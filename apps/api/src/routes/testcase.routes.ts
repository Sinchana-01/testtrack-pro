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
import {
  applyProjectScopeMiddleware,
  ensureWritableProject,
  getProjectIdFromRequest,
  projectGuards,
} from "./testcase.project-scope";
import { sendGenericEmail } from "../utils/email";
import {
  createNotification,
  createNotificationsBulk,
} from "../modules/notifications/notification.service";
import {
  sendBugAssignedEmail,
  sendBugStatusChangedEmail,
  sendCommentMentionEmail,
  sendRetestRequestedEmail,
  sendTestAssignedEmail,
} from "../services/email.service";

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

const CROSS_PROJECT_REFERENCE_MESSAGE = "Cross-project reference is not allowed.";

const TEST_CASE_STATUS_TRANSITIONS: Record<TestCaseStatus, TestCaseStatus[]> = {
  [TestCaseStatus.DRAFT]: [TestCaseStatus.READY_FOR_REVIEW],
  [TestCaseStatus.READY_FOR_REVIEW]: [TestCaseStatus.APPROVED, TestCaseStatus.DRAFT],
  [TestCaseStatus.APPROVED]: [TestCaseStatus.DEPRECATED],
  [TestCaseStatus.DEPRECATED]: [TestCaseStatus.ARCHIVED],
  [TestCaseStatus.ARCHIVED]: [],
  // Legacy statuses are treated as terminal under strict lifecycle rules.
  [TestCaseStatus.READY]: [],
  [TestCaseStatus.IN_PROGRESS]: [],
  [TestCaseStatus.PASSED]: [],
  [TestCaseStatus.FAILED]: [],
};

const isValidTestCaseStatusTransition = (current: TestCaseStatus, next: TestCaseStatus): boolean => {
  if (current === next) return true;
  return (TEST_CASE_STATUS_TRANSITIONS[current] || []).includes(next);
};

const asDate = (value: unknown): Date | null => {
  const input = asString(value);
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};


const csvEscape = (value: unknown): string => `"${String(value ?? "").replace(/\"/g, "\"\"")}"`;

const buildSimplePdf = (lines: string[]): Buffer => {
  const safeLines = lines.map((line) => String(line || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"));
  const content = ["BT", "/F1 11 Tf", "50 790 Td"]
    .concat(
      safeLines.flatMap((line, idx) => (idx === 0 ? [`(${line}) Tj`] : ["0 -14 Td", `(${line}) Tj`]))
    )
    .concat(["ET"])
    .join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
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
  let rawSteps: unknown = steps;
  if (typeof rawSteps === "string") {
    const textValue = rawSteps;
    try {
      rawSteps = JSON.parse(textValue);
    } catch {
      rawSteps = textValue
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter(Boolean)
        .map((line: string, idx: number) => ({
          stepNumber: idx + 1,
          action: line,
          expectedResult: "",
        }));
    }
  }
  if (rawSteps && typeof rawSteps === "object" && !Array.isArray(rawSteps)) {
    const maybeSteps = (rawSteps as Record<string, unknown>).steps;
    if (Array.isArray(maybeSteps)) {
      rawSteps = maybeSteps;
    }
  }
  if (!Array.isArray(rawSteps)) return [];

  const normalized: StepExecutionItem[] = [];
  rawSteps.forEach((item: unknown, idx: number) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const step = item as Record<string, unknown>;
      const rawStepNumber = step.stepNumber;
      const parsedStepNumber =
        typeof rawStepNumber === "number"
          ? rawStepNumber
          : typeof rawStepNumber === "string"
          ? Number(rawStepNumber)
          : NaN;
      const stepNumber = Number.isFinite(parsedStepNumber) ? parsedStepNumber : idx + 1;
      normalized.push({
        stepNumber,
        action: asString(step.action) || `Step ${stepNumber}`,
        expectedResult: asString(step.expectedResult),
        status: "NOT_EXECUTED",
        actualResult: "",
        notes: "",
      });
      return;
    }
    const text = asString(item);
    if (!text) return;
    normalized.push({
      stepNumber: idx + 1,
      action: text,
      expectedResult: "",
      status: "NOT_EXECUTED",
      actualResult: "",
      notes: "",
    });
  });
  return normalized.sort((a, b) => a.stepNumber - b.stepNumber);
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

const SUITE_EXECUTION_MODE = {
  SEQUENTIAL: "SEQUENTIAL",
  PARALLEL: "PARALLEL",
} as const;
type SuiteExecutionModeValue = (typeof SUITE_EXECUTION_MODE)[keyof typeof SUITE_EXECUTION_MODE];

const SUITE_TYPE = {
  STATIC: "STATIC",
  DYNAMIC: "DYNAMIC",
} as const;
type SuiteTypeValue = (typeof SUITE_TYPE)[keyof typeof SUITE_TYPE];

const SUITE_EXECUTION_STATUS = {
  PLANNED: "PLANNED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
} as const;
type SuiteExecutionStatusValue =
  (typeof SUITE_EXECUTION_STATUS)[keyof typeof SUITE_EXECUTION_STATUS];

const getSuiteExecutionStatus = (summary: {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
}): SuiteExecutionStatusValue => {
  const { total, passed, failed, blocked, skipped } = summary;
  const completed = passed + failed + blocked + skipped;
  if (total === 0) return SUITE_EXECUTION_STATUS.PLANNED;
  if (completed === 0) return SUITE_EXECUTION_STATUS.RUNNING;
  if (completed < total) return SUITE_EXECUTION_STATUS.RUNNING;
  if (failed + blocked > 0 && passed > 0) return SUITE_EXECUTION_STATUS.PARTIAL;
  if (failed + blocked > 0 && passed === 0) return SUITE_EXECUTION_STATUS.FAILED;
  return SUITE_EXECUTION_STATUS.COMPLETED;
};

const refreshSuiteExecutionSummary = async (suiteExecutionId: string): Promise<void> => {
  const cases = await prismaAny.testSuiteExecutionCase.findMany({
    where: { suiteExecutionId },
    select: { status: true },
  });
  const total = cases.length;
  const passed = cases.filter((item: any) => item.status === TestRunCaseStatus.PASSED).length;
  const failed = cases.filter((item: any) => item.status === TestRunCaseStatus.FAILED).length;
  const blocked = cases.filter((item: any) => item.status === TestRunCaseStatus.BLOCKED).length;
  const skipped = cases.filter((item: any) => item.status === TestRunCaseStatus.SKIPPED).length;
  const completed = passed + failed + blocked + skipped;
  const passRate = completed > 0 ? Number(((passed / completed) * 100).toFixed(2)) : null;
  const status = getSuiteExecutionStatus({ total, passed, failed, blocked, skipped });

  await prismaAny.testSuiteExecution.update({
    where: { id: suiteExecutionId },
    data: {
      totalCases: total,
      passed,
      failed,
      blocked,
      skipped,
      passRate,
      status,
      completedAt: completed === total && total > 0 ? new Date() : null,
    },
  });
};

const syncSuiteExecutionCaseFromTestRun = async (
  testRunId: string,
  testCaseId: string,
  executionId: string,
  runCaseStatus: TestRunCaseStatus
): Promise<void> => {
  const suiteCases = await prismaAny.testSuiteExecutionCase.findMany({
    where: {
      testCaseId,
      suiteExecution: { linkedTestRunId: testRunId },
    },
    select: { id: true, suiteExecutionId: true },
  });
  if (!suiteCases.length) return;

  for (const row of suiteCases) {
    await prismaAny.testSuiteExecutionCase.update({
      where: { id: row.id },
      data: {
        status: runCaseStatus,
        executionId,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    await refreshSuiteExecutionSummary(row.suiteExecutionId);
  }
};

const getActiveSuiteExecutionCase = async (
  testRunId: string,
  testCaseId: string
): Promise<{
  id: string;
  suiteExecutionId: string;
  status: TestRunCaseStatus;
  position: number;
  suiteExecution: { id: string; mode: SuiteExecutionModeValue; status: SuiteExecutionStatusValue };
} | null> => {
  const row = await prismaAny.testSuiteExecutionCase.findFirst({
    where: {
      testCaseId,
      suiteExecution: {
        linkedTestRunId: testRunId,
        status: {
          in: [
            SUITE_EXECUTION_STATUS.PLANNED,
            SUITE_EXECUTION_STATUS.RUNNING,
            SUITE_EXECUTION_STATUS.PARTIAL,
            SUITE_EXECUTION_STATUS.FAILED,
          ],
        },
      },
    },
    include: {
      suiteExecution: {
        select: { id: true, mode: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return row ?? null;
};

const enforceSuiteExecutionModeConstraints = async (params: {
  testRunId: string;
  testCaseId: string;
  userId: string;
}): Promise<void> => {
  const suiteCase = await getActiveSuiteExecutionCase(params.testRunId, params.testCaseId);
  if (!suiteCase) return;

  if (suiteCase.status !== TestRunCaseStatus.NOT_RUN) {
    throw new Error("This suite case is already executed");
  }

  const draftByAnyTester = await prisma.testExecution.findFirst({
    where: {
      testRunId: params.testRunId,
      testCaseId: params.testCaseId,
      isDraft: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (draftByAnyTester && draftByAnyTester.executedBy !== params.userId) {
    throw new Error("This suite case is already in progress by another tester");
  }

  if (suiteCase.suiteExecution.mode !== SUITE_EXECUTION_MODE.SEQUENTIAL) {
    return;
  }

  const nextPending = await prismaAny.testSuiteExecutionCase.findFirst({
    where: {
      suiteExecutionId: suiteCase.suiteExecutionId,
      status: TestRunCaseStatus.NOT_RUN,
    },
    orderBy: { position: "asc" },
    select: { id: true, testCaseId: true, position: true },
  });
  if (!nextPending) return;

  if (nextPending.testCaseId !== params.testCaseId) {
    throw new Error("Sequential suite mode: execute the next pending suite case first");
  }
};

const canManageExecution = (req: AuthRequest, executionUserId: string): boolean =>
  req.user!.role === Role.ADMIN || req.user!.userId === executionUserId;

const computeDurationSeconds = (start: Date, end: Date): number => {
  const diffMs = end.getTime() - start.getTime();
  return diffMs <= 0 ? 0 : Math.floor(diffMs / 1000);
};

const toValidDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const computeAccumulatedTimerSeconds = (meta: ExecutionMeta, now: Date): number => {
  const base =
    typeof meta.timerAccumulatedSeconds === "number" && Number.isFinite(meta.timerAccumulatedSeconds)
      ? Math.max(0, Math.floor(meta.timerAccumulatedSeconds))
      : 0;

  if (meta.timerState === "RUNNING") {
    const lastResumed = toValidDate(meta.timerLastResumedAt) || toValidDate(meta.timerStartAt);
    if (!lastResumed) return base;
    return base + computeDurationSeconds(lastResumed, now);
  }

  // Legacy flow fallback: timer started but no explicit state.
  if (!meta.timerState && meta.timerStartAt && !meta.timerStopAt) {
    const start = toValidDate(meta.timerStartAt);
    if (!start) return base;
    return base + computeDurationSeconds(start, now);
  }

  return base;
};

type ExecutionMeta = {
  timerStartAt?: string;
  timerStopAt?: string;
  durationSeconds?: number;
  reexecutionOfId?: string;
  timerState?: "RUNNING" | "PAUSED" | "STOPPED";
  timerAccumulatedSeconds?: number;
  timerLastResumedAt?: string;
  manualDurationSeconds?: number;
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

const parseBugWorkflowStatus = (value: unknown): BugWorkflowStatus | null =>
  parseEnum(BUG_WORKFLOW_STATUS, value);

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

const safeNotify = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    console.error("NOTIFICATION_DISPATCH_ERROR", error);
  }
};

const resolveUserEmail = async (userId?: string | null): Promise<string> => {
  const id = asString(userId);
  if (!id) return "unknown@system";
  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });
  return user?.email || "unknown@system";
};

const notifyBugAssigned = async (params: {
  assigneeId?: string | null;
  assigneeEmail?: string | null;
  bugCode: string;
  issueId: string;
  actorId?: string | null;
}) => {
  if (!params.assigneeId) return;
  await safeNotify(async () => {
    const actorEmail = await resolveUserEmail(params.actorId);
    await createNotification({
      userId: params.assigneeId!,
      type: "BUG_ASSIGNED",
      message: `New bug ${params.bugCode} assigned to you by ${actorEmail}`,
      entityId: params.issueId,
      entityType: "Issue",
    });
    if (params.assigneeEmail) {
      await sendBugAssignedEmail(params.assigneeId!, params.assigneeEmail, params.bugCode);
    }
  });
};

const notifyBugStatusChanged = async (params: {
  issueId: string;
  bugCode: string;
  status: string;
  actorId?: string | null;
  reporter?: { id: string; email: string } | null;
  assignee?: { id: string; email: string } | null;
}) => {
  const recipients = [params.reporter, params.assignee].filter(Boolean) as Array<{ id: string; email: string }>;
  if (!recipients.length) return;
  await safeNotify(async () => {
    const actorEmail = await resolveUserEmail(params.actorId);
    await createNotificationsBulk(
      recipients.map((r) => ({
        userId: r.id,
        type: "BUG_STATUS_CHANGED",
        message: `${params.bugCode} status changed to ${params.status} by ${actorEmail}`,
        entityId: params.issueId,
        entityType: "Issue",
      }))
    );
    for (const recipient of recipients) {
      await sendBugStatusChangedEmail(recipient.id, recipient.email, params.bugCode, params.status);
    }
  });
};

const notifyTestAssigned = async (params: { testerId: string; testerEmail?: string | null; runId: string; runName: string }) => {
  await safeNotify(async () => {
    await createNotification({
      userId: params.testerId,
      type: "TEST_ASSIGNED",
      message: `Test run '${params.runName}' assigned to you`,
      entityId: params.runId,
      entityType: "TestRun",
    });
    if (params.testerEmail) {
      await sendTestAssignedEmail(params.testerId, params.testerEmail, params.runName);
    }
  });
};

const notifyCommentMentions = async (params: {
  issueId: string;
  bugCode: string;
  mentions: string[];
  authorId: string;
}) => {
  if (!params.mentions.length) return;
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: params.authorId },
      OR: params.mentions.map((m) => ({
        OR: [{ email: { contains: m, mode: "insensitive" } }, { name: { contains: m, mode: "insensitive" } }],
      })),
    },
    select: { id: true, email: true },
    take: 20,
  });
  if (!users.length) return;
  await safeNotify(async () => {
    const authorEmail = await resolveUserEmail(params.authorId);
    await createNotificationsBulk(
      users.map((u) => ({
        userId: u.id,
        type: "COMMENT_MENTION",
        message: `@you mentioned in ${params.bugCode} by ${authorEmail}`,
        entityId: params.issueId,
        entityType: "Issue",
      }))
    );
    for (const u of users) {
      await sendCommentMentionEmail(u.id, u.email, params.bugCode);
    }
  });
};

const notifyRetestRequested = async (params: {
  issueId: string;
  bugCode: string;
  originalTesterId?: string | null;
  originalTesterEmail?: string | null;
  actorId?: string | null;
}) => {
  if (!params.originalTesterId) return;
  await safeNotify(async () => {
    const actorEmail = await resolveUserEmail(params.actorId);
    await createNotification({
      userId: params.originalTesterId!,
      type: "RETEST_REQUESTED",
      message: `Re-test requested for ${params.bugCode} by ${actorEmail}`,
      entityId: params.issueId,
      entityType: "Issue",
    });
    if (params.originalTesterEmail) {
      await sendRetestRequestedEmail(params.originalTesterId!, params.originalTesterEmail, params.bugCode);
    }
  });
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

const ensureIssueAccess = async (
  req: AuthRequest,
  issueId: string
): Promise<{
  allowed: boolean;
  issue?: { id: string; assignedTo: string | null; reportedBy: string; bugCode: string | null };
}> => {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, assignedTo: true, reportedBy: true, bugCode: true },
  });
  if (!issue) {
    return { allowed: false };
  }
  if (req.user!.role === Role.ADMIN) {
    return { allowed: true, issue };
  }
  if (req.user!.role === Role.DEVELOPER && issue.assignedTo !== req.user!.userId) {
    return { allowed: false, issue };
  }
  return { allowed: true, issue };
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

const resolveTestCaseRefs = async (
  refs: string[]
): Promise<{ resolvedIds: string[]; unresolved: string[] }> => {
  const cleaned = [...new Set(refs.map((item) => asString(item)).filter(Boolean))];
  if (!cleaned.length) return { resolvedIds: [], unresolved: [] };

  const rows = await prisma.testCase.findMany({
    where: {
      isDeleted: false,
      OR: [{ id: { in: cleaned } }, { testCaseCode: { in: cleaned } }],
    },
    select: { id: true, testCaseCode: true },
  });

  const byId = new Map<string, string>();
  const byCode = new Map<string, string>();
  rows.forEach((row) => {
    byId.set(row.id, row.id);
    if (row.testCaseCode) byCode.set(row.testCaseCode, row.id);
  });

  const resolved: string[] = [];
  const unresolved: string[] = [];
  cleaned.forEach((ref) => {
    const id = byId.get(ref) || byCode.get(ref);
    if (id) resolved.push(id);
    else unresolved.push(ref);
  });

  return { resolvedIds: [...new Set(resolved)], unresolved };
};

router.use(authenticate);
const {
  requireProjectFromRequest,
  requireProjectFromTestCaseId,
  requireProjectFromSuiteId,
  requireProjectFromExecutionId,
} = projectGuards;
applyProjectScopeMiddleware(router);

/* =========================
   TESTER/SHARED TEST CASE FLOWS
========================= */
router.get(
  "/testcases",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const where: Prisma.TestCaseWhereInput = {
      isDeleted: false,
    };
    if (projectId) {
      where.projectId = projectId;
    }
    const testCases = await prisma.testCase.findMany({
      where,
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
  requireProjectFromTestCaseId,
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
    if (req.projectContext?.projectId && testCase.projectId !== req.projectContext.projectId) {
      return res.status(404).json({ message: "Test case not found in selected project" });
    }
    return res.json(testCase);
  }
);

router.post("/testcases", authorizeRoles(Role.TESTER), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
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
  const projectId = asString(req.body.projectId);
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
  const writableProject = await ensureWritableProject(req, res, projectId);
  if (!writableProject) return;
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
      projectId: writableProject.id,
    },
  });

  await writeAuditLog(req.user!.userId, "CREATE_TEST_CASE", "TestCase", created.id, {
    title: created.title,
    priority: created.priority,
  });

  return res.status(201).json(created);
});

router.put(
  "/testcases/:id",
  authorizeRoles(Role.TESTER),
  requireProjectFromTestCaseId,
  async (req: AuthRequest, res: Response) => {
  const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.isDeleted) {
    return res.status(404).json({ message: "Test case not found" });
  }
  if (req.projectContext?.projectId && existing.projectId !== req.projectContext.projectId) {
    return res.status(404).json({ message: "Test case not found in selected project" });
  }
  if (!isOwnerOrAssignee(req, existing.createdBy, existing.assignedTo)) {
    return res.status(403).json({ message: "You can edit only owned/assigned test cases" });
  }
  if (existing.status === TestCaseStatus.ARCHIVED) {
    return res.status(403).json({ message: "Archived test cases cannot be modified or executed." });
  }
  const changeSummary = asString(req.body.changeSummary);
  if (!changeSummary) {
    return res.status(400).json({ message: "changeSummary is required for edit" });
  }
  const requestedStatus = parseEnum(TestCaseStatus, req.body.status);
  if (requestedStatus && !isValidTestCaseStatusTransition(existing.status, requestedStatus)) {
    return res.status(400).json({
      message: `Invalid status transition from ${existing.status} to ${requestedStatus}`,
    });
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
      status: requestedStatus ?? undefined,
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
}
);

router.delete(
  "/testcases/:id",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCase.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: "Test case not found" });
    }
    if (existing.status === TestCaseStatus.ARCHIVED) {
      return res.status(403).json({ message: "Archived test cases cannot be modified or executed." });
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

router.patch(
  "/testcase-templates/:id",
  authorizeRoles(Role.TESTER),
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.testCaseTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }
    if (existing.createdBy !== req.user!.userId) {
      return res.status(403).json({ message: "You can only edit templates you created" });
    }

    let parsedSteps: Prisma.InputJsonValue | undefined;
    if (req.body.steps !== undefined) {
      parsedSteps = parseJsonValue(req.body.steps, existing.steps as Prisma.InputJsonValue);
      const stepsValidationError = validateStepItems(parsedSteps);
      if (stepsValidationError) {
        return res.status(400).json({ message: stepsValidationError });
      }
    }

    const updated = await prisma.testCaseTemplate.update({
      where: { id: existing.id },
      data: {
        name: req.body.name !== undefined ? asString(req.body.name) : undefined,
        category: req.body.category !== undefined ? asString(req.body.category) || null : undefined,
        description: req.body.description !== undefined ? asString(req.body.description) || null : undefined,
        preConditions:
          req.body.preConditions !== undefined
            ? parseJsonValue(req.body.preConditions, existing.preConditions ?? [])
            : undefined,
        testDataRequirements:
          req.body.testDataRequirements !== undefined
            ? parseJsonValue(req.body.testDataRequirements, existing.testDataRequirements ?? [])
            : undefined,
        environmentRequirements:
          req.body.environmentRequirements !== undefined
            ? parseJsonValue(req.body.environmentRequirements, existing.environmentRequirements ?? [])
            : undefined,
        postConditions:
          req.body.postConditions !== undefined
            ? parseJsonValue(req.body.postConditions, existing.postConditions ?? [])
            : undefined,
        metadata:
          req.body.metadata !== undefined
            ? parseJsonValue(req.body.metadata, existing.metadata ?? {})
            : undefined,
        module: req.body.module !== undefined ? asString(req.body.module) || null : undefined,
        steps: parsedSteps !== undefined ? parsedSteps : undefined,
        priority: parseEnum(Priority, req.body.priority) ?? undefined,
        severity: parseEnum(TestSeverity, req.body.severity) ?? undefined,
        type: parseEnum(TestCaseType, req.body.type) ?? undefined,
        status: parseEnum(TestCaseStatus, req.body.status) ?? undefined,
        tags: req.body.tags !== undefined ? asStringArray(req.body.tags) : undefined,
        estimatedDurationMinutes:
          req.body.estimatedDurationMinutes !== undefined &&
          typeof req.body.estimatedDurationMinutes === "number"
            ? req.body.estimatedDurationMinutes
            : req.body.estimatedDurationMinutes !== undefined
            ? null
            : undefined,
        automationStatus: parseEnum(AutomationStatus, req.body.automationStatus) ?? undefined,
        automationScriptLink:
          req.body.automationScriptLink !== undefined
            ? asString(req.body.automationScriptLink) || null
            : undefined,
      },
    });

    await writeAuditLog(req.user!.userId, "EDIT_TEST_CASE_TEMPLATE", "TestCaseTemplate", updated.id);
    return res.json(updated);
  }
);

