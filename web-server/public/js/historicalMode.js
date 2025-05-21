// historicalMode.js
// Module to manage historical data loading and integrated trace functionality.

import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler } from "./utils.js";
import { showToast } from "./toast.js";
import { updateFixedPanel } from "./utils.js";

let historicalPath = null;
export let traceHistoricalData = [];
let traceViewLine = null;
let temporaryMarker = null;
let dataLoaded = false;
let searchCircle = null; // Add global variable to track search circle
let lastClickedPosition = null;
let tracePolyline = null;

// Add variable to track last known vehicle position
let lastKnownPosition = null;

/**
 * Initialize historical mode: sets up event listeners on the historical form.
 */

//Modified
export function initHistoricalMode() {
  const map = getMap();
  const radiusSlider = document.getElementById("search-radius");
  const radiusValueDisplay = document.getElementById("radius-value");
  map.off("click");

  document.getElementById("trace-results").innerHTML = "";
  document.getElementById("trace-results").style.display = "none";

  // Ensure the trace radius control visibility matches the toggle state
  document.getElementById("trace-radius-control").style.display = "none";

  const marker = getMarker();
  clearLayer(marker);

  const enableTraceToggleContainer = document.getElementById("enable-trace-toggle-container");
  if (!enableTraceToggleContainer) {
    const container = document.createElement("div");
    container.id = "enable-trace-toggle-container";
    container.className = "trace-toggle-container";

    const switchLabel = document.createElement("label");
    switchLabel.className = "switch";

    const switchInput = document.createElement("input");
    switchInput.type = "checkbox";
    switchInput.id = "enable-trace-toggle";

    const switchSpan = document.createElement("span");
    switchSpan.className = "slider round";

    const labelText = document.createElement("span");
    labelText.textContent = "Enable Trace Search";
    labelText.style.marginLeft = "10px";

    switchLabel.appendChild(switchInput);
    switchLabel.appendChild(switchSpan);
    container.appendChild(switchLabel);
    container.appendChild(labelText);

    // Crear un contenedor para los elementos adicionales (como trace-radius-control)
    const traceOptionsContainer = document.createElement("div");
    traceOptionsContainer.id = "trace-options-container";
    traceOptionsContainer.className = "trace-options-container";
    traceOptionsContainer.style.display = "none"; // Inicialmente oculto

    // Mover los elementos trace-radius-control y trace-time-slider-control al nuevo contenedor
    const traceRadiusControl = document.getElementById("trace-radius-control");
    const traceTimeSliderControl = document.getElementById("trace-time-slider-control");
    if (traceRadiusControl) traceOptionsContainer.appendChild(traceRadiusControl);
    if (traceTimeSliderControl) traceOptionsContainer.appendChild(traceTimeSliderControl);

    // Crear el botón de expandir/minimizar
    const toggleButton = document.createElement("button");
    toggleButton.id = "trace-options-toggle";
    toggleButton.className = "trace-options-toggle";
    toggleButton.innerHTML = "▼ Show Options";
    toggleButton.style.display = "none"; // Oculto hasta que se active Enable Trace Mode

    // Añadir el botón y el contenedor al DOM
    container.appendChild(toggleButton);
    container.appendChild(traceOptionsContainer);

    document.getElementById("historical-form").appendChild(container);
  }

  const newTraceToggle = document.getElementById("enable-trace-toggle");
  newTraceToggle.checked = false;

  const traceOptionsContainer = document.getElementById("trace-options-container");
  const toggleButton = document.getElementById("trace-options-toggle");

  let traceModeToastShown = false;

  newTraceToggle.addEventListener("change", () => {
    const map = getMap();
    map.off("click");

    clearTemporaryMarker();
    clearSearchCircle();

    if (historicalPath) {
      if (Array.isArray(historicalPath)) {
        historicalPath.forEach(path => {
          if (path) clearLayer(path);
        });
      } else {
        clearLayer(historicalPath);
      }
      historicalPath = null;
    }

    if (newTraceToggle.checked) {
      // When trace mode is enabled:
      // Show the trace radius slider.
      document.getElementById("trace-radius-control").style.display = "block";
      // Eliminar cualquier polilínea visible de ambos vehículos al activar trace
      map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Circle)) {
          map.removeLayer(layer);
        }
      });

      // Mostrar el botón de expandir/minimizar
      toggleButton.style.display = "block";
      traceOptionsContainer.style.display = "block"; // Mostrar inicialmente

      // If data has already been loaded, enable trace functionality
      if (dataLoaded && traceHistoricalData.length > 0) {
        // Clear any existing search circle when enabling trace mode
        if (searchCircle) {
          map.removeLayer(searchCircle);
          searchCircle = null;
        }

        // Start with the first point from the historical data
        const firstPoint = traceHistoricalData[0];
        const initialPosition = L.latLng(firstPoint.latitude, firstPoint.longitude);
        lastClickedPosition = initialPosition;
        performTraceSearch(initialPosition);

        // Show the toast message only if it hasn't been shown yet
        if (!traceModeToastShown) {
          showToast("Trace mode enabled. Click on the map to display trace information.");
          traceModeToastShown = true;
        }

        map.on("click", onMapClickTrace);
      } else {
        showToast("Please load route data first using the 'Load Route' button.");
        toggleButton.style.display = "none"; // Ocultar si no hay datos
        traceOptionsContainer.style.display = "none";
      }
    } else {
      // When trace mode is disabled:
      // Hide both the trace radius slider and the detected moments slider
      document.getElementById("trace-radius-control").style.display = "none";
      document.getElementById("trace-time-slider-control").style.display = "none";
      // Ocultar el contenedor de opciones y el botón de toggle
      toggleButton.style.display = "none";
      traceOptionsContainer.style.display = "none";
      // Remove the click event for trace mode
      map.off("click");

      clearSearchCircle();
      clearTemporaryMarker();

      // If data has been loaded, redraw the historical paths with original colors
      if (dataLoaded && traceHistoricalData.length > 0) {
        displayHistoricalPaths();
      }

      // Reset the toast flag when disabling trace mode
      traceModeToastShown = false;
    }
  });

  // Añadir funcionalidad al botón de expandir/minimizar
  toggleButton.addEventListener("click", () => {
    if (traceOptionsContainer.style.display === "none") {
      traceOptionsContainer.style.display = "block";
      document.getElementById("trace-radius-control").style.display = "block";
      if (document.getElementById("trace-time-slider-control").style.display === "block") {
        document.getElementById("trace-time-slider-control").style.display = "block";
      }
      toggleButton.innerHTML = "▲ Hide Options";
    } else {
      traceOptionsContainer.style.display = "none";
      document.getElementById("trace-radius-control").style.display = "none";
      document.getElementById("trace-time-slider-control").style.display = "none";
      toggleButton.innerHTML = "▼ Show Options ";
    }
  });

  //Modified

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

  // Setup the auto-loading functionality
  const startDate = document.getElementById('start-datetime');
  const endDate = document.getElementById('end-datetime');
  let lastFetchedStart = null;
  let lastFetchedEnd = null;
  let allHistoricalData = [];

  // Create a debounced version of loadAndDisplayRoute
  let loadTimeout = null;
  const debouncedLoad = () => {
    if (loadTimeout) {
      clearTimeout(loadTimeout);
    }
    loadTimeout = setTimeout(loadAndDisplayRoute, 500);
  };

  async function loadAndDisplayRoute() {
    const selectedVehicle = vehicleSelectHistorical.value;
    const startDateTime = startDate.value;
    const endDateTime = endDate.value;

    if (!startDateTime || !endDateTime) {
      return;
    }

    try {
      // Only fetch new data if dates have changed
      if (allHistoricalData.length === 0 || 
          startDateTime !== lastFetchedStart || 
          endDateTime !== lastFetchedEnd) {
            
        showToast('Loading route data...');
        const response = await fetch(
          `/historical?start=${encodeURIComponent(startDateTime + ':00')}&end=${encodeURIComponent(endDateTime + ':00')}`
        );
        allHistoricalData = await response.json();
        lastFetchedStart = startDateTime;
        lastFetchedEnd = endDateTime;
      }

      // Filter data based on selected vehicle
      let data1 = [], data2 = [];
      if (selectedVehicle === 'all') {
        data1 = allHistoricalData.filter(p => p.vehicle_id === 1);
        data2 = allHistoricalData.filter(p => p.vehicle_id === 2);
      } else {
        const vehicleId = parseInt(selectedVehicle);
        if (vehicleId === 1) data1 = allHistoricalData.filter(p => p.vehicle_id === 1);
        if (vehicleId === 2) data2 = allHistoricalData.filter(p => p.vehicle_id === 2);
      }

      if (data1.length === 0 && data2.length === 0) {
        showToast('No route data found for the selected vehicle(s).');

        // Clear any existing polylines
        const map = getMap();
        map.eachLayer((layer) => {
          if (layer instanceof L.Polyline && !(layer instanceof L.Circle)) {
            map.removeLayer(layer);
          }
        });

        // Hide the trace mode toggle if no data is available
        const enableTraceToggleContainer = document.getElementById("enable-trace-toggle-container");
        if (enableTraceToggleContainer) {
          enableTraceToggleContainer.style.display = "none";
        }
        return;
      }

      dataLoaded = true;
      traceHistoricalData = [...data1.map(p => ({ ...p, vehicle_id: 1 })), ...data2.map(p => ({ ...p, vehicle_id: 2 }))];
      displayHistoricalPaths();

      // Show the trace mode toggle only when data is loaded
      const enableTraceToggleContainer = document.getElementById("enable-trace-toggle-container");
      if (enableTraceToggleContainer) {
        enableTraceToggleContainer.style.display = "block";
      }

      // Reactivate trace if enabled
      if (newTraceToggle.checked) {
        getMap().off("click", onMapClickTrace);
        const event = new Event("change");
        newTraceToggle.dispatchEvent(event);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Error loading route data.');
    }
  }

  // Set up event listeners with debouncing
  startDate.addEventListener('change', debouncedLoad);
  endDate.addEventListener('change', debouncedLoad);
  vehicleSelectHistorical.addEventListener('change', debouncedLoad);

  // Hide the load button since it's no longer needed
  const loadButton = document.getElementById('load-data');
  if (loadButton) {
    loadButton.style.display = 'none';
  }

  // Load data initially if both dates are set
  if (startDate.value && endDate.value) {
    loadAndDisplayRoute();
  }

  radiusSlider.addEventListener("input", () => {
    radiusValueDisplay.textContent = radiusSlider.value;
    if (newTraceToggle.checked && lastClickedPosition) {
      performTraceSearch(lastClickedPosition, false);
    }
  });

  // If trace toggle is already active, rerun its logic as if it was manually changed
  if (newTraceToggle.checked) {
    const event = new Event("change");
    newTraceToggle.dispatchEvent(event);
  }
}

