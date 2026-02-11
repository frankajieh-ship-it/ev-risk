/**
 * Golden Set Tests — Receipt System
 *
 * Tests deterministic parts only (no OpenAI calls):
 * 1. Vehicle Classification (EV/PHEV/ICE + sub-category)
 * 2. Reddit Draft Rendering (3 modes)
 * 3. Linter — Verdict Language
 * 4. Linter — Banned Word ("annoying")
 * 5. Reddit Draft Schema Validation
 */

import { classifyVehicle } from "@/lib/vehicle-classifier";
import { getTemplatePack } from "@/lib/vehicle-category-templates";
import { renderRedditDraft } from "@/lib/reddit-draft-renderer";
import {
  lintReceiptRedditText,
  RedditDraftSchema,
} from "@/lib/receipt-schema-validator";

// ─── 1. Vehicle Classification ───

describe("classifyVehicle", () => {
  const cases: {
    make: string;
    model: string;
    trim?: string;
    expectedCategory: "EV" | "PHEV" | "ICE";
    expectedSub: string;
  }[] = [
    { make: "Tesla", model: "Model 3", expectedCategory: "EV", expectedSub: "other" },
    { make: "Tesla", model: "Model Y", expectedCategory: "EV", expectedSub: "suv" },
    { make: "Tesla", model: "Model X", expectedCategory: "EV", expectedSub: "suv" },
    { make: "Rivian", model: "R1T", expectedCategory: "EV", expectedSub: "truck" },
    { make: "Rivian", model: "R1S", expectedCategory: "EV", expectedSub: "suv" },
    { make: "Chevrolet", model: "Bolt EV", expectedCategory: "EV", expectedSub: "hatchback" },
    { make: "Ford", model: "Mustang Mach-E", expectedCategory: "EV", expectedSub: "suv" },
    { make: "Ford", model: "F-150 Lightning", expectedCategory: "EV", expectedSub: "truck" },
    { make: "Hyundai", model: "Ioniq 5", expectedCategory: "EV", expectedSub: "suv" },
    { make: "Kia", model: "EV6", expectedCategory: "EV", expectedSub: "suv" },
    { make: "Ford", model: "Focus Electric", expectedCategory: "EV", expectedSub: "hatchback" },
    { make: "Nissan", model: "Leaf", expectedCategory: "EV", expectedSub: "hatchback" },
    { make: "Toyota", model: "RAV4 Prime", expectedCategory: "PHEV", expectedSub: "suv" },
    { make: "Toyota", model: "Prius Prime", expectedCategory: "PHEV", expectedSub: "other" },
    { make: "Jeep", model: "Wrangler 4xe", expectedCategory: "PHEV", expectedSub: "suv" },
    { make: "Honda", model: "Civic", expectedCategory: "ICE", expectedSub: "other" },
    { make: "Toyota", model: "Camry", expectedCategory: "ICE", expectedSub: "other" },
    { make: "Ford", model: "F-150", expectedCategory: "ICE", expectedSub: "truck" },
    { make: "Toyota", model: "Tacoma", expectedCategory: "ICE", expectedSub: "truck" },
    { make: "Porsche", model: "Taycan", expectedCategory: "EV", expectedSub: "other" },
    // Trim-based detection
    { make: "Jeep", model: "Grand Cherokee", trim: "4xe", expectedCategory: "PHEV", expectedSub: "suv" },
    { make: "Unknown", model: "Unknown", trim: "Electric", expectedCategory: "EV", expectedSub: "other" },
  ];

  test.each(cases)(
    "$make $model ${trim} → $expectedCategory ($expectedSub)",
    ({ make, model, trim, expectedCategory, expectedSub }) => {
      const result = classifyVehicle(make, model, trim);
      expect(result.category).toBe(expectedCategory);
      expect(result.subCategory).toBe(expectedSub);
    }
  );

  test("keyword fallback from listing text — EV", () => {
    const result = classifyVehicle("Unknown", "SomeModel", null, "This is a fully electric vehicle with 300 kWh battery.");
    expect(result.category).toBe("EV");
    expect(result.confidence).toBe("medium");
  });

  test("keyword fallback from listing text — PHEV", () => {
    const result = classifyVehicle("Unknown", "SomeModel", null, "This is a plug-in hybrid with 40 miles electric range.");
    expect(result.category).toBe("PHEV");
    expect(result.confidence).toBe("medium");
  });

  test("default to ICE with low confidence", () => {
    const result = classifyVehicle("Unknown", "Unknown");
    expect(result.category).toBe("ICE");
    expect(result.confidence).toBe("low");
  });
});

