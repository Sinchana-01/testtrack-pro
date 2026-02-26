import React, { useState } from "react";

interface AdminDashboardProps {
  users: any[];
  onToggleActive: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  onToggleActive,
  onDeleteUser,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "users">("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f4f6f9" }}>
      
      {/* ================= SIDEBAR ================= */}
      <div
        style={{
          width: sidebarOpen ? "240px" : "70px",
          transition: "0.3s",
          background: "#f1fae3",
          color: "white",
          padding: "30px 15px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* HAMBURGER */}
        <div
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            cursor: "pointer",
            marginBottom: "40px",
          }}
        >
          <div style={{ height: "3px", background: "white", margin: "6px 0" }} />
          <div style={{ height: "3px", background: "white", margin: "6px 0" }} />
          <div style={{ height: "3px", background: "white", margin: "6px 0" }} />
        </div>

        {sidebarOpen && (
          <>
            <div
              onClick={() => setActiveTab("overview")}
              style={{
                padding: "10px",
                borderRadius: "6px",
                marginBottom: "15px",
                cursor: "pointer",
                background: activeTab === "overview" ? "#dae2ec" : "transparent",
              }}
            >
              Overview
            </div>

            <div
              onClick={() => setActiveTab("users")}
              style={{
                padding: "10px",
                borderRadius: "6px",
                marginBottom: "15px",
                cursor: "pointer",
                background: activeTab === "users" ? "#1f2937" : "transparent",
              }}
            >
              Manage Users
            </div>

            <div
              onClick={onLogout}
              style={{
                marginTop: "auto",
                padding: "10px",
                borderRadius: "6px",
                cursor: "pointer",
                background: "#7f1d1d",
                textAlign: "center",
              }}
            >
              Logout
            </div>
          </>
        )}
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div style={{ flex: 1, padding: "50px" }}>

        {/* -------- OVERVIEW -------- */}
        {activeTab === "overview" && (
          <>
            <h1 style={{ marginBottom: "30px" }}>Admin Overview</h1>

            <div style={{ display: "flex", gap: "20px" }}>
              
              <div
                style={{
                  flex: 1,
                  background: "white",
                  padding: "30px",
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                }}
              >
                <h3>Total Users</h3>
                <p style={{ fontSize: "32px", fontWeight: 700 }}>
                  {users.length}
                </p>
              </div>

              <div
                style={{
                  flex: 1,
                  background: "white",
                  padding: "30px",
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                }}
              >
                <h3>Active Users</h3>
                <p style={{ fontSize: "32px", fontWeight: 700 }}>
                  {users.filter((u) => u.isActive).length}
                </p>
              </div>

            </div>
          </>
        )}

        {/* -------- USER MANAGEMENT -------- */}
        {activeTab === "users" && (
          <>
            <h1 style={{ marginBottom: "30px" }}>User Management</h1>

            <div
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
              }}
            >
              {users.length === 0 && <p>No users found.</p>}

              {users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "15px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div>
                    <strong>{user.name}</strong>
                    <div style={{ fontSize: "13px", color: "#555" }}>
                      {user.email} • {user.role}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => onToggleActive(user.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: user.isActive ? "#f59e0b" : "#10b981",
                        color: "white",
                      }}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={() => onDeleteUser(user.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: "#ef4444",
                        color: "white",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;