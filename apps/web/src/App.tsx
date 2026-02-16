import { useEffect, useState } from "react";
import {
  bulkTestCaseOperationApi,
  clearSessionTokens,
  cloneTestCaseApi,
  createBugFromExecutionApi,
  createTestRunApi,
  deleteExecutionEvidenceApi,
  createFromTemplateApi,
  createTemplateApi,
  createTestCaseApi,
  deleteTestCaseApi,
  finalizeExecutionApi,
  forgotPasswordApi,
  getTestRunApi,
  getRefreshToken,
  listExecutionEvidenceApi,
  listExecutionReportsApi,
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
  resetPasswordApi,
  saveExecutionStepApi,
  setSessionTokens,
  startExecutionTimerApi,
  startExecutionApi,
  stopExecutionTimerApi,
  uploadExecutionEvidenceApi,
  updateTestCaseApi,
} from "./api";
import "./App.css";

type Screen = "login" | "register" | "forgot" | "reset" | "dashboard";

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState("TESTER");
  const [currentRole, setCurrentRole] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [testCases, setTestCases] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tcTitle, setTcTitle] = useState("");
  const [tcDescription, setTcDescription] = useState("");
  const [tcPreConditionsText, setTcPreConditionsText] = useState('["User account exists","User is on login page"]');
  const [tcTestDataRequirementsText, setTcTestDataRequirementsText] = useState('["Valid email: test@example.com","Valid password: Test@123"]');
  const [tcEnvironmentRequirementsText, setTcEnvironmentRequirementsText] = useState('["Browser: Chrome 120+","OS: Windows 10/11"]');
  const [tcModule, setTcModule] = useState("Authentication");
  const [tcStepsText, setTcStepsText] = useState(
    '[{"stepNumber":1,"action":"Open login page","testData":"N/A","expectedResult":"Login page is visible"}]'
  );
  const [tcPostConditionsText, setTcPostConditionsText] = useState('["User is redirected to dashboard"]');
  const [tcMetadataText, setTcMetadataText] = useState('{"owner":"QA Team","component":"Authentication"}');
  const [tcTagsText, setTcTagsText] = useState("login, authentication, smoke-test");
  const [tcEstimatedDurationMinutes, setTcEstimatedDurationMinutes] = useState("5");
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
  const [templateCategory, setTemplateCategory] = useState("Login Tests");
  const [templateSteps, setTemplateSteps] = useState(
    '[{"stepNumber":1,"action":"Execute template step","testData":"N/A","expectedResult":"Expected outcome"}]'
  );
  const [importType, setImportType] = useState("JSON");
  const [importFieldMappingText, setImportFieldMappingText] = useState("{}");
  const [importExcelRows, setImportExcelRows] = useState<any[]>([]);
  const [importExcelFileName, setImportExcelFileName] = useState("");
  const [importPayload, setImportPayload] = useState(
    '[{"title":"Imported Case","description":"From JSON","preConditions":["User exists"],"testDataRequirements":["Valid email: test@example.com"],"environmentRequirements":["Chrome 120+"],"module":"Authentication","steps":[{"stepNumber":1,"action":"Open login","testData":"N/A","expectedResult":"Login page opens"}],"postConditions":["User is logged in"],"metadata":{"owner":"QA"},"priority":"MEDIUM","severity":"MAJOR","type":"FUNCTIONAL","status":"DRAFT"}]'
  );
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importPreviewErrors, setImportPreviewErrors] = useState<string[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPreConditionsText, setEditPreConditionsText] = useState("[]");
  const [editTestDataRequirementsText, setEditTestDataRequirementsText] = useState("[]");
  const [editEnvironmentRequirementsText, setEditEnvironmentRequirementsText] = useState("[]");
  const [editModule, setEditModule] = useState("");
  const [editPostConditionsText, setEditPostConditionsText] = useState("[]");
  const [editMetadataText, setEditMetadataText] = useState("{}");
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
  const roleName = currentRole.toUpperCase();
  const isTester = roleName === "TESTER";
  const isDeveloper = roleName === "DEVELOPER";
  const isAdmin = roleName === "ADMIN";
  const canCreateAndManageTestCases = isTester;
  const canUseTemplates = isTester;
  const canRunBulkOps = isTester;
  const canImportTestCases = isTester;
  const canSeeSelectionControls = isTester;
  const canExecuteTests = isTester || isAdmin;
  const canManageTestRuns = isTester || isAdmin;

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
    const [caseRows, templateRows, runRows, executionRows] = await Promise.all([
      getTestCasesApi(),
      listTemplatesApi(),
      canManageTestRuns ? listTestRunsApi() : Promise.resolve([]),
      canExecuteTests ? listExecutionReportsApi() : Promise.resolve([]),
    ]);
    const rows = Array.isArray(caseRows) ? caseRows : [];
    setTestCases(rows);
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
    setTemplates(Array.isArray(templateRows) ? templateRows : []);
    setTestRuns(Array.isArray(runRows) ? runRows : []);
    setExecutionReports(Array.isArray(executionRows) ? executionRows : []);
    setIsRefreshing(false);
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
  };

  const resetEntryFields = () => {
    setTcTitle("");
    setTcDescription("");
    setTcPreConditionsText('["User account exists","User is on login page"]');
    setTcTestDataRequirementsText('["Valid email: test@example.com","Valid password: Test@123"]');
    setTcEnvironmentRequirementsText('["Browser: Chrome 120+","OS: Windows 10/11"]');
    setTcModule("Authentication");
    setTcStepsText(
      '[{"stepNumber":1,"action":"Open login page","testData":"N/A","expectedResult":"Login page is visible"}]'
    );
    setTcPostConditionsText('["User is redirected to dashboard"]');
    setTcMetadataText('{"owner":"QA Team","component":"Authentication"}');
    setTcTagsText("login, authentication, smoke-test");
    setTcEstimatedDurationMinutes("5");
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
    setTemplateCategory("Login Tests");
    setTemplateSteps(
      '[{"stepNumber":1,"action":"Execute template step","testData":"N/A","expectedResult":"Expected outcome"}]'
    );
    setImportType("JSON");
    setImportFieldMappingText("{}");
    setImportExcelRows([]);
    setImportExcelFileName("");
    setImportPayload(
      '[{"title":"Imported Case","description":"From JSON","preConditions":["User exists"],"testDataRequirements":["Valid email: test@example.com"],"environmentRequirements":["Chrome 120+"],"module":"Authentication","steps":[{"stepNumber":1,"action":"Open login","testData":"N/A","expectedResult":"Login page opens"}],"postConditions":["User is logged in"],"metadata":{"owner":"QA"},"priority":"MEDIUM","severity":"MAJOR","type":"FUNCTIONAL","status":"DRAFT"}]'
    );
    setRunName("");
    setRunDescription("");
    setRunStartDate("");
    setRunEndDate("");
    setRunTesterIdsText("");
    setSelectedRunId("");
    setRunDetails(null);
    resetExecutionPanel();
  };

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
      await loadTestCaseData();
      alert("Test case updated");
    } catch (error: any) {
      alert(error?.message || "Edit failed");
    }
  };

  const parseIdsFromText = (raw: string): string[] =>
    raw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);

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
      setShowTestCaseList(false);
      setExpandedTestCaseId("");
      setSelectedIds([]);
      setEditingId("");
      setTestRuns([]);
      setSelectedRunId("");
      setRunDetails(null);
      resetExecutionPanel();
    }
  }, [screen, currentRole]);

  /* REGISTER */
  const handleRegister = async () => {
    if (!isValidPassword(password)) {
      alert(
        "Password must be at least 8 characters and include uppercase, number, and special character."
      );
      return;
    }

    const res = await registerApi(name, email, password, role);
    alert(res.message || "Registered successfully");
    setScreen("login");
  };

  /* LOGIN */
  const handleLogin = async () => {
    const res = await loginApi(email, password, rememberMe);

    if (res.accessToken && res.refreshToken) {
      setSessionTokens(res.accessToken, res.refreshToken, rememberMe);
      setCurrentRole(res?.user?.role || "");
      setShowTestCaseList(false);
      setExpandedTestCaseId("");
      setSelectedIds([]);
      setEditingId("");
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
    setShowTestCaseList(false);
    setExpandedTestCaseId("");
    setSelectedIds([]);
    setEditingId("");
    setScreen("login");
  };

  return (
    <div className="container">
      <div className="card">
        <h2>TestTrack Pro</h2>

        {screen === "login" && (
          <>
            <h3>Login</h3>

            <input
              className="input"
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
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
          </>
        )}

        {screen === "register" && (
          <>
            <h3>Register</h3>

            <input
              className="input"
              placeholder="Name"
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="input"
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="note">
              Password must include uppercase, lowercase, number & special character
            </div>

            <select
              className="input"
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="TESTER">TESTER</option>
              <option value="DEVELOPER">DEVELOPER</option>
              <option value="ADMIN">ADMIN</option>
            </select>

            <button className="button" onClick={handleRegister}>
              Register
            </button>

            <div className="link" onClick={() => setScreen("login")}>
              Back to login
            </div>
          </>
        )}

        {screen === "forgot" && (
          <>
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
                setScreen("login");
              }}
            >
              Send Reset Link
            </button>

            <div className="link" onClick={() => setScreen("login")}>
              Back to login
            </div>
          </>
        )}

        {screen === "reset" && (
          <>
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
          </>
        )}

        {screen === "dashboard" && (
          <div className="dashboard">
            <div className="toolbar">
              <div>
                <h3>Test Case Management</h3>
                <p className="note">
                  Signed in as <strong>{currentRole || "N/A"}</strong>
                </p>
                <p className="note">
                  {isTester && "Tester workspace: create, edit, execute, report, assign issues."}
                  {isDeveloper && "Developer workspace: view details, assigned issues, status updates, reports."}
                  {isAdmin && "Admin workspace: user/project/role/audit/system/backup governance."}
                </p>
              </div>
              <div className="toolbarActions">
                <button
                  className="button small"
                  disabled={isRefreshing}
                  onClick={async () => {
                    try {
                      resetEntryFields();
                      await loadTestCaseData();
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

            <div className="dashboardGrid">
              {isDeveloper && (
                <section className="panel">
                  <h4>Developer Workspace</h4>
                  <p className="note">
                    Use this dashboard to view complete test case details and work on assigned issues, status
                    updates, fix notes, re-test requests, and developer reports.
                  </p>
                </section>
              )}

              {isAdmin && (
                <section className="panel">
                  <h4>Admin Workspace</h4>
                  <p className="note">
                    Admin operations are restricted to user/project/role management, audit logs, system
                    configuration, and backup endpoints.
                  </p>
                </section>
              )}

              {canCreateAndManageTestCases && (
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

              {canUseTemplates && (
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

              {canRunBulkOps && (
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

              {canImportTestCases && (
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

              {canManageTestRuns && (
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

              {canExecuteTests && (
              <section className="panel">
                <h4>Execute Test Case</h4>
                <select className="input" value={executionCaseId} onChange={(e) => setExecutionCaseId(e.target.value)}>
                  <option value="">Select Test Case</option>
                  {testCases.map((tc) => (
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
                      if (!executionCaseId) {
                        alert("Select a test case");
                        return;
                      }
                      const opened = await openExecutionApi(executionCaseId, executionRunId || undefined);
                      const currentSteps = Array.isArray(opened?.stepResults) ? opened.stepResults : [];
                      setExecutionSteps(currentSteps);
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
                          testCaseId: executionCaseId,
                          testRunId: executionRunId || null,
                        });
                        setExecutionId(started.id);
                        setExecutionStartedAt(started?.startedAt || "");
                        setExecutionCompletedAt("");
                        setExecutionDurationSeconds(null);
                        setExecutionEvidence([]);
                      }
                      if (currentSteps.length > 0) {
                        setExecutionSelectedStepNumber(String(currentSteps[0].stepNumber));
                      }
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
                          setSelectedExecutionReportId(final.id);
                          setExecutionCompletedAt(final?.completedAt || executionCompletedAt);
                          setExecutionDurationSeconds(
                            typeof final?.durationSeconds === "number" ? final.durationSeconds : executionDurationSeconds
                          );
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
            </div>

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
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
