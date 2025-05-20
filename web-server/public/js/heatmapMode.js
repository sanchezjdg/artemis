import { getMap } from './mapHandler.js';
import { cleanupHistoricalMode } from './historicalMode.js';

let heatLayer = null;

/**
 * Inicializa el modo mapa de calor solo para puntos con congestión.
 * Se considera congestión cuando el RPM está entre 600 y 1500 y la distancia entre puntos es muy baja.
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

  // Elimina elementos gráficos anteriores
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

  // Limpia heatmap previo
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  const congestedPoints = [];
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
        if (totalTime > 30000) {
          currentGroup.forEach(p => congestedPoints.push([p.latitude, p.longitude, 1]));
        }
      }
      clusterStart = null;
      currentGroup = [];
    }
  });

  // Por si hay una congestión abierta al final
  if (clusterStart && currentGroup.length > 0) {
    const totalTime = new Date(currentGroup[currentGroup.length - 1].timestamp) - clusterStart;
    if (totalTime > 30000) {
      currentGroup.forEach(p => congestedPoints.push([p.latitude, p.longitude, 1]));
    }
  }

  // Si no hay puntos de congestión, no continúes
  if (congestedPoints.length === 0) return;

  // Única capa de congestión
  heatLayer = L.heatLayer(congestedPoints, {
    radius: 25,
    blur: 20,
    maxZoom: 17,
    gradient: {
      0.4: '#8e00c2',
      0.7: '#c100c7',
      1.0: '#ff00e6'
    }
  }).addTo(map);

  // Centra el mapa
  const bounds = L.latLngBounds(congestedPoints.map(p => [p[0], p[1]]));
  map.fitBounds(bounds, { padding: [50, 50] });
}

/**
 * Limpia el mapa de calor del mapa Leaflet.
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
