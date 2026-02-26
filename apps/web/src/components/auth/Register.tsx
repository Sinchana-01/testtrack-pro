import React from "react";

interface RegisterProps {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  isLoading: boolean;
  setName: (val: string) => void;
  setEmail: (val: string) => void;
  setPassword: (val: string) => void;
  setConfirmPassword: (val: string) => void;
  setRole: (val: string) => void;
  onRegister: () => void;
  goToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({
  name,
  email,
  password,
  confirmPassword,
  role,
  isLoading,
  setName,
  setEmail,
  setPassword,
  setConfirmPassword,
  setRole,
  onRegister,
  goToLogin,
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

    <div className="authLayout">
      {/* LEFT SIDE */}
      <div className="authLeft">
        <div className="authLeftContent">
          <h1>TestTrack Pro</h1>
          <p>Create your account and start managing test cycles efficiently.</p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="authRight">
        <div className="authCard">

          <div className="authTitle">Create Account</div>
          <div className="authSubtitle">
            Join TestTrack Pro today
          </div>

          <label className="fieldLabel">Full Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="fieldLabel">Email</label>
          <input
            className="input"
            type="email"
            autoComplete="off"
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

          <label className="fieldLabel">Confirm Password</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <label className="fieldLabel">Role</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Select role</option>
            <option value="TESTER">Tester</option>
            <option value="DEVELOPER">Developer</option>
          </select>

          <button
            className="button"
            onClick={onRegister}
            disabled={isLoading}
          >
            {isLoading ? "Creating Account..." : "Register"}
          </button>

          <div className="link" onClick={goToLogin}>
            Already have an account? Login
          </div>

        </div>
      </div>
    </div>
    </>
  );
};

export default Register;