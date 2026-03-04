import React, { useMemo, useState } from "react";
import MemberTable from "../../components/projects/MemberTable";

type ProjectDetailsData = {
  id: string;
  name: string;
  code: string;
  description: string;
  ownerName: string;
  status: "ACTIVE" | "ARCHIVED";
  memberCount: number;
  createdAt: string;
};

type MemberOption = {
  id: string;
  label: string;
  role: "ADMIN" | "TESTER" | "DEVELOPER";
};

type Props = {
  isAdmin: boolean;
  project: ProjectDetailsData | null;
  members: any[];
  milestones: any[];
  testCases: any[];
  testCasesLoading?: boolean;
  milestonePassRate?: number;
  milestoneBugClosureRate?: number;
  onBackToProjects: () => void;
  onEdit: () => void;
  onToggleArchive: () => void;
  onViewTestCases: () => Promise<void> | void;
  onAddMember: (userId: string, role: "ADMIN" | "TESTER" | "DEVELOPER") => Promise<void> | void;
  onChangeRole: (memberId: string, role: "ADMIN" | "TESTER" | "DEVELOPER") => Promise<void> | void;
  onRemoveMember: (memberId: string) => Promise<void> | void;
  userOptions: MemberOption[];
  disabledActions?: boolean;
};

const ProjectDetails: React.FC<Props> = ({
  isAdmin,
  project,
  members,
  milestones,
  testCases,
  testCasesLoading,
  milestonePassRate,
  milestoneBugClosureRate,
  onBackToProjects,
  onEdit,
  onToggleArchive,
  onViewTestCases,
  onAddMember,
  onChangeRole,
  onRemoveMember,
  userOptions,
  disabledActions,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "milestones">("overview");
  const [newMemberRole, setNewMemberRole] = useState<"ADMIN" | "TESTER" | "DEVELOPER">("TESTER");
  const [newMemberUserId, setNewMemberUserId] = useState("");

  const filteredOptions = useMemo(
    () => userOptions.filter((option) => option.role === newMemberRole),
    [userOptions, newMemberRole]
  );

  const isArchived = project?.status === "ARCHIVED";
  const createdLabel = project?.createdAt ? new Date(project.createdAt).toLocaleDateString() : "N/A";

  return (
    <section>
      <div className="projectDetailsHeader">
        <div>
          <div className="projectBreadcrumb">Projects &gt; {project?.name || "Project"}</div>
          <h3 className="projectDetailsTitle">{project?.name || "Project Details"}</h3>
          <span className={`projectStatusBadge ${isArchived ? "archived" : "active"}`}>{project?.status || "ACTIVE"}</span>
        </div>
        <div className="toolbarActions">
          {isAdmin ? (
            <button className="button small" onClick={onViewTestCases}>
              {testCasesLoading ? "Loading..." : "View Test Cases"}
            </button>
          ) : null}
          <button className="button small" onClick={onBackToProjects}>
            Back to Projects
          </button>
          {isAdmin ? (
            <>
              <button className="button small" onClick={onEdit} disabled={Boolean(disabledActions) || isArchived}>
                Edit
              </button>
              <button className="button small" onClick={onToggleArchive} disabled={Boolean(disabledActions)}>
                {isArchived ? "Restore" : "Archive"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="projectTabs">
        <button
          className={`projectTab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`projectTab ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          Members
        </button>
        <button
          className={`projectTab ${activeTab === "milestones" ? "active" : ""}`}
          onClick={() => setActiveTab("milestones")}
        >
          Milestones
        </button>
      </div>

      {activeTab === "overview" ? (
        <div className="projectOverviewSection">
          <div className="projectOverviewGrid">
            <div className="projectOverviewItem">
              <strong>Description</strong>
              <span>{project?.description || "No description"}</span>
            </div>
            <div className="projectOverviewItem">
              <strong>Owner</strong>
              <span>{project?.ownerName || "N/A"}</span>
            </div>
            <div className="projectOverviewItem">
              <strong>Created</strong>
              <span>{createdLabel}</span>
            </div>
            <div className="projectOverviewItem">
              <strong>Members</strong>
              <span>{project?.memberCount ?? 0}</span>
            </div>
            <div className="projectOverviewItem">
              <strong>Code</strong>
              <span>{project?.code || "N/A"}</span>
            </div>
          </div>

          {isAdmin ? (
            <div className="projectTestCaseList">
              <div className="panelHeader">
                <h4>Project Test Cases</h4>
              </div>
              {testCasesLoading ? (
                <div className="note">Loading test cases...</div>
              ) : testCases.length === 0 ? (
                <div className="projectEmptyState">No test cases found for this project.</div>
              ) : (
                <div className="tableWrap adminUsersTableWrap">
                  <table className="table adminUsersTable">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Code</th>
                        <th>Module</th>
                        <th>Priority</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testCases.map((tc: any) => (
                        <tr key={tc.id}>
                          <td>{tc.title || "Untitled"}</td>
                          <td>{tc.testCaseCode || "N/A"}</td>
                          <td>{tc.module || "General"}</td>
                          <td>{tc.priority || "N/A"}</td>
                          <td>{tc.status || "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "members" ? (
        <div className="projectMembersSection">
          {isAdmin ? (
            <div className="inlineGrid">
              <select className="input" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value as any)}>
                <option value="TESTER">Tester</option>
                <option value="DEVELOPER">Developer</option>
                <option value="ADMIN">Admin</option>
              </select>
              <select className="input" value={newMemberUserId} onChange={(e) => setNewMemberUserId(e.target.value)}>
                <option value="">Select user (name/email)</option>
                {filteredOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                className="button small"
                disabled={Boolean(disabledActions) || !newMemberUserId || isArchived}
                onClick={async () => {
                  await onAddMember(newMemberUserId, newMemberRole);
                  setNewMemberUserId("");
                }}
              >
                Add Member
              </button>
            </div>
          ) : null}
          <MemberTable
            rows={members as any[]}
            isAdmin={isAdmin}
            disabled={Boolean(disabledActions) || isArchived}
            onChangeRole={onChangeRole}
            onRemove={onRemoveMember}
          />
        </div>
      ) : null}

      {activeTab === "milestones" ? (
        <div className="projectMilestonesSection">
          {milestones.length === 0 ? (
            <div className="projectEmptyState">No milestones found</div>
          ) : (
            <div className="projectGrid">
              {milestones.map((milestone: any) => {
                const target = milestone?.targetDate ? new Date(milestone.targetDate).toLocaleDateString() : "N/A";
                return (
                  <article className="projectCard" key={milestone.id}>
                    <h3 className="projectCardTitle">{milestone.name || "Milestone"}</h3>
                    <p className="projectCardDescription">{milestone.description || "No description"}</p>
                    <div className="projectCardFooter">
                      <span>Status: {milestone.status || "PLANNED"}</span>
                      <span>Target: {target}</span>
                    </div>
                    <div className="projectProgressBlock">
                      <div className="projectProgressLabel">Pass Rate</div>
                      <div className="projectProgressBar">
                        <span style={{ width: `${Math.max(0, Math.min(100, Number(milestonePassRate || 0)))}%` }} />
                      </div>
                      <div className="projectProgressValue">{Number(milestonePassRate || 0).toFixed(1)}%</div>
                    </div>
                    <div className="projectProgressBlock">
                      <div className="projectProgressLabel">Bug Closure</div>
                      <div className="projectProgressBar">
                        <span style={{ width: `${Math.max(0, Math.min(100, Number(milestoneBugClosureRate || 0)))}%` }} />
                      </div>
                      <div className="projectProgressValue">{Number(milestoneBugClosureRate || 0).toFixed(1)}%</div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default ProjectDetails;
