import { AttachmentType } from "@prisma/client";

const MB = 1024 * 1024;

const EVIDENCE_LIMITS: Record<"IMAGE" | "VIDEO" | "LOG" | "HAR" | "DOCUMENT", number> = {
  IMAGE: 10 * MB,
  VIDEO: 100 * MB,
  LOG: 50 * MB,
  HAR: 50 * MB,
  DOCUMENT: 50 * MB,
};

const getByteSizeFromDataUrl = (fileUrl: string): number => {
  const match = String(fileUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return 0;
  return Buffer.from(match[2], "base64").length;
};

const getMimeTypeFromDataUrl = (fileUrl: string): string => {
  const match = String(fileUrl || "").match(/^data:([^;]+);base64,/);
  return String(match?.[1] || "").toLowerCase();
};

const inferEvidenceKind = (fileType: AttachmentType, fileName: string, fileUrl: string): "IMAGE" | "VIDEO" | "LOG" | "HAR" | "DOCUMENT" => {
  const normalizedName = String(fileName || "").toLowerCase();
  const mimeType = getMimeTypeFromDataUrl(fileUrl);
  if (normalizedName.endsWith(".har")) return "HAR";
  if (fileType === AttachmentType.IMAGE || mimeType.startsWith("image/")) return "IMAGE";
  if (fileType === AttachmentType.VIDEO || mimeType.startsWith("video/")) return "VIDEO";
  if (
    fileType === AttachmentType.LOG ||
    mimeType.startsWith("text/") ||
    normalizedName.endsWith(".log") ||
    normalizedName.endsWith(".txt") ||
    normalizedName.endsWith(".json")
  ) {
    return "LOG";
  }
  return "DOCUMENT";
};

export const validateExecutionEvidenceUpload = (input: {
  fileType: AttachmentType;
  fileUrl: string;
  fileName: string;
}): string | null => {
  const fileUrl = String(input.fileUrl || "");
  const fileName = String(input.fileName || "");
  if (!fileUrl.startsWith("data:")) {
    return "Execution evidence upload requires a file attachment.";
  }

  const mimeType = getMimeTypeFromDataUrl(fileUrl);
  const kind = inferEvidenceKind(input.fileType, fileName, fileUrl);
  const size = getByteSizeFromDataUrl(fileUrl);
  const limit = EVIDENCE_LIMITS[kind];

  if (!size) {
    return "Attached evidence file is empty or invalid.";
  }
  if (size > limit) {
    return `${kind} evidence exceeds maximum size of ${Math.round(limit / MB)}MB.`;
  }
  if (kind === "IMAGE" && !mimeType.startsWith("image/")) {
    return "IMAGE evidence must be an image file.";
  }
  if (kind === "VIDEO" && !mimeType.startsWith("video/")) {
    return "VIDEO evidence must be a video file.";
  }
  if (kind === "HAR" && !String(fileName || "").toLowerCase().endsWith(".har")) {
    return "Network trace evidence must use a .har file.";
  }
  if (
    kind === "LOG" &&
    !(
      mimeType.startsWith("text/") ||
      String(fileName || "").toLowerCase().endsWith(".log") ||
      String(fileName || "").toLowerCase().endsWith(".txt") ||
      String(fileName || "").toLowerCase().endsWith(".json")
    )
  ) {
    return "LOG evidence must be a text, .log, .txt, or .json file.";
  }

  return null;
};
