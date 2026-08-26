import { NextRequest, NextResponse } from "next/server";
import { badRequest, isMissingSupabaseConfig, serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";

const defaultCategories = ["幼兒階段", "國小階段", "國高中階段"];

function uniqueCategories(categories: Array<string | null | undefined>) {
  return Array.from(new Set(categories.map((category) => category?.trim()).filter(Boolean) as string[]));
}

export async function GET() {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("book_categories")
      .select("name")
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      categories: uniqueCategories((data ?? []).map((category) => category.name))
    });
  } catch (error) {
    if (isMissingSupabaseConfig(error) || (error instanceof Error && error.message.includes("book_categories"))) {
      return NextResponse.json({ categories: defaultCategories });
    }
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const name = payload.name?.trim();
    if (!name) return badRequest("請輸入分類名稱。");

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("book_categories")
      .upsert({ name }, { onConflict: "name" })
      .select("name")
      .single();

    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await request.json();
    const name = payload.name?.trim();
    if (!name) return badRequest("請指定要刪除的分類。");

    const supabase = getAdminSupabase();
    const { count, error: booksError } = await supabase
      .from("books")
      .select("id", { count: "exact", head: true })
      .eq("stage", name);

    if (booksError) throw booksError;
    if ((count ?? 0) > 0) {
      return badRequest(`無法刪除「${name}」：目前有 ${count} 本書使用此分類。請先將這些書改為其他分類或未分類。`, 409);
    }

    const { data, error } = await supabase
      .from("book_categories")
      .delete()
      .eq("name", name)
      .select("name")
      .maybeSingle();

    if (error) throw error;
    if (!data) return badRequest("找不到這個分類，可能已被刪除。", 404);

    return NextResponse.json({ ok: true, category: data });
  } catch (error) {
    return serverError(error);
  }
}
