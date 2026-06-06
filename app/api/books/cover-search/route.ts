import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/errors";

type GoogleBookItem = {
  volumeInfo?: {
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
    };
  };
};

function secureImageUrl(url?: string) {
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://");
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const title = searchParams.get("title")?.trim();
    const author = searchParams.get("author")?.trim();
    const publisher = searchParams.get("publisher")?.trim();

    if (!title) return badRequest("請先輸入書名。");

    const queryParts = [`intitle:${title}`];
    if (author) queryParts.push(`inauthor:${author}`);
    if (publisher) queryParts.push(`inpublisher:${publisher}`);

    const googleParams = new URLSearchParams({
      q: queryParts.join(" "),
      printType: "books",
      maxResults: "5",
      projection: "lite"
    });

    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${googleParams.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) return badRequest("查不到封面，請改用手動貼圖片網址。");

    const data = (await response.json()) as { items?: GoogleBookItem[] };
    const coverUrl = (data.items ?? [])
      .map((item) => secureImageUrl(item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail))
      .find(Boolean);

    if (!coverUrl) return badRequest("查不到封面，請改用手動貼圖片網址。");

    return NextResponse.json({ cover_image_url: coverUrl });
  } catch (error) {
    return serverError(error);
  }
}
