/**
 * Pure date/time helpers for the /home greeting. Kept free of React so they
 * can be unit-reasoned and reused; the dashboard calls these with the user's
 * local `new Date()` on mount so the greeting reflects their wall clock.
 */

const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

/** "Good morning" (5–11), "Good afternoon" (12–16), "Good evening" (17–21), else "It's late night". */
export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "It's late night";
}

/** Formats a date as "WEDNESDAY, JUNE 24" for the mono sub-header. */
export function formatToday(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

/** Formats the wall-clock time as "9:23 AM" for the greeting sub-header. */
export function formatTime(date: Date): string {
  const hour24 = date.getHours();
  const minute = date.getMinutes();
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}
