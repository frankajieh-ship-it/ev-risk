import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL!);

async function checkReport() {
  const reportId = "531d703f-9435-47c0-ada1-1b4b802a109d";

  const result = await sql`
    SELECT id, status, created_at, paid_at, customer_email, vehicle_year, vehicle_model
    FROM reports
    WHERE id = ${reportId}
  `;

  console.log("Report lookup for:", reportId);
  if (result.length === 0) {
    console.log("❌ Report NOT found");
  } else {
    console.log("✅ Report found:");
    console.log("  - ID:", result[0].id);
    console.log("  - Status:", result[0].status);
    console.log("  - Created:", result[0].created_at);
    console.log("  - Paid at:", result[0].paid_at);
    console.log("  - Customer:", result[0].customer_email);
    console.log("  - Vehicle:", result[0].vehicle_year, result[0].vehicle_model);
  }

  process.exit(0);
}

checkReport();
