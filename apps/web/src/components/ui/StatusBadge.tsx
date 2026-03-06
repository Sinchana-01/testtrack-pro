import React from "react";

type Props = {
  value?: string;
};

const normalize = (value: string) => String(value || "").trim().toUpperCase();

const variantClass = (value: string): string => {
  const v = normalize(value);
  if (["PASSED", "ACTIVE", "APPROVED", "VERIFIED", "FIXED", "OPEN"].includes(v)) return "statusBadge statusBadge-success";
  if (["FAILED", "CRITICAL", "BLOCKER", "REJECTED"].includes(v)) return "statusBadge statusBadge-danger";
  if (["PENDING", "IN_PROGRESS", "BLOCKED", "READY_FOR_REVIEW"].includes(v)) return "statusBadge statusBadge-warning";
  return "statusBadge statusBadge-neutral";
};

const toLabel = (value: string): string => {
  const v = normalize(value).replace(/_/g, " ");
  if (!v) return "UNKNOWN";
  return v;
};

const StatusBadge: React.FC<Props> = ({ value = "UNKNOWN" }) => {
  return <span className={variantClass(value)}>{toLabel(value)}</span>;
};

export default StatusBadge;
