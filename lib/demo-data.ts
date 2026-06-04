import type { Book, LoanWithComputedStatus } from "@/lib/types";

export const demoBooks: Book[] = [
  {
    id: "demo-book-1",
    status: "在架上",
    book_code: "A-001",
    stage: "幼兒階段",
    title: "小熊上學去",
    publisher: "親子森林",
    published_date: "2024-03-01",
    author: "林小安",
    translator: null,
    keywords: "情緒,上學,幼兒園",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "demo-book-2",
    status: "在架上",
    book_code: "B-015",
    stage: "幼兒階段",
    title: "今天誰來說故事",
    publisher: "小種子",
    published_date: "2023-09-12",
    author: "王文心",
    translator: null,
    keywords: "故事,分享,想像力",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "demo-book-3",
    status: "在架上",
    book_code: "C-022",
    stage: "國小階段",
    title: "我會自己穿鞋子",
    publisher: "彩虹屋",
    published_date: "2022-11-20",
    author: "陳美美",
    translator: null,
    keywords: "生活自理,鞋子,成長",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const demoLoans: LoanWithComputedStatus[] = [
  {
    id: "demo-loan-1",
    book_id: "demo-loan-book-1",
    borrower_id: "demo-borrower-1",
    borrowed_at: "2026-05-25T02:00:00.000Z",
    due_at: "2026-06-24T02:00:00.000Z",
    returned_at: null,
    loan_status: "借閱中",
    books: {
      id: "demo-loan-book-1",
      status: "已借出",
      book_code: "D-006",
      stage: "幼兒階段",
      title: "月亮晚安",
      publisher: "晚風出版",
      published_date: "2021-06-10",
      author: "張柔柔",
      translator: null,
      keywords: "睡前,月亮,親子共讀",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    borrowers: {
      id: "demo-borrower-1",
      borrower_last_name: "陳",
      borrower_line_id: "chen_parent",
      child_class: "海豚班",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  },
  {
    id: "demo-loan-2",
    book_id: "demo-loan-book-2",
    borrower_id: "demo-borrower-2",
    borrowed_at: "2026-04-20T02:00:00.000Z",
    due_at: "2026-05-20T02:00:00.000Z",
    returned_at: null,
    loan_status: "逾期",
    books: {
      id: "demo-loan-book-2",
      status: "已借出",
      book_code: "E-018",
      stage: "國高中階段",
      title: "恐龍不生氣",
      publisher: "童心書房",
      published_date: "2020-08-18",
      author: "劉晴",
      translator: null,
      keywords: "情緒,恐龍,生氣",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    borrowers: {
      id: "demo-borrower-2",
      borrower_last_name: "黃",
      borrower_line_id: "huang_line",
      child_class: "星星班",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }
];
