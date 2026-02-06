const API_URL = "http://localhost:4000/api/auth";

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

/* RESET PASSWORD */
export async function resetPasswordApi(
  email: string,
  newPassword: string
) {
  const res = await fetch(`${API_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, newPassword }),
  });

  return res.json();
}
