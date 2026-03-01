import { useEffect, useRef, useState } from "react";
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
  createFromTemplateApi,
  createTemplateApi,
  updateTemplateApi,
  createTestCaseApi,
  editBugCommentApi,
  deleteTemplateApi,
  deleteTestCaseApi,
  finalizeExecutionApi,
  forgotPasswordApi,
  getBugApi,
  getTestRunApi,
  getRefreshToken,
  getMyRolePermissionsApi,
  listBugCommentsApi,
  listBugNotificationsApi,
  listBugsApi,
  listExecutionEvidenceApi,
  listExecutionReportsApi,
  listAdminProjectsApi,
  listAdminUsersApi,
  listAdminAuditLogsApi,
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
  createAdminProjectApi,
  updateAdminProjectApi,
  triggerAdminBackupApi,
  upsertAdminSystemConfigApi,
  updateAdminUserApi,
  updateSuiteApi,
  updateTestCaseApi,
  markBugNotificationReadApi,
} from "./api";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";
import DashboardLayout from "./components/layout/DashboardLayout";
import { buildNavFromPermissions, permissionCatalog } from "./config/roleNav";
import "./App.css";

type Screen = "login" | "register" | "forgot" | "reset" | "dashboard";
type DashboardFeature =
  | "dashboard_home"
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
  | "reports"
  | "my_assigned_bugs"
  | "all_bugs"
  | "test_reports"
  | "performance_report"
  | "linked_commits"
  | "user_management"
  | "role_management"
  | "project_management"
  | "system_configuration"
  | "audit_logs"
  | "backup_management";

