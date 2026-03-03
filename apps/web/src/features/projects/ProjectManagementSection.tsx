import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMilestoneProgressApi,
  getProjectConfigurationApi,
  listProjectMembersApi,
  listProjectMilestonesApi,
  removeProjectMemberApi,
  updateProjectConfigurationApi,
  upsertProjectMemberApi,
  createProjectMilestoneApi,
  linkMilestoneTestRunApi,
} from "../../api";

type ProjectItem = {
  id: string;
  name: string;
};

type Props = {
  projects: ProjectItem[];
  testRuns?: Array<{ id: string; name: string }>;
};

const ProjectManagementSection: React.FC<Props> = ({ projects, testRuns = [] }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || "");
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"ADMIN" | "TESTER" | "DEVELOPER">("TESTER");
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [linkTestRunId, setLinkTestRunId] = useState("");
  const [modulesText, setModulesText] = useState("[]");
  const [environmentsText, setEnvironmentsText] = useState("[]");
  const [customFieldsText, setCustomFieldsText] = useState("[]");
  const [workflowConfigText, setWorkflowConfigText] = useState("{}");

  const membersQuery = useQuery<any[], Error>({
    queryKey: ["project-members", selectedProjectId],
    queryFn: () => listProjectMembersApi(selectedProjectId),
    enabled: Boolean(selectedProjectId),
    keepPreviousData: true,
  });
  const configQuery = useQuery<any, Error>({
    queryKey: ["project-config", selectedProjectId],
    queryFn: () => getProjectConfigurationApi(selectedProjectId),
    enabled: Boolean(selectedProjectId),
    keepPreviousData: true,
    onSuccess: (data) => {
      setModulesText(JSON.stringify(data?.modules || [], null, 2));
      setEnvironmentsText(JSON.stringify(data?.environments || [], null, 2));
      setCustomFieldsText(JSON.stringify(data?.customFields || [], null, 2));
      setWorkflowConfigText(JSON.stringify(data?.workflowConfig || {}, null, 2));
    },
  });
  const milestonesQuery = useQuery<any[], Error>({
    queryKey: ["project-milestones", selectedProjectId],
    queryFn: () => listProjectMilestonesApi(selectedProjectId),
    enabled: Boolean(selectedProjectId),
    keepPreviousData: true,
  });
  const progressQuery = useQuery<any, Error>({
    queryKey: ["milestone-progress", selectedProjectId, selectedMilestoneId],
    queryFn: () => getMilestoneProgressApi(selectedProjectId, selectedMilestoneId),
    enabled: Boolean(selectedProjectId && selectedMilestoneId),
    keepPreviousData: true,
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const addMember = async () => {
    if (!selectedProjectId || !newMemberUserId.trim()) return;
    await upsertProjectMemberApi(selectedProjectId, {
      userId: newMemberUserId.trim(),
      roleInProject: newMemberRole,
    });
    setNewMemberUserId("");
    await membersQuery.refetch();
  };

  const removeMember = async (memberId: string) => {
    if (!selectedProjectId) return;
    await removeProjectMemberApi(selectedProjectId, memberId);
    await membersQuery.refetch();
  };

  const saveConfiguration = async () => {
    if (!selectedProjectId) return;
    await updateProjectConfigurationApi(selectedProjectId, {
      modules: JSON.parse(modulesText || "[]"),
      environments: JSON.parse(environmentsText || "[]"),
      customFields: JSON.parse(customFieldsText || "[]"),
      workflowConfig: JSON.parse(workflowConfigText || "{}"),
    });
    await configQuery.refetch();
  };

  const createMilestone = async () => {
    if (!selectedProjectId || !milestoneName.trim() || !milestoneDate) return;
    await createProjectMilestoneApi(selectedProjectId, {
      name: milestoneName.trim(),
      targetDate: new Date(milestoneDate).toISOString(),
    });
    setMilestoneName("");
    setMilestoneDate("");
    await milestonesQuery.refetch();
  };

  const linkRun = async () => {
    if (!selectedProjectId || !selectedMilestoneId || !linkTestRunId) return;
    await linkMilestoneTestRunApi(selectedProjectId, selectedMilestoneId, linkTestRunId);
    await Promise.all([milestonesQuery.refetch(), progressQuery.refetch()]);
  };

  return (
    <section className="panel">
      <h4>Project Management</h4>
      <div className="inlineGrid">
        <select className="input" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      {!selectedProject ? (
        <p className="note">No projects available.</p>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <strong>{selectedProject.name}</strong>
          </div>

          <div className="inlineGrid" style={{ alignItems: "start" }}>
            <div>
              <h5>Members</h5>
              <div className="inlineGrid">
                <input
                  className="input"
                  placeholder="User ID"
                  value={newMemberUserId}
                  onChange={(e) => setNewMemberUserId(e.target.value)}
                />
                <select className="input" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value as any)}>
                  <option value="ADMIN">Admin</option>
                  <option value="TESTER">Tester</option>
                  <option value="DEVELOPER">Developer</option>
                </select>
              </div>
              <button className="button small" onClick={addMember}>
                Add Member
              </button>
              <div className="tableWrap adminUsersTableWrap" style={{ marginTop: 10 }}>
                <table className="table adminUsersTable">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(membersQuery.data || []).map((member: any) => (
                      <tr key={member.id}>
                        <td>{member.user?.name || "-"}</td>
                        <td>{member.user?.email || "-"}</td>
                        <td>{member.roleInProject}</td>
                        <td>
                          <button className="button tiny danger" onClick={() => removeMember(member.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h5>Configuration</h5>
              <label className="label">Modules (JSON)</label>
              <textarea className="input" rows={3} value={modulesText} onChange={(e) => setModulesText(e.target.value)} />
              <label className="label">Environments (JSON)</label>
              <textarea className="input" rows={3} value={environmentsText} onChange={(e) => setEnvironmentsText(e.target.value)} />
              <label className="label">Custom Fields (JSON)</label>
              <textarea className="input" rows={3} value={customFieldsText} onChange={(e) => setCustomFieldsText(e.target.value)} />
              <label className="label">Workflow Config (JSON)</label>
              <textarea className="input" rows={4} value={workflowConfigText} onChange={(e) => setWorkflowConfigText(e.target.value)} />
              <button className="button small" onClick={saveConfiguration}>
                Save Configuration
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h5>Milestones</h5>
            <div className="inlineGrid">
              <input
                className="input"
                placeholder="Milestone name"
                value={milestoneName}
                onChange={(e) => setMilestoneName(e.target.value)}
              />
              <input className="input" type="date" value={milestoneDate} onChange={(e) => setMilestoneDate(e.target.value)} />
            </div>
            <button className="button small" onClick={createMilestone}>
              Create Milestone
            </button>

            <div className="inlineGrid" style={{ marginTop: 10 }}>
              <select className="input" value={selectedMilestoneId} onChange={(e) => setSelectedMilestoneId(e.target.value)}>
                <option value="">Select milestone</option>
                {(milestonesQuery.data || []).map((milestone: any) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </option>
                ))}
              </select>
              <select className="input" value={linkTestRunId} onChange={(e) => setLinkTestRunId(e.target.value)}>
                <option value="">Link test run</option>
                {testRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="button small" onClick={linkRun}>
              Link Test Run
            </button>

            {progressQuery.data && (
              <div className="kpiRow" style={{ marginTop: 10 }}>
                <div className="kpiItem">
                  <strong>Pass Rate</strong>
                  <span>{progressQuery.data.metrics?.passRate ?? 0}%</span>
                </div>
                <div className="kpiItem">
                  <strong>Bug Closure</strong>
                  <span>{progressQuery.data.metrics?.bugClosureRate ?? 0}%</span>
                </div>
                <div className="kpiItem">
                  <strong>Linked Runs</strong>
                  <span>{(progressQuery.data.linkedTestRuns || []).length}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default ProjectManagementSection;
