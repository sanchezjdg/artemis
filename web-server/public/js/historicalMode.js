// historicalMode.js
// Module to manage historical data loading and integrated trace functionality.

import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler, clearSearchCircle } from "./utils.js";
import { showToast } from "./toast.js";

let historicalPath = null;
let traceHistoricalData = [];
let traceViewMarker = null; // Global marker for trace view point

/**
 * Initialize historical mode: sets up event listeners for the historical form.
 */
export function initHistoricalMode() {
  const map = getMap();
  // Clear any previous click handlers.
  map.off("click");

  // Clear trace results.
  document.getElementById("trace-results").innerHTML = "";
  document.getElementById("trace-results").style.display = "none";

  // Set up the trace mode checkbox.
  const enableTraceToggle = document.getElementById("enable-trace-toggle");
  enableTraceToggle.checked = false; // Reset on each mode activation.
  // Hide the trace radius control initially.
  document.getElementById("trace-radius-control").style.display = "none";

  // Listen to changes on the trace mode checkbox.
  enableTraceToggle.addEventListener("change", () => {
    if (enableTraceToggle.checked) {
      // When trace mode is enabled:
      // Show the trace radius slider.
      document.getElementById("trace-radius-control").style.display = "block";
      // Remove historical polyline and marker (as trace mode should not show these).
      clearLayer(historicalPath);
      historicalPath = null;
      clearLayer(getMarker());
    } else {
      // When trace mode is disabled, hide the trace radius slider and remove map click events.
      document.getElementById("trace-radius-control").style.display = "none";
      map.off("click");
      // Optionally, you can reload historical data here if needed.
    }
  });

  // Set up the event listener for the "Load Route" button.
  document.getElementById("load-data").addEventListener("click", async () => {
    // Retrieve and validate date range.
    const lastStartDate = document.getElementById("start-datetime").value;
    const lastEndDate = document.getElementById("end-datetime").value;
    if (!lastStartDate || !lastEndDate) {
      showToast("Please fill in both datetime fields.");
      return;
    }
    const startDatetime = `${lastStartDate}:00`;
    const endDatetime = `${lastEndDate}:00`;
    const startDateObj = new Date(startDatetime);
    const endDateObj = new Date(endDatetime);
    if (startDateObj >= endDateObj) {
      showToast("Start datetime must be before end datetime.");
      return;
    }

    try {
      // Disable the load button.
      const loadButton = document.getElementById("load-data");
      loadButton.disabled = true;
      loadButton.innerText = "Loading...";

      // Fetch historical route data.
      const response = await fetch(
        `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`,
      );
      const data = await response.json();

      if (data.length === 0) {
        showToast("No route data found for the selected interval.");
        loadButton.disabled = false;
        loadButton.innerText = "Load Route";
        return;
      }

      // Clear previous historical layers.
      clearLayer(historicalPath);
      historicalPath = null;

      // Check if trace mode is enabled.
      if (!document.getElementById("enable-trace-toggle").checked) {
        // If not in trace mode, draw the historical route.
        historicalPath = L.polyline(
          data.map((loc) => [loc.latitude, loc.longitude]),
          {
            color: "#8E00C2",
            weight: 4,
            opacity: 0.8,
            lineJoin: "round",
          },
        ).addTo(map);

        // Attach a click handler to show popup details.
        addPolylineClickHandler(historicalPath, data);
        map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });
        // Update marker to the last point.
        getMarker().setLatLng([
          data[data.length - 1].latitude,
          data[data.length - 1].longitude,
        ]);
      }
      // Store data for trace mode.
      traceHistoricalData = data;

      if (document.getElementById("enable-trace-toggle").checked) {
        showToast(
          "Historical data loaded. Click on the map to display trace information.",
        );
        // Remove any historical layer remnants.
        clearLayer(historicalPath);
        historicalPath = null;
        clearLayer(getMarker());
        // Set the map to listen for click events.
        map.off("click");
        map.on("click", onMapClickTrace);
      } else {
        // Ensure trace-related click events are disabled.
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
    }
  });
}

/**
 * Handler for map clicks in trace mode.
 * @param {Object} e - The Leaflet event object.
 */
function onMapClickTrace(e) {
  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    showToast("Historical data not loaded. Please load data first.");
    return;
  }
  const radiusInput = document.getElementById("search-radius");
  const threshold = parseFloat(radiusInput.value) || 100;
  const clickedLatLng = e.latlng;
  // Clear any previous red search circles.
  clearSearchCircle();

  // Create a red search circle at the clicked point.
  const map = getMap();
  L.circle(clickedLatLng, {
    radius: threshold,
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.2,
  }).addTo(map);

  // Find nearby data points within the threshold.
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

  // Display trace results with a "View" button.
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

  // Add click handlers for each "View" button.
  document.querySelectorAll(".view-point").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const time = btn.dataset.time;
      // Clear any previous trace view marker.
      if (traceViewMarker && map.hasLayer(traceViewMarker)) {
        map.removeLayer(traceViewMarker);
      }
      // Center the map on the selected point.
      map.setView([lat, lng], 17);
      // Add a marker at the selected point.
      traceViewMarker = L.marker([lat, lng], { id: "trace-view-marker" }).addTo(
        map,
      );
      traceViewMarker
        .bindPopup(
          `<b>Recorded Moment</b><br>
         Lat: ${lat.toFixed(5)}<br>
         Lng: ${lng.toFixed(5)}<br>
         Timestamp: ${time}`,
        )
        .openPopup();
    });
  });
}
