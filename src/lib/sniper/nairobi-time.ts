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
 * Returns a Date object adjusted to Nairobi EAT wall-clock time
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
  const nairobiNow = getNairobiDate(currentTimestamp);
  
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
  let dayNumber = 1;
  let activeSinceDate = dateString;

  if (startTimestamp && startTimestamp <= currentTimestamp) {
    const startDate = getNairobiDate(startTimestamp);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate();

    const startUtcMidnight = Date.UTC(startYear, startMonth, startDay);
    const currentUtcMidnight = Date.UTC(
      nairobiNow.getFullYear(),
      nairobiNow.getMonth(),
      nairobiNow.getDate(),
    );

    const diffDays = Math.floor((currentUtcMidnight - startUtcMidnight) / (24 * 60 * 60 * 1000));
    dayNumber = Math.max(1, diffDays + 1);

    const pad = (n: number) => String(n).padStart(2, "0");
    activeSinceDate = `${startYear}-${pad(startMonth + 1)}-${pad(startDay)}`;
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
