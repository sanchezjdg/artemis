import { getMap } from './mapHandler.js';

let heatLayer = null;

/**
 * Inicializa el mapa de calor con datos históricos recibidos.
 * Los puntos de congestión (RPM bajo, poca distancia, largo tiempo) se marcan en otro color.
 * @param {Array} traceHistoricalData 
 */
export function initHeatmapMode(traceHistoricalData) {
  const map = getMap();

  // Oculta elementos del modo histórico si están presentes
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

  // Elimina polilíneas anteriores
  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline && !(layer instanceof L.Circle)) {
      map.removeLayer(layer);
    }
  });

  // Limpia capas anteriores
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  const normalPoints = [];
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

    const isStillCongested = rpm > 600 && rpm < 1500 && dist < 10;

    if (isStillCongested) {
      if (!clusterStart) clusterStart = new Date(prev.timestamp);
      currentGroup.push(point);
    } else {
      if (clusterStart && currentGroup.length > 0) {
        const totalTime = new Date(currentGroup[currentGroup.length - 1].timestamp) - clusterStart;
        const pointsToUse = currentGroup.length > 1 ? currentGroup : [prev];

        if (totalTime > 30000) {
          pointsToUse.forEach(p =>
            congestedPoints.push([p.latitude, p.longitude, 1])
          );
        } else {
          pointsToUse.forEach(p =>
            normalPoints.push([p.latitude, p.longitude, 1])
          );
        }
      }
      clusterStart = null;
      currentGroup = [];

      // También agrega este punto como normal (por fuera del grupo)
      normalPoints.push([point.latitude, point.longitude, 1]);
    }
  });

  // Por si quedó una congestión al final sin cerrar
  if (clusterStart && currentGroup.length > 0) {
    const totalTime = new Date(currentGroup[currentGroup.length - 1].timestamp) - clusterStart;
    if (totalTime > 30000) {
      currentGroup.forEach(p => congestedPoints.push([p.latitude, p.longitude, 1]));
    } else {
      currentGroup.forEach(p => normalPoints.push([p.latitude, p.longitude, 1]));
    }
  }

  // Capa normal
  const normalHeat = L.heatLayer(normalPoints, {
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

  // Capa de congestión
  const congestedHeat = L.heatLayer(congestedPoints, {
    radius: 25,
    blur: 20,
    maxZoom: 17,
    gradient: {
      0.4: '#8e00c2',
      0.7: '#c100c7',
      1.0: '#ff00e6'
    }
  }).addTo(map);

  // Agrupa para poder eliminar más fácil
  heatLayer = L.layerGroup([normalHeat, congestedHeat]);

  // Centra el mapa en los datos
  const allPoints = [...normalPoints, ...congestedPoints];
  const bounds = L.latLngBounds(allPoints.map(p => [p[0], p[1]]));
  map.fitBounds(bounds, { padding: [50, 50] });
}

/**
 * Limpia el mapa de calor del mapa Leaflet.
 */
export function cleanupHeatmapMode() {
  const map = getMap();

  if (heatLayer) {
    // 🔥 Eliminar cada subcapa del grupo
    heatLayer.eachLayer(layer => map.removeLayer(layer));
    heatLayer = null;
  }

  // 🔁 Por seguridad, también elimina cualquier otra HeatLayer residual
  map.eachLayer(layer => {
    if (layer instanceof L.HeatLayer) {
      map.removeLayer(layer);
    }
  });
}
