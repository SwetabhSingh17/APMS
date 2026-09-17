import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { ITopicOnboardingRow, ITopicOnboardingItem } from "@shared/schema";

/**
 * Result of parsing a topic suggestions workbook
 */
export interface IParsedTopicFileResult {
  success: boolean;
  message: string;
  totalRows: number;
  rows: ITopicOnboardingRow[];
  errors?: string[];
}

/**
 * Parse project topic suggestions Excel file (.xlsx or .xls)
 * Handles Google Forms response sheets with 5 topics per faculty row.
 */
export function parseTopicOnboardingFile(fileBuffer: Buffer): IParsedTopicFileResult {
  const result: IParsedTopicFileResult = {
    success: true,
    message: "",
    totalRows: 0,
    rows: [],
    errors: [],
  };

  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      result.success = false;
      result.message = "The uploaded Excel workbook contains no sheets.";
      return result;
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    if (rawData.length < 2) {
      result.success = false;
      result.message = "The uploaded file does not contain any data rows.";
      return result;
    }

    // Find header row (typically row 0, or within first 5 rows)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rawData.length, 5); r++) {
      const row = rawData[r];
      const joined = row.map((cell) => String(cell || "").toLowerCase()).join(" ");
      if (joined.includes("email") && (joined.includes("name") || joined.includes("title"))) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0; // Default to first row
    }

    const headers = rawData[headerRowIdx].map((h) => String(h || "").trim());

    // Locate column indices
    let nameColIdx = headers.findIndex((h) => /^name$/i.test(h) || (/name/i.test(h) && !/project/i.test(h)));
    let emailColIdx = headers.findIndex((h) => /email/i.test(h));
    let timestampColIdx = headers.findIndex((h) => /timestamp/i.test(h));

    if (nameColIdx === -1) nameColIdx = 1;
    if (emailColIdx === -1) emailColIdx = 2;
    if (timestampColIdx === -1) timestampColIdx = 0;

    // Scan data rows starting after header
    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const facultyName = String(row[nameColIdx] || "").trim();
      const rawEmail = String(row[emailColIdx] || "").trim().toLowerCase();
      const timestamp = timestampColIdx >= 0 ? String(row[timestampColIdx] || "").trim() : undefined;

      // Skip completely empty rows
      if (!facultyName && !rawEmail) continue;

      const topics: ITopicOnboardingItem[] = [];

      // Extract up to 5 topics
      for (let t = 0; t < 5; t++) {
        const baseIdx = 3 + t * 4;
        const rawTitle = row[baseIdx] !== undefined ? String(row[baseIdx]).trim() : "";
        const rawType = row[baseIdx + 1] !== undefined ? String(row[baseIdx + 1]).trim() : "";
        const rawTech = row[baseIdx + 2] !== undefined ? String(row[baseIdx + 2]).trim() : "";
        const rawDesc = row[baseIdx + 3] !== undefined ? String(row[baseIdx + 3]).trim() : "";

        // If title exists, sanitize and record topic
        if (rawTitle) {
          topics.push({
            slot: t + 1,
            title: rawTitle,
            projectType: rawType || "Web Application",
            technology: rawTech || "General / Web Development",
            description: rawDesc || `Proposed academic project: ${rawTitle}`,
          });
        }
      }

      result.rows.push({
        rowNumber: r + 1,
        facultyName,
        facultyEmail: rawEmail,
        timestamp,
        topics,
      });
    }

    result.totalRows = result.rows.length;
    result.message = `Successfully parsed ${result.rows.length} faculty submission rows.`;
    return result;
  } catch (error: any) {
    result.success = false;
    result.message = `Failed to parse Excel file: ${error.message}`;
    result.errors?.push(error.message);
    return result;
  }
}

/**
 * Generate official sample Excel template matching Google Forms response format
 * with 5 project topic slots.
 */
