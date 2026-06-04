export type BookStatus = "在架上" | "已借出";

export type Book = {
  id: string;
  status: BookStatus | string;
  book_code: string;
  stage: string | null;
  title: string;
  publisher: string | null;
  published_date: string | null;
  author: string | null;
  translator: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
};

export type Borrower = {
  id: string;
  borrower_last_name: string;
  borrower_line_id: string;
  child_class: string;
  created_at: string;
  updated_at: string;
};

export type Loan = {
  id: string;
  book_id: string;
  borrower_id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  books?: Book | null;
  borrowers?: Borrower | null;
};

export type LoanWithComputedStatus = Loan & {
  loan_status: "借閱中" | "逾期" | "已歸還";
};
