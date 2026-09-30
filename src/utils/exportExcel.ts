import * as XLSX from "xlsx";
import { TimesheetEntry } from "@/types/timesheet";
import { formatTime12h, formatDisplayDate } from "./timeUtils";

export function exportTimesheetToExcel(
  entries: TimesheetEntry[],
  selectedStudentName?: string
) {
  const totalHours = entries.reduce((acc, curr) => acc + curr.totalHours, 0);

  // Prepare table data
  const data: (string | number)[][] = [
    ["CO-OP WORK TIMESHEET"],
    ["Generated:", new Date().toLocaleDateString()],
    [],
    ["#", "Student Name", "Date", "Time In", "Time Out", "Total Hours"],
  ];

  entries.forEach((entry, index) => {
    data.push([
      index + 1,
      entry.name,
      entry.date,
      formatTime12h(entry.timeIn),
      formatTime12h(entry.timeOut),
      entry.totalHours,
    ]);
  });

  // Summary Row
  data.push([]);
  data.push(["", "", "", "", "TOTAL HOURS:", Math.round(totalHours * 100) / 100]);

  // Create sheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws["!cols"] = [
    { wch: 8 },  // #
    { wch: 25 }, // Student Name
    { wch: 15 }, // Date
    { wch: 15 }, // Time In
    { wch: 15 }, // Time Out
    { wch: 15 }, // Total Hours
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Timesheet");

  const cleanName = selectedStudentName
    ? selectedStudentName.replace(/\s+/g, "_")
    : "Coop";
  XLSX.writeFile(wb, `${cleanName}_Timesheet.xlsx`);
}
