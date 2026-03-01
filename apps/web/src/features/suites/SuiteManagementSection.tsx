import React, { useEffect, useMemo, useState } from "react";
import {
  addSuiteTestCasesApi,
  archiveSuiteApi,
  cloneSuiteApi,
  createSuiteApi,
  deleteSuiteApi,
  getSuiteApi,
  listSuiteExecutionsApi,
  listTesterUsersApi,
  removeSuiteTestCaseApi,
  reorderSuiteTestCasesApi,
  restoreSuiteApi,
  startSuiteExecutionApi,
  updateSuiteApi,
} from "../../api";
import SuiteExecutionWorkspace from "./SuiteExecutionWorkspace";

type SuiteView = "LIST" | "FORM" | "DETAIL" | "EXECUTION";
type SuiteFormMode = "CREATE" | "EDIT";

type Props = {
  suites: any[];
  testCases: any[];
  showArchivedSuites: boolean;
  setShowArchivedSuites: (next: boolean) => void;
  onRefreshData: () => Promise<void>;
  getSuiteFriendlyError: (error: any, fallback: string) => string;
  testRuns: any[];
};

const toCaseLabel = (tc: any): string =>
  `${tc?.testCaseCode || tc?.id || "N/A"} - ${tc?.title || "Untitled"}`;

