import { Response, NextFunction } from "express";
import prisma from "../prisma";
import { AuthRequest } from "./auth.middleware";

type RolePermissionMap = Record<string, string[]>;

const DEFAULT_ROLE_PERMISSIONS: RolePermissionMap = {
  ADMIN: [
    "Manage Users",
    "Manage Projects",
    "Manage Roles",
    "View Audit Logs",
    "Backup Management",
    "Reports",
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

const MANDATORY_ROLE_PERMISSIONS: RolePermissionMap = {
  ADMIN: [
    "Manage Users",
    "Manage Projects",
    "Manage Roles",
    "View Audit Logs",
    "Backup Management",
    "Reports",
    "All Bugs",
  ],
  TESTER: ["Reports"],
  DEVELOPER: ["Reports"],
};

let cachedPermissions: RolePermissionMap | null = null;
let permissionsFetchedAt = 0;
const PERMISSION_CACHE_TTL_MS = 30_000;

const normalizePath = (req: AuthRequest): string => {
  const base = `${req.baseUrl || ""}${req.path || ""}`.toLowerCase();
  const noApiPrefix = base.startsWith("/api") ? base.slice(4) : base;
  return noApiPrefix || "/";
};

const resolveRequiredPermission = (req: AuthRequest): string | null => {
  const method = req.method.toUpperCase();
  const path = normalizePath(req);

  if (path.startsWith("/admin/users")) return "Manage Users";
  if (path.startsWith("/admin/roles")) return "Manage Roles";
  if (path.startsWith("/admin/projects")) return "Manage Projects";
  if (path.startsWith("/admin/audit-logs")) return "View Audit Logs";
  if (path.startsWith("/admin/backups")) return "Backup Management";
  if (path.startsWith("/admin/system-config")) {
    const key = typeof req.body?.key === "string" ? req.body.key.trim().toUpperCase() : "";
    return key === "ROLE_PERMISSIONS" ? "Manage Roles" : null;
  }

  if (path.startsWith("/testcases") || path.startsWith("/testcase-templates")) {
    return "Create Test Cases";
  }
  if (path.startsWith("/executions") || path.startsWith("/suite-executions")) {
    return "Execute Tests";
  }
  if (path.startsWith("/reports")) {
    return "Reports";
  }
  if (path.startsWith("/issues/from-executions")) {
    return "Bug Management";
  }
  if (path.startsWith("/bugs") || path.startsWith("/issues") || path.startsWith("/notifications/bugs")) {
    if (path.startsWith("/developer/bugs")) return "My Assigned Bugs";
    if (req.user?.role === "TESTER") return "Bug Management";
    if (req.user?.role === "DEVELOPER") {
      const scope = typeof req.query?.scope === "string" ? req.query.scope.trim().toLowerCase() : "";
      if (method === "GET" && scope === "all") return "All Bugs";
      return "My Assigned Bugs";
    }
    if (method === "GET") return "All Bugs";
    return "My Assigned Bugs";
  }
  if (path.startsWith("/developer/reports") || path.startsWith("/developer/issues/assigned")) {
    return "Test Reports";
  }
  if (path.startsWith("/developer/dashboard")) {
    return "Performance Report";
  }
  if (path.includes("/link-commit") || path.startsWith("/developer/issues")) {
    return "Linked Commits";
  }

  return null;
};

const sanitizeRolePermissions = (raw: unknown): RolePermissionMap => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_ROLE_PERMISSIONS;
  const input = raw as Record<string, unknown>;
  const output: RolePermissionMap = { ...DEFAULT_ROLE_PERMISSIONS };
  Object.keys(DEFAULT_ROLE_PERMISSIONS).forEach((role) => {
    const list = input[role];
    if (Array.isArray(list)) {
      output[role] = list
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
    const mandatory = MANDATORY_ROLE_PERMISSIONS[role] || [];
    mandatory.forEach((permission) => {
      if (!output[role].includes(permission)) {
        output[role].push(permission);
      }
    });
  });
  return output;
};

const getRolePermissions = async (): Promise<RolePermissionMap> => {
  const now = Date.now();
  if (cachedPermissions && now - permissionsFetchedAt < PERMISSION_CACHE_TTL_MS) {
    return cachedPermissions;
  }

  const config = await prisma.systemConfig.findUnique({
    where: { key: "ROLE_PERMISSIONS" },
    select: { value: true },
  });

  if (!config?.value) {
    cachedPermissions = DEFAULT_ROLE_PERMISSIONS;
    permissionsFetchedAt = now;
    return cachedPermissions;
  }

  try {
    const parsed = JSON.parse(config.value);
    cachedPermissions = sanitizeRolePermissions(parsed);
  } catch {
    cachedPermissions = DEFAULT_ROLE_PERMISSIONS;
  }
  permissionsFetchedAt = now;
  return cachedPermissions;
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(403).json({ message: "Forbidden: Access denied" });
      }

      if (req.user.role === "ADMIN") {
        return next();
      }

      const requiredPermission = resolveRequiredPermission(req);
      const permissions = await getRolePermissions();
      const rolePermissions = permissions[req.user.role] || [];

      const staticallyAllowed = allowedRoles.includes(req.user.role);
      const permissionAllowed = requiredPermission
        ? rolePermissions.includes(requiredPermission)
        : false;

      if (!staticallyAllowed && !permissionAllowed) {
        return res.status(403).json({ message: "Forbidden: Access denied" });
      }

      if (requiredPermission) {
        if (!rolePermissions.includes(requiredPermission)) {
          return res.status(403).json({
            message: `Forbidden: Missing permission '${requiredPermission}' for role ${req.user.role}`,
          });
        }
      }
    } catch (error) {
      return res.status(500).json({ message: "Failed to load role permissions" });
    }

    next();
  };
};
