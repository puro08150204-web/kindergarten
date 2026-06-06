import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  if (!fs.existsSync(".env.local")) return;
  const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...valueParts] = line.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

function secureImageUrl(url) {
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://");
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))];
}

function buildQueries(book) {
  const title = book.title;
  const mainTitle = title.split(/[：:]/)[0]?.trim();
  const compactTitle = title.replace(/[：:]/g, " ").replace(/\s+/g, " ").trim();

  return uniqueValues([
    title,
    compactTitle,
    mainTitle,
    book.author ? `${title} ${book.author}` : undefined,
    book.author && mainTitle ? `${mainTitle} ${book.author}` : undefined,
    book.publisher ? `${title} ${book.publisher}` : undefined,
    `intitle:${title}`,
    mainTitle ? `intitle:${mainTitle}` : undefined
  ]);
}

async function findCover(book) {
  for (const query of buildQueries(book)) {
    const params = new URLSearchParams({
      q: query,
      printType: "books",
      maxResults: "10",
      projection: "lite"
    });

    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) continue;

    const data = await response.json();
    const cover = (data.items ?? [])
      .map((item) => secureImageUrl(item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail))
      .find(Boolean);

    if (cover) return cover;
  }

  const params = new URLSearchParams({
    title: book.title,
    limit: "10"
  });
  if (book.author) params.set("author", book.author);

  const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
    headers: { Accept: "application/json" }
  });
  if (response.ok) {
    const data = await response.json();
    const coverId = (data.docs ?? []).find((item) => item.cover_i)?.cover_i;
    if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  }

  return null;
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const { data: books, error } = await supabase
  .from("books")
  .select("id,book_code,title,author,publisher,cover_image_url")
  .or("cover_image_url.is.null,cover_image_url.eq.")
  .order("book_code", { ascending: true });

if (error) throw error;

let updated = 0;
let skipped = 0;

for (const book of books ?? []) {
  const cover = await findCover(book);
  if (!cover) {
    skipped += 1;
    console.log(`未找到：${book.book_code} ${book.title}`);
    continue;
  }

  const { error: updateError } = await supabase
    .from("books")
    .update({ cover_image_url: cover })
    .eq("id", book.id);

  if (updateError) {
    skipped += 1;
    console.log(`更新失敗：${book.book_code} ${book.title} - ${updateError.message}`);
    continue;
  }

  updated += 1;
  console.log(`已更新：${book.book_code} ${book.title}`);
}

console.log(`完成：更新 ${updated} 本，未找到或失敗 ${skipped} 本。`);
