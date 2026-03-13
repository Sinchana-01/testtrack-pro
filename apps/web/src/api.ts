const BASE_API_URL =
  process.env.REACT_APP_BASE_API_URL?.trim() || "http://localhost:4000/api";
const AUTH_API_URL = `${BASE_API_URL}/auth`;
const TEST_API_URL = BASE_API_URL;
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const ACTIVE_PROJECT_ID_KEY = "activeProjectId";

const getTokenFromStorage = (key: string): string =>
  localStorage.getItem(key) || sessionStorage.getItem(key) || "";

export const getAccessToken = (): string => getTokenFromStorage(ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string => getTokenFromStorage(REFRESH_TOKEN_KEY);
export const getActiveProjectId = (): string => localStorage.getItem(ACTIVE_PROJECT_ID_KEY) || "";
export const setActiveProjectId = (projectId: string) => {
  const value = String(projectId || "").trim();
  if (!value) {
    localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_PROJECT_ID_KEY, value);
};

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
  localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
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

export async function googleLoginApi(accessToken: string, rememberMe: boolean) {
  const res = await fetch(`${AUTH_API_URL}/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, rememberMe }),
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
  const activeProjectId = getActiveProjectId();
  const withAuthHeaders = (sourceHeaders: HeadersInit | undefined, token: string): Headers => {
    const headers = new Headers(sourceHeaders || {});
    headers.set("Authorization", `Bearer ${token}`);
    if (activeProjectId && activeProjectId !== "__ALL__") {
      headers.set("x-project-id", activeProjectId);
    } else {
      headers.delete("x-project-id");
    }
    return headers;
  };
  let response = await fetchWithRetry(input, {
    ...init,
    headers: withAuthHeaders(init?.headers, accessToken),
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
    headers: withAuthHeaders(init?.headers, accessToken),
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

const normalizeApiErrorMessage = (status: number, message: string): string => {
  const raw = String(message || "").trim();
  if (status === 403) {
    if (raw) {
      return `Access denied. ${raw}`;
    }
    return "Access denied. You do not have permission for this action.";
  }
  if (status === 401) {
    return "Your session expired. Please log in again.";
  }
  if (raw) {
    return raw;
  }
  return "Request failed";
};

export class ApiHttpError extends Error {
  status: number;
  body: any;

  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.body = body;
  }
}

const authJson = async (path: string, init?: RequestInit) => {
  const res = await authFetch(`${TEST_API_URL}${path}`, init);
  const body = await parseJson(res);
  if (!res.ok) {
    const message = normalizeApiErrorMessage(res.status, body?.message || body?.error || "");
    throw new ApiHttpError(res.status, message, body);
  }
  return body;
};

export async function getTestCasesApi() {
  return authJson("/testcases");
}

export async function getDashboardWidgetsLayoutApi() {
  return authJson("/dashboard/widgets");
}

export async function saveDashboardWidgetsLayoutApi(payload: {
  widgets: Array<{ id: string; visible: boolean; order: number; size: "S" | "M" | "L" }>;
}) {
  return authJson("/dashboard/widgets", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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

export async function updateTemplateApi(templateId: string, payload: Record<string, unknown>) {
  return authJson(`/testcase-templates/${templateId}`, {
    method: "PATCH",
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

export async function getTestExecutionReportSummaryApi(params?: {
  testRunId?: string;
  from?: string;
  to?: string;
  projectId?: string;
  export?: "csv" | "excel" | "pdf";
}) {
  const query = params
    ? `?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => String(v || "").trim().length > 0)
      ).toString()}`
    : "";
  return authJson(`/reports/test-executions/summary${query}`);
}

export async function getBugReportSummaryApi(params?: { projectId?: string }) {
  const query = params?.projectId ? `?projectId=${encodeURIComponent(params.projectId)}` : "";
  return authJson(`/reports/bugs/summary${query}`);
}

export async function getCrossProjectSummaryApi() {
  return authJson("/reports/cross-project-summary");
}

export async function getTesterPerformanceReportApi(params?: {
  testerId?: string;
  from?: string;
  to?: string;
  export?: "csv" | "excel" | "pdf";
}) {
  const query = params
    ? `?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => String(v || "").trim().length > 0)
      ).toString()}`
    : "";
  return authJson(`/reports/tester-performance${query}`);
}

export async function exportTesterPerformanceReportApi(
  format: "csv" | "excel" | "pdf",
  params?: { testerId?: string; from?: string; to?: string }
) {
  const query = new URLSearchParams(
    Object.entries({ ...(params || {}), export: format }).filter(([, v]) => String(v || "").trim().length > 0)
  ).toString();
  const res = await authFetch(`${TEST_API_URL}/reports/tester-performance?${query}`);
  if (!res.ok) {
    const body = await parseJson(res);
    throw new Error(body?.message || "Failed to export tester performance report");
  }
  return res.blob();
}

export async function exportTestExecutionReportApi(
  format: "csv" | "excel" | "pdf",
  params?: { testRunId?: string; from?: string; to?: string; projectId?: string }
) {
  const query = new URLSearchParams(
    Object.entries({ ...(params || {}), export: format }).filter(([, v]) => String(v || "").trim().length > 0)
  ).toString();
  const res = await authFetch(`${TEST_API_URL}/reports/test-executions/summary?${query}`);
  if (!res.ok) {
    const body = await parseJson(res);
    throw new Error(body?.message || "Failed to export test execution report");
  }
  return res.blob();
}

export async function listReportSchedulesApi() {
  return authJson("/reports/schedules");
}

export async function createReportScheduleApi(payload: {
  reportType: "TEST_EXECUTION_SUMMARY" | "TESTER_PERFORMANCE";
  format: "PDF" | "EXCEL" | "CSV";
  recipients: string[];
  frequency: "DAILY" | "WEEKLY";
  weekday: number;
  hour: number;
  minute: number;
  active?: boolean;
}) {
  return authJson("/reports/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function sendReportScheduleNowApi(id: string) {
  return authJson(`/reports/schedules/${id}/send-now`, { method: "POST" });
}

export async function deleteReportScheduleApi(id: string) {
  return authJson(`/reports/schedules/${id}`, { method: "DELETE" });
}

export async function getDeveloperPerformanceReportApi(params?: {
  developerId?: string;
  from?: string;
  to?: string;
}) {
  const query = params
    ? `?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => String(v || "").trim().length > 0)
      ).toString()}`
    : "";
  return authJson(`/reports/developer-performance${query}`);
}

export async function exportDeveloperPerformanceReportCsvApi(params?: {
  developerId?: string;
  from?: string;
  to?: string;
}) {
  const queryParams = new URLSearchParams(
    Object.entries({ ...(params || {}), export: "csv" }).filter(([, v]) => String(v || "").trim().length > 0)
  ).toString();
  const res = await authFetch(`${TEST_API_URL}/reports/developer-performance?${queryParams}`);
  if (!res.ok) {
    const payload = await parseJson(res);
    throw new Error(payload?.message || "Failed to export developer performance report");
  }
  return res.text();
}

export async function startExecutionTimerApi(executionId: string) {
  return authJson(`/executions/${executionId}/timer/start`, { method: "POST" });
}

export async function stopExecutionTimerApi(executionId: string) {
  return authJson(`/executions/${executionId}/timer/stop`, { method: "POST" });
}

export async function pauseExecutionTimerApi(executionId: string) {
  return authJson(`/executions/${executionId}/timer/pause`, { method: "POST" });
}

export async function resumeExecutionTimerApi(executionId: string) {
  return authJson(`/executions/${executionId}/timer/resume`, { method: "POST" });
}

export async function setExecutionManualDurationApi(
  executionId: string,
  payload: { durationSeconds?: number; durationMinutes?: number }
) {
  return authJson(`/executions/${executionId}/timer/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function executeTestCaseApi(
  testCaseId: string,
  payload: { result: string; testRunId?: string; notes?: string; stepResults?: unknown[] }
) {
  return authJson(`/testcases/${testCaseId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  payload?: {
    title?: string;
    description?: string;
    severity?: string;
    assignedTo?: string;
    stepsToReproduce?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    failedStepNumber?: number;
    failedStepAction?: string;
    failedStepExpectedResult?: string;
    failedStepActualResult?: string;
    failedStepNotes?: string;
  }
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

export async function getExecutionHistoryApi(executionId: string) {
  return authJson(`/executions/${executionId}/history`);
}

export async function compareExecutionApi(executionId: string, compareToExecutionId: string) {
  return authJson(`/executions/${executionId}/compare/${compareToExecutionId}`);
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

export async function getBugApi(id: string, params?: Record<string, string>) {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => String(v || "").length > 0)).toString()}`
    : "";
  return authJson(`/bugs/${id}${query}`);
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

export async function listDeveloperAssignedIssuesApi() {
  return authJson("/developer/issues/assigned");
}

export async function getDeveloperDashboardApi() {
  return authJson("/developer/dashboard");
}

export async function getDeveloperReportsApi() {
  return authJson("/developer/reports");
}

export async function updateDeveloperIssueStatusApi(id: string, status: string) {
  return authJson(`/issues/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function updateDeveloperFixNotesApi(id: string, fixNotes: string) {
  return authJson(`/issues/${id}/fix-notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fixNotes }),
  });
}

