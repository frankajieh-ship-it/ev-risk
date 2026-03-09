/**
 * Demo Report Display Page
 *
 * Displays a demo EV risk analysis using the exact same ResultPageV2Split component
 * as real reports. Includes demo banner and CTA to convert to real usage.
 */

import { notFound } from "next/navigation";
import { isDemoSlug } from "@/lib/demo-data";
import DemoReportClient from "./DemoReportClient";

interface DemoReportPageProps {
  params: Promise<{ slug: string }>;
}

// Server component wrapper to unwrap params
export default async function DemoReportPage({ params }: DemoReportPageProps) {
  const { slug } = await params;

  // Validate slug
  if (!isDemoSlug(slug)) {
    notFound();
  }

  return <DemoReportClient slug={slug} />;
}
