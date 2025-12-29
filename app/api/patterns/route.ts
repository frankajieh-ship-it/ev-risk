/**
 * Behavioral Pattern Tracking API
 *
 * Endpoints:
 * - POST /api/patterns - Submit a new behavioral pattern
 * - GET /api/patterns - Retrieve patterns (admin only)
 * - GET /api/patterns/analysis - Get aggregated insights (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { BehavioralPatternRecord } from "@/types/behavioralPatterns";

// In-memory storage for MVP (replace with database later)
// TODO: Move to Airtable/Notion/PostgreSQL for production
const patterns: BehavioralPatternRecord[] = [];

/**
 * POST /api/patterns
 * Submit a new behavioral pattern observation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.source || !body.user_context || !body.behavioral_pattern) {
      return NextResponse.json(
        { error: "Missing required fields: source, user_context, behavioral_pattern" },
        { status: 400 }
      );
    }

    // Generate ID
    const id = `bp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const pattern: BehavioralPatternRecord = {
      id,
      source: body.source,
      timestamp: body.timestamp || timestamp,
      source_url: body.source_url,
      user_context: body.user_context,
      behavioral_pattern: body.behavioral_pattern,
      tags: body.tags || [],
      behavioral_signal_tags: body.behavioral_signal_tags || [],
      extracted_by: body.extracted_by || "manual",
      notes: body.notes,
      created_at: timestamp,
      updated_at: timestamp,
    };

    // Store pattern
    patterns.push(pattern);

    console.log(`[Pattern Tracking] New pattern recorded: ${id}`, {
      source: pattern.source,
      housing: pattern.user_context.housing,
      ownership_stage: pattern.user_context.ownership_stage,
      cognitive_load: pattern.behavioral_pattern.cognitive_load_rating,
      tags: pattern.tags,
    });

    return NextResponse.json(
      {
        success: true,
        pattern_id: id,
        message: "Behavioral pattern recorded successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Pattern Tracking] Error recording pattern:", error);
    return NextResponse.json(
      { error: "Failed to record pattern", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/patterns
 * Retrieve all patterns (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminKey = searchParams.get("key");

    // Admin authentication
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional filters
    const source = searchParams.get("source");
    const housing = searchParams.get("housing");
    const ownership_stage = searchParams.get("ownership_stage");
    const tag = searchParams.get("tag");

    let filteredPatterns = [...patterns];

    if (source) {
      filteredPatterns = filteredPatterns.filter((p) => p.source === source);
    }
    if (housing) {
      filteredPatterns = filteredPatterns.filter(
        (p) => p.user_context.housing === housing
      );
    }
    if (ownership_stage) {
      filteredPatterns = filteredPatterns.filter(
        (p) => p.user_context.ownership_stage === ownership_stage
      );
    }
    if (tag) {
      filteredPatterns = filteredPatterns.filter((p) => p.tags.includes(tag as any));
    }

    return NextResponse.json({
      success: true,
      count: filteredPatterns.length,
      patterns: filteredPatterns,
    });
  } catch (error: any) {
    console.error("[Pattern Tracking] Error retrieving patterns:", error);
    return NextResponse.json(
      { error: "Failed to retrieve patterns", details: error.message },
      { status: 500 }
    );
  }
}
