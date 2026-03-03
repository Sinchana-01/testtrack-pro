import { Role } from "@prisma/client";
import { Response, Router } from "express";
import prisma from "../prisma";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();
const prismaAny = prisma as any;

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const asJson = (value: unknown, fallback: unknown) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};
const PROJECT_ROLES = ["ADMIN", "TESTER", "DEVELOPER"] as const;
type ProjectRoleValue = (typeof PROJECT_ROLES)[number];
const MILESTONE_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "MISSED"] as const;
type MilestoneStatusValue = (typeof MILESTONE_STATUSES)[number];

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

const hasProjectAccess = async (userId: string, role: Role, projectId: string) => {
  if (role === Role.ADMIN) return true;
  const membership = await prismaAny.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true },
  });
  return Boolean(membership?.id);
};

const isProjectOwnerOrAdmin = async (req: AuthRequest, projectId: string) => {
  if (req.user?.role === Role.ADMIN) return true;
  const project = await prismaAny.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, createdBy: true },
  });
  if (!project) return false;
  return project.ownerId === req.user?.userId || project.createdBy === req.user?.userId;
};

const ensureReadableProject = async (req: AuthRequest, res: Response, projectId: string) => {
  const project = await prismaAny.project.findUnique({
    where: { id: projectId },
    select: { id: true, isActive: true },
  });
  if (!project?.id) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  const allowed = await hasProjectAccess(req.user!.userId, req.user!.role as Role, projectId);
  if (!allowed) {
    res.status(403).json({ message: "Forbidden: you do not have access to this project" });
    return null;
  }
  return project;
};

router.use(authenticate);

router.post("/admin/projects", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const name = asString(req.body.name);
  const code = asString(req.body.code) || null;
  const ownerId = asString(req.body.ownerId) || req.user!.userId;
  if (!name) {
    return res.status(400).json({ message: "Project name is required" });
  }

  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, isActive: true } });
  if (!owner?.id || !owner.isActive) {
    return res.status(400).json({ message: "ownerId must be an active user" });
  }

  const project = await prismaAny.project.create({
    data: {
      name,
      code,
      description: asString(req.body.description) || null,
      createdBy: req.user!.userId,
      ownerId,
      members: {
        create: [
          {
            userId: ownerId,
            roleInProject: "ADMIN",
          },
        ],
      },
    },
  });

  await writeAuditLog(req.user!.userId, "ADMIN_CREATE_PROJECT", "Project", project.id, { name: project.name });
  return res.status(201).json(project);
});

router.get("/admin/projects", authorizeRoles(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  const projects = await prismaAny.project.findMany({
    include: {
      creator: { select: { id: true, name: true, email: true, role: true } },
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { testCases: true, testSuites: true, members: true, milestones: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return res.json(projects);
});

router.patch("/admin/projects/:id", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const ownerId = req.body.ownerId !== undefined ? asString(req.body.ownerId) || null : undefined;
  if (ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, isActive: true } });
    if (!owner?.id || !owner.isActive) {
      return res.status(400).json({ message: "ownerId must be an active user" });
    }
  }
  const project = await prismaAny.project.update({
    where: { id: req.params.id },
    data: {
      name: asString(req.body.name) || undefined,
      code: req.body.code !== undefined ? asString(req.body.code) || null : undefined,
      description: asString(req.body.description) || undefined,
      isActive: typeof req.body.isActive === "boolean" ? req.body.isActive : undefined,
      ownerId,
    },
  });
  await writeAuditLog(req.user!.userId, "ADMIN_UPDATE_PROJECT", "Project", project.id);
  return res.json(project);
});

router.post("/admin/projects/:id/archive", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  await writeAuditLog(req.user!.userId, "ADMIN_ARCHIVE_PROJECT", "Project", project.id);
  return res.json(project);
});

router.post("/admin/projects/:id/restore", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: { isActive: true },
  });
  await writeAuditLog(req.user!.userId, "ADMIN_RESTORE_PROJECT", "Project", project.id);
  return res.json(project);
});

router.delete("/admin/projects/:id", authorizeRoles(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }
  await prisma.project.delete({ where: { id: req.params.id } });
  await writeAuditLog(req.user!.userId, "ADMIN_DELETE_PROJECT", "Project", req.params.id, { name: project.name });
  return res.status(204).send();
});

