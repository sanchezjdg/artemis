// historicalMode.js
// Module to manage historical data loading and integrated trace functionality.
// This module handles loading historical routes based on a selected date range,
// and integrates a trace mode where users can click on the map to view details for specific points.

import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler, clearSearchCircle } from "./utils.js";
import { showToast } from "./toast.js";

let historicalPath = null; // Leaflet polyline for the historical route.
let traceHistoricalData = []; // Array to store loaded historical data points.
let traceViewMarker = null; // Marker to indicate the selected trace point on the map.

/**
 * Initializes historical mode by setting up event listeners on the historical form.
 * This includes the "Load Route" button and the trace mode checkbox.
 */
export function initHistoricalMode() {
  const map = getMap();
  // Clear any previous click handlers on the map.
  map.off("click");

  // Clear any previous trace results.
  document.getElementById("trace-results").innerHTML = "";
  document.getElementById("trace-results").style.display = "none";

  // Set up the trace mode checkbox.
  const enableTraceToggle = document.getElementById("enable-trace-toggle");
  enableTraceToggle.checked = false; // Reset state on each mode activation.
  // Hide the trace radius control initially (only shown when trace mode is enabled).
  document.getElementById("trace-radius-control").style.display = "none";

  // When the trace mode checkbox changes its state.
  enableTraceToggle.addEventListener("change", () => {
    if (enableTraceToggle.checked) {
      // When trace mode is enabled:
      // Show the trace radius slider.
      document.getElementById("trace-radius-control").style.display = "block";
      // Remove any historical polyline and marker from the map.
      clearLayer(historicalPath);
      historicalPath = null;
      clearLayer(getMarker());
    } else {
      // When trace mode is disabled:
      // Hide the trace radius slider.
      document.getElementById("trace-radius-control").style.display = "none";
      // Remove any click events associated with trace mode.
      map.off("click");
      // Optionally, you may choose to reload/display the historical route here.
    }
  });

  // Set up the event listener for the "Load Route" button.
  document.getElementById("load-data").addEventListener("click", async () => {
    // Retrieve the date range values from the inputs.
    const lastStartDate = document.getElementById("start-datetime").value;
    const lastEndDate = document.getElementById("end-datetime").value;

    // Validate that both datetime fields are filled.
    if (!lastStartDate || !lastEndDate) {
      showToast("Please fill in both datetime fields.");
      return;
    }

    // Create complete datetime strings (adding seconds).
    const startDatetime = `${lastStartDate}:00`;
    const endDatetime = `${lastEndDate}:00`;

    const startDateObj = new Date(startDatetime);
    const endDateObj = new Date(endDatetime);

    // Validate that the start time is before the end time.
    if (startDateObj >= endDateObj) {
      showToast("Start datetime must be before end datetime.");
      return;
    }

    try {
      // Disable the Load Route button to indicate the loading process.
      const loadButton = document.getElementById("load-data");
      loadButton.disabled = true;
      loadButton.innerText = "Loading...";

      // Fetch historical route data from the server.
      const response = await fetch(
        `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`,
      );
      const data = await response.json();

      // If no data is returned, notify the user.
      if (data.length === 0) {
        showToast("No route data found for the selected interval.");
        loadButton.disabled = false;
        loadButton.innerText = "Load Route";
        return;
      }

      // Clear any previous historical route from the map.
      clearLayer(historicalPath);
      historicalPath = null;

      // Check if trace mode is NOT enabled.
      if (!document.getElementById("enable-trace-toggle").checked) {
        // Draw the historical route polyline on the map.
        historicalPath = L.polyline(
          data.map((loc) => [loc.latitude, loc.longitude]),
          {
            color: "#8E00C2",
            weight: 4,
            opacity: 0.8,
            lineJoin: "round",
          },
        ).addTo(map);

        // Attach a click handler to the polyline to display position details.
        addPolylineClickHandler(historicalPath, data);
        // Adjust the map view to fit the historical route.
        map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });
        // Update the marker to the last recorded point of the route.
        getMarker().setLatLng([
          data[data.length - 1].latitude,
          data[data.length - 1].longitude,
        ]);
      }

      // Store the loaded route data for potential trace mode actions.
      traceHistoricalData = data;

      // If trace mode is enabled.
      if (document.getElementById("enable-trace-toggle").checked) {
        showToast(
          "Historical data loaded. Click on the map to display trace information.",
        );
        // Remove any historical route elements as they are not needed in trace mode.
        clearLayer(historicalPath);
        historicalPath = null;
        clearLayer(getMarker());
        // Enable map click events for trace functionality.
        map.off("click");
        map.on("click", onMapClickTrace);
      } else {
        // Ensure trace-related click events are turned off.
        map.off("click");
      }

      // Re-enable the Load Route button.
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
 * When in trace mode, clicking the map draws a red search circle at the click location,
 * and displays nearby recorded points.
 * @param {Object} e - The Leaflet event object for a click.
 */
function onMapClickTrace(e) {
  // Check if historical data has been loaded.
  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    showToast("Historical data not loaded. Please load data first.");
    return;
  }

  // Retrieve the search radius value from the slider (default is 100 meters if not set).
  const radiusInput = document.getElementById("search-radius");
  const threshold = parseFloat(radiusInput.value) || 100;
  const clickedLatLng = e.latlng;

  // Clear any previous red search circles.
  clearSearchCircle();

  // Draw a new red search circle at the clicked location.
  const map = getMap();
  L.circle(clickedLatLng, {
    radius: threshold,
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.2,
  }).addTo(map);

  // Filter and identify data points within the search radius.
  const nearbyPoints = traceHistoricalData.filter((point) => {
    const dist = clickedLatLng.distanceTo(
      L.latLng(point.latitude, point.longitude),
    );
    return dist <= threshold;
  });

  // Clear any existing trace results.
  const resultsContainer = document.getElementById("trace-results");
  resultsContainer.innerHTML = "";

  if (nearbyPoints.length === 0) {
    showToast(
      "No vehicle pass detected within the radius. Try clicking closer to the route.",
    );
    return;
  }

  // Build and display a list of nearby points with a "View" button for each.
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

  // Add event listeners to all "View" buttons.
  document.querySelectorAll(".view-point").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const time = btn.dataset.time;
      // Clear any existing trace view marker.
      if (traceViewMarker && map.hasLayer(traceViewMarker)) {
        map.removeLayer(traceViewMarker);
      }
      // Center the map on the selected point.
      map.setView([lat, lng], 17);
      // Create a new marker at the selected point.
      traceViewMarker = L.marker([lat, lng], { id: "trace-view-marker" }).addTo(
        map,
      );
      // Bind and open a popup with details of the recorded moment.
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
