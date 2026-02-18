import {
  AutomationStatus,
  AttachmentType,
  BackupStatus,
  ExecutionStatus,
  ImportSourceType,
  IssueStatus,
  Prisma,
  Priority,
  Role,
  Severity,
  TestCaseStatus,
  TestCaseType,
  TestSeverity,
  TestRunCaseStatus,
  TestRunStatus,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();
const prismaAny = prisma as any;

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
};

const parseEnum = <T extends Record<string, string>>(enumType: T, value: unknown): T[keyof T] | null => {
  if (typeof value !== "string") {
    return null;
  }

  return (Object.values(enumType) as string[]).includes(value) ? (value as T[keyof T]) : null;
};

const parseJsonValue = (value: unknown, fallback: Prisma.InputJsonValue): Prisma.InputJsonValue => {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      return value as Prisma.InputJsonValue;
    }
  }
  return value as Prisma.InputJsonValue;
};

const validateStepItems = (steps: unknown): string | null => {
  if (!Array.isArray(steps) || steps.length === 0) {
    return "steps must be a non-empty array";
  }

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i] as Record<string, unknown>;
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      return `steps[${i}] must be an object`;
    }
    if (typeof step.stepNumber !== "number" || !Number.isFinite(step.stepNumber)) {
      return `steps[${i}].stepNumber must be a number`;
    }
    if (!asString(step.action)) {
      return `steps[${i}].action is required`;
    }
    if (step.testData === undefined) {
      return `steps[${i}].testData is required`;
    }
    if (!asString(step.expectedResult)) {
      return `steps[${i}].expectedResult is required`;
    }
  }

  return null;
};

type StepExecutionItem = {
  stepNumber: number;
  action: string;
  expectedResult: string;
  status: ExecutionStatus | "NOT_EXECUTED";
  actualResult: string;
  notes: string;
};

const toExecutionStepItems = (steps: unknown): StepExecutionItem[] => {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, idx) => {
      const step = item as Record<string, unknown>;
      const rawStepNumber = step.stepNumber;
      const stepNumber =
        typeof rawStepNumber === "number" && Number.isFinite(rawStepNumber) ? rawStepNumber : idx + 1;
      return {
        stepNumber,
        action: asString(step.action) || `Step ${stepNumber}`,
        expectedResult: asString(step.expectedResult),
        status: "NOT_EXECUTED" as const,
        actualResult: "",
        notes: "",
      };
    })
    .sort((a, b) => a.stepNumber - b.stepNumber);
};

const parseStoredStepResults = (value: unknown): StepExecutionItem[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value as StepExecutionItem[];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as StepExecutionItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const deriveOverallResultFromSteps = (stepResults: StepExecutionItem[]): ExecutionStatus => {
  const executed = stepResults.filter((item) => item.status !== "NOT_EXECUTED");
  if (executed.some((item) => item.status === "FAILED")) return ExecutionStatus.FAILED;
  if (executed.some((item) => item.status === "BLOCKED")) return ExecutionStatus.BLOCKED;
  if (executed.length > 0 && executed.every((item) => item.status === "SKIPPED")) return ExecutionStatus.SKIPPED;
  if (executed.length > 0 && executed.every((item) => item.status === "PASSED")) return ExecutionStatus.PASSED;
  if (executed.some((item) => item.status === "PASSED")) return ExecutionStatus.PASSED;
  return ExecutionStatus.SKIPPED;
};

const deriveRunCaseStatus = (result: ExecutionStatus): TestRunCaseStatus => {
  switch (result) {
    case ExecutionStatus.PASSED:
      return TestRunCaseStatus.PASSED;
    case ExecutionStatus.FAILED:
      return TestRunCaseStatus.FAILED;
    case ExecutionStatus.BLOCKED:
      return TestRunCaseStatus.BLOCKED;
    case ExecutionStatus.SKIPPED:
      return TestRunCaseStatus.SKIPPED;
    default:
      return TestRunCaseStatus.NOT_RUN;
  }
};

const canManageExecution = (req: AuthRequest, executionUserId: string): boolean =>
  req.user!.role === Role.ADMIN || req.user!.userId === executionUserId;

const computeDurationSeconds = (start: Date, end: Date): number => {
  const diffMs = end.getTime() - start.getTime();
  return diffMs <= 0 ? 0 : Math.floor(diffMs / 1000);
};

type ExecutionMeta = {
  timerStartAt?: string;
  timerStopAt?: string;
  durationSeconds?: number;
  reexecutionOfId?: string;
};

const META_PREFIX = "[META]";
const META_SUFFIX = "[/META]";

const parseExecutionNotes = (notes: string | null): { userNotes: string; meta: ExecutionMeta } => {
  if (!notes) {
    return { userNotes: "", meta: {} };
  }
  const trimmed = notes.trim();
  if (!trimmed.startsWith(META_PREFIX)) {
    return { userNotes: notes, meta: {} };
  }
  const suffixIdx = trimmed.indexOf(META_SUFFIX);
  if (suffixIdx === -1) {
    return { userNotes: notes, meta: {} };
  }
  const jsonPart = trimmed.slice(META_PREFIX.length, suffixIdx);
  const textPart = trimmed.slice(suffixIdx + META_SUFFIX.length).trimStart();
  try {
    const parsed = JSON.parse(jsonPart) as ExecutionMeta;
    return { userNotes: textPart, meta: parsed ?? {} };
  } catch {
    return { userNotes: notes, meta: {} };
  }
};

const mergeExecutionNotes = (
  existingNotes: string | null,
  userNotes: string | null | undefined,
  metaPatch: Partial<ExecutionMeta>
): string => {
  const parsed = parseExecutionNotes(existingNotes);
  const mergedMeta: ExecutionMeta = { ...parsed.meta, ...metaPatch };
  const nextUserNotes = userNotes !== undefined && userNotes !== null ? userNotes : parsed.userNotes;
  return `${META_PREFIX}${JSON.stringify(mergedMeta)}${META_SUFFIX}\n${nextUserNotes ?? ""}`.trim();
};

const executionEvidencePrefix = (executionId: string): string => `EXEVID::${executionId}::`;

const BUG_PRIORITY = {
  P1_URGENT: "P1_URGENT",
  P2_HIGH: "P2_HIGH",
  P3_MEDIUM: "P3_MEDIUM",
  P4_LOW: "P4_LOW",
} as const;
type BugPriority = (typeof BUG_PRIORITY)[keyof typeof BUG_PRIORITY];

const BUG_WORKFLOW_STATUS = {
  NEW: "NEW",
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  FIXED: "FIXED",
  VERIFIED: "VERIFIED",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED",
  WONT_FIX: "WONT_FIX",
  DUPLICATE: "DUPLICATE",
} as const;
type BugWorkflowStatus = (typeof BUG_WORKFLOW_STATUS)[keyof typeof BUG_WORKFLOW_STATUS];

type BugMeta = {
  bugCode?: string;
  workflowStatus?: BugWorkflowStatus;
  priority?: BugPriority;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  environment?: string;
  affectedVersion?: string;
  linkedTestCaseCode?: string;
  dueDate?: string;
  duplicateOfBugCode?: string;
  resolutionReason?: string;
  mentions?: string[];
};

const BUG_META_PREFIX = "[BUGMETA]";
const BUG_META_SUFFIX = "[/BUGMETA]";

const parseBugDescription = (value: string): { details: string; meta: BugMeta } => {
  const text = (value || "").trim();
  if (!text.startsWith(BUG_META_PREFIX)) {
    return { details: value, meta: {} };
  }
  const idx = text.indexOf(BUG_META_SUFFIX);
  if (idx === -1) {
    return { details: value, meta: {} };
  }
  const jsonPart = text.slice(BUG_META_PREFIX.length, idx);
  const details = text.slice(idx + BUG_META_SUFFIX.length).trimStart();
  try {
    const meta = JSON.parse(jsonPart) as BugMeta;
    return { details, meta: meta ?? {} };
  } catch {
    return { details: value, meta: {} };
  }
};

const issueStatusFromWorkflow = (workflow: BugWorkflowStatus): IssueStatus => {
  switch (workflow) {
    case "IN_PROGRESS":
      return IssueStatus.IN_PROGRESS;
    case "FIXED":
    case "VERIFIED":
      return IssueStatus.FIXED;
    case "CLOSED":
      return IssueStatus.CLOSED;
    case "WONT_FIX":
    case "DUPLICATE":
      return IssueStatus.WONT_FIX;
    case "NEW":
    case "OPEN":
    case "REOPENED":
    default:
      return IssueStatus.OPEN;
  }
};

const parseMentions = (text: string): string[] => {
  const matches = text.match(/@([a-zA-Z0-9._-]+)/g) || [];
  return [...new Set(matches.map((item) => item.slice(1).toLowerCase()))];
};

const resolveActiveDeveloperId = async (raw: unknown): Promise<string | null> => {
  const input = asString(raw);
  if (!input) return null;
  const byId = await prisma.user.findUnique({ where: { id: input } });
  if (byId && byId.role === Role.DEVELOPER && byId.isActive) return byId.id;
  if (input.includes("@")) {
    const byEmail = await prisma.user.findUnique({ where: { email: input } });
    if (byEmail && byEmail.role === Role.DEVELOPER && byEmail.isActive) return byEmail.id;
  }
  return null;
};

const parseBugAttachments = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const fileType = parseEnum(AttachmentType, row.fileType);
      const fileUrl = asString(row.fileUrl);
      const fileName = asString(row.fileName);
      const notes = asString(row.notes) || null;
      if (!fileType || !fileUrl || !fileName) return null;
      return { fileType, fileUrl, fileName, notes };
    })
    .filter(Boolean) as Array<{ fileType: AttachmentType; fileUrl: string; fileName: string; notes: string | null }>;
};

const isAllowedWorkflowTransition = (from: BugWorkflowStatus, to: BugWorkflowStatus): boolean => {
  const map: Record<BugWorkflowStatus, BugWorkflowStatus[]> = {
    NEW: ["OPEN", "WONT_FIX", "DUPLICATE"],
    OPEN: ["IN_PROGRESS"],
    IN_PROGRESS: ["FIXED"],
    FIXED: ["VERIFIED", "REOPENED"],
    VERIFIED: ["CLOSED"],
    CLOSED: [],
    REOPENED: ["IN_PROGRESS"],
    WONT_FIX: [],
    DUPLICATE: [],
  };
  return map[from]?.includes(to) ?? false;
};

const enrichIssue = (issue: any) => {
  const parsed = parseBugDescription(issue.description || "");
  const workflowStatus = issue.workflowStatus || parsed.meta.workflowStatus || BUG_WORKFLOW_STATUS.OPEN;
  const bugPriority = issue.bugPriority || parsed.meta.priority || BUG_PRIORITY.P3_MEDIUM;
  return {
    ...issue,
    description: parsed.details || issue.description,
    bugMeta: {
      ...parsed.meta,
      stepsToReproduce: issue.stepsToReproduce || parsed.meta.stepsToReproduce,
      expectedBehavior: issue.expectedBehavior || parsed.meta.expectedBehavior,
      actualBehavior: issue.actualBehavior || parsed.meta.actualBehavior,
      environment: issue.environment || parsed.meta.environment,
      affectedVersion: issue.affectedVersion || parsed.meta.affectedVersion,
      dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString() : parsed.meta.dueDate,
      linkedTestCaseCode: issue.testCase?.testCaseCode || parsed.meta.linkedTestCaseCode,
    },
    bugId: issue.bugCode || parsed.meta.bugCode || issue.id,
    workflowStatus,
    priority: bugPriority,
  };
};

const isOwnerOrAssignee = (req: AuthRequest, createdBy: string, assignedTo: string | null): boolean =>
  req.user!.role === Role.ADMIN || req.user!.userId === createdBy || req.user!.userId === assignedTo;

const ensureIssueAccess = async (req: AuthRequest, issueId: string): Promise<{ allowed: boolean; issue?: { id: string } }> => {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, assignedTo: true },
  });
  if (!issue) {
    return { allowed: false };
  }
  if (req.user!.role === Role.ADMIN) {
    return { allowed: true, issue: { id: issue.id } };
  }
  if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
    return { allowed: false, issue: { id: issue.id } };
  }
  return { allowed: true, issue: { id: issue.id } };
};

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
};

const writeAuditLog = async (
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: object
) => {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      metadata: metadata ? (metadata as never) : undefined,
    },
  });
};

const generateTestCaseCode = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await prisma.testCase.count();
  const serial = String(count + 1).padStart(5, "0");
  return `TC-${year}-${serial}`;
};

const generateBugCode = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await prisma.issue.count();
  const serial = String(count + 1).padStart(5, "0");
  return `BUG-${year}-${serial}`;
};

router.use(authenticate);
router.use((req: AuthRequest, res: Response, next) => {
  if (req.user?.role === Role.ADMIN && !req.path.startsWith("/admin")) {
    return res.status(403).json({ message: "Admins can only access admin module endpoints." });
  }
  return next();
});