router.delete(
  "/testcase-templates/:id",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const template = await prisma.testCaseTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    if (template.createdBy !== req.user!.userId && req.user!.role !== Role.ADMIN) {
      return res.status(403).json({ message: "You can only delete templates you created" });
    }

    await prisma.testCaseTemplate.delete({ where: { id: req.params.id } });
    await writeAuditLog(req.user!.userId, "DELETE_TEST_CASE_TEMPLATE", "TestCaseTemplate", req.params.id);
    return res.json({ message: "Template deleted" });
  }
);

router.post(
  "/testcases/from-template/:templateId",
  authorizeRoles(Role.TESTER),
  requireProjectFromRequest,
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
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const writableProject = await ensureWritableProject(req, res, projectId);
    if (!writableProject) return;
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
        projectId: writableProject.id,
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
  requireProjectFromRequest,
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

    const found = await prisma.testCase.findMany({
      where: ownedOrAssignedFilter,
      select: { id: true, status: true },
    });
    const allowedIds = found.map((item) => item.id);
    if (allowedIds.length === 0) {
      return res.status(403).json({ message: "No authorized test cases for bulk operation" });
    }
    const hasArchived = found.some((item) => item.status === TestCaseStatus.ARCHIVED);
    const readOnlyOps = new Set(["EXPORT_CSV", "EXPORT_EXCEL"]);
    if (hasArchived && !readOnlyOps.has(operation)) {
      return res.status(403).json({ message: "Archived test cases cannot be modified or executed." });
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
      const invalid = found.find((item) => !isValidTestCaseStatusTransition(item.status, status));
      if (invalid) {
        return res.status(400).json({
          message: `Invalid status transition from ${invalid.status} to ${status}`,
        });
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
      const suite = await prismaAny.testSuite.findUnique({
        where: { id: suiteId },
        select: { id: true, isArchived: true, projectId: true },
      });
      if (!suite || suite.isArchived) {
        return res.status(404).json({ message: "Suite not found" });
      }
      const cases = await prisma.testCase.findMany({
        where: { id: { in: allowedIds }, isDeleted: false },
        select: { id: true, projectId: true },
      });
      const invalid = cases.find((row) => row.projectId !== suite.projectId);
      if (invalid) {
        return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
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
  requireProjectFromRequest,
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

    const projectId = asString(req.body.projectId);
    const writableProject = await ensureWritableProject(req, res, projectId);
    if (!writableProject) return;
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
      if (record.title.length > 400) {
        errors.push(`Row ${idx + 1}: title exceeds 400 characters`);
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
            projectId: writableProject.id,
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
      const isCreator = run.createdBy === req.user!.userId;
      const included = run.testCases.some((item: { testCaseId: string }) => item.testCaseId === existing.id);
      if (req.user!.role !== Role.ADMIN && !assigned && !isCreator) {
        return res.status(403).json({ message: "You are not assigned to this test run" });
      }
      if (!included) {
        return res.status(403).json({ message: "Selected test case is not part of this test run" });
      }
      if (run.projectId !== existing.projectId) {
        return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
      }
      try {
        await enforceSuiteExecutionModeConstraints({
          testRunId,
          testCaseId: existing.id,
          userId: req.user!.userId,
        });
      } catch (error: any) {
        return res.status(409).json({ message: error?.message || "Suite execution constraint violation" });
      }
    }

    const latestDraft = await prisma.testExecution.findFirst({
      where: {
        testCaseId: existing.id,
        projectId: existing.projectId,
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
            timerState: parsedDraft.meta.timerState || null,
            timerAccumulatedSeconds:
              typeof parsedDraft.meta.timerAccumulatedSeconds === "number"
                ? parsedDraft.meta.timerAccumulatedSeconds
                : null,
            timerLastResumedAt: parsedDraft.meta.timerLastResumedAt || null,
            manualDurationSeconds:
              typeof parsedDraft.meta.manualDurationSeconds === "number"
                ? parsedDraft.meta.manualDurationSeconds
                : null,
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
    if (existing.status === TestCaseStatus.ARCHIVED) {
      return res.status(403).json({ message: "Archived test cases cannot be modified or executed." });
    }
    if (existing.status !== TestCaseStatus.APPROVED) {
      return res.status(403).json({ message: "Only approved test cases can be executed." });
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
      const isCreator = run.createdBy === req.user!.userId;
      const included = run.testCases.some((item: { testCaseId: string }) => item.testCaseId === existing.id);
      if (req.user!.role !== Role.ADMIN && !assigned && !isCreator) {
        return res.status(403).json({ message: "You are not assigned to this test run" });
      }
      if (!included) {
        return res.status(403).json({ message: "Selected test case is not part of this test run" });
      }
      try {
        await enforceSuiteExecutionModeConstraints({
          testRunId,
          testCaseId: existing.id,
          userId: req.user!.userId,
        });
      } catch (error: any) {
        return res.status(409).json({ message: error?.message || "Suite execution constraint violation" });
      }
    }

    // Idempotent start: reuse latest draft for same user + test case + run.
    const existingDraft = await prisma.testExecution.findFirst({
      where: {
        testCaseId: existing.id,
        executedBy: req.user!.userId,
        testRunId,
        isDraft: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (existingDraft) {
      return res.status(200).json(existingDraft);
    }

    const execution = await prisma.testExecution.create({
      data: {
        testCaseId: existing.id,
        projectId: existing.projectId,
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
    const now = new Date();
    const startedAt = parsed.meta.timerStartAt || now.toISOString();
    const accumulatedSeconds = computeAccumulatedTimerSeconds(parsed.meta, now);
    const updated = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        notes: mergeExecutionNotes(execution.notes, parsed.userNotes, {
          timerStartAt: startedAt,
          timerStopAt: undefined,
          timerState: "RUNNING",
          timerAccumulatedSeconds: accumulatedSeconds,
          timerLastResumedAt: now.toISOString(),
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
      durationSeconds: accumulatedSeconds,
      timerState: "RUNNING",
      timerAccumulatedSeconds: accumulatedSeconds,
      timerLastResumedAt: now.toISOString(),
    });
  }
);

router.post(
  "/executions/:executionId/timer/pause",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({ where: { id: req.params.executionId } });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, execution.executedBy)) {
      return res.status(403).json({ message: "You can pause timer only for your own execution" });
    }
    if (!execution.isDraft) {
      return res.status(400).json({ message: "Execution already finalized" });
    }

    const parsed = parseExecutionNotes(execution.notes);
    const now = new Date();
    const startedAt = parsed.meta.timerStartAt || execution.executedAt.toISOString();
    const accumulatedSeconds = computeAccumulatedTimerSeconds(parsed.meta, now);
    const updated = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        notes: mergeExecutionNotes(execution.notes, parsed.userNotes, {
          timerStartAt: startedAt,
          timerState: "PAUSED",
          timerAccumulatedSeconds: accumulatedSeconds,
          timerLastResumedAt: undefined,
          durationSeconds: accumulatedSeconds,
          timerStopAt: undefined,
        }),
      },
    });

    await writeAuditLog(req.user!.userId, "PAUSE_EXECUTION_TIMER", "TestExecution", updated.id, {
      durationSeconds: accumulatedSeconds,
    });
    return res.json({
      id: updated.id,
      startedAt,
      completedAt: null,
      durationSeconds: accumulatedSeconds,
      timerState: "PAUSED",
      timerAccumulatedSeconds: accumulatedSeconds,
      timerLastResumedAt: null,
    });
  }
);

router.post(
  "/executions/:executionId/timer/resume",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({ where: { id: req.params.executionId } });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, execution.executedBy)) {
      return res.status(403).json({ message: "You can resume timer only for your own execution" });
    }
    if (!execution.isDraft) {
      return res.status(400).json({ message: "Execution already finalized" });
    }

    const parsed = parseExecutionNotes(execution.notes);
    const now = new Date();
    const startedAt = parsed.meta.timerStartAt || execution.executedAt.toISOString();
    const accumulatedSeconds = computeAccumulatedTimerSeconds(parsed.meta, now);
    const updated = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        notes: mergeExecutionNotes(execution.notes, parsed.userNotes, {
          timerStartAt: startedAt,
          timerState: "RUNNING",
          timerAccumulatedSeconds: accumulatedSeconds,
          timerLastResumedAt: now.toISOString(),
          timerStopAt: undefined,
        }),
      },
    });

    await writeAuditLog(req.user!.userId, "RESUME_EXECUTION_TIMER", "TestExecution", updated.id, {
      durationSeconds: accumulatedSeconds,
    });
    return res.json({
      id: updated.id,
      startedAt,
      completedAt: null,
      durationSeconds: accumulatedSeconds,
      timerState: "RUNNING",
      timerAccumulatedSeconds: accumulatedSeconds,
      timerLastResumedAt: now.toISOString(),
    });
  }
);

