// realTimeMode.js
import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler } from "./utils.js";
import { cleanupHistoricalMode } from "./historicalMode.js";

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
  initialLocationSet = false;

  const map = getMap();
  realTimePath = L.polyline([], {
    color: "#3b65ff",
    weight: 4,
    opacity: 0.8,
    lineJoin: "round",
  }).addTo(map);

  // Attach click handler for popup details.
  addPolylineClickHandler(realTimePath, realTimeCoordinates);

  // Clean up any trace mode elements.
  cleanupHistoricalMode();

  // Hide trace results
  document.getElementById("trace-results").style.display = "none";
  document.getElementById("trace-results").innerHTML = "";

  // Remove map click handlers from trace mode.
  map.off("click");

  // Ensure marker is visible in real-time mode.
  const marker = getMarker();
  marker.addTo(map);

  // Listen for real-time data updates.
  socket.off("updateData");
  socket.on("updateData", (data) => {
    if (data.latitude && data.longitude) {
      const latlng = [data.latitude, data.longitude];
      marker.setLatLng(latlng);

      realTimeCoordinates.push({
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp,
      });

      // Update polyline.
      realTimePath.setLatLngs(
        realTimeCoordinates.map((coord) => [coord.latitude, coord.longitude]),
      );

      if (!initialLocationSet) {
        map.setView(latlng, 15, { animate: true });
        initialLocationSet = true;
      } else if (document.getElementById("auto-center-toggle").checked) {
        map.setView(latlng, 15, { animate: true });
      }

      // Update marker popup.
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
 * Clears the real-time polyline from the map.
 */
export function clearRealTimePath() {
  if (realTimePath) {
    // Remove polyline from the map using helper function.
    clearLayer(realTimePath);
    // Nullify or reset the polyline reference.
    realTimePath = null;
    // Reset realTimeCoordinates if needed.
    realTimeCoordinates = [];
    initialLocationSet = false;
  }
}
