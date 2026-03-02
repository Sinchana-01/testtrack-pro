import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createReportScheduleApi,
  deleteReportScheduleApi,
  exportTesterPerformanceReportApi,
  getTesterPerformanceReportApi,
  listReportSchedulesApi,
  sendReportScheduleNowApi,
} from "../../api";

type Props = {
  roleName: string;
};

type TesterMetric = {
  testerId: string;
  testerName: string;
  testCasesExecuted: number;
  bugsDetected: number;
  bugDetectionRate: number;
  avgDurationMinutes: number;
  onTimeRate: number;
  efficiencyScore: number;
  coveragePercent: number;
};

type TesterPerformancePayload = {
  period: { from: string | null; to: string | null };
  totalRepositoryCases: number;
  summary: {
    totalExecuted: number;
    avgBugDetectionRate: number;
    avgEfficiencyScore: number;
    avgCoveragePercent: number;
  };
  testerMetrics: TesterMetric[];
};

type ReportSchedule = {
  id: string;
  reportType: "TEST_EXECUTION_SUMMARY" | "TESTER_PERFORMANCE";
  format: "PDF" | "EXCEL" | "CSV";
  recipients: string[];
  frequency: "DAILY" | "WEEKLY";
  weekday: number;
  hour: number;
  minute: number;
  active: boolean;
  nextRunAt: string | null;
  lastSentAt: string | null;
};

