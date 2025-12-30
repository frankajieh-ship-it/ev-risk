// Direct test of scoring logic (bypassing API)
import { calculateBuyConfidence } from './lib/scoring.ts';

const testInput1 = {
  model: "Tesla Model 3 Long Range",
  year: 2023,
  currentMileage: 10000,
  zipCode: "94102",
  dailyMiles: 30,
  homeCharging: true,
  riskTolerance: "moderate"
};

const testInput2 = {
  model: "Nissan Leaf",
  year: 2016,
  currentMileage: 120000,
  zipCode: "85001",
  dailyMiles: 80,
  homeCharging: false,
  riskTolerance: "conservative"
};

console.log("Test 1 - New Tesla:");
console.log(JSON.stringify(testInput1, null, 2));
try {
  const result1 = calculateBuyConfidence(testInput1);
  console.log("Score:", result1.overall_score);
  console.log("Rating:", result1.rating);
  console.log("");
} catch (error) {
  console.error("ERROR:", error.message);
}

console.log("\nTest 2 - Old Nissan Leaf:");
console.log(JSON.stringify(testInput2, null, 2));
try {
  const result2 = calculateBuyConfidence(testInput2);
  console.log("Score:", result2.overall_score);
  console.log("Rating:", result2.rating);
} catch (error) {
  console.error("ERROR:", error.message);
}
