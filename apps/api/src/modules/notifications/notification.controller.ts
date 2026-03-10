import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import prisma from "../../prisma";
import {
  getNotificationPreference,
  getUnreadCount,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  upsertNotificationPreference,
} from "./notification.service";

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return undefined;
};

const asNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};
const prismaAny = prisma as any;

const extractEmail = (message: string): string => {
  const match = String(message || "").match(/(?:by|from)\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match?.[1]?.toLowerCase() || "";
};

export const listNotifications = async (req: AuthRequest, res: Response) => {
  const unreadOnly = asBoolean(req.query.unread);
  const take = asNumber(req.query.take);
  const notifications = await getUserNotifications(req.user!.userId, {
    unread: unreadOnly,
    take,
  });
  const issueIds = Array.from(
    new Set(
      notifications
        .filter((item: any) => String(item?.entityType || "").toUpperCase() === "ISSUE" && String(item?.entityId || "").trim())
        .map((item: any) => String(item.entityId))
    )
  ) as string[];
  const issues: any[] = issueIds.length
    ? await prismaAny.issue.findMany({
        where: { id: { in: issueIds } },
        select: {
          id: true,
          reportedBy: true,
          assignedTo: true,
          reporter: { select: { email: true } },
          assignee: { select: { email: true } },
        },
      })
    : [];
  const issueById = new Map<string, any>(issues.map((issue: any) => [String(issue.id), issue]));

  const enriched = notifications.map((item: any) => {
    let senderEmail = extractEmail(item?.message || "");
    if (!senderEmail && String(item?.entityType || "").toUpperCase() === "ISSUE" && String(item?.entityId || "").trim()) {
      const issue = issueById.get(String(item.entityId));
      const type = String(item?.type || "").toUpperCase();
      if (issue) {
        if (type === "BUG_ASSIGNED") {
          senderEmail = String(issue.reporter?.email || issue.assignee?.email || "").toLowerCase();
        } else if (type === "BUG_STATUS_CHANGED" || type === "RETEST_REQUESTED") {
          senderEmail = String(issue.assignee?.email || issue.reporter?.email || "").toLowerCase();
        } else if (type === "COMMENT_MENTION") {
          const nonRecipientReporter =
            issue.reportedBy && issue.reportedBy !== req.user!.userId ? String(issue.reporter?.email || "") : "";
          const nonRecipientAssignee =
            issue.assignedTo && issue.assignedTo !== req.user!.userId ? String(issue.assignee?.email || "") : "";
          senderEmail = (nonRecipientAssignee || nonRecipientReporter).toLowerCase();
        }
      }
    }
    return { ...item, senderEmail };
  });

  const unreadCount = await getUnreadCount(req.user!.userId);
  // Keep both keys for backward compatibility with older frontend consumers.
  return res.json({ items: enriched, notifications: enriched, unreadCount });
};

export const markOneRead = async (req: AuthRequest, res: Response) => {
  await markNotificationRead(req.params.id, req.user!.userId);
  return res.json({ message: "Notification marked as read" });
};

export const markAllRead = async (req: AuthRequest, res: Response) => {
  const result = await markAllNotificationsRead(req.user!.userId);
  return res.json({ message: "All notifications marked as read", updated: result.count });
};

export const getPreferences = async (req: AuthRequest, res: Response) => {
  const pref = await getNotificationPreference(req.user!.userId);
  return res.json(pref);
};

export const updatePreferences = async (req: AuthRequest, res: Response) => {
  const pref = await upsertNotificationPreference(req.user!.userId, {
    emailBugAssigned: asBoolean(req.body.emailBugAssigned),
    emailComments: asBoolean(req.body.emailComments),
    emailStatusChange: asBoolean(req.body.emailStatusChange),
    quietHoursStart: typeof req.body.quietHoursStart === "string" ? req.body.quietHoursStart : undefined,
    quietHoursEnd: typeof req.body.quietHoursEnd === "string" ? req.body.quietHoursEnd : undefined,
  });
  return res.json(pref);
};
