// app.js
// Connect to the Socket.IO server

const socket = io();
console.log('Connected to Socket.IO server.');

// Initialize the Leaflet map centered at [0,0] with a low zoom level
const map = L.map('map').setView([0, 0], 2);

// Add OpenStreetMap tiles to the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
maxZoom: 19,
attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Add a marker to the map; initially placed at [0,0]
let marker = L.marker([0, 0]).addTo(map);

//Name 
app.get('/', (req, res) => {
  res.render('index', { 
    WEBSITE_NAME: process.env.WEBSITE_NAME 
  });
});

// Create a polyline to show the path history with purple color
const pathCoordinates = [];
const path = L.polyline([], {
  color: '#8A2BE2',  // Purple color (BlueViolet)
  weight: 4,         // Slightly thicker line
  opacity: 0.8,      // More visible
  lineJoin: 'round'
}).addTo(map);

// Listen for the "updateData" event from the server
socket.on('updateData', (data) => {
console.log('Received updateData event with data:', data);

// If latitude and longitude exist, update the marker's position and pan the map
if (data.latitude && data.longitude) {
  const latlng = [data.latitude, data.longitude];
  
  // Update marker position
  marker.setLatLng(latlng);

  // Add current position to path history
  pathCoordinates.push(latlng);
  path.setLatLngs(pathCoordinates);

  // Set view with smooth animation
  map.setView(latlng, 15);

  // Add a popup with coordinate information
  marker.bindPopup(`
    <strong>Current Position</strong><br>
    Latitude: ${data.latitude.toFixed(5)}<br>
    Longitude: ${data.longitude.toFixed(5)}<br>
    Timestamp: ${data.timestamp}
  `);
}
});