import React from "react";
import ProjectCard, { ProjectCardData } from "../../components/projects/ProjectCard";

type Props = {
  isAdmin: boolean;
  projects: ProjectCardData[];
  search: string;
  statusFilter: "ALL" | "ACTIVE" | "ARCHIVED";
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: "ALL" | "ACTIVE" | "ARCHIVED") => void;
  onCreate: () => void;
  onView: (id: string) => void;
  onEdit: (project: ProjectCardData) => void;
  onToggleArchive: (project: ProjectCardData) => void;
  busyProjectId?: string;
};

const ProjectList: React.FC<Props> = ({
  isAdmin,
  projects,
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onCreate,
  onView,
  onEdit,
  onToggleArchive,
  busyProjectId,
}) => {
  return (
    <section>
      <div className="projectToolbar">
        <div className="projectToolbarFilters">
          {isAdmin ? (
          <button className="button" onClick={onCreate}>
            Create Project
          </button>
        ) : null}<input
            className="input"
            placeholder="Search by project name or code"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as "ALL" | "ACTIVE" | "ARCHIVED")}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        
      </div>

      {projects.length === 0 ? (
        <div className="projectEmptyState">No projects found</div>
      ) : (
        <div className="projectGrid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isAdmin={isAdmin}
              onView={onView}
              onEdit={onEdit}
              onToggleArchive={onToggleArchive}
              busyId={busyProjectId}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProjectList;

