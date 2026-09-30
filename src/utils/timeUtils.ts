/**
 * Calculates hours worked between Time In and Time Out.
 * @param timeIn "HH:mm" (24h)
 * @param timeOut "HH:mm" (24h)
 * @returns number of hours rounded to 2 decimal places
 */
export function calculateHours(timeIn: string, timeOut: string): number {
  if (!timeIn || !timeOut) return 0;

  const [inHour, inMin] = timeIn.split(":").map(Number);
  const [outHour, outMin] = timeOut.split(":").map(Number);

  if (isNaN(inHour) || isNaN(inMin) || isNaN(outHour) || isNaN(outMin)) {
    return 0;
  }

  const startTotalMinutes = inHour * 60 + inMin;
  let endTotalMinutes = outHour * 60 + outMin;

  // Handle overnight shift if time out is before time in
  if (endTotalMinutes < startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }

  const netMinutes = Math.max(0, endTotalMinutes - startTotalMinutes);
  const hours = netMinutes / 60;
  return Math.round(hours * 100) / 100;
}

/**
 * Converts "17:00" to "5:00 PM"
 */
export function formatTime12h(time24: string): string {
  if (!time24) return "--:--";
  const [hours, minutes] = time24.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time24;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");

  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Formats YYYY-MM-DD to readable date like "Wed, Sep 30, 2026"
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns current time formatted as HH:mm
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
