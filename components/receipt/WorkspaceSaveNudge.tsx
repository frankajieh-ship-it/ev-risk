"use client";

interface WorkspaceSaveNudgeProps {
  onSignIn: () => void;
}

export default function WorkspaceSaveNudge({ onSignIn }: WorkspaceSaveNudgeProps) {
  return (
    <div data-tutorial="save-garage" className="rounded-xl border border-[#00d97e]/20 bg-[#00d97e]/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Save this analysis before you lose it</p>
          <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
            Create a free account to track this deal, compare listings, and get price-drop alerts.
          </p>
          <p className="text-xs text-white/25 mt-1.5">Results saved in this browser for now — sign in to keep them permanently.</p>
        </div>
        <button
          onClick={onSignIn}
          className="shrink-0 px-3 py-2 text-xs font-semibold bg-[#00d97e] text-[#0d1117] rounded-lg hover:bg-[#00c970] transition-colors whitespace-nowrap"
        >
          Save free — takes 30 sec →
        </button>
      </div>
    </div>
  );
}
