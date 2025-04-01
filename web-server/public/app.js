// app.js
const socket = io();
console.log("Connected to Socket.IO server.");

const map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);
//a
let marker = L.marker([0, 0]).addTo(map);
const realTimeCoordinates = [];
let realTimePath = L.polyline([], {
  color: "#3b65ff",
  weight: 4,
  opacity: 0.8,
  lineJoin: "round",
}).addTo(map);

let historicalPath = null;
let isRealTime = true;
let lastStartDate = "";
let lastStartTime = "";
let lastEndDate = "";
let lastEndTime = "";

// Clear layer
function clearLayer(layer) {
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
}

function addPolylineClickHandler(polyline, data) {
  console.log("Handler asignado a la polilínea con", data.length, "puntos"); // <-- Debug
  polyline.on("click", function (e) {
    console.log("Click detectado en la polilínea"); // <-- Debug
    if (data.length === 0) return;

    let closestPoint = data.reduce((prev, curr) => {
      let currLat = Array.isArray(curr) ? curr[0] : curr.latitude;
      let currLng = Array.isArray(curr) ? curr[1] : curr.longitude;
      let prevLat = Array.isArray(prev) ? prev[0] : prev.latitude;
      let prevLng = Array.isArray(prev) ? prev[1] : prev.longitude;

      return map.distance(e.latlng, L.latLng(currLat, currLng)) <
        map.distance(e.latlng, L.latLng(prevLat, prevLng))
        ? curr
        : prev;
    });

    let lat = Array.isArray(closestPoint)
      ? closestPoint[0]
      : closestPoint.latitude;
    let lng = Array.isArray(closestPoint)
      ? closestPoint[1]
      : closestPoint.longitude;
    let timestamp = closestPoint.timestamp || "N/A"; // Si no hay timestamp, muestra "N/A"

    L.popup()
      .setLatLng([lat, lng])
      .setContent(
        `
        <b>Position</b><br>
        Latitud: ${lat.toFixed(5)}<br>
        Longitud: ${lng.toFixed(5)}<br>
        Timestamp: ${timestamp}
      `,
      )
      .openOn(map);
  });
}

socket.on("updateData", (data) => {
  if (isRealTime && data.latitude && data.longitude) {
    const latlng = [data.latitude, data.longitude];

    marker.setLatLng(latlng);

    realTimeCoordinates.push({
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: data.timestamp,
    });

    realTimePath.setLatLngs(
      realTimeCoordinates.map((coord) => [coord.latitude, coord.longitude]),
    );

    map.setView(latlng, 15, { animate: true });

    marker.bindPopup(`
      <strong>Current Position</strong><br>
      Latitude: ${data.latitude.toFixed(5)}<br>
      Longitude: ${data.longitude.toFixed(5)}<br>
      Timestamp: ${data.timestamp}
    `);
  }
});

// Activa el modo tiempo real
document.getElementById("real-time-btn").addEventListener("click", () => {
  isRealTime = true;
  document.getElementById("historical-form").style.display = "none";

  clearLayer(historicalPath);
  historicalPath = null;

  clearLayer(realTimePath);
  realTimeCoordinates.length = 0;
  realTimePath = L.polyline([], {
    color: "#3b65ff",
    weight: 4,
    opacity: 0.8,
    lineJoin: "round",
  }).addTo(map);
  addPolylineClickHandler(realTimePath, realTimeCoordinates);
  marker.addTo(map);

  document.getElementById("real-time-btn").classList.add("active");
  document.getElementById("historical-btn").classList.remove("active");

  document.querySelector(".button-group").style.display = "flex";
  document.querySelector(".controls .mode-info").style.display = "block";
  map.closePopup();
});

// Activa el modo histórico
document.getElementById("historical-btn").addEventListener("click", () => {
  isRealTime = false;
  document.getElementById("historical-form").style.display = "block";

  clearLayer(realTimePath);

  clearLayer(historicalPath);
  historicalPath = null;

  document.getElementById("historical-btn").classList.add("active");
  document.getElementById("real-time-btn").classList.remove("active");
  map.closePopup();
});

// Carga la ruta histórica
async function loadHistoricalData() {
  lastStartDate = document.getElementById("start-date").value;
  lastStartTime = document.getElementById("start-time").value;
  lastEndDate = document.getElementById("end-date").value;
  lastEndTime = document.getElementById("end-time").value;

  if (!lastStartDate || !lastStartTime || !lastEndDate || !lastEndTime) {
    alert("Please fill in all date and time fields.");
    return;
  }

  const startDatetime = `${lastStartDate}T${lastStartTime}:00`;
  const endDatetime = `${lastEndDate}T${lastEndTime}:00`;

  const start = new Date(startDatetime);
  const end = new Date(endDatetime);
  const now = new Date();

  if (start >= end || start > now || end > now) {
    alert("Please select valid historical date/time ranges.");
    return;
  }

  document.querySelector(".button-group").style.display = "none";
  document.querySelector(".controls .mode-info").style.display = "none";

  const historicalForm = document.getElementById("historical-form");
  historicalForm.innerHTML = `
    <p class=\"mode-info\">Searching in:</p>
    <p class=\"mode-info\">${start.toLocaleString()}</p>
    <p class=\"mode-info\">until:</p>
    <p class=\"mode-info\">${end.toLocaleString()}</p>
    <button id=\"back-to-historical\" class=\"load-button\">Return to History</button>
  `;

  document.getElementById("back-to-historical").onclick = restoreHistoricalForm;

  try {
    const response = await fetch(
      `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`,
    );
    const data = await response.json();

    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      restoreHistoricalForm();
      return;
    }

    clearLayer(historicalPath);

    historicalPath = L.polyline(
      data.map((loc) => [loc.latitude, loc.longitude]),
      {
        color: "#FFFFFF",
        weight: 4,
        opacity: 0.8,
        lineJoin: "round",
      },
    ).addTo(map);
    addPolylineClickHandler(historicalPath, data);

    map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });

    marker.setLatLng([
      data[data.length - 1].latitude,
      data[data.length - 1].longitude,
    ]);
  } catch (error) {
    console.error("Error fetching historical data:", error);
    alert("An error occurred while fetching historical data.");
    restoreHistoricalForm();
  }
}

