import Link from "next/link";
import { BarChart2, MessageSquare, Zap, type LucideIcon } from "lucide-react";

const PILLARS: { icon: LucideIcon; color: string; title: string; body: string }[] = [
  {
    icon: BarChart2,
    color: "bg-blue-100 text-blue-600",
    title: "Listing signals + market comps",
    body: "We cross-check price, listed features, and history against real comparable listings in your area.",
  },
  {
    icon: MessageSquare,
    color: "bg-green-100 text-green-600",
    title: "Seller questions, not just a score",
    body: "Every analysis surfaces the 3 questions that actually move negotiations — not just a number.",
  },
  {
    icon: Zap,
    color: "bg-amber-100 text-amber-600",
    title: "Built for EV-specific risk",
    body: "Battery health, charging friction, and ownership cost flags that generic car tools miss entirely.",
  },
];

export default function WhyTrustOffo() {
  return (
    <section className="py-14 md:py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Why buyers trust OFFO</h2>
          <p className="text-gray-500 text-base">We help you decide, not just score a listing</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PILLARS.map(({ icon: Icon, color, title, body }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/methodology" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            How we build our analysis →
          </Link>
        </div>
      </div>
    </section>
  );
}
