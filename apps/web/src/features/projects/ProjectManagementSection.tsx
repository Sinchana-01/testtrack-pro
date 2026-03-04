import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveAdminProjectApi,
  createAdminProjectApi,
  getTestCasesApi,
  getMilestoneProgressApi,
  getProjectApi,
  listAdminProjectsApi,
  listAdminUsersApi,
  listProjectMembersApi,
  listProjectMilestonesApi,
  listProjectsApi,
  removeProjectMemberApi,
  restoreAdminProjectApi,
  setActiveProjectId,
  updateAdminProjectApi,
  updateProjectMemberRoleApi,
  upsertProjectMemberApi,
} from "../../api";
import ProjectFormModal from "../../components/projects/ProjectFormModal";
import ProjectList from "../../pages/projects/ProjectList";
import ProjectDetails from "../../pages/projects/ProjectDetails";
import type { ProjectCardData } from "../../components/projects/ProjectCard";

type Props = {
  isAdmin: boolean;
  onRefreshData?: () => Promise<void> | void;
};

type ProjectRoute =
  | { mode: "list" }
  | { mode: "details"; projectId: string };

const parseProjectRoute = (): ProjectRoute => {
  const path = window.location.pathname;
  if (path.startsWith("/projects/")) {
    const projectId = path.slice("/projects/".length).trim();
    if (projectId) return { mode: "details", projectId };
  }
  return { mode: "list" };
};

const normalizeProject = (row: any): ProjectCardData => ({
  id: String(row?.id || ""),
  name: String(row?.name || "Unnamed Project"),
  code: String(row?.code || "NO_CODE"),
  description: String(row?.description || ""),
  ownerId: row?.ownerId ? String(row.ownerId) : undefined,
  ownerName: String(row?.owner?.name || row?.creator?.name || "N/A"),
  status:
    String(row?.status || "").toUpperCase() === "ARCHIVED" || row?.isActive === false
      ? "ARCHIVED"
      : "ACTIVE",
  memberCount: Number(row?._count?.members || 0),
  createdAt: String(row?.createdAt || ""),
});

