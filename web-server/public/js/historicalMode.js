// historicalMode.js
// Module to manage historical data loading and integrated trace functionality.

import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler } from "./utils.js";
import { showToast } from "./toast.js";

let historicalPath = null;
let traceHistoricalData = [];
let traceViewLine = null;
let temporaryMarker = null;
let dataLoaded = false;

/**
 * Initialize historical mode: sets up event listeners on the historical form.
 */
export function initHistoricalMode() {
  // Remove any pre-existing click handlers.
  const map = getMap();
  // Update radius value display when the slider is moved
const radiusSlider = document.getElementById("search-radius");
const radiusValueDisplay = document.getElementById("radius-value");
  map.off("click");

  // Hide trace results initially.
  document.getElementById("trace-results").innerHTML = "";
  document.getElementById("trace-results").style.display = "none";

  // Hide the regular marker in historical mode
  const marker = getMarker();
  clearLayer(marker);

  // Set up the trace mode checkbox change listener.
  const enableTraceToggle = document.getElementById("enable-trace-toggle");
  // Don't reset trace toggle state, let user control it

  // Ensure the trace radius control visibility matches the toggle state
  document.getElementById("trace-radius-control").style.display =
    enableTraceToggle.checked ? "block" : "none";

  enableTraceToggle.addEventListener("change", () => {
    // Clear any temporary marker when toggling modes
    clearTemporaryMarker();

    if (enableTraceToggle.checked) {
      // When trace mode is enabled:
      // Show the trace radius slider.
      document.getElementById("trace-radius-control").style.display = "block";
      // Eliminar cualquier polilínea visible de ambos vehículos al activar trace
      map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Circle)) {
          map.removeLayer(layer);
        }
      });

      // If data has already been loaded, enable trace functionality
      if (dataLoaded && traceHistoricalData.length > 0) {
        showToast(
          "Trace mode enabled. Click on the map to display trace information.",
        );
        map.off("click");
        map.on("click", onMapClickTrace);
      } else {
        showToast(
          "Please load route data first using the 'Load Route' button.",
        );
      }
    } else {
      // When trace mode is disabled:
      // Hide the trace radius slider.
      document.getElementById("trace-radius-control").style.display = "none";
      // Remove the click event for trace mode
      map.off("click");
      
      clearSearchCircle();
      clearTemporaryMarker();

      // If data has been loaded, redraw the historical path
      if (dataLoaded && traceHistoricalData.length > 0) {
        clearLayer(historicalPath);
        historicalPath = L.polyline(
          traceHistoricalData.map((loc) => [loc.latitude, loc.longitude]),
          {
            color: "#8E00C2",
            weight: 4,
            opacity: 0.8,
            lineJoin: "round",
          },
        ).addTo(map);

        // Attach a click handler to the polyline to show details.
        addPolylineClickHandler(historicalPath, traceHistoricalData);
        // Fit the map bounds to the historical route.
        map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });
      }
    }
  });

  let vehicleSelectHistorical = document.getElementById('vehicle-select-historical');
  if (!vehicleSelectHistorical) {
    vehicleSelectHistorical = document.createElement('select');
    vehicleSelectHistorical.id = 'vehicle-select-historical';
    vehicleSelectHistorical.style.marginTop = '10px';
    vehicleSelectHistorical.style.width = '100%';
    vehicleSelectHistorical.style.padding = '5px';
    vehicleSelectHistorical.style.borderRadius = '5px';
    vehicleSelectHistorical.style.border = '1px solid #ccc';
    vehicleSelectHistorical.style.backgroundColor = '#fff';
    vehicleSelectHistorical.style.color = '#000';
    vehicleSelectHistorical.style.fontSize = '14px';
    vehicleSelectHistorical.style.fontWeight = 'bold';
    vehicleSelectHistorical.style.cursor = 'pointer';
    vehicleSelectHistorical.innerHTML = `
      <option value="all">All Vehicles</option>
      <option value="1">Vehicle 1</option>
      <option value="2">Vehicle 2</option>
    `;
    document.getElementById('historical-form').prepend(vehicleSelectHistorical);
  }
  
