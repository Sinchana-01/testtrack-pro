import { useEffect, useState } from "react";

interface RegisterProps {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  isLoading: boolean;
  error?: string;
  setName: (val: string) => void;
  setEmail: (val: string) => void;
  setPassword: (val: string) => void;
  setConfirmPassword: (val: string) => void;
  setRole: (val: string) => void;
  onRegister: () => void;
  goToLogin: () => void;
}

const Register = ({
  name,
  email,
  password,
  confirmPassword,
  role,
  isLoading,
  error,
  setName,
  setEmail,
  setPassword,
  setConfirmPassword,
  setRole,
  onRegister,
  goToLogin,
}: RegisterProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("");
  }, [setName, setEmail, setPassword, setConfirmPassword, setRole]);

  return (
    <section className="authScreen">
      <div className="authCenterCard">
        <input className="autoFillTrap" type="text" autoComplete="username" tabIndex={-1} />
        <input className="autoFillTrap" type="password" autoComplete="new-password" tabIndex={-1} />
        <h3 className="authHeader">Create Account</h3>
        <p className="authSubheader">Join TestTrack Pro</p>

        <label className="fieldLabel">Full Name</label>
        <input className="input" autoComplete="off" name="register_name_input" data-lpignore="true" data-1p-ignore="true" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="fieldLabel">Email</label>
        <input
          className="input"
          type="email"
          autoComplete="one-time-code"
          name="register_email_input"
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
            name="register_password_input"
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

        <label className="fieldLabel">Confirm Password</label>
        <div className="passwordInputWrap">
          <input
            className="input passwordInput"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            name="register_confirm_password_input"
            data-lpignore="true"
            data-1p-ignore="true"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            type="button"
            className="passwordToggle"
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            onClick={() => setShowConfirmPassword((prev) => !prev)}
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
              {showConfirmPassword ? (
                <path
                  d="M4 4 20 20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
            <span className="srOnly">
              {showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            </span>
          </button>
        </div>

        <label className="fieldLabel">Role</label>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Select role</option>
          <option value="TESTER">Tester</option>
          <option value="DEVELOPER">Developer</option>
        </select>

        {error ? <div className="authInlineError">{error}</div> : null}

        <button className="button" onClick={onRegister} disabled={isLoading}>
          {isLoading ? <span className="buttonSpinner" /> : null}
          {isLoading ? "Creating account..." : "Register"}
        </button>

        <div className="link" onClick={goToLogin}>
          Already have an account? Login
        </div>
      </div>
    </section>
  );
};

export default Register;
