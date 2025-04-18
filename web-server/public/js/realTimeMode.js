// realTimeMode.js
import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler } from "./utils.js";
import { cleanupHistoricalMode } from "./historicalMode.js";

// Global variables for real-time mode.
let vehicleData = new Map(); // Map to store data for each vehicle
let initialLocationSet = false;

/**
 * Starts real-time updates by listening to socket events.
 * @param {Object} socket - The Socket.IO socket instance.
 */
export function startRealTimeUpdates(socket) {
  // Clear any previous data
  vehicleData.forEach((vehicle) => {
    clearLayer(vehicle.path);
    clearLayer(vehicle.marker);
  });
  vehicleData.clear();
  initialLocationSet = false;

  const map = getMap();

  // Clean up any trace mode elements.
  cleanupHistoricalMode();

  // Hide trace results
  document.getElementById("trace-results").style.display = "none";
  document.getElementById("trace-results").innerHTML = "";

  // Remove map click handlers from trace mode.
  map.off("click");

  // Listen for real-time data updates for multiple vehicles
  socket.off("updateMultipleVehicles");
  socket.on("updateMultipleVehicles", (vehicles) => {
    vehicles.forEach((data) => {
      if (data.latitude && data.longitude) {
        const vehicleId = data.vehicle_id;
        const latlng = [data.latitude, data.longitude];

        // Initialize vehicle data if it doesn't exist
        if (!vehicleData.has(vehicleId)) {
          const vehicleColors = {
            1: "#3b65ff", // Blue for first vehicle
            2: "#ff3b3b", // Red for second vehicle
          };

          const color = vehicleColors[vehicleId] || "#3b65ff";

          vehicleData.set(vehicleId, {
            coordinates: [],
            path: L.polyline([], {
              color: color,
              weight: 4,
              opacity: 0.8,
              lineJoin: "round",
            }).addTo(map),
            marker: L.circleMarker(latlng, {
              radius: 8,
              fillColor: color,
              color: "#fff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map)
          });
        }

        const vehicle = vehicleData.get(vehicleId);

        // Update marker position
        vehicle.marker.setLatLng(latlng);

        // Update coordinates history
        vehicle.coordinates.push({
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp,
        });

        // Update polyline
        vehicle.path.setLatLngs(
          vehicle.coordinates.map((coord) => [coord.latitude, coord.longitude])
        );

        // Attach click handler for popup details
        addPolylineClickHandler(vehicle.path, vehicle.coordinates);

        // Center map on first vehicle if auto-center is enabled
        if (vehicleId === 1) {
          if (!initialLocationSet) {
            map.setView(latlng, 15, { animate: true });
            initialLocationSet = true;
          } else if (document.getElementById("auto-center-toggle").checked) {
            map.setView(latlng, 15, { animate: true });
          }
        }

        // Update marker popup
        vehicle.marker.bindPopup(
          `<strong>Vehicle ${vehicleId}</strong><br>
           Latitude: ${data.latitude.toFixed(5)}<br>
           Longitude: ${data.longitude.toFixed(5)}<br>
           Timestamp: ${data.timestamp}`
        );
      }
    });
  });
}

/**
 * Clears all real-time vehicle paths and markers from the map.
 */
export function clearRealTimePath() {
  // Clear all vehicle paths and markers
  vehicleData.forEach((vehicle) => {
    clearLayer(vehicle.path);
    clearLayer(vehicle.marker);
  });
  // Clear the vehicle data map
  vehicleData.clear();
  initialLocationSet = false;
}
