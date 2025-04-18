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
    L.popup()
      .setLatLng([lat, lng])
      .setContent(
        `<b>Position</b><br>
         Latitude: ${lat.toFixed(5)}<br>
         Longitude: ${lng.toFixed(5)}<br>
         Timestamp: ${timestamp}`,
      )
      .openOn(map);
  });
}

// formatTimestamp function to use Bogota local time
export function formatTimestamp(timestamp) {
  // Create a Date object from the input timestamp
  const date = new Date(timestamp);

  // Define formatting options, crucially setting the timeZone
  const options = {
    timeZone: 'America/Bogota', // Specifies the target time zone
    hour12: false // Use 24-hour format
  };

  // Create a formatter for English (US) locale with specified options
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...options, // Include the timeZone and hour12 options
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Format the date into parts according to Bogota time
  const parts = formatter.formatToParts(date);

  // Extract the time components (HH:mm:ss)
  const time = `${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}:${parts.find(p => p.type === 'second').value}`;

  // Extract the date components (YYYY-MM-DD)
  const dateStr = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;

  // Return the formatted string
  return `Time: ${time}, Date: ${dateStr}`;
}