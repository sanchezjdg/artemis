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
        
        // Auto-center logic
        const selected = document.getElementById("vehicle-select").value;
        const isAutoCenterEnabled = document.getElementById("auto-center-toggle").checked;

        if (
          isAutoCenterEnabled &&
          selected !== "all" &&
          parseInt(selected) === vehicleId
        ) {
          map.setView(latlng, 15, { animate: true });
        }

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

        // Update marker popup to use the user-friendly timestamp format
        vehicle.marker.bindPopup(
          `<strong>Vehicle ${vehicleId}</strong><br>
           Latitude: ${data.latitude.toFixed(5)}<br>
           Longitude: ${data.longitude.toFixed(5)}<br>
           ${formatTimestamp(data.timestamp)}`
        );
      }
    });

    const selected = document.getElementById("vehicle-select").value;
    const allLatLngs = [];

    if (selected === "all") {
      vehicleData.forEach((vehicle) => {
        const coords = vehicle.coordinates;
        if (coords.length > 0) {
          coords.forEach((c) => allLatLngs.push([c.latitude, c.longitude]));
        }
      });

      if (allLatLngs.length > 0) {
        map.fitBounds(allLatLngs, { padding: [50, 50] });
      }
    }

  });

  // Request latest location data immediately after entering real-time mode
  socket.emit("requestLatest");

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
    vehicleSelect.innerHTML = `
    <option value="all">All Vehicles</option>
    <option value="1">Vehicle 1</option>
    <option value="2">Vehicle 2</option>
    `;
    document.getElementById('real-time-controls').appendChild(vehicleSelect);
  }
  // Update the real-time updates function to handle vehicle selection
  vehicleSelect.addEventListener('change', () => {
    const selected = vehicleSelect.value;
    const autoCenterToggle = document.getElementById("auto-center-toggle");
  
    autoCenterToggle.parentElement.style.display = "block";
    autoCenterToggle.disabled = selected === "all";
    autoCenterToggle.checked = selected !== "all";
    
  
    vehicleData.forEach((vehicle, id) => {
      const show = selected === "all" || parseInt(selected) === id;
      if (show) {
        vehicle.path.addTo(getMap());
        vehicle.marker.addTo(getMap());
      } else {
        getMap().removeLayer(vehicle.path);
        getMap().removeLayer(vehicle.marker);
      }
    });
  
    // Centrar mapa en el vehículo seleccionado si hay datos
    if (selected !== "all") {
      const selectedId = parseInt(selected);
      if (vehicleData.has(selectedId)) {
        const last = vehicleData.get(selectedId).coordinates.at(-1);
        if (last) {
          getMap().setView([last.latitude, last.longitude], 15, { animate: true });
        }
      }
    }
  });
  
  vehicleSelect.value = 'all'; // selecciona "All Vehicles" por defecto

  const autoCenterToggle = document.getElementById("auto-center-toggle");
  if (autoCenterToggle) {
    autoCenterToggle.parentElement.style.display = "block"; // asegúrate de que se muestre
    autoCenterToggle.disabled = true; // desactívalo si estamos en "all"
    autoCenterToggle.checked = false;
  }
  
  // Update the socket listener to populate the dropdown
  // Ensure dropdown always includes 'All Vehicles' as the first option
  if (!document.querySelector('#vehicle-select option[value="all"]')) {
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Vehicles';
    vehicleSelect.appendChild(allOption);
  }

  // Add missing vehicle options without clearing the existing list
  vehicles.forEach((data) => {
    if (
      data.vehicle_id &&
      !document.querySelector(`#vehicle-select option[value="${data.vehicle_id}"]`)
    ) {
      const option = document.createElement('option');
      option.value = data.vehicle_id;
      option.textContent = `Vehicle ${data.vehicle_id}`;
      vehicleSelect.appendChild(option);
    }
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
