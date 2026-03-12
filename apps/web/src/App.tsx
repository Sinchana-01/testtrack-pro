import { useEffect, useRef, useState } from "react";
import {
  bulkTestCaseOperationApi,
  clearSessionTokens,
  cloneTestCaseApi,
  createBugApi,
  createBugCommentApi,
  createSuiteApi,
  createAdminUserApi,
  deleteAdminUserApi,
  deleteBugCommentApi,
  createFromTemplateApi,
  createTemplateApi,
  updateTemplateApi,
  createTestCaseApi,
  editBugCommentApi,
  deleteTemplateApi,
  deleteTestCaseApi,
  forgotPasswordApi,
  getBugApi,
  getRefreshToken,
  getMyRolePermissionsApi,
  listBugCommentsApi,
  listNotificationsApi,
  listBugsApi,
  listExecutionReportsApi,
  listDeveloperUsersApi,
  listAdminProjectsApi,
  listProjectsApi,
  listAdminBackupsApi,
  listAdminSystemConfigsApi,
  listAdminUsersApi,
  listAdminAuditLogsApi,
  listSuiteExecutionsApi,
  listSuitesApi,
  getTestCasesApi,
  googleLoginApi,
  importTestCasesApi,
  listTemplatesApi,
  listTestRunsApi,
  loginApi,
  logoutAllApi,
  openExecutionApi,
  refreshTokenApi,
  registerApi,
  resolveBugApi,
  resetPasswordApi,
  setSessionTokens,
  getActiveProjectId as getStoredActiveProjectId,
  setActiveProjectId as setStoredActiveProjectId,
  startExecutionApi,
  startSuiteExecutionApi,
  quickUpdateDeveloperBugStatusApi,
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
  markNotificationReadApi,
} from "./api";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";
import DashboardLayout from "./components/layout/DashboardLayout";
import TestRunManagementSection from "./features/test-runs/TestRunManagementSection";
import ExecuteTestsSection from "./features/execution/ExecuteTestsSection";
import SuiteManagementSection from "./features/suites/SuiteManagementSection";
import BugDetailsModal from "./features/bugs/BugDetailsModal";
import DeveloperWorkspacePanel from "./features/developer/DeveloperWorkspacePanel";
import ReportsHub from "./features/reports/ReportsHub";
import DashboardWidgetsBoard from "./features/dashboard/DashboardWidgetsBoard";
import ProjectManagementSection from "./features/projects/ProjectManagementSection";
import {
  getDeveloperAssignedExecutionReports,
  getDeveloperLinkedCommitBugs,
} from "./features/developer/developerWorkspace.utils";
import { buildNavFromPermissions, permissionCatalog } from "./config/roleNav";
import "./App.css";

const TT_INLINE_ALERT_EVENT = "tt-inline-alert";

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
  type: string;
  title: string;
  subtitle?: string;
  isRead: boolean;
  bugId?: string;
  senderEmail?: string;
};

