/**
 * OFFO Extension Popup
 *
 * Shows routine sync status and enable/disable toggle.
 */

const toggle = document.getElementById("enableToggle") as HTMLInputElement;
const routineCard = document.getElementById("routineCard") as HTMLDivElement;
const routineDetail = document.getElementById("routineDetail") as HTMLDivElement;

interface MinimumViableRoutine {
  charging_access?: string;
  weekly_miles?: number;
  longest_day_pattern?: string;
  [key: string]: unknown;
}

const ACCESS_LABELS: Record<string, string> = {
  home_l1: "Home L1 charger",
  home_l2: "Home L2 charger",
  work: "Workplace charging",
  public_only: "Public charging only",
};

// Load state
chrome.storage.local.get(["enabled", "offo_routine"], (result) => {
  toggle.checked = result.enabled !== false;

  const routine = result.offo_routine as MinimumViableRoutine | undefined;
  if (routine) {
    routineCard.classList.remove("missing");
    routineCard.classList.add("synced");
    const access = ACCESS_LABELS[routine.charging_access ?? ""] ?? routine.charging_access ?? "Unknown";
    const miles = routine.weekly_miles ? `${routine.weekly_miles} mi/wk` : null;
    const parts = [access, miles].filter(Boolean).join(" · ");
    routineDetail.textContent = `Routine synced · ${parts}`;
  } else {
    routineDetail.innerHTML = `
      No routine found.
      <a href="https://offolab.com/routine" target="_blank" class="routine-card-link">
        Complete setup at offolab.com →
      </a>
    `;
  }
});

// Save toggle state
toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: toggle.checked });
});
