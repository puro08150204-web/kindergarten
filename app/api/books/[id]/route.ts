import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { badRequest, serverError } from "@/lib/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    if (!payload.book_code?.trim() || !payload.title?.trim()) {
      return badRequest("索書編號與書名為必填。");
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("books")
      .update({
        status: payload.status || "在架上",
        book_code: payload.book_code.trim(),
        stage: payload.stage || null,
        title: payload.title.trim(),
        publisher: payload.publisher || null,
        published_date: payload.published_date || null,
        author: payload.author || null,
        translator: payload.translator || null,
        keywords: payload.keywords || null
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ book: data });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getAdminSupabase();
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
