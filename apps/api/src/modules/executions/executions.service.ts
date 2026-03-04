import { ExecutionStatus, IssueStatus, Prisma, Role, TestRunCaseStatus } from "@prisma/client";
import prisma from "../../prisma";
const prismaAny = prisma as any;

type ServiceError = Error & { statusCode?: number };

type StepExecutionItem = {
  stepNumber: number;
  action: string;
  expectedResult: string;
  status: ExecutionStatus | "NOT_EXECUTED";
  actualResult: string;
  notes: string;
  executedAt?: string | null;
  evidence?: Array<{ fileType: string; fileUrl: string; fileName: string; notes?: string }>;
};

const META_PREFIX = "[META]";
const META_SUFFIX = "[/META]";

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const fail = (statusCode: number, message: string): never => {
  const err = new Error(message) as ServiceError;
  err.statusCode = statusCode;
  throw err;
};

const requireValue = <T>(value: T | null | undefined, statusCode: number, message: string): NonNullable<T> => {
  if (value === null || value === undefined) fail(statusCode, message);
  return value as NonNullable<T>;
};

const parseEnum = <T extends Record<string, string>>(enumType: T, value: unknown): T[keyof T] | null => {
  if (typeof value !== "string") return null;
  return (Object.values(enumType) as string[]).includes(value) ? (value as T[keyof T]) : null;
};

const resolveActiveDeveloperId = async (
  tx: Prisma.TransactionClient,
  raw: unknown
): Promise<string | null> => {
  const input = asString(raw);
  if (!input) return null;

  const byId = await tx.user.findUnique({ where: { id: input } });
  if (byId && byId.role === Role.DEVELOPER && byId.isActive) {
    return byId.id;
  }

  if (input.includes("@")) {
    const byEmail = await tx.user.findUnique({ where: { email: input.toLowerCase() } });
    if (byEmail && byEmail.role === Role.DEVELOPER && byEmail.isActive) {
      return byEmail.id;
    }
  }

  return null;
};

