import { useEffect, useState } from "react";
import { loginApi, registerApi, forgotPasswordApi, resetPasswordApi } from "./api";
import "./App.css";

type Screen = "login" | "register" | "forgot" | "reset" | "dashboard";

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState("TESTER");
  const [rememberMe, setRememberMe] = useState(false);
  const [resetToken, setResetToken] = useState("");

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

    if (res.token) {
      localStorage.setItem("token", res.token);
      setScreen("dashboard");
    } else {
      alert(res.message || "Invalid email or password");
    }
  };

  /* LOGOUT */
  const handleLogout = () => {
    localStorage.removeItem("token");
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
          <>
            <h3>Dashboard</h3>
            <p>You are logged in successfully.</p>
            <button className="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
