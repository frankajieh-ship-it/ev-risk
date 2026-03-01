/**
 * OFFO Extension Service Worker
 *
 * Handles messages from content scripts and extension lifecycle events.
 */

const OFFO_BASE = "https://offolab.com";

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.type === "open_receipt") {
    const url = encodeURIComponent(msg.url);
    chrome.tabs.create({
      url: `${OFFO_BASE}/receipt?url=${url}&ext=true`,
    });
  }
});

// On first install, open the extension welcome page
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: `${OFFO_BASE}/extension?installed=true`,
    });
    // Set default enabled state
    chrome.storage.local.set({ enabled: true });
  }
});