const ProjectManagementSection: React.FC<Props> = ({ isAdmin, onRefreshData }) => {
  const queryClient = useQueryClient();
  const [route, setRoute] = useState<ProjectRoute>(() => parseProjectRoute());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingProject, setEditingProject] = useState<ProjectCardData | null>(null);
  const [busyProjectId, setBusyProjectId] = useState("");
  const [showProjectTestCases, setShowProjectTestCases] = useState(false);

  const projectsQuery = useQuery<any[], Error>({
    queryKey: ["projects", isAdmin ? "admin" : "member"],
    queryFn: () => (isAdmin ? listAdminProjectsApi() : listProjectsApi({ includeArchived: true })),
    keepPreviousData: true,
  });

  const usersQuery = useQuery<any[], Error>({
    queryKey: ["admin-users-for-projects"],
    queryFn: () => listAdminUsersApi(),
    enabled: isAdmin && (formOpen || route.mode === "details"),
    keepPreviousData: true,
  });

  const detailsQuery = useQuery<any, Error>({
    queryKey: ["project", route.mode === "details" ? route.projectId : ""],
    queryFn: () => getProjectApi((route as any).projectId),
    enabled: route.mode === "details",
    keepPreviousData: true,
  });

  const membersQuery = useQuery<any[], Error>({
    queryKey: ["project-members", route.mode === "details" ? route.projectId : ""],
    queryFn: () => listProjectMembersApi((route as any).projectId),
    enabled: route.mode === "details",
    keepPreviousData: true,
  });

  const milestonesQuery = useQuery<any[], Error>({
    queryKey: ["project-milestones", route.mode === "details" ? route.projectId : ""],
    queryFn: () => listProjectMilestonesApi((route as any).projectId),
    enabled: route.mode === "details",
    keepPreviousData: true,
  });

  const milestoneProgressQuery = useQuery<any, Error>({
    queryKey: ["project-milestone-progress", route.mode === "details" ? route.projectId : ""],
    queryFn: async () => {
      const milestones = await listProjectMilestonesApi((route as any).projectId);
      const first = Array.isArray(milestones) && milestones.length > 0 ? milestones[0] : null;
      if (!first?.id) return null;
      return getMilestoneProgressApi((route as any).projectId, first.id);
    },
    enabled: route.mode === "details",
    keepPreviousData: true,
  });

  const projectTestCasesQuery = useQuery<any[], Error>({
    queryKey: ["project-testcases", route.mode === "details" ? route.projectId : ""],
    queryFn: async () => {
      if (route.mode !== "details") return [];
      setActiveProjectId(route.projectId);
      const rows = await getTestCasesApi();
      return Array.isArray(rows) ? rows : [];
    },
    enabled: route.mode === "details" && showProjectTestCases,
    keepPreviousData: true,
  });

  const projectRows = useMemo(
    () => (Array.isArray(projectsQuery.data) ? projectsQuery.data.map(normalizeProject) : []),
    [projectsQuery.data]
  );

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projectRows.filter((project) => {
      if (statusFilter !== "ALL" && project.status !== statusFilter) return false;
      if (!query) return true;
      return project.name.toLowerCase().includes(query) || project.code.toLowerCase().includes(query);
    });
  }, [projectRows, search, statusFilter]);

  const selectedProjectFromList =
    route.mode === "details" ? projectRows.find((item) => item.id === route.projectId) || null : null;
  const selectedProject: ProjectCardData | null = useMemo(() => {
    if (route.mode !== "details") return null;
    if (detailsQuery.data?.id) return normalizeProject(detailsQuery.data);
    return selectedProjectFromList;
  }, [route, detailsQuery.data, selectedProjectFromList]);

  const memberUserOptions = useMemo(
    () =>
      (Array.isArray(usersQuery.data) ? usersQuery.data : [])
        .filter((user: any) => Boolean(user?.isActive))
        .map((user: any) => ({
          id: String(user.id),
          label: `${String(user.name || "User")} (${String(user.email || "no-email")})`,
          role: String(user.role || "TESTER").toUpperCase() as "ADMIN" | "TESTER" | "DEVELOPER",
        })),
    [usersQuery.data]
  );

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["project"] }),
      queryClient.invalidateQueries({ queryKey: ["project-members"] }),
      queryClient.invalidateQueries({ queryKey: ["project-milestones"] }),
    ]);
    if (onRefreshData) await onRefreshData();
  };

  useEffect(() => {
    const parsed = parseProjectRoute();
    if (!window.location.pathname.startsWith("/projects")) {
      window.history.replaceState({}, "", "/projects");
      setRoute({ mode: "list" });
      return;
    }
    setRoute(parsed);
    const onPopState = () => setRoute(parseProjectRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const goToList = () => {
    window.history.pushState({}, "", "/projects");
    setRoute({ mode: "list" });
    setShowProjectTestCases(false);
  };

  const goToDetails = (projectId: string) => {
    window.history.pushState({}, "", `/projects/${projectId}`);
    setRoute({ mode: "details", projectId });
    setShowProjectTestCases(false);
  };

  const createMutation = useMutation({
    mutationFn: createAdminProjectApi,
    onSuccess: async () => {
      await refreshAll();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateAdminProjectApi(id, payload),
    onSuccess: async () => {
      await refreshAll();
    },
  });

  const handleCreate = () => {
    setFormMode("create");
    setEditingProject(null);
    setFormOpen(true);
  };

  const handleEdit = (project: ProjectCardData) => {
    setFormMode("edit");
    setEditingProject(project);
    setFormOpen(true);
  };

  const handleArchiveRestore = async (project: ProjectCardData) => {
    if (!isAdmin) return;
    const isArchived = project.status === "ARCHIVED";
    const ok = window.confirm(
      isArchived
        ? "Are you sure you want to restore this project?"
        : "Are you sure you want to archive this project?"
    );
    if (!ok) return;
    setBusyProjectId(project.id);
    try {
      if (isArchived) {
        await restoreAdminProjectApi(project.id);
      } else {
        await archiveAdminProjectApi(project.id);
      }
      await refreshAll();
    } finally {
      setBusyProjectId("");
    }
  };

  const handleSubmitForm = async (payload: {
    name: string;
    code: string;
    description?: string;
    status: "ACTIVE" | "ARCHIVED";
  }) => {
    if (!isAdmin) return;
    if (formMode === "create") {
      await createMutation.mutateAsync(payload);
    } else if (editingProject?.id) {
      await updateMutation.mutateAsync({
        id: editingProject.id,
        payload: {
          name: payload.name,
          code: payload.code,
          description: payload.description,
          isActive: payload.status === "ACTIVE",
          status: payload.status,
        },
      });
    }
    setFormOpen(false);
  };

  const projectArchived = selectedProject?.status === "ARCHIVED";

  return (
    <section className="panel">
      <ProjectFormModal
        open={formOpen}
        mode={formMode}
        project={editingProject}
        saving={createMutation.isLoading || updateMutation.isLoading}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmitForm}
      />

      {route.mode === "list" ? (
        <ProjectList
          isAdmin={isAdmin}
          projects={filteredProjects}
          search={search}
          statusFilter={statusFilter}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          onCreate={handleCreate}
          onView={goToDetails}
          onEdit={handleEdit}
          onToggleArchive={handleArchiveRestore}
          busyProjectId={busyProjectId}
        />
      ) : (
        <ProjectDetails
          isAdmin={isAdmin}
          project={selectedProject}
          members={Array.isArray(membersQuery.data) ? membersQuery.data : []}
          milestones={Array.isArray(milestonesQuery.data) ? milestonesQuery.data : []}
          milestonePassRate={Number(milestoneProgressQuery.data?.metrics?.passRate || 0)}
          milestoneBugClosureRate={Number(milestoneProgressQuery.data?.metrics?.bugClosureRate || 0)}
          onBackToProjects={goToList}
          onEdit={() => selectedProject && handleEdit(selectedProject)}
          onToggleArchive={() => selectedProject && handleArchiveRestore(selectedProject)}
          onAddMember={async (userId, role) => {
            if (!selectedProject?.id) return;
            await upsertProjectMemberApi(selectedProject.id, { userId, roleInProject: role });
            await refreshAll();
          }}
          onChangeRole={async (memberId, role) => {
            if (!selectedProject?.id) return;
            await updateProjectMemberRoleApi(selectedProject.id, memberId, role);
            await refreshAll();
          }}
          onRemoveMember={async (memberId) => {
            if (!selectedProject?.id) return;
            await removeProjectMemberApi(selectedProject.id, memberId);
            await refreshAll();
          }}
          userOptions={memberUserOptions}
          disabledActions={projectArchived}
          testCases={Array.isArray(projectTestCasesQuery.data) ? projectTestCasesQuery.data : []}
          testCasesLoading={projectTestCasesQuery.isLoading}
          onViewTestCases={async () => {
            if (route.mode !== "details") return;
            setActiveProjectId(route.projectId);
            setShowProjectTestCases(true);
            await projectTestCasesQuery.refetch();
          }}
        />
      )}
    </section>
  );
};

export default ProjectManagementSection;
