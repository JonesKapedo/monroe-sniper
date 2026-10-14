/**
 * Nairobi Time (EAT - East Africa Time, UTC+3 / GMT+3)
 * Provides precise timezone formatting, calendar dates, and active days counter
 * starting with today as Day 1.
 */

// UTC+3 offset in milliseconds (3 hours * 60 * 60 * 1000)
export const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface NairobiTimeInfo {
  iso: string;
  timeString: string; // HH:mm:ss EAT
  dateString: string; // YYYY-MM-DD
  dayOfWeek: string;
  fullLabel: string;
  dayNumber: number; // Day 1, Day 2, etc.
  dayLabel: string; // "Day 1 Active"
  activeSinceDate: string;
  timezone: string; // "EAT (UTC+3)"
}

/**
 * EAT wall-clock fields for a timestamp, read straight from formatToParts.
 * Never round-trips through `new Date(localeString)` — that parses in the
 * HOST timezone and shifts every field off-host.
 */
export function eatDayParts(timestamp: number): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date(timestamp))
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

/**
 * Returns EAT wall-clock fields as a Date-like (display only).
 * @deprecated Prefer eatDayParts() — this reparses in host TZ off-host.
 */
export function getNairobiDate(timestamp: number = Date.now()): Date {
  // Using Intl timezone conversion for accurate wall-clock representation
  const date = new Date(timestamp);
  const nairobiStr = date.toLocaleString("en-US", { timeZone: "Africa/Nairobi" });
  return new Date(nairobiStr);
}

/**
 * Returns formatted Nairobi EAT time info and calculates active days.
 * @param startTimestamp The timestamp when the bot was first activated (defaults to today/first run)
 * @param currentTimestamp The current timestamp (defaults to Date.now())
 */
export function formatNairobiTime(
  startTimestamp?: number,
  currentTimestamp: number = Date.now(),
): NairobiTimeInfo {
  // Format date parts using Africa/Nairobi
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(new Date(currentTimestamp));
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const weekday = getPart("weekday");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");

  const dateString = `${year}-${month}-${day}`;
  const timeString = `${hour}:${minute}:${second} EAT`;

  // Calculate day counter starting with today as Day 1
  // (EAT calendar days via formatToParts — host-TZ independent).
  let dayNumber = 1;
  let activeSinceDate = dateString;

  if (startTimestamp && startTimestamp <= currentTimestamp) {
    const start = eatDayParts(startTimestamp);
    const current = eatDayParts(currentTimestamp);

    const startEATMidnight = Date.UTC(start.year, start.month - 1, start.day);
    // EAT midnight in UTC is 21:00Z the prior day; day differences are exact
    // either way since both sides share the same constant shift.
    const currentEATMidnight = Date.UTC(current.year, current.month - 1, current.day);

    const diffDays = Math.floor((currentEATMidnight - startEATMidnight) / (24 * 60 * 60 * 1000));
    dayNumber = Math.max(1, diffDays + 1);

    const pad = (n: number) => String(n).padStart(2, "0");
    activeSinceDate = `${start.year}-${pad(start.month)}-${pad(start.day)}`;
  }

  const dayLabel = `Day ${dayNumber} Active`;
  const fullLabel = `${weekday}, ${dateString} · ${timeString} · ${dayLabel}`;

  return {
    iso: new Date(currentTimestamp).toISOString(),
    timeString,
    dateString,
    dayOfWeek: weekday,
    fullLabel,
    dayNumber,
    dayLabel,
    activeSinceDate,
    timezone: "EAT (UTC+3)",
  };
}
