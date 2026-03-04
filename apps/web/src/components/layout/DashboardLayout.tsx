import { useEffect, useMemo, useState } from "react";
import "./DashboardLayout.css";

export type DashboardNavItem = {
  key: string;
  label: string;
  icon: string;
};

type DashboardLayoutProps = {
  appTitle?: string;
  currentUserName: string;
  currentRole: string;
  notificationCount?: number;
  notificationItems?: Array<{ id: string; title: string; subtitle?: string; isRead?: boolean }>;
  onNotificationClick?: (id: string) => void;
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

const DashboardLayout = ({
  appTitle = "TestTrack Pro",
  currentUserName,
  currentRole,
  notificationCount = 0,
  notificationItems = [],
  onNotificationClick,
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

  const initial = useMemo(() => {
    const source = String(currentUserName || "U").trim();
    return source ? source[0].toUpperCase() : "U";
  }, [currentUserName]);

  const handleSelect = (key: string) => {
    onSelect(key);
    setSidebarOpen(false);
  };

  useEffect(() => {
    // Reset UI chrome when user/session context changes.
    setSidebarOpen(false);
    setUserMenuOpen(false);
    setNotifOpen(false);
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
          {onProjectChange ? (
            <select
              className="topbarProjectSelect"
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
        <div className="topbarRight">
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
                  notificationItems.slice(0, 10).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`notifItemBtn ${item.isRead ? "read" : "unread"}`}
                      onClick={() => onNotificationClick?.(item.id)}
                    >
                      <strong>{item.title}</strong>
                      {item.subtitle ? <span>{item.subtitle}</span> : null}
                    </button>
                  ))
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
          <header className="dashboardPageHeader">
            <h2>{pageTitle}</h2>
            <p>{pageSubtitle}</p>
            {projectContextLabel ? <div className="dashboardProjectBreadcrumb">{projectContextLabel}</div> : null}
          </header>
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
    </div>
  );
};

export default DashboardLayout;
