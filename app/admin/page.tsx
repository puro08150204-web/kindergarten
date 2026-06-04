"use client";

import { Edit3, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Field, Notice, inputClass } from "@/components/ui";
import { formatTaiwanDate, toDateInputValue } from "@/lib/dates";
import type { Book, LoanWithComputedStatus } from "@/lib/types";

const emptyBook = {
  status: "在架上",
  book_code: "",
  stage: "",
  title: "",
  publisher: "",
  published_date: "",
  author: "",
  translator: "",
  keywords: ""
};
const bookStages = ["幼兒階段", "國小階段", "國高中階段"];

type BookForm = typeof emptyBook;
type Message = { tone: "good" | "bad"; text: string } | null;

export default function AdminPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<LoanWithComputedStatus[]>([]);
  const [query, setQuery] = useState("");
  const [loanMode, setLoanMode] = useState<"active" | "overdue" | "all">("active");
  const [form, setForm] = useState<BookForm>(emptyBook);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [loading, setLoading] = useState(false);

  async function loadBooks(nextQuery = query) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const response = await fetch(`/api/books?${params.toString()}`);
    const data = await response.json();
    setBooks(data.books ?? []);
  }

  async function loadLoans(mode = loanMode) {
    const response = await fetch(`/api/admin/loans?mode=${mode}`);
    const data = await response.json();
    setLoans(data.loans ?? []);
  }

  useEffect(() => {
    loadBooks("");
    loadLoans("active");
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function editBook(book: Book) {
    setEditingId(book.id);
    setForm({
      status: book.status || "在架上",
      book_code: book.book_code || "",
      stage: book.stage || "",
      title: book.title || "",
      publisher: book.publisher || "",
      published_date: toDateInputValue(book.published_date),
      author: book.author || "",
      translator: book.translator || "",
      keywords: book.keywords || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveBook() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(editingId ? `/api/books/${editingId}` : "/api/books", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setForm(emptyBook);
      setEditingId(null);
      await loadBooks();
      setMessage({ tone: "good", text: editingId ? "書籍已更新。" : "書籍已新增。" });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "儲存失敗。" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteBook(id: string) {
    if (!confirm("確定刪除這本書？")) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/books/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await loadBooks();
      setMessage({ tone: "good", text: "書籍已刪除。" });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "刪除失敗。" });
    } finally {
      setLoading(false);
    }
  }

  async function returnLoan(id: string) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_ids: [id] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await Promise.all([loadBooks(), loadLoans()]);
      setMessage({ tone: "good", text: "已完成手動還書。" });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "還書失敗。" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-leaf">Library Admin</p>
          <h1 className="text-2xl font-bold text-ink">圖書管理後台</h1>
        </div>
        <Link className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink shadow-soft" href="/">
          家長端
        </Link>
      </header>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className="grid gap-4">
          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold text-ink">{editingId ? "修改書籍" : "新增書籍"}</h2>
            <Field label="書況">
              <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option>在架上</option>
                <option>已借出</option>
              </select>
            </Field>
            <Field label="索書編號">
              <input className={inputClass} value={form.book_code} onChange={(event) => setForm({ ...form, book_code: event.target.value })} />
            </Field>
            <Field label="階段分類">
              <select className={inputClass} value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>
                <option value="">未分類</option>
                {bookStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="書名">
              <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="出版社">
              <input className={inputClass} value={form.publisher} onChange={(event) => setForm({ ...form, publisher: event.target.value })} />
            </Field>
            <Field label="出版日期">
              <input type="date" className={inputClass} value={form.published_date} onChange={(event) => setForm({ ...form, published_date: event.target.value })} />
            </Field>
            <Field label="作者">
              <input className={inputClass} value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} />
            </Field>
            <Field label="譯者">
              <input className={inputClass} value={form.translator} onChange={(event) => setForm({ ...form, translator: event.target.value })} />
            </Field>
            <Field label="關鍵字">
              <textarea className={`${inputClass} min-h-24`} value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={loading} onClick={saveBook}>
                {editingId ? <Save size={18} /> : <Plus size={18} />}
                {editingId ? "儲存" : "新增"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setForm(emptyBook);
                  setEditingId(null);
                }}
              >
                清除
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">全部書籍</h2>
              <span className="text-sm text-ink/60">{books.length} 筆</span>
            </div>
            <div className="flex gap-2">
              <input className={inputClass} value={query} placeholder="書名、索書編號、關鍵字" onChange={(event) => setQuery(event.target.value)} />
              <Button variant="secondary" aria-label="搜尋" onClick={() => loadBooks()}>
                <Search size={18} />
              </Button>
            </div>
            <div className="grid gap-2">
              {books.map((book) => (
                <article key={book.id} className="grid gap-3 rounded-md border border-ink/10 p-3 sm:grid-cols-[1fr_auto]">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-leaf">{book.book_code}</p>
                      <Badge tone={book.status === "在架上" ? "good" : "warn"}>{book.status}</Badge>
                      {book.stage && <Badge tone="neutral">{book.stage}</Badge>}
                    </div>
                    <h3 className="font-bold text-ink">{book.title}</h3>
                    <p className="text-sm text-ink/65">{[book.author, book.publisher].filter(Boolean).join(" · ")}</p>
                    {book.keywords && <p className="text-sm text-ink/55">{book.keywords}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-start">
                    <Button variant="secondary" onClick={() => editBook(book)}>
                      <Edit3 size={16} />
                    </Button>
                    <Button variant="danger" onClick={() => deleteBook(book.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">借閱紀錄</h2>
              <div className="grid grid-cols-3 rounded-md bg-ink/5 p-1 text-sm font-semibold">
                {(["active", "overdue", "all"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`tap rounded-md px-2 ${loanMode === mode ? "bg-white text-leaf shadow-sm" : "text-ink/70"}`}
                    onClick={() => {
                      setLoanMode(mode);
                      loadLoans(mode);
                    }}
                  >
                    {mode === "active" ? "借出中" : mode === "overdue" ? "逾期" : "全部"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              {loans.map((loan) => (
                <article key={loan.id} className="grid gap-3 rounded-md border border-ink/10 p-3 sm:grid-cols-[1fr_auto]">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={loan.loan_status === "逾期" ? "bad" : loan.loan_status === "已歸還" ? "good" : "warn"}>{loan.loan_status}</Badge>
                      <span className="text-xs font-semibold text-leaf">{loan.books?.book_code}</span>
                    </div>
                    <h3 className="font-bold text-ink">{loan.books?.title}</h3>
                    <p className="text-sm text-ink/65">
                      {loan.borrowers?.borrower_last_name} 家長 · {loan.borrowers?.child_class} · {loan.borrowers?.borrower_line_id}
                    </p>
                    <p className="text-sm text-ink/60">
                      借閱 {formatTaiwanDate(loan.borrowed_at)} · 到期 {formatTaiwanDate(loan.due_at)}
                    </p>
                  </div>
                  {!loan.returned_at && (
                    <Button variant="secondary" disabled={loading} onClick={() => returnLoan(loan.id)}>
                      <RotateCcw size={16} />
                      還書
                    </Button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
