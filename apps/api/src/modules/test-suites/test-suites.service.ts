import { Prisma, Role, SuiteType } from "@prisma/client";
import prisma from "../../prisma";

type ServiceError = Error & { statusCode?: number };

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const fail = (statusCode: number, message: string): never => {
  const err = new Error(message) as ServiceError;
  err.statusCode = statusCode;
  throw err;
};

const requireValue = <T>(value: T | null | undefined, statusCode: number, message: string): NonNullable<T> => {
  if (value === null || value === undefined) {
    fail(statusCode, message);
  }
  return value as NonNullable<T>;
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

const resolveTestCaseRefs = async (
  tx: Prisma.TransactionClient,
  refs: string[]
): Promise<{ resolvedIds: string[]; unresolved: string[] }> => {
  const cleaned = [...new Set(refs.map((item) => asString(item)).filter(Boolean))];
  if (!cleaned.length) return { resolvedIds: [], unresolved: [] };

  const rows = await tx.testCase.findMany({
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

const ensureStaticActiveSuite = async (
  tx: Prisma.TransactionClient,
  suiteId: string
): Promise<{ id: string; type: SuiteType; isArchived: boolean }> => {
  const suite = requireValue(
    await tx.testSuite.findUnique({
      where: { id: suiteId },
      select: { id: true, type: true, isArchived: true },
    }),
    404,
    "Suite not found"
  );
  if (suite.type !== SuiteType.STATIC) fail(400, "Operation allowed only for STATIC suite");
  if (suite.isArchived) fail(400, "Cannot modify archived suite");
  return suite;
};

export const testSuitesService = {
  async addTestCases(input: { suiteId: string; refs: string[]; actorRole: Role; actorId: string }) {
    const suiteId = asString(input.suiteId);
    const refs = Array.isArray(input.refs) ? input.refs : [];
    if (!suiteId) fail(400, "Suite id is required");
    if (!refs.length) fail(400, "testCaseIds are required");

    return prisma.$transaction(async (tx) => {
      await ensureStaticActiveSuite(tx, suiteId);

      const resolved = await resolveTestCaseRefs(tx, refs);
      if (resolved.unresolved.length > 0) {
        fail(400, `One or more testCaseIds are invalid/deleted: ${resolved.unresolved.join(", ")}`);
      }

      const existingLinks = await tx.testSuiteCase.findMany({
        where: { suiteId },
        select: { testCaseId: true },
      });
      const existingSet = new Set(existingLinks.map((row) => row.testCaseId));
      const toAdd = resolved.resolvedIds.filter((id) => !existingSet.has(id));

      const maxPosRow = await tx.testSuiteCase.findFirst({
        where: { suiteId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      let position = Number(maxPosRow?.position || 0);

      if (toAdd.length > 0) {
        await tx.testSuiteCase.createMany({
          data: toAdd.map((testCaseId) => ({
            suiteId,
            testCaseId,
            position: ++position,
          })),
        });
      }

      await writeAudit(tx, input.actorId, "SUITE_ADD_TEST_CASES_V2", "TestSuite", suiteId, {
        added: toAdd.length,
        skippedDuplicates: resolved.resolvedIds.length - toAdd.length,
      });

      const count = await tx.testSuiteCase.count({ where: { suiteId } });
      return {
        suiteId,
        added: toAdd.length,
        skippedDuplicates: resolved.resolvedIds.length - toAdd.length,
        totalCases: count,
      };
    });
  },

  async removeTestCase(input: { suiteId: string; testCaseRef: string; actorId: string }) {
    const suiteId = asString(input.suiteId);
    const testCaseRef = asString(input.testCaseRef);
    if (!suiteId || !testCaseRef) fail(400, "suiteId and testCaseId are required");

    return prisma.$transaction(async (tx) => {
      await ensureStaticActiveSuite(tx, suiteId);

      const resolved = await resolveTestCaseRefs(tx, [testCaseRef]);
      if (!resolved.resolvedIds.length) fail(404, "Test case not found");
      const testCaseId = resolved.resolvedIds[0];

      const link = requireValue(
        await tx.testSuiteCase.findUnique({
          where: { suiteId_testCaseId: { suiteId, testCaseId } },
          select: { id: true },
        }),
        404,
        "Suite test case link not found"
      );

      await tx.testSuiteCase.delete({ where: { id: link.id } });

      const remaining = await tx.testSuiteCase.findMany({
        where: { suiteId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      await Promise.all(
        remaining.map((row, idx) =>
          tx.testSuiteCase.update({
            where: { id: row.id },
            data: { position: idx + 1 },
          })
        )
      );

      await writeAudit(tx, input.actorId, "SUITE_REMOVE_TEST_CASE_V2", "TestSuite", suiteId, {
        removedTestCaseId: testCaseId,
      });

      return { suiteId, removedTestCaseId: testCaseId, totalCases: remaining.length };
    });
  },

  async reorderTestCases(input: { suiteId: string; refs: string[]; actorId: string }) {
    const suiteId = asString(input.suiteId);
    const refs = Array.isArray(input.refs) ? input.refs : [];
    if (!suiteId) fail(400, "suiteId is required");
    if (!refs.length) fail(400, "testCaseIds are required");

    const normalized = refs.map((r) => asString(r)).filter(Boolean);
    if (new Set(normalized).size !== normalized.length) {
      fail(400, "testCaseIds must not contain duplicates");
    }

    return prisma.$transaction(async (tx) => {
      await ensureStaticActiveSuite(tx, suiteId);

      const resolved = await resolveTestCaseRefs(tx, normalized);
      if (resolved.unresolved.length > 0) {
        fail(400, `One or more testCaseIds are invalid/deleted: ${resolved.unresolved.join(", ")}`);
      }

      const links = await tx.testSuiteCase.findMany({
        where: { suiteId },
        select: { testCaseId: true },
      });
      const existing = links.map((l) => l.testCaseId).sort();
      const incoming = [...resolved.resolvedIds].sort();
      if (existing.length !== incoming.length || existing.some((id, idx) => id !== incoming[idx])) {
        fail(400, "testCaseIds must exactly match current suite membership");
      }

      await Promise.all(
        resolved.resolvedIds.map((testCaseId, idx) =>
          tx.testSuiteCase.update({
            where: { suiteId_testCaseId: { suiteId, testCaseId } },
            data: { position: idx + 1 },
          })
        )
      );
      await writeAudit(tx, input.actorId, "SUITE_REORDER_TEST_CASES_V2", "TestSuite", suiteId, {
        orderedTestCaseIds: resolved.resolvedIds,
      });
      return { suiteId, orderedTestCaseIds: resolved.resolvedIds };
    });
  },

  async cloneSuite(input: { suiteId: string; actorId: string }) {
    const suiteId = asString(input.suiteId);
    const actorId = asString(input.actorId);
    if (!suiteId || !actorId) fail(400, "suiteId and actorId are required");

    return prisma.$transaction(async (tx) => {
      const source = requireValue(
        await tx.testSuite.findUnique({
          where: { id: suiteId },
          include: { suiteCases: { orderBy: { position: "asc" } } },
        }),
        404,
        "Suite not found"
      );

      const created = await tx.testSuite.create({
        data: {
          name: `${source.name} (Copy)`,
          description: source.description,
          module: source.module,
          type: source.type,
          filterJson:
            source.type === SuiteType.DYNAMIC
              ? ((source.filterJson ?? Prisma.JsonNull) as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          createdBy: actorId,
          projectId: source.projectId,
          parentSuiteId: source.parentSuiteId,
          isArchived: false,
        },
      });

      if (source.type === SuiteType.STATIC && source.suiteCases.length > 0) {
        await tx.testSuiteCase.createMany({
          data: source.suiteCases.map((row, idx) => ({
            suiteId: created.id,
            testCaseId: row.testCaseId,
            position: idx + 1,
            addedBy: actorId,
          })),
        });
      }

      await writeAudit(tx, input.actorId, "SUITE_CLONE_V2", "TestSuite", created.id, {
        sourceSuiteId: source.id,
        type: source.type,
      });

      return created;
    });
  },

  async archiveSuite(input: { suiteId: string; actorId: string }) {
    const suiteId = asString(input.suiteId);
    if (!suiteId) fail(400, "suiteId is required");
    const suite = requireValue(await prisma.testSuite.findUnique({ where: { id: suiteId } }), 404, "Suite not found");
    if (suite.isArchived) fail(400, "Suite is already archived");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.testSuite.update({ where: { id: suiteId }, data: { isArchived: true } });
      await writeAudit(tx, input.actorId, "SUITE_ARCHIVE_V2", "TestSuite", suiteId);
      return updated;
    });
  },

  async restoreSuite(input: { suiteId: string; actorId: string }) {
    const suiteId = asString(input.suiteId);
    if (!suiteId) fail(400, "suiteId is required");
    const suite = requireValue(await prisma.testSuite.findUnique({ where: { id: suiteId } }), 404, "Suite not found");
    if (!suite.isArchived) fail(400, "Suite is already active");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.testSuite.update({ where: { id: suiteId }, data: { isArchived: false } });
      await writeAudit(tx, input.actorId, "SUITE_RESTORE_V2", "TestSuite", suiteId);
      return updated;
    });
  },
};

export type { ServiceError };