// Update the data loading function to include vehicle selection
const loadButton = document.getElementById('load-data');
loadButton.addEventListener('click', async () => {
  const selectedVehicle = vehicleSelectHistorical.value;
  const lastStartDate = document.getElementById('start-datetime').value;
  const lastEndDate = document.getElementById('end-datetime').value;

  if (!lastStartDate || !lastEndDate) {
    showToast('Please fill in both datetime fields.');
    return;
  }

  const startDatetime = `${lastStartDate}:00`;
  const endDatetime = `${lastEndDate}:00`;

  showToast('Loading route data...');

  try {
    let data1 = [], data2 = [];

    if (selectedVehicle === '1' || selectedVehicle === 'all') {
      data1 = await fetch(
        `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}&vehicle_id=1`
      ).then(res => res.json());
    }

    if (selectedVehicle === '2' || selectedVehicle === 'all') {
      data2 = await fetch(
        `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}&vehicle_id=2`
      ).then(res => res.json());
    }

    if (data1.length === 0 && data2.length === 0) {
      showToast('No route data found for the selected vehicle(s).');
      return;
    }

    dataLoaded = true;
    traceHistoricalData = [...data1.map(p => ({ ...p, vehicle_id: 1 })), ...data2.map(p => ({ ...p, vehicle_id: 2 }))];
    clearLayer(historicalPath);

    const map = getMap();

    if (!document.getElementById("enable-trace-toggle").checked) {
      if (data1.length > 0) {
        const polyline1 = L.polyline(data1.map(p => [p.latitude, p.longitude]), {
          color: '#0078FF', weight: 4, opacity: 0.8, lineJoin: 'round'
        }).addTo(map);
        addPolylineClickHandler(polyline1, data1);
      }

      if (data2.length > 0) {
        const polyline2 = L.polyline(data2.map(p => [p.latitude, p.longitude]), {
          color: '#FF5733', weight: 4, opacity: 0.8, lineJoin: 'round'
        }).addTo(map);
        addPolylineClickHandler(polyline2, data2);
      }

      const allCoords = [...data1, ...data2].map(p => [p.latitude, p.longitude]);
      map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    }

    showToast('Route data loaded.');
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Error loading route data.');
  }
});

  radiusSlider.addEventListener("input", () => {
    radiusValueDisplay.textContent = radiusSlider.value;
  });
}

/**
 * Handler for map clicks in trace mode.
 * @param {Object} e - The Leaflet event object.
 */
