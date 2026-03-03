import { Role } from "@prisma/client";
import { Response, Router } from "express";
import prisma from "../prisma";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

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

router.use(authenticate);

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
    include: {
      creator: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { testCases: true, testSuites: true } },
    },
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
    const where =
      req.user?.role === Role.ADMIN || includeArchived
        ? undefined
        : {
            isActive: true,
          };

    const projects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
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
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (req.user?.role !== Role.ADMIN && !project.isActive) {
      return res.status(403).json({ message: "Forbidden: project is archived" });
    }
    return res.json(project);
  }
);

export default router;
