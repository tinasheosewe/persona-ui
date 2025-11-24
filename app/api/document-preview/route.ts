import { NextRequest, NextResponse } from "next/server";
import { contentType } from "mime-types";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB safeguard
const GENERIC_CONTENT_TYPE = "application/octet-stream";

const resolveContentType = (
  upstreamType: string | null,
  filename?: string | null,
  url?: string | null,
): string => {
  if (upstreamType && upstreamType.toLowerCase() !== GENERIC_CONTENT_TYPE) {
    return upstreamType;
  }

  const guessFromFilename = filename ? contentType(filename) : null;
  if (guessFromFilename) {
    return guessFromFilename;
  }

  const guessFromUrl = url ? contentType(url) : null;
  if (guessFromUrl) {
    return guessFromUrl;
  }

  return GENERIC_CONTENT_TYPE;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const targetUrl = searchParams.get("url");
  const filename = searchParams.get("filename") ?? undefined;

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Failed to retrieve document (${upstream.status})` },
        { status: upstream.status },
      );
    }

    const contentLengthHeader = upstream.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "Document is too large to preview." }, { status: 413 });
      }
    }

    const headers = new Headers();
    headers.set(
      "content-type",
      resolveContentType(upstream.headers.get("content-type"), filename, targetUrl),
    );
    headers.set("cache-control", "private, max-age=60");
    headers.set(
      "content-disposition",
      filename ? `inline; filename="${filename}"` : "inline",
    );

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load document" },
      { status: 500 },
    );
  }
}
