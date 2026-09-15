import ExcelJS from "exceljs";
import { IStudentOnboardingRow } from "@shared/schema";

/**
 * Interface for dynamically detected column positions
 */
interface IColumnIndexMap {
  sNoCol: number;
  teamIdCol: number;
  enrollmentCol: number;
  nameCol: number;
  mobileCol: number;
  emailCol: number;
}

/**
 * Safely extracts text from an ExcelJS cell, handling merged cells (MergeValue) and formulas
 */
function getCellString(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  try {
    const val = cell.value;
    if (val === null || val === undefined) return "";
    if (typeof val === "object") {
      // Handle formulas with precalculated result
      if ("result" in val && val.result !== undefined && val.result !== null) {
        return String(val.result).trim();
      }
      // Handle hyperlinks (e.g. { text: '...', hyperlink: '...' } or { hyperlink: 'mailto:...' })
      if ("hyperlink" in (val as any)) {
        const hVal = val as any;
        if (hVal.text && typeof hVal.text === "string") return hVal.text.trim();
        if (hVal.hyperlink && typeof hVal.hyperlink === "string") {
          return hVal.hyperlink.replace(/^mailto:/i, "").trim();
        }
      }
      // Handle RichText objects
      if ("richText" in val && Array.isArray(val.richText)) {
        return val.richText.map((t) => t.text).join("").trim();
      }
      // Handle objects with direct text property
      if ("text" in val && typeof (val as any).text === "string") {
        return (val as any).text.trim();
      }
      // Fall back safely for unrecognized objects instead of "[object Object]"
      return "";
    }
    return String(val).trim();
  } catch {
    return "";
  }
}

/**
 * Normalizes header strings for case-insensitive and symbol-agnostic matching
 */
function normalizeHeaderText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Parses a multi-sheet Excel file extracting student details and project teams.
 * Uses ExcelJS for robust handling of large workbooks and merged cell structures.
 */
export async function parseStudentOnboardingExcel(fileBuffer: Buffer): Promise<{
  students: IStudentOnboardingRow[];
  sheetNames: string[];
}> {
  // Initialize ExcelJS workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const students: IStudentOnboardingRow[] = [];
  const processedSheetNames: string[] = [];

  // Iterate over each worksheet in the workbook
  // Allows unified parsing of multiple sections like Group-A, Group-B, etc.
  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;
    let headerRowNumber = -1;
    let columnMap: IColumnIndexMap = {
      sNoCol: -1,
      teamIdCol: -1,
      enrollmentCol: -1,
      nameCol: -1,
      mobileCol: -1,
      emailCol: -1,
    };

    // Scan first 10 rows to dynamically detect the table header row
    // Accommodates titles, banners, or empty rows at the top of worksheets
    for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      let foundEnrollment = false;
      let foundName = false;

      row.eachCell((cell, colNumber) => {
        const cellValue = normalizeHeaderText(getCellString(cell));

        // Flexible detection of enrollment number column
        if (cellValue.includes("enrollment") || cellValue.includes("rollno") || cellValue === "matricula") {
          foundEnrollment = true;
          columnMap.enrollmentCol = colNumber;
        }
        // Detection of student name column
        else if (cellValue.includes("studentname") || cellValue === "name" || cellValue.includes("fullname")) {
          foundName = true;
          columnMap.nameCol = colNumber;
        }
        // Detection of project team ID column
        else if (
          cellValue.includes("projectteamid") ||
          cellValue.includes("teamid") ||
          cellValue.includes("groupid") ||
          cellValue === "team"
        ) {
          columnMap.teamIdCol = colNumber;
        }
        // Detection of contact / mobile number column
        else if (cellValue.includes("mobile") || cellValue.includes("phone") || cellValue.includes("contact")) {
          columnMap.mobileCol = colNumber;
        }
        // Detection of email address column
        else if (cellValue.includes("email")) {
          columnMap.emailCol = colNumber;
        }
        // Detection of sequential number column
        else if (cellValue.includes("sno") || cellValue === "srno" || cellValue === "no") {
          columnMap.sNoCol = colNumber;
        }
      });

      // If at least enrollment and name headers were found, this is our header row
      if (foundEnrollment && foundName) {
        headerRowNumber = r;
        break;
      }
    }

    // Skip sheets without required student headers (e.g. summary or instruction sheets)
    if (headerRowNumber === -1 || columnMap.enrollmentCol === -1) {
      return;
    }

    processedSheetNames.push(sheetName);

    // Track current team ID across merged rows
    // In institutional sheets, Team ID is often specified only on the first member's row
    let currentTeamId = "";

    // Iterate through data rows beneath the identified header row
    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);

      // Extract enrollment number and verify it is not empty
      const rawEnrollment = columnMap.enrollmentCol !== -1 ? getCellString(row.getCell(columnMap.enrollmentCol)) : "";
      const cleanEnrollment = String(rawEnrollment || "").trim();

      // Skip rows with missing or header-repeated enrollment numbers
      if (!cleanEnrollment || cleanEnrollment.toLowerCase() === "enrollment number") {
        continue;
      }

      // Carry forward or update current team ID
      if (columnMap.teamIdCol !== -1) {
        const teamCellText = getCellString(row.getCell(columnMap.teamIdCol)).trim();
        if (teamCellText) {
          currentTeamId = teamCellText;
        }
      }

      // Default to worksheet name if no team ID was designated
      const effectiveTeamId = currentTeamId || `${sheetName}-Team`;

      const rawName = columnMap.nameCol !== -1 ? getCellString(row.getCell(columnMap.nameCol)).trim() : "";
      const rawMobile = columnMap.mobileCol !== -1 ? getCellString(row.getCell(columnMap.mobileCol)).trim() : "";
      const rawEmail = columnMap.emailCol !== -1 ? getCellString(row.getCell(columnMap.emailCol)).trim() : "";
      const rawSNo = columnMap.sNoCol !== -1 ? getCellString(row.getCell(columnMap.sNoCol)).trim() : "";

      students.push({
        sNo: rawSNo,
        projectTeamId: effectiveTeamId,
        enrollmentNumber: cleanEnrollment,
        studentName: rawName || `Student ${cleanEnrollment}`,
        mobileNo: rawMobile,
        emailId: rawEmail,
        sheetName,
      });
    }
  });

  return {
    students,
    sheetNames: processedSheetNames,
  };
}

