export interface TimesheetEntry {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:mm (24h format, e.g. "09:00")
  timeOut: string; // HH:mm (24h format, e.g. "17:00")
  totalHours: number; // Decimal hours, e.g. 8.00
  createdAt?: string;
}
