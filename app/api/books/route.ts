import { NextRequest, NextResponse } from "next/server";
import { demoBooks } from "@/lib/demo-data";
import { getAdminSupabase } from "@/lib/supabase";
import { badRequest, isMissingSupabaseConfig, serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const bookCode = searchParams.get("bookCode")?.trim();
    const status = searchParams.get("status")?.trim();
    const stage = searchParams.get("stage")?.trim();

    let query = supabase
      .from("books")
      .select("*")
      .order("book_code", { ascending: true });

    if (bookCode) query = query.eq("book_code", bookCode);
    if (status) query = query.eq("status", status);
    if (stage) query = query.eq("stage", stage);
    if (q) {
      query = query.or(`title.ilike.%${q}%,book_code.ilike.%${q}%,stage.ilike.%${q}%,keywords.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ books: data ?? [] });
  } catch (error) {
    if (isMissingSupabaseConfig(error)) {
      const { searchParams } = new URL(request.url);
      const q = searchParams.get("q")?.trim().toLowerCase();
      const bookCode = searchParams.get("bookCode")?.trim();
      const status = searchParams.get("status")?.trim();
      const stage = searchParams.get("stage")?.trim();
      const books = demoBooks.filter((book) => {
        const matchesBookCode = bookCode ? book.book_code === bookCode : true;
        const matchesStatus = status ? book.status === status : true;
        const matchesStage = stage ? book.stage === stage : true;
        const searchText = `${book.title} ${book.book_code} ${book.stage ?? ""} ${book.keywords ?? ""}`.toLowerCase();
        const matchesQuery = q ? searchText.includes(q) : true;
        return matchesBookCode && matchesStatus && matchesStage && matchesQuery;
      });
      return NextResponse.json({ books, setupRequired: true });
    }
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    if (!payload.book_code?.trim() || !payload.title?.trim()) {
      return badRequest("索書編號與書名為必填。");
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("books")
      .insert({
        status: payload.status || "在架上",
        book_code: payload.book_code.trim(),
        stage: payload.stage || null,
        title: payload.title.trim(),
        cover_image_url: payload.cover_image_url || null,
        publisher: payload.publisher || null,
        published_date: payload.published_date || null,
        author: payload.author || null,
        translator: payload.translator || null,
        keywords: payload.keywords || null
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ book: data });
  } catch (error) {
    return serverError(error);
  }
}
