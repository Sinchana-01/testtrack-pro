import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  exportDeveloperPerformanceReportCsvApi,
  getDeveloperPerformanceReportApi,
} from "../../api";

type Props = {
  roleName: string;
};

type DeveloperMetric = {
  developerId: string;
  developerName: string;
  developerEmail: string;
  bugsAssigned: number;
  bugsResolved: number;
  reopenedCount: number;
  reopenRate: number;
  avgResolutionDays: number;
  fixQuality: {
    firstPassFixRate: number;
    fixNotesCoverage: number;
    commitLinkCoverage: number;
    retestRequestRate: number;
  };
};

type TrendPoint = {
  date: string;
  assigned: number;
  resolved: number;
};

type DeveloperPerformancePayload = {
  period: { from: string | null; to: string | null };
  summary: {
    developerCount: number;
    bugsAssigned: number;
    bugsResolved: number;
    avgResolutionDays: number;
    reopenRate: number;
  };
  developers: DeveloperMetric[];
  trend: TrendPoint[];
};

const defaultFilters = { developerId: "", from: "", to: "" };

const DeveloperPerformanceReportSection: React.FC<Props> = ({ roleName }) => {
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [exporting, setExporting] = useState(false);

  const reportQuery = useQuery<DeveloperPerformancePayload, Error>({
    queryKey: ["developer-performance-report", appliedFilters],
    queryFn: () =>
      getDeveloperPerformanceReportApi({
        developerId: appliedFilters.developerId || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
      }),
    keepPreviousData: true,
  });

  const payload = reportQuery.data;
  const developers = payload?.developers || [];
  const trend = payload?.trend || [];

  const maxAssigned = useMemo(
    () => developers.reduce((max, row) => Math.max(max, Number(row.bugsAssigned || 0)), 0) || 1,
    [developers]
  );
  const maxResolved = useMemo(
    () => developers.reduce((max, row) => Math.max(max, Number(row.bugsResolved || 0)), 0) || 1,
    [developers]
  );

  const trendPoints = useMemo(() => {
    const maxTotal =
      trend.reduce(
        (max, item) => Math.max(max, Number(item.assigned || 0), Number(item.resolved || 0)),
        0
      ) || 1;
    return trend.map((item, index) => {
      const x = trend.length === 1 ? 0 : (index / (trend.length - 1)) * 100;
      const assignedY = 100 - (Number(item.assigned || 0) / maxTotal) * 100;
      const resolvedY = 100 - (Number(item.resolved || 0) / maxTotal) * 100;
      return {
        x,
        assignedY,
        resolvedY,
        date: item.date,
        assigned: Number(item.assigned || 0),
        resolved: Number(item.resolved || 0),
      };
    });
  }, [trend]);

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setFilters(defaultFilters);
  };
  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const csv = await exportDeveloperPerformanceReportCsvApi({
        developerId: appliedFilters.developerId || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `developer-performance-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      window.alert(error?.message || "Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="panel reportPanel">
      <div className="reportPanelHeader">
        <h4 style={{ margin: 0 }}>Developer Performance Report</h4>
        <button className="button small" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      <div className="reportFilters">
        <div className="field">
          <label>Developer</label>
          <select
            value={filters.developerId}
            onChange={(event) => setFilters((prev) => ({ ...prev, developerId: event.target.value }))}
            disabled={roleName === "DEVELOPER"}
          >
            <option value="">All Developers</option>
            {developers.map((item) => (
              <option key={item.developerId} value={item.developerId}>
                {item.developerName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>From</label>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          />
        </div>
        <div className="field">
          <label>To</label>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          />
        </div>
        <div className="reportFilterActions">
          <button className="button small" onClick={handleApplyFilters}>
            Apply
          </button>
          <button className="button ghost small" onClick={handleResetFilters}>
            Reset
          </button>
        </div>
      </div>

      {reportQuery.isLoading || reportQuery.isFetching ? (
        <div className="reportSkeletonWrap">
          <div className="reportSummaryGrid">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`dev-report-skeleton-${idx}`} className="reportCard skeleton">
                <div className="skeletonLine small" />
                <div className="skeletonLine large" />
              </div>
            ))}
          </div>
          <div className="skeletonBlock" />
        </div>
      ) : reportQuery.isError ? (
        <div className="reportErrorState">
          <strong>Could not load report.</strong>
          <p>{reportQuery.error?.message || "Unknown error"}</p>
          <button className="button small" onClick={() => reportQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="reportSummaryGrid">
            <div className="reportCard">
              <div className="reportCardLabel">Bugs Assigned</div>
              <div className="reportCardValue">{Number(payload?.summary?.bugsAssigned || 0)}</div>
            </div>
            <div className="reportCard">
              <div className="reportCardLabel">Bugs Resolved</div>
              <div className="reportCardValue">{Number(payload?.summary?.bugsResolved || 0)}</div>
            </div>
            <div className="reportCard">
              <div className="reportCardLabel">Avg Resolution (Days)</div>
              <div className="reportCardValue">
                {Number(payload?.summary?.avgResolutionDays || 0).toFixed(2)}
              </div>
            </div>
            <div className="reportCard reportCardFail">
              <div className="reportCardLabel">Reopen Rate</div>
              <div className="reportCardValue">{Number(payload?.summary?.reopenRate || 0).toFixed(1)}%</div>
            </div>
          </div>

          <div className="inlineGrid">
            <div className="tableWrap adminUsersTableWrap">
              <h5 style={{ margin: "8px 0" }}>Assigned vs Resolved</h5>
              <div className="reportBarList">
                {developers.length === 0 ? (
                  <div className="note">No developer metrics found.</div>
                ) : (
                  developers.map((item) => (
                    <div key={item.developerId} className="devDualBarRow">
                      <div className="reportBarLabel">{item.developerName}</div>
                      <div className="devDualBarTracks">
                        <div className="reportBarTrack">
                          <div
                            className="reportBarFill priority"
                            style={{ width: `${Math.max(8, Math.round((item.bugsAssigned / maxAssigned) * 100))}%` }}
                          />
                        </div>
                        <div className="reportBarTrack">
                          <div
                            className="reportBarFill tester"
                            style={{ width: `${Math.max(8, Math.round((item.bugsResolved / maxResolved) * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="reportBarValue">
                        A:{item.bugsAssigned} | R:{item.bugsResolved}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="reportDualLegend">
                <span>
                  <span className="legendDot blocked" /> Assigned
                </span>
                <span>
                  <span className="legendDot passed" /> Resolved
                </span>
              </div>
            </div>

            <div className="tableWrap adminUsersTableWrap">
              <h5 style={{ margin: "8px 0" }}>Fix Quality Metrics</h5>
              <div className="tableWrap adminUsersTableWrap">
                <table className="table adminUsersTable">
                  <thead>
                    <tr>
                      <th>Developer</th>
                      <th>First-Pass Fix</th>
                      <th>Fix Notes</th>
                      <th>Commit Link</th>
                      <th>Re-test Request</th>
                    </tr>
                  </thead>
                  <tbody>
                    {developers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="note">
                          No quality metrics available.
                        </td>
                      </tr>
                    ) : (
                      developers.map((item) => (
                        <tr key={`quality-${item.developerId}`}>
                          <td>{item.developerName}</td>
                          <td>{Number(item.fixQuality.firstPassFixRate || 0).toFixed(1)}%</td>
                          <td>{Number(item.fixQuality.fixNotesCoverage || 0).toFixed(1)}%</td>
                          <td>{Number(item.fixQuality.commitLinkCoverage || 0).toFixed(1)}%</td>
                          <td>{Number(item.fixQuality.retestRequestRate || 0).toFixed(1)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="tableWrap adminUsersTableWrap">
            <h5 style={{ margin: "8px 0" }}>Assignment & Resolution Trend</h5>
            <div className="reportTimelineWrap" style={{ marginBottom: "10px" }}>
              {trendPoints.length === 0 ? (
                <div className="note">No trend data.</div>
              ) : (
                <>
                  <svg viewBox="0 0 100 100" className="reportTimelineChart" preserveAspectRatio="none">
                    <polyline
                      points={trendPoints.map((point) => `${point.x},${point.assignedY}`).join(" ")}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                    />
                    <polyline
                      points={trendPoints.map((point) => `${point.x},${point.resolvedY}`).join(" ")}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth={2}
                    />
                  </svg>
                  <div className="reportDualLegend">
                    <span>
                      <span className="legendDot blocked" /> Assigned
                    </span>
                    <span>
                      <span className="legendDot passed" /> Resolved
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default DeveloperPerformanceReportSection;
