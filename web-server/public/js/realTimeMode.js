// realTimeMode.js
import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler, formatTimestamp } from "./utils.js";
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

        // Update marker popup to use the user-friendly timestamp format
        vehicle.marker.bindPopup(
          `<strong>Vehicle ${vehicleId}</strong><br>
           Latitude: ${data.latitude.toFixed(5)}<br>
           Longitude: ${data.longitude.toFixed(5)}<br>
           ${formatTimestamp(data.timestamp)}`
        );
      }
    });
  });

  // Add a dropdown for vehicle selection in real-time mode
  let vehicleSelect = document.getElementById('vehicle-select');
  if (!vehicleSelect) {
    vehicleSelect = document.createElement('select');
    vehicleSelect.id = 'vehicle-select';
    vehicleSelect.style.marginTop = '10px';
    vehicleSelect.style.width = '100%';
    vehicleSelect.style.padding = '5px';
    vehicleSelect.style.borderRadius = '5px';
    vehicleSelect.style.border = '1px solid #ccc';
    vehicleSelect.style.backgroundColor = '#fff';
    vehicleSelect.style.color = '#000';
    vehicleSelect.style.fontSize = '14px';
    vehicleSelect.style.fontWeight = 'bold';
    vehicleSelect.style.cursor = 'pointer';
    vehicleSelect.innerHTML = '<option value="">Select Vehicle</option>';
    document.getElementById('real-time-controls').appendChild(vehicleSelect);
  }
  // Update the real-time updates function to handle vehicle selection
  vehicleSelect.addEventListener('change', () => {
    const selectedVehicleId = parseInt(vehicleSelect.value, 10);
    if (selectedVehicleId && vehicleData.has(selectedVehicleId)) {
      const vehicle = vehicleData.get(selectedVehicleId);
      const lastPosition = vehicle.coordinates[vehicle.coordinates.length - 1];
      if (lastPosition) {
        const latlng = [lastPosition.latitude, lastPosition.longitude];
        getMap().setView(latlng, 15, { animate: true });
      }
    }
  });

  // Update the socket listener to populate the dropdown
  socket.on('updateMultipleVehicles', (vehicles) => {
    vehicleSelect.innerHTML = '<option value="">Select Vehicle</option>';
    vehicles.forEach((data) => {
      if (data.vehicle_id && !document.querySelector(`#vehicle-select option[value="${data.vehicle_id}"]`)) {
        const option = document.createElement('option');
        option.value = data.vehicle_id;
        option.textContent = `Vehicle ${data.vehicle_id}`;
        vehicleSelect.appendChild(option);
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
