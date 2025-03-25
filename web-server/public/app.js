// app.js

const socket = io();
console.log('Connected to Socket.IO server.');

// Initialize the Leaflet map centered at [0,0] with a low zoom level
const map = L.map('map').setView([0, 0], 2);

// Add OpenStreetMap tiles to the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Marker for current position and polyline for route
let marker = L.marker([0, 0]).addTo(map);
const pathCoordinates = [];
const realTimePath = L.polyline([], {
  color: varColor = "#BF616A", // Nord red
  weight: 4,
  opacity: 0.8,
  lineJoin: 'round'
}).addTo(map);

// Real-time tracking flag
let isRealTime = true;

// Handle incoming real-time data
socket.on('updateData', (data) => {
  if (isRealTime && data.latitude && data.longitude) {
    const latlng = [data.latitude, data.longitude];
    
    // Update marker position and polyline
    marker.setLatLng(latlng);
    pathCoordinates.push(latlng);
    realTimePath.setLatLngs(pathCoordinates);
    
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

// Toggle to real-time mode
document.getElementById('real-time-btn').addEventListener('click', () => {
  isRealTime = true;
  document.getElementById('historical-form').style.display = 'none';
  // Update button active states
  document.getElementById('real-time-btn').classList.add('active');
  document.getElementById('historical-btn').classList.remove('active');
});

// Toggle to historical mode
document.getElementById('historical-btn').addEventListener('click', () => {
  isRealTime = false;
  document.getElementById('historical-form').style.display = 'block';
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
  
  try {
    // Fetch historical route data from server endpoint
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();
    
    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      return;
    }
    
    // Clear existing polyline and add historical path
    const historicalPath = L.polyline([], {
      color: "#81A1C1", // Nord blue for historical route
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);
    
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
