import React, { useEffect, useMemo, useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedBug: any;
  isDeveloper: boolean;
  canTransitionBugs: boolean;
  canResolveBugs: boolean;
  bugTransitionToStatus: string;
  setBugTransitionToStatus: (value: string) => void;
  bugTransitionReason: string;
  setBugTransitionReason: (value: string) => void;
  bugTransitionDuplicateOf: string;
  setBugTransitionDuplicateOf: (value: string) => void;
  onApplyTransition: () => Promise<void>;
  onRefreshDetails: () => Promise<void>;
  bugResolveAction: string;
  setBugResolveAction: (value: string) => void;
  bugResolveFixNotes: string;
  setBugResolveFixNotes: (value: string) => void;
  bugResolveCommitLink: string;
  setBugResolveCommitLink: (value: string) => void;
  onApplyResolution: () => Promise<void>;
  bugCommentText: string;
  onCommentTextChange: (value: string) => void;
  bugCommentParentId: string;
  setBugCommentParentId: (value: string) => void;
  onAddComment: () => Promise<void>;
  showMentionPopup: boolean;
  filteredMentionCandidates: Array<{ key: string; label: string }>;
  onApplyMention: (key: string) => void;
  appendCommentSnippet: (snippet: string) => void;
  bugCommentThreads: any[];
  bugComments: any[];
  renderCommentThreads: (items: any[], depth?: number) => JSX.Element[];
  isDeletedComment: (item: any) => boolean;
  renderFormattedComment: (text: string) => React.ReactNode;
};

const BugDetailsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedBug,
  isDeveloper,
  canTransitionBugs,
  canResolveBugs,
  bugTransitionToStatus,
  setBugTransitionToStatus,
  bugTransitionReason,
  setBugTransitionReason,
  bugTransitionDuplicateOf,
  setBugTransitionDuplicateOf,
  onApplyTransition,
  onRefreshDetails,
  bugResolveAction,
  setBugResolveAction,
  bugResolveFixNotes,
  setBugResolveFixNotes,
  bugResolveCommitLink,
  setBugResolveCommitLink,
  onApplyResolution,
  bugCommentText,
  onCommentTextChange,
  bugCommentParentId,
  setBugCommentParentId,
  onAddComment,
  showMentionPopup,
  filteredMentionCandidates,
  onApplyMention,
  appendCommentSnippet,
  bugCommentThreads,
  bugComments,
  renderCommentThreads,
  isDeletedComment,
  renderFormattedComment,
}) => {
  const sectionOptions = useMemo(() => {
    const items: Array<{ key: "transition" | "resolution" | "comments" | "test_case"; label: string }> = [];
    if (canTransitionBugs) items.push({ key: "transition", label: "Workflow Transition" });
    if (canResolveBugs) items.push({ key: "resolution", label: "Developer Resolution" });
    if (selectedBug?.testCase) items.push({ key: "test_case", label: "View Test Case Details" });
    items.push({ key: "comments", label: "Bug Comments" });
    return items;
  }, [canTransitionBugs, canResolveBugs, selectedBug?.testCase]);
  const [popupSection, setPopupSection] = useState<"transition" | "resolution" | "comments" | "test_case" | null>(null);
  useEffect(() => {
    if (popupSection && !sectionOptions.some((item) => item.key === popupSection)) {
      setPopupSection(null);
    }
  }, [sectionOptions, popupSection]);
  if (!isOpen || !selectedBug) return null;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="row bugModalHeaderTop" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h4 style={{ margin: 0 }}>Bug Details</h4>
          <button className="button small" aria-label="Close bug details modal" onClick={onClose}>X</button>
        </div>
        <div className="bugSectionTabs" aria-label="Bug detail actions">
          {sectionOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`button small bugSectionTab ${popupSection === item.key ? "active" : ""}`}
              onClick={() => setPopupSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="bugDetailsGrid">
          <section className="bugDetailsCard">
            <h5 className="bugDetailsHeading">Overview</h5>
            <div className="bugDetailsMetaGrid">
              <div><strong>Bug ID:</strong> {selectedBug.bugId || selectedBug.id}</div>
              <div><strong>Status:</strong> {selectedBug.workflowStatus}</div>
              <div><strong>Priority:</strong> {selectedBug.priority}</div>
              <div><strong>Severity:</strong> {selectedBug.severity}</div>
              <div><strong>Reporter:</strong> {selectedBug.reporter?.name || selectedBug.reportedBy || "N/A"}</div>
              <div><strong>Assigned To:</strong> {selectedBug.assignee?.name || selectedBug.assignedTo || "Unassigned"}</div>
              <div><strong>Linked Test Case:</strong> {selectedBug.testCase?.testCaseCode || selectedBug.testCaseId || "N/A"}</div>
              <div><strong>Affected Version:</strong> {selectedBug.bugMeta?.affectedVersion || "N/A"}</div>
            </div>
            <div className="bugDetailsField">
              <strong>Title</strong>
              <p>{selectedBug.title || "N/A"}</p>
            </div>
            <div className="bugDetailsField">
              <strong>Description</strong>
              <p>{selectedBug.description || "N/A"}</p>
            </div>
          </section>

          <section className="bugDetailsCard">
            <h5 className="bugDetailsHeading">Behavior & Reproduction</h5>
            <div className="bugDetailsField">
              <strong>Steps to Reproduce</strong>
              <p>{selectedBug.bugMeta?.stepsToReproduce || "N/A"}</p>
            </div>
            <div className="bugDetailsField">
              <strong>Expected Behavior</strong>
              <p>{selectedBug.bugMeta?.expectedBehavior || "N/A"}</p>
            </div>
            <div className="bugDetailsField">
              <strong>Actual Behavior</strong>
              <p>{selectedBug.bugMeta?.actualBehavior || "N/A"}</p>
            </div>
            <div className="bugDetailsField">
              <strong>Environment</strong>
              <p>{selectedBug.bugMeta?.environment || "N/A"}</p>
            </div>
          </section>

          <section className="bugDetailsCard">
            <h5 className="bugDetailsHeading">Resolution & Evidence</h5>
            <div className="bugDetailsField">
              <strong>Fix Notes</strong>
              <p>{selectedBug.fixNotes || "N/A"}</p>
            </div>
            <div className="bugDetailsField">
              <strong>Bug Commits</strong>
              <p>{selectedBug.commitLink || "N/A"}</p>
            </div>
            <div className="bugDetailsField">
              <strong>Attachments</strong>
              <p>
                {Array.isArray(selectedBug.attachments) && selectedBug.attachments.length > 0
                  ? selectedBug.attachments.map((a: any) => a.fileName).join(", ")
                  : "N/A"}
              </p>
            </div>
          </section>
        </div>

        {popupSection && (
          <div className="modalBackdrop bugActionModalBackdrop" onClick={() => setPopupSection(null)}>
            <div className="modalCard bugActionModalCard" onClick={(e) => e.stopPropagation()}>
              <div className="row bugModalHeaderTop" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>
                  {popupSection === "transition"
                    ? "Workflow Transition"
                    : popupSection === "resolution"
                    ? "Developer Resolution"
                    : popupSection === "test_case"
                    ? "Linked Test Case Details"
                    : "Bug Comments"}
                </h4>
                <button className="button small" aria-label="Close bug action modal" onClick={() => setPopupSection(null)}>X</button>
              </div>

              {popupSection === "transition" && canTransitionBugs && (
                <>
                  <select
                    className="input"
                    value={bugTransitionToStatus}
                    onChange={(e) => setBugTransitionToStatus(e.target.value)}
                  >
                    <option value="">Select target status</option>
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="FIXED">FIXED</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="REOPENED">REOPENED</option>
                    <option value="WONT_FIX">WONT_FIX</option>
                    <option value="DUPLICATE">DUPLICATE</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Reason (for Won't Fix)"
                    value={bugTransitionReason}
                    onChange={(e) => setBugTransitionReason(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Duplicate Bug Code (for Duplicate)"
                    value={bugTransitionDuplicateOf}
                    onChange={(e) => setBugTransitionDuplicateOf(e.target.value)}
                  />
                  <div className="inlineGrid">
                    <button className="button" onClick={onApplyTransition}>Apply Transition</button>
                    <button className="button" onClick={onRefreshDetails}>Refresh Details</button>
                  </div>
                </>
              )}

              {popupSection === "resolution" && canResolveBugs && (
                <>
                  <select className="input" value={bugResolveAction} onChange={(e) => setBugResolveAction(e.target.value)}>
                    <option value="">Select action</option>
                    <option value="START_PROGRESS">START_PROGRESS</option>
                    <option value="MARK_FIXED">MARK_FIXED</option>
                    <option value="REQUEST_RETEST">REQUEST_RETEST</option>
                    <option value="WONT_FIX">WONT_FIX</option>
                  </select>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Fix notes / resolution notes"
                    value={bugResolveFixNotes}
                    onChange={(e) => setBugResolveFixNotes(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Commit link (optional)"
                    value={bugResolveCommitLink}
                    onChange={(e) => setBugResolveCommitLink(e.target.value)}
                  />
                  <button className="button" onClick={onApplyResolution}>Apply Resolution Action</button>
                </>
              )}

              {popupSection === "comments" && (
                <>
                  <div className="toolbarActions" style={{ marginBottom: "8px" }}>
                    <button className="button small" onClick={() => appendCommentSnippet("@username")}>@Mention</button>
                    <button className="button small" onClick={() => appendCommentSnippet("**bold text**")}>Bold</button>
                    <button className="button small" onClick={() => appendCommentSnippet("_italic text_")}>Italic</button>
                    <button className="button small" onClick={() => appendCommentSnippet("`code`")}>Code</button>
                  </div>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Add comment"
                    value={bugCommentText}
                    onChange={(e) => onCommentTextChange(e.target.value)}
                  />
                  {showMentionPopup && filteredMentionCandidates.length > 0 && (
                    <div className="mentionPopup">
                      {filteredMentionCandidates.slice(0, 8).map((item) => (
                        <button key={item.key} className="mentionItem" onClick={() => onApplyMention(item.key)}>
                          @{item.key} - {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    className="input"
                    placeholder="Reply to Comment ID (optional)"
                    value={bugCommentParentId}
                    onChange={(e) => setBugCommentParentId(e.target.value)}
                  />
                  <button className="button" onClick={onAddComment}>Add Comment</button>
                  {bugCommentThreads.length > 0 && <div className="listCompact">{renderCommentThreads(bugCommentThreads)}</div>}
                  {bugComments.length > 0 && bugCommentThreads.length === 0 && (
                    <div className="listCompact">
                      {bugComments.map((item) => (
                        <div className={`bugCommentItem ${isDeletedComment(item) ? "isDeleted" : ""}`} key={item.id}>
                          <div className="bugCommentBody">
                            {isDeletedComment(item) ? "[Comment deleted]" : renderFormattedComment(item.comment || "")}
                          </div>
                          <div className="bugCommentFooter">
                            <span className="bugCommentMeta">
                              {item.author?.name || item.authorId} | {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {popupSection === "test_case" && (
                <>
                  {selectedBug?.testCase ? (
                    <div className="bugDetailsGrid">
                      <section className="bugDetailsCard">
                        <h5 className="bugDetailsHeading">Test Case Overview</h5>
                        <div className="bugDetailsMetaGrid">
                          <div><strong>Code:</strong> {selectedBug.testCase.testCaseCode || selectedBug.testCase.id || "N/A"}</div>
                          <div><strong>Module:</strong> {selectedBug.testCase.module || "General"}</div>
                          <div><strong>Priority:</strong> {selectedBug.testCase.priority || "N/A"}</div>
                          <div><strong>Status:</strong> {selectedBug.testCase.status || "N/A"}</div>
                          <div><strong>Severity:</strong> {selectedBug.testCase.severity || "N/A"}</div>
                          <div><strong>Type:</strong> {selectedBug.testCase.type || "N/A"}</div>
                        </div>
                        <div className="bugDetailsField">
                          <strong>Title</strong>
                          <p>{selectedBug.testCase.title || "N/A"}</p>
                        </div>
                        <div className="bugDetailsField">
                          <strong>Description</strong>
                          <p>{selectedBug.testCase.description || "N/A"}</p>
                        </div>
                        <div className="bugDetailsField">
                          <strong>Steps</strong>
                          <p>{typeof selectedBug.testCase.steps === "string" ? selectedBug.testCase.steps : JSON.stringify(selectedBug.testCase.steps ?? [], null, 2)}</p>
                        </div>
                        <div className="bugDetailsField">
                          <strong>Pre-conditions</strong>
                          <p>{JSON.stringify(selectedBug.testCase.preConditions ?? [], null, 2)}</p>
                        </div>
                      </section>
                    </div>
                  ) : (
                    <p className="note">No linked test case details available.</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BugDetailsModal;
