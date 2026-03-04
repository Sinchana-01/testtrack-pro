import React from "react";

type MemberRow = {
  id: string;
  roleInProject: "ADMIN" | "TESTER" | "DEVELOPER";
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
};

type Props = {
  rows: MemberRow[];
  isAdmin: boolean;
  disabled?: boolean;
  onChangeRole: (memberId: string, role: "ADMIN" | "TESTER" | "DEVELOPER") => Promise<void> | void;
  onRemove: (memberId: string) => Promise<void> | void;
};

const MemberTable: React.FC<Props> = ({ rows, isAdmin, disabled, onChangeRole, onRemove }) => {
  return (
    <div className="tableWrap adminUsersTableWrap">
      <table className="table adminUsersTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role in Project</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="note">
                No members found.
              </td>
            </tr>
          ) : (
            rows.map((member) => (
              <tr key={member.id}>
                <td>{member.user?.name || "N/A"}</td>
                <td>{member.user?.email || "N/A"}</td>
                <td>
                  {isAdmin ? (
                    <select
                      className="input"
                      value={member.roleInProject}
                      disabled={Boolean(disabled)}
                      onChange={(e) =>
                        onChangeRole(member.id, e.target.value as "ADMIN" | "TESTER" | "DEVELOPER")
                      }
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="TESTER">TESTER</option>
                      <option value="DEVELOPER">DEVELOPER</option>
                    </select>
                  ) : (
                    member.roleInProject
                  )}
                </td>
                <td>
                  {isAdmin ? (
                    <button className="button tiny danger" onClick={() => onRemove(member.id)} disabled={Boolean(disabled)}>
                      Remove
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MemberTable;

