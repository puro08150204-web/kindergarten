# 幼兒園圖書借閱系統

手機優先的 Next.js + Supabase + Tailwind CSS 圖書借閱系統，設計給家長不用登入即可借書與還書，後台可手動新增與管理書籍、查看借出與逾期名單。

## 功能

- 後台手動新增、修改、刪除書籍，欄位包含：書況、索書編號、階段分類、書名、出版社、出版日期、作者、譯者、關鍵字
- `stage` 階段分類可填：`幼兒階段`、`國小階段`、`國高中階段`
- 若要把既有 Excel 清單一次匯入，可使用 `npm run import:books -- /完整路徑/書籍清單.xlsx`
- 家長借書表單：姓氏、Line ID、最大小孩班級，一次最多 3 本
- 借書規則：只可借 `在架上`，同 Line ID 未歸還最多 3 本，到期日自動加 30 天
- 家長還書：輸入 Line ID 查詢借閱中書籍並勾選歸還
- 後台：全部書籍、借出中、逾期名單、搜尋、新增、修改、刪除、手動還書

## 本機啟動

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 需要填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=2026
```

## Supabase 設定

1. 到 Supabase 建立專案。
2. 打開 SQL Editor。
3. 貼上並執行 `supabase/schema.sql`。
4. 到 Project Settings > API 複製：
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key -> `SUPABASE_SERVICE_ROLE_KEY`

## Railway 部署

如果你已經建立過舊版資料表，請另外執行 `supabase/add-stage-to-books.sql`，把 `stage` 階段分類欄位加到 `books`。

1. 將專案推到 GitHub。
2. Railway 建立 New Project，選 GitHub Repo。
3. 在 Variables 加上 `.env.example` 裡的三個變數。
4. Railway 會使用 `npm run build` 建置，並以 `npm run start` 啟動。

## 路徑

- 家長端：`/`
- 後台：`/admin`

目前後台沒有登入保護，適合先用於內部測試。正式上線時建議至少加上後台密碼或限制 Railway 網域存取。