/**
 * Handler for map clicks in trace mode.
 * @param {Object} e - The Leaflet event object.
 */
function onMapClickTrace(e) {
  lastClickedPosition = e.latlng;
  performTraceSearch(e.latlng, true);
}

function performTraceSearch(clickedLatLng, isNewClick = false) {
  // Ensure that historical data has been loaded.
  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    showToast("Historical data not loaded. Please load data first.");
    return;
  }

  // Get the search radius from the slider (or default to 100 meters).
  const radiusInput = document.getElementById("search-radius");
  const threshold = parseFloat(radiusInput.value) || 100;

  // Clear any previous search circle from the map.
  clearSearchCircle();

  // Clear any temporary marker if it exists
  clearTemporaryMarker();

  // Create and add a search circle to the map.
  const map = getMap();
  searchCircle = L.circle(clickedLatLng, {
    radius: threshold,
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.2,
  }).addTo(map);

  // Filter data points that are within the search radius and sort by timestamp
  const nearbyPoints = traceHistoricalData.filter((point) => {
    const dist = clickedLatLng.distanceTo(
      L.latLng(point.latitude, point.longitude),
    );
    return dist <= threshold;
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Clear previous trace results.
  const resultsContainer = document.getElementById("trace-results");
  resultsContainer.innerHTML = "";

  if (nearbyPoints.length === 0) {
    // Clear the slider and detected moments if no points are found
    const sliderControl = document.getElementById("trace-time-slider-control");
    const slider = document.getElementById("trace-time-slider");
    const timestampDisplay = document.getElementById("trace-timestamp-display");

    if (sliderControl) sliderControl.style.display = "none";
    if (slider) {
      slider.value = 0;
      slider.max = 0;
      slider.oninput = null; // 🛑 Desactivar el evento del slider
    }
    if (timestampDisplay) timestampDisplay.innerText = "";

    // Only show the toast message if this is a new click position
    if (isNewClick) {
      showToast(
        "No vehicle pass detected within the radius. Try clicking closer to the route.",
      );
    }

    // 🛑 Limpiar tracePolyline si no se encontraron puntos
    if (tracePolyline) {
      if (Array.isArray(tracePolyline)) {
        tracePolyline.forEach(line => getMap().removeLayer(line));
      } else {
        getMap().removeLayer(tracePolyline);
      }
      tracePolyline = null;
    }

    // 🛑 Borrar los puntos guardados para el slider
    window.traceSliderPoints = [];
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
  showTracePointOnMap(nearbyPoints[0])
  
  
// Agrupar puntos por vehicle_id
const groupedByVehicle = {};
nearbyPoints.forEach(point => {
  const { vehicle_id } = point;
  if (!groupedByVehicle[vehicle_id]) {
    groupedByVehicle[vehicle_id] = [];
  }
  groupedByVehicle[vehicle_id].push([point.latitude, point.longitude]);
});

// Borrar polilíneas anteriores si las hay
if (tracePolyline) {
  if (Array.isArray(tracePolyline)) {
    tracePolyline.forEach(line => getMap().removeLayer(line));
  } else {
    getMap().removeLayer(tracePolyline);
  }
  tracePolyline = null;
}

// Crear una línea por cada vehículo
tracePolyline = Object.entries(groupedByVehicle).map(([vehicleId, coords]) => {
  const colorMap = {
    1: "#3b65ff", // azul
    2: "#ff3b3b", // rojo
  };
  return L.polyline(coords, {
    color: colorMap[vehicleId] || "#555",
    weight: 4,
    opacity: 0.8,
    lineJoin: 'round',
  }).addTo(getMap());
});

  // Al mover el slider, actualizar el punto mostrado
  slider.oninput = () => {
    const point = nearbyPoints[slider.value];
    timestampDisplay.innerText = point.timestamp;
    showTracePointOnMap(point);
  };
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

  // Clear the global searchCircle variable
  searchCircle = null;
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

  // Update last known position
  lastKnownPosition = L.latLng(lat, lng);
  
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

  // 🟢 Actualiza el panel fijo en la esquina
  updateFixedPanel(vehicle_id, lat, lng, rpm, time);
}

/**
 * Export the clear functions to be used externally.
 */
export function cleanupHistoricalMode() {
  lastClickedPosition = null; // Reset last clicked position
  
  // Limpiar círculo de búsqueda
  if (searchCircle) {
    const map = getMap();
    map.removeLayer(searchCircle);
    searchCircle = null;
  }

  // Limpiar marcador temporal
  clearTemporaryMarker();

  // Limpiar polilíneas históricas
  if (historicalPath) {
    const map = getMap();
    if (Array.isArray(historicalPath)) {
      historicalPath.forEach(path => {
        if (path) map.removeLayer(path);
      });
    } else {
      map.removeLayer(historicalPath);
    }
    historicalPath = null;
  }

  // Limpiar polilíneas de trace
  if (tracePolyline) {
    const map = getMap();
    if (Array.isArray(tracePolyline)) {
      tracePolyline.forEach(line => map.removeLayer(line));
    } else {
      map.removeLayer(tracePolyline);
    }
    tracePolyline = null;
  }

  // Limpiar cualquier polilínea residual
  const map = getMap();
  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline && !(layer instanceof L.Circle)) {
      map.removeLayer(layer);
    }
  });

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

// Helper function to display historical paths on the map
function displayHistoricalPaths() {
  const map = getMap();
  
  // Clear existing polylines
  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline && !(layer instanceof L.Circle)) {
      map.removeLayer(layer);
    }
  });

  // Group data by vehicle
  const data1 = traceHistoricalData.filter(p => p.vehicle_id === 1);
  const data2 = traceHistoricalData.filter(p => p.vehicle_id === 2);

  if (data1.length > 0) {
    const polyline1 = L.polyline(data1.map(p => [p.latitude, p.longitude]), {
      color: '#3b65ff', weight: 4, opacity: 0.8, lineJoin: 'round'
    }).addTo(map);
    addPolylineClickHandler(polyline1, data1);
  }

  if (data2.length > 0) {
    const polyline2 = L.polyline(data2.map(p => [p.latitude, p.longitude]), {
      color: '#ff3b3b', weight: 4, opacity: 0.8, lineJoin: 'round'
    }).addTo(map);
    addPolylineClickHandler(polyline2, data2);
  }

  const allCoords = [...data1, ...data2].map(p => [p.latitude, p.longitude]);
  if (allCoords.length > 0) {
    map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
  }
}