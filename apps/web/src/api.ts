const BASE_API_URL =
  process.env.REACT_APP_BASE_API_URL?.trim() || "http://localhost:4000/api";
const AUTH_API_URL = `${BASE_API_URL}/auth`;
const TEST_API_URL = BASE_API_URL;
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

const getTokenFromStorage = (key: string): string =>
  localStorage.getItem(key) || sessionStorage.getItem(key) || "";

export const getAccessToken = (): string => getTokenFromStorage(ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string => getTokenFromStorage(REFRESH_TOKEN_KEY);

export const setSessionTokens = (
  accessToken: string,
  refreshToken: string,
  rememberMe = true
) => {
  const storage = rememberMe ? localStorage : sessionStorage;
  const otherStorage = rememberMe ? sessionStorage : localStorage;

  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  otherStorage.removeItem(ACCESS_TOKEN_KEY);
  otherStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const clearSessionTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("token");
};

/* REGISTER */
export async function registerApi(
  name: string,
  email: string,
  password: string,
  role: string
) {
  const res = await fetch(`${AUTH_API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
  });

  return res.json();
}

/* LOGIN (UPDATED WITH rememberMe) */
export async function loginApi(
  email: string,
  password: string,
  rememberMe: boolean
) {
  const res = await fetch(`${AUTH_API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe }),
  });

  return res.json();
}

/* FORGOT PASSWORD */
export async function forgotPasswordApi(email: string) {
  const res = await fetch(`${AUTH_API_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return res.json();
}

/* RESET PASSWORD */
export async function resetPasswordApi(token: string, newPassword: string) {
  const res = await fetch(`${AUTH_API_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });

  return res.json();
}

