import React from "react";

interface Props {
  executionTestCases: any[];
  handleMarkExecution: (id: string, status: string) => Promise<void>;
}

const ExecuteTests: React.FC<Props> = ({
  executionTestCases,
  handleMarkExecution,
}) => {
  if (!executionTestCases || executionTestCases.length === 0) {
    return (
      <section className="panel">
        <h3>Execute Tests</h3>
        <div className="note">No active execution session.</div>
      </section>
    );
  }

  return (
    <section className="panel executePanel">

      {/* HEADER */}
      <div className="executeHeader">
        <h3>Execution Session</h3>
        <div className="note">
          {executionTestCases.length} step(s) in this test case
        </div>
      </div>

      <div className="executeLayout">

        {/* LEFT: STEPS */}
        <div className="executeSteps">
          {executionTestCases.map((step: any, index: number) => (
            <div key={step.id || index} className="executeStepCard">
              <div className="stepNumber">Step {index + 1}</div>
              <div className="stepAction">
                <strong>Action:</strong> {step.action}
              </div>
              <div className="stepExpected">
                <strong>Expected:</strong> {step.expectedResult}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: RESULT CONTROLS */}
        <div className="executeControls">
          <h4>Mark Result</h4>

          <div className="buttonGroup">
            <button
              className="button success"
              onClick={() => handleMarkExecution("current", "PASS")}
            >
              PASS
            </button>

            <button
              className="button danger"
              onClick={() => handleMarkExecution("current", "FAIL")}
            >
              FAIL
            </button>

            <button
              className="button warning"
              onClick={() => handleMarkExecution("current", "BLOCKED")}
            >
              BLOCKED
            </button>

            <button
              className="button"
              onClick={() => handleMarkExecution("current", "SKIPPED")}
            >
              SKIPPED
            </button>
          </div>
        </div>

      </div>

    </section>
  );
};

export default ExecuteTests;