// Restaura formulario histórico original con datos anteriores
function restoreHistoricalForm() {
  document.querySelector(".button-group").style.display = "flex";
  document.querySelector(".controls .mode-info").style.display = "block";

  document.getElementById("historical-form").innerHTML = `
    <div class=\"input-group\"><label for=\"start-date\">Start Date:</label><input type=\"date\" id=\"start-date\" value=\"${lastStartDate}\"></div>
    <div class=\"input-group\"><label for=\"start-time\">Start Time:</label><input type=\"time\" id=\"start-time\" value=\"${lastStartTime}\"></div>
    <div class=\"input-group\"><label for=\"end-date\">End Date:</label><input type=\"date\" id=\"end-date\" value=\"${lastEndDate}\"></div>
    <div class=\"input-group\"><label for=\"end-time\">End Time:</label><input type=\"time\" id=\"end-time\" value=\"${lastEndTime}\"></div>
    <button id=\"load-data\" class=\"load-button\">Load Route</button>
  `;

  document
    .getElementById("load-data")
    .addEventListener("click", loadHistoricalData);

  clearLayer(historicalPath);
  historicalPath = null;
  map.closePopup(); // Cierra cualquier popup abierto
}

// Evento inicial al cargar la página
document
  .getElementById("load-data")
  .addEventListener("click", loadHistoricalData);

// Define new mode state
let isTrace = false;

// Global variable to hold historical data for trace mode (ensure it is available)
let traceHistoricalData = [];

// New function: Fetch full historical data for trace mode
async function loadFullHistoricalData() {
  // Adjust the date range as needed; here we assume a broad range is used
  const defaultStart = "2020-01-01T00:00:00"; // Example start date
  const defaultEnd = new Date().toISOString(); // Up to now

  try {
    const response = await fetch(
      `/historical?start=${encodeURIComponent(defaultStart)}&end=${encodeURIComponent(defaultEnd)}`,
    );
    const data = await response.json();
    if (data.length === 0) {
      alert("No historical data available for tracing.");
      return;
    }
    traceHistoricalData = data;
    alert("Historical data loaded for trace mode. Click on the map to query.");
  } catch (error) {
    console.error("Error fetching full historical data:", error);
    alert("An error occurred while loading historical data for trace mode.");
  }
}

// New function: Handle map click in trace mode
function onMapClickTrace(e) {
  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    alert("Historical data not loaded. Please try again.");
    return;
  }

  // Define a threshold distance in meters (e.g., 100m)
  const threshold = 100;
  const clickedLatLng = e.latlng;

  // Find the closest historical data point
  let closestPoint = traceHistoricalData.reduce((prev, curr) => {
    let prevLatLng = L.latLng(prev.latitude, prev.longitude);
    let currLatLng = L.latLng(curr.latitude, curr.longitude);
    return clickedLatLng.distanceTo(currLatLng) <
      clickedLatLng.distanceTo(prevLatLng)
      ? curr
      : prev;
  });

  // Calculate the distance to the closest point
  let closestDistance = clickedLatLng.distanceTo(
    L.latLng(closestPoint.latitude, closestPoint.longitude),
  );

  if (closestDistance <= threshold) {
    // Display a popup with the timestamp
    L.popup()
      .setLatLng(clickedLatLng)
      .setContent(
        `
         <b>Historical Trace</b><br>
         The vehicle passed here at:<br>
         ${closestPoint.timestamp}<br>
         (Distance: ${closestDistance.toFixed(1)} m)
       `,
      )
      .openOn(map);
  } else {
    alert(
      "No historical record within the search area. Try clicking closer to the route.",
    );
  }
}

// Trace Mode Activation Handler
document.getElementById("trace-btn").addEventListener("click", () => {
  // Set mode states: disable real-time and historical modes
  isRealTime = false;
  isTrace = true;
  // Hide historical form if visible
  document.getElementById("historical-form").style.display = "none";
  // Clear existing layers if necessary
  clearLayer(realTimePath);
  clearLayer(historicalPath);

  // Update UI button states
  document.getElementById("trace-btn").classList.add("active");
  document.getElementById("real-time-btn").classList.remove("active");
  document.getElementById("historical-btn").classList.remove("active");

  // Provide on-screen instructions (optional)
  document.querySelector(".controls .mode-info").innerText =
    "Trace Mode: Click on the map to see when the vehicle passed that point.";

  // Load full historical data if not already loaded
  if (traceHistoricalData.length === 0) {
    loadFullHistoricalData();
  }

  // Attach a one-time map click listener for trace queries
  map.off("click"); // Remove other click listeners if any
  map.on("click", onMapClickTrace);
});

// When switching to Real-Time or Historical, remove the trace click handler
document.getElementById("real-time-btn").addEventListener("click", () => {
  isTrace = false;
  isRealTime = true;
  // Restore the standard behavior
  map.off("click", onMapClickTrace);
  // (Re)attach other mode-specific handlers as needed
});

document.getElementById("historical-btn").addEventListener("click", () => {
  isTrace = false;
  // Hide trace-specific instructions
  document.querySelector(".controls .mode-info").innerText =
    "Select the mode you want to use:";
  map.off("click", onMapClickTrace);
});
