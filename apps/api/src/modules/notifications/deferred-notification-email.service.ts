import prisma from "../../prisma";
import { canSendNotificationEmail, NotificationDeliveryType } from "./notification-preference.utils";
import { getNotificationQuietHoursState } from "./notification-email-timing";

const prismaAny = prisma as any;

export type DeferredNotificationEmailInput = {
  userId: string;
  type: NotificationDeliveryType;
  toEmail: string;
  subject: string;
  html: string;
  scheduledFor: Date;
};

export const queueDeferredNotificationEmail = async (input: DeferredNotificationEmailInput) => {
  return prismaAny.deferredNotificationEmail.create({
    data: {
      userId: input.userId,
      type: input.type,
      toEmail: input.toEmail,
      subject: input.subject,
      html: input.html,
      scheduledFor: input.scheduledFor,
    },
  });
};

type SendEmailFn = (to: string, subject: string, html: string) => Promise<void>;

let schedulerBusy = false;

export const processDueDeferredNotificationEmails = async (sendEmail: SendEmailFn) => {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const now = new Date();
    const queued: any[] = await prismaAny.deferredNotificationEmail.findMany({
      where: {
        status: "PENDING",
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    });

    for (const item of queued) {
      const type = String(item.type || "").toUpperCase() as NotificationDeliveryType;
      const emailEnabled = await canSendNotificationEmail(item.userId, type);
      if (!emailEnabled) {
        await prismaAny.deferredNotificationEmail.update({
          where: { id: item.id },
          data: {
            status: "CANCELLED",
            lastError: "Email disabled before delivery",
          },
        });
        continue;
      }

      const quietState = await getNotificationQuietHoursState(item.userId, now);
      if (quietState.inQuietHours && quietState.nextAllowedAt) {
        await prismaAny.deferredNotificationEmail.update({
          where: { id: item.id },
          data: {
            scheduledFor: quietState.nextAllowedAt,
            lastError: "Deferred due to quiet hours",
          },
        });
        continue;
      }

      try {
        await sendEmail(String(item.toEmail || ""), String(item.subject || ""), String(item.html || ""));
        await prismaAny.deferredNotificationEmail.update({
          where: { id: item.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            attemptCount: Number(item.attemptCount || 0) + 1,
            lastError: null,
          },
        });
      } catch (error: any) {
        await prismaAny.deferredNotificationEmail.update({
          where: { id: item.id },
          data: {
            attemptCount: Number(item.attemptCount || 0) + 1,
            lastError: String(error?.message || "Deferred email send failed"),
            scheduledFor: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
      }
    }
  } catch (error) {
    console.error("DEFERRED_NOTIFICATION_EMAIL_SCHEDULER_ERROR", error);
  } finally {
    schedulerBusy = false;
  }
};

export const startDeferredNotificationEmailScheduler = (sendEmail: SendEmailFn) => {
  setInterval(() => {
    processDueDeferredNotificationEmails(sendEmail);
  }, 60 * 1000);
};

