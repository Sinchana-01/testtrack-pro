import { NotificationItem } from "./api";

type NotificationsPageProps = {
  items: NotificationItem[];
  unreadCount: number;
  loading?: boolean;
  error?: string;
  onMarkRead: (id: string) => void | Promise<void>;
  onMarkAllRead: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
};

const formatTimestamp = (value: string) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

export default function NotificationsPage({
  items,
  unreadCount,
  loading,
  error,
  onMarkRead,
  onMarkAllRead,
  onRefresh,
}: NotificationsPageProps) {
  return (
    <div className="panel fullWidth">
      <div className="panelHeader">
        <h4>Notification History</h4>
        <div className="toolbarActions">
          <button type="button" className="button small" onClick={() => onMarkAllRead()}>
            Mark all read
          </button>
          {onRefresh ? (
            <button type="button" className="button small" onClick={() => onRefresh()}>
              Refresh
            </button>
          ) : null}
        </div>
      </div>
      <div className="note">Unread: {unreadCount}</div>
      {loading ? <div className="note">Loading notifications...</div> : null}
      {error ? <div className="note" style={{ color: "#b91c1c" }}>{error}</div> : null}
      {items.length === 0 ? (
        <div className="note">No notifications found.</div>
      ) : (
        <div className="listCompact">
          {items.map((item) => (
            <div className="row" key={item.id}>
              <div className="title">
                <strong>{item.message}</strong>
                <div className="note">{item.type}</div>
              </div>
              <div className="meta">{formatTimestamp(item.createdAt)}</div>
              {!item.isRead ? (
                <button type="button" className="button small" onClick={() => onMarkRead(item.id)}>
                  Mark read
                </button>
              ) : (
                <span className="note">Read</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

