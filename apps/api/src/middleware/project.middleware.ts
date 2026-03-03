import { NextFunction, Response } from "express";
import { Role } from "@prisma/client";
import prisma from "../prisma";
import { AuthRequest } from "./auth.middleware";
const prismaAny = prisma as any;

export const getRequestedProjectId = (req: AuthRequest): string => {
  const headerProjectId = String(req.headers["x-project-id"] || "").trim();
  const paramsProjectId = String((req.params as any)?.projectId || "").trim();
  const queryProjectId = String((req.query as any)?.projectId || "").trim();
  const bodyProjectId = String((req.body as any)?.projectId || "").trim();
  return headerProjectId || paramsProjectId || queryProjectId || bodyProjectId;
};

const canAccessProject = async (userId: string, role: Role, projectId: string): Promise<boolean> => {
  if (!projectId) return false;
  if (role === Role.ADMIN) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    return Boolean(project?.id);
  }
  const membership = await (prisma as any).projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true },
  });
  return Boolean(membership?.id);
};

export const requireProjectAccess = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const projectId = getRequestedProjectId(req);
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }
      const allowed = await canAccessProject(req.user.userId, req.user.role as Role, projectId);
      if (!allowed) {
        return res.status(403).json({ message: "Forbidden: You do not have access to this project" });
      }
      (req as any).projectId = projectId;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Failed to validate project access" });
    }
  };
};

export const requireProjectOwnerOrAdmin = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const projectId = getRequestedProjectId(req);
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }
      if (req.user.role === Role.ADMIN) {
        (req as any).projectId = projectId;
        return next();
      }
      const project = await prismaAny.project.findUnique({
        where: { id: projectId },
        select: { id: true, ownerId: true },
      });
      if (!project?.id) {
        return res.status(404).json({ message: "Project not found" });
      }
      if (project.ownerId !== req.user.userId) {
        return res.status(403).json({ message: "Only project owner or admin can modify this configuration" });
      }
      (req as any).projectId = projectId;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Failed to validate owner access" });
    }
  };
};
