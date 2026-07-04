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

/** "Good morning" (<12h), "Good afternoon" (<18h), else "Good evening". */
export function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Formats a date as "WEDNESDAY, JUNE 24" for the mono sub-header. */
export function formatToday(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}
