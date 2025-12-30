// Test the scoring API with different inputs to verify it returns different results

const testCases = [
  {
    name: "New Tesla Model 3, low miles, good conditions",
    data: {
      model: "Tesla Model 3 Long Range",
      year: 2023,
      currentMileage: 10000,
      zipCode: "94102", // San Francisco
      dailyMiles: 30,
      homeCharging: true,
      riskTolerance: "moderate"
    }
  },
  {
    name: "Old Nissan Leaf, high miles, hot climate, no home charging",
    data: {
      model: "Nissan Leaf",
      year: 2016,
      currentMileage: 120000,
      zipCode: "85001", // Phoenix AZ - extreme hot
      dailyMiles: 80,
      homeCharging: false,
      riskTolerance: "conservative"
    }
  },
  {
    name: "Mid-age Chevy Bolt, moderate miles, mild climate",
    data: {
      model: "Chevrolet Bolt EV",
      year: 2020,
      currentMileage: 45000,
      zipCode: "92101", // San Diego - mild
      dailyMiles: 40,
      homeCharging: true,
      riskTolerance: "moderate"
    }
  }
];

async function testScoring() {
  console.log("Testing EV-Risk Scoring Algorithm\n");
  console.log("=".repeat(80) + "\n");

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`Input: ${JSON.stringify(testCase.data, null, 2)}`);

    try {
      const response = await fetch("http://localhost:3000/api/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testCase.data),
      });

      const result = await response.json();

      if (!response.ok) {
        console.log(`❌ ERROR: ${result.error}`);
      } else {
        console.log(`✅ SUCCESS`);
        console.log(`Overall Score: ${result.confidence.overall_score}/100 (${result.confidence.rating})`);
        console.log(`Battery Risk: ${result.confidence.battery_risk.score}/100 - ${result.confidence.battery_risk.degradation_percent}% degradation`);
        console.log(`Platform Risk: ${result.confidence.platform_risk.score}/100`);
        console.log(`Ownership Fit: ${result.confidence.ownership_fit.score}/100`);
        console.log(`Recommendation: ${result.confidence.recommendation}`);
      }
    } catch (error) {
      console.log(`❌ FETCH ERROR: ${error.message}`);
    }

    console.log("\n" + "-".repeat(80) + "\n");
  }
}

// Run the test
testScoring().catch(console.error);
