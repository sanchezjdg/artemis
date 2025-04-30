import { getMap } from './mapHandler.js';

let heatLayer = null;

export function initHeatmapMode(traceHistoricalData) {
  const map = getMap();
  
  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline && !(layer instanceof L.Circle)) {
      map.removeLayer(layer);
    }
  });

  if (!traceHistoricalData || traceHistoricalData.length === 0) {
    alert("Debes cargar primero una ruta histórica.");
    return;
  }

  // Elimina capas anteriores si existen
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

    // Agrupa por coordenadas redondeadas (para acumular intensidad)
    const pointCounts = {};

    traceHistoricalData.forEach(p => {
    const key = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
    pointCounts[key] = (pointCounts[key] || 0) + 1;
    });

    const heatData = Object.entries(pointCounts).map(([key, count]) => {
    const [lat, lng] = key.split(',').map(Number);
    return [lat, lng, count]; // count = intensidad
    });

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

export function cleanupHeatmapMode() {
    const map = getMap();
    if (heatLayer) {
      map.removeLayer(heatLayer);
      heatLayer = null;
    }
  }
  