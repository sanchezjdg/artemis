import { getMap } from './mapHandler.js';
import { cleanupHistoricalMode } from './historicalMode.js';

let heatLayer = null;

/**
 * Inicializa el mapa de calor con todos los puntos recorridos.
 * Los puntos de congestión reciben más peso en la capa.
 * @param {Array} traceHistoricalData 
 */
export function initHeatmapMode(traceHistoricalData) {
  cleanupHistoricalMode();
  const map = getMap();

  // Oculta elementos de otros modos
  const form = document.getElementById("historical-form");
  if (form) form.style.display = "none";

  const traceSlider = document.getElementById("trace-time-slider-control");
  if (traceSlider) traceSlider.style.display = "none";

  const radiusControl = document.getElementById("trace-radius-control");
  if (radiusControl) radiusControl.style.display = "none";

  const traceResults = document.getElementById("trace-results");
  if (traceResults) {
    traceResults.style.display = "none";
    traceResults.innerHTML = "";
  }

  // Limpieza de elementos anteriores
  map.eachLayer((layer) => {
    if (
      layer instanceof L.Polyline ||
      layer instanceof L.Marker ||
      layer instanceof L.CircleMarker ||
      layer instanceof L.Circle 
    ) {
      map.removeLayer(layer);
    }
  });

  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  const heatPoints = [];
  let clusterStart = null;
  let currentGroup = [];

  traceHistoricalData.forEach((point, index, arr) => {
    if (index === 0) return;

    const prev = arr[index - 1];
    const dist = L.latLng(prev.latitude, prev.longitude).distanceTo(
      L.latLng(point.latitude, point.longitude)
    );
    const rpm = point.rpm;

    const isCongested = rpm > 600 && rpm < 1500 && dist < 10;

    if (isCongested) {
      if (!clusterStart) clusterStart = new Date(prev.timestamp);
      currentGroup.push(point);
    } else {
      if (clusterStart && currentGroup.length > 0) {
        const totalTime = new Date(currentGroup[currentGroup.length - 1].timestamp) - clusterStart;
        const weight = totalTime > 30000 ? 3 : 1.5;
        currentGroup.forEach(p =>
          heatPoints.push([p.latitude, p.longitude, weight])
        );
      }
      clusterStart = null;
      currentGroup = [];

      // Agrega punto normal
      heatPoints.push([point.latitude, point.longitude, 1]);
    }
  });

  // Por si queda un grupo congestionado al final
  if (clusterStart && currentGroup.length > 0) {
    const totalTime = new Date(currentGroup[currentGroup.length - 1].timestamp) - clusterStart;
    const weight = totalTime > 30000 ? 3 : 1.5;
    currentGroup.forEach(p =>
      heatPoints.push([p.latitude, p.longitude, weight])
    );
  }

  // Capa única de calor
  heatLayer = L.heatLayer(heatPoints, {
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

  // Centra el mapa en todos los puntos
  const bounds = L.latLngBounds(heatPoints.map(p => [p[0], p[1]]));
  map.fitBounds(bounds, { padding: [50, 50] });
}

/**
 * Limpia el mapa de calor.
 */
export function cleanupHeatmapMode() {
  const map = getMap();

  if (heatLayer) {
    heatLayer.eachLayer(layer => map.removeLayer(layer));
    heatLayer = null;
  }

  map.eachLayer(layer => {
    if (layer instanceof L.HeatLayer) {
      map.removeLayer(layer);
    }
  });
}
