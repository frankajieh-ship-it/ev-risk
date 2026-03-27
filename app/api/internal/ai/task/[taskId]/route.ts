/**
 * GET /api/internal/ai/task/[taskId]
 *
 * Returns the definition for a registered AI task — useful for inspection
 * and debugging without needing to run the task.
 *
 * Internal server-to-server only (INTERNAL_API_SECRET required).
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 5;

// Mirror of the TASKS registry from /api/internal/ai/run
// Kept as a lightweight read-only view (no actual provider calls here)
const TASK_REGISTRY: Record<string, {
  task_id: string;
  model: string;
  temperature: number;
  max_tokens: number;
  schema_name: string;
  description: string;
}> = {
  garage_news_relevance: {
    task_id: "garage_news_relevance",
    model: "grok",
    temperature: 0.1,
    max_tokens: 400,
    schema_name: "news_relevance",
    description: "Assess whether a news article is relevant to an EV owner's garage and routine",
  },
  buyer_profile_summary: {
    task_id: "buyer_profile_summary",
    model: "openai",
    temperature: 0.2,
    max_tokens: 600,
    schema_name: "buyer_profile_summary",
    description: "Generate anonymized buyer profile summary for dealer context",
  },
  pricing_explanation: {
    task_id: "pricing_explanation",
    model: "openai",
    temperature: 0.3,
    max_tokens: 400,
    schema_name: "pricing_explanation",
    description: "Produce a headline + why + action + caveats pricing recommendation",
  },
};

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (expected && secret === expected) return true;
  const serviceKey = req.headers.get("x-service-role-key");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  if (taskId === "_list") {
    return NextResponse.json({ tasks: Object.values(TASK_REGISTRY) });
  }

  const task = TASK_REGISTRY[taskId];
  if (!task) {
    return NextResponse.json(
      { error: `Unknown task: ${taskId}`, available: Object.keys(TASK_REGISTRY) },
      { status: 404 }
    );
  }

  return NextResponse.json({ task });
}
