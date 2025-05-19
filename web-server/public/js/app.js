// app.js
// Main entry point for initializing the application and setting up mode switching.
// Import modules (ensure your server supports ES modules or use a bundler)
import { initMap } from "./mapHandler.js";
import { startRealTimeUpdates } from "./realTimeMode.js";
import { initHistoricalMode } from "./historicalMode.js";
import { clearRealTimePath } from "./realTimeMode.js";
import { formatDate } from "./utils.js";
import { stopRealTimeUpdates } from "./realTimeMode.js";
import { traceHistoricalData } from './historicalMode.js';
import { initHeatmapMode, cleanupHeatmapMode } from './heatmapMode.js';
import { showToast } from "./toast.js";


// Initialize socket connection using Socket.IO.
const socket = io();
console.log("Connected to Socket.IO server.");

// Initialize the map.
initMap();

// Set initial visibility for the trace results area (hidden by default)
document.getElementById("trace-results").style.display = "none";

// Set up date inputs using the current time.
const now = new Date();
const startValue = formatDate(
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0),
);
const endValue = formatDate(now);
document.getElementById("start-datetime").value = startValue;
document.getElementById("end-datetime").value = endValue;

document.getElementById("heatmap-start").value = startValue;
document.getElementById("heatmap-end").value = endValue;

// Initialize flatpickr date/time pickers.
flatpickr("#start-datetime", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  defaultDate: startValue,
  maxDate: "today",
});
flatpickr("#end-datetime", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  defaultDate: endValue,
  maxDate: "today",
});

// 🟣 Heatmap flatpickrs
flatpickr("#heatmap-start", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  maxDate: "today",
});

flatpickr("#heatmap-end", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i",
  maxDate: "today",
});

// Set up active button color
function setActiveButton(activeId) {
  ["real-time-btn", "historical-btn", "heatmap-tab"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.remove("active");
    }
  });
  const activeBtn = document.getElementById(activeId);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const infoToggle = document.getElementById("info-toggle");
  const infoPanel = document.getElementById("info-panel");
  const closeInfo = document.getElementById("close-info");

  infoToggle.addEventListener("click", () => {
    infoPanel.style.display   = "block";
    infoToggle.style.display  = "none";
  });

  closeInfo.addEventListener("click", () => {
    infoPanel.style.display   = "none";
    infoToggle.style.display  = "block";
  });

  // Show real-time controls and hide historical form
  document.getElementById("real-time-controls").style.display = "block";
  document.getElementById("historical-form").style.display = "none";
  document.getElementById("heatmap-form").style.display = "none";
  
  // Set initial mode info
  document.querySelector(".controls .mode-info").innerText = "Currently tracking vehicles in real-time:";
  
  // Start real-time updates automatically
  startRealTimeUpdates(socket);
  setActiveButton("real-time-btn");

// Lógica para envolver .controls en un <details> solo en móviles
  const controls = document.querySelector(".controls");
  const map = document.getElementById("map");
  const fixedInfoPanel = document.getElementById("fixed-info-panel");

  function wrapControlsInDetails() {
    const details = document.createElement("details");
    details.id = "controls-toggle";
    details.setAttribute("open", "");

    const summary = document.createElement("summary");
    summary.textContent = "Controls";
    details.appendChild(summary);

    controls.parentNode.insertBefore(details, controls);
    details.appendChild(controls);

    details.addEventListener("toggle", () => {
      if (details.open) {
        map.style.height = "65vh";
        map.style.top = "35vh";
      } else {
        map.style.height = "100vh";
        map.style.top = "0";
      }
    });
  }

  function unwrapControls() {
    const details = document.getElementById("controls-toggle");
    if (details) {
      details.replaceWith(controls);
      map.style.height = "100vh";
      map.style.top = "0";
    }
  }

  // Ejecutar al cargar la página
  if (window.innerWidth <= 768) {
    wrapControlsInDetails();
  }

  // Manejar cambios de tamaño de ventana
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 768) {
      if (!document.getElementById("controls-toggle")) {
        wrapControlsInDetails();
      }
    } else {
      unwrapControls();
    }
  });
});

