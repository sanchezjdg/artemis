const socket = io();
console.log('Connected to Socket.IO server.');

const map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let marker = L.marker([0, 0]).addTo(map);
const realTimeCoordinates = [];
let realTimePath = L.polyline([], {
  color: "#A3BE8C",
  weight: 4,
  opacity: 0.8,
  lineJoin: 'round'
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
  console.log("Handler asignado a la polilínea con", data.length, "puntos"); // <-- Debug
  polyline.on('click', function (e) {
    console.log("Click detectado en la polilínea"); // <-- Debug
    if (data.length === 0) return;

    let closestPoint = data.reduce((prev, curr) => {
      let currLat = Array.isArray(curr) ? curr[0] : curr.latitude;
      let currLng = Array.isArray(curr) ? curr[1] : curr.longitude;
      let prevLat = Array.isArray(prev) ? prev[0] : prev.latitude;
      let prevLng = Array.isArray(prev) ? prev[1] : prev.longitude;

      return (map.distance(e.latlng, L.latLng(currLat, currLng)) <
              map.distance(e.latlng, L.latLng(prevLat, prevLng))) ? curr : prev;
    });

    let lat = Array.isArray(closestPoint) ? closestPoint[0] : closestPoint.latitude;
    let lng = Array.isArray(closestPoint) ? closestPoint[1] : closestPoint.longitude;

    L.popup()
      .setLatLng([lat, lng])
      .setContent(`
        <b>Position</b><br>
        Latitud: ${lat.toFixed(5)}<br>
        Longitud: ${lng.toFixed(5)}
      `)
      .openOn(map);
  });
}


socket.on('updateData', (data) => {
  if (isRealTime && data.latitude && data.longitude) {
    const latlng = [data.latitude, data.longitude];

    marker.setLatLng(latlng);

    realTimeCoordinates.push(latlng);
    realTimePath.setLatLngs(realTimeCoordinates);

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
document.getElementById('real-time-btn').addEventListener('click', () => {
  isRealTime = true;
  document.getElementById('historical-form').style.display = 'none';

  clearLayer(historicalPath);
  historicalPath = null;

  clearLayer(realTimePath);
  realTimeCoordinates.length = 0;
  realTimePath = L.polyline([], {
    color: "#A3BE8C",
    weight: 4,
    opacity: 0.8,
    lineJoin: 'round'
  }).addTo(map);
  addPolylineClickHandler(realTimePath, realTimeCoordinates);
  marker.addTo(map);

  document.getElementById('real-time-btn').classList.add('active');
  document.getElementById('historical-btn').classList.remove('active');

  document.querySelector('.button-group').style.display = 'flex';
  document.querySelector('.controls .mode-info').style.display = 'block';
});

// Activa el modo histórico
document.getElementById('historical-btn').addEventListener('click', () => {
  isRealTime = false;
  document.getElementById('historical-form').style.display = 'block';

  clearLayer(realTimePath);

  clearLayer(historicalPath);
  historicalPath = null;

  document.getElementById('historical-btn').classList.add('active');
  document.getElementById('real-time-btn').classList.remove('active');
});

// Carga la ruta histórica
async function loadHistoricalData() {
  lastStartDate = document.getElementById('start-date').value;
  lastStartTime = document.getElementById('start-time').value;
  lastEndDate = document.getElementById('end-date').value;
  lastEndTime = document.getElementById('end-time').value;

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

  document.querySelector('.button-group').style.display = 'none';
  document.querySelector('.controls .mode-info').style.display = 'none';

  const historicalForm = document.getElementById('historical-form');
  historicalForm.innerHTML = `
    <p class=\"mode-info\">Buscando en:</p>
    <p class=\"mode-info\">${start.toLocaleString()}</p>
    <p class=\"mode-info\">hasta:</p>
    <p class=\"mode-info\">${end.toLocaleString()}</p>
    <button id=\"back-to-historical\" class=\"load-button\">Regresar al Histórico</button>
  `;

  document.getElementById('back-to-historical').onclick = restoreHistoricalForm;

  try {
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();

    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      restoreHistoricalForm();
      return;
    }

    clearLayer(historicalPath);

    historicalPath = L.polyline(data.map(loc => [loc.latitude, loc.longitude]), {
      color: "#81A1C1",
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);
    addPolylineClickHandler(historicalPath, data);

    map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });

    marker.setLatLng([data[data.length - 1].latitude, data[data.length - 1].longitude]);

  } catch (error) {
    console.error('Error fetching historical data:', error);
    alert("An error occurred while fetching historical data.");
    restoreHistoricalForm();
  }
}

// Restaura formulario histórico original con datos anteriores
function restoreHistoricalForm() {
  document.querySelector('.button-group').style.display = 'flex';
  document.querySelector('.controls .mode-info').style.display = 'block';

  document.getElementById('historical-form').innerHTML = `
    <div class=\"input-group\"><label for=\"start-date\">Start Date:</label><input type=\"date\" id=\"start-date\" value=\"${lastStartDate}\"></div>
    <div class=\"input-group\"><label for=\"start-time\">Start Time:</label><input type=\"time\" id=\"start-time\" value=\"${lastStartTime}\"></div>
    <div class=\"input-group\"><label for=\"end-date\">End Date:</label><input type=\"date\" id=\"end-date\" value=\"${lastEndDate}\"></div>
    <div class=\"input-group\"><label for=\"end-time\">End Time:</label><input type=\"time\" id=\"end-time\" value=\"${lastEndTime}\"></div>
    <button id=\"load-data\" class=\"load-button\">Load Route</button>
  `;

  document.getElementById('load-data').addEventListener('click', loadHistoricalData);

  clearLayer(historicalPath);
  historicalPath = null;
}

// Evento inicial al cargar la página
 document.getElementById('load-data').addEventListener('click', loadHistoricalData);