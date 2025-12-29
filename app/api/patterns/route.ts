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
import fs from "fs";
import path from "path";

// File-based storage for persistence (local development only)
const PATTERNS_FILE = path.join(process.cwd(), "data", "patterns.json");

// In-memory fallback for serverless environments (Vercel, Netlify, etc.)
let inMemoryPatterns: BehavioralPatternRecord[] = [];

// Lazy-evaluated serverless detection
let _isServerless: boolean | null = null;

function isServerless(): boolean {
  if (_isServerless !== null) return _isServerless;

  // Check environment variables first
  if (process.env.VERCEL || process.env.NETLIFY) {
    _isServerless = true;
    return true;
  }

  // Test if we can write to file system
  try {
    const testDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const testFile = path.join(testDir, ".write-test");
    fs.writeFileSync(testFile, "test", "utf-8");
    fs.unlinkSync(testFile);
    _isServerless = false;
    return false;
  } catch {
    _isServerless = true;
    return true;
  }
}

// Ensure data directory exists (only works in non-serverless environments)
function ensureDataDirectory() {
  if (isServerless()) return;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load patterns from file (or in-memory fallback)
function loadPatterns(): BehavioralPatternRecord[] {
  if (isServerless()) {
    console.log("[Pattern Storage] Using in-memory storage (serverless environment)");
    return inMemoryPatterns;
  }

  ensureDataDirectory();

  if (!fs.existsSync(PATTERNS_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(PATTERNS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("[Pattern Storage] Error loading patterns:", error);
    return [];
  }
}

// Save patterns to file (or in-memory fallback)
function savePatterns(patterns: BehavioralPatternRecord[]) {
  if (isServerless()) {
    inMemoryPatterns = patterns;
    console.log(`[Pattern Storage] Saved ${patterns.length} patterns to in-memory storage`);
    console.warn("[Pattern Storage] ⚠️  WARNING: Using in-memory storage. Data will be lost on server restart. Please configure a database for production.");
    return;
  }

  ensureDataDirectory();

  try {
    const jsonData = JSON.stringify(patterns, null, 2);
    fs.writeFileSync(PATTERNS_FILE, jsonData, "utf-8");
    console.log(`[Pattern Storage] Successfully saved ${patterns.length} patterns to ${PATTERNS_FILE}`);
  } catch (error: any) {
    console.error("[Pattern Storage] Error saving patterns:", error);
    console.error("[Pattern Storage] File path:", PATTERNS_FILE);
    console.error("[Pattern Storage] Working directory:", process.cwd());
    throw new Error(`Failed to write patterns file: ${error.message}`);
  }
}

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
    try {
      const patterns = loadPatterns();
      patterns.push(pattern);
      savePatterns(patterns);

      console.log(`[Pattern Tracking] New pattern recorded: ${id}`, {
        source: pattern.source,
        housing: pattern.user_context.housing,
        ownership_stage: pattern.user_context.ownership_stage,
        cognitive_load: pattern.behavioral_pattern.cognitive_load_rating,
        tags: pattern.tags,
      });
    } catch (storageError: any) {
      console.error("[Pattern Tracking] Storage error:", storageError);
      console.error("[Pattern Tracking] Pattern data:", JSON.stringify(pattern, null, 2));
      throw new Error(`Storage failed: ${storageError.message}`);
    }

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

    const patterns = loadPatterns();
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
