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
  return String(value).trim() || null;
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return badRequest("請選擇 Excel 檔案。");

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<RawBookRow>(sheet, { defval: "" });

    const books = rows
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

    if (books.length === 0) return badRequest("Excel 沒有可匯入的資料，請確認欄位名稱。");

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("books")
      .upsert(books, { onConflict: "book_code" })
      .select("id");

    if (error) throw error;
    return NextResponse.json({ imported: data?.length ?? 0 });
  } catch (error) {
    return serverError(error);
  }
}