/* =========================
   TESTER/SHARED TEST CASE FLOWS
========================= */
router.get(
  "/testcases",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    const testCases = await prisma.testCase.findMany({
      where: { isDeleted: false },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        lastEditor: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(testCases);
  }
);

router.get(
  "/testcases/:id",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const testCase = await prisma.testCase.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        lastEditor: { select: { id: true, name: true, email: true } },
        attachments: true,
        executions: { orderBy: { executedAt: "desc" } },
        issues: { include: { comments: true } },
        suiteLinks: { include: { suite: true } },
      },
    });

    if (!testCase || testCase.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }
    return res.json(testCase);
  }
);

router.post("/testcases", authorizeRoles(Role.TESTER), async (req: AuthRequest, res: Response) => {
  const title = asString(req.body.title);
  const description = asString(req.body.description);
  const preConditions = parseJsonValue(req.body.preConditions, []);
  const testDataRequirements = parseJsonValue(req.body.testDataRequirements, []);
  const environmentRequirements = parseJsonValue(req.body.environmentRequirements, []);
  const postConditions = parseJsonValue(req.body.postConditions, []);
  const metadata = parseJsonValue(req.body.metadata, {});
  const moduleName = asString(req.body.module);
  const steps = parseJsonValue(req.body.steps, []);
  const priority = parseEnum(Priority, req.body.priority) || Priority.MEDIUM;
  const severity = parseEnum(TestSeverity, req.body.severity) || TestSeverity.MAJOR;
  const type = parseEnum(TestCaseType, req.body.type) || TestCaseType.FUNCTIONAL;
  const status = parseEnum(TestCaseStatus, req.body.status) || TestCaseStatus.DRAFT;
  const tags = asStringArray(req.body.tags);
  const estimatedDurationMinutes =
    typeof req.body.estimatedDurationMinutes === "number" ? req.body.estimatedDurationMinutes : null;
  const automationStatus =
    parseEnum(AutomationStatus, req.body.automationStatus) || AutomationStatus.NOT_AUTOMATED;
  const automationScriptLink = asString(req.body.automationScriptLink) || null;
  const assignedTo = asString(req.body.assignedTo) || null;
  const projectId = asString(req.body.projectId) || null;
  const requestedCode = asString(req.body.testCaseCode);

  if (
    !title ||
    !description ||
    !moduleName ||
    !steps ||
    req.body.preConditions === undefined ||
    req.body.testDataRequirements === undefined ||
    req.body.environmentRequirements === undefined ||
    req.body.postConditions === undefined
  ) {
    return res.status(400).json({
      message:
        "title, description, preConditions, testDataRequirements, environmentRequirements, steps, postConditions, module, priority, severity, type, and status are required",
    });
  }
  if (title.length > 200) {
    return res.status(400).json({ message: "Title cannot exceed 200 characters" });
  }
  const stepsValidationError = validateStepItems(steps);
  if (stepsValidationError) {
    return res.status(400).json({ message: stepsValidationError });
  }

  const nextCode = requestedCode || (await generateTestCaseCode());
  const created = await prisma.testCase.create({
    data: {
      testCaseCode: nextCode,
      title,
      description,
      preConditions,
      testDataRequirements,
      environmentRequirements,
      postConditions,
      metadata,
      module: moduleName,
      steps,
      priority,
      severity,
      type,
      status,
      tags,
      estimatedDurationMinutes,
      automationStatus,
      automationScriptLink,
      createdBy: req.user!.userId,
      lastModifiedBy: req.user!.userId,
      lastModifiedAt: new Date(),
      assignedTo,
      projectId,
    },
  });

  await writeAuditLog(req.user!.userId, "CREATE_TEST_CASE", "TestCase", created.id, {
    title: created.title,
    priority: created.priority,
  });

  return res.status(201).json(created);
});

router.put("/testcases/:id", authorizeRoles(Role.TESTER), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.isDeleted) {
    return res.status(404).json({ message: "Test case not found" });
  }
  if (!isOwnerOrAssignee(req, existing.createdBy, existing.assignedTo)) {
    return res.status(403).json({ message: "You can edit only owned/assigned test cases" });
  }
  const changeSummary = asString(req.body.changeSummary);
  if (!changeSummary) {
    return res.status(400).json({ message: "changeSummary is required for edit" });
  }
  if (req.body.steps !== undefined) {
    const stepsValidationError = validateStepItems(parseJsonValue(req.body.steps, []));
    if (stepsValidationError) {
      return res.status(400).json({ message: stepsValidationError });
    }
  }

  const updated = await prisma.testCase.update({
    where: { id: req.params.id },
    data: {
      title: asString(req.body.title) || undefined,
      description: asString(req.body.description) || undefined,
      preConditions:
        req.body.preConditions !== undefined ? parseJsonValue(req.body.preConditions, []) : undefined,
      testDataRequirements:
        req.body.testDataRequirements !== undefined
          ? parseJsonValue(req.body.testDataRequirements, [])
          : undefined,
      environmentRequirements:
        req.body.environmentRequirements !== undefined
          ? parseJsonValue(req.body.environmentRequirements, [])
          : undefined,
      postConditions:
        req.body.postConditions !== undefined ? parseJsonValue(req.body.postConditions, []) : undefined,
      metadata: req.body.metadata !== undefined ? parseJsonValue(req.body.metadata, {}) : undefined,
      module: asString(req.body.module) || undefined,
      steps: req.body.steps !== undefined ? parseJsonValue(req.body.steps, []) : undefined,
      status: parseEnum(TestCaseStatus, req.body.status) ?? undefined,
      priority: parseEnum(Priority, req.body.priority) ?? undefined,
      severity: parseEnum(TestSeverity, req.body.severity) ?? undefined,
      type: parseEnum(TestCaseType, req.body.type) ?? undefined,
      tags: req.body.tags !== undefined ? asStringArray(req.body.tags) : undefined,
      estimatedDurationMinutes:
        typeof req.body.estimatedDurationMinutes === "number"
          ? req.body.estimatedDurationMinutes
          : undefined,
      automationStatus: parseEnum(AutomationStatus, req.body.automationStatus) ?? undefined,
      automationScriptLink: req.body.automationScriptLink !== undefined ? asString(req.body.automationScriptLink) || null : undefined,
      version: { increment: 1 },
      lastModifiedBy: req.user!.userId,
      lastModifiedAt: new Date(),
      assignedTo: asString(req.body.assignedTo) || undefined,
    },
  });

  await prisma.testCaseVersion.create({
    data: {
      testCaseId: updated.id,
      version: updated.version,
      changedBy: req.user!.userId,
      changeSummary,
      snapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog(req.user!.userId, "EDIT_TEST_CASE", "TestCase", updated.id);
  return res.json(updated);
});

router.delete(
  "/testcases/:id",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }
    if (!isOwnerOrAssignee(req, existing.createdBy, existing.assignedTo)) {
      return res.status(403).json({ message: "You can delete only owned/assigned test cases" });
    }

    const deleted = await prisma.testCase.update({
      where: { id: req.params.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await writeAuditLog(req.user!.userId, "SOFT_DELETE_TEST_CASE", "TestCase", deleted.id);
    return res.json({ message: "Test case soft-deleted", testCase: deleted });
  }
);

router.post(
  "/testcases/:id/restore",
  authorizeRoles(Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing || !existing.isDeleted) {
      return res.status(404).json({ message: "Deleted test case not found" });
    }
    const restored = await prisma.testCase.update({
      where: { id: req.params.id },
      data: { isDeleted: false, deletedAt: null, lastModifiedBy: req.user!.userId, lastModifiedAt: new Date() },
    });
    await writeAuditLog(req.user!.userId, "RESTORE_TEST_CASE", "TestCase", restored.id);
    return res.json(restored);
  }
);

router.delete(
  "/testcases/:id/permanent",
  authorizeRoles(Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Test case not found" });
    }
    await prisma.testCase.delete({ where: { id: req.params.id } });
    await writeAuditLog(req.user!.userId, "PERMANENT_DELETE_TEST_CASE", "TestCase", req.params.id);
    return res.json({ message: "Test case permanently deleted" });
  }
);

router.get(
  "/testcases/:id/versions",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const versions = await prisma.testCaseVersion.findMany({
      where: { testCaseId: req.params.id },
      include: { editor: { select: { id: true, name: true, email: true } } },
      orderBy: { version: "desc" },
    });
    return res.json(versions);
  }
);

router.post(
  "/testcases/:id/clone",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }
    if (!isOwnerOrAssignee(req, existing.createdBy, existing.assignedTo)) {
      return res.status(403).json({ message: "You can clone only owned/assigned test cases" });
    }

    const titleSuffix = asString(req.body.titleSuffix) || " (Clone)";
    const includeAttachments = Boolean(req.body.includeAttachments);
    const nextCode = await generateTestCaseCode();
    const cloned = await prisma.testCase.create({
      data: {
        testCaseCode: nextCode,
        title: `${existing.title}${titleSuffix}`,
        description: existing.description,
        preConditions: existing.preConditions ?? [],
        testDataRequirements: existing.testDataRequirements ?? [],
        environmentRequirements: existing.environmentRequirements ?? [],
        postConditions: existing.postConditions ?? [],
        metadata: existing.metadata ?? {},
        module: existing.module,
        steps: existing.steps as never,
        priority: existing.priority,
        severity: existing.severity,
        type: existing.type,
        status: TestCaseStatus.DRAFT,
        tags: existing.tags,
        estimatedDurationMinutes: existing.estimatedDurationMinutes,
        automationStatus: existing.automationStatus,
        automationScriptLink: existing.automationScriptLink,
        version: 1,
        createdBy: req.user!.userId,
        lastModifiedBy: req.user!.userId,
        lastModifiedAt: new Date(),
        assignedTo: req.user!.userId,
        projectId: existing.projectId,
      },
    });
    if (includeAttachments) {
      const sourceAttachments = await prisma.attachment.findMany({ where: { testCaseId: existing.id } });
      if (sourceAttachments.length > 0) {
        await prisma.attachment.createMany({
          data: sourceAttachments.map((item) => ({
            testCaseId: cloned.id,
            uploadedBy: req.user!.userId,
            fileType: item.fileType,
            fileUrl: item.fileUrl,
            fileName: item.fileName,
          })),
        });
      }
    }

    await writeAuditLog(req.user!.userId, "CLONE_TEST_CASE", "TestCase", cloned.id, {
      sourceTestCaseId: existing.id,
    });
    return res.status(201).json(cloned);
  }
);

router.post(
  "/testcase-templates",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const name = asString(req.body.name);
    const category = asString(req.body.category) || null;
    const description = asString(req.body.description) || null;
    const preConditions = parseJsonValue(req.body.preConditions, []);
    const testDataRequirements = parseJsonValue(req.body.testDataRequirements, []);
    const environmentRequirements = parseJsonValue(req.body.environmentRequirements, []);
    const postConditions = parseJsonValue(req.body.postConditions, []);
    const metadata = parseJsonValue(req.body.metadata, {});
    const moduleName = asString(req.body.module) || null;
    const sourceTestCaseId = asString(req.body.sourceTestCaseId) || null;
    let steps = parseJsonValue(req.body.steps, []);
    const priority = parseEnum(Priority, req.body.priority) || Priority.MEDIUM;
    const severity = parseEnum(TestSeverity, req.body.severity) || TestSeverity.MAJOR;
    const type = parseEnum(TestCaseType, req.body.type) || TestCaseType.FUNCTIONAL;
    const status = parseEnum(TestCaseStatus, req.body.status) || TestCaseStatus.DRAFT;
    const tags = asStringArray(req.body.tags);
    const estimatedDurationMinutes =
      typeof req.body.estimatedDurationMinutes === "number" ? req.body.estimatedDurationMinutes : null;
    const automationStatus =
      parseEnum(AutomationStatus, req.body.automationStatus) || AutomationStatus.NOT_AUTOMATED;
    const automationScriptLink = asString(req.body.automationScriptLink) || null;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    let resolvedModule = moduleName;
    let resolvedPriority = priority;
    let resolvedSeverity = severity;
    let resolvedType = type;
    let resolvedStatus = status;
    let resolvedPreConditions = preConditions;
    let resolvedTestDataRequirements = testDataRequirements;
    let resolvedEnvironmentRequirements = environmentRequirements;
    let resolvedPostConditions = postConditions;
    let resolvedMetadata = metadata;
    let resolvedTags = tags;
    let resolvedEstimatedDurationMinutes = estimatedDurationMinutes;
    let resolvedAutomationStatus = automationStatus;
    let resolvedAutomationScriptLink = automationScriptLink;

    if (sourceTestCaseId) {
      const source = await prisma.testCase.findUnique({ where: { id: sourceTestCaseId } });
      if (!source || source.isDeleted) {
        return res.status(404).json({ message: "Source test case not found" });
      }
      steps = (source.steps ?? []) as Prisma.InputJsonValue;
      resolvedPreConditions = source.preConditions ?? [];
      resolvedTestDataRequirements = source.testDataRequirements ?? [];
      resolvedEnvironmentRequirements = source.environmentRequirements ?? [];
      resolvedPostConditions = source.postConditions ?? [];
      resolvedMetadata = source.metadata ?? {};
      resolvedTags = source.tags;
      resolvedEstimatedDurationMinutes = source.estimatedDurationMinutes;
      resolvedAutomationStatus = source.automationStatus;
      resolvedAutomationScriptLink = source.automationScriptLink;
      resolvedModule = source.module;
      resolvedPriority = source.priority;
      resolvedSeverity = source.severity || severity;
      resolvedType = source.type || type;
      resolvedStatus = source.status;
    }

    if (!steps) {
      return res.status(400).json({ message: "name and steps are required" });
    }
    const stepsValidationError = validateStepItems(steps);
    if (stepsValidationError) {
      return res.status(400).json({ message: stepsValidationError });
    }

    const template = await prisma.testCaseTemplate.create({
      data: {
        name,
        category,
        description,
        preConditions: resolvedPreConditions,
        testDataRequirements: resolvedTestDataRequirements,
        environmentRequirements: resolvedEnvironmentRequirements,
        postConditions: resolvedPostConditions,
        metadata: resolvedMetadata,
        module: resolvedModule,
        sourceTestCaseId,
        steps,
        priority: resolvedPriority,
        severity: resolvedSeverity,
        type: resolvedType,
        status: resolvedStatus,
        tags: resolvedTags,
        estimatedDurationMinutes: resolvedEstimatedDurationMinutes,
        automationStatus: resolvedAutomationStatus,
        automationScriptLink: resolvedAutomationScriptLink,
        createdBy: req.user!.userId,
      },
    });
    await writeAuditLog(req.user!.userId, "CREATE_TEST_CASE_TEMPLATE", "TestCaseTemplate", template.id);
    return res.status(201).json(template);
  }
);

