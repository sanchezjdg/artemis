// mapHandler.js
// Module to initialize and manage the Leaflet map and shared map layers.

let map; // Global map object
let marker; // Global marker for current position

/**
 * Initializes the map with default settings.
 */
export function initMap() {
  // Create Leaflet map centered at [0,0] with zoom level 2.
  map = L.map("map").setView([0, 0], 2);

  // Add OpenStreetMap tile layer with proper attribution.
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

}

/**
 * Returns the global map instance.
 */
export function getMap() {
  return map;
}

/**
 * Returns the global marker instance.
 */
export function getMarker() {
  return marker;
}

/**
 * Utility to clear a layer from the map if it exists.
 * @param {Object} layer - A Leaflet layer.
 */
export function clearLayer(layer) {
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
}
