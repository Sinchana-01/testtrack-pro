import { useState } from "react";
import { loginApi, registerApi, resetPasswordApi } from "./api.ts";
import "./App.css";

type Screen = "login" | "register" | "forgot" | "dashboard";

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("TESTER");
  const [rememberMe, setRememberMe] = useState(false);

  /* PASSWORD RULES */
  const isValidPassword = (pwd: string) =>
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[@$!%*?&]/.test(pwd);

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
      alert("Invalid email or password");
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
              Password must include uppercase, number & special character
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
            <h3>Reset Password</h3>

            <input
              className="input"
              placeholder="Registered email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input"
              type="password"
              placeholder="New password"
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              className="button"
              onClick={async () => {
                if (!isValidPassword(password)) {
                  alert(
                    "Password must be at least 8 chars and include uppercase, number, and special character"
                  );
                  return;
                }

                const res = await resetPasswordApi(email, password);
                alert(res.message);
                setScreen("login");
              }}
            >
              Reset Password
            </button>

            <div className="link" onClick={() => setScreen("login")}>
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
