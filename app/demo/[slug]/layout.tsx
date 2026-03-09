import { DEMO_METADATA, isDemoSlug } from "@/lib/demo-data";

interface DemoLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DemoLayoutProps) {
  const { slug } = await params;

  if (!isDemoSlug(slug)) {
    return {
      title: "Demo Not Found",
    };
  }

  const metadata = DEMO_METADATA[slug];

  return {
    title: `OFFO Demo - ${metadata.vehicle}`,
    description: `Sample EV risk analysis: ${metadata.routine}. ${metadata.key_insight}`,
  };
}

export default function DemoLayout({ children }: DemoLayoutProps) {
  return <>{children}</>;
}
