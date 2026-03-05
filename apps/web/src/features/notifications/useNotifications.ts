import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
} from "./api";

export const useNotifications = (enabled = true) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await fetchNotifications({ unread: false, take: 50 });
      setItems(payload.items);
      setUnreadCount(payload.unreadCount);
    } catch (err: any) {
      setError(String(err?.message || "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const onMarkRead = useCallback(async (notificationId: string) => {
    await markNotificationRead(notificationId);
    setItems((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const onMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      load().catch(() => {
        // ignore polling errors; foreground actions still show errors
      });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [enabled, load]);

  return useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      error,
      refresh: load,
      markRead: onMarkRead,
      markAllRead: onMarkAllRead,
    }),
    [error, items, load, loading, onMarkAllRead, onMarkRead, unreadCount]
  );
};

