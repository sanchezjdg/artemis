// app.js

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

function clearLayer(layer) {
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
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
  marker.addTo(map);

  document.getElementById('real-time-btn').classList.add('active');
  document.getElementById('historical-btn').classList.remove('active');
});

document.getElementById('historical-btn').addEventListener('click', () => {
  isRealTime = false;
  document.getElementById('historical-form').style.display = 'block';
  clearLayer(realTimePath);
  clearLayer(historicalPath);
  historicalPath = null;

  document.getElementById('historical-btn').classList.add('active');
  document.getElementById('real-time-btn').classList.remove('active');
});

document.querySelectorAll("#historical-form input").forEach((input) => {
  input.addEventListener("input", function () {
    let errorSpan = document.getElementById(input.id + "-error");
    if (input.value) {
      if (errorSpan) errorSpan.style.display = "none";
      input.classList.remove("error");
    } else {
      if (errorSpan) errorSpan.style.display = "inline";
      input.classList.add("error");
    }
  });
});

document.getElementById('load-data').addEventListener('click', async () => {
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

  if (start >= end) {
    alert("The start date/time must be earlier than the end date/time.");
    return;
  }

  if (start > now || end > now) {
    alert("Future dates/times are not allowed.");
    return;
  }

  try {
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();

    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      return;
    }

    clearLayer(historicalPath);

    historicalPath = L.polyline([], {
      color: "#81A1C1",
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);

    const historicalCoordinates = data.map(loc => [loc.latitude, loc.longitude]);
    historicalPath.setLatLngs(historicalCoordinates);
    map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });
    marker.setLatLng(historicalCoordinates[historicalCoordinates.length - 1]);

    document.getElementById('historical-form').style.display = 'none';
    document.querySelector('.mode-info').style.display = 'none';
    document.querySelector('.button-group').style.display = 'none';

    document.getElementById('historical-result').style.display = 'block';
    document.getElementById('result-interval').innerText = `Start: ${startDatetime}\nEnd: ${endDatetime}`;

  } catch (error) {
    console.error('Error fetching historical data:', error);
    alert("An error occurred while fetching historical data.");
  }
});

document.getElementById('back-to-historical').addEventListener('click', () => {
  clearLayer(historicalPath);
  document.getElementById('historical-result').style.display = 'none';
  document.querySelector('.mode-info').style.display = 'block';
  document.querySelector('.button-group').style.display = 'flex';
  document.getElementById('historical-form').style.display = 'block';
});
