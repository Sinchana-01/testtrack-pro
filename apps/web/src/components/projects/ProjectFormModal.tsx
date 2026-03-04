import React, { useEffect, useState } from "react";
import type { ProjectCardData } from "./ProjectCard";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  project?: ProjectCardData | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    code: string;
    description?: string;
    status: "ACTIVE" | "ARCHIVED";
  }) => Promise<void> | void;
};

const ProjectFormModal: React.FC<Props> = ({ open, mode, project, saving, onClose, onSubmit }) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const title = mode === "create" ? "Create Project" : "Edit Project";

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && project) {
      setName(project.name || "");
      setCode(project.code || "");
      setDescription(project.description || "");
      setStatus(project.status || "ACTIVE");
    } else {
      setName("");
      setCode("");
      setDescription("");
      setStatus("ACTIVE");
    }
    setErrors({});
  }, [open, mode, project]);

  if (!open) return null;

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Project name is required";
    if (!code.trim()) nextErrors.code = "Project code is required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit({
      name: name.trim(),
      code: code.trim(),
      description: description.trim() || undefined,
      status,
    });
  };

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalCard projectFormModal" onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        <label className="fieldLabel">Project Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        {errors.name ? <div className="formError">{errors.name}</div> : null}

        <label className="fieldLabel">Project Code</label>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
        {errors.code ? <div className="formError">{errors.code}</div> : null}

        <label className="fieldLabel">Description</label>
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="fieldLabel">Status</label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as "ACTIVE" | "ARCHIVED")}>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <div className="toolbarActions">
          <button className="button small danger" onClick={onClose} disabled={Boolean(saving)}>
            Cancel
          </button>
          <button className="button small" onClick={handleSubmit} disabled={Boolean(saving)}>
            {saving ? "Saving..." : "Save Project"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectFormModal;
