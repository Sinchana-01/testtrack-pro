const API_URL =
  process.env.REACT_APP_API_URL?.trim() || "http://localhost:4000/api/auth";
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

export const getAccessToken = (): string => localStorage.getItem(ACCESS_TOKEN_KEY) || "";
export const getRefreshToken = (): string => localStorage.getItem(REFRESH_TOKEN_KEY) || "";

export const setSessionTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearSessionTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("token");
};

/* REGISTER */
export async function registerApi(
  name: string,
  email: string,
  password: string,
  role: string
) {
  const res = await fetch(`${API_URL}/register`, {
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
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe }),
  });

  return res.json();
}

/* FORGOT PASSWORD */
export async function forgotPasswordApi(email: string) {
  const res = await fetch(`${API_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return res.json();
}

/* RESET PASSWORD */
export async function resetPasswordApi(token: string, newPassword: string) {
  const res = await fetch(`${API_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });

  return res.json();
}

/* REFRESH TOKEN */
export async function refreshTokenApi(refreshToken: string) {
  const res = await fetch(`${API_URL}/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  return res.json();
}

/* LOGOUT ALL DEVICES */
export async function logoutAllApi() {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/logout-all`, {
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

  setSessionTokens(refreshed.accessToken, refreshed.refreshToken);
  accessToken = refreshed.accessToken;

  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