router.post(
  "/executions/:executionId/timer/manual",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const execution = await prisma.testExecution.findUnique({ where: { id: req.params.executionId } });
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    if (!canManageExecution(req, execution.executedBy)) {
      return res.status(403).json({ message: "You can set duration only for your own execution" });
    }
    if (!execution.isDraft) {
      return res.status(400).json({ message: "Execution already finalized" });
    }

    const secondsRaw =
      typeof req.body.durationSeconds === "number"
        ? req.body.durationSeconds
        : typeof req.body.durationMinutes === "number"
        ? Math.round(req.body.durationMinutes * 60)
        : NaN;
    if (!Number.isFinite(secondsRaw) || secondsRaw < 0) {
      return res.status(400).json({ message: "durationSeconds or durationMinutes must be a non-negative number" });
    }
    const durationSeconds = Math.floor(secondsRaw);
    const parsed = parseExecutionNotes(execution.notes);
    const startedAt = parsed.meta.timerStartAt || execution.executedAt.toISOString();
    const updated = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        notes: mergeExecutionNotes(execution.notes, parsed.userNotes, {
          timerStartAt: startedAt,
          manualDurationSeconds: durationSeconds,
          durationSeconds,
        }),
      },
    });
    await writeAuditLog(req.user!.userId, "SET_EXECUTION_MANUAL_DURATION", "TestExecution", updated.id, {
      durationSeconds,
    });
    return res.json({
      id: updated.id,
      startedAt,
      completedAt: parsed.meta.timerStopAt || null,
      durationSeconds,
      manualDurationSeconds: durationSeconds,
      timerState: parsed.meta.timerState || null,
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
    const accumulatedSeconds = computeAccumulatedTimerSeconds(parsed.meta, end);
    const durationSeconds =
      typeof parsed.meta.manualDurationSeconds === "number"
        ? Math.max(0, Math.floor(parsed.meta.manualDurationSeconds))
        : accumulatedSeconds;
    const updated = await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        notes: mergeExecutionNotes(execution.notes, parsed.userNotes, {
          timerStartAt: start.toISOString(),
          timerStopAt: end.toISOString(),
          timerState: "STOPPED",
          timerAccumulatedSeconds: accumulatedSeconds,
          timerLastResumedAt: undefined,
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
      timerState: "STOPPED",
      timerAccumulatedSeconds: accumulatedSeconds,
      timerLastResumedAt: null,
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
    if (original.testCase.status === TestCaseStatus.ARCHIVED) {
      return res.status(403).json({ message: "Archived test cases cannot be modified or executed." });
    }
    if (original.testCase.status !== TestCaseStatus.APPROVED) {
      return res.status(403).json({ message: "Only approved test cases can be executed." });
    }

    const restarted = await prisma.testExecution.create({
      data: {
        testCaseId: original.testCaseId,
        projectId: original.testCase.projectId,
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
    const accumulatedSeconds = computeAccumulatedTimerSeconds(parsed.meta, completedAt);
    const durationSeconds =
      typeof parsed.meta.manualDurationSeconds === "number"
        ? Math.max(0, Math.floor(parsed.meta.manualDurationSeconds))
        : accumulatedSeconds > 0
        ? accumulatedSeconds
        : computeDurationSeconds(timerStart, completedAt);
    const finalNotes = mergeExecutionNotes(execution.notes, finalUserNotes, {
      timerStartAt: timerStart.toISOString(),
      timerStopAt: completedAt.toISOString(),
      timerState: "STOPPED",
      timerAccumulatedSeconds: accumulatedSeconds,
      timerLastResumedAt: undefined,
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
      await syncSuiteExecutionCaseFromTestRun(
        finalized.testRunId,
        finalized.testCaseId,
        finalized.id,
        deriveRunCaseStatus(finalResult)
      );
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
    if (existing.status === TestCaseStatus.ARCHIVED) {
      return res.status(403).json({ message: "Archived test cases cannot be modified or executed." });
    }
    if (existing.status !== TestCaseStatus.APPROVED) {
      return res.status(403).json({ message: "Only approved test cases can be executed." });
    }

    const result = parseEnum(ExecutionStatus, req.body.result);
    if (!result) {
      return res.status(400).json({ message: "Valid execution result is required" });
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
      const isCreator = run.createdBy === req.user!.userId;
      const included = run.testCases.some((item: { testCaseId: string }) => item.testCaseId === existing.id);
      if (req.user!.role !== Role.ADMIN && !assigned && !isCreator) {
        return res.status(403).json({ message: "You are not assigned to this test run" });
      }
      if (!included) {
        return res.status(403).json({ message: "Selected test case is not part of this test run" });
      }
      if (run.projectId !== existing.projectId) {
        return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
      }
      try {
        await enforceSuiteExecutionModeConstraints({
          testRunId,
          testCaseId: existing.id,
          userId: req.user!.userId,
        });
      } catch (error: any) {
        return res.status(409).json({ message: error?.message || "Suite execution constraint violation" });
      }
    }

    const execution = await prisma.testExecution.create({
      data: {
        testCaseId: existing.id,
        projectId: existing.projectId,
        executedBy: req.user!.userId,
        testRunId,
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
      await syncSuiteExecutionCaseFromTestRun(
        execution.testRunId,
        execution.testCaseId,
        execution.id,
        deriveRunCaseStatus(result)
      );
    }

    await writeAuditLog(req.user!.userId, "EXECUTE_TEST_CASE", "TestExecution", execution.id, { result });
    return res.status(201).json(execution);
  }
);

router.post(
  "/test-runs",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const name = asString(req.body.name);
    const description = asString(req.body.description) || null;
    const projectIdInput = asString(req.body.projectId) || null;
    const milestoneIdInput = asString(req.body.milestoneId) || null;
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
      select: { id: true, projectId: true, status: true },
    });
    if (foundCases.length !== distinctCaseIds.length) {
      return res.status(400).json({ message: "One or more testCaseIds are invalid or deleted" });
    }
    const inferredProjectIds = [...new Set(foundCases.map((item) => item.projectId).filter(Boolean))];
    const archivedInRun = foundCases.find((item) => item.status === TestCaseStatus.ARCHIVED);
    if (archivedInRun) {
      return res.status(403).json({ message: "Archived test cases cannot be added to test runs." });
    }
    if (inferredProjectIds.length > 1) {
      return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
    }
    if (projectIdInput && inferredProjectIds.length > 0 && inferredProjectIds[0] !== projectIdInput) {
      return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
    }
    const finalProjectId = projectIdInput || (inferredProjectIds[0] as string | undefined) || "";
    const writableProject = await ensureWritableProject(req, res, finalProjectId);
    if (!writableProject) return;
    if (milestoneIdInput) {
      const milestone = await prismaAny.projectMilestone.findUnique({
        where: { id: milestoneIdInput },
        select: { id: true, projectId: true },
      });
      if (!milestone?.id) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      if (milestone.projectId !== writableProject.id) {
        return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
      }
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
      const run = await (tx as any).testRun.create({
        data: {
          name,
          description,
          createdBy: req.user!.userId,
          targetStartDate,
          targetEndDate,
          status: TestRunStatus.PLANNED,
          projectId: writableProject.id,
          milestoneId: milestoneIdInput || null,
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
    if (distinctTesterIds.length > 0) {
      const testers = await prisma.user.findMany({
        where: { id: { in: distinctTesterIds } },
        select: { id: true, email: true },
      });
      await Promise.all(
        testers.map((tester) =>
          notifyTestAssigned({
            testerId: tester.id,
            testerEmail: tester.email,
            runId: created.id,
            runName: created.name,
          })
        )
      );
    }

    return res.status(201).json(created);
  }
);

router.get(
  "/test-runs",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const projectId = req.projectContext?.projectId || asString(req.query.projectId);
    const where: Prisma.TestRunWhereInput =
      req.user!.role === Role.ADMIN
        ? { projectId }
        : {
            projectId,
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
    await notifyTestAssigned({
      testerId: tester.id,
      testerEmail: tester.email,
      runId: run.id,
      runName: run.name,
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
    if (testCase.status === TestCaseStatus.ARCHIVED) {
      return res.status(403).json({ message: "Archived test cases cannot be added to test runs." });
    }
    if (testCase.projectId !== run.projectId) {
      return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
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

router.post("/suites", authorizeRoles(Role.TESTER), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
  try {
    const name = asString(req.body.name);
    if (!name) {
      return res.status(400).json({ message: "Suite name is required" });
    }
    const parentSuiteId = asString(req.body.parentSuiteId) || null;
    const projectId = asString(req.body.projectId);
    const writableProject = await ensureWritableProject(req, res, projectId);
    if (!writableProject) return;
    const moduleName = asString(req.body.module) || null;
    const suiteType =
      (parseEnum(SUITE_TYPE, asString(req.body.type).toUpperCase()) || SUITE_TYPE.STATIC) as SuiteTypeValue;
    const testCaseRefs = Array.isArray(req.body.testCaseIds) ? asStringArray(req.body.testCaseIds) : [];
    const rawFilter =
      req.body.filterJson && typeof req.body.filterJson === "object" && !Array.isArray(req.body.filterJson)
        ? (req.body.filterJson as Record<string, unknown>)
        : {};
    const filterModules = Array.isArray(rawFilter.modules) ? asStringArray(rawFilter.modules) : [];
    const dynamicModules = [...new Set([...filterModules, ...(moduleName ? [moduleName] : [])])].filter(Boolean);
    if (parentSuiteId) {
      const parentSuite = await prismaAny.testSuite.findUnique({ where: { id: parentSuiteId } });
      if (!parentSuite || parentSuite.isArchived) {
        return res.status(404).json({ message: "Parent suite not found" });
      }
      if (String(parentSuite.projectId || "") !== writableProject.id) {
        return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
      }
    }

    let resolvedCaseIds: string[] = [];
    let filterJson: Prisma.InputJsonValue | null = null;

    if (suiteType === SUITE_TYPE.DYNAMIC) {
      if (dynamicModules.length === 0) {
        return res.status(400).json({ message: "DYNAMIC suite requires at least one module filter" });
      }
      const dynamicModuleSet = new Set(dynamicModules.map((item) => item.toLowerCase()));
      const matchedCases = await prisma.testCase.findMany({
        where: {
          isDeleted: false,
          projectId: writableProject.id,
          module: { not: null },
        },
        select: { id: true, module: true },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      });
      resolvedCaseIds = [
        ...new Set(
          matchedCases
            .filter((row) => dynamicModuleSet.has(asString(row.module).toLowerCase()))
            .map((row) => row.id)
        ),
      ];
      if (resolvedCaseIds.length === 0) {
        return res.status(400).json({ message: "Dynamic suite filter matched no test cases" });
      }
      filterJson = { modules: dynamicModules };
    } else {
      const resolvedRefs = await resolveTestCaseRefs(testCaseRefs);
      if (resolvedRefs.unresolved.length > 0) {
        return res.status(400).json({
          message: `One or more testCaseIds are invalid/deleted: ${resolvedRefs.unresolved.join(", ")}`,
        });
      }
      resolvedCaseIds = resolvedRefs.resolvedIds;
      if (resolvedCaseIds.length > 0) {
        const cases = await prisma.testCase.findMany({
          where: { id: { in: resolvedCaseIds }, isDeleted: false },
          select: { id: true, projectId: true },
        });
        const caseProjectIds = [...new Set(cases.map((item) => item.projectId).filter(Boolean))];
        if (caseProjectIds.length > 1) {
          return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
        }
        if (caseProjectIds.length > 0 && caseProjectIds[0] !== writableProject.id) {
          return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
        }
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const baseData: Record<string, unknown> = {
        name,
        description: asString(req.body.description) || null,
        module: moduleName,
        createdBy: req.user!.userId,
        projectId: writableProject.id,
        parentSuiteId,
      };

      let suite: any;
      try {
        suite = await (tx as any).testSuite.create({
          data: {
            ...baseData,
            type: suiteType,
            filterJson: filterJson || undefined,
          },
        });
      } catch (createError: any) {
        const msg = asString(createError?.message || createError);
        const typeFieldNotSupported =
          msg.includes("Unknown argument `type`") ||
          msg.includes("Unknown field `type`") ||
          msg.includes("Unknown argument `filterJson`") ||
          msg.includes("Unknown field `filterJson`");
        if (!typeFieldNotSupported) {
          throw createError;
        }
        suite = await (tx as any).testSuite.create({ data: baseData });
      }

      if (resolvedCaseIds.length > 0) {
        const rows = resolvedCaseIds.map((testCaseId, idx) => ({
          suiteId: suite.id,
          testCaseId,
          position: idx + 1,
          addedBy: req.user!.userId,
        }));
        await (tx as any).testSuiteCase.createMany({ data: rows });
      }
      return suite;
    });

    await writeAuditLog(req.user!.userId, "CREATE_TEST_SUITE", "TestSuite", created.id, {
      name: created.name,
      requestedType: suiteType,
    });
    return res.status(201).json(created);
  } catch (error: any) {
    console.error("CREATE_SUITE_ERROR:", error?.message || error);
    return res.status(500).json({ message: error?.message || "Failed to create suite" });
  }
});

router.get("/suites", authorizeRoles(Role.TESTER), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
  const includeArchived = String(req.query.includeArchived || "").toLowerCase() === "true";
  const parentSuiteId = asString(req.query.parentSuiteId);
  const projectId = req.projectContext?.projectId || asString(req.query.projectId);
  const moduleName = asString(req.query.module);
  const where: any = {
    ...(includeArchived ? {} : { isArchived: false }),
    ...(parentSuiteId ? { parentSuiteId } : {}),
    projectId,
    ...(moduleName ? { module: moduleName } : {}),
  };

  const suites = await (prisma as any).testSuite.findMany({
    where,
    include: {
      parentSuite: { select: { id: true, name: true } },
      childSuites: { select: { id: true, name: true, isArchived: true } },
      _count: { select: { suiteCases: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return res.json(suites);
});

router.get("/suites/:suiteId", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const suite = await (prisma as any).testSuite.findUnique({
    where: { id: req.params.suiteId },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      parentSuite: { select: { id: true, name: true } },
      childSuites: { select: { id: true, name: true, isArchived: true } },
      suiteCases: {
        include: { testCase: { select: { id: true, title: true, testCaseCode: true, module: true } } },
        orderBy: { position: "asc" },
      },
      _count: { select: { suiteCases: true } },
    },
  });
  if (!suite) {
    return res.status(404).json({ message: "Suite not found" });
  }
  return res.json(suite);
});

router.patch("/suites/:suiteId", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const suite = await prismaAny.testSuite.findUnique({ where: { id: req.params.suiteId } });
  if (!suite) return res.status(404).json({ message: "Suite not found" });

  const parentSuiteId = req.body.parentSuiteId !== undefined ? asString(req.body.parentSuiteId) || null : undefined;
  if (parentSuiteId !== undefined) {
    if (parentSuiteId === suite.id) {
      return res.status(400).json({ message: "Suite cannot be parent of itself" });
    }
    if (parentSuiteId) {
      let cursor: string | null = parentSuiteId;
      while (cursor) {
        const node: any = await prismaAny.testSuite.findUnique({
          where: { id: cursor },
          select: { id: true, parentSuiteId: true, isArchived: true },
        });
        if (!node) return res.status(404).json({ message: "Parent suite not found" });
        if (node.isArchived) return res.status(400).json({ message: "Archived suite cannot be set as parent" });
        if (node.id === suite.id) {
          return res.status(400).json({ message: "Circular hierarchy is not allowed" });
        }
        cursor = (node.parentSuiteId as string | null) || null;
      }
    }
  }

  let nextProjectId: string | undefined;
  if (req.body.projectId !== undefined) {
    const candidateProjectId = asString(req.body.projectId);
    const writableProject = await ensureWritableProject(req, res, candidateProjectId);
    if (!writableProject) return;
    const linkedCases = await prismaAny.testSuiteCase.findMany({
      where: { suiteId: suite.id },
      select: { testCase: { select: { id: true, projectId: true } } },
    });
    const invalidLink = linkedCases.find(
      (row: any) => String(row.testCase?.projectId || "") !== writableProject.id
    );
    if (invalidLink) {
      return res.status(400).json({
        message: CROSS_PROJECT_REFERENCE_MESSAGE,
      });
    }
    nextProjectId = writableProject.id;
  }

  const updated = await prismaAny.testSuite.update({
    where: { id: suite.id },
    data: {
      name: asString(req.body.name) || undefined,
      description: req.body.description !== undefined ? asString(req.body.description) || null : undefined,
      module: req.body.module !== undefined ? asString(req.body.module) || null : undefined,
      projectId: nextProjectId,
      parentSuiteId,
    },
  });

  await writeAuditLog(req.user!.userId, "UPDATE_TEST_SUITE", "TestSuite", updated.id);
  return res.json(updated);
});

router.post("/suites/:suiteId/testcases", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const suiteId = req.params.suiteId;
  const suite = await prismaAny.testSuite.findUnique({ where: { id: suiteId } });
  if (!suite || suite.isArchived) return res.status(404).json({ message: "Suite not found" });

  const refs = Array.isArray(req.body.testCaseIds)
    ? asStringArray(req.body.testCaseIds)
    : asString(req.body.testCaseId)
    ? [asString(req.body.testCaseId)]
    : [];
  const testCaseRefs = [...new Set(refs)];
  if (!testCaseRefs.length) return res.status(400).json({ message: "testCaseIds are required" });

  const resolvedRefs = await resolveTestCaseRefs(testCaseRefs);
  if (resolvedRefs.unresolved.length > 0) {
    return res.status(400).json({
      message: `One or more testCaseIds are invalid/deleted: ${resolvedRefs.unresolved.join(", ")}`,
    });
  }
  if (suite.projectId) {
    const linkedCases = await prisma.testCase.findMany({
      where: { id: { in: resolvedRefs.resolvedIds }, isDeleted: false },
      select: { id: true, projectId: true },
    });
    const invalidCase = linkedCases.find((item) => item.projectId !== suite.projectId);
    if (invalidCase) {
      return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
    }
  }

  const maxPosRow = await (prisma as any).testSuiteCase.findFirst({
    where: { suiteId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let pos = Number(maxPosRow?.position || 0);

  const createdRows: any[] = [];
  for (const testCaseId of resolvedRefs.resolvedIds) {
    const row = await (prisma as any).testSuiteCase.upsert({
      where: { suiteId_testCaseId: { suiteId, testCaseId } },
      create: {
        suiteId,
        testCaseId,
        position: ++pos,
        addedBy: req.user!.userId,
      },
      update: {},
    });
    createdRows.push(row);
  }
  await writeAuditLog(req.user!.userId, "ADD_TEST_CASE_TO_SUITE", "TestSuite", suiteId, { count: createdRows.length });
  return res.status(201).json(createdRows);
});

router.delete(
  "/suites/:suiteId/testcases/:testCaseId",
  authorizeRoles(Role.TESTER),
  requireProjectFromSuiteId,
  async (req: AuthRequest, res: Response) => {
    const suiteId = req.params.suiteId;
    const suite = await prismaAny.testSuite.findUnique({ where: { id: suiteId } });
    if (!suite) return res.status(404).json({ message: "Suite not found" });
    const ref = asString(req.params.testCaseId);
    const resolved = await resolveTestCaseRefs([ref]);
    if (!resolved.resolvedIds.length) {
      return res.status(404).json({ message: "Test case not found" });
    }
    const testCaseId = resolved.resolvedIds[0];
    const row = await prismaAny.testSuiteCase.findUnique({
      where: { suiteId_testCaseId: { suiteId, testCaseId } },
    });
    if (!row) return res.status(404).json({ message: "Suite test case link not found" });
    await prismaAny.testSuiteCase.delete({ where: { id: row.id } });
    await writeAuditLog(req.user!.userId, "REMOVE_TEST_CASE_FROM_SUITE", "TestSuiteCase", row.id);
    return res.json({ message: "Removed from suite" });
  }
);

router.patch(
  "/suites/:suiteId/testcases/reorder",
  authorizeRoles(Role.TESTER),
  requireProjectFromSuiteId,
  async (req: AuthRequest, res: Response) => {
    const suiteId = req.params.suiteId;
    const suite = await prismaAny.testSuite.findUnique({ where: { id: suiteId } });
    if (!suite) return res.status(404).json({ message: "Suite not found" });
    if (suite.isArchived) return res.status(400).json({ message: "Cannot reorder archived suite" });
    const orderedRefs = Array.isArray(req.body.testCaseIds) ? asStringArray(req.body.testCaseIds) : [];
    if (!orderedRefs.length) return res.status(400).json({ message: "testCaseIds are required" });
    const uniqueRefs = [...new Set(orderedRefs)];
    if (uniqueRefs.length !== orderedRefs.length) {
      return res.status(400).json({ message: "testCaseIds must not contain duplicates" });
    }
    const resolvedRefs = await resolveTestCaseRefs(orderedRefs);
    if (resolvedRefs.unresolved.length > 0) {
      return res.status(400).json({
        message: `One or more testCaseIds are invalid/deleted: ${resolvedRefs.unresolved.join(", ")}`,
      });
    }
    const orderedIds = resolvedRefs.resolvedIds;

    const links = await prismaAny.testSuiteCase.findMany({ where: { suiteId }, select: { testCaseId: true } });
    const existing = links.map((l: any) => l.testCaseId).sort();
    const incoming = [...new Set(orderedIds)].sort();
    if (existing.length !== incoming.length || existing.some((id: string, i: number) => id !== incoming[i])) {
      return res.status(400).json({ message: "testCaseIds must exactly match current suite membership" });
    }

    await prisma.$transaction(
      orderedIds.map((testCaseId, idx) =>
        prismaAny.testSuiteCase.update({
          where: { suiteId_testCaseId: { suiteId, testCaseId } },
          data: { position: idx + 1 },
        })
      )
    );
    await writeAuditLog(req.user!.userId, "REORDER_SUITE_TEST_CASES", "TestSuite", suiteId);
    return res.json({ message: "Suite test case order updated" });
  }
);

router.post("/suites/:suiteId/clone", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const source = await (prisma as any).testSuite.findUnique({
    where: { id: req.params.suiteId },
    include: { suiteCases: { orderBy: { position: "asc" } } },
  });
  if (!source) return res.status(404).json({ message: "Suite not found" });
  if (source.isArchived) return res.status(400).json({ message: "Cannot clone archived suite" });

  const clone = await prisma.$transaction(async (tx) => {
    const created = await (tx as any).testSuite.create({
      data: {
        name: asString(req.body.name) || `${source.name} (Clone)`,
        description: source.description,
        module: source.module,
        createdBy: req.user!.userId,
        projectId: source.projectId,
        parentSuiteId: source.parentSuiteId,
      },
    });
    if (source.suiteCases.length > 0) {
      await (tx as any).testSuiteCase.createMany({
        data: source.suiteCases.map((item: any, idx: number) => ({
          suiteId: created.id,
          testCaseId: item.testCaseId,
          position: idx + 1,
          addedBy: req.user!.userId,
        })),
      });
    }
    return created;
  });
  await writeAuditLog(req.user!.userId, "CLONE_TEST_SUITE", "TestSuite", clone.id, {
    sourceSuiteId: source.id,
  });
  return res.status(201).json(clone);
});

router.post("/suites/:suiteId/archive", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const suite = await prismaAny.testSuite.findUnique({ where: { id: req.params.suiteId } });
  if (!suite) return res.status(404).json({ message: "Suite not found" });
  if (suite.isArchived) return res.status(400).json({ message: "Suite is already archived" });
  const activeChildren = await prismaAny.testSuite.count({
    where: { parentSuiteId: suite.id, isArchived: false },
  });
  if (activeChildren > 0) {
    return res.status(400).json({ message: "Archive child suites first before archiving parent suite" });
  }
  const updated = await prismaAny.testSuite.update({
    where: { id: req.params.suiteId },
    data: { isArchived: true },
  });
  await writeAuditLog(req.user!.userId, "ARCHIVE_TEST_SUITE", "TestSuite", updated.id);
  return res.json(updated);
});

router.post("/suites/:suiteId/restore", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const suite = await prismaAny.testSuite.findUnique({ where: { id: req.params.suiteId } });
  if (!suite) return res.status(404).json({ message: "Suite not found" });
  if (!suite.isArchived) return res.status(400).json({ message: "Suite is already active" });
  if (suite.parentSuiteId) {
    const parent = await prismaAny.testSuite.findUnique({
      where: { id: suite.parentSuiteId },
      select: { id: true, isArchived: true },
    });
    if (!parent) return res.status(400).json({ message: "Parent suite no longer exists" });
    if (parent.isArchived) {
      return res.status(400).json({ message: "Restore parent suite first" });
    }
  }
  const updated = await prismaAny.testSuite.update({
    where: { id: req.params.suiteId },
    data: { isArchived: false },
  });
  await writeAuditLog(req.user!.userId, "RESTORE_TEST_SUITE", "TestSuite", updated.id);
  return res.json(updated);
});

router.delete("/suites/:suiteId", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const suite = await prismaAny.testSuite.findUnique({
    where: { id: req.params.suiteId },
    select: {
      id: true,
      name: true,
      isArchived: true,
      _count: { select: { suiteCases: true, childSuites: true } },
    },
  });
  if (!suite) return res.status(404).json({ message: "Suite not found" });
  if (!suite.isArchived) {
    return res.status(400).json({ message: "Archive suite before permanent delete" });
  }
  if ((suite._count?.childSuites || 0) > 0) {
    return res.status(400).json({ message: "Delete child suites first before deleting parent suite" });
  }

  try {
    await prismaAny.testSuite.delete({
      where: { id: suite.id },
    });
  } catch (error: any) {
    // Prisma FK violation - surface a clearer action for UI.
    if (error?.code === "P2003") {
      return res.status(400).json({ message: "Suite cannot be deleted due to linked records. Delete dependent records first." });
    }
    throw error;
  }

  await writeAuditLog(req.user!.userId, "DELETE_TEST_SUITE", "TestSuite", suite.id, {
    name: suite.name,
    caseCount: suite._count?.suiteCases || 0,
    childCount: suite._count?.childSuites || 0,
  });
  return res.json({ message: "Suite deleted permanently", id: suite.id });
});

router.post("/suite-executions", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const suiteId = asString(req.body.suiteId);
  const mode = parseEnum(SUITE_EXECUTION_MODE, req.body.mode) || SUITE_EXECUTION_MODE.SEQUENTIAL;
  const linkedTestRunId = asString(req.body.linkedTestRunId);
  const reexecuteFromExecutionId = asString(req.body.reexecuteFromExecutionId);
  const reexecuteFailedOnly =
    req.body.reexecuteFailedOnly === true || String(req.body.reexecuteFailedOnly || "").toLowerCase() === "true";
  if (!suiteId) return res.status(400).json({ message: "suiteId is required" });

  const suite = await (prisma as any).testSuite.findUnique({
    where: { id: suiteId },
    include: { suiteCases: { orderBy: { position: "asc" } } },
  });
  if (!suite || suite.isArchived) return res.status(404).json({ message: "Suite not found" });
  if (!suite.suiteCases.length) return res.status(400).json({ message: "Suite has no test cases to execute" });

  let suiteCasesForExecution: any[] = [...suite.suiteCases];
  if (reexecuteFromExecutionId) {
    const sourceExecution = await (prisma as any).testSuiteExecution.findUnique({
      where: { id: reexecuteFromExecutionId },
      include: {
        cases: {
          select: { suiteCaseId: true, status: true },
        },
      },
    });
    if (!sourceExecution || sourceExecution.suiteId !== suite.id) {
      return res.status(400).json({ message: "Invalid reexecuteFromExecutionId for this suite" });
    }
    const statusBySuiteCaseId = new Map<string, string>(
      (sourceExecution.cases || []).map((row: any) => [String(row.suiteCaseId), String(row.status || "")])
    );
    suiteCasesForExecution = suiteCasesForExecution.filter((row: any) => {
      if (!reexecuteFailedOnly) return true;
      return String(statusBySuiteCaseId.get(String(row.id)) || "") === TestRunCaseStatus.FAILED;
    });
    if (suiteCasesForExecution.length === 0) {
      return res.status(400).json({
        message: reexecuteFailedOnly
          ? "No failed test cases found in source suite execution"
          : "No test cases found in source suite execution",
      });
    }
  }

  const requestedTesterIds = Array.isArray(req.body.testerIds) ? [...new Set(asStringArray(req.body.testerIds))] : [];
  const testerIds =
    requestedTesterIds.length > 0
      ? [...new Set([...requestedTesterIds, req.user!.userId])]
      : [req.user!.userId];
  if (testerIds.length > 0) {
    const testers = await prisma.user.findMany({
      where: { id: { in: testerIds }, role: Role.TESTER, isActive: true },
      select: { id: true },
    });
    if (testers.length !== testerIds.length) {
      return res.status(400).json({ message: "One or more testerIds are invalid/inactive/non-tester users" });
    }
  }
  if (linkedTestRunId) {
    const linkedRun = await prisma.testRun.findUnique({
      where: { id: linkedTestRunId },
      select: { id: true, projectId: true },
    });
    if (!linkedRun) {
      return res.status(404).json({ message: "Linked test run not found" });
    }
    if (linkedRun.projectId !== suite.projectId) {
      return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
    }
  }

  const candidateCaseIds = [...new Set(suiteCasesForExecution.map((item: any) => String(item.testCaseId)))];
  if (candidateCaseIds.length > 0) {
    const suiteCases = await prisma.testCase.findMany({
      where: { id: { in: candidateCaseIds }, isDeleted: false },
      select: { id: true, status: true },
    });
    const byId = new Map(suiteCases.map((row) => [row.id, row]));
    const archived = suiteCases.find((row) => row.status === TestCaseStatus.ARCHIVED);
    if (archived) {
      return res.status(403).json({ message: "Archived test cases cannot be added to test runs." });
    }
    const nonApproved = suiteCases.find((row) => row.status !== TestCaseStatus.APPROVED);
    if (nonApproved) {
      return res.status(403).json({ message: "Only approved test cases can be executed." });
    }
    const missingId = candidateCaseIds.find((id) => !byId.has(id));
    if (missingId) {
      return res.status(400).json({ message: "Suite execution contains invalid or deleted test cases" });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    let run: any = null;
    if (linkedTestRunId) {
      run = await tx.testRun.findUnique({
        where: { id: linkedTestRunId },
        include: { testCases: true, assignments: true },
      });
      if (!run) {
        throw new Error("Linked test run not found");
      }
      const existingRunCaseIds = new Set<string>((run.testCases || []).map((row: any) => String(row.testCaseId)));
      const missingRunCases = suiteCasesForExecution
        .map((item: any) => String(item.testCaseId))
        .filter((id: string) => !existingRunCaseIds.has(id));
      if (missingRunCases.length > 0) {
        await tx.testRunCase.createMany({
          data: missingRunCases.map((testCaseId: string) => ({
            testRunId: run.id,
            testCaseId,
            status: TestRunCaseStatus.NOT_RUN,
          })),
          skipDuplicates: true,
        });
      }
      if (testerIds.length > 0) {
        await tx.testRunAssignment.createMany({
          data: testerIds.map((testerId) => ({ testRunId: run.id, testerId })),
          skipDuplicates: true,
        });
      }
      await tx.testRun.update({
        where: { id: run.id },
        data: {
          status: TestRunStatus.IN_PROGRESS,
        },
      });
    } else {
      run = await tx.testRun.create({
        data: {
          name: `${suite.name} Run ${new Date().toISOString().slice(0, 10)}`,
          description: `Auto-linked run for suite ${suite.name}`,
          createdBy: req.user!.userId,
          targetStartDate: req.body.targetStartDate ? new Date(req.body.targetStartDate) : null,
          targetEndDate: req.body.targetEndDate ? new Date(req.body.targetEndDate) : null,
          status: TestRunStatus.PLANNED,
          projectId: suite.projectId,
        },
      });
      await tx.testRunCase.createMany({
        data: suiteCasesForExecution.map((item: any) => ({
          testRunId: run.id,
          testCaseId: item.testCaseId,
          status: TestRunCaseStatus.NOT_RUN,
        })),
      });
      if (testerIds.length > 0) {
        await tx.testRunAssignment.createMany({
          data: testerIds.map((testerId) => ({ testRunId: run.id, testerId })),
          skipDuplicates: true,
        });
      }
    }

    const suiteExecution = await (tx as any).testSuiteExecution.create({
      data: {
        suiteId: suite.id,
        startedBy: req.user!.userId,
        mode,
        status: SUITE_EXECUTION_STATUS.RUNNING,
        linkedTestRunId: run.id,
        totalCases: suiteCasesForExecution.length,
        startedAt: new Date(),
      },
    });

    await (tx as any).testSuiteExecutionCase.createMany({
      data: suiteCasesForExecution.map((item: any) => ({
        suiteExecutionId: suiteExecution.id,
        suiteId: suite.id,
        suiteCaseId: item.id,
        testCaseId: item.testCaseId,
        position: item.position,
        status: TestRunCaseStatus.NOT_RUN,
      })),
    });
    return suiteExecution;
  });

  await refreshSuiteExecutionSummary(created.id);
  await writeAuditLog(req.user!.userId, "START_SUITE_EXECUTION", "TestSuiteExecution", created.id, {
    suiteId,
    mode,
    linkedTestRunId: linkedTestRunId || null,
    reexecuteFromExecutionId: reexecuteFromExecutionId || null,
    reexecuteFailedOnly,
  });
  return res.status(201).json(created);
});

router.get("/suite-executions/:id", authorizeRoles(Role.TESTER), async (req: AuthRequest, res: Response) => {
  await refreshSuiteExecutionSummary(req.params.id);
  const suiteExecution = await (prisma as any).testSuiteExecution.findUnique({
    where: { id: req.params.id },
    include: {
      suite: { select: { id: true, name: true, module: true } },
      starter: { select: { id: true, name: true, email: true } },
      linkedTestRun: { select: { id: true, name: true, status: true } },
      cases: {
        include: {
          testCase: {
            select: {
              id: true,
              title: true,
              description: true,
              testCaseCode: true,
              module: true,
              priority: true,
              status: true,
              steps: true,
            },
          },
          execution: { select: { id: true, result: true, executedAt: true } },
        },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!suiteExecution) return res.status(404).json({ message: "Suite execution not found" });
  return res.json(suiteExecution);
});

router.get("/suites/:suiteId/executions", authorizeRoles(Role.TESTER), requireProjectFromSuiteId, async (req: AuthRequest, res: Response) => {
  const suiteId = req.params.suiteId;
  const executions = await (prisma as any).testSuiteExecution.findMany({
    where: { suiteId },
    include: {
      starter: { select: { id: true, name: true, email: true } },
      linkedTestRun: { select: { id: true, name: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return res.json(executions);
});

router.get(
  "/reports/test-executions",
  authorizeRoles(Role.TESTER, Role.DEVELOPER),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const executions = await prisma.testExecution.findMany({
      where: {
        isDraft: false,
        ...(projectId
          ? {
              testCase: {
                is: { projectId },
              },
            }
          : {}),
      },
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

router.get(
  "/reports/test-executions/summary",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const testRunId = asString(req.query.testRunId);
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const from = asString(req.query.from);
    const to = asString(req.query.to);
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const validFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
    const validTo = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;

    const where: Prisma.TestExecutionWhereInput = {
      isDraft: false,
      ...(testRunId ? { testRunId } : {}),
      ...(projectId
        ? {
            testCase: {
              is: { projectId },
            },
          }
        : {}),
      ...(validFrom || validTo
        ? {
            executedAt: {
              ...(validFrom ? { gte: validFrom } : {}),
              ...(validTo ? { lte: validTo } : {}),
            },
          }
        : {}),
    };

    // Reports are read-only for developers, but should use the same shared execution dataset.
    // Do not scope to only self-executed/self-assigned cases here.

    const executions = await prisma.testExecution.findMany({
      where,
      include: {
        testCase: { select: { id: true, testCaseCode: true, title: true, module: true } },
        executor: { select: { id: true, name: true, email: true } },
        testRun: { select: { id: true, name: true } },
      },
      orderBy: { executedAt: "asc" },
    });

    const totalExecuted = executions.length;
    const passed = executions.filter((item) => item.result === ExecutionStatus.PASSED).length;
    const failed = executions.filter((item) => item.result === ExecutionStatus.FAILED).length;
    const blocked = executions.filter((item) => item.result === ExecutionStatus.BLOCKED).length;
    const skipped = executions.filter((item) => item.result === ExecutionStatus.SKIPPED).length;
    const passRate = totalExecuted > 0 ? Number(((passed / totalExecuted) * 100).toFixed(1)) : 0;

    const byTesterMap = new Map<string, { testerId: string; testerName: string; total: number; passed: number; failed: number; blocked: number; skipped: number }>();
    const byModuleMap = new Map<string, { module: string; total: number; passed: number; failed: number; blocked: number; skipped: number }>();
    const timelineMap = new Map<string, { date: string; total: number; passed: number; failed: number; blocked: number; skipped: number }>();

    const bumpResult = <T extends { total: number; passed: number; failed: number; blocked: number; skipped: number }>(
      row: T,
      result: ExecutionStatus
    ) => {
      row.total += 1;
      if (result === ExecutionStatus.PASSED) row.passed += 1;
      if (result === ExecutionStatus.FAILED) row.failed += 1;
      if (result === ExecutionStatus.BLOCKED) row.blocked += 1;
      if (result === ExecutionStatus.SKIPPED) row.skipped += 1;
    };

    executions.forEach((item) => {
      const testerId = item.executor?.id || item.executedBy;
      const testerName = item.executor?.name || item.executor?.email || item.executedBy;
      const moduleName = item.testCase?.module || "General";
      const dayKey = item.executedAt.toISOString().slice(0, 10);

      const testerRow =
        byTesterMap.get(testerId) ||
        { testerId, testerName, total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 };
      bumpResult(testerRow, item.result);
      byTesterMap.set(testerId, testerRow);

      const moduleRow =
        byModuleMap.get(moduleName) ||
        { module: moduleName, total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 };
      bumpResult(moduleRow, item.result);
      byModuleMap.set(moduleName, moduleRow);

      const timelineRow =
        timelineMap.get(dayKey) ||
        { date: dayKey, total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 };
      bumpResult(timelineRow, item.result);
      timelineMap.set(dayKey, timelineRow);
    });

    const executionByTester = Array.from(byTesterMap.values()).sort((a, b) => b.total - a.total);
    const executionByModule = Array.from(byModuleMap.values()).sort((a, b) => b.total - a.total);
    const executionTimeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const byRunMap = new Map<
      string,
      {
        testRunId: string;
        testRunName: string;
        total: number;
        passed: number;
        failed: number;
        blocked: number;
        skipped: number;
        passRate: number;
      }
    >();
    executions.forEach((item) => {
      const runId = item.testRun?.id || "unlinked";
      const runName = item.testRun?.name || "Unlinked Executions";
      const row =
        byRunMap.get(runId) || {
          testRunId: runId,
          testRunName: runName,
          total: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          skipped: 0,
          passRate: 0,
        };
      bumpResult(row, item.result);
      byRunMap.set(runId, row);
    });
    const executionByTestRun = Array.from(byRunMap.values())
      .map((row) => ({
        ...row,
        passRate: row.total > 0 ? Number(((row.passed / row.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);
    const failedTestCases = executions
      .filter((item) => item.result === ExecutionStatus.FAILED)
      .map((item) => ({
        executionId: item.id,
        testCaseId: item.testCaseId,
        testCaseCode: item.testCase?.testCaseCode || null,
        testCaseTitle: item.testCase?.title || null,
        module: item.testCase?.module || "General",
        tester: item.executor?.name || item.executor?.email || item.executedBy,
        executedAt: item.executedAt,
        notes: parseExecutionNotes(item.notes).userNotes || "",
      }))
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
    const topFailedModules = executionByModule
      .filter((row) => row.failed > 0)
      .sort((a, b) => b.failed - a.failed)
      .slice(0, 3)
      .map((row, idx) => ({ rank: idx + 1, module: row.module, failures: row.failed }));

    const reportStart =
      validFrom?.toISOString() ||
      (executions.length > 0 ? executions[0].executedAt.toISOString() : null);
    const reportEnd =
      validTo?.toISOString() ||
      (executions.length > 0 ? executions[executions.length - 1].executedAt.toISOString() : null);
    const runName =
      testRunId && executions.length > 0
        ? executions.find((item) => item.testRun?.id === testRunId)?.testRun?.name || "Selected Test Run"
        : "All Test Runs";

    const payload = {
      runName,
      projectId: projectId || null,
      period: { from: reportStart, to: reportEnd },
      totalExecuted,
      breakdown: { passed, failed, blocked, skipped },
      passRate,
      executionByTester,
      executionByModule,
      executionByTestRun,
      executionTimeline,
      failedTestCases,
      topFailedModules,
    };

    const exportFormat = asString(req.query.export).toLowerCase();
    if (exportFormat === "csv" || exportFormat === "excel") {
      const header = [
        "runName",
        "periodFrom",
        "periodTo",
        "totalExecuted",
        "passed",
        "failed",
        "blocked",
        "skipped",
        "passRate",
      ];
      const row = [
        payload.runName,
        payload.period.from || "",
        payload.period.to || "",
        payload.totalExecuted,
        payload.breakdown.passed,
        payload.breakdown.failed,
        payload.breakdown.blocked,
        payload.breakdown.skipped,
        payload.passRate,
      ];
      const csv = [header.map(csvEscape).join(","), row.map(csvEscape).join(",")].join("\n");
      res.setHeader(
        "Content-Type",
        exportFormat === "excel" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"test-execution-report.${exportFormat === "excel" ? "xls" : "csv"}\"`
      );
      return res.send(csv);
    }

    if (exportFormat === "pdf") {
      const pdf = buildSimplePdf([
        "Test Execution Report",
        `Test Run: ${payload.runName}`,
        `Period: ${payload.period.from || "N/A"} - ${payload.period.to || "N/A"}`,
        `Total Executed: ${payload.totalExecuted}`,
        `Passed: ${payload.breakdown.passed}`,
        `Failed: ${payload.breakdown.failed}`,
        `Blocked: ${payload.breakdown.blocked}`,
        `Skipped: ${payload.breakdown.skipped}`,
        `Pass Rate: ${payload.passRate}%`,
      ]);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=\"test-execution-report.pdf\"");
      return res.send(pdf);
    }

    return res.json(payload);
  }
);

router.get(
  "/reports/tester-performance",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const testerId = asString(req.query.testerId);
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const fromDate = asDate(req.query.from);
    const toDate = asDate(req.query.to);

    const executionWhere: Prisma.TestExecutionWhereInput = {
      isDraft: false,
      ...(testerId ? { executedBy: testerId } : {}),
      ...(projectId
        ? {
            testCase: {
              is: { projectId },
            },
          }
        : {}),
      ...(fromDate || toDate
        ? {
            executedAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    const executions = await prisma.testExecution.findMany({
      where: executionWhere,
      include: {
        executor: { select: { id: true, name: true, email: true } },
        testCase: { select: { id: true, estimatedDurationMinutes: true } },
      },
      orderBy: { executedAt: "asc" },
    });

    const testerIds = [...new Set(executions.map((item) => item.executedBy))];
    const bugs = testerIds.length
      ? await prismaAny.issue.findMany({
          where: {
            reportedBy: { in: testerIds },
            ...(fromDate || toDate
              ? {
                  createdAt: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lte: toDate } : {}),
                  },
                }
              : {}),
          },
          select: { id: true, reportedBy: true },
        })
      : [];

    const totalRepositoryCases = await prisma.testCase.count({
      where: {
        isDeleted: false,
        ...(projectId ? { projectId } : {}),
      },
    });

    const byTester = new Map<
      string,
      {
        testerId: string;
        testerName: string;
        executed: number;
        uniqueCaseIds: Set<string>;
        durationSecondsTotal: number;
        durationSamples: number;
        estimatedSecondsTotal: number;
        onTimeCount: number;
        bugsDetected: number;
      }
    >();

    executions.forEach((item) => {
      const row = byTester.get(item.executedBy) || {
        testerId: item.executedBy,
        testerName: item.executor?.name || item.executor?.email || item.executedBy,
        executed: 0,
        uniqueCaseIds: new Set<string>(),
        durationSecondsTotal: 0,
        durationSamples: 0,
        estimatedSecondsTotal: 0,
        onTimeCount: 0,
        bugsDetected: 0,
      };
      row.executed += 1;
      row.uniqueCaseIds.add(item.testCaseId);

      const meta = parseExecutionNotes(item.notes).meta;
      const durationSeconds = typeof meta.durationSeconds === "number" ? meta.durationSeconds : null;
      const estimatedSeconds =
        typeof item.testCase?.estimatedDurationMinutes === "number" ? item.testCase.estimatedDurationMinutes * 60 : null;
      if (typeof durationSeconds === "number" && durationSeconds >= 0) {
        row.durationSecondsTotal += durationSeconds;
        row.durationSamples += 1;
      }
      if (typeof estimatedSeconds === "number" && estimatedSeconds > 0) {
        row.estimatedSecondsTotal += estimatedSeconds;
        if (typeof durationSeconds === "number" && durationSeconds <= estimatedSeconds) {
          row.onTimeCount += 1;
        }
      }
      byTester.set(item.executedBy, row);
    });

    bugs.forEach((bug: any) => {
      const row = byTester.get(String(bug.reportedBy));
      if (row) {
        row.bugsDetected += 1;
      }
    });

    const testerMetrics = Array.from(byTester.values()).map((row) => {
      const bugDetectionRate = row.executed > 0 ? Number(((row.bugsDetected / row.executed) * 100).toFixed(1)) : 0;
      const avgDurationMinutes =
        row.durationSamples > 0 ? Number((row.durationSecondsTotal / row.durationSamples / 60).toFixed(2)) : 0;
      const onTimeRate =
        row.executed > 0 && row.estimatedSecondsTotal > 0
          ? Number(((row.onTimeCount / row.executed) * 100).toFixed(1))
          : 0;
      const efficiencyScore =
        row.estimatedSecondsTotal > 0 && row.durationSecondsTotal > 0
          ? Number(Math.min(100, (row.estimatedSecondsTotal / row.durationSecondsTotal) * 100).toFixed(1))
          : onTimeRate;
      const coveragePercent =
        totalRepositoryCases > 0
          ? Number(((row.uniqueCaseIds.size / totalRepositoryCases) * 100).toFixed(1))
          : 0;

      return {
        testerId: row.testerId,
        testerName: row.testerName,
        testCasesExecuted: row.executed,
        bugsDetected: row.bugsDetected,
        bugDetectionRate,
        avgDurationMinutes,
        onTimeRate,
        efficiencyScore,
        coveragePercent,
      };
    });

    const summary = {
      totalExecuted: testerMetrics.reduce((sum, row) => sum + row.testCasesExecuted, 0),
      avgBugDetectionRate:
        testerMetrics.length > 0
          ? Number((testerMetrics.reduce((sum, row) => sum + row.bugDetectionRate, 0) / testerMetrics.length).toFixed(1))
          : 0,
      avgEfficiencyScore:
        testerMetrics.length > 0
          ? Number((testerMetrics.reduce((sum, row) => sum + row.efficiencyScore, 0) / testerMetrics.length).toFixed(1))
          : 0,
      avgCoveragePercent:
        testerMetrics.length > 0
          ? Number((testerMetrics.reduce((sum, row) => sum + row.coveragePercent, 0) / testerMetrics.length).toFixed(1))
          : 0,
    };

    const payload = {
      period: { from: fromDate?.toISOString() || null, to: toDate?.toISOString() || null },
      totalRepositoryCases,
      summary,
      testerMetrics: testerMetrics.sort((a, b) => b.testCasesExecuted - a.testCasesExecuted),
    };

    const exportFormat = asString(req.query.export).toLowerCase();
    if (exportFormat === "csv" || exportFormat === "excel") {
      const header = [
        "testerName",
        "testCasesExecuted",
        "bugsDetected",
        "bugDetectionRate",
        "avgDurationMinutes",
        "onTimeRate",
        "efficiencyScore",
        "coveragePercent",
      ];
      const rows = payload.testerMetrics.map((item) =>
        [
          item.testerName,
          item.testCasesExecuted,
          item.bugsDetected,
          item.bugDetectionRate,
          item.avgDurationMinutes,
          item.onTimeRate,
          item.efficiencyScore,
          item.coveragePercent,
        ]
          .map(csvEscape)
          .join(",")
      );
      const csv = [header.map(csvEscape).join(","), ...rows].join("\n");
      res.setHeader(
        "Content-Type",
        exportFormat === "excel" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"tester-performance-report.${exportFormat === "excel" ? "xls" : "csv"}\"`
      );
      return res.send(csv);
    }

    if (exportFormat === "pdf") {
      const pdf = buildSimplePdf([
        "Tester Performance Report",
        `Period: ${payload.period.from || "N/A"} - ${payload.period.to || "N/A"}`,
        `Total Executed: ${payload.summary.totalExecuted}`,
        `Avg Bug Detection Rate: ${payload.summary.avgBugDetectionRate}%`,
        `Avg Efficiency: ${payload.summary.avgEfficiencyScore}%`,
        `Avg Coverage: ${payload.summary.avgCoveragePercent}%`,
      ]);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=\"tester-performance-report.pdf\"");
      return res.send(pdf);
    }

    return res.json(payload);
  }
);

type ReportScheduleFrequency = "DAILY" | "WEEKLY";
type ReportScheduleType = "TEST_EXECUTION_SUMMARY" | "TESTER_PERFORMANCE";
type ReportSchedule = {
  id: string;
  reportType: ReportScheduleType;
  format: "PDF" | "EXCEL" | "CSV";
  recipients: string[];
  frequency: ReportScheduleFrequency;
  weekday: number;
  hour: number;
  minute: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  lastSentAt: string | null;
  nextRunAt: string | null;
};

const REPORT_SCHEDULE_CONFIG_KEY = "REPORT_EMAIL_SCHEDULES_V1";

const computeNextRunAt = (schedule: Pick<ReportSchedule, "frequency" | "weekday" | "hour" | "minute">): string => {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(schedule.hour, schedule.minute, 0, 0);
  if (schedule.frequency === "DAILY") {
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }
  const targetWeekday = Math.max(0, Math.min(6, schedule.weekday));
  const diff = (targetWeekday - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + diff);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next.toISOString();
};

const loadReportSchedules = async (): Promise<ReportSchedule[]> => {
  const config = await prisma.systemConfig.findUnique({ where: { key: REPORT_SCHEDULE_CONFIG_KEY } });
  if (!config?.value) return [];
  try {
    const parsed = JSON.parse(config.value);
    if (!Array.isArray(parsed)) return [];
    return parsed as ReportSchedule[];
  } catch {
    return [];
  }
};

const resolveScheduleUpdaterId = async (): Promise<string | null> => {
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN }, select: { id: true } });
  if (admin?.id) return admin.id;
  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  return anyUser?.id || null;
};

const saveReportSchedules = async (schedules: ReportSchedule[], updatedBy?: string) => {
  const updaterId = updatedBy || (await resolveScheduleUpdaterId());
  if (!updaterId) return;
  await prisma.systemConfig.upsert({
    where: { key: REPORT_SCHEDULE_CONFIG_KEY },
    update: { value: JSON.stringify(schedules) },
    create: { key: REPORT_SCHEDULE_CONFIG_KEY, value: JSON.stringify(schedules), updatedBy: updaterId },
  });
};

const runScheduledReport = async (schedule: ReportSchedule) => {
  const lines: string[] = [];
  if (schedule.reportType === "TEST_EXECUTION_SUMMARY") {
    const executions = await prisma.testExecution.findMany({ where: { isDraft: false } });
    const total = executions.length;
    const passed = executions.filter((item) => item.result === ExecutionStatus.PASSED).length;
    const failed = executions.filter((item) => item.result === ExecutionStatus.FAILED).length;
    const blocked = executions.filter((item) => item.result === ExecutionStatus.BLOCKED).length;
    const skipped = executions.filter((item) => item.result === ExecutionStatus.SKIPPED).length;
    lines.push("Test Execution Summary");
    lines.push(`Total Executed: ${total}`);
    lines.push(`Passed: ${passed}`);
    lines.push(`Failed: ${failed}`);
    lines.push(`Blocked: ${blocked}`);
    lines.push(`Skipped: ${skipped}`);
  } else {
    const executions = await prisma.testExecution.count({ where: { isDraft: false } });
    const bugs = await prismaAny.issue.count();
    lines.push("Tester Performance Summary");
    lines.push(`Executions: ${executions}`);
    lines.push(`Bugs Reported: ${bugs}`);
  }

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h3 style="margin: 0 0 12px;">Scheduled ${schedule.reportType.replace(/_/g, " ")}</h3>
      <pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">${lines.join("\n")}</pre>
      <p style="font-size: 12px; color: #64748b;">Generated at ${new Date().toISOString()}</p>
    </div>
  `;
  await sendGenericEmail(schedule.recipients, `Scheduled Report: ${schedule.reportType}`, html);
};

router.get("/reports/schedules", authorizeRoles(Role.TESTER, Role.ADMIN), requireProjectFromRequest, async (_req: AuthRequest, res: Response) => {
  const schedules = await loadReportSchedules();
  return res.json(schedules.sort((a, b) => (a.nextRunAt || "").localeCompare(b.nextRunAt || "")));
});

router.post("/reports/schedules", authorizeRoles(Role.TESTER, Role.ADMIN), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
  const reportType = asString(req.body.reportType).toUpperCase() as ReportScheduleType;
  const format = asString(req.body.format).toUpperCase() as ReportSchedule["format"];
  const frequency = asString(req.body.frequency).toUpperCase() as ReportScheduleFrequency;
  const recipients = asStringArray(req.body.recipients);
  const weekday = Number(req.body.weekday);
  const hour = Number(req.body.hour);
  const minute = Number(req.body.minute);
  const active = req.body.active !== false;

  if (!["TEST_EXECUTION_SUMMARY", "TESTER_PERFORMANCE"].includes(reportType)) {
    return res.status(400).json({ message: "reportType must be TEST_EXECUTION_SUMMARY or TESTER_PERFORMANCE" });
  }
  if (!["PDF", "EXCEL", "CSV"].includes(format)) {
    return res.status(400).json({ message: "format must be PDF, EXCEL, or CSV" });
  }
  if (!["DAILY", "WEEKLY"].includes(frequency)) {
    return res.status(400).json({ message: "frequency must be DAILY or WEEKLY" });
  }
  if (recipients.length === 0) {
    return res.status(400).json({ message: "recipients are required" });
  }

  const now = new Date().toISOString();
  const schedule: ReportSchedule = {
    id: `sched_${Date.now()}`,
    reportType,
    format,
    frequency,
    recipients,
    weekday: Number.isFinite(weekday) ? weekday : 1,
    hour: Number.isFinite(hour) ? hour : 9,
    minute: Number.isFinite(minute) ? minute : 0,
    active,
    createdBy: req.user!.userId,
    createdAt: now,
    lastSentAt: null,
    nextRunAt: computeNextRunAt({
      frequency,
      weekday: Number.isFinite(weekday) ? weekday : 1,
      hour: Number.isFinite(hour) ? hour : 9,
      minute: Number.isFinite(minute) ? minute : 0,
    }),
  };

  const schedules = await loadReportSchedules();
  schedules.push(schedule);
  await saveReportSchedules(schedules, req.user!.userId);
  return res.status(201).json(schedule);
});

router.post(
  "/reports/schedules/:id/send-now",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const schedules = await loadReportSchedules();
    const idx = schedules.findIndex((item) => item.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "Schedule not found" });
    await runScheduledReport(schedules[idx]);
    schedules[idx].lastSentAt = new Date().toISOString();
    schedules[idx].nextRunAt = computeNextRunAt(schedules[idx]);
    await saveReportSchedules(schedules, req.user!.userId);
    return res.json({ message: "Report email sent", schedule: schedules[idx] });
  }
);

router.delete("/reports/schedules/:id", authorizeRoles(Role.TESTER, Role.ADMIN), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
  const schedules = await loadReportSchedules();
  const filtered = schedules.filter((item) => item.id !== req.params.id);
  if (filtered.length === schedules.length) {
    return res.status(404).json({ message: "Schedule not found" });
  }
  await saveReportSchedules(filtered, req.user!.userId);
  return res.status(204).send();
});

router.get(
  "/reports/bugs/summary",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const now = Date.now();
    const bugs = await prismaAny.issue.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        testCase: { select: { projectId: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const byStatus = new Map<string, number>();
    const bySeverity = new Map<string, number>();
    const byPriority = new Map<string, number>();
    const byDeveloper = new Map<string, { developerId: string; developerName: string; total: number }>();
    const byProject = new Map<string, { projectId: string; projectName: string; total: number }>();
    const trendByDay = new Map<string, { date: string; created: number; resolved: number }>();
    const agingBuckets = {
      "0-3": 0,
      "4-7": 0,
      "8-14": 0,
      "15+": 0,
    };
    const resolutionDays: number[] = [];

    const closedLikeStatuses = new Set(["FIXED", "VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"]);

    const bump = (map: Map<string, number>, key: string) => {
      map.set(key, (map.get(key) || 0) + 1);
    };

    bugs.forEach((bug: any) => {
      const status = String(bug.workflowStatus || bug.status || "OPEN").toUpperCase();
      const severity = String(bug.severity || "MEDIUM").toUpperCase();
      const priority = String(bug.bugPriority || "P3_MEDIUM").toUpperCase();
      const createdDay = new Date(bug.createdAt).toISOString().slice(0, 10);
      const trendRow = trendByDay.get(createdDay) || { date: createdDay, created: 0, resolved: 0 };
      trendRow.created += 1;
      trendByDay.set(createdDay, trendRow);

      bump(byStatus, status);
      bump(bySeverity, severity);
      bump(byPriority, priority);

      const developerId = String(bug.assignedTo || "");
      const developerName =
        bug.assignee?.name || bug.assignee?.email || (developerId ? "Assigned Developer" : "Unassigned");
      const developerKey = developerId || "unassigned";
      const developerRow = byDeveloper.get(developerKey) || {
        developerId: developerId || "unassigned",
        developerName,
        total: 0,
      };
      developerRow.total += 1;
      byDeveloper.set(developerKey, developerRow);

      const bugProjectId = String(bug.testCase?.projectId || "unscoped");
      const projectRow = byProject.get(bugProjectId) || {
        projectId: bugProjectId,
        projectName: bugProjectId === "unscoped" ? "Unscoped" : bugProjectId,
        total: 0,
      };
      projectRow.total += 1;
      byProject.set(bugProjectId, projectRow);

      if (!closedLikeStatuses.has(status)) {
        const ageDays = Math.max(0, Math.floor((now - new Date(bug.createdAt).getTime()) / 86_400_000));
        if (ageDays <= 3) agingBuckets["0-3"] += 1;
        else if (ageDays <= 7) agingBuckets["4-7"] += 1;
        else if (ageDays <= 14) agingBuckets["8-14"] += 1;
        else agingBuckets["15+"] += 1;
      } else {
        const resolvedDay = new Date(bug.updatedAt).toISOString().slice(0, 10);
        const resolvedTrend = trendByDay.get(resolvedDay) || { date: resolvedDay, created: 0, resolved: 0 };
        resolvedTrend.resolved += 1;
        trendByDay.set(resolvedDay, resolvedTrend);

        const days = Math.max(
          0,
          Number(((new Date(bug.updatedAt).getTime() - new Date(bug.createdAt).getTime()) / 86_400_000).toFixed(2))
        );
        resolutionDays.push(days);
      }
    });

    const sortedResolution = [...resolutionDays].sort((a, b) => a - b);
    const averageResolutionDays =
      resolutionDays.length > 0
        ? Number((resolutionDays.reduce((sum, value) => sum + value, 0) / resolutionDays.length).toFixed(2))
        : 0;
    const medianResolutionDays =
      sortedResolution.length === 0
        ? 0
        : sortedResolution.length % 2 === 1
        ? sortedResolution[Math.floor(sortedResolution.length / 2)]
        : Number(
            (
              (sortedResolution[sortedResolution.length / 2 - 1] +
                sortedResolution[sortedResolution.length / 2]) /
              2
            ).toFixed(2)
          );

    return res.json({
      totalBugs: bugs.length,
      totalByStatus: Array.from(byStatus.entries())
        .map(([status, total]) => ({ status, total }))
        .sort((a, b) => b.total - a.total),
      bugAging: agingBuckets,
      bySeverity: Array.from(bySeverity.entries())
        .map(([severity, total]) => ({ severity, total }))
        .sort((a, b) => b.total - a.total),
      byPriority: Array.from(byPriority.entries())
        .map(([priority, total]) => ({ priority, total }))
        .sort((a, b) => b.total - a.total),
      byDeveloper: Array.from(byDeveloper.values()).sort((a, b) => b.total - a.total),
      byProject: Array.from(byProject.values()).sort((a, b) => b.total - a.total),
      trendsOverTime: Array.from(trendByDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
      resolutionTime: {
        resolvedCount: resolutionDays.length,
        averageDays: averageResolutionDays,
        medianDays: medianResolutionDays,
        minDays: sortedResolution.length > 0 ? sortedResolution[0] : 0,
        maxDays: sortedResolution.length > 0 ? sortedResolution[sortedResolution.length - 1] : 0,
      },
    });
  }
);

router.get(
  "/reports/cross-project-summary",
  authorizeRoles(Role.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    });

    const byProject = await Promise.all(
      projects.map(async (project) => {
        const [testCaseCount, executionCount, failedExecutionCount, bugCount] = await Promise.all([
          prisma.testCase.count({ where: { projectId: project.id, isDeleted: false } }),
          prisma.testExecution.count({
            where: {
              isDraft: false,
              testCase: { is: { projectId: project.id } },
            },
          }),
          prisma.testExecution.count({
            where: {
              isDraft: false,
              result: ExecutionStatus.FAILED,
              testCase: { is: { projectId: project.id } },
            },
          }),
          prisma.issue.count({
            where: {
              testCase: { is: { projectId: project.id } },
            },
          }),
        ]);

        const passCount = executionCount - failedExecutionCount;
        const passRate = executionCount > 0 ? Number(((passCount / executionCount) * 100).toFixed(1)) : 0;
        return {
          projectId: project.id,
          projectName: project.name,
          status: project.isActive ? "ACTIVE" : "ARCHIVED",
          testCaseCount,
          executionCount,
          failedExecutionCount,
          bugCount,
          passRate,
        };
      })
    );

    return res.json({
      totalProjects: projects.length,
      projects: byProject,
    });
  }
);

router.get(
  "/reports/developer-performance",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const developerIdFilter = asString(req.query.developerId);
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const from = asString(req.query.from);
    const to = asString(req.query.to);
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const validFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
    const validTo = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;

    const activeDevelopers = await prisma.user.findMany({
      where: { role: Role.DEVELOPER, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });

    const developerMap = new Map(
      activeDevelopers.map((item) => [item.id, { id: item.id, name: item.name || item.email, email: item.email }])
    );

    let scopedDeveloperIds: string[] = [];
    if (req.user!.role === Role.DEVELOPER) {
      scopedDeveloperIds = [req.user!.userId];
    } else if (developerIdFilter) {
      scopedDeveloperIds = developerMap.has(developerIdFilter) ? [developerIdFilter] : [];
    } else {
      scopedDeveloperIds = activeDevelopers.map((item) => item.id);
    }

    if (scopedDeveloperIds.length === 0) {
      return res.json({
        period: { from: validFrom?.toISOString() || null, to: validTo?.toISOString() || null },
        summary: {
          developerCount: 0,
          bugsAssigned: 0,
          bugsResolved: 0,
          avgResolutionDays: 0,
          reopenRate: 0,
        },
        developers: [],
        trend: [],
      });
    }

    const where: Prisma.IssueWhereInput = {
      assignedTo: { in: scopedDeveloperIds },
      ...(projectId
        ? {
            testCase: {
              is: { projectId },
            },
          }
        : {}),
      ...(validFrom || validTo
        ? {
            createdAt: {
              ...(validFrom ? { gte: validFrom } : {}),
              ...(validTo ? { lte: validTo } : {}),
            },
          }
        : {}),
    };

    const issues = await prismaAny.issue.findMany({
      where,
      select: {
        id: true,
        assignedTo: true,
        workflowStatus: true,
        createdAt: true,
        updatedAt: true,
        fixNotes: true,
        commitLink: true,
        retestRequested: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const issueIds = issues.map((item: any) => item.id);
    const transitions =
      issueIds.length > 0
        ? await prisma.auditLog.findMany({
            where: {
              action: { in: ["BUG_WORKFLOW_TRANSITION", "BUG_QUICK_STATUS_UPDATE"] },
              entityType: "Issue",
              entityId: { in: issueIds },
            },
            select: { entityId: true, metadata: true },
          })
        : [];

    const reopenedIssueIds = new Set<string>();
    transitions.forEach((log) => {
      const meta = log.metadata as Record<string, unknown> | null;
      const toStatus = asString(meta?.to || meta?.toStatus || meta?.status).toUpperCase();
      if (toStatus === BUG_WORKFLOW_STATUS.REOPENED) {
        reopenedIssueIds.add(log.entityId);
      }
    });

    const resolvedStatuses: Set<BugWorkflowStatus> = new Set([
      BUG_WORKFLOW_STATUS.FIXED,
      BUG_WORKFLOW_STATUS.VERIFIED,
      BUG_WORKFLOW_STATUS.CLOSED,
      BUG_WORKFLOW_STATUS.WONT_FIX,
      BUG_WORKFLOW_STATUS.DUPLICATE,
    ]);

    type DeveloperMetric = {
      developerId: string;
      developerName: string;
      developerEmail: string;
      bugsAssigned: number;
      bugsResolved: number;
      reopenedCount: number;
      reopenRate: number;
      avgResolutionDays: number;
      fixQuality: {
        firstPassFixRate: number;
        fixNotesCoverage: number;
        commitLinkCoverage: number;
        retestRequestRate: number;
      };
    };

    const byDeveloper = new Map<
      string,
      {
        assigned: number;
        resolved: number;
        reopened: number;
        resolutionDays: number[];
        withFixNotes: number;
        withCommitLink: number;
        withRetestRequest: number;
        firstPassFixed: number;
      }
    >();

    const trendMap = new Map<string, { date: string; assigned: number; resolved: number }>();

    issues.forEach((issue: any) => {
      const developerId = String(issue.assignedTo || "");
      if (!developerId) return;

      const row =
        byDeveloper.get(developerId) || {
          assigned: 0,
          resolved: 0,
          reopened: 0,
          resolutionDays: [] as number[],
          withFixNotes: 0,
          withCommitLink: 0,
          withRetestRequest: 0,
          firstPassFixed: 0,
        };
      row.assigned += 1;

      const createdDay = new Date(issue.createdAt).toISOString().slice(0, 10);
      const createdTrend = trendMap.get(createdDay) || { date: createdDay, assigned: 0, resolved: 0 };
      createdTrend.assigned += 1;
      trendMap.set(createdDay, createdTrend);

      const status = parseBugWorkflowStatus(issue.workflowStatus);
      const isResolved = status ? resolvedStatuses.has(status) : false;
      const isReopened = reopenedIssueIds.has(issue.id);

      if (isResolved) {
        row.resolved += 1;
        if (isReopened) {
          row.reopened += 1;
        } else {
          row.firstPassFixed += 1;
        }
        if (asString(issue.fixNotes)) row.withFixNotes += 1;
        if (asString(issue.commitLink)) row.withCommitLink += 1;
        if (Boolean(issue.retestRequested)) row.withRetestRequest += 1;

        const days = Math.max(
          0,
          Number(
            (
              (new Date(issue.updatedAt).getTime() - new Date(issue.createdAt).getTime()) /
              86_400_000
            ).toFixed(2)
          )
        );
        row.resolutionDays.push(days);

        const resolvedDay = new Date(issue.updatedAt).toISOString().slice(0, 10);
        const resolvedTrend = trendMap.get(resolvedDay) || { date: resolvedDay, assigned: 0, resolved: 0 };
        resolvedTrend.resolved += 1;
        trendMap.set(resolvedDay, resolvedTrend);
      }

      byDeveloper.set(developerId, row);
    });

    const developers: DeveloperMetric[] = scopedDeveloperIds.map((developerId) => {
      const person = developerMap.get(developerId);
      const row =
        byDeveloper.get(developerId) || {
          assigned: 0,
          resolved: 0,
          reopened: 0,
          resolutionDays: [] as number[],
          withFixNotes: 0,
          withCommitLink: 0,
          withRetestRequest: 0,
          firstPassFixed: 0,
        };
      const avgResolutionDays =
        row.resolutionDays.length > 0
          ? Number((row.resolutionDays.reduce((sum, v) => sum + v, 0) / row.resolutionDays.length).toFixed(2))
          : 0;
      const reopenRate = row.resolved > 0 ? Number(((row.reopened / row.resolved) * 100).toFixed(1)) : 0;
      return {
        developerId,
        developerName: person?.name || person?.email || "Unknown Developer",
        developerEmail: person?.email || "",
        bugsAssigned: row.assigned,
        bugsResolved: row.resolved,
        reopenedCount: row.reopened,
        reopenRate,
        avgResolutionDays,
        fixQuality: {
          firstPassFixRate: row.resolved > 0 ? Number(((row.firstPassFixed / row.resolved) * 100).toFixed(1)) : 0,
          fixNotesCoverage: row.resolved > 0 ? Number(((row.withFixNotes / row.resolved) * 100).toFixed(1)) : 0,
          commitLinkCoverage:
            row.resolved > 0 ? Number(((row.withCommitLink / row.resolved) * 100).toFixed(1)) : 0,
          retestRequestRate:
            row.resolved > 0 ? Number(((row.withRetestRequest / row.resolved) * 100).toFixed(1)) : 0,
        },
      };
    });

    const summary = {
      developerCount: developers.length,
      bugsAssigned: developers.reduce((sum, row) => sum + row.bugsAssigned, 0),
      bugsResolved: developers.reduce((sum, row) => sum + row.bugsResolved, 0),
      avgResolutionDays:
        developers.reduce((sum, row) => sum + row.avgResolutionDays, 0) / Math.max(developers.length, 1),
      reopenRate:
        developers.reduce((sum, row) => sum + row.reopenedCount, 0) /
        Math.max(developers.reduce((sum, row) => sum + row.bugsResolved, 0), 1),
    };
    const normalizedSummary = {
      ...summary,
      avgResolutionDays: Number(summary.avgResolutionDays.toFixed(2)),
      reopenRate: Number((summary.reopenRate * 100).toFixed(1)),
    };

    const payload = {
      period: { from: validFrom?.toISOString() || null, to: validTo?.toISOString() || null },
      summary: normalizedSummary,
      developers: developers.sort((a, b) => b.bugsAssigned - a.bugsAssigned),
      trend: Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };

    if (String(req.query.export || "").toLowerCase() === "csv") {
      const header =
        "developerId,developerName,developerEmail,bugsAssigned,bugsResolved,avgResolutionDays,reopenedCount,reopenRate,firstPassFixRate,fixNotesCoverage,commitLinkCoverage,retestRequestRate";
      const rows = payload.developers.map((row) =>
        [
          row.developerId,
          row.developerName,
          row.developerEmail,
          row.bugsAssigned,
          row.bugsResolved,
          row.avgResolutionDays,
          row.reopenedCount,
          row.reopenRate,
          row.fixQuality.firstPassFixRate,
          row.fixQuality.fixNotesCoverage,
          row.fixQuality.commitLinkCoverage,
          row.fixQuality.retestRequestRate,
        ]
          .map((value) => `"${String(value).replace(/\"/g, "\"\"")}"`)
          .join(",")
      );
      res.setHeader("Content-Type", "text/csv");
      return res.send([header, ...rows].join("\n"));
    }

    return res.json(payload);
  }
);

router.post(
  "/issues/from-executions/:executionId",
  authorizeRoles(Role.TESTER),
  requireProjectFromExecutionId,
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
        projectId: execution.projectId,
        testCaseId: execution.testCaseId,
        executionId: execution.id,
        reportedBy: req.user!.userId,
        assignedTo: assignedDeveloperId,
      },
    });

    await writeAuditLog(req.user!.userId, "CREATE_BUG_REPORT", "Issue", issue.id, { executionId: execution.id });
    if (issue.assignedTo) {
      const assignee = await prisma.user.findUnique({
        where: { id: issue.assignedTo },
        select: { id: true, email: true },
      });
      await notifyBugAssigned({
        assigneeId: assignee?.id,
        assigneeEmail: assignee?.email,
        bugCode: issue.bugCode || issue.id,
        issueId: issue.id,
        actorId: req.user!.userId,
      });
    }
    return res.status(201).json(issue);
  }
);

router.post("/bugs", authorizeRoles(Role.TESTER, Role.ADMIN), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
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
  const projectIdInput = getProjectIdFromRequest(req);

  if (!title || !details || !stepsToReproduce || !expectedBehavior || !actualBehavior) {
    return res.status(400).json({
      message:
        "title, description, stepsToReproduce, expectedBehavior, and actualBehavior are required",
    });
  }
  if (title.length > 200) {
    return res.status(400).json({ message: "Title cannot exceed 200 characters" });
  }

  let resolvedProjectId = "";
  if (linkedTestCaseId) {
    const tc = await prisma.testCase.findUnique({ where: { id: linkedTestCaseId } });
    if (!tc || tc.isDeleted) return res.status(400).json({ message: "Invalid linked testCaseId" });
    if (projectIdInput && tc.projectId !== projectIdInput) {
      return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
    }
    resolvedProjectId = tc.projectId;
  }
  if (executionId) {
    const execution = await prisma.testExecution.findUnique({
      where: { id: executionId },
      select: { id: true, testCaseId: true, projectId: true },
    });
    if (!execution) return res.status(400).json({ message: "Invalid executionId" });
    if (projectIdInput && execution.projectId !== projectIdInput) {
      return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
    }
    if (linkedTestCaseId && execution.testCaseId !== linkedTestCaseId) {
      return res.status(400).json({ message: "executionId does not match linked testCaseId" });
    }
    if (resolvedProjectId && execution.projectId !== resolvedProjectId) {
      return res.status(403).json({ message: CROSS_PROJECT_REFERENCE_MESSAGE });
    }
    resolvedProjectId = execution.projectId;
  }
  if (!resolvedProjectId) {
    resolvedProjectId = projectIdInput;
  }
  const writableProject = await ensureWritableProject(req, res, resolvedProjectId);
  if (!writableProject) return;
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
      projectId: writableProject.id,
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
  if (issue.assignedTo) {
    const assignee = await prisma.user.findUnique({
      where: { id: issue.assignedTo },
      select: { id: true, email: true },
    });
    await notifyBugAssigned({
      assigneeId: assignee?.id,
      assigneeEmail: assignee?.email,
      bugCode: issue.bugCode || issue.id,
      issueId: issue.id,
      actorId: req.user!.userId,
    });
  }
  return res.status(201).json(enrichIssue(issue));
});

router.get("/bugs", authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
  const mineOnly = String(req.query.mine || "") === "1";
  const scope = asString(req.query.scope).toLowerCase();
  const developerAllScope = req.user!.role === Role.DEVELOPER && scope === "all";
  const statusFilter = parseBugWorkflowStatus(req.query.status);
  const priorityFilter = asString(req.query.priority).toUpperCase();
  const severityFilter = asString(req.query.severity).toUpperCase();
  const projectId = getProjectIdFromRequest(req);
  const projectWhere = projectId ? { projectId } : {};
  const rows = await prismaAny.issue.findMany({
    where:
      req.user!.role === Role.DEVELOPER && !developerAllScope
        ? {
            assignedTo: req.user!.userId,
            ...(statusFilter ? { workflowStatus: statusFilter } : {}),
            ...(priorityFilter ? { bugPriority: priorityFilter as BugPriority } : {}),
            ...(severityFilter ? { severity: severityFilter as Severity } : {}),
            ...projectWhere,
          }
        : mineOnly
        ? {
            reportedBy: req.user!.userId,
            ...(statusFilter ? { workflowStatus: statusFilter } : {}),
            ...(priorityFilter ? { bugPriority: priorityFilter as BugPriority } : {}),
            ...(severityFilter ? { severity: severityFilter as Severity } : {}),
            ...projectWhere,
          }
        : {
            ...(statusFilter ? { workflowStatus: statusFilter } : {}),
            ...(priorityFilter ? { bugPriority: priorityFilter as BugPriority } : {}),
            ...(severityFilter ? { severity: severityFilter as Severity } : {}),
            ...projectWhere,
          },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      testCase: { select: { id: true, title: true, testCaseCode: true, projectId: true } },
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
  const scope = asString(req.query.scope).toLowerCase();
  const developerAllScope = req.user!.role === Role.DEVELOPER && scope === "all";
  const projectId = getProjectIdFromRequest(req);
  const issue = await prismaAny.issue.findUnique({
    where: { id: req.params.id },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      testCase: {
        select: {
          id: true,
          title: true,
          testCaseCode: true,
          description: true,
          module: true,
          priority: true,
          status: true,
          severity: true,
          type: true,
          steps: true,
          preConditions: true,
          postConditions: true,
          testDataRequirements: true,
          environmentRequirements: true,
          tags: true,
          estimatedDurationMinutes: true,
          automationStatus: true,
          automationScriptLink: true,
        },
      },
      execution: { select: { id: true, result: true, executedAt: true } },
      comments: { orderBy: { createdAt: "asc" } },
      attachments: true,
    },
  });
  if (!issue) return res.status(404).json({ message: "Bug not found" });
  const issueProjectId = issue.projectId || issue.testCase?.projectId || "";
  if (projectId && issueProjectId !== projectId) {
    return res.status(404).json({ message: "Bug not found in selected project" });
  }
  if (req.user!.role === Role.DEVELOPER && !developerAllScope && issue.assignedTo !== req.user!.userId) {
    return res.status(403).json({ message: "You can view only assigned bugs" });
  }
  return res.json(enrichIssue(issue));
});

router.get(
  "/users/testers",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    const rows = await prisma.user.findMany({
      where: { role: Role.TESTER, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    return res.json(rows);
  }
);

router.get(
  "/users/developers",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    const rows = await prisma.user.findMany({
      where: { role: Role.DEVELOPER, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    return res.json(rows);
  }
);

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
    const recipientIds = [issue.reportedBy, issue.assignedTo].filter(Boolean) as string[];
    if (recipientIds.length > 0) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, email: true },
      });
      const byId = new Map(recipients.map((u) => [u.id, u]));
      await notifyBugStatusChanged({
        issueId: updated.id,
        bugCode: updated.bugCode || updated.id,
        status: target,
        actorId: req.user!.userId,
        reporter: issue.reportedBy ? byId.get(issue.reportedBy) || null : null,
        assignee: issue.assignedTo ? byId.get(issue.assignedTo) || null : null,
      });
    }
    return res.json(enrichIssue(updated));
  } catch (error: any) {
    console.error("BUG_WORKFLOW_TRANSITION_ERROR", error);
    return res.status(500).json({ message: error?.message || "Failed to update bug workflow" });
  }
});

router.get("/developer/bugs", authorizeRoles(Role.DEVELOPER), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
  const query: Record<string, string> = {};
  if (req.query.priority) query.priority = String(req.query.priority);
  if (req.query.severity) query.severity = String(req.query.severity);
  if (req.query.status) query.status = String(req.query.status);
  if (req.query.sortBy) query.sortBy = String(req.query.sortBy);
  const statusFilter = parseBugWorkflowStatus(query.status);
  const rows = await prismaAny.issue.findMany({
    where: {
      assignedTo: req.user!.userId,
      ...(query.priority ? { bugPriority: query.priority as BugPriority } : {}),
      ...(query.severity ? { severity: query.severity as Severity } : {}),
      ...(statusFilter ? { workflowStatus: statusFilter } : {}),
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
  const recipientIds = [issue.reportedBy, issue.assignedTo].filter(Boolean) as string[];
  if (recipientIds.length > 0) {
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true },
    });
    const byId = new Map(recipients.map((u) => [u.id, u]));
    await notifyBugStatusChanged({
      issueId: updated.id,
      bugCode: updated.bugCode || updated.id,
      status: target,
      actorId: req.user!.userId,
      reporter: issue.reportedBy ? byId.get(issue.reportedBy) || null : null,
      assignee: issue.assignedTo ? byId.get(issue.assignedTo) || null : null,
    });
  }
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
  const recipientIds = [issue.reportedBy, issue.assignedTo].filter(Boolean) as string[];
  if (recipientIds.length > 0) {
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true },
    });
    const byId = new Map(recipients.map((u) => [u.id, u]));
    await notifyBugStatusChanged({
      issueId: updated.id,
      bugCode: updated.bugCode || updated.id,
      status: workflowStatus,
      actorId: req.user!.userId,
      reporter: issue.reportedBy ? byId.get(issue.reportedBy) || null : null,
      assignee: issue.assignedTo ? byId.get(issue.assignedTo) || null : null,
    });
  }
  if (action === "REQUEST_RETEST" && issue.reportedBy) {
    const tester = await prisma.user.findUnique({
      where: { id: issue.reportedBy },
      select: { id: true, email: true },
    });
    await notifyRetestRequested({
      issueId: updated.id,
      bugCode: updated.bugCode || updated.id,
      originalTesterId: tester?.id,
      originalTesterEmail: tester?.email,
      actorId: req.user!.userId,
    });
  }
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
  await notifyCommentMentions({
    issueId: issue.id,
    bugCode: issue.bugCode || issue.id,
    mentions,
    authorId: req.user!.userId,
  });
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
  await notifyBugAssigned({
    assigneeId: developer.id,
    assigneeEmail: developer.email,
    bugCode: issue.bugCode || issue.id,
    issueId: issue.id,
    actorId: req.user!.userId,
  });
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
    const issueRow = await prisma.issue.findUnique({
      where: { id: req.params.id },
      select: { id: true, bugCode: true },
    });
    if (!issueRow) {
      return res.status(404).json({ message: "Issue not found" });
    }
    const mentions = parseMentions(comment);

    const created = await prisma.issueComment.create({
      data: {
        issueId: req.params.id,
        authorId: req.user!.userId,
        comment,
      },
    });

    await writeAuditLog(req.user!.userId, "COMMENT_ON_ISSUE", "IssueComment", created.id);
    await notifyCommentMentions({
      issueId: issueRow.id,
      bugCode: issueRow.bugCode || issueRow.id,
      mentions,
      authorId: req.user!.userId,
    });
    return res.status(201).json(created);
  }
);

/* =========================
   DEVELOPER FLOWS
========================= */
router.get("/developer/reports", authorizeRoles(Role.DEVELOPER), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
  const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
  const [totalExecutions, failedExecutions, openIssues] = await Promise.all([
    prisma.testExecution.count({ where: { isDraft: false, projectId } }),
    prisma.testExecution.count({ where: { isDraft: false, result: ExecutionStatus.FAILED, projectId } }),
    prisma.issue.count({ where: { status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] }, projectId } }),
  ]);
  return res.json({ totalExecutions, failedExecutions, openIssues });
});

router.get(
  "/developer/issues/assigned",
  authorizeRoles(Role.DEVELOPER),
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const issues = await prisma.issue.findMany({
      where: req.user!.role === Role.ADMIN ? { projectId } : { assignedTo: req.user!.userId, projectId },
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

  const prev = access.issue;
  const issue = await prisma.issue.update({
    where: { id: req.params.id },
    data: { status },
  });

  await writeAuditLog(req.user!.userId, "UPDATE_ISSUE_STATUS", "Issue", issue.id, { status });
  const recipientIds = [prev.reportedBy, prev.assignedTo].filter(Boolean) as string[];
  if (recipientIds.length > 0) {
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true },
    });
    const byId = new Map(recipients.map((u) => [u.id, u]));
    await notifyBugStatusChanged({
      issueId: issue.id,
      bugCode: issue.bugCode || issue.id,
      status: status,
      actorId: req.user!.userId,
      reporter: prev.reportedBy ? byId.get(prev.reportedBy) || null : null,
      assignee: prev.assignedTo ? byId.get(prev.assignedTo) || null : null,
    });
  }
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
    const prev = access.issue;
    const issue = await prisma.issue.update({
      where: { id: req.params.id },
      data: {
        retestRequested: true,
        status: IssueStatus.FIXED,
      },
    });
    await writeAuditLog(req.user!.userId, "REQUEST_RETEST", "Issue", issue.id);
    if (prev.reportedBy) {
      const tester = await prisma.user.findUnique({
        where: { id: prev.reportedBy },
        select: { id: true, email: true },
      });
      await notifyRetestRequested({
        issueId: issue.id,
        bugCode: issue.bugCode || issue.id,
        originalTesterId: tester?.id,
        originalTesterEmail: tester?.email,
        actorId: req.user!.userId,
      });
    }
    return res.json(issue);
  }
);

