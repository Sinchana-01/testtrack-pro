import { useEffect, useMemo, useState } from "react";
import {
  createBugFromExecutionApi,
  deleteExecutionEvidenceApi,
  finalizeExecutionApi,
  getSuiteExecutionApi,
  listExecutionEvidenceApi,
  pauseExecutionTimerApi,
  reexecuteExecutionApi,
  resumeExecutionTimerApi,
  saveExecutionStepApi,
  setExecutionManualDurationApi,
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
  resetQuickBugFields,
  setExecutionId,
  onQuickBugCreated,
}: Props) => {
  const [timerState, setTimerState] = useState<"RUNNING" | "PAUSED" | "STOPPED">("STOPPED");
  const [manualDurationMinutes, setManualDurationMinutes] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);

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

  const selectedExecutionReport = useMemo(
    () => executionReports.find((item) => item.id === selectedExecutionReportId) || null,
    [executionReports, selectedExecutionReportId]
  );
  const previousExecutionReport = useMemo(() => {
    if (!selectedExecutionReport) return null;
    const prevId = String(selectedExecutionReport.reexecutionOfId || "");
    if (!prevId) return null;
    return executionReports.find((item) => item.id === prevId) || null;
  }, [executionReports, selectedExecutionReport]);

  const comparisonRows = useMemo(() => {
    if (!selectedExecutionReport || !previousExecutionReport) return [];
    const currentSteps = Array.isArray(selectedExecutionReport.stepResults) ? selectedExecutionReport.stepResults : [];
    const previousSteps = Array.isArray(previousExecutionReport.stepResults)
      ? previousExecutionReport.stepResults
      : [];
    const byNumber = new Map<number, any>();
    previousSteps.forEach((step: any) => {
      const n = Number(step?.stepNumber || 0);
      if (n > 0) byNumber.set(n, { stepNumber: n, previous: step, current: null });
    });
    currentSteps.forEach((step: any) => {
      const n = Number(step?.stepNumber || 0);
      if (n <= 0) return;
      const existing = byNumber.get(n) || { stepNumber: n, previous: null, current: null };
      existing.current = step;
      byNumber.set(n, existing);
    });
    return Array.from(byNumber.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }, [selectedExecutionReport, previousExecutionReport]);

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
    <section className="panel">
      <h4>Execute Test Case</h4>
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
          } catch (error: any) {
            alert(error?.message || "Open execution failed");
          }
        }}
      >
        Open Execution Mode
      </button>
      {executionCaseId && !isApprovedCase && !isArchivedCase ? (
        <div className="note">Execution is enabled only when test case status is APPROVED.</div>
      ) : null}
      {executionCaseId && isArchivedCase ? (
        <div className="note">Archived test cases cannot be executed.</div>
      ) : null}
      {executionId && executionSteps.length > 0 && (
        <>
          <div className="note">Progress: {executionProgress}% (auto-saved)</div>
          <div className="inlineGrid">
            <button
              className="button"
              onClick={async () => {
                try {
                  const timer = await startExecutionTimerApi(executionId);
                  setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                  setExecutionCompletedAt("");
                  setExecutionDurationSeconds(
                    typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                  );
                  setTimerState("RUNNING");
                } catch (error: any) {
                  alert(error?.message || "Failed to start timer");
                }
              }}
            >
              Start Timer
            </button>
            <button
              className="button"
              onClick={async () => {
                try {
                  const timer = await stopExecutionTimerApi(executionId);
                  setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                  setExecutionCompletedAt(timer?.completedAt || "");
                  setExecutionDurationSeconds(
                    typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                  );
                  setTimerState("STOPPED");
                } catch (error: any) {
                  alert(error?.message || "Failed to stop timer");
                }
              }}
            >
              Stop Timer
            </button>
            <button
              className="button"
              disabled={timerState !== "RUNNING"}
              onClick={async () => {
                try {
                  const timer = await pauseExecutionTimerApi(executionId);
                  setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                  setExecutionCompletedAt("");
                  setExecutionDurationSeconds(
                    typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                  );
                  setTimerState("PAUSED");
                } catch (error: any) {
                  alert(error?.message || "Failed to pause timer");
                }
              }}
            >
              Pause Timer
            </button>
            <button
              className="button"
              disabled={timerState !== "PAUSED"}
              onClick={async () => {
                try {
                  const timer = await resumeExecutionTimerApi(executionId);
                  setExecutionStartedAt(timer?.startedAt || executionStartedAt);
                  setExecutionCompletedAt("");
                  setExecutionDurationSeconds(
                    typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                  );
                  setTimerState("RUNNING");
                } catch (error: any) {
                  alert(error?.message || "Failed to resume timer");
                }
              }}
            >
              Resume Timer
            </button>
          </div>
          <div className="note">
            Timer State: {timerState} |{" "}
            Started: {executionStartedAt ? new Date(executionStartedAt).toLocaleString() : "N/A"} | Completed:{" "}
            {executionCompletedAt ? new Date(executionCompletedAt).toLocaleString() : "N/A"} | Duration:{" "}
            {typeof executionDurationSeconds === "number" ? `${executionDurationSeconds}s` : "N/A"}
          </div>
          <div className="inlineGrid">
            <input
              className="input"
              type="number"
              min={0}
              placeholder="Manual duration (minutes)"
              value={manualDurationMinutes}
              onChange={(e) => setManualDurationMinutes(e.target.value)}
            />
            <button
              className="button"
              onClick={async () => {
                try {
                  const minutes = Number(manualDurationMinutes);
                  if (!Number.isFinite(minutes) || minutes < 0) {
                    alert("Enter a valid non-negative duration");
                    return;
                  }
                  const timer = await setExecutionManualDurationApi(executionId, {
                    durationMinutes: minutes,
                  });
                  setExecutionDurationSeconds(
                    typeof timer?.durationSeconds === "number" ? timer.durationSeconds : executionDurationSeconds
                  );
                  setManualDurationMinutes("");
                  alert("Manual duration saved");
                } catch (error: any) {
                  alert(error?.message || "Failed to set manual duration");
                }
              }}
            >
              Save Manual Duration
            </button>
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
                setExecutionSelectedStepNumber("");
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
                setManualDurationMinutes("");
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
                alert(`Execution finalized: ${final.result}`);
              } catch (error: any) {
                alert(error?.message || "Finalize failed");
              }
            }}
          >
            Finalize Execution
          </button>
          <h4>Execution Evidence</h4>
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
          <div className="note">
            {evidenceUrl
              ? "File attached and ready to upload."
              : "Attach a file to upload as execution evidence."}
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
                  if (!evidenceUrl.trim() || !evidenceName.trim()) {
                    alert("Attach file and provide evidence name");
                    return;
                  }
                  const created = await uploadExecutionEvidenceApi(executionId, {
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
                  const rows = await listExecutionEvidenceApi(executionId);
                  setExecutionEvidence(Array.isArray(rows) ? rows : []);
                } catch (error: any) {
                  alert(error?.message || "Failed to refresh evidence");
                }
              }}
            >
              Refresh Evidence
            </button>
          </div>
          {executionEvidence.length > 0 && (
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
                        await deleteExecutionEvidenceApi(executionId, item.id);
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
          )}
        </>
      )}
      <h4>Quick Bug / Re-execution</h4>
      <select
        className="input"
        value={selectedExecutionReportId}
        onChange={(e) => setSelectedExecutionReportIdState(e.target.value)}
      >
        <option value="">Select execution report</option>
        {executionReports
          .filter((item) => !executionCaseId || item.testCaseId === executionCaseId)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.testCase?.title || item.testCaseId} | {item.result} | {new Date(item.executedAt).toLocaleString()}
            </option>
          ))}
      </select>
      {selectedExecutionReport && (
        <div className="note">
          Selected result: {selectedExecutionReport.result} | Executed at{" "}
          {new Date(selectedExecutionReport.executedAt).toLocaleString()}
          {previousExecutionReport ? " | Previous execution available for comparison" : ""}
        </div>
      )}
      {previousExecutionReport && (
        <button className="button small" onClick={() => setCompareOpen((prev) => !prev)}>
          {compareOpen ? "Hide" : "Show"} Previous vs Current Comparison
        </button>
      )}
      {compareOpen && selectedExecutionReport && previousExecutionReport && (
        <div className="testCaseDetails">
          <div>
            <strong>Previous:</strong> {previousExecutionReport.id.slice(0, 8)} ({previousExecutionReport.result})
          </div>
          <div>
            <strong>Current:</strong> {selectedExecutionReport.id.slice(0, 8)} ({selectedExecutionReport.result})
          </div>
          <div className="listCompact" style={{ marginTop: "8px" }}>
            {comparisonRows.map((row: any) => (
              <div className="row" key={`cmp-${row.stepNumber}`}>
                <span className="title">Step {row.stepNumber}</span>
                <span className="meta">
                  Prev: {row.previous?.status || "N/A"} | Curr: {row.current?.status || "N/A"}
                </span>
                <span className="meta">
                  Prev Actual: {row.previous?.actualResult || "-"} | Curr Actual:{" "}
                  {row.current?.actualResult || "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
      <div className="inlineGrid">
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
              });
              resetQuickBugFields();
              if (onQuickBugCreated) {
                await onQuickBugCreated(issue);
              }
              alert(`Bug created: ${issue.id}`);
            } catch (error: any) {
              alert(error?.message || "Quick bug creation failed");
            }
          }}
        >
          Create Quick Bug
        </button>
        <button
          className="button"
          onClick={async () => {
            try {
              if (!selectedExecutionReportId) {
                alert("Select an execution report");
                return;
              }
              const restarted = await reexecuteExecutionApi(selectedExecutionReportId, {
                notes: "Re-execution requested",
              });
              setExecutionId(restarted.id);
              setExecutionCaseId(restarted.testCaseId);
              setExecutionRunId(restarted.testRunId || "");
              setExecutionSteps(Array.isArray(restarted.stepResults) ? restarted.stepResults : []);
              setExecutionSelectedStepNumber(
                Array.isArray(restarted.stepResults) && restarted.stepResults.length > 0
                  ? String(restarted.stepResults[0].stepNumber)
                  : ""
              );
              setExecutionProgress(restarted.progressPercent || 0);
              setExecutionNotes(restarted.notes || "");
              setExecutionStartedAt(restarted.startedAt || "");
              setExecutionCompletedAt("");
              setExecutionDurationSeconds(null);
              setExecutionEvidence([]);
              alert("Re-execution draft created");
            } catch (error: any) {
              alert(error?.message || "Re-execution failed");
            }
          }}
        >
          Re-execute
        </button>
      </div>
    </section>
  );
};

export default ExecuteTestsSection;
