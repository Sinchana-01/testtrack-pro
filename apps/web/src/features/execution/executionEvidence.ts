export type ExecutionEvidenceUiType = "IMAGE" | "VIDEO" | "LOG" | "HAR" | "DOCUMENT";

const MB = 1024 * 1024;

export const EXECUTION_EVIDENCE_LIMITS: Record<ExecutionEvidenceUiType, number> = {
  IMAGE: 10 * MB,
  VIDEO: 100 * MB,
  LOG: 50 * MB,
  HAR: 50 * MB,
  DOCUMENT: 50 * MB,
};

export const EXECUTION_EVIDENCE_LABELS: Record<ExecutionEvidenceUiType, string> = {
  IMAGE: "Screenshot / Image",
  VIDEO: "Video",
  LOG: "Log File",
  HAR: "Network Trace (HAR)",
  DOCUMENT: "Document",
};

export const mapEvidenceUiTypeToApiType = (value: ExecutionEvidenceUiType): "IMAGE" | "VIDEO" | "LOG" | "DOCUMENT" =>
  value === "HAR" ? "DOCUMENT" : value;

export const inferExecutionEvidenceType = (file: File): ExecutionEvidenceUiType => {
  const fileName = String(file?.name || "").toLowerCase();
  const mimeType = String(file?.type || "").toLowerCase();
  if (fileName.endsWith(".har")) return "HAR";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (
    mimeType.startsWith("text/") ||
    fileName.endsWith(".log") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".json")
  ) {
    return "LOG";
  }
  return "DOCUMENT";
};

const bytesToMb = (bytes: number): string => `${(bytes / MB).toFixed(0)}MB`;

export const getExecutionEvidenceLimitText = (value: ExecutionEvidenceUiType): string =>
  bytesToMb(EXECUTION_EVIDENCE_LIMITS[value]);

export const validateExecutionEvidenceFile = (file: File, requestedType: ExecutionEvidenceUiType): string | null => {
  const fileName = String(file?.name || "").toLowerCase();
  const mimeType = String(file?.type || "").toLowerCase();
  const sizeLimit = EXECUTION_EVIDENCE_LIMITS[requestedType];

  if (!file) return "Select a file to attach.";
  if (file.size > sizeLimit) {
    return `${EXECUTION_EVIDENCE_LABELS[requestedType]} must be ${bytesToMb(sizeLimit)} or smaller.`;
  }

  if (requestedType === "IMAGE" && !mimeType.startsWith("image/")) {
    return "Selected file is not a valid image.";
  }
  if (requestedType === "VIDEO" && !mimeType.startsWith("video/")) {
    return "Selected file is not a valid video.";
  }
  if (requestedType === "HAR" && !fileName.endsWith(".har")) {
    return "Network trace upload requires a .har file.";
  }
  if (
    requestedType === "LOG" &&
    !(
      mimeType.startsWith("text/") ||
      fileName.endsWith(".log") ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".json")
    )
  ) {
    return "Log upload requires a text, .log, .txt, or .json file.";
  }

  return null;
};
