import prisma from "../../prisma";

const prismaAny = prisma as any;

export type NotificationDeliveryType =
  | "BUG_ASSIGNED"
  | "BUG_STATUS_CHANGED"
  | "TEST_ASSIGNED"
  | "COMMENT_MENTION"
  | "RETEST_REQUESTED";

type PreferenceFlags = {
  email: string;
  inApp: string;
};

const preferenceFieldMap: Record<NotificationDeliveryType, PreferenceFlags> = {
  BUG_ASSIGNED: {
    email: "emailBugAssigned",
    inApp: "inAppBugAssigned",
  },
  BUG_STATUS_CHANGED: {
    email: "emailStatusChange",
    inApp: "inAppStatusChange",
  },
  TEST_ASSIGNED: {
    email: "emailTestAssigned",
    inApp: "inAppTestAssigned",
  },
  COMMENT_MENTION: {
    email: "emailComments",
    inApp: "inAppComments",
  },
  RETEST_REQUESTED: {
    email: "emailRetestRequested",
    inApp: "inAppRetestRequested",
  },
};

const readFlag = (pref: any, field: string): boolean => {
  if (!pref) return true;
  const value = pref[field];
  return typeof value === "boolean" ? value : true;
};

export const getNotificationPreferenceRecord = async (userId: string) => {
  return prismaAny.notificationPreference.findUnique({ where: { userId } });
};

export const canCreateInAppNotification = async (userId: string, type: string): Promise<boolean> => {
  const key = String(type || "").toUpperCase() as NotificationDeliveryType;
  const mapping = preferenceFieldMap[key];
  if (!mapping) return true;
  const pref = await getNotificationPreferenceRecord(userId);
  return readFlag(pref, mapping.inApp);
};

export const canSendNotificationEmail = async (userId: string, type: NotificationDeliveryType): Promise<boolean> => {
  const mapping = preferenceFieldMap[type];
  if (!mapping) return true;
  const pref = await getNotificationPreferenceRecord(userId);
  return readFlag(pref, mapping.email);
};