function App() {
  const [inlineNotice, setInlineNotice] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
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
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim() || "";
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
  const [dashboardDataLoaded, setDashboardDataLoaded] = useState(false);
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
  const [suites, setSuites] = useState<any[]>([]);
  const [suiteName, setSuiteName] = useState("");
  const [suiteDescription, setSuiteDescription] = useState("");
  const [suiteCreateType, setSuiteCreateType] = useState<"STATIC" | "DYNAMIC">("STATIC");
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
  const [quickBugExpectedBehavior, setQuickBugExpectedBehavior] = useState("");
  const [quickBugActualBehavior, setQuickBugActualBehavior] = useState("");
  const [quickBugAssignedTo, setQuickBugAssignedTo] = useState("");
  const [bugs, setBugs] = useState<any[]>([]);
  const [myCreatedBugs, setMyCreatedBugs] = useState<any[]>([]);
  const [selectedBugId, setSelectedBugId] = useState("");
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [selectedBug, setSelectedBug] = useState<any>(null);
  const [bugComments, setBugComments] = useState<any[]>([]);
  const [bugCommentThreads, setBugCommentThreads] = useState<any[]>([]);
  const [bugFilterStatus, setBugFilterStatus] = useState("");
  const [bugFilterPriority, setBugFilterPriority] = useState("");
  const [bugFilterSeverity, setBugFilterSeverity] = useState("");
  const [bugSortBy, setBugSortBy] = useState("");
  const [bugViewMode, setBugViewMode] = useState<"all" | "mine" | "assigned">("all");
  const [bugSearch, setBugSearch] = useState("");
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
  const [showBugCreateForm, setShowBugCreateForm] = useState(false);
  const [developerDirectory, setDeveloperDirectory] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [bugAssignDeveloperId, setBugAssignDeveloperId] = useState("");
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
  const [bugActionNotice, setBugActionNotice] = useState<{ type: "info" | "error"; text: string } | null>(null);
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
  const [showAdminUsersListModal, setShowAdminUsersListModal] = useState(false);
  const adminUserModalRef = useRef<HTMLDivElement | null>(null);
  const bulkCasePickerRef = useRef<HTMLDivElement | null>(null);
  const formNoticeHostRef = useRef<HTMLElement | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const [adminProjects, setAdminProjects] = useState<any[]>([]);
  const [accessibleProjects, setAccessibleProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string>(getStoredActiveProjectId());
  const [adminProjectName, setAdminProjectName] = useState("");
  const [adminProjectCode, setAdminProjectCode] = useState("");
  const [adminProjectDescription, setAdminProjectDescription] = useState("");
  const [adminProjectSavingId, setAdminProjectSavingId] = useState("");
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [adminBackups, setAdminBackups] = useState<any[]>([]);
  const [adminSystemConfigs, setAdminSystemConfigs] = useState<any[]>([]);
  const [notificationItems, setNotificationItems] = useState<AppNotificationItem[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [auditEntityType, setAuditEntityType] = useState("");
  const [showAuditLogList, setShowAuditLogList] = useState(false);
  const [backupNotes, setBackupNotes] = useState("");
  const [backupTriggering, setBackupTriggering] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [selectedBackupJobId, setSelectedBackupJobId] = useState("");
  const [showTriggeredBackups, setShowTriggeredBackups] = useState(false);
  const [systemConfigKey, setSystemConfigKey] = useState("");
  const [systemConfigValue, setSystemConfigValue] = useState("");
  const [systemConfigSaving, setSystemConfigSaving] = useState(false);
  const [systemConfigLoading, setSystemConfigLoading] = useState(false);
  const [showSystemConfigList, setShowSystemConfigList] = useState(false);
  const [rolePermissionSaving, setRolePermissionSaving] = useState(false);
  const [showRolePermissionList, setShowRolePermissionList] = useState(false);
  const [editPermissionRole, setEditPermissionRole] = useState<"ADMIN" | "TESTER" | "DEVELOPER">("ADMIN");
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({
    ADMIN: [
      "Manage Users",
      "Manage Projects",
      "Manage Roles",
      "View Audit Logs",
      "Backup Management",
      "Reports",
    ],
    TESTER: [
      "Create Test Cases",
      "Execute Tests",
      "Bug Management",
      "Reports",
    ],
    DEVELOPER: [
      "Reports",
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
  const activeProject = accessibleProjects.find((item) => item.id === activeProjectId) || null;
  const activeProjectName = isAdmin && activeProjectId === "__ALL__" ? "All Projects" : activeProject?.name || "";
  const scopedProjectId = activeProjectId && activeProjectId !== "__ALL__" ? activeProjectId : "";
  const isActiveProjectArchived = Boolean((activeProject as any)?.isArchived);
  const isProjectScopeWritable = !(isAdmin && activeProjectId === "__ALL__") && !isActiveProjectArchived;
  const projectWriteBlockedMessage = isActiveProjectArchived
    ? "Current project is archived. Create or update actions are disabled."
    : "Select a specific active project to perform create or update actions.";
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
  const canAccessReports =
    hasPermission("Reports") ||
    hasPermission("Test Reports") ||
    hasPermission("Performance Report") ||
    hasPermission("Linked Commits");
  const canViewBugs =
    isTester ||
    isDeveloper ||
    isAdmin ||
    hasPermission("Bug Management") ||
    hasPermission("My Assigned Bugs") ||
    hasPermission("All Bugs");
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
    reports: "reports",
    my_assigned_bugs: "bug_management",
    all_bugs: "bug_management",
    test_reports: "reports",
    performance_report: "reports",
    linked_commits: "reports",
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
        title: "Dashboard",
        subtitle: ""
      };
    }
    const byKey: Record<string, { title: string; subtitle: string }> = {
      create_test_case: { title: "", subtitle: "" },
      templates: { title: "", subtitle: "" },
      bulk_operations: { title: "", subtitle: "" },
      import_test_cases: { title: "", subtitle: "" },
      suite_management: { title: "Test Suites", subtitle: "Organize suites and manage static or dynamic case collections." },
      test_runs: { title: "", subtitle: "" },
      execute_tests: { title: " ", subtitle: " " },
      bug_management: { title: "", subtitle: "" },
      test_cases: { title: "", subtitle: "" },
      reports: { title: "Reports", subtitle: "Review execution outcomes and defect quality indicators." },
      my_assigned_bugs: { title: "", subtitle: "" },
      all_bugs: { title: "", subtitle: "" },
      test_reports: { title: "Test Reports", subtitle: "Analyze run-level and case-level quality trends." },
      performance_report: { title: "Performance Report", subtitle: "Review test execution throughput and aging trends." },
      linked_commits: { title: "Linked Commits", subtitle: "Track fixes mapped to commits and retest cycles." },
      admin_workspace: { title: "Admin Workspace", subtitle: "Govern users, roles, projects, configuration, and audits." },
      user_management: { title: "", subtitle: "" },
      role_management: { title: "", subtitle: "" },
      project_management: { title: "Project Management", subtitle: "Manage projects and module ownership for quality planning." },
      system_configuration: { title: "", subtitle: "" },
      audit_logs: { title: "", subtitle: "" },
      backup_management: { title: "", subtitle: "" },
      developer_workspace: { title: "Developer Workspace", subtitle: "Resolve assigned defects with workflow and evidence updates." },
    };
    return byKey[activeMenuKey] || byKey[activeFeature] || byKey.bug_management;
  })();
  const projectContextLabel = currentPageMeta.title
    ? activeProjectName
      ? `${activeProjectName} > ${currentPageMeta.title}`
      : currentPageMeta.title
    : activeProjectName || "";
  const showCreateTestCase = canCreateAndManageTestCases && normalizedFeature === "create_test_case";
  const showTemplates = canUseTemplates && normalizedFeature === "templates";
  const showBulkOperations = canRunBulkOps && normalizedFeature === "bulk_operations";
  const showImport = canImportTestCases && normalizedFeature === "import_test_cases";
  const showTestRuns = canManageTestRuns && normalizedFeature === "test_runs";
  const showSuiteManagement = canManageSuites && normalizedFeature === "suite_management";
  const showExecute = canExecuteTests && normalizedFeature === "execute_tests";
  const showReports = normalizedFeature === "reports" || activeMenuKey === "reports";
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
  const showDeveloperWorkspacePanel = isDeveloper && normalizedFeature === "developer_workspace";
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
  const getBugAssigneeId = (item: any): string =>
    String(
      item?.assignedTo ||
        item?.assigneeId ||
        item?.assignee?.id ||
        item?.assignee?.userId ||
        ""
    ).trim();
  const getBugReporterId = (item: any): string =>
    String(item?.reportedBy || item?.reporterId || item?.reporter?.id || "").trim();
  const getBugPriority = (item: any): string => String(item?.priority || item?.bugPriority || "").trim();
  const getBugField = (item: any, key: string): string => {
    const directValue = item?.[key];
    if (typeof directValue === "string" && directValue.trim()) return directValue.trim();
    const metaValue = item?.bugMeta?.[key];
    if (typeof metaValue === "string" && metaValue.trim()) return metaValue.trim();
    return "";
  };
  const bugRowsForDisplay = bugs
    .filter((item) => {
      const reporterId = getBugReporterId(item);
      const assigneeId = getBugAssigneeId(item);
      if (bugViewMode === "mine") return !!currentUserId && reporterId === currentUserId;
      if (bugViewMode === "assigned") return !!currentUserId && assigneeId === currentUserId;
      return true;
    })
    .filter((item) => {
      const query = bugSearch.trim().toLowerCase();
      if (!query) return true;
      const searchableText = [
        item?.bugId,
        item?.id,
        item?.title,
        item?.description,
        item?.workflowStatus,
        item?.priority,
        item?.severity,
        item?.reporter?.name,
        item?.reporter?.email,
        item?.assignee?.name,
        item?.assignee?.email,
        item?.testCase?.testCaseCode,
        item?.testCase?.title,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return searchableText.includes(query);
    });
  const developerDashboardBugRows = bugs.filter((item) => {
    const assigneeId = getBugAssigneeId(item);
    return !!currentUserId && assigneeId === currentUserId;
  });
  const assignedBugCount = bugRowsForDisplay.length;
  const p1UrgentCount = bugRowsForDisplay.filter((item) => getBugPriority(item) === "P1_URGENT").length;
  const criticalBugCount = bugRowsForDisplay.filter((item) => item.severity === "CRITICAL").length;
  const developerAssignedBugCount = developerDashboardBugRows.length;
  const developerP1UrgentCount = developerDashboardBugRows.filter((item) => getBugPriority(item) === "P1_URGENT").length;
  const developerCriticalBugCount = developerDashboardBugRows.filter((item) => item.severity === "CRITICAL").length;
  const developerRecentBugs = [...developerDashboardBugRows]
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 6);
  const developerAssignedExecutionReports = getDeveloperAssignedExecutionReports(executionReports, currentUserId);
  const developerLinkedCommitBugs = getDeveloperLinkedCommitBugs(developerDashboardBugRows);
  const reportAssignedExecutionReports =
    roleName === "DEVELOPER" ? developerAssignedExecutionReports : executionReports;
  const reportLinkedCommitBugs =
    roleName === "DEVELOPER"
      ? developerLinkedCommitBugs
      : bugs.filter((item) => String(item?.commitLink || "").trim().length > 0);
  const failedExecutions = executionReports.filter((item) => item.result === "FAILED");
  const bugByExecutionId = new Map<string, any>(
    [...bugs, ...myCreatedBugs]
      .filter((item) => String(item?.executionId || "").trim().length > 0)
      .map((item) => [String(item.executionId), item])
  );
  const testerFailedExecutionQueue = failedExecutions
    .map((row) => {
      const executionId = String(row?.id || "");
      return {
        ...row,
        _executionId: executionId,
        _linkedBug: executionId ? bugByExecutionId.get(executionId) || null : null,
      };
    })
    .sort((a, b) => new Date(b?.executedAt || 0).getTime() - new Date(a?.executedAt || 0).getTime())
    .slice(0, 20);
  const testerPendingTests = testCases
    .filter((item) => item.status === "DRAFT" || item.status === "READY_FOR_REVIEW")
    .slice(0, 8);
  const recentFailures = failedExecutions.slice(0, 6);
  const testerVisibleBugRows = isTester ? bugRowsForDisplay : myCreatedBugs;
  const testerBugSelectionOptions = (testerVisibleBugRows.length > 0 ? testerVisibleBugRows : bugs)
    .filter((item, index, arr) => arr.findIndex((row) => String(row?.id || "") === String(item?.id || "")) === index)
    .sort((a, b) => {
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return bTime - aTime;
    });
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
  const developerBugTrendBuckets = (() => {
    const base = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      const key = d.toISOString().slice(0, 10);
      return { key, label: d.toLocaleDateString(undefined, { weekday: "short" }), count: 0 };
    });
    developerDashboardBugRows.forEach((item) => {
      const dateValue = item.updatedAt || item.createdAt;
      if (!dateValue) return;
      const key = new Date(dateValue).toISOString().slice(0, 10);
      const found = base.find((row) => row.key === key);
      if (found) found.count += 1;
    });
    return base;
  })();
  const developerBugMaxTrendCount = Math.max(...developerBugTrendBuckets.map((b) => b.count), 1);
  const bugStatusCounts = {
    NEW: bugRowsForDisplay.filter((b) => b.workflowStatus === "NEW").length,
    OPEN: bugRowsForDisplay.filter((b) => b.workflowStatus === "OPEN").length,
    IN_PROGRESS: bugRowsForDisplay.filter((b) => b.workflowStatus === "IN_PROGRESS").length,
    FIXED: bugRowsForDisplay.filter((b) => b.workflowStatus === "FIXED").length,
    VERIFIED: bugRowsForDisplay.filter((b) => b.workflowStatus === "VERIFIED").length,
    CLOSED: bugRowsForDisplay.filter((b) => b.workflowStatus === "CLOSED").length,
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
  const developerBugStatusCounts = {
    NEW: developerDashboardBugRows.filter((b) => b.workflowStatus === "NEW").length,
    OPEN: developerDashboardBugRows.filter((b) => b.workflowStatus === "OPEN").length,
    IN_PROGRESS: developerDashboardBugRows.filter((b) => b.workflowStatus === "IN_PROGRESS").length,
    FIXED: developerDashboardBugRows.filter((b) => b.workflowStatus === "FIXED").length,
    VERIFIED: developerDashboardBugRows.filter((b) => b.workflowStatus === "VERIFIED").length,
    CLOSED: developerDashboardBugRows.filter((b) => b.workflowStatus === "CLOSED").length,
  };
  const developerBugStatusTotal = Object.values(developerBugStatusCounts).reduce((acc, n) => acc + n, 0) || 1;
  const developerBugStatusPie = `conic-gradient(
    #2563eb 0deg ${(developerBugStatusCounts.NEW / developerBugStatusTotal) * 360}deg,
    #7c3aed ${(developerBugStatusCounts.NEW / developerBugStatusTotal) * 360}deg ${((developerBugStatusCounts.NEW + developerBugStatusCounts.OPEN) / developerBugStatusTotal) * 360}deg,
    #d97706 ${((developerBugStatusCounts.NEW + developerBugStatusCounts.OPEN) / developerBugStatusTotal) * 360}deg ${((developerBugStatusCounts.NEW + developerBugStatusCounts.OPEN + developerBugStatusCounts.IN_PROGRESS) / developerBugStatusTotal) * 360}deg,
    #16a34a ${((developerBugStatusCounts.NEW + developerBugStatusCounts.OPEN + developerBugStatusCounts.IN_PROGRESS) / developerBugStatusTotal) * 360}deg ${((developerBugStatusCounts.NEW + developerBugStatusCounts.OPEN + developerBugStatusCounts.IN_PROGRESS + developerBugStatusCounts.FIXED) / developerBugStatusTotal) * 360}deg,
    #0891b2 ${((developerBugStatusCounts.NEW + developerBugStatusCounts.OPEN + developerBugStatusCounts.IN_PROGRESS + developerBugStatusCounts.FIXED) / developerBugStatusTotal) * 360}deg ${((developerBugStatusCounts.NEW + developerBugStatusCounts.OPEN + developerBugStatusCounts.IN_PROGRESS + developerBugStatusCounts.FIXED + developerBugStatusCounts.VERIFIED) / developerBugStatusTotal) * 360}deg,
    #64748b ${((developerBugStatusCounts.NEW + developerBugStatusCounts.OPEN + developerBugStatusCounts.IN_PROGRESS + developerBugStatusCounts.FIXED + developerBugStatusCounts.VERIFIED) / developerBugStatusTotal) * 360}deg 360deg
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
      if (!scopedProjectId) {
        alert("Please select a specific project before import preview");
        return;
      }
      const fieldMapping = parseFieldMapping();
      const excelRows =
        importType === "EXCEL"
          ? (importExcelRows.length > 0 ? importExcelRows : JSON.parse(importPayload))
          : [];
      const payload =
        importType === "JSON"
          ? { sourceType: "JSON", items: JSON.parse(importPayload), fieldMapping, preview: true, projectId: scopedProjectId }
          : importType === "CSV"
          ? { sourceType: "CSV", csvText: importPayload, fieldMapping, preview: true, projectId: scopedProjectId }
          : { sourceType: "EXCEL", rows: excelRows, fieldMapping, preview: true, projectId: scopedProjectId };
      const res = await importTestCasesApi(payload);
      setImportPreview(Array.isArray(res?.preview) ? res.preview : []);
      setImportPreviewErrors(Array.isArray(res?.errors) ? res.errors : []);
      setPreviewReady(true);
    } catch (error: any) {
      alert(error?.message || "Preview failed");
    }
  };

  const handleImportFileChange = async (file?: File) => {
    if (!file) return;
    if (!importType) {
      alert("Please select import source type first");
      return;
    }
    try {
      const text = await file.text();
      if (importType === "JSON") {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          setImportPayload(JSON.stringify(parsed, null, 2));
        } else if (parsed && typeof parsed === "object") {
          setImportPayload(JSON.stringify(parsed, null, 2));
        } else {
          alert("JSON import file must contain an object or array.");
          return;
        }
        setImportExcelRows([]);
        setImportExcelFileName(file.name);
      } else if (importType === "CSV") {
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.length < 2) {
          alert("CSV import requires a header row and at least one data row.");
          return;
        }
        setImportPayload(text);
        setImportExcelRows([]);
        setImportExcelFileName(file.name);
      } else {
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
          alert("Unable to parse file. Use JSON array rows or CSV text for EXCEL import.");
          return;
        }
        setImportExcelRows(rows);
        setImportExcelFileName(file.name);
        setImportPayload(JSON.stringify(rows, null, 2));
      }
      setPreviewReady(false);
      setImportPreview([]);
      setImportPreviewErrors([]);
    } catch (error: any) {
      const context = importType || "import";
      alert(error?.message || `Failed to parse ${context} file`);
    }
  };

  const getImportFileAccept = (): string => {
    if (importType === "JSON") return ".json,application/json,text/json,.txt";
    if (importType === "CSV") return ".csv,text/csv,.txt";
    if (importType === "EXCEL") return ".csv,.json,.txt";
    return ".json,.csv,.txt";
  };

  const loadTestCaseData = async () => {
    setIsRefreshing(true);
    try {
      const shouldFetchTestCases =
        isAdmin ||
        canCreateAndManageTestCases ||
        canManageSuites ||
        canManageTestRuns ||
        canExecuteTests;
      const bugParams: Record<string, string> = {
        status: bugFilterStatus,
        priority: bugFilterPriority,
        severity: bugFilterSeverity,
        sortBy: bugSortBy,
      };
      if (bugViewMode === "mine") {
        bugParams.mine = "1";
      }
      if (isDeveloper && (activeMenuKey === "all_bugs" || bugViewMode === "all")) {
        bugParams.scope = "all";
      }
      const myBugParams: Record<string, string> = { mine: "1" };
      if (isDeveloper) {
        myBugParams.scope = "all";
      }
      const [
        caseRowsResult,
        templateRowsResult,
        runRowsResult,
        suiteRowsResult,
        executionRowsResult,
        bugRowsResult,
        myBugRowsResult,
      ] = await Promise.allSettled([
        shouldFetchTestCases ? getTestCasesApi() : Promise.resolve([]),
        canUseTemplates ? listTemplatesApi() : Promise.resolve([]),
        canManageTestRuns || canAccessReports ? listTestRunsApi() : Promise.resolve([]),
        canManageSuites
          ? listSuitesApi(showArchivedSuites ? { includeArchived: "true" } : undefined)
          : Promise.resolve([]),
        canExecuteTests || canAccessReports ? listExecutionReportsApi() : Promise.resolve([]),
        canViewBugs ? listBugsApi(bugParams) : Promise.resolve([]),
        canViewBugs ? listBugsApi(myBugParams) : Promise.resolve([]),
      ]);

      const caseRows = caseRowsResult.status === "fulfilled" ? caseRowsResult.value : null;
      const templateRows = templateRowsResult.status === "fulfilled" ? templateRowsResult.value : [];
      const runRows = runRowsResult.status === "fulfilled" ? runRowsResult.value : [];
      const suiteRows = suiteRowsResult.status === "fulfilled" ? suiteRowsResult.value : [];
      const executionRows = executionRowsResult.status === "fulfilled" ? executionRowsResult.value : [];
      const bugRows = bugRowsResult.status === "fulfilled" ? bugRowsResult.value : [];
      const mineBugRows = myBugRowsResult.status === "fulfilled" ? myBugRowsResult.value : [];

      const rows = Array.isArray(caseRows) ? caseRows : null;
      if (rows) {
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
      } else if (caseRowsResult.status === "rejected") {
        const msg =
          caseRowsResult.reason?.message || "Failed to refresh test cases. Showing last loaded list.";
        alert(msg);
      }
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
      setMyCreatedBugs(Array.isArray(mineBugRows) ? mineBugRows : []);
      setSelectedBug((prev: any) => {
        if (!prev?.id) return prev;
        const refreshedBug = bugList.find((item) => item.id === prev.id);
        if (!refreshedBug) return null;
        return {
          ...prev,
          ...refreshedBug,
          bugMeta: {
            ...(prev?.bugMeta || {}),
            ...(refreshedBug?.bugMeta || {}),
          },
          testCase: refreshedBug?.testCase || prev?.testCase || null,
          reporter: refreshedBug?.reporter || prev?.reporter || null,
          assignee: refreshedBug?.assignee || prev?.assignee || null,
        };
      });
      if (selectedBugId && !bugList.some((item) => item.id === selectedBugId)) {
        setSelectedBugId("");
      }
      setDashboardDataLoaded(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadBugDetails = async (bugId: string) => {
    if (!bugId) {
      setSelectedBug(null);
      setBugComments([]);
      setBugCommentThreads([]);
      setBugTransitionToStatus("");
      setBugTransitionReason("");
      setBugTransitionDuplicateOf("");
      return;
    }
    const bugScope =
      isDeveloper && (activeMenuKey === "all_bugs" || bugViewMode === "all") ? { scope: "all" } : undefined;
    const [bug, commentsPayload] = await Promise.all([getBugApi(bugId, bugScope), listBugCommentsApi(bugId)]);
    setSelectedBug(bug || null);
    const nextAssignedTo = String(bug?.assignedTo || bug?.assignee?.id || "").trim();
    setBugAssignDeveloperId(nextAssignedTo);
    setBugTransitionToStatus(String(bug?.workflowStatus || "OPEN").toUpperCase());
    setBugTransitionReason("");
    setBugTransitionDuplicateOf("");
    setBugComments(Array.isArray(commentsPayload?.comments) ? commentsPayload.comments : []);
    setBugCommentThreads(Array.isArray(commentsPayload?.threaded) ? commentsPayload.threaded : []);
  };

  const selectBugForInlineActions = async (bugId: string) => {
    if (!bugId) return;
    if (selectedBugId === bugId) return;
    setSelectedBugId(bugId);
    try {
      await loadBugDetails(bugId);
      setBugModalOpen(false);
    } catch (error: any) {
      setSelectedBugId("");
      showBugActionNotice(error?.message || "Failed to load bug details", "error");
    }
  };

  const refreshSelectedBugDetails = async () => {
    if (!selectedBug?.id) return;
    await loadBugDetails(selectedBug.id);
  };

  const applyBugTransition = async () => {
    if (!selectedBug?.id) return;
    const current = String(selectedBug.workflowStatus || "OPEN").toUpperCase();
    const target = String(bugTransitionToStatus || "OPEN").toUpperCase();
    const currentAssignedTo = String(selectedBug.assignedTo || selectedBug.assignee?.id || "").trim();
    const nextAssignedTo = String(bugAssignDeveloperId || "").trim();
    const assigneeChanged = nextAssignedTo !== currentAssignedTo;
    if (target === current && !assigneeChanged) {
      showBugActionNotice(`Bug is already in ${current} status`, "error");
      return;
    }
    if (isDeveloper) {
      await quickUpdateDeveloperBugStatusApi(selectedBug.id, bugTransitionToStatus);
    } else {
      await updateBugWorkflowApi(selectedBug.id, {
        toStatus: bugTransitionToStatus,
        reason: bugTransitionReason || undefined,
        duplicateOfBugCode: bugTransitionDuplicateOf || undefined,
        assignedTo: nextAssignedTo || null,
      });
    }
    setBugAssignDeveloperId("");
    setBugTransitionToStatus("");
    setBugTransitionReason("");
    setBugTransitionDuplicateOf("");
    showBugActionNotice(
      assigneeChanged && target === current ? "Bug assignee updated" : `Bug updated${assigneeChanged ? " and assigned" : ""}`
    );
    await loadTestCaseData();
    await loadBugDetails(selectedBug.id);
  };

  const saveBugAssignee = async () => {
    if (!selectedBug?.id) return;
    const currentStatus = String(selectedBug.workflowStatus || "OPEN").toUpperCase();
    const currentAssignedTo = String(selectedBug.assignedTo || selectedBug.assignee?.id || "").trim();
    const nextAssignedTo = String(bugAssignDeveloperId || "").trim();
    if (nextAssignedTo === currentAssignedTo) {
      showBugActionNotice("Assignee is unchanged", "error");
      return;
    }
    await updateBugWorkflowApi(selectedBug.id, {
      toStatus: currentStatus,
      assignedTo: nextAssignedTo || null,
    });
    setBugAssignDeveloperId("");
    showBugActionNotice(nextAssignedTo ? "Bug assignee updated" : "Bug unassigned");
    await loadTestCaseData();
    await loadBugDetails(selectedBug.id);
  };

  const applyBugResolution = async () => {
    if (!selectedBug?.id) return;
    await resolveBugApi(selectedBug.id, {
      action: bugResolveAction,
      fixNotes: bugResolveFixNotes || undefined,
      commitLink: bugResolveCommitLink || undefined,
      reason: bugTransitionReason || undefined,
    });
    setBugResolveAction("");
    setBugResolveFixNotes("");
    setBugResolveCommitLink("");
    showBugActionNotice("Bug resolution updated successfully");
    await loadTestCaseData();
    await loadBugDetails(selectedBug.id);
  };

  const createBugFromBugManagement = async () => {
    if (!scopedProjectId) {
      showBugActionNotice("Select a project before creating a bug", "error");
      return;
    }
    if (
      !bugCreateTitle.trim() ||
      !bugCreateDescription.trim() ||
      !bugCreateStepsToReproduce.trim() ||
      !bugCreateExpectedBehavior.trim() ||
      !bugCreateActualBehavior.trim()
    ) {
      showBugActionNotice(
        "Title, description, steps to reproduce, expected behavior, and actual behavior are required",
        "error"
      );
      return;
    }
    try {
      const attachments = bugCreateAttachmentsText.trim()
        ? parseBugAttachmentsInput(bugCreateAttachmentsText)
        : undefined;
      const created = await createBugApi({
        projectId: scopedProjectId,
        title: bugCreateTitle.trim(),
        description: bugCreateDescription.trim(),
        stepsToReproduce: bugCreateStepsToReproduce.trim(),
        expectedBehavior: bugCreateExpectedBehavior.trim(),
        actualBehavior: bugCreateActualBehavior.trim(),
        severity: bugCreateSeverity || "MEDIUM",
        priority: bugCreatePriority || "P3_MEDIUM",
        environment: bugCreateEnvironment.trim() || undefined,
        affectedVersion: bugCreateAffectedVersion.trim() || undefined,
        assignedTo: bugCreateAssignedTo || undefined,
        testCaseId: bugCreateTestCaseId || undefined,
        executionId: bugCreateExecutionId || undefined,
        dueDate: bugCreateDueDate || undefined,
        attachments,
      });
      resetBugCreateFields();
      setShowBugCreateForm(false);
      showBugActionNotice(`Bug created: ${created?.bugId || created?.id || "new bug"}`);
      await loadTestCaseData();
      if (created?.id) {
        setSelectedBugId(created.id);
        await loadBugDetails(created.id);
      }
    } catch (error: any) {
      showBugActionNotice(error?.message || "Bug creation failed", "error");
    }
  };

  const addBugComment = async () => {
    if (!selectedBug?.id) return;
    if (!bugCommentText.trim()) {
      showBugActionNotice("Comment text is required", "error");
      return;
    }
    await createBugCommentApi(selectedBug.id, {
      comment: bugCommentText,
      parentCommentId: bugCommentParentId || undefined,
    });
    setBugCommentText("");
    setBugCommentParentId("");
    showBugActionNotice("Comment added");
    await loadBugDetails(selectedBug.id);
  };

  const loadAdminUsers = async () => {
    const rows = await listAdminUsersApi();
    setAdminUsers(Array.isArray(rows) ? rows : []);
  };

  const loadDeveloperDirectory = async () => {
    const rows = await listDeveloperUsersApi();
    const normalized = Array.isArray(rows)
      ? rows
          .map((row: any) => ({
            id: String(row?.id || ""),
            name: String(row?.name || "").trim(),
            email: String(row?.email || "").trim(),
          }))
          .filter((row) => row.id && row.email)
      : [];
    setDeveloperDirectory(normalized);
    setBugCreateAssignedTo((prev) => (prev && normalized.some((row) => row.id === prev) ? prev : ""));
  };

  const loadAdminProjects = async () => {
    const rows = await listAdminProjectsApi();
    setAdminProjects(Array.isArray(rows) ? rows : []);
  };

  const applyProjectContext = (projectId: string, availableProjects: any[], adminMode: boolean) => {
    const normalized = String(projectId || "").trim();
    let nextId = normalized;
    if (adminMode) {
      if (!nextId) nextId = "__ALL__";
      if (nextId !== "__ALL__" && !availableProjects.some((row: any) => row.id === nextId)) {
        nextId = "__ALL__";
      }
    } else {
      if (!availableProjects.some((row: any) => row.id === nextId)) {
        nextId = availableProjects[0]?.id || "";
      }
    }
    setActiveProjectIdState(nextId);
    setStoredActiveProjectId(nextId);
  };

  const loadAccessibleProjects = async (adminMode = isAdmin) => {
    const rows = await listProjectsApi({ includeArchived: false });
    const normalized = Array.isArray(rows)
      ? rows
          .map((row: any) => ({
            id: String(row?.id || ""),
            name: String(row?.name || "").trim() || "Unnamed Project",
            isArchived:
              String(row?.status || "").toUpperCase() === "ARCHIVED" ||
              Boolean(row?.isActive === false),
          }))
          .filter((row) => row.id)
      : [];
    setAccessibleProjects(normalized);
    const stored = getStoredActiveProjectId();
    applyProjectContext(activeProjectId || stored, normalized, adminMode);
  };

  const loadAdminAuditLogs = async (entityType?: string) => {
    const rows = await listAdminAuditLogsApi(entityType || undefined);
    setAdminAuditLogs(Array.isArray(rows) ? rows : []);
  };

  const loadAdminSystemConfigs = async () => {
    setSystemConfigLoading(true);
    try {
      const rows = await listAdminSystemConfigsApi();
      setAdminSystemConfigs(Array.isArray(rows) ? rows : []);
    } finally {
      setSystemConfigLoading(false);
    }
  };

  const loadAdminBackups = async () => {
    setBackupLoading(true);
    try {
      const rows = await listAdminBackupsApi();
      setAdminBackups(Array.isArray(rows) ? rows : []);
    } finally {
      setBackupLoading(false);
    }
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

  const showAppNotice = (text: string, type: "info" | "error" | "success" = "info") => {
    setInlineNotice({ type, text });
  };

  const showBugActionNotice = (text: string, type: "info" | "error" = "info") => {
    setBugActionNotice({ type, text });
    window.setTimeout(() => {
      setBugActionNotice((prev) => (prev?.text === text ? null : prev));
    }, 3500);
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
          title: `${row?.bugCode || "BUG"} â€¢ ${workflow} â€¢ ${priority}`,
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

    try {
      const payload = await listNotificationsApi({ unread: "0", take: 30 });
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.notifications)
          ? payload.notifications
          : [];
      const items: AppNotificationItem[] = rows.map((row: any) => {
        const message = String(row?.message || "Notification");
        const senderMatch = message.match(/(?:by|from)\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
        const senderEmail = String(row?.senderEmail || "").trim().toLowerCase();
        return {
          id: String(row?.id || `notif:${Math.random()}`),
          type: String(row?.type || "GENERAL"),
          title: message,
          subtitle:
            String(row?.entityType || "").trim() && String(row?.entityId || "").trim()
              ? `${row.entityType} • ${row.entityId}`
              : String(row?.issueTitle || row?.commentPreview || "").trim(),
          isRead: Boolean(row?.isRead),
          bugId:
            String(row?.entityType || "").toUpperCase() === "ISSUE"
              ? String(row?.entityId || "")
              : String(row?.issueId || ""),
          senderEmail: senderEmail || senderMatch?.[1]?.toLowerCase() || "",
        };
      });
      setNotificationItems(items);
      setNotificationUnreadCount(Number(payload?.unreadCount || items.filter((item) => !item.isRead).length));
    } catch {
      setNotificationItems([]);
      setNotificationUnreadCount(0);
    }
  };

  const handleNotificationClick = async (id: string) => {
    const selected = notificationItems.find((item) => item.id === id);
    if (!selected) return;

    if (!selected.isRead) {
      try {
        await markNotificationReadApi(selected.id);
      } catch {
        showAppNotice("Notification opened, but failed to mark it as read", "error");
      }
      setNotificationItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
      setNotificationUnreadCount((prev) => Math.max(0, prev - 1));
    }

    if (selected.bugId) {
      setSelectedBugId(selected.bugId);
      const targetMenuKey = isDeveloper ? "my_assigned_bugs" : "bug_management";
      handleDashboardNavSelect(targetMenuKey).then(() => {
        showAppNotice("Notification opened", "success");
      }).catch(() => {
        showAppNotice("Failed to open the linked bug from notification", "error");
      });
    }
  };

  const handleNotificationReply = async (id: string, message: string) => {
    const selected = notificationItems.find((item) => item.id === id);
    if (!selected) {
      throw new Error("Notification not found");
    }
    const comment = String(message || "").trim();
    if (!comment) {
      throw new Error("Reply message is required");
    }
    if (!selected.bugId) {
      throw new Error("Reply is not available for this notification");
    }

    await createBugCommentApi(selected.bugId, { comment });

    if (!selected.isRead) {
      try {
        await markNotificationReadApi(selected.id);
      } catch {
        // Ignore read-status failure on successful reply.
      }
      setNotificationItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
      setNotificationUnreadCount((prev) => Math.max(0, prev - 1));
    }

    showAppNotice("Reply sent successfully", "success");
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
    setMyCreatedBugs([]);
    setSelectedBugId("");
    setBugModalOpen(false);
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
    setShowBugCreateForm(false);
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
    setBugActionNotice(null);
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
    setSuiteName("");
    setSuiteDescription("");
    setSuiteCreateType("STATIC");
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

  const resetQuickBugFields = () => {
    setSelectedExecutionReportId("");
    setQuickBugTitle("");
    setQuickBugDescription("");
    setQuickBugSeverity("");
    setQuickBugExpectedBehavior("");
    setQuickBugActualBehavior("");
    setQuickBugAssignedTo("");
  };

  const resetBugCreateFields = () => {
    setShowBugCreateForm(false);
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

  const prefillBugFromFailedExecution = (row: any) => {
    const executionId = String(row?.id || "");
    const tcCode = String(row?.testCase?.testCaseCode || "");
    const tcTitle = String(row?.testCase?.title || "Failed test case");
    setBugCreateTitle(`Execution failed: ${tcCode || executionId}`);
    setBugCreateDescription(`Auto-prefilled from failed execution for ${tcTitle}.`);
    setBugCreateStepsToReproduce("Re-run the linked test case steps and observe failure.");
    setBugCreateExpectedBehavior("Execution should pass without errors.");
    setBugCreateActualBehavior(`Execution result was FAILED${executionId ? ` (Execution: ${executionId})` : ""}.`);
    setBugCreateSeverity((prev) => prev || "HIGH");
    setBugCreatePriority((prev) => prev || "P2_HIGH");
    setBugCreateTestCaseId(String(row?.testCaseId || ""));
    setBugCreateExecutionId(executionId);
    setShowBugCreateForm(true);
    showBugActionNotice("Bug form prefilled from failed execution.");
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

  const renderFormattedComment = (text: string): JSX.Element[] => {
    const lines = String(text || "").split(/\r?\n/);
    const renderInline = (input: string, keyPrefix: string): React.ReactNode[] => {
      const nodes: React.ReactNode[] = [];
      const pattern = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let tokenIndex = 0;
      while ((match = pattern.exec(input)) !== null) {
        if (match.index > lastIndex) {
          nodes.push(input.slice(lastIndex, match.index));
        }
        const token = match[0];
        if (token.startsWith("**") && token.endsWith("**")) {
          nodes.push(<strong key={`${keyPrefix}-b-${tokenIndex}`}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith("_") && token.endsWith("_")) {
          nodes.push(<em key={`${keyPrefix}-i-${tokenIndex}`}>{token.slice(1, -1)}</em>);
        } else if (token.startsWith("`") && token.endsWith("`")) {
          nodes.push(<code key={`${keyPrefix}-c-${tokenIndex}`}>{token.slice(1, -1)}</code>);
        } else {
          nodes.push(token);
        }
        lastIndex = match.index + token.length;
        tokenIndex += 1;
      }
      if (lastIndex < input.length) {
        nodes.push(input.slice(lastIndex));
      }
      return nodes;
    };

    return lines.flatMap((line, lineIndex) => {
      const content = renderInline(line, `line-${lineIndex}`);
      return lineIndex < lines.length - 1 ? [...content, <br key={`br-${lineIndex}`} />] : content;
    }) as JSX.Element[];
  };

  const renderCommentThreads = (items: any[], depth = 0): JSX.Element[] =>
    items.map((item) => (
      <div
        key={item.id}
        className={`bugCommentItem ${isDeletedComment(item) ? "isDeleted" : ""}`}
        style={{ marginLeft: depth > 0 ? `${Math.min(depth * 18, 54)}px` : "0" }}
      >
        <div className="bugCommentBody">
          {isDeletedComment(item) ? "[Comment deleted]" : renderFormattedComment(item.comment || "")}
          {Array.isArray(item.mentions) && item.mentions.length > 0 ? (
            <div className="bugCommentMentions">
              Mentioned: {item.mentions.map((m: string) => `@${m}`).join(", ")}
            </div>
          ) : null}
        </div>
        <div className="bugCommentFooter">
          <span className="bugCommentMeta">
            {item.author?.name || item.authorId} | {new Date(item.createdAt).toLocaleString()}
          </span>
          <div className="bugCommentActions">
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
                  showBugActionNotice("Comment deleted");
                } catch (error: any) {
                  showBugActionNotice(error?.message || "Delete comment failed", "error");
                }
              }}
              disabled={!canModifyComment(item) || isDeletedComment(item)}
            >
              Delete
            </button>
          </div>
        </div>
        {Array.isArray(item.replies) && item.replies.length > 0 ? renderCommentThreads(item.replies, depth + 1) : null}
      </div>
    ));

  const startEditCase = (tc: any) => {
    const status = String(tc?.status || "").toUpperCase();
    if (status === "ARCHIVED") {
      alert("Access denied. Archived test cases cannot be modified or executed.");
      return;
    }
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
    if (msg.includes("Delete child suites first before deleting parent suite")) {
      return "Delete or detach all child suites first, then delete the parent suite.";
    }
    if (msg.includes("linked records")) {
      return "Suite has dependent linked records. Remove dependencies first, then try deleting again.";
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
    if (!GOOGLE_CLIENT_ID) return;
    const existing = document.getElementById("google-identity-services");
    if (existing) return;
    const script = document.createElement("script");
    script.id = "google-identity-services";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [GOOGLE_CLIENT_ID]);

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
      setDashboardDataLoaded(false);
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
      setBugCommentThreads([]);
      setSelectedBugId("");
      setBugModalOpen(false);
    });
  }, [selectedBugId, screen]);

  useEffect(() => {
    if (screen !== "dashboard" || !isDeveloper) return;
    if (activeMenuKey === "all_bugs") {
      if (bugViewMode !== "all") setBugViewMode("all");
      return;
    }
    if (bugViewMode !== "assigned") {
      setBugViewMode("assigned");
    }
  }, [screen, isDeveloper, activeMenuKey, bugViewMode]);

  useEffect(() => {
    if (screen !== "dashboard" || !showBugs) return;
    if (!isDeveloper) return;
    if (activeMenuKey === "all_bugs" && bugViewMode !== "all") {
      setBugViewMode("all");
      return;
    }
    if (activeMenuKey === "my_assigned_bugs" && bugViewMode !== "assigned") {
      setBugViewMode("assigned");
      return;
    }
    if (activeMenuKey === "bug_management" && bugViewMode === "all") {
      // Keep bug management focused for developers.
      setBugViewMode("assigned");
    }
  }, [screen, showBugs, isDeveloper, isTester, bugViewMode, activeMenuKey]);

  useEffect(() => {
    if (!selectedBugId) return;
    if (!bugRowsForDisplay.some((item) => item.id === selectedBugId)) {
      setSelectedBugId("");
      setSelectedBug(null);
      setBugComments([]);
      setBugCommentThreads([]);
      setBugModalOpen(false);
    }
  }, [selectedBugId, bugRowsForDisplay]);

  useEffect(() => {
    if (showTestCases && !testCasesVisible) {
      setTestCasesVisible(true);
    }
  }, [showTestCases, testCasesVisible]);

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
    if (screen !== "dashboard") return;
    loadAccessibleProjects().catch(() => {
      setAccessibleProjects([]);
      const fallback = isAdmin ? "__ALL__" : "";
      setActiveProjectIdState(fallback);
      setStoredActiveProjectId(fallback);
    });
  }, [screen, currentUserId, currentRole]);

  useEffect(() => {
    if (screen !== "dashboard") return;
    loadTestCaseData().catch(() => {
      // no-op
    });
  }, [activeProjectId, screen]);

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
      if (activeMenuKey === "backup_management" && hasPermission("Backup Management")) {
        loadAdminBackups().catch(() => {
          setAdminBackups([]);
        });
      }
    }
    if (activeMenuKey === "system_configuration") {
      loadAdminSystemConfigs().catch(() => {
        setAdminSystemConfigs([]);
      });
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
  const applyAuthLoginSuccess = async (
    res: {
      accessToken: string;
      refreshToken: string;
      user?: { role?: string; id?: string; name?: string; email?: string };
    },
    persistedRememberMe: boolean
  ) => {
    setSessionTokens(res.accessToken, res.refreshToken, persistedRememberMe);
    setName(res?.user?.name || "");
    setEmail(res?.user?.email || "");
    setCurrentRole(res?.user?.role || "");
    setCurrentUserId(res?.user?.id || "");
    setDashboardDataLoaded(false);
    setAccessibleProjects([]);
    setActiveProjectIdState("");
    setStoredActiveProjectId("");
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
      await loadAccessibleProjects(String(res?.user?.role || "").toUpperCase() === "ADMIN");
      await loadTestCaseData();
    } catch (error: any) {
      alert(error?.message || "Failed to load test data");
    }
  };

  const handleLogin = async () => {
    setAuthError("");
    try {
      setAuthSubmitting(true);
      const res = await loginApi(email, password, rememberMe);

      if (res.accessToken && res.refreshToken) {
        await applyAuthLoginSuccess(res, rememberMe);
      } else {
        setAuthError(res.message || "Invalid email or password");
      }
    } catch (error: any) {
      setAuthError(error?.message || "Login failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const getGoogleAccessToken = async (): Promise<string> => {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error("Google login is not configured. Set REACT_APP_GOOGLE_CLIENT_ID.");
    }
    const googleApi = (window as any).google;
    if (!googleApi?.accounts?.oauth2?.initTokenClient) {
      throw new Error("Google Identity Services is not loaded yet. Please retry.");
    }

    return new Promise<string>((resolve, reject) => {
      const tokenClient = googleApi.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        callback: (response: any) => {
          if (response?.access_token) {
            resolve(String(response.access_token));
          } else {
            reject(new Error("Google login failed to return access token."));
          }
        },
        error_callback: () => {
          reject(new Error("Google popup failed or was closed."));
        },
      });
      tokenClient.requestAccessToken({ prompt: "select_account" });
    });
  };

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      setAuthSubmitting(true);
      const accessToken = await getGoogleAccessToken();
      const res = await googleLoginApi(accessToken, rememberMe);
      if (res?.accessToken && res?.refreshToken) {
        await applyAuthLoginSuccess(res, rememberMe);
      } else {
        setAuthError(res?.message || "Google login failed.");
      }
    } catch (error: any) {
      setAuthError(error?.message || "Google login failed.");
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
    setDashboardDataLoaded(false);
    setAccessibleProjects([]);
    setActiveProjectIdState("");
    setStoredActiveProjectId("");
    setDeveloperDirectory([]);
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
        mappedFeature === "reports" ||
        mappedFeature === "bug_management" ||
        mappedFeature === "test_cases" ||
        mappedFeature === "developer_workspace" ||
        mappedFeature === "test_reports" ||
        mappedFeature === "performance_report" ||
        mappedFeature === "linked_commits"
      ) {
        await loadTestCaseData();
      }
      if (mappedFeature === "bug_management" && canCreateBugs) {
        await loadDeveloperDirectory();
      }

      if (isAdmin && mappedFeature === "admin_workspace") {
        if (menuKey === "user_management" || menuKey === "role_management") {
          await loadAdminUsers();
        } else if (menuKey === "audit_logs") {
          await loadAdminAuditLogs(auditEntityType || undefined);
        } else if (menuKey === "backup_management") {
          await loadAdminAuditLogs("BackupJob");
          await loadAdminBackups();
        } else if (menuKey === "system_configuration") {
          await loadAdminSystemConfigs();
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
      showAppNotice("Failed to open the selected dashboard feature", "error");
    }
  };

  const handleProjectSwitch = (projectId: string) => {
    const selected =
      projectId === "__ALL__"
        ? { name: "All Projects" }
        : accessibleProjects.find((item) => String(item.id) === String(projectId));
    applyProjectContext(projectId, accessibleProjects, isAdmin);
    setInlineNotice({
      type: "info",
      text: selected ? `Project switched: ${selected.name}` : "Project switched",
    });
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

  const saveRolePermissions = async () => {
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
  };

  const requestInlineConfirm = (message: string): Promise<boolean> =>
    new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({ open: true, message });
    });

  const resolveInlineConfirm = (value: boolean) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmDialog({ open: false, message: "" });
    if (resolver) resolver(value);
  };

  useEffect(() => {
    const originalAlert = window.alert.bind(window);
    const originalGlobalAlert = globalThis.alert;
    const hostSelector =
      "form, .panel, .modalCard, .authCenterCard, .authPanel, .adminCreateUserPanel, .backupAuthLikeCard, .reportInsightCard";
    const resolveNoticeHost = (node?: Element | null) =>
      ((node?.closest(hostSelector) as HTMLElement | null) || null);
    const updateNoticeHostFromEvent = (event: Event) => {
      const target = event.target as Element | null;
      const host = resolveNoticeHost(target);
      if (host) formNoticeHostRef.current = host;
    };

    document.addEventListener("focusin", updateNoticeHostFromEvent, true);
    document.addEventListener("pointerdown", updateNoticeHostFromEvent, true);

    const showFormScopedNotice = (text: string, type: "info" | "error" | "success") => {
      const active = document.activeElement as HTMLElement | null;
      const host = resolveNoticeHost(active) || formNoticeHostRef.current;
      if (!host) return false;

      let notice = host.querySelector(".formInlineNotice") as HTMLDivElement | null;
      if (!notice) {
        notice = document.createElement("div");
        notice.className = "formInlineNotice";
        host.insertBefore(notice, host.firstChild);
      }
      notice.textContent = text;
      notice.classList.toggle("formInlineNoticeError", type === "error");
      notice.classList.toggle("formInlineNoticeInfo", type === "info");
      notice.classList.toggle("formInlineNoticeSuccess", type === "success");

      const prevTimer = notice.dataset.timeoutId ? Number(notice.dataset.timeoutId) : null;
      if (prevTimer) window.clearTimeout(prevTimer);
      const timeoutId = window.setTimeout(() => {
        if (notice && notice.parentElement) notice.remove();
      }, 5000);
      notice.dataset.timeoutId = String(timeoutId);
      return true;
    };

    const patchedAlert = (message?: any) => {
      const text =
        typeof message === "string" ? message : message == null ? "Done" : JSON.stringify(message);
      window.dispatchEvent(new CustomEvent(TT_INLINE_ALERT_EVENT, { detail: text }));
    };

    const handleInlineAlert = (event: Event) => {
      const custom = event as CustomEvent<string>;
      const text = typeof custom.detail === "string" ? custom.detail : "Done";
      const normalized = text.toLowerCase();
      const isErrorLike =
        normalized.includes("error") ||
        normalized.includes("failed") ||
        normalized.includes("denied") ||
        normalized.includes("required") ||
        normalized.includes("invalid");
      const isSuccessLike =
        normalized.includes("success") ||
        normalized.includes("successful") ||
        normalized.includes("created") ||
        normalized.includes("updated") ||
        normalized.includes("saved") ||
        normalized.includes("deleted") ||
        normalized.includes("loaded") ||
        normalized.includes("refreshed") ||
        normalized.includes("completed") ||
        normalized.includes("linked") ||
        normalized.includes("requested") ||
        normalized.includes("opened") ||
        normalized.includes("switched") ||
        normalized.includes("triggered") ||
        normalized.includes("added") ||
        normalized.includes("removed") ||
        normalized.includes("activated") ||
        normalized.includes("deactivated") ||
        normalized.includes("finalized") ||
        normalized.includes("import complete") ||
        normalized.includes("export");
      const type: "info" | "error" | "success" = isErrorLike ? "error" : isSuccessLike ? "success" : "info";
      showFormScopedNotice(text, type);
      setInlineNotice({ type, text });
    };
    window.addEventListener(TT_INLINE_ALERT_EVENT, handleInlineAlert as EventListener);
    window.alert = patchedAlert;
    globalThis.alert = patchedAlert;

    return () => {
      document.removeEventListener("focusin", updateNoticeHostFromEvent, true);
      document.removeEventListener("pointerdown", updateNoticeHostFromEvent, true);
      window.removeEventListener(TT_INLINE_ALERT_EVENT, handleInlineAlert as EventListener);
      window.alert = originalAlert;
      globalThis.alert = originalGlobalAlert;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!inlineNotice) return;
    const timeout = window.setTimeout(() => setInlineNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [inlineNotice]);

  return (
    <div className={`container ${screen === "dashboard" ? "dashboardMode" : "authMode"}`}>
      <div className={`card ${screen === "dashboard" ? "cardDashboard" : "cardAuth"}`}>
        {screen !== "dashboard" && <h2 className="brandTitle">TestTrack Pro</h2>}
        {screen !== "dashboard" && (
          <p className="authTagline">Quality engineering workspace for testers, developers, and admins.</p>
        )}
        {inlineNotice ? (
          <div className={`inlineNotice inlineNotice-${inlineNotice.type}`}>
            <span>{inlineNotice.text}</span>
            <button type="button" onClick={() => setInlineNotice(null)} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}

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
            onGoogleLogin={handleGoogleLogin}
            googleEnabled={Boolean(GOOGLE_CLIENT_ID)}
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
            currentUserEmail={email || ""}
            currentRole={currentRole || "USER"}
            notificationCount={notificationUnreadCount}
            notificationItems={notificationItems.map((item) => ({
              id: item.id,
              title: item.title,
              subtitle: item.subtitle,
              isRead: item.isRead,
              bugId: item.bugId,
              type: item.type,
              senderEmail: item.senderEmail,
            }))}
            onNotificationClick={handleNotificationClick}
            onNotificationReply={handleNotificationReply}
            navItems={roleNavItems}
            activeKey={activeMenuKey}
            onSelect={(feature) => {
              handleDashboardNavSelect(feature);
            }}
            onBack={
              activeMenuKey !== "dashboard_home"
                ? () => {
                    handleDashboardNavSelect("dashboard_home");
                  }
                : undefined
            }
            onLogout={handleLogout}
            onLogoutAll={async () => {
              const res = await logoutAllApi();
              alert(res.message || "Logged out from all devices");
              clearSessionTokens();
              setScreen("login");
            }}
            pageTitle={currentPageMeta.title}
            pageSubtitle={currentPageMeta.subtitle}
            projectContextLabel={projectContextLabel}
            projectOptions={accessibleProjects}
            activeProjectId={activeProjectId}
            onProjectChange={handleProjectSwitch}
            allowAllProjectsOption={isAdmin}
          >
            {activeFeature === "none" && (
              <>
                <DashboardWidgetsBoard
                  roleName={roleName}
                  testCases={testCases}
                  executionReports={executionReports}
                  bugs={bugs}
                  adminUsers={adminUsers}
                  adminProjects={adminProjects}
                  adminAuditLogs={adminAuditLogs}
                  currentUserId={currentUserId}
                  dataLoading={!dashboardDataLoaded || isRefreshing}
                  onNavigate={handleDashboardNavSelect}
                />

              </>
            )}
            <div className="dashboardGrid">
              {showDeveloperWorkspacePanel && (
                <DeveloperWorkspacePanel
                  mode="workspace"
                  dataLoading={!dashboardDataLoaded || isRefreshing}
                  assignedBugCount={developerAssignedBugCount}
                  inProgressCount={developerBugStatusCounts.IN_PROGRESS}
                  needsVerificationCount={developerBugStatusCounts.FIXED}
                  assignedBugs={developerDashboardBugRows}
                  assignedExecutionReports={developerAssignedExecutionReports}
                  linkedCommitBugs={developerLinkedCommitBugs}
                  onOpenAssignedBugs={() => handleDashboardNavSelect("my_assigned_bugs")}
                  onOpenTestReports={() => handleDashboardNavSelect("test_reports")}
                  onOpenExecuteTests={() => handleDashboardNavSelect("execute_tests")}
                />
              )}

              {isAdmin && showRolePanel && activeFeature === "admin_workspace" && (
                <section className="panel rolePanel rolePanelAdmin">
                  {activeMenuKey === "user_management" && (
                    <div className="auditCenterWrap">
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
                              setShowAdminUsersListModal(true);
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
                        {showAdminUsersListModal ? (
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

                      {!showAdminUsersListModal ? (
                        <p className="note">Click the Users button to open the user list.</p>
                      ) : null}

                      {showAdminUsersListModal ? (
                        <div className="modalBackdrop">
                          <div className="modalCard backupListModalCard">
                            <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <strong>Users List</strong>
                              <button className="button small" aria-label="Close users list modal" onClick={() => setShowAdminUsersListModal(false)}>
                                X
                              </button>
                            </div>
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
                          </div>
                        </div>
                      ) : null}

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
                                      const confirmed = await requestInlineConfirm(
                                        `${actionLabel} ${adminUserModalUser.email}?`
                                      );
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
                                      const firstConfirm = await requestInlineConfirm(
                                        `Delete ${adminUserModalUser.email}? This is irreversible.`
                                      );
                                      if (!firstConfirm) return;
                                      const finalConfirm = await requestInlineConfirm(
                                        "Final confirmation: permanently delete this user?"
                                      );
                                      if (!finalConfirm) return;
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
                    </div>
                  )}

                  {activeMenuKey === "role_management" && (
                    <div className="auditCenterWrap">
                      <div className="backupManagementCenter">
                        <div className="backupActionCard backupAuthLikeCard auditCompactCard">
                          <h4 style={{ marginBottom: 0 }}>Role Management</h4>
                          <p className="note" style={{ marginBottom: 0 }}>Customize user roles and role permissions.</p>
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
                          <button className="button small showActionBtnBlack" onClick={() => setShowRolePermissionList(true)}>
                            Show Permission List
                          </button>
                        </div>
                      </div>
                      {showRolePermissionList ? (
                        <div className="modalBackdrop">
                          <div className="modalCard backupListModalCard">
                            <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <strong>Role Permissions - {editPermissionRole}</strong>
                              <button className="button small" aria-label="Close role permissions modal" onClick={() => setShowRolePermissionList(false)}>
                                X
                              </button>
                            </div>
                            <div className="listCompact" style={{ marginTop: 12 }}>
                              {permissionCatalog.map((permission) => (
                                <label key={permission} className="row backupTriggerItem" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={(rolePermissions[editPermissionRole] || []).includes(permission)}
                                    onChange={() => toggleRolePermission(editPermissionRole, permission)}
                                  />
                                  <span>{permission}</span>
                                </label>
                              ))}
                            </div>
                            <div className="centerActionRow" style={{ marginTop: 10 }}>
                              <button className="button small" disabled={rolePermissionSaving} onClick={saveRolePermissions}>
                                {rolePermissionSaving ? "Saving..." : "Save Permissions"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {activeMenuKey === "project_management" && (
                    <>
                     
                      <div className="projectManagementCenterWrap" style={{ marginTop: 16 }}>
                        <ProjectManagementSection isAdmin={isAdmin} onRefreshData={loadTestCaseData} />
                      </div>
                    </>
                  )}

                  {activeMenuKey === "system_configuration" && (
                    <div className="auditCenterWrap">
                      <div className="backupManagementCenter">
                        <div className="backupActionCard backupAuthLikeCard auditCompactCard">
                          <h4 style={{ marginBottom: 0 }}>System Configuration</h4>
                          <p className="note" style={{ marginBottom: 0 }}>Configure system-wide key/value settings used by platform workflows.</p>
                          <div className="inlineGrid">
                            <input
                              className="input"
                              placeholder="Configuration Key (e.g., ROLE_PERMISSIONS)"
                              value={systemConfigKey}
                              onChange={(e) => setSystemConfigKey(e.target.value)}
                            />
                            <input
                              className="input"
                              placeholder="Configuration Value"
                              value={systemConfigValue}
                              onChange={(e) => setSystemConfigValue(e.target.value)}
                            />
                          </div>
                          <div className="inlineGrid" style={{ marginTop: "8px" }}>
                            <button
                              className="button"
                              disabled={systemConfigSaving}
                              onClick={async () => {
                                try {
                                  if (!systemConfigKey.trim()) {
                                    alert("Configuration key is required");
                                    return;
                                  }
                                  if (!systemConfigValue.trim()) {
                                    alert("Configuration value is required");
                                    return;
                                  }
                                  setSystemConfigSaving(true);
                                  await upsertAdminSystemConfigApi({
                                    key: systemConfigKey.trim(),
                                    value: systemConfigValue.trim(),
                                  });
                                  setSystemConfigKey("");
                                  setSystemConfigValue("");
                                  await loadAdminSystemConfigs();
                                  alert("System configuration saved");
                                } catch (error: any) {
                                  alert(error?.message || "Failed to save system configuration");
                                } finally {
                                  setSystemConfigSaving(false);
                                }
                              }}
                            >
                              {systemConfigSaving ? "Saving..." : "Save Configuration"}
                            </button>
                            <button
                              className="button"
                              onClick={() => {
                                loadAdminSystemConfigs().catch(() => {
                                  setAdminSystemConfigs([]);
                                });
                              }}
                            >
                              Refresh Configs
                            </button>
                          </div>
                          <div className="centerActionRow" style={{ marginTop: "8px" }}>
                            <button className="button small centerActionBtn showActionBtnBlack" onClick={() => setShowSystemConfigList(true)}>
                              Show Config List
                            </button>
                          </div>
                        </div>
                      </div>
                      {showSystemConfigList ? (
                        <div className="modalBackdrop">
                          <div className="modalCard backupListModalCard">
                            <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <strong>System Configuration List</strong>
                              <button className="button small" aria-label="Close system configuration modal" onClick={() => setShowSystemConfigList(false)}>
                                X
                              </button>
                            </div>
                            <div className="listCompact">
                              {systemConfigLoading ? (
                                <p className="note">Loading system configurations...</p>
                              ) : adminSystemConfigs.length === 0 ? (
                                <p className="note">No system configurations found.</p>
                              ) : (
                                adminSystemConfigs.map((config: any) => {
                                  const rawValue = String(config.value || "");
                                  let summary = rawValue;
                                  try {
                                    const parsed = JSON.parse(rawValue);
                                    if (Array.isArray(parsed)) {
                                      summary = `${parsed.length} item${parsed.length === 1 ? "" : "s"} configured`;
                                    } else if (parsed && typeof parsed === "object") {
                                      summary = `${Object.keys(parsed).length} setting${Object.keys(parsed).length === 1 ? "" : "s"} configured`;
                                    }
                                  } catch {
                                    summary = rawValue;
                                  }
                                  if (summary.length > 90) {
                                    summary = `${summary.slice(0, 90)}...`;
                                  }
                                  return (
                                    <button
                                      key={config.id}
                                      type="button"
                                      className="row backupTriggerItem systemConfigItemCard"
                                      onClick={() => {
                                        setSystemConfigKey(String(config.key || ""));
                                        setSystemConfigValue(String(config.value || ""));
                                        setShowSystemConfigList(false);
                                      }}
                                    >
                                      <strong>{config.key}</strong>
                                      <div className="note">{summary || "No summary available"}</div>
                                      <div className="note">
                                        Updated: {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "N/A"}
                                      </div>
                                      <div className="note">
                                        By: {config.updater?.name || config.updater?.email || config.updatedBy || "Unknown"}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {activeMenuKey === "audit_logs" && (
                    <div className="auditCenterWrap">
                      <div className="backupManagementCenter">
                        <div className="backupActionCard backupAuthLikeCard auditCompactCard">
                          <h4 style={{ marginBottom: 0 }}>Audit Logs</h4>
                          <p className="note" style={{ marginBottom: 0 }}>View complete system audit trail.</p>
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
                          <button
                            className="button small showActionBtnBlack"
                            onClick={async () => {
                              try {
                                await loadAdminAuditLogs(auditEntityType || undefined);
                                setShowAuditLogList(true);
                              } catch (error: any) {
                                alert(error?.message || "Failed to load audit logs");
                              }
                            }}
                          >
                            Show Audit Logs
                          </button>
                        </div>
                      </div>
                      {showAuditLogList ? (
                        <div className="modalBackdrop">
                          <div className="modalCard backupListModalCard">
                            <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <strong>Audit Logs</strong>
                              <button className="button small" aria-label="Close audit logs modal" onClick={() => setShowAuditLogList(false)}>
                                X
                              </button>
                            </div>
                            <div className="listCompact">
                              {adminAuditLogs.length === 0 ? (
                                <p className="note">No audit logs found.</p>
                              ) : (
                                adminAuditLogs.map((log: any) => (
                                  <div className="backupTriggerItem auditLogItemCard" key={log.id}>
                                    <div className="auditLogItemTop">
                                      <strong>{log.action || "ACTION"}</strong>
                                      <span className="statusPill">{log.entityType || "Entity"}</span>
                                    </div>
                                    <div className="auditLogItemMetaGrid">
                                      <div>
                                        <span className="note">Entity ID</span>
                                        <strong>{log.entityId || "-"}</strong>
                                      </div>
                                      <div>
                                        <span className="note">Actor</span>
                                        <strong>{log.actor?.name || log.actor?.email || "Unknown"}</strong>
                                      </div>
                                      <div>
                                        <span className="note">Created</span>
                                        <strong>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}</strong>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {activeMenuKey === "backup_management" && (
                    <div className="auditCenterWrap">
                      <div className="backupManagementCenter">
                        <div className="backupActionCard backupAuthLikeCard auditCompactCard">
                          <h4 style={{ marginBottom: 0 }}>Backup Management</h4>
                          <p className="note" style={{ marginBottom: 0 }}>Trigger and monitor backup-related activity.</p>
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
                                await loadAdminBackups();
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
                          <button
                            className="button small showActionBtnBlack"
                            onClick={() => setShowTriggeredBackups(true)}
                          >
                            Show Triggered Backups
                          </button>
                        </div>
                      </div>
                      {showTriggeredBackups ? (
                        <div className="modalBackdrop">
                          <div className="modalCard backupListModalCard">
                            <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <strong>Triggered Backups</strong>
                              <button className="button small" aria-label="Close triggered backups modal" onClick={() => setShowTriggeredBackups(false)}>
                                X
                              </button>
                            </div>
                            <div className="listCompact">
                              {backupLoading ? (
                                <p className="note">Loading backup jobs...</p>
                              ) : adminBackups.length === 0 ? (
                                <p className="note">No backup jobs found.</p>
                              ) : (
                                adminBackups.map((job: any) => (
                                    <div
                                      className={`backupTriggerItem backupJobItemCard ${selectedBackupJobId === String(job.id) ? "active" : ""}`}
                                      key={job.id}
                                      onClick={() => setSelectedBackupJobId(String(job.id))}
                                    >
                                      <div className="auditLogItemTop">
                                        <strong>{job.status || "PENDING"}</strong>
                                        <span className="statusPill">{job.id ? String(job.id).slice(0, 8) : "JOB"}</span>
                                      </div>
                                      <div className="auditLogItemMetaGrid">
                                        <div>
                                          <span className="note">Started</span>
                                          <strong>{job.startedAt ? new Date(job.startedAt).toLocaleString() : "N/A"}</strong>
                                        </div>
                                        <div>
                                          <span className="note">Completed</span>
                                          <strong>{job.completedAt ? new Date(job.completedAt).toLocaleString() : "N/A"}</strong>
                                        </div>
                                        <div>
                                          <span className="note">Triggered By</span>
                                          <strong>{job.triggerUser?.name || job.triggerUser?.email || job.triggeredBy || "Unknown"}</strong>
                                        </div>
                                      </div>
                                      <div className="auditLogItemNotes">
                                        <span className="note">Notes</span>
                                        <strong>{job.notes || "-"}</strong>
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              )}

              {showCreateTestCase && (
              <section className="panel createCasePanel testerCompactPanel">
                <div className="compactFormHeader">
                  <h4>Create Test Case</h4>
                  <div className="note">Design structured test cases with complete metadata.</div>
                </div>
                {!isProjectScopeWritable ? <div className="note">{projectWriteBlockedMessage}</div> : null}
                <label className="fieldLabel">Project Context (auto-filled)</label>
                <input
                  className="input"
                  value={scopedProjectId ? `${activeProjectName || "Selected Project"} (${scopedProjectId})` : "No active project selected"}
                  readOnly
                  disabled
                />
                <label className="fieldLabel">Title</label>
                <input className="input" placeholder="Title" value={tcTitle} onChange={(e) => setTcTitle(e.target.value)} disabled={!isProjectScopeWritable} />
                <label className="fieldLabel">Description</label>
                <input className="input" placeholder="Description" value={tcDescription} onChange={(e) => setTcDescription(e.target.value)} disabled={!isProjectScopeWritable} />
                <label className="fieldLabel">Module/Feature</label>
                <select className="input" value={tcModule} onChange={(e) => setTcModule(e.target.value)} disabled={!isProjectScopeWritable}>
                  <option value="">Select module</option>
                  <option value="Authentication">Authentication</option>
                  <option value="User Management">User Management</option>
                  <option value="Reporting">Reporting</option>
                  <option value="General">General</option>
                </select>
                <label className="fieldLabel">Test Steps</label>
                <textarea className="input" placeholder="Steps JSON or one step per line" rows={4} value={tcStepsText} onChange={(e) => setTcStepsText(e.target.value)} disabled={!isProjectScopeWritable} />
                <label className="fieldLabel">Classification</label>
                <div className="inlineGrid">
                  <select className="input" value={tcPriority} onChange={(e) => setTcPriority(e.target.value)} disabled={!isProjectScopeWritable}>
                    <option value="">Select priority</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <select className="input" value={tcSeverity} onChange={(e) => setTcSeverity(e.target.value)} disabled={!isProjectScopeWritable}>
                    <option value="">Select severity</option>
                    <option value="BLOCKER">BLOCKER</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="MINOR">MINOR</option>
                    <option value="TRIVIAL">TRIVIAL</option>
                  </select>
                </div>
                <div className="inlineGrid">
                  <select className="input" value={tcType} onChange={(e) => setTcType(e.target.value)} disabled={!isProjectScopeWritable}>
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
                  <select className="input" value={tcStatus} onChange={(e) => setTcStatus(e.target.value)} disabled={!isProjectScopeWritable}>
                    <option value="">Select status</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="DEPRECATED">DEPRECATED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
                <button
                  className="button small compactButton"
                  disabled={!isProjectScopeWritable}
                  onClick={async () => {
                    try {
                      if (!scopedProjectId) {
                        alert("Please select a specific project before creating a test case");
                        return;
                      }
                      if (tcTitle.length > 200) {
                        alert("Title must be 200 characters or less");
                        return;
                      }
                      await createTestCaseApi({
                        title: tcTitle,
                        description: tcDescription,
                        preConditions: [],
                        testDataRequirements: [],
                        environmentRequirements: [],
                        module: tcModule,
                        steps: parseSteps(tcStepsText),
                        postConditions: [],
                        metadata: {},
                        tags: [],
                        estimatedDurationMinutes: null,
                        automationStatus: "",
                        automationScriptLink: null,
                        priority: tcPriority || "MEDIUM",
                        severity: tcSeverity || "MAJOR",
                        type: tcType || "FUNCTIONAL",
                        status: tcStatus || "DRAFT",
                        projectId: scopedProjectId,
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
              <section className="panel formWidePanel testerCompactPanel">
                <div className="compactFormHeader">
                  <h4>Templates</h4>
                  <div className="note">Standardize test case creation using reusable templates.</div>
                </div>
                {!isProjectScopeWritable ? <div className="note">{projectWriteBlockedMessage}</div> : null}
                <input className="input" placeholder="Template Name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} disabled={!isProjectScopeWritable} />
                <input className="input" placeholder="Template Category (e.g., Login Tests)" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} disabled={!isProjectScopeWritable} />
                <textarea className="input" placeholder="Template steps JSON or lines" rows={3} value={templateSteps} onChange={(e) => setTemplateSteps(e.target.value)} disabled={!isProjectScopeWritable} />
                <button
                  className="button small compactButton sectionCta"
                  disabled={!isProjectScopeWritable}
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
                    className="button small compactButton adminUsersPrimaryBtn"
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
                          <p><strong>Created By:</strong> {selectedTemplateModal.creator?.name || selectedTemplateModal.creator?.email || selectedTemplateModal.createdBy || "N/A"}</p>
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
                                  if (!(await requestInlineConfirm("Delete this template?"))) return;
                                  await deleteTemplateApi(selectedTemplateModal.id);
                                  await loadTestCaseData();
                                  alert("Template deleted");
                                  setSelectedTemplateModalId("");
                                  setTemplateModalEditing(false);
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
              <section className="panel formWidePanel testerCompactPanel">
                <div className="compactFormHeader">
                  <h4>Bulk Operations</h4>
                  <div className="note">Apply controlled updates across multiple test cases.</div>
                </div>
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
                    <span>{bulkCasePickerOpen ? "â–²" : "â–¼"}</span>
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
                  className="button small compactButton sectionCta"
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
                        if (!(await requestInlineConfirm("Confirm bulk soft-delete for selected test cases?"))) {
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
              <section className="panel testerCompactPanel">
                <div className="compactFormHeader">
                  <h4>Import Test Cases</h4>
                  <div className="note">Import structured test cases from JSON, CSV, or Excel.</div>
                </div>
                <label className="fieldLabel">Project Context (auto-filled)</label>
                <input
                  className="input"
                  value={scopedProjectId ? `${activeProjectName || "Selected Project"} (${scopedProjectId})` : "No active project selected"}
                  readOnly
                  disabled
                />
                <select className="input" value={importType} onChange={(e) => setImportType(e.target.value)}>
                  <option value="">Select import source</option>
                  <option value="JSON">JSON</option>
                  <option value="CSV">CSV</option>
                  <option value="EXCEL">EXCEL</option>
                </select>
                {importType && (
                  <>
                    <input
                      className="input"
                      type="file"
                      accept={getImportFileAccept()}
                      onChange={(e) => handleImportFileChange(e.target.files?.[0])}
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
                <button className="button small compactButton" onClick={buildImportPreview}>
                  Preview Import
                </button>
                <button
                  className="button small compactButton"
                  onClick={async () => {
                    try {
                      if (!scopedProjectId) {
                        alert("Please select a specific project before import");
                        return;
                      }
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
                          ? { sourceType: "JSON", items: JSON.parse(importPayload), fieldMapping, confirm: true, projectId: scopedProjectId }
                          : importType === "CSV"
                          ? { sourceType: "CSV", csvText: importPayload, fieldMapping, confirm: true, projectId: scopedProjectId }
                          : { sourceType: "EXCEL", rows: excelRows, fieldMapping, confirm: true, projectId: scopedProjectId };
                      const res = await importTestCasesApi(payload);
                      await loadTestCaseData();
                      const latestCases = await getTestCasesApi();
                      const latestCaseRows = Array.isArray(latestCases) ? latestCases : [];
                      setTestCases(latestCaseRows);
                      setActiveFeature("test_cases");
                      setActiveMenuKey("test_cases");
                      setTestCasesVisible(true);
                      resetImportFields();
                      if (Number(res?.success || 0) > 0) {
                        const createdIds = Array.isArray(res?.createdIds) ? res.createdIds.map((id: any) => String(id)) : [];
                        const visibleCreated = createdIds.filter((id: string) =>
                          latestCaseRows.some((tc: any) => String(tc?.id || "") === id)
                        ).length;
                        alert(`Import complete: ${res.success}/${res.total}. Visible now: ${visibleCreated}/${createdIds.length}`);
                      } else {
                        alert(`Import complete: 0/${res.total}. Check preview errors and required fields.`);
                      }
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
                <div className="testerListHost">
                  <TestRunManagementSection
                    selectedIds={selectedIds}
                    testRuns={testRuns}
                    testCases={testCases}
                    onRefreshData={loadTestCaseData}
                    onOpenRunExecution={async (run) => {
                      const runId = String(run?.id || "").trim();
                      if (!runId) {
                        throw new Error("Run id is missing");
                      }
                      const runCases = Array.isArray(run?.testCases) ? run.testCases : [];
                      const pendingCase =
                        runCases.find((item: any) => String(item?.status || "").toUpperCase() === "NOT_RUN") ||
                        runCases[0] ||
                        null;
                      const testCaseId = String(
                        pendingCase?.testCaseId || pendingCase?.testCase?.id || ""
                      ).trim();
                      setActiveMenuKey("execute_tests");
                      setActiveFeature("execute_tests");
                      setExecutionRunId(runId);
                      if (!testCaseId) {
                        return;
                      }
                      setExecutionCaseId(testCaseId);
                      await openExecutionSession(testCaseId, runId);
                    }}
                  />
                </div>
              )}

              {showSuiteManagement && (
                <SuiteManagementSection
                  suites={suites}
                  testCases={testCases}
                  testRuns={testRuns}
                  activeProjectId={scopedProjectId}
                  activeProjectName={activeProjectName}
                  showArchivedSuites={showArchivedSuites}
                  setShowArchivedSuites={setShowArchivedSuites}
                  onRefreshData={loadTestCaseData}
                  getSuiteFriendlyError={getSuiteFriendlyError}
                />
              )}
              {showExecute && (
                <ExecuteTestsSection
                  executionCaseId={executionCaseId}
                  setExecutionCaseId={setExecutionCaseId}
                  executionSelectableCases={executionSelectableCases}
                  executionRunId={executionRunId}
                  setExecutionRunId={setExecutionRunId}
                  testRuns={testRuns}
                  setActiveSuiteExecutionContext={setActiveSuiteExecutionContext}
                  openExecutionSession={openExecutionSession}
                  executionId={executionId}
                  executionSteps={executionSteps}
                  executionProgress={executionProgress}
                  executionStartedAt={executionStartedAt}
                  setExecutionStartedAt={setExecutionStartedAt}
                  executionCompletedAt={executionCompletedAt}
                  setExecutionCompletedAt={setExecutionCompletedAt}
                  executionDurationSeconds={executionDurationSeconds}
                  setExecutionDurationSeconds={setExecutionDurationSeconds}
                  executionSelectedStepNumber={executionSelectedStepNumber}
                  setExecutionSelectedStepNumber={setExecutionSelectedStepNumber}
                  executionStepStatus={executionStepStatus}
                  setExecutionStepStatus={setExecutionStepStatus}
                  executionActualResult={executionActualResult}
                  setExecutionActualResult={setExecutionActualResult}
                  executionStepNotes={executionStepNotes}
                  setExecutionStepNotes={setExecutionStepNotes}
                  executionNotes={executionNotes}
                  setExecutionNotes={setExecutionNotes}
                  setExecutionSteps={setExecutionSteps}
                  setExecutionProgress={setExecutionProgress}
                  loadTestCaseData={loadTestCaseData}
                  activeSuiteExecutionContext={activeSuiteExecutionContext}
                  setSuiteExecutionDetails={setSuiteExecutionDetails}
                  openSuiteExecutionCase={openSuiteExecutionCase}
                  setSelectedExecutionReportId={setSelectedExecutionReportId}
                  setExecutionEvidence={setExecutionEvidence}
                  executionEvidence={executionEvidence}
                  evidenceType={evidenceType}
                  setEvidenceType={setEvidenceType}
                  evidenceName={evidenceName}
                  setEvidenceName={setEvidenceName}
                  evidenceUrl={evidenceUrl}
                  setEvidenceUrl={setEvidenceUrl}
                  evidenceNotes={evidenceNotes}
                  setEvidenceNotes={setEvidenceNotes}
                  executionReports={executionReports}
                  selectedExecutionReportId={selectedExecutionReportId}
                  setSelectedExecutionReportIdState={setSelectedExecutionReportId}
                  quickBugTitle={quickBugTitle}
                  setQuickBugTitle={setQuickBugTitle}
                  quickBugDescription={quickBugDescription}
                  setQuickBugDescription={setQuickBugDescription}
                  quickBugSeverity={quickBugSeverity}
                  setQuickBugSeverity={setQuickBugSeverity}
                  quickBugExpectedBehavior={quickBugExpectedBehavior}
                  setQuickBugExpectedBehavior={setQuickBugExpectedBehavior}
                  quickBugActualBehavior={quickBugActualBehavior}
                  setQuickBugActualBehavior={setQuickBugActualBehavior}
                  quickBugAssignedTo={quickBugAssignedTo}
                  setQuickBugAssignedTo={setQuickBugAssignedTo}
                  developerDirectory={developerDirectory}
                  resetQuickBugFields={resetQuickBugFields}
                  setExecutionId={setExecutionId}
                  onQuickBugCreated={async (issue) => {
                    setActiveMenuKey("bug_management");
                    setActiveFeature("bug_management");
                    setBugViewMode("all");
                    setSelectedBugId(issue.id);
                    await loadTestCaseData();
                    await loadBugDetails(issue.id);
                  }}
                />
              )}
              {showReports && (
                <ReportsHub
                  roleName={roleName}
                  rolePermissions={currentRolePermissions}
                  testRuns={testRuns}
                  executionReports={executionReports}
                  bugs={bugs}
                  assignedExecutionReports={reportAssignedExecutionReports}
                  linkedCommitBugs={reportLinkedCommitBugs}
                  onRefreshData={loadTestCaseData}
                  onOpenExecuteTests={async (execution) => {
                    const testCaseId = String(execution?.testCaseId || "").trim();
                    const testRunId = String(execution?.testRunId || "").trim();
                    setActiveMenuKey("execute_tests");
                    setActiveFeature("execute_tests");
                    if (!testCaseId) {
                      return;
                    }
                    await openExecutionSession(testCaseId, testRunId || undefined);
                  }}
                />
              )}

              {showBugs && (
              <section className="panel">
                <h4>{isDeveloper ? "Assigned Bugs" : "Bug Management (4.4)"}</h4>
                {bugActionNotice ? (
                  <div className={`inlineNotice inlineNotice-${bugActionNotice.type}`} style={{ marginBottom: "10px" }}>
                    <span>{bugActionNotice.text}</span>
                    <button type="button" onClick={() => setBugActionNotice(null)} aria-label="Dismiss message">
                      ×
                    </button>
                  </div>
                ) : null}
                {isTester && (
                  <>
                    <div className="row" style={{ justifyContent: "flex-end", alignItems: "center", width: "100%", marginBottom: "10px" }}>
                      <button
                        className="button small"
                        onClick={() => {
                          if (showBugCreateForm) {
                            setShowBugCreateForm(false);
                            resetBugCreateFields();
                            return;
                          }
                          setShowBugCreateForm(true);
                        }}
                      >
                        {showBugCreateForm ? "Hide Form" : "Add New Bug"}
                      </button>
                    </div>
                    {showBugCreateForm && (
                      <div className="panel" style={{ marginBottom: "10px" }}>
                        <div className="note" style={{ marginBottom: "8px" }}>
                          Create a tester bug directly in the current project scope.
                        </div>
                        <input
                          className="input"
                          value={scopedProjectId ? `${activeProjectName || "Selected Project"} (${scopedProjectId})` : "No active project selected"}
                          readOnly
                          disabled
                        />
                        <div className="inlineGrid">
                          <input
                            className="input"
                            placeholder="Bug title"
                            value={bugCreateTitle}
                            onChange={(e) => setBugCreateTitle(e.target.value)}
                          />
                          <select
                            className="input"
                            value={bugCreateAssignedTo}
                            onChange={(e) => setBugCreateAssignedTo(e.target.value)}
                          >
                            <option value="">Assign developer (optional)</option>
                            {developerDirectory.map((dev) => (
                              <option key={dev.id} value={dev.id}>
                                {dev.name || dev.email} {dev.email ? `(${dev.email})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="Bug description"
                          value={bugCreateDescription}
                          onChange={(e) => setBugCreateDescription(e.target.value)}
                        />
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="Steps to reproduce"
                          value={bugCreateStepsToReproduce}
                          onChange={(e) => setBugCreateStepsToReproduce(e.target.value)}
                        />
                        <div className="inlineGrid">
                          <textarea
                            className="input"
                            rows={2}
                            placeholder="Expected behavior"
                            value={bugCreateExpectedBehavior}
                            onChange={(e) => setBugCreateExpectedBehavior(e.target.value)}
                          />
                          <textarea
                            className="input"
                            rows={2}
                            placeholder="Actual behavior"
                            value={bugCreateActualBehavior}
                            onChange={(e) => setBugCreateActualBehavior(e.target.value)}
                          />
                        </div>
                        <div className="inlineGrid">
                          <select
                            className="input"
                            value={bugCreateSeverity}
                            onChange={(e) => setBugCreateSeverity(e.target.value)}
                          >
                            <option value="">Severity (default MEDIUM)</option>
                            <option value="LOW">LOW</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="HIGH">HIGH</option>
                            <option value="CRITICAL">CRITICAL</option>
                          </select>
                          <select
                            className="input"
                            value={bugCreatePriority}
                            onChange={(e) => setBugCreatePriority(e.target.value)}
                          >
                            <option value="">Priority (default P3_MEDIUM)</option>
                            <option value="P1_URGENT">P1_URGENT</option>
                            <option value="P2_HIGH">P2_HIGH</option>
                            <option value="P3_MEDIUM">P3_MEDIUM</option>
                            <option value="P4_LOW">P4_LOW</option>
                          </select>
                        </div>
                        <div className="inlineGrid">
                          <select
                            className="input"
                            value={bugCreateTestCaseId}
                            onChange={(e) => setBugCreateTestCaseId(e.target.value)}
                          >
                            <option value="">Linked test case (optional)</option>
                            {testCases.map((tc) => (
                              <option key={tc.id} value={tc.id}>
                                {tc.testCaseCode || tc.id} | {tc.title || "Untitled Test Case"}
                              </option>
                            ))}
                          </select>
                          <select
                            className="input"
                            value={bugCreateExecutionId}
                            onChange={(e) => setBugCreateExecutionId(e.target.value)}
                          >
                            <option value="">Linked execution (optional)</option>
                            {executionReports.map((report) => (
                              <option key={report.id} value={report.id}>
                                {report.testCase?.testCaseCode || report.testCaseId || report.id} | {report.result || "N/A"}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="inlineGrid">
                          <input
                            className="input"
                            placeholder="Environment (optional)"
                            value={bugCreateEnvironment}
                            onChange={(e) => setBugCreateEnvironment(e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Affected version (optional)"
                            value={bugCreateAffectedVersion}
                            onChange={(e) => setBugCreateAffectedVersion(e.target.value)}
                          />
                        </div>
                        <div className="inlineGrid">
                          <input
                            className="input"
                            type="date"
                            value={bugCreateDueDate}
                            onChange={(e) => setBugCreateDueDate(e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Optional attachments JSON"
                            value={bugCreateAttachmentsText}
                            onChange={(e) => setBugCreateAttachmentsText(e.target.value)}
                          />
                        </div>
                        {testerFailedExecutionQueue.length > 0 && (
                          <div className="toolbarActions" style={{ marginBottom: "8px" }}>
                            {testerFailedExecutionQueue.slice(0, 3).map((row) => (
                              <button
                                key={row._executionId}
                                className="button small"
                                onClick={() => prefillBugFromFailedExecution(row)}
                              >
                                Prefill {row.testCase?.testCaseCode || row._executionId}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="toolbarActions">
                          <button className="button small" onClick={createBugFromBugManagement}>
                            Create Bug
                          </button>
                          <button
                            className="button small danger"
                            onClick={() => {
                              resetBugCreateFields();
                              setShowBugCreateForm(false);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  {!showBugCreateForm ? (
                    <div className="panel" style={{ marginBottom: "10px" }}>
                      <div style={{ marginBottom: "10px" }}>
                        <select
                          className="input"
                          value={bugViewMode}
                          onChange={(e) => setBugViewMode(e.target.value as "all" | "mine" | "assigned")}
                        >
                          <option value="all">All Bugs In Project</option>
                          <option value="mine">My Created Bugs</option>
                        </select>
                      </div>
                      <h5 style={{ marginTop: 0, marginBottom: "8px" }}>Select Bug Report</h5>
                      <div className="inlineGrid">
                      <select
                          className="input"
                          value={selectedBugId}
                          onChange={async (e) => {
                            const nextBugId = e.target.value;
                            if (!nextBugId) {
                              setSelectedBugId("");
                              setSelectedBug(null);
                              setBugComments([]);
                              setBugCommentThreads([]);
                              return;
                            }
                            await selectBugForInlineActions(nextBugId);
                            setBugModalOpen(true);
                          }}
                        >
                          <option value="">Choose bug report</option>
                          {testerBugSelectionOptions.map((item) => (
                            <option key={`tester-select-${item.id}`} value={item.id}>
                              {(item.bugId || item.id)} | {item.title || "Untitled Bug"} | {item.workflowStatus || "OPEN"}
                            </option>
                          ))}
                        </select>
                        <button
                          className="button small"
                          onClick={async () => {
                            await loadTestCaseData();
                            showBugActionNotice("Bug reports refreshed");
                          }}
                        >
                          Refresh
                        </button>
                      </div>
                      {testerBugSelectionOptions.length === 0 ? (
                        <div className="note" style={{ marginTop: "8px" }}>
                          No bug reports available in current project scope.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  </>
                )}
                <div className="testCaseDetails" style={{ marginBottom: "10px" }}>
                  </div>
                {isTester && !showBugCreateForm ? (
                <div className="tableWrap adminUsersTableWrap" style={{ marginBottom: "12px" }}>
                  <table className="table adminUsersTable">
                    <thead>
                      <tr>
                        <th>Bug</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Severity</th>
                        <th>Assignee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testerVisibleBugRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="note">
                            {isTester ? "No bug reports available in current scope." : "No bug reports created by you yet."}
                          </td>
                        </tr>
                      ) : (
                        testerVisibleBugRows.map((item) => (
                          <tr
                            key={`mine-${item.id}`}
                            className="adminUsersRow"
                            tabIndex={0}
                            role="button"
                            aria-label={`Open bug ${item.title || item.bugId || item.id}`}
                            onClick={async () => {
                              await selectBugForInlineActions(item.id);
                              setBugModalOpen(true);
                            }}
                            onKeyDown={async (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                await selectBugForInlineActions(item.id);
                                setBugModalOpen(true);
                              }
                            }}
                          >
                            <td className="truncateCell">{(item.bugId || item.id)} | {item.title || "Untitled Bug"}</td>
                            <td>{item.workflowStatus || "OPEN"}</td>
                            <td>{item.priority || "N/A"}</td>
                            <td>{item.severity || "N/A"}</td>
                            <td>{item.assignee?.name || item.assignee?.email || "Unassigned"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                ) : null}

                {!isTester && (
                  <>
                {!isDeveloper ? (
                  <>
                    <div className="note" style={{ marginBottom: "8px" }}>
                      Created bug reports are shown here. Quick bugs from Execute Tests appear in this list after creation.
                    </div>
                    <div className="inlineGrid">
                      <input
                        className="input"
                        placeholder="Search by bug id, title, status, reporter, assignee, or linked test case"
                        value={bugSearch}
                        onChange={(e) => setBugSearch(e.target.value)}
                      />
                      <select
                        className="input"
                        value={bugViewMode}
                        onChange={(e) => setBugViewMode(e.target.value as "all" | "mine" | "assigned")}
                      >
                        <option value="all">All Visible Bugs</option>
                        <option value="mine">My Created Bugs</option>
                        <option value="assigned">Assigned To Me</option>
                      </select>
                    </div>
                    <div className="note" style={{ marginBottom: "8px" }}>
                      Showing {bugRowsForDisplay.length} of {bugs.length} bug reports
                    </div>
                  </>
                ) : null}

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
                      showBugActionNotice(error?.message || "Failed to apply bug filters", "error");
                    }
                  }}
                >
                  Apply Filters
                </button>

                {isDeveloper && (
                  <div className="testCaseDetails" style={{ marginTop: "8px" }}>
                    <div><strong>Assigned Bugs:</strong> {assignedBugCount}</div>
                    <div><strong>P1-Urgent:</strong> {p1UrgentCount}</div>
                    <div><strong>Critical Severity:</strong> {criticalBugCount}</div>
                  </div>
                )}
                <div className="tableWrap adminUsersTableWrap">
                  <table className="table adminUsersTable">
                    <thead>
                      <tr>
                        <th>Bug</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Severity</th>
                        <th>Assignee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bugRowsForDisplay.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="note">No bug reports found.</td>
                        </tr>
                      ) : (
                        bugRowsForDisplay.map((item) => (
                          <tr
                            key={item.id}
                            className="adminUsersRow"
                            tabIndex={0}
                            role="button"
                            aria-label={`Open bug ${item.title || item.bugId || item.id}`}
                            onClick={async () => {
                              await selectBugForInlineActions(item.id);
                              setBugModalOpen(true);
                            }}
                            onKeyDown={async (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                await selectBugForInlineActions(item.id);
                                setBugModalOpen(true);
                              }
                            }}
                          >
                            <td className="truncateCell">{(item.bugId || item.id)} | {item.title || "Untitled Bug"}</td>
                            <td>{item.workflowStatus || "OPEN"}</td>
                            <td>{getBugPriority(item) || "N/A"}</td>
                            <td>{item.severity || "N/A"}</td>
                            <td>{item.assignee?.name || item.assignee?.email || "Unassigned"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                </>
                )}

                {selectedBug && !(isTester && showBugCreateForm) && (
                  <div className="panel" style={{ marginTop: "10px" }}>
                    <h5 style={{ marginTop: 0 }}>Selected Bug Actions</h5>
                    <div className="note" style={{ marginBottom: "8px" }}>
                      {(selectedBug.bugId || selectedBug.id)} | {selectedBug.title || "Untitled Bug"} | Current Status:{" "}
                      {selectedBug.workflowStatus || "OPEN"}
                    </div>
                    {canTransitionBugs && (
                      <div style={{ marginBottom: "10px" }}>
                        <div className="inlineGrid">
                          <select
                            className="input"
                            value={bugTransitionToStatus}
                            onChange={(e) => setBugTransitionToStatus(e.target.value)}
                          >
                            <option value="">Select transition status</option>
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
                            placeholder="Reason (used for Won't Fix)"
                            value={bugTransitionReason}
                            onChange={(e) => setBugTransitionReason(e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Duplicate bug code (used for Duplicate)"
                            value={bugTransitionDuplicateOf}
                            onChange={(e) => setBugTransitionDuplicateOf(e.target.value)}
                          />
                        </div>
                        <div style={{ marginTop: "8px" }}>
                          <button className="button small" onClick={applyBugTransition} disabled={!bugTransitionToStatus}>
                            Apply Transition
                          </button>
                          <button
                            className="button small"
                            style={{ marginLeft: "8px" }}
                            onClick={() => setBugModalOpen(true)}
                          >
                            Open Details
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="bugDetailsGrid" style={{ marginBottom: "10px" }}>
                      <section className="bugDetailsCard">
                        <h5 className="bugDetailsHeading">Overview</h5>
                        <div className="bugDetailsMetaGrid">
                          <div><strong>Reporter:</strong> {selectedBug.reporter?.name || selectedBug.reporter?.email || "N/A"}</div>
                          <div><strong>Assignee:</strong> {selectedBug.assignee?.name || selectedBug.assignee?.email || "Unassigned"}</div>
                          <div><strong>Priority:</strong> {getBugPriority(selectedBug) || "N/A"}</div>
                          <div><strong>Severity:</strong> {selectedBug.severity || "N/A"}</div>
                          <div><strong>Linked Test Case:</strong> {selectedBug.testCase?.testCaseCode || selectedBug.testCaseId || "N/A"}</div>
                          <div><strong>Execution:</strong> {selectedBug.executionId || "N/A"}</div>
                        </div>
                        <div className="bugDetailsField">
                          <strong>Description</strong>
                          <p>{selectedBug.description || "N/A"}</p>
                        </div>
                      </section>
                      <section className="bugDetailsCard">
                        <h5 className="bugDetailsHeading">Behavior</h5>
                        <div className="bugDetailsField">
                          <strong>Steps to Reproduce</strong>
                          <p>{getBugField(selectedBug, "stepsToReproduce") || "N/A"}</p>
                        </div>
                        <div className="bugDetailsField">
                          <strong>Expected Behavior</strong>
                          <p>{getBugField(selectedBug, "expectedBehavior") || "N/A"}</p>
                        </div>
                        <div className="bugDetailsField">
                          <strong>Actual Behavior</strong>
                          <p>{getBugField(selectedBug, "actualBehavior") || "N/A"}</p>
                        </div>
                      </section>
                    </div>
                    <div>
                      <div className="toolbarActions" style={{ marginBottom: "8px" }}>
                        <button className="button small" onClick={() => appendCommentSnippet("@username")}>@Mention</button>
                        <button className="button small" onClick={() => appendCommentSnippet("**bold text**")}>Bold</button>
                        <button className="button small" onClick={() => appendCommentSnippet("_italic text_")}>Italic</button>
                        <button className="button small" onClick={() => appendCommentSnippet("`code`")}>Code</button>
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
                            <button key={item.key} className="mentionItem" onClick={() => applyMention(item.key)}>
                              @{item.key} - {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: "8px" }}>
                        <button className="button small" onClick={addBugComment}>Add Comment</button>
                      </div>
                      {bugCommentParentId ? (
                        <div className="note" style={{ marginTop: "8px" }}>
                          Replying to comment: {bugCommentParentId}
                        </div>
                      ) : null}
                      {bugCommentThreads.length > 0 ? (
                        <div className="listCompact" style={{ marginTop: "10px" }}>
                          {renderCommentThreads(bugCommentThreads)}
                        </div>
                      ) : bugComments.length > 0 ? (
                        <div className="listCompact" style={{ marginTop: "10px" }}>
                          {bugComments.map((item) => (
                            <div className={`bugCommentItem ${isDeletedComment(item) ? "isDeleted" : ""}`} key={item.id}>
                              <div className="bugCommentBody">
                                {isDeletedComment(item) ? "[Comment deleted]" : renderFormattedComment(item.comment || "")}
                              </div>
                              <div className="bugCommentFooter">
                                <span className="bugCommentMeta">
                                  {item.author?.name || item.authorId} | {new Date(item.createdAt).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="note" style={{ marginTop: "10px" }}>
                          No comments yet for this bug.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <BugDetailsModal
                  isOpen={bugModalOpen && !!selectedBug}
                  onClose={() => {
                    setBugModalOpen(false);
                    setSelectedBugId("");
                    setSelectedBug(null);
                    setBugComments([]);
                    setBugCommentThreads([]);
                  }}
                  selectedBug={selectedBug}
                  isDeveloper={isDeveloper}
                  canTransitionBugs={canTransitionBugs}
                  canResolveBugs={canResolveBugs}
                  developerDirectory={developerDirectory}
                  bugAssignDeveloperId={bugAssignDeveloperId}
                  setBugAssignDeveloperId={setBugAssignDeveloperId}
                  bugTransitionToStatus={bugTransitionToStatus}
                  setBugTransitionToStatus={setBugTransitionToStatus}
                  bugTransitionReason={bugTransitionReason}
                  setBugTransitionReason={setBugTransitionReason}
                  bugTransitionDuplicateOf={bugTransitionDuplicateOf}
                  setBugTransitionDuplicateOf={setBugTransitionDuplicateOf}
                  onApplyTransition={applyBugTransition}
                  onRefreshDetails={refreshSelectedBugDetails}
                  bugResolveAction={bugResolveAction}
                  setBugResolveAction={setBugResolveAction}
                  bugResolveFixNotes={bugResolveFixNotes}
                  setBugResolveFixNotes={setBugResolveFixNotes}
                  bugResolveCommitLink={bugResolveCommitLink}
                  setBugResolveCommitLink={setBugResolveCommitLink}
                  onApplyResolution={applyBugResolution}
                  bugCommentText={bugCommentText}
                  onCommentTextChange={handleCommentTextChange}
                  bugCommentParentId={bugCommentParentId}
                  setBugCommentParentId={setBugCommentParentId}
                  onAddComment={addBugComment}
                  showMentionPopup={showMentionPopup}
                  filteredMentionCandidates={filteredMentionCandidates}
                  onApplyMention={applyMention}
                  appendCommentSnippet={appendCommentSnippet}
                  bugCommentThreads={bugCommentThreads}
                  bugComments={bugComments}
                  renderCommentThreads={renderCommentThreads}
                  isDeletedComment={isDeletedComment}
                  renderFormattedComment={renderFormattedComment}
                  onSaveAssignee={saveBugAssignee}
                />
              </section>
              )}
            </div>

            {showTestCases && (
            <section className="panel fullWidth testerListPanel">
              <div className="compactFormHeader">
                <h4>Test Cases</h4>
                <div className="note">Browse, inspect, clone, and edit detailed test case records.</div>
              </div>
              <div className="panelHeader panelHeaderActionsCenter">
                <div className="adminUsersToolbar">
                  <button
                    className="button small compactButton"
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
                    {testCasesLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
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
                          disabled={String(selectedTestCaseModal.status || "").toUpperCase() === "ARCHIVED"}
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
                              const includeAttachments = await requestInlineConfirm(
                                "Clone with attachments? Click OK for Yes, Cancel for No."
                              );
                              await cloneTestCaseApi(selectedTestCaseModal.id, { includeAttachments });
                              await loadTestCaseData();
                              alert("Test case cloned successfully");
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
                              if (!(await requestInlineConfirm("Confirm soft-delete for this test case?"))) {
                                return;
                              }
                              await deleteTestCaseApi(selectedTestCaseModal.id);
                              setSelectedTestCaseModalId("");
                              await loadTestCaseData();
                              alert("Test case deleted successfully");
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
                            showBugActionNotice("Comment updated");
                          } catch (error: any) {
                            showBugActionNotice(error?.message || "Edit comment failed", "error");
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
            {confirmDialog.open && (
              <div className="modalBackdrop inlineConfirmBackdrop">
                <div className="modalCard inlineConfirmModalCard">
                  <h4>Confirm Action</h4>
                  <p className="note">{confirmDialog.message}</p>
                  <div className="toolbarActions">
                    <button
                      className="button small"
                      onClick={() => resolveInlineConfirm(true)}
                    >
                      Confirm
                    </button>
                    <button
                      className="button small danger"
                      onClick={() => resolveInlineConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DashboardLayout>
        )}
      </div>
    </div>
  );
}

export default App;






