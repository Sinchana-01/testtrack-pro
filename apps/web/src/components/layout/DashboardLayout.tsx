import { useEffect, useMemo, useRef, useState } from "react";
import "./DashboardLayout.css";

export type DashboardNavItem = {
  key: string;
  label: string;
  icon: string;
};

type DashboardLayoutProps = {
  appTitle?: string;
  currentUserName: string;
  currentUserEmail?: string;
  currentRole: string;
  notificationCount?: number;
  notificationItems?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    isRead?: boolean;
    bugId?: string;
    type?: string;
    senderEmail?: string;
  }>;
  onNotificationClick?: (id: string) => void;
  onNotificationReply?: (id: string, message: string) => Promise<void> | void;
  onOpenNotificationPreferences?: () => void;
  navItems: DashboardNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onBack?: () => void;
  onLogout: () => void;
  onLogoutAll: () => void;
  pageTitle: string;
  pageSubtitle: string;
  projectContextLabel?: string;
  projectOptions?: Array<{ id: string; name: string }>;
  activeProjectId?: string;
  onProjectChange?: (projectId: string) => void;
  allowAllProjectsOption?: boolean;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  children: React.ReactNode;
};

type LayoutNotificationItem = {
  id: string;
  title: string;
  subtitle?: string;
  isRead?: boolean;
  bugId?: string;
  type?: string;
  senderEmail?: string;
};

