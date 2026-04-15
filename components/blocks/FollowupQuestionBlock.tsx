"use client";

interface FollowupQuestionBlockProps {
  question: string | null;
}

export function FollowupQuestionBlock({ question }: FollowupQuestionBlockProps) {
  if (!question) return null;

  return (
    <div className="p-4 bg-[#00d97e]/[0.07] rounded-xl border border-[#00d97e]/20">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-[#00d97e] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-medium text-[#00d97e]/70 uppercase mb-1">
            One thing that would help
          </p>
          <p className="text-sm text-white/80 font-medium">{question}</p>
        </div>
      </div>
    </div>
  );
}
