import { useEffect, useState } from "react";
import {
  bulkTestCaseOperationApi,
  clearSessionTokens,
  cloneTestCaseApi,
  createBugApi,
  createBugCommentApi,
  createBugFromExecutionApi,
  createSuiteApi,
  createAdminUserApi,
  createTestRunApi,
  deleteExecutionEvidenceApi,
  deleteAdminUserApi,
  deleteBugCommentApi,
  deleteTemplateApi,
  createFromTemplateApi,
  createTemplateApi,
  createTestCaseApi,
  editBugCommentApi,
  deleteTestCaseApi,
  finalizeExecutionApi,
  forgotPasswordApi,
  getBugApi,
  getTestRunApi,
  getRefreshToken,
  listBugCommentsApi,
  listBugsApi,
  listExecutionEvidenceApi,
  listExecutionReportsApi,
  listAdminUsersApi,
  listSuiteExecutionsApi,
  listSuitesApi,
  getTestCasesApi,
  importTestCasesApi,
  listTemplatesApi,
  listTestRunsApi,
  loginApi,
  logoutAllApi,
  openExecutionApi,
  reexecuteExecutionApi,
  refreshTokenApi,
  registerApi,
  resolveBugApi,
  resetPasswordApi,
  saveExecutionStepApi,
  setSessionTokens,
  startExecutionTimerApi,
  startExecutionApi,
  startSuiteExecutionApi,
  stopExecutionTimerApi,
  quickUpdateDeveloperBugStatusApi,
  uploadExecutionEvidenceApi,
  updateBugWorkflowApi,
  addSuiteTestCasesApi,
  archiveSuiteApi,
  cloneSuiteApi,
  deleteSuiteApi,
  getSuiteApi,
  getSuiteExecutionApi,
  removeSuiteTestCaseApi,
  reorderSuiteTestCasesApi,
  restoreSuiteApi,
  updateAdminRoleApi,
  updateAdminUserApi,
  updateSuiteApi,
  createAdminProjectApi,
  createAdminUserApi,
  listAdminAuditLogsApi,
  listAdminBackupsApi,
  listAdminProjectsApi,
  listAdminSystemConfigsApi,
  listAdminUsersApi,
  triggerAdminBackupApi,
  updateAdminProjectApi,
  updateAdminRoleApi,
  updateAdminUserApi,
  upsertAdminSystemConfigApi,
  updateTestCaseApi,
} from "./api";
import "./App.css";

