// realTimeMode.js
// Module to handle real-time updates.

import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler } from "./utils.js";

// Global variables to track real-time data.
let realTimeCoordinates = [];
let realTimePath = null;

/**
 * Returns the last real-time position as [lat, lng] if available.
 * @returns {Array|null} The last coordinate or null.
 */
export function getLastRealTimePosition() {
  if (realTimeCoordinates.length > 0) {
    return [
      realTimeCoordinates[realTimeCoordinates.length - 1].latitude,
      realTimeCoordinates[realTimeCoordinates.length - 1].longitude,
    ];
  }
  return null;
}

/**
 * Starts subscribing to real-time updates.
 * @param {Object} socket - Socket.IO instance.
 */
export function startRealTimeUpdates(socket) {
  // Clear any pre-existing layers.
  clearLayer(realTimePath);
  realTimeCoordinates = [];

  const map = getMap();
  realTimePath = L.polyline([], {
    color: "#3b65ff",
    weight: 4,
    opacity: 0.8,
    lineJoin: "round",
  }).addTo(map);
  addPolylineClickHandler(realTimePath, realTimeCoordinates);
  getMarker().addTo(map);

  // Remove previous listeners to avoid duplicates.
  socket.off("updateData");
  socket.on("updateData", (data) => {
    if (data.latitude && data.longitude) {
      const latlng = [data.latitude, data.longitude];
      const marker = getMarker();
      marker.setLatLng(latlng);

      // Append new data.
      realTimeCoordinates.push({
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp,
      });
      realTimePath.setLatLngs(
        realTimeCoordinates.map((coord) => [coord.latitude, coord.longitude]),
      );

      // Always auto center in real-time (default enabled).
      if (document.getElementById("auto-center-toggle").checked) {
        map.setView(latlng, 15, { animate: true });
      }
      // Bind popup with current location details.
      marker.bindPopup(
        `<strong>Current Position</strong><br>
         Latitude: ${data.latitude.toFixed(5)}<br>
         Longitude: ${data.longitude.toFixed(5)}<br>
         Timestamp: ${data.timestamp}`,
      );
    }
  });
}
