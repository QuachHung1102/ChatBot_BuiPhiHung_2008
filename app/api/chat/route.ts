import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple proxy to keep the external API token server-side.
// Expects body: { messages: {role: string, content: string}[], model?: string, max_tokens?: number }

const EXTERNAL_ENDPOINT = "https://api.inverevitae.com/api/v1/chats_openai/f91a9a04b3cf11f09ebc7e5a354505d9/chat/completions";

export async function POST(req: Request) {
  try {
    const token = process.env.RAGFLOW_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Missing server token. Set RAGFLOW_API_TOKEN in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const payload = {
      model: body.model ?? "deepseek-chat@DeepSeek",
      messages: body.messages ?? [],
      max_tokens: body.max_tokens ?? 256,
      stream: false,
    } as const;

    const apiRes = await fetch(EXTERNAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      // Optional: you can set a timeout via AbortController if needed
    });

    // Forward status and (sanitized) body
  const text = await apiRes.text();
  let data: unknown = undefined;
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON or malformed
      data = { raw: text };
    }

    return NextResponse.json(
      { ok: apiRes.ok, status: apiRes.status, data },
      { status: apiRes.ok ? 200 : apiRes.status }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
