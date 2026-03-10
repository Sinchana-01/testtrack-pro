import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardWidgetsLayoutApi, saveDashboardWidgetsLayoutApi } from "../../api";
import StatusBadge from "../../components/ui/StatusBadge";

type RoleName = "TESTER" | "DEVELOPER" | "ADMIN";
type WidgetSize = "S" | "M" | "L";

type WidgetLayoutItem = {
  id: string;
  visible: boolean;
  order: number;
  size: WidgetSize;
};

type Props = {
  roleName: string;
  testCases: any[];
  executionReports: any[];
  bugs: any[];
  adminUsers: any[];
  adminProjects: any[];
  adminAuditLogs: any[];
  currentUserId: string;
  dataLoading?: boolean;
  onNavigate: (key: string) => void;
};

const WIDGETS_BY_ROLE: Record<RoleName, Array<{ id: string; title: string }>> = {
  TESTER: [
    { id: "pending_tests", title: "My Pending Tests" },
    { id: "recent_failures", title: "Recent Failures" },
    { id: "execution_trend", title: "Execution Trend" },
    { id: "status_breakdown", title: "Test Status Breakdown" },
  ],
  DEVELOPER: [
    { id: "assigned_bugs_counter", title: "Assigned Bugs" },
    { id: "critical_bugs_counter", title: "Critical + P1" },
    { id: "bug_aging_chart", title: "Bug Aging (7 Days)" },
    { id: "bug_status_chart", title: "Bug Status Distribution" },
  ],
  ADMIN: [
    { id: "total_users", title: "Total Users" },
    { id: "active_projects", title: "Active Projects" },
    { id: "total_test_cases", title: "Total Test Cases" },
    { id: "system_activity_chart", title: "System Activity (7 Days)" },
  ],
};

const toWidgetSize = (value: unknown): WidgetSize => {
  if (value === "S" || value === "M" || value === "L") return value;
  return "M";
};

const normalizeLayout = (role: RoleName, raw?: WidgetLayoutItem[]): WidgetLayoutItem[] => {
  const defaults = WIDGETS_BY_ROLE[role].map((item, index) => ({
    id: item.id,
    visible: true,
    order: index,
    size: "M" as WidgetSize,
  }));
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const allowed = new Set(WIDGETS_BY_ROLE[role].map((item) => item.id));
  const valid = raw
    .filter((item) => item && allowed.has(item.id))
    .map((item, index) => ({
      id: item.id,
      visible: item.visible !== false,
      order: Number.isFinite(item.order) ? item.order : index,
      size: toWidgetSize(item.size),
    }))
    .sort((a, b) => a.order - b.order);

  const byId = new Map(valid.map((item) => [item.id, item]));
  defaults.forEach((item) => {
    if (!byId.has(item.id)) byId.set(item.id, { ...item, order: byId.size });
  });
  return Array.from(byId.values()).map((item, idx) => ({ ...item, order: idx }));
};

