import React, { useEffect, useMemo, useState } from "react";
import "./ProjectConfigurationPanel.css";

type CustomFieldRow = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  optionsText: string;
};

type WorkflowStageRow = {
  id: string;
  value: string;
};

type Props = {
  configuration: any;
  loading?: boolean;
  saving?: boolean;
  disabled?: boolean;
  onSave: (payload: {
    customFields: Array<{ label: string; type: string; required: boolean; options?: string[] }>;
    workflowConfig: { statuses: string[] };
    modules: string[];
    environments: string[];
  }) => Promise<void> | void;
};

const createCustomFieldRow = (input?: any): CustomFieldRow => ({
  id: String(input?.id || `${Date.now()}-${Math.random()}`),
  label: String(input?.label || ""),
  type: String(input?.type || "TEXT"),
  required: Boolean(input?.required),
  optionsText: Array.isArray(input?.options) ? input.options.join(", ") : "",
});

const createWorkflowStageRow = (value = ""): WorkflowStageRow => ({
  id: `${Date.now()}-${Math.random()}`,
  value,
});

const normalizeList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

const ProjectConfigurationPanel: React.FC<Props> = ({
  configuration,
  loading = false,
  saving = false,
  disabled = false,
  onSave,
}) => {
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);
  const [workflowStages, setWorkflowStages] = useState<WorkflowStageRow[]>([]);
  const [modulesText, setModulesText] = useState("");
  const [environmentsText, setEnvironmentsText] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setCustomFields(
      Array.isArray(configuration?.customFields) && configuration.customFields.length > 0
        ? configuration.customFields.map((item: any) => createCustomFieldRow(item))
        : [createCustomFieldRow()]
    );
    const rawStatuses = Array.isArray(configuration?.workflowConfig?.statuses)
      ? configuration.workflowConfig.statuses
      : [];
    setWorkflowStages(rawStatuses.length > 0 ? rawStatuses.map((item: string) => createWorkflowStageRow(item)) : [createWorkflowStageRow("OPEN"), createWorkflowStageRow("IN_PROGRESS"), createWorkflowStageRow("CLOSED")]);
    setModulesText(normalizeList(configuration?.modules).join(", "));
    setEnvironmentsText(normalizeList(configuration?.environments).join(", "));
    setNotice("");
  }, [configuration]);

  const customFieldPreview = useMemo(
    () =>
      customFields
        .map((field) => ({
          label: field.label.trim(),
          type: field.type.trim() || "TEXT",
          required: field.required,
          options: field.optionsText
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }))
        .filter((field) => field.label),
    [customFields]
  );

  const saveConfiguration = async () => {
    const workflowStatuses = workflowStages
      .map((stage) => stage.value.trim().toUpperCase().replace(/\s+/g, "_"))
      .filter(Boolean);
    if (workflowStatuses.length === 0) {
      setNotice("Add at least one workflow status.");
      return;
    }

    const payload = {
      customFields: customFieldPreview,
      workflowConfig: { statuses: Array.from(new Set(workflowStatuses)) },
      modules: Array.from(new Set(modulesText.split(",").map((item) => item.trim()).filter(Boolean))),
      environments: Array.from(new Set(environmentsText.split(",").map((item) => item.trim()).filter(Boolean))),
    };
    setNotice("");
    await onSave(payload);
  };

  return (
    <section className="projectConfigPanel">
      <div className="projectConfigHero">
        <div>
          <h4>Project Configuration</h4>
          <p>Define project-specific custom fields, workflow stages, modules, and environments without affecting other projects.</p>
        </div>
        <button
          type="button"
          className="button small"
          disabled={disabled || saving || loading}
          onClick={saveConfiguration}
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {loading ? <div className="note">Loading project configuration...</div> : null}
      {notice ? <div className="projectConfigNotice">{notice}</div> : null}

      <div className="projectConfigGrid">
        <article className="projectConfigCard">
          <div className="projectConfigCardHeader">
            <div>
              <h5>Custom Fields</h5>
              <p>Examples: Device Type for Mobile, Browser Type for Web.</p>
            </div>
            <button
              type="button"
              className="button small"
              disabled={disabled}
              onClick={() => setCustomFields((prev) => [...prev, createCustomFieldRow()])}
            >
              Add Field
            </button>
          </div>
          <div className="projectConfigList">
            {customFields.map((field, index) => (
              <div key={field.id} className="projectConfigItem">
                <div className="projectConfigRow">
                  <label>
                    <span>Label</span>
                    <input
                      className="input"
                      value={field.label}
                      disabled={disabled}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((item) => (item.id === field.id ? { ...item, label: e.target.value } : item))
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      className="input"
                      value={field.type}
                      disabled={disabled}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((item) => (item.id === field.id ? { ...item, type: e.target.value } : item))
                        )
                      }
                    >
                      <option value="TEXT">Text</option>
                      <option value="SELECT">Select</option>
                      <option value="NUMBER">Number</option>
                      <option value="DATE">Date</option>
                    </select>
                  </label>
                </div>
                <div className="projectConfigRow">
                  <label className="projectConfigGrow">
                    <span>Options</span>
                    <input
                      className="input"
                      placeholder="Comma separated options"
                      value={field.optionsText}
                      disabled={disabled || field.type !== "SELECT"}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((item) => (item.id === field.id ? { ...item, optionsText: e.target.value } : item))
                        )
                      }
                    />
                  </label>
                  <label className="projectConfigCheckbox">
                    <input
                      type="checkbox"
                      checked={field.required}
                      disabled={disabled}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((item) => (item.id === field.id ? { ...item, required: e.target.checked } : item))
                        )
                      }
                    />
                    <span>Required</span>
                  </label>
                  <button
                    type="button"
                    className="button small danger"
                    disabled={disabled || customFields.length === 1}
                    onClick={() => setCustomFields((prev) => prev.filter((item) => item.id !== field.id))}
                  >
                    Remove
                  </button>
                </div>
                <div className="projectConfigItemIndex">Field {index + 1}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="projectConfigCard">
          <div className="projectConfigCardHeader">
            <div>
              <h5>Project Workflow</h5>
              <p>Control workflow statuses used for this project.</p>
            </div>
            <button
              type="button"
              className="button small"
              disabled={disabled}
              onClick={() => setWorkflowStages((prev) => [...prev, createWorkflowStageRow()])}
            >
              Add Status
            </button>
          </div>
          <div className="projectConfigList compact">
            {workflowStages.map((stage) => (
              <div key={stage.id} className="projectConfigInlineRow">
                <input
                  className="input"
                  value={stage.value}
                  disabled={disabled}
                  placeholder="OPEN"
                  onChange={(e) =>
                    setWorkflowStages((prev) =>
                      prev.map((item) => (item.id === stage.id ? { ...item, value: e.target.value } : item))
                    )
                  }
                />
                <button
                  type="button"
                  className="button small danger"
                  disabled={disabled || workflowStages.length === 1}
                  onClick={() => setWorkflowStages((prev) => prev.filter((item) => item.id !== stage.id))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="projectConfigGrid secondary">
        <article className="projectConfigCard">
          <div className="projectConfigCardHeader">
            <div>
              <h5>Modules / Components</h5>
              <p>Used to organize test cases and scope coverage by project module.</p>
            </div>
          </div>
          <textarea
            className="input"
            rows={4}
            disabled={disabled}
            value={modulesText}
            onChange={(e) => setModulesText(e.target.value)}
            placeholder="Authentication, Dashboard, Payments"
          />
        </article>

        <article className="projectConfigCard">
          <div className="projectConfigCardHeader">
            <div>
              <h5>Environments</h5>
              <p>Define project environments like QA Web, Android QA, iOS Staging.</p>
            </div>
          </div>
          <textarea
            className="input"
            rows={4}
            disabled={disabled}
            value={environmentsText}
            onChange={(e) => setEnvironmentsText(e.target.value)}
            placeholder="QA Web, Android QA, iOS Staging"
          />
        </article>
      </div>

      <article className="projectConfigPreviewCard">
        <div className="projectConfigCardHeader">
          <div>
            <h5>Configuration Preview</h5>
            <p>Quick view of how this project is currently configured.</p>
          </div>
        </div>
        <div className="projectConfigPreviewGrid">
          <div>
            <strong>Custom Field Count</strong>
            <span>{customFieldPreview.length}</span>
          </div>
          <div>
            <strong>Workflow Statuses</strong>
            <span>
              {workflowStages
                .map((stage) => stage.value.trim())
                .filter(Boolean)
                .join(", ") || "No statuses configured"}
            </span>
          </div>
          <div>
            <strong>Modules</strong>
            <span>{modulesText.trim() || "No modules configured"}</span>
          </div>
          <div>
            <strong>Environments</strong>
            <span>{environmentsText.trim() || "No environments configured"}</span>
          </div>
        </div>
      </article>
    </section>
  );
};

export default ProjectConfigurationPanel;
