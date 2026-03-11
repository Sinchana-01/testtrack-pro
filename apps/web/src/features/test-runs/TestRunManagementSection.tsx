import { useEffect, useMemo, useRef, useState } from "react";
import { createTestRunApi, getTestRunApi, listTesterUsersApi } from "../../api";

type TesterRow = { id: string; name: string; email: string };

type Props = {
  selectedIds: string[];
  testCases: any[];
  testRuns: any[];
  onRefreshData: () => Promise<void>;
  onOpenRunExecution: (run: any) => Promise<void>;
};

const TestRunManagementSection = ({ selectedIds, testCases, testRuns, onRefreshData, onOpenRunExecution }: Props) => {
  const [runName, setRunName] = useState("");
  const [runDescription, setRunDescription] = useState("");
  const [runStartDate, setRunStartDate] = useState("");
  const [runEndDate, setRunEndDate] = useState("");
  const [runTesterIds, setRunTesterIds] = useState<string[]>([]);
  const [runTestCaseIds, setRunTestCaseIds] = useState<string[]>([]);

  const [runCasePickerOpen, setRunCasePickerOpen] = useState(false);
  const [runCaseQuery, setRunCaseQuery] = useState("");
  const [runTesterPickerOpen, setRunTesterPickerOpen] = useState(false);
  const [runTesterQuery, setRunTesterQuery] = useState("");
  const [testerDirectory, setTesterDirectory] = useState<TesterRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runDetails, setRunDetails] = useState<any>(null);

  const runTesterPickerRef = useRef<HTMLDivElement | null>(null);
  const runCasePickerRef = useRef<HTMLDivElement | null>(null);

  const filteredTesterOptions = useMemo(() => {
    const query = runTesterQuery.trim().toLowerCase();
    if (!query) return testerDirectory;
    return testerDirectory.filter((tester) => {
      return (
        String(tester?.name || "").toLowerCase().includes(query) ||
        String(tester?.email || "").toLowerCase().includes(query)
      );
    });
  }, [runTesterQuery, testerDirectory]);

  const filteredCaseOptions = useMemo(() => {
    const query = runCaseQuery.trim().toLowerCase();
    const rows = Array.isArray(testCases) ? testCases : [];
    if (!query) return rows;
    return rows.filter((tc: any) => {
      const code = String(tc?.testCaseCode || "").toLowerCase();
      const title = String(tc?.title || "").toLowerCase();
      return code.includes(query) || title.includes(query);
    });
  }, [runCaseQuery, testCases]);

  const runTesterSelectedSummary =
    runTesterIds.length === 0
      ? "No tester selected"
      : runTesterIds.length === 1
      ? "1 tester selected"
      : `${runTesterIds.length} testers selected`;

  const runCaseSelectedSummary =
    runTestCaseIds.length === 0
      ? "No test case selected"
      : runTestCaseIds.length === 1
      ? "1 test case selected"
      : `${runTestCaseIds.length} test cases selected`;

  const resetRunFields = () => {
    setRunName("");
    setRunDescription("");
    setRunStartDate("");
    setRunEndDate("");
    setRunTesterIds([]);
    setRunTestCaseIds([]);
    setRunCasePickerOpen(false);
    setRunCaseQuery("");
    setRunTesterPickerOpen(false);
    setRunTesterQuery("");
    setSelectedRunId("");
    setRunDetails(null);
  };

  useEffect(() => {
    let disposed = false;
    const run = async () => {
      try {
        const rows = await listTesterUsersApi();
        if (disposed) return;
        const normalized = Array.isArray(rows)
          ? rows
              .map((row: any) => ({
                id: String(row?.id || ""),
                name: String(row?.name || "").trim(),
                email: String(row?.email || "").trim(),
              }))
              .filter((row) => row.id && row.email)
          : [];
        setTesterDirectory(normalized);
        setRunTesterIds((prev) => prev.filter((id) => normalized.some((row) => row.id === id)));
      } catch {
        if (!disposed) setTesterDirectory([]);
      }
    };
    run();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    setRunTestCaseIds((prev) => (prev.length > 0 ? prev : Array.from(new Set(selectedIds))));
  }, [selectedIds]);

  useEffect(() => {
    if (!runTesterPickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!runTesterPickerRef.current) return;
      if (!runTesterPickerRef.current.contains(event.target as Node)) {
        setRunTesterPickerOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRunTesterPickerOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [runTesterPickerOpen]);

  useEffect(() => {
    if (!runCasePickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!runCasePickerRef.current) return;
      if (!runCasePickerRef.current.contains(event.target as Node)) {
        setRunCasePickerOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRunCasePickerOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [runCasePickerOpen]);

  return (
    <section className="panel">
      <h4>Test Run / Cycle Management</h4>
      <input
        className="input"
        placeholder="Run Name (e.g., Sprint 5 Regression)"
        value={runName}
        onChange={(e) => setRunName(e.target.value)}
      />
      <input
        className="input"
        placeholder="Description"
        value={runDescription}
        onChange={(e) => setRunDescription(e.target.value)}
      />
      <label className="fieldLabel">Target Start Date</label>
      <input
        className="input"
        type="datetime-local"
        value={runStartDate}
        onChange={(e) => setRunStartDate(e.target.value)}
      />
      <label className="fieldLabel">Target End Date</label>
      <input
        className="input"
        type="datetime-local"
        value={runEndDate}
        onChange={(e) => setRunEndDate(e.target.value)}
      />

      <label className="fieldLabel">Select Test Cases</label>
      <div className="bulkCasePicker" ref={runCasePickerRef}>
        <button
          type="button"
          className="bulkCasePickerTrigger"
          onClick={() => setRunCasePickerOpen((prev) => !prev)}
          aria-expanded={runCasePickerOpen}
          aria-haspopup="listbox"
        >
          <span>{runCaseSelectedSummary}</span>
          <span>{runCasePickerOpen ? "?" : "?"}</span>
        </button>
        {runCasePickerOpen ? (
          <div className="bulkCasePickerMenu" role="listbox" aria-multiselectable="true">
            <input
              className="input bulkCasePickerSearch"
              placeholder="Search by test case code or title"
              value={runCaseQuery}
              onChange={(e) => setRunCaseQuery(e.target.value)}
            />
            <div className="bulkCasePickerList">
              {filteredCaseOptions.length === 0 ? (
                <div className="note">No test cases available in this project.</div>
              ) : (
                filteredCaseOptions.map((tc: any) => {
                  const id = String(tc?.id || "");
                  const checked = runTestCaseIds.includes(id);
                  const label = `${tc?.testCaseCode || "TC"} - ${tc?.title || "Untitled"}`;
                  return (
                    <label key={id} className="bulkCasePickerItem">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRunTestCaseIds((prev) => Array.from(new Set([...prev, id])));
                          } else {
                            setRunTestCaseIds((prev) => prev.filter((rowId) => rowId !== id));
                          }
                        }}
                      />
                      <span className="bulkCasePickerText">{label}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="bulkCasePickerFooter">
              <span className="note">Selected: {runTestCaseIds.length}</span>
              <button
                type="button"
                className="button small"
                onClick={() => setRunTestCaseIds([])}
                disabled={runTestCaseIds.length === 0}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <label className="fieldLabel">Select Testers (Email)</label>
      <div className="bulkCasePicker" ref={runTesterPickerRef}>
        <button
          type="button"
          className="bulkCasePickerTrigger"
          onClick={() => setRunTesterPickerOpen((prev) => !prev)}
          aria-expanded={runTesterPickerOpen}
          aria-haspopup="listbox"
        >
          <span>{runTesterSelectedSummary}</span>
          <span>{runTesterPickerOpen ? "?" : "?"}</span>
        </button>
        {runTesterPickerOpen ? (
          <div className="bulkCasePickerMenu" role="listbox" aria-multiselectable="true">
            <input
              className="input bulkCasePickerSearch"
              placeholder="Search tester by name or email"
              value={runTesterQuery}
              onChange={(e) => setRunTesterQuery(e.target.value)}
            />
            <div className="bulkCasePickerList">
              {filteredTesterOptions.length === 0 ? (
                <div className="note">No active testers available.</div>
              ) : (
                filteredTesterOptions.map((tester) => {
                  const checked = runTesterIds.includes(tester.id);
                  return (
                    <label key={tester.id} className="bulkCasePickerItem">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRunTesterIds((prev) => Array.from(new Set([...prev, tester.id])));
                          } else {
                            setRunTesterIds((prev) => prev.filter((id) => id !== tester.id));
                          }
                        }}
                      />
                      <span className="bulkCasePickerText">
                        {tester.name ? `${tester.name} - ` : ""}
                        {tester.email}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="bulkCasePickerFooter">
              <span className="note">Selected: {runTesterIds.length}</span>
              <button
                type="button"
                className="button small"
                onClick={() => setRunTesterIds([])}
                disabled={runTesterIds.length === 0}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <button
        className="button"
        onClick={async () => {
          try {
            if (!runName.trim()) {
              alert("Run name is required");
              return;
            }
            if (runTestCaseIds.length === 0) {
              alert("Select at least one test case");
              return;
            }
            await createTestRunApi({
              name: runName,
              description: runDescription || undefined,
              targetStartDate: runStartDate ? new Date(runStartDate).toISOString() : undefined,
              targetEndDate: runEndDate ? new Date(runEndDate).toISOString() : undefined,
              testCaseIds: runTestCaseIds,
              testerIds: runTesterIds,
            });
            resetRunFields();
            await onRefreshData();
            alert("Test run created");
          } catch (error: any) {
            alert(error?.message || "Create test run failed");
          }
        }}
      >
        Create Test Run
      </button>

      <select className="input" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
        <option value="">Select Test Run</option>
        {testRuns.map((run) => (
          <option key={run.id} value={run.id}>
            {run.name} ({run.progress?.completed || 0}/{run.progress?.total || 0})
          </option>
        ))}
      </select>
      <button
        className="button"
        onClick={async () => {
          try {
            if (!selectedRunId) {
              alert("Select a test run");
              return;
            }
            const detail = await getTestRunApi(selectedRunId);
            setRunDetails(detail);
          } catch (error: any) {
            alert(error?.message || "Load test run failed");
          }
        }}
      >
        View Run Progress
      </button>
      {runDetails && (
        <div className="testCaseDetails">
          <div><strong>Run:</strong> {runDetails.name}</div>
          <div><strong>Status:</strong> {runDetails.status}</div>
          <div>
            <strong>Progress:</strong> {runDetails.progress?.completed || 0}/
            {runDetails.progress?.total || 0} ({runDetails.progress?.percent || 0}%)
          </div>
          <div className="toolbarActions" style={{ marginTop: 10 }}>
            <button
              className="button small"
              onClick={async () => {
                try {
                  await onOpenRunExecution(runDetails);
                } catch (error: any) {
                  alert(error?.message || "Open run execution failed");
                }
              }}
            >
              Execute This Run
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default TestRunManagementSection;
