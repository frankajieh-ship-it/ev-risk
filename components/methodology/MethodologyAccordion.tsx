"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AccordionItem } from "@/content/methodology";

interface Props {
  items: AccordionItem[];
}

export default function MethodologyAccordion({ items }: Props) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] overflow-hidden">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id}>
            <button
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              aria-controls={`methodology-${item.id}`}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-sm font-semibold text-white">{item.title}</span>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-white/30 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
              )}
            </button>
            {isOpen && (
              <div id={`methodology-${item.id}`} className="px-5 pb-5">
                <p className="text-sm text-white/50 leading-relaxed">{item.body}</p>
                {item.note && (
                  <p className="mt-3 text-xs text-white/30 italic">{item.note}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
