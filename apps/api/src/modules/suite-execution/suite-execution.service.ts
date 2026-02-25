import {
  ExecutionStatus,
  Prisma,
  Role,
  TestRunCaseStatus,
  TestRunStatus,
} from "@prisma/client";
import prisma from "../../prisma";

type ServiceError = Error & { statusCode?: number };

type InputStatus = "PASS" | "FAIL" | "BLOCKED" | "SKIPPED" | "NOT_EXECUTED";
type ResetMode = "ALL" | "FAILED_ONLY";

const fail = (statusCode: number, message: string): never => {
  const err = new Error(message) as ServiceError;
  err.statusCode = statusCode;
  throw err;
};

const requireValue = <T>(value: T | null | undefined, statusCode: number, message: string): NonNullable<T> => {
  if (value === null || value === undefined) fail(statusCode, message);
  return value as NonNullable<T>;
};

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const parseInputStatus = (value: unknown): InputStatus | null => {
  const normalized = asString(value).toUpperCase();
  if (normalized === "PASS") return "PASS";
  if (normalized === "FAIL") return "FAIL";
  if (normalized === "BLOCKED") return "BLOCKED";
  if (normalized === "SKIPPED") return "SKIPPED";
  if (normalized === "NOT_EXECUTED") return "NOT_EXECUTED";
  return null;
};

const parseResetMode = (value: unknown): ResetMode | null => {
  const normalized = asString(value).toUpperCase();
  if (normalized === "ALL") return "ALL";
  if (normalized === "FAILED_ONLY") return "FAILED_ONLY";
  return null;
};

const toRunCaseStatus = (status: Exclude<InputStatus, "NOT_EXECUTED">): TestRunCaseStatus => {
  switch (status) {
    case "PASS":
      return TestRunCaseStatus.PASSED;
    case "FAIL":
      return TestRunCaseStatus.FAILED;
    case "BLOCKED":
      return TestRunCaseStatus.BLOCKED;
    case "SKIPPED":
      return TestRunCaseStatus.SKIPPED;
    default:
      return TestRunCaseStatus.NOT_RUN;
  }
};

const toExecutionStatus = (status: Exclude<InputStatus, "NOT_EXECUTED">): ExecutionStatus => {
  switch (status) {
    case "PASS":
      return ExecutionStatus.PASSED;
    case "FAIL":
      return ExecutionStatus.FAILED;
    case "BLOCKED":
      return ExecutionStatus.BLOCKED;
    case "SKIPPED":
      return ExecutionStatus.SKIPPED;
    default:
      return ExecutionStatus.SKIPPED;
  }
};

const fromRunCaseStatus = (status: TestRunCaseStatus): InputStatus => {
  switch (status) {
    case TestRunCaseStatus.PASSED:
      return "PASS";
    case TestRunCaseStatus.FAILED:
      return "FAIL";
    case TestRunCaseStatus.BLOCKED:
      return "BLOCKED";
    case TestRunCaseStatus.SKIPPED:
      return "SKIPPED";
    case TestRunCaseStatus.NOT_RUN:
    default:
      return "NOT_EXECUTED";
  }
};

