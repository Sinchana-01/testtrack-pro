import { useState } from "react";
import { NotificationItem } from "./api";

type NotificationBellProps = {
  unreadCount: number;
  items: NotificationItem[];
  onClickItem: (id: string) => void | Promise<void>;
  onMarkAllRead: () => void | Promise<void>;
  onOpenHistory?: () => void;
};

const formatTimestamp = (value: string) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString();
};

export default function NotificationBell({
  unreadCount,
  items,
  onClickItem,
  onMarkAllRead,
  onOpenHistory,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const latest = items.slice(0, 10);
  return (
    <div className="notifWrap">
      <button
        type="button"
        className="topbarCircleBtn"
        aria-label="Notifications"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="bellIcon">&#128276;</span>
        {unreadCount > 0 ? <span className="notifBadge">{unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="notifDropdown">
          <div className="notifHeader">
            <span>Notifications</span>
            <button type="button" className="button small" onClick={() => onMarkAllRead()}>
              Mark all read
            </button>
          </div>
          {latest.length === 0 ? (
            <div className="notifItem">No new notifications</div>
          ) : (
            latest.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`notifItemBtn ${item.isRead ? "read" : "unread"}`}
                onClick={() => onClickItem(item.id)}
              >
                <strong>{item.message}</strong>
                <span>{formatTimestamp(item.createdAt)}</span>
              </button>
            ))
          )}
          {onOpenHistory ? (
            <button
              type="button"
              className="button small"
              onClick={() => {
                setOpen(false);
                onOpenHistory();
              }}
            >
              View all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

