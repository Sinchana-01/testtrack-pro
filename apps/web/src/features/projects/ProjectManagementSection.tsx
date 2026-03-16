import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveAdminProjectApi,
  createAdminProjectApi,
  createProjectMilestoneApi,
  deleteProjectMilestoneApi,
  getTestCasesApi,
  getMilestoneProgressApi,
  getProjectApi,
  getProjectConfigurationApi,
  listAdminProjectsApi,
  listAdminUsersApi,
  listProjectMembersApi,
  listProjectMilestonesApi,
  listProjectsApi,
  listTestRunsApi,
  linkMilestoneTestRunApi,
  removeProjectMemberApi,
  restoreAdminProjectApi,
  setActiveProjectId,
  updateAdminProjectApi,
  updateProjectMilestoneApi,
  updateProjectConfigurationApi,
  updateProjectMemberRoleApi,
  upsertProjectMemberApi,
} from "../../api";
import ProjectFormModal from "../../components/projects/ProjectFormModal";
import ProjectList from "../../pages/projects/ProjectList";
import ProjectDetails from "../../pages/projects/ProjectDetails";
import type { ProjectCardData } from "../../components/projects/ProjectCard";
import { syncProjectContext } from "./projectManagement.utils";

type Props = {
  isAdmin: boolean;
  onRefreshData?: () => Promise<void> | void;
  onProjectContextSelect?: (projectId: string) => void;
  activeProjectId?: string;
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

export const ProjectManagementSection: React.FC<Props> = ({
  isAdmin,
  onRefreshData,
  onProjectContextSelect,
  activeProjectId = "",
}) => {
  const queryClient = useQueryClient();
  const [route, setRoute] = useState<ProjectRoute>(() => parseProjectRoute());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingProject, setEditingProject] = useState<ProjectCardData | null>(null);
  const [busyProjectId, setBusyProjectId] = useState("");
  const [showProjectTestCases, setShowProjectTestCases] = useState(false);
  const lastSyncedProjectIdRef = useRef("");
  const suppressRouteSyncRef = useRef(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
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
    queryKey: [
      "project-milestone-progress",
      route.mode === "details" ? route.projectId : "",
      selectedMilestoneId,
    ],
    queryFn: async () => {
      if (!selectedMilestoneId) return null;
      return getMilestoneProgressApi((route as any).projectId, selectedMilestoneId);
    },
    enabled: route.mode === "details" && Boolean(selectedMilestoneId),
    keepPreviousData: true,
  });

  const testRunsQuery = useQuery<any[], Error>({
    queryKey: ["project-test-runs", route.mode === "details" ? route.projectId : ""],
    queryFn: () => listTestRunsApi(),
    enabled: route.mode === "details",
    keepPreviousData: true,
  });

  const projectTestCasesQuery = useQuery<any[], Error>({
    queryKey: ["project-testcases", route.mode === "details" ? route.projectId : ""],
    queryFn: async () => {
      if (route.mode !== "details") return [];
      syncProjectContext(route.projectId, onProjectContextSelect);
      const rows = await getTestCasesApi();
      return Array.isArray(rows) ? rows : [];
    },
    enabled: route.mode === "details" && showProjectTestCases,
    keepPreviousData: true,
  });

  const configurationQuery = useQuery<any, Error>({
    queryKey: ["project-configuration", route.mode === "details" ? route.projectId : ""],
    queryFn: () => getProjectConfigurationApi((route as any).projectId),
    enabled: route.mode === "details",
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

  useEffect(() => {
    if (route.mode !== "details") {
      setSelectedMilestoneId("");
      return;
    }
    const rows = Array.isArray(milestonesQuery.data) ? milestonesQuery.data : [];
    if (!rows.length) {
      setSelectedMilestoneId("");
      return;
    }
    if (!selectedMilestoneId) {
      setSelectedMilestoneId(String(rows[0].id || ""));
      return;
    }
    if (!rows.some((row) => String(row.id) === String(selectedMilestoneId))) {
      setSelectedMilestoneId(String(rows[0].id || ""));
    }
  }, [route.mode, milestonesQuery.data, selectedMilestoneId]);

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
      queryClient.invalidateQueries({ queryKey: ["project-milestone-progress"] }),
      queryClient.invalidateQueries({ queryKey: ["project-test-runs"] }),
      queryClient.invalidateQueries({ queryKey: ["project-configuration"] }),
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
    suppressRouteSyncRef.current = true;
    window.history.pushState({}, "", "/projects");
    setRoute({ mode: "list" });
    setShowProjectTestCases(false);
  };

  const goToDetails = (projectId: string) => {
    suppressRouteSyncRef.current = false;
    window.history.pushState({}, "", `/projects/${projectId}`);
    setRoute({ mode: "details", projectId });
    setShowProjectTestCases(false);
  };

  useEffect(() => {
    if (route.mode !== "details" || !route.projectId) return;
    if (lastSyncedProjectIdRef.current === route.projectId) return;
    lastSyncedProjectIdRef.current = route.projectId;
    syncProjectContext(route.projectId, onProjectContextSelect);
  }, [route.mode, route.mode === "details" ? route.projectId : "", onProjectContextSelect]);

  useEffect(() => {
    const normalized = String(activeProjectId || "").trim();
    if (suppressRouteSyncRef.current) return;
    if (!normalized) {
      if (route.mode !== "list") {
        window.history.replaceState({}, "", "/projects");
        setRoute({ mode: "list" });
        setShowProjectTestCases(false);
      }
      return;
    }
    if (route.mode === "details" && route.projectId === normalized) return;
    lastSyncedProjectIdRef.current = normalized;
    window.history.replaceState({}, "", `/projects/${normalized}`);
    setRoute({ mode: "details", projectId: normalized });
    setShowProjectTestCases(false);
  }, [activeProjectId, route.mode, route.mode === "details" ? route.projectId : ""]);

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

  const handleCreateMilestone = async (payload: {
    name: string;
    description?: string;
    targetDate: string;
    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
    targetPassRate?: number;
    targetBugClosure?: number;
  }) => {
    if (route.mode !== "details") return;
    const created = await createProjectMilestoneApi(route.projectId, payload);
    await refreshAll();
    if (created?.id) {
      setSelectedMilestoneId(String(created.id));
    }
  };

  const handleUpdateMilestone = async (
    milestoneId: string,
    payload: {
      name?: string;
      description?: string;
      targetDate?: string;
      status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
      targetPassRate?: number;
      targetBugClosure?: number;
    }
  ) => {
    if (route.mode !== "details") return;
    await updateProjectMilestoneApi(route.projectId, milestoneId, payload);
    await refreshAll();
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (route.mode !== "details") return;
    await deleteProjectMilestoneApi(route.projectId, milestoneId);
    await refreshAll();
    setSelectedMilestoneId("");
  };

  const handleLinkMilestoneRun = async (milestoneId: string, testRunId: string) => {
    if (route.mode !== "details") return;
    await linkMilestoneTestRunApi(route.projectId, milestoneId, testRunId);
    await refreshAll();
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
          testRuns={Array.isArray(testRunsQuery.data) ? testRunsQuery.data : []}
          selectedMilestoneId={selectedMilestoneId}
          milestoneProgress={milestoneProgressQuery.data || null}
          milestoneProgressLoading={milestoneProgressQuery.isLoading || milestoneProgressQuery.isFetching}
          configuration={configurationQuery.data || null}
          configurationLoading={configurationQuery.isLoading || configurationQuery.isFetching}
          onBackToProjects={goToList}
          onEdit={() => selectedProject && handleEdit(selectedProject)}
          onToggleArchive={() => selectedProject && handleArchiveRestore(selectedProject)}
          onAddMember={async (userId, role) => {
            if (!selectedProject?.id) return;
            await upsertProjectMemberApi(selectedProject.id, { userId, roleInProject: role });
            await refreshAll();
          }}
          onSelectMilestone={setSelectedMilestoneId}
          onCreateMilestone={handleCreateMilestone}
          onUpdateMilestone={handleUpdateMilestone}
          onDeleteMilestone={handleDeleteMilestone}
          onLinkMilestoneTestRun={handleLinkMilestoneRun}
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
          showTestCases={showProjectTestCases}
          testCasesLoading={
            showProjectTestCases && (projectTestCasesQuery.isLoading || projectTestCasesQuery.isFetching)
          }
          onViewTestCases={async () => {
            if (route.mode !== "details") return;
            syncProjectContext(route.projectId, onProjectContextSelect);
            setShowProjectTestCases(true);
            await projectTestCasesQuery.refetch();
          }}
          onSaveConfiguration={async (payload) => {
            if (!selectedProject?.id) return;
            await updateProjectConfigurationApi(selectedProject.id, payload);
            await refreshAll();
          }}
        />
      )}
    </section>
  );
};

export default ProjectManagementSection;





