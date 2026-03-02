import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardWidgetsLayoutApi, saveDashboardWidgetsLayoutApi } from "../../api";

type RoleName = "TESTER" | "DEVELOPER" | "ADMIN";
type WidgetSize = "S" | "M" | "L";
type WidgetType = "chart" | "table" | "counter" | "list";

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
  onNavigate: (key: string) => void;
};

const WIDGETS_BY_ROLE: Record<RoleName, Array<{ id: string; title: string; type: WidgetType }>> = {
  TESTER: [
    { id: "pending_tests", title: "My Pending Tests", type: "table" },
    { id: "recent_failures", title: "Recent Failures", type: "list" },
    { id: "execution_trend", title: "Execution Trend (7 Days)", type: "chart" },
    { id: "status_breakdown", title: "Test Status Breakdown", type: "chart" },
    { id: "quick_actions", title: "Quick Actions", type: "list" },
  ],
  DEVELOPER: [
    { id: "assigned_bugs_counter", title: "Assigned Bugs", type: "counter" },
    { id: "critical_bugs_counter", title: "Critical + P1", type: "counter" },
    { id: "bug_aging_chart", title: "Bug Aging (7 Days)", type: "chart" },
    { id: "bug_status_chart", title: "Bug Status Distribution", type: "chart" },
    { id: "recent_activity", title: "Recent Activity", type: "list" },
  ],
  ADMIN: [
    { id: "total_users", title: "Total Users", type: "counter" },
    { id: "active_projects", title: "Active Projects", type: "counter" },
    { id: "total_test_cases", title: "Total Test Cases", type: "counter" },
    { id: "system_activity_chart", title: "System Activity (7 Days)", type: "chart" },
    { id: "recent_audit_logs", title: "Recent Audit Logs", type: "table" },
  ],
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
    .map((item, index) => {
      const normalizedSize: WidgetSize = item.size === "S" || item.size === "L" ? item.size : "M";
      return {
      id: item.id,
      visible: item.visible !== false,
      order: Number.isFinite(item.order) ? item.order : index,
      size: normalizedSize,
    };})
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
  onNavigate,
}) => {
  const normalizedRole: RoleName = roleName === "DEVELOPER" || roleName === "ADMIN" ? roleName : "TESTER";
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(normalizeLayout(normalizedRole));
  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState("");
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

  const testerPending = useMemo(
    () => testCases.filter((item) => item.status === "DRAFT" || item.status === "READY_FOR_REVIEW").slice(0, 8),
    [testCases]
  );
  const recentFailures = useMemo(
    () =>
      executionReports
        .filter((item) => item.result === "FAILED")
        .sort((a, b) => new Date(b.executedAt || 0).getTime() - new Date(a.executedAt || 0).getTime())
        .slice(0, 6),
    [executionReports]
  );
  const trendBuckets = useMemo(() => {
    const base = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: "short" }), count: 0 };
    });
    executionReports.forEach((item) => {
      const key = new Date(item.executedAt || 0).toISOString().slice(0, 10);
      const row = base.find((b) => b.key === key);
      if (row) row.count += 1;
    });
    return base;
  }, [executionReports]);
  const maxTrend = Math.max(...trendBuckets.map((b) => b.count), 1);

  const statusCounts = useMemo(
    () => ({
      passed: executionReports.filter((item) => item.result === "PASSED").length,
      failed: executionReports.filter((item) => item.result === "FAILED").length,
      blocked: executionReports.filter((item) => item.result === "BLOCKED").length,
      skipped: executionReports.filter((item) => item.result === "SKIPPED").length,
    }),
    [executionReports]
  );

  const devAssigned = useMemo(
    () => bugs.filter((item) => String(item?.assignedTo || item?.assignee?.id || "") === currentUserId),
    [bugs, currentUserId]
  );
  const devCriticalP1 = useMemo(
    () =>
      devAssigned.filter(
        (item) => String(item?.severity || "").toUpperCase() === "CRITICAL" || String(item?.priority || "").toUpperCase() === "P1_URGENT"
      ).length,
    [devAssigned]
  );
  const devTrend = useMemo(() => {
    const base = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: "short" }), count: 0 };
    });
    devAssigned.forEach((item) => {
      const key = new Date(item.updatedAt || item.createdAt || 0).toISOString().slice(0, 10);
      const row = base.find((b) => b.key === key);
      if (row) row.count += 1;
    });
    return base;
  }, [devAssigned]);
  const devTrendMax = Math.max(...devTrend.map((b) => b.count), 1);

  const devStatus = useMemo(() => {
    const values = ["NEW", "OPEN", "IN_PROGRESS", "FIXED", "VERIFIED", "CLOSED"];
    return values.reduce<Record<string, number>>((acc, key) => {
      acc[key] = devAssigned.filter((item) => String(item?.workflowStatus || item?.status || "").toUpperCase() === key).length;
      return acc;
    }, {});
  }, [devAssigned]);

  const reorder = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    const sorted = [...layout].sort((a, b) => a.order - b.order);
    const fromIdx = sorted.findIndex((item) => item.id === fromId);
    const toIdx = sorted.findIndex((item) => item.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    setLayout(sorted.map((item, idx) => ({ ...item, order: idx })));
  };

  const updateWidget = (id: string, patch: Partial<WidgetLayoutItem>) => {
    setLayout((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const saveLayout = async () => {
    try {
      setSaving(true);
      const normalized = [...layout].sort((a, b) => a.order - b.order).map((item, idx) => ({ ...item, order: idx }));
      const response = await saveDashboardWidgetsLayoutApi({ widgets: normalized });
      setLayout(normalizeLayout(normalizedRole, response?.widgets));
      setEditMode(false);
    } catch (error: any) {
      window.alert(error?.message || "Failed to save dashboard layout");
    } finally {
      setSaving(false);
    }
  };

  const renderContent = (widgetId: string) => {
    if (widgetId === "pending_tests") {
      return (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Test Case</th>
                <th>Module</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {testerPending.length === 0 ? (
                <tr><td colSpan={3} className="note">No pending tests.</td></tr>
              ) : (
                testerPending.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.module || "General"}</td>
                    <td>{item.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    }
    if (widgetId === "recent_failures") {
      return (
        <div className="listCompact">
          {recentFailures.length === 0 ? <p className="note">No recent failures.</p> : recentFailures.map((row) => (
            <div className="row" key={row.id}>
              <strong>{row.testCase?.title || row.testCaseId}</strong>
              <div className="note">{new Date(row.executedAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      );
    }
    if (widgetId === "execution_trend" || widgetId === "system_activity_chart") {
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
    if (widgetId === "status_breakdown") {
      const total = statusCounts.passed + statusCounts.failed + statusCounts.blocked + statusCounts.skipped || 1;
      const pie = `conic-gradient(
      #16a34a 0deg ${(statusCounts.passed / total) * 360}deg,
      #dc2626 ${(statusCounts.passed / total) * 360}deg ${((statusCounts.passed + statusCounts.failed) / total) * 360}deg,
      #d97706 ${((statusCounts.passed + statusCounts.failed) / total) * 360}deg ${((statusCounts.passed + statusCounts.failed + statusCounts.blocked) / total) * 360}deg,
      #64748b ${((statusCounts.passed + statusCounts.failed + statusCounts.blocked) / total) * 360}deg 360deg
    )`;
      return (
        <div className="pieSection">
          <div className="pieChart" style={{ background: pie }} />
          <div className="pieLegend">
            <div>Passed: {statusCounts.passed}</div>
            <div>Failed: {statusCounts.failed}</div>
            <div>Blocked: {statusCounts.blocked}</div>
            <div>Skipped: {statusCounts.skipped}</div>
          </div>
        </div>
      );
    }
    if (widgetId === "quick_actions") {
      return (
        <div className="toolbarActions">
          <button className="button small" onClick={() => onNavigate("create_test_case")}>Create Test Case</button>
          <button className="button small" onClick={() => onNavigate("execute_tests")}>Execute Tests</button>
          <button className="button small" onClick={() => onNavigate("bug_management")}>Report Bug</button>
        </div>
      );
    }
    if (widgetId === "assigned_bugs_counter") {
      return <div className="dashboardCounterValue">{devAssigned.length}</div>;
    }
    if (widgetId === "critical_bugs_counter") {
      return <div className="dashboardCounterValue">{devCriticalP1}</div>;
    }
    if (widgetId === "bug_aging_chart") {
      return (
        <div className="miniBarChart">
          {devTrend.map((bucket) => (
            <div key={bucket.key} className="miniBarItem">
              <div className="miniBar bugAgingBar" style={{ height: `${Math.max(8, Math.round((bucket.count / devTrendMax) * 100))}%` }} />
              <span>{bucket.label}</span>
            </div>
          ))}
        </div>
      );
    }
    if (widgetId === "bug_status_chart") {
      const entries = Object.entries(devStatus);
      const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
      let cursor = 0;
      const colors = ["#3b82f6", "#0ea5e9", "#f59e0b", "#22c55e", "#10b981", "#64748b"];
      const segments = entries.map(([key, value], index) => {
        const start = cursor;
        const end = cursor + (value / total) * 360;
        cursor = end;
        return `${colors[index % colors.length]} ${start}deg ${end}deg`;
      });
      return (
        <div className="pieSection">
          <div className="pieChart" style={{ background: `conic-gradient(${segments.join(", ")})` }} />
          <div className="pieLegend">
            {entries.map(([key, value]) => <div key={key}>{key}: {value}</div>)}
          </div>
        </div>
      );
    }
    if (widgetId === "recent_activity") {
      return (
        <div className="listCompact">
          {devAssigned.slice(0, 6).map((item) => (
            <div className="row" key={item.id}>
              <strong>{item.title || item.bugId || item.id}</strong>
              <div className="note">{item.workflowStatus || item.status || "OPEN"}</div>
            </div>
          ))}
          {devAssigned.length === 0 && <p className="note">No assigned activity.</p>}
        </div>
      );
    }
    if (widgetId === "total_users") return <div className="dashboardCounterValue">{adminUsers.length}</div>;
    if (widgetId === "active_projects")
      return <div className="dashboardCounterValue">{adminProjects.filter((item) => item.isActive !== false).length}</div>;
    if (widgetId === "total_test_cases") return <div className="dashboardCounterValue">{testCases.length}</div>;
    if (widgetId === "recent_audit_logs") {
      return (
        <div className="listCompact">
          {adminAuditLogs.slice(0, 8).map((log: any) => (
            <div className="row" key={log.id}>
              <strong>{log.action || "ACTION"}</strong>
              <div className="note">{new Date(log.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {adminAuditLogs.length === 0 && <p className="note">No logs.</p>}
        </div>
      );
    }
    return <p className="note">Widget unavailable.</p>;
  };

  const widgetMeta = new Map(WIDGETS_BY_ROLE[normalizedRole].map((item) => [item.id, item]));

  return (
    <section className="panel dashboardWidgetsPanel">
      <div className="panelHeader">
        <div>
          <h4 style={{ marginBottom: 0 }}>Personal Dashboard Widgets</h4>
          <p className="note">Drag and drop cards to reorder. Your layout is saved per user.</p>
        </div>
        <div className="toolbarActions">
          <button className="button small" onClick={() => setEditMode((prev) => !prev)}>
            {editMode ? "Close Customize" : "Customize Layout"}
          </button>
          {editMode && (
            <button className="button small" onClick={saveLayout} disabled={saving}>
              {saving ? "Saving..." : "Save Layout"}
            </button>
          )}
        </div>
      </div>

      {editMode && (
        <div className="dashboardWidgetEditor">
          {[...layout].sort((a, b) => a.order - b.order).map((item) => (
            <div key={`edit-${item.id}`} className="dashboardWidgetEditorRow">
              <span>{widgetMeta.get(item.id)?.title || item.id}</span>
              <label>
                <input
                  type="checkbox"
                  checked={item.visible}
                  onChange={(event) => updateWidget(item.id, { visible: event.target.checked })}
                />
                Show
              </label>
              <select value={item.size} onChange={(event) => updateWidget(item.id, { size: event.target.value as WidgetSize })}>
                <option value="S">Small</option>
                <option value="M">Medium</option>
                <option value="L">Large</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {layoutQuery.isLoading ? (
        <p className="note">Loading widget layout...</p>
      ) : (
        <div className="dashboardWidgetGridDnD">
          {orderedWidgets.map((item) => {
            const sizeClass = item.size === "S" ? "sizeS" : item.size === "L" ? "sizeL" : "sizeM";
            return (
              <article
                key={item.id}
                className={`panel dashboardWidget ${sizeClass}`}
                draggable={editMode}
                onDragStart={() => setDragId(item.id)}
                onDragOver={(event) => {
                  if (!editMode) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!editMode) return;
                  event.preventDefault();
                  reorder(dragId, item.id);
                  setDragId("");
                }}
              >
                <div className="panelHeader">
                  <h4 style={{ marginBottom: 0 }}>{widgetMeta.get(item.id)?.title || item.id}</h4>
                  <span className="note widgetTypeBadge">{widgetMeta.get(item.id)?.type || "widget"}</span>
                </div>
                {renderContent(item.id)}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default DashboardWidgetsBoard;