const TesterPerformanceReportSection: React.FC<Props> = ({ roleName }) => {
  const [testerId, setTesterId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{ testerId?: string; from?: string; to?: string }>({});
  const [exporting, setExporting] = useState<"" | "csv" | "excel" | "pdf">("");
  const [scheduleDraft, setScheduleDraft] = useState({
    reportType: "TEST_EXECUTION_SUMMARY" as "TEST_EXECUTION_SUMMARY" | "TESTER_PERFORMANCE",
    format: "PDF" as "PDF" | "EXCEL" | "CSV",
    recipients: "",
    frequency: "WEEKLY" as "DAILY" | "WEEKLY",
    weekday: "1",
    hour: "9",
    minute: "0",
  });

  const reportQuery = useQuery<TesterPerformancePayload, Error>({
    queryKey: ["tester-performance-report", appliedFilters],
    queryFn: () => getTesterPerformanceReportApi(appliedFilters),
    keepPreviousData: true,
  });

  const schedulesQuery = useQuery<ReportSchedule[], Error>({
    queryKey: ["report-schedules"],
    queryFn: () => listReportSchedulesApi(),
    enabled: roleName === "TESTER" || roleName === "ADMIN",
  });

  const payload = reportQuery.data;
  const testers = payload?.testerMetrics || [];

  const maxExecuted = useMemo(
    () => testers.reduce((max, item) => Math.max(max, Number(item.testCasesExecuted || 0)), 0) || 1,
    [testers]
  );

  const applyFilters = () => {
    setAppliedFilters({
      testerId: testerId || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    });
  };

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    try {
      setExporting(format);
      const blob = await exportTesterPerformanceReportApi(format, appliedFilters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tester-performance-report.${format === "excel" ? "xls" : format}`;
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

  const createSchedule = async () => {
    try {
      const recipients = scheduleDraft.recipients
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      await createReportScheduleApi({
        reportType: scheduleDraft.reportType,
        format: scheduleDraft.format,
        recipients,
        frequency: scheduleDraft.frequency,
        weekday: Number(scheduleDraft.weekday),
        hour: Number(scheduleDraft.hour),
        minute: Number(scheduleDraft.minute),
        active: true,
      });
      setScheduleDraft((prev) => ({ ...prev, recipients: "" }));
      await schedulesQuery.refetch();
    } catch (error: any) {
      window.alert(error?.message || "Failed to create schedule");
    }
  };

  return (
    <section className="panel reportPanel">
      <div className="reportPanelHeader">
        <h4 style={{ margin: 0 }}>Tester Performance Report</h4>
        <div className="toolbarActions">
          <button className="button small" onClick={() => handleExport("pdf")} disabled={exporting !== ""}>
            {exporting === "pdf" ? "Exporting..." : "Export PDF"}
          </button>
          <button className="button small" onClick={() => handleExport("excel")} disabled={exporting !== ""}>
            {exporting === "excel" ? "Exporting..." : "Export Excel"}
          </button>
          <button className="button small" onClick={() => handleExport("csv")} disabled={exporting !== ""}>
            {exporting === "csv" ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="inlineGrid">
        <select className="input" value={testerId} onChange={(e) => setTesterId(e.target.value)}>
          <option value="">All Testers</option>
          {testers.map((item) => (
            <option key={item.testerId} value={item.testerId}>
              {item.testerName}
            </option>
          ))}
        </select>
        <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </div>
      <div className="inlineGrid">
        <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <div className="toolbarActions">
          <button className="button small" onClick={applyFilters}>
            Generate Report
          </button>
          <button
            className="button small"
            onClick={() => {
              setTesterId("");
              setFromDate("");
              setToDate("");
              setAppliedFilters({});
              reportQuery.refetch();
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {reportQuery.isLoading || reportQuery.isFetching ? (
        <div className="note">Loading tester performance...</div>
      ) : reportQuery.isError ? (
        <div className="reportErrorState">
          <strong>Could not load tester performance report.</strong>
          <p>{reportQuery.error?.message || "Unknown error"}</p>
        </div>
      ) : (
        <>
          <div className="reportSummaryGrid">
            <article className="reportCard">
              <div className="reportCardLabel">Test Cases Executed</div>
              <div className="reportCardValue">{Number(payload?.summary?.totalExecuted || 0)}</div>
            </article>
            <article className="reportCard">
              <div className="reportCardLabel">Avg Bug Detection Rate</div>
              <div className="reportCardValue">{Number(payload?.summary?.avgBugDetectionRate || 0).toFixed(1)}%</div>
            </article>
            <article className="reportCard">
              <div className="reportCardLabel">Avg Efficiency</div>
              <div className="reportCardValue">{Number(payload?.summary?.avgEfficiencyScore || 0).toFixed(1)}%</div>
            </article>
            <article className="reportCard">
              <div className="reportCardLabel">Avg Coverage</div>
              <div className="reportCardValue">{Number(payload?.summary?.avgCoveragePercent || 0).toFixed(1)}%</div>
            </article>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <h5 style={{ margin: "8px 0" }}>Execution Efficiency by Tester</h5>
            <div className="reportBarList">
              {testers.length === 0 ? (
                <div className="note">No tester data available.</div>
              ) : (
                testers.map((item) => (
                  <div key={item.testerId} className="reportBarRow">
                    <div className="reportBarLabel">{item.testerName}</div>
                    <div className="reportBarTrack">
                      <div
                        className="reportBarFill tester"
                        style={{ width: `${Math.max(8, Math.round((item.testCasesExecuted / maxExecuted) * 100))}%` }}
                      />
                    </div>
                    <div className="reportBarValue">{item.testCasesExecuted}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <table className="table adminUsersTable">
              <thead>
                <tr>
                  <th>Tester</th>
                  <th>Executed</th>
                  <th>Bug Detection</th>
                  <th>Efficiency</th>
                  <th>Coverage</th>
                  <th>Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {testers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="note">
                      No tester metrics.
                    </td>
                  </tr>
                ) : (
                  testers.map((item) => (
                    <tr key={`metric-${item.testerId}`}>
                      <td>{item.testerName}</td>
                      <td>{item.testCasesExecuted}</td>
                      <td>{item.bugDetectionRate.toFixed(1)}%</td>
                      <td>{item.efficiencyScore.toFixed(1)}%</td>
                      <td>{item.coveragePercent.toFixed(1)}%</td>
                      <td>{item.avgDurationMinutes.toFixed(2)} min</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(roleName === "TESTER" || roleName === "ADMIN") && (
        <section className="panel">
          <h4>Scheduled Report Emails</h4>
          <div className="inlineGrid">
            <select
              className="input"
              value={scheduleDraft.reportType}
              onChange={(e) =>
                setScheduleDraft((prev) => ({
                  ...prev,
                  reportType: e.target.value as "TEST_EXECUTION_SUMMARY" | "TESTER_PERFORMANCE",
                }))
              }
            >
              <option value="TEST_EXECUTION_SUMMARY">Test Execution Summary</option>
              <option value="TESTER_PERFORMANCE">Tester Performance</option>
            </select>
            <select
              className="input"
              value={scheduleDraft.format}
              onChange={(e) =>
                setScheduleDraft((prev) => ({ ...prev, format: e.target.value as "PDF" | "EXCEL" | "CSV" }))
              }
            >
              <option value="PDF">PDF</option>
              <option value="EXCEL">Excel</option>
              <option value="CSV">CSV</option>
            </select>
          </div>
          <div className="inlineGrid">
            <input
              className="input"
              placeholder="Recipients (comma-separated emails)"
              value={scheduleDraft.recipients}
              onChange={(e) => setScheduleDraft((prev) => ({ ...prev, recipients: e.target.value }))}
            />
            <select
              className="input"
              value={scheduleDraft.frequency}
              onChange={(e) => setScheduleDraft((prev) => ({ ...prev, frequency: e.target.value as "DAILY" | "WEEKLY" }))}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="DAILY">Daily</option>
            </select>
          </div>
          <div className="inlineGrid">
            <input
              className="input"
              type="number"
              min={0}
              max={6}
              value={scheduleDraft.weekday}
              onChange={(e) => setScheduleDraft((prev) => ({ ...prev, weekday: e.target.value }))}
              placeholder="Weekday (0-6)"
            />
            <input
              className="input"
              type="number"
              min={0}
              max={23}
              value={scheduleDraft.hour}
              onChange={(e) => setScheduleDraft((prev) => ({ ...prev, hour: e.target.value }))}
              placeholder="Hour"
            />
          </div>
          <div className="inlineGrid">
            <input
              className="input"
              type="number"
              min={0}
              max={59}
              value={scheduleDraft.minute}
              onChange={(e) => setScheduleDraft((prev) => ({ ...prev, minute: e.target.value }))}
              placeholder="Minute"
            />
            <button className="button small" onClick={createSchedule}>
              Create Schedule
            </button>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <table className="table adminUsersTable">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Frequency</th>
                  <th>Next Run</th>
                  <th>Last Sent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(schedulesQuery.data || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="note">
                      No schedules configured.
                    </td>
                  </tr>
                ) : (
                  (schedulesQuery.data || []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.reportType.replace(/_/g, " ")}</td>
                      <td>
                        {item.frequency} | {String(item.hour).padStart(2, "0")}:{String(item.minute).padStart(2, "0")}
                      </td>
                      <td>{item.nextRunAt ? new Date(item.nextRunAt).toLocaleString() : "N/A"}</td>
                      <td>{item.lastSentAt ? new Date(item.lastSentAt).toLocaleString() : "Never"}</td>
                      <td>
                        <div className="toolbarActions">
                          <button
                            className="button small"
                            onClick={async () => {
                              await sendReportScheduleNowApi(item.id);
                              await schedulesQuery.refetch();
                            }}
                          >
                            Send Now
                          </button>
                          <button
                            className="button small danger"
                            onClick={async () => {
                              await deleteReportScheduleApi(item.id);
                              await schedulesQuery.refetch();
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
};

export default TesterPerformanceReportSection;

