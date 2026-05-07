/**
 * POST /api/admin/trigger-news-engine
 *
 * Triggers the GitHub Actions "OFFO Daily News Engine" workflow via
 * workflow_dispatch. Requires GITHUB_TOKEN + GITHUB_REPO env vars.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO; // e.g. "frankajieh-ship-it/ev-risk"

  if (!githubToken || !githubRepo) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN and GITHUB_REPO must be set in environment variables" },
      { status: 500 }
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${githubRepo}/actions/workflows/daily-news-engine.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (res.status === 204) {
    return NextResponse.json({ ok: true, message: "News engine triggered — articles will appear in ~5 min" });
  }

  const body = await res.text();
  console.error("[trigger-news-engine] GitHub API error:", res.status, body);
  return NextResponse.json(
    { error: `GitHub API returned ${res.status}: ${body}` },
    { status: 502 }
  );
}
