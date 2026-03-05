import nodemailer from "nodemailer";
import prisma from "../prisma";
const prismaAny = prisma as any;
import {
  bugAssignedTemplate,
  bugStatusChangedTemplate,
  mentionTemplate,
  retestRequestedTemplate,
  testAssignedTemplate,
} from "./emailTemplates";

export type NotificationEmailType =
  | "BUG_ASSIGNED"
  | "BUG_STATUS_CHANGED"
  | "TEST_ASSIGNED"
  | "COMMENT_MENTION"
  | "RETEST_REQUESTED";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const toMinutes = (hhmm: string): number | null => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const isInQuietHours = (start?: string | null, end?: string | null): boolean => {
  if (!start || !end) return false;
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (s <= e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e;
};

const canSendEmail = async (userId: string, type: NotificationEmailType): Promise<boolean> => {
  const pref = await prismaAny.notificationPreference.findUnique({ where: { userId } });
  if (!pref) return true;
  if (isInQuietHours(pref.quietHoursStart, pref.quietHoursEnd)) return false;
  switch (type) {
    case "BUG_ASSIGNED":
      return pref.emailBugAssigned;
    case "COMMENT_MENTION":
      return pref.emailComments;
    case "BUG_STATUS_CHANGED":
    case "RETEST_REQUESTED":
      return pref.emailStatusChange;
    case "TEST_ASSIGNED":
      return true;
    default:
      return true;
  }
};

const send = async (to: string, subject: string, html: string) => {
  if (!to || !process.env.EMAIL_USER) return;
  await transporter.sendMail({
    from: `"TestTrack Pro" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

export const sendBugAssignedEmail = async (userId: string, email: string, bugCode: string) => {
  if (!(await canSendEmail(userId, "BUG_ASSIGNED"))) return;
  await send(email, `Bug Assigned: ${bugCode}`, bugAssignedTemplate(bugCode));
};

export const sendBugStatusChangedEmail = async (
  userId: string,
  email: string,
  bugCode: string,
  status: string
) => {
  if (!(await canSendEmail(userId, "BUG_STATUS_CHANGED"))) return;
  await send(email, `Bug Update: ${bugCode}`, bugStatusChangedTemplate(bugCode, status));
};

export const sendTestAssignedEmail = async (userId: string, email: string, runName: string) => {
  if (!(await canSendEmail(userId, "TEST_ASSIGNED"))) return;
  await send(email, `Test Assignment: ${runName}`, testAssignedTemplate(runName));
};

export const sendCommentMentionEmail = async (userId: string, email: string, bugCode: string) => {
  if (!(await canSendEmail(userId, "COMMENT_MENTION"))) return;
  await send(email, `Mentioned in ${bugCode}`, mentionTemplate(bugCode));
};

export const sendRetestRequestedEmail = async (userId: string, email: string, bugCode: string) => {
  if (!(await canSendEmail(userId, "RETEST_REQUESTED"))) return;
  await send(email, `Re-test Requested: ${bugCode}`, retestRequestedTemplate(bugCode));
};
