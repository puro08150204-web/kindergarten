"use client";

import { BookOpen, Check, ClipboardList, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Field, Notice, inputClass } from "@/components/ui";
import { formatTaiwanDate } from "@/lib/dates";
import type { Book, LoanWithComputedStatus } from "@/lib/types";

type Message = { tone: "good" | "bad"; text: string } | null;
const bookStages = ["幼兒階段", "國小階段", "國高中階段"];

export default function HomePage() {
  const [tab, setTab] = useState<"borrow" | "return" | "publicLoans">("borrow");
  const [books, setBooks] = useState<Book[]>([]);
  const [publicLoans, setPublicLoans] = useState<LoanWithComputedStatus[]>([]);
  const [publicLoanMode, setPublicLoanMode] = useState<"active" | "overdue">("active");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [borrower, setBorrower] = useState({
    borrower_last_name: "",
    borrower_line_id: "",
    child_class: ""
  });
  const [returnLineId, setReturnLineId] = useState("");
  const [returnLoans, setReturnLoans] = useState<LoanWithComputedStatus[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const selectedBooks = useMemo(
    () => books.filter((book) => selectedBookIds.includes(book.id)),
    [books, selectedBookIds]
  );

  async function loadBooks(nextQuery = query) {
    const params = new URLSearchParams({ status: "在架上" });
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (stage) params.set("stage", stage);
    const response = await fetch(`/api/books?${params.toString()}`);
    const data = await response.json();
    setBooks(data.books ?? []);
  }

  async function loadPublicLoans(mode = publicLoanMode) {
    const response = await fetch(`/api/loans?mode=${mode}`);
    const data = await response.json();
    setPublicLoans(data.loans ?? []);
  }

  useEffect(() => {
    loadBooks("");
    loadPublicLoans("active");
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleBook(id: string) {
    setSelectedBookIds((current) => {
      if (current.includes(id)) return current.filter((bookId) => bookId !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  async function submitBorrow() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...borrower, book_ids: selectedBookIds })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSelectedBookIds([]);
      setBorrower({ borrower_last_name: "", borrower_line_id: "", child_class: "" });
      await loadBooks();
      await loadPublicLoans();
      setMessage({ tone: "good", text: "借閱完成，系統已記錄到期日為 30 天後。" });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "借閱失敗。" });
    } finally {
      setLoading(false);
    }
  }

  async function searchReturns() {
    setLoading(true);
    setMessage(null);
    setSelectedLoanIds([]);
    try {
      const response = await fetch(`/api/returns?lineId=${encodeURIComponent(returnLineId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReturnLoans(data.loans ?? []);
      if ((data.loans ?? []).length === 0) {
        setMessage({ tone: "good", text: "目前沒有借閱中的書。" });
      }
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "查詢失敗。" });
    } finally {
      setLoading(false);
    }
  }

  async function submitReturns() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_ids: selectedLoanIds })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await searchReturns();
      await loadBooks();
      await loadPublicLoans();
      setMessage({ tone: "good", text: "還書完成，書籍已回到在架上。" });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "還書失敗。" });
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-leaf">Kindergarten Library</p>
          <h1 className="text-2xl font-bold text-ink">幼兒園圖書借閱</h1>
        </div>
        <Link className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink shadow-soft" href="/admin">
          後台
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-3 rounded-md bg-white p-1 shadow-soft">
        <button
          className={`tap rounded-md text-sm font-semibold ${tab === "borrow" ? "bg-leaf text-white" : "text-ink"}`}
          onClick={() => setTab("borrow")}
        >
          借書
        </button>
        <button
          className={`tap rounded-md text-sm font-semibold ${tab === "return" ? "bg-leaf text-white" : "text-ink"}`}
          onClick={() => setTab("return")}
        >
          還書
        </button>
        <button
          className={`tap rounded-md text-sm font-semibold ${tab === "publicLoans" ? "bg-leaf text-white" : "text-ink"}`}
          onClick={() => {
            setTab("publicLoans");
            loadPublicLoans();
          }}
        >
          借出名單
        </button>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {tab === "borrow" ? (
        <section className="mt-4 grid gap-4">
          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <Field label="搜尋可借書籍">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={query}
                  placeholder="書名、索書編號、關鍵字"
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button variant="secondary" aria-label="搜尋" onClick={() => loadBooks()}>
                  <Search size={18} />
                </Button>
              </div>
            </Field>
            <Field label="階段分類">
              <select className={inputClass} value={stage} onChange={(event) => setStage(event.target.value)}>
                <option value="">全部階段</option>
                {bookStages.map((bookStage) => (
                  <option key={bookStage} value={bookStage}>
                    {bookStage}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="secondary" onClick={() => loadBooks()}>
              套用分類
            </Button>
            <p className="text-sm text-ink/65">已選 {selectedBookIds.length}/3 本</p>
          </div>

          <div className="grid gap-3">
            {books.map((book) => (
              <button
                key={book.id}
                className={`grid gap-2 rounded-md border bg-white p-4 text-left shadow-soft transition ${
                  selectedBookIds.includes(book.id) ? "border-leaf ring-4 ring-leaf/15" : "border-transparent"
                }`}
                onClick={() => toggleBook(book.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-leaf">{book.book_code}</p>
                    <h2 className="text-base font-bold text-ink">{book.title}</h2>
                  </div>
                  {selectedBookIds.includes(book.id) ? <Check className="text-leaf" size={20} /> : <BookOpen size={20} />}
                </div>
                {book.stage && <Badge tone="neutral">{book.stage}</Badge>}
                <p className="text-sm text-ink/65">{[book.author, book.publisher].filter(Boolean).join(" · ")}</p>
                {book.keywords && <p className="text-sm text-ink/55">{book.keywords}</p>}
              </button>
            ))}
          </div>

          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold text-ink">借閱人資料</h2>
            <Field label="姓氏">
              <input className={inputClass} value={borrower.borrower_last_name} onChange={(event) => setBorrower({ ...borrower, borrower_last_name: event.target.value })} />
            </Field>
            <Field label="Line ID">
              <input className={inputClass} value={borrower.borrower_line_id} onChange={(event) => setBorrower({ ...borrower, borrower_line_id: event.target.value })} />
            </Field>
            <Field label="最大小孩班級">
              <input className={inputClass} value={borrower.child_class} onChange={(event) => setBorrower({ ...borrower, child_class: event.target.value })} />
            </Field>
            {selectedBooks.length > 0 && (
              <div className="rounded-md bg-sky/[0.45] p-3 text-sm text-ink">
                {selectedBooks.map((book) => book.title).join("、")}
              </div>
            )}
            <Button disabled={loading || selectedBookIds.length === 0} onClick={submitBorrow}>
              送出借閱
            </Button>
          </div>
        </section>
      ) : tab === "return" ? (
        <section className="mt-4 grid gap-4">
          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <Field label="Line ID">
              <input className={inputClass} value={returnLineId} onChange={(event) => setReturnLineId(event.target.value)} />
            </Field>
            <Button disabled={loading} onClick={searchReturns}>
              查詢借閱中書籍
            </Button>
          </div>

          <div className="grid gap-3">
            {returnLoans.map((loan) => (
              <label key={loan.id} className="flex gap-3 rounded-md bg-white p-4 shadow-soft">
                <input
                  className="mt-1 h-5 w-5"
                  type="checkbox"
                  checked={selectedLoanIds.includes(loan.id)}
                  onChange={(event) =>
                    setSelectedLoanIds((current) =>
                      event.target.checked ? [...current, loan.id] : current.filter((id) => id !== loan.id)
                    )
                  }
                />
                <span className="grid flex-1 gap-2">
                  <span className="font-bold text-ink">{loan.books?.title}</span>
                  <span className="text-sm text-ink/65">到期日 {formatTaiwanDate(loan.due_at)}</span>
                  <Badge tone={loan.loan_status === "逾期" ? "bad" : "warn"}>{loan.loan_status}</Badge>
                </span>
              </label>
            ))}
          </div>
          {returnLoans.length > 0 && (
            <Button disabled={loading || selectedLoanIds.length === 0} onClick={submitReturns}>
              <RotateCcw size={18} />
              歸還選取書籍
            </Button>
          )}
        </section>
      ) : (
        <section className="mt-4 grid gap-4">
          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">公開借閱狀態</h2>
                <p className="text-sm text-ink/60">目前借出與逾期的書籍列表</p>
              </div>
              <ClipboardList className="text-leaf" size={22} />
            </div>
            <div className="grid grid-cols-2 rounded-md bg-ink/5 p-1 text-sm font-semibold">
              {(["active", "overdue"] as const).map((mode) => (
                <button
                  key={mode}
                  className={`tap rounded-md px-2 ${publicLoanMode === mode ? "bg-white text-leaf shadow-sm" : "text-ink/70"}`}
                  onClick={() => {
                    setPublicLoanMode(mode);
                    loadPublicLoans(mode);
                  }}
                >
                  {mode === "active" ? "借出中" : "逾期"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {publicLoans.map((loan) => (
              <article key={loan.id} className="grid gap-2 rounded-md bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-leaf">{loan.books?.book_code}</p>
                    <h3 className="font-bold text-ink">{loan.books?.title}</h3>
                  </div>
                  <Badge tone={loan.loan_status === "逾期" ? "bad" : "warn"}>{loan.loan_status}</Badge>
                </div>
                {loan.books?.stage && <Badge tone="neutral">{loan.books.stage}</Badge>}
                <p className="text-sm text-ink/65">
                  {loan.borrowers?.borrower_last_name} 家長 · {loan.borrowers?.child_class} · Line ID：{loan.borrowers?.borrower_line_id}
                </p>
                <p className="text-sm text-ink/60">
                  借閱 {formatTaiwanDate(loan.borrowed_at)} · 到期 {formatTaiwanDate(loan.due_at)}
                </p>
              </article>
            ))}
            {publicLoans.length === 0 && (
              <div className="rounded-md bg-white p-4 text-center text-sm font-medium text-ink/65 shadow-soft">
                {publicLoanMode === "overdue" ? "目前沒有逾期書籍。" : "目前沒有借出中的書籍。"}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
