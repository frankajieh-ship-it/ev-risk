/**
 * POST /api/admin/news/generate-posts
 *
 * Generates X thread / Facebook / Reddit posts from top scored news articles.
 * Uses Grok grok-3-mini — same prompt and output schema as tools/news-engine/post_generator.py.
 *
 * Body: { articles: Article[] }
 * Returns: { x_thread: [{tweet, text}], facebook: {text, suggested_image_prompt}, reddit: {title, body} }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const POST_SYSTEM = `You are OFFO's content writer. OFFO is an EV friction analysis platform at offolab.com that helps people understand real-world EV ownership challenges: charging access, battery daily use, routine fit.

OFFO voice: calm, analytical, never hype, never evangelical. Like a knowledgeable EV owner helping their community understand what actually matters in daily ownership.

Given today's top routine-impact EV news, write:
1. An X (Twitter) thread: 3-5 tweets, max 280 chars each
2. A Facebook post: warm, helpful tone, 100-200 words
3. A Reddit post: title + body for r/electricvehicles or r/EVRoutine (first-person community voice, not marketing)

Rules:
- Focus on how each story affects real daily ownership — not specs or politics
- Include offolab.com/receipt or offolab.com/routine only when it naturally solves the problem described (max once total across all three posts)
- No hype. No "game changer". No "revolutionary". No "exciting news". Just useful, grounded analysis.
- Reddit body should sound like a community member, not a brand

Output ONLY valid JSON (no markdown fences):
{
  "x_thread": [
    {"tweet": 1, "text": "..."},
    {"tweet": 2, "text": "..."}
  ],
  "facebook": {
    "text": "...",
    "suggested_image_prompt": "..."
  },
  "reddit": {
    "title": "...",
    "body": "..."
  }
}`;

const ArticleSchema = z.object({
  title: z.string().max(500),
  url: z.url(),
  source: z.string().max(100).optional(),
  impact_score: z.number().min(0).max(100).optional(),
  ai_summary: z.string().max(1000).optional(),
  summary: z.string().max(1000).optional(),
});

const RequestSchema = z.object({
  articles: z.array(ArticleSchema).min(1).max(20),
});

export async function POST(req: NextRequest) {
  const grokKey = process.env.GROK_API_KEY;
  if (!grokKey) {
    return NextResponse.json({ error: "GROK_API_KEY not configured" }, { status: 503 });
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: z.flattenError(parsed.error) }, { status: 400 });
  }
  const { articles } = parsed.data;

  // Build compact digest of top articles (same as Python post_generator.py)
  const digestLines = articles.slice(0, 10).map((a, i) => {
    const summary = a.ai_summary || a.summary || "";
    return `${i + 1}. [${a.impact_score ?? 0}/100] ${a.title}\n   Routine effect: ${summary.slice(0, 150)}`;
  });
  const digest = `Today's top routine-impact EV news (sorted by impact score):\n\n${digestLines.join("\n\n")}`;

  try {
    const grokResp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${grokKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        temperature: 0.4,
        max_tokens: 1500,
        messages: [
          { role: "system", content: POST_SYSTEM },
          { role: "user", content: digest },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!grokResp.ok) {
      const errText = await grokResp.text();
      return NextResponse.json({ error: `Grok API error: ${errText.slice(0, 200)}` }, { status: 502 });
    }

    const grokData = await grokResp.json();
    let raw: string = grokData.choices?.[0]?.message?.content ?? "";

    // Strip markdown fences if Grok wraps output
    raw = raw.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");

    const posts = JSON.parse(raw);
    return NextResponse.json(posts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Post generation failed: ${message}` }, { status: 500 });
  }
}
