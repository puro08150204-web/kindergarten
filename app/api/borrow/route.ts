import { NextRequest, NextResponse } from "next/server";
import { dueDateFromNow } from "@/lib/dates";
import { badRequest, serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const borrowerLastName = payload.borrower_last_name?.trim();
    const borrowerLineId = payload.borrower_line_id?.trim();
    const childClass = payload.child_class?.trim();
    const bookIds = Array.isArray(payload.book_ids) ? payload.book_ids.filter(Boolean) : [];

    if (!borrowerLastName || !borrowerLineId || !childClass) {
      return badRequest("請填寫姓氏、Line ID 與最大小孩班級。");
    }
    if (bookIds.length === 0 || bookIds.length > 3) {
      return badRequest("一次需選擇 1 到 3 本書。");
    }

    const supabase = getAdminSupabase();

    const { data: activeLoans, error: activeError } = await supabase
      .from("loans")
      .select("id, borrowers!inner(borrower_line_id)")
      .is("returned_at", null)
      .eq("borrowers.borrower_line_id", borrowerLineId);

    if (activeError) throw activeError;
    if ((activeLoans?.length ?? 0) + bookIds.length > 3) {
      return badRequest("同一個 Line ID 目前未歸還的書最多 3 本。");
    }

    const { data: books, error: booksError } = await supabase
      .from("books")
      .select("id,status,title")
      .in("id", bookIds);

    if (booksError) throw booksError;
    if ((books?.length ?? 0) !== bookIds.length) return badRequest("有書籍不存在。");
    const unavailable = books?.find((book) => book.status !== "在架上");
    if (unavailable) return badRequest(`「${unavailable.title}」目前不是在架上，無法借出。`);

    const { data: borrower, error: borrowerError } = await supabase
      .from("borrowers")
      .upsert(
        {
          borrower_last_name: borrowerLastName,
          borrower_line_id: borrowerLineId,
          child_class: childClass
        },
        { onConflict: "borrower_line_id" }
      )
      .select()
      .single();

    if (borrowerError) throw borrowerError;

    const borrowedAt = new Date().toISOString();
    const dueAt = dueDateFromNow();
    const { data: loans, error: loanError } = await supabase
      .from("loans")
      .insert(
        bookIds.map((bookId: string) => ({
          book_id: bookId,
          borrower_id: borrower.id,
          borrowed_at: borrowedAt,
          due_at: dueAt
        }))
      )
      .select("*, books(*)");

    if (loanError) throw loanError;

    const { error: updateError } = await supabase
      .from("books")
      .update({ status: "已借出" })
      .in("id", bookIds);

    if (updateError) throw updateError;
    return NextResponse.json({ loans });
  } catch (error) {
    return serverError(error);
  }
}
