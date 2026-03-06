import { useEffect, useMemo, useRef, useState } from "react";
import {
  createBugFromExecutionApi,
  deleteExecutionEvidenceApi,
  finalizeExecutionApi,
  getSuiteExecutionApi,
  listExecutionEvidenceApi,
  pauseExecutionTimerApi,
  resumeExecutionTimerApi,
  saveExecutionStepApi,
  startExecutionTimerApi,
  stopExecutionTimerApi,
  uploadExecutionEvidenceApi,
} from "../../api";

type Props = {
  executionCaseId: string;
  setExecutionCaseId: (value: string) => void;
  executionSelectableCases: any[];
  executionRunId: string;
  setExecutionRunId: (value: string) => void;
  testRuns: any[];
  setActiveSuiteExecutionContext: (value: any) => void;
  openExecutionSession: (testCaseId: string, runId?: string) => Promise<void>;
  executionId: string;
  executionSteps: any[];
  executionProgress: number;
  executionStartedAt: string;
  setExecutionStartedAt: (value: string) => void;
  executionCompletedAt: string;
  setExecutionCompletedAt: (value: string) => void;
  executionDurationSeconds: number | null;
  setExecutionDurationSeconds: (value: number | null) => void;
  executionSelectedStepNumber: string;
  setExecutionSelectedStepNumber: (value: string) => void;
  executionStepStatus: string;
  setExecutionStepStatus: (value: string) => void;
  executionActualResult: string;
  setExecutionActualResult: (value: string) => void;
  executionStepNotes: string;
  setExecutionStepNotes: (value: string) => void;
  executionNotes: string;
  setExecutionNotes: (value: string) => void;
  setExecutionSteps: (rows: any[]) => void;
  setExecutionProgress: (value: number) => void;
  loadTestCaseData: () => Promise<void>;
  activeSuiteExecutionContext: any;
  setSuiteExecutionDetails: (value: any) => void;
  openSuiteExecutionCase: (suiteExecution: any, suiteCase: any) => Promise<void>;
  setSelectedExecutionReportId: (value: string) => void;
  setExecutionEvidence: (rows: any[] | ((prev: any[]) => any[])) => void;
  executionEvidence: any[];
  evidenceType: string;
  setEvidenceType: (value: string) => void;
  evidenceName: string;
  setEvidenceName: (value: string) => void;
  evidenceUrl: string;
  setEvidenceUrl: (value: string) => void;
  evidenceNotes: string;
  setEvidenceNotes: (value: string) => void;
  executionReports: any[];
  selectedExecutionReportId: string;
  setSelectedExecutionReportIdState: (value: string) => void;
  quickBugTitle: string;
  setQuickBugTitle: (value: string) => void;
  quickBugDescription: string;
  setQuickBugDescription: (value: string) => void;
  quickBugSeverity: string;
  setQuickBugSeverity: (value: string) => void;
  quickBugExpectedBehavior: string;
  setQuickBugExpectedBehavior: (value: string) => void;
  quickBugActualBehavior: string;
  setQuickBugActualBehavior: (value: string) => void;
  quickBugAssignedTo: string;
  setQuickBugAssignedTo: (value: string) => void;
  developerDirectory: Array<{ id: string; name: string; email: string }>;
  resetQuickBugFields: () => void;
  setExecutionId: (value: string) => void;
  onQuickBugCreated?: (issue: any) => Promise<void> | void;
};

