import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
} from "docx";
import { TimesheetEntry } from "@/types/timesheet";
import { formatTime12h, formatDisplayDate } from "./timeUtils";

export async function exportTimesheetToWord(
  entries: TimesheetEntry[],
  selectedStudentName?: string
) {
  const totalHours = entries.reduce((acc, curr) => acc + curr.totalHours, 0);

  const subtleBorder = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "CBD5E1",
  };

  const borders = {
    top: subtleBorder,
    bottom: subtleBorder,
    left: subtleBorder,
    right: subtleBorder,
  };

  // Header row
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: "2563EB" },
        borders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "#", bold: true, color: "FFFFFF" })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: "2563EB" },
        borders,
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Student Name", bold: true, color: "FFFFFF" }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: "2563EB" },
        borders,
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Date", bold: true, color: "FFFFFF" })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: "2563EB" },
        borders,
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Time In", bold: true, color: "FFFFFF" }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: "2563EB" },
        borders,
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Time Out", bold: true, color: "FFFFFF" }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: "2563EB" },
        borders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Hours", bold: true, color: "FFFFFF" }),
            ],
          }),
        ],
      }),
    ],
  });

  // Entry rows
  const dataRows = entries.map((entry, index) => {
    const isEven = index % 2 === 0;
    const bgShade = isEven ? undefined : { type: ShadingType.CLEAR, fill: "F8FAFC" };

    return new TableRow({
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: bgShade,
          borders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${index + 1}` })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: bgShade,
          borders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: entry.name, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: bgShade,
          borders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: formatDisplayDate(entry.date) })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: bgShade,
          borders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: formatTime12h(entry.timeIn) })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: bgShade,
          borders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: formatTime12h(entry.timeOut) })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: bgShade,
          borders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${entry.totalHours.toFixed(2)}`,
                  bold: true,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  // Total summary row
  const totalRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 5,
        width: { size: 90, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: "E2E8F0" },
        borders,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "TOTAL HOURS:", bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: "DBEAFE" },
        borders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${totalHours.toFixed(2)}h`,
                bold: true,
                color: "1E40AF",
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows, totalRow],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "CO-OP WORK TIMESHEET",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Generated on ${new Date().toLocaleDateString("en-US", {
                  dateStyle: "full",
                })}`,
                italics: true,
                color: "64748B",
              }),
            ],
          }),
          table,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const cleanName = selectedStudentName
    ? selectedStudentName.replace(/\s+/g, "_")
    : "Coop";
  a.download = `${cleanName}_Timesheet.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
