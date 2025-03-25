// app.js

const socket = io();
console.log('Connected to Socket.IO server.');

const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let marker = L.marker([0, 0]).addTo(map);
let realTimeCoordinates = [];
let realTimePath = L.polyline([], {
  color: "#A3BE8C",
  weight: 4,
  opacity: 0.8,
  lineJoin: 'round'
}).addTo(map);

let historicalPath = null;
let isRealTime = true;

const clearLayer = layer => {
  if (layer && map.hasLayer(layer)) map.removeLayer(layer);
};

socket.on('updateData', data => {
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

const realTimeBtn = document.getElementById('real-time-btn');
const historicalBtn = document.getElementById('historical-btn');
const historicalForm = document.getElementById('historical-form');
const loaderOverlay = document.getElementById('loader-overlay');
const backToHistoricalBtn = document.getElementById('back-to-historical');
const loadDataBtn = document.getElementById('load-data');

realTimeBtn.addEventListener('click', () => {
  isRealTime = true;
  historicalForm.style.display = 'none';
  loaderOverlay.classList.add('hidden');

  clearLayer(historicalPath);
  historicalPath = null;

  clearLayer(realTimePath);
  realTimeCoordinates = [];
  realTimePath = L.polyline([], { color: "#A3BE8C", weight: 4, opacity: 0.8, lineJoin: 'round' }).addTo(map);

  marker.addTo(map);

  realTimeBtn.classList.add('active');
  historicalBtn.classList.remove('active');
});

historicalBtn.addEventListener('click', () => {
  isRealTime = false;
  historicalForm.style.display = 'block';
  loaderOverlay.classList.add('hidden');

  clearLayer(realTimePath);

  historicalBtn.classList.add('active');
  realTimeBtn.classList.remove('active');
});

loadDataBtn.addEventListener('click', async () => {
  const startDate = document.getElementById('start-date').value;
  const startTime = document.getElementById('start-time').value;
  const endDate = document.getElementById('end-date').value;
  const endTime = document.getElementById('end-time').value;

  if (!startDate || !startTime || !endDate || !endTime) {
    alert("Please fill in all date and time fields.");
    return;
  }

  const startDatetime = `${startDate}T${startTime}:00`;
  const endDatetime = `${endDate}T${endTime}:00`;
  const start = new Date(startDatetime);
  const end = new Date(endDatetime);
  const now = new Date();

  if (start >= end || start > now || end > now) {
    alert("Invalid date/time range.");
    return;
  }

  historicalForm.style.display = 'none';
  loaderOverlay.classList.remove('hidden');

  try {
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();

    if (data.length === 0) {
      loaderOverlay.classList.add('hidden');
      alert("No route data found.");
      historicalForm.style.display = 'block';
      return;
    }

    clearLayer(historicalPath);

    historicalPath = L.polyline(data.map(loc => [loc.latitude, loc.longitude]), {
      color: "#81A1C1",
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);

    map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });

    marker.setLatLng([data[data.length - 1].latitude, data[data.length - 1].longitude]);

  } catch (error) {
    console.error('Error fetching historical data:', error);
    alert("An error occurred while fetching historical data.");
  } finally {
    loaderOverlay.classList.add('hidden');
  }
});

backToHistoricalBtn.addEventListener('click', () => {
  loaderOverlay.classList.add('hidden');
  historicalForm.style.display = 'block';
});
