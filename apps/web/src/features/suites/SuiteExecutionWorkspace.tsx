import React, { useEffect, useMemo, useState } from "react";
import {
  createBugFromExecutionApi,
  finalizeExecutionApi,
  getSuiteExecutionApi,
  listDeveloperUsersApi,
  openExecutionApi,
  pauseExecutionTimerApi,
  resumeExecutionTimerApi,
  saveExecutionStepApi,
  setExecutionManualDurationApi,
  startExecutionApi,
  startSuiteExecutionApi,
  startExecutionTimerApi,
} from "../../api";

type Props = {
  suiteId: string;
  executionId: string;
  onExecutionStarted: (executionId: string) => void;
  onBackToDetail: () => void;
  getSuiteFriendlyError: (error: any, fallback: string) => string;
};

type TimerState = "RUNNING" | "PAUSED" | "STOPPED";

const badgeClass = (status: string): string => {
  const value = String(status || "").toUpperCase();
  if (value === "PASSED" || value === "COMPLETED") return "statusBadge status-ready";
  if (value === "FAILED") return "statusBadge status-critical";
  if (value === "RUNNING" || value === "IN_PROGRESS") return "statusBadge status-ready_for_review";
  return "statusBadge status-draft";
};

const csvEscape = (value: unknown): string => {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const downloadCsv = (fileName: string, rows: unknown[][]) => {
  const csvText = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

const SuiteExecutionWorkspace: React.FC<Props> = ({
  suiteId,
  executionId,
  onExecutionStarted,
  onBackToDetail,
  getSuiteFriendlyError,
}) => {
  const [execution, setExecution] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [savingSuite, setSavingSuite] = useState(false);

  const [activeCase, setActiveCase] = useState<any>(null);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [activeSteps, setActiveSteps] = useState<any[]>([]);
  const [activeProgress, setActiveProgress] = useState(0);
  const [activeExecutionNotes, setActiveExecutionNotes] = useState("");
  const [activeStepNumber, setActiveStepNumber] = useState("");
  const [activeStepStatus, setActiveStepStatus] = useState("");
  const [activeActualResult, setActiveActualResult] = useState("");
  const [activeStepNotes, setActiveStepNotes] = useState("");
  const [timerState, setTimerState] = useState<TimerState>("STOPPED");
  const [timerStartedAt, setTimerStartedAt] = useState("");
  const [timerCompletedAt, setTimerCompletedAt] = useState("");
  const [timerDurationSeconds, setTimerDurationSeconds] = useState<number | null>(null);
  const [manualDurationMinutes, setManualDurationMinutes] = useState("");
  const [savingStep, setSavingStep] = useState(false);
  const [finalizingCase, setFinalizingCase] = useState(false);
  const [developerOptions, setDeveloperOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [showFailedBugModal, setShowFailedBugModal] = useState(false);
  const [failedExecutionId, setFailedExecutionId] = useState("");
  const [failedCaseLabel, setFailedCaseLabel] = useState("");
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSeverity, setBugSeverity] = useState("HIGH");
  const [bugExpectedBehavior, setBugExpectedBehavior] = useState("");
  const [bugActualBehavior, setBugActualBehavior] = useState("");
  const [bugAssignedTo, setBugAssignedTo] = useState("");
  const [creatingBug, setCreatingBug] = useState(false);

  const refreshExecution = async () => {
    if (!executionId) return;
    setLoading(true);
    try {
      const detail = await getSuiteExecutionApi(executionId);
      setExecution(detail || null);
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Failed to load suite execution"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshExecution().catch(() => undefined);
  }, [executionId]);

  useEffect(() => {
    if (!executionId) return;
    const timer = window.setInterval(() => {
      getSuiteExecutionApi(executionId)
        .then((detail) => setExecution(detail || null))
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [executionId]);

  useEffect(() => {
    listDeveloperUsersApi()
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
        setDeveloperOptions(normalized);
      })
      .catch(() => {
        setDeveloperOptions([]);
      });
  }, []);

  const caseRows = useMemo(() => (Array.isArray(execution?.cases) ? execution.cases : []), [execution]);
  const total = Number(execution?.totalCases || caseRows.length || 0);
  const passed = Number(execution?.passed || 0);
  const failed = Number(execution?.failed || 0);
  const blocked = Number(execution?.blocked || 0);
  const skipped = Number(execution?.skipped || 0);
  const completed = passed + failed + blocked + skipped;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const passRate = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0;
  const nextSequentialCase = useMemo(
    () => caseRows.find((row: any) => String(row?.status || "").toUpperCase() === "NOT_RUN") || null,
    [caseRows]
  );
  const pendingCount = Math.max(0, total - completed);

  const isRunning = String(execution?.status || "").toUpperCase() === "RUNNING" && pendingCount > 0;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isRunning) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning]);

  const statusCounts = useMemo(
    () => ({
      NOT_RUN: caseRows.filter((row: any) => row.status === "NOT_RUN").length,
      PASSED: caseRows.filter((row: any) => row.status === "PASSED").length,
      FAILED: caseRows.filter((row: any) => row.status === "FAILED").length,
      BLOCKED: caseRows.filter((row: any) => row.status === "BLOCKED").length,
      SKIPPED: caseRows.filter((row: any) => row.status === "SKIPPED").length,
    }),
    [caseRows]
  );

  const statusTotal =
    statusCounts.NOT_RUN + statusCounts.PASSED + statusCounts.FAILED + statusCounts.BLOCKED + statusCounts.SKIPPED || 1;
  const statusPie = `conic-gradient(
    #cbd5e1 0deg ${(statusCounts.NOT_RUN / statusTotal) * 360}deg,
    #16a34a ${(statusCounts.NOT_RUN / statusTotal) * 360}deg ${((statusCounts.NOT_RUN + statusCounts.PASSED) / statusTotal) * 360}deg,
    #dc2626 ${((statusCounts.NOT_RUN + statusCounts.PASSED) / statusTotal) * 360}deg ${((statusCounts.NOT_RUN + statusCounts.PASSED + statusCounts.FAILED) / statusTotal) * 360}deg,
    #d97706 ${((statusCounts.NOT_RUN + statusCounts.PASSED + statusCounts.FAILED) / statusTotal) * 360}deg ${((statusCounts.NOT_RUN + statusCounts.PASSED + statusCounts.FAILED + statusCounts.BLOCKED) / statusTotal) * 360}deg,
    #64748b ${((statusCounts.NOT_RUN + statusCounts.PASSED + statusCounts.FAILED + statusCounts.BLOCKED) / statusTotal) * 360}deg 360deg
  )`;

  const moduleBreakdown = useMemo(() => {
    const buckets = new Map<string, { total: number; passed: number; failed: number }>();
    caseRows.forEach((row: any) => {
      const module = String(row?.testCase?.module || "Unspecified");
      const next = buckets.get(module) || { total: 0, passed: 0, failed: 0 };
      next.total += 1;
      if (row?.status === "PASSED") next.passed += 1;
      if (row?.status === "FAILED") next.failed += 1;
      buckets.set(module, next);
    });
    return Array.from(buckets.entries()).map(([module, value]) => ({ module, ...value }));
  }, [caseRows]);

  const failedRows = useMemo(() => caseRows.filter((row: any) => row.status === "FAILED"), [caseRows]);
  const timelineRows = useMemo(
    () =>
      caseRows
        .filter((row: any) => row?.execution?.executedAt)
        .map((row: any) => ({
          id: row.id,
          code: row?.testCase?.testCaseCode || row?.testCaseId,
          title: row?.testCase?.title || "Untitled",
          status: row.status,
          executedAt: row.execution.executedAt,
        }))
        .sort((a: any, b: any) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()),
    [caseRows]
  );

  const openCaseExecutor = async (suiteCaseRow: any) => {
    try {
      if (!suiteCaseRow?.testCaseId) return;
      if (!execution?.linkedTestRun?.id) {
        alert("Linked test run not found for this suite execution.");
        return;
      }
      let openRes = await openExecutionApi(suiteCaseRow.testCaseId, execution.linkedTestRun.id);
      if (!openRes?.draftExecution) {
        await startExecutionApi({ testCaseId: suiteCaseRow.testCaseId, testRunId: execution.linkedTestRun.id });
        openRes = await openExecutionApi(suiteCaseRow.testCaseId, execution.linkedTestRun.id);
      }
      const draft = openRes?.draftExecution;
      if (!draft?.id) {
        alert("Unable to open execution draft.");
        return;
      }
      setActiveCase(suiteCaseRow);
      setActiveDraftId(draft.id);
      setActiveSteps(Array.isArray(draft.stepResults) ? draft.stepResults : Array.isArray(openRes?.stepResults) ? openRes.stepResults : []);
      setActiveProgress(Number(draft.progressPercent || 0));
      setActiveExecutionNotes(String(draft.notes || ""));
      setActiveStepNumber("");
      setActiveStepStatus("");
      setActiveActualResult("");
      setActiveStepNotes("");
      const serverTimerState = String(draft.timerState || "").toUpperCase();
      if (serverTimerState === "RUNNING" || serverTimerState === "PAUSED" || serverTimerState === "STOPPED") {
        setTimerState(serverTimerState as TimerState);
      } else {
        setTimerState(draft.startedAt ? "RUNNING" : "STOPPED");
      }
      setTimerStartedAt(String(draft.startedAt || ""));
      setTimerCompletedAt(String(draft.completedAt || ""));
      setTimerDurationSeconds(typeof draft.durationSeconds === "number" ? draft.durationSeconds : null);
      setManualDurationMinutes(
        typeof draft.manualDurationSeconds === "number" ? String(Math.round(draft.manualDurationSeconds / 60)) : ""
      );
      if (!draft.startedAt && !draft.completedAt) {
        try {
          const timer = await startExecutionTimerApi(draft.id);
          updateTimerFromResponse(timer);
          setTimerState("RUNNING");
        } catch {
          // keep execution open even if timer auto-start fails
        }
      }
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Open case executor failed"));
    }
  };

  const saveStep = async () => {
    try {
      const stepNumber = Number(activeStepNumber);
      if (!activeDraftId) {
        alert("Execution draft not ready");
        return;
      }
      if (!Number.isFinite(stepNumber) || stepNumber <= 0) {
        alert("Select a valid step");
        return;
      }
      if (!activeStepStatus) {
        alert("Select step status");
        return;
      }
      setSavingStep(true);
      const saved = await saveExecutionStepApi(activeDraftId, stepNumber, {
        status: activeStepStatus,
        actualResult: activeActualResult,
        notes: activeStepNotes,
        executionNotes: activeExecutionNotes,
      });
      setActiveSteps(Array.isArray(saved?.stepResults) ? saved.stepResults : activeSteps);
      setActiveProgress(Number(saved?.progressPercent || 0));
      setActiveStepNumber("");
      setActiveStepStatus("");
      setActiveActualResult("");
      setActiveStepNotes("");
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Save step failed"));
    } finally {
      setSavingStep(false);
    }
  };

  const updateTimerFromResponse = (timer: any) => {
    if (!timer) return;
    setTimerStartedAt(String(timer?.startedAt || timerStartedAt || ""));
    setTimerCompletedAt(String(timer?.completedAt || ""));
    setTimerDurationSeconds(typeof timer?.durationSeconds === "number" ? timer.durationSeconds : timerDurationSeconds);
  };

  const finalizeCaseExecution = async () => {
    try {
      if (!activeDraftId) {
        alert("Execution draft not ready");
        return;
      }
      const draftIdBeforeFinalize = activeDraftId;
      const activeCaseBeforeFinalize = activeCase;
      setFinalizingCase(true);
      const finalized = await finalizeExecutionApi(activeDraftId, { notes: activeExecutionNotes });
      const finalResult = String(finalized?.result || "").toUpperCase();
      const previousMode = String(execution?.mode || "").toUpperCase();
      await refreshExecution();
      const currentExecution = await getSuiteExecutionApi(executionId);
      setExecution(currentExecution || null);
      setActiveCase(null);
      setActiveDraftId("");
      setActiveSteps([]);
      setActiveProgress(0);
      if (previousMode === "SEQUENTIAL") {
        const nextCase = (currentExecution?.cases || []).find((row: any) => row.status === "NOT_RUN");
        if (nextCase) {
          await openCaseExecutor(nextCase);
        }
      }
      if (finalResult === "FAILED") {
        setFailedExecutionId(draftIdBeforeFinalize);
        setFailedCaseLabel(
          `${activeCaseBeforeFinalize?.testCase?.testCaseCode || activeCaseBeforeFinalize?.testCaseId || ""} - ${activeCaseBeforeFinalize?.testCase?.title || "Untitled"}`
        );
        setBugTitle(`Failure in ${activeCaseBeforeFinalize?.testCase?.title || "test case"}`);
        setBugDescription("Test case execution failed in suite execution workspace.");
        setBugSeverity("HIGH");
        setBugExpectedBehavior("");
        setBugActualBehavior("");
        setBugAssignedTo("");
        setShowFailedBugModal(true);
        alert("Test case execution failed. Create bug report now.");
      } else if (finalResult === "PASSED") {
        alert("Test case execution completed successfully.");
      } else if (finalResult === "SKIPPED") {
        alert("Test case execution skipped. Use Execute Skipped Execution to run again.");
      } else {
        alert(`Test case execution finalized: ${finalResult || "DONE"}`);
      }
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, "Finalize case execution failed"));
    } finally {
      setFinalizingCase(false);
    }
  };

  const finalizeSuiteExecution = async () => {
    setSavingSuite(true);
    try {
      await refreshExecution();
      if (pendingCount > 0) {
        alert(`Cannot finalize suite execution yet. Pending test cases: ${pendingCount}`);
        return;
      }
      setShowReport(true);
    } finally {
      setSavingSuite(false);
    }
  };

  const reExecute = async (failedOnly: boolean) => {
    try {
      const started = await startSuiteExecutionApi({
        suiteId,
        mode: execution?.mode || "SEQUENTIAL",
        reexecuteFromExecutionId: execution?.id,
        reexecuteFailedOnly: failedOnly,
      });
      if (started?.id) {
        onExecutionStarted(started.id);
        setShowReport(false);
      }
    } catch (error: any) {
      alert(getSuiteFriendlyError(error, failedOnly ? "Re-run failed only failed" : "Re-run all failed"));
    }
  };

  const exportDetailedCsv = () => {
    const rows: unknown[][] = [
      ["Suite", execution?.suite?.name || ""],
      ["Execution Id", execution?.id || ""],
      ["Mode", execution?.mode || ""],
      ["Status", execution?.status || ""],
      ["Total", total],
      ["Passed", passed],
      ["Failed", failed],
      ["Blocked", blocked],
      ["Skipped", skipped],
      ["Pass Rate", `${passRate}%`],
      [],
      ["Order", "Test Case", "Title", "Module", "Status", "Last Change", "Executed At"],
      ...caseRows.map((row: any) => [
        row.position,
        row?.testCase?.testCaseCode || row?.testCaseId,
        row?.testCase?.title || "Untitled",
        row?.testCase?.module || "",
        row?.status || "",
        row?.updatedAt || "",
        row?.execution?.executedAt || "",
      ]),
    ];
    downloadCsv(`suite-execution-${execution?.id || executionId}.csv`, rows);
  };

  const selectedStep = useMemo(() => {
    const stepNo = Number(activeStepNumber);
    if (!Number.isFinite(stepNo)) return null;
    return activeSteps.find((row: any) => Number(row?.stepNumber) === stepNo) || null;
  }, [activeStepNumber, activeSteps]);

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <h4 style={{ marginBottom: 4 }}>{execution?.suite?.name || "Suite Execution"}</h4>
          <div className="note">
            Status: <span className={badgeClass(execution?.status || "PLANNED")}>{execution?.status || "PLANNED"}</span> | Mode:{" "}
            {execution?.mode || "N/A"} | Pass Rate: {passRate}%
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!showReport && (
            <button className="button small" onClick={finalizeSuiteExecution} disabled={savingSuite}>
              Finalize Suite Execution
            </button>
          )}
          {showReport ? (
            <button className="button small" onClick={() => setShowReport(false)}>Back To Execution</button>
          ) : (
            <button className="button small" onClick={() => setShowReport(true)} disabled={pendingCount > 0}>
              View Detailed Report
            </button>
          )}
          <button className="button small" onClick={refreshExecution} disabled={loading}>Refresh</button>
          <button
            className="button small"
            onClick={() => {
              if (isRunning && !window.confirm("Suite execution is running. Leave this page?")) return;
              onBackToDetail();
            }}
          >
            Back
          </button>
        </div>
      </div>

      {!showReport && (
        <>
          <div className="testCaseDetails">
            <div><strong>Total:</strong> {total}</div>
            <div><strong>Passed:</strong> {passed}</div>
            <div><strong>Failed:</strong> {failed}</div>
            <div><strong>Blocked:</strong> {blocked}</div>
            <div><strong>Skipped:</strong> {skipped}</div>
            <div><strong>Pending:</strong> {pendingCount}</div>
            <div><strong>Progress:</strong> {progressPercent}%</div>
          </div>
          <div style={{ marginTop: 8, marginBottom: 10 }}>
            <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", background: "#2563eb" }} />
            </div>
          </div>

          {String(execution?.mode || "").toUpperCase() === "SEQUENTIAL" ? (
            <div className="panel" style={{ marginTop: 8 }}>
              <h4>Sequential Execution</h4>
              {nextSequentialCase ? (
                <>
                  <div className="testCaseDetails">
                    <div><strong>Now Executing:</strong> #{nextSequentialCase.position}</div>
                    <div><strong>ID:</strong> {nextSequentialCase?.testCase?.testCaseCode || nextSequentialCase?.testCaseId}</div>
                    <div><strong>Title:</strong> {nextSequentialCase?.testCase?.title || "Untitled"}</div>
                    <div><strong>Priority:</strong> {nextSequentialCase?.testCase?.priority || "N/A"}</div>
                    <div><strong>Last Change:</strong> {nextSequentialCase?.updatedAt ? new Date(nextSequentialCase.updatedAt).toLocaleString() : "N/A"}</div>
                  </div>
                  <button className="button" onClick={() => openCaseExecutor(nextSequentialCase)}>
                    {String(nextSequentialCase?.status || "").toUpperCase() === "SKIPPED"
                      ? "Execute Skipped Execution"
                      : "Open Step Execution"}
                  </button>
                </>
              ) : (
                <div className="note">All suite test cases have been executed.</div>
              )}
            </div>
          ) : (
            <div className="panel" style={{ marginTop: 8 }}>
              <h4>Parallel Execution</h4>
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Last Change</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseRows.map((row: any) => (
                      <tr key={row.id}>
                        <td>{row.position}</td>
                        <td>{row?.testCase?.testCaseCode || row?.testCaseId}</td>
                        <td>{row?.testCase?.title || "Untitled"}</td>
                        <td><span className={badgeClass(row.status)}>{row.status}</span></td>
                        <td>{row?.updatedAt ? new Date(row.updatedAt).toLocaleString() : "N/A"}</td>
                        <td>
                          <button className="button small" onClick={() => openCaseExecutor(row)}>
                            {String(row?.status || "").toUpperCase() === "SKIPPED"
                              ? "Execute Skipped Execution"
                              : "Open Step Execution"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showReport && (
        <div className="panel">
          <h4>Detailed Report</h4>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button className="button small" onClick={exportDetailedCsv}>Export CSV</button>
            <button className="button small" onClick={() => window.print()}>Export PDF</button>
          </div>
          <div className="inlineGrid">
            <div className="panel">
              <h4>Status Distribution</h4>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 120, height: 120, borderRadius: "50%", background: statusPie }} />
                <div style={{ display: "grid", gap: 6 }}>
                  <div>Not Run: {statusCounts.NOT_RUN}</div>
                  <div>Passed: {statusCounts.PASSED}</div>
                  <div>Failed: {statusCounts.FAILED}</div>
                  <div>Blocked: {statusCounts.BLOCKED}</div>
                  <div>Skipped: {statusCounts.SKIPPED}</div>
                </div>
              </div>
            </div>
            <div className="panel">
              <h4>Module Breakdown</h4>
              <div className="listCompact">
                {moduleBreakdown.map((row) => (
                  <div className="row" key={row.module}>
                    <span className="title">{row.module}</span>
                    <span className="meta">Total: {row.total} | Passed: {row.passed} | Failed: {row.failed}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 8 }}>
            <h4>Failed Test Cases</h4>
            {failedRows.length === 0 ? (
              <div className="note">No failed cases.</div>
            ) : (
              <div className="listCompact">
                {failedRows.map((row: any) => (
                  <div className="row" key={row.id}>
                    <span className="title">{row?.testCase?.testCaseCode || row?.testCaseId} - {row?.testCase?.title || "Untitled"}</span>
                    <span className="meta">{row.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel" style={{ marginTop: 8 }}>
            <h4>Execution Timeline</h4>
            {timelineRows.length === 0 ? (
              <div className="note">No timeline entries yet.</div>
            ) : (
              <div className="listCompact">
                {timelineRows.map((row: any) => (
                  <div className="row" key={row.id}>
                    <span className="title">{row.code} - {row.title}</span>
                    <span className="meta">{row.status} | {new Date(row.executedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="button small" onClick={() => reExecute(false)}>Re-run All</button>
            <button className="button small" onClick={() => reExecute(true)} disabled={failedRows.length === 0}>
              Re-run Failed Only
            </button>
          </div>
        </div>
      )}

      {activeCase && (
        <div className="modalBackdrop" onClick={() => setActiveCase(null)}>
          <div className="modalCard suiteExecModal" onClick={(e) => e.stopPropagation()}>
            <div className="row suiteExecModalHeader">
              <h4 style={{ margin: 0 }}>Test Case Execution</h4>
              <button className="button small" onClick={() => setActiveCase(null)}>Close</button>
            </div>
            <div className="suiteExecMeta">
              <div><strong>ID:</strong> {activeCase?.testCase?.testCaseCode || activeCase?.testCaseId}</div>
              <div><strong>Title:</strong> {activeCase?.testCase?.title || "Untitled"}</div>
              <div><strong>Progress:</strong> {activeProgress}%</div>
              <div><strong>Last Change:</strong> {activeCase?.updatedAt ? new Date(activeCase.updatedAt).toLocaleString() : "N/A"}</div>
            </div>
            <div className="suiteExecSection">
              <div className="suiteExecSectionTitle">Timer</div>
              <div className="suiteExecButtonRow">
                <button
                  className="button small"
                  onClick={async () => {
                    try {
                      if (timerState === "RUNNING") {
                        const timer = await pauseExecutionTimerApi(activeDraftId);
                        updateTimerFromResponse(timer);
                        setTimerState("PAUSED");
                        return;
                      }
                      const timer = await resumeExecutionTimerApi(activeDraftId);
                      updateTimerFromResponse(timer);
                      setTimerState("RUNNING");
                    } catch (error: any) {
                      alert(getSuiteFriendlyError(error, "Pause/Resume timer failed"));
                    }
                  }}
                >
                  {timerState === "RUNNING" ? "Pause Timer" : "Resume Timer"}
                </button>
              </div>
              <div className="note">
                Timer: {timerState} | Started: {timerStartedAt ? new Date(timerStartedAt).toLocaleString() : "N/A"} | Completed:{" "}
                {timerCompletedAt ? new Date(timerCompletedAt).toLocaleString() : "N/A"} | Duration:{" "}
                {typeof timerDurationSeconds === "number" ? `${timerDurationSeconds}s` : "N/A"}
              </div>
              <div className="suiteExecButtonRow">
                <input
                  className="input"
                  type="number"
                  min={0}
                  placeholder="Manual duration (minutes)"
                  value={manualDurationMinutes}
                  onChange={(e) => setManualDurationMinutes(e.target.value)}
                />
                <button
                  className="button small"
                  onClick={async () => {
                    try {
                      const mins = Number(manualDurationMinutes);
                      if (!Number.isFinite(mins) || mins < 0) {
                        alert("Enter valid minutes");
                        return;
                      }
                      const timer = await setExecutionManualDurationApi(activeDraftId, { durationMinutes: mins });
                      updateTimerFromResponse(timer);
                    } catch (error: any) {
                      alert(getSuiteFriendlyError(error, "Save manual duration failed"));
                    }
                  }}
                >
                  Save Manual Duration
                </button>
              </div>
            </div>

            <div className="suiteExecSection">
              <div className="suiteExecSectionTitle">Step Execution</div>
              <select className="input" value={activeStepNumber} onChange={(e) => setActiveStepNumber(e.target.value)}>
                <option value="">Select step</option>
                {activeSteps.map((step: any) => (
                  <option key={step.stepNumber} value={step.stepNumber}>
                    Step {step.stepNumber}: {step.action} [{step.status}]
                  </option>
                ))}
              </select>
              {selectedStep && (
                <div className="suiteExecExpected">
                  <strong>Expected Result</strong>
                  <div>{selectedStep.expectedResult || "N/A"}</div>
                </div>
              )}
              <select className="input" value={activeStepStatus} onChange={(e) => setActiveStepStatus(e.target.value)}>
                <option value="">Select step status</option>
                <option value="PASSED">PASSED</option>
                <option value="FAILED">FAILED</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="SKIPPED">SKIPPED</option>
              </select>
              <textarea
                className="input"
                rows={3}
                placeholder="Actual result"
                value={activeActualResult}
                onChange={(e) => setActiveActualResult(e.target.value)}
              />
              <textarea
                className="input"
                rows={2}
                placeholder="Step notes"
                value={activeStepNotes}
                onChange={(e) => setActiveStepNotes(e.target.value)}
              />
              <textarea
                className="input"
                rows={3}
                placeholder="Execution notes"
                value={activeExecutionNotes}
                onChange={(e) => setActiveExecutionNotes(e.target.value)}
              />
            </div>

            <div className="suiteExecFooterActions">
              <button className="button" disabled={savingStep} onClick={saveStep}>Save Step</button>
              <button className="button" disabled={finalizingCase} onClick={finalizeCaseExecution}>
                Finalize Test Case Execution
              </button>
            </div>
          </div>
        </div>
      )}
      {showFailedBugModal && (
        <div className="modalBackdrop" onClick={() => setShowFailedBugModal(false)}>
          <div className="modalCard executionPopupCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Create Bug Report</h4>
              <button className="button small" onClick={() => setShowFailedBugModal(false)}>Close</button>
            </div>
            <div className="note">
              Linked execution: {failedExecutionId || "N/A"} {failedCaseLabel ? `| ${failedCaseLabel}` : ""}
            </div>
            <input
              className="input"
              placeholder="Bug title"
              value={bugTitle}
              onChange={(e) => setBugTitle(e.target.value)}
            />
            <textarea
              className="input"
              rows={2}
              placeholder="Bug description"
              value={bugDescription}
              onChange={(e) => setBugDescription(e.target.value)}
            />
            <select className="input" value={bugSeverity} onChange={(e) => setBugSeverity(e.target.value)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <textarea
              className="input"
              rows={2}
              placeholder="Expected behavior"
              value={bugExpectedBehavior}
              onChange={(e) => setBugExpectedBehavior(e.target.value)}
            />
            <textarea
              className="input"
              rows={2}
              placeholder="Actual behavior"
              value={bugActualBehavior}
              onChange={(e) => setBugActualBehavior(e.target.value)}
            />
            <select className="input" value={bugAssignedTo} onChange={(e) => setBugAssignedTo(e.target.value)}>
              <option value="">Assign to Developer (optional)</option>
              {developerOptions.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name ? `${dev.name} - ` : ""}
                  {dev.email}
                </option>
              ))}
            </select>
            <button
              className="button"
              disabled={creatingBug || !failedExecutionId}
              onClick={async () => {
                try {
                  if (!failedExecutionId) {
                    alert("Missing failed execution context.");
                    return;
                  }
                  setCreatingBug(true);
                  const issue = await createBugFromExecutionApi(failedExecutionId, {
                    title: bugTitle || undefined,
                    description: bugDescription || undefined,
                    severity: bugSeverity || undefined,
                    expectedBehavior: bugExpectedBehavior || undefined,
                    actualBehavior: bugActualBehavior || undefined,
                    assignedTo: bugAssignedTo || undefined,
                  });
                  setShowFailedBugModal(false);
                  alert(
                    `Bug created and linked to suite execution: ${issue?.bugId || issue?.id}.` +
                      (bugAssignedTo ? " Assigned developer has been notified." : "")
                  );
                } catch (error: any) {
                  alert(getSuiteFriendlyError(error, "Create bug report failed"));
                } finally {
                  setCreatingBug(false);
                }
              }}
            >
              {creatingBug ? "Creating..." : "Create Bug"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default SuiteExecutionWorkspace;