export async function generateTopicDemoFormatExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Integral Project Hub (APMS)";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Form Responses 1", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 1 }],
  });

  // Define exact columns matching the Google Forms response sheet
  worksheet.columns = [
    { header: "Timestamp", key: "timestamp", width: 22 },
    { header: "Name", key: "name", width: 26 },
    { header: "Email", key: "email", width: 28 },

    { header: "BCA Project-1 Title", key: "t1_title", width: 35 },
    { header: "Project Type ", key: "t1_type", width: 22 },
    { header: "Your preferred technology stack or platform for developing the project? (Specify if applicable)", key: "t1_tech", width: 40 },
    { header: "Provide a detailed description of your proposed project, covering the following aspects: Project Overview, Application, Work Flow and Final Outcome (upto 500 words)", key: "t1_desc", width: 45 },

    { header: "BCA Project-2 Title", key: "t2_title", width: 35 },
    { header: "Project Type  2", key: "t2_type", width: 22 },
    { header: "Your preferred technology stack or platform for developing the project? (Specify if applicable) 2", key: "t2_tech", width: 40 },
    { header: "Provide a detailed description of your proposed project, covering the following aspects: Project Overview, Application, Work Flow and Final Outcome  (upto 500 words).", key: "t2_desc", width: 45 },

    { header: "BCA Project-3 Title", key: "t3_title", width: 35 },
    { header: "Project Type  3", key: "t3_type", width: 22 },
    { header: "Your preferred technology stack or platform for developing the project? (Specify if applicable) 3", key: "t3_tech", width: 40 },
    { header: "Provide a detailed description of your proposed project, covering the following aspects: Project Overview, Application, Work Flow and Final Outcome (upto 500 words) 2", key: "t3_desc", width: 45 },

    { header: "BCA Project-4 Title", key: "t4_title", width: 35 },
    { header: "Project Type  4", key: "t4_type", width: 22 },
    { header: "Your preferred technology stack or platform for developing the project? (Specify if applicable) 4", key: "t4_tech", width: 40 },
    { header: "Provide a detailed description of your proposed project, covering the following aspects: Project Overview, Application, Work Flow and Final Outcome  (upto 500 words). 2", key: "t4_desc", width: 45 },

    { header: "BCA Project-5 Title", key: "t5_title", width: 35 },
    { header: "Project Type  5", key: "t5_type", width: 22 },
    { header: "Your preferred technology stack or platform for developing the project? (Specify if applicable) 5", key: "t5_tech", width: 40 },
    { header: "Provide a detailed description of your proposed project, covering the following aspects: Project Overview, Application, Work Flow and Final Outcome  (upto 500 words). 3", key: "t5_desc", width: 45 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 36;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Deep Navy
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F172A" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Sample faculty row
  const sampleRow = worksheet.addRow({
    timestamp: "2026-09-15 10:30:00",
    name: "Dr. Syed Adnan Afaq",
    email: "saafaq@iul.ac.in",

    t1_title: "Requirement Change Impact Prediction System",
    t1_type: "Web Application",
    t1_tech: "Python, Flask, React, PostgreSQL, NLP",
    t1_desc: "A machine learning based web application that predicts the ripple effects and costs of requirement modifications during software development lifecycle.",

    t2_title: "Intelligent Code Review & Vulnerability Scanner",
    t2_type: "Web Application",
    t2_tech: "Node.js, TypeScript, AST Parser, Docker",
    t2_desc: "Automated static code review platform analyzing pull requests for security vulnerabilities, memory leaks, and style infractions.",

    t3_title: "Smart Campus Transit & Shuttle Tracker",
    t3_type: "Mobile / Web Application",
    t3_tech: "React Native, Leaflet.js, WebSockets, Express",
    t3_desc: "Real-time GPS tracking system for university shuttle buses providing live estimated arrival times and campus route navigation.",

    t4_title: "Automated Thesis Plagiarism & Citation Verifier",
    t4_type: "Stand-Alone Application",
    t4_tech: "Python, FastAPI, Scikit-learn, SQLite",
    t4_desc: "Academic document analysis engine verifying references and citations against public scholarly repositories and detecting text overlap.",

    t5_title: "AI-Powered Adaptive Examination Portal",
    t5_type: "Web Application",
    t5_tech: "Next.js, Tailwind CSS, PostgreSQL, Python AI",
    t5_desc: "Online examination system that dynamically adjusts question difficulty based on student answer patterns while detecting suspicious tab switches.",
  });

  sampleRow.height = 28;
  sampleRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 10 };
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