type DashboardWidgetSize = "S" | "M" | "L";
type DashboardWidgetLayoutItem = {
  id: string;
  visible: boolean;
  order: number;
  size: DashboardWidgetSize;
};

const DASHBOARD_WIDGET_LAYOUTS_KEY = "DASHBOARD_WIDGET_LAYOUTS_V1";
const DASHBOARD_WIDGETS_BY_ROLE: Record<Role, string[]> = {
  [Role.TESTER]: [
    "pending_tests",
    "recent_failures",
    "execution_trend",
    "status_breakdown",
    "quick_actions",
  ],
  [Role.DEVELOPER]: [
    "assigned_bugs_counter",
    "critical_bugs_counter",
    "bug_aging_chart",
    "bug_status_chart",
    "recent_activity",
  ],
  [Role.ADMIN]: [
    "total_users",
    "active_projects",
    "total_test_cases",
    "system_activity_chart",
    "recent_audit_logs",
  ],
};

const toDefaultDashboardLayout = (role: Role): DashboardWidgetLayoutItem[] =>
  (DASHBOARD_WIDGETS_BY_ROLE[role] || []).map((id, index) => ({
    id,
    visible: true,
    order: index,
    size: "M",
  }));

const sanitizeDashboardLayout = (role: Role, raw: unknown): DashboardWidgetLayoutItem[] => {
  const allowed = new Set(DASHBOARD_WIDGETS_BY_ROLE[role] || []);
  if (!Array.isArray(raw)) return toDefaultDashboardLayout(role);
  const rows = raw
    .filter((item) => item && typeof item === "object")
    .map((item: any, index) => {
      const id = asString(item.id);
      if (!allowed.has(id)) return null;
      const size = asString(item.size).toUpperCase();
      const normalizedSize: DashboardWidgetSize = size === "S" || size === "L" ? (size as DashboardWidgetSize) : "M";
      return {
        id,
        visible: item.visible !== false,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
        size: normalizedSize,
      };
    })
    .filter(Boolean) as DashboardWidgetLayoutItem[];

  const byId = new Map(rows.map((row) => [row.id, row]));
  (DASHBOARD_WIDGETS_BY_ROLE[role] || []).forEach((id) => {
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        visible: true,
        order: byId.size,
        size: "M",
      });
    }
  });

  return Array.from(byId.values())
    .sort((a, b) => a.order - b.order)
    .map((row, idx) => ({ ...row, order: idx }));
};

