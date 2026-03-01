import React from "react";

interface Props {
  executions: any[];
}

const Reports: React.FC<Props> = ({ executions }) => {
  const total = executions.length;
  const passed = executions.filter((e) => e.result === "PASSED").length;
  const failed = executions.filter((e) => e.result === "FAILED").length;
  const passRate = total ? Math.round((passed / total) * 100) : 0;

  return (
    <section className="panel">

      <h4>Reports Dashboard</h4>

      <div className="reportGrid">
        <div>Total Executed: {total}</div>
        <div>Pass Rate: {passRate}%</div>
        <div>Failed Count: {failed}</div>
      </div>

      <h5 style={{ marginTop: "20px" }}>Recent Runs</h5>

      {executions.slice(0, 5).map((run) => (
        <div key={run.id} className="simpleListItem">
          <div className="listName">{run.testCaseTitle}</div>
          <div className="listMeta">
            {run.result} • {new Date(run.executedAt).toLocaleString()}
          </div>
        </div>
      ))}

    </section>
  );
};

export default Reports;