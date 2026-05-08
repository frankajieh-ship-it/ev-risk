/**
 * Regression tests: CarGurus extractor must extract title_status, accidents_reported, and owners
 * from __NEXT_DATA__ JSON. If the extractor is broken or the field path changes, these fail.
 */

import { _testExports } from "@/lib/listing-scraper";

const { extractFromCarGurus } = _testExports;

function buildCarGurusHtml(listing: Record<string, unknown>): string {
  const nextData = {
    props: { pageProps: { listing } },
    page: "/vdp/[id]",
    query: {},
    buildId: "test",
  };
  return `<!DOCTYPE html><html><head>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
  </head><body></body></html>`;
}

describe("extractFromCarGurus — title status", () => {
  it("extracts clean title from titleStatus field", async () => {
    const html = buildCarGurusHtml({
      year: 2022, make: "Hyundai", model: "Ioniq 5",
      price: 32000, mileage: 18000,
      titleStatus: "CLEAN",
    });
    const data = await extractFromCarGurus(html);
    expect(data.title_status).toBe("clean");
  });

  it("extracts salvage title", async () => {
    const html = buildCarGurusHtml({
      year: 2021, make: "Tesla", model: "Model 3",
      price: 18000, mileage: 45000,
      titleStatus: "SALVAGE",
    });
    const data = await extractFromCarGurus(html);
    expect(data.title_status).toBe("salvage");
  });

  it("extracts rebuilt title from reconstructed value", async () => {
    const html = buildCarGurusHtml({
      year: 2020, make: "Chevrolet", model: "Bolt",
      titleStatus: "RECONSTRUCTED",
    });
    const data = await extractFromCarGurus(html);
    expect(data.title_status).toBe("rebuilt");
  });

  it("falls back to titleHistory.status", async () => {
    const html = buildCarGurusHtml({
      year: 2022, make: "Ford", model: "Mustang Mach-E",
      titleHistory: { status: "Clean Title" },
    });
    const data = await extractFromCarGurus(html);
    expect(data.title_status).toBe("clean");
  });
});

describe("extractFromCarGurus — accident history", () => {
  it("reports no accidents when accidentCount is 0", async () => {
    const html = buildCarGurusHtml({
      year: 2022, make: "Kia", model: "EV6",
      price: 28000, mileage: 12000,
      accidentCount: 0,
    });
    const data = await extractFromCarGurus(html);
    expect(data.accidents_reported).toBe("no");
  });

  it("reports accidents when accidentCount > 0", async () => {
    const html = buildCarGurusHtml({
      year: 2021, make: "Tesla", model: "Model Y",
      accidentCount: 1,
    });
    const data = await extractFromCarGurus(html);
    expect(data.accidents_reported).toBe("yes");
  });

  it("reports no accidents from hasAccidents = false", async () => {
    const html = buildCarGurusHtml({
      year: 2023, make: "BMW", model: "i4",
      hasAccidents: false,
    });
    const data = await extractFromCarGurus(html);
    expect(data.accidents_reported).toBe("no");
  });

  it("reports no accidents from hasAccidents = 'NO_ACCIDENTS'", async () => {
    const html = buildCarGurusHtml({
      year: 2022, make: "Volkswagen", model: "ID.4",
      hasAccidents: "NO_ACCIDENTS",
    });
    const data = await extractFromCarGurus(html);
    expect(data.accidents_reported).toBe("no");
  });

  it("reports accidents from hasAccidents = true", async () => {
    const html = buildCarGurusHtml({
      year: 2020, make: "Nissan", model: "Leaf",
      hasAccidents: true,
    });
    const data = await extractFromCarGurus(html);
    expect(data.accidents_reported).toBe("yes");
  });
});

describe("extractFromCarGurus — owner count", () => {
  it("extracts owner count from ownerCount", async () => {
    const html = buildCarGurusHtml({
      year: 2022, make: "Hyundai", model: "Ioniq 6",
      ownerCount: 1,
    });
    const data = await extractFromCarGurus(html);
    expect(data.owners).toBe(1);
  });

  it("extracts owner count from numberOfOwners", async () => {
    const html = buildCarGurusHtml({
      year: 2021, make: "Tesla", model: "Model 3",
      numberOfOwners: 2,
    });
    const data = await extractFromCarGurus(html);
    expect(data.owners).toBe(2);
  });

  it("does not set owners when count is 0 (invalid data)", async () => {
    const html = buildCarGurusHtml({
      year: 2022, make: "Kia", model: "EV6",
      ownerCount: 0,
    });
    const data = await extractFromCarGurus(html);
    expect(data.owners).toBeUndefined();
  });
});

describe("extractFromCarGurus — core fields", () => {
  it("extracts year, make, model, price, mileage from __NEXT_DATA__", async () => {
    const html = buildCarGurusHtml({
      year: 2022,
      make: "Hyundai",
      model: "Ioniq 5",
      trim: "SEL",
      price: 32500,
      mileage: 18200,
      vin: "KMHM34AC6NA123456",
    });
    const data = await extractFromCarGurus(html);
    expect(data.year).toBe(2022);
    expect(data.make).toBe("Hyundai");
    expect(data.model).toBe("Ioniq 5");
    expect(data.price).toBe(32500);
    expect(data.mileage).toBe(18200);
    expect(data.vin).toBe("KMHM34AC6NA123456");
  });
});
