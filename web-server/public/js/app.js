// app.js
// Main entry point for initializing the application and setting up mode switching.
// Import modules (ensure your server supports ES modules or use a bundler)
import { initMap } from "./mapHandler.js";
import { startRealTimeUpdates } from "./realTimeMode.js";
import { initHistoricalMode } from "./historicalMode.js";
import { clearRealTimePath } from "./realTimeMode.js";
import { formatDate } from "./utils.js";
import { stopRealTimeUpdates } from "./realTimeMode.js";

// Initialize socket connection using Socket.IO.
const socket = io();
console.log("Connected to Socket.IO server.");

// Initialize the map.
initMap();

// Set initial visibility for the trace results area (hidden by default)
document.getElementById("trace-results").style.display = "none";

// Set up date inputs using the current time.
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

// Set up active button color
function setActiveButton(activeId) {
  ["real-time-btn", "historical-btn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.remove("active");
    }
  });
  const activeBtn = document.getElementById(activeId);
  void activeBtn.offsetWidth;
  document.getElementById(activeId).classList.add("active");
}

// Default to real-time mode on page load
document.addEventListener("DOMContentLoaded", () => {
  // Show real-time controls and hide historical form.
  document.getElementById("real-time-controls").style.display = "block";
  document.getElementById("historical-form").style.display = "none";
  // Start real-time updates automatically
  startRealTimeUpdates(socket);
  setActiveButton("real-time-btn");
});

document.addEventListener("DOMContentLoaded", () => {
  const infoToggle = document.getElementById("info-toggle");
  const infoPanel = document.getElementById("info-panel");
  const closeInfo = document.getElementById("close-info");

  infoToggle.addEventListener("click", () => {
    // If already visible, hide it. Otherwise, show it.
    if (infoPanel.style.display === "block") {
      infoPanel.style.display = "none";
    } else {
      infoPanel.style.display = "block";
    }
  });

  closeInfo.addEventListener("click", () => {
    infoPanel.style.display = "none";
  });
});

// Set up mode switching buttons.
document.getElementById("real-time-btn").addEventListener("click", () => {
  // Show real-time controls and hide historical form.
  document.getElementById("real-time-controls").style.display = "block";
  document.getElementById("historical-form").style.display = "none";
  // Clear trace results and hide them
  document.getElementById("trace-results").style.display = "none";
  document.getElementById("trace-results").innerHTML = "";
  // Start real-time updates.
  startRealTimeUpdates(socket);
  setActiveButton("real-time-btn");
  // Update the mode information.
  document.querySelector(".controls .mode-info").innerText =
    "Select the mode you want to use:";
});

document.getElementById("historical-btn").addEventListener("click", () => {
  // Stop real time updates.
  socket.off("updateData");
  stopRealTimeUpdates(socket);   
  // Clear the real-time polyline.
  clearRealTimePath();
  // Hide real-time controls since auto-center is specific to real-time.
  document.getElementById("real-time-controls").style.display = "none";
  // Show the historical form.
  document.getElementById("historical-form").style.display = "block";
  // Update instructions for historical mode.
  document.querySelector(".controls .mode-info").innerText =
    "Select a date range and optionally enable trace mode:";
  // Initialize historical mode events.
  initHistoricalMode();
  setActiveButton("historical-btn");
});