router.post(
  "/testcase-templates/from-testcase/:id",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const source = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!source || source.isDeleted) {
      return res.status(404).json({ message: "Source test case not found" });
    }

    const template = await prisma.testCaseTemplate.create({
      data: {
        name: asString(req.body.name) || `${source.title} Template`,
        category: asString(req.body.category) || null,
        description: asString(req.body.description) || source.description,
        preConditions: source.preConditions ?? [],
        testDataRequirements: source.testDataRequirements ?? [],
        environmentRequirements: source.environmentRequirements ?? [],
        postConditions: source.postConditions ?? [],
        metadata: source.metadata ?? {},
        module: source.module,
        sourceTestCaseId: source.id,
        steps: source.steps as never,
        priority: source.priority,
        severity: source.severity || TestSeverity.MAJOR,
        type: source.type || TestCaseType.FUNCTIONAL,
        status: source.status,
        tags: source.tags,
        estimatedDurationMinutes: source.estimatedDurationMinutes,
        automationStatus: source.automationStatus,
        automationScriptLink: source.automationScriptLink,
        createdBy: req.user!.userId,
      },
    });

    await writeAuditLog(req.user!.userId, "CREATE_TEMPLATE_FROM_TEST_CASE", "TestCaseTemplate", template.id, {
      sourceTestCaseId: source.id,
    });
    return res.status(201).json(template);
  }
);

router.get(
  "/testcase-templates",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    const templates = await prisma.testCaseTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(templates);
  }
);

router.post(
  "/testcases/from-template/:templateId",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const template = await prisma.testCaseTemplate.findUnique({ where: { id: req.params.templateId } });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const title = asString(req.body.title) || template.name;
    const description = asString(req.body.description) || template.description || "Generated from template";
    const preConditions = parseJsonValue(req.body.preConditions, template.preConditions ?? []);
    const testDataRequirements = parseJsonValue(
      req.body.testDataRequirements,
      template.testDataRequirements ?? []
    );
    const environmentRequirements = parseJsonValue(
      req.body.environmentRequirements,
      template.environmentRequirements ?? []
    );
    const postConditions = parseJsonValue(req.body.postConditions, template.postConditions ?? []);
    const metadata = parseJsonValue(req.body.metadata, template.metadata ?? {});
    const moduleName = asString(req.body.module) || template.module || "General";
    const assignedTo = asString(req.body.assignedTo) || null;
    const projectId = asString(req.body.projectId) || null;
    const nextCode = await generateTestCaseCode();

    const created = await prisma.testCase.create({
      data: {
        testCaseCode: nextCode,
        title,
        description,
        preConditions,
        testDataRequirements,
        environmentRequirements,
        postConditions,
        metadata,
        module: moduleName,
        steps: template.steps as never,
        priority: template.priority,
        severity: template.severity,
        type: template.type,
        status: template.status,
        tags: template.tags,
        estimatedDurationMinutes: template.estimatedDurationMinutes,
        automationStatus: template.automationStatus,
        automationScriptLink: template.automationScriptLink,
        createdBy: req.user!.userId,
        lastModifiedBy: req.user!.userId,
        lastModifiedAt: new Date(),
        assignedTo,
        projectId,
      },
    });
    await writeAuditLog(req.user!.userId, "CREATE_TEST_CASE_FROM_TEMPLATE", "TestCase", created.id, {
      templateId: template.id,
    });
    return res.status(201).json(created);
  }
);

