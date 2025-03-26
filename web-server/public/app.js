const map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const socket = io();

let isRealTime = true;
let realTimePath = L.polyline([], { color: "#A3BE8C" }).addTo(map);
let historicalPath;

const marker = L.marker([0, 0]).addTo(map);

socket.on('updateData', (data) => {
  if (isRealTime) {
    const coords = [data.latitude, data.longitude];
    realTimePath.addLatLng(coords);
    map.panTo(coords);
    marker.setLatLng(coords)
      .bindPopup(`Latitude: ${data.latitude}<br>Longitude: ${data.longitude}<br>Timestamp: ${data.timestamp}`);
  }
});

// Mode switching
const realTimeBtn = document.getElementById('real-time-btn');
const historicalBtn = document.getElementById('historical-btn');
const historicalForm = document.getElementById('historical-form');

realTimeBtn.onclick = () => {
  isRealTime = true;
  historicalForm.style.display = 'none';
  realTimeBtn.classList.add('active');
  historicalBtn.classList.remove('active');
  
  if (historicalPath) map.removeLayer(historicalPath);
};

historicalBtn.onclick = () => {
  isRealTime = false;
  historicalForm.style.display = 'block';
  historicalBtn.classList.add('active');
  realTimeBtn.classList.remove('active');
  
  realTimePath.setLatLngs([]);
};

// Load historical route
document.getElementById('load-data').addEventListener('click', async () => {
  const startDate = document.getElementById('start-date').value;
  const startTime = document.getElementById('start-time').value;
  const endDate = document.getElementById('end-date').value;
  const endTime = document.getElementById('end-time').value;

  if (!startDate || !startTime || !endDate || !endTime) {
    alert("Please fill in all date and time fields.");
    return;
  }

  const startDatetime = `${startDate}T${startTime}`;
  const endDatetime = `${endDate}T${endTime}`;

  const start = new Date(startDatetime);
  const end = new Date(endDatetime);
  const now = new Date();

  if (start >= end || start > now || end > now) {
    alert("Please select valid historical date/time ranges.");
    return;
  }

  document.querySelector('.button-group').style.display = 'none';
  document.querySelector('.controls .mode-info').style.display = 'none';

  historicalForm.innerHTML = `
    <p class="mode-info">Buscando en:</p>
    <p class="mode-info">${start.toLocaleString()}</p>
    <p class="mode-info">hasta:</p>
    <p class="mode-info">${end.toLocaleString()}</p>
    <button id="back-to-historical" class="load-button">Regresar al Histórico</button>
  `;

  document.getElementById('back-to-historical').onclick = () => location.reload();

  try {
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();

    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      location.reload();
      return;
    }

    historicalPath = L.polyline(data.map(loc => [loc.latitude, loc.longitude]), { color: "#81A1C1" }).addTo(map);
    map.fitBounds(historicalPath.getBounds());

    marker.setLatLng(data[data.length - 1]);

  } catch (error) {
    alert("An error occurred while fetching historical data.");
    location.reload();
  }
});