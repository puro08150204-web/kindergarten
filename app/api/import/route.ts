import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { badRequest, serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";

type RawBookRow = {
  status?: string;
  book_code?: string;
  stage?: string;
  階段?: string;
  分類?: string;
  適讀階段?: string;
  幼兒階段?: string;
  國小階段?: string;
  國高中階段?: string;
  title?: string;
  publisher?: string;
  published_date?: string | number | Date;
  author?: string;
  translator?: string;
  keywords?: string;
  [key: string]: string | number | Date | undefined;
};

const stageColumns = ["幼兒階段", "國小階段", "國高中階段"];

function normalizeExcelDate(value: RawBookRow["published_date"]) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${month}-${day}`;
  }
  const text = String(value).trim();
  if (text.includes("--") || text.includes("??")) return null;
  const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return text || null;
}

function hasStageMark(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  return Boolean(text) && !["0", "false", "否", "無", "no", "n"].includes(text);
}

function normalizeStage(row: RawBookRow) {
  const directStage = String(row.stage || row["階段"] || row["分類"] || row["適讀階段"] || "").trim();
  if (directStage) return directStage;

  const markedStage = stageColumns.find((stage) => hasStageMark(row[stage]));
  return markedStage || null;
}

function normalizeStageLabel(value: unknown) {
  const text = String(value || "").trim();
  if (text.includes("幼兒") || text.includes("幼兒園")) return "幼兒階段";
  if (text.includes("小學") || text.includes("國小")) return "國小階段";
  if (text.includes("國高中") || text.includes("國中") || text.includes("高中")) return "國高中階段";
  return text || null;
}

function parseSectionedRows(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
    header: 1,
    defval: ""
  });
  let currentStage: string | null = null;
  const books = [];

  for (const row of rows) {
    const nonEmpty = row.filter((cell) => String(cell ?? "").trim());
    if (nonEmpty.length === 0) continue;

    if (nonEmpty.length === 1) {
      currentStage = normalizeStageLabel(nonEmpty[0]);
      continue;
    }

    const status = String(row[0] || "").trim();
    const bookCode = String(row[1] || "").trim();
    const title = String(row[2] || "").trim();

    if (!bookCode || !title || status === "書況") continue;

    books.push({
      status: status || "在架上",
      book_code: bookCode,
      stage: currentStage,
      title,
      publisher: String(row[3] || "").trim() || null,
      published_date: normalizeExcelDate(row[4]),
      author: String(row[6] || "").trim() || null,
      translator: String(row[7] || "").trim() || null,
      keywords: String(row[8] || "").trim() || null
    });
  }

  return books;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return badRequest("請選擇 Excel 檔案。");

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<RawBookRow>(sheet, { defval: "" });

    let books = rows
      .map((row) => ({
        status: String(row.status || "在架上").trim(),
        book_code: String(row.book_code || "").trim(),
        stage: normalizeStage(row),
        title: String(row.title || "").trim(),
        publisher: String(row.publisher || "").trim() || null,
        published_date: normalizeExcelDate(row.published_date),
        author: String(row.author || "").trim() || null,
        translator: String(row.translator || "").trim() || null,
        keywords: String(row.keywords || "").trim() || null
      }))
      .filter((book) => book.book_code && book.title);

    if (books.length === 0) {
      books = parseSectionedRows(sheet);
    }

    if (books.length === 0) return badRequest("Excel 沒有可匯入的資料，請確認欄位名稱。");

    const supabase = getAdminSupabase();
    const bookCodes = books.map((book) => book.book_code);
    const { data: existingBooks, error: existingError } = await supabase
      .from("books")
      .select("book_code")
      .in("book_code", bookCodes);

    if (existingError) throw existingError;
    const existingCodes = new Set((existingBooks ?? []).map((book) => book.book_code));
    const updated = books.filter((book) => existingCodes.has(book.book_code)).length;
    const created = books.length - updated;

    const { data, error } = await supabase
      .from("books")
      .upsert(books, { onConflict: "book_code" })
      .select("id");

    if (error) throw error;
    return NextResponse.json({ imported: data?.length ?? 0, created, updated });
  } catch (error) {
    return serverError(error);
  }
}