router.post(
  "/testcases/bulk",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const operation = asString(req.body.operation).toUpperCase();
    const idsRaw = Array.isArray(req.body.ids) ? req.body.ids : [];
    const ids = idsRaw
      .map((id: unknown) => asString(id))
      .filter((id: string) => Boolean(id));

    if (!operation || ids.length === 0) {
      return res.status(400).json({ message: "operation and non-empty ids are required" });
    }

    const ownedOrAssignedFilter =
      req.user!.role === Role.ADMIN
        ? { id: { in: ids }, isDeleted: false }
        : {
            id: { in: ids },
            isDeleted: false,
            OR: [{ createdBy: req.user!.userId }, { assignedTo: req.user!.userId }],
          };

    const found = await prisma.testCase.findMany({ where: ownedOrAssignedFilter, select: { id: true } });
    const allowedIds = found.map((item) => item.id);
    if (allowedIds.length === 0) {
      return res.status(403).json({ message: "No authorized test cases for bulk operation" });
    }

    let resultCount = 0;
    if (operation === "ASSIGN") {
      const assignedTo = asString(req.body.assignedTo);
      if (!assignedTo) {
        return res.status(400).json({ message: "assignedTo is required for ASSIGN" });
      }
      const result = await prisma.testCase.updateMany({
        where: { id: { in: allowedIds } },
        data: { assignedTo },
      });
      resultCount = result.count;
    } else if (operation === "STATUS") {
      const status = parseEnum(TestCaseStatus, req.body.status);
      if (!status) {
        return res.status(400).json({ message: "Valid status is required for STATUS" });
      }
      const result = await prisma.testCase.updateMany({
        where: { id: { in: allowedIds } },
        data: { status },
      });
      resultCount = result.count;
    } else if (operation === "PRIORITY") {
      const priority = parseEnum(Priority, req.body.priority);
      if (!priority) {
        return res.status(400).json({ message: "Valid priority is required for PRIORITY" });
      }
      const result = await prisma.testCase.updateMany({
        where: { id: { in: allowedIds } },
        data: { priority },
      });
      resultCount = result.count;
    } else if (operation === "SEVERITY") {
      const severity = parseEnum(TestSeverity, req.body.severity);
      if (!severity) {
        return res.status(400).json({ message: "Valid severity is required for SEVERITY" });
      }
      const result = await prisma.testCase.updateMany({
        where: { id: { in: allowedIds } },
        data: { severity },
      });
      resultCount = result.count;
    } else if (operation === "MOVE_MODULE") {
      const moduleName = asString(req.body.module);
      if (!moduleName) {
        return res.status(400).json({ message: "module is required for MOVE_MODULE" });
      }
      const result = await prisma.testCase.updateMany({
        where: { id: { in: allowedIds } },
        data: { module: moduleName },
      });
      resultCount = result.count;
    } else if (operation === "MOVE_SUITE") {
      const suiteId = asString(req.body.suiteId);
      if (!suiteId) {
        return res.status(400).json({ message: "suiteId is required for MOVE_SUITE" });
      }
      for (const testCaseId of allowedIds) {
        await prisma.testSuiteCase.upsert({
          where: { suiteId_testCaseId: { suiteId, testCaseId } },
          create: { suiteId, testCaseId },
          update: {},
        });
      }
      resultCount = allowedIds.length;
    } else if (operation === "EXPORT_CSV" || operation === "EXPORT_EXCEL") {
      const rows = await prisma.testCase.findMany({
        where: { id: { in: allowedIds } },
        orderBy: { createdAt: "desc" },
      });
      const header =
        "testCaseCode,title,description,module,priority,severity,type,status,version,tags,estimatedDurationMinutes,automationStatus,automationScriptLink";
      const csvRows = rows.map((item) =>
        [
          item.testCaseCode || "",
          item.title,
          item.description,
          item.module || "",
          item.priority,
          item.severity || "",
          item.type || "",
          item.status,
          String(item.version),
          item.tags.join("|"),
          item.estimatedDurationMinutes ?? "",
          item.automationStatus,
          item.automationScriptLink || "",
        ]
          .map((value) => `"${String(value).replace(/\"/g, "\"\"")}"`)
          .join(",")
      );
      return res.json({
        operation,
        format: operation === "EXPORT_EXCEL" ? "EXCEL_COMPATIBLE_CSV" : "CSV",
        fileName: `testcases_${new Date().toISOString().slice(0, 10)}.csv`,
        content: [header, ...csvRows].join("\n"),
      });
    } else if (operation === "DELETE") {
      if (!req.body.confirm) {
        return res.status(400).json({ message: "confirm=true is required for DELETE" });
      }
      const result = await prisma.testCase.updateMany({
        where: { id: { in: allowedIds } },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      resultCount = result.count;
    } else {
      return res.status(400).json({
        message:
          "Unsupported operation. Use ASSIGN, STATUS, PRIORITY, SEVERITY, MOVE_MODULE, MOVE_SUITE, EXPORT_CSV, EXPORT_EXCEL, or DELETE.",
      });
    }

    await writeAuditLog(req.user!.userId, "BULK_TEST_CASE_OPERATION", "TestCase", "bulk", {
      operation,
      ids: allowedIds,
      count: resultCount,
    });
    return res.json({ operation, processed: resultCount, ids: allowedIds });
  }
);

router.post(
  "/testcases/import",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const sourceType = parseEnum(ImportSourceType, asString(req.body.sourceType).toUpperCase());
    if (!sourceType) {
      return res.status(400).json({ message: "sourceType is required: JSON, CSV, or EXCEL" });
    }
    const preview = Boolean(req.body.preview);
    const confirmImport = Boolean(req.body.confirm);
    if (!preview && !confirmImport) {
      return res.status(400).json({ message: "confirm=true is required for final import" });
    }
    const fieldMapping =
      req.body.fieldMapping && typeof req.body.fieldMapping === "object"
        ? (req.body.fieldMapping as Record<string, string>)
        : {};
    const mapKey = (key: string): string => (fieldMapping[key] || key).toLowerCase();

    const projectId = asString(req.body.projectId) || null;
    const assignedTo = asString(req.body.assignedTo) || null;
    const errors: string[] = [];
    const createdIds: string[] = [];

    let records: Array<{
      title: string;
      description: string;
      preConditions: Prisma.InputJsonValue;
      testDataRequirements: Prisma.InputJsonValue;
      environmentRequirements: Prisma.InputJsonValue;
      postConditions: Prisma.InputJsonValue;
      metadata: Prisma.InputJsonValue;
      module: string;
      steps: Prisma.InputJsonValue;
      priority?: Priority;
      severity?: TestSeverity;
      type?: TestCaseType;
      status?: TestCaseStatus;
      tags?: string[];
      estimatedDurationMinutes?: number | null;
      automationStatus?: AutomationStatus;
      automationScriptLink?: string | null;
    }> = [];

    if (sourceType === ImportSourceType.JSON) {
      const rawItems = req.body.items;
      const items =
        Array.isArray(rawItems)
          ? rawItems
          : rawItems && typeof rawItems === "object"
          ? [rawItems]
          : [];
      records = items.map((item: unknown) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const read = (canonical: string): unknown => row[fieldMapping[canonical] || canonical];
        return {
          title: asString(read("title")),
          description: asString(read("description")),
          preConditions: parseJsonValue(read("preConditions"), []),
          testDataRequirements: parseJsonValue(read("testDataRequirements"), []),
          environmentRequirements: parseJsonValue(read("environmentRequirements"), []),
          postConditions: parseJsonValue(read("postConditions"), []),
          metadata: parseJsonValue(read("metadata"), {}),
          module: asString(read("module")) || "General",
          steps: parseJsonValue(read("steps"), []),
          priority: parseEnum(Priority, read("priority")) || Priority.MEDIUM,
          severity: parseEnum(TestSeverity, read("severity")) || TestSeverity.MAJOR,
          type: parseEnum(TestCaseType, read("type")) || TestCaseType.FUNCTIONAL,
          status: parseEnum(TestCaseStatus, read("status")) || TestCaseStatus.DRAFT,
          tags: asStringArray(read("tags")),
          estimatedDurationMinutes:
            typeof read("estimatedDurationMinutes") === "number"
              ? (read("estimatedDurationMinutes") as number)
              : null,
          automationStatus:
            parseEnum(AutomationStatus, read("automationStatus")) || AutomationStatus.NOT_AUTOMATED,
          automationScriptLink: asString(read("automationScriptLink")) || null,
        };
      });
    } else if (sourceType === ImportSourceType.CSV) {
      const csvText = asString(req.body.csvText);
      if (!csvText) {
        return res.status(400).json({ message: "csvText is required for CSV import" });
      }
      const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV requires header + at least one row" });
      }
      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      records = lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        const map: Record<string, string> = {};
        headers.forEach((h, idx) => {
          map[h] = (cells[idx] || "").trim();
        });
        const read = (canonical: string): string => map[mapKey(canonical)] || "";
        let parsedSteps: Prisma.InputJsonValue = [];
        try {
          parsedSteps = read("steps") ? (JSON.parse(read("steps")) as Prisma.InputJsonValue) : [];
        } catch {
          parsedSteps = (read("steps") || []) as Prisma.InputJsonValue;
        }
        return {
          title: read("title"),
          description: read("description"),
          preConditions: read("preConditions") ? parseJsonValue(read("preConditions"), []) : [],
          testDataRequirements: read("testDataRequirements")
            ? parseJsonValue(read("testDataRequirements"), [])
            : [],
          environmentRequirements: read("environmentRequirements")
            ? parseJsonValue(read("environmentRequirements"), [])
            : [],
          postConditions: read("postConditions") ? parseJsonValue(read("postConditions"), []) : [],
          metadata: read("metadata") ? parseJsonValue(read("metadata"), {}) : {},
          module: read("module") || "General",
          steps: parsedSteps,
          priority: parseEnum(Priority, read("priority")) || Priority.MEDIUM,
          severity: parseEnum(TestSeverity, read("severity")) || TestSeverity.MAJOR,
          type: parseEnum(TestCaseType, read("type")) || TestCaseType.FUNCTIONAL,
          status: parseEnum(TestCaseStatus, read("status")) || TestCaseStatus.DRAFT,
          tags: read("tags")
            ? read("tags")
                .split("|")
                .map((item) => item.trim())
                .filter(Boolean)
            : [],
          estimatedDurationMinutes: read("estimatedDurationMinutes")
            ? Number(read("estimatedDurationMinutes"))
            : null,
          automationStatus:
            parseEnum(AutomationStatus, read("automationStatus")) || AutomationStatus.NOT_AUTOMATED,
          automationScriptLink: read("automationScriptLink") || null,
        };
      });
    } else {
      const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
      records = rows.map((item: unknown) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const read = (canonical: string): unknown => row[fieldMapping[canonical] || canonical];
        return {
          title: asString(read("title")),
          description: asString(read("description")),
          preConditions: parseJsonValue(read("preConditions"), []),
          testDataRequirements: parseJsonValue(read("testDataRequirements"), []),
          environmentRequirements: parseJsonValue(read("environmentRequirements"), []),
          postConditions: parseJsonValue(read("postConditions"), []),
          metadata: parseJsonValue(read("metadata"), {}),
          module: asString(read("module")) || "General",
          steps: parseJsonValue(read("steps"), []),
          priority: parseEnum(Priority, read("priority")) || Priority.MEDIUM,
          severity: parseEnum(TestSeverity, read("severity")) || TestSeverity.MAJOR,
          type: parseEnum(TestCaseType, read("type")) || TestCaseType.FUNCTIONAL,
          status: parseEnum(TestCaseStatus, read("status")) || TestCaseStatus.DRAFT,
          tags: asStringArray(read("tags")),
          estimatedDurationMinutes:
            typeof read("estimatedDurationMinutes") === "number"
              ? (read("estimatedDurationMinutes") as number)
              : null,
          automationStatus:
            parseEnum(AutomationStatus, read("automationStatus")) || AutomationStatus.NOT_AUTOMATED,
          automationScriptLink: asString(read("automationScriptLink")) || null,
        };
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        message:
          "No import rows found. Provide at least one row/item for the selected source type before preview/confirm.",
      });
    }

    for (let idx = 0; idx < records.length; idx += 1) {
      const record = records[idx];
      if (
        !record.title ||
        !record.description ||
        !record.module ||
        record.steps === undefined ||
        record.preConditions === undefined ||
        record.testDataRequirements === undefined ||
        record.environmentRequirements === undefined ||
        record.postConditions === undefined
      ) {
        errors.push(
          `Row ${idx + 1}: title, description, preConditions, testDataRequirements, environmentRequirements, module, steps, and postConditions are required`
        );
        continue;
      }
      if (record.title.length > 200) {
        errors.push(`Row ${idx + 1}: title exceeds 200 characters`);
        continue;
      }
      const stepsValidationError = validateStepItems(record.steps);
      if (stepsValidationError) {
        errors.push(`Row ${idx + 1}: ${stepsValidationError}`);
        continue;
      }
      if (record.estimatedDurationMinutes !== null && Number.isNaN(record.estimatedDurationMinutes)) {
        errors.push(`Row ${idx + 1}: estimatedDurationMinutes must be a number`);
      }
    }

    if (preview) {
      return res.json({
        message: "Import preview generated",
        total: records.length,
        failed: errors.length,
        success: records.length - errors.length,
        errors,
        preview: records.slice(0, 50),
      });
    }

    for (let idx = 0; idx < records.length; idx += 1) {
      const record = records[idx];
      if (
        !record.title ||
        !record.description ||
        !record.module ||
        record.steps === undefined ||
        record.preConditions === undefined ||
        record.testDataRequirements === undefined ||
        record.environmentRequirements === undefined ||
        record.postConditions === undefined
      ) {
        continue;
      }
      if (record.title.length > 200) {
        continue;
      }
      const stepsValidationError = validateStepItems(record.steps);
      if (stepsValidationError) {
        continue;
      }
      if (record.estimatedDurationMinutes !== null && Number.isNaN(record.estimatedDurationMinutes)) {
        continue;
      }
      try {
        const nextCode = await generateTestCaseCode();
        const created = await prisma.testCase.create({
          data: {
            testCaseCode: nextCode,
            title: record.title,
            description: record.description,
            preConditions: record.preConditions,
            testDataRequirements: record.testDataRequirements,
            environmentRequirements: record.environmentRequirements,
            postConditions: record.postConditions,
            metadata: record.metadata,
            module: record.module,
            steps: record.steps as never,
            priority: record.priority || Priority.MEDIUM,
            severity: record.severity || TestSeverity.MAJOR,
            type: record.type || TestCaseType.FUNCTIONAL,
            status: record.status || TestCaseStatus.DRAFT,
            tags: record.tags || [],
            estimatedDurationMinutes: record.estimatedDurationMinutes ?? null,
            automationStatus: record.automationStatus || AutomationStatus.NOT_AUTOMATED,
            automationScriptLink: record.automationScriptLink || null,
            createdBy: req.user!.userId,
            lastModifiedBy: req.user!.userId,
            lastModifiedAt: new Date(),
            assignedTo,
            projectId,
          },
        });
        createdIds.push(created.id);
      } catch (error) {
        errors.push(`Row ${idx + 1}: failed to create`);
      }
    }

    const job = await prisma.testCaseImportJob.create({
      data: {
        importedBy: req.user!.userId,
        sourceType,
        totalRecords: records.length,
        successCount: createdIds.length,
        failedCount: errors.length,
        errors: errors.length > 0 ? (errors as never) : undefined,
        createdIds,
      },
    });

    await writeAuditLog(req.user!.userId, "IMPORT_TEST_CASES", "TestCaseImportJob", job.id, {
      total: records.length,
      success: createdIds.length,
      failed: errors.length,
    });

    return res.status(201).json({
      message: "Import completed",
      importJobId: job.id,
      total: records.length,
      success: createdIds.length,
      failed: errors.length,
      errors,
      createdIds,
    });
  }
);

router.get(
  "/executions/testcases/:id/open",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }

    const testRunId = asString(req.query.testRunId);
    if (testRunId) {
      const run = await prisma.testRun.findUnique({
        where: { id: testRunId },
        include: { assignments: true, testCases: true },
      });
      if (!run) {
        return res.status(404).json({ message: "Test run not found" });
      }
      const assigned = run.assignments.some((item: { testerId: string }) => item.testerId === req.user!.userId);
      const included = run.testCases.some((item: { testCaseId: string }) => item.testCaseId === existing.id);
      if (req.user!.role !== Role.ADMIN && (!assigned || !included)) {
        return res.status(403).json({ message: "You are not assigned to execute this test case in the selected run" });
      }
    }

    const latestDraft = await prisma.testExecution.findFirst({
      where: {
        testCaseId: existing.id,
        executedBy: req.user!.userId,
        testRunId: testRunId || null,
        isDraft: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const defaultSteps = toExecutionStepItems(existing.steps);
    const storedSteps = latestDraft?.stepResults ? parseStoredStepResults(latestDraft.stepResults) : [];

    const mergedSteps =
      storedSteps.length > 0
        ? defaultSteps.map((step) => {
            const found = storedSteps.find((item) => item.stepNumber === step.stepNumber);
            return found ? { ...step, ...found } : step;
          })
        : defaultSteps;

    const parsedDraft = parseExecutionNotes(latestDraft?.notes ?? null);
    const evidence =
      latestDraft
        ? await prisma.attachment.findMany({
            where: {
              testCaseId: existing.id,
              fileName: {
                startsWith: executionEvidencePrefix(latestDraft.id),
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

    return res.json({
      testCase: existing,
      draftExecution: latestDraft
        ? {
            id: latestDraft.id,
            progressPercent: latestDraft.progressPercent,
            notes: parsedDraft.userNotes,
            startedAt: parsedDraft.meta.timerStartAt || null,
            completedAt: parsedDraft.meta.timerStopAt || null,
            durationSeconds:
              typeof parsedDraft.meta.durationSeconds === "number" ? parsedDraft.meta.durationSeconds : null,
            reexecutionOfId: parsedDraft.meta.reexecutionOfId || null,
            evidence,
            stepResults: mergedSteps,
          }
        : null,
      stepResults: mergedSteps,
    });
  }
);

router.post(
  "/executions/testcases/:id/start",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }

    const testRunId = asString(req.body.testRunId) || null;
    if (testRunId) {
      const run = await prisma.testRun.findUnique({
        where: { id: testRunId },
        include: { assignments: true, testCases: true },
      });
      if (!run) {
        return res.status(404).json({ message: "Test run not found" });
      }
      const assigned = run.assignments.some((item: { testerId: string }) => item.testerId === req.user!.userId);
      const included = run.testCases.some((item: { testCaseId: string }) => item.testCaseId === existing.id);
      if (req.user!.role !== Role.ADMIN && (!assigned || !included)) {
        return res.status(403).json({ message: "You are not assigned to this test run/test case" });
      }
    }

    const execution = await prisma.testExecution.create({
      data: {
        testCaseId: existing.id,
        executedBy: req.user!.userId,
        testRunId,
        result: ExecutionStatus.SKIPPED,
        notes: mergeExecutionNotes(null, asString(req.body.notes) || "", {
          timerStartAt: new Date().toISOString(),
        }),
        stepResults: toExecutionStepItems(existing.steps) as never,
        progressPercent: 0,
        isDraft: true,
      },
    });

    await writeAuditLog(req.user!.userId, "START_TEST_EXECUTION", "TestExecution", execution.id, {
      testCaseId: existing.id,
      testRunId,
    });
    return res.status(201).json(execution);
  }
);

router.post(
  "/executions/:executionId/steps/:stepNumber",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({
      where: { id: req.params.executionId },
      include: { testCase: true },
    });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (req.user!.role !== Role.ADMIN && execution.executedBy !== req.user!.userId) {
      return res.status(403).json({ message: "You can update only your own execution" });
    }
    if (!execution.isDraft) {
      return res.status(400).json({ message: "Execution is already finalized" });
    }

    const stepNumber = Number(req.params.stepNumber);
    if (!Number.isFinite(stepNumber) || stepNumber <= 0) {
      return res.status(400).json({ message: "Valid step number is required" });
    }
    const stepStatus = parseEnum(ExecutionStatus, req.body.status);
    if (!stepStatus) {
      return res.status(400).json({ message: "Valid step status is required" });
    }

    const storedSteps = parseStoredStepResults(execution.stepResults);
    const fallbackSteps = toExecutionStepItems(execution.testCase.steps);
    const baseSteps = storedSteps.length > 0 ? storedSteps : fallbackSteps;
    const idx = baseSteps.findIndex((item) => item.stepNumber === stepNumber);
    if (idx < 0) {
      return res.status(404).json({ message: "Step not found in test case definition" });
    }

    baseSteps[idx] = {
      ...baseSteps[idx],
      status: stepStatus,
      actualResult: asString(req.body.actualResult),
      notes: asString(req.body.notes),
    };

    const executedCount = baseSteps.filter((item) => item.status !== "NOT_EXECUTED").length;
    const progressPercent =
      baseSteps.length === 0 ? 0 : Math.round((executedCount / baseSteps.length) * 100);

    const updated = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        stepResults: baseSteps as never,
        progressPercent,
        notes: mergeExecutionNotes(
          execution.notes,
          asString(req.body.executionNotes) || parseExecutionNotes(execution.notes).userNotes,
          {}
        ),
      },
    });

    await writeAuditLog(req.user!.userId, "AUTO_SAVE_TEST_EXECUTION_STEP", "TestExecution", updated.id, {
      stepNumber,
      stepStatus,
      progressPercent,
    });
    return res.json({
      id: updated.id,
      progressPercent: updated.progressPercent,
      stepResults: baseSteps,
    });
  }
);

