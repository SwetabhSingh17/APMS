import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { ISupervisorOnboardingRow } from "@shared/schema";

/**
 * Interface for dynamically detected supervisor column indices
 */
interface ISupervisorColumnMap {
  sNo: number;
  empId: number;
  name: number;
  designation: number;
  mobile: number;
  email: number;
}

/**
 * Helper to normalize column header text for flexible matching
 */
function normalizeHeader(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Parses an uploaded supervisor onboarding file (.xls or .xlsx)
 * Extracts employee ID, full name with prefix separation, designation, mobile, and official email.
 */
export async function parseSupervisorOnboardingFile(fileBuffer: Buffer): Promise<{
  supervisors: ISupervisorOnboardingRow[];
  department: string;
}> {
  // Read workbook using SheetJS (supports both binary BIFF8 .xls and XML .xlsx)
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("The uploaded Excel workbook contains no readable sheets.");
  }

  const supervisors: ISupervisorOnboardingRow[] = [];
  let detectedDepartment = "Department of Computer Application";

  // Scan sheets to find supervisor table
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
    if (!rows || rows.length === 0) continue;

    let headerRowIndex = -1;
    const colMap: ISupervisorColumnMap = {
      sNo: -1,
      empId: -1,
      name: -1,
      designation: -1,
      mobile: -1,
      email: -1,
    };

    // Scan the first 15 rows to find the table header and check for department banner
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      // Check for department banner
      for (const cell of row) {
        const text = String(cell || "").trim();
        if (/department of/i.test(text)) {
          detectedDepartment = text;
        }
      }

      // Check for columns
      for (let c = 0; c < row.length; c++) {
        const norm = normalizeHeader(String(row[c] || ""));
        if (norm.includes("empid") || norm.includes("employeeid")) colMap.empId = c;
        if (norm.includes("employeename") || norm.includes("staffname") || norm.includes("facultyname") || norm === "name") colMap.name = c;
        if (norm.includes("designation") || norm.includes("post") || norm.includes("role")) colMap.designation = c;
        if (norm.includes("mobile") || norm.includes("phone") || norm.includes("contact")) colMap.mobile = c;
        if (norm.includes("email") || norm.includes("officialemail")) colMap.email = c;
        if (norm.includes("sno") || norm.includes("slno") || norm.includes("serial")) colMap.sNo = c;
      }

      // Valid header requires at least Emp ID and Name
      if (colMap.empId !== -1 && colMap.name !== -1) {
        headerRowIndex = r;
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Not a supervisor sheet or unrecognized header in this sheet, continue to next
      continue;
    }

    // Process data rows
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      const rawEmpId = colMap.empId !== -1 ? String(row[colMap.empId] || "").trim() : "";
      const rawName = colMap.name !== -1 ? String(row[colMap.name] || "").trim() : "";
      if (!rawEmpId || !rawName) continue;

      const rawDesignation = colMap.designation !== -1 ? String(row[colMap.designation] || "").trim() : "";
      const rawMobile = colMap.mobile !== -1 && row[colMap.mobile] !== undefined ? String(row[colMap.mobile]).trim() : "";
      const rawEmail = colMap.email !== -1 && row[colMap.email] !== undefined ? String(row[colMap.email]).trim() : "";
      const sNo = colMap.sNo !== -1 && row[colMap.sNo] !== undefined ? row[colMap.sNo] : undefined;

      // Extract primary email if multi-valued (e.g., 'mdfaisal@iul.ac.in/headca@iul.ac.in ')
      let email = rawEmail.split(/[\/,;]/)[0].trim();
      if (!email || !email.includes("@")) {
        email = `${rawEmpId.toLowerCase()}@iul.ac.in`;
      }

      // Extract prefix if present (e.g. Dr., Mr., Mrs., Ms., Prof.)
      let prefix = "";
      let cleanFullName = rawName;
      const prefixMatch = rawName.match(/^(Dr\.|Dr|Prof\.|Prof|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms)\s+(.*)$/i);
      if (prefixMatch) {
        prefix = prefixMatch[1].endsWith(".") ? prefixMatch[1] : prefixMatch[1] + ".";
        cleanFullName = prefixMatch[2].trim();
      }

      // Separate first name and last name
      const nameParts = cleanFullName.split(/\s+/);
      const firstName = nameParts[0] || cleanFullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      supervisors.push({
        sNo,
        empId: rawEmpId,
        name: rawName,
        prefix: prefix || undefined,
        firstName,
        lastName,
        designation: rawDesignation || "Supervisor",
        mobile: rawMobile || undefined,
        email,
        department: detectedDepartment,
      });
    }
  }

  if (supervisors.length === 0) {
    throw new Error(
      "No valid supervisor records found. Ensure the Excel sheet contains header columns: 'Emp. ID.', 'Employee Name', 'Designation', 'Mobile', 'Official Email'."
    );
  }

  return {
    supervisors,
    department: detectedDepartment,
  };
}

/**
 * Generates an official Demo Format Excel file matching the exact structure
 * of "Updated Staff List with all details.xls"
 */
export async function generateSupervisorDemoFormatExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Academic Project Management System (APMS)";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Supervisor Staff List", {
    views: [{ showGridLines: true }],
  });

  // Department Title Banner (Rows 1 - 3)
  worksheet.mergeCells("A2:F2");
  const titleCell = worksheet.getCell("A2");
  titleCell.value = "Integral University, Lucknow";
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1E3A8A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells("A3:F3");
  const subTitleCell = worksheet.getCell("A3");
  subTitleCell.value = "Department of Computer Application — Faculty & Supervisor Directory";
  subTitleCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };
  subTitleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Empty row for spacing
  worksheet.addRow([]);

  // Column Headers (Row 5)
  const headerRow = worksheet.addRow([
    "S.No.",
    "Emp. ID.",
    "Employee Name",
    "Designation",
    "Mobile",
    "Official Email",
  ]);

  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Navy / Slate-800
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Sample supervisor records matching Integral University faculty patterns
  const sampleData = [
    [1, "F00157", "Dr. Mohammad Faisal", "Professor & Head", "9984171083", "mdfaisal@iul.ac.in"],
    [2, "F00039", "Dr. Mohammad Kalamuddin Ahamad", "Associate Professor", "9569829507", "mohdkalam@iul.ac.in"],
    [3, "F00124", "Dr. Md. Faizan Farooqui", "Associate Professor", "7080908908", "ffarooqui@iul.ac.in"],
    [4, "F00755", "Mr. Faizan Mahmood", "Assistant Professor", "8756621255", "fmahmood@iul.ac.in"],
    [5, "F00806", "Mrs. Fareen", "Assistant Professor", "8299863071", "fareen@iul.ac.in"],
    [6, "F01344", "Ms. Fiza Afreen", "Assistant Professor", "9565538561", "fafreen@iul.ac.in"],
  ];

  sampleData.forEach((row, index) => {
    const dataRow = worksheet.addRow(row);
    dataRow.height = 22;
    const isEven = index % 2 === 1;

    dataRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" },
      };
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      // Alignment per column type
      if (colNumber === 1 || colNumber === 2) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNumber === 5) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  // Set explicit column widths for clarity
  worksheet.columns = [
    { width: 10 }, // S.No.
    { width: 16 }, // Emp. ID.
    { width: 34 }, // Employee Name
    { width: 28 }, // Designation
    { width: 18 }, // Mobile
    { width: 34 }, // Official Email
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