type AppNotificationItem = {
  id: string;
  sourceId?: string;
  type: "mention" | "bug";
  title: string;
  subtitle?: string;
  isRead: boolean;
  bugId?: string;
};

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tcTitle, setTcTitle] = useState("");
  const [tcDescription, setTcDescription] = useState("");
  const [tcPreConditionsText, setTcPreConditionsText] = useState("");
  const [tcTestDataRequirementsText, setTcTestDataRequirementsText] = useState("");
  const [tcEnvironmentRequirementsText, setTcEnvironmentRequirementsText] = useState("");
  const [tcModule, setTcModule] = useState("");
  const [tcStepsText, setTcStepsText] = useState("");
  const [tcPostConditionsText, setTcPostConditionsText] = useState("");
  const [tcMetadataText, setTcMetadataText] = useState("");
  const [tcTagsText, setTcTagsText] = useState("");
  const [tcEstimatedDurationMinutes, setTcEstimatedDurationMinutes] = useState("");
  const [tcAutomationStatus, setTcAutomationStatus] = useState("");
  const [tcAutomationScriptLink, setTcAutomationScriptLink] = useState("");
  const [tcPriority, setTcPriority] = useState("");
  const [tcSeverity, setTcSeverity] = useState("");
  const [tcType, setTcType] = useState("");
  const [tcStatus, setTcStatus] = useState("");
  const [bulkOperation, setBulkOperation] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkPriority, setBulkPriority] = useState("");
  const [bulkSeverityValue, setBulkSeverityValue] = useState("");
  const [bulkModule, setBulkModule] = useState("");
  const [bulkSuiteId, setBulkSuiteId] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkCasePickerOpen, setBulkCasePickerOpen] = useState(false);
  const [bulkCaseQuery, setBulkCaseQuery] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateSteps, setTemplateSteps] = useState("");
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateModalId, setSelectedTemplateModalId] = useState("");
  const [templateModalEditing, setTemplateModalEditing] = useState(false);
  const [templateEditName, setTemplateEditName] = useState("");
  const [templateEditCategory, setTemplateEditCategory] = useState("");
  const [templateEditDescription, setTemplateEditDescription] = useState("");
  const [templateEditModule, setTemplateEditModule] = useState("");
  const [templateEditSteps, setTemplateEditSteps] = useState("");
  const [importType, setImportType] = useState("");
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
  const [editStepsText, setEditStepsText] = useState("");
  const [editPreConditionsText, setEditPreConditionsText] = useState("");
  const [editTestDataRequirementsText, setEditTestDataRequirementsText] = useState("");
  const [editEnvironmentRequirementsText, setEditEnvironmentRequirementsText] = useState("");
  const [editModule, setEditModule] = useState("");
  const [editPostConditionsText, setEditPostConditionsText] = useState("");
  const [editMetadataText, setEditMetadataText] = useState("");
  const [editTagsText, setEditTagsText] = useState("");
  const [editEstimatedDurationMinutes, setEditEstimatedDurationMinutes] = useState("");
  const [editAutomationStatus, setEditAutomationStatus] = useState("");
  const [editAutomationScriptLink, setEditAutomationScriptLink] = useState("");
  const [editChangeSummary, setEditChangeSummary] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editSeverity, setEditSeverity] = useState("");
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [showTestCaseList, setShowTestCaseList] = useState(false);
  const [expandedTestCaseId, setExpandedTestCaseId] = useState("");
  const [testCasesVisible, setTestCasesVisible] = useState(false);
  const [selectedTestCaseModalId, setSelectedTestCaseModalId] = useState("");
  const [testCasesLoading, setTestCasesLoading] = useState(false);
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
  const [suiteExecutionMode, setSuiteExecutionMode] = useState("");
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
  const [executionStepStatus, setExecutionStepStatus] = useState("");
  const [executionActualResult, setExecutionActualResult] = useState("");
  const [executionStepNotes, setExecutionStepNotes] = useState("");
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionStartedAt, setExecutionStartedAt] = useState("");
  const [executionCompletedAt, setExecutionCompletedAt] = useState("");
  const [executionDurationSeconds, setExecutionDurationSeconds] = useState<number | null>(null);
  const [executionEvidence, setExecutionEvidence] = useState<any[]>([]);
  const [evidenceType, setEvidenceType] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceName, setEvidenceName] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [executionReports, setExecutionReports] = useState<any[]>([]);
  const [selectedExecutionReportId, setSelectedExecutionReportId] = useState("");
  const [quickBugTitle, setQuickBugTitle] = useState("");
  const [quickBugDescription, setQuickBugDescription] = useState("");
  const [quickBugSeverity, setQuickBugSeverity] = useState("");
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
  const [bugCreateSeverity, setBugCreateSeverity] = useState("");
  const [bugCreatePriority, setBugCreatePriority] = useState("");
  const [bugCreateEnvironment, setBugCreateEnvironment] = useState("");
  const [bugCreateAffectedVersion, setBugCreateAffectedVersion] = useState("");
  const [bugCreateAssignedTo, setBugCreateAssignedTo] = useState("");
  const [bugCreateTestCaseId, setBugCreateTestCaseId] = useState("");
  const [bugCreateExecutionId, setBugCreateExecutionId] = useState("");
  const [bugCreateDueDate, setBugCreateDueDate] = useState("");
  const [bugCreateAttachmentsText, setBugCreateAttachmentsText] = useState("");
  const [bugTransitionToStatus, setBugTransitionToStatus] = useState("");
  const [bugTransitionReason, setBugTransitionReason] = useState("");
  const [bugTransitionDuplicateOf, setBugTransitionDuplicateOf] = useState("");
  const [bugResolveAction, setBugResolveAction] = useState("");
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
  const [adminUsersVisible, setAdminUsersVisible] = useState(false);
  const [adminUserModalUser, setAdminUserModalUser] = useState<any | null>(null);
  const [adminUserModalEditing, setAdminUserModalEditing] = useState(false);
  const [adminUserModalName, setAdminUserModalName] = useState("");
  const [adminUserModalRole, setAdminUserModalRole] = useState("TESTER");
  const [adminUserModalLoading, setAdminUserModalLoading] = useState(false);
  const [adminUserModalError, setAdminUserModalError] = useState("");
  const [adminUserToast, setAdminUserToast] = useState("");
  const adminUserModalRef = useRef<HTMLDivElement | null>(null);
  const bulkCasePickerRef = useRef<HTMLDivElement | null>(null);
  const [adminProjects, setAdminProjects] = useState<any[]>([]);
  const [adminProjectName, setAdminProjectName] = useState("");
  const [adminProjectDescription, setAdminProjectDescription] = useState("");
  const [adminProjectSavingId, setAdminProjectSavingId] = useState("");
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [notificationItems, setNotificationItems] = useState<AppNotificationItem[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [auditEntityType, setAuditEntityType] = useState("");
  const [backupNotes, setBackupNotes] = useState("");
  const [backupTriggering, setBackupTriggering] = useState(false);
  const [rolePermissionSaving, setRolePermissionSaving] = useState(false);
  const [editPermissionRole, setEditPermissionRole] = useState<"ADMIN" | "TESTER" | "DEVELOPER">("ADMIN");
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({
    ADMIN: [
      "Manage Users",
      "Manage Projects",
      "Manage Roles",
      "View Audit Logs",
      "Backup Management",
    ],
    TESTER: [
      "Create Test Cases",
      "Execute Tests",
      "Bug Management",
      "Reports",
    ],
    DEVELOPER: [
      "My Assigned Bugs",
      "All Bugs",
      "Test Reports",
      "Linked Commits",
    ],
  });
  const [activeFeature, setActiveFeature] = useState<DashboardFeature | "none">("none");
  const [activeMenuKey, setActiveMenuKey] = useState<string>("dashboard_home");
  const roleName = currentRole.toUpperCase();
  const isTester = roleName === "TESTER";
  const isDeveloper = roleName === "DEVELOPER";
  const isAdmin = roleName === "ADMIN";
  const currentRolePermissions = rolePermissions[roleName] || [];
  const hasPermission = (permission: string): boolean => currentRolePermissions.includes(permission);
  const canCreateAndManageTestCases = hasPermission("Create Test Cases");
  const canUseTemplates = hasPermission("Create Test Cases");
  const canRunBulkOps = hasPermission("Create Test Cases");
  const canImportTestCases = hasPermission("Create Test Cases");
  const canManageSuites = hasPermission("Create Test Cases");
  const canSeeSelectionControls = hasPermission("Create Test Cases");
  const canExecuteTests = hasPermission("Execute Tests");
  const canManageTestRuns = hasPermission("Create Test Cases") || hasPermission("Execute Tests");
  const canViewBugs =
    hasPermission("Bug Management") || hasPermission("My Assigned Bugs") || hasPermission("All Bugs");
  const canCreateBugs = hasPermission("Bug Management");
  const canTransitionBugs = canViewBugs;
  const canResolveBugs = isDeveloper && hasPermission("My Assigned Bugs");
  const canManageUsersPermission = hasPermission("Manage Users");
  const canManageProjectsPermission = hasPermission("Manage Projects");
  const canViewAuditLogsPermission = hasPermission("View Audit Logs");
  const rolePermissionsKey = JSON.stringify([...currentRolePermissions].sort());
const roleNavItems = buildNavFromPermissions(roleName, rolePermissions);

  const menuFeatureMap: Record<string, DashboardFeature | "none"> = {
    dashboard_home: "none",
    create_test_case: "create_test_case",
    test_cases: "test_cases",
    templates: "templates",
    bulk_operations: "bulk_operations",
    import_test_cases: "import_test_cases",
    suite_management: "suite_management",
    test_runs: "test_runs",
    execute_tests: "execute_tests",
    bug_management: "bug_management",
    reports: "execute_tests",
    my_assigned_bugs: "bug_management",
    all_bugs: "bug_management",
    test_reports: "execute_tests",
    performance_report: "developer_workspace",
    linked_commits: "developer_workspace",
    user_management: "admin_workspace",
    role_management: "admin_workspace",
    project_management: "admin_workspace",
    system_configuration: "admin_workspace",
    audit_logs: "admin_workspace",
    backup_management: "admin_workspace",
    developer_workspace: "developer_workspace",
    admin_workspace: "admin_workspace",
  };

  const normalizedFeature = activeFeature;

  const currentPageMeta = (() => {
    if (activeMenuKey === "dashboard_home" || activeFeature === "none") {
      return {
        title: "Dashboard Overview",
        subtitle: "Monitor quality, execution trends, and module health in one place.",
      };
    }
    const byKey: Record<string, { title: string; subtitle: string }> = {
      create_test_case: { title: "Create Test Case", subtitle: "Design structured test cases with complete metadata." },
      templates: { title: "Templates", subtitle: "Standardize test case creation using reusable templates." },
      bulk_operations: { title: "Bulk Operations", subtitle: "Apply controlled updates across multiple test cases." },
      import_test_cases: { title: "Import Test Cases", subtitle: "Import structured test cases from JSON, CSV, or Excel." },
      suite_management: { title: "Test Suites", subtitle: "Organize suites and manage static or dynamic case collections." },
      test_runs: { title: "Test Run Management", subtitle: "Plan and execute test runs with assignments and progress." },
      execute_tests: { title: "Execute Tests", subtitle: "Run test cases step-by-step with evidence and timing." },
      bug_management: { title: "Bug Management", subtitle: "Track defects, comments, workflow transitions, and ownership." },
      test_cases: { title: "Test Cases", subtitle: "Browse, inspect, clone, and edit detailed test case records." },
      reports: { title: "Reports", subtitle: "Review execution outcomes and defect quality indicators." },
      my_assigned_bugs: { title: "My Assigned Bugs", subtitle: "Focus on defects currently assigned to your developer queue." },
      all_bugs: { title: "All Bugs", subtitle: "Review bug backlog with filters, priority, and severity views." },
      test_reports: { title: "Test Reports", subtitle: "Analyze run-level and case-level quality trends." },
      performance_report: { title: "Performance Report", subtitle: "Review test execution throughput and aging trends." },
      linked_commits: { title: "Linked Commits", subtitle: "Track fixes mapped to commits and retest cycles." },
      admin_workspace: { title: "Admin Workspace", subtitle: "Govern users, roles, projects, configuration, and audits." },
      user_management: { title: "User Management", subtitle: "Manage user activation, lifecycle, and role assignments." },
      role_management: { title: "Role Management", subtitle: "Control permissions and assignment structure across teams." },
      project_management: { title: "Project Management", subtitle: "Manage projects and module ownership for quality planning." },
      system_configuration: { title: "System Configuration", subtitle: "Maintain platform-level settings and controls." },
      audit_logs: { title: "Audit Logs", subtitle: "Track all critical operations with actor and timestamp context." },
      backup_management: { title: "Backup Management", subtitle: "Trigger and monitor backup jobs for platform resilience." },
      developer_workspace: { title: "Developer Workspace", subtitle: "Resolve assigned defects with workflow and evidence updates." },
    };
    return byKey[activeMenuKey] || byKey[activeFeature] || byKey.bug_management;
  })();
  const showCreateTestCase = canCreateAndManageTestCases && normalizedFeature === "create_test_case";
  const showTemplates = canUseTemplates && normalizedFeature === "templates";
  const showBulkOperations = canRunBulkOps && normalizedFeature === "bulk_operations";
  const showImport = canImportTestCases && normalizedFeature === "import_test_cases";
  const showTestRuns = canManageTestRuns && normalizedFeature === "test_runs";
  const showSuiteManagement = canManageSuites && normalizedFeature === "suite_management";
  const showExecute = canExecuteTests && normalizedFeature === "execute_tests";
  const showBugs =
    canViewBugs &&
    (normalizedFeature === "bug_management" || (isDeveloper && normalizedFeature === "developer_workspace"));
  const showTestCases = normalizedFeature === "test_cases";
  const selectedTemplateModal = templates.find((tpl) => tpl.id === selectedTemplateModalId) || null;
  const selectedTestCaseModal = testCases.find((tc) => tc.id === selectedTestCaseModalId) || null;
  const filteredBulkCaseOptions = testCases.filter((tc) => {
    const query = bulkCaseQuery.trim().toLowerCase();
    if (!query) return true;
    const title = String(tc?.title || "").toLowerCase();
    const code = String(tc?.testCaseCode || "").toLowerCase();
    return title.includes(query) || code.includes(query);
  });
  const bulkSelectedSummary =
    selectedIds.length === 0
      ? "No test case selected"
      : selectedIds.length === 1
      ? "1 test case selected"
      : `${selectedIds.length} test cases selected`;
  const showRolePanel = normalizedFeature === "developer_workspace" || normalizedFeature === "admin_workspace";
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
  const assignedBugCount = bugs.length;
  const p1UrgentCount = bugs.filter((item) => item.priority === "P1_URGENT").length;
  const criticalBugCount = bugs.filter((item) => item.severity === "CRITICAL").length;
  const failedExecutions = executionReports.filter((item) => item.result === "FAILED");
  const testerPendingTests = testCases
    .filter((item) => item.status === "DRAFT" || item.status === "READY_FOR_REVIEW")
    .slice(0, 8);
  const recentFailures = failedExecutions.slice(0, 6);
  const statusCounts = {
    passed: executionReports.filter((item) => item.result === "PASSED").length,
    failed: executionReports.filter((item) => item.result === "FAILED").length,
    blocked: executionReports.filter((item) => item.result === "BLOCKED").length,
    skipped: executionReports.filter((item) => item.result === "SKIPPED").length,
  };
  const totalStatusCount =
    statusCounts.passed + statusCounts.failed + statusCounts.blocked + statusCounts.skipped || 1;
  const statusPie = `conic-gradient(
    #16a34a 0deg ${(statusCounts.passed / totalStatusCount) * 360}deg,
    #dc2626 ${(statusCounts.passed / totalStatusCount) * 360}deg ${((statusCounts.passed + statusCounts.failed) / totalStatusCount) * 360}deg,
    #d97706 ${((statusCounts.passed + statusCounts.failed) / totalStatusCount) * 360}deg ${((statusCounts.passed + statusCounts.failed + statusCounts.blocked) / totalStatusCount) * 360}deg,
    #64748b ${((statusCounts.passed + statusCounts.failed + statusCounts.blocked) / totalStatusCount) * 360}deg 360deg
  )`;
  const trendBuckets = (() => {
    const base = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      const key = d.toISOString().slice(0, 10);
      return { key, label: d.toLocaleDateString(undefined, { weekday: "short" }), count: 0 };
    });
    executionReports.forEach((item) => {
      const key = new Date(item.executedAt).toISOString().slice(0, 10);
      const found = base.find((row) => row.key === key);
      if (found) found.count += 1;
    });
    return base;
  })();
  const maxTrendCount = Math.max(...trendBuckets.map((b) => b.count), 1);
  const bugStatusCounts = {
    NEW: bugs.filter((b) => b.workflowStatus === "NEW").length,
    OPEN: bugs.filter((b) => b.workflowStatus === "OPEN").length,
    IN_PROGRESS: bugs.filter((b) => b.workflowStatus === "IN_PROGRESS").length,
    FIXED: bugs.filter((b) => b.workflowStatus === "FIXED").length,
    VERIFIED: bugs.filter((b) => b.workflowStatus === "VERIFIED").length,
    CLOSED: bugs.filter((b) => b.workflowStatus === "CLOSED").length,
  };
  const bugStatusTotal = Object.values(bugStatusCounts).reduce((acc, n) => acc + n, 0) || 1;
  const bugStatusPie = `conic-gradient(
    #2563eb 0deg ${(bugStatusCounts.NEW / bugStatusTotal) * 360}deg,
    #7c3aed ${(bugStatusCounts.NEW / bugStatusTotal) * 360}deg ${((bugStatusCounts.NEW + bugStatusCounts.OPEN) / bugStatusTotal) * 360}deg,
    #d97706 ${((bugStatusCounts.NEW + bugStatusCounts.OPEN) / bugStatusTotal) * 360}deg ${((bugStatusCounts.NEW + bugStatusCounts.OPEN + bugStatusCounts.IN_PROGRESS) / bugStatusTotal) * 360}deg,
    #16a34a ${((bugStatusCounts.NEW + bugStatusCounts.OPEN + bugStatusCounts.IN_PROGRESS) / bugStatusTotal) * 360}deg ${((bugStatusCounts.NEW + bugStatusCounts.OPEN + bugStatusCounts.IN_PROGRESS + bugStatusCounts.FIXED) / bugStatusTotal) * 360}deg,
    #0891b2 ${((bugStatusCounts.NEW + bugStatusCounts.OPEN + bugStatusCounts.IN_PROGRESS + bugStatusCounts.FIXED) / bugStatusTotal) * 360}deg ${((bugStatusCounts.NEW + bugStatusCounts.OPEN + bugStatusCounts.IN_PROGRESS + bugStatusCounts.FIXED + bugStatusCounts.VERIFIED) / bugStatusTotal) * 360}deg,
    #64748b ${((bugStatusCounts.NEW + bugStatusCounts.OPEN + bugStatusCounts.IN_PROGRESS + bugStatusCounts.FIXED + bugStatusCounts.VERIFIED) / bugStatusTotal) * 360}deg 360deg
  )`;

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
    try {
      const shouldFetchTestCases =
        canCreateAndManageTestCases || canManageSuites || canManageTestRuns || canExecuteTests;
      const bugParams: Record<string, string> = {
        status: bugFilterStatus,
        priority: bugFilterPriority,
        severity: bugFilterSeverity,
        sortBy: bugSortBy,
      };
      const [
        caseRowsResult,
        templateRowsResult,
        runRowsResult,
        suiteRowsResult,
        executionRowsResult,
        bugRowsResult,
      ] = await Promise.allSettled([
        shouldFetchTestCases ? getTestCasesApi() : Promise.resolve([]),
        canUseTemplates ? listTemplatesApi() : Promise.resolve([]),
        canManageTestRuns ? listTestRunsApi() : Promise.resolve([]),
        canManageSuites
          ? listSuitesApi(showArchivedSuites ? { includeArchived: "true" } : undefined)
          : Promise.resolve([]),
        canExecuteTests ? listExecutionReportsApi() : Promise.resolve([]),
        canViewBugs ? listBugsApi(bugParams) : Promise.resolve([]),
      ]);

      const caseRows = caseRowsResult.status === "fulfilled" ? caseRowsResult.value : [];
      const templateRows = templateRowsResult.status === "fulfilled" ? templateRowsResult.value : [];
      const runRows = runRowsResult.status === "fulfilled" ? runRowsResult.value : [];
      const suiteRows = suiteRowsResult.status === "fulfilled" ? suiteRowsResult.value : [];
      const executionRows = executionRowsResult.status === "fulfilled" ? executionRowsResult.value : [];
      const bugRows = bugRowsResult.status === "fulfilled" ? bugRowsResult.value : [];

      const rows = Array.isArray(caseRows) ? caseRows : [];
      setTestCases(rows);
      const projectsFromCases = Array.from(
        new Map(
          rows
            .map((row: any) => row?.project)
            .filter((project: any) => project?.id)
            .map((project: any) => [
              project.id,
              {
                id: project.id,
                name: project.name || "Unnamed Project",
                description: project.description || "",
                isActive: project.isActive !== false,
              },
            ])
        ).values()
      );
      if (projectsFromCases.length > 0) {
        setAdminProjects((prev) => {
          const byId = new Map<string, any>();
          prev.forEach((p: any) => byId.set(p.id, p));
          projectsFromCases.forEach((p: any) => {
            if (!byId.has(p.id)) byId.set(p.id, p);
          });
          return Array.from(byId.values());
        });
      }
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
    } finally {
      setIsRefreshing(false);
    }
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

  const loadAdminProjects = async () => {
    const rows = await listAdminProjectsApi();
    setAdminProjects(Array.isArray(rows) ? rows : []);
  };

  const loadAdminAuditLogs = async (entityType?: string) => {
    const rows = await listAdminAuditLogsApi(entityType || undefined);
    setAdminAuditLogs(Array.isArray(rows) ? rows : []);
  };

  const loadRolePermissions = async () => {
    const payload = await getMyRolePermissionsApi();
    if (payload?.rolePermissions && typeof payload.rolePermissions === "object") {
      const next = payload.rolePermissions as Record<string, unknown>;
      setRolePermissions((prev) => ({
        ADMIN: Array.isArray(next.ADMIN) ? (next.ADMIN as string[]) : prev.ADMIN || [],
        TESTER: Array.isArray(next.TESTER) ? (next.TESTER as string[]) : prev.TESTER || [],
        DEVELOPER: Array.isArray(next.DEVELOPER) ? (next.DEVELOPER as string[]) : prev.DEVELOPER || [],
      }));
    }
  };

  const showAdminToast = (message: string) => {
    setAdminUserToast(message);
    window.setTimeout(() => setAdminUserToast(""), 2500);
  };

  const openAdminUserModal = (user: any) => {
    if (!user) return;
    setAdminUserModalUser(user);
    setAdminUserModalEditing(false);
    setAdminUserModalName(String(user?.name || "").trim() || "Unnamed user");
    setAdminUserModalRole(String(user?.role || "TESTER").toUpperCase());
    setAdminUserModalError("");
    setAdminUserModalLoading(false);
  };

  const closeAdminUserModal = () => {
    if (adminUserModalLoading) return;
    setAdminUserModalUser(null);
    setAdminUserModalEditing(false);
    setAdminUserModalError("");
  };

  const openTemplateModal = (tpl: any) => {
    setSelectedTemplateModalId(String(tpl?.id || ""));
    setTemplateModalEditing(false);
    setTemplateEditName(String(tpl?.name || ""));
    setTemplateEditCategory(String(tpl?.category || ""));
    setTemplateEditDescription(String(tpl?.description || ""));
    setTemplateEditModule(String(tpl?.module || ""));
    setTemplateEditSteps(
      typeof tpl?.steps === "string" ? tpl.steps : JSON.stringify(tpl?.steps ?? [], null, 2)
    );
  };

  const buildBugNotificationItems = (bugRows: any[]): AppNotificationItem[] => {
    if (!Array.isArray(bugRows) || bugRows.length === 0) return [];
    const unresolvedWorkflow = new Set(["NEW", "OPEN", "IN_PROGRESS", "REOPENED"]);
    return bugRows
      .filter((row) => {
        const workflow = String(row?.workflowStatus || row?.status || "").toUpperCase();
        return unresolvedWorkflow.has(workflow);
      })
      .sort((a, b) => {
        const at = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bt - at;
      })
      .slice(0, 8)
      .map((row) => {
        const priority = String(row?.bugPriority || row?.priority || "").toUpperCase() || "P3_MEDIUM";
        const workflow = String(row?.workflowStatus || row?.status || "").toUpperCase() || "OPEN";
        return {
          id: `bug:${String(row?.id || Math.random())}`,
          type: "bug" as const,
          title: `${row?.bugCode || "BUG"} • ${workflow} • ${priority}`,
          subtitle: String(row?.title || "Bug update"),
          isRead: false,
          bugId: String(row?.id || ""),
        };
      })
      .filter((item) => item.bugId);
  };

  const loadNotifications = async () => {
    if (screen !== "dashboard") {
      setNotificationItems([]);
      setNotificationUnreadCount(0);
      return;
    }

    const canUseMentionApi = isTester || isDeveloper;
    let mentionItems: AppNotificationItem[] = [];

    if (canUseMentionApi) {
      try {
        const payload = await listBugNotificationsApi({ unread: "0", take: 30 });
        const rows = Array.isArray(payload?.notifications) ? payload.notifications : [];
        mentionItems = rows.map((row: any) => ({
          id: `mention:${String(row?.id || Math.random())}`,
          sourceId: String(row?.id || ""),
          type: "mention" as const,
          title: String(row?.message || "You were mentioned in a bug comment"),
          subtitle:
            String(row?.bugCode || "").trim() && String(row?.issueTitle || "").trim()
              ? `${row.bugCode} • ${row.issueTitle}`
              : String(row?.issueTitle || row?.commentPreview || "").trim(),
          isRead: Boolean(row?.isRead),
          bugId: String(row?.issueId || ""),
        }));
      } catch {
        mentionItems = [];
      }
    }

    const bugItems = canUseMentionApi ? buildBugNotificationItems(bugs) : [];
    setNotificationItems([...mentionItems, ...bugItems]);
    setNotificationUnreadCount(mentionItems.filter((item) => !item.isRead).length);
  };

  const handleNotificationClick = async (id: string) => {
    const selected = notificationItems.find((item) => item.id === id);
    if (!selected) return;

    if (selected.type === "mention" && selected.sourceId && !selected.isRead) {
      try {
        await markBugNotificationReadApi(selected.sourceId);
      } catch {
        // no-op for optimistic UI
      }
      setNotificationItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
      setNotificationUnreadCount((prev) => Math.max(0, prev - 1));
    }

    if (selected.bugId) {
      setSelectedBugId(selected.bugId);
      const targetMenuKey = isDeveloper ? "my_assigned_bugs" : "bug_management";
      handleDashboardNavSelect(targetMenuKey).catch(() => {
        // no-op
      });
    }
  };

  const resetExecutionPanel = () => {
    setExecutionCaseId("");
    setExecutionRunId("");
    setExecutionId("");
    setExecutionSteps([]);
    setExecutionNotes("");
    setExecutionSelectedStepNumber("");
    setExecutionStepStatus("");
    setExecutionActualResult("");
    setExecutionStepNotes("");
    setExecutionProgress(0);
    setExecutionStartedAt("");
    setExecutionCompletedAt("");
    setExecutionDurationSeconds(null);
    setExecutionEvidence([]);
    setEvidenceType("");
    setEvidenceUrl("");
    setEvidenceName("");
    setEvidenceNotes("");
    setSelectedExecutionReportId("");
    setQuickBugTitle("");
    setQuickBugDescription("");
    setQuickBugSeverity("");
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
    setBugCreateSeverity("");
    setBugCreatePriority("");
    setBugCreateEnvironment("");
    setBugCreateAffectedVersion("");
    setBugCreateAssignedTo("");
    setBugCreateTestCaseId("");
    setBugCreateExecutionId("");
    setBugCreateDueDate("");
    setBugCreateAttachmentsText("");
    setBugTransitionToStatus("");
    setBugTransitionReason("");
    setBugTransitionDuplicateOf("");
    setBugResolveAction("");
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
    setTcModule("");
    setTcStepsText("");
    setTcPostConditionsText("");
    setTcMetadataText("");
    setTcTagsText("");
    setTcEstimatedDurationMinutes("");
    setTcAutomationStatus("");
    setTcAutomationScriptLink("");
    setTcPriority("");
    setTcSeverity("");
    setTcType("");
    setTcStatus("");
    setBulkOperation("");
    setBulkStatus("");
    setBulkPriority("");
    setBulkSeverityValue("");
    setBulkModule("");
    setBulkSuiteId("");
    setBulkAssignee("");
    setBulkCasePickerOpen(false);
    setBulkCaseQuery("");
    setTemplateName("");
    setTemplateCategory("");
    setTemplateSteps("");
    setImportType("");
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
    setSuiteExecutionMode("");
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
    setAdminUsersVisible(false);
    setAdminUserModalUser(null);
    setAdminUserModalEditing(false);
    setAdminUserModalName("");
    setAdminUserModalRole("TESTER");
    setAdminUserModalLoading(false);
    setAdminUserModalError("");
    setAdminUserToast("");
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
    setTcModule("");
    setTcStepsText("");
    setTcPostConditionsText("");
    setTcMetadataText("");
    setTcTagsText("");
    setTcEstimatedDurationMinutes("");
    setTcAutomationStatus("");
    setTcAutomationScriptLink("");
    setTcPriority("");
    setTcSeverity("");
    setTcType("");
    setTcStatus("");
  };

  const resetTemplateFields = () => {
    setTemplateName("");
    setTemplateCategory("");
    setTemplateSteps("");
  };

  const resetImportFields = () => {
    setImportType("");
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
    setQuickBugSeverity("");
  };

  const resetBugCreateFields = () => {
    setBugCreateTitle("");
    setBugCreateDescription("");
    setBugCreateStepsToReproduce("");
    setBugCreateExpectedBehavior("");
    setBugCreateActualBehavior("");
    setBugCreateSeverity("");
    setBugCreatePriority("");
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

  const renderCommentThreads = (items: any[], depth = 0): JSX.Element[] =>
    items.map((item) => (
      <div key={item.id} style={{ marginLeft: depth > 0 ? `${Math.min(depth * 18, 54)}px` : "0" }}>
        <div className="row">
          <span className="title">
            <strong>Comment:</strong> {isDeletedComment(item) ? "[Comment deleted]" : item.comment}
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
    setEditStepsText(
      typeof tc.steps === "string"
        ? tc.steps
        : JSON.stringify(tc.steps ?? [], null, 2)
    );
    setEditPreConditionsText(JSON.stringify(tc.preConditions ?? [], null, 2));
    setEditTestDataRequirementsText(JSON.stringify(tc.testDataRequirements ?? [], null, 2));
    setEditEnvironmentRequirementsText(JSON.stringify(tc.environmentRequirements ?? [], null, 2));
    setEditModule(tc.module || "");
    setEditPostConditionsText(JSON.stringify(tc.postConditions ?? [], null, 2));
    setEditMetadataText(JSON.stringify(tc.metadata ?? {}, null, 2));
    setEditTagsText((tc.tags ?? []).join(", "));
    setEditEstimatedDurationMinutes(
      tc.estimatedDurationMinutes !== null && tc.estimatedDurationMinutes !== undefined
        ? String(tc.estimatedDurationMinutes)
        : ""
    );
    setEditAutomationStatus(tc.automationStatus || "");
    setEditAutomationScriptLink(tc.automationScriptLink || "");
    setEditChangeSummary("");
    setEditPriority(tc.priority || "");
    setEditSeverity(tc.severity || "");
    setEditType(tc.type || "");
    setEditStatus(tc.status || "");
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
        steps: parseSteps(editStepsText),
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
      setEditStepsText("");
      setEditPreConditionsText("");
      setEditTestDataRequirementsText("");
      setEditEnvironmentRequirementsText("");
      setEditModule("");
      setEditPostConditionsText("");
      setEditMetadataText("");
      setEditTagsText("");
      setEditEstimatedDurationMinutes("");
      setEditAutomationStatus("");
      setEditAutomationScriptLink("");
      setEditChangeSummary("");
      setEditPriority("");
      setEditSeverity("");
      setEditType("");
      setEditStatus("");
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
    setExecutionStepStatus("");
    setExecutionActualResult("");
    setExecutionStepNotes("");
    if (currentSteps.length > 0) {
      setExecutionSelectedStepNumber("");
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
    setActiveMenuKey("execute_tests");
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

  const resetAuthFields = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("");
    setRememberMe(false);
    setNewPassword("");
    setResetToken("");
    setAuthError("");
  };

  const clearAuthFormFields = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("");
    setRememberMe(false);
    setNewPassword("");
    setAuthError("");
  };

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
    if (screen === "login" || screen === "register" || screen === "forgot") {
      clearAuthFormFields();
    }
  }, [screen]);

  useEffect(() => {
    setAuthError("");
    setAuthSubmitting(false);
  }, [screen]);

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
      setActiveFeature("none");
      setActiveMenuKey("dashboard_home");
      setShowTestCaseList(false);
      setExpandedTestCaseId("");
      setTestCasesVisible(false);
      setSelectedTestCaseModalId("");
      setTestCasesLoading(false);
      setTemplatesVisible(false);
      setTemplatesLoading(false);
      setSelectedTemplateModalId("");
      setTemplateModalEditing(false);
      setTemplateEditName("");
      setTemplateEditCategory("");
      setTemplateEditDescription("");
      setTemplateEditModule("");
      setTemplateEditSteps("");
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
    setActiveMenuKey("dashboard_home");
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
    loadTestCaseData().catch(() => {
      // no-op: page-level actions already show explicit alerts on manual refresh
    });
  }, [screen, currentRole, rolePermissionsKey]);

  useEffect(() => {
    if (screen !== "dashboard" || !currentRole) return;
    loadRolePermissions().catch(() => {
      // no-op: keep defaults if fetch fails
    });
  }, [screen, currentRole]);

  useEffect(() => {
    if (screen !== "dashboard") return;
    if (roleNavItems.some((item) => item.key === activeMenuKey)) return;
    setActiveMenuKey("dashboard_home");
    setActiveFeature("none");
  }, [screen, activeMenuKey, roleNavItems]);

  useEffect(() => {
    if (screen !== "dashboard" || !currentRole) {
      setNotificationItems([]);
      setNotificationUnreadCount(0);
      return;
    }

    let disposed = false;
    const run = async () => {
      try {
        await loadNotifications();
      } catch {
        if (!disposed) {
          setNotificationItems([]);
          setNotificationUnreadCount(0);
        }
      }
    };

    run();
    const timerId = window.setInterval(run, 30000);
    return () => {
      disposed = true;
      window.clearInterval(timerId);
    };
  }, [screen, currentRole, currentUserId, bugs]);

  useEffect(() => {
    if (!adminUserModalUser) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAdminUserModal();
        return;
      }

      if (event.key !== "Tab" || !adminUserModalRef.current) return;
      const focusable = adminUserModalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !adminUserModalRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const modalNode = adminUserModalRef.current;
    const firstFocusable = modalNode?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [adminUserModalUser, adminUserModalLoading]);

  useEffect(() => {
    if (!bulkCasePickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!bulkCasePickerRef.current) return;
      if (!bulkCasePickerRef.current.contains(event.target as Node)) {
        setBulkCasePickerOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBulkCasePickerOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [bulkCasePickerOpen]);

  useEffect(() => {
    if (screen !== "dashboard") return;
    if (normalizedFeature !== "bug_management" && normalizedFeature !== "test_cases") return;
    loadTestCaseData().catch(() => {
      // no-op
    });
  }, [normalizedFeature, screen]);

  useEffect(() => {
    if (screen !== "dashboard" || !isAdmin || normalizedFeature !== "admin_workspace") return;
    if (activeMenuKey === "user_management" || activeMenuKey === "role_management") {
      setAdminCreateName("");
      setAdminCreateEmail("");
      setAdminCreatePassword("");
      setAdminCreateRole("");
      if (canManageUsersPermission) {
        loadAdminUsers().catch(() => {
          setAdminUsers([]);
        });
      }
      return;
    }
    if (activeMenuKey === "audit_logs" || activeMenuKey === "backup_management") {
      if (canViewAuditLogsPermission || hasPermission("Backup Management")) {
        loadAdminAuditLogs(activeMenuKey === "backup_management" ? "BackupJob" : auditEntityType || undefined).catch(
          () => {
            setAdminAuditLogs([]);
          }
        );
      }
    }
  }, [
    screen,
    isAdmin,
    normalizedFeature,
    activeMenuKey,
    auditEntityType,
    canManageUsersPermission,
    canViewAuditLogsPermission,
    rolePermissions,
  ]);

  useEffect(() => {
    if (screen !== "dashboard" || !isAdmin) return;
    if (activeMenuKey !== "dashboard_home" && normalizedFeature !== "none") return;

    const tasks: Array<Promise<void>> = [];

    if (canManageUsersPermission) {
      tasks.push(
        loadAdminUsers().catch(() => {
          setAdminUsers([]);
        })
      );
    } else {
      setAdminUsers([]);
    }

    if (canManageProjectsPermission) {
      tasks.push(
        loadAdminProjects().catch(() => {
          setAdminProjects([]);
        })
      );
    } else {
      setAdminProjects([]);
    }

    if (canViewAuditLogsPermission) {
      tasks.push(
        loadAdminAuditLogs().catch(() => {
          setAdminAuditLogs([]);
        })
      );
    } else {
      setAdminAuditLogs([]);
    }

    if (tasks.length > 0) {
      Promise.all(tasks).catch(() => {
        // no-op
      });
    }
  }, [
    screen,
    isAdmin,
    activeMenuKey,
    normalizedFeature,
    canManageUsersPermission,
    canManageProjectsPermission,
    canViewAuditLogsPermission,
  ]);

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
    setAuthError("");
    if (!role) {
      setAuthError("Please select a role.");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("Password and confirm password do not match.");
      return;
    }
    if (!isValidPassword(password)) {
      setAuthError(
        "Password must be at least 8 characters and include uppercase, number, and special character."
      );
      return;
    }
    try {
      setAuthSubmitting(true);
      const res = await registerApi(name, email, password, role);
      if (res?.message && String(res.message).toLowerCase().includes("successful")) {
        alert(res.message || "Registered successfully");
        resetAuthFields();
        setScreen("login");
        return;
      }
      setAuthError(res?.message || "Registration failed.");
    } catch (error: any) {
      setAuthError(error?.message || "Registration failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  /* LOGIN */
  const handleLogin = async () => {
    setAuthError("");
    try {
      setAuthSubmitting(true);
      const res = await loginApi(email, password, rememberMe);

      if (res.accessToken && res.refreshToken) {
        setSessionTokens(res.accessToken, res.refreshToken, rememberMe);
        setCurrentRole(res?.user?.role || "");
        setCurrentUserId(res?.user?.id || "");
        setShowTestCaseList(false);
        setExpandedTestCaseId("");
        setTestCasesVisible(false);
        setSelectedTestCaseModalId("");
        setTestCasesLoading(false);
        setTemplatesVisible(false);
        setTemplatesLoading(false);
        setSelectedTemplateModalId("");
        setTemplateModalEditing(false);
        setSelectedIds([]);
        setEditingId("");
        resetBugPanel();
        setActiveMenuKey("dashboard_home");
        setScreen("dashboard");
        try {
          await loadRolePermissions();
          await loadTestCaseData();
        } catch (error: any) {
          alert(error?.message || "Failed to load test data");
        }
      } else {
        setAuthError(res.message || "Invalid email or password");
      }
    } catch (error: any) {
      setAuthError(error?.message || "Login failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setAuthError("");
    try {
      setAuthSubmitting(true);
      const res = await forgotPasswordApi(email);
      if (res?.message) {
        alert(res.message);
        resetAuthFields();
        setScreen("login");
      } else {
        setAuthError("Unable to send reset link.");
      }
    } catch (error: any) {
      setAuthError(error?.message || "Unable to send reset link.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setAuthError("");
    if (!isValidPassword(newPassword)) {
      setAuthError(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      );
      return;
    }
    try {
      setAuthSubmitting(true);
      const res = await resetPasswordApi(resetToken, newPassword);
      alert(res.message || "Password reset complete");

      if (typeof res.message === "string" && res.message.toLowerCase().includes("successful")) {
        setNewPassword("");
        window.history.replaceState({}, "", "/");
        setScreen("login");
      }
    } catch (error: any) {
      setAuthError(error?.message || "Password reset failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    window.history.replaceState({}, "", "/");
    resetAuthFields();
    setScreen("login");
  };

  const goToRegisterScreen = () => {
    clearAuthFormFields();
    setScreen("register");
  };

  const goToForgotScreen = () => {
    clearAuthFormFields();
    setScreen("forgot");
  };

  const goToLoginScreen = () => {
    clearAuthFormFields();
    setScreen("login");
  };

  /* LOGOUT */
  const handleLogout = () => {
    clearSessionTokens();
    setCurrentRole("");
    setCurrentUserId("");
    setNotificationItems([]);
    setNotificationUnreadCount(0);
    resetAuthFields();
    setShowTestCaseList(false);
    setExpandedTestCaseId("");
    setTestCasesVisible(false);
    setSelectedTestCaseModalId("");
    setTestCasesLoading(false);
    setTemplatesVisible(false);
    setTemplatesLoading(false);
    setSelectedTemplateModalId("");
    setTemplateModalEditing(false);
    setSelectedIds([]);
    setEditingId("");
    setAdminUsersVisible(false);
    setAdminUserModalUser(null);
    setAdminUserModalEditing(false);
    setAdminUserModalName("");
    setAdminUserModalRole("TESTER");
    setAdminUserModalLoading(false);
    setAdminUserModalError("");
    setAdminUserToast("");
    resetBugPanel();
    setActiveFeature("none");
    setActiveMenuKey("dashboard_home");
    setScreen("login");
  };

  const resetTransientDashboardUi = () => {
    setShowTestCaseList(false);
    setExpandedTestCaseId("");
    setTestCasesVisible(false);
    setSelectedTestCaseModalId("");
    setTestCasesLoading(false);
    setTemplatesVisible(false);
    setTemplatesLoading(false);
    setSelectedTemplateModalId("");
    setTemplateModalEditing(false);
    setBulkCasePickerOpen(false);
    setBulkCaseQuery("");
    setSelectedIds([]);
    setAdminUsersVisible(false);
    setAdminUserModalUser(null);
    setAdminUserModalEditing(false);
    setAdminUserModalName("");
    setAdminUserModalRole("TESTER");
    setAdminUserModalLoading(false);
    setAdminUserModalError("");
    setShowMentionPopup(false);
    setMentionQuery("");
    setSelectedExecutionReportId("");
    setSelectedBugId("");
  };

  const handleDashboardNavSelect = async (menuKey: string) => {
    const mappedFeature = menuFeatureMap[menuKey] || "none";
    resetTransientDashboardUi();
    setActiveMenuKey(menuKey);
    setActiveFeature(mappedFeature);

    try {
      if (
        mappedFeature === "none" ||
        mappedFeature === "create_test_case" ||
        mappedFeature === "templates" ||
        mappedFeature === "bulk_operations" ||
        mappedFeature === "import_test_cases" ||
        mappedFeature === "suite_management" ||
        mappedFeature === "test_runs" ||
        mappedFeature === "execute_tests" ||
        mappedFeature === "bug_management" ||
        mappedFeature === "test_cases" ||
        mappedFeature === "developer_workspace"
      ) {
        await loadTestCaseData();
      }

      if (isAdmin && mappedFeature === "admin_workspace") {
        if (menuKey === "user_management" || menuKey === "role_management") {
          await loadAdminUsers();
        } else if (menuKey === "audit_logs") {
          await loadAdminAuditLogs(auditEntityType || undefined);
        } else if (menuKey === "backup_management") {
          await loadAdminAuditLogs("BackupJob");
        } else if (menuKey === "project_management") {
          await loadTestCaseData();
        }
      }

      if (isAdmin && menuKey === "dashboard_home") {
        const calls: Array<Promise<any>> = [];
        if (canManageUsersPermission) calls.push(loadAdminUsers());
        if (canManageProjectsPermission) calls.push(loadAdminProjects());
        if (canViewAuditLogsPermission) calls.push(loadAdminAuditLogs());
        if (calls.length > 0) {
          await Promise.all(calls);
        }
      }

      if (selectedBugId && mappedFeature === "bug_management") {
        await loadBugDetails(selectedBugId);
      }
    } catch {
      // Intentionally silent here: existing page-level actions already show explicit alerts.
    }
  };

  const toggleRolePermission = (roleKey: "ADMIN" | "TESTER" | "DEVELOPER", permission: string) => {
    setRolePermissions((prev) => {
      const current = prev[roleKey] || [];
      const next = current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission];
      return { ...prev, [roleKey]: next };
    });
  };

  return (
    <div className={`container ${screen === "dashboard" ? "dashboardMode" : "authMode"}`}>
      <div className={`card ${screen === "dashboard" ? "cardDashboard" : "cardAuth"}`}>
        {screen !== "dashboard" && <h2 className="brandTitle">TestTrack Pro</h2>}
        {screen !== "dashboard" && (
          <p className="authTagline">Quality engineering workspace for testers, developers, and admins.</p>
        )}

        {screen === "login" && (
          <Login
            key="auth-login"
            email={email}
            password={password}
            rememberMe={rememberMe}
            isLoading={authSubmitting}
            error={authError}
            setEmail={setEmail}
            setPassword={setPassword}
            setRememberMe={setRememberMe}
            onLogin={handleLogin}
            goToForgot={goToForgotScreen}
            goToRegister={goToRegisterScreen}
          />
        )}

        {screen === "register" && (
          <Register
            key="auth-register"
            name={name}
            email={email}
            password={password}
            confirmPassword={confirmPassword}
            role={role}
            isLoading={authSubmitting}
            error={authError}
            setName={setName}
            setEmail={setEmail}
            setPassword={setPassword}
            setConfirmPassword={setConfirmPassword}
            setRole={setRole}
            onRegister={handleRegister}
            goToLogin={goToLoginScreen}
          />
        )}

        {screen === "forgot" && (
          <ForgotPassword
            key="auth-forgot"
            email={email}
            isLoading={authSubmitting}
            error={authError}
            setEmail={setEmail}
            onSubmit={handleForgotPassword}
            goToLogin={goToLoginScreen}
          />
        )}

        {screen === "reset" && (
          <ResetPassword
            resetToken={resetToken}
            newPassword={newPassword}
            isLoading={authSubmitting}
            error={authError}
            setNewPassword={setNewPassword}
            onSubmit={handleResetPassword}
            goToLogin={handleBackToLogin}
          />
        )}

        {screen === "dashboard" && (
          <DashboardLayout
            key={`layout-${currentUserId || "anon"}-${currentRole || "none"}`}
            currentUserName={name || email || "User"}
            currentRole={currentRole || "USER"}
            notificationCount={notificationUnreadCount}
            notificationItems={notificationItems.map((item) => ({
              id: item.id,
              title: item.title,
              subtitle: item.subtitle,
              isRead: item.isRead,
            }))}
            onNotificationClick={handleNotificationClick}
            navItems={roleNavItems}
            activeKey={activeMenuKey}
            onSelect={(feature) => {
              handleDashboardNavSelect(feature);
            }}
            onLogout={handleLogout}
            onLogoutAll={async () => {
              const res = await logoutAllApi();
              alert(res.message || "Logged out from all devices");
              clearSessionTokens();
              setScreen("login");
            }}
            pageTitle={currentPageMeta.title}
            pageSubtitle={currentPageMeta.subtitle}
            primaryActionLabel={isRefreshing ? "Refreshing..." : "Refresh Data"}
            onPrimaryAction={async () => {
              try {
                resetEntryFields();
                await loadTestCaseData();
              } catch (error: any) {
                setIsRefreshing(false);
                alert(error?.message || "Refresh failed");
              }
            }}
          >
            {activeFeature === "none" && (
              <>
                {isTester && (
                  <>
                    <section className="panel">
                      <h4>Tester Dashboard</h4>
                      <p className="note">Track pending tests, failures, and execution quality at a glance.</p>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader">
                        <h4 style={{ marginBottom: 0 }}>My Pending Tests</h4>
                      </div>
                      <div className="tableWrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Test Case</th>
                              <th>Module</th>
                              <th>Status</th>
                              <th>Priority</th>
                            </tr>
                          </thead>
                          <tbody>
                            {testerPendingTests.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="note">No pending tests.</td>
                              </tr>
                            ) : (
                              testerPendingTests.map((item) => (
                                <tr key={item.id}>
                                  <td>{item.title}</td>
                                  <td>{item.module || "General"}</td>
                                  <td>
                                    <span className={`statusBadge status-${String(item.status || "").toLowerCase()}`}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td>{item.priority || "MEDIUM"}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>Recent Failures</h4></div>
                      <div className="listCompact">
                        {recentFailures.length === 0 ? (
                          <p className="note">No recent failures.</p>
                        ) : (
                          recentFailures.map((row) => (
                            <div className="row" key={row.id}>
                              <strong>{row.testCase?.title || row.testCaseId}</strong>
                              <div className="note">{new Date(row.executedAt).toLocaleString()}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>Execution Trend (7 Days)</h4></div>
                      <div className="miniBarChart">
                        {trendBuckets.map((bucket) => (
                          <div key={bucket.key} className="miniBarItem">
                            <div
                              className="miniBar"
                              style={{ height: `${Math.max(8, Math.round((bucket.count / maxTrendCount) * 100))}%` }}
                            />
                            <span>{bucket.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>Test Status Breakdown</h4></div>
                      <div className="pieSection">
                        <div className="pieChart" style={{ background: statusPie }} />
                        <div className="pieLegend">
                          <div>Passed: {statusCounts.passed}</div>
                          <div>Failed: {statusCounts.failed}</div>
                          <div>Blocked: {statusCounts.blocked}</div>
                          <div>Skipped: {statusCounts.skipped}</div>
                        </div>
                      </div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>Quick Actions</h4></div>
                      <div className="toolbarActions">
                        <button className="button small" onClick={() => handleDashboardNavSelect("create_test_case")}>Create Test Case</button>
                        <button className="button small" onClick={() => handleDashboardNavSelect("execute_tests")}>Execute Tests</button>
                        <button className="button small" onClick={() => handleDashboardNavSelect("bug_management")}>Report Bug</button>
                      </div>
                    </section>
                  </>
                )}

                {isDeveloper && (
                  <>
                    <section className="panel">
                      <h4>Developer Dashboard</h4>
                      <p className="note">Monitor assigned defects, severity hotspots, and recent updates.</p>
                    </section>
                    <section className="panel dashboardWidget kpiRow">
                      <div className="kpiItem"><strong>Assigned Bugs</strong><span>{assignedBugCount}</span></div>
                      <div className="kpiItem"><strong>Critical / P1</strong><span>{criticalBugCount + p1UrgentCount}</span></div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>Bug Aging (Last 7 Days)</h4></div>
                      <div className="miniBarChart">
                        {trendBuckets.map((bucket) => (
                          <div key={`aging-${bucket.key}`} className="miniBarItem">
                            <div
                              className="miniBar bugAgingBar"
                              style={{ height: `${Math.max(8, Math.round((bucket.count / maxTrendCount) * 100))}%` }}
                            />
                            <span>{bucket.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>Bug Status Distribution</h4></div>
                      <div className="pieSection">
                        <div className="pieChart" style={{ background: bugStatusPie }} />
                        <div className="pieLegend">
                          <div>New: {bugStatusCounts.NEW}</div>
                          <div>Open: {bugStatusCounts.OPEN}</div>
                          <div>In Progress: {bugStatusCounts.IN_PROGRESS}</div>
                          <div>Fixed: {bugStatusCounts.FIXED}</div>
                          <div>Verified: {bugStatusCounts.VERIFIED}</div>
                          <div>Closed: {bugStatusCounts.CLOSED}</div>
                        </div>
                      </div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>Recent Activity</h4></div>
                      <div className="listCompact">
                        {bugs.slice(0, 6).map((item) => (
                          <div className="row" key={item.id}>
                            <strong>{item.title || item.bugCode || item.id}</strong>
                            <div className="note">{item.workflowStatus || item.status || "OPEN"} | {new Date(item.updatedAt || item.createdAt).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {isAdmin && (
                  <>
                    <section className="panel">
                      <h4>Admin Dashboard</h4>
                      <p className="note">View user/project/case health and system-wide activity trends.</p>
                    </section>
                    <section className="panel dashboardWidget kpiRow">
                      <div className="kpiItem"><strong>Total Users</strong><span>{adminUsers.length}</span></div>
                      <div className="kpiItem"><strong>Active Projects</strong><span>{adminProjects.filter((p) => p.isActive !== false).length}</span></div>
                      <div className="kpiItem"><strong>Total Test Cases</strong><span>{testCases.length}</span></div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>System Activity (7 Days)</h4></div>
                      <div className="miniBarChart">
                        {trendBuckets.map((bucket) => (
                          <div key={`system-${bucket.key}`} className="miniBarItem">
                            <div
                              className="miniBar systemBar"
                              style={{ height: `${Math.max(8, Math.round((bucket.count / maxTrendCount) * 100))}%` }}
                            />
                            <span>{bucket.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="panel dashboardWidget">
                      <div className="panelHeader"><h4 style={{ marginBottom: 0 }}>Recent Audit Logs</h4></div>
                      <div className="listCompact">
                        {adminAuditLogs.slice(0, 8).map((log: any) => (
                          <div className="row" key={log.id}>
                            <strong>{log.action || "ACTION"}</strong>
                            <div className="note">{log.actor?.name || log.actor?.email || "Unknown"} | {new Date(log.createdAt).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </>
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
                  {activeMenuKey === "user_management" && (
                    <>
                      <h4>User Management</h4>
                      <p className="note">Open users in a clean table and manage actions safely through a modal.</p>
                      <div className="panel adminCreateUserPanel">
                        <div className="panelHeader">
                          <h4 style={{ marginBottom: 0 }}>Create User</h4>
                        </div>
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
                          disabled={adminUserSavingId === "create-user"}
                          onClick={async () => {
                            try {
                              if (
                                !adminCreateName.trim() ||
                                !adminCreateEmail.trim() ||
                                !adminCreatePassword.trim() ||
                                !adminCreateRole
                              ) {
                                alert("Name, email, password, and role are required");
                                return;
                              }
                              setAdminUserSavingId("create-user");
                              const created = await createAdminUserApi({
                                name: adminCreateName.trim(),
                                email: adminCreateEmail.trim().toLowerCase(),
                                password: adminCreatePassword,
                                role: adminCreateRole,
                              });
                              setAdminCreateName("");
                              setAdminCreateEmail("");
                              setAdminCreatePassword("");
                              setAdminCreateRole("");
                              setAdminUsersVisible(true);
                              if (created?.id) {
                                setAdminUsers((prev) => {
                                  const exists = prev.some((row) => row.id === created.id);
                                  if (exists) return prev;
                                  return [created, ...prev];
                                });
                              } else {
                                await loadAdminUsers();
                              }
                              showAdminToast("User created successfully");
                            } catch (error: any) {
                              alert(error?.message || "Create user failed");
                            } finally {
                              setAdminUserSavingId("");
                            }
                          }}
                        >
                          {adminUserSavingId === "create-user" ? "Creating..." : "Create User"}
                        </button>
                      </div>
                      <div className="adminUsersToolbar">
                        <button
                          className="button adminUsersPrimaryBtn"
                          onClick={async () => {
                            try {
                              setAdminUserSavingId("users-load");
                              await loadAdminUsers();
                              setAdminUsersVisible(true);
                              showAdminToast("Users loaded");
                            } catch (error: any) {
                              alert(error?.message || "Load users failed");
                            } finally {
                              setAdminUserSavingId("");
                            }
                          }}
                          disabled={adminUserSavingId === "users-load"}
                        >
                          {adminUserSavingId === "users-load" ? "Loading Users..." : "Users"}
                        </button>
                        {adminUsersVisible ? (
                          <button
                            className="button small"
                            onClick={async () => {
                              try {
                                setAdminUserSavingId("users-refresh");
                                await loadAdminUsers();
                                showAdminToast("Users refreshed");
                              } catch (error: any) {
                                alert(error?.message || "Refresh users failed");
                              } finally {
                                setAdminUserSavingId("");
                              }
                            }}
                            disabled={adminUserSavingId === "users-refresh"}
                          >
                            {adminUserSavingId === "users-refresh" ? "Refreshing..." : "Refresh"}
                          </button>
                        ) : null}
                      </div>

                      {!adminUsersVisible ? (
                        <p className="note">Click the Users button to fetch and display the user table.</p>
                      ) : (
                        <div className="tableWrap adminUsersTableWrap">
                          <table className="table adminUsersTable">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminUsers.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="note">No users found.</td>
                                </tr>
                              ) : (
                                adminUsers.map((user) => {
                                  const roleValue = String(user.role || "TESTER").toUpperCase();
                                  const statusValue = Boolean(user.isActive) ? "ACTIVE" : "INACTIVE";
                                  return (
                                    <tr
                                      key={user.id}
                                      className="adminUsersRow"
                                      tabIndex={0}
                                      role="button"
                                      aria-label={`Open actions for ${user.name || user.email}`}
                                      onClick={() => openAdminUserModal(user)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          openAdminUserModal(user);
                                        }
                                      }}
                                    >
                                      <td>{user.name || "Unnamed user"}</td>
                                      <td className="truncateCell" title={user.email}>{user.email}</td>
                                      <td>
                                        <span className={`adminPill role-${roleValue.toLowerCase()}`}>{roleValue}</span>
                                      </td>
                                      <td>
                                        <span className={`adminPill status-${statusValue.toLowerCase()}`}>
                                          {statusValue}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {adminUserModalUser ? (
                        <div
                          className="adminUserModalOverlay"
                          onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                              closeAdminUserModal();
                            }
                          }}
                        >
                          <div
                            className="adminUserModal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="admin-user-modal-title"
                            ref={adminUserModalRef}
                          >
                            <button
                              type="button"
                              className="adminUserModalClose"
                              aria-label="Close user details"
                              onClick={closeAdminUserModal}
                              disabled={adminUserModalLoading}
                            >
                              X
                            </button>
                            <h5 id="admin-user-modal-title">User Details</h5>

                            {adminUserModalError ? (
                              <div className="adminUserModalError">{adminUserModalError}</div>
                            ) : null}

                            {!adminUserModalEditing ? (
                              <div className="adminUserModalDetails">
                                <p><strong>Name:</strong> {adminUserModalUser.name || "Unnamed user"}</p>
                                <p><strong>Email:</strong> {adminUserModalUser.email}</p>
                                <p><strong>Role:</strong> {adminUserModalUser.role || "TESTER"}</p>
                                <p><strong>Status:</strong> {adminUserModalUser.isActive ? "Active" : "Inactive"}</p>
                              </div>
                            ) : (
                              <div className="adminUserModalForm">
                                <label className="fieldLabel" htmlFor="admin-modal-name">Name</label>
                                <input
                                  id="admin-modal-name"
                                  className="input"
                                  value={adminUserModalName}
                                  onChange={(e) => setAdminUserModalName(e.target.value)}
                                  disabled={adminUserModalLoading}
                                />
                                <label className="fieldLabel" htmlFor="admin-modal-role">Role</label>
                                <select
                                  id="admin-modal-role"
                                  className="input"
                                  value={adminUserModalRole}
                                  onChange={(e) => setAdminUserModalRole(e.target.value)}
                                  disabled={adminUserModalLoading}
                                >
                                  <option value="TESTER">TESTER</option>
                                  <option value="DEVELOPER">DEVELOPER</option>
                                  <option value="ADMIN">ADMIN</option>
                                </select>
                              </div>
                            )}

                            <div className="adminUserModalActions">
                              {!adminUserModalEditing ? (
                                <>
                                  <button
                                    className="button small adminActionEdit"
                                    disabled={adminUserModalLoading}
                                    onClick={() => {
                                      setAdminUserModalEditing(true);
                                      setAdminUserModalName(String(adminUserModalUser?.name || "").trim() || "Unnamed user");
                                      setAdminUserModalRole(String(adminUserModalUser?.role || "TESTER").toUpperCase());
                                      setAdminUserModalError("");
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="button small adminActionToggle"
                                    disabled={adminUserModalLoading || adminUserModalUser.id === currentUserId}
                                    onClick={async () => {
                                      const actionLabel = adminUserModalUser.isActive ? "Deactivate" : "Activate";
                                      const confirmed = window.confirm(`${actionLabel} ${adminUserModalUser.email}?`);
                                      if (!confirmed) return;
                                      try {
                                        setAdminUserModalLoading(true);
                                        setAdminUserModalError("");
                                        const nextIsActive = !Boolean(adminUserModalUser.isActive);
                                        await updateAdminUserApi(adminUserModalUser.id, { isActive: nextIsActive });
                                        setAdminUsers((prev) =>
                                          prev.map((row) => (row.id === adminUserModalUser.id ? { ...row, isActive: nextIsActive } : row))
                                        );
                                        setAdminUserModalUser((prev: any | null) =>
                                          prev ? { ...prev, isActive: nextIsActive } : prev
                                        );
                                        showAdminToast(`User ${nextIsActive ? "activated" : "deactivated"} successfully`);
                                        closeAdminUserModal();
                                      } catch (error: any) {
                                        setAdminUserModalError(error?.message || "Status update failed");
                                      } finally {
                                        setAdminUserModalLoading(false);
                                      }
                                    }}
                                  >
                                    {adminUserModalUser.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                  <button
                                    className="button small adminActionDelete"
                                    disabled={adminUserModalLoading || adminUserModalUser.id === currentUserId}
                                    onClick={async () => {
                                      const firstConfirm = window.confirm(
                                        `Delete ${adminUserModalUser.email}? This is irreversible.`
                                      );
                                      if (!firstConfirm) return;
                                      const finalToken = window.prompt("Type DELETE to confirm permanent removal.");
                                      if (finalToken !== "DELETE") return;
                                      try {
                                        setAdminUserModalLoading(true);
                                        setAdminUserModalError("");
                                        await deleteAdminUserApi(adminUserModalUser.id);
                                        setAdminUsers((prev) => prev.filter((row) => row.id !== adminUserModalUser.id));
                                        showAdminToast("User deleted successfully");
                                        closeAdminUserModal();
                                      } catch (error: any) {
                                        setAdminUserModalError(error?.message || "Delete user failed");
                                      } finally {
                                        setAdminUserModalLoading(false);
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="button small adminActionEdit"
                                    disabled={adminUserModalLoading || !adminUserModalName.trim()}
                                    onClick={async () => {
                                      const nextName = adminUserModalName.trim();
                                      if (!nextName) {
                                        setAdminUserModalError("Name is required");
                                        return;
                                      }
                                      try {
                                        setAdminUserModalLoading(true);
                                        setAdminUserModalError("");
                                        await updateAdminUserApi(adminUserModalUser.id, {
                                          name: nextName,
                                          role: adminUserModalRole,
                                        });
                                        setAdminUsers((prev) =>
                                          prev.map((row) =>
                                            row.id === adminUserModalUser.id
                                              ? { ...row, name: nextName, role: adminUserModalRole }
                                              : row
                                          )
                                        );
                                        showAdminToast("User updated successfully");
                                        closeAdminUserModal();
                                      } catch (error: any) {
                                        setAdminUserModalError(error?.message || "Save failed");
                                      } finally {
                                        setAdminUserModalLoading(false);
                                      }
                                    }}
                                  >
                                    {adminUserModalLoading ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    className="button small"
                                    disabled={adminUserModalLoading}
                                    onClick={() => {
                                      setAdminUserModalEditing(false);
                                      setAdminUserModalName(String(adminUserModalUser?.name || "").trim() || "Unnamed user");
                                      setAdminUserModalRole(String(adminUserModalUser?.role || "TESTER").toUpperCase());
                                      setAdminUserModalError("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {adminUserToast ? <div className="adminUserToast">{adminUserToast}</div> : null}
                    </>
                  )}

                  {activeMenuKey === "role_management" && (
                    <>
                      <h4>Role Management</h4>
                      <p className="note">Customize user roles and role permissions.</p>
                      <div className="inlineGrid">
                        <select
                          className="input"
                          value={editPermissionRole}
                          onChange={(e) =>
                            setEditPermissionRole(e.target.value as "ADMIN" | "TESTER" | "DEVELOPER")
                          }
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="TESTER">TESTER</option>
                          <option value="DEVELOPER">DEVELOPER</option>
                        </select>
                        <button
                          className="button"
                          disabled={rolePermissionSaving}
                          onClick={async () => {
                            try {
                              setRolePermissionSaving(true);
                              await upsertAdminSystemConfigApi({
                                key: "ROLE_PERMISSIONS",
                                value: JSON.stringify(rolePermissions),
                              });
                              await loadRolePermissions();
                              await loadTestCaseData();
                              alert("Role permissions updated");
                            } catch (error: any) {
                              alert(error?.message || "Failed to save role permissions");
                            } finally {
                              setRolePermissionSaving(false);
                            }
                          }}
                        >
                          {rolePermissionSaving ? "Saving..." : "Save Permissions"}
                        </button>
                      </div>
                      <div className="listCompact">
                        {permissionCatalog.map((permission) => (
                          <label key={permission} className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={(rolePermissions[editPermissionRole] || []).includes(permission)}
                              onChange={() => toggleRolePermission(editPermissionRole, permission)}
                            />
                            <span>{permission}</span>
                          </label>
                        ))}
                      </div>
                     
                    </>
                  )}

                  {activeMenuKey === "project_management" && (
                    <>
                      <h4>Project Management</h4>
                      <p className="note">Create and configure projects.</p>
                      <div className="inlineGrid">
                        <input
                          className="input"
                          placeholder="Project Name"
                          value={adminProjectName}
                          onChange={(e) => setAdminProjectName(e.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="Project Description"
                          value={adminProjectDescription}
                          onChange={(e) => setAdminProjectDescription(e.target.value)}
                        />
                      </div>
                      <button
                        className="button"
                        onClick={async () => {
                          try {
                            if (!adminProjectName.trim()) {
                              alert("Project name is required");
                              return;
                            }
                            const created = await createAdminProjectApi({
                              name: adminProjectName.trim(),
                              description: adminProjectDescription.trim() || undefined,
                            });
                            setAdminProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
                            setAdminProjectName("");
                            setAdminProjectDescription("");
                            alert("Project created");
                          } catch (error: any) {
                            alert(error?.message || "Create project failed");
                          }
                        }}
                      >
                        Create Project
                      </button>
                      <div className="panelHeader" style={{ marginTop: "12px" }}>
                        <h4 style={{ marginBottom: 0 }}>Project List</h4>
                        <button className="button small" onClick={() => loadTestCaseData()}>
                          Refresh Projects
                        </button>
                      </div>
                      <div className="listCompact">
                        {adminProjects.length === 0 ? (
                          <p className="note">
                            No projects found. Create one. Existing projects from linked test cases appear here.
                          </p>
                        ) : (
                          adminProjects.map((project) => (
                            <div className="row adminUserRow" key={project.id}>
                              <span className="title">
                                <strong>{project.name || "Unnamed project"}</strong>
                                <br />
                                {project.description || "No description"}
                              </span>
                              <span className="meta">{project.isActive === false ? "Inactive" : "Active"}</span>
                              <button
                                className="button small"
                                disabled={adminProjectSavingId === project.id}
                                onClick={async () => {
                                  try {
                                    setAdminProjectSavingId(project.id);
                                    await updateAdminProjectApi(project.id, {
                                      isActive: project.isActive === false ? true : false,
                                    });
                                    setAdminProjects((prev) =>
                                      prev.map((item) =>
                                        item.id === project.id
                                          ? { ...item, isActive: !(project.isActive === false) }
                                          : item
                                      )
                                    );
                                  } catch (error: any) {
                                    alert(error?.message || "Project update failed");
                                  } finally {
                                    setAdminProjectSavingId("");
                                  }
                                }}
                              >
                                {project.isActive === false ? "Activate" : "Deactivate"}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {activeMenuKey === "audit_logs" && (
                    <>
                      <h4>Audit Logs</h4>
                      <p className="note">View complete system audit trail.</p>
                      <div className="inlineGrid">
                        <input
                          className="input"
                          placeholder="Entity Type (optional)"
                          value={auditEntityType}
                          onChange={(e) => setAuditEntityType(e.target.value)}
                        />
                        <button
                          className="button"
                          onClick={async () => {
                            try {
                              await loadAdminAuditLogs(auditEntityType || undefined);
                            } catch (error: any) {
                              alert(error?.message || "Failed to load audit logs");
                            }
                          }}
                        >
                          Refresh Audit Logs
                        </button>
                      </div>
                      <div className="listCompact">
                        {adminAuditLogs.length === 0 ? (
                          <p className="note">No audit logs found.</p>
                        ) : (
                          adminAuditLogs.map((log: any) => (
                            <div className="row" key={log.id}>
                              <strong>{log.action || "ACTION"}</strong>
                              <div className="note">
                                {log.entityType || "Entity"} {log.entityId || ""}
                              </div>
                              <div className="note">
                                {(log.actor?.name || log.actor?.email || "Unknown")} |{" "}
                                {log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {activeMenuKey === "backup_management" && (
                    <>
                      <h4>Backup Management</h4>
                      <p className="note">Trigger and monitor backup-related activity.</p>
                      <div className="inlineGrid">
                        <input
                          className="input"
                          placeholder="Backup notes"
                          value={backupNotes}
                          onChange={(e) => setBackupNotes(e.target.value)}
                        />
                        <button
                          className="button"
                          disabled={backupTriggering}
                          onClick={async () => {
                            try {
                              setBackupTriggering(true);
                              await triggerAdminBackupApi(backupNotes || undefined);
                              setBackupNotes("");
                              await loadAdminAuditLogs("BackupJob");
                              alert("Backup triggered");
                            } catch (error: any) {
                              alert(error?.message || "Backup trigger failed");
                            } finally {
                              setBackupTriggering(false);
                            }
                          }}
                        >
                          {backupTriggering ? "Triggering..." : "Trigger Backup"}
                        </button>
                      </div>
                      <div className="listCompact">
                        {adminAuditLogs.length === 0 ? (
                          <p className="note">No backup activity found.</p>
                        ) : (
                          adminAuditLogs
                            .filter((log: any) =>
                              (log.entityType || "").toLowerCase().includes("backup") ||
                              (log.action || "").toUpperCase().includes("BACKUP")
                            )
                            .map((log: any) => (
                              <div className="row" key={log.id}>
                                <strong>{log.action || "BACKUP_EVENT"}</strong>
                                <div className="note">
                                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}

              {showCreateTestCase && (
              <section className="panel createCasePanel">
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
                  <option value="">Select module</option>
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
                  <option value="">Select automation status</option>
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
                    <option value="">Select priority</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <select className="input" value={tcSeverity} onChange={(e) => setTcSeverity(e.target.value)}>
                    <option value="">Select severity</option>
                    <option value="BLOCKER">BLOCKER</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="MINOR">MINOR</option>
                    <option value="TRIVIAL">TRIVIAL</option>
                  </select>
                </div>
                <div className="inlineGrid">
                  <select className="input" value={tcType} onChange={(e) => setTcType(e.target.value)}>
                    <option value="">Select type</option>
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
                    <option value="">Select status</option>
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
              <section className="panel formWidePanel">
                <h4>Templates</h4>
                <input className="input" placeholder="Template Name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                <input className="input" placeholder="Template Category (e.g., Login Tests)" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} />
                <textarea className="input" placeholder="Template steps JSON or lines" rows={3} value={templateSteps} onChange={(e) => setTemplateSteps(e.target.value)} />
                <button
                  className="button sectionCta"
                  onClick={async () => {
                    try {
                      await createTemplateApi({
                        name: templateName,
                        category: templateCategory,
                        preConditions: parseSection(tcPreConditionsText),
                        testDataRequirements: parseSection(tcTestDataRequirementsText),
                        environmentRequirements: parseSection(tcEnvironmentRequirementsText),
                        module: tcModule,
                        steps: parseSteps(templateSteps),
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
                <div className="adminUsersToolbar sectionActionRow">
                  <button
                    className="button adminUsersPrimaryBtn"
                    disabled={templatesLoading}
                    onClick={async () => {
                      try {
                        setTemplatesLoading(true);
                        await loadTestCaseData();
                        setTemplatesVisible(true);
                      } catch (error: any) {
                        alert(error?.message || "Load templates failed");
                      } finally {
                        setTemplatesLoading(false);
                      }
                    }}
                  >
                    {templatesLoading ? "Loading..." : "Templates"}
                  </button>
                  {templatesVisible ? (
                    <button
                      className="button small"
                      disabled={templatesLoading}
                      onClick={async () => {
                        try {
                          setTemplatesLoading(true);
                          await loadTestCaseData();
                        } catch (error: any) {
                          alert(error?.message || "Refresh templates failed");
                        } finally {
                          setTemplatesLoading(false);
                        }
                      }}
                    >
                      Refresh
                    </button>
                  ) : null}
                </div>

                {!templatesVisible ? (
                  <div className="note">Click the Templates button to fetch and view template list.</div>
                ) : (
                  <div className="tableWrap adminUsersTableWrap">
                    <table className="table adminUsersTable">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Module</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="note">No templates found.</td>
                          </tr>
                        ) : (
                          templates.map((tpl) => (
                            <tr
                              key={tpl.id}
                              className="adminUsersRow"
                              tabIndex={0}
                              role="button"
                              aria-label={`Open template ${tpl.name}`}
                              onClick={() => openTemplateModal(tpl)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  openTemplateModal(tpl);
                                }
                              }}
                            >
                              <td>{tpl.name || "Untitled template"}</td>
                              <td>{tpl.category || "General"}</td>
                              <td>{tpl.module || "General"}</td>
                              <td>{tpl.status || "DRAFT"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedTemplateModal && (
                  <div
                    className="adminUserModalOverlay"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) setSelectedTemplateModalId("");
                    }}
                  >
                    <div className="adminUserModal testCaseModal" role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
                      <button
                        type="button"
                        className="adminUserModalClose"
                        aria-label="Close template details"
                        onClick={() => {
                          setSelectedTemplateModalId("");
                          setTemplateModalEditing(false);
                        }}
                      >
                        X
                      </button>
                      <h5 id="template-modal-title">Template Details</h5>
                      {!templateModalEditing ? (
                        <div className="adminUserModalDetails">
                          <p><strong>Name:</strong> {selectedTemplateModal.name || "N/A"}</p>
                          <p><strong>Category:</strong> {selectedTemplateModal.category || "N/A"}</p>
                          <p><strong>Description:</strong> {selectedTemplateModal.description || "N/A"}</p>
                          <p><strong>Module:</strong> {selectedTemplateModal.module || "N/A"}</p>
                          <p><strong>Steps:</strong> {typeof selectedTemplateModal.steps === "string" ? selectedTemplateModal.steps : JSON.stringify(selectedTemplateModal.steps ?? [])}</p>
                          <p><strong>Priority:</strong> {selectedTemplateModal.priority || "N/A"}</p>
                          <p><strong>Severity:</strong> {selectedTemplateModal.severity || "N/A"}</p>
                          <p><strong>Type:</strong> {selectedTemplateModal.type || "N/A"}</p>
                          <p><strong>Status:</strong> {selectedTemplateModal.status || "N/A"}</p>
                          <p><strong>Tags:</strong> {(selectedTemplateModal.tags ?? []).join(", ") || "N/A"}</p>
                          <p><strong>Estimated Duration:</strong> {selectedTemplateModal.estimatedDurationMinutes ?? "N/A"} min</p>
                          <p><strong>Automation Status:</strong> {selectedTemplateModal.automationStatus || "N/A"}</p>
                          <p><strong>Automation Script:</strong> {selectedTemplateModal.automationScriptLink || "N/A"}</p>
                          <p><strong>Metadata:</strong> {JSON.stringify(selectedTemplateModal.metadata ?? {})}</p>
                        </div>
                      ) : (
                        <div>
                          <label className="fieldLabel">Name</label>
                          <input className="input" value={templateEditName} onChange={(e) => setTemplateEditName(e.target.value)} />
                          <label className="fieldLabel">Category</label>
                          <input className="input" value={templateEditCategory} onChange={(e) => setTemplateEditCategory(e.target.value)} />
                          <label className="fieldLabel">Description</label>
                          <textarea className="input" rows={2} value={templateEditDescription} onChange={(e) => setTemplateEditDescription(e.target.value)} />
                          <label className="fieldLabel">Module</label>
                          <input className="input" value={templateEditModule} onChange={(e) => setTemplateEditModule(e.target.value)} />
                          <label className="fieldLabel">Steps (JSON or lines)</label>
                          <textarea className="input" rows={4} value={templateEditSteps} onChange={(e) => setTemplateEditSteps(e.target.value)} />
                        </div>
                      )}
                      <div className="adminUserModalActions">
                        {!templateModalEditing ? (
                          <>
                            <button
                              className="button small"
                              onClick={async () => {
                                try {
                                  await createFromTemplateApi(selectedTemplateModal.id, { title: `${selectedTemplateModal.name} - Instance` });
                                  await loadTestCaseData();
                                  alert("Test case created from template");
                                } catch (error: any) {
                                  alert(error?.message || "Create from template failed");
                                }
                              }}
                            >
                              Use
                            </button>
                            <button className="button small adminActionEdit" onClick={() => setTemplateModalEditing(true)}>
                              Edit
                            </button>
                            <button
                              className="button small adminActionDelete"
                              onClick={async () => {
                                try {
                                  if (!window.confirm("Delete this template?")) return;
                                  await deleteTemplateApi(selectedTemplateModal.id);
                                  setSelectedTemplateModalId("");
                                  setTemplateModalEditing(false);
                                  await loadTestCaseData();
                                  alert("Template deleted");
                                } catch (error: any) {
                                  alert(error?.message || "Delete template failed");
                                }
                              }}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="button small adminActionEdit"
                              onClick={async () => {
                                try {
                                  await updateTemplateApi(selectedTemplateModal.id, {
                                    name: templateEditName,
                                    category: templateEditCategory || null,
                                    description: templateEditDescription || null,
                                    module: templateEditModule || null,
                                    steps: parseSteps(templateEditSteps),
                                  });
                                  setTemplateModalEditing(false);
                                  await loadTestCaseData();
                                  alert("Template updated");
                                } catch (error: any) {
                                  alert(error?.message || "Update template failed");
                                }
                              }}
                            >
                              Save
                            </button>
                            <button className="button small" onClick={() => setTemplateModalEditing(false)}>
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
              )}

              {showBulkOperations && (
              <section className="panel formWidePanel">
                <h4>Bulk Operations</h4>
                <select className="input" value={bulkOperation} onChange={(e) => setBulkOperation(e.target.value)}>
                  <option value="">Select operation</option>
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
                <label className="fieldLabel">Select Test Cases</label>
                <div className="bulkCasePicker" ref={bulkCasePickerRef}>
                  <button
                    type="button"
                    className="bulkCasePickerTrigger"
                    onClick={() => setBulkCasePickerOpen((prev) => !prev)}
                    aria-expanded={bulkCasePickerOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{bulkSelectedSummary}</span>
                    <span>{bulkCasePickerOpen ? "▲" : "▼"}</span>
                  </button>
                  {bulkCasePickerOpen ? (
                    <div className="bulkCasePickerMenu" role="listbox" aria-multiselectable="true">
                      <input
                        className="input bulkCasePickerSearch"
                        placeholder="Search by test case code or title"
                        value={bulkCaseQuery}
                        onChange={(e) => setBulkCaseQuery(e.target.value)}
                      />
                      <div className="bulkCasePickerList">
                        {filteredBulkCaseOptions.length === 0 ? (
                          <div className="note">No test cases match your search.</div>
                        ) : (
                          filteredBulkCaseOptions.map((tc) => {
                            const tcId = String(tc?.id || "");
                            const checked = selectedIds.includes(tcId);
                            return (
                              <label key={tcId} className="bulkCasePickerItem">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedIds((prev) => Array.from(new Set([...prev, tcId])));
                                    } else {
                                      setSelectedIds((prev) => prev.filter((id) => id !== tcId));
                                    }
                                  }}
                                />
                                <span className="bulkCasePickerText">
                                  {tc?.testCaseCode ? `${tc.testCaseCode} - ` : ""}
                                  {tc?.title || "Untitled test case"}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                      <div className="bulkCasePickerFooter">
                        <span className="note">Selected: {selectedIds.length}</span>
                        <button
                          type="button"
                          className="button small"
                          onClick={() => setSelectedIds([])}
                          disabled={selectedIds.length === 0}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {bulkOperation === "STATUS" && (
                  <select className="input" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                    <option value="">Select status</option>
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
                    <option value="">Select priority</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                )}
                {bulkOperation === "SEVERITY" && (
                  <select className="input" value={bulkSeverityValue} onChange={(e) => setBulkSeverityValue(e.target.value)}>
                    <option value="">Select severity</option>
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
                  className="button sectionCta"
                  onClick={async () => {
                    try {
                      if (!selectedIds.length) {
                        alert("Please select at least one test case for bulk operation");
                        return;
                      }
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
                        setBulkOperation("");
                        setBulkStatus("");
                        setBulkPriority("");
                        setBulkSeverityValue("");
                        setBulkModule("");
                        setBulkSuiteId("");
                        setBulkAssignee("");
                        setBulkCasePickerOpen(false);
                        setBulkCaseQuery("");
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
                  <option value="">Select import source</option>
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
                        <option value="">Select execution mode</option>
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
                      <option value="">Select step</option>
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
                      <option value="">Select step status</option>
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
                          setExecutionStepStatus("");
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
                        <option value="">Select evidence type</option>
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
                  <option value="">Select severity</option>
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
                          <option value="">Select severity</option>
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
                          <option value="">Select priority</option>
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
                      <option value="">Select target status</option>
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
                            setBugTransitionToStatus("");
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
                      <option value="">Select action</option>
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
                          setBugResolveAction("");
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
                              <strong>Comment:</strong> {isDeletedComment(item) ? "[Comment deleted]" : item.comment}
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
                <div className="adminUsersToolbar">
                  <button
                    className="button adminUsersPrimaryBtn"
                    disabled={testCasesLoading}
                    onClick={async () => {
                      try {
                        setTestCasesLoading(true);
                        await loadTestCaseData();
                        setTestCasesVisible(true);
                      } catch (error: any) {
                        alert(error?.message || "Load test cases failed");
                      } finally {
                        setTestCasesLoading(false);
                      }
                    }}
                  >
                    {testCasesLoading ? "Loading..." : "Test Cases"}
                  </button>
                  {testCasesVisible ? (
                    <button
                      className="button small"
                      disabled={testCasesLoading}
                      onClick={async () => {
                        try {
                          setTestCasesLoading(true);
                          await loadTestCaseData();
                        } catch (error: any) {
                          alert(error?.message || "Refresh test cases failed");
                        } finally {
                          setTestCasesLoading(false);
                        }
                      }}
                    >
                      Refresh
                    </button>
                  ) : null}
                </div>
              </div>
              {!testCasesVisible && (
                <div className="note">Click the Test Cases button to fetch and view the table.</div>
              )}
              {testCasesVisible && (
                <>
                  <div className="tableWrap adminUsersTableWrap">
                    <table className="table adminUsersTable">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Code</th>
                          <th>Module</th>
                          <th>Priority</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testCases.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="note">No test cases found.</td>
                          </tr>
                        ) : (
                          testCases.map((tc) => (
                            <tr
                              key={tc.id}
                              className="adminUsersRow"
                              tabIndex={0}
                              role="button"
                              aria-label={`Open test case ${tc.title}`}
                              onClick={() => setSelectedTestCaseModalId(tc.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedTestCaseModalId(tc.id);
                                }
                              }}
                            >
                              <td>{tc.title || "Untitled"}</td>
                              <td>{tc.testCaseCode || "N/A"}</td>
                              <td>{tc.module || "General"}</td>
                              <td>{tc.priority || "N/A"}</td>
                              <td>
                                <span className={`adminPill status-${String(tc.status || "inactive").toLowerCase()}`}>
                                  {tc.status || "N/A"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {selectedTestCaseModal && (
                <div
                  className="adminUserModalOverlay"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setSelectedTestCaseModalId("");
                  }}
                >
                  <div className="adminUserModal testCaseModal" role="dialog" aria-modal="true" aria-labelledby="testcase-modal-title">
                    <button
                      type="button"
                      className="adminUserModalClose"
                      aria-label="Close test case details"
                      onClick={() => setSelectedTestCaseModalId("")}
                    >
                      X
                    </button>
                    <h5 id="testcase-modal-title">Test Case Details</h5>
                    <div className="adminUserModalDetails">
                      <p><strong>Test Case ID:</strong> {selectedTestCaseModal.testCaseCode || "N/A"}</p>
                      <p><strong>Title:</strong> {selectedTestCaseModal.title || "N/A"}</p>
                      <p><strong>Description:</strong> {selectedTestCaseModal.description || "N/A"}</p>
                      <p><strong>Pre-conditions:</strong> {JSON.stringify(selectedTestCaseModal.preConditions ?? [])}</p>
                      <p><strong>Test Data Requirements:</strong> {JSON.stringify(selectedTestCaseModal.testDataRequirements ?? [])}</p>
                      <p><strong>Environment Requirements:</strong> {JSON.stringify(selectedTestCaseModal.environmentRequirements ?? [])}</p>
                      <p><strong>Module:</strong> {selectedTestCaseModal.module || "N/A"}</p>
                      <p><strong>Priority:</strong> {selectedTestCaseModal.priority || "N/A"}</p>
                      <p><strong>Severity:</strong> {selectedTestCaseModal.severity || "N/A"}</p>
                      <p><strong>Type:</strong> {selectedTestCaseModal.type || "N/A"}</p>
                      <p><strong>Status:</strong> {selectedTestCaseModal.status || "N/A"}</p>
                      <p><strong>Version:</strong> {selectedTestCaseModal.version ?? 1}</p>
                      <p><strong>Tags:</strong> {(selectedTestCaseModal.tags ?? []).join(", ") || "N/A"}</p>
                      <p><strong>Estimated Duration:</strong> {selectedTestCaseModal.estimatedDurationMinutes ?? "N/A"} min</p>
                      <p><strong>Automation Status:</strong> {selectedTestCaseModal.automationStatus || "N/A"}</p>
                      <p><strong>Automation Script:</strong> {selectedTestCaseModal.automationScriptLink || "N/A"}</p>
                      <p><strong>Steps:</strong> {typeof selectedTestCaseModal.steps === "string" ? selectedTestCaseModal.steps : JSON.stringify(selectedTestCaseModal.steps ?? [])}</p>
                      <p><strong>Post-conditions:</strong> {JSON.stringify(selectedTestCaseModal.postConditions ?? [])}</p>
                      <p><strong>Metadata:</strong> {JSON.stringify(selectedTestCaseModal.metadata ?? {})}</p>
                      <p><strong>Created By:</strong> {selectedTestCaseModal.creator?.name || selectedTestCaseModal.createdBy || "N/A"}</p>
                      <p><strong>Last Modified By:</strong> {selectedTestCaseModal.lastEditor?.name || selectedTestCaseModal.lastModifiedBy || "N/A"}</p>
                      <p><strong>Last Modified At:</strong> {selectedTestCaseModal.lastModifiedAt ? new Date(selectedTestCaseModal.lastModifiedAt).toLocaleString() : "N/A"}</p>
                      <p><strong>Created At:</strong> {selectedTestCaseModal.createdAt ? new Date(selectedTestCaseModal.createdAt).toLocaleString() : "N/A"}</p>
                    </div>
                    {canCreateAndManageTestCases && (
                      <div className="adminUserModalActions">
                        <button
                          className="button small adminActionEdit"
                          onClick={() => {
                            startEditCase(selectedTestCaseModal);
                            setSelectedTestCaseModalId("");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="button small"
                          onClick={async () => {
                            try {
                              await createTemplateApi({
                                name: `${selectedTestCaseModal.title} Template`,
                                category: "From Existing Test Cases",
                                sourceTestCaseId: selectedTestCaseModal.id,
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
                              await cloneTestCaseApi(selectedTestCaseModal.id, { includeAttachments });
                              await loadTestCaseData();
                            } catch (error: any) {
                              alert(error?.message || "Clone failed");
                            }
                          }}
                        >
                          Clone
                        </button>
                        <button
                          className="button small adminActionDelete"
                          onClick={async () => {
                            try {
                              if (!window.confirm("Confirm soft-delete for this test case?")) {
                                return;
                              }
                              await deleteTestCaseApi(selectedTestCaseModal.id);
                              setSelectedTestCaseModalId("");
                              await loadTestCaseData();
                            } catch (error: any) {
                              alert(error?.message || "Delete failed");
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {editingId && canCreateAndManageTestCases && (
                <div className="modalBackdrop">
                  <div className="modalCard">
                    <h4>Edit Test Case</h4>
                    <label className="fieldLabel" htmlFor="edit-title">Title</label>
                    <input id="edit-title" className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-description">Description</label>
                    <input id="edit-description" className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-steps">Steps (JSON or one step per line)</label>
                    <textarea id="edit-steps" className="input" rows={4} value={editStepsText} onChange={(e) => setEditStepsText(e.target.value)} />
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
                      <option value="">Select automation status</option>
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
                          <option value="">Select priority</option>
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                          <option value="CRITICAL">CRITICAL</option>
                        </select>
                      </div>
                      <div>
                        <label className="fieldLabel" htmlFor="edit-severity">Severity</label>
                        <select id="edit-severity" className="input" value={editSeverity} onChange={(e) => setEditSeverity(e.target.value)}>
                          <option value="">Select severity</option>
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
                          <option value="">Select type</option>
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
                          <option value="">Select status</option>
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
          </DashboardLayout>
        )}
      </div>
    </div>
  );
}

export default App;

