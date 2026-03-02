import React from "react";
import { exportAssignedBugReportCsv, exportAssignedExecutionReportCsv } from "./developerWorkspace.utils";

type Props = {
  mode?: "workspace" | "test_reports" | "performance_report" | "linked_commits";
  assignedBugCount: number;
  inProgressCount: number;
  needsVerificationCount: number;
  assignedBugs: any[];
  assignedExecutionReports: any[];
  linkedCommitBugs: any[];
  onOpenAssignedBugs: () => void;
  onOpenTestReports: () => void;
  onOpenExecuteTests: () => void;
};

const DeveloperWorkspacePanel: React.FC<Props> = ({
  mode = "workspace",
  assignedBugCount,
  inProgressCount,
  needsVerificationCount,
  assignedBugs,
  assignedExecutionReports,
  linkedCommitBugs,
  onOpenAssignedBugs,
  onOpenTestReports,
  onOpenExecuteTests,
}) => {
  const showOverview = mode === "workspace" || mode === "performance_report";
  const showQuickActions = mode === "workspace";
  const showAssignedIssuesTable = mode === "workspace";
  const showTestReportsTable = mode === "workspace" || mode === "test_reports" || mode === "performance_report";
  const showLinkedCommitsTable = mode === "workspace" || mode === "linked_commits";
  const panelTitle =
    mode === "test_reports"
      ? "Test Reports"
      : mode === "performance_report"
      ? "Performance Report"
      : mode === "linked_commits"
      ? "Linked Commits"
      : "Developer Workspace";
  const panelNote =
    mode === "test_reports"
      ? "Access assigned test execution reports and export them."
      : mode === "performance_report"
      ? "Access developer analytics and assigned execution metrics."
      : mode === "linked_commits"
      ? "Track bug fixes associated with linked code commits."
      : "Manage assigned issues, test reports, and linked commits from one place.";

  return (
    <section className="panel rolePanel rolePanelDeveloper">
      <h4>{panelTitle}</h4>
      <p className="note">{panelNote}</p>

      {showOverview && (
        <div className="kpiRow" style={{ marginBottom: "10px" }}>
          <div className="kpiItem"><strong>Assigned Issues</strong><span>{assignedBugCount}</span></div>
          <div className="kpiItem"><strong>In Progress</strong><span>{inProgressCount}</span></div>
          <div className="kpiItem"><strong>Needs Verification</strong><span>{needsVerificationCount}</span></div>
        </div>
      )}

      <div className="toolbarActions" style={{ marginBottom: "12px" }}>
        {showQuickActions && (
          <>
            <button className="button small" onClick={onOpenAssignedBugs}>View Assigned Issues</button>
            <button className="button small" onClick={onOpenTestReports}>View Test Reports</button>
            <button className="button small" onClick={onOpenExecuteTests}>View Dashboard Execution</button>
          </>
        )}
        <button
          className="button small"
          onClick={() => {
            if (!exportAssignedBugReportCsv(assignedBugs)) alert("No assigned issues to export");
          }}
        >
          Export Issue Report
        </button>
        <button
          className="button small"
          onClick={() => {
            if (!exportAssignedExecutionReportCsv(assignedExecutionReports)) alert("No assigned test reports to export");
          }}
        >
          Export Test Report
        </button>
      </div>

      {showAssignedIssuesTable && (
      <div className="tableWrap adminUsersTableWrap">
        <table className="table adminUsersTable">
          <thead>
            <tr>
              <th>Assigned Issue</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {assignedBugs.length === 0 ? (
              <tr>
                <td colSpan={4} className="note">No assigned issues.</td>
              </tr>
            ) : (
              assignedBugs.map((item) => (
                <tr key={item.id}>
                  <td className="truncateCell">{item.bugId || item.id} | {item.title || "Untitled"}</td>
                  <td>{item.workflowStatus || item.status || "OPEN"}</td>
                  <td>{item.priority || "N/A"}</td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {showTestReportsTable && (
      <div className="tableWrap adminUsersTableWrap">
        <table className="table adminUsersTable">
          <thead>
            <tr>
              <th>Test Report</th>
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
                  <td className="truncateCell">{item.testCase?.testCaseCode || item.testCaseId || item.id} | {item.testCase?.title || "Untitled Test Case"}</td>
                  <td>{item.result || "N/A"}</td>
                  <td>{item.executor?.email || item.executedBy || "N/A"}</td>
                  <td>{item.executedAt ? new Date(item.executedAt).toLocaleString() : "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {showLinkedCommitsTable && (
      <div className="tableWrap adminUsersTableWrap">
        <table className="table adminUsersTable">
          <thead>
            <tr>
              <th>Linked Commits</th>
              <th>Issue</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {linkedCommitBugs.length === 0 ? (
              <tr>
                <td colSpan={3} className="note">No linked commits yet.</td>
              </tr>
            ) : (
              linkedCommitBugs.map((item) => (
                <tr key={item.id}>
                  <td className="truncateCell">{item.commitLink}</td>
                  <td className="truncateCell">{item.bugId || item.id} | {item.title || "Untitled"}</td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
};

export default DeveloperWorkspacePanel;