router.post(
  "/executions/:executionId/timer/start",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({ where: { id: req.params.executionId } });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, execution.executedBy)) {
      return res.status(403).json({ message: "You can start timer only for your own execution" });
    }
    if (!execution.isDraft) {
      return res.status(400).json({ message: "Execution already finalized" });
    }

    const parsed = parseExecutionNotes(execution.notes);
    const startedAt = parsed.meta.timerStartAt || new Date().toISOString();
    const updated = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        notes: mergeExecutionNotes(execution.notes, parsed.userNotes, {
          timerStartAt: startedAt,
          timerStopAt: undefined,
        }),
      },
    });

    await writeAuditLog(req.user!.userId, "START_EXECUTION_TIMER", "TestExecution", updated.id, {
      startedAt,
    });
    return res.json({
      id: updated.id,
      startedAt,
      completedAt: null,
      durationSeconds: null,
    });
  }
);

router.post(
  "/executions/:executionId/timer/stop",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({ where: { id: req.params.executionId } });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, execution.executedBy)) {
      return res.status(403).json({ message: "You can stop timer only for your own execution" });
    }

    const parsed = parseExecutionNotes(execution.notes);
    const start = parsed.meta.timerStartAt ? new Date(parsed.meta.timerStartAt) : execution.executedAt;
    const end = new Date();
    const durationSeconds = computeDurationSeconds(start, end);
    const updated = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        notes: mergeExecutionNotes(execution.notes, parsed.userNotes, {
          timerStartAt: start.toISOString(),
          timerStopAt: end.toISOString(),
          durationSeconds,
        }),
      },
    });

    await writeAuditLog(req.user!.userId, "STOP_EXECUTION_TIMER", "TestExecution", updated.id, {
      completedAt: end.toISOString(),
      durationSeconds,
    });
    return res.json({
      id: updated.id,
      startedAt: start.toISOString(),
      completedAt: end.toISOString(),
      durationSeconds,
    });
  }
);

router.get(
  "/executions/:executionId/evidence",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({ where: { id: req.params.executionId } });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, execution.executedBy)) {
      return res.status(403).json({ message: "You can view evidence only for your own execution" });
    }
    const evidence = await prisma.attachment.findMany({
      where: {
        testCaseId: execution.testCaseId,
        fileName: {
          startsWith: executionEvidencePrefix(execution.id),
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(
      evidence.map((item) => ({
        ...item,
        displayName: item.fileName.replace(executionEvidencePrefix(execution.id), ""),
      }))
    );
  }
);

router.post(
  "/executions/:executionId/evidence",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({ where: { id: req.params.executionId } });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, execution.executedBy)) {
      return res.status(403).json({ message: "You can upload evidence only for your own execution" });
    }

    const fileType = parseEnum(AttachmentType, req.body.fileType);
    const fileUrl = asString(req.body.fileUrl);
    const fileName = asString(req.body.fileName);
    if (!fileType || !fileUrl || !fileName) {
      return res.status(400).json({ message: "fileType, fileUrl, and fileName are required" });
    }

    const created = await prisma.attachment.create({
      data: {
        testCaseId: execution.testCaseId,
        uploadedBy: req.user!.userId,
        fileType,
        fileUrl,
        fileName: `${executionEvidencePrefix(execution.id)}${fileName}`,
      },
    });
    await writeAuditLog(req.user!.userId, "UPLOAD_EXECUTION_EVIDENCE", "Attachment", created.id, {
      executionId: execution.id,
      fileType,
      notes: asString(req.body.notes) || null,
    });
    return res.status(201).json({
      ...created,
      displayName: fileName,
    });
  }
);

router.delete(
  "/executions/:executionId/evidence/:evidenceId",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({ where: { id: req.params.executionId } });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, execution.executedBy)) {
      return res.status(403).json({ message: "You can delete evidence only for your own execution" });
    }

    const evidence = await prisma.attachment.findUnique({ where: { id: req.params.evidenceId } });
    if (
      !evidence ||
      evidence.testCaseId !== execution.testCaseId ||
      !evidence.fileName.startsWith(executionEvidencePrefix(execution.id))
    ) {
      return res.status(404).json({ message: "Evidence not found" });
    }
    await prisma.attachment.delete({ where: { id: evidence.id } });
    await writeAuditLog(req.user!.userId, "DELETE_EXECUTION_EVIDENCE", "Attachment", evidence.id, {
      executionId: execution.id,
    });
    return res.json({ message: "Evidence deleted" });
  }
);

router.post(
  "/executions/:executionId/reexecute",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const original = await prisma.testExecution.findUnique({
      where: { id: req.params.executionId },
      include: { testCase: true },
    });
    if (!original) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, original.executedBy)) {
      return res.status(403).json({ message: "You can re-execute only your own execution" });
    }

    const restarted = await prisma.testExecution.create({
      data: {
        testCaseId: original.testCaseId,
        executedBy: req.user!.userId,
        testRunId: original.testRunId,
        result: ExecutionStatus.SKIPPED,
        notes: mergeExecutionNotes(null, asString(req.body.notes) || "Re-execution initiated", {
          timerStartAt: new Date().toISOString(),
          reexecutionOfId: original.id,
        }),
        stepResults: toExecutionStepItems(original.testCase.steps) as never,
        progressPercent: 0,
        isDraft: true,
      },
    });

    await writeAuditLog(req.user!.userId, "REEXECUTE_TEST_CASE", "TestExecution", restarted.id, {
      originalExecutionId: original.id,
    });
    return res.status(201).json(restarted);
  }
);

router.post(
  "/executions/:executionId/finalize",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({
      where: { id: req.params.executionId },
      include: { testCase: true },
    });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (req.user!.role !== Role.ADMIN && execution.executedBy !== req.user!.userId) {
      return res.status(403).json({ message: "You can finalize only your own execution" });
    }

    const stepResults = parseStoredStepResults(execution.stepResults);
    const explicitResult = parseEnum(ExecutionStatus, req.body.result);
    const finalResult = explicitResult || deriveOverallResultFromSteps(stepResults);
    const parsed = parseExecutionNotes(execution.notes);
    const finalUserNotes = asString(req.body.notes) || parsed.userNotes;
    const completedAt = new Date();
    const timerStart = parsed.meta.timerStartAt ? new Date(parsed.meta.timerStartAt) : execution.executedAt;
    const durationSeconds = computeDurationSeconds(timerStart, completedAt);
    const finalNotes = mergeExecutionNotes(execution.notes, finalUserNotes, {
      timerStartAt: timerStart.toISOString(),
      timerStopAt: completedAt.toISOString(),
      durationSeconds,
    });

    const finalized = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        result: finalResult,
        notes: finalNotes,
        isDraft: false,
        progressPercent: 100,
      },
    });

    if (finalized.testRunId) {
      await prisma.testRunCase.updateMany({
        where: {
          testRunId: finalized.testRunId,
          testCaseId: finalized.testCaseId,
        },
        data: {
          status: deriveRunCaseStatus(finalResult),
          lastExecutionId: finalized.id,
        },
      });
    }

    await writeAuditLog(req.user!.userId, "FINALIZE_TEST_EXECUTION", "TestExecution", finalized.id, {
      finalResult,
      testRunId: finalized.testRunId,
    });
    return res.json({
      ...finalized,
      notes: finalUserNotes,
      startedAt: timerStart.toISOString(),
      completedAt: completedAt.toISOString(),
      durationSeconds,
      reexecutionOfId: parsed.meta.reexecutionOfId || null,
    });
  }
);

router.post(
  "/testcases/:id/execute",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }

    const result = parseEnum(ExecutionStatus, req.body.result);
    if (!result) {
      return res.status(400).json({ message: "Valid execution result is required" });
    }

    const execution = await prisma.testExecution.create({
      data: {
        testCaseId: existing.id,
        executedBy: req.user!.userId,
        testRunId: asString(req.body.testRunId) || null,
        result,
        notes: mergeExecutionNotes(null, asString(req.body.notes) || "", {
          timerStartAt: new Date().toISOString(),
          timerStopAt: new Date().toISOString(),
          durationSeconds: 0,
        }),
        stepResults: parseJsonValue(req.body.stepResults, []) as never,
        progressPercent: 100,
        isDraft: false,
      },
    });

    if (execution.testRunId) {
      await prisma.testRunCase.updateMany({
        where: {
          testRunId: execution.testRunId,
          testCaseId: execution.testCaseId,
        },
        data: {
          status: deriveRunCaseStatus(result),
          lastExecutionId: execution.id,
        },
      });
    }

    await writeAuditLog(req.user!.userId, "EXECUTE_TEST_CASE", "TestExecution", execution.id, { result });
    return res.status(201).json(execution);
  }
);

router.post(
  "/test-runs",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const name = asString(req.body.name);
    const description = asString(req.body.description) || null;
    const targetStartDate = req.body.targetStartDate ? new Date(req.body.targetStartDate) : null;
    const targetEndDate = req.body.targetEndDate ? new Date(req.body.targetEndDate) : null;
    const testerIds = Array.isArray(req.body.testerIds) ? asStringArray(req.body.testerIds) : [];
    const testCaseIds = Array.isArray(req.body.testCaseIds) ? asStringArray(req.body.testCaseIds) : [];

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }
    if (testCaseIds.length === 0) {
      return res.status(400).json({ message: "At least one testCaseId is required" });
    }
    if (targetStartDate && Number.isNaN(targetStartDate.getTime())) {
      return res.status(400).json({ message: "targetStartDate is invalid" });
    }
    if (targetEndDate && Number.isNaN(targetEndDate.getTime())) {
      return res.status(400).json({ message: "targetEndDate is invalid" });
    }
    if (targetStartDate && targetEndDate && targetEndDate < targetStartDate) {
      return res.status(400).json({ message: "targetEndDate cannot be earlier than targetStartDate" });
    }

    const distinctCaseIds = [...new Set(testCaseIds)];
    const distinctTesterIds = [...new Set(testerIds)];
    const foundCases = await prisma.testCase.findMany({
      where: { id: { in: distinctCaseIds }, isDeleted: false },
      select: { id: true },
    });
    if (foundCases.length !== distinctCaseIds.length) {
      return res.status(400).json({ message: "One or more testCaseIds are invalid or deleted" });
    }

    if (distinctTesterIds.length > 0) {
      const testers = await prisma.user.findMany({
        where: { id: { in: distinctTesterIds }, role: Role.TESTER, isActive: true },
        select: { id: true },
      });
      if (testers.length !== distinctTesterIds.length) {
        return res.status(400).json({ message: "One or more testerIds are invalid/inactive/non-tester users" });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const run = await tx.testRun.create({
        data: {
          name,
          description,
          createdBy: req.user!.userId,
          targetStartDate,
          targetEndDate,
          status: TestRunStatus.PLANNED,
        },
      });
      if (distinctCaseIds.length > 0) {
        await tx.testRunCase.createMany({
          data: distinctCaseIds.map((testCaseId) => ({
            testRunId: run.id,
            testCaseId,
            status: TestRunCaseStatus.NOT_RUN,
          })),
        });
      }
      if (distinctTesterIds.length > 0) {
        await tx.testRunAssignment.createMany({
          data: distinctTesterIds.map((testerId) => ({
            testRunId: run.id,
            testerId,
          })),
        });
      }
      return run;
    });

    await writeAuditLog(req.user!.userId, "CREATE_TEST_RUN", "TestRun", created.id, {
      testCaseCount: distinctCaseIds.length,
      testerCount: distinctTesterIds.length,
    });

    return res.status(201).json(created);
  }
);