const ExecuteTestsSection = ({
  executionCaseId,
  setExecutionCaseId,
  executionSelectableCases,
  executionRunId,
  setExecutionRunId,
  testRuns,
  setActiveSuiteExecutionContext,
  openExecutionSession,
  executionId,
  executionSteps,
  executionProgress,
  executionStartedAt,
  setExecutionStartedAt,
  executionCompletedAt,
  setExecutionCompletedAt,
  executionDurationSeconds,
  setExecutionDurationSeconds,
  executionSelectedStepNumber,
  setExecutionSelectedStepNumber,
  executionStepStatus,
  setExecutionStepStatus,
  executionActualResult,
  setExecutionActualResult,
  executionStepNotes,
  setExecutionStepNotes,
  executionNotes,
  setExecutionNotes,
  setExecutionSteps,
  setExecutionProgress,
  loadTestCaseData,
  activeSuiteExecutionContext,
  setSuiteExecutionDetails,
  openSuiteExecutionCase,
  setSelectedExecutionReportId,
  setExecutionEvidence,
  executionEvidence,
  evidenceType,
  setEvidenceType,
  evidenceName,
  setEvidenceName,
  evidenceUrl,
  setEvidenceUrl,
  evidenceNotes,
  setEvidenceNotes,
  executionReports,
  selectedExecutionReportId,
  setSelectedExecutionReportIdState,
  quickBugTitle,
  setQuickBugTitle,
  quickBugDescription,
  setQuickBugDescription,
  quickBugSeverity,
  setQuickBugSeverity,
  quickBugExpectedBehavior,
  setQuickBugExpectedBehavior,
  quickBugActualBehavior,
  setQuickBugActualBehavior,
  quickBugAssignedTo,
  setQuickBugAssignedTo,
  developerDirectory,
  resetQuickBugFields,
  setExecutionId,
  onQuickBugCreated,
}: Props) => {
  const [timerState, setTimerState] = useState<"RUNNING" | "PAUSED" | "STOPPED">("STOPPED");
  const [showQuickBugModal, setShowQuickBugModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [postFinalizeResult, setPostFinalizeResult] = useState<"" | "PASSED" | "FAILED" | "BLOCKED" | "SKIPPED">("");
  const autoStartedExecutionRef = useRef<string>("");

  useEffect(() => {
    if (executionCompletedAt) {
      setTimerState("STOPPED");
      return;
    }
    if (executionStartedAt) {
      setTimerState("RUNNING");
      return;
    }
    setTimerState("STOPPED");
  }, [executionStartedAt, executionCompletedAt, executionId]);

  useEffect(() => {
    if (executionId && executionSteps.length > 0) {
      setShowExecutionModal(true);
    }
  }, [executionId, executionSteps.length]);

  useEffect(() => {
    if (!executionId) {
      autoStartedExecutionRef.current = "";
      return;
    }
    if (executionStartedAt || executionCompletedAt) return;
    if (autoStartedExecutionRef.current === executionId) return;
    autoStartedExecutionRef.current = executionId;
    startExecutionTimerApi(executionId)
      .then((timer) => {
        setExecutionStartedAt(timer?.startedAt || executionStartedAt);
        setExecutionCompletedAt("");
        setExecutionDurationSeconds(
          typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
        );
        setTimerState("RUNNING");
      })
      .catch(() => {
        // Message will be handled by next user action/finalize if timer control fails.
      });
  }, [
    executionId,
    executionStartedAt,
    executionCompletedAt,
    executionDurationSeconds,
    setExecutionStartedAt,
    setExecutionCompletedAt,
    setExecutionDurationSeconds,
  ]);

  const effectiveEvidenceExecutionId = executionId || selectedExecutionReportId;

  const selectedExecutionReport = useMemo(
    () => executionReports.find((item) => item.id === selectedExecutionReportId) || null,
    [executionReports, selectedExecutionReportId]
  );

  const selectedExecutionCase = useMemo(
    () => executionSelectableCases.find((item) => item.id === executionCaseId) || null,
    [executionSelectableCases, executionCaseId]
  );
  const selectedExecutionCaseStatus = String(selectedExecutionCase?.status || "").toUpperCase();
  const isArchivedCase = selectedExecutionCaseStatus === "ARCHIVED";
  const isApprovedCase = selectedExecutionCaseStatus === "APPROVED";
  const canOpenExecution =
    Boolean(executionCaseId) &&
    !isArchivedCase &&
    isApprovedCase &&
    (!executionRunId || executionSelectableCases.some((tc) => tc.id === executionCaseId));

  const inferEvidenceType = (mimeType: string): string => {
    const type = String(mimeType || "").toLowerCase();
    if (type.startsWith("image/")) return "IMAGE";
    if (type.startsWith("video/")) return "VIDEO";
    if (type.includes("pdf") || type.includes("text") || type.includes("msword") || type.includes("officedocument")) {
      return "DOCUMENT";
    }
    return "LOG";
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  return (
    <section className="panel executionCompactPanel">
      <div className="executionEntryCard">
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Execute Tests</h4>
        <div className="note" style={{ marginBottom: 10 }}>
          Run test cases step-by-step with evidence and timing.
        </div>
        <select className="input" value={executionCaseId} onChange={(e) => setExecutionCaseId(e.target.value)}>
          <option value="">Select Test Case</option>
          {executionSelectableCases.map((tc) => (
            <option key={tc.id} value={tc.id}>
              {tc.testCaseCode || tc.id} - {tc.title}
            </option>
          ))}
        </select>
        <select className="input" value={executionRunId} onChange={(e) => setExecutionRunId(e.target.value)}>
          <option value="">Optional: Link to Test Run</option>
          {testRuns.map((run) => (
            <option key={run.id} value={run.id}>
              {run.name}
            </option>
          ))}
        </select>
        <button
          className="button"
          disabled={!canOpenExecution}
          onClick={async () => {
            try {
              setActiveSuiteExecutionContext(null);
              if (!executionCaseId) {
                alert("Select a test case");
                return;
              }
              if (isArchivedCase) {
                alert("Access denied. Archived test cases cannot be modified or executed.");
                return;
              }
              if (!isApprovedCase) {
                alert("Only APPROVED test cases can be executed.");
                return;
              }
              if (executionRunId) {
                const inRun = executionSelectableCases.some((tc) => tc.id === executionCaseId);
                if (!inRun) {
                  alert("Selected test case is not part of the selected test run.");
                  return;
                }
              }
              await openExecutionSession(executionCaseId, executionRunId || undefined);
              setShowExecutionModal(true);
            } catch (error: any) {
              alert(error?.message || "Open execution failed");
            }
          }}
        >
          Open Execution Mode
        </button>
      </div>
      {executionCaseId && !isApprovedCase && !isArchivedCase ? (
        <div className="note">Execution is enabled only when test case status is APPROVED.</div>
      ) : null}
      {executionCaseId && isArchivedCase ? (
        <div className="note">Archived test cases cannot be executed.</div>
      ) : null}
      {executionId && executionSteps.length > 0 && showExecutionModal && (
        <div className="modalBackdrop" onClick={() => setShowExecutionModal(false)}>
          <div className="modalCard executionPopupCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Execution Workspace</h4>
              <button className="button small" onClick={() => setShowExecutionModal(false)}>Close</button>
            </div>
          <div className="note">Progress: {executionProgress}% (auto-saved)</div>
          <div className="inlineGrid">
            <button
              className="button"
              disabled={timerState === "STOPPED"}
              onClick={async () => {
                try {
                  if (timerState === "RUNNING") {
                    const timer = await pauseExecutionTimerApi(executionId);
                    setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                    setExecutionCompletedAt("");
                    setExecutionDurationSeconds(
                      typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                    );
                    setTimerState("PAUSED");
                    return;
                  }
                  const timer = await resumeExecutionTimerApi(executionId);
                  setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                  setExecutionCompletedAt("");
                  setExecutionDurationSeconds(
                    typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                  );
                  setTimerState("RUNNING");
                } catch (error: any) {
                  alert(error?.message || "Failed to update timer");
                }
              }}
            >
              Pause / Resume Timer
            </button>
          </div>
          <div className="note">
            Timer State: {timerState} |{" "}
            Started: {executionStartedAt ? new Date(executionStartedAt).toLocaleString() : "N/A"} | Completed:{" "}
            {executionCompletedAt ? new Date(executionCompletedAt).toLocaleString() : "N/A"} | Duration:{" "}
            {typeof executionDurationSeconds === "number" ? `${executionDurationSeconds}s` : "N/A"}
          </div>
          <select
            className="input"
            value={executionSelectedStepNumber}
            onChange={(e) => setExecutionSelectedStepNumber(e.target.value)}
          >
            <option value="">Select step</option>
            {executionSteps.map((step) => (
              <option key={step.stepNumber} value={step.stepNumber}>
                Step {step.stepNumber}: {step.action} [{step.status}]
              </option>
            ))}
          </select>
          <select className="input" value={executionStepStatus} onChange={(e) => setExecutionStepStatus(e.target.value)}>
            <option value="">Select step status</option>
            <option value="PASSED">PASSED</option>
            <option value="FAILED">FAILED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="SKIPPED">SKIPPED</option>
          </select>
          <textarea
            className="input"
            rows={2}
            placeholder="Actual result for selected step"
            value={executionActualResult}
            onChange={(e) => setExecutionActualResult(e.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="Step notes"
            value={executionStepNotes}
            onChange={(e) => setExecutionStepNotes(e.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="Execution notes"
            value={executionNotes}
            onChange={(e) => setExecutionNotes(e.target.value)}
          />
          <button
            className="button"
            onClick={async () => {
              try {
                const stepNumber = Number(executionSelectedStepNumber);
                if (!Number.isFinite(stepNumber)) {
                  alert("Select a valid step");
                  return;
                }
                const saved = await saveExecutionStepApi(executionId, stepNumber, {
                  status: executionStepStatus,
                  actualResult: executionActualResult,
                  notes: executionStepNotes,
                  executionNotes,
                });
                const nextSteps = Array.isArray(saved?.stepResults) ? saved.stepResults : executionSteps;
                setExecutionSteps(nextSteps);
                setExecutionProgress(saved?.progressPercent || 0);
                const sortedSteps = [...nextSteps]
                  .map((step: any) => ({ ...step, stepNumber: Number(step?.stepNumber || 0) }))
                  .filter((step: any) => step.stepNumber > 0)
                  .sort((a: any, b: any) => a.stepNumber - b.stepNumber);
                const currentIndex = sortedSteps.findIndex((step: any) => step.stepNumber === stepNumber);
                const nextStep = currentIndex >= 0 ? sortedSteps[currentIndex + 1] : null;
                setExecutionSelectedStepNumber(nextStep ? String(nextStep.stepNumber) : "");
                setExecutionStepStatus("");
                setExecutionActualResult("");
                setExecutionStepNotes("");
              } catch (error: any) {
                alert(error?.message || "Auto-save failed");
              }
            }}
          >
            Save Step (Auto-save)
          </button>
          <button
            className="button"
            onClick={async () => {
              try {
                if (!executionCompletedAt) {
                  try {
                    const timer = await stopExecutionTimerApi(executionId);
                    setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                    setExecutionCompletedAt(timer?.completedAt || "");
                    setExecutionDurationSeconds(
                      typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                    );
                    setTimerState("STOPPED");
                  } catch {
                    // continue finalize even if timer endpoint fails
                  }
                }
                const final = await finalizeExecutionApi(executionId, {
                  notes: executionNotes,
                });
                await loadTestCaseData();
                let freshSuiteExecution: any = null;
                if (
                  activeSuiteExecutionContext?.suiteExecutionId &&
                  activeSuiteExecutionContext?.runId &&
                  executionRunId &&
                  activeSuiteExecutionContext.runId === executionRunId
                ) {
                  try {
                    freshSuiteExecution = await getSuiteExecutionApi(activeSuiteExecutionContext.suiteExecutionId);
                    setSuiteExecutionDetails(freshSuiteExecution);
                  } catch {
                    // ignore secondary refresh failures
                  }
                }
                setSelectedExecutionReportId(final.id);
                setExecutionCompletedAt(final?.completedAt || executionCompletedAt);
                setExecutionDurationSeconds(
                  typeof final?.durationSeconds === "number" ? final.durationSeconds : executionDurationSeconds
                );
                setExecutionNotes("");
                setExecutionSelectedStepNumber("");
                setExecutionStepStatus("");
                setExecutionActualResult("");
                setExecutionStepNotes("");
                setEvidenceType("");
                setEvidenceName("");
                setEvidenceUrl("");
                setEvidenceNotes("");
                setExecutionCaseId("");
                setExecutionRunId("");
                setExecutionId("");
                setExecutionSteps([]);
                setExecutionProgress(0);
                setExecutionStartedAt("");
                setExecutionCompletedAt("");
                setExecutionDurationSeconds(null);
                setExecutionEvidence([]);
                setShowExecutionModal(false);
                if (
                  freshSuiteExecution &&
                  String(activeSuiteExecutionContext?.mode || "").toUpperCase() === "SEQUENTIAL"
                ) {
                  const nextPending = (freshSuiteExecution.cases || []).find(
                    (item: any) => item.status === "NOT_RUN"
                  );
                  if (nextPending) {
                    await openSuiteExecutionCase(freshSuiteExecution, nextPending);
                    alert(`Execution finalized: ${final.result}. Opened next pending suite case.`);
                    return;
                  }
                  setActiveSuiteExecutionContext(null);
                }
                const finalResult = String(final?.result || "").toUpperCase();
                if (finalResult === "FAILED") {
                  setSelectedExecutionReportIdState(final.id);
                  setShowQuickBugModal(true);
                  setPostFinalizeResult("FAILED");
                  alert("Execution failed. Please create a bug report now.");
                }
                if (finalResult === "PASSED") {
                  setSelectedExecutionReportIdState(final.id);
                  setPostFinalizeResult("PASSED");
                  alert("Execution completed successfully.");
                }
                if (finalResult === "BLOCKED") setPostFinalizeResult("BLOCKED");
                if (finalResult === "SKIPPED") {
                  setPostFinalizeResult("SKIPPED");
                  alert("Execution skipped. You can execute skipped execution again.");
                }
              } catch (error: any) {
                alert(error?.message || "Finalize failed");
              }
            }}
          >
            Finalize Execution
          </button>
          </div>
        </div>
      )}
      {selectedExecutionReportId ? (
        <>
          <h4>Post Execution</h4>
          {selectedExecutionReport && (
            <div className="note">
              Selected result: {selectedExecutionReport.result} | Executed at{" "}
              {new Date(selectedExecutionReport.executedAt).toLocaleString()}
            </div>
          )}
          {postFinalizeResult === "PASSED" ? (
            <div className="testCaseDetails" style={{ marginBottom: 8 }}>
              <div><strong>Execution Passed.</strong> Add evidence or skip.</div>
            </div>
          ) : null}
          {postFinalizeResult === "FAILED" ? (
            <div className="testCaseDetails" style={{ marginBottom: 8 }}>
              <div><strong>Execution Failed.</strong> Create a bug report.</div>
            </div>
          ) : null}
          {postFinalizeResult === "SKIPPED" ? (
            <div className="testCaseDetails" style={{ marginBottom: 8 }}>
              <div><strong>Execution Skipped.</strong> Run skipped execution now.</div>
            </div>
          ) : null}
          {String(selectedExecutionReport?.result || "").toUpperCase() === "PASSED" ? (
            <div className="inlineGrid">
              <button className="button small" onClick={() => setShowEvidenceModal(true)}>
                Add Evidence
              </button>
              <button
                className="button small"
                onClick={() => {
                  setPostFinalizeResult("");
                  setSelectedExecutionReportIdState("");
                }}
              >
                Skip
              </button>
            </div>
          ) : null}
          {String(selectedExecutionReport?.result || "").toUpperCase() === "FAILED" ? (
            <button className="button small" onClick={() => setShowQuickBugModal(true)}>
              Create Bug Report
            </button>
          ) : null}
          {String(selectedExecutionReport?.result || "").toUpperCase() === "SKIPPED" ? (
            <button
              className="button small"
              onClick={async () => {
                try {
                  const tcId = String(
                    selectedExecutionReport?.testCaseId ||
                      selectedExecutionReport?.testCase?.id ||
                      ""
                  ).trim();
                  if (!tcId) {
                    alert("Unable to resolve skipped test case for re-execution.");
                    return;
                  }
                  const runId = String(selectedExecutionReport?.testRunId || "").trim();
                  setPostFinalizeResult("");
                  setSelectedExecutionReportIdState("");
                  setExecutionCaseId(tcId);
                  setExecutionRunId(runId);
                  await openExecutionSession(tcId, runId || undefined);
                  setShowExecutionModal(true);
                  alert("Skipped execution opened for re-run.");
                } catch (error: any) {
                  alert(error?.message || "Failed to reopen skipped execution");
                }
              }}
            >
              Execute Skipped Execution
            </button>
          ) : null}
        </>
      ) : null}
      {showQuickBugModal ? (
        <div className="modalBackdrop" onClick={() => setShowQuickBugModal(false)}>
          <div className="modalCard executionPopupCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Create Bug Report</h4>
              <button className="button small" onClick={() => setShowQuickBugModal(false)}>Close</button>
            </div>
            <input
              className="input"
              placeholder="Bug title (optional)"
              value={quickBugTitle}
              onChange={(e) => setQuickBugTitle(e.target.value)}
            />
            <input
              className="input"
              placeholder="Bug description (optional)"
              value={quickBugDescription}
              onChange={(e) => setQuickBugDescription(e.target.value)}
            />
            <select className="input" value={quickBugSeverity} onChange={(e) => setQuickBugSeverity(e.target.value)}>
              <option value="">Select severity</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <textarea
              className="input"
              rows={2}
              placeholder="Expected behavior"
              value={quickBugExpectedBehavior}
              onChange={(e) => setQuickBugExpectedBehavior(e.target.value)}
            />
            <textarea
              className="input"
              rows={2}
              placeholder="Actual behavior"
              value={quickBugActualBehavior}
              onChange={(e) => setQuickBugActualBehavior(e.target.value)}
            />
            <select
              className="input"
              value={quickBugAssignedTo}
              onChange={(e) => setQuickBugAssignedTo(e.target.value)}
            >
              <option value="">Assign to Developer (optional)</option>
              {developerDirectory.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name ? `${dev.name} - ` : ""}
                  {dev.email}
                </option>
              ))}
            </select>
            <button
              className="button"
              onClick={async () => {
                try {
                  if (!selectedExecutionReportId) {
                    alert("Select an execution report");
                    return;
                  }
                  const issue = await createBugFromExecutionApi(selectedExecutionReportId, {
                    title: quickBugTitle || undefined,
                    description: quickBugDescription || undefined,
                    severity: quickBugSeverity,
                    expectedBehavior: quickBugExpectedBehavior || undefined,
                    actualBehavior: quickBugActualBehavior || undefined,
                    assignedTo: quickBugAssignedTo || undefined,
                  });
                  resetQuickBugFields();
                  if (onQuickBugCreated) {
                    await onQuickBugCreated(issue);
                  }
                  setPostFinalizeResult("");
                  setShowQuickBugModal(false);
                  alert(`Bug created: ${issue.id}`);
                } catch (error: any) {
                  alert(error?.message || "Quick bug creation failed");
                }
              }}
            >
              Create Bug
            </button>
          </div>
        </div>
      ) : null}
      {showEvidenceModal ? (
        <div className="modalBackdrop" onClick={() => setShowEvidenceModal(false)}>
          <div className="modalCard executionPopupCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Add Evidence</h4>
              <button className="button small" onClick={() => setShowEvidenceModal(false)}>Close</button>
            </div>
            <div className="inlineGrid">
              <select className="input" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                <option value="">Select evidence type</option>
                <option value="IMAGE">IMAGE</option>
                <option value="VIDEO">VIDEO</option>
                <option value="LOG">LOG</option>
                <option value="DOCUMENT">DOCUMENT</option>
              </select>
              <input
                className="input"
                placeholder="Evidence file name"
                value={evidenceName}
                onChange={(e) => setEvidenceName(e.target.value)}
              />
            </div>
            <input
              className="input"
              type="file"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await readFileAsDataUrl(file);
                  setEvidenceUrl(dataUrl);
                  if (!evidenceName.trim()) {
                    setEvidenceName(file.name);
                  }
                  if (!evidenceType) {
                    setEvidenceType(inferEvidenceType(file.type));
                  }
                } catch (error: any) {
                  alert(error?.message || "Failed to read selected file");
                }
              }}
            />
            <input
              className="input"
              placeholder="Evidence notes (optional)"
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
            />
            <div className="inlineGrid">
              <button
                className="button"
                onClick={async () => {
                  try {
                    if (!effectiveEvidenceExecutionId) {
                      alert("Select an execution report");
                      return;
                    }
                    if (!evidenceUrl.trim() || !evidenceName.trim()) {
                      alert("Attach file and provide evidence name");
                      return;
                    }
                    const created = await uploadExecutionEvidenceApi(effectiveEvidenceExecutionId, {
                      fileType: evidenceType,
                      fileUrl: evidenceUrl,
                      fileName: evidenceName,
                      notes: evidenceNotes,
                    });
                    setExecutionEvidence((prev: any[]) => [created, ...prev]);
                    setEvidenceType("");
                    setEvidenceUrl("");
                    setEvidenceName("");
                    setEvidenceNotes("");
                    alert("Evidence added");
                  } catch (error: any) {
                    alert(error?.message || "Evidence upload failed");
                  }
                }}
              >
                Add Evidence
              </button>
              <button
                className="button"
                onClick={async () => {
                  try {
                    if (!effectiveEvidenceExecutionId) {
                      alert("Select an execution report");
                      return;
                    }
                    const rows = await listExecutionEvidenceApi(effectiveEvidenceExecutionId);
                    setExecutionEvidence(Array.isArray(rows) ? rows : []);
                  } catch (error: any) {
                    alert(error?.message || "Failed to refresh evidence");
                  }
                }}
              >
                Refresh Evidence
              </button>
            </div>
            {executionEvidence.length > 0 ? (
              <div className="listCompact">
                {executionEvidence.map((item) => (
                  <div className="row" key={item.id}>
                    <span className="title">
                      {item.fileUrl ? (
                        <a href={item.fileUrl} target="_blank" rel="noreferrer">
                          {item.fileName}
                        </a>
                      ) : (
                        item.fileName
                      )}
                    </span>
                    <span className="meta">{item.fileType}</span>
                    <button
                      className="button small danger"
                      onClick={async () => {
                        try {
                          if (!effectiveEvidenceExecutionId) return;
                          await deleteExecutionEvidenceApi(effectiveEvidenceExecutionId, item.id);
                          setExecutionEvidence((prev: any[]) => prev.filter((row) => row.id !== item.id));
                        } catch (error: any) {
                          alert(error?.message || "Delete evidence failed");
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ExecuteTestsSection;
