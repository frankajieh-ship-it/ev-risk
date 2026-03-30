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
    <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id}>
            <button
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-900">{item.title}</span>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-5 pb-5">
                <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
                {item.note && (
                  <p className="mt-3 text-xs text-gray-400 italic">{item.note}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
