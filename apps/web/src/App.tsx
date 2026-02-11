import { useEffect, useState } from "react";
import {
  bulkTestCaseOperationApi,
  clearSessionTokens,
  cloneTestCaseApi,
  createFromTemplateApi,
  createTemplateApi,
  createTestCaseApi,
  deleteTestCaseApi,
  forgotPasswordApi,
  getRefreshToken,
  getTestCasesApi,
  importTestCasesApi,
  listTemplatesApi,
  loginApi,
  logoutAllApi,
  refreshTokenApi,
  registerApi,
  resetPasswordApi,
  setSessionTokens,
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
  const [tcModule, setTcModule] = useState("Authentication");
  const [tcStepsText, setTcStepsText] = useState('["step 1","step 2"]');
  const [tcPriority, setTcPriority] = useState("MEDIUM");
  const [tcSeverity, setTcSeverity] = useState("MAJOR");
  const [tcType, setTcType] = useState("FUNCTIONAL");
  const [tcStatus, setTcStatus] = useState("DRAFT");
  const [bulkOperation, setBulkOperation] = useState("STATUS");
  const [bulkStatus, setBulkStatus] = useState("READY");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("Login Tests");
  const [templateSteps, setTemplateSteps] = useState('["template step"]');
  const [importType, setImportType] = useState("JSON");
  const [importPayload, setImportPayload] = useState(
    '[{"title":"Imported Case","description":"From JSON","module":"Authentication","steps":["a","b"],"priority":"MEDIUM","severity":"MAJOR","type":"FUNCTIONAL","status":"DRAFT"}]'
  );
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importPreviewErrors, setImportPreviewErrors] = useState<string[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editModule, setEditModule] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editSeverity, setEditSeverity] = useState("MAJOR");
  const [editType, setEditType] = useState("FUNCTIONAL");
  const [editStatus, setEditStatus] = useState("DRAFT");
  const [showTestCaseList, setShowTestCaseList] = useState(false);
  const [expandedTestCaseId, setExpandedTestCaseId] = useState("");

  const parseSteps = (raw: string): unknown => {
    const value = raw.trim();
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    }
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

  const buildImportPreview = () => {
    try {
      const errors: string[] = [];
      let rows: any[] = [];
      if (importType === "JSON") {
        const parsed = JSON.parse(importPayload);
        if (!Array.isArray(parsed)) {
          alert("JSON import must be an array of test cases");
          return;
        }
        rows = parsed.map((item: any) => ({
          title: item?.title || "",
          description: item?.description || "",
          module: item?.module || "",
          steps: item?.steps,
          priority: item?.priority || "MEDIUM",
          severity: item?.severity || "MAJOR",
          type: item?.type || "FUNCTIONAL",
          status: item?.status || "DRAFT",
        }));
      } else {
        const lines = importPayload
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.length < 2) {
          alert("CSV needs one header row and at least one data row");
          return;
        }
        const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
        rows = lines.slice(1).map((line) => {
          const cells = parseCsvLine(line);
          const map: Record<string, string> = {};
          headers.forEach((h, idx) => {
            map[h] = (cells[idx] || "").trim();
          });
          return {
            title: map.title || "",
            description: map.description || "",
            module: map.module || "",
            steps: map.steps || "",
            priority: map.priority || "MEDIUM",
            severity: map.severity || "MAJOR",
            type: map.type || "FUNCTIONAL",
            status: map.status || "DRAFT",
          };
        });
      }

      rows.forEach((row, idx) => {
        if (!row.title || !row.description || !row.module || row.steps === undefined || row.steps === "") {
          errors.push(`Row ${idx + 1}: title, description, module, steps are required`);
        }
        if (String(row.title).length > 200) {
          errors.push(`Row ${idx + 1}: title exceeds 200 characters`);
        }
      });

      setImportPreview(rows);
      setImportPreviewErrors(errors);
      setPreviewReady(true);
    } catch (error: any) {
      alert(error?.message || "Preview failed");
    }
  };

  const loadTestCaseData = async () => {
    setIsRefreshing(true);
    const [caseRows, templateRows] = await Promise.all([getTestCasesApi(), listTemplatesApi()]);
    const rows = Array.isArray(caseRows) ? caseRows : [];
    setTestCases(rows);
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
    setTemplates(Array.isArray(templateRows) ? templateRows : []);
    setIsRefreshing(false);
  };

  const resetEntryFields = () => {
    setTcTitle("");
    setTcDescription("");
    setTcModule("Authentication");
    setTcStepsText('["step 1","step 2"]');
    setTcPriority("MEDIUM");
    setTcSeverity("MAJOR");
    setTcType("FUNCTIONAL");
    setTcStatus("DRAFT");
    setBulkOperation("STATUS");
    setBulkStatus("READY_FOR_REVIEW");
    setBulkAssignee("");
    setTemplateName("");
    setTemplateCategory("Login Tests");
    setTemplateSteps('["template step"]');
    setImportType("JSON");
    setImportPayload(
      '[{"title":"Imported Case","description":"From JSON","module":"Authentication","steps":["a","b"],"priority":"MEDIUM","severity":"MAJOR","type":"FUNCTIONAL","status":"DRAFT"}]'
    );
  };

  const startEditCase = (tc: any) => {
    setEditingId(tc.id);
    setEditTitle(tc.title || "");
    setEditDescription(tc.description || "");
    setEditModule(tc.module || "General");
    setEditPriority(tc.priority || "MEDIUM");
    setEditSeverity(tc.severity || "MAJOR");
    setEditType(tc.type || "FUNCTIONAL");
    setEditStatus(tc.status || "DRAFT");
  };

  const saveEditCase = async () => {
    if (!editingId) return;
    try {
      await updateTestCaseApi(editingId, {
        title: editTitle,
        description: editDescription,
        module: editModule,
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
  }, [importPayload, importType]);

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
              <section className="panel">
                <h4>Create Test Case</h4>
                <input className="input" placeholder="Title" value={tcTitle} onChange={(e) => setTcTitle(e.target.value)} />
                <input className="input" placeholder="Description" value={tcDescription} onChange={(e) => setTcDescription(e.target.value)} />
                <input className="input" placeholder="Module/Feature" value={tcModule} onChange={(e) => setTcModule(e.target.value)} />
                <textarea className="input" placeholder="Steps JSON or one step per line" rows={4} value={tcStepsText} onChange={(e) => setTcStepsText(e.target.value)} />
                <div className="inlineGrid">
                  <select className="input" value={tcPriority} onChange={(e) => setTcPriority(e.target.value)}>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
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
                      await createTestCaseApi({
                        title: tcTitle,
                        description: tcDescription,
                        module: tcModule,
                        steps: parseSteps(tcStepsText),
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
                        module: tcModule,
                        steps: parseSteps(templateSteps),
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

              <section className="panel">
                <h4>Bulk Operations</h4>
                <select className="input" value={bulkOperation} onChange={(e) => setBulkOperation(e.target.value)}>
                  <option value="STATUS">STATUS</option>
                  <option value="ASSIGN">ASSIGN</option>
                  <option value="DELETE">DELETE</option>
                </select>
                {bulkOperation === "STATUS" && (
                  <select className="input" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="DEPRECATED">DEPRECATED</option>
                  </select>
                )}
                {bulkOperation === "ASSIGN" && (
                  <input className="input" placeholder="Assignee User ID" value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)} />
                )}
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      const payload: any = { operation: bulkOperation, ids: selectedIds };
                      if (bulkOperation === "STATUS") payload.status = bulkStatus;
                      if (bulkOperation === "ASSIGN") payload.assignedTo = bulkAssignee;
                      await bulkTestCaseOperationApi(payload);
                      setSelectedIds([]);
                      await loadTestCaseData();
                      alert("Bulk operation completed");
                    } catch (error: any) {
                      alert(error?.message || "Bulk operation failed");
                    }
                  }}
                >
                  Apply
                </button>
              </section>

              <section className="panel">
                <h4>Import</h4>
                <select className="input" value={importType} onChange={(e) => setImportType(e.target.value)}>
                  <option value="JSON">JSON</option>
                  <option value="CSV">CSV</option>
                </select>
                <textarea className="input" rows={5} placeholder="Import payload" value={importPayload} onChange={(e) => setImportPayload(e.target.value)} />
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
                      const payload =
                        importType === "JSON"
                          ? { sourceType: "JSON", items: JSON.parse(importPayload) }
                          : { sourceType: "CSV", csvText: importPayload };
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
              {testCases.map((tc) => (
                <div key={tc.id}>
                <div className="row">
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
                  <button
                    className="linkButton"
                    onClick={() =>
                      setExpandedTestCaseId((prev) => (prev === tc.id ? "" : tc.id))
                    }
                  >
                    {tc.title}
                  </button>
                  <span className="meta">{tc.testCaseCode} | {tc.module} | {tc.priority}/{tc.status}</span>
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
                        await cloneTestCaseApi(tc.id);
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
                        await deleteTestCaseApi(tc.id);
                        await loadTestCaseData();
                      } catch (error: any) {
                        alert(error?.message || "Delete failed");
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
                {expandedTestCaseId === tc.id && (
                  <div className="testCaseDetails">
                    <div><strong>Test Case ID:</strong> {tc.testCaseCode || "N/A"}</div>
                    <div><strong>Title:</strong> {tc.title || "N/A"}</div>
                    <div><strong>Description:</strong> {tc.description || "N/A"}</div>
                    <div><strong>Module:</strong> {tc.module || "N/A"}</div>
                    <div><strong>Priority:</strong> {tc.priority || "N/A"}</div>
                    <div><strong>Severity:</strong> {tc.severity || "N/A"}</div>
                    <div><strong>Type:</strong> {tc.type || "N/A"}</div>
                    <div><strong>Status:</strong> {tc.status || "N/A"}</div>
                    <div><strong>Steps:</strong> {typeof tc.steps === "string" ? tc.steps : JSON.stringify(tc.steps)}</div>
                    <div><strong>Created At:</strong> {tc.createdAt ? new Date(tc.createdAt).toLocaleString() : "N/A"}</div>
                  </div>
                )}
                </div>
              ))}
                </>
              )}
              {editingId && (
                <div className="modalBackdrop">
                  <div className="modalCard">
                    <h4>Edit Test Case</h4>
                    <label className="fieldLabel" htmlFor="edit-title">Title</label>
                    <input id="edit-title" className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-description">Description</label>
                    <input id="edit-description" className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                    <label className="fieldLabel" htmlFor="edit-module">Module/Feature</label>
                    <input id="edit-module" className="input" value={editModule} onChange={(e) => setEditModule(e.target.value)} />
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
