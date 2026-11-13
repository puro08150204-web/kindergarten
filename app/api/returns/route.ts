import { NextRequest, NextResponse } from "next/server";
import { isOverdue } from "@/lib/dates";
import { badRequest, serverError } from "@/lib/errors";
import { getAdminSupabase } from "@/lib/supabase";
import { sendAvailabilityEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const borrowerName = searchParams.get("name")?.trim();
    const lineId = searchParams.get("lineId")?.trim();
    if (!borrowerName && !lineId) return badRequest("請輸入借閱人姓名。");

    const supabase = getAdminSupabase();
    let query = supabase
      .from("loans")
      .select("*, books(*), borrowers!inner(*)")
      .is("returned_at", null)
      .order("borrowed_at", { ascending: false });

    if (borrowerName) {
      query = query.ilike("borrowers.borrower_last_name", `%${borrowerName}%`);
    }

    if (lineId) {
      query = query.eq("borrowers.borrower_line_id", lineId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const loans = (data ?? []).map((loan) => ({
      ...loan,
      loan_status: isOverdue(loan.due_at, loan.returned_at) ? "逾期" : "借閱中"
    }));

    return NextResponse.json({ loans });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const loanIds = Array.isArray(payload.loan_ids) ? payload.loan_ids.filter(Boolean) : [];
    if (loanIds.length === 0) return badRequest("請選擇要歸還的書。");

    const supabase = getAdminSupabase();
    const { data: loans, error: findError } = await supabase
      .from("loans")
      .select("id,book_id,books(title)")
      .in("id", loanIds)
      .is("returned_at", null);

    if (findError) throw findError;
    const bookIds = (loans ?? []).map((loan) => loan.book_id);

    const { error: loanError } = await supabase
      .from("loans")
      .update({ returned_at: new Date().toISOString() })
      .in("id", loanIds)
      .is("returned_at", null);

    if (loanError) throw loanError;

    if (bookIds.length > 0) {
      const { error: bookError } = await supabase
        .from("books")
        .update({ status: "在架上" })
        .in("id", bookIds);
      if (bookError) throw bookError;
    }

    let notified = 0;
    const notificationErrors: string[] = [];

    for (const loan of loans ?? []) {
      const { data: reservation, error: reservationError } = await supabase
        .from("book_reservations")
        .select("id,email")
        .eq("book_id", loan.book_id)
        .eq("status", "waiting")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (reservationError) {
        notificationErrors.push(reservationError.message);
        continue;
      }
      if (!reservation) continue;

      const bookRelation = loan.books as { title?: string } | Array<{ title?: string }> | null;
      const bookTitle = Array.isArray(bookRelation) ? bookRelation[0]?.title : bookRelation?.title;
      const result = await sendAvailabilityEmail({
        to: reservation.email,
        bookTitle: bookTitle ?? "預約書籍"
      });

      if (!result.sent) {
        notificationErrors.push(result.error ?? "寄信失敗。");
        continue;
      }

      const { error: updateReservationError } = await supabase
        .from("book_reservations")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", reservation.id);

      if (updateReservationError) {
        notificationErrors.push(updateReservationError.message);
      } else {
        notified += 1;
      }
    }

    return NextResponse.json({ ok: true, notified, notification_errors: notificationErrors });
  } catch (error) {
    return serverError(error);
  }
}
