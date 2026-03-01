
import React, { useEffect, useMemo, useState } from "react";
import "./AdminDashboard.css";

type AdminMenuKey = "dashboard" | "users" | "roles" | "reports" | "settings";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type RoleKey = "ADMIN" | "TESTER" | "DEVELOPER";

type ActivityRow = {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
};

type DashboardStats = {
  totalTestCases?: number;
  totalTestRuns?: number;
  totalBugs?: number;
};

type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type ExecutionRow = {
  id: string;
  module: string;
  role: RoleKey;
  status: "PASSED" | "FAILED";
  linkedBug: string | null;
  executedAt: string;
};

interface AdminDashboardProps {
  users: any[];
  onToggleActive: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onLogout: () => void;
  adminName?: string;
  stats?: DashboardStats;
  recentActivity?: ActivityRow[];
}

const menuItems: Array<{ key: AdminMenuKey; label: string; icon: string }> = [
  { key: "dashboard", label: "Dashboard", icon: "▦" },
  { key: "users", label: "User Management", icon: "◉" },
  { key: "roles", label: "Role Management", icon: "◇" },
  { key: "reports", label: "Reports", icon: "◧" },
  { key: "settings", label: "System Settings", icon: "⚙" },
];

const defaultRolePermissions: Record<RoleKey, string[]> = {
  ADMIN: [
    "Users: Create/Edit/Disable",
    "Roles: Assign/Update",
    "System: Settings & Backup",
    "Audit: View Logs",
    "Reports: Full Access",
  ],
  TESTER: [
    "Test Cases: CRUD",
    "Executions: Run/Finalize",
    "Bugs: Create/Comment",
    "Reports: View",
    "Suites: Manage",
  ],
  DEVELOPER: [
    "Bugs: Assigned Access",
    "Status: Update Workflow",
    "Fix Notes: Update",
    "Retest: Request",
    "Reports: Export Own",
  ],
};

const permissionGroups: Array<{ group: string; items: string[] }> = [
  { group: "User & Role", items: ["Users: Create/Edit/Disable", "Roles: Assign/Update"] },
  { group: "Execution", items: ["Executions: Run/Finalize", "Suites: Manage"] },
  { group: "Issue & Reporting", items: ["Bugs: Create/Comment", "Bugs: Assigned Access", "Reports: Full Access", "Reports: View", "Reports: Export Own"] },
  { group: "Admin Controls", items: ["System: Settings & Backup", "Audit: View Logs"] },
];

const toSafeUser = (row: any): DashboardUser => ({
  id: String(row?.id || ""),
  name: String(row?.name || "").trim() || "Unnamed user",
  email: String(row?.email || "").trim() || "no-email@unknown",
  role: String(row?.role || "TESTER").toUpperCase(),
  isActive: Boolean(row?.isActive),
});

