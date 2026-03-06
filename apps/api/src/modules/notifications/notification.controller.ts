import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
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

export const listNotifications = async (req: AuthRequest, res: Response) => {
  const unreadOnly = asBoolean(req.query.unread);
  const take = asNumber(req.query.take);
  const notifications = await getUserNotifications(req.user!.userId, {
    unread: unreadOnly,
    take,
  });
  const unreadCount = await getUnreadCount(req.user!.userId);
  // Keep both keys for backward compatibility with older frontend consumers.
  return res.json({ items: notifications, notifications, unreadCount });
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
