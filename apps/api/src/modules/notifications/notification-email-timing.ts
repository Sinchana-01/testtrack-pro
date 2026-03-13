import prisma from "../../prisma";

const prismaAny = prisma as any;

const toMinutes = (hhmm: string): number | null => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

export const isInQuietHours = (start?: string | null, end?: string | null, at = new Date()): boolean => {
  if (!start || !end) return false;
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return false;
  const nowMin = at.getHours() * 60 + at.getMinutes();
  if (s <= e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e;
};

export const computeNextQuietHoursEnd = (start?: string | null, end?: string | null, from = new Date()): Date | null => {
  if (!start || !end) return null;
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null) return null;

  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

  const nowMin = from.getHours() * 60 + from.getMinutes();
  if (startMin <= endMin) {
    if (nowMin >= startMin && nowMin < endMin) {
      return candidate;
    }
    if (nowMin >= endMin) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  if (nowMin >= startMin) {
    candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }
  return candidate;
};

export const getNotificationQuietHoursState = async (userId: string, at = new Date()) => {
  const pref = await prismaAny.notificationPreference.findUnique({ where: { userId } });
  const quietHoursStart = pref?.quietHoursStart || null;
  const quietHoursEnd = pref?.quietHoursEnd || null;
  const inQuietHours = isInQuietHours(quietHoursStart, quietHoursEnd, at);
  return {
    quietHoursStart,
    quietHoursEnd,
    inQuietHours,
    nextAllowedAt: inQuietHours ? computeNextQuietHoursEnd(quietHoursStart, quietHoursEnd, at) : at,
  };
};

