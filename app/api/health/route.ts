import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const hasToken = Boolean(process.env.RAGFLOW_API_TOKEN && process.env.RAGFLOW_API_TOKEN?.trim());
  return NextResponse.json({ ok: true, hasToken });
}