function onMapClickTrace(e) {
  // Ensure that historical data has been loaded.
  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    showToast("Historical data not loaded. Please load data first.");
    return;
  }

  // Get the search radius from the slider (or default to 100 meters).
  const radiusInput = document.getElementById("search-radius");
  const threshold = parseFloat(radiusInput.value) || 100;
  const clickedLatLng = e.latlng;

  // Clear any previous search circle from the map.
  clearSearchCircle();

  // Clear any temporary marker if it exists
  clearTemporaryMarker();

  // Create and add a search circle to the map.
  const map = getMap();
  const searchCircle = L.circle(clickedLatLng, {
    radius: threshold,
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.2,
  }).addTo(map);

  // Filter data points that are within the search radius.
  const nearbyPoints = traceHistoricalData.filter((point) => {
    const dist = clickedLatLng.distanceTo(
      L.latLng(point.latitude, point.longitude),
    );
    return dist <= threshold;
  });

  // Clear previous trace results.
  const resultsContainer = document.getElementById("trace-results");
  resultsContainer.innerHTML = "";

  if (nearbyPoints.length === 0) {
    showToast(
      "No vehicle pass detected within the radius. Try clicking closer to the route.",
    );
    return;
  }

  // Display each nearby point as a result with a "View" button.
  // Guardar puntos cercanos para navegación por slider
  window.traceSliderPoints = nearbyPoints;
  const slider = document.getElementById("trace-time-slider");
  const sliderControl = document.getElementById("trace-time-slider-control");
  const timestampDisplay = document.getElementById("trace-timestamp-display");

  slider.max = nearbyPoints.length - 1;
  slider.value = 0;
  sliderControl.style.display = "block";
  resultsContainer.style.display = "none"; // Ocultamos lista anterior
  timestampDisplay.innerText = nearbyPoints[0].timestamp;

  // Mostrar el primer punto en el mapa inmediatamente
  showTracePointOnMap(nearbyPoints[0]);

  // Al mover el slider, actualizar el punto mostrado
  slider.oninput = () => {
    const point = nearbyPoints[slider.value];
    timestampDisplay.innerText = point.timestamp;
    showTracePointOnMap(point);
  };


  // Add click handlers to each "View" button.
  document.querySelectorAll(".view-point").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const time = btn.dataset.time;

      // Clear any temporary marker if it exists
      clearTemporaryMarker();

      // Create a new temporary marker at this location
      temporaryMarker = L.marker([lat, lng]).addTo(map);
      temporaryMarker
        .bindPopup(
          `<b>Recorded Moment</b><br>
          Lat: ${lat.toFixed(5)}<br>
          Lng: ${lng.toFixed(5)}<br>
          RPM: ${point.rpm !== null ? point.rpm : 'No data'}<br>
          Timestamp: ${time}`
        )
        .openPopup();

      // Center the map on the clicked point
      map.setView([lat, lng], 17);
    });
  });
}

/**
 * Utility function to clear any existing search circle from the map.
 */
function clearSearchCircle() {
  const map = getMap();
  // Iterate over map layers and remove any circles with a red border.
  map.eachLayer((layer) => {
    if (layer instanceof L.Circle && layer.options.color === "red") {
      map.removeLayer(layer);
    }
  });
}

/**
 * Utility function to clear the temporary marker from the map.
 */
function clearTemporaryMarker() {
  if (temporaryMarker) {
    const map = getMap();
    map.removeLayer(temporaryMarker);
    temporaryMarker = null;
  }
}

function showTracePointOnMap(point) {
  const { latitude: lat, longitude: lng, timestamp: time, vehicle_id, rpm } = point;

  clearTemporaryMarker();

  // Asignar color según el ID del vehículo
  const colorMap = {
    1: "#3b65ff", // Azul
    2: "#ff3b3b", // Rojo/Naranja
  };
  const fillColor = colorMap[vehicle_id] || "#666";

  // Crear marcador tipo círculo con color por vehículo
  temporaryMarker = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: fillColor,
    color: "#fff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8,
  }).addTo(getMap());

  temporaryMarker
    .bindPopup(
      `<b>Vehicle ${vehicle_id}</b><br>
       Lat: ${lat.toFixed(5)}<br>
       Lng: ${lng.toFixed(5)}<br>
       RPM: ${rpm !== null ? rpm : "No data"}<br>
       Timestamp: ${time}`
    )
    .openPopup();

  getMap().setView([lat, lng], 17);
}

/**
 * Export the clear functions to be used externally.
 */
export function cleanupHistoricalMode() {
  clearSearchCircle();
  clearTemporaryMarker();

  // Remove the polyline if it exists
  if (historicalPath) {
    const map = getMap();
    map.removeLayer(historicalPath);
    historicalPath = null;
  }

  // Reset data loaded state
  dataLoaded = false;

  // Ocultar y resetear el slider de tiempo
  const sliderControl = document.getElementById("trace-time-slider-control");
  const slider = document.getElementById("trace-time-slider");
  const timestampDisplay = document.getElementById("trace-timestamp-display");

  if (sliderControl) sliderControl.style.display = "none";
  if (slider) {
    slider.value = 0;
    slider.max = 0;
  }
  if (timestampDisplay) timestampDisplay.innerText = "";
}