// Set up mode switching buttons.
document.getElementById("real-time-btn").addEventListener("click", async () => {
  cleanupHeatmapMode(); // Cleanup heatmap if active
  
  // First, stop any existing updates and clear the path
  stopRealTimeUpdates(socket);
  clearRealTimePath();
  
  // Update UI elements
  document.getElementById("real-time-controls").style.display = "block";
  document.getElementById("historical-form").style.display = "none";
  document.getElementById("heatmap-form").style.display = "none";
  document.getElementById("trace-results").style.display = "none";
  document.getElementById("trace-results").innerHTML = "";
  
  // Update mode info text
  document.querySelector(".controls .mode-info").innerText = "Currently tracking vehicles in real-time:";
  
  // Set active button state
  setActiveButton("real-time-btn");
  
  // Finally, start real-time updates
  await startRealTimeUpdates(socket);
});

document.getElementById("historical-btn").addEventListener("click", () => {
  cleanupHeatmapMode(); // Limpia el heatmap si estaba activo
  // Stop real time updates.
  socket.off("updateData");
  stopRealTimeUpdates(socket);   
  // Clear the real-time polyline.
  clearRealTimePath();
  document.getElementById("heatmap-form").style.display = "none";  // <- esto también
  // Hide real-time controls since auto-center is specific to real-time.
  document.getElementById("real-time-controls").style.display = "none";
  // Show the historical form.
  document.getElementById("historical-form").style.display = "block";
  // Update instructions for historical mode.
  document.querySelector(".controls .mode-info").innerText =
    "Select a date range and optionally enable trace mode:";
  // Initialize historical mode events.
  initHistoricalMode();
  // Set active button state last to ensure UI is consistent
  setActiveButton("historical-btn");
});


// Create a debounced heatmap update function
let heatmapTimeout = null;
const updateHeatmap = async () => {
  const start = document.getElementById('heatmap-start').value;
  const end = document.getElementById('heatmap-end').value;
  const vehicleId = document.getElementById('heatmap-vehicle').value;

  if (!start || !end) return;

  const startDatetime = `${start}:00`;
  const endDatetime = `${end}:00`;

  try {
    // Single request to get all vehicle data
    const allData = await fetch(
      `/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`
    ).then(res => res.json());

    // Filter data based on vehicle selection
    const data = allData.filter(p => 
      vehicleId === 'all' || p.vehicle_id === parseInt(vehicleId)
    );

    if (data.length === 0) {
      showToast("No data found for generating the heatmap.");
      return;
    }


    showToast("Generating heatmap, please wait...");

    cleanupHeatmapMode();
    initHeatmapMode(data);

  } catch (err) {
    console.error('Error loading heatmap data:', err);
    showToast("An error occurred while loading the heatmap.");
  }
};

const debouncedHeatmapUpdate = () => {
  if (heatmapTimeout) {
    clearTimeout(heatmapTimeout);
  }
  heatmapTimeout = setTimeout(updateHeatmap, 500);
};

document.getElementById("heatmap-tab").addEventListener("click", () => {
  // Ocultar formularios de otros modos
  document.getElementById("real-time-controls").style.display = "none";
  document.getElementById("historical-form").style.display = "none";
  document.getElementById("trace-time-slider-control").style.display = "none";
  document.getElementById("trace-results").style.display = "none";

  // Mostrar formulario del heatmap
  document.getElementById("heatmap-form").style.display = "block";

  // Detener modo en tiempo real si está activo
  stopRealTimeUpdates(socket);

  // Limpiar heatmap anterior si existe
  cleanupHeatmapMode();

  // Cambiar botón activo
  setActiveButton("heatmap-tab");

  // Cambiar mensaje de instrucciones
  document.querySelector(".controls .mode-info").innerText =
    "Select a date range to visualize the heat map:";

  // Load data initially if dates are set
  if (document.getElementById('heatmap-start').value && 
      document.getElementById('heatmap-end').value) {
    updateHeatmap();
  }
});

// Add event listeners for input changes
document.getElementById('heatmap-start').addEventListener('change', debouncedHeatmapUpdate);
document.getElementById('heatmap-end').addEventListener('change', debouncedHeatmapUpdate);
document.getElementById('heatmap-vehicle').addEventListener('change', debouncedHeatmapUpdate);