const SuiteManagementSection: React.FC<Props> = ({
  suites,
  testCases,
  showArchivedSuites,
  setShowArchivedSuites,
  onRefreshData,
  getSuiteFriendlyError,
  testRuns,
}) => {
  const [view, setView] = useState<SuiteView>("LIST");
  const [formMode, setFormMode] = useState<SuiteFormMode>("CREATE");

  const [suiteId, setSuiteId] = useState("");
  const [suiteDetails, setSuiteDetails] = useState<any>(null);
  const [activeExecutionId, setActiveExecutionId] = useState("");
  const [suiteExecutionHistory, setSuiteExecutionHistory] = useState<any[]>([]);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [executeMode, setExecuteMode] = useState<"SEQUENTIAL" | "PARALLEL">("SEQUENTIAL");
  const [executeRunId, setExecuteRunId] = useState("");
  const [testerOptions, setTesterOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedTesterIds, setSelectedTesterIds] = useState<string[]>([]);

  const [suiteName, setSuiteName] = useState("");
  const [suiteDescription, setSuiteDescription] = useState("");
  const [suiteModule, setSuiteModule] = useState("");
  const [suiteProjectId, setSuiteProjectId] = useState("");
  const [suiteParentId, setSuiteParentId] = useState("");
  const [suiteCreateType, setSuiteCreateType] = useState<"STATIC" | "DYNAMIC">("STATIC");
  const [suiteStatus, setSuiteStatus] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [leftPickedIds, setLeftPickedIds] = useState<string[]>([]);
  const [rightPickedIds, setRightPickedIds] = useState<string[]>([]);

  const [draggingCaseId, setDraggingCaseId] = useState("");
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState("");
  const [drawerSelection, setDrawerSelection] = useState<string[]>([]);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const activeSuites = useMemo(() => suites, [suites]);
  const parentSuites = useMemo(
    () => activeSuites.filter((suite) => !suite?.parentSuiteId),
    [activeSuites]
  );

  const resetForm = () => {
    setSuiteId("");
    setSuiteName("");
    setSuiteDescription("");
    setSuiteModule("");
    setSuiteProjectId("");
    setSuiteParentId("");
    setSuiteCreateType("STATIC");
    setSuiteStatus("ACTIVE");
    setAvailableSearch("");
    setSelectedSearch("");
    setSelectedCaseIds([]);
    setLeftPickedIds([]);
    setRightPickedIds([]);
  };

  useEffect(() => {
    listTesterUsersApi()
      .then((rows) => {
        const normalized = Array.isArray(rows)
          ? rows
              .map((row: any) => ({
                id: String(row?.id || ""),
                name: String(row?.name || "").trim(),
                email: String(row?.email || "").trim(),
              }))
              .filter((row) => row.id && row.email)
          : [];
        setTesterOptions(normalized);
      })
      .catch(() => {
        setTesterOptions([]);
      });
  }, []);

  const loadSuiteDetailBundle = async (id: string, options?: { preserveExecutionId?: boolean }) => {
    const [detail, history] = await Promise.all([getSuiteApi(id), listSuiteExecutionsApi(id)]);
    setSuiteDetails(detail || null);
    setSuiteExecutionHistory(Array.isArray(history) ? history : []);
    if (!options?.preserveExecutionId) {
      setActiveExecutionId("");
    }
    if (Array.isArray(detail?.suiteCases)) {
      setSelectedCaseIds(detail.suiteCases.map((row: any) => row.testCaseId));
    }
  };

  const goCreate = () => {
    resetForm();
    setFormMode("CREATE");
    setView("FORM");
  };

  const goEdit = async (row: any) => {
    try {
      const id = String(row?.id || "");
      if (!id) return;
      await loadSuiteDetailBundle(id);
      setSuiteId(id);
      setSuiteName(String(row?.name || ""));
      setSuiteDescription(String(row?.description || ""));
      setSuiteModule(String(row?.module || ""));
      setSuiteProjectId(String(row?.projectId || ""));
      setSuiteParentId(String(row?.parentSuiteId || ""));
      setSuiteCreateType(String(row?.type || "STATIC").toUpperCase() === "DYNAMIC" ? "DYNAMIC" : "STATIC");
      setSuiteStatus(row?.isArchived ? "ARCHIVED" : "ACTIVE");
      setFormMode("EDIT");
      setView("FORM");
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Load suite for edit failed"));
    }
  };

  const goDetail = async (id: string) => {
    try {
      await loadSuiteDetailBundle(id);
      setSuiteId(id);
      setView("DETAIL");
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Load suite detail failed"));
    }
  };

  const openExecuteModal = async (id: string) => {
    try {
      if (!suiteDetails || suiteDetails.id !== id) {
        await loadSuiteDetailBundle(id);
        setSuiteId(id);
      }
      setExecuteMode("SEQUENTIAL");
      setExecuteRunId("");
      setSelectedTesterIds([]);
      setExecuteModalOpen(true);
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Load suite before execution failed"));
    }
  };

  const startSuiteExecutionFlow = async () => {
    try {
      const targetSuiteId = suiteDetails?.id || suiteId;
      if (!targetSuiteId) {
        alert("Select a suite first");
        return;
      }
      const started = await startSuiteExecutionApi({
        suiteId: targetSuiteId,
        mode: executeMode,
        linkedTestRunId: executeRunId || undefined,
        testerIds: selectedTesterIds,
      });
      if (started?.id) {
        setActiveExecutionId(started.id);
        setView("EXECUTION");
      }
      setExecuteModalOpen(false);
      await loadSuiteDetailBundle(targetSuiteId, { preserveExecutionId: true });
      await onRefreshData();
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Start suite execution failed"));
    }
  };

  const availableCases = useMemo(() => {
    const term = availableSearch.trim().toLowerCase();
    return testCases.filter((tc) => {
      if (selectedCaseIds.includes(tc.id)) return false;
      if (!term) return true;
      return toCaseLabel(tc).toLowerCase().includes(term);
    });
  }, [testCases, selectedCaseIds, availableSearch]);

  const selectedCases = useMemo(() => {
    const byId = new Map(testCases.map((tc) => [tc.id, tc]));
    const term = selectedSearch.trim().toLowerCase();
    return selectedCaseIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .filter((tc: any) => !term || toCaseLabel(tc).toLowerCase().includes(term));
  }, [testCases, selectedCaseIds, selectedSearch]);

  const saveSuite = async () => {
    try {
      if (!suiteName.trim()) {
        alert("Suite name is required");
        return;
      }
      if (suiteCreateType === "DYNAMIC" && !suiteModule.trim()) {
        alert("Module is required for dynamic suite");
        return;
      }

      if (formMode === "CREATE") {
        const payload: Record<string, unknown> = {
          name: suiteName,
          description: suiteDescription || undefined,
          module: suiteModule || undefined,
          parentSuiteId: suiteParentId || undefined,
          projectId: suiteProjectId || undefined,
          type: suiteCreateType,
        };
        if (suiteCreateType === "DYNAMIC") {
          payload.filterJson = { modules: [suiteModule.trim()] };
        } else {
          payload.testCaseIds = selectedCaseIds;
        }
        const created = await createSuiteApi(payload);
        await onRefreshData();
        if (created?.id) {
          await goDetail(created.id);
        } else {
          setView("LIST");
        }
        alert("Suite created");
        return;
      }

      if (!suiteId) {
        alert("Suite id missing");
        return;
      }

      await updateSuiteApi(suiteId, {
        name: suiteName,
        description: suiteDescription || null,
        module: suiteModule || null,
        projectId: suiteProjectId || null,
        parentSuiteId: suiteParentId || null,
      });

      const detail = await getSuiteApi(suiteId);
      const existingIds = Array.isArray(detail?.suiteCases)
        ? detail.suiteCases.map((row: any) => row.testCaseId)
        : [];
      const toAdd = selectedCaseIds.filter((id) => !existingIds.includes(id));
      const toRemove = existingIds.filter((id: string) => !selectedCaseIds.includes(id));

      for (const testCaseId of toRemove) {
        await removeSuiteTestCaseApi(suiteId, testCaseId);
      }
      if (toAdd.length > 0) {
        await addSuiteTestCasesApi(suiteId, toAdd);
      }
      if (selectedCaseIds.length > 0) {
        await reorderSuiteTestCasesApi(suiteId, selectedCaseIds);
      }

      const detailAfterCaseOps = await getSuiteApi(suiteId);
      const shouldArchive = suiteStatus === "ARCHIVED";
      if (shouldArchive && !detailAfterCaseOps?.isArchived) {
        await archiveSuiteApi(suiteId);
      }
      if (!shouldArchive && detailAfterCaseOps?.isArchived) {
        await restoreSuiteApi(suiteId);
      }

      await onRefreshData();
      await goDetail(suiteId);
      alert("Suite updated");
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Save suite failed"));
    }
  };

  const toggleArchive = async (row: any) => {
    try {
      if (row?.isArchived) {
        if (!window.confirm("Restore this suite?")) return;
        await restoreSuiteApi(row.id);
      } else {
        if (!window.confirm("Archive this suite? You can restore it later.")) return;
        await archiveSuiteApi(row.id);
      }
      await onRefreshData();
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Archive/restore failed"));
    }
  };

  const cloneAndEdit = async (row: any) => {
    try {
      const cloned = await cloneSuiteApi(row.id);
      await onRefreshData();
      if (cloned?.id) {
        await goEdit(cloned);
      } else {
        setView("LIST");
      }
      alert("Suite cloned");
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Clone suite failed"));
    }
  };

  const deleteSuite = async (row: any) => {
    try {
      if (!row?.isArchived) {
        alert("Archive the suite first, then delete permanently.");
        return;
      }
      if (!window.confirm("Delete this suite permanently? This cannot be undone.")) return;
      await deleteSuiteApi(row.id);
      await onRefreshData();
      if (suiteId === row.id) {
        setView("LIST");
        setSuiteId("");
        setSuiteDetails(null);
      }
      alert("Suite deleted permanently");
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Delete suite failed"));
    }
  };

  const detailCaseRows = useMemo(() => {
    if (!Array.isArray(suiteDetails?.suiteCases)) return [];
    return [...suiteDetails.suiteCases].sort((a: any, b: any) => Number(a.position || 0) - Number(b.position || 0));
  }, [suiteDetails]);

  const reorderAndSaveDetail = async (sourceId: string, targetId: string) => {
    if (!suiteDetails?.id || !sourceId || !targetId || sourceId === targetId) return;
    const ordered = detailCaseRows.map((row: any) => row.testCaseId);
    const from = ordered.indexOf(sourceId);
    const to = ordered.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const byCaseId = new Map(detailCaseRows.map((row: any) => [row.testCaseId, row]));
    setSuiteDetails((prev: any) => ({
      ...prev,
      suiteCases: next.map((id, idx) => ({ ...(byCaseId.get(id) || {}), testCaseId: id, position: idx + 1 })),
    }));
    try {
      await reorderSuiteTestCasesApi(suiteDetails.id, next);
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Reorder failed"));
      await loadSuiteDetailBundle(suiteDetails.id);
    }
  };

  const drawerCandidates = useMemo(() => {
    const term = drawerSearch.trim().toLowerCase();
    const existing = new Set(detailCaseRows.map((row: any) => row.testCaseId));
    return testCases.filter((tc) => {
      if (existing.has(tc.id)) return false;
      if (!term) return true;
      return toCaseLabel(tc).toLowerCase().includes(term);
    });
  }, [drawerSearch, detailCaseRows, testCases]);

  const saveDrawerCases = async () => {
    if (!suiteDetails?.id || drawerSelection.length === 0) return;
    try {
      await addSuiteTestCasesApi(suiteDetails.id, drawerSelection);
      setAddDrawerOpen(false);
      setDrawerSelection([]);
      setDrawerSearch("");
      await loadSuiteDetailBundle(suiteDetails.id);
      await onRefreshData();
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Add test cases failed"));
    }
  };

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h4>Suite Management (4.5)</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button small" onClick={() => setView("LIST")}>Suite List</button>
          <button className="button small" onClick={goCreate}>Create Suite</button>
        </div>
      </div>

      {view === "LIST" && (
        <>
          <div className="row" style={{ gap: 12, marginBottom: 10 }}>
            <label className="note" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 0 }}>
              <input type="checkbox" checked={showArchivedSuites} onChange={(e) => setShowArchivedSuites(e.target.checked)} />
              Show Archived
            </label>
            <button className="button small" onClick={onRefreshData}>Refresh</button>
          </div>
          <div style={{ border: "1px solid #e4e7ec", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>Suite Name</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Module</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Test Case Count</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Type</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Status</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parentSuites.map((parent: any) => {
                  const children = activeSuites.filter((row) => row.parentSuiteId === parent.id);
                  const expanded = Boolean(expandedParents[parent.id]);
                  return (
                    <React.Fragment key={parent.id}>
                      <tr style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={{ padding: 10 }}>
                          <button className="button small" style={{ marginRight: 8 }} onClick={() => setExpandedParents((prev) => ({ ...prev, [parent.id]: !expanded }))}>
                            {children.length > 0 ? (expanded ? "▾" : "▸") : "•"}
                          </button>
                          {parent.name}
                        </td>
                        <td style={{ padding: 10 }}>{parent.module || "N/A"}</td>
                        <td style={{ padding: 10 }}>{parent._count?.suiteCases || 0}</td>
                        <td style={{ padding: 10 }}>Parent</td>
                        <td style={{ padding: 10 }}>{parent.isArchived ? "ARCHIVED" : "ACTIVE"}</td>
                        <td style={{ padding: 10 }}>
                          <details>
                            <summary style={{ cursor: "pointer" }}>⋮</summary>
                            <div className="listCompact" style={{ marginTop: 8 }}>
                              <button className="button small" onClick={() => goDetail(parent.id)}>View</button>
                              <button className="button small" onClick={() => openExecuteModal(parent.id)}>Execute</button>
                              <button className="button small" onClick={() => goEdit(parent)}>Edit</button>
                              <button className="button small" onClick={() => cloneAndEdit(parent)}>Clone</button>
                              <button className="button small" onClick={() => toggleArchive(parent)}>{parent.isArchived ? "Restore" : "Archive"}</button>
                              <button className="button small danger" onClick={() => deleteSuite(parent)}>Delete</button>
                            </div>
                          </details>
                        </td>
                      </tr>
                      {expanded && children.map((child: any) => (
                        <tr key={child.id} style={{ borderTop: "1px solid #f2f4f7", background: "#fcfcfd" }}>
                          <td style={{ padding: "10px 10px 10px 42px" }}>└ {child.name}</td>
                          <td style={{ padding: 10 }}>{child.module || "N/A"}</td>
                          <td style={{ padding: 10 }}>{child._count?.suiteCases || 0}</td>
                          <td style={{ padding: 10 }}>Child</td>
                          <td style={{ padding: 10 }}>{child.isArchived ? "ARCHIVED" : "ACTIVE"}</td>
                          <td style={{ padding: 10 }}>
                            <details>
                              <summary style={{ cursor: "pointer" }}>⋮</summary>
                              <div className="listCompact" style={{ marginTop: 8 }}>
                                <button className="button small" onClick={() => goDetail(child.id)}>View</button>
                                <button className="button small" onClick={() => openExecuteModal(child.id)}>Execute</button>
                                <button className="button small" onClick={() => goEdit(child)}>Edit</button>
                                <button className="button small" onClick={() => cloneAndEdit(child)}>Clone</button>
                                <button className="button small" onClick={() => toggleArchive(child)}>{child.isArchived ? "Restore" : "Archive"}</button>
                                <button className="button small danger" onClick={() => deleteSuite(child)}>Delete</button>
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "FORM" && (
        <>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <strong>{formMode === "CREATE" ? "Create Suite" : "Edit Suite"}</strong>
            <button className="button small" onClick={() => setView("LIST")}>Back to List</button>
          </div>
          <div className="inlineGrid">
            <input className="input" placeholder="Suite Name" value={suiteName} onChange={(e) => setSuiteName(e.target.value)} />
            <input className="input" placeholder="Module" value={suiteModule} onChange={(e) => setSuiteModule(e.target.value)} />
          </div>
          <textarea className="input" rows={2} placeholder="Description" value={suiteDescription} onChange={(e) => setSuiteDescription(e.target.value)} />
          <div className="inlineGrid">
            <select className="input" value={suiteParentId} onChange={(e) => setSuiteParentId(e.target.value)}>
              <option value="">No Parent Suite</option>
              {suites.filter((row) => !row.isArchived && row.id !== suiteId).map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
            <input className="input" placeholder="Project ID (optional)" value={suiteProjectId} onChange={(e) => setSuiteProjectId(e.target.value)} />
          </div>
          <div className="inlineGrid">
            <select className="input" value={suiteCreateType} onChange={(e) => setSuiteCreateType((e.target.value as "STATIC" | "DYNAMIC") || "STATIC")} disabled={formMode === "EDIT"}>
              <option value="STATIC">STATIC</option>
              <option value="DYNAMIC">DYNAMIC (Module based)</option>
            </select>
            <select className="input" value={suiteStatus} onChange={(e) => setSuiteStatus((e.target.value as "ACTIVE" | "ARCHIVED") || "ACTIVE")}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
          {suiteCreateType === "DYNAMIC" ? (
            <div className="note">Dynamic suite will auto-populate by module on create.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12 }}>
              <div style={{ border: "1px solid #e4e7ec", borderRadius: 8, padding: 10 }}>
                <strong>Available Test Cases</strong>
                <input className="input" placeholder="Search available" value={availableSearch} onChange={(e) => setAvailableSearch(e.target.value)} />
                <div className="listCompact" style={{ maxHeight: 240, overflow: "auto" }}>
                  {availableCases.map((tc) => (
                    <label key={tc.id} className="row" style={{ marginBottom: 0 }}>
                      <input type="checkbox" checked={leftPickedIds.includes(tc.id)} onChange={() => setLeftPickedIds((prev) => prev.includes(tc.id) ? prev.filter((id) => id !== tc.id) : [...prev, tc.id])} />
                      <span className="title">{toCaseLabel(tc)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
                <button className="button small" onClick={() => { setSelectedCaseIds((prev) => [...prev, ...leftPickedIds.filter((id) => !prev.includes(id))]); setLeftPickedIds([]); }}>Add →</button>
                <button className="button small" onClick={() => { setSelectedCaseIds((prev) => prev.filter((id) => !rightPickedIds.includes(id))); setRightPickedIds([]); }}>← Remove</button>
              </div>
              <div style={{ border: "1px solid #e4e7ec", borderRadius: 8, padding: 10 }}>
                <strong>Selected Test Cases</strong>
                <input className="input" placeholder="Search selected" value={selectedSearch} onChange={(e) => setSelectedSearch(e.target.value)} />
                <div className="listCompact" style={{ maxHeight: 240, overflow: "auto" }}>
                  {selectedCases.map((tc: any) => (
                    <label key={tc.id} className="row" style={{ marginBottom: 0 }}>
                      <input type="checkbox" checked={rightPickedIds.includes(tc.id)} onChange={() => setRightPickedIds((prev) => prev.includes(tc.id) ? prev.filter((id) => id !== tc.id) : [...prev, tc.id])} />
                      <span className="title">{toCaseLabel(tc)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="button" onClick={saveSuite}>Save Suite</button>
            <button className="button secondary" onClick={() => setView("LIST")}>Cancel</button>
          </div>
        </>
      )}
      {view === "DETAIL" && suiteDetails && (
        <>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <strong>{suiteDetails.name}</strong>
              <div className="note">
                Module: {suiteDetails.module || "N/A"} | Parent: {suiteDetails.parentSuite?.name || "None"} | Status:{" "}
                {suiteDetails.isArchived ? "ARCHIVED" : "ACTIVE"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="button small" onClick={() => goEdit(suiteDetails)}>Edit</button>
              <button className="button small" onClick={() => setAddDrawerOpen(true)} disabled={suiteDetails.isArchived}>Add Test Cases</button>
              <button className="button small" onClick={() => setView("LIST")}>Back</button>
            </div>
          </div>
          <div style={{ border: "1px solid #e4e7ec", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>#</th>
                  <th style={{ textAlign: "left", padding: 10 }}>ID</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Title</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Priority</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Status</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {detailCaseRows.map((row: any, idx: number) => (
                  <tr
                    key={row.id || row.testCaseId}
                    draggable={!suiteDetails.isArchived}
                    onDragStart={() => setDraggingCaseId(row.testCaseId)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async () => { await reorderAndSaveDetail(draggingCaseId, row.testCaseId); setDraggingCaseId(""); }}
                    style={{ borderTop: "1px solid #eef2f7", cursor: suiteDetails.isArchived ? "default" : "move" }}
                  >
                    <td style={{ padding: 10 }}>{idx + 1}</td>
                    <td style={{ padding: 10 }}>{row.testCase?.testCaseCode || row.testCaseId}</td>
                    <td style={{ padding: 10 }}>{row.testCase?.title || "Untitled"}</td>
                    <td style={{ padding: 10 }}>{row.testCase?.priority || "N/A"}</td>
                    <td style={{ padding: 10 }}>{row.testCase?.status || "N/A"}</td>
                    <td style={{ padding: 10 }}>
                      <button
                        className="button small danger"
                        disabled={suiteDetails.isArchived}
                        onClick={async () => {
                          try {
                            if (!window.confirm("Remove this test case from suite?")) return;
                            await removeSuiteTestCaseApi(suiteDetails.id, row.testCaseId);
                            await loadSuiteDetailBundle(suiteDetails.id);
                            await onRefreshData();
                          } catch (error: any) {
                            alert(getSuiteFriendlyError(error, "Remove case failed"));
                          }
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4 style={{ marginTop: 16 }}>Suite Executions</h4>
          {suiteExecutionHistory.length === 0 ? (
            <div className="note">No suite executions yet. Click "Execute Suite" to start.</div>
          ) : (
            <div className="listCompact">
              {suiteExecutionHistory.map((row: any) => (
                <div className="row" key={row.id}>
                  <span className="title">
                    {row.id.slice(0, 8)} | {row.mode} | {row.status}
                  </span>
                  <span className="meta">
                    {row.passed}/{row.totalCases} passed | {new Date(row.createdAt).toLocaleString()}
                  </span>
                  <button
                    className="button small"
                    onClick={() => {
                      setActiveExecutionId(row.id);
                      setView("EXECUTION");
                    }}
                  >
                    Open Execution
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {view === "EXECUTION" && suiteDetails && activeExecutionId && (
        <SuiteExecutionWorkspace
          suiteId={suiteDetails.id}
          executionId={activeExecutionId}
          onExecutionStarted={(id) => setActiveExecutionId(id)}
          onBackToDetail={async () => {
            await loadSuiteDetailBundle(suiteDetails.id);
            setView("DETAIL");
          }}
          getSuiteFriendlyError={getSuiteFriendlyError}
        />
      )}
      {addDrawerOpen && suiteDetails && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: "min(520px, 100%)", height: "100%", background: "#fff", padding: 16, boxShadow: "-8px 0 24px rgba(0,0,0,0.18)", overflow: "auto" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Add Test Cases</strong>
              <button className="button small" onClick={() => setAddDrawerOpen(false)}>Close</button>
            </div>
            <input className="input" placeholder="Search test cases" value={drawerSearch} onChange={(e) => setDrawerSearch(e.target.value)} />
            <div className="listCompact" style={{ maxHeight: "65vh", overflow: "auto" }}>
              {drawerCandidates.map((tc) => (
                <label key={tc.id} className="row" style={{ marginBottom: 0 }}>
                  <input type="checkbox" checked={drawerSelection.includes(tc.id)} onChange={() => setDrawerSelection((prev) => prev.includes(tc.id) ? prev.filter((id) => id !== tc.id) : [...prev, tc.id])} />
                  <span className="title">{toCaseLabel(tc)}</span>
                </label>
              ))}
            </div>
            <button className="button" onClick={saveDrawerCases} disabled={drawerSelection.length === 0}>Add Selected</button>
          </div>
        </div>
      )}
      {executeModalOpen && suiteDetails && (
        <div className="modalBackdrop" onClick={() => setExecuteModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Execute Suite</h4>
              <button className="button small" onClick={() => setExecuteModalOpen(false)}>Close</button>
            </div>
            <div className="note" style={{ marginBottom: 8 }}>
              {suiteDetails.name} | Configure execution and start.
            </div>
            <label className="fieldLabel">Execution Mode</label>
            <select className="input" value={executeMode} onChange={(e) => setExecuteMode((e.target.value as "SEQUENTIAL" | "PARALLEL") || "SEQUENTIAL")}>
              <option value="SEQUENTIAL">SEQUENTIAL (default)</option>
              <option value="PARALLEL">PARALLEL</option>
            </select>
            <label className="fieldLabel">Optional Linked Test Run</label>
            <select className="input" value={executeRunId} onChange={(e) => setExecuteRunId(e.target.value)}>
              <option value="">Auto-create linked run</option>
              {testRuns.map((run: any) => (
                <option key={run.id} value={run.id}>
                  {run.name} ({run.status})
                </option>
              ))}
            </select>
            <label className="fieldLabel">Optional Tester Assignment</label>
            <div className="listCompact" style={{ maxHeight: 180, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
              {testerOptions.length === 0 && <div className="note">No testers found.</div>}
              {testerOptions.map((tester) => (
                <label key={tester.id} className="row" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={selectedTesterIds.includes(tester.id)}
                    onChange={() =>
                      setSelectedTesterIds((prev) =>
                        prev.includes(tester.id) ? prev.filter((id) => id !== tester.id) : [...prev, tester.id]
                      )
                    }
                  />
                  <span className="title">{tester.name || "Tester"} - {tester.email}</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="button" onClick={startSuiteExecutionFlow}>
                Start Execution
              </button>
              <button className="button small" onClick={() => setExecuteModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SuiteManagementSection;
