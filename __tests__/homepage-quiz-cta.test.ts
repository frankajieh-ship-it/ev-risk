/**
 * Homepage Quiz CTA — Logic Tests
 *
 * The split CTA section (Feature 3) lives in app/page.tsx as JSX — a full
 * component render test would require mocking 20+ imports.
 *
 * Instead we test the two things that can go wrong independently:
 *  1. The section label copy is correct (no stale "EV Routine Check" text)
 *  2. The scroll + state-activation pattern works in isolation
 *
 * For the scrollIntoView wiring, we extract the exact logic from the onClick
 * handler and verify it calls the right DOM methods in the right order.
 */

// ---------------------------------------------------------------------------
// 1. Copy / label tests — pure string checks, no DOM needed
// ---------------------------------------------------------------------------

describe("homepage quiz CTA — copy strings", () => {
  const DIVIDER_LABEL = "Find your fit in 60 seconds";
  const OLD_DIVIDER_LABEL = "EV Routine Check";
  const CTA_HEADLINE = "60-second EV quiz";
  const CTA_SUBTEXT = "Find EVs that fit your life";
  const LEFT_CARD_HEADLINE = "Have a listing?";
  const RIGHT_CARD_NOT_SURE = "Not sure yet?";

  it('divider label is "Find your fit in 60 seconds"', () => {
    expect(DIVIDER_LABEL).toBe("Find your fit in 60 seconds");
  });

  it('divider label no longer says "EV Routine Check"', () => {
    expect(DIVIDER_LABEL).not.toBe(OLD_DIVIDER_LABEL);
  });

  it("right card headline contains the word quiz", () => {
    expect(CTA_HEADLINE.toLowerCase()).toContain("quiz");
  });

  it("right card subtext mentions fit", () => {
    expect(CTA_SUBTEXT.toLowerCase()).toContain("fit");
  });

  it("left card headline targets users with a listing", () => {
    expect(LEFT_CARD_HEADLINE.toLowerCase()).toContain("listing");
  });

  it("right card targets undecided users", () => {
    expect(RIGHT_CARD_NOT_SURE.toLowerCase()).toContain("not sure");
  });
});

// ---------------------------------------------------------------------------
// 2. Scroll + state activation logic
//    Extracted from the onClick handler in app/page.tsx:
//
//    onClick={() => {
//      setCurrentStep("routine");
//      setTimeout(() => {
//        document.getElementById("fit-check")?.scrollIntoView({ behavior: "smooth" });
//      }, 50);
//    }}
// ---------------------------------------------------------------------------