const DashboardLayout = ({
  appTitle = "TestTrack Pro",
  currentUserName,
  currentUserEmail = "",
  currentRole,
  notificationCount = 0,
  notificationItems = [],
  onNotificationClick,
  onNotificationReply,
  onOpenNotificationPreferences,
  navItems,
  activeKey,
  onSelect,
  onBack,
  onLogout,
  onLogoutAll,
  pageTitle,
  pageSubtitle,
  projectContextLabel,
  projectOptions = [],
  activeProjectId = "",
  onProjectChange,
  allowAllProjectsOption = false,
  primaryActionLabel,
  onPrimaryAction,
  children,
}: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<LayoutNotificationItem | null>(null);
  const [notificationReplyText, setNotificationReplyText] = useState("");
  const [notificationReplyError, setNotificationReplyError] = useState("");
  const [sendingNotificationReply, setSendingNotificationReply] = useState(false);
  const notificationListRef = useRef<HTMLDivElement | null>(null);
  const isDashboardHomeHeader = pageTitle === "Dashboard";
  const hasPageHeaderContent = Boolean(pageTitle || pageSubtitle || projectContextLabel);

  const initial = useMemo(() => {
    const source = String(currentUserName || "U").trim();
    return source ? source[0].toUpperCase() : "U";
  }, [currentUserName]);
  const getNotificationSource = (
    item: LayoutNotificationItem
  ): { label: string; tone: "tester" | "developer" | "system" | "mine" } => {
    const senderEmail = String(item.senderEmail || "").trim().toLowerCase();
    const currentEmail = String(currentUserEmail || "").trim().toLowerCase();
    if (senderEmail && currentEmail && senderEmail === currentEmail) {
      return { label: "You", tone: "mine" };
    }
    if (senderEmail) {
      return { label: senderEmail, tone: "developer" };
    }
    return { label: "unknown@system", tone: "system" };
  };

  const handleSelect = (key: string) => {
    onSelect(key);
    setSidebarOpen(false);
  };

  useEffect(() => {
    // Reset UI chrome when user/session context changes.
    setSidebarOpen(false);
    setUserMenuOpen(false);
    setNotifOpen(false);
    setSelectedNotification(null);
    setNotificationReplyText("");
    setNotificationReplyError("");
    setSendingNotificationReply(false);
  }, [currentUserName, currentRole]);

  return (
    <div className="dashboardLayoutRoot">
      <header className="dashboardTopbar">
        <div className="topbarLeft">
          <button
            type="button"
            className="topbarIconBtn"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            <span />
            <span />
            <span />
          </button>
          {onBack ? (
            <button
              type="button"
              className="topbarBackBtn"
              onClick={onBack}
              aria-label="Go back"
              title="Back"
            >
              <span aria-hidden="true">&#8592;</span>
            </button>
          ) : null}
        </div>
        <div className="topbarCenter">
          <h1 className="topbarTitle">{appTitle}</h1>
        </div>
        <div className="topbarRight">
          <div className="topbarRightControls">
            <div className="notifWrap">
              <button
                type="button"
                className="topbarCircleBtn"
                aria-label="Notifications"
                onClick={() => setNotifOpen((prev) => !prev)}
              >
                <span className="bellIcon">&#128276;</span>
                {notificationCount > 0 ? <span className="notifBadge">{notificationCount}</span> : null}
              </button>
              {notifOpen ? (
                <div className="notifDropdown">
                  <div className="notifHeader">Notifications</div>
                  {notificationItems.length === 0 ? (
                    <div className="notifItem">No new notifications</div>
                  ) : (
                    <>
                      <div className="notifList" ref={notificationListRef}>
                        {notificationItems.map((item) => {
                          const source = getNotificationSource(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`notifItemBtn ${item.isRead ? "read" : "unread"} ${source.tone === "mine" ? "mine" : ""}`}
                              onClick={() => {
                                setSelectedNotification(item);
                                setNotificationReplyText("");
                                setNotificationReplyError("");
                                setNotifOpen(false);
                              }}
                            >
                              <span className={`notifSourceBadge ${source.tone}`}>{source.label}</span>
                              <strong>{item.title || "Notification"}</strong>
                              {item.subtitle ? <span>{item.subtitle}</span> : <span>No additional details</span>}
                            </button>
                          );
                        })}
                      </div>
                      {notificationItems.length > 6 ? (
                        <div className="notifFooter">
                          <button
                            type="button"
                            className="notifScrollBtn"
                            onClick={() =>
                              notificationListRef.current?.scrollTo({
                                top: notificationListRef.current.scrollHeight,
                                behavior: "smooth",
                              })
                            }
                          >
                            Scroll to latest
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <div className="userMenuWrap">
              <button
                type="button"
                className="topbarAvatarBtn"
                aria-label="User menu"
                onClick={() => setUserMenuOpen((prev) => !prev)}
              >
                <span className="avatarCircle">{initial}</span>
              </button>
              {userMenuOpen ? (
                <div className="userDropdown" role="menu">
                  <div className="userDropdownMeta">
                    <strong>{currentUserName || "User"}</strong>
                    <span>{currentRole || "USER"}</span>
                  </div>
                  
                  {onOpenNotificationPreferences ? (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenNotificationPreferences();
                      }}
                    >
                      Notification Preferences
                    </button>
                  ) : null}
                  <button type="button" onClick={onLogout}>
                    Logout
                  </button>
                  <button type="button" onClick={onLogoutAll}>
                    Logout All Devices
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {onProjectChange ? (
            <select
              className="topbarProjectSelect topbarProjectSelectRight"
              value={activeProjectId || (allowAllProjectsOption ? "__ALL__" : "")}
              onChange={(e) => onProjectChange(e.target.value)}
            >
              {allowAllProjectsOption ? <option value="__ALL__">All Projects</option> : null}
              {projectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </header>

      <aside className={`dashboardSidebar ${sidebarOpen ? "open" : "closed"}`}>
        <nav className="sidebarNav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebarNavItem ${activeKey === item.key ? "active" : ""}`}
              onClick={() => handleSelect(item.key)}
              aria-current={activeKey === item.key ? "page" : undefined}
              title={item.label}
            >
              <span className="sidebarIcon">{item.icon}</span>
              {sidebarOpen ? <span className="sidebarLabel">{item.label}</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebarBottom">
          <button type="button" className="sidebarLogoutBtn" onClick={onLogout}>
            <span className="sidebarIcon">L</span>
            {sidebarOpen ? <span className="sidebarLabel">Logout</span> : null}
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="mobileSidebarBackdrop"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className={`dashboardMain ${sidebarOpen ? "sidebarFull" : "sidebarMini"}`}>
        <section className="dashboardPageContent">
          {!isDashboardHomeHeader && hasPageHeaderContent ? (
            <header className="dashboardPageHeader">
              <h2>{pageTitle}</h2>
              {pageSubtitle ? <p>{pageSubtitle}</p> : null}
            </header>
          ) : null}
          {primaryActionLabel && onPrimaryAction ? (
            <div className="dashboardContentToolbar">
              <button type="button" className="pagePrimaryAction" onClick={onPrimaryAction}>
                {primaryActionLabel}
              </button>
            </div>
          ) : null}
          {children}
        </section>
      </main>
      {selectedNotification ? (
        <div className="notifModalBackdrop" onClick={() => setSelectedNotification(null)}>
          <section className="notifModal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="notifModalHeader">
              <h3>Notification details</h3>
              <span className={`notifSourceBadge ${getNotificationSource(selectedNotification).tone}`}>
                {getNotificationSource(selectedNotification).label}
              </span>
              <button
                type="button"
                className="notifModalCloseBtn"
                aria-label="Close notification details"
                onClick={() => setSelectedNotification(null)}
              >
                X
              </button>
            </header>
            <div className="notifModalBody">
              <p className="notifModalMessage">{selectedNotification.title || "Notification"}</p>
              {selectedNotification.subtitle ? (
                <p className="notifModalMeta">{selectedNotification.subtitle}</p>
              ) : (
                <p className="notifModalMeta">No additional details available.</p>
              )}
              <label className="notifReplyLabel" htmlFor="notif-reply-input">
                Reply message
              </label>
              <textarea
                id="notif-reply-input"
                className="notifReplyInput"
                rows={4}
                value={notificationReplyText}
                onChange={(e) => {
                  setNotificationReplyText(e.target.value);
                  if (notificationReplyError) setNotificationReplyError("");
                }}
                placeholder="Write your reply..."
              />
              {notificationReplyError ? <p className="notifReplyError">{notificationReplyError}</p> : null}
            </div>
            <footer className="notifModalFooter">
              <button
                type="button"
                className="notifModalActionBtn"
                disabled={
                  sendingNotificationReply ||
                  !selectedNotification.id ||
                  !selectedNotification.bugId ||
                  !notificationReplyText.trim()
                }
                onClick={async () => {
                  const message = notificationReplyText.trim();
                  if (!selectedNotification.id || !selectedNotification.bugId) {
                    setNotificationReplyError("Reply is not available for this notification.");
                    return;
                  }
                  if (!message) {
                    setNotificationReplyError("Reply message is required.");
                    return;
                  }
                  try {
                    setSendingNotificationReply(true);
                    await onNotificationReply?.(selectedNotification.id, message);
                    setSelectedNotification(null);
                    setNotificationReplyText("");
                    setNotificationReplyError("");
                  } catch (error: any) {
                    setNotificationReplyError(error?.message || "Failed to send reply.");
                  } finally {
                    setSendingNotificationReply(false);
                  }
                }}
              >
                {sendingNotificationReply ? "Sending..." : "Reply"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardLayout;