router.get(
  "/projects",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const includeArchived = String(req.query.includeArchived || "").trim() === "true";
    const where: any = {};
    if (!includeArchived) {
      where.isActive = true;
    }
    if (req.user?.role !== Role.ADMIN) {
      where.members = { some: { userId: req.user!.userId } };
    }

    const projects = await prismaAny.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        ownerId: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, milestones: true, testCases: true, testRuns: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return res.json(projects);
  }
);

router.get(
  "/projects/:id",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const project = await prismaAny.project.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        ownerId: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, milestones: true, testCases: true, testRuns: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const allowed = await hasProjectAccess(req.user!.userId, req.user!.role as Role, project.id);
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden: you do not have access to this project" });
    }
    if (req.user?.role !== Role.ADMIN && !project.isActive) {
      return res.status(403).json({ message: "Forbidden: project is archived" });
    }
    return res.json(project);
  }
);

router.get(
  "/projects/:id/members",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const project = await ensureReadableProject(req, res, req.params.id);
    if (!project) return;

    const members = await prismaAny.projectMember.findMany({
      where: { projectId: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json(members);
  }
);

router.post(
  "/projects/:id/members",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const canManage = await isProjectOwnerOrAdmin(req, req.params.id);
    if (!canManage) {
      return res.status(403).json({ message: "Only project owner or admin can add members" });
    }
    const userId = asString(req.body.userId);
    const roleInProject = asString(req.body.roleInProject).toUpperCase() as ProjectRoleValue;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (!PROJECT_ROLES.includes(roleInProject)) {
      return res.status(400).json({ message: "roleInProject must be ADMIN, TESTER, or DEVELOPER" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
    if (!user?.id || !user.isActive) {
      return res.status(400).json({ message: "User must be active" });
    }
    if (user.role !== roleInProject) {
      return res.status(400).json({ message: `User role mismatch: expected ${roleInProject}` });
    }

    const member = await prismaAny.projectMember.upsert({
      where: {
        projectId_userId: { projectId: req.params.id, userId },
      },
      create: { projectId: req.params.id, userId, roleInProject },
      update: { roleInProject },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    await writeAuditLog(req.user!.userId, "PROJECT_MEMBER_UPSERT", "ProjectMember", member.id, {
      projectId: req.params.id,
      userId,
      roleInProject,
    });
    return res.status(201).json(member);
  }
);

router.patch(
  "/projects/:id/members/:memberId",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const canManage = await isProjectOwnerOrAdmin(req, req.params.id);
    if (!canManage) {
      return res.status(403).json({ message: "Only project owner or admin can update members" });
    }
    const roleInProject = asString(req.body.roleInProject).toUpperCase() as ProjectRoleValue;
    if (!PROJECT_ROLES.includes(roleInProject)) {
      return res.status(400).json({ message: "roleInProject must be ADMIN, TESTER, or DEVELOPER" });
    }
    const member = await prismaAny.projectMember.findUnique({
      where: { id: req.params.memberId },
    });
    if (!member || member.projectId !== req.params.id) {
      return res.status(404).json({ message: "Project member not found" });
    }

    const updated = await prismaAny.projectMember.update({
      where: { id: req.params.memberId },
      data: { roleInProject },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    await writeAuditLog(req.user!.userId, "PROJECT_MEMBER_UPDATE", "ProjectMember", updated.id, { roleInProject });
    return res.json(updated);
  }
);

router.delete(
  "/projects/:id/members/:memberId",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const canManage = await isProjectOwnerOrAdmin(req, req.params.id);
    if (!canManage) {
      return res.status(403).json({ message: "Only project owner or admin can remove members" });
    }
    const member = await prismaAny.projectMember.findUnique({
      where: { id: req.params.memberId },
    });
    if (!member || member.projectId !== req.params.id) {
      return res.status(404).json({ message: "Project member not found" });
    }

    await prismaAny.projectMember.delete({ where: { id: req.params.memberId } });
    await writeAuditLog(req.user!.userId, "PROJECT_MEMBER_DELETE", "ProjectMember", req.params.memberId);
    return res.status(204).send();
  }
);

router.get(
  "/projects/:id/configuration",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const project = await ensureReadableProject(req, res, req.params.id);
    if (!project) return;

    const config = await prismaAny.projectConfig.findUnique({
      where: { projectId: req.params.id },
    });
    return res.json(
      config || {
        projectId: req.params.id,
        customFields: [],
        modules: [],
        workflowConfig: {},
        environments: [],
      }
    );
  }
);

router.put(
  "/projects/:id/configuration",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const canManage = await isProjectOwnerOrAdmin(req, req.params.id);
    if (!canManage) {
      return res.status(403).json({ message: "Only project owner or admin can update configuration" });
    }
    const customFields = asJson(req.body.customFields, []);
    const modules = asJson(req.body.modules, []);
    const workflowConfig = asJson(req.body.workflowConfig, {});
    const environments = asJson(req.body.environments, []);

    const saved = await prismaAny.projectConfig.upsert({
      where: { projectId: req.params.id },
      create: {
        projectId: req.params.id,
        customFields,
        modules,
        workflowConfig,
        environments,
        updatedBy: req.user!.userId,
      },
      update: {
        customFields,
        modules,
        workflowConfig,
        environments,
        updatedBy: req.user!.userId,
      },
    });
    await writeAuditLog(req.user!.userId, "PROJECT_CONFIG_UPSERT", "ProjectConfig", saved.id, {
      projectId: req.params.id,
    });
    return res.json(saved);
  }
);

router.get(
  "/projects/:id/milestones",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const project = await ensureReadableProject(req, res, req.params.id);
    if (!project) return;

    const milestones = await prismaAny.projectMilestone.findMany({
      where: { projectId: req.params.id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        testRuns: { select: { id: true, name: true, status: true, projectId: true, milestoneId: true } },
      },
      orderBy: [{ targetDate: "asc" }, { createdAt: "desc" }],
    });
    return res.json(milestones);
  }
);

router.post(
  "/projects/:id/milestones",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const canManage = await isProjectOwnerOrAdmin(req, req.params.id);
    if (!canManage) {
      return res.status(403).json({ message: "Only project owner or admin can create milestones" });
    }
    const name = asString(req.body.name);
    const targetDate = asString(req.body.targetDate);
    const status = (asString(req.body.status).toUpperCase() || "PLANNED") as MilestoneStatusValue;
    if (!name || !targetDate) {
      return res.status(400).json({ message: "name and targetDate are required" });
    }
    if (!MILESTONE_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid milestone status" });
    }
    const parsedTargetDate = new Date(targetDate);
    if (Number.isNaN(parsedTargetDate.getTime())) {
      return res.status(400).json({ message: "targetDate is invalid" });
    }

    const milestone = await prismaAny.projectMilestone.create({
      data: {
        projectId: req.params.id,
        name,
        description: asString(req.body.description) || null,
        targetDate: parsedTargetDate,
        status,
        targetPassRate: typeof req.body.targetPassRate === "number" ? req.body.targetPassRate : null,
        targetBugClosure: typeof req.body.targetBugClosure === "number" ? req.body.targetBugClosure : null,
        createdBy: req.user!.userId,
      },
    });
    await writeAuditLog(req.user!.userId, "PROJECT_MILESTONE_CREATE", "ProjectMilestone", milestone.id);
    return res.status(201).json(milestone);
  }
);

router.patch(
  "/projects/:id/milestones/:milestoneId",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const canManage = await isProjectOwnerOrAdmin(req, req.params.id);
    if (!canManage) {
      return res.status(403).json({ message: "Only project owner or admin can update milestones" });
    }
    const statusInput = asString(req.body.status).toUpperCase();
    if (statusInput && !MILESTONE_STATUSES.includes(statusInput as MilestoneStatusValue)) {
      return res.status(400).json({ message: "Invalid milestone status" });
    }
    const targetDateRaw = req.body.targetDate !== undefined ? asString(req.body.targetDate) : "";
    const targetDate =
      req.body.targetDate !== undefined && targetDateRaw
        ? new Date(targetDateRaw)
        : undefined;
    if (targetDate && Number.isNaN(targetDate.getTime())) {
      return res.status(400).json({ message: "targetDate is invalid" });
    }

    const existing = await prismaAny.projectMilestone.findUnique({
      where: { id: req.params.milestoneId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== req.params.id) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const updated = await prismaAny.projectMilestone.update({
      where: { id: req.params.milestoneId },
      data: {
        name: asString(req.body.name) || undefined,
        description: req.body.description !== undefined ? asString(req.body.description) || null : undefined,
        targetDate,
        status: statusInput ? (statusInput as MilestoneStatusValue) : undefined,
        targetPassRate: req.body.targetPassRate !== undefined ? Number(req.body.targetPassRate) : undefined,
        targetBugClosure: req.body.targetBugClosure !== undefined ? Number(req.body.targetBugClosure) : undefined,
      },
    });
    await writeAuditLog(req.user!.userId, "PROJECT_MILESTONE_UPDATE", "ProjectMilestone", updated.id);
    return res.json(updated);
  }
);

router.delete(
  "/projects/:id/milestones/:milestoneId",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const canManage = await isProjectOwnerOrAdmin(req, req.params.id);
    if (!canManage) {
      return res.status(403).json({ message: "Only project owner or admin can delete milestones" });
    }
    const existing = await prismaAny.projectMilestone.findUnique({
      where: { id: req.params.milestoneId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== req.params.id) {
      return res.status(404).json({ message: "Milestone not found" });
    }
    await prismaAny.projectMilestone.delete({ where: { id: req.params.milestoneId } });
    await writeAuditLog(req.user!.userId, "PROJECT_MILESTONE_DELETE", "ProjectMilestone", req.params.milestoneId);
    return res.status(204).send();
  }
);

router.post(
  "/projects/:id/milestones/:milestoneId/link-test-run",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const canManage = await isProjectOwnerOrAdmin(req, req.params.id);
    if (!canManage) {
      return res.status(403).json({ message: "Only project owner or admin can link test runs" });
    }
    const testRunId = asString(req.body.testRunId);
    if (!testRunId) {
      return res.status(400).json({ message: "testRunId is required" });
    }
    const milestone = await prismaAny.projectMilestone.findUnique({
      where: { id: req.params.milestoneId },
      select: { id: true, projectId: true },
    });
    if (!milestone || milestone.projectId !== req.params.id) {
      return res.status(404).json({ message: "Milestone not found" });
    }
    const run = await prismaAny.testRun.findUnique({
      where: { id: testRunId },
      select: { id: true, projectId: true },
    });
    if (!run?.id) {
      return res.status(404).json({ message: "Test run not found" });
    }
    if (run.projectId && run.projectId !== req.params.id) {
      return res.status(400).json({ message: "Test run belongs to a different project" });
    }

    const updatedRun = await prismaAny.testRun.update({
      where: { id: run.id },
      data: { projectId: req.params.id, milestoneId: milestone.id },
    });
    await writeAuditLog(req.user!.userId, "PROJECT_MILESTONE_LINK_TEST_RUN", "TestRun", updatedRun.id, {
      milestoneId: milestone.id,
    });
    return res.json(updatedRun);
  }
);

router.get(
  "/projects/:id/milestones/:milestoneId/progress",
  authorizeRoles(Role.TESTER, Role.DEVELOPER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const project = await ensureReadableProject(req, res, req.params.id);
    if (!project) return;
    const milestone = await prismaAny.projectMilestone.findUnique({
      where: { id: req.params.milestoneId },
      select: { id: true, projectId: true, targetPassRate: true, targetBugClosure: true, name: true, targetDate: true, status: true },
    });
    if (!milestone || milestone.projectId !== req.params.id) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const runs = await prismaAny.testRun.findMany({
      where: { milestoneId: milestone.id, projectId: req.params.id },
      select: { id: true, name: true, status: true },
    });
    const runIds = runs.map((r: any) => r.id);
    const [cases, bugs] = await Promise.all([
      runIds.length
        ? prisma.testRunCase.findMany({
            where: { testRunId: { in: runIds } },
            select: { status: true },
          })
        : [],
      prismaAny.issue.findMany({
        where: { testCase: { is: { projectId: req.params.id } } },
        select: { workflowStatus: true, status: true },
      }),
    ]);

    const totalCases = cases.length;
    const passedCases = cases.filter((c: any) => c.status === "PASSED").length;
    const passRate = totalCases > 0 ? Number(((passedCases / totalCases) * 100).toFixed(1)) : 0;

    const closedStatuses = new Set(["FIXED", "VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"]);
    const totalBugs = bugs.length;
    const closedBugs = bugs.filter((b: any) => closedStatuses.has(String(b.workflowStatus || b.status || "").toUpperCase())).length;
    const bugClosureRate = totalBugs > 0 ? Number(((closedBugs / totalBugs) * 100).toFixed(1)) : 0;

    return res.json({
      milestone: {
        id: milestone.id,
        name: milestone.name,
        status: milestone.status,
        targetDate: milestone.targetDate,
        targetPassRate: milestone.targetPassRate,
        targetBugClosure: milestone.targetBugClosure,
      },
      linkedTestRuns: runs,
      metrics: {
        totalCases,
        passedCases,
        passRate,
        totalBugs,
        closedBugs,
        bugClosureRate,
      },
    });
  }
);

export default router;