const toExecutionStepItems = (steps: unknown): StepExecutionItem[] => {
  let rawSteps: unknown = steps;
  if (typeof rawSteps === "string") {
    const rawText = rawSteps;
    try {
      rawSteps = JSON.parse(rawText);
    } catch {
      rawSteps = rawText
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
    if (Array.isArray(maybeSteps)) rawSteps = maybeSteps;
  }
  if (!Array.isArray(rawSteps)) return [];

  return rawSteps
    .map((item: unknown, idx: number) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const row = item as Record<string, unknown>;
        const parsed = Number(row.stepNumber);
        const stepNumber = Number.isFinite(parsed) ? parsed : idx + 1;
        return {
          stepNumber,
          action: asString(row.action) || `Step ${stepNumber}`,
          expectedResult: asString(row.expectedResult),
          status: "NOT_EXECUTED" as const,
          actualResult: "",
          notes: "",
          executedAt: null,
        };
      }
      const text = asString(item);
      if (!text) return null;
      return {
        stepNumber: idx + 1,
        action: text,
        expectedResult: "",
        status: "NOT_EXECUTED" as const,
        actualResult: "",
        notes: "",
        executedAt: null,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.stepNumber - b.stepNumber) as StepExecutionItem[];
};

const parseStoredStepResults = (value: unknown): StepExecutionItem[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as StepExecutionItem[];
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

const parseExecutionNotes = (notes: string | null): { userNotes: string; meta: ExecutionMeta } => {
  if (!notes) return { userNotes: "", meta: {} };
  const trimmed = notes.trim();
  if (!trimmed.startsWith(META_PREFIX)) return { userNotes: notes, meta: {} };
  const suffixIdx = trimmed.indexOf(META_SUFFIX);
  if (suffixIdx === -1) return { userNotes: notes, meta: {} };
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

const SUITE_EXECUTION_STATUS = {
  PLANNED: "PLANNED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
} as const;

const SUITE_EXECUTION_MODE = {
  SEQUENTIAL: "SEQUENTIAL",
  PARALLEL: "PARALLEL",
} as const;

const getSuiteExecutionStatus = (summary: {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
}) => {
  const { total, passed, failed, blocked, skipped } = summary;
  const completed = passed + failed + blocked + skipped;
  if (total === 0) return SUITE_EXECUTION_STATUS.PLANNED;
  if (completed === 0 || completed < total) return SUITE_EXECUTION_STATUS.RUNNING;
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

const enforceSuiteExecutionModeConstraints = async (params: {
  testRunId: string;
  testCaseId: string;
  actorId: string;
}): Promise<void> => {
  const suiteCase = await prismaAny.testSuiteExecutionCase.findFirst({
    where: {
      testCaseId: params.testCaseId,
      suiteExecution: {
        linkedTestRunId: params.testRunId,
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
    include: { suiteExecution: { select: { id: true, mode: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!suiteCase) return;

  if (suiteCase.status !== TestRunCaseStatus.NOT_RUN) {
    fail(409, "This suite case is already executed");
  }

  const draftByAnyTester = await prisma.testExecution.findFirst({
    where: {
      testRunId: params.testRunId,
      testCaseId: params.testCaseId,
      isDraft: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (draftByAnyTester && draftByAnyTester.executedBy !== params.actorId) {
    fail(409, "This suite case is already in progress by another tester");
  }

  if (suiteCase.suiteExecution.mode !== SUITE_EXECUTION_MODE.SEQUENTIAL) return;

  const nextPending = await prismaAny.testSuiteExecutionCase.findFirst({
    where: {
      suiteExecutionId: suiteCase.suiteExecutionId,
      status: TestRunCaseStatus.NOT_RUN,
    },
    orderBy: { position: "asc" },
    select: { testCaseId: true },
  });

  if (nextPending && nextPending.testCaseId !== params.testCaseId) {
    fail(409, "Sequential suite mode: execute the next pending suite case first");
  }
};

const computeDurationSeconds = (start: Date, end: Date): number => {
  const diffMs = end.getTime() - start.getTime();
  return diffMs <= 0 ? 0 : Math.floor(diffMs / 1000);
};

const computeTimerDurationSeconds = (meta: ExecutionMeta, now = new Date()): number => {
  const accumulated = Number(meta.timerAccumulatedSeconds || 0);
  const lastResumed = meta.timerLastResumedAt ? new Date(meta.timerLastResumedAt) : null;
  if (meta.timerState === "RUNNING" && lastResumed) {
    return accumulated + computeDurationSeconds(lastResumed, now);
  }
  return accumulated;
};

const writeAuditLog = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: object
) => {
  await tx.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      metadata: metadata ? (metadata as never) : undefined,
    },
  });
};

const validateEvidence = (value: unknown): Array<{ fileType: string; fileUrl: string; fileName: string; notes?: string }> => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(400, "evidence must be an array");
  const rows = value as unknown[];
  const parsed = rows.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) fail(400, "Each evidence entry must be an object");
    const row = item as Record<string, unknown>;
    const fileType = asString(row.fileType);
    const fileUrl = asString(row.fileUrl);
    const fileName = asString(row.fileName);
    const notes = asString(row.notes);
    if (!fileType || !fileUrl || !fileName) {
      fail(400, "Each evidence entry requires fileType, fileUrl, fileName");
    }
    return { fileType, fileUrl, fileName, ...(notes ? { notes } : {}) };
  });
  return parsed;
};

const computeOverallResult = (steps: StepExecutionItem[]): ExecutionStatus => {
  if (steps.some((step) => step.status === ExecutionStatus.FAILED)) return ExecutionStatus.FAILED;
  if (steps.some((step) => step.status === ExecutionStatus.BLOCKED)) return ExecutionStatus.BLOCKED;
  return ExecutionStatus.PASSED;
};

const generateBugCode = async (tx: Prisma.TransactionClient): Promise<string> => {
  const year = new Date().getFullYear();
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const count = await tx.issue.count();
    const serial = String(count + 1 + attempts).padStart(5, "0");
    const code = `BUG-${year}-${serial}`;
    const existing = await tx.issue.findUnique({ where: { bugCode: code } });
    if (!existing) return code;
  }
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `BUG-${year}-${String(random).padStart(5, "0")}-${timestamp}`;
};

export const executionsService = {
  async start(input: {
    testCaseId: string;
    testRunId?: string | null;
    notes?: string;
    actorId: string;
    actorRole: Role;
  }) {
    const testCaseId = asString(input.testCaseId);
    const testRunId = asString(input.testRunId) || null;
    const actorId = asString(input.actorId);
    if (!testCaseId || !actorId) fail(400, "testCaseId and actorId are required");

    return prisma.$transaction(async (tx) => {
      const testCase = requireValue(
        await tx.testCase.findUnique({ where: { id: testCaseId } }),
        404,
        "Test case not found"
      );
      if (testCase.isDeleted) fail(404, "Test case not found");

      if (testRunId) {
        const run = requireValue(
          await tx.testRun.findUnique({
            where: { id: testRunId },
            include: { assignments: true, testCases: true },
          }),
          404,
          "Test run not found"
        );
        const assigned = run.assignments.some((item) => item.testerId === actorId);
        const isCreator = run.createdBy === actorId;
        const included = run.testCases.some((item) => item.testCaseId === testCaseId);
        if (input.actorRole !== Role.ADMIN && !assigned && !isCreator) {
          fail(403, "You are not assigned to this test run");
        }
        if (!included) {
          fail(403, "Selected test case is not part of this test run");
        }
        await enforceSuiteExecutionModeConstraints({ testRunId, testCaseId, actorId });
      }

      const active = await tx.testExecution.findFirst({
        where: {
          testCaseId,
          executedBy: actorId,
          testRunId,
          isDraft: true,
        },
        orderBy: { updatedAt: "desc" },
      });
      if (active) fail(409, "An active execution already exists for this test case");

      const startedAt = new Date().toISOString();
      const execution = await tx.testExecution.create({
        data: {
          testCaseId,
          projectId: testCase.projectId,
          executedBy: actorId,
          testRunId,
          result: ExecutionStatus.SKIPPED,
          stepResults: toExecutionStepItems(testCase.steps) as never,
          progressPercent: 0,
          isDraft: true,
          notes: mergeExecutionNotes(null, asString(input.notes) || "", {
            timerStartAt: startedAt,
            timerState: "RUNNING",
            timerAccumulatedSeconds: 0,
            timerLastResumedAt: startedAt,
          }),
        },
      });

      await writeAuditLog(tx, actorId, "START_TEST_EXECUTION_V2", "TestExecution", execution.id, {
        testCaseId,
        testRunId,
      });

      return {
        ...execution,
        startedAt,
      };
    });
  },

  async saveStep(input: {
    executionId: string;
    stepNumber: number;
    status: string;
    actualResult: string;
    notes?: string;
    evidence?: unknown;
    actorId: string;
    actorRole: Role;
  }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");
    if (!Number.isFinite(input.stepNumber) || input.stepNumber <= 0) fail(400, "Valid stepNumber is required");

    const status = parseEnum(ExecutionStatus, input.status);
    if (!status) fail(400, "status must be PASSED/FAILED/BLOCKED/SKIPPED");
    const stepStatus = status as ExecutionStatus;
    const actualResult = asString(input.actualResult);
    if (!actualResult) fail(400, "actualResult is required");

    const evidence = validateEvidence(input.evidence);
    if (stepStatus === ExecutionStatus.FAILED && input.evidence !== undefined && evidence.length === 0) {
      fail(400, "FAILED step evidence is invalid");
    }

    return prisma.$transaction(async (tx) => {
      const execution = requireValue(
        await tx.testExecution.findUnique({
          where: { id: executionId },
          include: { testCase: true },
        }),
        404,
        "Execution not found"
      );

      if (input.actorRole !== Role.ADMIN && execution.executedBy !== input.actorId) {
        fail(403, "You can update only your own execution");
      }
      if (!execution.isDraft) fail(400, "Execution is already finalized");

      const storedSteps = parseStoredStepResults(execution.stepResults);
      const fallback = toExecutionStepItems(execution.testCase.steps);
      const base = storedSteps.length > 0 ? storedSteps : fallback;
      const idx = base.findIndex((item) => item.stepNumber === input.stepNumber);
      if (idx < 0) fail(404, "Step not found");

      base[idx] = {
        ...base[idx],
        status: stepStatus,
        actualResult,
        notes: asString(input.notes),
        executedAt: new Date().toISOString(),
        ...(input.evidence !== undefined ? { evidence } : {}),
      };

      const executedCount = base.filter((item) => item.status !== "NOT_EXECUTED").length;
      const progressPercent = base.length === 0 ? 0 : Math.round((executedCount / base.length) * 100);
      const updated = await tx.testExecution.update({
        where: { id: execution.id },
        data: {
          stepResults: base as never,
          progressPercent,
        },
      });

      await writeAuditLog(tx, input.actorId, "SAVE_EXECUTION_STEP_V2", "TestExecution", updated.id, {
        stepNumber: input.stepNumber,
        status: stepStatus,
      });

      return {
        id: updated.id,
        progressPercent,
        stepResults: base,
      };
    });
  },

  async finalize(input: { executionId: string; notes?: string; actorId: string; actorRole: Role }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");

    return prisma.$transaction(async (tx) => {
      const execution = requireValue(
        await tx.testExecution.findUnique({
          where: { id: executionId },
          include: { testCase: true },
        }),
        404,
        "Execution not found"
      );
      if (input.actorRole !== Role.ADMIN && execution.executedBy !== input.actorId) {
        fail(403, "You can finalize only your own execution");
      }
      if (!execution.isDraft) fail(400, "Execution is already finalized");

      const steps = parseStoredStepResults(execution.stepResults);
      if (!steps.length) fail(400, "No execution steps available");
      const incomplete = steps.filter((step) => step.status === "NOT_EXECUTED");
      if (incomplete.length > 0) {
        fail(400, `All steps must be marked before finalize. Pending: ${incomplete.length}`);
      }

      const overallResult = computeOverallResult(steps);
      const parsed = parseExecutionNotes(execution.notes);
      const start = parsed.meta.timerStartAt ? new Date(parsed.meta.timerStartAt) : execution.executedAt;
      const completedAt = parsed.meta.timerStopAt ? new Date(parsed.meta.timerStopAt) : new Date();
      const autoDuration =
        parsed.meta.timerStopAt || parsed.meta.timerState === "STOPPED"
          ? Number(parsed.meta.durationSeconds || computeTimerDurationSeconds(parsed.meta, completedAt))
          : computeTimerDurationSeconds(parsed.meta, completedAt);
      const durationSeconds =
        typeof parsed.meta.manualDurationSeconds === "number"
          ? parsed.meta.manualDurationSeconds
          : autoDuration || computeDurationSeconds(start, completedAt);
      const notes = mergeExecutionNotes(execution.notes, asString(input.notes) || parsed.userNotes, {
        timerStartAt: start.toISOString(),
        timerStopAt: completedAt.toISOString(),
        durationSeconds,
        timerState: "STOPPED",
        timerAccumulatedSeconds: autoDuration,
        timerLastResumedAt: undefined,
      });

      const finalized = await tx.testExecution.update({
        where: { id: execution.id },
        data: {
          result: overallResult,
          notes,
          isDraft: false,
          progressPercent: 100,
        },
      });

      if (finalized.testRunId) {
        await tx.testRunCase.updateMany({
          where: { testRunId: finalized.testRunId, testCaseId: finalized.testCaseId },
          data: {
            status: deriveRunCaseStatus(overallResult),
            lastExecutionId: finalized.id,
          },
        });
        await syncSuiteExecutionCaseFromTestRun(
          finalized.testRunId,
          finalized.testCaseId,
          finalized.id,
          deriveRunCaseStatus(overallResult)
        );
      }

      await writeAuditLog(tx, input.actorId, "FINALIZE_TEST_EXECUTION_V2", "TestExecution", finalized.id, {
        finalResult: overallResult,
      });
      return {
        ...finalized,
        startedAt: start.toISOString(),
        completedAt: completedAt.toISOString(),
        durationSeconds,
        timerState: "STOPPED",
      };
    });
  },

  async reExecute(input: { executionId: string; notes?: string; actorId: string; actorRole: Role }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");

    return prisma.$transaction(async (tx) => {
      const original = requireValue(
        await tx.testExecution.findUnique({
          where: { id: executionId },
          include: { testCase: true },
        }),
        404,
        "Execution not found"
      );
      if (input.actorRole !== Role.ADMIN && original.executedBy !== input.actorId) {
        fail(403, "You can re-execute only your own execution");
      }

      const base = toExecutionStepItems(original.testCase.steps);
      const startedAt = new Date().toISOString();
      const restarted = await tx.testExecution.create({
        data: {
          testCaseId: original.testCaseId,
          projectId: original.projectId,
          executedBy: input.actorId,
          testRunId: original.testRunId,
          result: ExecutionStatus.SKIPPED,
          stepResults: base as never,
          progressPercent: 0,
          isDraft: true,
          notes: mergeExecutionNotes(null, asString(input.notes) || "Re-execution initiated", {
            timerStartAt: startedAt,
            reexecutionOfId: original.id,
            timerState: "RUNNING",
            timerAccumulatedSeconds: 0,
            timerLastResumedAt: startedAt,
          }),
        },
      });

      await writeAuditLog(tx, input.actorId, "REEXECUTE_TEST_CASE_V2", "TestExecution", restarted.id, {
        originalExecutionId: original.id,
      });
      return {
        ...restarted,
        startedAt,
      };
    });
  },

  async createBug(input: {
    executionId: string;
    stepNumber: number;
    environment?: string;
    severity?: string;
    assignedTo?: string;
    actorId: string;
    actorRole: Role;
  }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");
    if (!Number.isFinite(input.stepNumber) || input.stepNumber <= 0) fail(400, "Valid stepNumber is required");

    return prisma.$transaction(async (tx) => {
      const execution = requireValue(
        await tx.testExecution.findUnique({
          where: { id: executionId },
          include: { testCase: true },
        }),
        404,
        "Execution not found"
      );

      if (input.actorRole !== Role.ADMIN && execution.executedBy !== input.actorId) {
        fail(403, "You can create bug only for your own execution");
      }

      const steps = parseStoredStepResults(execution.stepResults);
      const step = requireValue(
        steps.find((row) => row.stepNumber === input.stepNumber),
        404,
        "Step not found"
      );
      if (step.status !== ExecutionStatus.FAILED) fail(400, "Bug can be created only from FAILED step");

      const bugCode = await generateBugCode(tx);
      const severity = parseEnum(
        { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" },
        input.severity || "MEDIUM"
      );
      const assignedTo = await resolveActiveDeveloperId(tx, input.assignedTo);
      if (asString(input.assignedTo) && !assignedTo) {
        fail(400, "assignedTo must be an active developer (id or email)");
      }

      const issue = await tx.issue.create({
        data: {
          bugCode,
          title: `Bug in ${execution.testCase.title} - Step ${step.stepNumber}`,
          description: `Auto-created from execution ${execution.id}`,
          stepsToReproduce: step.action || `Execute step ${step.stepNumber}`,
          expectedBehavior: step.expectedResult || "Expected step result",
          actualBehavior: step.actualResult || "Observed failure",
          environment: asString(input.environment) || execution.testCase.module || null,
          severity: (severity as any) || "MEDIUM",
          status: IssueStatus.OPEN,
          testCaseId: execution.testCaseId,
          executionId: execution.id,
          reportedBy: input.actorId,
          assignedTo,
          workflowStatus: "NEW",
          bugPriority: "P3_MEDIUM",
        } as any,
      });

      await writeAuditLog(tx, input.actorId, "CREATE_BUG_FROM_EXECUTION_STEP_V2", "Issue", issue.id, {
        executionId: execution.id,
        stepNumber: step.stepNumber,
      });

      return issue;
    });
  },

  async timerStart(input: { executionId: string; actorId: string; actorRole: Role }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");

    return prisma.$transaction(async (tx) => {
      const execution = requireValue(
        await tx.testExecution.findUnique({ where: { id: executionId } }),
        404,
        "Execution not found"
      );
      if (input.actorRole !== Role.ADMIN && execution.executedBy !== input.actorId) {
        fail(403, "You can manage timer only for your own execution");
      }
      if (!execution.isDraft) fail(400, "Execution already finalized");

      const parsed = parseExecutionNotes(execution.notes);
      const nowIso = new Date().toISOString();
      const startedAt = parsed.meta.timerStartAt || nowIso;
      const nextMeta: Partial<ExecutionMeta> = {
        timerStartAt: startedAt,
        timerState: "RUNNING",
        timerAccumulatedSeconds: Number(parsed.meta.timerAccumulatedSeconds || 0),
        timerLastResumedAt: nowIso,
      };
      const updated = await tx.testExecution.update({
        where: { id: execution.id },
        data: {
          notes: mergeExecutionNotes(execution.notes, parsed.userNotes, nextMeta),
        },
      });

      const durationSeconds = computeTimerDurationSeconds({ ...parsed.meta, ...nextMeta }, new Date());
      await writeAuditLog(tx, input.actorId, "START_EXECUTION_TIMER_V2", "TestExecution", updated.id, {
        startedAt,
      });
      return {
        id: updated.id,
        startedAt,
        completedAt: parsed.meta.timerStopAt || null,
        durationSeconds,
        timerState: "RUNNING",
      };
    });
  },

  async timerPause(input: { executionId: string; actorId: string; actorRole: Role }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");

    return prisma.$transaction(async (tx) => {
      const execution = requireValue(
        await tx.testExecution.findUnique({ where: { id: executionId } }),
        404,
        "Execution not found"
      );
      if (input.actorRole !== Role.ADMIN && execution.executedBy !== input.actorId) {
        fail(403, "You can manage timer only for your own execution");
      }
      if (!execution.isDraft) fail(400, "Execution already finalized");

      const parsed = parseExecutionNotes(execution.notes);
      if (parsed.meta.timerState !== "RUNNING") {
        fail(400, "Timer is not running");
      }
      const now = new Date();
      const durationSeconds = computeTimerDurationSeconds(parsed.meta, now);
      const nextMeta: Partial<ExecutionMeta> = {
        timerState: "PAUSED",
        timerAccumulatedSeconds: durationSeconds,
        timerLastResumedAt: undefined,
        durationSeconds,
      };
      const updated = await tx.testExecution.update({
        where: { id: execution.id },
        data: {
          notes: mergeExecutionNotes(execution.notes, parsed.userNotes, nextMeta),
        },
      });
      await writeAuditLog(tx, input.actorId, "PAUSE_EXECUTION_TIMER_V2", "TestExecution", updated.id, {
        durationSeconds,
      });
      return {
        id: updated.id,
        startedAt: parsed.meta.timerStartAt || null,
        completedAt: parsed.meta.timerStopAt || null,
        durationSeconds,
        timerState: "PAUSED",
      };
    });
  },

  async timerResume(input: { executionId: string; actorId: string; actorRole: Role }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");

    return prisma.$transaction(async (tx) => {
      const execution = requireValue(
        await tx.testExecution.findUnique({ where: { id: executionId } }),
        404,
        "Execution not found"
      );
      if (input.actorRole !== Role.ADMIN && execution.executedBy !== input.actorId) {
        fail(403, "You can manage timer only for your own execution");
      }
      if (!execution.isDraft) fail(400, "Execution already finalized");

      const parsed = parseExecutionNotes(execution.notes);
      if (parsed.meta.timerState === "RUNNING") {
        return {
          id: execution.id,
          startedAt: parsed.meta.timerStartAt || null,
          completedAt: parsed.meta.timerStopAt || null,
          durationSeconds: computeTimerDurationSeconds(parsed.meta, new Date()),
          timerState: "RUNNING",
        };
      }
      if (parsed.meta.timerState === "STOPPED") fail(400, "Timer is already stopped");

      const nowIso = new Date().toISOString();
      const nextMeta: Partial<ExecutionMeta> = {
        timerState: "RUNNING",
        timerLastResumedAt: nowIso,
        timerStartAt: parsed.meta.timerStartAt || nowIso,
        timerAccumulatedSeconds: Number(parsed.meta.timerAccumulatedSeconds || 0),
      };
      const updated = await tx.testExecution.update({
        where: { id: execution.id },
        data: {
          notes: mergeExecutionNotes(execution.notes, parsed.userNotes, nextMeta),
        },
      });
      await writeAuditLog(tx, input.actorId, "RESUME_EXECUTION_TIMER_V2", "TestExecution", updated.id);
      return {
        id: updated.id,
        startedAt: nextMeta.timerStartAt || null,
        completedAt: null,
        durationSeconds: computeTimerDurationSeconds({ ...parsed.meta, ...nextMeta }, new Date()),
        timerState: "RUNNING",
      };
    });
  },

  async timerStop(input: { executionId: string; actorId: string; actorRole: Role }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");

    return prisma.$transaction(async (tx) => {
      const execution = requireValue(
        await tx.testExecution.findUnique({ where: { id: executionId } }),
        404,
        "Execution not found"
      );
      if (input.actorRole !== Role.ADMIN && execution.executedBy !== input.actorId) {
        fail(403, "You can manage timer only for your own execution");
      }

      const parsed = parseExecutionNotes(execution.notes);
      const now = new Date();
      const nowIso = now.toISOString();
      const autoDuration = computeTimerDurationSeconds(parsed.meta, now);
      const nextMeta: Partial<ExecutionMeta> = {
        timerStopAt: nowIso,
        timerState: "STOPPED",
        timerAccumulatedSeconds: autoDuration,
        timerLastResumedAt: undefined,
        durationSeconds:
          typeof parsed.meta.manualDurationSeconds === "number"
            ? parsed.meta.manualDurationSeconds
            : autoDuration,
      };
      const updated = await tx.testExecution.update({
        where: { id: execution.id },
        data: {
          notes: mergeExecutionNotes(execution.notes, parsed.userNotes, nextMeta),
        },
      });
      await writeAuditLog(tx, input.actorId, "STOP_EXECUTION_TIMER_V2", "TestExecution", updated.id, {
        completedAt: nowIso,
        durationSeconds: nextMeta.durationSeconds,
      });
      return {
        id: updated.id,
        startedAt: parsed.meta.timerStartAt || null,
        completedAt: nowIso,
        durationSeconds: nextMeta.durationSeconds || autoDuration,
        timerState: "STOPPED",
      };
    });
  },

  async setManualTime(input: {
    executionId: string;
    durationSeconds: number;
    actorId: string;
    actorRole: Role;
  }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");
    if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) {
      fail(400, "durationSeconds must be a non-negative number");
    }

    return prisma.$transaction(async (tx) => {
      const execution = requireValue(
        await tx.testExecution.findUnique({ where: { id: executionId } }),
        404,
        "Execution not found"
      );
      if (input.actorRole !== Role.ADMIN && execution.executedBy !== input.actorId) {
        fail(403, "You can update time only for your own execution");
      }
      const parsed = parseExecutionNotes(execution.notes);
      const updated = await tx.testExecution.update({
        where: { id: execution.id },
        data: {
          notes: mergeExecutionNotes(execution.notes, parsed.userNotes, {
            manualDurationSeconds: input.durationSeconds,
            durationSeconds: input.durationSeconds,
          }),
        },
      });
      await writeAuditLog(tx, input.actorId, "SET_EXECUTION_MANUAL_TIME_V2", "TestExecution", updated.id, {
        durationSeconds: input.durationSeconds,
      });
      return {
        id: updated.id,
        durationSeconds: input.durationSeconds,
        timerState: parsed.meta.timerState || "RUNNING",
      };
    });
  },

  async history(input: { executionId: string; actorId: string; actorRole: Role }) {
    const executionId = asString(input.executionId);
    if (!executionId) fail(400, "executionId is required");

    const seed = requireValue(
      await prisma.testExecution.findUnique({
        where: { id: executionId },
        select: { id: true, testCaseId: true, executedBy: true },
      }),
      404,
      "Execution not found"
    );
    if (input.actorRole !== Role.ADMIN && seed.executedBy !== input.actorId) {
      fail(403, "You can view history only for your own execution");
    }

    const rows = await prisma.testExecution.findMany({
      where: { testCaseId: seed.testCaseId },
      include: {
        executor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { executedAt: "desc" },
    });

    return rows.map((row) => {
      const parsed = parseExecutionNotes(row.notes);
      return {
        id: row.id,
        result: row.result,
        isDraft: row.isDraft,
        executedAt: row.executedAt,
        progressPercent: row.progressPercent,
        timer: {
          startedAt: parsed.meta.timerStartAt || null,
          completedAt: parsed.meta.timerStopAt || null,
          durationSeconds:
            typeof parsed.meta.manualDurationSeconds === "number"
              ? parsed.meta.manualDurationSeconds
              : typeof parsed.meta.durationSeconds === "number"
              ? parsed.meta.durationSeconds
              : null,
        },
        reexecutionOfId: parsed.meta.reexecutionOfId || null,
        executor: row.executor,
      };
    });
  },

  async compare(input: {
    executionId: string;
    compareToExecutionId: string;
    actorId: string;
    actorRole: Role;
  }) {
    const leftId = asString(input.executionId);
    const rightId = asString(input.compareToExecutionId);
    if (!leftId || !rightId) fail(400, "execution ids are required");

    const [left, right] = await Promise.all([
      prisma.testExecution.findUnique({ where: { id: leftId } }),
      prisma.testExecution.findUnique({ where: { id: rightId } }),
    ]);
    const current = requireValue(left, 404, "Execution not found");
    const previous = requireValue(right, 404, "Compare execution not found");
    if (current.testCaseId !== previous.testCaseId) {
      fail(400, "Executions belong to different test cases");
    }
    if (input.actorRole !== Role.ADMIN && current.executedBy !== input.actorId && previous.executedBy !== input.actorId) {
      fail(403, "You can compare only executions you own");
    }

    const leftSteps = parseStoredStepResults(current.stepResults);
    const rightSteps = parseStoredStepResults(previous.stepResults);
    const leftMap = new Map(leftSteps.map((s) => [s.stepNumber, s]));
    const rightMap = new Map(rightSteps.map((s) => [s.stepNumber, s]));
    const stepNumbers = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort((a, b) => a - b);

    const leftMeta = parseExecutionNotes(current.notes).meta;
    const rightMeta = parseExecutionNotes(previous.notes).meta;

    return {
      current: {
        id: current.id,
        result: current.result,
        executedAt: current.executedAt,
        durationSeconds:
          typeof leftMeta.manualDurationSeconds === "number"
            ? leftMeta.manualDurationSeconds
            : leftMeta.durationSeconds || null,
      },
      previous: {
        id: previous.id,
        result: previous.result,
        executedAt: previous.executedAt,
        durationSeconds:
          typeof rightMeta.manualDurationSeconds === "number"
            ? rightMeta.manualDurationSeconds
            : rightMeta.durationSeconds || null,
      },
      steps: stepNumbers.map((stepNumber) => {
        const l = leftMap.get(stepNumber);
        const r = rightMap.get(stepNumber);
        return {
          stepNumber,
          action: l?.action || r?.action || "",
          expectedResult: l?.expectedResult || r?.expectedResult || "",
          current: {
            status: l?.status || "NOT_EXECUTED",
            actualResult: l?.actualResult || "",
            notes: l?.notes || "",
          },
          previous: {
            status: r?.status || "NOT_EXECUTED",
            actualResult: r?.actualResult || "",
            notes: r?.notes || "",
          },
        };
      }),
    };
  },
};

export type { ServiceError };
