"use client";

import { BookOpen, Camera, Check, ChevronDown, ClipboardList, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Field, Notice, inputClass } from "@/components/ui";
import { formatTaiwanDate } from "@/lib/dates";
import type { Book, LoanWithComputedStatus } from "@/lib/types";

type Message = { tone: "good" | "bad"; text: string } | null;
const bookStages = ["幼兒階段", "國小階段", "國高中階段"];
const pageSize = 20;

type BorrowSuccess = {
  dueAt: string;
  lineId: string;
  titles: string[];
} | null;

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function BookCover({ book, size = "normal" }: { book?: Book | null; size?: "normal" | "small" }) {
  const sizeClass = size === "small" ? "h-16 w-11" : "h-20 w-14";

  return (
    <div className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink/10 bg-ink/5`}>
      {book?.cover_image_url ? (
        <img alt={`${book.title}封面`} className="h-full w-full object-cover" src={book.cover_image_url} />
      ) : (
        <BookOpen className="text-ink/30" size={size === "small" ? 18 : 22} />
      )}
    </div>
  );
}

function normalizeScannedCode(value: string) {
  const text = value.trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    return url.searchParams.get("book_code") || url.searchParams.get("code") || url.hash.replace(/^#/, "") || url.pathname.split("/").filter(Boolean).pop() || text;
  } catch {
    return text;
  }
}

function BookScanner({
  onScan,
  onClose
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scannerMessage, setScannerMessage] = useState("請將書上的 QR Code 對準畫面中央");

  useEffect(() => {
    let active = true;
    let frameId = 0;

    async function startScanner() {
      if (!window.BarcodeDetector) {
        setScannerMessage("這台手機瀏覽器不支援網頁掃描，請改用搜尋或手動選書。");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new window.BarcodeDetector({
          formats: ["qr_code", "ean_13", "code_128", "code_39"]
        });

        async function scanFrame() {
          if (!active || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const rawValue = results[0]?.rawValue;
            if (rawValue) {
              onScan(normalizeScannedCode(rawValue));
              return;
            }
          } catch {
            setScannerMessage("掃描中，請靠近一點或讓 QR Code 更清楚。");
          }
          frameId = window.requestAnimationFrame(scanFrame);
        }

        frameId = window.requestAnimationFrame(scanFrame);
      } catch {
        setScannerMessage("無法開啟相機，請確認已允許相機權限。");
      }
    }

    startScanner();

    return () => {
      active = false;
      if (frameId) window.cancelAnimationFrame(frameId);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 px-4 py-6">
      <div className="grid w-full max-w-md gap-3 rounded-md bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">掃描書籍</h2>
          <button className="tap rounded-md border border-ink/10 p-2 text-ink" aria-label="關閉掃描" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="overflow-hidden rounded-md bg-ink">
          <video ref={videoRef} className="aspect-[3/4] w-full object-cover" playsInline muted />
        </div>
        <p className="text-sm font-medium text-ink/70">{scannerMessage}</p>
        <Button variant="secondary" onClick={onClose}>
          取消掃描
        </Button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [tab, setTab] = useState<"catalog" | "borrow" | "return" | "publicLoans">("catalog");
  const [books, setBooks] = useState<Book[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [publicLoans, setPublicLoans] = useState<LoanWithComputedStatus[]>([]);
  const [publicLoanMode, setPublicLoanMode] = useState<"active" | "overdue">("active");
  const [query, setQuery] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [stage, setStage] = useState("");
  const [catalogStage, setCatalogStage] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [borrowPage, setBorrowPage] = useState(1);
  const [expandedBookIds, setExpandedBookIds] = useState<string[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [borrowPanelOpen, setBorrowPanelOpen] = useState(false);
  const [borrower, setBorrower] = useState({
    borrower_last_name: "",
    borrower_line_id: "",
    child_class: ""
  });
  const [returnBorrowerName, setReturnBorrowerName] = useState("");
  const [returnLoans, setReturnLoans] = useState<LoanWithComputedStatus[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [borrowSuccess, setBorrowSuccess] = useState<BorrowSuccess>(null);

  const selectedBooks = useMemo(
    () => books.filter((book) => selectedBookIds.includes(book.id)),
    [books, selectedBookIds]
  );
  const paginatedCatalogBooks = useMemo(
    () => catalogBooks.slice((catalogPage - 1) * pageSize, catalogPage * pageSize),
    [catalogBooks, catalogPage]
  );
  const paginatedBorrowBooks = useMemo(
    () => books.slice((borrowPage - 1) * pageSize, borrowPage * pageSize),
    [books, borrowPage]
  );
  const totalCatalogPages = Math.max(1, Math.ceil(catalogBooks.length / pageSize));
  const totalBorrowPages = Math.max(1, Math.ceil(books.length / pageSize));

  async function loadBooks(nextQuery = query) {
    const params = new URLSearchParams({ status: "在架上" });
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (stage) params.set("stage", stage);
    const response = await fetch(`/api/books?${params.toString()}`);
    const data = await response.json();
    setBooks(data.books ?? []);
    setBorrowPage(1);
  }

  async function loadCatalogBooks(nextQuery = catalogQuery) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (catalogStage) params.set("stage", catalogStage);
    const response = await fetch(`/api/books?${params.toString()}`);
    const data = await response.json();
    setCatalogBooks(data.books ?? []);
    setCatalogPage(1);
  }

  async function loadPublicLoans(mode = publicLoanMode) {
    const response = await fetch(`/api/loans?mode=${mode}`);
    const data = await response.json();
    setPublicLoans(data.loans ?? []);
  }

  useEffect(() => {
    loadCatalogBooks("");
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

  async function selectScannedBook(scannedCode: string) {
    const bookCode = scannedCode.trim();
    setScannerOpen(false);
    setMessage(null);

    if (!bookCode) {
      setMessage({ tone: "bad", text: "沒有讀到書籍編號，請再掃一次。" });
      return;
    }

    if (selectedBookIds.length >= 3) {
      setMessage({ tone: "bad", text: "一次最多借 3 本書。" });
      return;
    }

    try {
      const params = new URLSearchParams({ bookCode });
      const response = await fetch(`/api/books?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const scannedBook = data.books?.[0] as Book | undefined;

      if (!scannedBook) {
        setMessage({ tone: "bad", text: `找不到索書編號「${bookCode}」。` });
        return;
      }

      if (scannedBook.status !== "在架上") {
        setMessage({ tone: "bad", text: `「${scannedBook.title}」目前不是在架上，無法借出。` });
        return;
      }

      if (selectedBookIds.includes(scannedBook.id)) {
        setMessage({ tone: "good", text: `「${scannedBook.title}」已經在已選清單中。` });
        return;
      }

      setBooks((current) => {
        if (current.some((book) => book.id === scannedBook.id)) return current;
        return [scannedBook, ...current];
      });
      setSelectedBookIds((current) => [...current, scannedBook.id]);
      setBorrowPage(1);
      setMessage({ tone: "good", text: `已加入「${scannedBook.title}」。` });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "掃描後查詢失敗。" });
    }
  }

  function toggleBookDetails(id: string) {
    setExpandedBookIds((current) =>
      current.includes(id) ? current.filter((bookId) => bookId !== id) : [...current, id]
    );
  }

  function bookDetails(book: Book) {
    return (
      <div className="grid gap-1 rounded-md bg-ink/5 p-3 text-sm text-ink/70">
        {book.publisher && <p>出版社：{book.publisher}</p>}
        {book.published_date && <p>出版日期：{formatTaiwanDate(book.published_date)}</p>}
        {book.author && <p>作者：{book.author}</p>}
        {book.translator && <p>譯者：{book.translator}</p>}
        {book.keywords && <p>關鍵字：{book.keywords}</p>}
      </div>
    );
  }

  async function submitBorrow() {
    if (selectedBooks.length === 0) return;
    const confirmBorrow = window.confirm(`你要借這 ${selectedBooks.length} 本書嗎？\n\n${selectedBooks.map((book) => book.title).join("\n")}`);
    if (!confirmBorrow) return;

    setLoading(true);
    setMessage(null);
    setBorrowSuccess(null);
    try {
      const response = await fetch("/api/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...borrower, book_ids: selectedBookIds })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBorrowSuccess({
        dueAt: data.loans?.[0]?.due_at ?? new Date().toISOString(),
        lineId: borrower.borrower_line_id,
        titles: selectedBooks.map((book) => book.title)
      });
      setSelectedBookIds([]);
      setBorrowPanelOpen(false);
      setBorrower({ borrower_last_name: "", borrower_line_id: "", child_class: "" });
      await loadBooks();
      await loadPublicLoans();
      setMessage({ tone: "good", text: "借閱成功。" });
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
      const response = await fetch(`/api/returns?name=${encodeURIComponent(returnBorrowerName)}`);
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

      <div className="mb-4 grid grid-cols-4 rounded-md bg-white p-1 shadow-soft">
        <button
          className={`tap rounded-md text-sm font-semibold ${tab === "catalog" ? "bg-leaf text-white" : "text-ink"}`}
          onClick={() => {
            setTab("catalog");
            loadCatalogBooks();
          }}
        >
          全部書籍
        </button>
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
      {borrowSuccess && (
        <div className="mt-3 grid gap-2 rounded-md bg-white p-4 shadow-soft">
          <h2 className="text-lg font-bold text-leaf">借閱成功</h2>
          <p className="text-sm text-ink/70">Line ID：{borrowSuccess.lineId}</p>
          <p className="text-sm text-ink/70">到期日：{formatTaiwanDate(borrowSuccess.dueAt)}</p>
          <div className="rounded-md bg-sky/[0.45] p-3 text-sm text-ink">
            {borrowSuccess.titles.join("、")}
          </div>
        </div>
      )}

      {tab === "catalog" ? (
        <section className="mt-4 grid gap-4 md:pb-8">
          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <Field label="搜尋全部書籍">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={catalogQuery}
                  placeholder="書名、索書編號、關鍵字"
                  onChange={(event) => setCatalogQuery(event.target.value)}
                />
                <Button variant="secondary" aria-label="搜尋" onClick={() => loadCatalogBooks()}>
                  <Search size={18} />
                </Button>
              </div>
            </Field>
            <Field label="階段分類">
              <select className={inputClass} value={catalogStage} onChange={(event) => setCatalogStage(event.target.value)}>
                <option value="">全部階段</option>
                {bookStages.map((bookStage) => (
                  <option key={bookStage} value={bookStage}>
                    {bookStage}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="secondary" onClick={() => loadCatalogBooks()}>
              套用分類
            </Button>
            <p className="text-sm text-ink/65">共 {catalogBooks.length} 本</p>
          </div>

          <div className="grid gap-3">
            {paginatedCatalogBooks.map((book) => (
              <article key={book.id} className="grid gap-2 rounded-md bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <BookCover book={book} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-leaf">{book.book_code}</p>
                      <h2 className="text-base font-bold text-ink">{book.title}</h2>
                    </div>
                  </div>
                  <Badge tone={book.status === "在架上" ? "good" : "warn"}>{book.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {book.stage && <Badge tone="neutral">{book.stage}</Badge>}
                  {book.status === "在架上" && <Badge tone="good">可借閱</Badge>}
                </div>
                <p className="text-sm text-ink/65">{[book.author, book.publisher].filter(Boolean).join(" · ")}</p>
                {book.keywords && <p className="text-sm text-ink/55">{book.keywords}</p>}
                <button className="text-left text-sm font-semibold text-leaf" onClick={() => toggleBookDetails(book.id)}>
                  {expandedBookIds.includes(book.id) ? "收合詳細資料" : "詳細資料"}
                </button>
                {expandedBookIds.includes(book.id) && bookDetails(book)}
              </article>
            ))}
            {catalogBooks.length === 0 && (
              <div className="rounded-md bg-white p-4 text-center text-sm font-medium text-ink/65 shadow-soft">
                目前沒有符合條件的書籍。
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Button variant="secondary" disabled={catalogPage <= 1} onClick={() => setCatalogPage((page) => page - 1)}>
              上一頁
            </Button>
            <p className="text-center text-sm font-semibold text-ink/65">
              {catalogPage} / {totalCatalogPages}
            </p>
            <Button variant="secondary" disabled={catalogPage >= totalCatalogPages} onClick={() => setCatalogPage((page) => page + 1)}>
              下一頁
            </Button>
          </div>
        </section>
      ) : tab === "borrow" ? (
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
            <Button variant="secondary" onClick={() => setScannerOpen(true)}>
              <Camera size={18} />
              掃描借書
            </Button>
            <p className="text-sm text-ink/65">已選 {selectedBookIds.length}/3 本</p>
          </div>

          <div className="mx-auto w-full max-w-3xl md:fixed md:bottom-auto md:right-5 md:top-24 md:z-20 md:w-72">
            <div className="grid gap-2 rounded-md border border-leaf/25 bg-sky/[0.92] p-3 shadow-soft md:gap-3 md:p-4">
              <button
                className="flex items-center justify-between gap-3 text-left"
                onClick={() => setBorrowPanelOpen((open) => !open)}
              >
                <span>
                  <span className="block text-sm font-semibold text-leaf">借閱人資料 <span className="text-coral">請填寫</span></span>
                  <span className="block text-base font-bold text-ink">已選 {selectedBookIds.length}/3 本</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-2 text-sm font-bold text-ink shadow-sm">
                  {borrowPanelOpen ? "收合" : "填寫資料"}
                  <ChevronDown className={`transition ${borrowPanelOpen ? "rotate-180" : ""}`} size={22} />
                </span>
              </button>

              {selectedBooks.length > 0 && (
                <div className="rounded-md bg-white/70 p-3 text-sm text-ink">
                  {selectedBooks.map((book) => book.title).join("、")}
                </div>
              )}

              {borrowPanelOpen && (
                <div className="grid gap-3">
                  <Field label="姓名">
                    <input className={inputClass} value={borrower.borrower_last_name} onChange={(event) => setBorrower({ ...borrower, borrower_last_name: event.target.value })} />
                  </Field>
                  <Field label="Line ID">
                    <input className={inputClass} value={borrower.borrower_line_id} onChange={(event) => setBorrower({ ...borrower, borrower_line_id: event.target.value })} />
                  </Field>
                  <Field label="最大小孩班級">
                    <input className={inputClass} value={borrower.child_class} onChange={(event) => setBorrower({ ...borrower, child_class: event.target.value })} />
                  </Field>
                </div>
              )}

              <Button disabled={loading || selectedBookIds.length === 0} onClick={submitBorrow}>
                送出借閱
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {paginatedBorrowBooks.map((book) => (
              <button
                key={book.id}
                className={`grid gap-2 rounded-md border bg-white p-4 text-left shadow-soft transition ${
                  selectedBookIds.includes(book.id) ? "border-leaf ring-4 ring-leaf/15" : "border-transparent"
                }`}
                onClick={() => toggleBook(book.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <BookCover book={book} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-leaf">{book.book_code}</p>
                      <h2 className="text-base font-bold text-ink">{book.title}</h2>
                    </div>
                  </div>
                  {selectedBookIds.includes(book.id) ? (
                    <Check className="shrink-0 text-leaf" size={20} />
                  ) : (
                    <BookOpen className="shrink-0 text-ink" size={20} />
                  )}
                </div>
                {book.stage && <Badge tone="neutral">{book.stage}</Badge>}
                <p className="text-sm text-ink/65">{[book.author, book.publisher].filter(Boolean).join(" · ")}</p>
                {book.keywords && <p className="text-sm text-ink/55">{book.keywords}</p>}
                <span
                  className="text-sm font-semibold text-leaf"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleBookDetails(book.id);
                  }}
                >
                  {expandedBookIds.includes(book.id) ? "收合詳細資料" : "詳細資料"}
                </span>
                {expandedBookIds.includes(book.id) && bookDetails(book)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Button variant="secondary" disabled={borrowPage <= 1} onClick={() => setBorrowPage((page) => page - 1)}>
              上一頁
            </Button>
            <p className="text-center text-sm font-semibold text-ink/65">
              {borrowPage} / {totalBorrowPages}
            </p>
            <Button variant="secondary" disabled={borrowPage >= totalBorrowPages} onClick={() => setBorrowPage((page) => page + 1)}>
              下一頁
            </Button>
          </div>
          {scannerOpen && <BookScanner onScan={selectScannedBook} onClose={() => setScannerOpen(false)} />}
        </section>
      ) : tab === "return" ? (
        <section className="mt-4 grid gap-4">
          <div className="grid gap-3 rounded-md bg-white p-4 shadow-soft">
            <Field label="借閱人姓名">
              <input
                className={inputClass}
                value={returnBorrowerName}
                placeholder="請輸入姓名"
                onChange={(event) => setReturnBorrowerName(event.target.value)}
              />
            </Field>
            <Button disabled={loading} onClick={searchReturns}>
              查詢還書清單
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
                  <span className="flex gap-3">
                    <BookCover book={loan.books} size="small" />
                    <span className="grid flex-1 gap-2">
                      <span className="font-bold text-ink">{loan.books?.title}</span>
                      <span className="text-sm text-ink/65">到期日 {formatTaiwanDate(loan.due_at)}</span>
                    </span>
                  </span>
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
                  <div className="flex min-w-0 gap-3">
                    <BookCover book={loan.books} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-leaf">{loan.books?.book_code}</p>
                      <h3 className="font-bold text-ink">{loan.books?.title}</h3>
                    </div>
                  </div>
                  <Badge tone={loan.loan_status === "逾期" ? "bad" : "warn"}>{loan.loan_status}</Badge>
                </div>
                {loan.books?.stage && <Badge tone="neutral">{loan.books.stage}</Badge>}
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
