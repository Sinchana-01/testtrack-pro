import React from "react";

interface ForgotPasswordProps {
  email: string;
  isLoading: boolean;
  setEmail: (val: string) => void;
  onSubmit: () => void;
  goToLogin: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({
  email,
  isLoading,
  setEmail,
  onSubmit,
  goToLogin,
}) => {
  return (
  <>
    {/* BRANDING */}
    <div style={{ textAlign: "center", color: "white", marginBottom: "40px" }}>
      <h1 style={{ fontSize: "40px", fontWeight: 900, margin: 0 }}>
        TestTrack Pro
      </h1>
      <p style={{ marginTop: "8px" }}>
        Enterprise Test Management Platform
      </p>
    </div>

    {/* CENTERED CARD */}
    <div className="authCard">

      <div className="authTitle">Forgot Password</div>
      <div className="authSubtitle">
        Enter your registered email to receive reset instructions
      </div>

      <label className="fieldLabel">Email Address</label>
      <input
        className="input"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        className="button"
        onClick={onSubmit}
        disabled={isLoading}
      >
        {isLoading ? "Sending..." : "Send Reset Link"}
      </button>

      <div className="link" onClick={goToLogin}>
        Back to Login
      </div>

    </div>
  </>
);
};

export default ForgotPassword;