type EmailTemplateInput = {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

const wrap = ({ title, message, ctaLabel, ctaUrl }: EmailTemplateInput): string => {
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<p style="margin:16px 0 0;">
          <a href="${ctaUrl}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
            ${ctaLabel}
          </a>
        </p>`
      : "";
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a;">
    <h2 style="margin:0 0 10px;">${title}</h2>
    <p style="margin:0;">${message}</p>
    ${ctaBlock}
  </div>`;
};

export const bugAssignedTemplate = (bugCode: string) =>
  wrap({
    title: "Bug Assigned",
    message: `New bug ${bugCode} assigned to you.`,
  });

export const bugStatusChangedTemplate = (bugCode: string, status: string) =>
  wrap({
    title: "Bug Status Changed",
    message: `${bugCode} status changed to ${status}.`,
  });

export const testAssignedTemplate = (runName: string) =>
  wrap({
    title: "Test Assigned",
    message: `Test run '${runName}' assigned to you.`,
  });

export const mentionTemplate = (bugCode: string) =>
  wrap({
    title: "Mentioned in Comment",
    message: `You were mentioned in ${bugCode}.`,
  });

export const retestRequestedTemplate = (bugCode: string) =>
  wrap({
    title: "Re-test Requested",
    message: `Re-test requested for ${bugCode}.`,
  });
