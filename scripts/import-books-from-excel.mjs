import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const excelPath = process.argv[2];

if (!excelPath) {
  console.error("Usage: node scripts/import-books-from-excel.mjs /path/to/books.xlsx");
  process.exit(1);
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    process.env[key] = process.env[key] || value;
  }
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return text || null;
}

function normalizeStage(value) {
  const text = String(value || "").trim();
  if (text.includes("幼兒") || text.includes("幼兒園")) return "幼兒階段";
  if (text.includes("小學") || text.includes("國小")) return "國小階段";
  if (text.includes("國高中") || text.includes("高中") || text.includes("國中")) return "國高中階段";
  return text || null;
}

loadEnv(path.resolve(".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const workbook = XLSX.readFile(excelPath, { cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

let currentStage = null;
const books = [];

for (const row of rows) {
  const nonEmpty = row.filter((cell) => String(cell ?? "").trim());
  if (nonEmpty.length === 0) continue;

  if (nonEmpty.length === 1) {
    currentStage = normalizeStage(nonEmpty[0]);
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
    published_date: normalizeDate(row[4]),
    author: String(row[6] || "").trim() || null,
    translator: String(row[7] || "").trim() || null,
    keywords: String(row[8] || "").trim() || null
  });
}

if (books.length === 0) {
  console.error("No importable books found.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const { data, error } = await supabase
  .from("books")
  .upsert(books, { onConflict: "book_code" })
  .select("id");

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Imported ${data?.length ?? 0} books.`);