const formatNumber = (value: number): string => Intl.NumberFormat("en-US").format(value);

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  onToggleActive,
  onDeleteUser,
  onLogout,
  adminName,
  stats,
  recentActivity,
}) => {
  const [activeMenu, setActiveMenu] = useState<AdminMenuKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isBootLoading, setIsBootLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [isFiltering, setIsFiltering] = useState(false);

  const [draftById, setDraftById] = useState<Record<string, Partial<DashboardUser>>>({});
  const [hiddenUserIds, setHiddenUserIds] = useState<string[]>([]);

  const [editingUserId, setEditingUserId] = useState<string>("");
  const [editDraft, setEditDraft] = useState<Partial<DashboardUser>>({});
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [rolePermissions, setRolePermissions] = useState<Record<RoleKey, string[]>>(defaultRolePermissions);
  const [editingRole, setEditingRole] = useState<RoleKey | "">("");
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);

  const [settingsDraft, setSettingsDraft] = useState({
    notifications: true,
    auditLogs: true,
    autoArchive: false,
  });
  const [savedSettings, setSavedSettings] = useState(settingsDraft);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [activityRows, setActivityRows] = useState<ActivityRow[]>(
    Array.isArray(recentActivity) && recentActivity.length > 0
      ? recentActivity
      : [{ id: "seed-1", action: "ADMIN_LOGIN", actor: "System", target: "Admin Session", timestamp: new Date().toISOString() }]
  );

  const [reportFilters, setReportFilters] = useState({ dateFrom: "", dateTo: "", role: "ALL", module: "ALL" });

  useEffect(() => {
    const t = window.setTimeout(() => setIsBootLoading(false), 550);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    setIsFiltering(true);
    const t = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
      setIsFiltering(false);
    }, 240);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth <= 920;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!editingUserId && !editingRole) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditingUserId("");
        setEditingRole("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingRole, editingUserId]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(""), 1800);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const allUsers = useMemo(() => users.map(toSafeUser).filter((row) => row.id), [users]);

  const effectiveUsers = useMemo(() => {
    return allUsers.filter((row) => !hiddenUserIds.includes(row.id)).map((row) => ({ ...row, ...(draftById[row.id] || {}) }));
  }, [allUsers, draftById, hiddenUserIds]);

  const userRoleOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(effectiveUsers.map((user) => user.role))).sort()],
    [effectiveUsers]
  );

  const filteredUsers = useMemo(() => {
    return effectiveUsers.filter((user) => {
      const matchTerm = !searchTerm || user.name.toLowerCase().includes(searchTerm) || user.email.toLowerCase().includes(searchTerm) || user.role.toLowerCase().includes(searchTerm);
      const matchRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" && user.isActive) || (statusFilter === "INACTIVE" && !user.isActive);
      return matchTerm && matchRole && matchStatus;
    });
  }, [effectiveUsers, roleFilter, searchTerm, statusFilter]);

  const adminDisplayName = useMemo(() => {
    if (adminName && String(adminName).trim()) return String(adminName).trim();
    const adminRow = effectiveUsers.find((user) => user.role === "ADMIN");
    if (adminRow?.name) return adminRow.name;
    return "Admin User";
  }, [adminName, effectiveUsers]);

  const totalUsers = effectiveUsers.length;
  const activeUsers = effectiveUsers.filter((user) => user.isActive).length;
  const totalTestCases = Number(stats?.totalTestCases || 0);
  const totalTestRuns = Number(stats?.totalTestRuns || 0);
  const totalBugs = Number(stats?.totalBugs || 0);

  const roleRows = useMemo(() => {
    const counts: Record<RoleKey, number> = { ADMIN: 0, TESTER: 0, DEVELOPER: 0 };
    effectiveUsers.forEach((user) => {
      if (user.role === "ADMIN" || user.role === "TESTER" || user.role === "DEVELOPER") counts[user.role] += 1;
    });
    return (Object.keys(rolePermissions) as RoleKey[]).map((role) => ({ role, permissions: rolePermissions[role], count: counts[role] || 0 }));
  }, [effectiveUsers, rolePermissions]);

  const reportRows = useMemo<ExecutionRow[]>(() => {
    return activityRows.map((row, idx) => {
      const role: RoleKey = idx % 3 === 0 ? "TESTER" : idx % 3 === 1 ? "DEVELOPER" : "ADMIN";
      const status = idx % 4 === 0 ? "FAILED" : "PASSED";
      return {
        id: row.id,
        module: ["Authentication", "Regression", "Payments", "Reports"][idx % 4],
        role,
        status,
        linkedBug: status === "FAILED" ? `BUG-${String(idx + 1).padStart(3, "0")}` : null,
        executedAt: row.timestamp,
      };
    });
  }, [activityRows]);

  const filteredReportRows = useMemo(() => {
    return reportRows.filter((row) => {
      const roleOk = reportFilters.role === "ALL" || row.role === reportFilters.role;
      const moduleOk = reportFilters.module === "ALL" || row.module === reportFilters.module;
      const fromOk = !reportFilters.dateFrom || new Date(row.executedAt).getTime() >= new Date(reportFilters.dateFrom).getTime();
      const toOk = !reportFilters.dateTo || new Date(row.executedAt).getTime() <= new Date(reportFilters.dateTo).getTime() + 86400000;
      return roleOk && moduleOk && fromOk && toOk;
    });
  }, [reportFilters, reportRows]);

  const passRate = filteredReportRows.length === 0 ? 0 : Math.round((filteredReportRows.filter((row) => row.status === "PASSED").length / filteredReportRows.length) * 100);
  const executionCount = filteredReportRows.length;
  const failedCount = filteredReportRows.filter((row) => row.status === "FAILED").length;
  const linkedBugCount = filteredReportRows.filter((row) => !!row.linkedBug).length;

  const settingsChanged = settingsDraft.notifications !== savedSettings.notifications || settingsDraft.auditLogs !== savedSettings.auditLogs || settingsDraft.autoArchive !== savedSettings.autoArchive;

  const pushActivity = (action: string, target: string) => {
    const row: ActivityRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      actor: adminDisplayName,
      target,
      timestamp: new Date().toISOString(),
    };
    setActivityRows((prev) => [row, ...prev].slice(0, 20));
  };

  const handleLogout = () => {
    const ok = window.confirm("Logout from admin session?");
    if (!ok) return;
    onLogout();
  };

  const openEditModal = (user: DashboardUser) => {
    setEditingUserId(user.id);
    setEditDraft({ ...user });
  };

  const saveEditedUser = async () => {
    if (!editingUserId || !String(editDraft.name || "").trim()) return;
    setIsSavingUser(true);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    setDraftById((prev) => ({
      ...prev,
      [editingUserId]: {
        name: String(editDraft.name || "").trim(),
        email: String(editDraft.email || "").trim() || "no-email@unknown",
        role: String(editDraft.role || "TESTER").toUpperCase(),
        isActive: Boolean(editDraft.isActive),
      },
    }));
    pushActivity("USER_EDITED", editingUserId);
    setEditingUserId("");
    setEditDraft({});
    setIsSavingUser(false);
  };

  const handleToggleStatus = async (user: DashboardUser) => {
    const actionLabel = user.isActive ? "Deactivate" : "Activate";
    const ok = window.confirm(`${actionLabel} ${user.name}?`);
    if (!ok) return;
    setDraftById((prev) => ({ ...prev, [user.id]: { ...(prev[user.id] || {}), isActive: !user.isActive } }));
    pushActivity("USER_STATUS_TOGGLED", user.id);
    try {
      await Promise.resolve(onToggleActive(user.id));
    } catch {
      setDraftById((prev) => ({ ...prev, [user.id]: { ...(prev[user.id] || {}), isActive: user.isActive } }));
    }
  };

  const handleDelete = async (user: DashboardUser) => {
    const ok = window.confirm(`Delete ${user.name}? This cannot be undone.`);
    if (!ok) return;
    setHiddenUserIds((prev) => [...prev, user.id]);
    pushActivity("USER_DELETED", user.id);
    try {
      await Promise.resolve(onDeleteUser(user.id));
    } catch {
      setHiddenUserIds((prev) => prev.filter((id) => id !== user.id));
    }
  };

  const openRoleModal = (role: RoleKey) => {
    setEditingRole(role);
    setPermissionDraft([...(rolePermissions[role] || [])]);
  };

  const togglePermissionDraft = (permission: string) => {
    setPermissionDraft((prev) => (prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission]));
  };

  const saveRolePermissions = async () => {
    if (!editingRole) return;
    const cleaned = Array.from(new Set(permissionDraft.map((item) => item.trim()).filter(Boolean)));
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    setRolePermissions((prev) => ({ ...prev, [editingRole]: cleaned }));
    pushActivity("ROLE_PERMISSIONS_UPDATED", editingRole);
    setEditingRole("");
    setPermissionDraft([]);
  };

  const saveSettings = async () => {
    if (!settingsChanged) return;
    setIsSavingSettings(true);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    setSavedSettings(settingsDraft);
    setIsSavingSettings(false);
    setToastMessage("Settings saved successfully");
    pushActivity("SETTINGS_UPDATED", "System Settings");
  };

  return (
    <div className={`adminShell ${sidebarOpen ? "sidebarExpanded" : "sidebarCollapsed"} ${isMobile ? "mobileShell" : ""}`}>
      <aside className="adminSidebar">
        <div className="adminSidebarTop">
          <button
            type="button"
            className="sidebarToggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <nav className="adminNav" aria-label="Admin primary navigation">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`adminNavItem ${activeMenu === item.key ? "active" : ""}`}
              onClick={() => {
                setActiveMenu(item.key);
                if (isMobile) setSidebarOpen(false);
              }}
              aria-current={activeMenu === item.key ? "page" : undefined}
            >
              <span className="adminNavIcon" aria-hidden="true">{item.icon}</span>
              {sidebarOpen ? <span className="adminNavLabel">{item.label}</span> : null}
            </button>
          ))}
        </nav>
      </aside>
      {isMobile && sidebarOpen ? <button type="button" className="sidebarBackdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} /> : null}

      <main className="adminMain">
        <header className="adminHeader">
          <div className="adminBrand">
            <div className="adminLogo">TT</div>
            <div className="adminBrandText">TestTrack Pro</div>
          </div>

          <div className="adminHeaderRight">
            <button type="button" className="adminIconBtn" aria-label="Notifications">🔔</button>
            <div className="adminIdentity">
              <span className="adminName">{adminDisplayName}</span>
              <span className="adminRoleBadge">ADMIN</span>
            </div>
            <button type="button" className="adminLogoutBtn" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <section className="adminContent">
          {activeMenu === "dashboard" && (
            <>
              <h1 className="adminSectionTitle">Dashboard</h1>
              <div className="adminKpiGrid">
                {isBootLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <article className="adminCard adminKpiCard skeleton" key={`sk-${idx}`}>
                      <div className="skeletonLine small" />
                      <div className="skeletonLine large" />
                    </article>
                  ))
                ) : (
                  <>
                    <article className="adminCard adminKpiCard"><h3>Total Users</h3><p className="adminKpiValue">{formatNumber(totalUsers)}</p></article>
                    <article className="adminCard adminKpiCard"><h3>Active Users</h3><p className="adminKpiValue">{formatNumber(activeUsers)}</p></article>
                    <article className="adminCard adminKpiCard"><h3>Total Test Cases</h3><p className="adminKpiValue">{formatNumber(totalTestCases)}</p></article>
                    <article className="adminCard adminKpiCard"><h3>Total Test Runs</h3><p className="adminKpiValue">{formatNumber(totalTestRuns)}</p></article>
                    <article className="adminCard adminKpiCard"><h3>Total Bugs</h3><p className="adminKpiValue">{formatNumber(totalBugs)}</p></article>
                  </>
                )}
              </div>

              <div className="adminCard adminSectionCard">
                <div className="adminSectionHead"><h2>Recent System Activity</h2></div>
                <div className="adminTableWrap">
                  <table className="adminTable">
                    <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Time</th></tr></thead>
                    <tbody>
                      {activityRows.length === 0 ? (
                        <tr><td colSpan={4} className="adminEmptyCell">No activity available.</td></tr>
                      ) : (
                        activityRows.map((row) => (
                          <tr key={row.id}><td>{row.action}</td><td>{row.actor}</td><td>{row.target}</td><td>{new Date(row.timestamp).toLocaleString()}</td></tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeMenu === "users" && (
            <>
              <h1 className="adminSectionTitle">User Management</h1>
              <div className="adminCard adminSectionCard">
                <div className="adminFilters">
                  <input className="adminInput" placeholder="Search by name, email, or role" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} aria-label="Search users" />
                  <select className="adminInput" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
                    {userRoleOptions.map((role) => (
                      <option key={role} value={role}>{role === "ALL" ? "All Roles" : role}</option>
                    ))}
                  </select>
                  <select className="adminInput" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filter by status">
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                {isFiltering ? <div className="adminSpinner" aria-label="Filtering users" /> : null}

                <div className="adminTableWrap">
                  <table className="adminTable">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr><td colSpan={5} className="adminEmptyCell">No users match the selected filters.</td></tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id}>
                            <td>{user.name}</td>
                            <td className="emailCell" title={user.email}>{user.email}</td>
                            <td><span className={`pill role ${user.role.toLowerCase()}`}>{user.role}</span></td>
                            <td><span className={`pill status ${user.isActive ? "active" : "inactive"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
                            <td>
                              <div className="adminActionRow">
                                <button type="button" className="adminActionBtn neutral" onClick={() => openEditModal(user)}>Edit</button>
                                <button type="button" className={`adminActionBtn ${user.isActive ? "warn" : "success"}`} onClick={() => handleToggleStatus(user)}>{user.isActive ? "Deactivate" : "Activate"}</button>
                                <button type="button" className="adminActionBtn danger" onClick={() => handleDelete(user)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeMenu === "roles" && (
            <>
              <h1 className="adminSectionTitle">Role Management</h1>
              <div className="adminCard adminSectionCard">
                <div className="adminTableWrap">
                  <table className="adminTable">
                    <thead><tr><th>Role Name</th><th>Permission Summary</th><th>User Count</th><th>Edit</th></tr></thead>
                    <tbody>
                      {roleRows.map((row) => (
                        <tr key={row.role}>
                          <td>{row.role}</td>
                          <td>{row.permissions.join(", ")}</td>
                          <td>{row.count}</td>
                          <td><button type="button" className="adminActionBtn neutral" onClick={() => openRoleModal(row.role)}>Edit</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeMenu === "reports" && (
            <>
              <h1 className="adminSectionTitle">Reports</h1>
              <div className="adminCard adminSectionCard">
                <div className="adminFilters reportFilters">
                  <input className="adminInput" type="date" value={reportFilters.dateFrom} onChange={(event) => setReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} aria-label="Report from date" />
                  <input className="adminInput" type="date" value={reportFilters.dateTo} onChange={(event) => setReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))} aria-label="Report to date" />
                  <select className="adminInput" value={reportFilters.role} onChange={(event) => setReportFilters((prev) => ({ ...prev, role: event.target.value }))} aria-label="Filter report by role">
                    <option value="ALL">All Roles</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="TESTER">TESTER</option>
                    <option value="DEVELOPER">DEVELOPER</option>
                  </select>
                  <select className="adminInput" value={reportFilters.module} onChange={(event) => setReportFilters((prev) => ({ ...prev, module: event.target.value }))} aria-label="Filter report by module">
                    <option value="ALL">All Modules</option>
                    <option value="Authentication">Authentication</option>
                    <option value="Regression">Regression</option>
                    <option value="Payments">Payments</option>
                    <option value="Reports">Reports</option>
                  </select>
                </div>

                <div className="adminKpiGrid reportKpiGrid">
                  <article className="adminCard adminKpiCard"><h3>Pass Rate %</h3><p className="adminKpiValue">{formatNumber(passRate)}</p></article>
                  <article className="adminCard adminKpiCard"><h3>Executions</h3><p className="adminKpiValue">{formatNumber(executionCount)}</p></article>
                  <article className="adminCard adminKpiCard"><h3>Failed Count</h3><p className="adminKpiValue">{formatNumber(failedCount)}</p></article>
                  <article className="adminCard adminKpiCard"><h3>Linked Bugs</h3><p className="adminKpiValue">{formatNumber(linkedBugCount)}</p></article>
                </div>

                <div className="adminTableWrap">
                  <table className="adminTable">
                    <thead><tr><th>Execution ID</th><th>Module</th><th>Role</th><th>Status</th><th>Linked Bug</th><th>Executed At</th></tr></thead>
                    <tbody>
                      {filteredReportRows.length === 0 ? (
                        <tr><td colSpan={6} className="adminEmptyCell">No execution rows found for the selected filters.</td></tr>
                      ) : (
                        filteredReportRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.id}</td>
                            <td>{row.module}</td>
                            <td><span className={`pill role ${row.role.toLowerCase()}`}>{row.role}</span></td>
                            <td><span className={`pill status ${row.status === "PASSED" ? "active" : "inactive"}`}>{row.status}</span></td>
                            <td>{row.linkedBug || "-"}</td>
                            <td>{new Date(row.executedAt).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeMenu === "settings" && (
            <>
              <h1 className="adminSectionTitle">System Settings</h1>
              <div className="adminCard adminSectionCard settingsCard">
                <label className="toggleRow"><span>Enable Notifications</span><button type="button" className={`switchBtn ${settingsDraft.notifications ? "on" : "off"}`} onClick={() => setSettingsDraft((prev) => ({ ...prev, notifications: !prev.notifications }))} aria-pressed={settingsDraft.notifications} /></label>
                <label className="toggleRow"><span>Audit Logs</span><button type="button" className={`switchBtn ${settingsDraft.auditLogs ? "on" : "off"}`} onClick={() => setSettingsDraft((prev) => ({ ...prev, auditLogs: !prev.auditLogs }))} aria-pressed={settingsDraft.auditLogs} /></label>
                <label className="toggleRow"><span>Auto Archive</span><button type="button" className={`switchBtn ${settingsDraft.autoArchive ? "on" : "off"}`} onClick={() => setSettingsDraft((prev) => ({ ...prev, autoArchive: !prev.autoArchive }))} aria-pressed={settingsDraft.autoArchive} /></label>
                <div className="settingsActions"><button type="button" className="adminActionBtn success" onClick={saveSettings} disabled={!settingsChanged || isSavingSettings}>{isSavingSettings ? "Saving..." : "Save Settings"}</button></div>
              </div>
            </>
          )}
        </section>
      </main>

      {editingUserId ? (
        <div className="adminModalOverlay" onClick={() => setEditingUserId("")} role="dialog" aria-modal="true" aria-label="Edit user modal">
          <div className="adminModal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit User</h3>
            <div className="adminModalGrid">
              <div className="adminFieldWrap">
                <input className="adminInput" placeholder="Name" value={String(editDraft.name || "")} onChange={(event) => setEditDraft((prev) => ({ ...prev, name: event.target.value }))} aria-label="Edit user name" />
                {!String(editDraft.name || "").trim() ? <p className="fieldError">Name is required.</p> : null}
              </div>
              <div className="adminFieldWrap">
                <input className="adminInput" placeholder="Email" value={String(editDraft.email || "")} onChange={(event) => setEditDraft((prev) => ({ ...prev, email: event.target.value }))} aria-label="Edit user email" />
              </div>
              <div className="adminFieldWrap">
                <select className="adminInput" value={String(editDraft.role || "TESTER")} onChange={(event) => setEditDraft((prev) => ({ ...prev, role: event.target.value }))} aria-label="Edit user role">
                  <option value="ADMIN">ADMIN</option><option value="TESTER">TESTER</option><option value="DEVELOPER">DEVELOPER</option>
                </select>
              </div>
              <div className="adminFieldWrap">
                <label className="adminCheckboxLabel"><input type="checkbox" checked={Boolean(editDraft.isActive)} onChange={(event) => setEditDraft((prev) => ({ ...prev, isActive: event.target.checked }))} />Active</label>
              </div>
            </div>
            <div className="adminModalActions">
              <button type="button" className="adminActionBtn neutral" onClick={() => setEditingUserId("")}>Cancel</button>
              <button type="button" className="adminActionBtn success" onClick={saveEditedUser} disabled={!String(editDraft.name || "").trim() || isSavingUser}>{isSavingUser ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {editingRole ? (
        <div className="adminModalOverlay" onClick={() => setEditingRole("")} role="dialog" aria-modal="true" aria-label="Edit role permissions modal">
          <div className="adminModal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit {editingRole} Permissions</h3>
            <div className="permissionGroups">
              {permissionGroups.map((group) => (
                <div className="permissionGroup" key={group.group}>
                  <h4>{group.group}</h4>
                  <div className="permissionGrid">
                    {group.items.map((permission) => (
                      <label key={permission} className="adminCheckboxLabel"><input type="checkbox" checked={permissionDraft.includes(permission)} onChange={() => togglePermissionDraft(permission)} />{permission}</label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="adminModalActions">
              <button type="button" className="adminActionBtn neutral" onClick={() => setEditingRole("")}>Cancel</button>
              <button type="button" className="adminActionBtn success" onClick={saveRolePermissions}>Save</button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? <div className="adminToast">{toastMessage}</div> : null}
    </div>
  );
};

export default AdminDashboard;