const loadDashboardWidgetLayouts = async (): Promise<Record<string, DashboardWidgetLayoutItem[]>> => {
  const config = await prisma.systemConfig.findUnique({
    where: { key: DASHBOARD_WIDGET_LAYOUTS_KEY },
    select: { value: true },
  });
  if (!config?.value) return {};
  try {
    const parsed = JSON.parse(config.value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, DashboardWidgetLayoutItem[]>)
      : {};
  } catch {
    return {};
  }
};

router.get(
  "/dashboard/widgets",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const layoutsByUser = await loadDashboardWidgetLayouts();
    const role = req.user!.role as Role;
    const persisted = layoutsByUser[req.user!.userId];
    const widgets = sanitizeDashboardLayout(role, persisted);
    return res.json({ widgets });
  }
);

router.put(
  "/dashboard/widgets",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const role = req.user!.role as Role;
    const widgets = sanitizeDashboardLayout(role, req.body?.widgets);
    const layoutsByUser = await loadDashboardWidgetLayouts();
    layoutsByUser[req.user!.userId] = widgets;
    await prisma.systemConfig.upsert({
      where: { key: DASHBOARD_WIDGET_LAYOUTS_KEY },
      create: {
        key: DASHBOARD_WIDGET_LAYOUTS_KEY,
        value: JSON.stringify(layoutsByUser),
        updatedBy: req.user!.userId,
      },
      update: {
        value: JSON.stringify(layoutsByUser),
        updatedBy: req.user!.userId,
      },
    });
    return res.json({ widgets });
  }
);

