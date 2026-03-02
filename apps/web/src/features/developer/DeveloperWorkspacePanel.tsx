import React, { useEffect, useMemo, useState } from "react";
import {
  createDeveloperIssueCommentApi,
  exportDeveloperReportsCsvApi,
  getDeveloperDashboardApi,
  listDeveloperAssignedIssuesApi,
  linkDeveloperIssueCommitApi,
  requestDeveloperIssueRetestApi,
  updateDeveloperFixNotesApi,
  updateDeveloperIssueStatusApi,
} from "../../api";
import DeveloperIssueActionModal from "./DeveloperIssueActionModal";
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
  const [issues, setIssues] = useState<any[]>(assignedBugs);
  const [dashboardCounts, setDashboardCounts] = useState<{ assignedCount: number; openCount: number; fixedCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [statusValue, setStatusValue] = useState("OPEN");
  const [fixNotesValue, setFixNotesValue] = useState("");
  const [commitLinkValue, setCommitLinkValue] = useState("");
  const [commentValue, setCommentValue] = useState("");

  const loadDeveloperData = async () => {
    try {
      const [issueRows, dashboard] = await Promise.all([listDeveloperAssignedIssuesApi(), getDeveloperDashboardApi()]);
      setIssues(Array.isArray(issueRows) ? issueRows : []);
      setDashboardCounts({
        assignedCount: Number(dashboard?.assignedCount || 0),
        openCount: Number(dashboard?.openCount || 0),
        fixedCount: Number(dashboard?.fixedCount || 0),
      });
    } catch {
      setIssues(assignedBugs);
      setDashboardCounts(null);
    }
  };

  useEffect(() => {
    loadDeveloperData();
  }, []);

  useEffect(() => {
    setIssues(assignedBugs);
  }, [assignedBugs]);

  const assignedIssueRows = useMemo(() => (issues.length > 0 ? issues : assignedBugs), [issues, assignedBugs]);
  const linkedCommitRows = useMemo(() => {
    const source = issues.length > 0 ? issues : linkedCommitBugs;
    return source.filter((item: any) => String(item?.commitLink || "").trim().length > 0);
  }, [issues, linkedCommitBugs]);

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
          <div className="kpiItem"><strong>Assigned Issues</strong><span>{dashboardCounts?.assignedCount ?? assignedBugCount}</span></div>
          <div className="kpiItem"><strong>In Progress / Open</strong><span>{dashboardCounts?.openCount ?? inProgressCount}</span></div>
          <div className="kpiItem"><strong>Fixed</strong><span>{dashboardCounts?.fixedCount ?? needsVerificationCount}</span></div>
        </div>
      )}

      <div className="toolbarActions" style={{ marginBottom: "12px" }}>
        {showQuickActions ? (
          <>
            <button className="button small" onClick={onOpenAssignedBugs}>View Assigned Issues</button>
            <button className="button small" onClick={onOpenTestReports}>View Test Reports</button>
            <button className="button small" onClick={onOpenExecuteTests}>View Dashboard Execution</button>
          </>
        ) : null}
        <button
          className="button small"
          onClick={() => {
            if (!exportAssignedBugReportCsv(assignedIssueRows)) alert("No assigned issues to export");
          }}
        >
          Export Issue Report
        </button>
        <button
          className="button small"
          onClick={async () => {
            try {
              const csv = await exportDeveloperReportsCsvApi();
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "developer_assigned_issues_backend.csv";
              document.body.appendChild(anchor);
              anchor.click();
              document.body.removeChild(anchor);
              URL.revokeObjectURL(url);
            } catch (error: any) {
              alert(error?.message || "Failed to export backend report");
            }
          }}
        >
          Export Backend Report
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

      {showAssignedIssuesTable ? (
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
              {assignedIssueRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="note">No assigned issues.</td>
                </tr>
              ) : (
                assignedIssueRows.map((item) => (
                  <tr key={item.id}>
                    <td className="truncateCell">{item.bugId || item.id} | {item.title || "Untitled"}</td>
                    <td>{item.workflowStatus || item.status || "OPEN"}</td>
                    <td>{item.priority || "N/A"}</td>
                    <td>
                      <div className="bugTableActions">
                        <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "N/A"}</span>
                        <button
                          className="button small"
                          onClick={() => {
                            setSelectedIssue(item);
                            setStatusValue(String(item.workflowStatus || item.status || "OPEN").toUpperCase());
                            setFixNotesValue(item.fixNotes || "");
                            setCommitLinkValue(item.commitLink || "");
                            setCommentValue("");
                          }}
                        >
                          Manage
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

      {showTestReportsTable ? (
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
      ) : null}

      {showLinkedCommitsTable ? (
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
              {linkedCommitRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="note">No linked commits yet.</td>
                </tr>
              ) : (
                linkedCommitRows.map((item) => (
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
      ) : null}

      <DeveloperIssueActionModal
        isOpen={!!selectedIssue}
        issue={selectedIssue}
        statusValue={statusValue}
        onStatusChange={setStatusValue}
        fixNotesValue={fixNotesValue}
        onFixNotesChange={setFixNotesValue}
        commitLinkValue={commitLinkValue}
        onCommitLinkChange={setCommitLinkValue}
        commentValue={commentValue}
        onCommentChange={setCommentValue}
        loading={loading}
        onClose={() => {
          setSelectedIssue(null);
          setLoading(false);
        }}
        onUpdateStatus={async () => {
          if (!selectedIssue?.id) return;
          try {
            setLoading(true);
            await updateDeveloperIssueStatusApi(selectedIssue.id, statusValue);
            await loadDeveloperData();
            alert("Issue status updated");
          } catch (error: any) {
            alert(error?.message || "Failed to update issue status");
          } finally {
            setLoading(false);
          }
        }}
        onSaveFixNotes={async () => {
          if (!selectedIssue?.id || !fixNotesValue.trim()) {
            alert("Fix notes are required");
            return;
          }
          try {
            setLoading(true);
            await updateDeveloperFixNotesApi(selectedIssue.id, fixNotesValue.trim());
            await loadDeveloperData();
            alert("Fix notes saved");
          } catch (error: any) {
            alert(error?.message || "Failed to save fix notes");
          } finally {
            setLoading(false);
          }
        }}
        onLinkCommit={async () => {
          if (!selectedIssue?.id || !commitLinkValue.trim()) {
            alert("Commit link is required");
            return;
          }
          try {
            setLoading(true);
            await linkDeveloperIssueCommitApi(selectedIssue.id, commitLinkValue.trim());
            await loadDeveloperData();
            alert("Commit linked");
          } catch (error: any) {
            alert(error?.message || "Failed to link commit");
          } finally {
            setLoading(false);
          }
        }}
        onRequestRetest={async () => {
          if (!selectedIssue?.id) return;
          try {
            setLoading(true);
            await requestDeveloperIssueRetestApi(selectedIssue.id);
            await loadDeveloperData();
            alert("Re-test requested");
          } catch (error: any) {
            alert(error?.message || "Failed to request re-test");
          } finally {
            setLoading(false);
          }
        }}
        onAddComment={async () => {
          if (!selectedIssue?.id || !commentValue.trim()) {
            alert("Comment is required");
            return;
          }
          try {
            setLoading(true);
            await createDeveloperIssueCommentApi(selectedIssue.id, commentValue.trim());
            setCommentValue("");
            await loadDeveloperData();
            alert("Comment added");
          } catch (error: any) {
            alert(error?.message || "Failed to add comment");
          } finally {
            setLoading(false);
          }
        }}
      />
    </section>
  );
};

export default DeveloperWorkspacePanel;
