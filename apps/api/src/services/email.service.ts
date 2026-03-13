import nodemailer from "nodemailer";
import {
  bugAssignedTemplate,
  bugStatusChangedTemplate,
  mentionTemplate,
  retestRequestedTemplate,
  testAssignedTemplate,
} from "./emailTemplates";
import { canSendNotificationEmail, NotificationDeliveryType } from "../modules/notifications/notification-preference.utils";
import { getNotificationQuietHoursState } from "../modules/notifications/notification-email-timing";
import { queueDeferredNotificationEmail } from "../modules/notifications/deferred-notification-email.service";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendRawNotificationEmail = async (to: string, subject: string, html: string) => {
  if (!to || !process.env.EMAIL_USER) return;
  await transporter.sendMail({
    from: `"TestTrack Pro" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

const dispatchNotificationEmail = async (
  userId: string,
  type: NotificationDeliveryType,
  to: string,
  subject: string,
  html: string
) => {
  if (!to || !process.env.EMAIL_USER) return;
  const emailEnabled = await canSendNotificationEmail(userId, type);
  if (!emailEnabled) return;

  const quietState = await getNotificationQuietHoursState(userId);
  if (quietState.inQuietHours && quietState.nextAllowedAt) {
    await queueDeferredNotificationEmail({
      userId,
      type,
      toEmail: to,
      subject,
      html,
      scheduledFor: quietState.nextAllowedAt,
    });
    return;
  }

  await sendRawNotificationEmail(to, subject, html);
};

export const sendBugAssignedEmail = async (userId: string, email: string, bugCode: string) => {
  await dispatchNotificationEmail(userId, "BUG_ASSIGNED", email, `Bug Assigned: ${bugCode}`, bugAssignedTemplate(bugCode));
};

export const sendBugStatusChangedEmail = async (
  userId: string,
  email: string,
  bugCode: string,
  status: string
) => {
  await dispatchNotificationEmail(
    userId,
    "BUG_STATUS_CHANGED",
    email,
    `Bug Update: ${bugCode}`,
    bugStatusChangedTemplate(bugCode, status)
  );
};

export const sendTestAssignedEmail = async (userId: string, email: string, runName: string) => {
  await dispatchNotificationEmail(userId, "TEST_ASSIGNED", email, `Test Assignment: ${runName}`, testAssignedTemplate(runName));
};

export const sendCommentMentionEmail = async (userId: string, email: string, bugCode: string) => {
  await dispatchNotificationEmail(userId, "COMMENT_MENTION", email, `Mentioned in ${bugCode}`, mentionTemplate(bugCode));
};

export const sendRetestRequestedEmail = async (userId: string, email: string, bugCode: string) => {
  await dispatchNotificationEmail(
    userId,
    "RETEST_REQUESTED",
    email,
    `Re-test Requested: ${bugCode}`,
    retestRequestedTemplate(bugCode)
  );
};
