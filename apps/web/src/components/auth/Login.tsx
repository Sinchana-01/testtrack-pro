import React from "react";

interface LoginProps {
  email: string;
  password: string;
  rememberMe: boolean;
  isLoading: boolean;
  setEmail: (val: string) => void;
  setPassword: (val: string) => void;
  setRememberMe: (val: boolean) => void;
  onLogin: () => void;
  goToRegister: () => void;
  goToForgot: () => void;
}

const Login: React.FC<LoginProps> = ({
  email,
  password,
  rememberMe,
  isLoading,
  setEmail,
  setPassword,
  setRememberMe,
  onLogin,
  goToRegister,
  goToForgot,
}) => {
 return (
  <>

  <div style={{ textAlign: "center", color: "white", marginBottom: "40px" }}>
    <h1 style={{ fontSize: "40px", fontWeight: 900, margin: 0 }}>
      TestTrack Pro
    </h1>
    <p style={{ marginTop: "8px" }}>
      Enterprise Test Management Platform
    </p>
  </div>

  <div className="authCard">

    <div className="authTitle">Sign In</div>
    <div className="authSubtitle">Access your dashboard</div>

    <label className="fieldLabel">Email Address</label>
    <input
      className="input"
      type="email"
      autoComplete="new-email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />

    <label className="fieldLabel">Password</label>
    <input
      className="input"
      type="password"
      autoComplete="new-password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />

    <button
      className="button"
      onClick={onLogin}
      disabled={isLoading}
    >
      {isLoading ? "Signing in..." : "Login"}
    </button>

    <div className="link" onClick={goToForgot}>
      Forgot password?
    </div>

    <div className="link" onClick={goToRegister}>
      New user? Register
    </div>

  </div>
</>
);};
export default Login;