router.get(
  "/test-runs",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const where: Prisma.TestRunWhereInput =
      req.user!.role === Role.ADMIN
        ? {}
        : {
            OR: [
              { createdBy: req.user!.userId },
              { assignments: { some: { testerId: req.user!.userId } } },
            ],
          };

    const runs = await prisma.testRun.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: { include: { tester: { select: { id: true, name: true, email: true } } } },
        testCases: { include: { testCase: { select: { id: true, title: true, testCaseCode: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const withProgress = runs.map((run: any) => {
      const total = run.testCases.length;
      const completed = run.testCases.filter((item: any) => item.status !== TestRunCaseStatus.NOT_RUN).length;
      return {
        ...run,
        progress: {
          total,
          completed,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
      };
    });
    return res.json(withProgress);
  }
);

router.get(
  "/test-runs/:id",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const run = await prisma.testRun.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: { include: { tester: { select: { id: true, name: true, email: true } } } },
        testCases: {
          include: {
            testCase: { select: { id: true, title: true, testCaseCode: true, module: true } },
            lastExecution: { select: { id: true, result: true, executedAt: true, executedBy: true } },
          },
        },
      },
    });
    if (!run) {
      return res.status(404).json({ message: "Test run not found" });
    }
    const assigned = run.assignments.some((item: any) => item.testerId === req.user!.userId);
    if (req.user!.role !== Role.ADMIN && run.createdBy !== req.user!.userId && !assigned) {
      return res.status(403).json({ message: "You are not allowed to view this test run" });
    }
    const total = run.testCases.length;
    const completed = run.testCases.filter((item: any) => item.status !== TestRunCaseStatus.NOT_RUN).length;
    return res.json({
      ...run,
      progress: {
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    });
  }
);

router.patch(
  "/test-runs/:id",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const run = await prisma.testRun.findUnique({ where: { id: req.params.id } });
    if (!run) {
      return res.status(404).json({ message: "Test run not found" });
    }
    if (req.user!.role !== Role.ADMIN && run.createdBy !== req.user!.userId) {
      return res.status(403).json({ message: "Only creator/admin can update this test run" });
    }
    const nextStatus = parseEnum(TestRunStatus, req.body.status);
    const updated = await prisma.testRun.update({
      where: { id: req.params.id },
      data: {
        name: asString(req.body.name) || undefined,
        description: req.body.description !== undefined ? asString(req.body.description) || null : undefined,
        targetStartDate: req.body.targetStartDate ? new Date(req.body.targetStartDate) : undefined,
        targetEndDate: req.body.targetEndDate ? new Date(req.body.targetEndDate) : undefined,
        status: nextStatus ?? undefined,
      },
    });
    await writeAuditLog(req.user!.userId, "UPDATE_TEST_RUN", "TestRun", updated.id, {
      status: updated.status,
    });
    return res.json(updated);
  }
);

router.post(
  "/test-runs/:id/assign",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const testerId = asString(req.body.testerId);
    if (!testerId) {
      return res.status(400).json({ message: "testerId is required" });
    }
    const run = await prisma.testRun.findUnique({ where: { id: req.params.id } });
    if (!run) {
      return res.status(404).json({ message: "Test run not found" });
    }
    if (req.user!.role !== Role.ADMIN && run.createdBy !== req.user!.userId) {
      return res.status(403).json({ message: "Only creator/admin can assign testers" });
    }
    const tester = await prisma.user.findUnique({ where: { id: testerId } });
    if (!tester || tester.role !== Role.TESTER || !tester.isActive) {
      return res.status(400).json({ message: "Valid active tester is required" });
    }

    const assignment = await prisma.testRunAssignment.upsert({
      where: { testRunId_testerId: { testRunId: run.id, testerId } },
      create: {
        testRunId: run.id,
        testerId,
      },
      update: {},
    });

    await writeAuditLog(req.user!.userId, "ASSIGN_TEST_RUN", "TestRunAssignment", assignment.id, {
      testerId,
      testRunId: run.id,
    });
    return res.status(201).json(assignment);
  }
);

router.post(
  "/test-runs/:id/testcases",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const testCaseId = asString(req.body.testCaseId);
    if (!testCaseId) {
      return res.status(400).json({ message: "testCaseId is required" });
    }
    const run = await prisma.testRun.findUnique({ where: { id: req.params.id } });
    if (!run) {
      return res.status(404).json({ message: "Test run not found" });
    }
    if (req.user!.role !== Role.ADMIN && run.createdBy !== req.user!.userId) {
      return res.status(403).json({ message: "Only creator/admin can add test cases to run" });
    }
    const testCase = await prisma.testCase.findUnique({ where: { id: testCaseId } });
    if (!testCase || testCase.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }

    const linked = await prisma.testRunCase.upsert({
      where: { testRunId_testCaseId: { testRunId: run.id, testCaseId } },
      create: {
        testRunId: run.id,
        testCaseId,
        status: TestRunCaseStatus.NOT_RUN,
      },
      update: {},
    });

    await writeAuditLog(req.user!.userId, "ADD_TEST_CASE_TO_RUN", "TestRunCase", linked.id, {
      testRunId: run.id,
      testCaseId,
    });
    return res.status(201).json(linked);
  }
);

router.post(
  "/testcases/:id/attachments",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }

    const fileType = parseEnum(AttachmentType, req.body.fileType);
    const fileUrl = asString(req.body.fileUrl);
    const fileName = asString(req.body.fileName);
    if (!fileType || !fileUrl || !fileName) {
      return res.status(400).json({ message: "fileType, fileUrl, fileName are required" });
    }

    const attachment = await prisma.attachment.create({
      data: {
        testCaseId: req.params.id,
        uploadedBy: req.user!.userId,
        fileType,
        fileUrl,
        fileName,
      },
    });

    await writeAuditLog(req.user!.userId, "UPLOAD_ATTACHMENT", "Attachment", attachment.id);
    return res.status(201).json(attachment);
  }
);

router.post("/suites", authorizeRoles(Role.TESTER), async (req: AuthRequest, res: Response) => {
  const name = asString(req.body.name);
  if (!name) {
    return res.status(400).json({ message: "Suite name is required" });
  }

  const suite = await prisma.testSuite.create({
    data: {
      name,
      description: asString(req.body.description) || null,
      createdBy: req.user!.userId,
      projectId: asString(req.body.projectId) || null,
    },
  });

  await writeAuditLog(req.user!.userId, "CREATE_TEST_SUITE", "TestSuite", suite.id, { name: suite.name });
  return res.status(201).json(suite);
});

router.post(
  "/suites/:suiteId/testcases/:testCaseId",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const link = await prisma.testSuiteCase.upsert({
      where: {
        suiteId_testCaseId: {
          suiteId: req.params.suiteId,
          testCaseId: req.params.testCaseId,
        },
      },
      create: {
        suiteId: req.params.suiteId,
        testCaseId: req.params.testCaseId,
      },
      update: {},
    });

    await writeAuditLog(req.user!.userId, "ADD_TEST_CASE_TO_SUITE", "TestSuiteCase", link.id);
    return res.status(201).json(link);
  }
);

router.get(
  "/reports/test-executions",
  authorizeRoles(Role.TESTER, Role.DEVELOPER),
  async (req: AuthRequest, res: Response) => {
    const executions = await prisma.testExecution.findMany({
      where: { isDraft: false },
      include: {
        testCase: { select: { id: true, title: true } },
        executor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { executedAt: "desc" },
    });

    const enriched = await Promise.all(
      executions.map(async (item) => {
        const parsed = parseExecutionNotes(item.notes);
        const evidenceCount = await prisma.attachment.count({
          where: {
            testCaseId: item.testCaseId,
            fileName: {
              startsWith: executionEvidencePrefix(item.id),
            },
          },
        });
        return {
          ...item,
          notes: parsed.userNotes,
          timerStartAt: parsed.meta.timerStartAt || null,
          timerStopAt: parsed.meta.timerStopAt || null,
          durationSeconds:
            typeof parsed.meta.durationSeconds === "number" ? parsed.meta.durationSeconds : null,
          reexecutionOfId: parsed.meta.reexecutionOfId || null,
          evidenceCount,
        };
      })
    );

    if (req.query.export === "csv") {
      const header = "executionId,testCaseId,testCaseTitle,result,executor,evidenceCount,durationSeconds,executedAt";
      const rows = enriched.map((item) =>
        [
          item.id,
          item.testCaseId,
          item.testCase.title,
          item.result,
          item.executor.email,
          item.evidenceCount,
          item.durationSeconds ?? "",
          item.executedAt.toISOString(),
        ]
          .map((value) => `"${String(value).replace(/\"/g, "\"\"")}"`)
          .join(",")
      );
      res.setHeader("Content-Type", "text/csv");
      return res.send([header, ...rows].join("\n"));
    }

    return res.json(enriched);
  }
);

router.post(
  "/issues/from-executions/:executionId",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({
      where: { id: req.params.executionId },
      include: { testCase: true },
    });

    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (execution.result !== ExecutionStatus.FAILED) {
      return res.status(400).json({ message: "Only FAILED execution can be converted to a bug report" });
    }

    const assignedDeveloperId = await resolveActiveDeveloperId(req.body.assignedTo);
    if (asString(req.body.assignedTo) && !assignedDeveloperId) {
      return res.status(400).json({ message: "assignedTo must be an active developer (id or email)" });
    }

    const issue = await prismaAny.issue.create({
      data: {
        bugCode: await generateBugCode(),
        title: asString(req.body.title) || `Bug: ${execution.testCase.title}`,
        description:
          asString(req.body.description) ||
          `Auto-created from failed execution ${execution.id} for test case ${execution.testCase.title}`,
        stepsToReproduce: asString(req.body.stepsToReproduce) || "Auto-created from failed execution",
        expectedBehavior: asString(req.body.expectedBehavior) || "Execution should pass without errors",
        actualBehavior: asString(req.body.actualBehavior) || `Execution failed with result ${execution.result}`,
        bugPriority: parseEnum(BUG_PRIORITY, req.body.priority) || BUG_PRIORITY.P3_MEDIUM,
        workflowStatus: BUG_WORKFLOW_STATUS.OPEN,
        severity: parseEnum(Severity, req.body.severity) || Severity.MEDIUM,
        status: IssueStatus.OPEN,
        environment: asString(req.body.environment) || null,
        affectedVersion: asString(req.body.affectedVersion) || null,
        testCaseId: execution.testCaseId,
        executionId: execution.id,
        reportedBy: req.user!.userId,
        assignedTo: assignedDeveloperId,
      },
    });

    await writeAuditLog(req.user!.userId, "CREATE_BUG_REPORT", "Issue", issue.id, { executionId: execution.id });
    return res.status(201).json(issue);
  }
);

router.post("/bugs", authorizeRoles(Role.TESTER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const title = asString(req.body.title);
  const details = asString(req.body.description);
  const stepsToReproduce = asString(req.body.stepsToReproduce);
  const expectedBehavior = asString(req.body.expectedBehavior);
  const actualBehavior = asString(req.body.actualBehavior);
  const environment = asString(req.body.environment);
  const affectedVersion = asString(req.body.affectedVersion);
  const priority = parseEnum(BUG_PRIORITY, asString(req.body.priority).toUpperCase()) || BUG_PRIORITY.P3_MEDIUM;
  const workflowStatus =
    parseEnum(BUG_WORKFLOW_STATUS, asString(req.body.workflowStatus).toUpperCase()) || BUG_WORKFLOW_STATUS.NEW;
  const linkedTestCaseId = asString(req.body.testCaseId) || null;
  const executionId = asString(req.body.executionId) || null;
  const assignedToInput = asString(req.body.assignedTo) || null;
  const dueDate = asString(req.body.dueDate) || null;
  const severity = parseEnum(Severity, req.body.severity) || Severity.MEDIUM;
  const attachments = parseBugAttachments(req.body.attachments);

  if (!title || !details || !stepsToReproduce || !expectedBehavior || !actualBehavior) {
    return res.status(400).json({
      message:
        "title, description, stepsToReproduce, expectedBehavior, and actualBehavior are required",
    });
  }
  if (title.length > 200) {
    return res.status(400).json({ message: "Title cannot exceed 200 characters" });
  }

  if (linkedTestCaseId) {
    const tc = await prisma.testCase.findUnique({ where: { id: linkedTestCaseId } });
    if (!tc || tc.isDeleted) return res.status(400).json({ message: "Invalid linked testCaseId" });
  }
  if (executionId) {
    const execution = await prisma.testExecution.findUnique({ where: { id: executionId } });
    if (!execution) return res.status(400).json({ message: "Invalid executionId" });
  }
  const assignedTo = await resolveActiveDeveloperId(assignedToInput);
  if (assignedToInput && !assignedTo) {
    return res.status(400).json({ message: "assignedTo must be an active developer (id or email)" });
  }

  const bugCode = await generateBugCode();
  const issue = await prismaAny.issue.create({
    data: {
      bugCode,
      title,
      description: details,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      bugPriority: priority,
      workflowStatus,
      severity,
      status: issueStatusFromWorkflow(workflowStatus),
      environment: environment || null,
      affectedVersion: affectedVersion || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      testCaseId: linkedTestCaseId,
      executionId,
      reportedBy: req.user!.userId,
      assignedTo,
      attachments:
        attachments.length > 0
          ? {
              create: attachments.map((item) => ({
                ...item,
                uploadedBy: req.user!.userId,
              })),
            }
          : undefined,
    },
    include: {
      attachments: true,
    },
  });

  await writeAuditLog(req.user!.userId, "CREATE_BUG_REPORT", "Issue", issue.id, { bugCode, workflowStatus });
  return res.status(201).json(enrichIssue(issue));
});

