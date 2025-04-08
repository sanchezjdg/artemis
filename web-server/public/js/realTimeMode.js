// realTimeMode.js
// Module to handle real-time map updates from the Socket.IO server.
import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler } from "./utils.js";

// Global variables for real-time mode.
let realTimeCoordinates = [];
let realTimePath = null;
let initialLocationSet = false;

/**
 * Starts real-time updates by listening to socket events.
 * @param {Object} socket - The Socket.IO socket instance.
 */
export function startRealTimeUpdates(socket) {
  // Clear any previous historical layers.
  clearLayer(realTimePath);
  realTimeCoordinates = [];

  // Reset the initial location flag when starting real-time mode
  initialLocationSet = false;

  // Create a new polyline for real-time data.
  const map = getMap();
  realTimePath = L.polyline([], {
    color: "#3b65ff",
    weight: 4,
    opacity: 0.8,
    lineJoin: "round",
  }).addTo(map);

  // Attach click handler to show popup details.
  addPolylineClickHandler(realTimePath, realTimeCoordinates);

  // Ensure the marker is added to the map.
  getMarker().addTo(map);

  // Clear any trace mode circles and hide trace results
  clearTraceCircles();
  document.getElementById("trace-results").style.display = "none";
  document.getElementById("trace-results").innerHTML = "";

  // Remove any map click handlers from trace mode
  map.off("click");

  // Listen for real-time data updates.
  socket.off("updateData"); // Remove previous listeners if any.
  socket.on("updateData", (data) => {
    if (data.latitude && data.longitude) {
      const latlng = [data.latitude, data.longitude];
      const marker = getMarker();
      marker.setLatLng(latlng);

      // Append the new coordinate to the array.
      realTimeCoordinates.push({
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp,
      });

      // Update polyline with new coordinates.
      realTimePath.setLatLngs(
        realTimeCoordinates.map((coord) => [coord.latitude, coord.longitude]),
      );

      // Always center the map on the first location update if not already set
      if (!initialLocationSet) {
        map.setView(latlng, 15, { animate: true });
        initialLocationSet = true;
      }
      // Otherwise, auto-center if the option is checked
      else if (document.getElementById("auto-center-toggle").checked) {
        map.setView(latlng, 15, { animate: true });
      }

      // Update marker popup with current position details.
      marker.bindPopup(
        `<strong>Current Position</strong><br>
         Latitude: ${data.latitude.toFixed(5)}<br>
         Longitude: ${data.longitude.toFixed(5)}<br>
         Timestamp: ${data.timestamp}`,
      );
    }
  });
}

/**
 * Utility function to clear any existing trace circles from the map.
 */
function clearTraceCircles() {
  const map = getMap();
  // Iterate over map layers and remove any circles
  map.eachLayer((layer) => {
    if (layer instanceof L.Circle) {
      map.removeLayer(layer);
    }
  });
}
