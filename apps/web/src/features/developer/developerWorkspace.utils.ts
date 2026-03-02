type GenericRow = Record<string, unknown>;

const escapeCsvCell = (value: unknown): string => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
};

export const downloadCsv = (fileName: string, rows: GenericRow[]): boolean => {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((key) => escapeCsvCell(row[key])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
};

export const getDeveloperAssignedExecutionReports = (executionReports: any[], currentUserId: string): any[] =>
  executionReports
    .filter((item) => {
      const executorId = String(item?.executedBy || item?.executor?.id || "");
      const testCaseAssigneeId = String(item?.testCase?.assignedTo || item?.testCase?.assignee?.id || "");
      return (!!currentUserId && executorId === currentUserId) || (!!currentUserId && testCaseAssigneeId === currentUserId);
    })
    .sort((a, b) => new Date(b.executedAt || 0).getTime() - new Date(a.executedAt || 0).getTime());

export const getDeveloperLinkedCommitBugs = (assignedBugs: any[]): any[] =>
  [...assignedBugs]
    .filter((item) => String(item?.commitLink || "").trim().length > 0)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());

export const exportAssignedBugReportCsv = (assignedBugs: any[]): boolean =>
  downloadCsv(
    "developer_assigned_bugs.csv",
    assignedBugs.map((item) => ({
      bugId: item.bugId || item.id,
      title: item.title || "",
      status: item.workflowStatus || item.status || "",
      priority: item.priority || "",
      severity: item.severity || "",
      assignee: item.assignee?.email || item.assignedTo || "",
      reporter: item.reporter?.email || item.reportedBy || "",
      fixNotes: item.fixNotes || "",
      commitLink: item.commitLink || "",
      updatedAt: item.updatedAt || item.createdAt || "",
    }))
  );

export const exportAssignedExecutionReportCsv = (assignedExecutionReports: any[]): boolean =>
  downloadCsv(
    "developer_assigned_test_reports.csv",
    assignedExecutionReports.map((item) => ({
      executionId: item.id,
      testCaseCode: item.testCase?.testCaseCode || item.testCaseId || "",
      testCaseTitle: item.testCase?.title || "",
      result: item.result || "",
      progressPercent: item.progressPercent ?? "",
      executedAt: item.executedAt || "",
      executedBy: item.executor?.email || item.executedBy || "",
      notes: item.notes || "",
    }))
  );