router.get("/bugs", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const mineOnly = String(req.query.mine || "") === "1";
  const statusFilter = asString(req.query.status).toUpperCase();
  const priorityFilter = asString(req.query.priority).toUpperCase();
  const severityFilter = asString(req.query.severity).toUpperCase();
  const rows = await prismaAny.issue.findMany({
    where:
      req.user!.role === Role.DEVELOPER
        ? {
            assignedTo: req.user!.userId,
            ...(statusFilter ? { workflowStatus: statusFilter as BugWorkflowStatus } : {}),
            ...(priorityFilter ? { bugPriority: priorityFilter as BugPriority } : {}),
            ...(severityFilter ? { severity: severityFilter as Severity } : {}),
          }
        : mineOnly
        ? {
            reportedBy: req.user!.userId,
            ...(statusFilter ? { workflowStatus: statusFilter as BugWorkflowStatus } : {}),
            ...(priorityFilter ? { bugPriority: priorityFilter as BugPriority } : {}),
            ...(severityFilter ? { severity: severityFilter as Severity } : {}),
          }
        : {
            ...(statusFilter ? { workflowStatus: statusFilter as BugWorkflowStatus } : {}),
            ...(priorityFilter ? { bugPriority: priorityFilter as BugPriority } : {}),
            ...(severityFilter ? { severity: severityFilter as Severity } : {}),
          },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      testCase: { select: { id: true, title: true, testCaseCode: true } },
      execution: { select: { id: true, result: true, executedAt: true } },
      comments: true,
      attachments: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  let enriched = rows.map(enrichIssue);
  const sortBy = asString(req.query.sortBy).toLowerCase();
  if (sortBy === "priority") {
    const rank: Record<string, number> = { [BUG_PRIORITY.P1_URGENT]: 1, [BUG_PRIORITY.P2_HIGH]: 2, [BUG_PRIORITY.P3_MEDIUM]: 3, [BUG_PRIORITY.P4_LOW]: 4 };
    enriched = enriched.sort((a: any, b: any) => (rank[a.bugPriority] || rank[a.priority] || 99) - (rank[b.bugPriority] || rank[b.priority] || 99));
  } else if (sortBy === "age") {
    enriched = enriched.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (sortBy === "dueDate") {
    enriched = enriched.sort((a: any, b: any) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : a.bugMeta?.dueDate ? new Date(a.bugMeta.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : b.bugMeta?.dueDate ? new Date(b.bugMeta.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  }
  return res.json(enriched);
});

router.get("/bugs/:id", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const issue = await prismaAny.issue.findUnique({
    where: { id: req.params.id },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      testCase: { select: { id: true, title: true, testCaseCode: true } },
      execution: { select: { id: true, result: true, executedAt: true } },
      comments: { orderBy: { createdAt: "asc" } },
      attachments: true,
    },
  });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can view only assigned bugs" });
  }
  return res.json(enrichIssue(issue));
});

router.post("/bugs/:id/attachments", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const issue = await prismaAny.issue.findUnique({ where: { id: req.params.id } });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can upload only for assigned bugs" });
  }
  const fileType = parseEnum(AttachmentType, req.body.fileType);
  const fileUrl = asString(req.body.fileUrl);
  const fileName = asString(req.body.fileName);
  const notes = asString(req.body.notes) || null;
  if (!fileType || !fileUrl || !fileName) {
    return res.status(400).json({ message: "fileType, fileUrl, fileName are required" });
  }
  const created = await prismaAny.bugAttachment.create({
    data: {
      issueId: issue.id,
      uploadedBy: req.user!.userId,
      fileType,
      fileUrl,
      fileName,
      notes,
    },
  });
  await writeAuditLog(req.user!.userId, "BUG_ATTACHMENT_ADD", "BugAttachment", created.id, { issueId: issue.id });
  return res.status(201).json(created);
});

router.get("/bugs/:id/attachments", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const issue = await prismaAny.issue.findUnique({ where: { id: req.params.id } });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can view only assigned bug attachments" });
  }
  const rows = await prismaAny.bugAttachment.findMany({
    where: { issueId: issue.id },
    orderBy: { createdAt: "desc" },
  });
  return res.json(rows);
});

router.delete("/bugs/:id/attachments/:attachmentId", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const issue = await prismaAny.issue.findUnique({ where: { id: req.params.id } });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  const attachment = await prismaAny.bugAttachment.findUnique({ where: { id: req.params.attachmentId } });
  if (!attachment || attachment.issueId !== issue.id) {
    return res.status(404).json({ message: "Attachment not found" });
  }
  if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can delete only for assigned bugs" });
  }
  await prismaAny.bugAttachment.delete({ where: { id: attachment.id } });
  await writeAuditLog(req.user!.userId, "BUG_ATTACHMENT_DELETE", "BugAttachment", attachment.id, { issueId: issue.id });
  return res.json({ message: "Attachment removed" });
});

router.patch("/bugs/:id/workflow", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const target = parseEnum(BUG_WORKFLOW_STATUS, asString(req.body.toStatus).toUpperCase());
    if (!target) return res.status(400).json({ message: "toStatus is required" });
    const issue = await prismaAny.issue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ message: "Bug not found" });
    if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
      return res.status(403).json({ message: "You can update only assigned bugs" });
    }

    // Legacy rows may have null workflowStatus; treat them as NEW to allow first triage transitions.
    const from = issue.workflowStatus || BUG_WORKFLOW_STATUS.NEW;
    if (!isAllowedWorkflowTransition(from, target) && req.user!.role !== Role.ADMIN) {
      return res.status(400).json({ message: `Invalid transition: ${from} -> ${target}` });
    }

    const updated = await prismaAny.issue.update({
      where: { id: issue.id },
      data: {
        workflowStatus: target,
        status: issueStatusFromWorkflow(target),
        fixNotes:
          target === BUG_WORKFLOW_STATUS.WONT_FIX
            ? asString(req.body.reason) || issue.fixNotes
            : issue.fixNotes,
      },
    });
    await writeAuditLog(req.user!.userId, "BUG_WORKFLOW_TRANSITION", "Issue", updated.id, { from, to: target });
    return res.json(enrichIssue(updated));
  } catch (error: any) {
    console.error("BUG_WORKFLOW_TRANSITION_ERROR", error);
    return res.status(500).json({ message: error?.message || "Failed to update bug workflow" });
  }
});

router.get("/developer/bugs", authorizeRoles(Role.DEVELOPER), async (req: AuthRequest, res: Response) => {
  const query: Record<string, string> = {};
  if (req.query.priority) query.priority = String(req.query.priority);
  if (req.query.severity) query.severity = String(req.query.severity);
  if (req.query.status) query.status = String(req.query.status);
  if (req.query.sortBy) query.sortBy = String(req.query.sortBy);
  const rows = await prismaAny.issue.findMany({
    where: {
      assignedTo: req.user!.userId,
      ...(query.priority ? { bugPriority: query.priority as BugPriority } : {}),
      ...(query.severity ? { severity: query.severity as Severity } : {}),
      ...(query.status ? { workflowStatus: query.status as BugWorkflowStatus } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { comments: true, attachments: true },
  });
  let enriched = rows.map(enrichIssue);
  if (query.sortBy === "priority") {
    const rank: Record<string, number> = { [BUG_PRIORITY.P1_URGENT]: 1, [BUG_PRIORITY.P2_HIGH]: 2, [BUG_PRIORITY.P3_MEDIUM]: 3, [BUG_PRIORITY.P4_LOW]: 4 };
    enriched = enriched.sort((a: any, b: any) => (rank[a.bugPriority] || rank[a.priority] || 99) - (rank[b.bugPriority] || rank[b.priority] || 99));
  }
  if (query.sortBy === "age") {
    enriched = enriched.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  if (query.sortBy === "dueDate") {
    enriched = enriched.sort((a: any, b: any) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : a.bugMeta?.dueDate ? new Date(a.bugMeta.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : b.bugMeta?.dueDate ? new Date(b.bugMeta.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  }
  return res.json(enriched);
});

router.patch("/developer/bugs/:id/quick-status", authorizeRoles(Role.DEVELOPER), async (req: AuthRequest, res: Response) => {
  const target = parseEnum(BUG_WORKFLOW_STATUS, asString(req.body.toStatus || req.body.status).toUpperCase());
  if (!target) return res.status(400).json({ message: "status is required" });
  const issue = await prismaAny.issue.findUnique({ where: { id: req.params.id } });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  if (issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can update only assigned bugs" });
  }
  const from = issue.workflowStatus || BUG_WORKFLOW_STATUS.OPEN;
  if (!isAllowedWorkflowTransition(from, target)) {
    return res.status(400).json({ message: `Invalid transition: ${from} -> ${target}` });
  }
  const updated = await prismaAny.issue.update({
    where: { id: issue.id },
    data: {
      workflowStatus: target,
      status: issueStatusFromWorkflow(target),
    },
  });
  await writeAuditLog(req.user!.userId, "BUG_QUICK_STATUS_UPDATE", "Issue", updated.id, {
    from,
    to: target,
  });
  return res.json(enrichIssue(updated));
});

router.post("/bugs/:id/resolve", authorizeRoles(Role.DEVELOPER), async (req: AuthRequest, res: Response) => {
  const issue = await prismaAny.issue.findUnique({ where: { id: req.params.id } });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  if (issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can resolve only assigned bugs" });
  }
  const action = asString(req.body.action).toUpperCase();
  let workflowStatus = issue.workflowStatus || BUG_WORKFLOW_STATUS.OPEN;
  if (action === "START_PROGRESS") {
    workflowStatus = BUG_WORKFLOW_STATUS.IN_PROGRESS;
  } else if (action === "MARK_FIXED") {
    workflowStatus = BUG_WORKFLOW_STATUS.FIXED;
  } else if (action === "REQUEST_RETEST") {
    workflowStatus = BUG_WORKFLOW_STATUS.FIXED;
  } else if (action === "WONT_FIX") {
    workflowStatus = BUG_WORKFLOW_STATUS.WONT_FIX;
  } else {
    return res.status(400).json({ message: "Unsupported action" });
  }
  const updated = await prismaAny.issue.update({
    where: { id: issue.id },
    data: {
      fixNotes: req.body.fixNotes !== undefined ? asString(req.body.fixNotes) || issue.fixNotes : issue.fixNotes,
      commitLink: req.body.commitLink !== undefined ? asString(req.body.commitLink) || issue.commitLink : issue.commitLink,
      retestRequested: action === "REQUEST_RETEST" ? true : issue.retestRequested,
      workflowStatus,
      status: issueStatusFromWorkflow(workflowStatus),
    },
  });
  await writeAuditLog(req.user!.userId, "BUG_RESOLUTION_ACTION", "Issue", issue.id, { action });
  return res.json(enrichIssue(updated));
});

router.post("/bugs/:id/comments", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const issue = await prisma.issue.findUnique({ where: { id: req.params.id } });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can comment only assigned bugs" });
  }
  const comment = asString(req.body.comment);
  if (!comment) return res.status(400).json({ message: "comment is required" });
  const parentCommentId = asString(req.body.parentCommentId) || null;
  const payload = parentCommentId ? `[PARENT:${parentCommentId}]\n${comment}` : comment;
  const mentions = parseMentions(comment);
  const created = await prisma.issueComment.create({
    data: { issueId: issue.id, authorId: req.user!.userId, comment: payload },
  });
  await writeAuditLog(req.user!.userId, "BUG_COMMENT_ADD", "IssueComment", created.id, { mentions });
  return res.status(201).json({ ...created, mentions, parentCommentId });
});

router.get("/bugs/:id/comments", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const issue = await prisma.issue.findUnique({ where: { id: req.params.id } });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can view only assigned bug comments" });
  }
  const rows = await prisma.issueComment.findMany({
    where: { issueId: issue.id },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const normalized = rows.map((item) => {
    const match = item.comment.match(/^\[PARENT:([^\]]+)\]\s*\n?/);
    const parentCommentId = match?.[1] || null;
    const body = match ? item.comment.replace(match[0], "") : item.comment;
    return { ...item, parentCommentId, comment: body, mentions: parseMentions(body) };
  });
  const byParent: Record<string, any[]> = {};
  normalized.forEach((item) => {
    const key = item.parentCommentId || "__root__";
    byParent[key] = byParent[key] || [];
    byParent[key].push({ ...item, replies: [] as any[] });
  });
  const roots = byParent["__root__"] || [];
  Object.keys(byParent)
    .filter((k) => k !== "__root__")
    .forEach((parentId) => {
      const parent = normalized.find((item) => item.id === parentId);
      if (!parent) return;
      const parentNode = roots
        .concat(...roots.map((r) => r.replies || []))
        .find((n: any) => n.id === parentId);
      if (parentNode) parentNode.replies = byParent[parentId];
    });
  return res.json({ comments: normalized, threaded: roots });
});

router.patch("/bugs/comments/:commentId", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.issueComment.findUnique({ where: { id: req.params.commentId } });
  if (!existing) return res.status(404).json({ message: "Comment not found" });
  const diffMs = Date.now() - new Date(existing.createdAt).getTime();
  if (req.user!.role !== Role.ADMIN && existing.authorId !== req.user!.userId) {
    return res.status(403).json({ message: "You can edit only your own comments" });
  }
  if (req.user!.role !== Role.ADMIN && diffMs > 5 * 60 * 1000) {
    return res.status(400).json({ message: "Comments can be edited only within 5 minutes" });
  }
  const comment = asString(req.body.comment);
  if (!comment) return res.status(400).json({ message: "comment is required" });
  const prefixMatch = existing.comment.match(/^\[PARENT:[^\]]+\]\s*\n?/);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  const updated = await prisma.issueComment.update({
    where: { id: existing.id },
    data: { comment: `${prefix}${comment}` },
  });
  await writeAuditLog(req.user!.userId, "BUG_COMMENT_EDIT", "IssueComment", updated.id);
  return res.json({ ...updated, mentions: parseMentions(comment) });
});

router.delete("/bugs/comments/:commentId", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.issueComment.findUnique({ where: { id: req.params.commentId } });
  if (!existing) return res.status(404).json({ message: "Comment not found" });
  const diffMs = Date.now() - new Date(existing.createdAt).getTime();
  if (req.user!.role !== Role.ADMIN && existing.authorId !== req.user!.userId) {
    return res.status(403).json({ message: "You can delete only your own comments" });
  }
  if (req.user!.role !== Role.ADMIN && diffMs > 5 * 60 * 1000) {
    return res.status(400).json({ message: "Comments can be deleted only within 5 minutes" });
  }
  const prefixMatch = existing.comment.match(/^\[PARENT:[^\]]+\]\s*\n?/);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  const updated = await prisma.issueComment.update({
    where: { id: existing.id },
    data: { comment: `${prefix}[DELETED]` },
  });
  await writeAuditLog(req.user!.userId, "BUG_COMMENT_DELETE", "IssueComment", updated.id);
  return res.json({ message: "Comment deleted" });
});

