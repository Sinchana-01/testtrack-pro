import React, { useState } from "react";
import ExecuteTests from "./ExecuteTests";
import Reports from "./Reports";

interface Props {
  executionTestCases: any[];
  executions: any[];
  handleMarkExecution: (id: string, status: string) => Promise<void>;
}

const TesterDashboard: React.FC<Props> = ({
  executionTestCases,
  executions,
  handleMarkExecution,
}) => {
  const [activeFeature, setActiveFeature] = useState("report_dashboard");

  return (
    <div className="dashboardWrapper">

      {/* Sidebar */}
      <aside className="sidebar">
        <button onClick={() => setActiveFeature("report_dashboard")}>
          Reports
        </button>
        <button onClick={() => setActiveFeature("execute_tests")}>
          Execute Tests
        </button>
      </aside>

      {/* Content */}
      <main className="dashboardContent">

        {activeFeature === "report_dashboard" && (
          <Reports executions={executions} />
        )}

        {activeFeature === "execute_tests" && (
          <ExecuteTests
            executionTestCases={executionTestCases}
            handleMarkExecution={handleMarkExecution}
          />
        )}

      </main>

    </div>
  );
};

export default TesterDashboard;