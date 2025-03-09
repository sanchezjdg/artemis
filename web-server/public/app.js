
// app.js
// Connect to the Socket.IO server
const socket = io();
console.log('Connected to Socket.IO server.');

// Initialize the Leaflet map with a clean style and better defaults
const map = L.map('map', {
  zoomControl: false, 
  attributionControl: false
}).setView([0, 0], 2);

// Add zoom control to the top-right corner
L.control.zoom({
  position: 'topright'
}).addTo(map);

// Add a custom attribution in the bottom-right
L.control.attribution({
  position: 'bottomright',
  prefix: '© OpenStreetMap contributors | Map data'
}).addTo(map);


// Tile Layer: Carto Dark Matter (dark theme)
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  subdomains: 'abcd'
});

// Option 2: Carto Positron (clean, light background)
// const positronLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {


// Add the default layer to the map
terrainLayer.addTo(map);

// Create a layer control and add it to the map
const baseLayers = {
  "Terrain View": terrainLayer,
  "Light View": positronLayer,
  "Dark View": darkLayer,
  "Standard View": osmLayer
};

L.control.layers(baseLayers, null, { position: 'topleft' }).addTo(map);

// Add a scale control
L.control.scale({
  imperial: false,  // Use metric only for cleaner look
  position: 'bottomleft'
}).addTo(map);

// Create a custom icon for the marker
const customIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Add a marker to the map with the custom icon
let marker = L.marker([0, 0], { icon: customIcon }).addTo(map);

// Add a circle around marker to highlight the position
let locationCircle = L.circle([0, 0], {
  color: '#3388ff',
  fillColor: '#3388ff',
  fillOpacity: 0.15,
  radius: 500
}).addTo(map);

// Create a polyline to show the path history
const pathCoordinates = [];
const path = L.polyline([], {
  color: '#3388ff',
  weight: 3,
  opacity: 0.7,
  lineJoin: 'round'
}).addTo(map);

// Listen for the "updateData" event from the server
socket.on('updateData', (data) => {
  console.log('Received updateData event with data:', data);
  
  // Update the displayed fields with the new data
  document.getElementById('latitude').textContent = data.latitude || 'N/A';
  document.getElementById('longitude').textContent = data.longitude || 'N/A';
  document.getElementById('altitude').textContent = data.altitude || 'N/A';
  document.getElementById('timestamp').textContent = data.timestamp || 'N/A';
  
  // If latitude and longitude exist, update the marker's position and pan the map
  if (data.latitude && data.longitude) {
    const latlng = [data.latitude, data.longitude];
    
    // Update marker position
    marker.setLatLng(latlng);
    
    // Update the circle position
    locationCircle.setLatLng(latlng);
    
    // Add current position to path history
    pathCoordinates.push(latlng);
    path.setLatLngs(pathCoordinates);
    
    // Set view with smooth animation
    map.flyTo(latlng, 15, {
      duration: 1.5,
      easeLinearity: 0.25
    });
    
    // Add a popup with coordinate information
    marker.bindPopup(`
      <strong>Current Position</strong><br>
      Lat: ${data.latitude.toFixed(6)}<br>
      Lng: ${data.longitude.toFixed(6)}<br>
      Alt: ${data.altitude ? data.altitude.toFixed(2) + 'm' : 'N/A'}
    `).openPopup();
  }
});

// Add fullscreen control
if (L.control.fullscreen) {
  L.control.fullscreen({
    position: 'topright',
    title: 'Show fullscreen',
    titleCancel: 'Exit fullscreen',
    forceSeparateButton: true
  }).addTo(map);
}