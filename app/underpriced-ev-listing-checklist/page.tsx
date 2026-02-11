/**
 * SEO Page: Underpriced EV Listing Checklist
 *
 * /underpriced-ev-listing-checklist
 * Server component wrapper with static metadata for SEO.
 */

import type { Metadata } from "next";
import ChecklistPageClient from "./ChecklistPageClient";

export const metadata: Metadata = {
  title: "Underpriced EV Listing Checklist",
  description:
    "Found a used EV listing that seems too cheap? Use this free checklist to verify the deal before you message the seller.",
  openGraph: {
    title: "Underpriced EV Listing Checklist | OFFO",
    description:
      "Found a used EV listing that seems too cheap? Use this free checklist to verify the deal before you message the seller.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Underpriced EV Listing Checklist | OFFO",
    description:
      "Found a used EV listing that seems too cheap? Use this free checklist to verify the deal before you message the seller.",
  },
};

export default function ChecklistPage() {
  return <ChecklistPageClient />;
}