/* REFRESH TOKEN */
export async function refreshTokenApi(refreshToken: string) {
  const res = await fetch(`${AUTH_API_URL}/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  return res.json();
}

/* LOGOUT ALL DEVICES */
export async function logoutAllApi() {
  const token = getAccessToken();
  const res = await fetch(`${AUTH_API_URL}/logout-all`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

/* AUTH FETCH WITH AUTO REFRESH */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const fetchWithRetry = async (
    target: RequestInfo | URL,
    requestInit: RequestInit | undefined,
    retries = 1
  ): Promise<Response> => {
    try {
      return await fetch(target, requestInit);
    } catch (error: any) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return fetchWithRetry(target, requestInit, retries - 1);
      }
      throw new Error(
        `Unable to reach API server at ${TEST_API_URL}. Ensure backend is running on port 4000.`
      );
    }
  };

  let accessToken = getAccessToken();
  const usingSessionStorage = Boolean(sessionStorage.getItem(REFRESH_TOKEN_KEY));
  let response = await fetchWithRetry(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return response;
  }

  const refreshed = await refreshTokenApi(refreshToken);
  if (!refreshed?.accessToken || !refreshed?.refreshToken) {
    clearSessionTokens();
    return response;
  }

  setSessionTokens(refreshed.accessToken, refreshed.refreshToken, !usingSessionStorage);
  accessToken = refreshed.accessToken;

  return fetchWithRetry(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

const parseJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const authJson = async (path: string, init?: RequestInit) => {
  const res = await authFetch(`${TEST_API_URL}${path}`, init);
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(body?.message || "Request failed");
  }
  return body;
};

export async function getTestCasesApi() {
  return authJson("/testcases");
}

export async function createTestCaseApi(payload: {
  title: string;
  description: string;
  preConditions: unknown;
  testDataRequirements: unknown;
  environmentRequirements: unknown;
  module: string;
  steps: unknown;
  postConditions: unknown;
  metadata: Record<string, unknown>;
  tags: string[];
  estimatedDurationMinutes: number | null;
  automationStatus: string;
  automationScriptLink: string | null;
  priority: string;
  severity: string;
  type: string;
  status: string;
  assignedTo?: string;
  projectId?: string;
}) {
  return authJson("/testcases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateTestCaseApi(id: string, payload: Record<string, unknown>) {
  return authJson(`/testcases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function cloneTestCaseApi(id: string, payload?: Record<string, unknown>) {
  return authJson(`/testcases/${id}/clone`, {
    method: "POST",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

export async function deleteTestCaseApi(id: string) {
  return authJson(`/testcases/${id}`, { method: "DELETE" });
}

export async function bulkTestCaseOperationApi(payload: Record<string, unknown>) {
  return authJson("/testcases/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listTemplatesApi() {
  return authJson("/testcase-templates");
}

export async function createTemplateApi(payload: Record<string, unknown>) {
  return authJson("/testcase-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createFromTemplateApi(templateId: string, payload: Record<string, unknown>) {
  return authJson(`/testcases/from-template/${templateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function importTestCasesApi(payload: Record<string, unknown>) {
  return authJson("/testcases/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function openExecutionApi(testCaseId: string, testRunId?: string) {
  const query = testRunId ? `?testRunId=${encodeURIComponent(testRunId)}` : "";
  return authJson(`/executions/testcases/${testCaseId}/open${query}`);
}

export async function startExecutionApi(payload: { testCaseId: string; testRunId?: string | null; notes?: string }) {
  return authJson(`/executions/testcases/${payload.testCaseId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      testRunId: payload.testRunId || null,
      notes: payload.notes || "",
    }),
  });
}

export async function saveExecutionStepApi(
  executionId: string,
  stepNumber: number,
  payload: { status: string; actualResult?: string; notes?: string; executionNotes?: string }
) {
  return authJson(`/executions/${executionId}/steps/${stepNumber}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function finalizeExecutionApi(executionId: string, payload?: { result?: string; notes?: string }) {
  return authJson(`/executions/${executionId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export async function createTestRunApi(payload: {
  name: string;
  description?: string;
  targetStartDate?: string;
  targetEndDate?: string;
  testCaseIds: string[];
  testerIds: string[];
}) {
  return authJson("/test-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listTestRunsApi() {
  return authJson("/test-runs");
}

export async function getTestRunApi(id: string) {
  return authJson(`/test-runs/${id}`);
}

export async function listExecutionReportsApi() {
  return authJson("/reports/test-executions");
}

export async function startExecutionTimerApi(executionId: string) {
  return authJson(`/executions/${executionId}/timer/start`, { method: "POST" });
}

export async function stopExecutionTimerApi(executionId: string) {
  return authJson(`/executions/${executionId}/timer/stop`, { method: "POST" });
}

export async function listExecutionEvidenceApi(executionId: string) {
  return authJson(`/executions/${executionId}/evidence`);
}

export async function uploadExecutionEvidenceApi(
  executionId: string,
  payload: { fileType: string; fileUrl: string; fileName: string; notes?: string }
) {
  return authJson(`/executions/${executionId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteExecutionEvidenceApi(executionId: string, evidenceId: string) {
  return authJson(`/executions/${executionId}/evidence/${evidenceId}`, { method: "DELETE" });
}

export async function createBugFromExecutionApi(
  executionId: string,
  payload?: { title?: string; description?: string; severity?: string; assignedTo?: string }
) {
  return authJson(`/issues/from-executions/${executionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export async function reexecuteExecutionApi(executionId: string, payload?: { notes?: string }) {
  return authJson(`/executions/${executionId}/reexecute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export async function createBugApi(payload: Record<string, unknown>) {
  return authJson("/bugs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listBugsApi(params?: Record<string, string>) {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => String(v || "").length > 0)).toString()}`
    : "";
  return authJson(`/bugs${query}`);
}

export async function getBugApi(id: string) {
  return authJson(`/bugs/${id}`);
}

export async function updateBugWorkflowApi(id: string, payload: Record<string, unknown>) {
  return authJson(`/bugs/${id}/workflow`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function resolveBugApi(id: string, payload: Record<string, unknown>) {
  return authJson(`/bugs/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listDeveloperBugsApi(params?: Record<string, string>) {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => String(v || "").length > 0)).toString()}`
    : "";
  return authJson(`/developer/bugs${query}`);
}

export async function quickUpdateDeveloperBugStatusApi(id: string, status: string) {
  return authJson(`/developer/bugs/${id}/quick-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function createBugCommentApi(id: string, payload: { comment: string; parentCommentId?: string }) {
  return authJson(`/bugs/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listBugCommentsApi(id: string) {
  return authJson(`/bugs/${id}/comments`);
}

export async function editBugCommentApi(commentId: string, comment: string) {
  return authJson(`/bugs/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
}

export async function deleteBugCommentApi(commentId: string) {
  return authJson(`/bugs/comments/${commentId}`, { method: "DELETE" });
}

export async function deleteTemplateApi(templateId: string) {
  return authJson(`/testcase-templates/${templateId}`, { method: "DELETE" });
}

export async function createSuiteApi(payload: Record<string, unknown>) {
  return authJson("/suites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listSuitesApi(params?: Record<string, string>) {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => String(v || "").length > 0)).toString()}`
    : "";
  return authJson(`/suites${query}`);
}

export async function getSuiteApi(id: string) {
  return authJson(`/suites/${id}`);
}

export async function updateSuiteApi(id: string, payload: Record<string, unknown>) {
  return authJson(`/suites/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function addSuiteTestCasesApi(suiteId: string, testCaseIds: string[]) {
  return authJson(`/suites/${suiteId}/testcases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testCaseIds }),
  });
}

export async function removeSuiteTestCaseApi(suiteId: string, testCaseId: string) {
  return authJson(`/suites/${suiteId}/testcases/${testCaseId}`, { method: "DELETE" });
}

export async function reorderSuiteTestCasesApi(suiteId: string, testCaseIds: string[]) {
  return authJson(`/suites/${suiteId}/testcases/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testCaseIds }),
  });
}

export async function cloneSuiteApi(suiteId: string, name?: string) {
  return authJson(`/suites/${suiteId}/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });
}

export async function archiveSuiteApi(suiteId: string) {
  return authJson(`/suites/${suiteId}/archive`, { method: "POST" });
}

export async function restoreSuiteApi(suiteId: string) {
  return authJson(`/suites/${suiteId}/restore`, { method: "POST" });
}

export async function deleteSuiteApi(suiteId: string) {
  return authJson(`/suites/${suiteId}`, { method: "DELETE" });
}

export async function startSuiteExecutionApi(payload: Record<string, unknown>) {
  return authJson("/suite-executions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getSuiteExecutionApi(id: string) {
  return authJson(`/suite-executions/${id}`);
}

export async function listSuiteExecutionsApi(suiteId: string) {
  return authJson(`/suites/${suiteId}/executions`);
}

export async function listAdminUsersApi() {
  return authJson("/admin/users");
}

export async function createAdminUserApi(payload: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  return authJson("/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminUserApi(
  id: string,
  payload: { name?: string; role?: string; isActive?: boolean }
) {
  return authJson(`/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminUserApi(id: string) {
  return authJson(`/admin/users/${id}`, {
    method: "DELETE",
  });
}

export async function updateAdminRoleApi(id: string, role: string) {
  return authJson(`/admin/roles/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export async function listAdminProjectsApi() {
  return authJson("/admin/projects");
}

export async function createAdminProjectApi(payload: { name: string; description?: string }) {
  return authJson("/admin/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminProjectApi(
  id: string,
  payload: { name?: string; description?: string; isActive?: boolean }
) {
  return authJson(`/admin/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listAdminAuditLogsApi(entityType?: string) {
  const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";
  return authJson(`/admin/audit-logs${query}`);
}

export async function listAdminSystemConfigsApi() {
  return authJson("/admin/system-config");
}

export async function upsertAdminSystemConfigApi(payload: { key: string; value: string }) {
  return authJson("/admin/system-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listAdminBackupsApi() {
  return authJson("/admin/backups");
}

export async function triggerAdminBackupApi(notes?: string) {
  return authJson("/admin/backups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: notes || "" }),
  });
}

export async function listBugNotificationsApi(params?: { unread?: "0" | "1"; take?: number }) {
  const qp = new URLSearchParams();
  if (params?.unread) qp.set("unread", params.unread);
  if (typeof params?.take === "number") qp.set("take", String(params.take));
  const query = qp.toString();
  return authJson(`/notifications/bugs${query ? `?${query}` : ""}`);
}

export async function markBugNotificationReadApi(notificationId: string) {
  return authJson(`/notifications/bugs/${notificationId}/read`, {
    method: "PATCH",
  });
}
