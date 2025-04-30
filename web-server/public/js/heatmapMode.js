import { getMap } from './mapHandler.js';

let heatLayer = null;

export function initHeatmapMode(traceHistoricalData) {
  const map = getMap();

  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    alert("Debes cargar primero una ruta histórica.");
    return;
  }

  // Elimina capas anteriores si existen
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  // Crea array de puntos con intensidad (lat, lng, 1)
  const heatData = traceHistoricalData.map(p => [p.latitude, p.longitude, 1]);

  // Crea y agrega la capa de mapa de calor
  heatLayer = L.heatLayer(heatData, {
    radius: 25,
    blur: 15,
    maxZoom: 17,
    gradient: {
      0.2: 'blue',
      0.4: 'lime',
      0.6: 'yellow',
      0.8: 'orange',
      1.0: 'red'
    }
  }).addTo(map);

  // Ajusta vista
  const bounds = L.latLngBounds(heatData.map(p => [p[0], p[1]]));
  map.fitBounds(bounds, { padding: [50, 50] });
}
