"use client";

import { Download, Edit3, FileUp, LogOut, Plus, QrCode, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Field, Notice, inputClass } from "@/components/ui";
import { formatTaiwanDate, toDateInputValue } from "@/lib/dates";
import type { Book, LoanWithComputedStatus } from "@/lib/types";

const emptyBook = {
  status: "在架上",
  book_code: "",
  stage: "",
  title: "",
  cover_image_url: "",
  publisher: "",
  published_date: "",
  author: "",
  translator: "",
  keywords: ""
};
const bookStages = ["幼兒階段", "國小階段", "國高中階段"];
const pageSize = 20;

type BookForm = typeof emptyBook;
type Message = { tone: "good" | "bad"; text: string } | null;

function qrCodeUrl(bookCode: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(bookCode)}`;
}

export default function AdminPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<LoanWithComputedStatus[]>([]);
  const [query, setQuery] = useState("");
  const [bookStatusFilter, setBookStatusFilter] = useState("");
  const [bookStageFilter, setBookStageFilter] = useState("");
  const [bookPage, setBookPage] = useState(1);
  const [loanMode, setLoanMode] = useState<"active" | "overdue" | "all">("active");
  const [form, setForm] = useState<BookForm>(emptyBook);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qrBook, setQrBook] = useState<Book | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [loading, setLoading] = useState(false);

  const paginatedBooks = useMemo(
    () => books.slice((bookPage - 1) * pageSize, bookPage * pageSize),
    [bookPage, books]
  );
  const totalBookPages = Math.max(1, Math.ceil(books.length / pageSize));

  async function loadBooks(nextQuery = query) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (bookStatusFilter) params.set("status", bookStatusFilter);
    if (bookStageFilter) params.set("stage", bookStageFilter);
    const response = await fetch(`/api/books?${params.toString()}`);
    const data = await response.json();
    setBooks(data.books ?? []);
    setBookPage(1);
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
      cover_image_url: book.cover_image_url || "",
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

  async function findCoverForForm() {
    if (!form.title.trim()) {
      setMessage({ tone: "bad", text: "請先輸入書名，再查封面。" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ title: form.title });
      if (form.author.trim()) params.set("author", form.author);
      if (form.publisher.trim()) params.set("publisher", form.publisher);
      const response = await fetch(`/api/books/cover-search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setForm((current) => ({ ...current, cover_image_url: data.cover_image_url ?? "" }));
      setMessage({ tone: "good", text: "已找到封面，儲存後會顯示在書籍旁邊。" });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "查詢封面失敗。" });
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

  async function importExcel(file?: File) {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await loadBooks();
      setMessage({ tone: "good", text: `已匯入 ${data.imported} 筆書籍：新增 ${data.created ?? 0} 筆，更新 ${data.updated ?? 0} 筆。` });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "匯入失敗。" });
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  function exportLoansCsv() {
    const headers = ["狀態", "索書編號", "書名", "姓名", "班級", "Line ID", "借閱日", "到期日", "歸還日"];
    const rows = loans.map((loan) => [
      loan.loan_status,
      loan.books?.book_code ?? "",
      loan.books?.title ?? "",
      loan.borrowers?.borrower_last_name ?? "",
      loan.borrowers?.child_class ?? "",
      loan.borrowers?.borrower_line_id ?? "",
      formatTaiwanDate(loan.borrowed_at),
      formatTaiwanDate(loan.due_at),
      formatTaiwanDate(loan.returned_at)
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `library-loans-${loanMode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  function printQrCode() {
    if (!qrBook) return;

    document.body.classList.add("qr-printing");
    const removePrintClass = () => document.body.classList.remove("qr-printing");
    window.addEventListener("afterprint", removePrintClass, { once: true });
    window.print();
    window.setTimeout(removePrintClass, 1000);
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
        <Button variant="secondary" onClick={logout}>
          <LogOut size={16} />
          登出
        </Button>
      </header>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section className="grid content-start gap-4">
          <div className="grid content-start gap-3 rounded-md bg-white p-4 shadow-soft">
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
            <Field label="封面圖片網址">
              <div className="grid gap-2">
                <input
                  className={inputClass}
                  value={form.cover_image_url}
                  placeholder="可貼圖片網址，或按下方自動查封面"
                  onChange={(event) => setForm({ ...form, cover_image_url: event.target.value })}
                />
                <Button variant="secondary" disabled={loading} onClick={findCoverForForm}>
                  自動查封面
                </Button>
                {form.cover_image_url && (
                  <img
                    alt={`${form.title || "書籍"}封面`}
                    className="h-28 w-20 rounded-md border border-ink/10 bg-ink/5 object-cover"
                    src={form.cover_image_url}
                  />
                )}
              </div>
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

          <div className="grid content-start gap-3 rounded-md bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold text-ink">批次匯入既有清單</h2>
            <label className="tap inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-leaf/[0.45] bg-sky/[0.35] px-4 py-3 text-sm font-semibold text-ink">
              <FileUp size={18} />
              選擇 Excel 檔
              <input className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => importExcel(event.target.files?.[0])} />
            </label>
          </div>
        </section>

        <section className="grid content-start gap-4">
          <div className="grid content-start gap-3 rounded-md bg-white p-4 shadow-soft">
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
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={inputClass} value={bookStatusFilter} onChange={(event) => setBookStatusFilter(event.target.value)}>
                <option value="">全部書況</option>
                <option value="在架上">在架上</option>
                <option value="已借出">已借出</option>
              </select>
              <select className={inputClass} value={bookStageFilter} onChange={(event) => setBookStageFilter(event.target.value)}>
                <option value="">全部階段</option>
                {bookStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="secondary" onClick={() => loadBooks()}>
              套用篩選
            </Button>
            <div className="grid gap-2">
              {paginatedBooks.map((book) => (
                <article key={book.id} className="grid gap-3 rounded-md border border-ink/10 p-3 sm:grid-cols-[1fr_auto]">
                  <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
                    <div className="flex h-20 w-14 items-center justify-center overflow-hidden rounded-md border border-ink/10 bg-ink/5">
                      {book.cover_image_url ? (
                        <img alt={`${book.title}封面`} className="h-full w-full object-cover" src={book.cover_image_url} />
                      ) : (
                        <span className="text-[10px] font-semibold text-ink/35">無封面</span>
                      )}
                    </div>
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
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:items-start">
                    <Button variant="secondary" onClick={() => setQrBook(book)}>
                      <QrCode size={16} />
                      <span className="sm:hidden">QR Code</span>
                    </Button>
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
            <div className="grid grid-cols-3 items-center gap-2">
              <Button variant="secondary" disabled={bookPage <= 1} onClick={() => setBookPage((page) => page - 1)}>
                上一頁
              </Button>
              <p className="text-center text-sm font-semibold text-ink/65">
                {bookPage} / {totalBookPages}
              </p>
              <Button variant="secondary" disabled={bookPage >= totalBookPages} onClick={() => setBookPage((page) => page + 1)}>
                下一頁
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">借閱紀錄</h2>
              <Button variant="secondary" onClick={exportLoansCsv}>
                <Download size={16} />
                匯出
              </Button>
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

      {qrBook && (
        <div className="qr-print-layer fixed inset-0 z-50 grid place-items-center bg-ink/70 px-4 py-6 print:static print:bg-white print:p-0">
          <div className="qr-print-card grid w-full max-w-sm gap-4 rounded-md bg-white p-5 text-center shadow-soft print:max-w-none print:shadow-none">
            <div className="flex items-center justify-between gap-3 print:hidden">
              <h2 className="text-lg font-bold text-ink">單本 QR Code</h2>
              <button className="tap rounded-md border border-ink/10 p-2 text-ink" aria-label="關閉 QR Code" onClick={() => setQrBook(null)}>
                <X size={20} />
              </button>
            </div>
            <div id="qr-print-area" className="grid justify-items-center gap-3">
              <img alt={`${qrBook.title} QR Code`} className="h-64 w-64 rounded-md border border-ink/10 bg-white p-3" src={qrCodeUrl(qrBook.book_code)} />
              <div className="grid gap-1">
                <p className="text-sm font-semibold text-leaf">{qrBook.book_code}</p>
                <p className="text-xl font-bold text-ink">{qrBook.title}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 print:hidden">
              <Button onClick={printQrCode}>列印</Button>
              <Button variant="secondary" onClick={() => setQrBook(null)}>
                關閉
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
