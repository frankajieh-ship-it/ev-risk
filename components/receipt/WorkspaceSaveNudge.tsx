"use client";

interface WorkspaceSaveNudgeProps {
  onSignIn: () => void;
}

export default function WorkspaceSaveNudge({ onSignIn }: WorkspaceSaveNudgeProps) {
  return (
    <div data-tutorial="save-garage" className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white/70">Track this deal over time</p>
        <p className="text-xs text-white/30 mt-0.5">Create a free account to save receipts, compare EVs, and get deal alerts.</p>
      </div>
      <button
        onClick={onSignIn}
        className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-[#00d97e] text-[#0d1117] rounded-lg hover:bg-[#00c970] transition-colors"
      >
        Save free
      </button>
    </div>
  );
}
