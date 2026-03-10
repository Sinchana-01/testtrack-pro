import React from "react";

type Props = {
  isOpen: boolean;
  issue: any | null;
  statusValue: string;
  onStatusChange: (value: string) => void;
  fixNotesValue: string;
  onFixNotesChange: (value: string) => void;
  commitLinkValue: string;
  onCommitLinkChange: (value: string) => void;
  commentValue: string;
  onCommentChange: (value: string) => void;
  loading: boolean;
  onClose: () => void;
  onUpdateStatus: () => Promise<void>;
  onSaveFixNotes: () => Promise<void>;
  onLinkCommit: () => Promise<void>;
  onRequestRetest: () => Promise<void>;
  onAddComment: () => Promise<void>;
};

const DeveloperIssueActionModal: React.FC<Props> = ({
  isOpen,
  issue,
  statusValue,
  onStatusChange,
  fixNotesValue,
  onFixNotesChange,
  commitLinkValue,
  onCommitLinkChange,
  commentValue,
  onCommentChange,
  loading,
  onClose,
  onUpdateStatus,
  onSaveFixNotes,
  onLinkCommit,
  onRequestRetest,
  onAddComment,
}) => {
  if (!isOpen || !issue) return null;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h4 style={{ margin: 0 }}>Manage Issue</h4>
          <button className="button small" aria-label="Close manage issue modal" onClick={onClose}>X</button>
        </div>

        <div className="testCaseDetails" style={{ marginBottom: "10px" }}>
          <div><strong>Issue:</strong> {issue.bugId || issue.id}</div>
          <div><strong>Title:</strong> {issue.title || "Untitled"}</div>
          <div><strong>Status:</strong> {issue.workflowStatus || issue.status || "OPEN"}</div>
          <div><strong>Assigned To:</strong> {issue.assignee?.name || issue.assignedTo || "N/A"}</div>
        </div>

        <h5 style={{ marginBottom: 8 }}>Update Issue Status</h5>
        <div className="inlineGrid">
          <select className="input" value={statusValue} onChange={(e) => onStatusChange(e.target.value)} disabled={loading}>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="FIXED">FIXED</option>
            <option value="WONT_FIX">WONT_FIX</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <button className="button" disabled={loading} onClick={onUpdateStatus}>
            {loading ? "Saving..." : "Update Status"}
          </button>
        </div>

        <h5 style={{ marginBottom: 8 }}>Add Fix Notes</h5>
        <textarea
          className="input"
          rows={3}
          value={fixNotesValue}
          onChange={(e) => onFixNotesChange(e.target.value)}
          placeholder="Document fix details or reason"
          disabled={loading}
        />
        <button className="button" disabled={loading} onClick={onSaveFixNotes}>
          {loading ? "Saving..." : "Save Fix Notes"}
        </button>

        <h5 style={{ marginBottom: 8, marginTop: 12 }}>Link Code Commit</h5>
        <div className="inlineGrid">
          <input
            className="input"
            value={commitLinkValue}
            onChange={(e) => onCommitLinkChange(e.target.value)}
            placeholder="https://github.com/org/repo/commit/..."
            disabled={loading}
          />
          <button className="button" disabled={loading} onClick={onLinkCommit}>
            {loading ? "Saving..." : "Link Commit"}
          </button>
        </div>

        <h5 style={{ marginBottom: 8, marginTop: 12 }}>Request Re-test</h5>
        <button className="button" disabled={loading} onClick={onRequestRetest}>
          {loading ? "Saving..." : "Request Re-test"}
        </button>

        <h5 style={{ marginBottom: 8, marginTop: 12 }}>Comment on Issue</h5>
        <textarea
          className="input"
          rows={3}
          value={commentValue}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Add collaboration note for tester/dev team"
          disabled={loading}
        />
        <button className="button" disabled={loading} onClick={onAddComment}>
          {loading ? "Saving..." : "Add Comment"}
        </button>
      </div>
    </div>
  );
};

export default DeveloperIssueActionModal;
