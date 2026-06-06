import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/errors";

type GoogleBookItem = {
  volumeInfo?: {
    title?: string;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
    };
  };
};

type OpenLibraryResult = {
  cover_i?: number;
};

function secureImageUrl(url?: string) {
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://");
}

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function buildQueries(title: string, author?: string, publisher?: string) {
  const mainTitle = title.split(/[：:]/)[0]?.trim();
  const compactTitle = title.replace(/[：:]/g, " ").replace(/\s+/g, " ").trim();

  return uniqueValues([
    title,
    compactTitle,
    mainTitle,
    author ? `${title} ${author}` : undefined,
    author && mainTitle ? `${mainTitle} ${author}` : undefined,
    publisher ? `${title} ${publisher}` : undefined,
    `intitle:${title}`,
    mainTitle ? `intitle:${mainTitle}` : undefined
  ]);
}

async function fetchGoogleCover(query: string) {
  const googleParams = new URLSearchParams({
    q: query,
    printType: "books",
    maxResults: "10",
    projection: "lite"
  });

  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${googleParams.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { items?: GoogleBookItem[] };
  return (data.items ?? [])
    .map((item) => secureImageUrl(item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail))
    .find(Boolean);
}

async function fetchOpenLibraryCover(title: string, author?: string) {
  const params = new URLSearchParams({
    title,
    limit: "10"
  });
  if (author) params.set("author", author);

  const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { docs?: OpenLibraryResult[] };
  const coverId = (data.docs ?? []).find((book) => book.cover_i)?.cover_i;
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const title = searchParams.get("title")?.trim();
    const author = searchParams.get("author")?.trim();
    const publisher = searchParams.get("publisher")?.trim();

    if (!title) return badRequest("請先輸入書名。");

    let coverUrl: string | undefined;
    for (const query of buildQueries(title, author, publisher)) {
      coverUrl = await fetchGoogleCover(query) ?? undefined;
      if (coverUrl) break;
    }

    if (!coverUrl) {
      coverUrl = await fetchOpenLibraryCover(title, author) ?? undefined;
    }

    if (!coverUrl) return badRequest("查不到封面，請改用手動貼圖片網址。");

    return NextResponse.json({ cover_image_url: coverUrl });
  } catch (error) {
    return serverError(error);
  }
}
