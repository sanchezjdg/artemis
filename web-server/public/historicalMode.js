// historicalMode.js
// Module to manage historical data loading and integrated trace functionality.

import { getMap, getMarker, clearLayer } from "./mapHandler.js";
import { addPolylineClickHandler } from "./utils.js";
import { showToast } from "./toast.js";

let historicalPath = null;
let traceHistoricalData = [];
let traceViewLine = null;

/**
 * Initialize historical mode: sets up event listeners on historical form.
 */
export function initHistoricalMode() {
  // Remove any pre-existing click handlers and layers.
  const map = getMap();
  map.off("click"); // Remove any leftover map click events.

  // Clear any displayed trace results.
  document.getElementById("trace-results").innerHTML = "";
  document.getElementById("trace-results").style.display = "none";

  // Add event listener for data loading.
  document.getElementById("load-data").addEventListener("click", async () => {
    // Retrieve date range values.
    const lastStartDate = document.getElementById("start-datetime").value;
    const lastEndDate = document.getElementById("end-datetime").value;

    // Validate that both date fields are filled.
    if (!lastStartDate || !lastEndDate) {
      showToast("Please fill in both datetime fields.");
      return;
    }

    // Append seconds to create full datetime strings.
    const startDatetime = `${lastStartDate}:00`;
    const endDatetime = `${lastEndDate}:00`;

    const startDateObj = new Date(startDatetime);
    const endDateObj = new Date(endDatetime);

    // Validate that start date is before end date.
    if (startDateObj >= endDateObj) {
      showToast("Start datetime must be before end datetime.");
      return;
    }

    try {
      // Disable the load button to indicate loading.
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
        return;
      }

      const map = getMap();

      // Clear any previous layers.
      clearLayer(historicalPath);

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

      // Attach polyline click handler to display details.
      addPolylineClickHandler(historicalPath, data);
      map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });

      // Update marker position to the last point.
      getMarker().setLatLng([
        data[data.length - 1].latitude,
        data[data.length - 1].longitude,
      ]);

      // Store loaded data for potential trace mode actions.
      traceHistoricalData = data;

      // Determine if trace mode is enabled (using the checkbox).
      const isTraceEnabled = document.getElementById(
        "enable-trace-toggle",
      ).checked;
      if (isTraceEnabled) {
        // Prompt user via toast to click on the map for trace details.
        showToast(
          "Historical data loaded. Click on the map to display trace information.",
        );

        // Set up map click event for trace functionality.
        map.off("click"); // Remove previous click events.
        map.on("click", onMapClickTrace);
      } else {
        // Disable trace mode interactions.
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
  // Ensure that historical data is loaded.
  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    showToast("Historical data not loaded. Please load data first.");
    return;
  }

  // Get the search radius from the slider (or fallback to 100 meters).
  const radiusInput = document.getElementById("search-radius");
  const threshold = parseFloat(radiusInput.value) || 100;
  const clickedLatLng = e.latlng;

  // Clear any previous search circle from the map.
  clearSearchCircle();

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

  // Attach click handlers to each "View" button to display detailed trace.
  document.querySelectorAll(".view-point").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const time = btn.dataset.time;

      // Remove previous trace view line if present.
      if (traceViewLine && getMap().hasLayer(traceViewLine)) {
        clearLayer(traceViewLine);
        traceViewLine = null;
      }

      // Center the map on the selected point and display a popup.
      const map = getMap();
      map.setView([lat, lng], 17);
      L.popup()
        .setLatLng([lat, lng])
        .setContent(
          `<b>Recorded Moment</b><br>
           Lat: ${lat.toFixed(5)}<br>
           Lng: ${lng.toFixed(5)}<br>
           Timestamp: ${time}`,
        )
        .openOn(map);

      // Determine the index of the clicked point in the data.
      const clickedIndex = traceHistoricalData.findIndex(
        (p) =>
          p.latitude === lat && p.longitude === lng && p.timestamp === time,
      );
      if (clickedIndex === -1) return;

      // Identify a segment of the route around the clicked point based on threshold distance.
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

      // Extract and draw the route segment.
      const segment = traceHistoricalData
        .slice(startIndex, endIndex + 1)
        .map((p) => [p.latitude, p.longitude]);
      if (segment.length >= 2) {
        traceViewLine = L.polyline(segment, {
          color: "#8E00C2",
          weight: 4,
          opacity: 0.9,
          lineJoin: "round",
        }).addTo(map);
      }
    });
  });
}

/**
 * Utility function to clear any existing search circle.
 */
function clearSearchCircle() {
  const map = getMap();
  // Find and remove any circle layers (assumes circles have red border).
  map.eachLayer((layer) => {
    if (layer instanceof L.Circle && layer.options.color === "red") {
      map.removeLayer(layer);
    }
  });
}
