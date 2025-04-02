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
let isTrace = false;
let traceHistoricalData = [];
let searchCircle = null;

function clearSearchCircle() {
  if (searchCircle && map.hasLayer(searchCircle)) {
    map.removeLayer(searchCircle);
    searchCircle = null;
  }
}

const now = new Date();
const pad = (n) => n.toString().padStart(2, "0");
const formatDate = (d) => {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const startValue = formatDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0));
const endValue = formatDate(now);

document.getElementById("start-datetime").value = startValue;
document.getElementById("end-datetime").value = endValue;

flatpickr("#start-datetime", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  defaultDate: startValue,
  maxDate: "today"
});

flatpickr("#end-datetime", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  defaultDate: endValue,
  maxDate: "today"
});

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

      return map.distance(e.latlng, L.latLng(currLat, currLng)) < map.distance(e.latlng, L.latLng(prevLat, prevLng))
        ? curr
        : prev;
    });

    let lat = Array.isArray(closestPoint) ? closestPoint[0] : closestPoint.latitude;
    let lng = Array.isArray(closestPoint) ? closestPoint[1] : closestPoint.longitude;
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

function setActiveButton(activeId) {
  ["real-time-btn", "historical-btn", "trace-btn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.remove("active");
    }
  });
  document.getElementById(activeId).classList.add("active");
}

document.getElementById("real-time-btn").addEventListener("click", () => {
  clearSearchCircle();
  isRealTime = true;
  isTrace = false;

  document.getElementById("historical-form").style.display = "none"; // NUEVO
  document.getElementById("trace-radius-control").style.display = "none"; // NUEVO

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

  setActiveButton("real-time-btn");
  document.querySelector(".button-group").style.display = "flex";
  document.querySelector(".controls .mode-info").style.display = "block";
  map.closePopup();
});

document.getElementById("historical-btn").addEventListener("click", () => {
  clearSearchCircle();
  isRealTime = false;
  isTrace = false;

  document.getElementById("historical-form").style.display = "block";
  document.getElementById("trace-radius-control").style.display = "none"; // NUEVO

  clearLayer(realTimePath);
  clearLayer(historicalPath);
  historicalPath = null;

  marker.addTo(map);

  setActiveButton("historical-btn");
  document.querySelector(".controls .mode-info").innerText =
    "Select the mode you want to use:";
  map.off("click", onMapClickTrace);
  map.closePopup();
});

document.getElementById("trace-btn").addEventListener("click", () => {
  clearSearchCircle();
  isRealTime = false;
  isTrace = true;

  const radiusSlider = document.getElementById("search-radius");
  const radiusValue = document.getElementById("radius-value");

  radiusSlider.addEventListener("input", () => {
    radiusValue.textContent = radiusSlider.value;
  });

  document.getElementById("historical-form").style.display = "block";
  document.getElementById("trace-radius-control").style.display = "block";

  clearLayer(realTimePath);
  clearLayer(historicalPath);

  map.removeLayer(marker);

  setActiveButton("trace-btn");

  document.querySelector(".controls .mode-info").innerText =
    "Trace Mode: Selecciona un rango de tiempo y haz clic en el mapa para ver cuándo pasó el vehículo por ese punto.";

  map.off("click");
  map.on("click", onMapClickTrace);
  map.closePopup();
});

document.getElementById("load-data").addEventListener("click", async () => {
  lastStartDate = document.getElementById("start-datetime").value;
  lastEndDate = document.getElementById("end-datetime").value;

  if (!lastStartDate || !lastEndDate) {
    alert("Please fill in both datetime fields.");
    return;
  }

  const startDatetime = `${lastStartDate}:00`;
  const endDatetime = `${lastEndDate}:00`;

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

    if (!isTrace) {
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
    } else {
      traceHistoricalData = data;
      alert("Datos cargados. Haz clic en el mapa para consultar.");
    }

    loadButton.disabled = false;
    loadButton.innerText = "Load Route";
  } catch (error) {
    console.error("Error fetching historical data:", error);
    alert("Start datetime must be before end datetime.");
    const loadButton = document.getElementById("load-data");
    loadButton.disabled = false;
    loadButton.innerText = "Load Route";
  }
});

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

  const radiusInput = document.getElementById("search-radius");
  const threshold = parseFloat(radiusInput.value) || 100;
  const clickedLatLng = e.latlng;

  clearSearchCircle();

  searchCircle = L.circle(clickedLatLng, {
    radius: threshold,
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.2,
  }).addTo(map);

  const nearbyPoints = traceHistoricalData.filter((point) => {
    const dist = clickedLatLng.distanceTo(L.latLng(point.latitude, point.longitude));
    return dist <= threshold;
  });

  const resultsContainer = document.getElementById("trace-results");
  resultsContainer.innerHTML = "";

  if (nearbyPoints.length === 0) {
    alert("No se encontró ningún paso del vehículo dentro del radio. Intenta más cerca de la ruta.");
    return;
  }

  const fragment = document.createDocumentFragment();

  nearbyPoints.forEach((point) => {
    const div = document.createElement("div");
    div.className = "trace-result";

    div.innerHTML = `
      <div><b>${point.timestamp}</b></div>
      <button class="view-point" data-lat="${point.latitude}" data-lng="${point.longitude}" data-time="${point.timestamp}">Ver</button>
      <hr>
    `;
    fragment.appendChild(div);
  });

  resultsContainer.appendChild(fragment);

  document.querySelectorAll(".view-point").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const time = btn.dataset.time;

      map.setView([lat, lng], 17);
      L.popup()
        .setLatLng([lat, lng])
        .setContent(`
          <b>Momento registrado</b><br>
          Lat: ${lat.toFixed(5)}<br>
          Lng: ${lng.toFixed(5)}<br>
          Timestamp: ${time}
        `)
        .openOn(map);
    });
  });
}

document.getElementById("restore-form")?.addEventListener("click", restoreHistoricalForm);
