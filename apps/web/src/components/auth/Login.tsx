import { useEffect, useState } from "react";

interface LoginProps {
  email: string;
  password: string;
  rememberMe: boolean;
  isLoading: boolean;
  error?: string;
  setEmail: (val: string) => void;
  setPassword: (val: string) => void;
  setRememberMe: (val: boolean) => void;
  onLogin: () => void;
  goToRegister: () => void;
  goToForgot: () => void;
}

const Login = ({
  email,
  password,
  rememberMe,
  isLoading,
  error,
  setEmail,
  setPassword,
  setRememberMe,
  onLogin,
  goToRegister,
  goToForgot,
}: LoginProps) => {
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setEmail("");
    setPassword("");
    setRememberMe(false);
  }, [setEmail, setPassword, setRememberMe]);

  return (
    <section className="authScreen">
      <div className="authCenterCard">
        <input className="autoFillTrap" type="text" autoComplete="username" tabIndex={-1} />
        <input className="autoFillTrap" type="password" autoComplete="new-password" tabIndex={-1} />
        <h3 className="authHeader">Welcome Back</h3>
        <p className="authSubheader">Sign in to continue to TestTrack Pro</p>

        <label className="fieldLabel">Email</label>
        <input
          className="input"
          type="email"
          autoComplete="one-time-code"
          name="login_email_input"
          data-lpignore="true"
          data-1p-ignore="true"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="fieldLabel">Password</label>
        <div className="passwordInputWrap">
          <input
            className="input passwordInput"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            name="login_password_input"
            data-lpignore="true"
            data-1p-ignore="true"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="passwordToggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            <svg className="eyeIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M2 12C3.8 8.5 7.3 6 12 6c4.7 0 8.2 2.5 10 6-1.8 3.5-5.3 6-10 6-4.7 0-8.2-2.5-10-6Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              {showPassword ? (
                <path
                  d="M4 4 20 20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
            <span className="srOnly">{showPassword ? "Hide password" : "Show password"}</span>
          </button>
        </div>

        <div className="remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span>Remember me</span>
        </div>

        {error ? <div className="authInlineError">{error}</div> : null}

        <button className="button" onClick={onLogin} disabled={isLoading}>
          {isLoading ? <span className="buttonSpinner" /> : null}
          {isLoading ? "Signing in..." : "Login"}
        </button>

        <div className="link" onClick={goToForgot}>
          Forgot password?
        </div>
        <div className="link" onClick={goToRegister}>
          New user? Register
        </div>
      </div>
    </section>
  );
};

export default Login;
