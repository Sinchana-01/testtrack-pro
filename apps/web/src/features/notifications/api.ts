import {
  listNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
} from "../../api";

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  message: string;
  entityId: string | null;
  entityType: string | null;
  isRead: boolean;
  createdAt: string;
};

export const fetchNotifications = async (params?: { unread?: boolean; take?: number }) => {
  const payload = await listNotificationsApi({
    unread: params?.unread ? "1" : "0",
    take: params?.take,
  });
  return {
    items: (Array.isArray(payload?.items) ? payload.items : []) as NotificationItem[],
    unreadCount: Number(payload?.unreadCount || 0),
  };
};

export const markNotificationRead = async (notificationId: string) => {
  return markNotificationReadApi(notificationId);
};

export const markAllNotificationsRead = async () => {
  return markAllNotificationsReadApi();
};
