import { Response, Router } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { projectIdFromRequest, requireProjectAccess } from "../middleware/project-access.middleware";

const prismaAny = prisma as any;

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const getProjectIdFromRequest = (req: AuthRequest): string =>
  projectIdFromRequest(req) || "";

export const ensureWritableProject = async (
  req: AuthRequest,
  res: Response,
  projectId: string
): Promise<{ id: string; isActive: boolean } | null> => {
  let normalized = asString(projectId);
  if (!normalized) {
    normalized = asString(req.projectContext?.projectId);
  }
  if (!normalized && req.user?.role !== "ADMIN") {
    const firstMembership = await prismaAny.projectMember.findFirst({
      where: {
        userId: req.user?.userId,
        project: { isActive: true },
      },
      select: { projectId: true },
      orderBy: { createdAt: "asc" },
    });
    normalized = asString(firstMembership?.projectId);
  }
  if (!normalized && req.user?.role === "ADMIN") {
    const firstOwned = await prisma.project.findFirst({
      where: {
        OR: [{ ownerId: req.user.userId }, { createdBy: req.user.userId }],
        isActive: true,
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    normalized = asString(firstOwned?.id);
  }
  if (!normalized) {
    res.status(400).json({ message: "projectId is required" });
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { id: normalized },
    select: { id: true, isActive: true },
  });
  if (!project?.id) {
    res.status(400).json({ message: "Invalid projectId" });
    return null;
  }
  if (!project.isActive) {
    res.status(400).json({ message: "Cannot write into archived project" });
    return null;
  }
  if (req.user?.role !== "ADMIN") {
    if (!req.projectContext || req.projectContext.projectId !== project.id) {
      res.status(403).json({ message: "Forbidden: you do not have access to this project" });
      return null;
    }
  }
  return project;
};

export const projectGuards = {
  requireProjectFromRequest: requireProjectAccess(async (req) => {
    const requested = projectIdFromRequest(req);
    if (requested) return requested;

    if (req.user?.role === "ADMIN") return null;

    const memberships = await prismaAny.projectMember.findMany({
      where: { userId: req.user?.userId },
      select: { projectId: true, project: { select: { isActive: true } } },
      take: 2,
    });
    const activeProjectIds = memberships
      .filter((row: any) => Boolean(row?.project?.isActive))
      .map((row: any) => String(row.projectId || "").trim())
      .filter(Boolean);

    if (activeProjectIds.length === 1) {
      return activeProjectIds[0];
    }
    return null;
  }, { allowAdminWithoutProject: true }),
  requireProjectFromTestCaseId: requireProjectAccess(async (req) => {
    const testCaseId = asString(req.params.id) || asString(req.params.testCaseId) || asString(req.body.testCaseId);
    if (!testCaseId) return null;
    const row = await prisma.testCase.findUnique({ where: { id: testCaseId }, select: { projectId: true } });
    return row?.projectId || null;
  }),
  requireProjectFromTestRunId: requireProjectAccess(async (req) => {
    const runId = asString(req.params.id) || asString(req.params.testRunId) || asString(req.body.testRunId);
    if (!runId) return null;
    const row = await prisma.testRun.findUnique({ where: { id: runId }, select: { projectId: true } });
    return row?.projectId || null;
  }),
  requireProjectFromSuiteId: requireProjectAccess(async (req) => {
    const suiteId = asString(req.params.suiteId) || asString(req.body.suiteId);
    if (!suiteId) return null;
    const row = await prismaAny.testSuite.findUnique({ where: { id: suiteId }, select: { projectId: true } });
    return row?.projectId || null;
  }),
  requireProjectFromExecutionId: requireProjectAccess(async (req) => {
    const executionId = asString(req.params.executionId) || asString(req.body.executionId);
    if (!executionId) return null;
    const row = await prisma.testExecution.findUnique({ where: { id: executionId }, select: { projectId: true } });
    return row?.projectId || null;
  }),
  requireProjectFromBugId: requireProjectAccess(async (req) => {
    const issueId = asString(req.params.id);
    if (!issueId) return null;
    const row = await prismaAny.issue.findUnique({ where: { id: issueId }, select: { projectId: true } });
    return row?.projectId || null;
  }),
  requireProjectFromBugCommentId: requireProjectAccess(async (req) => {
    const commentId = asString(req.params.commentId);
    if (!commentId) return null;
    const row = await prismaAny.issueComment.findUnique({
      where: { id: commentId },
      select: { issue: { select: { projectId: true } } },
    });
    return row?.issue?.projectId || null;
  }),
  requireProjectFromMilestoneId: requireProjectAccess(async (req) => {
    const milestoneId = asString(req.params.milestoneId) || asString(req.body.milestoneId);
    if (!milestoneId) return null;
    const row = await prismaAny.projectMilestone.findUnique({
      where: { id: milestoneId },
      select: { projectId: true },
    });
    return row?.projectId || null;
  }),
  requireProjectFromSuiteExecutionId: requireProjectAccess(async (req) => {
    const suiteExecutionId = asString(req.params.id);
    if (!suiteExecutionId) return null;
    const row = await prismaAny.testSuiteExecution.findUnique({
      where: { id: suiteExecutionId },
      select: { suite: { select: { projectId: true } } },
    });
    return row?.suite?.projectId || null;
  }),
};

export const applyProjectScopeMiddleware = (router: Router): void => {
  router.use("/testcases/:id", projectGuards.requireProjectFromTestCaseId);
  router.use("/test-runs/:id", projectGuards.requireProjectFromTestRunId);
  router.use("/executions/testcases/:id", projectGuards.requireProjectFromTestCaseId);
  router.use("/executions/:executionId", projectGuards.requireProjectFromExecutionId);
  router.use("/suites/:suiteId", projectGuards.requireProjectFromSuiteId);
  router.use("/suite-executions/:id", projectGuards.requireProjectFromSuiteExecutionId);
  router.use("/reports/milestones/progress", projectGuards.requireProjectFromMilestoneId);
  router.use("/bugs/:id", projectGuards.requireProjectFromBugId);
  router.use("/bugs/comments/:commentId", projectGuards.requireProjectFromBugCommentId);
  router.use("/issues/:id", projectGuards.requireProjectFromBugId);
  router.use("/developer/bugs/:id", projectGuards.requireProjectFromBugId);
};