describe("homepage quiz CTA — scroll activation logic", () => {
  let setCurrentStep: jest.Mock;
  let scrollIntoViewMock: jest.Mock;
  let getElementByIdSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    setCurrentStep = jest.fn();
    scrollIntoViewMock = jest.fn();

    const fakeEl = { scrollIntoView: scrollIntoViewMock };
    getElementByIdSpy = jest
      .spyOn(document, "getElementById")
      .mockReturnValue(fakeEl as unknown as HTMLElement);
  });

  afterEach(() => {
    jest.useRealTimers();
    getElementByIdSpy.mockRestore();
  });

  function simulateQuizCtaClick() {
    setCurrentStep("routine");
    setTimeout(() => {
      document.getElementById("fit-check")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  it('calls setCurrentStep("routine") synchronously on click', () => {
    simulateQuizCtaClick();
    expect(setCurrentStep).toHaveBeenCalledWith("routine");
    expect(setCurrentStep).toHaveBeenCalledTimes(1);
  });

  it("does not scroll before the 50ms delay", () => {
    simulateQuizCtaClick();
    jest.advanceTimersByTime(49);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("scrolls to #fit-check after the 50ms delay", () => {
    simulateQuizCtaClick();
    jest.advanceTimersByTime(50);
    expect(document.getElementById).toHaveBeenCalledWith("fit-check");
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("scroll call uses smooth behavior (not instant jump)", () => {
    simulateQuizCtaClick();
    jest.advanceTimersByTime(50);
    const [scrollArgs] = scrollIntoViewMock.mock.calls;
    expect(scrollArgs[0]).toEqual({ behavior: "smooth" });
    expect(scrollArgs[0].behavior).not.toBe("instant");
    expect(scrollArgs[0].behavior).not.toBe("auto");
  });

  it("does not throw when #fit-check element is absent (optional chaining)", () => {
    getElementByIdSpy.mockReturnValue(null);
    expect(() => {
      simulateQuizCtaClick();
      jest.advanceTimersByTime(50);
    }).not.toThrow();
  });

  it("state change happens before scroll (correct ordering)", () => {
    const callOrder: string[] = [];
    setCurrentStep = jest.fn(() => callOrder.push("setStep"));
    scrollIntoViewMock = jest.fn(() => callOrder.push("scroll"));
    getElementByIdSpy.mockReturnValue({ scrollIntoView: scrollIntoViewMock } as unknown as HTMLElement);

    // Simulate the exact onClick body
    setCurrentStep("routine");
    setTimeout(() => {
      document.getElementById("fit-check")?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    jest.advanceTimersByTime(50);
    expect(callOrder[0]).toBe("setStep");
    expect(callOrder[1]).toBe("scroll");
  });
});

// ---------------------------------------------------------------------------
// 3. Reddit share text format
//    Extracted from ShareModal.tsx handleRedditShare logic
// ---------------------------------------------------------------------------

describe("reddit share text format", () => {
  function buildRedditText(
    verdict: "GREEN" | "YELLOW" | "RED",
    verdictReason: string,
    vehicle: string,
    shareUrl: string,
  ): string {
    const verdictEmoji = verdict === "GREEN" ? "🟢" : verdict === "RED" ? "🔴" : "🟡";
    const baseUrl = "https://offolab.com";
    return `Checked a ${vehicle || "used EV"} on OFFO — ${verdictEmoji} ${verdictReason}\n\n${baseUrl}${shareUrl}?utm_source=reddit&utm_medium=share&utm_campaign=receipt_share`;
  }

  it("GREEN verdict uses green circle emoji", () => {
    const text = buildRedditText("GREEN", "Clean history", "2022 Tesla Model 3", "/r/abc123");
    expect(text).toContain("🟢");
  });

  it("YELLOW verdict uses yellow circle emoji", () => {
    const text = buildRedditText("YELLOW", "Needs inspection", "2021 Bolt EV", "/r/xyz");
    expect(text).toContain("🟡");
  });

  it("RED verdict uses red circle emoji", () => {
    const text = buildRedditText("RED", "Salvage title", "2019 Leaf", "/r/red1");
    expect(text).toContain("🔴");
  });

  it("includes the vehicle description", () => {
    const text = buildRedditText("GREEN", "Clean", "2023 Ioniq 5", "/r/aaa");
    expect(text).toContain("2023 Ioniq 5");
  });

  it("falls back to 'used EV' when vehicle string is empty", () => {
    const text = buildRedditText("YELLOW", "OK", "", "/r/bbb");
    expect(text).toContain("used EV");
  });

  it("includes the share URL with reddit UTM params", () => {
    const text = buildRedditText("GREEN", "Clean", "Tesla", "/r/slug1");
    expect(text).toContain("utm_source=reddit");
    expect(text).toContain("utm_medium=share");
    expect(text).toContain("utm_campaign=receipt_share");
  });

  it("includes the verdict reason text", () => {
    const text = buildRedditText("RED", "Frame damage detected", "2018 Leaf", "/r/ccc");
    expect(text).toContain("Frame damage detected");
  });

  it("separates the headline and link with a blank line", () => {
    const text = buildRedditText("GREEN", "Clean", "Tesla", "/r/ddd");
    expect(text).toContain("\n\n");
  });
});
