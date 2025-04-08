// Initialize Socket.IO connection and log the connection status.
const socket = io();
console.log("Connected to Socket.IO server.");

// Hide trace-results element if it exists (optional as trace-specific UI is removed).
const traceResultsEl = document.getElementById("trace-results");
if (traceResultsEl) {
  traceResultsEl.style.display = "none";
}

// Initialize Leaflet map and set default view.
const map = L.map("map").setView([0, 0], 2);

// Add OpenStreetMap tiles.
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Create a marker for the real-time mode.
let marker = L.marker([0, 0]).addTo(map);

// Array to store coordinates in real-time mode.
const realTimeCoordinates = [];

// Variable for holding a polyline that represents the real-time route.
let realTimePath = L.polyline([], {
  color: "#3b65ff",
  weight: 4,
  opacity: 0.8,
  lineJoin: "round",
}).addTo(map);

// Variables for historical mode.
// In the new merged version, trace (search within historical data) is part of the historical mode.
let historicalMarkers = []; // Array to hold marker objects for historical data.
let historicalPath = null; // (Optional) Kept here if you want to later add a polyline.
let isRealTime = true; // Flag to differentiate real-time from historical modes.

let lastStartDate = "";
let lastEndDate = "";

// Utility function to clear a layer from the map.
function clearLayer(layer) {
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
}

// Utility function to clear all historical markers.
function clearHistoricalMarkers() {
  historicalMarkers.forEach((m) => {
    clearLayer(m);
  });
  historicalMarkers = [];
}

// Format date and time functions.
const now = new Date();
const pad = (n) => n.toString().padStart(2, "0");
const formatDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;

const startValue = formatDate(
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0),
);
const endValue = formatDate(now);

document.getElementById("start-datetime").value = startValue;
document.getElementById("end-datetime").value = endValue;

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

// Utility to set an "active" class on the selected mode button.
function setActiveButton(activeId) {
  ["real-time-btn", "historical-btn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.remove("active");
    }
  });
  document.getElementById(activeId).classList.add("active");
}

/* ============================
   REAL-TIME MODE CONFIGURATION
=============================== */
document.getElementById("real-time-btn").addEventListener("click", () => {
  // Ensure any historical UI elements are cleared.
  if (traceResultsEl) {
    traceResultsEl.innerHTML = "";
    traceResultsEl.style.display = "none";
  }

  isRealTime = true;

  // Hide historical form if visible.
  document.getElementById("historical-form").style.display = "none";

  clearLayer(historicalPath);
  historicalPath = null;

  // Reset real-time path and coordinates.
  clearLayer(realTimePath);
  realTimeCoordinates.length = 0;
  realTimePath = L.polyline([], {
    color: "#3b65ff",
    weight: 4,
    opacity: 0.8,
    lineJoin: "round",
  }).addTo(map);

  // Add the marker to the map.
  marker.addTo(map);

  setActiveButton("real-time-btn");

  // Show any controls or instructions specific to real-time mode.
  document.querySelector(".button-group").style.display = "flex";
  document.querySelector(".controls .mode-info").style.display = "block";
  map.closePopup();
});

/* ============================
   HISTORICAL MODE CONFIGURATION (Merged with Trace)
=============================== */
document.getElementById("historical-btn").addEventListener("click", () => {
  isRealTime = false;
  // Show the historical data form.
  document.getElementById("historical-form").style.display = "block";

  // Clear any real-time paths.
  clearLayer(realTimePath);

  // Remove any previous historical markers.
  clearHistoricalMarkers();

  // Add the main marker if needed.
  marker.addTo(map);

  // Update mode info text.
  setActiveButton("historical-btn");
  document.querySelector(".controls .mode-info").innerText =
    "Historical Mode: Load data to display location points.";
  map.closePopup();
});

/* ============================
   LOAD HISTORICAL DATA & DISPLAY POINTS
=============================== */
document.getElementById("load-data").addEventListener("click", async () => {
  // Get the selected datetime range from the form.
  lastStartDate = document.getElementById("start-datetime").value;
  lastEndDate = document.getElementById("end-datetime").value;

  if (!lastStartDate || !lastEndDate) {
    alert("Please fill in both datetime fields.");
    return;
  }

  const startDatetime = `${lastStartDate}:00`;
  const endDatetime = `${lastEndDate}:00`;

  const startDateObj = new Date(startDatetime);
  const endDateObj = new Date(endDatetime);

  // Validate datetime range.
  if (startDateObj >= endDateObj) {
    alert("Start datetime must be before end datetime.");
    return;
  }

  try {
    const loadButton = document.getElementById("load-data");
    loadButton.disabled = true;
    loadButton.innerText = "Loading...";

    const response = await fetch(
      `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`,
    );
    const data = await response.json();

    // Check if data is available for the specified range.
    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      loadButton.disabled = false;
      loadButton.innerText = "Load Route";
      return;
    }

    // Remove any existing historical markers.
    clearHistoricalMarkers();

    // Create a marker for each historical data point.
    data.forEach((loc) => {
      // Create a marker for the location.
      const histMarker = L.marker([loc.latitude, loc.longitude]).addTo(map);
      histMarker.bindPopup(
        `<b>Timestamp:</b> ${loc.timestamp}<br>
         <b>Latitude:</b> ${loc.latitude.toFixed(5)}<br>
         <b>Longitude:</b> ${loc.longitude.toFixed(5)}`,
      );

      historicalMarkers.push(histMarker);
    });

    // Fit the map bounds to the group of historical markers.
    const group = new L.featureGroup(historicalMarkers);
    map.fitBounds(group.getBounds(), { padding: [50, 50] });

    // Optionally update the main marker to the last point in data.
    const lastPoint = data[data.length - 1];
    marker.setLatLng([lastPoint.latitude, lastPoint.longitude]);

    loadButton.disabled = false;
    loadButton.innerText = "Load Route";
  } catch (error) {
    console.error("Error fetching historical data:", error);
    alert("Failed to load historical data. Please try again.");
    const loadButton = document.getElementById("load-data");
    loadButton.disabled = false;
    loadButton.innerText = "Load Route";
  }
});

/* ============================
   REAL-TIME DATA UPDATES FROM SOCKET.IO
=============================== */
socket.on("updateData", (data) => {
  // Process data only if in real-time mode.
  if (isRealTime && data.latitude && data.longitude) {
    const latlng = [data.latitude, data.longitude];
    // Update the marker position.
    marker.setLatLng(latlng);

    // Append new coordinates to the real-time array.
    realTimeCoordinates.push({
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: data.timestamp,
    });

    // Update the real-time polyline with the new set of points.
    realTimePath.setLatLngs(
      realTimeCoordinates.map((coord) => [coord.latitude, coord.longitude]),
    );

    // Auto-center map if the respective toggle is active.
    if (document.getElementById("auto-center-toggle").checked) {
      map.setView(latlng, 15, { animate: true });
    }

    // Update the popup content with current data.
    marker.bindPopup(
      `<strong>Current Position</strong><br>
       Latitude: ${data.latitude.toFixed(5)}<br>
       Longitude: ${data.longitude.toFixed(5)}<br>
       Timestamp: ${data.timestamp}`,
    );
  }
});

// Auto-center toggle event listener.
document
  .getElementById("auto-center-toggle")
  .addEventListener("change", (e) => {
    // The auto-center flag is directly derived from this toggle.
    // No additional code is required here.
  });
