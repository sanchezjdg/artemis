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
      // Remove historical polyline as it's not needed in trace mode
      clearLayer(historicalPath);
      historicalPath = null;

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

  // Set up event listener for the data loading button.
  document.getElementById("load-data").addEventListener("click", async () => {
    // Retrieve the date range values.
    const lastStartDate = document.getElementById("start-datetime").value;
    const lastEndDate = document.getElementById("end-datetime").value;

    // Validate that both date fields are filled.
    if (!lastStartDate || !lastEndDate) {
      showToast("Please fill in both datetime fields.");
      return;
    }

    // Create complete datetime strings.
    const startDatetime = `${lastStartDate}:00`;
    const endDatetime = `${lastEndDate}:00`;

    const startDateObj = new Date(startDatetime);
    const endDateObj = new Date(endDatetime);

    // Validate that the start date is before the end date.
    if (startDateObj >= endDateObj) {
      showToast("Start datetime must be before end datetime.");
      return;
    }

    try {
      // Indicate loading process by disabling the button.
      const loadButton = document.getElementById("load-data");
      loadButton.disabled = true;
      loadButton.innerText = "Loading...";

      // Fetch historical data from the server.
      const response = await fetch(
        `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`,
      );
      const data = await response.json();

      // Check if no data is returned.
      if (data.length === 0) {
        showToast("No route data found for the selected interval.");
        loadButton.disabled = false;
        loadButton.innerText = "Load Route";
        dataLoaded = false;
        return;
      }

      // Store the loaded data for both modes
      traceHistoricalData = data;
      dataLoaded = true;

      const map = getMap();
      const enableTraceToggle = document.getElementById("enable-trace-toggle");

      // Clear any existing elements
      clearLayer(historicalPath);
      historicalPath = null;
      clearTemporaryMarker();

      // If trace mode is not enabled, display the historical route.
      if (!enableTraceToggle.checked) {
        // Create a new polyline for the historical route.
        historicalPath = L.polyline(
          data.map((loc) => [loc.latitude, loc.longitude]),
          {
            color: "#8E00C2",
            weight: 4,
            opacity: 0.8,
            lineJoin: "round",
          },
        ).addTo(map);

        // Attach a click handler to the polyline to show details.
        addPolylineClickHandler(historicalPath, data);
        // Fit the map bounds to the historical route.
        map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });
      }

      // Check if trace mode is enabled.
      if (enableTraceToggle.checked) {
        showToast(
          "Historical data loaded. Click on the map to display trace information.",
        );
        // Set up the map click handler for trace mode.
        map.off("click");
        map.on("click", onMapClickTrace);
      } else {
        // If trace mode is disabled, ensure that map click events for trace are turned off.
        map.off("click");
      }

      loadButton.disabled = false;
      loadButton.innerText = "Load Route";
    } catch (error) {
      console.error("Error fetching historical data:", error);
      showToast("Error loading historical data.");
      const loadButton = document.getElementById("load-data");
      loadButton.disabled = false;
      loadButton.innerText = "Load Route";
      dataLoaded = false;
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
  const fragment = document.createDocumentFragment();
  nearbyPoints.forEach((point) => {
    const div = document.createElement("div");
    div.className = "trace-result";
    div.innerHTML = `
      <div><b>${point.timestamp}</b></div>
      <button class="view-point" data-lat="${point.latitude}" data-lng="${point.longitude}" data-time="${point.timestamp}">View</button>
      <hr>`;
    fragment.appendChild(div);
  });
  resultsContainer.appendChild(fragment);
  resultsContainer.style.display = "block";

  // Add click handlers to each "View" button.
  document.querySelectorAll(".view-point").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const time = btn.dataset.time;

      // Remove previous trace view line if it exists.
      if (traceViewLine && getMap().hasLayer(traceViewLine)) {
        clearLayer(traceViewLine);
        traceViewLine = null;
      }

      // Clear any temporary marker if it exists
      clearTemporaryMarker();

      // Create a new temporary marker at this location
      temporaryMarker = L.marker([lat, lng]).addTo(map);
      temporaryMarker
        .bindPopup(
          `<b>Recorded Moment</b><br>
         Lat: ${lat.toFixed(5)}<br>
         Lng: ${lng.toFixed(5)}<br>
         Timestamp: ${time}`,
        )
        .openPopup();

      // Center the map on the clicked point
      map.setView([lat, lng], 17);

      // Find the index of the clicked point within the historical data.
      const clickedIndex = traceHistoricalData.findIndex(
        (p) =>
          p.latitude === lat && p.longitude === lng && p.timestamp === time,
      );
      if (clickedIndex === -1) return;

      // Determine a segment of the route around the clicked point based on the threshold distance.
      let startIndex = clickedIndex;
      while (startIndex > 0) {
        const dist = L.latLng(lat, lng).distanceTo(
          L.latLng(
            traceHistoricalData[startIndex].latitude,
            traceHistoricalData[startIndex].longitude,
          ),
        );
        if (dist > threshold) {
          startIndex++;
          break;
        }
        startIndex--;
      }
      let endIndex = clickedIndex;
      while (endIndex < traceHistoricalData.length) {
        const dist = L.latLng(lat, lng).distanceTo(
          L.latLng(
            traceHistoricalData[endIndex].latitude,
            traceHistoricalData[endIndex].longitude,
          ),
        );
        if (dist > threshold) {
          endIndex--;
          break;
        }
        endIndex++;
      }
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
  // Reset the flag of loaded data
  dataLoaded = false;
}