type Screen = "login" | "register" | "forgot" | "reset" | "dashboard";
type DashboardFeature =
  | "create_test_case"
  | "templates"
  | "bulk_operations"
  | "import_test_cases"
  | "test_runs"
  | "suite_management"
  | "execute_tests"
  | "bug_management"
  | "test_cases"
  | "developer_workspace"
  | "admin_workspace"
  | "admin_users"
  | "admin_projects"
  | "admin_roles"
  | "admin_audit_logs"
  | "admin_system_config"
  | "admin_backups";

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [testCases, setTestCases] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tcTitle, setTcTitle] = useState("");
  const [tcDescription, setTcDescription] = useState("");
  const [tcPreConditionsText, setTcPreConditionsText] = useState("");
  const [tcTestDataRequirementsText, setTcTestDataRequirementsText] = useState("");
  const [tcEnvironmentRequirementsText, setTcEnvironmentRequirementsText] = useState("");
  const [tcModule, setTcModule] = useState("Authentication");
  const [tcStepsText, setTcStepsText] = useState("");
  const [tcPostConditionsText, setTcPostConditionsText] = useState("");
  const [tcMetadataText, setTcMetadataText] = useState("");
  const [tcTagsText, setTcTagsText] = useState("");
  const [tcEstimatedDurationMinutes, setTcEstimatedDurationMinutes] = useState("");
  const [tcAutomationStatus, setTcAutomationStatus] = useState("NOT_AUTOMATED");
  const [tcAutomationScriptLink, setTcAutomationScriptLink] = useState("");
  const [tcPriority, setTcPriority] = useState("MEDIUM");
  const [tcSeverity, setTcSeverity] = useState("MAJOR");
  const [tcType, setTcType] = useState("FUNCTIONAL");
  const [tcStatus, setTcStatus] = useState("DRAFT");
  const [bulkOperation, setBulkOperation] = useState("STATUS");
  const [bulkStatus, setBulkStatus] = useState("READY_FOR_REVIEW");
  const [bulkPriority, setBulkPriority] = useState("MEDIUM");
  const [bulkSeverityValue, setBulkSeverityValue] = useState("MAJOR");
  const [bulkModule, setBulkModule] = useState("General");
  const [bulkSuiteId, setBulkSuiteId] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateSteps, setTemplateSteps] = useState("");
  const [importType, setImportType] = useState("JSON");
  const [importFieldMappingText, setImportFieldMappingText] = useState("");
  const [importExcelRows, setImportExcelRows] = useState<any[]>([]);
  const [importExcelFileName, setImportExcelFileName] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importPreviewErrors, setImportPreviewErrors] = useState<string[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPreConditionsText, setEditPreConditionsText] = useState("");
  const [editTestDataRequirementsText, setEditTestDataRequirementsText] = useState("");
  const [editEnvironmentRequirementsText, setEditEnvironmentRequirementsText] = useState("");
  const [editModule, setEditModule] = useState("");
  const [editPostConditionsText, setEditPostConditionsText] = useState("");
  const [editMetadataText, setEditMetadataText] = useState("");
  const [editTagsText, setEditTagsText] = useState("");
  const [editEstimatedDurationMinutes, setEditEstimatedDurationMinutes] = useState("");
  const [editAutomationStatus, setEditAutomationStatus] = useState("NOT_AUTOMATED");
  const [editAutomationScriptLink, setEditAutomationScriptLink] = useState("");
  const [editChangeSummary, setEditChangeSummary] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editSeverity, setEditSeverity] = useState("MAJOR");
  const [editType, setEditType] = useState("FUNCTIONAL");
  const [editStatus, setEditStatus] = useState("DRAFT");
  const [showTestCaseList, setShowTestCaseList] = useState(false);
  const [expandedTestCaseId, setExpandedTestCaseId] = useState("");
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [runName, setRunName] = useState("");
  const [runDescription, setRunDescription] = useState("");
  const [runStartDate, setRunStartDate] = useState("");
  const [runEndDate, setRunEndDate] = useState("");
  const [runTesterIdsText, setRunTesterIdsText] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runDetails, setRunDetails] = useState<any>(null);
  const [suites, setSuites] = useState<any[]>([]);
  const [suiteName, setSuiteName] = useState("");
  const [suiteDescription, setSuiteDescription] = useState("");
  const [suiteModule, setSuiteModule] = useState("");
  const [suiteProjectId, setSuiteProjectId] = useState("");
  const [suiteParentId, setSuiteParentId] = useState("");
  const [suiteCreateCaseSelection, setSuiteCreateCaseSelection] = useState<string[]>([]);
  const [suiteAddCaseSelection, setSuiteAddCaseSelection] = useState<string[]>([]);
  const [suiteCreateCaseSearch, setSuiteCreateCaseSearch] = useState("");
  const [suiteAddCaseSearch, setSuiteAddCaseSearch] = useState("");
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [suiteDetails, setSuiteDetails] = useState<any>(null);
  const [suiteReorderIds, setSuiteReorderIds] = useState<string[]>([]);
  const [suiteCloneName, setSuiteCloneName] = useState("");
  const [suiteExecutionMode, setSuiteExecutionMode] = useState("SEQUENTIAL");
  const [suiteExecutionTesterIdsText, setSuiteExecutionTesterIdsText] = useState("");
  const [suiteExecutionId, setSuiteExecutionId] = useState("");
  const [suiteExecutionDetails, setSuiteExecutionDetails] = useState<any>(null);
  const [suiteExecutionHistory, setSuiteExecutionHistory] = useState<any[]>([]);
  const [activeSuiteExecutionContext, setActiveSuiteExecutionContext] = useState<{
    suiteExecutionId: string;
    mode: string;
    runId: string;
  } | null>(null);
  const [showArchivedSuites, setShowArchivedSuites] = useState(false);
  const [executionCaseId, setExecutionCaseId] = useState("");
  const [executionRunId, setExecutionRunId] = useState("");
  const [executionId, setExecutionId] = useState("");
  const [executionSteps, setExecutionSteps] = useState<any[]>([]);
  const [executionNotes, setExecutionNotes] = useState("");
  const [executionSelectedStepNumber, setExecutionSelectedStepNumber] = useState("");
  const [executionStepStatus, setExecutionStepStatus] = useState("PASSED");
  const [executionActualResult, setExecutionActualResult] = useState("");
  const [executionStepNotes, setExecutionStepNotes] = useState("");
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionStartedAt, setExecutionStartedAt] = useState("");
  const [executionCompletedAt, setExecutionCompletedAt] = useState("");
  const [executionDurationSeconds, setExecutionDurationSeconds] = useState<number | null>(null);
  const [executionEvidence, setExecutionEvidence] = useState<any[]>([]);
  const [evidenceType, setEvidenceType] = useState("IMAGE");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceName, setEvidenceName] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [executionReports, setExecutionReports] = useState<any[]>([]);
  const [selectedExecutionReportId, setSelectedExecutionReportId] = useState("");
  const [quickBugTitle, setQuickBugTitle] = useState("");
  const [quickBugDescription, setQuickBugDescription] = useState("");
  const [quickBugSeverity, setQuickBugSeverity] = useState("MEDIUM");
  const [bugs, setBugs] = useState<any[]>([]);
  const [selectedBugId, setSelectedBugId] = useState("");
  const [selectedBug, setSelectedBug] = useState<any>(null);
  const [bugComments, setBugComments] = useState<any[]>([]);
  const [bugCommentThreads, setBugCommentThreads] = useState<any[]>([]);
  const [bugFilterStatus, setBugFilterStatus] = useState("");
  const [bugFilterPriority, setBugFilterPriority] = useState("");
  const [bugFilterSeverity, setBugFilterSeverity] = useState("");
  const [bugSortBy, setBugSortBy] = useState("");
  const [bugCreateTitle, setBugCreateTitle] = useState("");
  const [bugCreateDescription, setBugCreateDescription] = useState("");
  const [bugCreateStepsToReproduce, setBugCreateStepsToReproduce] = useState("");
  const [bugCreateExpectedBehavior, setBugCreateExpectedBehavior] = useState("");
  const [bugCreateActualBehavior, setBugCreateActualBehavior] = useState("");
  const [bugCreateSeverity, setBugCreateSeverity] = useState("MEDIUM");
  const [bugCreatePriority, setBugCreatePriority] = useState("P3_MEDIUM");
  const [bugCreateEnvironment, setBugCreateEnvironment] = useState("");
  const [bugCreateAffectedVersion, setBugCreateAffectedVersion] = useState("");
  const [bugCreateAssignedTo, setBugCreateAssignedTo] = useState("");
  const [bugCreateTestCaseId, setBugCreateTestCaseId] = useState("");
  const [bugCreateExecutionId, setBugCreateExecutionId] = useState("");
  const [bugCreateDueDate, setBugCreateDueDate] = useState("");
  const [bugCreateAttachmentsText, setBugCreateAttachmentsText] = useState("");
  const [bugTransitionToStatus, setBugTransitionToStatus] = useState("OPEN");
  const [bugTransitionReason, setBugTransitionReason] = useState("");
  const [bugTransitionDuplicateOf, setBugTransitionDuplicateOf] = useState("");
  const [bugResolveAction, setBugResolveAction] = useState("START_PROGRESS");
  const [bugResolveFixNotes, setBugResolveFixNotes] = useState("");
  const [bugResolveCommitLink, setBugResolveCommitLink] = useState("");
  const [bugCommentText, setBugCommentText] = useState("");
  const [bugCommentParentId, setBugCommentParentId] = useState("");
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentText, setEditingCommentText] = useState("");
  const [quickStatusByBugId, setQuickStatusByBugId] = useState<Record<string, string>>({});
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminCreateName, setAdminCreateName] = useState("");
  const [adminCreateEmail, setAdminCreateEmail] = useState("");
  const [adminCreatePassword, setAdminCreatePassword] = useState("");
  const [adminCreateRole, setAdminCreateRole] = useState("");
  const [adminUserSavingId, setAdminUserSavingId] = useState("");
  const [adminProjects, setAdminProjects] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [adminConfigs, setAdminConfigs] = useState<any[]>([]);
  const [adminBackups, setAdminBackups] = useState<any[]>([]);
  const [adminUserName, setAdminUserName] = useState("");
  const [adminUserEmail, setAdminUserEmail] = useState("");
  const [adminUserPassword, setAdminUserPassword] = useState("");
  const [adminUserRole, setAdminUserRole] = useState("TESTER");
  const [adminUserUpdateName, setAdminUserUpdateName] = useState("");
  const [adminUserUpdateRole, setAdminUserUpdateRole] = useState("TESTER");
  const [adminUserUpdateActive, setAdminUserUpdateActive] = useState(true);
  const [adminUserUpdateId, setAdminUserUpdateId] = useState("");
  const [adminProjectName, setAdminProjectName] = useState("");
  const [adminProjectDescription, setAdminProjectDescription] = useState("");
  const [adminProjectUpdateId, setAdminProjectUpdateId] = useState("");
  const [adminProjectUpdateName, setAdminProjectUpdateName] = useState("");
  const [adminProjectUpdateDescription, setAdminProjectUpdateDescription] = useState("");
  const [adminProjectUpdateActive, setAdminProjectUpdateActive] = useState(true);
  const [adminRoleUserId, setAdminRoleUserId] = useState("");
  const [adminRoleValue, setAdminRoleValue] = useState("TESTER");
  const [adminAuditEntityType, setAdminAuditEntityType] = useState("");
  const [adminConfigKey, setAdminConfigKey] = useState("");
  const [adminConfigValue, setAdminConfigValue] = useState("");
  const [adminBackupNotes, setAdminBackupNotes] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<DashboardFeature | "none">("none");
  const roleName = currentRole.toUpperCase();
  const isTester = roleName === "TESTER";
  const isDeveloper = roleName === "DEVELOPER";
  const isAdmin = roleName === "ADMIN";
  const roleKey = isTester ? "tester" : isDeveloper ? "developer" : isAdmin ? "admin" : "unknown";
  const canCreateAndManageTestCases = isTester;
  const canUseTemplates = isTester;
  const canRunBulkOps = isTester;
  const canImportTestCases = isTester;
  const canManageSuites = isTester;
  const canSeeSelectionControls = isTester;
  const canExecuteTests = isTester;
  const canManageTestRuns = isTester;
  const canViewBugs = isTester || isDeveloper;
  const canCreateBugs = isTester;
  const canTransitionBugs = isTester || isDeveloper;
  const canResolveBugs = isDeveloper;
  const testerFeatures: Array<{ key: DashboardFeature; label: string }> = [
    { key: "create_test_case", label: "Create Test Case" },
    { key: "templates", label: "Templates" },
    { key: "bulk_operations", label: "Bulk Operations" },
    { key: "import_test_cases", label: "Import Test Cases" },
    { key: "test_runs", label: "Test Run Management" },
    { key: "suite_management", label: "Suite Management" },
    { key: "execute_tests", label: "Execute Tests" },
    { key: "bug_management", label: "Bug Management" },
    { key: "test_cases", label: "Test Cases" },
  ];
  const developerFeatures: Array<{ key: DashboardFeature; label: string }> = [
    { key: "developer_workspace", label: "Developer Workspace" },
    { key: "bug_management", label: "Assigned Bugs" },
    { key: "test_cases", label: "Test Cases" },
  ];
  const adminFeatures: Array<{ key: DashboardFeature; label: string }> = [
    { key: "admin_workspace", label: "Admin Workspace" },
    { key: "admin_users", label: "Manage Users" },
    { key: "admin_projects", label: "Manage Projects" },
    { key: "admin_roles", label: "Manage Roles" },
    { key: "admin_audit_logs", label: "Audit Logs" },
    { key: "admin_system_config", label: "System Config" },
    { key: "admin_backups", label: "Backup Management" },
  ];
  const roleFeatures = isTester ? testerFeatures : isDeveloper ? developerFeatures : adminFeatures;
  const roleSummary = isTester
    ? "Tester workspace: create, edit, execute, report, and assign issues."
    : isDeveloper
    ? "Developer workspace: view assigned bugs, add fix notes, and update statuses."
    : isAdmin
    ? "Admin workspace: govern users, projects, roles, configuration, and audits."
    : "Workspace";
  const showCreateTestCase = canCreateAndManageTestCases && activeFeature === "create_test_case";
  const showTemplates = canUseTemplates && activeFeature === "templates";
  const showBulkOperations = canRunBulkOps && activeFeature === "bulk_operations";
  const showImport = canImportTestCases && activeFeature === "import_test_cases";
  const showTestRuns = canManageTestRuns && activeFeature === "test_runs";
  const showSuiteManagement = canManageSuites && activeFeature === "suite_management";
  const showExecute = canExecuteTests && activeFeature === "execute_tests";
  const showBugs =
    canViewBugs &&
    (activeFeature === "bug_management" || (isDeveloper && activeFeature === "developer_workspace"));
  const showTestCases = activeFeature === "test_cases";
  const showRolePanel = activeFeature === "developer_workspace" || activeFeature === "admin_workspace";
  const selectedExecutionRun = testRuns.find((run) => run.id === executionRunId) || null;
  const executionRunCaseIds = new Set(
    (selectedExecutionRun?.testCases || [])
      .map((item: any) => item?.testCaseId)
      .filter((id: any) => typeof id === "string" && id.length > 0)
  );
  const executionSelectableCases =
    executionRunId && executionRunCaseIds.size > 0
      ? testCases.filter((tc) => executionRunCaseIds.has(tc.id))
      : testCases;
  const showAdminUsers = isAdmin && activeFeature === "admin_users";
  const showAdminProjects = isAdmin && activeFeature === "admin_projects";
  const showAdminRoles = isAdmin && activeFeature === "admin_roles";
  const showAdminAuditLogs = isAdmin && activeFeature === "admin_audit_logs";
  const showAdminSystemConfig = isAdmin && activeFeature === "admin_system_config";
  const showAdminBackups = isAdmin && activeFeature === "admin_backups";
  const assignedBugCount = bugs.length;
  const p1UrgentCount = bugs.filter((item) => item.priority === "P1_URGENT").length;
  const criticalBugCount = bugs.filter((item) => item.severity === "CRITICAL").length;

  const parseSteps = (raw: string): unknown => {
    const value = raw.trim();
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({
          stepNumber: index + 1,
          action: line,
          testData: "N/A",
          expectedResult: "Expected result",
        }));
    }
  };

  const parseSection = (raw: string): unknown => {
    const value = raw.trim();
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    }
  };

  const parseMetadata = (raw: string): Record<string, unknown> => {
    const value = raw.trim();
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const meta: Record<string, unknown> = {};
      lines.forEach((line) => {
        const [key, ...rest] = line.split(":");
        if (key) {
          meta[key.trim()] = rest.join(":").trim();
        }
      });
      return meta;
    }
  };

  const parseTags = (raw: string): string[] =>
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const parseFieldMapping = (): Record<string, string> => {
    const raw = importFieldMappingText.trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Field mapping must be a JSON object");
    }
    const mapped: Record<string, string> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
      if (typeof v === "string" && v.trim()) {
        mapped[k] = v.trim();
      }
    });
    return mapped;
  };

  const parseCsvLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const buildImportPreview = async () => {
    try {
      const fieldMapping = parseFieldMapping();
      const excelRows =
        importType === "EXCEL"
          ? (importExcelRows.length > 0 ? importExcelRows : JSON.parse(importPayload))
          : [];
      const payload =
        importType === "JSON"
          ? { sourceType: "JSON", items: JSON.parse(importPayload), fieldMapping, preview: true }
          : importType === "CSV"
          ? { sourceType: "CSV", csvText: importPayload, fieldMapping, preview: true }
          : { sourceType: "EXCEL", rows: excelRows, fieldMapping, preview: true };
      const res = await importTestCasesApi(payload);
      setImportPreview(Array.isArray(res?.preview) ? res.preview : []);
      setImportPreviewErrors(Array.isArray(res?.errors) ? res.errors : []);
      setPreviewReady(true);
    } catch (error: any) {
      alert(error?.message || "Preview failed");
    }
  };

  const handleExcelFileChange = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      let rows: any[] = [];
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          rows = parsed;
        }
      } catch {
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.length >= 2) {
          const headers = parseCsvLine(lines[0]);
          rows = lines.slice(1).map((line) => {
            const cells = parseCsvLine(line);
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => {
              row[h] = cells[idx] || "";
            });
            return row;
          });
        }
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        alert("Unable to parse file. Use JSON array rows or CSV text for import.");
        return;
      }
      setImportExcelRows(rows);
      setImportExcelFileName(file.name);
      setImportPayload(JSON.stringify(rows, null, 2));
      setPreviewReady(false);
      setImportPreview([]);
      setImportPreviewErrors([]);
    } catch (error: any) {
      alert(error?.message || "Failed to parse Excel file");
    }
  };

  const loadTestCaseData = async () => {
    setIsRefreshing(true);
    if (isAdmin) {
      setTestCases([]);
      setTemplates([]);
      setTestRuns([]);
      setExecutionReports([]);
      setBugs([]);
      setIsRefreshing(false);
      return;
    }
    const bugParams: Record<string, string> = {
      status: bugFilterStatus,
      priority: bugFilterPriority,
      severity: bugFilterSeverity,
      sortBy: bugSortBy,
    };
    const [caseRows, templateRows, runRows, suiteRows, executionRows, bugRows] = await Promise.all([
      getTestCasesApi(),
      listTemplatesApi(),
      canManageTestRuns ? listTestRunsApi() : Promise.resolve([]),
      canManageSuites
        ? listSuitesApi(showArchivedSuites ? { includeArchived: "true" } : undefined)
        : Promise.resolve([]),
      canExecuteTests ? listExecutionReportsApi() : Promise.resolve([]),
      canViewBugs ? listBugsApi(bugParams) : Promise.resolve([]),
    ]);
    const rows = Array.isArray(caseRows) ? caseRows : [];
    setTestCases(rows);
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
    setTemplates(Array.isArray(templateRows) ? templateRows : []);
    setTestRuns(Array.isArray(runRows) ? runRows : []);
    const suiteList = Array.isArray(suiteRows) ? suiteRows : [];
    setSuites(suiteList);
    if (selectedSuiteId && !suiteList.some((suite: any) => suite.id === selectedSuiteId)) {
      setSelectedSuiteId("");
      setSuiteDetails(null);
      setSuiteExecutionHistory([]);
      setSuiteExecutionId("");
      setSuiteExecutionDetails(null);
    }
    setExecutionReports(Array.isArray(executionRows) ? executionRows : []);
    const bugList = Array.isArray(bugRows) ? bugRows : [];
    setBugs(bugList);
    setSelectedBug((prev: any) => {
      if (!prev?.id) return prev;
      return bugList.find((item) => item.id === prev.id) || null;
    });
    setIsRefreshing(false);
  };

  const loadAdminData = async () => {
    if (!isAdmin) {
      setAdminUsers([]);
      setAdminProjects([]);
      setAdminAuditLogs([]);
      setAdminConfigs([]);
      setAdminBackups([]);
      return;
    }
    const [users, projects, logs, configs, backups] = await Promise.all([
      listAdminUsersApi(),
      listAdminProjectsApi(),
      listAdminAuditLogsApi(adminAuditEntityType || undefined),
      listAdminSystemConfigsApi(),
      listAdminBackupsApi(),
    ]);
    setAdminUsers(Array.isArray(users) ? users : []);
    setAdminProjects(Array.isArray(projects) ? projects : []);
    setAdminAuditLogs(Array.isArray(logs) ? logs : []);
    setAdminConfigs(Array.isArray(configs) ? configs : []);
    setAdminBackups(Array.isArray(backups) ? backups : []);
  };

  const loadBugDetails = async (bugId: string) => {
    if (!bugId) {
      setSelectedBug(null);
      setBugComments([]);
      setBugCommentThreads([]);
      return;
    }
    const [bug, commentsPayload] = await Promise.all([getBugApi(bugId), listBugCommentsApi(bugId)]);
    setSelectedBug(bug || null);
    setBugComments(Array.isArray(commentsPayload?.comments) ? commentsPayload.comments : []);
    setBugCommentThreads(Array.isArray(commentsPayload?.threaded) ? commentsPayload.threaded : []);
  };

  const loadAdminUsers = async () => {
    const rows = await listAdminUsersApi();
    setAdminUsers(Array.isArray(rows) ? rows : []);
  };

  const resetExecutionPanel = () => {
    setExecutionCaseId("");
    setExecutionRunId("");
    setExecutionId("");
    setExecutionSteps([]);
    setExecutionNotes("");
    setExecutionSelectedStepNumber("");
    setExecutionStepStatus("PASSED");
    setExecutionActualResult("");
    setExecutionStepNotes("");
    setExecutionProgress(0);
    setExecutionStartedAt("");
    setExecutionCompletedAt("");
    setExecutionDurationSeconds(null);
    setExecutionEvidence([]);
    setEvidenceType("IMAGE");
    setEvidenceUrl("");
    setEvidenceName("");
    setEvidenceNotes("");
    setSelectedExecutionReportId("");
    setQuickBugTitle("");
    setQuickBugDescription("");
    setQuickBugSeverity("MEDIUM");
    setActiveSuiteExecutionContext(null);
  };

  const resetBugPanel = () => {
    setBugs([]);
    setSelectedBugId("");
    setSelectedBug(null);
    setBugComments([]);
    setBugCommentThreads([]);
    setBugCreateTitle("");
    setBugCreateDescription("");
    setBugCreateStepsToReproduce("");
    setBugCreateExpectedBehavior("");
    setBugCreateActualBehavior("");
    setBugCreateSeverity("MEDIUM");
    setBugCreatePriority("P3_MEDIUM");
    setBugCreateEnvironment("");
    setBugCreateAffectedVersion("");
    setBugCreateAssignedTo("");
    setBugCreateTestCaseId("");
    setBugCreateExecutionId("");
    setBugCreateDueDate("");
    setBugCreateAttachmentsText("");
    setBugTransitionToStatus("OPEN");
    setBugTransitionReason("");
    setBugTransitionDuplicateOf("");
    setBugResolveAction("START_PROGRESS");
    setBugResolveFixNotes("");
    setBugResolveCommitLink("");
    setBugCommentText("");
    setBugCommentParentId("");
    setEditingCommentId("");
    setEditingCommentText("");
    setBugFilterStatus("");
    setBugFilterPriority("");
    setBugFilterSeverity("");
    setBugSortBy("");
  };

  const resetEntryFields = () => {
    setTcTitle("");
    setTcDescription("");
    setTcPreConditionsText("");
    setTcTestDataRequirementsText("");
    setTcEnvironmentRequirementsText("");
    setTcModule("Authentication");
    setTcStepsText("");
    setTcPostConditionsText("");
    setTcMetadataText("");
    setTcTagsText("");
    setTcEstimatedDurationMinutes("");
    setTcAutomationStatus("NOT_AUTOMATED");
    setTcAutomationScriptLink("");
    setTcPriority("MEDIUM");
    setTcSeverity("MAJOR");
    setTcType("FUNCTIONAL");
    setTcStatus("DRAFT");
    setBulkOperation("STATUS");
    setBulkStatus("READY_FOR_REVIEW");
    setBulkPriority("MEDIUM");
    setBulkSeverityValue("MAJOR");
    setBulkModule("General");
    setBulkSuiteId("");
    setBulkAssignee("");
    setTemplateName("");
    setTemplateCategory("");
    setTemplateSteps("");
    setImportType("JSON");
    setImportFieldMappingText("");
    setImportExcelRows([]);
    setImportExcelFileName("");
    setImportPayload("");
    setRunName("");
    setRunDescription("");
    setRunStartDate("");
    setRunEndDate("");
    setRunTesterIdsText("");
    setSelectedRunId("");
    setRunDetails(null);
    setSuiteName("");
    setSuiteDescription("");
    setSuiteModule("");
    setSuiteProjectId("");
    setSuiteParentId("");
    setSuiteCreateCaseSelection([]);
    setSuiteAddCaseSelection([]);
    setSuiteCreateCaseSearch("");
    setSuiteAddCaseSearch("");
    setSelectedSuiteId("");
    setSuiteDetails(null);
    setSuiteReorderIds([]);
    setSuiteCloneName("");
    setSuiteExecutionMode("SEQUENTIAL");
    setSuiteExecutionTesterIdsText("");
    setSuiteExecutionId("");
    setSuiteExecutionDetails(null);
    setSuiteExecutionHistory([]);
    setAdminUsers([]);
    setAdminCreateName("");
    setAdminCreateEmail("");
    setAdminCreatePassword("");
    setAdminCreateRole("");
    setAdminUserSavingId("");
    resetExecutionPanel();
    resetBugPanel();
  };

  useEffect(() => {
    if (screen !== "dashboard" || !canManageSuites) return;
    loadTestCaseData().catch(() => {
      // no-op
    });
  }, [showArchivedSuites, screen, canManageSuites]);

  const resetCreateTestCaseFields = () => {
    setTcTitle("");
    setTcDescription("");
    setTcPreConditionsText("");
    setTcTestDataRequirementsText("");
    setTcEnvironmentRequirementsText("");
    setTcModule("Authentication");
    setTcStepsText("");
    setTcPostConditionsText("");
    setTcMetadataText("");
    setTcTagsText("");
    setTcEstimatedDurationMinutes("");
    setTcAutomationStatus("NOT_AUTOMATED");
    setTcAutomationScriptLink("");
    setTcPriority("MEDIUM");
    setTcSeverity("MAJOR");
    setTcType("FUNCTIONAL");
    setTcStatus("DRAFT");
  };

  const resetTemplateFields = () => {
    setTemplateName("");
    setTemplateCategory("");
    setTemplateSteps("");
  };

  const resetImportFields = () => {
    setImportType("JSON");
    setImportFieldMappingText("");
    setImportExcelRows([]);
    setImportExcelFileName("");
    setImportPayload("");
    setImportPreview([]);
    setImportPreviewErrors([]);
    setPreviewReady(false);
  };

  const resetRunFields = () => {
    setRunName("");
    setRunDescription("");
    setRunStartDate("");
    setRunEndDate("");
    setRunTesterIdsText("");
    setSelectedRunId("");
    setRunDetails(null);
  };

  const resetQuickBugFields = () => {
    setSelectedExecutionReportId("");
    setQuickBugTitle("");
    setQuickBugDescription("");
    setQuickBugSeverity("MEDIUM");
  };

  const resetBugCreateFields = () => {
    setBugCreateTitle("");
    setBugCreateDescription("");
    setBugCreateStepsToReproduce("");
    setBugCreateExpectedBehavior("");
    setBugCreateActualBehavior("");
    setBugCreateSeverity("MEDIUM");
    setBugCreatePriority("P3_MEDIUM");
    setBugCreateEnvironment("");
    setBugCreateAffectedVersion("");
    setBugCreateAssignedTo("");
    setBugCreateTestCaseId("");
    setBugCreateExecutionId("");
    setBugCreateDueDate("");
    setBugCreateAttachmentsText("");
  };

  const appendCommentSnippet = (snippet: string) => {
    setBugCommentText((prev) => (prev ? `${prev} ${snippet}` : snippet));
  };

  const mentionCandidates = (() => {
    const map = new Map<string, { key: string; label: string }>();
    const add = (name?: string, email?: string) => {
      const base = (name || email || "").trim();
      if (!base) return;
      const key = base.toLowerCase().replace(/\s+/g, ".");
      if (!map.has(key)) {
        map.set(key, { key, label: name ? `${name}${email ? ` (${email})` : ""}` : email || key });
      }
    };
    add(selectedBug?.reporter?.name, selectedBug?.reporter?.email);
    add(selectedBug?.assignee?.name, selectedBug?.assignee?.email);
    bugComments.forEach((item) => add(item?.author?.name, item?.author?.email));
    return Array.from(map.values());
  })();

  const filteredMentionCandidates = mentionQuery
    ? mentionCandidates.filter((item) => item.key.includes(mentionQuery.toLowerCase()) || item.label.toLowerCase().includes(mentionQuery.toLowerCase()))
    : mentionCandidates;

  const handleCommentTextChange = (value: string) => {
    setBugCommentText(value);
    const match = value.match(/@([a-zA-Z0-9._-]*)$/);
    if (match) {
      setMentionQuery(match[1] || "");
      setShowMentionPopup(true);
    } else {
      setMentionQuery("");
      setShowMentionPopup(false);
    }
  };

  const applyMention = (key: string) => {
    const next = bugCommentText.replace(/@([a-zA-Z0-9._-]*)$/, `@${key} `);
    setBugCommentText(next);
    setMentionQuery("");
    setShowMentionPopup(false);
  };

  const canModifyComment = (item: any): boolean => {
    const authorId = String(item.authorId || item.author?.id || "");
    const isOwner = !!currentUserId && authorId === currentUserId;
    const within5Min = Date.now() - new Date(item.createdAt).getTime() <= 5 * 60 * 1000;
    return isAdmin || (isOwner && within5Min);
  };

  const isDeletedComment = (item: any): boolean => String(item.comment || "").trim() === "[DELETED]";

  const renderInlineCommentMarkdown = (text: string): JSX.Element[] => {
    const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g).filter((part) => part.length > 0);
    return tokens.map((part, index) => {
      if (/^`[^`]+`$/.test(part)) {
        return (
          <code className="commentCode" key={`code-${index}`}>
            {part.slice(1, -1)}
          </code>
        );
      }
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
      }
      if (/^_[^_]+_$/.test(part)) {
        return <em key={`italic-${index}`}>{part.slice(1, -1)}</em>;
      }
      return <span key={`text-${index}`}>{part}</span>;
    });
  };

  const renderCommentContent = (text: string): JSX.Element => {
    const lines = text.split(/\r?\n/);
    return (
      <>
        {lines.map((line, index) => (
          <span key={`line-${index}`}>
            {renderInlineCommentMarkdown(line)}
            {index < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </>
    );
  };

  const renderCommentThreads = (items: any[], depth = 0): JSX.Element[] =>
    items.map((item) => (
      <div key={item.id} style={{ marginLeft: depth > 0 ? `${Math.min(depth * 18, 54)}px` : "0" }}>
        <div className="row">
          <span className="title">
            <strong>Comment:</strong>{" "}
            {isDeletedComment(item) ? "[Comment deleted]" : renderCommentContent(String(item.comment || ""))}
            {Array.isArray(item.mentions) && item.mentions.length > 0 ? (
              <>
                <br />
                <strong>Mentions:</strong> {item.mentions.map((m: string) => `@${m}`).join(", ")}
              </>
            ) : null}
          </span>
          <span className="meta">
            <strong>By:</strong> {item.author?.name || item.authorId}
            <br />
            <strong>At:</strong> {new Date(item.createdAt).toLocaleString()}
          </span>
          <button
            className="button small"
            onClick={() => {
              setBugCommentParentId(item.id);
              appendCommentSnippet(`@${(item.author?.name || "user").replace(/\s+/g, ".").toLowerCase()}`);
            }}
            disabled={isDeletedComment(item)}
          >
            Reply
          </button>
          <button
            className="button small"
            onClick={() => {
              setEditingCommentId(item.id);
              setEditingCommentText(item.comment || "");
            }}
            disabled={!canModifyComment(item) || isDeletedComment(item)}
          >
            Edit
          </button>
          <button
            className="button small danger"
            onClick={async () => {
              try {
                await deleteBugCommentApi(item.id);
                if (selectedBug?.id) {
                  await loadBugDetails(selectedBug.id);
                }
              } catch (error: any) {
                alert(error?.message || "Delete comment failed");
              }
            }}
            disabled={!canModifyComment(item) || isDeletedComment(item)}
          >
            Delete
          </button>
        </div>
        {Array.isArray(item.replies) && item.replies.length > 0 ? renderCommentThreads(item.replies, depth + 1) : null}
      </div>
    ));

  const startEditCase = (tc: any) => {
    setEditingId(tc.id);
    setEditTitle(tc.title || "");
    setEditDescription(tc.description || "");
    setEditPreConditionsText(JSON.stringify(tc.preConditions ?? [], null, 2));
    setEditTestDataRequirementsText(JSON.stringify(tc.testDataRequirements ?? [], null, 2));
    setEditEnvironmentRequirementsText(JSON.stringify(tc.environmentRequirements ?? [], null, 2));
    setEditModule(tc.module || "General");
    setEditPostConditionsText(JSON.stringify(tc.postConditions ?? [], null, 2));
    setEditMetadataText(JSON.stringify(tc.metadata ?? {}, null, 2));
    setEditTagsText((tc.tags ?? []).join(", "));
    setEditEstimatedDurationMinutes(
      tc.estimatedDurationMinutes !== null && tc.estimatedDurationMinutes !== undefined
        ? String(tc.estimatedDurationMinutes)
        : ""
    );
    setEditAutomationStatus(tc.automationStatus || "NOT_AUTOMATED");
    setEditAutomationScriptLink(tc.automationScriptLink || "");
    setEditChangeSummary("");
    setEditPriority(tc.priority || "MEDIUM");
    setEditSeverity(tc.severity || "MAJOR");
    setEditType(tc.type || "FUNCTIONAL");
    setEditStatus(tc.status || "DRAFT");
  };

  const saveEditCase = async () => {
    if (!editingId) return;
    try {
      if (!editChangeSummary.trim()) {
        alert("Change summary is required");
        return;
      }
      if (editEstimatedDurationMinutes && Number.isNaN(Number(editEstimatedDurationMinutes))) {
        alert("Estimated duration must be a number (minutes)");
        return;
      }
      await updateTestCaseApi(editingId, {
        title: editTitle,
        description: editDescription,
        preConditions: parseSection(editPreConditionsText),
        testDataRequirements: parseSection(editTestDataRequirementsText),
        environmentRequirements: parseSection(editEnvironmentRequirementsText),
        module: editModule,
        postConditions: parseSection(editPostConditionsText),
        metadata: parseMetadata(editMetadataText),
        tags: parseTags(editTagsText),
        estimatedDurationMinutes: editEstimatedDurationMinutes
          ? Number(editEstimatedDurationMinutes)
          : null,
        automationStatus: editAutomationStatus,
        automationScriptLink: editAutomationScriptLink || null,
        changeSummary: editChangeSummary,
        priority: editPriority,
        severity: editSeverity,
        type: editType,
        status: editStatus,
      });
      setEditingId("");
      setEditTitle("");
      setEditDescription("");
      setEditPreConditionsText("");
      setEditTestDataRequirementsText("");
      setEditEnvironmentRequirementsText("");
      setEditModule("");
      setEditPostConditionsText("");
      setEditMetadataText("");
      setEditTagsText("");
      setEditEstimatedDurationMinutes("");
      setEditAutomationStatus("NOT_AUTOMATED");
      setEditAutomationScriptLink("");
      setEditChangeSummary("");
      setEditPriority("MEDIUM");
      setEditSeverity("MAJOR");
      setEditType("FUNCTIONAL");
      setEditStatus("DRAFT");
      await loadTestCaseData();
      alert("Test case updated");
    } catch (error: any) {
      alert(error?.message || "Edit failed");
    }
  };

  const parseIdsFromText = (raw: string): string[] =>
    raw
      .split(/[\n,]/)
      .map((item) => item.trim().replace(/^<+|>+$/g, "").replace(/^"+|"+$/g, ""))
      .filter(Boolean);

  const toggleSelection = (
    id: string,
    setter: (updater: (prev: string[]) => string[]) => void
  ) => {
    setter((prev: string[]) =>
      prev.includes(id) ? prev.filter((item: string) => item !== id) : [...prev, id]
    );
  };

  const getSuiteFriendlyError = (error: any, fallback: string): string => {
    const msg = String(error?.message || "").trim();
    if (!msg) return fallback;
    if (msg.includes("Circular hierarchy is not allowed")) {
      return "Invalid parent selection: this creates a circular suite hierarchy.";
    }
    if (msg.includes("Archived suite cannot be set as parent")) {
      return "Selected parent suite is archived. Restore the parent suite first.";
    }
    if (msg.includes("Restore parent suite first")) {
      return "Restore the parent suite first, then restore this child suite.";
    }
    if (msg.includes("Archive child suites first")) {
      return "Archive all child suites first, then archive the parent suite.";
    }
    if (msg.includes("testCaseIds must exactly match current suite membership")) {
      return "Reorder list must include all current suite test cases exactly once.";
    }
    if (msg.includes("testCaseIds must not contain duplicates")) {
      return "Reorder list contains duplicate test case IDs/codes. Remove duplicates and retry.";
    }
    if (msg.includes("One or more testCaseIds are invalid/deleted")) {
      return "Some test case IDs/codes are invalid or deleted. Verify IDs and retry.";
    }
    if (msg.includes("Suite has no test cases to execute")) {
      return "Add test cases to the suite before starting suite execution.";
    }
    if (msg.includes("Archive suite before permanent delete")) {
      return "Archive the suite first, then delete it permanently.";
    }
    if (msg.includes("One or more testerIds are invalid")) {
      return "One or more tester IDs are invalid or inactive.";
    }
    if (msg.includes("Sequential suite mode: execute the next pending suite case first")) {
      return "Sequential suite mode requires executing the next pending case in order.";
    }
    if (msg.includes("already in progress by another tester")) {
      return "This suite case is already in progress by another tester.";
    }
    if (msg.includes("This suite case is already executed")) {
      return "This suite case is already executed.";
    }
    return msg || fallback;
  };

  const loadSuiteDetails = async (suiteId: string) => {
    if (!suiteId) {
      setSuiteDetails(null);
      setSuiteExecutionHistory([]);
      setSuiteAddCaseSelection([]);
      return;
    }
    const [detail, history] = await Promise.all([getSuiteApi(suiteId), listSuiteExecutionsApi(suiteId)]);
    setSuiteDetails(detail || null);
    setSuiteExecutionHistory(Array.isArray(history) ? history : []);
    setSuiteAddCaseSelection([]);
    if (Array.isArray(detail?.suiteCases)) {
      setSuiteReorderIds(detail.suiteCases.map((item: any) => item.testCaseId));
    }
  };

  const openExecutionSession = async (testCaseId: string, runId?: string) => {
    const opened = await openExecutionApi(testCaseId, runId || undefined);
    let currentSteps = Array.isArray(opened?.stepResults) ? opened.stepResults : [];
    setExecutionCaseId(testCaseId);
    setExecutionRunId(runId || "");
    setExecutionProgress(opened?.draftExecution?.progressPercent || 0);
    setExecutionNotes(opened?.draftExecution?.notes || "");
    setExecutionStartedAt(opened?.draftExecution?.startedAt || "");
    setExecutionCompletedAt(opened?.draftExecution?.completedAt || "");
    setExecutionDurationSeconds(
      typeof opened?.draftExecution?.durationSeconds === "number"
        ? opened.draftExecution.durationSeconds
        : null
    );
    setExecutionEvidence(Array.isArray(opened?.draftExecution?.evidence) ? opened.draftExecution.evidence : []);
    if (opened?.draftExecution?.id) {
      setExecutionId(opened.draftExecution.id);
    } else {
      const started = await startExecutionApi({
        testCaseId,
        testRunId: runId || null,
      });
      setExecutionId(started.id);
      setExecutionStartedAt(started?.startedAt || "");
      setExecutionCompletedAt("");
      setExecutionDurationSeconds(null);
      setExecutionEvidence([]);
      // Ensure UI has steps even if initial open response had none.
      const reopened = await openExecutionApi(testCaseId, runId || undefined);
      const reopenedSteps = Array.isArray(reopened?.stepResults) ? reopened.stepResults : [];
      if (reopenedSteps.length > 0) {
        currentSteps = reopenedSteps;
        setExecutionProgress(reopened?.draftExecution?.progressPercent || 0);
        setExecutionNotes(reopened?.draftExecution?.notes || "");
      }
    }
    setExecutionSteps(currentSteps);
    setExecutionStepStatus("PASSED");
    setExecutionActualResult("");
    setExecutionStepNotes("");
    if (currentSteps.length > 0) {
      setExecutionSelectedStepNumber(String(currentSteps[0].stepNumber));
    } else {
      setExecutionSelectedStepNumber("");
      throw new Error("No executable steps found for this test case. Add steps and try again.");
    }
  };

  const openSuiteExecutionCase = async (suiteExecution: any, suiteCase: any) => {
    if (!suiteExecution?.id || !suiteExecution?.linkedTestRun?.id) {
      throw new Error("Linked run not found for this suite execution.");
    }
    if (!suiteCase?.testCaseId) {
      throw new Error("Invalid suite case selected.");
    }
    setActiveSuiteExecutionContext({
      suiteExecutionId: suiteExecution.id,
      mode: String(suiteExecution.mode || "SEQUENTIAL"),
      runId: suiteExecution.linkedTestRun.id,
    });
    await openExecutionSession(suiteCase.testCaseId, suiteExecution.linkedTestRun.id);
    setActiveFeature("execute_tests");
  };

  const moveSuiteCase = (testCaseId: string, direction: "UP" | "DOWN") => {
    setSuiteReorderIds((prev) => {
      const current = [...prev];
      const idx = current.indexOf(testCaseId);
      if (idx < 0) return prev;
      const nextIdx = direction === "UP" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= current.length) return prev;
      [current[idx], current[nextIdx]] = [current[nextIdx], current[idx]];
      return current;
    });
  };

  const parseBugAttachmentsInput = (raw: string): Array<{
    fileType: string;
    fileUrl: string;
    fileName: string;
    notes?: string;
  }> => {
    const value = raw.trim();
    if (!value) return [];
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error("Attachments must be a JSON array");
    }
    return parsed
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item: any) => ({
        fileType: String(item.fileType || "").toUpperCase(),
        fileUrl: String(item.fileUrl || ""),
        fileName: String(item.fileName || ""),
        notes: item.notes ? String(item.notes) : undefined,
      }))
      .filter((item) => item.fileType && item.fileUrl && item.fileName);
  };

  /* PASSWORD RULES */
  const isValidPassword = (pwd: string) =>
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[@$!%*?&]/.test(pwd);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    const path = window.location.pathname.toLowerCase();
    const isResetPath = path === "/reset-password";

    if (isResetPath && token) {
      setResetToken(token);
      setScreen("reset");
    }
  }, []);

  useEffect(() => {
    if (screen !== "dashboard") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return;
      }

      const refreshed = await refreshTokenApi(refreshToken);
      if (refreshed?.accessToken && refreshed?.refreshToken) {
        setSessionTokens(refreshed.accessToken, refreshed.refreshToken, rememberMe);
      }
    }, 14 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [screen, rememberMe]);

  useEffect(() => {
    setPreviewReady(false);
    setImportPreview([]);
    setImportPreviewErrors([]);
  }, [importPayload, importType, importFieldMappingText]);

  useEffect(() => {
    if (screen !== "dashboard") {
      setNavOpen(false);
      setActiveFeature("none");
      setShowTestCaseList(false);
      setExpandedTestCaseId("");
      setSelectedIds([]);
      setEditingId("");
      setTestRuns([]);
      setSelectedRunId("");
      setRunDetails(null);
      setAdminUsers([]);
      setAdminCreateName("");
      setAdminCreateEmail("");
      setAdminCreatePassword("");
      setAdminCreateRole("");
      setAdminUserSavingId("");
      resetExecutionPanel();
      resetBugPanel();
    }
  }, [screen, currentRole]);

  useEffect(() => {
    if (screen !== "dashboard") return;
    setActiveFeature("none");
  }, [screen, isTester, isDeveloper, isAdmin]);

  useEffect(() => {
    if (screen === "login") {
      setEmail("");
      setPassword("");
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== "register") return;
    setName("");
    setEmail("");
    setPassword("");
    setRole("");
  }, [screen]);

  useEffect(() => {
    if (screen !== "dashboard" || !selectedBugId) return;
    loadBugDetails(selectedBugId).catch(() => {
      setSelectedBug(null);
      setBugComments([]);
    });
  }, [selectedBugId, screen]);

  useEffect(() => {
    if (screen !== "dashboard" || !currentRole) return;
    const loader = isAdmin ? loadAdminData : loadTestCaseData;
    loader().catch(() => {
      // no-op: page-level actions already show explicit alerts on manual refresh
    });
  }, [screen, currentRole, isAdmin]);

  useEffect(() => {
    if (screen !== "dashboard") return;
    if (isAdmin) {
      if (
        activeFeature === "admin_users" ||
        activeFeature === "admin_projects" ||
        activeFeature === "admin_roles" ||
        activeFeature === "admin_audit_logs" ||
        activeFeature === "admin_system_config" ||
        activeFeature === "admin_backups"
      ) {
        loadAdminData().catch(() => {
          // no-op
        });
      }
      return;
    }
    if (activeFeature !== "bug_management" && activeFeature !== "test_cases") return;
    loadTestCaseData().catch(() => {
      // no-op
    });
  }, [activeFeature, screen, isAdmin]);

  useEffect(() => {
    if (!isAdmin || screen !== "dashboard" || activeFeature !== "admin_audit_logs") return;
    loadAdminData().catch(() => {
      // no-op
    });
  }, [adminAuditEntityType, activeFeature, isAdmin, screen]);

  useEffect(() => {
    if (screen !== "dashboard" || !isAdmin || activeFeature !== "admin_workspace") return;
    setAdminCreateName("");
    setAdminCreateEmail("");
    setAdminCreatePassword("");
    setAdminCreateRole("");
    loadAdminUsers().catch(() => {
      setAdminUsers([]);
    });
  }, [screen, isAdmin, activeFeature]);

  useEffect(() => {
    if (!executionRunId || !executionCaseId) return;
    const stillValid = executionSelectableCases.some((tc) => tc.id === executionCaseId);
    if (!stillValid) {
      setExecutionCaseId("");
      setExecutionId("");
      setExecutionSteps([]);
      setExecutionSelectedStepNumber("");
      setExecutionProgress(0);
      setExecutionNotes("");
      setExecutionActualResult("");
      setExecutionStepNotes("");
    }
  }, [executionRunId, executionCaseId, testRuns, testCases]);

  useEffect(() => {
    if (!executionRunId) return;
    if (executionCaseId) return;
    if (!executionSelectableCases.length) return;
    setExecutionCaseId(executionSelectableCases[0].id);
  }, [executionRunId, executionCaseId, executionSelectableCases]);

  /* REGISTER */
  const handleRegister = async () => {
    if (!role) {
      alert("Please select a role");
      return;
    }
    if (!isValidPassword(password)) {
      alert(
        "Password must be at least 8 characters and include uppercase, number, and special character."
      );
      return;
    }

    const res = await registerApi(name, email, password, role);
    alert(res.message || "Registered successfully");
    setName("");
    setEmail("");
    setPassword("");
    setRole("");
    setScreen("login");
  };

  /* LOGIN */
  const handleLogin = async () => {
    const res = await loginApi(email, password, rememberMe);

    if (res.accessToken && res.refreshToken) {
      setSessionTokens(res.accessToken, res.refreshToken, rememberMe);
      setCurrentRole(res?.user?.role || "");
      setCurrentUserId(res?.user?.id || "");
      setShowTestCaseList(false);
      setExpandedTestCaseId("");
      setSelectedIds([]);
      setEditingId("");
      resetBugPanel();
      setNavOpen(false);
      setScreen("dashboard");
      try {
        await loadTestCaseData();
      } catch (error: any) {
        alert(error?.message || "Failed to load test data");
      }
    } else {
      alert(res.message || "Invalid email or password");
    }
  };

  /* LOGOUT */
  const handleLogout = () => {
    clearSessionTokens();
    setCurrentRole("");
    setCurrentUserId("");
    setEmail("");
    setPassword("");
    setShowTestCaseList(false);
    setExpandedTestCaseId("");
    setSelectedIds([]);
    setEditingId("");
    resetBugPanel();
    setNavOpen(false);
    setActiveFeature("none");
    setScreen("login");
  };

  return (
    <div className="container">
      <div className={`card ${screen === "dashboard" ? "cardDashboard" : "cardAuth"}`}>
        <h2 className="brandTitle">TestTrack Pro</h2>
        {screen !== "dashboard" && (
          <p className="authTagline">Quality engineering workspace for testers, developers, and admins.</p>
        )}

        {screen === "login" && (
          <section className="authPanel">
            <h3>Login</h3>

            <input
              className="input"
              placeholder="Email"
              value={email}
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* ✅ REMEMBER ME (ADDED HERE) */}
            <div className="remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span> Remember me</span>
            </div>

            <button className="button" onClick={handleLogin}>
              Login
            </button>

            <div className="link" onClick={() => setScreen("forgot")}>
              Forgot password?
            </div>

            <div className="link" onClick={() => setScreen("register")}>
              New user? Register
            </div>
          </section>
        )}

        {screen === "register" && (
          <section className="authPanel">
            <h3>Register</h3>

            <input
              className="input"
              placeholder="Name"
              value={name}
              autoComplete="off"
              name="register_name"
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="input"
              placeholder="Email"
              value={email}
              autoComplete="off"
              name="register_email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="new-password"
              name="register_password"
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="note">
              Password must include uppercase, lowercase, number & special character
            </div>

            <select
              className="input"
              value={role}
              name="register_role"
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Select role</option>
              <option value="TESTER">TESTER</option>
              <option value="DEVELOPER">DEVELOPER</option>
            </select>

            <button className="button" onClick={handleRegister}>
              Register
            </button>

            <div className="link" onClick={() => setScreen("login")}>
              Back to login
            </div>
          </section>
        )}

        {screen === "forgot" && (
          <section className="authPanel">
            <h3>Forgot Password</h3>

            <input
              className="input"
              placeholder="Registered email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              className="button"
              onClick={async () => {
                const res = await forgotPasswordApi(email);
                alert(res.message);
                setEmail("");
                setScreen("login");
              }}
            >
              Send Reset Link
            </button>

            <div className="link" onClick={() => setScreen("login")}>
              Back to login
            </div>
          </section>
        )}

        {screen === "reset" && (
          <section className="authPanel">
            <h3>Reset Password</h3>

            {!resetToken ? (
              <div className="note">Invalid reset link. Please request a new one.</div>
            ) : (
              <>
                <input
                  className="input"
                  type="password"
                  placeholder="New password"
                  onChange={(e) => setNewPassword(e.target.value)}
                />

                <div className="note">
                  Password must include uppercase, lowercase, number & special character
                </div>

                <button
                  className="button"
                  onClick={async () => {
                    if (!isValidPassword(newPassword)) {
                      alert(
                        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
                      );
                      return;
                    }

                    const res = await resetPasswordApi(resetToken, newPassword);
                    alert(res.message || "Password reset complete");

                    if (
                      typeof res.message === "string" &&
                      res.message.toLowerCase().includes("successful")
                    ) {
                      setNewPassword("");
                      window.history.replaceState({}, "", "/");
                      setScreen("login");
                    }
                  }}
                >
                  Set New Password
                </button>
              </>
            )}

            <div
              className="link"
              onClick={() => {
                window.history.replaceState({}, "", "/");
                setScreen("login");
              }}
            >
              Back to login
            </div>
          </section>
        )}

        {screen === "dashboard" && (
          <div className="dashboard">
            <div className="toolbar">
              <div className="toolbarIntro">
                <button
                  className="menuButton"
                  onClick={() => setNavOpen((prev) => !prev)}
                  title="Open feature menu"
                >
                  <span />
                  <span />
                  <span />
                </button>
                <h3>Test Case Management</h3>
                <p className="note">
                  Signed in as <strong>{currentRole || "N/A"}</strong>{" "}
                  <span className={`roleBadge role-${roleKey}`}>{currentRole || "USER"}</span>
                </p>
                <p className="note">{roleSummary}</p>
              </div>
              <div className="toolbarActions">
                <button
                  className="button small"
                  disabled={isRefreshing}
                  onClick={async () => {
                    try {
                      if (!isAdmin) {
                        resetEntryFields();
                        await loadTestCaseData();
                      } else {
                        await loadAdminData();
                      }
                    } catch (error: any) {
                      setIsRefreshing(false);
                      alert(error?.message || "Refresh failed");
                    }
                  }}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
                <button className="button small danger" onClick={handleLogout}>
                  Logout
                </button>
                <button
                  className="button small"
                  style={{ backgroundColor: "#374151" }}
                  onClick={async () => {
                    const res = await logoutAllApi();
                    alert(res.message || "Logged out from all devices");
                    clearSessionTokens();
                    setScreen("login");
                  }}
                >
                  Logout All
                </button>
              </div>
            </div>

            <div className={`dashboardBody ${navOpen ? "withSidebar" : "withoutSidebar"}`}>
              {navOpen && (
                <aside className="featureSidebar">
                  <h4>Features</h4>
                  <div className="featureList">
                    {roleFeatures.map((feature) => (
                      <button
                        key={feature.key}
                        className={`featureItem ${activeFeature === feature.key ? "active" : ""}`}
                        onClick={() => setActiveFeature(feature.key)}
                      >
                        {feature.label}
                      </button>
                    ))}
                  </div>
                </aside>
              )}

              <div className="dashboardContent">
            {activeFeature === "none" && (
              <section className="panel">
                <h4>Select A Feature</h4>
                <p className="note">Open the menu icon and choose a feature to continue.</p>
              </section>
            )}
            <div className="dashboardGrid">
              {isDeveloper && showRolePanel && activeFeature === "developer_workspace" && (
                <section className="panel rolePanel rolePanelDeveloper">
                  <h4>Developer Workspace</h4>
                  <p className="note">
                    Use this dashboard to view complete test case details and work on assigned issues, status
                    updates, fix notes, re-test requests, and developer reports.
                  </p>
                </section>
              )}

              {isAdmin && showRolePanel && activeFeature === "admin_workspace" && (
                <section className="panel rolePanel rolePanelAdmin">
                  <h4>Admin Workspace</h4>
                  <p className="note">
                    Admin operations are restricted to user/project/role management, audit logs, system
                    configuration, and backup endpoints.
                  </p>

                  <div className="inlineGrid">
                    <input
                      className="input"
                      placeholder="Name"
                      value={adminCreateName}
                      autoComplete="off"
                      name="admin_create_name"
                      onChange={(e) => setAdminCreateName(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Email"
                      value={adminCreateEmail}
                      autoComplete="off"
                      name="admin_create_email"
                      onChange={(e) => setAdminCreateEmail(e.target.value)}
                    />
                  </div>
                  <div className="inlineGrid">
                    <input
                      className="input"
                      type="password"
                      placeholder="Temporary Password"
                      value={adminCreatePassword}
                      autoComplete="new-password"
                      name="admin_create_password"
                      onChange={(e) => setAdminCreatePassword(e.target.value)}
                    />
                    <select
                      className="input"
                      value={adminCreateRole}
                      onChange={(e) => setAdminCreateRole(e.target.value)}
                    >
                      <option value="">Select role</option>
                      <option value="TESTER">TESTER</option>
                      <option value="DEVELOPER">DEVELOPER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <button
                    className="button"
                      onClick={async () => {
                      try {
                        if (!adminCreateName.trim() || !adminCreateEmail.trim() || !adminCreatePassword.trim() || !adminCreateRole) {
                          alert("Name, email, password, and role are required");
                          return;
                        }
                        await createAdminUserApi({
                          name: adminCreateName.trim(),
                          email: adminCreateEmail.trim().toLowerCase(),
                          password: adminCreatePassword,
                          role: adminCreateRole,
                        });
                        setAdminCreateName("");
                        setAdminCreateEmail("");
                        setAdminCreatePassword("");
                        setAdminCreateRole("");
                        await loadAdminUsers();
                        alert("User created");
                      } catch (error: any) {
                        alert(error?.message || "Create user failed");
                      }
                    }}
                  >
                    Create User
                  </button>

                  <div className="panelHeader" style={{ marginTop: "12px" }}>
                    <h4 style={{ marginBottom: 0 }}>Manage Users</h4>
                    <button
                      className="button small"
                      onClick={async () => {
                        try {
                          await loadAdminUsers();
                        } catch (error: any) {
                          alert(error?.message || "Load users failed");
                        }
                      }}
                    >
                      Refresh Users
                    </button>
                  </div>
                  <div className="listCompact">
                    {adminUsers.length === 0 ? (
                      <p className="note">No users found.</p>
                    ) : (
                      adminUsers.map((user) => {
                        const isCurrentAdmin = user.id === currentUserId;
                        const isSaving = adminUserSavingId === user.id;
                        return (
                          <div className="row adminUserRow" key={user.id}>
                            <span className="title">
                              <strong>{user.name || "Unnamed user"}</strong>
                              <br />
                              {user.email}
                            </span>
                            <span className="meta">
                              {isCurrentAdmin ? "Current account" : user.isActive ? "Active" : "Inactive"}
                            </span>
                            <select
                              className="input adminRoleInput"
                              value={user.role || "TESTER"}
                              disabled={isSaving}
                              onChange={async (e) => {
                                try {
                                  const nextRole = e.target.value;
                                  setAdminUserSavingId(user.id);
                                  await updateAdminRoleApi(user.id, nextRole);
                                  await loadAdminUsers();
                                } catch (error: any) {
                                  alert(error?.message || "Role update failed");
                                } finally {
                                  setAdminUserSavingId("");
                                }
                              }}
                            >
                              <option value="TESTER">TESTER</option>
                              <option value="DEVELOPER">DEVELOPER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                            <button
                              className="button small"
                              disabled={isSaving || isCurrentAdmin}
                              onClick={async () => {
                                try {
                                  setAdminUserSavingId(user.id);
                                  await updateAdminUserApi(user.id, { isActive: !Boolean(user.isActive) });
                                  await loadAdminUsers();
                                } catch (error: any) {
                                  alert(error?.message || "Status update failed");
                                } finally {
                                  setAdminUserSavingId("");
                                }
                              }}
                            >
                              {Boolean(user.isActive) ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              className="button small danger"
                              disabled={isSaving || isCurrentAdmin}
                              onClick={async () => {
                                try {
                                  const confirmed = window.confirm(
                                    `Delete user ${user.email}? This action cannot be undone.`
                                  );
                                  if (!confirmed) return;
                                  setAdminUserSavingId(user.id);
                                  await deleteAdminUserApi(user.id);
                                  await loadAdminUsers();
                                } catch (error: any) {
                                  alert(error?.message || "Delete user failed");
                                } finally {
                                  setAdminUserSavingId("");
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}

              {showAdminUsers && (
                <section className="panel">
                  <h4>Manage Users</h4>
                  <input className="input" placeholder="Name" value={adminUserName} onChange={(e) => setAdminUserName(e.target.value)} />
                  <input className="input" placeholder="Email" value={adminUserEmail} onChange={(e) => setAdminUserEmail(e.target.value)} />
                  <input className="input" type="password" placeholder="Password" value={adminUserPassword} onChange={(e) => setAdminUserPassword(e.target.value)} />
                  <select className="input" value={adminUserRole} onChange={(e) => setAdminUserRole(e.target.value)}>
                    <option value="TESTER">TESTER</option>
                    <option value="DEVELOPER">DEVELOPER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await createAdminUserApi({
                          name: adminUserName,
                          email: adminUserEmail,
                          password: adminUserPassword,
                          role: adminUserRole,
                        });
                        setAdminUserName("");
                        setAdminUserEmail("");
                        setAdminUserPassword("");
                        setAdminUserRole("TESTER");
                        await loadAdminData();
                        alert("User created");
                      } catch (error: any) {
                        alert(error?.message || "Create user failed");
                      }
                    }}
                  >
                    Create User
                  </button>
                  <input className="input" placeholder="User ID to update" value={adminUserUpdateId} onChange={(e) => setAdminUserUpdateId(e.target.value)} />
                  <input className="input" placeholder="Updated Name" value={adminUserUpdateName} onChange={(e) => setAdminUserUpdateName(e.target.value)} />
                  <select className="input" value={adminUserUpdateRole} onChange={(e) => setAdminUserUpdateRole(e.target.value)}>
                    <option value="TESTER">TESTER</option>
                    <option value="DEVELOPER">DEVELOPER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <label className="note" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input type="checkbox" checked={adminUserUpdateActive} onChange={(e) => setAdminUserUpdateActive(e.target.checked)} />
                    Active User
                  </label>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await updateAdminUserApi(adminUserUpdateId, {
                          name: adminUserUpdateName || undefined,
                          role: adminUserUpdateRole || undefined,
                          isActive: adminUserUpdateActive,
                        });
                        setAdminUserUpdateId("");
                        setAdminUserUpdateName("");
                        setAdminUserUpdateRole("TESTER");
                        setAdminUserUpdateActive(true);
                        await loadAdminData();
                        alert("User updated");
                      } catch (error: any) {
                        alert(error?.message || "Update user failed");
                      }
                    }}
                  >
                    Update User
                  </button>
                  <div className="listCompact">
                    {adminUsers.map((item) => (
                      <div className="row" key={item.id}>
                        <span className="title">
                          {item.name} ({item.email})
                          <br />
                          <strong>User ID:</strong> {item.id}
                        </span>
                        <span className="meta">{item.role} | {item.isActive ? "ACTIVE" : "INACTIVE"}</span>
                        <button
                          className="button small"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(item.id);
                              alert("User ID copied");
                            } catch {
                              alert(`User ID: ${item.id}`);
                            }
                          }}
                        >
                          Copy ID
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showAdminProjects && (
                <section className="panel">
                  <h4>Manage Projects</h4>
                  <input className="input" placeholder="Project Name" value={adminProjectName} onChange={(e) => setAdminProjectName(e.target.value)} />
                  <input className="input" placeholder="Project Description" value={adminProjectDescription} onChange={(e) => setAdminProjectDescription(e.target.value)} />
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await createAdminProjectApi({
                          name: adminProjectName,
                          description: adminProjectDescription || undefined,
                        });
                        setAdminProjectName("");
                        setAdminProjectDescription("");
                        await loadAdminData();
                        alert("Project created");
                      } catch (error: any) {
                        alert(error?.message || "Create project failed");
                      }
                    }}
                  >
                    Create Project
                  </button>
                  <input className="input" placeholder="Project ID to update" value={adminProjectUpdateId} onChange={(e) => setAdminProjectUpdateId(e.target.value)} />
                  <input className="input" placeholder="Updated Project Name" value={adminProjectUpdateName} onChange={(e) => setAdminProjectUpdateName(e.target.value)} />
                  <input className="input" placeholder="Updated Description" value={adminProjectUpdateDescription} onChange={(e) => setAdminProjectUpdateDescription(e.target.value)} />
                  <label className="note" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input type="checkbox" checked={adminProjectUpdateActive} onChange={(e) => setAdminProjectUpdateActive(e.target.checked)} />
                    Active Project
                  </label>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await updateAdminProjectApi(adminProjectUpdateId, {
                          name: adminProjectUpdateName || undefined,
                          description: adminProjectUpdateDescription || undefined,
                          isActive: adminProjectUpdateActive,
                        });
                        setAdminProjectUpdateId("");
                        setAdminProjectUpdateName("");
                        setAdminProjectUpdateDescription("");
                        setAdminProjectUpdateActive(true);
                        await loadAdminData();
                        alert("Project updated");
                      } catch (error: any) {
                        alert(error?.message || "Update project failed");
                      }
                    }}
                  >
                    Update Project
                  </button>
                  <div className="listCompact">
                    {adminProjects.map((item) => (
                      <div className="row" key={item.id}>
                        <span className="title">{item.name}</span>
                        <span className="meta">{item.isActive ? "ACTIVE" : "INACTIVE"}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showAdminRoles && (
                <section className="panel">
                  <h4>Manage Roles</h4>
                  <input className="input" placeholder="User ID" value={adminRoleUserId} onChange={(e) => setAdminRoleUserId(e.target.value)} />
                  <select className="input" value={adminRoleValue} onChange={(e) => setAdminRoleValue(e.target.value)}>
                    <option value="TESTER">TESTER</option>
                    <option value="DEVELOPER">DEVELOPER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await updateAdminRoleApi(adminRoleUserId, adminRoleValue);
                        setAdminRoleUserId("");
                        setAdminRoleValue("TESTER");
                        await loadAdminData();
                        alert("Role updated");
                      } catch (error: any) {
                        alert(error?.message || "Role update failed");
                      }
                    }}
                  >
                    Update Role
                  </button>
                </section>
              )}

              {showAdminAuditLogs && (
                <section className="panel">
                  <h4>Audit Logs</h4>
                  <input
                    className="input"
                    placeholder="Filter by entity type (optional)"
                    value={adminAuditEntityType}
                    onChange={(e) => setAdminAuditEntityType(e.target.value)}
                  />
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        const logs = await listAdminAuditLogsApi(adminAuditEntityType || undefined);
                        setAdminAuditLogs(Array.isArray(logs) ? logs : []);
                      } catch (error: any) {
                        alert(error?.message || "Load audit logs failed");
                      }
                    }}
                  >
                    Refresh Logs
                  </button>
                  <div className="listCompact">
                    {adminAuditLogs.map((item) => (
                      <div className="row" key={item.id}>
                        <span className="title">{item.action} | {item.entityType} | {item.entityId}</span>
                        <span className="meta">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showAdminSystemConfig && (
                <section className="panel">
                  <h4>System Configuration</h4>
                  <input className="input" placeholder="Config Key" value={adminConfigKey} onChange={(e) => setAdminConfigKey(e.target.value)} />
                  <input className="input" placeholder="Config Value" value={adminConfigValue} onChange={(e) => setAdminConfigValue(e.target.value)} />
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await upsertAdminSystemConfigApi({ key: adminConfigKey, value: adminConfigValue });
                        setAdminConfigKey("");
                        setAdminConfigValue("");
                        await loadAdminData();
                        alert("System config updated");
                      } catch (error: any) {
                        alert(error?.message || "System config update failed");
                      }
                    }}
                  >
                    Save Config
                  </button>
                  <div className="listCompact">
                    {adminConfigs.map((item) => (
                      <div className="row" key={item.id}>
                        <span className="title">{item.key}: {item.value}</span>
                        <span className="meta">{item.updater?.name || item.updatedBy}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showAdminBackups && (
                <section className="panel">
                  <h4>Backup Management</h4>
                  <input className="input" placeholder="Backup notes" value={adminBackupNotes} onChange={(e) => setAdminBackupNotes(e.target.value)} />
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await triggerAdminBackupApi(adminBackupNotes || undefined);
                        setAdminBackupNotes("");
                        await loadAdminData();
                        alert("Backup triggered");
                      } catch (error: any) {
                        alert(error?.message || "Trigger backup failed");
                      }
                    }}
                  >
                    Trigger Backup
                  </button>
                  <div className="listCompact">
                    {adminBackups.map((item) => (
                      <div className="row" key={item.id}>
                        <span className="title">{item.status} | {item.notes || "No notes"}</span>
                        <span className="meta">{new Date(item.startedAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showCreateTestCase && (
              <section className="panel">
                <h4>Create Test Case</h4>
                <label className="fieldLabel">Title</label>
                <input className="input" placeholder="Title" value={tcTitle} onChange={(e) => setTcTitle(e.target.value)} />
                <label className="fieldLabel">Description</label>
                <input className="input" placeholder="Description" value={tcDescription} onChange={(e) => setTcDescription(e.target.value)} />
                <label className="fieldLabel">Pre-conditions</label>
                <textarea className="input" placeholder='JSON array or one pre-condition per line' rows={3} value={tcPreConditionsText} onChange={(e) => setTcPreConditionsText(e.target.value)} />
                <label className="fieldLabel">Test Data Requirements</label>
                <textarea className="input" placeholder='JSON array or one item per line' rows={3} value={tcTestDataRequirementsText} onChange={(e) => setTcTestDataRequirementsText(e.target.value)} />
                <label className="fieldLabel">Environment Requirements</label>
                <textarea className="input" placeholder='JSON array or one item per line' rows={3} value={tcEnvironmentRequirementsText} onChange={(e) => setTcEnvironmentRequirementsText(e.target.value)} />
                <label className="fieldLabel">Module/Feature</label>
                <select className="input" value={tcModule} onChange={(e) => setTcModule(e.target.value)}>
                  <option value="Authentication">Authentication</option>
                  <option value="User Management">User Management</option>
                  <option value="Reporting">Reporting</option>
                  <option value="General">General</option>
                </select>
                <label className="fieldLabel">Test Steps</label>
                <textarea className="input" placeholder="Steps JSON or one step per line" rows={4} value={tcStepsText} onChange={(e) => setTcStepsText(e.target.value)} />
                <label className="fieldLabel">Post-conditions</label>
                <textarea className="input" placeholder='JSON array or one post-condition per line' rows={3} value={tcPostConditionsText} onChange={(e) => setTcPostConditionsText(e.target.value)} />
                <label className="fieldLabel">Metadata (JSON or key:value lines)</label>
                <textarea className="input" placeholder='{"owner":"QA Team","environment":"staging"}' rows={3} value={tcMetadataText} onChange={(e) => setTcMetadataText(e.target.value)} />
                <label className="fieldLabel">Tags (comma-separated)</label>
                <input className="input" placeholder="login, authentication, smoke-test" value={tcTagsText} onChange={(e) => setTcTagsText(e.target.value)} />
                <label className="fieldLabel">Estimated Duration (minutes)</label>
                <input className="input" placeholder="5" value={tcEstimatedDurationMinutes} onChange={(e) => setTcEstimatedDurationMinutes(e.target.value)} />
                <label className="fieldLabel">Automation Status</label>
                <select className="input" value={tcAutomationStatus} onChange={(e) => setTcAutomationStatus(e.target.value)}>
                  <option value="NOT_AUTOMATED">Not Automated</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="AUTOMATED">Automated</option>
                  <option value="CANNOT_AUTOMATE">Cannot Automate</option>
                </select>
                <label className="fieldLabel">Automation Script Link</label>
                <input className="input" placeholder="https://github.com/repo/tests/login.spec.ts" value={tcAutomationScriptLink} onChange={(e) => setTcAutomationScriptLink(e.target.value)} />
                <label className="fieldLabel">Metadata Section</label>
                <div className="inlineGrid">
                  <select className="input" value={tcPriority} onChange={(e) => setTcPriority(e.target.value)}>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <select className="input" value={tcSeverity} onChange={(e) => setTcSeverity(e.target.value)}>
                    <option value="BLOCKER">BLOCKER</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="MINOR">MINOR</option>
                    <option value="TRIVIAL">TRIVIAL</option>
                  </select>
                </div>
                <div className="inlineGrid">
                  <select className="input" value={tcType} onChange={(e) => setTcType(e.target.value)}>
                    <option value="FUNCTIONAL">FUNCTIONAL</option>
                    <option value="REGRESSION">REGRESSION</option>
                    <option value="SMOKE">SMOKE</option>
                    <option value="INTEGRATION">INTEGRATION</option>
                    <option value="UAT">UAT</option>
                    <option value="PERFORMANCE">PERFORMANCE</option>
                    <option value="SECURITY">SECURITY</option>
                    <option value="USABILITY">USABILITY</option>
                  </select>
                  <select className="input" value={tcStatus} onChange={(e) => setTcStatus(e.target.value)}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="DEPRECATED">DEPRECATED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      if (tcTitle.length > 200) {
                        alert("Title must be 200 characters or less");
                        return;
                      }
                      if (tcEstimatedDurationMinutes && Number.isNaN(Number(tcEstimatedDurationMinutes))) {
                        alert("Estimated duration must be a number (minutes)");
                        return;
                      }
                      await createTestCaseApi({
                        title: tcTitle,
                        description: tcDescription,
                        preConditions: parseSection(tcPreConditionsText),
                        testDataRequirements: parseSection(tcTestDataRequirementsText),
                        environmentRequirements: parseSection(tcEnvironmentRequirementsText),
                        module: tcModule,
                        steps: parseSteps(tcStepsText),
                        postConditions: parseSection(tcPostConditionsText),
                        metadata: parseMetadata(tcMetadataText),
                        tags: parseTags(tcTagsText),
                        estimatedDurationMinutes: tcEstimatedDurationMinutes
                          ? Number(tcEstimatedDurationMinutes)
                          : null,
                        automationStatus: tcAutomationStatus,
                        automationScriptLink: tcAutomationScriptLink || null,
                        priority: tcPriority,
                        severity: tcSeverity,
                        type: tcType,
                        status: tcStatus,
                      });
                      resetCreateTestCaseFields();
                      await loadTestCaseData();
                      alert("Test case created");
                    } catch (error: any) {
                      alert(error?.message || "Create failed");
                    }
                  }}
                >
                  Create
                </button>
              </section>
              )}

              {showTemplates && (
              <section className="panel">
                <h4>Templates</h4>
                <input className="input" placeholder="Template Name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                <input className="input" placeholder="Template Category (e.g., Login Tests)" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} />
                <textarea className="input" placeholder="Template steps JSON or lines" rows={3} value={templateSteps} onChange={(e) => setTemplateSteps(e.target.value)} />
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      await createTemplateApi({
                        name: templateName,
                        category: templateCategory,
                        preConditions: [],
                        testDataRequirements: [],
                        environmentRequirements: [],
                        module: templateCategory || "General",
                        steps: parseSteps(templateSteps),
                        postConditions: [],
                        metadata: {},
                        tags: [],
                        estimatedDurationMinutes: null,
                        automationStatus: "NOT_AUTOMATED",
                        automationScriptLink: null,
                        priority: "MEDIUM",
                        severity: "MAJOR",
                        type: "FUNCTIONAL",
                        status: "DRAFT",
                      });
                      resetTemplateFields();
                      await loadTestCaseData();
                      alert("Template created");
                    } catch (error: any) {
                      alert(error?.message || "Template create failed");
                    }
                  }}
                >
                  Save Template
                </button>
                <div className="listCompact">
                  {templates.map((tpl) => (
                    <div className="row" key={tpl.id}>
                      <span className="title">{tpl.name}</span>
                      <span className="meta">{tpl.category || "General"}</span>
                      <button
                        className="button small danger"
                        onClick={async () => {
                          try {
                            if (!window.confirm("Delete this template?")) {
                              return;
                            }
                            await deleteTemplateApi(tpl.id);
                            await loadTestCaseData();
                            alert("Template deleted");
                          } catch (error: any) {
                            alert(error?.message || "Delete template failed");
                          }
                        }}
                      >
                        Delete
                      </button>
                      <button
                        className="button small"
                        onClick={async () => {
                          try {
                            await createFromTemplateApi(tpl.id, { title: `${tpl.name} - Instance` });
                            await loadTestCaseData();
                            alert("Test case created from template");
                          } catch (error: any) {
                            alert(error?.message || "Create from template failed");
                          }
                        }}
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              )}

              {showBulkOperations && (
              <section className="panel">
                <h4>Bulk Operations</h4>
                <select className="input" value={bulkOperation} onChange={(e) => setBulkOperation(e.target.value)}>
                  <option value="STATUS">STATUS</option>
                  <option value="ASSIGN">ASSIGN</option>
                  <option value="PRIORITY">PRIORITY</option>
                  <option value="SEVERITY">SEVERITY</option>
                  <option value="MOVE_MODULE">MOVE_MODULE</option>
                  <option value="MOVE_SUITE">MOVE_SUITE</option>
                  <option value="EXPORT_CSV">EXPORT_CSV</option>
                  <option value="EXPORT_EXCEL">EXPORT_EXCEL</option>
                  <option value="DELETE">DELETE</option>
                </select>
                {bulkOperation === "STATUS" && (
                  <select className="input" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="DEPRECATED">DEPRECATED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                )}
                {bulkOperation === "ASSIGN" && (
                  <input className="input" placeholder="Assignee User ID" value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)} />
                )}
                {bulkOperation === "PRIORITY" && (
                  <select className="input" value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)}>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                )}
                {bulkOperation === "SEVERITY" && (
                  <select className="input" value={bulkSeverityValue} onChange={(e) => setBulkSeverityValue(e.target.value)}>
                    <option value="BLOCKER">BLOCKER</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="MINOR">MINOR</option>
                    <option value="TRIVIAL">TRIVIAL</option>
                  </select>
                )}
                {bulkOperation === "MOVE_MODULE" && (
                  <input className="input" placeholder="Module/Feature" value={bulkModule} onChange={(e) => setBulkModule(e.target.value)} />
                )}
                {bulkOperation === "MOVE_SUITE" && (
                  <input className="input" placeholder="Suite ID" value={bulkSuiteId} onChange={(e) => setBulkSuiteId(e.target.value)} />
                )}
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      const payload: any = { operation: bulkOperation, ids: selectedIds };
                      if (bulkOperation === "STATUS") payload.status = bulkStatus;
                      if (bulkOperation === "ASSIGN") payload.assignedTo = bulkAssignee;
                      if (bulkOperation === "PRIORITY") payload.priority = bulkPriority;
                      if (bulkOperation === "SEVERITY") payload.severity = bulkSeverityValue;
                      if (bulkOperation === "MOVE_MODULE") payload.module = bulkModule;
                      if (bulkOperation === "MOVE_SUITE") payload.suiteId = bulkSuiteId;
                      if (bulkOperation === "DELETE") {
                        if (!window.confirm("Confirm bulk soft-delete for selected test cases?")) {
                          return;
                        }
                        payload.confirm = true;
                      }
                      const res = await bulkTestCaseOperationApi(payload);
                      if (
                        (bulkOperation === "EXPORT_CSV" || bulkOperation === "EXPORT_EXCEL") &&
                        res?.content
                      ) {
                        const blob = new Blob([res.content], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = res.fileName || "testcases_export.csv";
                        link.click();
                        URL.revokeObjectURL(url);
                        alert("Bulk export completed");
                      } else {
                        setSelectedIds([]);
                        setBulkOperation("STATUS");
                        setBulkStatus("READY_FOR_REVIEW");
                        setBulkPriority("MEDIUM");
                        setBulkSeverityValue("MAJOR");
                        setBulkModule("General");
                        setBulkSuiteId("");
                        setBulkAssignee("");
                        await loadTestCaseData();
                        alert("Bulk operation completed");
                      }
                    } catch (error: any) {
                      alert(error?.message || "Bulk operation failed");
                    }
                  }}
                >
                  Apply
                </button>
              </section>
              )}

              {showImport && (
              <section className="panel">
                <h4>Import</h4>
                <select className="input" value={importType} onChange={(e) => setImportType(e.target.value)}>
                  <option value="JSON">JSON</option>
                  <option value="CSV">CSV</option>
                  <option value="EXCEL">EXCEL</option>
                </select>
                {importType === "EXCEL" && (
                  <>
                    <input
                      className="input"
                      type="file"
                      accept=".json,.csv,.txt"
                      onChange={(e) => handleExcelFileChange(e.target.files?.[0])}
                    />
                    {importExcelFileName && (
                      <div className="note">Loaded file: {importExcelFileName}</div>
                    )}
                  </>
                )}
                <textarea className="input" rows={5} placeholder="Import payload" value={importPayload} onChange={(e) => setImportPayload(e.target.value)} />
                <textarea
                  className="input"
                  rows={3}
                  placeholder='Field mapping JSON (optional), e.g. {"title":"Test Title","steps":"Step Details"}'
                  value={importFieldMappingText}
                  onChange={(e) => setImportFieldMappingText(e.target.value)}
                />
                <button className="button" onClick={buildImportPreview}>
                  Preview Import
                </button>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      if (!previewReady) {
                        alert("Please run Preview Import before final import");
                        return;
                      }
                      if (importPreview.length === 0) {
                        alert("Preview has 0 rows. Please provide valid import data first.");
                        return;
                      }
                      const fieldMapping = parseFieldMapping();
                      const excelRows =
                        importType === "EXCEL"
                          ? (importExcelRows.length > 0 ? importExcelRows : JSON.parse(importPayload))
                          : [];
                      const payload =
                        importType === "JSON"
                          ? { sourceType: "JSON", items: JSON.parse(importPayload), fieldMapping, confirm: true }
                          : importType === "CSV"
                          ? { sourceType: "CSV", csvText: importPayload, fieldMapping, confirm: true }
                          : { sourceType: "EXCEL", rows: excelRows, fieldMapping, confirm: true };
                      const res = await importTestCasesApi(payload);
                      resetImportFields();
                      await loadTestCaseData();
                      alert(`Import complete: ${res.success}/${res.total}`);
                    } catch (error: any) {
                      alert(error?.message || "Import failed");
                    }
                  }}
                >
                  Confirm Import
                </button>
                {previewReady && (
                  <div className="note">
                    Preview rows: {importPreview.length} | Validation errors: {importPreviewErrors.length}
                  </div>
                )}
                {importPreviewErrors.length > 0 && (
                  <div className="note">
                    {importPreviewErrors.slice(0, 5).join(" | ")}
                  </div>
                )}
              </section>
              )}

              {showTestRuns && (
              <section className="panel">
                <h4>Test Run / Cycle Management</h4>
                <input
                  className="input"
                  placeholder="Run Name (e.g., Sprint 5 Regression)"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Description"
                  value={runDescription}
                  onChange={(e) => setRunDescription(e.target.value)}
                />
                <label className="fieldLabel">Target Start Date</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={runStartDate}
                  onChange={(e) => setRunStartDate(e.target.value)}
                />
                <label className="fieldLabel">Target End Date</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={runEndDate}
                  onChange={(e) => setRunEndDate(e.target.value)}
                />
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Tester IDs (comma or newline separated)"
                  value={runTesterIdsText}
                  onChange={(e) => setRunTesterIdsText(e.target.value)}
                />
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      if (!runName.trim()) {
                        alert("Run name is required");
                        return;
                      }
                      if (selectedIds.length === 0) {
                        alert("Select at least one test case from the list section");
                        return;
                      }
                      await createTestRunApi({
                        name: runName,
                        description: runDescription || undefined,
                        targetStartDate: runStartDate ? new Date(runStartDate).toISOString() : undefined,
                        targetEndDate: runEndDate ? new Date(runEndDate).toISOString() : undefined,
                        testCaseIds: selectedIds,
                        testerIds: parseIdsFromText(runTesterIdsText),
                      });
                      resetRunFields();
                      await loadTestCaseData();
                      alert("Test run created");
                    } catch (error: any) {
                      alert(error?.message || "Create test run failed");
                    }
                  }}
                >
                  Create Test Run
                </button>
                <select
                  className="input"
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                >
                  <option value="">Select Test Run</option>
                  {testRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.name} ({run.progress?.completed || 0}/{run.progress?.total || 0})
                    </option>
                  ))}
                </select>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      if (!selectedRunId) {
                        alert("Select a test run");
                        return;
                      }
                      const detail = await getTestRunApi(selectedRunId);
                      setRunDetails(detail);
                    } catch (error: any) {
                      alert(error?.message || "Load test run failed");
                    }
                  }}
                >
                  View Run Progress
                </button>
                {runDetails && (
                  <div className="testCaseDetails">
                    <div><strong>Run:</strong> {runDetails.name}</div>
                    <div><strong>Status:</strong> {runDetails.status}</div>
                    <div>
                      <strong>Progress:</strong> {runDetails.progress?.completed || 0}/
                      {runDetails.progress?.total || 0} ({runDetails.progress?.percent || 0}%)
                    </div>
                  </div>
                )}
              </section>
              )}

              {showSuiteManagement && (
              <section className="panel">
                <h4>Suite Management (4.5)</h4>
                <label className="note" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={showArchivedSuites}
                    onChange={(e) => setShowArchivedSuites(e.target.checked)}
                  />
                  Show Archived Suites
                </label>
                <button
                  className="button small"
                  onClick={async () => {
                    try {
                      await loadTestCaseData();
                      if (selectedSuiteId) {
                        await loadSuiteDetails(selectedSuiteId);
                      }
                    } catch (error: any) {
                      alert(getSuiteFriendlyError(error, "Refresh suites failed"));
                    }
                  }}
                >
                  Refresh Suites
                </button>
                <div className="inlineGrid">
                  <input
                    className="input"
                    placeholder="Suite Name"
                    value={suiteName}
                    onChange={(e) => setSuiteName(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Module (e.g., Authentication)"
                    value={suiteModule}
                    onChange={(e) => setSuiteModule(e.target.value)}
                  />
                </div>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Suite Description"
                  value={suiteDescription}
                  onChange={(e) => setSuiteDescription(e.target.value)}
                />
                <div className="inlineGrid">
                  <select
                    className="input"
                    value={suiteParentId}
                    onChange={(e) => setSuiteParentId(e.target.value)}
                  >
                    <option value="">No Parent Suite</option>
                    {suites
                      .filter((suite) => !suite.isArchived)
                      .map((suite) => (
                        <option key={suite.id} value={suite.id}>
                          {suite.name}
                        </option>
                      ))}
                  </select>
                  <input
                    className="input"
                    placeholder="Project ID (optional)"
                    value={suiteProjectId}
                    onChange={(e) => setSuiteProjectId(e.target.value)}
                  />
                </div>
                <div className="note">Select initial test cases</div>
                <input
                  className="input"
                  placeholder="Search test cases by title/code"
                  value={suiteCreateCaseSearch}
                  onChange={(e) => setSuiteCreateCaseSearch(e.target.value)}
                />
                <div className="toolbarActions" style={{ marginBottom: "8px" }}>
                  <button
                    className="button small"
                    onClick={() => {
                      const term = suiteCreateCaseSearch.trim().toLowerCase();
                      const visible = testCases.filter((tc) => {
                        if (!term) return true;
                        return (
                          String(tc.title || "").toLowerCase().includes(term) ||
                          String(tc.testCaseCode || tc.id || "").toLowerCase().includes(term)
                        );
                      });
                      setSuiteCreateCaseSelection(visible.map((tc) => tc.id));
                    }}
                  >
                    Select Visible
                  </button>
                  <button className="button small" onClick={() => setSuiteCreateCaseSelection([])}>
                    Clear Selection
                  </button>
                </div>
                <div className="listCompact" style={{ maxHeight: "180px", overflow: "auto", marginBottom: "8px" }}>
                  {testCases
                    .filter((tc) => {
                      const term = suiteCreateCaseSearch.trim().toLowerCase();
                      if (!term) return true;
                      return (
                        String(tc.title || "").toLowerCase().includes(term) ||
                        String(tc.testCaseCode || tc.id || "").toLowerCase().includes(term)
                      );
                    })
                    .map((tc) => (
                    <label className="row" key={tc.id} style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={suiteCreateCaseSelection.includes(tc.id)}
                        onChange={() => toggleSelection(tc.id, setSuiteCreateCaseSelection)}
                      />
                      <span className="title">
                        {tc.testCaseCode || tc.id} - {tc.title}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      if (!suiteName.trim()) {
                        alert("Suite name is required");
                        return;
                      }
                      await createSuiteApi({
                        name: suiteName,
                        description: suiteDescription || undefined,
                        module: suiteModule || undefined,
                        parentSuiteId: suiteParentId || undefined,
                        projectId: suiteProjectId || undefined,
                        testCaseIds: suiteCreateCaseSelection,
                      });
                      setSuiteName("");
                      setSuiteDescription("");
                      setSuiteModule("");
                      setSuiteParentId("");
                      setSuiteProjectId("");
                      setSuiteCreateCaseSelection([]);
                      await loadTestCaseData();
                      alert("Suite created");
                    } catch (error: any) {
                      alert(getSuiteFriendlyError(error, "Create suite failed"));
                    }
                  }}
                >
                  Create Suite
                </button>

                <select
                  className="input"
                  value={selectedSuiteId}
                  onChange={(e) => {
                    setSelectedSuiteId(e.target.value);
                    setSuiteDetails(null);
                    setSuiteExecutionHistory([]);
                    setSuiteExecutionId("");
                    setSuiteExecutionDetails(null);
                    setSuiteAddCaseSelection([]);
                  }}
                >
                  <option value="">Select Suite</option>
                  {suites.map((suite) => (
                    <option key={suite.id} value={suite.id}>
                      {suite.name}
                      {suite.isArchived ? " [ARCHIVED]" : ""} ({suite._count?.suiteCases || 0} cases)
                    </option>
                  ))}
                </select>
                {selectedSuiteId && (
                  <div className="row">
                    <span className="title">
                      <strong>Selected Suite ID:</strong> {selectedSuiteId}
                    </span>
                    <button
                      className="button small"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(selectedSuiteId);
                          alert("Suite ID copied");
                        } catch {
                          alert(`Suite ID: ${selectedSuiteId}`);
                        }
                      }}
                    >
                      Copy ID
                    </button>
                  </div>
                )}
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      if (!selectedSuiteId) {
                        alert("Select a suite");
                        return;
                      }
                      await loadSuiteDetails(selectedSuiteId);
                    } catch (error: any) {
                      alert(getSuiteFriendlyError(error, "Load suite details failed"));
                    }
                  }}
                >
                  View Suite Details
                </button>

                {suiteDetails && (
                  <div className="testCaseDetails">
                    <div><strong>Suite:</strong> {suiteDetails.name}</div>
                    <div><strong>Module:</strong> {suiteDetails.module || "N/A"}</div>
                    <div><strong>Archived:</strong> {suiteDetails.isArchived ? "Yes" : "No"}</div>
                    <div><strong>Cases:</strong> {suiteDetails._count?.suiteCases || 0}</div>
                    <div><strong>Parent:</strong> {suiteDetails.parentSuite?.name || "None"}</div>
                    {suiteDetails.isArchived && (
                      <div><strong>Note:</strong> This suite is archived. Restore it to modify cases or execute.</div>
                    )}
                  </div>
                )}

                {suiteDetails && (
                  <>
                    <div className="note">Add test cases to suite</div>
                    <input
                      className="input"
                      placeholder="Search available test cases"
                      value={suiteAddCaseSearch}
                      onChange={(e) => setSuiteAddCaseSearch(e.target.value)}
                    />
                    <div className="toolbarActions" style={{ marginBottom: "8px" }}>
                      <button
                        className="button small"
                        disabled={suiteDetails.isArchived}
                        onClick={() => {
                          const term = suiteAddCaseSearch.trim().toLowerCase();
                          const visible = testCases.filter((tc) => {
                            const alreadyInSuite = (suiteDetails.suiteCases || []).some(
                              (item: any) => item.testCaseId === tc.id
                            );
                            if (alreadyInSuite) return false;
                            if (!term) return true;
                            return (
                              String(tc.title || "").toLowerCase().includes(term) ||
                              String(tc.testCaseCode || tc.id || "").toLowerCase().includes(term)
                            );
                          });
                          setSuiteAddCaseSelection(visible.map((tc) => tc.id));
                        }}
                      >
                        Select Visible
                      </button>
                      <button className="button small" onClick={() => setSuiteAddCaseSelection([])}>
                        Clear Selection
                      </button>
                    </div>
                    <div className="listCompact" style={{ maxHeight: "180px", overflow: "auto", marginBottom: "8px" }}>
                      {testCases
                        .filter(
                          (tc) => {
                            const alreadyInSuite = (suiteDetails.suiteCases || []).some(
                              (item: any) => item.testCaseId === tc.id
                            );
                            if (alreadyInSuite) return false;
                            const term = suiteAddCaseSearch.trim().toLowerCase();
                            if (!term) return true;
                            return (
                              String(tc.title || "").toLowerCase().includes(term) ||
                              String(tc.testCaseCode || tc.id || "").toLowerCase().includes(term)
                            );
                          }
                        )
                        .map((tc) => (
                          <label className="row" key={tc.id} style={{ marginBottom: 0 }}>
                            <input
                              type="checkbox"
                              checked={suiteAddCaseSelection.includes(tc.id)}
                              disabled={suiteDetails.isArchived}
                              onChange={() => toggleSelection(tc.id, setSuiteAddCaseSelection)}
                            />
                            <span className="title">
                              {tc.testCaseCode || tc.id} - {tc.title}
                            </span>
                          </label>
                        ))}
                    </div>
                    <button
                      className="button"
                      disabled={suiteDetails.isArchived}
                      onClick={async () => {
                        try {
                          if (!suiteAddCaseSelection.length) {
                            alert("Select at least one test case");
                            return;
                          }
                          await addSuiteTestCasesApi(suiteDetails.id, suiteAddCaseSelection);
                          setSuiteAddCaseSelection([]);
                          await loadSuiteDetails(suiteDetails.id);
                          await loadTestCaseData();
                          alert("Test case(s) added to suite");
                        } catch (error: any) {
                          alert(getSuiteFriendlyError(error, "Add to suite failed"));
                        }
                      }}
                    >
                      Add Test Cases
                    </button>

                    <div className="note">Reorder Suite Cases (no IDs needed)</div>
                    <div className="listCompact" style={{ maxHeight: "220px", overflow: "auto", marginBottom: "8px" }}>
                      {suiteReorderIds.map((testCaseId, idx) => {
                        const caseRow = (suiteDetails.suiteCases || []).find(
                          (item: any) => item.testCaseId === testCaseId
                        );
                        return (
                          <div className="row" key={testCaseId} style={{ marginBottom: 0 }}>
                            <span className="title">
                              #{idx + 1} {caseRow?.testCase?.testCaseCode || testCaseId} -{" "}
                              {caseRow?.testCase?.title || testCaseId}
                            </span>
                            <button
                              className="button small"
                              disabled={idx === 0}
                              onClick={() => moveSuiteCase(testCaseId, "UP")}
                            >
                              Up
                            </button>
                            <button
                              className="button small"
                              disabled={idx === suiteReorderIds.length - 1}
                              onClick={() => moveSuiteCase(testCaseId, "DOWN")}
                            >
                              Down
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      className="button"
                      disabled={suiteDetails.isArchived}
                      onClick={async () => {
                        try {
                          if (!suiteReorderIds.length) {
                            alert("No suite test cases available to reorder");
                            return;
                          }
                          await reorderSuiteTestCasesApi(suiteDetails.id, suiteReorderIds);
                          await loadSuiteDetails(suiteDetails.id);
                          alert("Suite order updated");
                        } catch (error: any) {
                          alert(getSuiteFriendlyError(error, "Reorder failed"));
                        }
                      }}
                    >
                      Save Reorder
                    </button>

                    <input
                      className="input"
                      placeholder="Clone Name (optional)"
                      value={suiteCloneName}
                      onChange={(e) => setSuiteCloneName(e.target.value)}
                    />
                    <div className="inlineGrid">
                      <button
                        className="button"
                        disabled={suiteDetails.isArchived}
                        onClick={async () => {
                          try {
                            await cloneSuiteApi(suiteDetails.id, suiteCloneName || undefined);
                            setSuiteCloneName("");
                            await loadTestCaseData();
                            alert("Suite cloned");
                          } catch (error: any) {
                            alert(getSuiteFriendlyError(error, "Clone suite failed"));
                          }
                        }}
                      >
                        Clone Suite
                      </button>
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            if (suiteDetails.isArchived) {
                              if (!window.confirm("Restore this suite?")) {
                                return;
                              }
                              await restoreSuiteApi(suiteDetails.id);
                            } else {
                              if (!window.confirm("Archive this suite? You can restore it later.")) {
                                return;
                              }
                              await archiveSuiteApi(suiteDetails.id);
                              setShowArchivedSuites(true);
                            }
                            await loadSuiteDetails(suiteDetails.id);
                            await loadTestCaseData();
                            alert(suiteDetails.isArchived ? "Suite restored" : "Suite archived");
                          } catch (error: any) {
                            alert(getSuiteFriendlyError(error, "Archive/restore failed"));
                          }
                        }}
                      >
                        {suiteDetails.isArchived ? "Restore Suite" : "Archive Suite"}
                      </button>
                    </div>
                    <button
                      className="button danger"
                      disabled={!suiteDetails.isArchived}
                      onClick={async () => {
                        try {
                          if (!suiteDetails.isArchived) {
                            alert("Archive the suite first, then delete permanently.");
                            return;
                          }
                          const ok = window.confirm(
                            "Delete this suite permanently? This cannot be undone and removes suite execution history for this suite."
                          );
                          if (!ok) return;
                          const finalOk = window.confirm("Type confirmation by clicking OK again to permanently delete.");
                          if (!finalOk) return;
                          await deleteSuiteApi(suiteDetails.id);
                          setSelectedSuiteId("");
                          setSuiteDetails(null);
                          setSuiteExecutionHistory([]);
                          setSuiteExecutionId("");
                          setSuiteExecutionDetails(null);
                          await loadTestCaseData();
                          alert("Suite deleted permanently");
                        } catch (error: any) {
                          alert(getSuiteFriendlyError(error, "Delete suite failed"));
                        }
                      }}
                    >
                      Delete Suite Permanently
                    </button>

                    <h4>Suite Cases</h4>
                    <div className="listCompact">
                      {(suiteDetails.suiteCases || []).map((item: any) => (
                        <div className="row" key={item.id}>
                          <span className="title">
                            #{item.position} {item.testCase?.testCaseCode || item.testCaseId} -{" "}
                            {item.testCase?.title || item.testCaseId}
                          </span>
                          <button
                            className="button small danger"
                            onClick={async () => {
                              try {
                                await removeSuiteTestCaseApi(suiteDetails.id, item.testCaseId);
                                await loadSuiteDetails(suiteDetails.id);
                                await loadTestCaseData();
                              } catch (error: any) {
                                alert(getSuiteFriendlyError(error, "Remove from suite failed"));
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <h4>Execute Suite</h4>
                    <div className="inlineGrid">
                      <select
                        className="input"
                        value={suiteExecutionMode}
                        onChange={(e) => setSuiteExecutionMode(e.target.value)}
                      >
                        <option value="SEQUENTIAL">SEQUENTIAL</option>
                        <option value="PARALLEL">PARALLEL</option>
                      </select>
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Tester IDs (comma/newline, optional)"
                        value={suiteExecutionTesterIdsText}
                        onChange={(e) => setSuiteExecutionTesterIdsText(e.target.value)}
                      />
                    </div>
                    <button
                      className="button"
                      disabled={suiteDetails.isArchived}
                      onClick={async () => {
                        try {
                          const started = await startSuiteExecutionApi({
                            suiteId: suiteDetails.id,
                            mode: suiteExecutionMode,
                            testerIds: parseIdsFromText(suiteExecutionTesterIdsText),
                          });
                          setSuiteExecutionId(started.id);
                          const detail = await getSuiteExecutionApi(started.id);
                          setSuiteExecutionDetails(detail);
                          await loadSuiteDetails(suiteDetails.id);
                          alert("Suite execution started");
                        } catch (error: any) {
                          alert(getSuiteFriendlyError(error, "Start suite execution failed"));
                        }
                      }}
                    >
                      Start Suite Execution
                    </button>

                    <select
                      className="input"
                      value={suiteExecutionId}
                      onChange={(e) => setSuiteExecutionId(e.target.value)}
                    >
                      <option value="">Select Suite Execution</option>
                      {suiteExecutionHistory.map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.id.slice(0, 8)} | {item.status} | {item.passed}/{item.totalCases}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button"
                      onClick={async () => {
                        try {
                          if (!suiteExecutionId) {
                            alert("Select suite execution");
                            return;
                          }
                          const detail = await getSuiteExecutionApi(suiteExecutionId);
                          setSuiteExecutionDetails(detail);
                        } catch (error: any) {
                          alert(getSuiteFriendlyError(error, "Load suite execution failed"));
                        }
                      }}
                    >
                      View Suite Report
                    </button>
                    {suiteExecutionHistory.length > 0 && (
                      <div className="suiteHistoryList">
                        {suiteExecutionHistory.map((item: any) => {
                          const total = Number(item.totalCases || 0);
                          const completed =
                            Number(item.passed || 0) +
                            Number(item.failed || 0) +
                            Number(item.blocked || 0) +
                            Number(item.skipped || 0);
                          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                          const pending = Math.max(0, total - completed);
                          return (
                            <div
                              key={item.id}
                              className={`suiteHistoryItem ${suiteExecutionId === item.id ? "active" : ""}`}
                            >
                              <div className="suiteHistoryTop">
                                <span className="suiteHistoryId">#{item.id.slice(0, 8)}</span>
                                <span className="suitePendingBadge">Pending: {pending}</span>
                              </div>
                              <div className="suiteProgressTrack">
                                <div className="suiteProgressFill" style={{ width: `${percent}%` }} />
                              </div>
                              <div className="suiteHistoryMeta">
                                <span>{item.status}</span>
                                <span>{completed}/{total} ({percent}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {suiteExecutionDetails && (
                  <div className="testCaseDetails">
                    <div><strong>Execution Status:</strong> {suiteExecutionDetails.status}</div>
                    <div><strong>Mode:</strong> {suiteExecutionDetails.mode}</div>
                    <div>
                      <strong>Summary:</strong> Total {suiteExecutionDetails.totalCases} | Passed{" "}
                      {suiteExecutionDetails.passed} | Failed {suiteExecutionDetails.failed} | Blocked{" "}
                      {suiteExecutionDetails.blocked} | Skipped {suiteExecutionDetails.skipped}
                    </div>
                    <div><strong>Pass Rate:</strong> {suiteExecutionDetails.passRate ?? 0}%</div>
                    <div><strong>Linked Run:</strong> {suiteExecutionDetails.linkedTestRun?.name || "N/A"}</div>
                    <div style={{ marginTop: "8px" }}>
                      <button
                        className="button small"
                        onClick={async () => {
                          try {
                            const freshDetail = await getSuiteExecutionApi(suiteExecutionDetails.id);
                            setSuiteExecutionDetails(freshDetail);
                          } catch (error: any) {
                            alert(getSuiteFriendlyError(error, "Refresh suite report failed"));
                          }
                        }}
                      >
                        Refresh Suite Report
                      </button>
                      <button
                        className="button small"
                        disabled={
                          (Number(suiteExecutionDetails.totalCases) > 0 &&
                            Number(suiteExecutionDetails.passed || 0) +
                              Number(suiteExecutionDetails.failed || 0) +
                              Number(suiteExecutionDetails.blocked || 0) +
                              Number(suiteExecutionDetails.skipped || 0) >=
                              Number(suiteExecutionDetails.totalCases)) ||
                          !suiteExecutionDetails.id
                        }
                        onClick={async () => {
                          try {
                            const freshDetail = await getSuiteExecutionApi(suiteExecutionDetails.id);
                            setSuiteExecutionDetails(freshDetail);
                            const completed =
                              Number(freshDetail?.passed || 0) +
                              Number(freshDetail?.failed || 0) +
                              Number(freshDetail?.blocked || 0) +
                              Number(freshDetail?.skipped || 0);
                            const total = Number(freshDetail?.totalCases || 0);
                            if (total > 0 && completed >= total) {
                              alert("No pending suite cases. Suite execution is already complete.");
                              return;
                            }
                            const cases = Array.isArray(freshDetail?.cases)
                              ? freshDetail.cases
                              : [];
                            const nextPending = cases.find((item: any) => item.status === "NOT_RUN");
                            if (!nextPending) {
                              alert("No pending suite cases. All cases are already executed.");
                              return;
                            }
                            const linkedRunId = freshDetail?.linkedTestRun?.id || "";
                            if (!linkedRunId) {
                              alert("Linked run not found for this suite execution.");
                              return;
                            }
                            await openSuiteExecutionCase(freshDetail, nextPending);
                            alert("Opened next pending suite case in Execute Tests.");
                          } catch (error: any) {
                            alert(getSuiteFriendlyError(error, "Open next pending case failed"));
                          }
                        }}
                      >
                        {String(suiteExecutionDetails.mode || "").toUpperCase() === "PARALLEL"
                          ? "Open Any Pending Case"
                          : "Execute Next Pending Case"}
                      </button>
                    </div>
                    <div style={{ marginTop: "10px" }}>
                      <strong>Suite Cases</strong>
                      <div className="listCompact" style={{ marginTop: "6px" }}>
                        {(suiteExecutionDetails.cases || []).map((item: any) => (
                          <div className="row" key={item.id}>
                            <span className="title">
                              #{item.position} {item.testCase?.testCaseCode || item.testCaseId} -{" "}
                              {item.testCase?.title || item.testCaseId}
                            </span>
                            <span className="meta">{item.status}</span>
                            <button
                              className="button small"
                              disabled={item.status !== "NOT_RUN"}
                              onClick={async () => {
                                try {
                                  const fresh = await getSuiteExecutionApi(suiteExecutionDetails.id);
                                  setSuiteExecutionDetails(fresh);
                                  const freshCase = (fresh?.cases || []).find((c: any) => c.id === item.id);
                                  if (!freshCase) {
                                    alert("Suite case not found in latest report.");
                                    return;
                                  }
                                  if (freshCase.status !== "NOT_RUN") {
                                    alert("This suite case is already executed.");
                                    return;
                                  }
                                  await openSuiteExecutionCase(fresh, freshCase);
                                } catch (error: any) {
                                  alert(getSuiteFriendlyError(error, "Open suite case failed"));
                                }
                              }}
                            >
                              Open
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
              )}

              {showExecute && (
              <section className="panel">
                <h4>Execute Test Case</h4>
                <select className="input" value={executionCaseId} onChange={(e) => setExecutionCaseId(e.target.value)}>
                  <option value="">Select Test Case</option>
                  {executionSelectableCases.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.testCaseCode || tc.id} - {tc.title}
                    </option>
                  ))}
                </select>
                <select className="input" value={executionRunId} onChange={(e) => setExecutionRunId(e.target.value)}>
                  <option value="">Optional: Link to Test Run</option>
                  {testRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.name}
                    </option>
                  ))}
                </select>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      setActiveSuiteExecutionContext(null);
                      if (!executionCaseId) {
                        alert("Select a test case");
                        return;
                      }
                      if (executionRunId) {
                        const inRun = executionSelectableCases.some((tc) => tc.id === executionCaseId);
                        if (!inRun) {
                          alert("Selected test case is not part of the selected test run.");
                          return;
                        }
                      }
                      await openExecutionSession(executionCaseId, executionRunId || undefined);
                    } catch (error: any) {
                      alert(error?.message || "Open execution failed");
                    }
                  }}
                >
                  Open Execution Mode
                </button>
                {executionId && executionSteps.length > 0 && (
                  <>
                    <div className="note">Progress: {executionProgress}% (auto-saved)</div>
                    <div className="inlineGrid">
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            const timer = await startExecutionTimerApi(executionId);
                            setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                          } catch (error: any) {
                            alert(error?.message || "Failed to start timer");
                          }
                        }}
                      >
                        Start Timer
                      </button>
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            const timer = await stopExecutionTimerApi(executionId);
                            setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                            setExecutionCompletedAt(timer?.completedAt || "");
                            setExecutionDurationSeconds(
                              typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                            );
                          } catch (error: any) {
                            alert(error?.message || "Failed to stop timer");
                          }
                        }}
                      >
                        Stop Timer
                      </button>
                    </div>
                    <div className="note">
                      Started: {executionStartedAt ? new Date(executionStartedAt).toLocaleString() : "N/A"} | Completed:{" "}
                      {executionCompletedAt ? new Date(executionCompletedAt).toLocaleString() : "N/A"} | Duration:{" "}
                      {typeof executionDurationSeconds === "number" ? `${executionDurationSeconds}s` : "N/A"}
                    </div>
                    <select
                      className="input"
                      value={executionSelectedStepNumber}
                      onChange={(e) => setExecutionSelectedStepNumber(e.target.value)}
                    >
                      {executionSteps.map((step) => (
                        <option key={step.stepNumber} value={step.stepNumber}>
                          Step {step.stepNumber}: {step.action} [{step.status}]
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={executionStepStatus}
                      onChange={(e) => setExecutionStepStatus(e.target.value)}
                    >
                      <option value="PASSED">PASSED</option>
                      <option value="FAILED">FAILED</option>
                      <option value="BLOCKED">BLOCKED</option>
                      <option value="SKIPPED">SKIPPED</option>
                    </select>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Actual result for selected step"
                      value={executionActualResult}
                      onChange={(e) => setExecutionActualResult(e.target.value)}
                    />
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Step notes"
                      value={executionStepNotes}
                      onChange={(e) => setExecutionStepNotes(e.target.value)}
                    />
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Execution notes"
                      value={executionNotes}
                      onChange={(e) => setExecutionNotes(e.target.value)}
                    />
                    <button
                      className="button"
                      onClick={async () => {
                        try {
                          const stepNumber = Number(executionSelectedStepNumber);
                          if (!Number.isFinite(stepNumber)) {
                            alert("Select a valid step");
                            return;
                          }
                          const saved = await saveExecutionStepApi(executionId, stepNumber, {
                            status: executionStepStatus,
                            actualResult: executionActualResult,
                            notes: executionStepNotes,
                            executionNotes,
                          });
                          const nextSteps = Array.isArray(saved?.stepResults) ? saved.stepResults : executionSteps;
                          setExecutionSteps(nextSteps);
                          setExecutionProgress(saved?.progressPercent || 0);
                          setExecutionActualResult("");
                          setExecutionStepNotes("");
                        } catch (error: any) {
                          alert(error?.message || "Auto-save failed");
                        }
                      }}
                    >
                      Save Step (Auto-save)
                    </button>
                    <button
                      className="button"
                      onClick={async () => {
                        try {
                          const final = await finalizeExecutionApi(executionId, {
                            notes: executionNotes,
                          });
                          await loadTestCaseData();
                          let freshSuiteExecution: any = null;
                          if (
                            activeSuiteExecutionContext?.suiteExecutionId &&
                            activeSuiteExecutionContext?.runId &&
                            executionRunId &&
                            activeSuiteExecutionContext.runId === executionRunId
                          ) {
                            try {
                              freshSuiteExecution = await getSuiteExecutionApi(activeSuiteExecutionContext.suiteExecutionId);
                              setSuiteExecutionDetails(freshSuiteExecution);
                            } catch {
                              // ignore secondary refresh failures
                            }
                          }
                          setSelectedExecutionReportId(final.id);
                          setExecutionCompletedAt(final?.completedAt || executionCompletedAt);
                          setExecutionDurationSeconds(
                            typeof final?.durationSeconds === "number" ? final.durationSeconds : executionDurationSeconds
                          );
                          setExecutionNotes("");
                          setExecutionSelectedStepNumber("");
                          setExecutionStepStatus("PASSED");
                          setExecutionActualResult("");
                          setExecutionStepNotes("");
                          if (
                            freshSuiteExecution &&
                            String(activeSuiteExecutionContext?.mode || "").toUpperCase() === "SEQUENTIAL"
                          ) {
                            const nextPending = (freshSuiteExecution.cases || []).find(
                              (item: any) => item.status === "NOT_RUN"
                            );
                            if (nextPending) {
                              await openSuiteExecutionCase(freshSuiteExecution, nextPending);
                              alert(`Execution finalized: ${final.result}. Opened next pending suite case.`);
                              return;
                            }
                            setActiveSuiteExecutionContext(null);
                          }
                          alert(`Execution finalized: ${final.result}`);
                        } catch (error: any) {
                          alert(error?.message || "Finalize failed");
                        }
                      }}
                    >
                      Finalize Execution
                    </button>
                    <h4>Execution Evidence</h4>
                    <div className="inlineGrid">
                      <select className="input" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                        <option value="IMAGE">IMAGE</option>
                        <option value="VIDEO">VIDEO</option>
                        <option value="LOG">LOG</option>
                        <option value="DOCUMENT">DOCUMENT</option>
                      </select>
                      <input
                        className="input"
                        placeholder="Evidence file name"
                        value={evidenceName}
                        onChange={(e) => setEvidenceName(e.target.value)}
                      />
                    </div>
                    <input
                      className="input"
                      placeholder="Evidence URL (storage link)"
                      value={evidenceUrl}
                      onChange={(e) => setEvidenceUrl(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Evidence notes (optional)"
                      value={evidenceNotes}
                      onChange={(e) => setEvidenceNotes(e.target.value)}
                    />
                    <div className="inlineGrid">
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            if (!evidenceUrl.trim() || !evidenceName.trim()) {
                              alert("Evidence URL and name are required");
                              return;
                            }
                            const created = await uploadExecutionEvidenceApi(executionId, {
                              fileType: evidenceType,
                              fileUrl: evidenceUrl,
                              fileName: evidenceName,
                              notes: evidenceNotes,
                            });
                            setExecutionEvidence((prev) => [created, ...prev]);
                            setEvidenceUrl("");
                            setEvidenceName("");
                            setEvidenceNotes("");
                          } catch (error: any) {
                            alert(error?.message || "Evidence upload failed");
                          }
                        }}
                      >
                        Add Evidence
                      </button>
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            const rows = await listExecutionEvidenceApi(executionId);
                            setExecutionEvidence(Array.isArray(rows) ? rows : []);
                          } catch (error: any) {
                            alert(error?.message || "Failed to refresh evidence");
                          }
                        }}
                      >
                        Refresh Evidence
                      </button>
                    </div>
                    {executionEvidence.length > 0 && (
                      <div className="listCompact">
                        {executionEvidence.map((item) => (
                          <div className="row" key={item.id}>
                            <span className="title">{item.fileName}</span>
                            <span className="meta">{item.fileType}</span>
                            <button
                              className="button small danger"
                              onClick={async () => {
                                try {
                                  await deleteExecutionEvidenceApi(executionId, item.id);
                                  setExecutionEvidence((prev) => prev.filter((row) => row.id !== item.id));
                                } catch (error: any) {
                                  alert(error?.message || "Delete evidence failed");
                                }
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <h4>Quick Bug / Re-execution</h4>
                <select
                  className="input"
                  value={selectedExecutionReportId}
                  onChange={(e) => setSelectedExecutionReportId(e.target.value)}
                >
                  <option value="">Select execution report</option>
                  {executionReports
                    .filter((item) => !executionCaseId || item.testCaseId === executionCaseId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.testCase?.title || item.testCaseId} | {item.result} | {new Date(item.executedAt).toLocaleString()}
                      </option>
                    ))}
                </select>
                <input
                  className="input"
                  placeholder="Bug title (optional)"
                  value={quickBugTitle}
                  onChange={(e) => setQuickBugTitle(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Bug description (optional)"
                  value={quickBugDescription}
                  onChange={(e) => setQuickBugDescription(e.target.value)}
                />
                <select className="input" value={quickBugSeverity} onChange={(e) => setQuickBugSeverity(e.target.value)}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
                <div className="inlineGrid">
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        if (!selectedExecutionReportId) {
                          alert("Select an execution report");
                          return;
                        }
                        const issue = await createBugFromExecutionApi(selectedExecutionReportId, {
                          title: quickBugTitle || undefined,
                          description: quickBugDescription || undefined,
                          severity: quickBugSeverity,
                        });
                        resetQuickBugFields();
                        alert(`Bug created: ${issue.id}`);
                      } catch (error: any) {
                        alert(error?.message || "Quick bug creation failed");
                      }
                    }}
                  >
                    Create Quick Bug
                  </button>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        if (!selectedExecutionReportId) {
                          alert("Select an execution report");
                          return;
                        }
                        const restarted = await reexecuteExecutionApi(selectedExecutionReportId, {
                          notes: "Re-execution requested",
                        });
                        setExecutionId(restarted.id);
                        setExecutionCaseId(restarted.testCaseId);
                        setExecutionRunId(restarted.testRunId || "");
                        setExecutionSteps(Array.isArray(restarted.stepResults) ? restarted.stepResults : []);
                        setExecutionSelectedStepNumber(
                          Array.isArray(restarted.stepResults) && restarted.stepResults.length > 0
                            ? String(restarted.stepResults[0].stepNumber)
                            : ""
                        );
                        setExecutionProgress(restarted.progressPercent || 0);
                        setExecutionNotes(restarted.notes || "");
                        setExecutionStartedAt(restarted.startedAt || "");
                        setExecutionCompletedAt("");
                        setExecutionDurationSeconds(null);
                        setExecutionEvidence([]);
                        alert("Re-execution draft created");
                      } catch (error: any) {
                        alert(error?.message || "Re-execution failed");
                      }
                    }}
                  >
                    Re-execute
                  </button>
                </div>
              </section>
              )}

              {showBugs && (
              <section className="panel">
                <h4>{isDeveloper ? "Assigned Bugs" : "Bug Management (4.4)"}</h4>
                {canCreateBugs && (
                  <>
                    <label className="fieldLabel">Title (max 200)</label>
                    <input
                      className="input"
                      placeholder="Bug title"
                      value={bugCreateTitle}
                      onChange={(e) => setBugCreateTitle(e.target.value)}
                    />
                    <label className="fieldLabel">Description</label>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Detailed bug description"
                      value={bugCreateDescription}
                      onChange={(e) => setBugCreateDescription(e.target.value)}
                    />
                    <label className="fieldLabel">Steps to Reproduce</label>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Step 1... Step 2..."
                      value={bugCreateStepsToReproduce}
                      onChange={(e) => setBugCreateStepsToReproduce(e.target.value)}
                    />
                    <div className="inlineGrid">
                      <div>
                        <label className="fieldLabel">Expected Behavior</label>
                        <textarea
                          className="input"
                          rows={2}
                          placeholder="Expected outcome"
                          value={bugCreateExpectedBehavior}
                          onChange={(e) => setBugCreateExpectedBehavior(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="fieldLabel">Actual Behavior</label>
                        <textarea
                          className="input"
                          rows={2}
                          placeholder="Observed outcome"
                          value={bugCreateActualBehavior}
                          onChange={(e) => setBugCreateActualBehavior(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="inlineGrid">
                      <div>
                        <label className="fieldLabel">Severity</label>
                        <select
                          className="input"
                          value={bugCreateSeverity}
                          onChange={(e) => setBugCreateSeverity(e.target.value)}
                        >
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                          <option value="CRITICAL">CRITICAL</option>
                        </select>
                      </div>
                      <div>
                        <label className="fieldLabel">Priority</label>
                        <select
                          className="input"
                          value={bugCreatePriority}
                          onChange={(e) => setBugCreatePriority(e.target.value)}
                        >
                          <option value="P1_URGENT">P1_URGENT</option>
                          <option value="P2_HIGH">P2_HIGH</option>
                          <option value="P3_MEDIUM">P3_MEDIUM</option>
                          <option value="P4_LOW">P4_LOW</option>
                        </select>
                      </div>
                    </div>
                    <input
                      className="input"
                      placeholder="Environment (e.g., Chrome 122, Windows 11)"
                      value={bugCreateEnvironment}
                      onChange={(e) => setBugCreateEnvironment(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Affected Version (e.g., v1.5.0)"
                      value={bugCreateAffectedVersion}
                      onChange={(e) => setBugCreateAffectedVersion(e.target.value)}
                    />
                    <div className="inlineGrid">
                      <input
                        className="input"
                        placeholder="Assign to Developer User ID"
                        value={bugCreateAssignedTo}
                        onChange={(e) => setBugCreateAssignedTo(e.target.value)}
                      />
                      <input
                        className="input"
                        type="date"
                        value={bugCreateDueDate}
                        onChange={(e) => setBugCreateDueDate(e.target.value)}
                      />
                    </div>
                    <label className="fieldLabel">Attachments JSON (optional)</label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder='[{"fileType":"IMAGE","fileUrl":"https://.../screenshot.png","fileName":"screenshot.png","notes":"login error"}]'
                      value={bugCreateAttachmentsText}
                      onChange={(e) => setBugCreateAttachmentsText(e.target.value)}
                    />
                    <div className="inlineGrid">
                      <select
                        className="input"
                        value={bugCreateTestCaseId}
                        onChange={(e) => setBugCreateTestCaseId(e.target.value)}
                      >
                        <option value="">Linked Test Case (optional)</option>
                        {testCases.map((tc) => (
                          <option key={tc.id} value={tc.id}>
                            {tc.testCaseCode || tc.id} - {tc.title}
                          </option>
                        ))}
                      </select>
                      <select
                        className="input"
                        value={bugCreateExecutionId}
                        onChange={(e) => setBugCreateExecutionId(e.target.value)}
                      >
                        <option value="">Linked Execution (optional)</option>
                        {executionReports.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.testCase?.title || item.testCaseId} | {item.result}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="button"
                      onClick={async () => {
                        try {
                          const attachments = parseBugAttachmentsInput(bugCreateAttachmentsText);
                          if (bugCreateTitle.length > 200) {
                            alert("Bug title must be 200 characters or less");
                            return;
                          }
                          const created = await createBugApi({
                            title: bugCreateTitle,
                            description: bugCreateDescription,
                            stepsToReproduce: bugCreateStepsToReproduce,
                            expectedBehavior: bugCreateExpectedBehavior,
                            actualBehavior: bugCreateActualBehavior,
                            severity: bugCreateSeverity,
                            priority: bugCreatePriority,
                            environment: bugCreateEnvironment || undefined,
                            affectedVersion: bugCreateAffectedVersion || undefined,
                            assignedTo: bugCreateAssignedTo || undefined,
                            testCaseId: bugCreateTestCaseId || undefined,
                            executionId: bugCreateExecutionId || undefined,
                            dueDate: bugCreateDueDate || undefined,
                            attachments,
                          });
                          setSelectedBugId(created.id);
                          resetBugCreateFields();
                          await loadTestCaseData();
                          await loadBugDetails(created.id);
                          alert(`Bug created: ${created.bugId || created.id}`);
                        } catch (error: any) {
                          alert(error?.message || "Create bug failed");
                        }
                      }}
                    >
                      Create Bug Report
                    </button>
                  </>
                )}

                <div className="panelHeader" style={{ marginTop: "12px" }}>
                  <h4 style={{ margin: 0 }}>Bug List</h4>
                  <button
                    className="button small"
                    onClick={async () => {
                      try {
                        await loadTestCaseData();
                      } catch (error: any) {
                        alert(error?.message || "Failed to refresh bugs");
                      }
                    }}
                  >
                    Refresh Bugs
                  </button>
                </div>

                <div className="inlineGrid">
                  <select className="input" value={bugFilterStatus} onChange={(e) => setBugFilterStatus(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="NEW">NEW</option>
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="FIXED">FIXED</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="REOPENED">REOPENED</option>
                    <option value="WONT_FIX">WONT_FIX</option>
                    <option value="DUPLICATE">DUPLICATE</option>
                  </select>
                  <select className="input" value={bugFilterPriority} onChange={(e) => setBugFilterPriority(e.target.value)}>
                    <option value="">All Priority</option>
                    <option value="P1_URGENT">P1_URGENT</option>
                    <option value="P2_HIGH">P2_HIGH</option>
                    <option value="P3_MEDIUM">P3_MEDIUM</option>
                    <option value="P4_LOW">P4_LOW</option>
                  </select>
                </div>
                <div className="inlineGrid">
                  <select className="input" value={bugFilterSeverity} onChange={(e) => setBugFilterSeverity(e.target.value)}>
                    <option value="">All Severity</option>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <select className="input" value={bugSortBy} onChange={(e) => setBugSortBy(e.target.value)}>
                    <option value="">Sort: Latest Update</option>
                    <option value="priority">Sort: Priority</option>
                    <option value="age">Sort: Age</option>
                    <option value="dueDate">Sort: Due Date</option>
                  </select>
                </div>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      await loadTestCaseData();
                    } catch (error: any) {
                      alert(error?.message || "Failed to apply bug filters");
                    }
                  }}
                >
                  Apply Filters
                </button>

                {isDeveloper && (
                  <>
                    <div className="testCaseDetails" style={{ marginTop: "8px" }}>
                      <div><strong>Assigned Bugs:</strong> {assignedBugCount}</div>
                      <div><strong>P1-Urgent:</strong> {p1UrgentCount}</div>
                      <div><strong>Critical Severity:</strong> {criticalBugCount}</div>
                    </div>
                    <div className="listCompact">
                      {bugs.map((item) => (
                        <div key={item.id}>
                          <div className="row">
                            <span className="title">
                              {(item.bugId || item.id)} | {item.title}
                              <br />
                              Env: {item.bugMeta?.environment || "N/A"} | Version: {item.bugMeta?.affectedVersion || "N/A"} | TC:{" "}
                              {item.testCase?.testCaseCode || item.testCaseId || "N/A"}
                              <br />
                              Attachments:{" "}
                              {Array.isArray(item.attachments) && item.attachments.length > 0
                                ? item.attachments.map((a: any) => a.fileName).join(", ")
                                : "N/A"}
                            </span>
                            <span className="meta">
                              {item.priority} | {item.severity} | {item.workflowStatus}
                            </span>
                            <select
                              className="input"
                              style={{ width: "180px", marginBottom: 0 }}
                              value={quickStatusByBugId[item.id] || item.workflowStatus || "OPEN"}
                              onChange={(e) =>
                                setQuickStatusByBugId((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="IN_PROGRESS">IN_PROGRESS</option>
                              <option value="FIXED">FIXED</option>
                              <option value="VERIFIED">VERIFIED</option>
                              <option value="CLOSED">CLOSED</option>
                              <option value="REOPENED">REOPENED</option>
                              <option value="WONT_FIX">WONT_FIX</option>
                              <option value="DUPLICATE">DUPLICATE</option>
                            </select>
                            <button
                              className="button small"
                              onClick={async () => {
                                try {
                                  const status = quickStatusByBugId[item.id] || item.workflowStatus || "OPEN";
                                  const current = String(item.workflowStatus || "OPEN").toUpperCase();
                                  if (String(status).toUpperCase() === current) {
                                    alert(`Bug is already in ${current} status`);
                                    return;
                                  }
                                  await quickUpdateDeveloperBugStatusApi(item.id, status);
                                  setQuickStatusByBugId((prev) => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                  await loadTestCaseData();
                                } catch (error: any) {
                                  alert(error?.message || "Quick status update failed");
                                }
                              }}
                            >
                              Quick Update
                            </button>
                            <button
                              className="button small"
                              onClick={() => setSelectedBugId((prev) => (prev === item.id ? "" : item.id))}
                            >
                              {selectedBugId === item.id ? "Close" : "Open"}
                            </button>
                          </div>
                          {selectedBugId === item.id && selectedBug?.id === item.id && (
                            <div className="testCaseDetails">
                              <div><strong>Bug ID:</strong> {selectedBug.bugId || selectedBug.id}</div>
                              <div><strong>Title:</strong> {selectedBug.title}</div>
                              <div><strong>Status:</strong> {selectedBug.workflowStatus}</div>
                              <div><strong>Priority:</strong> {selectedBug.priority}</div>
                              <div><strong>Severity:</strong> {selectedBug.severity}</div>
                              <div><strong>Description:</strong> {selectedBug.description || "N/A"}</div>
                              <div><strong>Steps to Reproduce:</strong> {selectedBug.bugMeta?.stepsToReproduce || "N/A"}</div>
                              <div><strong>Expected Behavior:</strong> {selectedBug.bugMeta?.expectedBehavior || "N/A"}</div>
                              <div><strong>Actual Behavior:</strong> {selectedBug.bugMeta?.actualBehavior || "N/A"}</div>
                              <div><strong>Environment:</strong> {selectedBug.bugMeta?.environment || "N/A"}</div>
                              <div><strong>Affected Version:</strong> {selectedBug.bugMeta?.affectedVersion || "N/A"}</div>
                              <div><strong>Reporter:</strong> {selectedBug.reporter?.name || selectedBug.reportedBy || "N/A"}</div>
                              <div><strong>Assigned To:</strong> {selectedBug.assignee?.name || selectedBug.assignedTo || "Unassigned"}</div>
                              <div><strong>Linked Test Case:</strong> {selectedBug.testCase?.testCaseCode || selectedBug.testCaseId || "N/A"}</div>
                              <div>
                                <strong>Attachments:</strong>{" "}
                                {Array.isArray(selectedBug.attachments) && selectedBug.attachments.length > 0
                                  ? selectedBug.attachments.map((a: any) => a.fileName).join(", ")
                                  : "N/A"}
                              </div>
                              <div><strong>Fix Notes:</strong> {selectedBug.fixNotes || "N/A"}</div>
                              <div><strong>Commit Link:</strong> {selectedBug.commitLink || "N/A"}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!isDeveloper && (
                  <div className="listCompact">
                    {bugs.map((item) => (
                      <div key={item.id}>
                        <div className="row">
                          <span className="title">
                            {(item.bugId || item.id)} | {item.title}
                          </span>
                          <span className="meta">
                            {item.priority} | {item.severity} | {item.workflowStatus}
                          </span>
                          <button
                            className="button small"
                            onClick={() => setSelectedBugId((prev) => (prev === item.id ? "" : item.id))}
                          >
                            {selectedBugId === item.id ? "Close" : "Open"}
                          </button>
                        </div>
                        {selectedBugId === item.id && selectedBug?.id === item.id && (
                          <div className="testCaseDetails">
                            <div><strong>Bug ID:</strong> {selectedBug.bugId || selectedBug.id}</div>
                            <div><strong>Title:</strong> {selectedBug.title}</div>
                            <div><strong>Status:</strong> {selectedBug.workflowStatus}</div>
                            <div><strong>Priority:</strong> {selectedBug.priority}</div>
                            <div><strong>Severity:</strong> {selectedBug.severity}</div>
                            <div><strong>Description:</strong> {selectedBug.description || "N/A"}</div>
                            <div><strong>Steps to Reproduce:</strong> {selectedBug.bugMeta?.stepsToReproduce || "N/A"}</div>
                            <div><strong>Expected Behavior:</strong> {selectedBug.bugMeta?.expectedBehavior || "N/A"}</div>
                            <div><strong>Actual Behavior:</strong> {selectedBug.bugMeta?.actualBehavior || "N/A"}</div>
                            <div><strong>Environment:</strong> {selectedBug.bugMeta?.environment || "N/A"}</div>
                            <div><strong>Affected Version:</strong> {selectedBug.bugMeta?.affectedVersion || "N/A"}</div>
                            <div><strong>Reporter:</strong> {selectedBug.reporter?.name || selectedBug.reportedBy || "N/A"}</div>
                            <div><strong>Assigned To:</strong> {selectedBug.assignee?.name || selectedBug.assignedTo || "Unassigned"}</div>
                            <div><strong>Linked Test Case:</strong> {selectedBug.testCase?.testCaseCode || selectedBug.testCaseId || "N/A"}</div>
                            <div>
                              <strong>Attachments:</strong>{" "}
                              {Array.isArray(selectedBug.attachments) && selectedBug.attachments.length > 0
                                ? selectedBug.attachments.map((a: any) => a.fileName).join(", ")
                                : "N/A"}
                            </div>
                            <div><strong>Fix Notes:</strong> {selectedBug.fixNotes || "N/A"}</div>
                            <div><strong>Commit Link:</strong> {selectedBug.commitLink || "N/A"}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedBug && canTransitionBugs && (
                  <>
                    <h4 style={{ marginTop: "12px" }}>Workflow Transition</h4>
                    <select
                      className="input"
                      value={bugTransitionToStatus}
                      onChange={(e) => setBugTransitionToStatus(e.target.value)}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="FIXED">FIXED</option>
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="REOPENED">REOPENED</option>
                      <option value="WONT_FIX">WONT_FIX</option>
                      <option value="DUPLICATE">DUPLICATE</option>
                    </select>
                    <input
                      className="input"
                      placeholder="Reason (for Won't Fix)"
                      value={bugTransitionReason}
                      onChange={(e) => setBugTransitionReason(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Duplicate Bug Code (for Duplicate)"
                      value={bugTransitionDuplicateOf}
                      onChange={(e) => setBugTransitionDuplicateOf(e.target.value)}
                    />
                    <div className="inlineGrid">
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            const current = String(selectedBug.workflowStatus || "OPEN").toUpperCase();
                            const target = String(bugTransitionToStatus || "OPEN").toUpperCase();
                            if (target === current) {
                              alert(`Bug is already in ${current} status`);
                              return;
                            }
                            if (isDeveloper) {
                              await quickUpdateDeveloperBugStatusApi(selectedBug.id, bugTransitionToStatus);
                            } else {
                              await updateBugWorkflowApi(selectedBug.id, {
                                toStatus: bugTransitionToStatus,
                                reason: bugTransitionReason || undefined,
                                duplicateOfBugCode: bugTransitionDuplicateOf || undefined,
                              });
                            }
                            setBugTransitionToStatus("OPEN");
                            setBugTransitionReason("");
                            setBugTransitionDuplicateOf("");
                            await loadTestCaseData();
                            await loadBugDetails(selectedBug.id);
                          } catch (error: any) {
                            alert(error?.message || "Workflow transition failed");
                          }
                        }}
                      >
                        Apply Transition
                      </button>
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            await loadBugDetails(selectedBug.id);
                          } catch (error: any) {
                            alert(error?.message || "Failed to refresh bug details");
                          }
                        }}
                      >
                        Refresh Details
                      </button>
                    </div>
                  </>
                )}

                {selectedBug && canResolveBugs && (
                  <>
                    <h4 style={{ marginTop: "12px" }}>Developer Resolution</h4>
                    <select className="input" value={bugResolveAction} onChange={(e) => setBugResolveAction(e.target.value)}>
                      <option value="START_PROGRESS">START_PROGRESS</option>
                      <option value="MARK_FIXED">MARK_FIXED</option>
                      <option value="REQUEST_RETEST">REQUEST_RETEST</option>
                      <option value="WONT_FIX">WONT_FIX</option>
                    </select>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Fix notes / resolution notes"
                      value={bugResolveFixNotes}
                      onChange={(e) => setBugResolveFixNotes(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Commit link (optional)"
                      value={bugResolveCommitLink}
                      onChange={(e) => setBugResolveCommitLink(e.target.value)}
                    />
                    <button
                      className="button"
                      onClick={async () => {
                        try {
                          await resolveBugApi(selectedBug.id, {
                            action: bugResolveAction,
                            fixNotes: bugResolveFixNotes || undefined,
                            commitLink: bugResolveCommitLink || undefined,
                            reason: bugTransitionReason || undefined,
                          });
                          setBugResolveAction("START_PROGRESS");
                          setBugResolveFixNotes("");
                          setBugResolveCommitLink("");
                          await loadTestCaseData();
                          await loadBugDetails(selectedBug.id);
                        } catch (error: any) {
                          alert(error?.message || "Resolution action failed");
                        }
                      }}
                    >
                      Apply Resolution Action
                    </button>
                  </>
                )}

                {selectedBug && (
                  <>
                    <h4 style={{ marginTop: "12px" }}>Bug Comments</h4>
                    <div className="note">
                      Supports mentions with @username. Edit/delete is allowed for 5 minutes (admin override).
                    </div>
                    <div className="toolbarActions" style={{ marginBottom: "8px" }}>
                      <button className="button small" onClick={() => appendCommentSnippet("@username")}>
                        @Mention
                      </button>
                      <button className="button small" onClick={() => appendCommentSnippet("**bold text**")}>
                        Bold
                      </button>
                      <button className="button small" onClick={() => appendCommentSnippet("_italic text_")}>
                        Italic
                      </button>
                      <button className="button small" onClick={() => appendCommentSnippet("`code`")}>
                        Code
                      </button>
                    </div>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Add comment"
                      value={bugCommentText}
                      onChange={(e) => handleCommentTextChange(e.target.value)}
                    />
                    {showMentionPopup && filteredMentionCandidates.length > 0 && (
                      <div className="mentionPopup">
                        {filteredMentionCandidates.slice(0, 8).map((item) => (
                          <button
                            key={item.key}
                            className="mentionItem"
                            onClick={() => applyMention(item.key)}
                          >
                            @{item.key} - {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      className="input"
                      placeholder="Reply to Comment ID (optional)"
                      value={bugCommentParentId}
                      onChange={(e) => setBugCommentParentId(e.target.value)}
                    />
                    <button
                      className="button"
                      onClick={async () => {
                        try {
                          if (!bugCommentText.trim()) {
                            alert("Comment text is required");
                            return;
                          }
                          await createBugCommentApi(selectedBug.id, {
                            comment: bugCommentText,
                            parentCommentId: bugCommentParentId || undefined,
                          });
                          setBugCommentText("");
                          setBugCommentParentId("");
                          await loadBugDetails(selectedBug.id);
                        } catch (error: any) {
                          alert(error?.message || "Add comment failed");
                        }
                      }}
                    >
                      Add Comment
                    </button>
                    {bugCommentThreads.length > 0 && (
                      <div className="listCompact">
                        {renderCommentThreads(bugCommentThreads)}
                      </div>
                    )}
                    {bugComments.length > 0 && bugCommentThreads.length === 0 && (
                      <div className="listCompact">
                        {bugComments.map((item) => (
                          <div className="row" key={item.id}>
                            <span className="title">
                              <strong>Comment:</strong>{" "}
                              {isDeletedComment(item)
                                ? "[Comment deleted]"
                                : renderCommentContent(String(item.comment || ""))}
                              {Array.isArray(item.mentions) && item.mentions.length > 0 ? (
                                <>
                                  <br />
                                  <strong>Mentions:</strong> {item.mentions.map((m: string) => `@${m}`).join(", ")}
                                </>
                              ) : null}
                            </span>
                            <span className="meta">
                              <strong>By:</strong> {item.author?.name || item.authorId}
                              <br />
                              <strong>At:</strong> {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
              )}
            </div>

            {showTestCases && (
            <section className="panel fullWidth">
              <div className="panelHeader">
                <h4>Test Cases</h4>
                <button
                  className="button small"
                  onClick={() => setShowTestCaseList((prev) => !prev)}
                >
                  {showTestCaseList ? "Hide List" : "Open List"}
                </button>
              </div>
              {!showTestCaseList && (
                <div className="note">Click "Open List" to view all test cases.</div>
              )}
              {showTestCaseList && (
                <>
              {canSeeSelectionControls && (
              <div className="row">
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={testCases.length > 0 && selectedIds.length === testCases.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(testCases.map((tc) => tc.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                  <span className="title">Select all test cases</span>
                </label>
              </div>
              )}
              {testCases.map((tc) => (
                <div key={tc.id}>
                <div className="row">
                  {canSeeSelectionControls && (
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(tc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => [...prev, tc.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== tc.id));
                          }
                        }}
                      />
                    </label>
                  )}
                  <button
                    className="linkButton"
                    onClick={() =>
                      setExpandedTestCaseId((prev) => (prev === tc.id ? "" : tc.id))
                    }
                  >
                    {tc.title}
                  </button>
                  <span className="meta">{tc.testCaseCode} | {tc.module} | {tc.priority}/{tc.status}</span>
                  {canCreateAndManageTestCases && (
                    <>
                      <button
                        className="button small"
                        onClick={() => startEditCase(tc)}
                      >
                        Edit
                      </button>
                      <button
                        className="button small"
                        onClick={async () => {
                          try {
                            await createTemplateApi({
                              name: `${tc.title} Template`,
                              category: "From Existing Test Cases",
                              sourceTestCaseId: tc.id,
                            });
                            await loadTestCaseData();
                            alert("Template created from test case");
                          } catch (error: any) {
                            alert(error?.message || "Create template failed");
                          }
                        }}
                      >
                        Make Template
                      </button>
                      <button
                        className="button small"
                        onClick={async () => {
                          try {
                            const includeAttachments = window.confirm(
                              "Clone with attachments? Click OK for Yes, Cancel for No."
                            );
                            await cloneTestCaseApi(tc.id, { includeAttachments });
                            await loadTestCaseData();
                          } catch (error: any) {
                            alert(error?.message || "Clone failed");
                          }
                        }}
                      >
                        Clone
                      </button>
                      <button
                        className="button small danger"
                        onClick={async () => {
                          try {
                            if (!window.confirm("Confirm soft-delete for this test case?")) {
                              return;
                            }
                            await deleteTestCaseApi(tc.id);
                            await loadTestCaseData();
                          } catch (error: any) {
                            alert(error?.message || "Delete failed");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
                {expandedTestCaseId === tc.id && (
                  <div className="testCaseDetails">
                    <div><strong>Test Case ID:</strong> {tc.testCaseCode || "N/A"}</div>
                    <div><strong>Title:</strong> {tc.title || "N/A"}</div>
                    <div><strong>Description:</strong> {tc.description || "N/A"}</div>
                    <div><strong>Pre-conditions:</strong> {JSON.stringify(tc.preConditions ?? [])}</div>
                    <div><strong>Test Data Requirements:</strong> {JSON.stringify(tc.testDataRequirements ?? [])}</div>
                    <div><strong>Environment Requirements:</strong> {JSON.stringify(tc.environmentRequirements ?? [])}</div>
                    <div><strong>Module:</strong> {tc.module || "N/A"}</div>
                    <div><strong>Priority:</strong> {tc.priority || "N/A"}</div>
                    <div><strong>Severity:</strong> {tc.severity || "N/A"}</div>
                    <div><strong>Type:</strong> {tc.type || "N/A"}</div>
                    <div><strong>Status:</strong> {tc.status || "N/A"}</div>
                    <div><strong>Version:</strong> {tc.version ?? 1}</div>
                    <div><strong>Tags:</strong> {(tc.tags ?? []).join(", ") || "N/A"}</div>
                    <div><strong>Estimated Duration:</strong> {tc.estimatedDurationMinutes ?? "N/A"} min</div>
                    <div><strong>Automation Status:</strong> {tc.automationStatus || "N/A"}</div>
                    <div><strong>Automation Script:</strong> {tc.automationScriptLink || "N/A"}</div>
                    <div><strong>Steps:</strong> {typeof tc.steps === "string" ? tc.steps : JSON.stringify(tc.steps)}</div>
                    <div><strong>Post-conditions:</strong> {JSON.stringify(tc.postConditions ?? [])}</div>
                    <div><strong>Metadata:</strong> {JSON.stringify(tc.metadata ?? {})}</div>
                    <div><strong>Created By:</strong> {tc.creator?.name || tc.createdBy || "N/A"}</div>
                    <div><strong>Last Modified By:</strong> {tc.lastEditor?.name || tc.lastModifiedBy || "N/A"}</div>
                    <div><strong>Last Modified At:</strong> {tc.lastModifiedAt ? new Date(tc.lastModifiedAt).toLocaleString() : "N/A"}</div>
                    <div><strong>Created At:</strong> {tc.createdAt ? new Date(tc.createdAt).toLocaleString() : "N/A"}</div>
                  </div>
                )}
                </div>
              ))}
                </>
              )}
              {editingId && canCreateAndManageTestCases && (
                <div className="modalBackdrop">
                  <div className="modalCard">
                    <h4>Edit Test Case</h4>
                    <label className="fieldLabel" htmlFor="edit-title">Title</label>
                    <input id="edit-title" className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-description">Description</label>
                    <input id="edit-description" className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-pre-conditions">Pre-conditions</label>
                    <textarea id="edit-pre-conditions" className="input" rows={3} value={editPreConditionsText} onChange={(e) => setEditPreConditionsText(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-test-data-requirements">Test Data Requirements</label>
                    <textarea id="edit-test-data-requirements" className="input" rows={3} value={editTestDataRequirementsText} onChange={(e) => setEditTestDataRequirementsText(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-environment-requirements">Environment Requirements</label>
                    <textarea id="edit-environment-requirements" className="input" rows={3} value={editEnvironmentRequirementsText} onChange={(e) => setEditEnvironmentRequirementsText(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-module">Module/Feature</label>
                    <input id="edit-module" className="input" value={editModule} onChange={(e) => setEditModule(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-post-conditions">Post-conditions</label>
                    <textarea id="edit-post-conditions" className="input" rows={3} value={editPostConditionsText} onChange={(e) => setEditPostConditionsText(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-metadata">Metadata</label>
                    <textarea id="edit-metadata" className="input" rows={3} value={editMetadataText} onChange={(e) => setEditMetadataText(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-tags">Tags (comma-separated)</label>
                    <input id="edit-tags" className="input" value={editTagsText} onChange={(e) => setEditTagsText(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-estimated-duration">Estimated Duration (minutes)</label>
                    <input id="edit-estimated-duration" className="input" value={editEstimatedDurationMinutes} onChange={(e) => setEditEstimatedDurationMinutes(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-automation-status">Automation Status</label>
                    <select id="edit-automation-status" className="input" value={editAutomationStatus} onChange={(e) => setEditAutomationStatus(e.target.value)}>
                      <option value="NOT_AUTOMATED">Not Automated</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="AUTOMATED">Automated</option>
                      <option value="CANNOT_AUTOMATE">Cannot Automate</option>
                    </select>
                    <label className="fieldLabel" htmlFor="edit-automation-link">Automation Script Link</label>
                    <input id="edit-automation-link" className="input" value={editAutomationScriptLink} onChange={(e) => setEditAutomationScriptLink(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-change-summary">Change Summary (required)</label>
                    <input id="edit-change-summary" className="input" value={editChangeSummary} onChange={(e) => setEditChangeSummary(e.target.value)} placeholder="Updated expected result for clarity" />
                    <div className="inlineGrid">
                      <div>
                        <label className="fieldLabel" htmlFor="edit-priority">Priority</label>
                        <select id="edit-priority" className="input" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                          <option value="CRITICAL">CRITICAL</option>
                        </select>
                      </div>
                      <div>
                        <label className="fieldLabel" htmlFor="edit-severity">Severity</label>
                        <select id="edit-severity" className="input" value={editSeverity} onChange={(e) => setEditSeverity(e.target.value)}>
                          <option value="BLOCKER">BLOCKER</option>
                          <option value="CRITICAL">CRITICAL</option>
                          <option value="MAJOR">MAJOR</option>
                          <option value="MINOR">MINOR</option>
                          <option value="TRIVIAL">TRIVIAL</option>
                        </select>
                      </div>
                    </div>
                    <div className="inlineGrid">
                      <div>
                        <label className="fieldLabel" htmlFor="edit-type">Type</label>
                        <select id="edit-type" className="input" value={editType} onChange={(e) => setEditType(e.target.value)}>
                          <option value="FUNCTIONAL">FUNCTIONAL</option>
                          <option value="REGRESSION">REGRESSION</option>
                          <option value="SMOKE">SMOKE</option>
                          <option value="INTEGRATION">INTEGRATION</option>
                          <option value="UAT">UAT</option>
                          <option value="PERFORMANCE">PERFORMANCE</option>
                          <option value="SECURITY">SECURITY</option>
                          <option value="USABILITY">USABILITY</option>
                        </select>
                      </div>
                      <div>
                        <label className="fieldLabel" htmlFor="edit-status">Status</label>
                        <select id="edit-status" className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                          <option value="DRAFT">DRAFT</option>
                          <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="DEPRECATED">DEPRECATED</option>
                          <option value="ARCHIVED">ARCHIVED</option>
                        </select>
                      </div>
                    </div>
                    <div className="toolbarActions">
                      <button className="button small" onClick={saveEditCase}>Save</button>
                      <button className="button small danger" onClick={() => setEditingId("")}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              {editingCommentId && (
                <div className="modalBackdrop">
                  <div className="modalCard">
                    <h4>Edit Bug Comment</h4>
                    <textarea
                      className="input"
                      rows={4}
                      value={editingCommentText}
                      onChange={(e) => setEditingCommentText(e.target.value)}
                    />
                    <div className="toolbarActions">
                      <button
                        className="button small"
                        disabled={!editingCommentText.trim()}
                        onClick={async () => {
                          try {
                            await editBugCommentApi(editingCommentId, editingCommentText);
                            setEditingCommentId("");
                            setEditingCommentText("");
                            if (selectedBugId) {
                              await loadBugDetails(selectedBugId);
                            }
                          } catch (error: any) {
                            alert(error?.message || "Edit comment failed");
                          }
                        }}
                      >
                        Save Comment
                      </button>
                      <button
                        className="button small danger"
                        onClick={() => {
                          setEditingCommentId("");
                          setEditingCommentText("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
            )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
