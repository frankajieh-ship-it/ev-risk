/**
 * OFFO Extension Popup
 *
 * Simple settings popup with enable/disable toggle.
 */

const toggle = document.getElementById("enableToggle") as HTMLInputElement;

// Load current state
chrome.storage.local.get(["enabled"], (result) => {
  toggle.checked = result.enabled !== false; // Default: enabled
});

// Save on toggle change
toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: toggle.checked });
});