const DashboardWidgetsBoard: React.FC<Props> = ({
  roleName,
  testCases,
  executionReports,
  bugs,
  adminUsers,
  adminProjects,
  adminAuditLogs,
  currentUserId,
  dataLoading = false,
}) => {
  const normalizedRole: RoleName = roleName === "DEVELOPER" || roleName === "ADMIN" ? roleName : "TESTER";
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(normalizeLayout(normalizedRole));
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const layoutQuery = useQuery<{ widgets: WidgetLayoutItem[] }, Error>({
    queryKey: ["dashboard-widgets-layout", normalizedRole, currentUserId],
    queryFn: () => getDashboardWidgetsLayoutApi(),
    keepPreviousData: true,
    enabled: !!currentUserId,
  });

  useEffect(() => {
    if (layoutQuery.data?.widgets) {
      setLayout(normalizeLayout(normalizedRole, layoutQuery.data.widgets));
    } else {
      setLayout(normalizeLayout(normalizedRole));
    }
  }, [layoutQuery.data, normalizedRole]);

  const orderedWidgets = useMemo(() => {
    return [...layout].sort((a, b) => a.order - b.order).filter((item) => item.visible);
  }, [layout]);

  const assignedCases = useMemo(
    () =>
      testCases.filter(
        (item) =>
          String(item?.assignedTo || item?.assignee?.id || "") === currentUserId ||
          String(item?.createdBy || item?.creator?.id || "") === currentUserId
      ),
    [testCases, currentUserId]
  );

  const executedCaseIds = useMemo(() => {
    const ids = new Set<string>();
    executionReports.forEach((item) => {
      if (item?.testCaseId) ids.add(String(item.testCaseId));
    });
    return ids;
  }, [executionReports]);

  const testerPendingCount = useMemo(() => {
    return assignedCases.filter((tc) => !executedCaseIds.has(String(tc.id))).length;
  }, [assignedCases, executedCaseIds]);

  const testerRecentFailures = useMemo(() => {
    return executionReports.filter((item) => {
      if (String(item?.result || "").toUpperCase() !== "FAILED") return false;
      return assignedCases.some((tc) => String(tc.id) === String(item?.testCaseId || ""));
    }).length;
  }, [executionReports, assignedCases]);

  const testerReports = useMemo(() => {
    return executionReports.filter((item) =>
      assignedCases.some((tc) => String(tc.id) === String(item?.testCaseId || ""))
    );
  }, [executionReports, assignedCases]);

  const trendBuckets = useMemo(() => {
    const base = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      return {
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        count: 0,
      };
    });
    const source = normalizedRole === "TESTER" ? testerReports : normalizedRole === "DEVELOPER" ? bugs : adminAuditLogs;
    source.forEach((item: any) => {
      const at = item?.executedAt || item?.updatedAt || item?.createdAt;
      const key = new Date(at || 0).toISOString().slice(0, 10);
      const row = base.find((b) => b.key === key);
      if (row) row.count += 1;
    });
    return base;
  }, [normalizedRole, testerReports, bugs, adminAuditLogs]);

  const maxTrend = Math.max(...trendBuckets.map((b) => b.count), 1);

  const statusCounts = useMemo(() => {
    const source = normalizedRole === "TESTER" ? testerReports : executionReports;
    return {
      passed: source.filter((item) => String(item?.result || "").toUpperCase() === "PASSED").length,
      failed: source.filter((item) => String(item?.result || "").toUpperCase() === "FAILED").length,
      blocked: source.filter((item) => String(item?.result || "").toUpperCase() === "BLOCKED").length,
    };
  }, [normalizedRole, testerReports, executionReports]);

  const devAssigned = useMemo(
    () => bugs.filter((item) => String(item?.assignedTo || item?.assignee?.id || "") === currentUserId),
    [bugs, currentUserId]
  );

  const devCriticalP1 = useMemo(
    () =>
      devAssigned.filter(
        (item) =>
          String(item?.severity || "").toUpperCase() === "CRITICAL" ||
          String(item?.priority || item?.bugPriority || "").toUpperCase() === "P1_URGENT"
      ).length,
    [devAssigned]
  );

  const devStatus = useMemo(() => {
    const values = ["NEW", "OPEN", "IN_PROGRESS", "FIXED", "VERIFIED", "CLOSED"];
    return values.reduce<Record<string, number>>((acc, key) => {
      acc[key] = devAssigned.filter((item) => String(item?.workflowStatus || item?.status || "").toUpperCase() === key).length;
      return acc;
    }, {});
  }, [devAssigned]);

  const adminActiveProjectsByOwner = useMemo(() => {
    return adminProjects.filter(
      (item) =>
        item?.isActive !== false &&
        (String(item?.ownerId || "") === currentUserId || String(item?.createdBy || "") === currentUserId)
    ).length;
  }, [adminProjects, currentUserId]);

  const widgetMeta = new Map(WIDGETS_BY_ROLE[normalizedRole].map((item) => [item.id, item]));

  const updateWidget = (id: string, patch: Partial<WidgetLayoutItem>) => {
    setLayout((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const saveLayout = async () => {
    try {
      setSaving(true);
      const normalized = [...layout]
        .sort((a, b) => a.order - b.order)
        .map((item, idx) => ({ ...item, order: idx }));
      const response = await saveDashboardWidgetsLayoutApi({ widgets: normalized });
      setLayout(normalizeLayout(normalizedRole, response?.widgets));
      setCustomizeMode(false);
      setWidgetModalOpen(false);
    } catch (error: any) {
      window.alert(error?.message || "Failed to save dashboard layout");
    } finally {
      setSaving(false);
    }
  };

  const renderPie = (data: Record<string, number>, colors: string[]) => {
    const entries = Object.entries(data);
    const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
    let cursor = 0;
    const segments = entries.map(([key, value], index) => {
      const start = cursor;
      const end = cursor + (value / total) * 360;
      cursor = end;
      return `${colors[index % colors.length]} ${start}deg ${end}deg`;
    });
    return (
      <div className="peachChartWrap">
        <div className="pieChart" style={{ background: `conic-gradient(${segments.join(", ")})` }} />
        <div className="pieLegend">
          {entries.map(([key, value]) => (
            <div key={key}>{key}: {value}</div>
          ))}
        </div>
      </div>
    );
  };

  const renderWidgetContent = (widgetId: string) => {
    if (widgetId === "total_users") return <div className="peachCardNumber">{adminUsers.length}</div>;
    if (widgetId === "active_projects") return <div className="peachCardNumber">{adminActiveProjectsByOwner}</div>;
    if (widgetId === "total_test_cases") return <div className="peachCardNumber">{testCases.length}</div>;
    if (widgetId === "system_activity_chart" || widgetId === "execution_trend" || widgetId === "bug_aging_chart") {
      return (
        <div className="miniBarChart">
          {trendBuckets.map((bucket) => (
            <div key={bucket.key} className="miniBarItem">
              <div className="miniBar" style={{ height: `${Math.max(8, Math.round((bucket.count / maxTrend) * 100))}%` }} />
              <span>{bucket.label}</span>
            </div>
          ))}
        </div>
      );
    }
    if (widgetId === "assigned_bugs_counter") return <div className="peachCardNumber">{devAssigned.length}</div>;
    if (widgetId === "critical_bugs_counter") return <div className="peachCardNumber">{devCriticalP1}</div>;
    if (widgetId === "bug_status_chart") {
      return renderPie(devStatus, ["#3b82f6", "#0ea5e9", "#f59e0b", "#22c55e", "#10b981", "#64748b"]);
    }
    if (widgetId === "pending_tests") return <div className="peachCardNumber">{testerPendingCount}</div>;
    if (widgetId === "recent_failures") return <div className="peachCardNumber">{testerRecentFailures}</div>;
    if (widgetId === "status_breakdown") {
      return renderPie(
        {
          PASSED: statusCounts.passed,
          FAILED: statusCounts.failed,
          BLOCKED: statusCounts.blocked,
        },
        ["#16a34a", "#dc2626", "#d97706"]
      );
    }
    return <div className="note">No data</div>;
  };

  return (
    <section className="dashboardWidgetsSaaS">
      <div className="dashboardWidgetsHeader">
        <h4>Dashboard</h4>
        <button className="button small" onClick={() => setWidgetModalOpen(true)}>
          Personal Dashboard Widgets
        </button>
      </div>

      {layoutQuery.isLoading || dataLoading ? (
        <p className="note">Loading dashboard...</p>
      ) : (
        <div className="dashboardCardsGrid">
          {orderedWidgets.map((item) => (
            <article className="peachStatCard" key={item.id}>
              <div className="peachCardLabel">{widgetMeta.get(item.id)?.title || item.id}</div>
              {renderWidgetContent(item.id)}
            </article>
          ))}
        </div>
      )}

      {widgetModalOpen ? (
        <div className="modalBackdrop">
          <div className="modalCard dashboardWidgetModal">
            <button className="closeModalBtn" onClick={() => setWidgetModalOpen(false)} aria-label="Close">
              ×
            </button>
            <h4 style={{ marginTop: 0 }}>Personal Dashboard Widgets</h4>
            <div className="toolbarActions" style={{ justifyContent: "flex-end", marginTop: 10 }}>
              <button className="button small" onClick={() => setCustomizeMode((prev) => !prev)}>
                {customizeMode ? "Close Customize" : "Customize Layout"}
              </button>
              <button className="button small" onClick={saveLayout} disabled={saving || !customizeMode}>
                {saving ? "Saving..." : "Save Layout"}
              </button>
            </div>
            <div className="listCompact" style={{ marginTop: 10 }}>
              {[...layout].sort((a, b) => a.order - b.order).map((item) => (
                <div key={item.id} className="row" style={{ marginBottom: 0, justifyContent: "space-between" }}>
                  <div>
                    <strong>{widgetMeta.get(item.id)?.title || item.id}</strong>
                    <div className="note"><StatusBadge value={item.visible ? "ACTIVE" : "HIDDEN"} /></div>
                  </div>
                  <div className="toolbarActions">
                    <label className="note" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={item.visible}
                        disabled={!customizeMode}
                        onChange={(e) => updateWidget(item.id, { visible: e.target.checked })}
                      />
                      Show
                    </label>
                    <select
                      className="input"
                      style={{ width: 120, marginBottom: 0 }}
                      disabled={!customizeMode}
                      value={item.size}
                      onChange={(e) => updateWidget(item.id, { size: e.target.value as WidgetSize })}
                    >
                      <option value="S">Small</option>
                      <option value="M">Medium</option>
                      <option value="L">Large</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default DashboardWidgetsBoard;



