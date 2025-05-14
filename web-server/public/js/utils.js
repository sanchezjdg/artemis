// utils.js
// Utility functions shared among modules.

/**
 * Pads a number with leading zeros if necessary.
 * @param {number} n - Number to pad.
 * @returns {string}
 */
export function pad(n) {
  return n.toString().padStart(2, "0");
}

/**
 * Formats a Date object as a string in "YYYY-MM-DDTHH:MM" format.
 * @param {Date} d - The date to format.
 * @returns {string}
 */
export function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Adds a click handler to a polyline to show point details in a popup.
 * @param {Object} polyline - The Leaflet polyline.
 * @param {Array} data - Array of data points with coordinates and timestamps.
 */
export function addPolylineClickHandler(polyline, data) {
  const map = polyline._map; // Use the map instance associated with the polyline.
  polyline.on("click", function (e) {
    if (data.length === 0) return;

    // Determine the closest point on the polyline to the click location.
    let closestPoint = data.reduce((prev, curr) => {
      const currLat = Array.isArray(curr) ? curr[0] : curr.latitude;
      const currLng = Array.isArray(curr) ? curr[1] : curr.longitude;
      const prevLat = Array.isArray(prev) ? prev[0] : prev.latitude;
      const prevLng = Array.isArray(prev) ? prev[1] : prev.longitude;
      return map.distance(e.latlng, L.latLng(currLat, currLng)) <
        map.distance(e.latlng, L.latLng(prevLat, prevLng))
        ? curr
        : prev;
    });

    // Extract latitude, longitude and timestamp.
    const lat = Array.isArray(closestPoint)
      ? closestPoint[0]
      : closestPoint.latitude;
    const lng = Array.isArray(closestPoint)
      ? closestPoint[1]
      : closestPoint.longitude;
    const timestamp = closestPoint.timestamp || "N/A";

    // Open a popup with the point's information.
    const rpm = closestPoint.rpm !== undefined && closestPoint.rpm !== null
    ? closestPoint.rpm
    : "No data";
  
    L.popup()
      .setLatLng([lat, lng])
      .setContent(
        `<b>Vehicle ${closestPoint.vehicle_id}</b><br>
        Latitude: ${lat.toFixed(5)}<br>
        Longitude: ${lng.toFixed(5)}<br>
        RPM: ${rpm}<br>
        Timestamp: ${timestamp}`,
      )
      .openOn(map);
  });
}

// Format a timestamp string by removing milliseconds and keeping only date and time
export function formatTimestamp(timestamp) {
  try {
    const clean = timestamp
      .replace("T", " ")               // "2025-04-18 19:47:57.000Z"
      .replace(/\.\d{3}Z$/, "")       // Remove the milliseconds (e.g., ".000") and the trailing "Z" if present
      .trim();

    const [datePart, timePart] = clean.split(" ");

    if (!datePart || !timePart) throw new Error("Invalid format");

    return `Time: ${timePart} <br> Date: ${datePart}`;
  } catch (err) {
    return "Time: N/A <br> Date: N/A";
  }
}

export function updateFixedPanel(vehicleId, latitude, longitude, rpm, timestamp) {
  const panel = document.getElementById("fixed-info-panel");
  const vehicleInfo = document.getElementById(`vehicle-${vehicleId}-info`);

  if (vehicleInfo) {
    vehicleInfo.innerHTML = `
      <b>Vehicle ${vehicleId}:</b><br>
      RPM: ${rpm !== null ? rpm : "No data"}<br>
      ${timestamp}<br>
    `;
  }
}
