/**
 * Proxy for the local FastAPI Reddit Operator service (localhost:8088).
 * Forwards all /api/reddit-operator/* requests to http://127.0.0.1:8088/*
 * so the browser never makes a cross-origin request.
 * Dev-only — not used in production (Netlify).
 */

import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://127.0.0.1:8088";

async function proxy(request: NextRequest, params: { path: string[] }) {
  const path = (params.path ?? []).join("/");
  const search = request.nextUrl.search ?? "";
  const target = `${FASTAPI_BASE}/${path}${search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      // @ts-expect-error — Node fetch supports duplex for streaming bodies
      duplex: "half",
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "proxy error";
    return NextResponse.json({ error: `Reddit operator unreachable: ${msg}` }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*" },
  });
}