router.post("/issues/:id/assign", authorizeRoles(Role.TESTER), async (req: AuthRequest, res: Response) => {
  const developerId = asString(req.body.developerId);
  if (!developerId) {
    return res.status(400).json({ message: "developerId is required" });
  }

  const developer = await prisma.user.findUnique({ where: { id: developerId } });
  if (!developer || developer.role !== Role.DEVELOPER || !developer.isActive) {
    return res.status(400).json({ message: "Valid active developer is required" });
  }

  const issue = await prisma.issue.update({
    where: { id: req.params.id },
    data: { assignedTo: developerId },
  });

  await writeAuditLog(req.user!.userId, "ASSIGN_ISSUE_TO_DEVELOPER", "Issue", issue.id, { developerId });
  return res.json(issue);
});

router.post(
  "/issues/:id/comments",
  authorizeRoles(Role.TESTER, Role.DEVELOPER),
  async (req: AuthRequest, res: Response) => {
    const comment = asString(req.body.comment);
    if (!comment) {
      return res.status(400).json({ message: "comment is required" });
    }
    if (req.user!.role === Role.DEVELOPER) {
      const access = await ensureIssueAccess(req, req.params.id);
      if (!access.issue) {
        return res.status(404).json({ message: "Issue not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ message: "You can comment only on issues assigned to you" });
      }
    }

    const created = await prisma.issueComment.create({
      data: {
        issueId: req.params.id,
        authorId: req.user!.userId,
        comment,
      },
    });

    await writeAuditLog(req.user!.userId, "COMMENT_ON_ISSUE", "IssueComment", created.id);
    return res.status(201).json(created);
  }
);

/* =========================
   DEVELOPER FLOWS
========================= */
router.get("/developer/reports", authorizeRoles(Role.DEVELOPER), async (_req: AuthRequest, res: Response) => {
  const [totalExecutions, failedExecutions, openIssues] = await Promise.all([
    prisma.testExecution.count({ where: { isDraft: false } }),
    prisma.testExecution.count({ where: { isDraft: false, result: ExecutionStatus.FAILED } }),
    prisma.issue.count({ where: { status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] } } }),
  ]);
  return res.json({ totalExecutions, failedExecutions, openIssues });
});

router.get(
  "/developer/issues/assigned",
  authorizeRoles(Role.DEVELOPER),
  async (req: AuthRequest, res: Response) => {
    const issues = await prisma.issue.findMany({
      where: req.user!.role === Role.ADMIN ? undefined : { assignedTo: req.user!.userId },
      include: { testCase: true, execution: true, comments: true },
      orderBy: { updatedAt: "desc" },
    });
    return res.json(issues);
  }
);

router.patch("/issues/:id/status", authorizeRoles(Role.DEVELOPER), async (req: AuthRequest, res: Response) => {
  const status = parseEnum(IssueStatus, req.body.status);
  if (!status) {
    return res.status(400).json({ message: "Valid issue status is required" });
  }
  const access = await ensureIssueAccess(req, req.params.id);
  if (!access.issue) {
    return res.status(404).json({ message: "Issue not found" });
  }
  if (!access.allowed) {
    return res.status(403).json({ message: "You can update only issues assigned to you" });
  }

  const issue = await prisma.issue.update({
    where: { id: req.params.id },
    data: { status },
  });

  await writeAuditLog(req.user!.userId, "UPDATE_ISSUE_STATUS", "Issue", issue.id, { status });
  return res.json(issue);
});

router.patch("/issues/:id/fix-notes", authorizeRoles(Role.DEVELOPER), async (req: AuthRequest, res: Response) => {
  const fixNotes = asString(req.body.fixNotes);
  if (!fixNotes) {
    return res.status(400).json({ message: "fixNotes is required" });
  }
  const access = await ensureIssueAccess(req, req.params.id);
  if (!access.issue) {
    return res.status(404).json({ message: "Issue not found" });
  }
  if (!access.allowed) {
    return res.status(403).json({ message: "You can update only issues assigned to you" });
  }

  const issue = await prisma.issue.update({
    where: { id: req.params.id },
    data: { fixNotes },
  });
  await writeAuditLog(req.user!.userId, "ADD_FIX_NOTES", "Issue", issue.id);
  return res.json(issue);
});

router.patch("/issues/:id/link-commit", authorizeRoles(Role.DEVELOPER), async (req: AuthRequest, res: Response) => {
  const commitLink = asString(req.body.commitLink);
  if (!commitLink) {
    return res.status(400).json({ message: "commitLink is required" });
  }
  const access = await ensureIssueAccess(req, req.params.id);
  if (!access.issue) {
    return res.status(404).json({ message: "Issue not found" });
  }
  if (!access.allowed) {
    return res.status(403).json({ message: "You can update only issues assigned to you" });
  }

  const issue = await prisma.issue.update({
    where: { id: req.params.id },
    data: { commitLink },
  });
  await writeAuditLog(req.user!.userId, "LINK_COMMIT", "Issue", issue.id, { commitLink });
  return res.json(issue);
});

router.post(
  "/issues/:id/request-retest",
  authorizeRoles(Role.DEVELOPER),
  async (req: AuthRequest, res: Response) => {
    const access = await ensureIssueAccess(req, req.params.id);
    if (!access.issue) {
      return res.status(404).json({ message: "Issue not found" });
    }
    if (!access.allowed) {
      return res.status(403).json({ message: "You can update only issues assigned to you" });
    }
    const issue = await prisma.issue.update({
      where: { id: req.params.id },
      data: {
        retestRequested: true,
        status: IssueStatus.FIXED,
      },
    });
    await writeAuditLog(req.user!.userId, "REQUEST_RETEST", "Issue", issue.id);
    return res.json(issue);
  }
);

router.get("/developer/dashboard", authorizeRoles(Role.DEVELOPER), async (req: AuthRequest, res: Response) => {
  const where = req.user!.role === Role.ADMIN ? undefined : { assignedTo: req.user!.userId };
  const [assignedCount, fixedCount, openCount] = await Promise.all([
    prisma.issue.count({ where }),
    prisma.issue.count({ where: { ...where, status: IssueStatus.FIXED } }),
    prisma.issue.count({ where: { ...where, status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] } } }),
  ]);

  return res.json({ assignedCount, fixedCount, openCount });
});

router.get(
  "/developer/reports/export",
  authorizeRoles(Role.DEVELOPER),
  async (req: AuthRequest, res: Response) => {
    const issues = await prisma.issue.findMany({
      where: req.user!.role === Role.ADMIN ? undefined : { assignedTo: req.user!.userId },
      orderBy: { updatedAt: "desc" },
    });
    const header = "issueId,title,status,severity,assignedTo,updatedAt";
    const rows = issues.map((item) =>
      [item.id, item.title, item.status, item.severity, item.assignedTo || "", item.updatedAt.toISOString()]
        .map((value) => `"${String(value).replace(/\"/g, "\"\"")}"`)
        .join(",")
    );
    res.setHeader("Content-Type", "text/csv");
    return res.send([header, ...rows].join("\n"));
  }
);

/* =========================
   ADMIN FLOWS (BONUS)
========================= */
router.get("/admin/users", authorizeRoles(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json(users);
});

router.post("/admin/users", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const name = asString(req.body.name);
  const email = asString(req.body.email).toLowerCase();
  const password = asString(req.body.password);
  const role = parseEnum(Role, req.body.role) || Role.TESTER;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, and password are required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      isVerified: true,
      passwordHistory: [hashedPassword],
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await writeAuditLog(req.user!.userId, "ADMIN_CREATE_USER", "User", user.id, { role: user.role });
  return res.status(201).json(user);
});

router.patch("/admin/users/:id", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      name: asString(req.body.name) || undefined,
      role: parseEnum(Role, req.body.role) ?? undefined,
      isActive: typeof req.body.isActive === "boolean" ? req.body.isActive : undefined,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  await writeAuditLog(req.user!.userId, "ADMIN_UPDATE_USER", "User", user.id);
  return res.json(user);
});

router.post("/admin/roles/:id", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const role = parseEnum(Role, req.body.role);
  if (!role) {
    return res.status(400).json({ message: "Valid role is required" });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  await writeAuditLog(req.user!.userId, "ADMIN_MANAGE_ROLE", "User", user.id, { role });
  return res.json(user);
});

router.post("/admin/projects", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const name = asString(req.body.name);
  if (!name) {
    return res.status(400).json({ message: "Project name is required" });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: asString(req.body.description) || null,
      createdBy: req.user!.userId,
    },
  });

  await writeAuditLog(req.user!.userId, "ADMIN_CREATE_PROJECT", "Project", project.id, { name: project.name });
  return res.status(201).json(project);
});

router.get("/admin/projects", authorizeRoles(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return res.json(projects);
});

router.patch("/admin/projects/:id", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      name: asString(req.body.name) || undefined,
      description: asString(req.body.description) || undefined,
      isActive: typeof req.body.isActive === "boolean" ? req.body.isActive : undefined,
    },
  });
  await writeAuditLog(req.user!.userId, "ADMIN_UPDATE_PROJECT", "Project", project.id);
  return res.json(project);
});

router.get("/admin/audit-logs", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    where: req.query.entityType ? { entityType: String(req.query.entityType) } : undefined,
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return res.json(logs);
});

router.post("/admin/system-config", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const key = asString(req.body.key);
  const value = asString(req.body.value);
  if (!key || !value) {
    return res.status(400).json({ message: "key and value are required" });
  }

  const config = await prisma.systemConfig.upsert({
    where: { key },
    create: {
      key,
      value,
      updatedBy: req.user!.userId,
    },
    update: {
      value,
      updatedBy: req.user!.userId,
    },
  });

  await writeAuditLog(req.user!.userId, "ADMIN_SYSTEM_CONFIG", "SystemConfig", config.id, { key: config.key });
  return res.json(config);
});

router.get("/admin/system-config", authorizeRoles(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  const configs = await prisma.systemConfig.findMany({
    orderBy: { key: "asc" },
    include: {
      updater: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  return res.json(configs);
});

router.post("/admin/backups", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const backup = await prisma.backupJob.create({
    data: {
      triggeredBy: req.user!.userId,
      status: BackupStatus.RUNNING,
      notes: asString(req.body.notes) || "Manual backup triggered",
    },
  });

  const completed = await prisma.backupJob.update({
    where: { id: backup.id },
    data: {
      status: BackupStatus.SUCCESS,
      completedAt: new Date(),
    },
  });

  await writeAuditLog(req.user!.userId, "ADMIN_TRIGGER_BACKUP", "BackupJob", completed.id);
  return res.status(201).json(completed);
});

router.get("/admin/backups", authorizeRoles(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  const backups = await prisma.backupJob.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      triggerUser: { select: { id: true, name: true, email: true, role: true } },
    },
    take: 100,
  });
  return res.json(backups);
});

export default router;
