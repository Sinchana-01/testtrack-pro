import React from "react";
import "./ProjectCustomFieldsForm.css";

export type ProjectCustomFieldDefinition = {
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

type Props = {
  title?: string;
  fields: ProjectCustomFieldDefinition[];
  values: Record<string, string>;
  disabled?: boolean;
  onChange: (label: string, value: string) => void;
};

const ProjectCustomFieldsForm: React.FC<Props> = ({
  title = "Project Custom Fields",
  fields,
  values,
  disabled = false,
  onChange,
}) => {
  if (!fields.length) return null;

  return (
    <div className="projectCustomFieldsPanel">
      <div className="projectCustomFieldsHeader">
        <strong>{title}</strong>
        <span>Fields below come from the active project configuration.</span>
      </div>
      <div className="projectCustomFieldsGrid">
        {fields.map((field) => {
          const label = String(field.label || "").trim();
          const type = String(field.type || "TEXT").toUpperCase();
          const options = Array.isArray(field.options)
            ? field.options.map((item) => String(item || "").trim()).filter(Boolean)
            : [];
          const value = values[label] || "";
          return (
            <label key={label} className="projectCustomFieldItem">
              <span>
                {label}
                {field.required ? " *" : ""}
              </span>
              {type === "SELECT" ? (
                <select
                  className="input"
                  value={value}
                  disabled={disabled}
                  onChange={(e) => onChange(label, e.target.value)}
                >
                  <option value="">Select {label}</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type={type === "NUMBER" ? "number" : type === "DATE" ? "date" : "text"}
                  value={value}
                  disabled={disabled}
                  onChange={(e) => onChange(label, e.target.value)}
                  placeholder={label}
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectCustomFieldsForm;
