import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { exportTestExecutionReportApi, getTestExecutionReportSummaryApi, listProjectsApi } from "../../api";

type Props = {
  testRuns: any[];
  roleName: string;
};

type ReportFilters = {
  projectId?: string;
  testRunId?: string;
  from?: string;
  to?: string;
};

type ReportSummary = {
  runName?: string;
  period?: {
    from?: string;
    to?: string;
  };
  totalExecuted?: number;
  passRate?: number;
  breakdown?: {
    passed?: number;
    failed?: number;
    blocked?: number;
    skipped?: number;
  };
  executionByTester?: Array<{
    testerId: string;
    testerName: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
  }>;
  executionTimeline?: Array<{
    date: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
  }>;
  executionByModule?: Array<{
    module: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
  }>;
  topFailedModules?: Array<{
    rank: number;
    module: string;
    failures: number;
  }>;
  executionByTestRun?: Array<{
    testRunId: string;
    testRunName: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    passRate: number;
  }>;
  failedTestCases?: Array<{
    executionId: string;
    testCaseId: string;
    testCaseCode?: string;
    testCaseTitle?: string;
    module?: string;
    tester?: string;
    executedAt?: string;
    notes?: string;
  }>;
};

const toPercent = (value: number, total: number) =>
  total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;

const chartPalette = {
  passed: "#22c55e",
  failed: "#ef4444",
  blocked: "#f59e0b",
  skipped: "#6b7280",
};

type TesterBarPoint = {
  label: string;
  total: number;
  heightPct: number;
};

type TimelinePoint = {
  x: number;
  y: number;
  label: string;
  total: number;
};

type ExecutionByTesterRow = NonNullable<ReportSummary["executionByTester"]>[number];
type ExecutionTimelineRow = NonNullable<ReportSummary["executionTimeline"]>[number];
type ExecutionByModuleRow = NonNullable<ReportSummary["executionByModule"]>[number];

