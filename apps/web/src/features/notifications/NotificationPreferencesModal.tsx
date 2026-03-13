import { useEffect, useMemo, useState } from "react";
import "./NotificationPreferencesModal.css";

export type NotificationPreferenceSettings = {
  emailBugAssigned: boolean;
  emailComments: boolean;
  emailStatusChange: boolean;
  emailTestAssigned: boolean;
  emailRetestRequested: boolean;
  inAppBugAssigned: boolean;
  inAppComments: boolean;
  inAppStatusChange: boolean;
  inAppTestAssigned: boolean;
  inAppRetestRequested: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

type PreferenceKey =
  | "bugAssigned"
  | "comments"
  | "statusChange"
  | "testAssigned"
  | "retestRequested";

type Props = {
  open: boolean;
  loading: boolean;
  saving: boolean;
  preferences: NotificationPreferenceSettings;
  error?: string;
  onClose: () => void;
  onSave: (payload: NotificationPreferenceSettings) => Promise<void> | void;
};

const notificationRows: Array<{
  key: PreferenceKey;
  label: string;
  description: string;
  emailKey: keyof NotificationPreferenceSettings;
  inAppKey: keyof NotificationPreferenceSettings;
}> = [
  {
    key: "bugAssigned",
    label: "Bug assignments",
    description: "Receive updates when a bug is assigned to you.",
    emailKey: "emailBugAssigned",
    inAppKey: "inAppBugAssigned",
  },
  {
    key: "comments",
    label: "Comment mentions",
    description: "Receive alerts when you are mentioned in bug comments.",
    emailKey: "emailComments",
    inAppKey: "inAppComments",
  },
  {
    key: "statusChange",
    label: "Bug status changes",
    description: "Receive workflow/status change updates on tracked bugs.",
    emailKey: "emailStatusChange",
    inAppKey: "inAppStatusChange",
  },
  {
    key: "testAssigned",
    label: "Test run assignments",
    description: "Receive updates when a test run is assigned to you.",
    emailKey: "emailTestAssigned",
    inAppKey: "inAppTestAssigned",
  },
  {
    key: "retestRequested",
    label: "Retest requests",
    description: "Receive updates when a developer requests retesting.",
    emailKey: "emailRetestRequested",
    inAppKey: "inAppRetestRequested",
  },
];

const NotificationPreferencesModal = ({
  open,
  loading,
  saving,
  preferences,
  error = "",
  onClose,
  onSave,
}: Props) => {
  const [draft, setDraft] = useState<NotificationPreferenceSettings>(preferences);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(preferences);
      setLocalError("");
    }
  }, [open, preferences]);

  const hasQuietHours = Boolean(draft.quietHoursStart || draft.quietHoursEnd);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(preferences), [draft, preferences]);

  if (!open) return null;

  return (
    <div className="notifPrefBackdrop" onClick={onClose}>
      <section className="notifPrefModal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="notifPrefHeader">
          <div>
            <h3>Notification Preferences</h3>
            <p>Choose which notifications stay in-app, which ones send email, and when email should stay quiet.</p>
          </div>
          <button type="button" className="notifPrefCloseBtn" onClick={onClose} aria-label="Close notification preferences">
            X
          </button>
        </header>

        <div className="notifPrefBody">
          {loading ? <div className="notifPrefNotice info">Loading preferences...</div> : null}
          {error ? <div className="notifPrefNotice error">{error}</div> : null}
          {localError ? <div className="notifPrefNotice error">{localError}</div> : null}

          <section className="notifPrefSection">
            <div className="notifPrefSectionTitle">Notification Types</div>
            <div className="notifPrefGrid notifPrefGridHeader">
              <div>Type</div>
              <div>In-App</div>
              <div>Email</div>
            </div>
            {notificationRows.map((row) => (
              <div key={row.key} className="notifPrefGrid">
                <div className="notifPrefTypeCell">
                  <strong>{row.label}</strong>
                  <span>{row.description}</span>
                </div>
                <label className="notifPrefToggle">
                  <input
                    type="checkbox"
                    checked={Boolean(draft[row.inAppKey])}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.inAppKey]: e.target.checked,
                      }))
                    }
                  />
                  <span>{draft[row.inAppKey] ? "Enabled" : "Disabled"}</span>
                </label>
                <label className="notifPrefToggle">
                  <input
                    type="checkbox"
                    checked={Boolean(draft[row.emailKey])}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.emailKey]: e.target.checked,
                      }))
                    }
                  />
                  <span>{draft[row.emailKey] ? "Enabled" : "Disabled"}</span>
                </label>
              </div>
            ))}
          </section>

          <section className="notifPrefSection">
            <div className="notifPrefSectionTitle">Quiet Hours</div>
            <p className="notifPrefQuietText">
              Quiet hours affect email only. In-app notifications continue unless you disable them above.
            </p>
            <div className="notifPrefQuietGrid">
              <label>
                <span>Start</span>
                <input
                  type="time"
                  value={draft.quietHoursStart || ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      quietHoursStart: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label>
                <span>End</span>
                <input
                  type="time"
                  value={draft.quietHoursEnd || ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      quietHoursEnd: e.target.value || null,
                    }))
                  }
                />
              </label>
            </div>
            {hasQuietHours ? (
              <button
                type="button"
                className="notifPrefSecondaryBtn"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    quietHoursStart: null,
                    quietHoursEnd: null,
                  }))
                }
              >
                Clear Quiet Hours
              </button>
            ) : null}
          </section>
        </div>

        <footer className="notifPrefFooter">
          <button type="button" className="notifPrefSecondaryBtn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="notifPrefPrimaryBtn"
            disabled={loading || saving || !dirty}
            onClick={async () => {
              if ((draft.quietHoursStart && !draft.quietHoursEnd) || (!draft.quietHoursStart && draft.quietHoursEnd)) {
                setLocalError("Set both quiet hour times or clear both.");
                return;
              }
              await onSave(draft);
            }}
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default NotificationPreferencesModal;
