// app.js

const socket = io();
console.log('Connected to Socket.IO server.');

// Inicializar el mapa centrado en Buenavista, Barranquilla
const map = L.map('map').setView([10.9886, -74.8148], 15);

// Agregar capa de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Agregar un marcador en la ubicación inicial
let marker = L.marker([10.9886, -74.8148]).addTo(map)
  .bindPopup('Buenavista, Barranquilla')
  .openPopup();

// Función para actualizar la ubicación cuando se necesite
function updateMap(lat, lng) {
  map.setView([lat, lng], 15); // Mueve el mapa a la nueva ubicación
  marker.setLatLng([lat, lng]); // Mueve el marcador
}


// Global variables for tracking layers and state
let marker = L.marker([0, 0]).addTo(map);
const realTimeCoordinates = [];
let realTimePath = L.polyline([], {
  color: "#A3BE8C", // Nord green
  weight: 4,
  opacity: 0.8,
  lineJoin: 'round'
}).addTo(map);

let historicalPath = null;
let isRealTime = true;

// Function to clear a given layer from the map
function clearLayer(layer) {
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
}

// Handle incoming real-time data
socket.on('updateData', (data) => {
  if (isRealTime && data.latitude && data.longitude) {
    const latlng = [data.latitude, data.longitude];

    // Update marker position
    marker.setLatLng(latlng);

    // Append current position to real-time tracking path
    realTimeCoordinates.push(latlng);
    realTimePath.setLatLngs(realTimeCoordinates);

    // Smoothly pan the map to the new position
    map.setView(latlng, 15, { animate: true });

    // Update marker popup
    marker.bindPopup(`
      <strong>Current Position</strong><br>
      Latitude: ${data.latitude.toFixed(5)}<br>
      Longitude: ${data.longitude.toFixed(5)}<br>
      Timestamp: ${data.timestamp}
    `);
  }
});

// Toggle to Real-Time mode
document.getElementById('real-time-btn').addEventListener('click', () => {
  isRealTime = true;
  document.getElementById('historical-form').style.display = 'none';

  // Remove historical route if present
  clearLayer(historicalPath);
  historicalPath = null;

  // Reinitialize the real-time path for clarity
  clearLayer(realTimePath);
  realTimeCoordinates.length = 0; // Clear previous data
  realTimePath = L.polyline([], {
    color: "#A3BE8C", // Nord green
    weight: 4,
    opacity: 0.8,
    lineJoin: 'round'
  }).addTo(map);

  // Ensure the marker remains visible
  marker.addTo(map);

  // Update button active states
  document.getElementById('real-time-btn').classList.add('active');
  document.getElementById('historical-btn').classList.remove('active');
});

// Toggle to Historical mode
document.getElementById('historical-btn').addEventListener('click', () => {
  isRealTime = false;
  document.getElementById('historical-form').style.display = 'block';

  // Remove the real-time route to avoid confusion
  clearLayer(realTimePath);

  // Also remove any previous historical route
  clearLayer(historicalPath);
  historicalPath = null;

  // Update button active states
  document.getElementById('historical-btn').classList.add('active');
  document.getElementById('real-time-btn').classList.remove('active');
});

// Validate input fields (simple inline validation)
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

// Fetch and display historical route data
document.getElementById('load-data').addEventListener('click', async () => {
  // Get date/time values
  const startDate = document.getElementById('start-date').value;
  const startTime = document.getElementById('start-time').value;
  const endDate = document.getElementById('end-date').value;
  const endTime = document.getElementById('end-time').value;
  
  if (!startDate || !startTime || !endDate || !endTime) {
    alert("Please fill in all date and time fields.");
    return;
  }
  
  // Construct ISO datetime strings
  const startDatetime = `${startDate}T${startTime}:00`;
  const endDatetime = `${endDate}T${endTime}:00`;
  
  // Client-side validation: Chronological order and future date exclusion
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
    // Fetch historical route data from server endpoint
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();
    
    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      return;
    }
    
    // Remove any previous historical route from the map
    clearLayer(historicalPath);

    // Create new historical polyline using Nord blue
    historicalPath = L.polyline([], {
      color: "#81A1C1", // Nord blue
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);
    
    // Build the historical route coordinates array
    const historicalCoordinates = data.map(loc => [loc.latitude, loc.longitude]);
    historicalPath.setLatLngs(historicalCoordinates);
    
    // Fit map bounds to the historical route
    map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });
    
    // Optionally, update the marker to the last location of the historical route
    marker.setLatLng(historicalCoordinates[historicalCoordinates.length - 1]);
    
  } catch (error) {
    console.error('Error fetching historical data:', error);
    alert("An error occurred while fetching historical data.");
  }
});
