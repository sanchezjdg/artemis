// app.js
// Main entry point for initializing the application and setting up mode switching.

// Import modules
import { initMap, getMap, getMarker, clearLayer } from "./mapHandler.js";
import {
  startRealTimeUpdates,
  getLastRealTimePosition,
} from "./realTimeMode.js";
import { initHistoricalMode } from "./historicalMode.js";
import { formatDate, clearSearchCircle } from "./utils.js";
import { showToast } from "./toast.js";

// Initialize socket connection using Socket.IO.
const socket = io();
console.log("Connected to Socket.IO server.");

// Initialize the map.
initMap();

// Hide trace results area by default.
document.getElementById("trace-results").style.display = "none";

// Set up date inputs using the current time.
const now = new Date();
const startValue = formatDate(
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0),
);
const endValue = formatDate(now);
document.getElementById("start-datetime").value = startValue;
document.getElementById("end-datetime").value = endValue;

// Initialize flatpickr.
flatpickr("#start-datetime", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  defaultDate: startValue,
  maxDate: "today",
});
flatpickr("#end-datetime", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  defaultDate: endValue,
  maxDate: "today",
});

/**
 * Utility to set the active mode button.
 * @param {string} activeId - The ID of the button to set as active.
 */
function setActiveButton(activeId) {
  ["real-time-btn", "historical-btn"].forEach((id) => {
    const btn = document.getElementById(id);
    btn.classList.remove("active");
  });
  document.getElementById(activeId).classList.add("active");
}

// Set up mode switching buttons.
document.getElementById("real-time-btn").addEventListener("click", () => {
  // Clear elements from other modes.
  clearSearchCircle();
  clearLayer(document.getElementById("trace-view-marker")); // clear trace marker if exists
  // Show real-time controls, hide historical form.
  document.getElementById("real-time-controls").style.display = "block";
  document.getElementById("historical-form").style.display = "none";
  // Update active button.
  setActiveButton("real-time-btn");
  // Start real-time updates.
  startRealTimeUpdates(socket);
  // If a last real-time position exists, center on it.
  const lastPos = getLastRealTimePosition();
  if (lastPos) {
    getMap().setView(lastPos, 15, { animate: true });
  }
  // Update instruction guide text if needed.
  document.getElementById("mode-info-text").innerText =
    "Real Time Mode: Live tracking of current position.";
});

document.getElementById("historical-btn").addEventListener("click", () => {
  // Clear real-time artifacts.
  clearLayer(getMarker());
  clearSearchCircle();
  // Hide real-time controls, show historical form.
  document.getElementById("real-time-controls").style.display = "none";
  document.getElementById("historical-form").style.display = "block";
  // Update active button.
  setActiveButton("historical-btn");
  // Initialize historical mode events.
  initHistoricalMode();
  // Update guide text.
  document.getElementById("mode-info-text").innerText =
    "Historical Mode: Load routes by time range. Optionally enable Trace Mode.";
});

// Guide button (info) event listener.
document.getElementById("guide-button").addEventListener("click", () => {
  const guideText = `Usage Instructions:
• Real Time Mode:
  - Displays live tracking data from the server.
  - The Auto-center option centers the map on the latest position.
• Historical Mode:
  - Select a start and end datetime and click 'Load Route' to load a historical route.
  - Check 'Enable Trace Mode' to click on the map for details on specific points.
• Trace Mode (within Historical Mode):
  - Clicking on the map shows nearby recorded points.
  - Click 'View' to place a marker at that point with further details.`;
  showToast(guideText, 6000);
});
