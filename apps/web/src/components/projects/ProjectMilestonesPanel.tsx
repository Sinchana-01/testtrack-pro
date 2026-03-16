import React, { useMemo, useState } from "react";
import "./ProjectMilestonesPanel.css";

type MilestoneRow = {
  id: string;
  name: string;
  description?: string;
  targetDate?: string;
  status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
  targetPassRate?: number | null;
  targetBugClosure?: number | null;
  testRuns?: Array<{ id: string; name: string; status: string }>;
};

type TestRunRow = {
  id: string;
  name: string;
  status?: string;
};

type Props = {
  milestones: MilestoneRow[];
  testRuns: TestRunRow[];
  selectedMilestoneId: string;
  progress?: {
    metrics?: { passRate?: number; bugClosureRate?: number };
    testRuns?: Array<{ id: string; name: string; status: string }>;
  } | null;
  progressLoading?: boolean;
  disabled?: boolean;
  onSelect: (milestoneId: string) => void;
  onCreate: (payload: {
    name: string;
    description?: string;
    targetDate: string;
    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
    targetPassRate?: number;
    targetBugClosure?: number;
  }) => Promise<void> | void;
  onUpdate: (
    milestoneId: string,
    payload: {
      name?: string;
      description?: string;
      targetDate?: string;
      status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
      targetPassRate?: number;
      targetBugClosure?: number;
    }
  ) => Promise<void> | void;
  onDelete: (milestoneId: string) => Promise<void> | void;
  onLinkTestRun: (milestoneId: string, testRunId: string) => Promise<void> | void;
};

const asDateInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const ProjectMilestonesPanel: React.FC<Props> = ({
  milestones,
  testRuns,
  selectedMilestoneId,
  progress,
  progressLoading,
  disabled = false,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onLinkTestRun,
}) => {
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formStatus, setFormStatus] = useState<"PLANNED" | "IN_PROGRESS" | "COMPLETED" | "MISSED">("PLANNED");
  const [formTargetPassRate, setFormTargetPassRate] = useState("");
  const [formTargetBugClosure, setFormTargetBugClosure] = useState("");
  const [linkRunId, setLinkRunId] = useState("");
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

  const selectedMilestone = milestones.find((m) => m.id === selectedMilestoneId) || null;
  const targetPassRateLabel = Number.isFinite(Number(progress?.metrics?.passRate))
    ? `${Number(progress?.metrics?.passRate || 0).toFixed(1)}%`
    : "N/A";
  const targetBugClosureLabel = Number.isFinite(Number(progress?.metrics?.bugClosureRate))
    ? `${Number(progress?.metrics?.bugClosureRate || 0).toFixed(1)}%`
    : "N/A";

  const linkedRuns: Array<{ id: string; name: string; status?: string }> = useMemo(() => {
    const fromProgress: Array<{ id: string; name: string; status?: string }> = Array.isArray(progress?.testRuns)
      ? (progress?.testRuns as Array<{ id: string; name: string; status?: string }>)
      : [];
    if (fromProgress.length > 0) return fromProgress;
    return Array.isArray(selectedMilestone?.testRuns)
      ? (selectedMilestone?.testRuns as Array<{ id: string; name: string; status?: string }>)
      : [];
  }, [progress, selectedMilestone]);

  const resetForm = () => {
    setFormMode("create");
    setFormName("");
    setFormDescription("");
    setFormTargetDate("");
    setFormStatus("PLANNED");
    setFormTargetPassRate("");
    setFormTargetBugClosure("");
  };

  const loadEdit = () => {
    if (!selectedMilestone) return;
    setFormMode("edit");
    setFormName(selectedMilestone.name || "");
    setFormDescription(selectedMilestone.description || "");
    setFormTargetDate(asDateInput(selectedMilestone.targetDate));
    setFormStatus(selectedMilestone.status || "PLANNED");
    setFormTargetPassRate(
      selectedMilestone.targetPassRate !== undefined && selectedMilestone.targetPassRate !== null
        ? String(selectedMilestone.targetPassRate)
        : ""
    );
    setFormTargetBugClosure(
      selectedMilestone.targetBugClosure !== undefined && selectedMilestone.targetBugClosure !== null
        ? String(selectedMilestone.targetBugClosure)
        : ""
    );
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formTargetDate.trim()) return;
    const payload = {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      targetDate: formTargetDate,
      status: formStatus,
      targetPassRate: formTargetPassRate ? Number(formTargetPassRate) : undefined,
      targetBugClosure: formTargetBugClosure ? Number(formTargetBugClosure) : undefined,
    };
    if (formMode === "create") {
      await onCreate(payload);
      resetForm();
      setShowMilestoneModal(false);
      return;
    }
    if (selectedMilestone) {
      await onUpdate(selectedMilestone.id, payload);
      setShowMilestoneModal(false);
    }
  };

  return (
    <div className="projectMilestonesPanel">
      <div className="projectMilestonesList">
          <div className="panelHeader">
            <h4>Milestones</h4>
            <button
              className="button small"
              onClick={() => {
                resetForm();
                setShowMilestoneModal(true);
              }}
              disabled={disabled}
            >
              New Milestone
            </button>
          </div>
          {milestones.length === 0 ? (
            <div className="note">No milestones yet.</div>
          ) : (
            <div className="milestoneList">
                {milestones.map((row) => {
                  const currentPassRate =
                    row.id === selectedMilestoneId ? Number(progress?.metrics?.passRate || 0) : 0;
                  const targetPassRate =
                    row.targetPassRate !== undefined && row.targetPassRate !== null
                      ? Number(row.targetPassRate)
                      : null;
                  const hasTarget = Number.isFinite(targetPassRate || NaN);
                  const ratio = hasTarget && targetPassRate ? Math.min(currentPassRate / targetPassRate, 1) : 0;
                  const progressLabel = hasTarget
                    ? `${Number(currentPassRate || 0).toFixed(0)}% / ${Number(targetPassRate || 0).toFixed(0)}%`
                    : "No target";
                  return (
                  <button
                    key={row.id}
                    type="button"
                    className={`milestoneListItem ${row.id === selectedMilestoneId ? "active" : ""}`}
                    onClick={() => onSelect(row.id)}
                  >
                    <div className="milestoneTitleRow">
                      <strong>{row.name || "Untitled milestone"}</strong>
                      <span className={`milestoneStatus ${String(row.status || "PLANNED").toLowerCase()}`}>
                        {row.status || "PLANNED"}
                      </span>
                    </div>
                    <div className="milestoneMetaRow">
                      <span>Target: {asDateInput(row.targetDate) || "N/A"}</span>
                      <span>Pass Target: {row.targetPassRate ?? "N/A"}%</span>
                    </div>
                    <div className="milestoneProgressTiny">
                      <div className="milestoneProgressTrack">
                        <div className="milestoneProgressFill" style={{ width: `${ratio * 100}%` }} />
                      </div>
                      <span className="milestoneProgressLabel">{progressLabel}</span>
                    </div>
                  </button>
                );
                })}
            </div>
          )}
        </div>

      {showMilestoneModal ? (
        <div className="modalBackdrop milestoneModalBackdrop" onClick={() => setShowMilestoneModal(false)}>
          <div className="modalCard milestoneModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeaderRow">
              <h4>{formMode === "create" ? "Create Milestone" : "Edit Milestone"}</h4>
              <button className="iconButton" onClick={() => setShowMilestoneModal(false)}>
                X
              </button>
            </div>
            {selectedMilestone ? (
              <div className="inlineActions">
                <button className="button small" onClick={loadEdit} disabled={disabled}>
                  Load Selected
                </button>
                <button
                  className="button small danger"
                  onClick={() => selectedMilestone && onDelete(selectedMilestone.id)}
                  disabled={disabled}
                >
                  Delete
                </button>
              </div>
            ) : null}
            <div className="milestoneForm">
              <label className="field">
                <span>Milestone Name</span>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Beta Release"
                  disabled={disabled}
                />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea
                  className="input"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  disabled={disabled}
                />
              </label>
              <div className="inlineGrid">
                <label className="field">
                  <span>Target Date</span>
                  <input
                    className="input"
                    type="date"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    disabled={disabled}
                  />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    className="input"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    disabled={disabled}
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="MISSED">Missed</option>
                  </select>
                </label>
              </div>
              <div className="inlineGrid">
                <label className="field">
                  <span>Target Pass Rate (%)</span>
                  <input
                    className="input"
                    value={formTargetPassRate}
                    onChange={(e) => setFormTargetPassRate(e.target.value)}
                    placeholder="95"
                    disabled={disabled}
                  />
                </label>
                <label className="field">
                  <span>Target Bug Closure (%)</span>
                  <input
                    className="input"
                    value={formTargetBugClosure}
                    onChange={(e) => setFormTargetBugClosure(e.target.value)}
                    placeholder="90"
                    disabled={disabled}
                  />
                </label>
              </div>
              <div className="toolbarActions">
                <button className="button small" onClick={handleSubmit} disabled={disabled || !formName || !formTargetDate}>
                  {formMode === "create" ? "Create Milestone" : "Save Changes"}
                </button>
                <button
                  className="button small secondary"
                  onClick={() => {
                    resetForm();
                    setShowMilestoneModal(false);
                  }}
                  disabled={disabled}
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="milestoneProgress">
              <div className="panelHeader">
                <h4>Milestone Progress</h4>
              </div>
              {progressLoading ? (
                <div className="note">Loading progress...</div>
              ) : (
                <div className="milestoneProgressGrid">
                  <div className="milestoneProgressCard">
                    <span>Pass Rate</span>
                    <strong>{targetPassRateLabel}</strong>
                  </div>
                  <div className="milestoneProgressCard">
                    <span>Bug Closure</span>
                    <strong>{targetBugClosureLabel}</strong>
                  </div>
                  <div className="milestoneProgressCard">
                    <span>Linked Runs</span>
                    <strong>{linkedRuns.length}</strong>
                  </div>
                </div>
              )}
            </div>
            <div className="milestoneLinker">
              <div className="panelHeader">
                <h4>Link Test Run</h4>
              </div>
              <div className="inlineGrid">
                <select
                  className="input"
                  value={linkRunId}
                  onChange={(e) => setLinkRunId(e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Select a test run</option>
                  {testRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.name} ({run.status || "N/A"})
                    </option>
                  ))}
                </select>
                <button
                  className="button small"
                  onClick={() => {
                    if (!selectedMilestone || !linkRunId) return;
                    onLinkTestRun(selectedMilestone.id, linkRunId);
                    setLinkRunId("");
                  }}
                  disabled={disabled || !selectedMilestone || !linkRunId}
                >
                  Link Run
                </button>
              </div>
              {linkedRuns.length > 0 ? (
                <div className="linkedRunsList">
                  {linkedRuns.map((run) => (
                    <div key={run.id} className="linkedRunItem">
                      <span>{run.name}</span>
                      <span className="note">{run.status || "N/A"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="note">No test runs linked to this milestone.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProjectMilestonesPanel;
