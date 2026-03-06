import React from "react";

export type ProjectCardData = {
  id: string;
  name: string;
  code: string;
  description: string;
  ownerId?: string;
  ownerName: string;
  status: "ACTIVE" | "ARCHIVED";
  memberCount: number;
  createdAt: string;
};

type Props = {
  project: ProjectCardData;
  isAdmin: boolean;
  onView: (id: string) => void;
  onEdit: (project: ProjectCardData) => void;
  onToggleArchive: (project: ProjectCardData) => void;
  busyId?: string;
};

const ProjectCard: React.FC<Props> = ({ project, isAdmin, onView, onEdit, onToggleArchive, busyId }) => {
  const isArchived = project.status === "ARCHIVED";
  const createdLabel = project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "N/A";
  const descriptionPreview = (project.description || "No description").trim();

  return (
    <article className="projectCard">
      <div className="projectCardHeader">
        <div>
          <h3 className="projectCardTitle">{project.name || "Unnamed Project"}</h3>
          <div className="projectCardMetaRow">
            <span className="projectCodeBadge">{project.code || "NO_CODE"}</span>
            <span className={`projectStatusBadge ${isArchived ? "archived" : "active"}`}>{project.status}</span>
          </div>
        </div>
      </div>
      <p className="projectCardDescription">{descriptionPreview}</p>
      <div className="projectCardFooter">
        <span>Owner: {project.ownerName || "N/A"}</span>
        <span>Members: {project.memberCount}</span>
        <span>Created: {createdLabel}</span>
      </div>
      <div className="projectCardActions">
        <button className="button small projectActionBtnBlack" onClick={() => onView(project.id)}>
          View
        </button>
        {isAdmin ? (
          <>
            <button className="button small projectActionBtnBlack" disabled={isArchived} onClick={() => onEdit(project)}>
              Edit
            </button>
            <button
              className="button small projectActionBtnBlack"
              disabled={busyId === project.id}
              onClick={() => onToggleArchive(project)}
            >
              {isArchived ? "Restore" : "Archive"}
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
};

export default ProjectCard;