/**
 * Generates an official demo Excel template file using ExcelJS.
 * Features styled headers, multi-sheet examples, and clear column guidelines.
 */
export async function generateDemoFormatExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Academic Project Management System (APMS)";
  workbook.created = new Date();

  // Sheet 1: Instructions for coordinators and administrators
  const instructionsSheet = workbook.addWorksheet("Instructions");
  instructionsSheet.columns = [
    { header: "Parameter", key: "param", width: 28 },
    { header: "System Specification & Guidelines", key: "desc", width: 65 },
  ];

  instructionsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  instructionsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" }, // Dark institutional blue
  };

  instructionsSheet.addRows([
    { param: "Multi-Sheet Support", desc: "Workbooks can contain multiple section sheets (e.g. Group-A, Group-B, Group-C). All sheets will be parsed." },
    { param: "Project TeamID", desc: "Project TeamID (e.g. A-01) groups students into project teams. Can be placed on the first row or repeated for every member." },
    { param: "Enrollment Number", desc: "Mandatory and unique. Used as the default username and initial login password." },
    { param: "Security & First Login", desc: "Upon initial login, students will be intercepted with a mandatory password reset dialog." },
    { param: "BCA / MCA Isolation", desc: "Upload modal enforces selecting BCA (teams of 2-5) or MCA (teams of 1-2) to guarantee strict data isolation." },
    { param: "Institutional Email", desc: "Optional in file; if omitted, automatically defaults to: <enrollment>@student.iul.ac.in." },
  ]);

  // Sheet 2: Example section Group-A
  const groupASheet = workbook.addWorksheet("Group-A");
  groupASheet.columns = [
    { header: "SNo.", key: "sNo", width: 10 },
    { header: "Project TeamID", key: "teamId", width: 20 },
    { header: "Enrollment Number", key: "enrollment", width: 24 },
    { header: "Student Name", key: "name", width: 32 },
    { header: "Mobile No.", key: "mobile", width: 18 },
    { header: "Email Id", key: "email", width: 35 },
  ];

  // Modern styling for Group-A headers
  const headerRowA = groupASheet.getRow(1);
  headerRowA.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRowA.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0284C7" }, // Vibrant sky blue
  };
  headerRowA.alignment = { vertical: "middle", horizontal: "center" };

  // Sample rows for Team A-01 (3 members)
  groupASheet.addRow({ sNo: 1, teamId: "A-01", enrollment: "2400101001", name: "Aarav Sharma", mobile: "9876543210", email: "aaravs@student.iul.ac.in" });
  groupASheet.addRow({ sNo: 2, teamId: "", enrollment: "2400101002", name: "Ananya Patel", mobile: "9876543211", email: "ananyap@student.iul.ac.in" });
  groupASheet.addRow({ sNo: 3, teamId: "", enrollment: "2400101003", name: "Mohammad Farooq", mobile: "9876543212", email: "mfarooq@student.iul.ac.in" });

  // Sample rows for Team A-02 (2 members)
  groupASheet.addRow({ sNo: 1, teamId: "A-02", enrollment: "2400101004", name: "Priya Singh", mobile: "9876543213", email: "priyas@student.iul.ac.in" });
  groupASheet.addRow({ sNo: 2, teamId: "", enrollment: "2400101005", name: "Rohan Verma", mobile: "9876543214", email: "rohanv@student.iul.ac.in" });

  // Sheet 3: Example section Group-B
  const groupBSheet = workbook.addWorksheet("Group-B");
  groupBSheet.columns = [
    { header: "SNo.", key: "sNo", width: 10 },
    { header: "Project TeamID", key: "teamId", width: 20 },
    { header: "Enrollment Number", key: "enrollment", width: 24 },
    { header: "Student Name", key: "name", width: 32 },
    { header: "Mobile No.", key: "mobile", width: 18 },
    { header: "Email Id", key: "email", width: 35 },
  ];

  const headerRowB = groupBSheet.getRow(1);
  headerRowB.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRowB.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0284C7" },
  };
  headerRowB.alignment = { vertical: "middle", horizontal: "center" };

  // Sample rows for Team B-01
  groupBSheet.addRow({ sNo: 1, teamId: "B-01", enrollment: "2400102001", name: "Zaid Khan", mobile: "9876543220", email: "zaidk@student.iul.ac.in" });
  groupBSheet.addRow({ sNo: 2, teamId: "", enrollment: "2400102002", name: "Sara Ali", mobile: "9876543221", email: "saraa@student.iul.ac.in" });

  // Generate in-memory binary buffer for HTTP download
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
