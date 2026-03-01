interface ForgotPasswordProps {
  email: string;
  isLoading: boolean;
  error?: string;
  setEmail: (val: string) => void;
  onSubmit: () => void;
  goToLogin: () => void;
}

const ForgotPassword = ({
  email,
  isLoading,
  error,
  setEmail,
  onSubmit,
  goToLogin,
}: ForgotPasswordProps) => {
  return (
    <section className="authScreen">
      <div className="authCenterCard">
        <input className="autoFillTrap" type="text" autoComplete="username" tabIndex={-1} />
        <h3 className="authHeader">Forgot Password</h3>
        <p className="authSubheader">
          Enter your registered email to receive a reset link.
        </p>

        <label className="fieldLabel">Email Address</label>
        <input
          className="input"
          type="email"
          autoComplete="one-time-code"
          name="forgot_email_input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error ? <div className="authInlineError">{error}</div> : null}

        <button className="button" onClick={onSubmit} disabled={isLoading}>
          {isLoading ? <span className="buttonSpinner" /> : null}
          {isLoading ? "Sending..." : "Send Reset Link"}
        </button>

        <div className="link" onClick={goToLogin}>
          Back to Login
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;
