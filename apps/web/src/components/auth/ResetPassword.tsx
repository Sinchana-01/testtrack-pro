import { useState } from "react";

type ResetPasswordProps = {
  resetToken: string;
  newPassword: string;
  isLoading: boolean;
  error?: string;
  setNewPassword: (value: string) => void;
  onSubmit: () => void;
  goToLogin: () => void;
};

export default function ResetPassword(props: ResetPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="authScreen">
      <div className="authCenterCard">
        <input className="autoFillTrap" type="password" autoComplete="new-password" tabIndex={-1} />
        <h3 className="authHeader">Reset Password</h3>
        <p className="authSubheader">Set a strong password for your account.</p>

        {!props.resetToken ? (
          <div className="authInlineError">Invalid reset link. Request a new link.</div>
        ) : (
          <>
            <label className="fieldLabel">New Password</label>
            <div className="passwordInputWrap">
              <input
                className="input passwordInput"
                type={showPassword ? "text" : "password"}
                autoComplete="off"
                name="reset_new_password_input"
                value={props.newPassword}
                onChange={(e) => props.setNewPassword(e.target.value)}
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
          </>
        )}

        {props.error ? <div className="authInlineError">{props.error}</div> : null}

        <button className="button" onClick={props.onSubmit} disabled={props.isLoading || !props.resetToken}>
          {props.isLoading ? <span className="buttonSpinner" /> : null}
          {props.isLoading ? "Updating..." : "Set New Password"}
        </button>

        <div className="link" onClick={props.goToLogin}>
          Back to Login
        </div>
      </div>
    </section>
  );
}
