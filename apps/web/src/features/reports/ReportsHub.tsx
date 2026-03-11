import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  compareExecutionApi,
  getBugReportSummaryApi,
  getExecutionHistoryApi,
  reexecuteExecutionApi,
} from "../../api";
import TestExecutionReportSection from "./TestExecutionReportSection";
import DeveloperPerformanceReportSection from "./DeveloperPerformanceReportSection";
import TesterPerformanceReportSection from "./TesterPerformanceReportSection";

type Props = {
  roleName: string;
  rolePermissions: string[];
  testRuns: any[];
  executionReports: any[];
  bugs: any[];
  assignedExecutionReports: any[];
  linkedCommitBugs: any[];
  onRefreshData?: () => Promise<void>;
  onOpenExecuteTests?: (execution: any) => Promise<void> | void;
};

type ReportKey =
  | "execution_summary"
  | "execution_history"
  | "failed_cases"
  | "tester_performance"
  | "developer_performance"
  | "bug_overview"
  | "assigned_reports"
  | "linked_commits";

type ReportOption = {
  key: ReportKey;
  label: string;
};

const ReportsHub: React.FC<Props> = ({
  roleName,
  rolePermissions,
  testRuns,
  executionReports,
  bugs,
  assignedExecutionReports,
  linkedCommitBugs,
  onRefreshData,
  onOpenExecuteTests,
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportKey>("execution_summary");
  const [historyExecution, setHistoryExecution] = useState<any | null>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [compareTargetId, setCompareTargetId] = useState("");
  const [compareData, setCompareData] = useState<any | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [executionActionNotice, setExecutionActionNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const hasPermission = (permission: string) => rolePermissions.includes(permission);

  const loadExecutionHistory = async (execution: any) => {
    setHistoryExecution(execution);
    setHistoryLoading(true);
    setHistoryError("");
    setCompareTargetId("");
    setCompareData(null);
    setExecutionActionNotice(null);
    try {
      const rows = await getExecutionHistoryApi(execution.id);
      setHistoryRows(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      setHistoryRows([]);
      setHistoryError(error?.message || "Failed to load execution history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeExecutionHistory = () => {
    setHistoryExecution(null);
    setHistoryRows([]);
    setHistoryLoading(false);
    setHistoryError("");
    setCompareTargetId("");
    setCompareData(null);
    setCompareLoading(false);
    setExecutionActionNotice(null);
  };

  const loadExecutionComparison = async (compareToId: string) => {
    if (!historyExecution?.id || !compareToId) {
      setCompareData(null);
      return;
    }
    setCompareLoading(true);
    setExecutionActionNotice(null);
    try {
      const data = await compareExecutionApi(historyExecution.id, compareToId);
      setCompareData(data);
      setCompareTargetId(compareToId);
    } catch (error: any) {
      setCompareData(null);
      setExecutionActionNotice({ type: "error", text: error?.message || "Execution comparison failed" });
    } finally {
      setCompareLoading(false);
    }
  };

  const handleReexecute = async (executionId: string) => {
    try {
      const restarted = await reexecuteExecutionApi(executionId, { notes: "Re-execution started from history" });
      setExecutionActionNotice({
        type: "success",
        text: `Re-execution started: ${restarted?.id || "draft created"}. Open Execute Tests to continue.`,
      });
      if (onRefreshData) {
        await onRefreshData();
      }
      if (historyExecution?.id) {
        const rows = await getExecutionHistoryApi(historyExecution.id);
        setHistoryRows(Array.isArray(rows) ? rows : []);
      }
      if (onOpenExecuteTests) {
        await onOpenExecuteTests(restarted);
      }
    } catch (error: any) {
      setExecutionActionNotice({ type: "error", text: error?.message || "Re-execution failed" });
    }
  };

  const reportOptions = useMemo<ReportOption[]>(() => {
    if (roleName === "ADMIN") {
      return [
        { key: "execution_summary", label: "Test Execution Report" },
        { key: "execution_history", label: "Execution History" },
        { key: "failed_cases", label: "Failed Test Cases" },
        { key: "tester_performance", label: "Tester Performance Report" },
        { key: "developer_performance", label: "Developer Performance Report" },
        { key: "assigned_reports", label: "Assigned Test Reports" },
        { key: "bug_overview", label: "Bug Overview" },
        { key: "linked_commits", label: "Linked Commits" },
      ];
    }

    const options: ReportOption[] = [{ key: "execution_summary", label: "Test Execution Report" }];
    const canSeeExecutionHistory = roleName === "ADMIN" || roleName === "TESTER";
    const canSeeTesterPerformance = roleName === "ADMIN" || roleName === "TESTER" || roleName === "DEVELOPER";
    const canSeeBugOverview =
      hasPermission("Bug Management") || hasPermission("My Assigned Bugs") || hasPermission("All Bugs");
    const canSeeDeveloperPerformance = roleName === "ADMIN" || roleName === "TESTER" || roleName === "DEVELOPER";
    const canSeeAssignedReports = roleName === "DEVELOPER" || roleName === "ADMIN";
    const canSeeLinkedCommits = roleName === "DEVELOPER" || roleName === "ADMIN";

    if (canSeeExecutionHistory) {
      options.push({ key: "execution_history", label: "Execution History" });
      options.push({ key: "failed_cases", label: "Failed Test Cases" });
    }
    if (canSeeTesterPerformance) {
      options.push({ key: "tester_performance", label: "Tester Performance Report" });
    }
    if (canSeeAssignedReports) {
      options.push({ key: "assigned_reports", label: "Assigned Test Reports" });
    }
    if (canSeeDeveloperPerformance) {
      options.push({ key: "developer_performance", label: "Developer Performance Report" });
    }
    if (canSeeBugOverview) {
      options.push({ key: "bug_overview", label: "Bug Overview" });
    }
    if (canSeeLinkedCommits) {
      options.push({ key: "linked_commits", label: "Linked Commits" });
    }
    return options;
  }, [roleName, rolePermissions]);

  useEffect(() => {
    if (!reportOptions.some((item) => item.key === selectedReport)) {
      setSelectedReport(reportOptions[0]?.key || "execution_summary");
    }
  }, [reportOptions, selectedReport]);

  const failedRows = useMemo(
    () => executionReports.filter((item) => String(item?.result || "").toUpperCase() === "FAILED"),
    [executionReports]
  );
  const bugReportQuery = useQuery<any, Error>({
    queryKey: ["bug-report-summary"],
    queryFn: () => getBugReportSummaryApi(),
    keepPreviousData: true,
  });
  const bugSummary = bugReportQuery.data;
  const bugStatusBars = useMemo(() => {
    const rows = (bugSummary?.totalByStatus || []) as Array<{ status: string; total: number }>;
    const maxTotal = rows.reduce((max, item) => Math.max(max, Number(item.total || 0)), 0) || 1;
    return rows.map((item) => ({
      label: item.status,
      total: Number(item.total || 0),
      widthPct: Math.max(8, Math.round((Number(item.total || 0) / maxTotal) * 100)),
    }));
  }, [bugSummary]);
  const bugDeveloperBars = useMemo(() => {
    const rows = (bugSummary?.byDeveloper || []) as Array<{ developerName: string; total: number }>;
    const maxTotal = rows.reduce((max, item) => Math.max(max, Number(item.total || 0)), 0) || 1;
    return rows.map((item) => ({
      label: item.developerName || "Unassigned",
      total: Number(item.total || 0),
      widthPct: Math.max(8, Math.round((Number(item.total || 0) / maxTotal) * 100)),
    }));
  }, [bugSummary]);
  const bugSeverityBars = useMemo(() => {
    const rows = (bugSummary?.bySeverity || []) as Array<{ severity: string; total: number }>;
    const maxTotal = rows.reduce((max, item) => Math.max(max, Number(item.total || 0)), 0) || 1;
    return rows.map((item) => ({
      label: item.severity,
      total: Number(item.total || 0),
      heightPct: Math.max(8, Math.round((Number(item.total || 0) / maxTotal) * 100)),
    }));
  }, [bugSummary]);
  const bugPriorityBars = useMemo(() => {
    const rows = (bugSummary?.byPriority || []) as Array<{ priority: string; total: number }>;
    const maxTotal = rows.reduce((max, item) => Math.max(max, Number(item.total || 0)), 0) || 1;
    return rows.map((item) => ({
      label: item.priority,
      total: Number(item.total || 0),
      widthPct: Math.max(8, Math.round((Number(item.total || 0) / maxTotal) * 100)),
    }));
  }, [bugSummary]);
  const bugAgingBars = useMemo(() => {
    const rows = Object.entries(bugSummary?.bugAging || {}).map(([bucket, total]) => ({
      label: `${bucket}d`,
      total: Number(total || 0),
    }));
    const maxTotal = rows.reduce((max, item) => Math.max(max, item.total), 0) || 1;
    return rows.map((item) => ({
      ...item,
      heightPct: Math.max(8, Math.round((item.total / maxTotal) * 100)),
    }));
  }, [bugSummary]);
  const bugStatusDonut = useMemo(() => {
    const rows = (bugSummary?.totalByStatus || []) as Array<{ status: string; total: number }>;
    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    if (!total) {
      return "conic-gradient(#cbd5e1 0deg 360deg)";
    }
    const palette = ["#2563eb", "#ef4444", "#f59e0b", "#22c55e", "#6b7280", "#14b8a6", "#a855f7"];
    let cursor = 0;
    const segments = rows.map((row, idx) => {
      const angle = (Number(row.total || 0) / total) * 360;
      const start = cursor;
      const end = cursor + angle;
      cursor = end;
      return `${palette[idx % palette.length]} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }, [bugSummary]);
  const bugTrendPoints = useMemo(() => {
    const rows = (bugSummary?.trendsOverTime || []) as Array<{ date: string; created: number; resolved: number }>;
    const maxTotal =
      rows.reduce((max, item) => Math.max(max, Number(item.created || 0), Number(item.resolved || 0)), 0) || 1;
    return rows.map((item, index) => {
      const x = rows.length === 1 ? 0 : (index / (rows.length - 1)) * 100;
      const createdY = 100 - (Number(item.created || 0) / maxTotal) * 100;
      const resolvedY = 100 - (Number(item.resolved || 0) / maxTotal) * 100;
      return {
        x,
        createdY,
        resolvedY,
        date: item.date,
        created: Number(item.created || 0),
        resolved: Number(item.resolved || 0),
      };
    });
  }, [bugSummary]);

  return (
    <section className="panel reportsHubPanel">
      <h4>Reports</h4>
      <div className="reportsHubLayout">
        <aside className="reportsHubNav">
          {reportOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`reportsHubNavItem ${selectedReport === option.key ? "active" : ""}`}
              onClick={() => setSelectedReport(option.key)}
            >
              {option.label}
            </button>
          ))}
        </aside>
        <div className="reportsHubContent">
          {selectedReport === "execution_summary" && (
            <TestExecutionReportSection testRuns={testRuns} roleName={roleName} />
          )}
          {selectedReport === "tester_performance" && <TesterPerformanceReportSection roleName={roleName} />}

          {selectedReport === "execution_history" && (
            <section className="panel">
              {!historyExecution ? (
                <>
                  <h4>Execution History</h4>
                  <div className="tableWrap adminUsersTableWrap">
                    <table className="table adminUsersTable">
                      <thead>
                        <tr>
                          <th>Execution</th>
                          <th>Result</th>
                          <th>Executor</th>
                          <th>Executed At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executionReports.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="note">No execution reports.</td>
                          </tr>
                        ) : (
                          executionReports.map((item) => (
                            <tr key={item.id}>
                              <td className="truncateCell">
                                {item.testCase?.testCaseCode || item.testCaseId || item.id}
                                {" | "}
                                {item.testCase?.title || "Untitled"}
                              </td>
                              <td>{item.result || "N/A"}</td>
                              <td>{item.executor?.name || item.executor?.email || item.executedBy || "N/A"}</td>
                              <td>{item.executedAt ? new Date(item.executedAt).toLocaleString() : "N/A"}</td>
                              <td>
                                <button className="button small" onClick={() => loadExecutionHistory(item)}>
                                  Open
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : compareData ? (
                <div className="executionComparePage">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <h4 style={{ margin: 0 }}>Execution Comparison</h4>
                      <div className="note">
                        {historyExecution?.testCase?.testCaseCode || historyExecution?.testCaseId || historyExecution?.id}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        className="button small"
                        onClick={() => {
                          setCompareData(null);
                          setCompareTargetId("");
                        }}
                      >
                        Back To History
                      </button>
                      <button className="button small danger" onClick={closeExecutionHistory}>
                        Back To Reports
                      </button>
                    </div>
                  </div>
                  {executionActionNotice ? (
                    <div className={`reportCompareNotice ${executionActionNotice.type}`}>{executionActionNotice.text}</div>
                  ) : null}
                  <div className="reportSummaryGrid" style={{ marginBottom: 12 }}>
                    <div className="reportCard">
                      <div className="reportCardLabel">Current Result</div>
                      <div className="reportCardValue">{compareData?.current?.result || "N/A"}</div>
                      <div className="reportCardSub">{compareData?.current?.executedAt ? new Date(compareData.current.executedAt).toLocaleString() : "N/A"}</div>
                    </div>
                    <div className="reportCard">
                      <div className="reportCardLabel">Previous Result</div>
                      <div className="reportCardValue">{compareData?.previous?.result || "N/A"}</div>
                      <div className="reportCardSub">{compareData?.previous?.executedAt ? new Date(compareData.previous.executedAt).toLocaleString() : "N/A"}</div>
                    </div>
                    <div className="reportCard">
                      <div className="reportCardLabel">Current Duration</div>
                      <div className="reportCardValue">
                        {typeof compareData?.current?.durationSeconds === "number" ? `${compareData.current.durationSeconds}s` : "N/A"}
                      </div>
                      <div className="reportCardSub">{compareData?.current?.id || "N/A"}</div>
                    </div>
                    <div className="reportCard">
                      <div className="reportCardLabel">Previous Duration</div>
                      <div className="reportCardValue">
                        {typeof compareData?.previous?.durationSeconds === "number" ? `${compareData.previous.durationSeconds}s` : "N/A"}
                      </div>
                      <div className="reportCardSub">{compareData?.previous?.id || compareTargetId || "N/A"}</div>
                    </div>
                  </div>
                  <section className="reportCompareHero">
                    <div>
                      <div className="reportCardLabel">Comparison Focus</div>
                      <h5>Side-by-side step result review</h5>
                      <p>
                        Use this page to inspect what changed between the latest run and the selected previous run before re-executing.
                      </p>
                    </div>
                  </section>
                  <div className="tableWrap adminUsersTableWrap">
                    <table className="table adminUsersTable reportCompareTable">
                      <thead>
                        <tr>
                          <th>Step</th>
                          <th>Action</th>
                          <th>Expected</th>
                          <th>Current Status</th>
                          <th>Current Result</th>
                          <th>Previous Status</th>
                          <th>Previous Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(compareData?.steps || []).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="note">No step comparison available.</td>
                          </tr>
                        ) : (
                          (compareData.steps || []).map((step: any) => {
                            const changed =
                              String(step.current?.status || "") !== String(step.previous?.status || "") ||
                              String(step.current?.actualResult || step.current?.notes || "") !==
                                String(step.previous?.actualResult || step.previous?.notes || "");
                            return (
                              <tr key={step.stepNumber} className={changed ? "reportCompareChangedRow" : ""}>
                                <td>{step.stepNumber}</td>
                                <td className="truncateCell">{step.action || "-"}</td>
                                <td className="truncateCell">{step.expectedResult || "-"}</td>
                                <td>{step.current?.status || "NOT_EXECUTED"}</td>
                                <td className="truncateCell">{step.current?.actualResult || step.current?.notes || "-"}</td>
                                <td>{step.previous?.status || "NOT_EXECUTED"}</td>
                                <td className="truncateCell">{step.previous?.actualResult || step.previous?.notes || "-"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="executionHistoryPage">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <h4 style={{ margin: 0 }}>Execution History</h4>
                      <div className="note">
                        {historyExecution?.testCase?.testCaseCode || historyExecution?.testCaseId || historyExecution?.id}
                      </div>
                    </div>
                    <button className="button small danger" onClick={closeExecutionHistory}>
                      Back To Reports
                    </button>
                  </div>
                  {executionActionNotice ? (
                    <div className={`reportCompareNotice ${executionActionNotice.type}`}>{executionActionNotice.text}</div>
                  ) : null}
                  <section className="reportCompareHero">
                    <div>
                      <div className="reportCardLabel">Execution Chain</div>
                      <h5>Review previous runs before comparing</h5>
                      <p>Choose a previous execution to compare against the currently selected run, or start a re-execution directly.</p>
                    </div>
                  </section>
                  {historyLoading ? <div className="note">Loading execution history...</div> : null}
                  {historyError ? <div className="reportCompareNotice error">{historyError}</div> : null}
                  {!historyLoading && !historyError ? (
                    <div className="tableWrap adminUsersTableWrap">
                      <table className="table adminUsersTable">
                        <thead>
                          <tr>
                            <th>Execution</th>
                            <th>Result</th>
                            <th>Executor</th>
                            <th>Executed At</th>
                            <th>Duration</th>
                            <th>Re-execution Of</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyRows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="note">No previous executions found.</td>
                            </tr>
                          ) : (
                            historyRows.map((row) => (
                              <tr key={row.id}>
                                <td className="truncateCell">{row.id}</td>
                                <td>{row.result || "N/A"}</td>
                                <td>{row.executor?.name || row.executor?.email || "N/A"}</td>
                                <td>{row.executedAt ? new Date(row.executedAt).toLocaleString() : "N/A"}</td>
                                <td>{typeof row?.timer?.durationSeconds === "number" ? `${row.timer.durationSeconds}s` : "N/A"}</td>
                                <td className="truncateCell">{row.reexecutionOfId || "-"}</td>
                                <td>
                                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                    <button
                                      className="button small"
                                      disabled={row.id === historyExecution.id}
                                      onClick={() => loadExecutionComparison(row.id)}
                                    >
                                      Compare
                                    </button>
                                    <button className="button small" onClick={() => handleReexecute(row.id)}>
                                      Re-execute
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          )}

          {selectedReport === "failed_cases" && (
            <section className="panel">
              <h4>Failed Test Cases</h4>
              <div className="tableWrap adminUsersTableWrap">
                <table className="table adminUsersTable">
                  <thead>
                    <tr>
                      <th>Test Case</th>
                      <th>Module</th>
                      <th>Executor</th>
                      <th>Executed At</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="note">No failed test cases.</td>
                      </tr>
                    ) : (
                      failedRows.map((item) => (
                        <tr key={item.id}>
                          <td className="truncateCell">
                            {item.testCase?.testCaseCode || item.testCaseId || item.id}
                            {" | "}
                            {item.testCase?.title || "Untitled"}
                          </td>
                          <td>{item.testCase?.module || "General"}</td>
                          <td>{item.executor?.name || item.executor?.email || item.executedBy || "N/A"}</td>
                          <td>{item.executedAt ? new Date(item.executedAt).toLocaleString() : "N/A"}</td>
                          <td className="truncateCell">{item.notes || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {selectedReport === "assigned_reports" && (
            <section className="panel">
              <h4>Assigned Test Reports</h4>
              <div className="tableWrap adminUsersTableWrap">
                <table className="table adminUsersTable">
                  <thead>
                    <tr>
                      <th>Execution</th>
                      <th>Result</th>
                      <th>Executor</th>
                      <th>Executed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedExecutionReports.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="note">No assigned test reports.</td>
                      </tr>
                    ) : (
                      assignedExecutionReports.map((item) => (
                        <tr key={item.id}>
                          <td className="truncateCell">
                            {item.testCase?.testCaseCode || item.testCaseId || item.id}
                            {" | "}
                            {item.testCase?.title || "Untitled"}
                          </td>
                          <td>{item.result || "N/A"}</td>
                          <td>{item.executor?.name || item.executor?.email || item.executedBy || "N/A"}</td>
                          <td>{item.executedAt ? new Date(item.executedAt).toLocaleString() : "N/A"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {selectedReport === "developer_performance" && <DeveloperPerformanceReportSection roleName={roleName} />}

          {selectedReport === "bug_overview" && (
            <section className="panel">
              <h4>Bug Overview</h4>
              {bugReportQuery.isLoading || bugReportQuery.isFetching ? (
                <div className="note">Loading bug analytics...</div>
              ) : bugReportQuery.isError ? (
                <div className="reportErrorState">
                  <strong>Could not load bug report.</strong>
                  <p>{bugReportQuery.error?.message || "Unknown error"}</p>
                  <button className="button small" onClick={() => bugReportQuery.refetch()}>
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="kpiRow" style={{ marginBottom: "10px" }}>
                    <div className="kpiItem">
                      <strong>Total Bugs</strong>
                      <span>{Number(bugSummary?.totalBugs || 0)}</span>
                    </div>
                    <div className="kpiItem">
                      <strong>Avg Resolution (Days)</strong>
                      <span>{Number(bugSummary?.resolutionTime?.averageDays || 0).toFixed(2)}</span>
                    </div>
                    <div className="kpiItem">
                      <strong>Resolved Count</strong>
                      <span>{Number(bugSummary?.resolutionTime?.resolvedCount || 0)}</span>
                    </div>
                  </div>

                  <div className="tableWrap adminUsersTableWrap">
                    <h5 style={{ margin: "8px 0" }}>Status (Donut Chart)</h5>
                    <div className="reportMetricNote">Metric: Status</div>
                    <div className="pieSection">
                      <div className="pieChart" style={{ background: bugStatusDonut }} />
                      <div className="pieLegend">
                        {bugStatusBars.length === 0 ? (
                          <div>No status data.</div>
                        ) : (
                          bugStatusBars.map((row) => (
                            <div key={`bug-status-${row.label}`}>{row.label}: {row.total}</div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="tableWrap adminUsersTableWrap">
                    <h5 style={{ margin: "8px 0" }}>Aging (Vertical Bar)</h5>
                    <div className="reportMetricNote">Metric: Aging</div>
                    <div className="miniBarChart">
                      {bugAgingBars.length === 0 ? (
                        <div className="note">No aging data.</div>
                      ) : (
                        bugAgingBars.map((item) => (
                          <div key={`aging-bar-${item.label}`} className="miniBarItem">
                            <div className="miniBar agingBar" style={{ height: `${item.heightPct}%` }} />
                            <span>{item.label}</span>
                            <strong>{item.total}</strong>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="inlineGrid">
                    <div className="tableWrap adminUsersTableWrap">
                      <h5 style={{ margin: "8px 0" }}>Severity (Vertical Bar)</h5>
                      <div className="reportMetricNote">Metric: Severity</div>
                      <div className="miniBarChart">
                        {bugSeverityBars.length === 0 ? (
                          <div className="note">No severity data.</div>
                        ) : (
                          bugSeverityBars.map((item) => (
                            <div key={`severity-bar-${item.label}`} className="miniBarItem">
                              <div className="miniBar severityBar" style={{ height: `${item.heightPct}%` }} />
                              <span>{item.label}</span>
                            <strong>{item.total}</strong>
                          </div>
                        ))
                      )}
                    </div>
                    </div>

                    <div className="tableWrap adminUsersTableWrap">
                      <h5 style={{ margin: "8px 0" }}>Priority (Horizontal Bar)</h5>
                      <div className="reportMetricNote">Metric: Priority</div>
                      <div className="reportBarList">
                        {bugPriorityBars.length === 0 ? (
                          <div className="note">No priority data.</div>
                        ) : (
                          bugPriorityBars.map((item) => (
                            <div key={`priority-bar-${item.label}`} className="reportBarRow">
                              <div className="reportBarLabel">{item.label}</div>
                              <div className="reportBarTrack">
                                <div className="reportBarFill priority" style={{ width: `${item.widthPct}%` }} />
                              </div>
                              <div className="reportBarValue">{item.total}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="tableWrap adminUsersTableWrap">
                    <h5 style={{ margin: "8px 0" }}>Developer Load (Horizontal Bar)</h5>
                    <div className="reportMetricNote">Metric: Developer Load</div>
                    <div className="reportBarList">
                      {bugDeveloperBars.length === 0 ? (
                        <div className="note">No developer data.</div>
                      ) : (
                        bugDeveloperBars.map((item) => (
                          <div key={item.label} className="reportBarRow">
                            <div className="reportBarLabel">{item.label}</div>
                            <div className="reportBarTrack">
                              <div className="reportBarFill module" style={{ width: `${item.widthPct}%` }} />
                            </div>
                            <div className="reportBarValue">{item.total}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="tableWrap adminUsersTableWrap">
                    <h5 style={{ margin: "8px 0" }}>Trends (Line Chart)</h5>
                    <div className="reportMetricNote">Metric: Trends</div>
                    <div className="reportTimelineWrap" style={{ marginBottom: "10px" }}>
                      {bugTrendPoints.length === 0 ? (
                        <div className="note">No trend data.</div>
                      ) : (
                        <>
                          <svg viewBox="0 0 100 100" className="reportTimelineChart" preserveAspectRatio="none">
                            <polyline
                              points={bugTrendPoints.map((point) => `${point.x},${point.createdY}`).join(" ")}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth={2}
                            />
                            <polyline
                              points={bugTrendPoints.map((point) => `${point.x},${point.resolvedY}`).join(" ")}
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth={2}
                            />
                          </svg>
                          <div className="reportDualLegend">
                            <span><span className="legendDot failed" /> Created</span>
                            <span><span className="legendDot passed" /> Resolved</span>
                          </div>
                          <div className="reportTimelineLegend">
                            {bugTrendPoints.map((point) => (
                              <div key={`bug-trend-${point.date}`} className="reportTimelineLegendItem">
                                <span>{point.date}</span>
                                <strong>C:{point.created} | R:{point.resolved}</strong>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {selectedReport === "linked_commits" && (
            <section className="panel">
              <h4>Linked Commits</h4>
              <div className="tableWrap adminUsersTableWrap">
                <table className="table adminUsersTable">
                  <thead>
                    <tr>
                      <th>Bug</th>
                      <th>Commit</th>
                      <th>Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedCommitBugs.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="note">No linked commits.</td>
                      </tr>
                    ) : (
                      linkedCommitBugs.map((item) => (
                        <tr key={item.id}>
                          <td className="truncateCell">{item.bugCode || item.id} | {item.title || "Untitled"}</td>
                          <td className="truncateCell">{item.commitLink || "-"}</td>
                          <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "N/A"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
};

export default ReportsHub;
