// utils.js
// Utility functions shared among modules.

export function pad(n) {
  return n.toString().padStart(2, "0");
}

export function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Adds a click handler to a polyline to show point details.
 * @param {Object} polyline - The Leaflet polyline.
 * @param {Array} data - Array of data points.
 */
export function addPolylineClickHandler(polyline, data) {
  const map = polyline._map;
  polyline.on("click", function (e) {
    if (data.length === 0) return;
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
    const lat = Array.isArray(closestPoint)
      ? closestPoint[0]
      : closestPoint.latitude;
    const lng = Array.isArray(closestPoint)
      ? closestPoint[1]
      : closestPoint.longitude;
    const timestamp = closestPoint.timestamp || "N/A";
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

/**
 * Clears any red circle layers (representing search circles) from the map.
 */
export function clearSearchCircle() {
  const map = window.map || null;
  if (!map) return;
  map.eachLayer((layer) => {
    if (layer instanceof L.Circle && layer.options.color === "red") {
      map.removeLayer(layer);
    }
  });
}