router.get("/developer/dashboard", authorizeRoles(Role.DEVELOPER), requireProjectFromRequest, async (req: AuthRequest, res: Response) => {
  const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
  const where = req.user!.role === Role.ADMIN ? { projectId } : { assignedTo: req.user!.userId, projectId };
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
  requireProjectFromRequest,
  async (req: AuthRequest, res: Response) => {
    const projectId = req.projectContext?.projectId || getProjectIdFromRequest(req);
    const issues = await prisma.issue.findMany({
      where: req.user!.role === Role.ADMIN ? { projectId } : { assignedTo: req.user!.userId, projectId },
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
router.get(
  "/admin/role-permissions/me",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const withMandatoryPermissions = (role: "ADMIN" | "TESTER" | "DEVELOPER", permissions: string[]): string[] => {
      const next = Array.from(new Set(permissions.filter(Boolean)));
      if (!next.includes("Reports")) next.push("Reports");
      if (role === "ADMIN" && !next.includes("All Bugs")) next.push("All Bugs");
      return next;
    };

    const defaults: Record<string, string[]> = {
      ADMIN: [
        "Manage Users",
        "Manage Projects",
        "Manage Roles",
        "View Audit Logs",
        "Backup Management",
        "Reports",
        "All Bugs",
      ],
      TESTER: ["Create Test Cases", "Execute Tests", "Bug Management", "Reports"],
      DEVELOPER: [
        "Reports",
        "My Assigned Bugs",
        "All Bugs",
        "Test Reports",
        "Performance Report",
        "Linked Commits",
      ],
    };

    const config = await prisma.systemConfig.findUnique({
      where: { key: "ROLE_PERMISSIONS" },
      select: { value: true },
    });

    let rolePermissions = defaults;
    if (config?.value) {
      try {
        const parsed = JSON.parse(config.value) as Record<string, unknown>;
        rolePermissions = {
          ADMIN: withMandatoryPermissions(
            "ADMIN",
            Array.isArray(parsed?.ADMIN)
            ? (parsed.ADMIN as unknown[]).map((x) => asString(x)).filter(Boolean)
            : defaults.ADMIN
          ),
          TESTER: withMandatoryPermissions(
            "TESTER",
            Array.isArray(parsed?.TESTER)
            ? (parsed.TESTER as unknown[]).map((x) => asString(x)).filter(Boolean)
            : defaults.TESTER
          ),
          DEVELOPER: withMandatoryPermissions(
            "DEVELOPER",
            Array.isArray(parsed?.DEVELOPER)
            ? (parsed.DEVELOPER as unknown[]).map((x) => asString(x)).filter(Boolean)
            : defaults.DEVELOPER
          ),
        };
      } catch {
        rolePermissions = defaults;
      }
    }

    const roleKey = String(req.user!.role || "").toUpperCase();
    return res.json({
      role: roleKey,
      permissions: rolePermissions[roleKey] || [],
      rolePermissions,
    });
  }
);

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

router.delete("/admin/users/:id", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  if (req.user!.userId === req.params.id) {
    return res.status(400).json({ message: "Admin cannot delete their own account" });
  }

  await prisma.user.delete({
    where: { id: req.params.id },
  });

  await writeAuditLog(req.user!.userId, "ADMIN_DELETE_USER", "User", req.params.id);
  return res.status(204).send();
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
    include: {
      updater: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { updatedAt: "desc" },
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
  const jobs = await prisma.backupJob.findMany({
    include: {
      triggerUser: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 200,
  });
  return res.json(jobs);
});

let reportSchedulerBusy = false;
setInterval(async () => {
  if (reportSchedulerBusy) return;
  reportSchedulerBusy = true;
  try {
    const schedules = await loadReportSchedules();
    const now = new Date();
    let changed = false;
    for (const schedule of schedules) {
      if (!schedule.active || !schedule.nextRunAt) continue;
      const dueAt = new Date(schedule.nextRunAt);
      if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() > now.getTime()) continue;
      await runScheduledReport(schedule);
      schedule.lastSentAt = now.toISOString();
      schedule.nextRunAt = computeNextRunAt(schedule);
      changed = true;
    }
    if (changed) {
      await saveReportSchedules(schedules);
    }
  } catch (error) {
    console.error("REPORT_SCHEDULER_ERROR", error);
  } finally {
    reportSchedulerBusy = false;
  }
}, 60 * 1000);

export default router;
