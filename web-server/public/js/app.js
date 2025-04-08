// app.js
// Main entry point for initializing the application and setting up mode switching.

// Import modules (ensure your server supports ES modules or use a bundler)
import { initMap, getMap, getMarker, clearLayer } from "./mapHandler.js";
import { startRealTimeUpdates } from "./realTimeMode.js";
import { initHistoricalMode } from "./historicalMode.js";
import { formatDate, clearSearchCircle } from "./utils.js";

// Initialize socket connection using Socket.IO.
const socket = io();
console.log("Connected to Socket.IO server.");

// Initialize the map.
initMap();

// Hide the trace results area by default.
document.getElementById("trace-results").style.display = "none";

// Set up date inputs using the current time.
const now = new Date();
const startValue = formatDate(
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0),
);
const endValue = formatDate(now);
document.getElementById("start-datetime").value = startValue;
document.getElementById("end-datetime").value = endValue;

// Initialize flatpickr for date/time inputs.
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

// Set up mode switching buttons.
document.getElementById("real-time-btn").addEventListener("click", () => {
  // Clear any residual elements from previous modes.
  clearSearchCircle();
  // In case trace mode left a temporary marker, remove it.
  clearLayer(document.getElementById("trace-view-marker"));
  // Show real-time controls.
  document.getElementById("real-time-controls").style.display = "block";
  // Hide historical form.
  document.getElementById("historical-form").style.display = "none";
  // Start real-time updates.
  startRealTimeUpdates(socket);
  // Update the mode information.
  document.querySelector(".controls .mode-info").innerText =
    "Select the mode you want to use:";
});

document.getElementById("historical-btn").addEventListener("click", () => {
  // Clear real-time elements (like marker, search circles).
  clearLayer(getMarker());
  clearSearchCircle();
  // Hide real-time controls.
  document.getElementById("real-time-controls").style.display = "none";
  // Show the historical form.
  document.getElementById("historical-form").style.display = "block";
  // Update instructions for historical mode.
  document.querySelector(".controls .mode-info").innerText =
    "Select a date range and optionally enable trace mode:";
  // Initialize historical mode handlers.
  initHistoricalMode();
});
