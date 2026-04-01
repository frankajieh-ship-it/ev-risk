"use client";

import { useEffect, useRef } from "react";

interface Props {
  diagram: string;
  id: string;
  className?: string;
}

export default function MermaidDiagram({ diagram, id, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then((mod) => {
      if (cancelled) return;
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
      mermaid.render(id, diagram).then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      }).catch((err) => {
        console.warn("[MermaidDiagram] render error:", err);
      });
    });
    return () => { cancelled = true; };
  }, [diagram, id]);

  return (
    <div
      ref={ref}
      id={`mermaid-container-${id}`}
      className={className ?? "overflow-x-auto my-8 rounded-xl border border-gray-200 bg-gray-50 p-4"}
      aria-label="Pipeline diagram"
    />
  );
}
