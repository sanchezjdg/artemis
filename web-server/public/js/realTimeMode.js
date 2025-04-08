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
  // Reset the initial location flag
  initialLocationSet = false;

  // Clear any previous historical layers.
  clearLayer(realTimePath);
  realTimeCoordinates = [];

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

      // Always center map on first location received
      if (!initialLocationSet) {
        map.setView(latlng, 15, { animate: true });
        initialLocationSet = true;
      }
      // For subsequent updates, only auto-center if the option is checked
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
