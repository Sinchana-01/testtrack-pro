import prisma from "../../prisma";
import { canCreateInAppNotification } from "./notification-preference.utils";
const prismaAny = prisma as any;

export type NotificationCreateInput = {
  userId: string;
  type: string;
  message: string;
  entityId?: string | null;
  entityType?: string | null;
};

export const createNotification = async (input: NotificationCreateInput) => {
  if (!(await canCreateInAppNotification(input.userId, input.type))) {
    return null;
  }
  return prismaAny.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      message: input.message,
      entityId: input.entityId || null,
      entityType: input.entityType || null,
    },
  });
};

export const createNotificationsBulk = async (inputs: NotificationCreateInput[]) => {
  if (!inputs.length) return;
  const allowed = (
    await Promise.all(
      inputs.map(async (item) => ((await canCreateInAppNotification(item.userId, item.type)) ? item : null))
    )
  ).filter((item): item is NotificationCreateInput => Boolean(item));
  if (!allowed.length) return;
  await prismaAny.notification.createMany({
    data: allowed.map((item) => ({
      userId: item.userId,
      type: item.type,
      message: item.message,
      entityId: item.entityId || null,
      entityType: item.entityType || null,
    })),
  });
};

export const getUserNotifications = async (userId: string, options?: { unread?: boolean; take?: number }) => {
  const where: { userId: string; isRead?: boolean } = { userId };
  if (options?.unread === true) {
    where.isRead = false;
  }
  return prismaAny.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.take && options.take > 0 ? options.take : 100,
  });
};

export const markNotificationRead = async (notificationId: string, userId: string) => {
  return prismaAny.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
};

export const markAllNotificationsRead = async (userId: string) => {
  return prismaAny.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
};

export const getUnreadCount = async (userId: string) => {
  return prismaAny.notification.count({ where: { userId, isRead: false } });
};

export const getNotificationPreference = async (userId: string) => {
  const pref = await prismaAny.notificationPreference.findUnique({ where: { userId } });
  if (pref) return pref;
  return prismaAny.notificationPreference.create({ data: { userId } });
};

export const upsertNotificationPreference = async (
  userId: string,
  input: {
    emailBugAssigned?: boolean;
    emailComments?: boolean;
    emailStatusChange?: boolean;
    emailTestAssigned?: boolean;
    emailRetestRequested?: boolean;
    inAppBugAssigned?: boolean;
    inAppComments?: boolean;
    inAppStatusChange?: boolean;
    inAppTestAssigned?: boolean;
    inAppRetestRequested?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
  }
) => {
  return prismaAny.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      emailBugAssigned: input.emailBugAssigned ?? true,
      emailComments: input.emailComments ?? true,
      emailStatusChange: input.emailStatusChange ?? true,
      emailTestAssigned: input.emailTestAssigned ?? true,
      emailRetestRequested: input.emailRetestRequested ?? true,
      inAppBugAssigned: input.inAppBugAssigned ?? true,
      inAppComments: input.inAppComments ?? true,
      inAppStatusChange: input.inAppStatusChange ?? true,
      inAppTestAssigned: input.inAppTestAssigned ?? true,
      inAppRetestRequested: input.inAppRetestRequested ?? true,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
    },
    update: {
      emailBugAssigned: input.emailBugAssigned ?? undefined,
      emailComments: input.emailComments ?? undefined,
      emailStatusChange: input.emailStatusChange ?? undefined,
      emailTestAssigned: input.emailTestAssigned ?? undefined,
      emailRetestRequested: input.emailRetestRequested ?? undefined,
      inAppBugAssigned: input.inAppBugAssigned ?? undefined,
      inAppComments: input.inAppComments ?? undefined,
      inAppStatusChange: input.inAppStatusChange ?? undefined,
      inAppTestAssigned: input.inAppTestAssigned ?? undefined,
      inAppRetestRequested: input.inAppRetestRequested ?? undefined,
      quietHoursStart: input.quietHoursStart === undefined ? undefined : input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd === undefined ? undefined : input.quietHoursEnd,
    },
  });
};
