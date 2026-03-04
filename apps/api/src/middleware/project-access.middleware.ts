import { NextFunction, Response } from "express";
import { Role } from "@prisma/client";
import prisma from "../prisma";
import { AuthRequest } from "./auth.middleware";

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

type ProjectResolver = (req: AuthRequest) => Promise<string | null> | string | null;

type RequireProjectAccessOptions = {
  allowAdminWithoutProject?: boolean;
};

const isWriteMethod = (method: string): boolean => {
  const normalized = String(method || "").toUpperCase();
  return normalized === "POST" || normalized === "PUT" || normalized === "PATCH" || normalized === "DELETE";
};

const attachProjectContext = (req: AuthRequest, project: { id: string; isActive?: boolean | null }) => {
  const active = Boolean(project.isActive);
  req.projectContext = {
    projectId: project.id,
    isArchived: !active,
  };
};

const resolveProjectAndAuthorize = async (
  req: AuthRequest,
  res: Response,
  projectId: string,
  options?: RequireProjectAccessOptions
): Promise<boolean> => {
  let normalizedProjectId = asString(projectId);
  if (!normalizedProjectId) {
    if (req.user?.role === Role.ADMIN) {
      const firstOwned = await (prisma as any).project.findFirst({
        where: {
          OR: [{ ownerId: req.user.userId }, { createdBy: req.user.userId }],
          isActive: true,
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      normalizedProjectId = asString(firstOwned?.id);
    } else {
      const membership = await (prisma as any).projectMember.findFirst({
        where: {
          userId: req.user?.userId,
          project: { isActive: true },
        },
        select: { projectId: true },
        orderBy: { createdAt: "asc" },
      });
      normalizedProjectId = asString(membership?.projectId);
    }
  }

  if (!normalizedProjectId) {
    if (req.user?.role === Role.ADMIN && options?.allowAdminWithoutProject) {
      return true;
    }
    res.status(400).json({ message: "projectId is required" });
    return false;
  }

  const project = await (prisma as any).project.findUnique({
    where: { id: normalizedProjectId },
    select: { id: true, isActive: true },
  });
  if (!project?.id) {
    res.status(404).json({ message: "Project not found" });
    return false;
  }

  if (isWriteMethod(req.method) && !project.isActive) {
    res.status(403).json({ message: "Forbidden: archived projects are read-only" });
    return false;
  }

  if (req.user?.role !== Role.ADMIN) {
    const membership = await (prisma as any).projectMember.findFirst({
      where: {
        projectId: project.id,
        userId: req.user?.userId,
      },
      select: { id: true },
    });
    if (!membership?.id) {
      res.status(403).json({ message: "Forbidden: you do not have access to this project" });
      return false;
    }
  }

  attachProjectContext(req, project);
  return true;
};

export const requireProjectAccess = (
  resolver: ProjectResolver,
  options?: RequireProjectAccessOptions
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const resolved = await resolver(req);
    const ok = await resolveProjectAndAuthorize(req, res, asString(resolved), options);
    if (!ok) return;
    next();
  };
};

export const projectIdFromRequest = (
  req: AuthRequest,
  keys: { param?: string; body?: string; query?: string; header?: string } = {}
): string | null => {
  const paramKey = keys.param || "projectId";
  const bodyKey = keys.body || "projectId";
  const queryKey = keys.query || "projectId";
  const headerKey = keys.header || "x-project-id";

  const fromParam = asString((req.params as Record<string, unknown>)?.[paramKey]);
  const fromBody = asString((req.body as Record<string, unknown>)?.[bodyKey]);
  const fromQuery = asString((req.query as Record<string, unknown>)?.[queryKey]);
  const fromHeader = asString(req.headers[headerKey]);
  return fromParam || fromBody || fromQuery || fromHeader || null;
};

export const projectIdFromEntity = (
  resolver: (req: AuthRequest) => Promise<string | null>
): ProjectResolver => resolver;
