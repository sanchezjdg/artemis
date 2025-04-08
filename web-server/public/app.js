// app.js
// Main entry point to initialize the application and set up mode switching.

// Import modules (ensure your server supports ES modules or use a bundler)
import { initMap, getMap, getMarker } from "./mapHandler.js";
import { startRealTimeUpdates } from "./realTimeMode.js";
import { initHistoricalMode } from "./historicalMode.js";
import { showToast } from "./toast.js";
import { formatDate } from "./utils.js";

// Initialize socket connection using Socket.IO.
const socket = io();
console.log("Connected to Socket.IO server.");

// Initialize the map.
initMap();

// Set initial visibility for the trace results area (hidden by default)
document.getElementById("trace-results").style.display = "none";

// Set up date inputs using current time.
const now = new Date();
const startValue = formatDate(
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0),
);
const endValue = formatDate(now);
document.getElementById("start-datetime").value = startValue;
document.getElementById("end-datetime").value = endValue;

// Initialize flatpickr date/time pickers.
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

// Set up mode switching buttons (Real-Time and Historical).
document.getElementById("real-time-btn").addEventListener("click", () => {
  // Hide historical form elements when switching to real-time.
  document.getElementById("historical-form").style.display = "none";
  // Start real-time updates.
  startRealTimeUpdates(socket);
  // Adjust UI controls.
  document.querySelector(".button-group").style.display = "flex";
  document.querySelector(".controls .mode-info").innerText =
    "Select the mode you want to use:";
  // Reset toast and any leftover notifications.
});

document.getElementById("historical-btn").addEventListener("click", () => {
  // Stop any active real-time updates if necessary.
  // Display the historical form.
  document.getElementById("historical-form").style.display = "block";
  // Update mode information text.
  document.querySelector(".controls .mode-info").innerText =
    "Select a date range and optionally enable trace mode:";
  // Initialize historical mode event handlers.
  initHistoricalMode();
});