const writeAudit = async (
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

const ensureSuiteAndRun = async (tx: Prisma.TransactionClient, suiteId: string, runId: string) => {
  const suite = requireValue(
    await tx.testSuite.findUnique({
      where: { id: suiteId },
      select: { id: true, type: true, isArchived: true, filterJson: true },
    }),
    404,
    "Suite not found"
  );
  if (suite.isArchived) fail(400, "Cannot execute archived suite");

  const run = requireValue(
    await tx.testRun.findUnique({
      where: { id: runId },
      include: {
        assignments: { select: { testerId: true } },
      },
    }),
    404,
    "Test run not found"
  );

  return { suite, run };
};

const assertRunAccess = (
  params: {
    actorId: string;
    actorRole: Role;
    runCreatedBy: string;
    assignmentTesterIds: string[];
  }
) => {
  if (params.actorRole === Role.ADMIN) return;
  if (params.actorRole !== Role.TESTER) fail(403, "Unauthorized");
  if (params.runCreatedBy === params.actorId) return;
  if (params.assignmentTesterIds.includes(params.actorId)) return;
  fail(403, "Unauthorized");
};

const resolveDynamicFilterCaseIds = async (
  tx: Prisma.TransactionClient,
  filterJson: unknown
): Promise<string[]> => {
  const filter = (filterJson && typeof filterJson === "object" ? filterJson : {}) as Record<string, unknown>;
  const where: Record<string, unknown> = { isDeleted: false };

  const modules =
    Array.isArray(filter.modules) && filter.modules.length > 0
      ? filter.modules
      : filter.module
      ? [String(filter.module)]
      : [];
  const priorities =
    Array.isArray(filter.priorities) && filter.priorities.length > 0
      ? filter.priorities
      : filter.priority
      ? [String(filter.priority)]
      : [];
  const statuses =
    Array.isArray(filter.statuses) && filter.statuses.length > 0
      ? filter.statuses
      : filter.status
      ? [String(filter.status)]
      : [];
  const tags = Array.isArray(filter.tags) ? filter.tags : [];

  if (modules.length > 0) where.module = { in: modules };
  if (priorities.length > 0) where.priority = { in: priorities };
  if (statuses.length > 0) where.status = { in: statuses };
  if (tags.length > 0) where.tags = { hasSome: tags };
  if (filter.automationStatus) where.automationStatus = String(filter.automationStatus);

  const rows = await tx.testCase.findMany({
    where: where as Prisma.TestCaseWhereInput,
    select: { id: true },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map((row) => row.id);
};

const resolveSuiteCaseIds = async (
  tx: Prisma.TransactionClient,
  suite: { id: string; type: string; filterJson: unknown }
): Promise<string[]> => {
  if (suite.type === "DYNAMIC") {
    return resolveDynamicFilterCaseIds(tx, suite.filterJson);
  }
  const links = await tx.testSuiteCase.findMany({
    where: { suiteId: suite.id },
    include: { testCase: { select: { id: true, isDeleted: true } } },
    orderBy: { position: "asc" },
  });
  return links.filter((row) => !row.testCase.isDeleted).map((row) => row.testCaseId);
};

const syncSuiteRunRecords = async (params: {
  tx: Prisma.TransactionClient;
  suiteId: string;
  runId: string;
  actorId: string;
}): Promise<{ added: number; obsoleteMarked: number; activeTestCaseIds: string[] }> => {
  const { tx, suiteId, runId, actorId } = params;
  const suite = requireValue(
    await tx.testSuite.findUnique({
      where: { id: suiteId },
      select: { id: true, type: true, filterJson: true, isArchived: true },
    }),
    404,
    "Suite not found"
  );
  if (suite.isArchived) fail(400, "Cannot execute archived suite");

  const activeTestCaseIds = [...new Set(await resolveSuiteCaseIds(tx, suite as { id: string; type: string; filterJson: unknown }))];
  if (activeTestCaseIds.length === 0) {
    fail(400, "Suite is empty");
  }

  const runCases = await tx.testRunCase.findMany({
    where: { testRunId: runId },
    select: { id: true, testCaseId: true, status: true },
  });
  const runCaseByTestCaseId = new Map(runCases.map((row) => [row.testCaseId, row]));

  const missingIds = activeTestCaseIds.filter((testCaseId) => !runCaseByTestCaseId.has(testCaseId));
  if (missingIds.length > 0) {
    await tx.testRunCase.createMany({
      data: missingIds.map((testCaseId) => ({
        testRunId: runId,
        testCaseId,
        status: TestRunCaseStatus.NOT_RUN,
      })),
      skipDuplicates: true,
    });
    await writeAudit(tx, actorId, "SUITE_RUN_SYNC_ADD_CASES", "TestRun", runId, {
      suiteId,
      addedCaseIds: missingIds,
    });
  }

  const obsoleteRunCaseIds = runCases
    .filter((row) => !activeTestCaseIds.includes(row.testCaseId))
    .map((row) => row.id);

  if (obsoleteRunCaseIds.length > 0) {
    await tx.testRunCase.updateMany({
      where: { id: { in: obsoleteRunCaseIds } },
      data: { status: TestRunCaseStatus.SKIPPED },
    });
    await writeAudit(tx, actorId, "SUITE_RUN_SYNC_MARK_OBSOLETE", "TestRun", runId, {
      suiteId,
      obsoleteRunCaseIds,
    });
  }

  return {
    added: missingIds.length,
    obsoleteMarked: obsoleteRunCaseIds.length,
    activeTestCaseIds,
  };
};

const computeRunState = (runCases: Array<{ status: TestRunCaseStatus }>) => {
  const total = runCases.length;
  const notExecuted = runCases.filter((row) => row.status === TestRunCaseStatus.NOT_RUN).length;
  const passed = runCases.filter((row) => row.status === TestRunCaseStatus.PASSED).length;
  const failed = runCases.filter((row) => row.status === TestRunCaseStatus.FAILED).length;
  const blocked = runCases.filter((row) => row.status === TestRunCaseStatus.BLOCKED).length;
  const skipped = runCases.filter((row) => row.status === TestRunCaseStatus.SKIPPED).length;
  const executed = total - notExecuted;
  const progressPercent = total === 0 ? 0 : Math.round((executed / total) * 100);

  let runStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "COMPLETED_WITH_DEFECTS" = "NOT_STARTED";
  if (executed === 0) runStatus = "NOT_STARTED";
  else if (executed < total) runStatus = "IN_PROGRESS";
  else if (failed > 0) runStatus = "COMPLETED_WITH_DEFECTS";
  else runStatus = "COMPLETED";

  return {
    counts: { total, notExecuted, passed, failed, blocked, skipped, executed },
    progressPercent,
    runStatus,
  };
};

const syncTestRunStatus = async (tx: Prisma.TransactionClient, runId: string, computedStatus: string) => {
  const mappedStatus =
    computedStatus === "NOT_STARTED"
      ? TestRunStatus.PLANNED
      : computedStatus === "IN_PROGRESS"
      ? TestRunStatus.IN_PROGRESS
      : TestRunStatus.COMPLETED;

  await tx.testRun.update({
    where: { id: runId },
    data: { status: mappedStatus },
  });
};

export const suiteExecutionService = {
  async executeSuite(params: {
    suiteId: string;
    runId: string;
    actorId: string;
    actorRole: Role;
  }) {
    const suiteId = asString(params.suiteId);
    const runId = asString(params.runId);
    if (!suiteId || !runId) fail(400, "suiteId and runId are required");

    return prisma.$transaction(async (tx) => {
      const { run } = await ensureSuiteAndRun(tx, suiteId, runId);
      assertRunAccess({
        actorId: params.actorId,
        actorRole: params.actorRole,
        runCreatedBy: run.createdBy,
        assignmentTesterIds: run.assignments.map((row) => row.testerId),
      });

      const syncResult = await syncSuiteRunRecords({
        tx,
        suiteId,
        runId,
        actorId: params.actorId,
      });

      const currentRunCases = await tx.testRunCase.findMany({
        where: { testRunId: runId, testCaseId: { in: syncResult.activeTestCaseIds } },
        include: {
          testCase: { select: { id: true, title: true, testCaseCode: true, module: true } },
          lastExecution: {
            select: {
              id: true,
              executedBy: true,
              executedAt: true,
              result: true,
            },
          },
        },
      });

      const summary = computeRunState(currentRunCases.map((row) => ({ status: row.status })));
      await syncTestRunStatus(tx, runId, summary.runStatus);
      const obsoleteRunCases = await tx.testRunCase.findMany({
        where: { testRunId: runId, testCaseId: { notIn: syncResult.activeTestCaseIds } },
        include: {
          testCase: { select: { id: true, title: true, testCaseCode: true, module: true } },
          lastExecution: {
            select: {
              id: true,
              executedBy: true,
              executedAt: true,
              result: true,
            },
          },
        },
      });
      await writeAudit(tx, params.actorId, "EXECUTE_SUITE_SYNC", "TestRun", runId, {
        suiteId,
        ...syncResult,
      });

      return {
        runId,
        suiteId,
        sync: syncResult,
        runStatus: summary.runStatus,
        progressPercent: summary.progressPercent,
        executions: [
          ...currentRunCases.map((row) => ({
            id: row.id,
            testCaseId: row.testCaseId,
            status: fromRunCaseStatus(row.status),
            executedBy: row.lastExecution?.executedBy || null,
            executedAt: row.lastExecution?.executedAt || null,
            isObsolete: false,
            testCase: row.testCase,
          })),
          ...obsoleteRunCases.map((row) => ({
            id: row.id,
            testCaseId: row.testCaseId,
            status: fromRunCaseStatus(row.status),
            executedBy: row.lastExecution?.executedBy || null,
            executedAt: row.lastExecution?.executedAt || null,
            isObsolete: true,
            testCase: row.testCase,
          })),
        ],
      };
    });
  },

  async updateExecutionStatus(params: {
    executionId: string;
    status: unknown;
    actorId: string;
    actorRole: Role;
  }) {
    const executionId = asString(params.executionId);
    if (!executionId) fail(400, "execution id is required");
    const parsedStatus = parseInputStatus(params.status);
    if (!parsedStatus) fail(400, "Invalid status. Allowed: PASS, FAIL, BLOCKED, SKIPPED, NOT_EXECUTED");

    return prisma.$transaction(async (tx) => {
      const runCase = requireValue(
        await tx.testRunCase.findUnique({
          where: { id: executionId },
          include: {
            testRun: { include: { assignments: { select: { testerId: true } } } },
            testCase: { select: { id: true } },
          },
        }),
        404,
        "Execution record not found"
      );

      assertRunAccess({
        actorId: params.actorId,
        actorRole: params.actorRole,
        runCreatedBy: runCase.testRun.createdBy,
        assignmentTesterIds: runCase.testRun.assignments.map((row) => row.testerId),
      });

      if (parsedStatus === "NOT_EXECUTED") {
        const updated = await tx.testRunCase.update({
          where: { id: runCase.id },
          data: { status: TestRunCaseStatus.NOT_RUN, lastExecutionId: null },
        });
        await writeAudit(tx, params.actorId, "UPDATE_SUITE_EXECUTION_STATUS_RESET", "TestRunCase", updated.id, {
          runId: runCase.testRunId,
        });
      } else {
        const concreteStatus = parsedStatus as Exclude<InputStatus, "NOT_EXECUTED">;
        const status = toRunCaseStatus(concreteStatus);
        const execution = await tx.testExecution.create({
          data: {
            testCaseId: runCase.testCaseId,
            executedBy: params.actorId,
            testRunId: runCase.testRunId,
            result: toExecutionStatus(concreteStatus),
            notes: "Suite execution status update",
            stepResults: [] as never,
            progressPercent: 100,
            isDraft: false,
          },
        });

        await tx.testRunCase.update({
          where: { id: runCase.id },
          data: {
            status,
            lastExecutionId: execution.id,
          },
        });
        await writeAudit(tx, params.actorId, "UPDATE_SUITE_EXECUTION_STATUS", "TestRunCase", runCase.id, {
          status: parsedStatus,
          executedBy: params.actorId,
          executedAt: execution.executedAt,
        });
      }

      const runCases = await tx.testRunCase.findMany({
        where: { testRunId: runCase.testRunId },
        select: { status: true },
      });
      const summary = computeRunState(runCases);
      await syncTestRunStatus(tx, runCase.testRunId, summary.runStatus);

      const refreshed = requireValue(
        await tx.testRunCase.findUnique({
          where: { id: runCase.id },
          include: {
            lastExecution: {
              select: { executedBy: true, executedAt: true, result: true },
            },
          },
        }),
        404,
        "Execution record not found"
      );

      return {
        id: runCase.id,
        runId: runCase.testRunId,
        testCaseId: runCase.testCaseId,
        status: refreshed ? fromRunCaseStatus(refreshed.status) : parsedStatus,
        executedBy: refreshed?.lastExecution?.executedBy || null,
        executedAt: refreshed?.lastExecution?.executedAt || null,
        runStatus: summary.runStatus,
      };
    });
  },

  async bulkMark(params: {
    suiteId: string;
    runId: string;
    status: unknown;
    actorId: string;
    actorRole: Role;
  }) {
    const suiteId = asString(params.suiteId);
    const runId = asString(params.runId);
    if (!suiteId || !runId) fail(400, "suiteId and runId are required");
    const parsedStatus = parseInputStatus(params.status);
    if (!parsedStatus) fail(400, "Invalid status");

    return prisma.$transaction(async (tx) => {
      const { run } = await ensureSuiteAndRun(tx, suiteId, runId);
      assertRunAccess({
        actorId: params.actorId,
        actorRole: params.actorRole,
        runCreatedBy: run.createdBy,
        assignmentTesterIds: run.assignments.map((row) => row.testerId),
      });

      const syncResult = await syncSuiteRunRecords({ tx, suiteId, runId, actorId: params.actorId });
      const targetRows = await tx.testRunCase.findMany({
        where: {
          testRunId: runId,
          testCaseId: { in: syncResult.activeTestCaseIds },
          status: TestRunCaseStatus.NOT_RUN,
        },
      });

      if (parsedStatus === "NOT_EXECUTED") {
        const summaryRows = await tx.testRunCase.findMany({
          where: { testRunId: runId },
          select: { status: true },
        });
        const summary = computeRunState(summaryRows);
        await syncTestRunStatus(tx, runId, summary.runStatus);
        return {
          runId,
          suiteId,
          updated: 0,
          runStatus: summary.runStatus,
          progressPercent: summary.progressPercent,
        };
      }

      const concreteStatus = parsedStatus as Exclude<InputStatus, "NOT_EXECUTED">;
      const mappedRunCaseStatus = toRunCaseStatus(concreteStatus);
      for (const row of targetRows) {
        const execution = await tx.testExecution.create({
          data: {
            testCaseId: row.testCaseId,
            executedBy: params.actorId,
            testRunId: runId,
            result: toExecutionStatus(concreteStatus),
            notes: "Bulk mark from suite execution",
            stepResults: [] as never,
            progressPercent: 100,
            isDraft: false,
          },
        });
        await tx.testRunCase.update({
          where: { id: row.id },
          data: { status: mappedRunCaseStatus, lastExecutionId: execution.id },
        });
      }

      await writeAudit(tx, params.actorId, "BULK_MARK_SUITE_EXECUTIONS", "TestRun", runId, {
        suiteId,
        status: parsedStatus,
        updated: targetRows.length,
      });

      const summaryRows = await tx.testRunCase.findMany({
        where: { testRunId: runId, testCaseId: { in: syncResult.activeTestCaseIds } },
        select: { status: true },
      });
      const summary = computeRunState(summaryRows);
      await syncTestRunStatus(tx, runId, summary.runStatus);

      return {
        runId,
        suiteId,
        updated: targetRows.length,
        runStatus: summary.runStatus,
        progressPercent: summary.progressPercent,
      };
    });
  },

  async reset(params: {
    suiteId: string;
    runId: string;
    mode: unknown;
    actorId: string;
    actorRole: Role;
  }) {
    const suiteId = asString(params.suiteId);
    const runId = asString(params.runId);
    if (!suiteId || !runId) fail(400, "suiteId and runId are required");
    const mode = parseResetMode(params.mode);
    if (!mode) fail(400, "mode must be ALL or FAILED_ONLY");

    return prisma.$transaction(async (tx) => {
      const { run } = await ensureSuiteAndRun(tx, suiteId, runId);
      assertRunAccess({
        actorId: params.actorId,
        actorRole: params.actorRole,
        runCreatedBy: run.createdBy,
        assignmentTesterIds: run.assignments.map((row) => row.testerId),
      });

      const syncResult = await syncSuiteRunRecords({ tx, suiteId, runId, actorId: params.actorId });
      const where: Prisma.TestRunCaseWhereInput = {
        testRunId: runId,
        testCaseId: { in: syncResult.activeTestCaseIds },
      };
      if (mode === "FAILED_ONLY") {
        where.status = TestRunCaseStatus.FAILED;
      }

      const result = await tx.testRunCase.updateMany({
        where,
        data: {
          status: TestRunCaseStatus.NOT_RUN,
          lastExecutionId: null,
        },
      });

      await writeAudit(tx, params.actorId, "RESET_SUITE_EXECUTIONS", "TestRun", runId, {
        suiteId,
        mode,
        resetCount: result.count,
      });

      const summaryRows = await tx.testRunCase.findMany({
        where: { testRunId: runId, testCaseId: { in: syncResult.activeTestCaseIds } },
        select: { status: true },
      });
      const summary = computeRunState(summaryRows);
      await syncTestRunStatus(tx, runId, summary.runStatus);

      return {
        runId,
        suiteId,
        mode,
        resetCount: result.count,
        runStatus: summary.runStatus,
        progressPercent: summary.progressPercent,
      };
    });
  },

  async sync(params: {
    suiteId: string;
    runId: string;
    actorId: string;
    actorRole: Role;
  }) {
    const suiteId = asString(params.suiteId);
    const runId = asString(params.runId);
    if (!suiteId || !runId) fail(400, "suiteId and runId are required");

    return prisma.$transaction(async (tx) => {
      const { run } = await ensureSuiteAndRun(tx, suiteId, runId);
      assertRunAccess({
        actorId: params.actorId,
        actorRole: params.actorRole,
        runCreatedBy: run.createdBy,
        assignmentTesterIds: run.assignments.map((row) => row.testerId),
      });
      const syncResult = await syncSuiteRunRecords({ tx, suiteId, runId, actorId: params.actorId });
      const activeRows = await tx.testRunCase.findMany({
        where: { testRunId: runId, testCaseId: { in: syncResult.activeTestCaseIds } },
        select: { status: true },
      });
      const summary = computeRunState(activeRows);
      await syncTestRunStatus(tx, runId, summary.runStatus);
      return {
        runId,
        suiteId,
        ...syncResult,
        runStatus: summary.runStatus,
        progressPercent: summary.progressPercent,
      };
    });
  },

  async summary(params: { runId: string; actorId: string; actorRole: Role }) {
    const runId = asString(params.runId);
    if (!runId) fail(400, "runId is required");

    return prisma.$transaction(async (tx) => {
      const run = requireValue(
        await tx.testRun.findUnique({
          where: { id: runId },
          include: { assignments: { select: { testerId: true } } },
        }),
        404,
        "Test run not found"
      );

      assertRunAccess({
        actorId: params.actorId,
        actorRole: params.actorRole,
        runCreatedBy: run.createdBy,
        assignmentTesterIds: run.assignments.map((row) => row.testerId),
      });

      const rows = await tx.testRunCase.findMany({
        where: { testRunId: runId },
        select: { status: true },
      });
      const computed = computeRunState(rows);
      await syncTestRunStatus(tx, runId, computed.runStatus);

      return {
        runId,
        runStatus: computed.runStatus,
        progressPercent: computed.progressPercent,
        ...computed.counts,
      };
    });
  },
};

export { parseInputStatus };
export type { ServiceError };
