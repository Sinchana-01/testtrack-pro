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
import {
  ExecutionEvidenceUiType,
  getExecutionEvidenceLimitText,
  inferExecutionEvidenceType,
  mapEvidenceUiTypeToApiType,
  validateExecutionEvidenceFile,
} from "./executionEvidence";

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
  const [executionAutosaveState, setExecutionAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<File | null>(null);
  const autoStartedExecutionRef = useRef<string>("");
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveInFlightRef = useRef(false);
  const lastSavedSnapshotRef = useRef("");

  const getExecutionSnapshot = (
    stepNumberValue: string,
    stepStatusValue: string,
    actualResultValue: string,
    stepNotesValue: string,
    executionNotesValue: string
  ): string =>
    JSON.stringify({
      stepNumber: String(stepNumberValue || ""),
      status: String(stepStatusValue || ""),
      actualResult: String(actualResultValue || ""),
      notes: String(stepNotesValue || ""),
      executionNotes: String(executionNotesValue || ""),
    });

  const syncSelectedStepFields = (stepNumberValue: string, stepRows: any[], executionNotesValue: string) => {
    if (!stepNumberValue) {
      setExecutionStepStatus("");
      setExecutionActualResult("");
      setExecutionStepNotes("");
      lastSavedSnapshotRef.current = "";
      return;
    }
    const stepNumber = Number(stepNumberValue);
    const selectedStep = Array.isArray(stepRows)
      ? stepRows.find((step: any) => Number(step?.stepNumber || 0) === stepNumber) || null
      : null;
    const normalizedStatus =
      String(selectedStep?.status || "").toUpperCase() !== "NOT_EXECUTED"
        ? String(selectedStep?.status || "").toUpperCase()
        : "";
    const actualResultValue = String(selectedStep?.actualResult || "");
    const stepNotesValue = String(selectedStep?.notes || "");
    setExecutionStepStatus(normalizedStatus);
    setExecutionActualResult(actualResultValue);
    setExecutionStepNotes(stepNotesValue);
    lastSavedSnapshotRef.current = getExecutionSnapshot(
      stepNumberValue,
      normalizedStatus,
      actualResultValue,
      stepNotesValue,
      executionNotesValue
    );
  };

  const getSelectedStep = (): any | null => {
    const stepNumber = Number(executionSelectedStepNumber);
    if (!Number.isFinite(stepNumber)) return null;
    return executionSteps.find((step: any) => Number(step?.stepNumber || 0) === stepNumber) || null;
  };

  const buildQuickBugFromFailedStep = (executionReportId?: string) => {
    const selectedStep = getSelectedStep();
    const stepNumber = Number(selectedStep?.stepNumber || executionSelectedStepNumber || 0);
    const testCaseCode = String(selectedExecutionCase?.testCaseCode || selectedExecutionCase?.id || executionCaseId || "TC");
    const testCaseTitle = String(selectedExecutionCase?.title || "Failed test case");
    const stepAction = String(selectedStep?.action || "Execution step");
    const expectedResult = String(selectedStep?.expectedResult || executionStepNotes || "Expected result not captured");
    const actualResult = String(executionActualResult || selectedStep?.actualResult || `Failure observed during step ${stepNumber || "selected"}`);
    const bugTitle = `Bug: ${testCaseCode}${stepNumber > 0 ? ` - Step ${stepNumber}` : ""}`;
    const bugDescription = [
      `${testCaseTitle} failed during execution${executionReportId ? ` ${executionReportId}` : ""}.`,
      stepNumber > 0 ? `Failed Step ${stepNumber}: ${stepAction}` : "",
      executionStepNotes ? `Failure Notes: ${executionStepNotes}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      title: bugTitle,
      description: bugDescription,
      severity: "HIGH",
      expectedBehavior: expectedResult,
      actualBehavior: actualResult,
      failedStepNumber: stepNumber,
      failedStepAction: stepAction,
      failedStepExpectedResult: expectedResult,
      failedStepActualResult: actualResult,
      failedStepNotes: executionStepNotes || String(selectedStep?.notes || ""),
    };
  };

  const populateQuickBugFromFailedStep = (executionReportId?: string) => {
    const draft = buildQuickBugFromFailedStep(executionReportId);
    setQuickBugTitle(draft.title);
    setQuickBugDescription(draft.description);
    setQuickBugSeverity(quickBugSeverity || draft.severity);
    setQuickBugExpectedBehavior(draft.expectedBehavior);
    setQuickBugActualBehavior(draft.actualBehavior);
  };

  const hasRequiredStepDetails = (): boolean => {
    if (!executionStepStatus) return false;
    return String(executionActualResult || "").trim().length > 0;
  };

  const persistExecutionStep = async (options?: { moveToNext?: boolean; source?: "manual" | "autosave" | "finalize" }) => {
    const stepNumber = Number(executionSelectedStepNumber);
    if (!executionId || !Number.isFinite(stepNumber) || !executionStepStatus || !hasRequiredStepDetails()) {
      return false;
    }
    const snapshot = getExecutionSnapshot(
      executionSelectedStepNumber,
      executionStepStatus,
      executionActualResult,
      executionStepNotes,
      executionNotes
    );
    if (options?.source !== "manual" && snapshot === lastSavedSnapshotRef.current) {
      return true;
    }
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    autosaveInFlightRef.current = true;
    setExecutionAutosaveState("saving");
    try {
      const saved = await saveExecutionStepApi(executionId, stepNumber, {
        status: executionStepStatus,
        actualResult: executionActualResult,
        notes: executionStepNotes,
        executionNotes,
      });
      const nextSteps = Array.isArray(saved?.stepResults) ? saved.stepResults : executionSteps;
      setExecutionSteps(nextSteps);
      setExecutionProgress(saved?.progressPercent || 0);
      lastSavedSnapshotRef.current = snapshot;
      setExecutionAutosaveState("saved");

      if (options?.moveToNext) {
        const sortedSteps = [...nextSteps]
          .map((step: any) => ({ ...step, stepNumber: Number(step?.stepNumber || 0) }))
          .filter((step: any) => step.stepNumber > 0)
          .sort((a: any, b: any) => a.stepNumber - b.stepNumber);
        const currentIndex = sortedSteps.findIndex((step: any) => step.stepNumber === stepNumber);
        const nextStep = currentIndex >= 0 ? sortedSteps[currentIndex + 1] : null;
        const nextStepNumber = nextStep ? String(nextStep.stepNumber) : "";
        setExecutionSelectedStepNumber(nextStepNumber);
        if (!nextStepNumber) {
          setExecutionStepStatus("");
          setExecutionActualResult("");
          setExecutionStepNotes("");
          lastSavedSnapshotRef.current = "";
        }
      }
      return true;
    } catch (error: any) {
      setExecutionAutosaveState("error");
      if (options?.source !== "autosave") {
        alert(error?.message || "Execution save failed");
      }
      return false;
    } finally {
      autosaveInFlightRef.current = false;
    }
  };

  const createBugFromCurrentFailedStep = async () => {
    if (!executionId) {
      alert("Open an execution first");
      return;
    }
    if (!executionSelectedStepNumber) {
      alert("Select the failed step first");
      return;
    }
    if (executionStepStatus !== "FAILED") {
      alert("Set the selected step status to FAILED before creating a bug");
      return;
    }
    const selectedStep = getSelectedStep();
    const flushed = await persistExecutionStep({ source: "manual" });
    if (!flushed) return;
    const final = await finalizeExecutionApi(executionId, { result: "FAILED", notes: executionNotes });
    await loadTestCaseData();
    setSelectedExecutionReportId(final.id);
    setSelectedExecutionReportIdState(final.id);
    const draft = buildQuickBugFromFailedStep(final.id);
    setQuickBugTitle(draft.title);
    setQuickBugDescription(draft.description);
    setQuickBugSeverity(draft.severity);
    setQuickBugExpectedBehavior(draft.expectedBehavior);
    setQuickBugActualBehavior(draft.actualBehavior);
    const issue = await createBugFromExecutionApi(final.id, {
      title: draft.title,
      description: draft.description,
      severity: draft.severity,
      stepsToReproduce:
        selectedStep && Number(selectedStep?.stepNumber || 0) > 0
          ? `Open ${selectedExecutionCase?.title || executionCaseId}, execute step ${selectedStep.stepNumber} (${selectedStep.action}), and observe the failure.`
          : undefined,
      expectedBehavior: draft.expectedBehavior,
      actualBehavior: draft.actualBehavior,
      assignedTo: quickBugAssignedTo || undefined,
      failedStepNumber: draft.failedStepNumber,
      failedStepAction: draft.failedStepAction,
      failedStepExpectedResult: draft.failedStepExpectedResult,
      failedStepActualResult: draft.failedStepActualResult,
      failedStepNotes: draft.failedStepNotes,
    });
    resetQuickBugFields();
    setPostFinalizeResult("");
    setShowExecutionModal(false);
    setExecutionCaseId("");
    setExecutionRunId("");
    setExecutionId("");
    setExecutionSteps([]);
    setExecutionProgress(0);
    setExecutionStartedAt("");
    setExecutionCompletedAt("");
    setExecutionDurationSeconds(null);
    setExecutionEvidence([]);
    setExecutionNotes("");
    setExecutionSelectedStepNumber("");
    setExecutionStepStatus("");
    setExecutionActualResult("");
    setExecutionStepNotes("");
    if (onQuickBugCreated) {
      await onQuickBugCreated(issue);
    }
    alert(`Bug created: ${issue.id}`);
  };

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
    if (!showExecutionModal) {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      setExecutionAutosaveState("idle");
      return;
    }
    syncSelectedStepFields(executionSelectedStepNumber, executionSteps, executionNotes);
  }, [executionSelectedStepNumber, executionSteps, showExecutionModal]);

  useEffect(() => {
    if (!showExecutionModal || !executionId || !executionSelectedStepNumber) return;
    if (!executionStepStatus || autosaveInFlightRef.current) return;
    if (!hasRequiredStepDetails()) {
      setExecutionAutosaveState("idle");
      return;
    }
    const snapshot = getExecutionSnapshot(
      executionSelectedStepNumber,
      executionStepStatus,
      executionActualResult,
      executionStepNotes,
      executionNotes
    );
    if (snapshot === lastSavedSnapshotRef.current) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    setExecutionAutosaveState("saving");
    autosaveTimerRef.current = window.setTimeout(() => {
      persistExecutionStep({ source: "autosave", moveToNext: true }).catch(() => {
        // handled in helper
      });
    }, 700);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    executionId,
    executionSelectedStepNumber,
    executionStepStatus,
    executionActualResult,
    executionStepNotes,
    executionNotes,
    showExecutionModal,
  ]);

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

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const normalizedEvidenceType = ((evidenceType || "DOCUMENT") as ExecutionEvidenceUiType);

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
            <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Execution Workspace</h4>
              <button className="button small" aria-label="Close execution modal" onClick={() => setShowExecutionModal(false)}>X</button>
            </div>
          <div className="note">
            Progress: {executionProgress}% | Autosave:{" "}
            {executionAutosaveState === "saving"
              ? "Saving..."
              : executionAutosaveState === "saved"
              ? "Saved"
              : executionAutosaveState === "error"
              ? "Save failed"
              : "Ready"}
          </div>
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
              const saved = await persistExecutionStep({ moveToNext: true, source: "manual" });
              if (!saved) {
                alert("Select a valid step/status and enter actual result before saving");
              }
            }}
          >
            Save Step And Next
          </button>
          <button
            className="button"
            onClick={async () => {
              try {
                if (!String(executionActualResult || "").trim()) {
                  alert("Enter actual result before creating a bug");
                  return;
                }
                await createBugFromCurrentFailedStep();
              } catch (error: any) {
                alert(error?.message || "Fail and create bug failed");
              }
            }}
          >
            Fail And Create Bug
          </button>
          <button
            className="button"
            onClick={async () => {
              try {
                if (executionSelectedStepNumber && executionStepStatus) {
                  if (!String(executionActualResult || "").trim()) {
                    alert("Enter actual result before finalizing the current step");
                    return;
                  }
                  const flushed = await persistExecutionStep({ source: "finalize" });
                  if (!flushed) {
                    return;
                  }
                }
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
                  populateQuickBugFromFailedStep(final.id);
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
            <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Create Bug Report</h4>
              <button className="button small" aria-label="Close create bug modal" onClick={() => setShowQuickBugModal(false)}>X</button>
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
            <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Add Evidence</h4>
              <button className="button small" aria-label="Close evidence modal" onClick={() => setShowEvidenceModal(false)}>X</button>
            </div>
            <div className="inlineGrid">
              <select className="input" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                <option value="">Select evidence type</option>
                <option value="IMAGE">IMAGE</option>
                <option value="VIDEO">VIDEO</option>
                <option value="LOG">LOG</option>
                <option value="HAR">HAR / NETWORK TRACE</option>
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
                  setSelectedEvidenceFile(file);
                  const dataUrl = await readFileAsDataUrl(file);
                  setEvidenceUrl(dataUrl);
                  if (!evidenceName.trim()) {
                    setEvidenceName(file.name);
                  }
                  if (!evidenceType) {
                    setEvidenceType(inferExecutionEvidenceType(file));
                  }
                } catch (error: any) {
                  alert(error?.message || "Failed to read selected file");
                }
              }}
            />
            <div className="note" style={{ marginBottom: 8 }}>
              Limits: Images {getExecutionEvidenceLimitText("IMAGE")}, Videos {getExecutionEvidenceLimitText("VIDEO")},
              Logs {getExecutionEvidenceLimitText("LOG")}, HAR {getExecutionEvidenceLimitText("HAR")}
            </div>
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
                    if (!selectedEvidenceFile || !evidenceUrl.trim() || !evidenceName.trim()) {
                      alert("Attach file and provide evidence name");
                      return;
                    }
                    const validationMessage = validateExecutionEvidenceFile(selectedEvidenceFile, normalizedEvidenceType);
                    if (validationMessage) {
                      alert(validationMessage);
                      return;
                    }
                    const created = await uploadExecutionEvidenceApi(effectiveEvidenceExecutionId, {
                      fileType: mapEvidenceUiTypeToApiType(normalizedEvidenceType),
                      fileUrl: evidenceUrl,
                      fileName: evidenceName,
                      notes: evidenceNotes,
                    });
                    setExecutionEvidence((prev: any[]) => [
                      {
                        ...created,
                        fileType: normalizedEvidenceType,
                        displayName: created?.displayName || evidenceName,
                      },
                      ...prev,
                    ]);
                    setEvidenceType("");
                    setEvidenceUrl("");
                    setEvidenceName("");
                    setEvidenceNotes("");
                    setSelectedEvidenceFile(null);
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
                    setExecutionEvidence(
                      Array.isArray(rows)
                        ? rows.map((item: any) => ({
                            ...item,
                            fileType:
                              String(item?.displayName || item?.fileName || "")
                                .toLowerCase()
                                .endsWith(".har")
                                ? "HAR"
                                : item?.fileType,
                          }))
                        : []
                    );
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
                            {item.displayName || item.fileName}
                          </a>
                        ) : (
                          item.displayName || item.fileName
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
