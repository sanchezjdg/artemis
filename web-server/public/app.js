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

  document.querySelector('.button-group').style.display = 'flex';
  document.querySelector('.controls .mode-info').style.display = 'block';
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

document.getElementById('back-to-historical').onclick = () => {
  // Vuelve a mostrar elementos ocultos
  document.querySelector('.button-group').style.display = 'flex';
  document.querySelector('.controls .mode-info').style.display = 'block';

  // Restaura el formulario histórico original
  const historicalForm = document.getElementById('historical-form');
  historicalForm.innerHTML = `
    <div class="input-group">
      <label for="start-date">Start Date:</label>
      <input type="date" id="start-date">
    </div>
    
    <div class="input-group">
      <label for="start-time">Start Time:</label>
      <input type="time" id="start-time">
    </div>
    
    <div class="input-group">
      <label for="end-date">End Date:</label>
      <input type="date" id="end-date">
    </div>
    
    <div class="input-group">
      <label for="end-time">End Time:</label>
      <input type="time" id="end-time">
    </div>
    
    <button id="load-data" class="load-button">Load Route</button>
  `;

  // Reactivar evento del botón load-data después de restaurar el formulario
  document.getElementById('load-data').addEventListener('click', loadHistoricalData);

  // Limpia la ruta histórica del mapa
  clearLayer(historicalPath);
  historicalPath = null;
};

  try {
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();

    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      location.reload();
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
    location.reload();
  }
});