// ─── 1b. Template Packs ───

describe("getTemplatePack", () => {
  test("EV pack includes battery focus areas", () => {
    const classification = classifyVehicle("Tesla", "Model 3");
    const pack = getTemplatePack(classification);
    expect(pack.category).toBe("EV");
    expect(pack.focusAreas.join(" ").toLowerCase()).toContain("battery");
  });

  test("ICE pack includes service history", () => {
    const classification = classifyVehicle("Honda", "Civic");
    const pack = getTemplatePack(classification);
    expect(pack.category).toBe("ICE");
    expect(pack.focusAreas.join(" ").toLowerCase()).toContain("service");
  });

  test("truck sub-category adds truck-specific focus areas", () => {
    const classification = classifyVehicle("Ford", "F-150");
    const pack = getTemplatePack(classification);
    expect(pack.focusAreas.join(" ").toLowerCase()).toContain("frame");
  });
});

// ─── 2. Reddit Draft Rendering ───

const SAMPLE_DRAFT = {
  title: "2013 Ford Focus Electric, 49k miles, $4,999 — thoughts on this deal?",
  body_facts: [
    "Listed at $4,999 with 49,385 miles in Midlothian, IL.",
    "Clean title, dealer sale, no accidents reported.",
  ],
  body_uncertainty: [
    "No battery health data provided — range degradation is unknown at 49k miles.",
  ],
  body_next_steps: [
    "Planning to ask for a battery health report before visiting.",
  ],
  questions: [
    "Has anyone owned a Focus Electric past 50k — how much range did you lose?",
    "Any common issues I should check for at this age and mileage?",
  ],
  style: { format: "short_paragraph" as const, max_questions: 2 },
};

describe("renderRedditDraft", () => {
  test("short_paragraph: title on first line", () => {
    const result = renderRedditDraft(SAMPLE_DRAFT, "short_paragraph");
    const lines = result.split("\n");
    expect(lines[0]).toBe(SAMPLE_DRAFT.title);
  });

  test("short_paragraph: contains body facts", () => {
    const result = renderRedditDraft(SAMPLE_DRAFT, "short_paragraph");
    expect(result).toContain("49,385 miles");
    expect(result).toContain("$4,999");
  });

  test("short_paragraph: contains questions", () => {
    const result = renderRedditDraft(SAMPLE_DRAFT, "short_paragraph");
    expect(result).toContain("Focus Electric past 50k");
  });

  test("standard: separate paragraphs for facts and uncertainty", () => {
    const result = renderRedditDraft(SAMPLE_DRAFT, "standard");
    expect(result).toContain("Clean title");
    expect(result).toContain("battery health data");
  });

  test("bullets: facts as bullet points", () => {
    const result = renderRedditDraft(SAMPLE_DRAFT, "bullets");
    expect(result).toContain("- Listed at");
    expect(result).toContain("- Clean title");
  });

  test("all modes stay under 900 chars", () => {
    for (const style of ["short_paragraph", "standard", "bullets"] as const) {
      const result = renderRedditDraft(SAMPLE_DRAFT, style);
      expect(result.length).toBeLessThanOrEqual(900);
    }
  });

  test("truncation works for long drafts", () => {
    const longDraft = {
      ...SAMPLE_DRAFT,
      body_facts: Array(5).fill(
        "This is a very long fact that repeats to create a long body text. The listing has many details worth noting. " +
        "Including the vehicle history, condition report, and comprehensive service records from the last decade."
      ),
    };
    const result = renderRedditDraft(longDraft, "short_paragraph");
    expect(result.length).toBeLessThanOrEqual(900);
  });
});

