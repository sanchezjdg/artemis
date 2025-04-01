// app.js
const socket = io();
console.log("Connected to Socket.IO server.");

const map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

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

function clearLayer(layer) {
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
}

function addPolylineClickHandler(polyline, data) {
  polyline.on("click", function (e) {
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
    let timestamp = closestPoint.timestamp || "N/A";

    L.popup()
      .setLatLng([lat, lng])
      .setContent(`
        <b>Position</b><br>
        Latitud: ${lat.toFixed(5)}<br>
        Longitud: ${lng.toFixed(5)}<br>
        Timestamp: ${timestamp}
      `)
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
      realTimeCoordinates.map((coord) => [coord.latitude, coord.longitude])
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


  try {
    const loadButton = document.getElementById("load-data");
    loadButton.disabled = true;
    loadButton.innerText = "Loading...";

    const response = await fetch(
      `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`
    );
    const data = await response.json();

    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      loadButton.disabled = false;
      loadButton.innerText = "Load Route";
      return;
    }

    clearLayer(historicalPath);
    historicalPath = L.polyline(
      data.map((loc) => [loc.latitude, loc.longitude]),
      {
        color: "#8E00C2",
        weight: 4,
        opacity: 0.8,
        lineJoin: "round",
      }
    ).addTo(map);

    addPolylineClickHandler(historicalPath, data);
    map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });

    marker.setLatLng([
      data[data.length - 1].latitude,
      data[data.length - 1].longitude,
    ]);

    loadButton.disabled = false;
    loadButton.innerText = "Load Route";
  } catch (error) {
    console.error("Error fetching historical data:", error);
    alert("An error occurred while fetching historical data.");
    const loadButton = document.getElementById("load-data");
    loadButton.disabled = false;
    loadButton.innerText = "Load Route";
  }
}

function restoreHistoricalForm() {
  document.querySelector(".button-group").style.display = "flex";
  document.querySelector(".controls .mode-info").style.display = "block";

  document.getElementById("historical-form").innerHTML = `
    <div class="input-group"><label for="start-date">Start Date:</label><input type="date" id="start-date" value="${lastStartDate}"></div>
    <div class="input-group"><label for="start-time">Start Time:</label><input type="time" id="start-time" value="${lastStartTime}"></div>
    <div class="input-group"><label for="end-date">End Date:</label><input type="date" id="end-date" value="${lastEndDate}"></div>
    <div class="input-group"><label for="end-time">End Time:</label><input type="time" id="end-time" value="${lastEndTime}"></div>
    <button id="load-data" class="load-button">Load Route</button>
  `;

  document
    .getElementById("load-data")
    .addEventListener("click", loadHistoricalData);

  clearLayer(historicalPath);
  historicalPath = null;
  map.closePopup();
}

document
  .getElementById("load-data")
  .addEventListener("click", loadHistoricalData);

let isTrace = false;
let traceHistoricalData = [];

async function loadFullHistoricalData() {
  const defaultStart = "2020-01-01T00:00:00";
  const defaultEnd = new Date().toISOString();

  try {
    const response = await fetch(
      `/historical?start=${encodeURIComponent(defaultStart)}&end=${encodeURIComponent(defaultEnd)}`
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

function onMapClickTrace(e) {
  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    alert("Historical data not loaded. Please try again.");
    return;
  }

  const threshold = 100;
  const clickedLatLng = e.latlng;

  let closestPoint = traceHistoricalData.reduce((prev, curr) => {
    let prevLatLng = L.latLng(prev.latitude, prev.longitude);
    let currLatLng = L.latLng(curr.latitude, curr.longitude);
    return clickedLatLng.distanceTo(currLatLng) <
      clickedLatLng.distanceTo(prevLatLng)
      ? curr
      : prev;
  });

  let closestDistance = clickedLatLng.distanceTo(
    L.latLng(closestPoint.latitude, closestPoint.longitude)
  );

  if (closestDistance <= threshold) {
    L.popup()
      .setLatLng(clickedLatLng)
      .setContent(`
         <b>Historical Trace</b><br>
         The vehicle passed here at:<br>
         ${closestPoint.timestamp}<br>
         (Distance: ${closestDistance.toFixed(1)} m)
       `)
      .openOn(map);
  } else {
    alert("No historical record within the search area. Try clicking closer to the route.");
  }
}

document.getElementById("trace-btn").addEventListener("click", () => {
  isRealTime = false;
  isTrace = true;

  document.getElementById("historical-form").style.display = "none";
  clearLayer(realTimePath);
  clearLayer(historicalPath);

  document.getElementById("trace-btn").classList.add("active");
  document.getElementById("real-time-btn").classList.remove("active");
  document.getElementById("historical-btn").classList.remove("active");

  document.querySelector(".controls .mode-info").innerText =
    "Trace Mode: Click on the map to see when the vehicle passed that point.";

  if (traceHistoricalData.length === 0) {
    loadFullHistoricalData();
  }

  map.off("click");
  map.on("click", onMapClickTrace);
});

document.getElementById("real-time-btn").addEventListener("click", () => {
  isTrace = false;
  isRealTime = true;
  map.off("click", onMapClickTrace);
});

document.getElementById("historical-btn").addEventListener("click", () => {
  isTrace = false;
  document.querySelector(".controls .mode-info").innerText =
    "Select the mode you want to use:";
  map.off("click", onMapClickTrace);
});
