import { setActiveProjectId } from "../../api";

export const syncProjectContext = (
  projectId: string,
  onProjectContextSelect?: (projectId: string) => void
) => {
  const normalized = String(projectId || "").trim();
  if (!normalized) return;
  onProjectContextSelect?.(normalized);
  setActiveProjectId(normalized);
};
