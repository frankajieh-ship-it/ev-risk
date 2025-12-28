// Test script to debug AutoTrader extraction
const url = "https://www.autotrader.com/cars-for-sale/used-cars?ds_rl=1294008&gclid=6897496cc60f1b8fc5cc203da70a11ea&gclsrc=3p.ds&LNX=SPBINGNONBRANDBODYSTYLE&msclkid=6897496cc60f1b8fc5cc203da70a11ea&utm_campaign=at_na_na_national_evergreen_roi_na_na&utm_content=na_na_na_na_na_spbingnonbrandbodystyle_na&utm_medium=sem_non-brand_perf&utm_source=MICROSOFT&utm_term=used%20electric%20cars";

async function testExtraction() {
  console.log("Fetching:", url);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  console.log("Status:", response.status);
  console.log("Status Text:", response.statusText);

  const html = await response.text();
  console.log("\n--- HTML Length:", html.length, "---");

  // Test title extraction
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    console.log("\n✓ Title found:", titleMatch[1]);
  } else {
    console.log("\n✗ Title NOT found");
  }

  // Test meta description extraction
  const metaMatch = html.match(/property="og:description"\s+content="([^"]+)"/i);
  if (metaMatch) {
    console.log("\n✓ Meta description:", metaMatch[1]);
  } else {
    console.log("\n✗ Meta description NOT found");
  }

  // Test mileage pattern 1: "with X miles"
  const metaMileageMatch = html.match(/with\s+(\d+(?:,\d{3})*)\s+miles/i);
  if (metaMileageMatch) {
    console.log("\n✓ Mileage (meta pattern):", metaMileageMatch[1]);
  } else {
    console.log("\n✗ Mileage (meta pattern) NOT found");
  }

  // Test mileage pattern 2: Structured "Mileage:</span><span>X mi</span>"
  const mileageStructured = html.match(/Mileage[^>]*>[\s\S]{0,100}?(\d+(?:,\d{3})*)\s*mi/i);
  if (mileageStructured) {
    console.log("\n✓ Mileage (structured):", mileageStructured[1]);
  } else {
    console.log("\n✗ Mileage (structured) NOT found");
  }

  // Show a snippet of HTML around "Mileage"
  const mileageIndex = html.indexOf("Mileage");
  if (mileageIndex > 0) {
    const snippet = html.substring(mileageIndex, mileageIndex + 200);
    console.log("\n--- HTML snippet around 'Mileage' ---");
    console.log(snippet);
  }

  // Check if we got any useful data
  console.log("\n--- First 500 chars of HTML ---");
  console.log(html.substring(0, 500));
}

testExtraction().catch(console.error);
