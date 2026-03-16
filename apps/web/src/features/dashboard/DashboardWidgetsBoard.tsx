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
  const [chartProgress, setChartProgress] = useState(0);
  const [chartHover, setChartHover] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (layoutQuery.isLoading || dataLoading) return;
    setChartProgress(0);
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - startedAt) / 700);
      setChartProgress(next);
      if (next < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [
    layoutQuery.isLoading,
    dataLoading,
    normalizedRole,
    testCases.length,
    executionReports.length,
    bugs.length,
    adminUsers.length,
    adminProjects.length,
    adminAuditLogs.length,
  ]);

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

  const getAssigneeId = (item: any): string =>
    String(item?.assignedTo || item?.assigneeId || item?.assignee?.id || item?.assignee?.userId || "").trim();

  const devAssigned = useMemo(
    () => bugs.filter((item) => getAssigneeId(item) && getAssigneeId(item) === currentUserId),
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

  const adminActiveProjects = useMemo(
    () => adminProjects.filter((item) => item?.isActive !== false).length,
    [adminProjects]
  );

  const adminExecutionStatus = useMemo(() => {
    return {
      PASSED: executionReports.filter((item) => String(item?.result || "").toUpperCase() === "PASSED").length,
      FAILED: executionReports.filter((item) => String(item?.result || "").toUpperCase() === "FAILED").length,
      BLOCKED: executionReports.filter((item) => String(item?.result || "").toUpperCase() === "BLOCKED").length,
      SKIPPED: executionReports.filter((item) => String(item?.result || "").toUpperCase() === "SKIPPED").length,
    };
  }, [executionReports]);

  const adminBugStatus = useMemo(() => {
    const values = ["NEW", "OPEN", "IN_PROGRESS", "FIXED", "VERIFIED", "CLOSED"];
    return values.reduce<Record<string, number>>((acc, key) => {
      acc[key] = bugs.filter((item) => String(item?.workflowStatus || item?.status || "").toUpperCase() === key).length;
      return acc;
    }, {});
  }, [bugs]);

  const adminTestCaseStatus = useMemo(() => {
    const values = ["DRAFT", "READY_FOR_REVIEW", "APPROVED", "DEPRECATED", "ARCHIVED"] as const;
    const counts = values.reduce<Record<string, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    testCases.forEach((item) => {
      const rawStatus = String(item?.status || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
      const normalizedStatus =
        rawStatus === "READY" || rawStatus === "READY_FOR_REVIEW" || rawStatus === "READY-FOR-REVIEW"
          ? "READY_FOR_REVIEW"
          : rawStatus;
      const key = values.find((value) => value === normalizedStatus);
      counts[key || "DRAFT"] += 1;
    });

    return counts;
  }, [testCases]);

  const adminPassRate = useMemo(() => {
    const total = executionReports.length || 1;
    return Math.round((adminExecutionStatus.PASSED / total) * 100);
  }, [adminExecutionStatus, executionReports.length]);

  const adminCriticalBugs = useMemo(
    () =>
      bugs.filter(
        (item) =>
          String(item?.severity || "").toUpperCase() === "CRITICAL" ||
          String(item?.priority || item?.bugPriority || "").toUpperCase() === "P1_URGENT"
      ).length,
    [bugs]
  );

  const adminModuleStats = useMemo(() => {
    const counts = new Map<string, number>();
    testCases.forEach((item) => {
      const key = String(item?.module || "General").trim() || "General";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [testCases]);

  const adminDeveloperWorkload = useMemo(() => {
    const developerMap = new Map<string, { label: string; value: number }>();
    adminUsers
      .filter((user) => String(user?.role || "").toUpperCase() === "DEVELOPER")
      .forEach((user) => {
        developerMap.set(String(user.id), {
          label: String(user?.name || "").trim() || String(user?.email || "").trim() || "Developer",
          value: 0,
        });
      });
    bugs.forEach((bug) => {
      const assigneeId = String(bug?.assignedTo || bug?.assignee?.id || "").trim();
      if (!assigneeId) return;
      const current = developerMap.get(assigneeId);
      if (current) {
        current.value += 1;
      } else {
        developerMap.set(assigneeId, {
          label: String(bug?.assignee?.name || bug?.assignee?.email || assigneeId),
          value: 1,
        });
      }
    });
    return Array.from(developerMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [adminUsers, bugs]);

  const adminRecentActivity = useMemo(() => {
    return [...adminAuditLogs]
      .slice(0, 5)
      .map((item: any) => ({
        id: String(item?.id || Math.random()),
        action: String(item?.action || "Unknown Action"),
        actor: String(item?.actor?.name || item?.user?.name || item?.actor?.email || item?.user?.email || "System"),
        at: item?.createdAt,
      }));
  }, [adminAuditLogs]);

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

  const polarToCartesian = (cx: number, cy: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (cx: number, cy: number, radius: number, startAngle: number, endAngle: number) => {
    const safeEnd = endAngle <= startAngle ? startAngle + 0.001 : endAngle;
    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, safeEnd);
    const largeArcFlag = safeEnd - startAngle <= 180 ? "0" : "1";
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  };

  const renderAdminPie = (chartKey: string, data: Record<string, number>, colors: string[]) => {
    const entries = Object.entries(data).filter(([, value]) => value > 0);
    if (entries.length === 0) {
      return <div className="note">No lifecycle data available.</div>;
    }
    const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
    let cursor = 0;
    const segments = entries.map(([key, value], index) => {
      const start = cursor;
      const end = cursor + ((value / total) * 360 * chartProgress);
      cursor = end;
      return {
        key,
        value,
        percent: Math.round((value / total) * 100),
        color: colors[index % colors.length],
        start,
        end,
      };
    });
    return (
      <div className="adminDashboardPieSection">
        <div className="adminDashboardPieWrap">
          <svg className="adminDashboardPieChart" viewBox="0 0 120 120" aria-label={chartKey}>
            <circle cx="60" cy="60" r="56" fill="#e2e8f0" />
            {segments.map((segment) => {
              const label = `${segment.key}: ${segment.value} (${segment.percent}%)`;
              return (
                <path
                  key={segment.key}
                  d={describeArc(60, 60, 56, segment.start, segment.end)}
                  fill={segment.color}
                  className="adminDashboardPieSlice"
                  onMouseEnter={() => setChartHover((prev) => ({ ...prev, [chartKey]: label }))}
                  onMouseLeave={() => setChartHover((prev) => ({ ...prev, [chartKey]: "" }))}
                  onPointerEnter={() => setChartHover((prev) => ({ ...prev, [chartKey]: label }))}
                  onPointerLeave={() => setChartHover((prev) => ({ ...prev, [chartKey]: "" }))}
                  onFocus={() => setChartHover((prev) => ({ ...prev, [chartKey]: label }))}
                  onBlur={() => setChartHover((prev) => ({ ...prev, [chartKey]: "" }))}
                >
                  <title>{label}</title>
                </path>
              );
            })}
          </svg>
          {chartHover[chartKey] ? <div className="adminDashboardHoverTag">{chartHover[chartKey]}</div> : null}
        </div>
        <div className="adminDashboardPieLegend">
          {entries.map(([key, value], index) => {
            const label = `${key}: ${value} (${Math.round((value / total) * 100)}%)`;
            return (
              <button
                key={key}
                type="button"
                className="adminDashboardPieLegendItem"
                onMouseEnter={() => setChartHover((prev) => ({ ...prev, [chartKey]: label }))}
                onMouseLeave={() => setChartHover((prev) => ({ ...prev, [chartKey]: "" }))}
                onPointerEnter={() => setChartHover((prev) => ({ ...prev, [chartKey]: label }))}
                onPointerLeave={() => setChartHover((prev) => ({ ...prev, [chartKey]: "" }))}
                onFocus={() => setChartHover((prev) => ({ ...prev, [chartKey]: label }))}
                onBlur={() => setChartHover((prev) => ({ ...prev, [chartKey]: "" }))}
              >
                <span className="adminDashboardPieLegendDot" style={{ background: colors[index % colors.length] }} />
                <span>{key}: {value}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTesterStatusPie = () => {
    const data = {
      PASSED: statusCounts.passed,
      FAILED: statusCounts.failed,
      BLOCKED: statusCounts.blocked,
      SKIPPED: testerReports.filter((item) => String(item?.result || "").toUpperCase() === "SKIPPED").length,
    };
    return renderAdminPie("tester-status-breakdown", data, ["#0f9d58", "#d7263d", "#ff8c00", "#4b5563"]);
  };

  const renderAdminBarList = (items: Array<{ label: string; value: number }>, fillClass: string) => {
    const maxValue = Math.max(...items.map((item) => item.value), 1);
    return (
      <div className="adminDashboardBarList">
        {items.length === 0 ? (
          <div className="note">No data available.</div>
        ) : (
          items.map((item) => (
            <div key={item.label} className="adminDashboardBarRow" title={`${item.label}: ${item.value}`}>
              <div className="adminDashboardBarLabel">{item.label}</div>
              <div className="adminDashboardBarTrack">
                <div
                  className={`adminDashboardBarFill ${fillClass}`}
                  style={{ width: `${Math.max(8, Math.round((item.value / maxValue) * 100) * chartProgress)}%` }}
                />
              </div>
              <div className="adminDashboardBarValue">{item.value}</div>
            </div>
          ))
        )}
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
      return renderAdminPie("developer-bug-status", devStatus, ["#0047ff", "#00a3a3", "#ff8c00", "#18a957", "#006d77", "#4b5563"]);
    }
    if (widgetId === "pending_tests") return <div className="peachCardNumber">{testerPendingCount}</div>;
    if (widgetId === "recent_failures") return <div className="peachCardNumber">{testerRecentFailures}</div>;
    if (widgetId === "status_breakdown") {
      return renderTesterStatusPie();
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
      ) : normalizedRole === "ADMIN" ? (
        <div className="adminDashboardContent">
          <div className="adminDashboardSummaryGrid">
            <article className="adminDashboardSummaryCard" title={`Total users: ${adminUsers.length}`}>
              <div className="adminDashboardSummaryLabel">Total Users</div>
              <div className="adminDashboardSummaryValue">{adminUsers.length}</div>
              <div className="adminDashboardSummarySub">All active roles in current scope</div>
            </article>
            <article className="adminDashboardSummaryCard" title={`Active projects: ${adminActiveProjects}`}>
              <div className="adminDashboardSummaryLabel">Active Projects</div>
              <div className="adminDashboardSummaryValue">{adminActiveProjects}</div>
              <div className="adminDashboardSummarySub">Owned by you: {adminActiveProjectsByOwner}</div>
            </article>
            <article className="adminDashboardSummaryCard" title={`Total test cases: ${testCases.length}`}>
              <div className="adminDashboardSummaryLabel">Total Test Cases</div>
              <div className="adminDashboardSummaryValue">{testCases.length}</div>
              <div className="adminDashboardSummarySub">Across current project scope</div>
            </article>
            <article className="adminDashboardSummaryCard" title={`Total executions: ${executionReports.length}`}>
              <div className="adminDashboardSummaryLabel">Executions</div>
              <div className="adminDashboardSummaryValue">{executionReports.length}</div>
              <div className="adminDashboardSummarySub">Pass rate: {adminPassRate}%</div>
            </article>
            <article className="adminDashboardSummaryCard adminDashboardSummaryCardFail" title={`Open bugs: ${bugs.length}`}>
              <div className="adminDashboardSummaryLabel">Bug Inventory</div>
              <div className="adminDashboardSummaryValue">{bugs.length}</div>
              <div className="adminDashboardSummarySub">Critical/P1: {adminCriticalBugs}</div>
            </article>
          </div>

          <div className="adminDashboardChartGrid">
            <section className="adminDashboardChartCard adminDashboardChartCardSquare">
              <h5 className="adminDashboardChartTitle">Execution Result Distribution</h5>
              {renderAdminPie("admin-execution", adminExecutionStatus, ["#0f9d58", "#d7263d", "#ff8c00", "#4b5563"])}
            </section>
            <section className="adminDashboardChartCard adminDashboardChartCardSquare">
              <h5 className="adminDashboardChartTitle">Bug Workflow Status</h5>
              {renderAdminPie("admin-bug-status", adminBugStatus, ["#0047ff", "#0096ff", "#ff8c00", "#0f9d58", "#006d77", "#4b5563"])}
            </section>
          </div>

          <div className="adminDashboardInlineGrid">
            <section className="adminDashboardChartCard">
              <h5 className="adminDashboardChartTitle">Module Coverage</h5>
              {renderAdminBarList(adminModuleStats, "module")}
            </section>
            <section className="adminDashboardChartCard">
              <h5 className="adminDashboardChartTitle">Developer Bug Load</h5>
              {renderAdminBarList(adminDeveloperWorkload, "priority")}
            </section>
          </div>

          <section className="adminDashboardChartCard">
            <h5 className="adminDashboardChartTitle">System Activity (7 Days)</h5>
            <div className="adminDashboardMiniBarChart">
              {trendBuckets.map((bucket) => (
                <div key={bucket.key} className="adminDashboardMiniBarItem" title={`${bucket.label}: ${bucket.count}`}>
                  <div
                    className="adminDashboardMiniBar"
                    style={{ height: `${Math.max(8, Math.round((bucket.count / maxTrend) * 100) * chartProgress)}%` }}
                  />
                  <span>{bucket.label}</span>
                  <strong>{bucket.count}</strong>
                </div>
              ))}
            </div>
          </section>

        </div>
      ) : (
        <div className="dashboardCardsGrid">
          {orderedWidgets.map((item) => (
            <article className={`peachStatCard ${item.id === "status_breakdown" ? "peachStatCardChart" : ""}`} key={item.id}>
              <div className="peachCardLabel">{widgetMeta.get(item.id)?.title || item.id}</div>
              {renderWidgetContent(item.id)}
            </article>
          ))}
        </div>
      )}

      {widgetModalOpen && normalizedRole !== "ADMIN" ? (
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
