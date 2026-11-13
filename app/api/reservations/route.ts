import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const bookId = payload.book_id?.trim();
    const email = payload.email?.trim().toLowerCase();

    if (!bookId || !email || !emailPattern.test(email)) {
      return badRequest("請輸入有效的 Email。");
    }

    const supabase = getAdminSupabase();
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id,status,title")
      .eq("id", bookId)
      .single();

    if (bookError) throw bookError;
    if (book.status !== "已借出") {
      return badRequest("這本書目前可直接借閱，不需要預約。", 409);
    }

    const { error } = await supabase.from("book_reservations").insert({
      book_id: bookId,
      email,
      status: "waiting"
    });

    if (error?.code === "23505") {
      return badRequest("這個 Email 已預約此書。", 409);
    }
    if (error) throw error;

    return NextResponse.json({ ok: true, message: `已預約「${book.title}」。` });
  } catch (error) {
    return serverError(error);
  }
}