export async function linkDeveloperIssueCommitApi(id: string, commitLink: string) {
  return authJson(`/issues/${id}/link-commit`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commitLink }),
  });
}

export async function requestDeveloperIssueRetestApi(id: string) {
  return authJson(`/issues/${id}/request-retest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function createDeveloperIssueCommentApi(id: string, comment: string) {
  return authJson(`/issues/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
}

export async function exportDeveloperReportsCsvApi() {
  const res = await authFetch(`${TEST_API_URL}/developer/reports/export`);
  if (!res.ok) {
    const payload = await parseJson(res);
    throw new Error(payload?.message || "Failed to export developer report");
  }
  return res.text();
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

export async function listTesterUsersApi() {
  return authJson("/users/testers");
}

export async function listDeveloperUsersApi() {
  return authJson("/users/developers");
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

export async function listProjectsApi(params?: { includeArchived?: boolean }) {
  const query =
    params?.includeArchived !== undefined
      ? `?includeArchived=${params.includeArchived ? "true" : "false"}`
      : "";
  return authJson(`/projects${query}`);
}

export async function getProjectApi(id: string) {
  return authJson(`/projects/${id}`);
}

export async function createAdminProjectApi(payload: { name: string; code: string; description?: string; ownerId?: string }) {
  return authJson("/admin/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminProjectApi(
  id: string,
  payload: {
    name?: string;
    code?: string;
    description?: string;
    isActive?: boolean;
    ownerId?: string;
    status?: "ACTIVE" | "ARCHIVED";
  }
) {
  return authJson(`/admin/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listProjectMembersApi(projectId: string) {
  return authJson(`/projects/${projectId}/members`);
}

export async function upsertProjectMemberApi(
  projectId: string,
  payload: { userId: string; roleInProject: "ADMIN" | "TESTER" | "DEVELOPER" }
) {
  return authJson(`/projects/${projectId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateProjectMemberRoleApi(
  projectId: string,
  memberId: string,
  roleInProject: "ADMIN" | "TESTER" | "DEVELOPER"
) {
  return authJson(`/projects/${projectId}/members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleInProject }),
  });
}

export async function removeProjectMemberApi(projectId: string, memberId: string) {
  return authJson(`/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
  });
}

export async function getProjectConfigurationApi(projectId: string) {
  return authJson(`/projects/${projectId}/configuration`);
}

export async function updateProjectConfigurationApi(
  projectId: string,
  payload: {
    customFields?: unknown;
    modules?: unknown;
    workflowConfig?: unknown;
    environments?: unknown;
  }
) {
  return authJson(`/projects/${projectId}/configuration`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listProjectMilestonesApi(projectId: string) {
  return authJson(`/projects/${projectId}/milestones`);
}

export async function createProjectMilestoneApi(
  projectId: string,
  payload: {
    name: string;
    description?: string;
    targetDate: string;
    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
    targetPassRate?: number;
    targetBugClosure?: number;
  }
) {
  return authJson(`/projects/${projectId}/milestones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateProjectMilestoneApi(
  projectId: string,
  milestoneId: string,
  payload: {
    name?: string;
    description?: string;
    targetDate?: string;
    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
    targetPassRate?: number;
    targetBugClosure?: number;
  }
) {
  return authJson(`/projects/${projectId}/milestones/${milestoneId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectMilestoneApi(projectId: string, milestoneId: string) {
  return authJson(`/projects/${projectId}/milestones/${milestoneId}`, {
    method: "DELETE",
  });
}

export async function linkMilestoneTestRunApi(projectId: string, milestoneId: string, testRunId: string) {
  return authJson(`/projects/${projectId}/milestones/${milestoneId}/link-test-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testRunId }),
  });
}

export async function getMilestoneProgressApi(projectId: string, milestoneId: string) {
  return authJson(`/projects/${projectId}/milestones/${milestoneId}/progress`);
}

export async function archiveAdminProjectApi(id: string) {
  return authJson(`/admin/projects/${id}/archive`, {
    method: "POST",
  });
}

export async function restoreAdminProjectApi(id: string) {
  return authJson(`/admin/projects/${id}/restore`, {
    method: "POST",
  });
}

export async function listAdminAuditLogsApi(entityType?: string) {
  const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";
  return authJson(`/admin/audit-logs${query}`);
}

export async function listAdminSystemConfigsApi() {
  return authJson("/admin/system-config");
}

export async function getMyRolePermissionsApi() {
  return authJson("/admin/role-permissions/me");
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
  const payload = await authJson(`/notifications/bugs${query ? `?${query}` : ""}`);
  const notifications = Array.isArray(payload?.notifications)
    ? payload.notifications
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
  return { ...payload, notifications };
}

export async function markBugNotificationReadApi(notificationId: string) {
  return authJson(`/notifications/bugs/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function listNotificationsApi(params?: { unread?: "0" | "1"; take?: number }) {
  const qp = new URLSearchParams();
  if (params?.unread) qp.set("unread", params.unread);
  if (typeof params?.take === "number") qp.set("take", String(params.take));
  const query = qp.toString();
  const payload = await authJson(`/notifications${query ? `?${query}` : ""}`);
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.notifications)
      ? payload.notifications
      : [];
  return {
    ...payload,
    items,
    unreadCount: Number(payload?.unreadCount || 0),
  };
}

export async function markNotificationReadApi(notificationId: string) {
  return authJson(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsReadApi() {
  return authJson("/notifications/read-all", {
    method: "PATCH",
  });
}

export async function getNotificationPreferencesApi() {
  return authJson("/notification-preferences");
}

export async function updateNotificationPreferencesApi(payload: {
  emailBugAssigned?: boolean;
  emailComments?: boolean;
  emailStatusChange?: boolean;
  emailTestAssigned?: boolean;
  emailRetestRequested?: boolean;
  inAppBugAssigned?: boolean;
  inAppComments?: boolean;
  inAppStatusChange?: boolean;
  inAppTestAssigned?: boolean;
  inAppRetestRequested?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}) {
  return authJson("/notification-preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
