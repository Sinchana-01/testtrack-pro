import { useEffect, useMemo, useRef, useState } from "react";
import { createTestRunApi, getTestRunApi, listTesterUsersApi } from "../../api";

type TesterRow = { id: string; name: string; email: string };

type Props = {
  selectedIds: string[];
  testRuns: any[];
  onRefreshData: () => Promise<void>;
};

const TestRunManagementSection = ({ selectedIds, testRuns, onRefreshData }: Props) => {
  const [runName, setRunName] = useState("");
  const [runDescription, setRunDescription] = useState("");
  const [runStartDate, setRunStartDate] = useState("");
  const [runEndDate, setRunEndDate] = useState("");
  const [runTesterIds, setRunTesterIds] = useState<string[]>([]);
  const [runTesterPickerOpen, setRunTesterPickerOpen] = useState(false);
  const [runTesterQuery, setRunTesterQuery] = useState("");
  const [testerDirectory, setTesterDirectory] = useState<TesterRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runDetails, setRunDetails] = useState<any>(null);
  const runTesterPickerRef = useRef<HTMLDivElement | null>(null);

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

  const runTesterSelectedSummary =
    runTesterIds.length === 0
      ? "No tester selected"
      : runTesterIds.length === 1
      ? "1 tester selected"
      : `${runTesterIds.length} testers selected`;

  const resetRunFields = () => {
    setRunName("");
    setRunDescription("");
    setRunStartDate("");
    setRunEndDate("");
    setRunTesterIds([]);
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
          <span>{runTesterPickerOpen ? "▲" : "▼"}</span>
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
            if (selectedIds.length === 0) {
              alert("Select at least one test case from the list section");
              return;
            }
            await createTestRunApi({
              name: runName,
              description: runDescription || undefined,
              targetStartDate: runStartDate ? new Date(runStartDate).toISOString() : undefined,
              targetEndDate: runEndDate ? new Date(runEndDate).toISOString() : undefined,
              testCaseIds: selectedIds,
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
        </div>
      )}
    </section>
  );
};

export default TestRunManagementSection;

