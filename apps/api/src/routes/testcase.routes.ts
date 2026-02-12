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
} from "@prisma/client";
import bcrypt from "bcrypt";
import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();

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

router.use(authenticate);

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
      const items = Array.isArray(req.body.items) ? req.body.items : [];
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

router.post(
  "/testcases/:id/execute",
  authorizeRoles(Role.TESTER),
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
        result,
        notes: asString(req.body.notes) || null,
      },
    });

    await writeAuditLog(req.user!.userId, "EXECUTE_TEST_CASE", "TestExecution", execution.id, { result });
    return res.status(201).json(execution);
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
      include: {
        testCase: { select: { id: true, title: true } },
        executor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { executedAt: "desc" },
    });

    if (req.query.export === "csv") {
      const header = "executionId,testCaseId,testCaseTitle,result,executor,executedAt";
      const rows = executions.map((item) =>
        [item.id, item.testCaseId, item.testCase.title, item.result, item.executor.email, item.executedAt.toISOString()]
          .map((value) => `"${String(value).replace(/\"/g, "\"\"")}"`)
          .join(",")
      );
      res.setHeader("Content-Type", "text/csv");
      return res.send([header, ...rows].join("\n"));
    }

    return res.json(executions);
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

    const issue = await prisma.issue.create({
      data: {
        title: asString(req.body.title) || `Bug: ${execution.testCase.title}`,
        description:
          asString(req.body.description) ||
          `Auto-created from failed execution ${execution.id} for test case ${execution.testCase.title}`,
        severity: parseEnum(Severity, req.body.severity) || Severity.MEDIUM,
        status: IssueStatus.OPEN,
        testCaseId: execution.testCaseId,
        executionId: execution.id,
        reportedBy: req.user!.userId,
        assignedTo: asString(req.body.assignedTo) || null,
      },
    });

    await writeAuditLog(req.user!.userId, "CREATE_BUG_REPORT", "Issue", issue.id, { executionId: execution.id });
    return res.status(201).json(issue);
  }
);

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
    prisma.testExecution.count(),
    prisma.testExecution.count({ where: { result: ExecutionStatus.FAILED } }),
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

export default router;
