import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.POSTGRES_URL!);

async function checkReport() {
  const reportId = "0a387a97-f9f0-4bbb-8c9f-6525015ffbfa";
  
  try {
    const result = await sql`
      SELECT id, status, paid_at, customer_email, vehicle_year, vehicle_model, created_at
      FROM reports
      WHERE id = ${reportId}
    `;
    
    console.log("Query result:", JSON.stringify(result, null, 2));
    console.log("Number of rows:", result.length);
    
    if (result.length > 0) {
      console.log("\nReport found:");
      console.log("- ID:", result[0].id);
      console.log("- Status:", result[0].status);
      console.log("- Paid at:", result[0].paid_at);
      console.log("- Customer email:", result[0].customer_email);
      console.log("- Vehicle:", result[0].vehicle_year, result[0].vehicle_model);
    } else {
      console.log("\nReport NOT found in database");
    }
  } catch (error) {
    console.error("Error:", error);
  }
  
  process.exit(0);
}

checkReport();
