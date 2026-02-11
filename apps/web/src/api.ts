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
  let accessToken = getAccessToken();
  const usingSessionStorage = Boolean(sessionStorage.getItem(REFRESH_TOKEN_KEY));
  let response = await fetch(input, {
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

  return fetch(input, {
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
  module: string;
  steps: unknown;
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

export async function cloneTestCaseApi(id: string) {
  return authJson(`/testcases/${id}/clone`, { method: "POST" });
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