const TestExecutionReportSection: React.FC<Props> = ({ testRuns, roleName }) => {
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({});
  const [exporting, setExporting] = useState<"" | "csv" | "excel" | "pdf">("");

  const reportQuery = useQuery<ReportSummary, Error>({
    queryKey: ["test-execution-summary", appliedFilters],
    queryFn: () => getTestExecutionReportSummaryApi(appliedFilters),
    keepPreviousData: true,
  });
  const projectsQuery = useQuery<any[], Error>({
    queryKey: ["projects-for-reports"],
    queryFn: () => listProjectsApi(),
    keepPreviousData: true,
  });

  const report = reportQuery.data;

  const breakdown = useMemo(() => {
    const total = Number(report?.totalExecuted || 0);
    const passed = Number(report?.breakdown?.passed || 0);
    const failed = Number(report?.breakdown?.failed || 0);
    const blocked = Number(report?.breakdown?.blocked || 0);
    const skipped = Number(report?.breakdown?.skipped || 0);
    const pct = (value: number) => (total > 0 ? ((value / total) * 100).toFixed(1) : "0.0");
    return {
      total,
      passed,
      failed,
      blocked,
      skipped,
      passRate: Number(report?.passRate || 0).toFixed(1) + "%",
      passedPct: pct(passed) + "%",
      failedPct: pct(failed) + "%",
      blockedPct: pct(blocked) + "%",
      skippedPct: pct(skipped) + "%",
    };
  }, [report]);

  const pieSegments = useMemo(() => {
    const total = Math.max(breakdown.total, 1);
    const passedAngle = (breakdown.passed / total) * 360;
    const failedAngle = (breakdown.failed / total) * 360;
    const blockedAngle = (breakdown.blocked / total) * 360;
    const skippedAngle = 360 - passedAngle - failedAngle - blockedAngle;
    return `conic-gradient(
      ${chartPalette.passed} 0deg ${passedAngle}deg,
      ${chartPalette.failed} ${passedAngle}deg ${passedAngle + failedAngle}deg,
      ${chartPalette.blocked} ${passedAngle + failedAngle}deg ${passedAngle + failedAngle + blockedAngle}deg,
      ${chartPalette.skipped} ${passedAngle + failedAngle + blockedAngle}deg ${passedAngle + failedAngle + blockedAngle + skippedAngle}deg
    )`;
  }, [breakdown]);

  const testerBars = useMemo<TesterBarPoint[]>(() => {
    const rows: ExecutionByTesterRow[] = report?.executionByTester || [];
    const maxTotal =
      rows.reduce((max: number, item: ExecutionByTesterRow) => {
        return Math.max(max, Number(item.total || 0));
      }, 0) || 1;
    return rows.map((item: ExecutionByTesterRow) => ({
      label: item.testerName || "Unknown",
      total: Number(item.total || 0),
      heightPct: Math.max(8, Math.round((Number(item.total || 0) / maxTotal) * 100)),
    }));
  }, [report]);

  const timelinePoints = useMemo<TimelinePoint[]>(() => {
    const rows: ExecutionTimelineRow[] = report?.executionTimeline || [];
    const maxTotal =
      rows.reduce((max: number, item: ExecutionTimelineRow) => {
        return Math.max(max, Number(item.total || 0));
      }, 0) || 1;
    return rows.map((item: ExecutionTimelineRow, index: number) => {
      const x = rows.length === 1 ? 0 : (index / (rows.length - 1)) * 100;
      const y = 100 - (Number(item.total || 0) / maxTotal) * 100;
      return {
        x,
        y,
        label: item.date,
        total: Number(item.total || 0),
      };
    });
  }, [report]);

  const moduleBars = useMemo(() => {
    const rows: ExecutionByModuleRow[] = report?.executionByModule || [];
    const maxTotal =
      rows.reduce((max: number, item: ExecutionByModuleRow) => {
        return Math.max(max, Number(item.total || 0));
      }, 0) || 1;
    return rows.map((item) => ({
      label: item.module || "General",
      total: Number(item.total || 0),
      passed: Number(item.passed || 0),
      failed: Number(item.failed || 0),
      blocked: Number(item.blocked || 0),
      skipped: Number(item.skipped || 0),
      widthPct: Math.max(6, Math.round((Number(item.total || 0) / maxTotal) * 100)),
    }));
  }, [report]);

  const linePath = useMemo(() => {
    if (timelinePoints.length === 0) return "";
    return timelinePoints
      .map((point: TimelinePoint, index: number) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }, [timelinePoints]);

  const applyFilters = () => {
    const nextFilters = {
      projectId: selectedProjectId || undefined,
      testRunId: selectedRunId || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    };
    setAppliedFilters(nextFilters);
    // Clear filter controls after generating report as requested.
    setSelectedRunId("");
    setSelectedProjectId("");
    setFromDate("");
    setToDate("");
  };

  const resetAndRefresh = async () => {
    setSelectedRunId("");
    setSelectedProjectId("");
    setFromDate("");
    setToDate("");
    setAppliedFilters({});
    await reportQuery.refetch();
  };

  const exportReport = async (format: "csv" | "excel" | "pdf") => {
    try {
      setExporting(format);
      const blob = await exportTestExecutionReportApi(format, appliedFilters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `test-execution-report.${format === "excel" ? "xls" : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      window.alert(error?.message || "Export failed");
    } finally {
      setExporting("");
    }
  };

  const isLoading = reportQuery.isLoading || reportQuery.isFetching;

  return (
    <section className="panel reportPanel">
      <div className="reportPanelHeader">
        <h4 style={{ margin: 0 }}>Test Execution Report (FR-RPT-001)</h4>
        <div className="toolbarActions">
          <button className="button small" onClick={() => exportReport("pdf")} disabled={exporting !== ""}>
            {exporting === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
          <button className="button small" onClick={() => exportReport("excel")} disabled={exporting !== ""}>
            {exporting === "excel" ? "Exporting..." : "Export Excel"}
          </button>
          <button className="button small" onClick={() => exportReport("csv")} disabled={exporting !== ""}>
            {exporting === "csv" ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>
      <div className="inlineGrid">
        <select className="input" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
          {roleName === "ADMIN" ? <option value="">All Projects</option> : null}
          {(projectsQuery.data || []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select className="input" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
          <option value="">All Test Runs</option>
          {testRuns.map((run) => (
            <option key={run.id} value={run.id}>
              {run.name}
            </option>
          ))}
        </select>
        <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </div>
      <div className="inlineGrid">
        <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <div className="toolbarActions">
          <button className="button small" onClick={applyFilters} disabled={isLoading}>
            {isLoading ? "Loading..." : "Generate Report"}
          </button>
          <button className="button small" onClick={resetAndRefresh} disabled={isLoading}>
            Reset & Refresh
          </button>
        </div>
      </div>

      {reportQuery.isError && (
        <div className="reportErrorState">
          <strong>Could not load report.</strong>
          <p>{reportQuery.error?.message || "Unknown error"}</p>
          <button className="button small" onClick={() => reportQuery.refetch()}>
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div className="reportSkeletonWrap" aria-live="polite" aria-label="Loading report">
          <div className="reportSummaryGrid">
            {[0, 1, 2, 3].map((idx) => (
              <article key={idx} className="reportCard skeleton">
                <div className="skeletonLine small" />
                <div className="skeletonLine large" />
              </article>
            ))}
          </div>
          <div className="reportChartGrid">
            <div className="reportChartCard skeleton">
              <div className="skeletonLine small" />
              <div className="skeletonBlock" />
            </div>
            <div className="reportChartCard skeleton">
              <div className="skeletonLine small" />
              <div className="skeletonBlock" />
            </div>
            <div className="reportChartCard skeleton">
              <div className="skeletonLine small" />
              <div className="skeletonBlock" />
            </div>
          </div>
        </div>
      )}

      {!isLoading && report && (
        <>
          <div className="testCaseDetails" style={{ marginTop: "8px", marginBottom: "10px" }}>
            <div><strong>Test Run:</strong> {report.runName || "All Test Runs"}</div>
            <div>
              <strong>Period:</strong>{" "}
              {report.period?.from ? new Date(report.period.from).toLocaleDateString() : "N/A"} -{" "}
              {report.period?.to ? new Date(report.period.to).toLocaleDateString() : "N/A"}
            </div>
          </div>

          <div className="reportSummaryGrid">
            <article className="reportCard">
              <div className="reportCardLabel">Total Executed</div>
              <div className="reportCardValue">{breakdown.total}</div>
            </article>
            <article className="reportCard">
              <div className="reportCardLabel">Pass Rate</div>
              <div className="reportCardValue">{breakdown.passRate}</div>
            </article>
            <article className="reportCard reportCardFail">
              <div className="reportCardLabel">Failed</div>
              <div className="reportCardValue">{breakdown.failed}</div>
              <div className="reportCardSub">{breakdown.failedPct}</div>
            </article>
            <article className="reportCard reportCardBlocked">
              <div className="reportCardLabel">Blocked</div>
              <div className="reportCardValue">{breakdown.blocked}</div>
              <div className="reportCardSub">{breakdown.blockedPct}</div>
            </article>
          </div>

          <div className="reportChartGrid">
            <article className="reportChartCard">
              <h5 className="reportChartTitle">Status Distribution</h5>
              <div className="pieSection">
                <div className="pieChart" style={{ background: pieSegments }} />
                <div className="pieLegend">
                  <div><span className="legendDot passed" /> Passed: {breakdown.passed} ({breakdown.passedPct})</div>
                  <div><span className="legendDot failed" /> Failed: {breakdown.failed} ({breakdown.failedPct})</div>
                  <div><span className="legendDot blocked" /> Blocked: {breakdown.blocked} ({breakdown.blockedPct})</div>
                  <div><span className="legendDot skipped" /> Skipped: {breakdown.skipped} ({breakdown.skippedPct})</div>
                </div>
              </div>
            </article>

            <article className="reportChartCard">
              <h5 className="reportChartTitle">Execution by Tester</h5>
              {(testerBars || []).length === 0 ? (
                <div className="note">No tester breakdown.</div>
              ) : (
                <div className="miniBarChart">
                  {testerBars.map((item: TesterBarPoint) => (
                    <div key={item.label} className="miniBarItem" title={`${item.label}: ${item.total}`}>
                      <div className="miniBar" style={{ height: `${item.heightPct}%` }} />
                      <span>{item.label}</span>
                      <strong>{item.total}</strong>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="reportChartCard">
              <h5 className="reportChartTitle">Execution Timeline</h5>
              {timelinePoints.length === 0 ? (
                <div className="note">No timeline data.</div>
              ) : (
                <div className="reportTimelineWrap">
                  <svg viewBox="0 0 100 100" className="reportTimelineChart" preserveAspectRatio="none">
                    <polyline
                      points={timelinePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={2}
                    />
                    {linePath &&
                      timelinePoints.map((point: TimelinePoint) => (
                        <circle key={`${point.label}-${point.total}`} cx={point.x} cy={point.y} r={1.8} fill="#1d4ed8" />
                      ))}
                  </svg>
                  <div className="reportTimelineLegend">
                    {timelinePoints.map((point: TimelinePoint) => (
                      <div key={`${point.label}-${point.total}`} className="reportTimelineLegendItem">
                        <span>{point.label}</span>
                        <strong>{point.total}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <h5 style={{ margin: "8px 0" }}>Top Failed Modules</h5>
            <table className="table adminUsersTable">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Module</th>
                  <th>Failures</th>
                </tr>
              </thead>
              <tbody>
                {(report.topFailedModules || []).length === 0 ? (
                  <tr><td colSpan={3} className="note">No failed modules.</td></tr>
                ) : (
                  (report.topFailedModules || []).map((item: any) => (
                    <tr key={`${item.rank}-${item.module}`}>
                      <td>{item.rank}</td>
                      <td>{item.module}</td>
                      <td>{item.failures}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <h5 style={{ margin: "8px 0" }}>Execution By Tester</h5>
            <div className="reportMetricNote">Total executions handled by each tester.</div>
            <div className="reportBarList">
              {(report.executionByTester || []).length === 0 ? (
                <div className="note">No tester breakdown.</div>
              ) : (
                testerBars.map((item: TesterBarPoint) => (
                  <div key={item.label} className="reportBarRow">
                    <div className="reportBarLabel">{item.label}</div>
                    <div className="reportBarTrack">
                      <div className="reportBarFill tester" style={{ width: `${item.heightPct}%` }} />
                    </div>
                    <div className="reportBarValue">{item.total}</div>
                  </div>
                ))
              )}
            </div>
            <table className="table adminUsersTable">
              <thead>
                <tr>
                  <th>Tester</th>
                  <th>Total</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Blocked</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {(report.executionByTester || []).length === 0 ? (
                  <tr><td colSpan={6} className="note">No tester breakdown.</td></tr>
                ) : (
                  (report.executionByTester || []).map((item: any) => (
                    <tr key={item.testerId}>
                      <td>{item.testerName}</td>
                      <td>{item.total}</td>
                      <td>{item.passed}</td>
                      <td>{item.failed}</td>
                      <td>{item.blocked}</td>
                      <td>{item.skipped}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <h5 style={{ margin: "8px 0" }}>Execution By Module</h5>
            <div className="reportMetricNote">Execution distribution by application module.</div>
            <div className="reportBarList">
              {(report.executionByModule || []).length === 0 ? (
                <div className="note">No module breakdown.</div>
              ) : (
                moduleBars.map((item) => (
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
            <table className="table adminUsersTable">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Total</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Blocked</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {(report.executionByModule || []).length === 0 ? (
                  <tr><td colSpan={6} className="note">No module breakdown.</td></tr>
                ) : (
                  (report.executionByModule || []).map((item: any) => (
                    <tr key={item.module}>
                      <td>{item.module}</td>
                      <td>{item.total}</td>
                      <td>{item.passed}</td>
                      <td>{item.failed}</td>
                      <td>{item.blocked}</td>
                      <td>{item.skipped}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <h5 style={{ margin: "8px 0" }}>Execution Timeline</h5>
            <div className="reportMetricNote">Daily execution trend across the selected period.</div>
            <div className="reportTimelineWrap" style={{ marginBottom: "10px" }}>
              {timelinePoints.length === 0 ? (
                <div className="note">No timeline data.</div>
              ) : (
                <>
                  <svg viewBox="0 0 100 100" className="reportTimelineChart" preserveAspectRatio="none">
                    <polyline
                      points={timelinePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                      fill="none"
                      stroke="#0ea5e9"
                      strokeWidth={2.2}
                    />
                    {timelinePoints.map((point: TimelinePoint) => (
                      <circle key={`timeline-point-${point.label}`} cx={point.x} cy={point.y} r={2.1} fill="#0284c7" />
                    ))}
                  </svg>
                  <div className="reportTimelineLegend">
                    {timelinePoints.map((point: TimelinePoint) => (
                      <div key={`timeline-legend-${point.label}`} className="reportTimelineLegendItem">
                        <span>{point.label}</span>
                        <strong>{point.total}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <table className="table adminUsersTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Blocked</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {(report.executionTimeline || []).length === 0 ? (
                  <tr><td colSpan={6} className="note">No timeline data.</td></tr>
                ) : (
                  (report.executionTimeline || []).map((item: any) => (
                    <tr key={item.date}>
                      <td>{item.date}</td>
                      <td>{item.total}</td>
                      <td>{item.passed}</td>
                      <td>{item.failed}</td>
                      <td>{item.blocked}</td>
                      <td>{item.skipped}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <h5 style={{ margin: "8px 0" }}>Failed Test Case Details</h5>
            <table className="table adminUsersTable">
              <thead>
                <tr>
                  <th>Test Case</th>
                  <th>Module</th>
                  <th>Tester</th>
                  <th>Executed At</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(report.failedTestCases || []).length === 0 ? (
                  <tr><td colSpan={5} className="note">No failed test cases.</td></tr>
                ) : (
                  (report.failedTestCases || []).map((item: any) => (
                    <tr key={item.executionId}>
                      <td className="truncateCell">{item.testCaseCode || item.testCaseId} | {item.testCaseTitle || "Untitled"}</td>
                      <td>{item.module}</td>
                      <td>{item.tester}</td>
                      <td>{item.executedAt ? new Date(item.executedAt).toLocaleString() : "N/A"}</td>
                      <td className="truncateCell">{item.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isLoading && !reportQuery.isError && !report && (
        <div className="reportErrorState">
          <strong>No report data found.</strong>
          <p>Try changing filters or click Generate Report.</p>
        </div>
      )}
    </section>
  );
};

export default TestExecutionReportSection;