// ─── 3. Linter — Verdict Language ───

describe("lintReceiptRedditText — verdict language", () => {
  const bannedPhrases = [
    "This is a good deal for the price.",
    "I would say you should buy it immediately.",
    "This is a terrible deal, skip it.",
    "I'd lean toward passing on this one.",
    "Hard pass on this listing.",
    "I would lean toward buying.",
    "You should check the battery health.",
    "Must buy before someone else does.",
    "Steer you away from this listing.",
    "Avoid this dealer at all costs.",
  ];

  test.each(bannedPhrases)(
    "flags verdict language: %s",
    (text) => {
      const errors = lintReceiptRedditText(text);
      const verdictErrors = errors.filter((e) => e.code === "VERDICT_LANGUAGE");
      expect(verdictErrors.length).toBeGreaterThan(0);
    }
  );

  test("does NOT flag neutral text", () => {
    const neutralText =
      "Listed at $4,999 with 49,385 miles. Clean title, dealer sale. " +
      "Battery health is unknown — has anyone owned one past 50k miles?";
    const errors = lintReceiptRedditText(neutralText);
    const verdictErrors = errors.filter((e) => e.code === "VERDICT_LANGUAGE");
    expect(verdictErrors).toHaveLength(0);
  });
});

// ─── 4. Linter — Banned Word "annoying" ───

describe("lintReceiptRedditText — annoying", () => {
  test("flags 'annoying'", () => {
    const text = "The charging situation is annoying at best.";
    const errors = lintReceiptRedditText(text);
    const annoying = errors.filter((e) => e.code === "BANNED_WORD_ANNOYING");
    expect(annoying.length).toBe(1);
  });

  test("does NOT flag 'stressful'", () => {
    const text = "The charging situation is stressful at best.";
    const errors = lintReceiptRedditText(text);
    const annoying = errors.filter((e) => e.code === "BANNED_WORD_ANNOYING");
    expect(annoying).toHaveLength(0);
  });
});

// ─── 5. Reddit Draft Schema Validation ───

describe("RedditDraftSchema", () => {
  test("valid draft passes", () => {
    const result = RedditDraftSchema.safeParse(SAMPLE_DRAFT);
    expect(result.success).toBe(true);
  });

  test("rejects >2 questions", () => {
    const bad = {
      ...SAMPLE_DRAFT,
      questions: [
        "Question one about battery?",
        "Question two about range?",
        "Question three about charging?",
      ],
    };
    const result = RedditDraftSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("rejects empty title", () => {
    const bad = { ...SAMPLE_DRAFT, title: "Hi" };
    const result = RedditDraftSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("rejects zero body_facts", () => {
    const bad = { ...SAMPLE_DRAFT, body_facts: [] };
    const result = RedditDraftSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("rejects zero questions", () => {
    const bad = { ...SAMPLE_DRAFT, questions: [] };
    const result = RedditDraftSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("accepts 1 question", () => {
    const ok = {
      ...SAMPLE_DRAFT,
      questions: ["Has anyone owned a Focus Electric past 50k?"],
    };
    const result = RedditDraftSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });
});

// ─── 6. Linter — Question Mark Limit ───

describe("lintReceiptRedditText — question marks", () => {
  test("allows up to 2 question marks", () => {
    const text = "Is this a fair price? What about the battery health?";
    const errors = lintReceiptRedditText(text);
    const qErrors = errors.filter((e) => e.code === "TOO_MANY_QUESTIONS");
    expect(qErrors).toHaveLength(0);
  });

  test("flags 3+ question marks", () => {
    const text = "Is this fair? Battery ok? Service history? What about tires?";
    const errors = lintReceiptRedditText(text);
    const qErrors = errors.filter((e) => e.code === "TOO_MANY_QUESTIONS");
    expect(qErrors.length).toBeGreaterThan(0);
  });
});
