document.getElementById('load-data').addEventListener('click', async () => {
  const startDate = document.getElementById('start-date').value;
  const startTime = document.getElementById('start-time').value;
  const endDate = document.getElementById('end-date').value;
  const endTime = document.getElementById('end-time').value;

  if (!startDate || !startTime || !endDate || !endTime) {
    alert("Please fill in all date and time fields.");
    return;
  }

  const startDatetime = `${startDate}T${startTime}:00`;
  const endDatetime = `${endDate}T${endTime}:00`;

  const start = new Date(startDatetime);
  const end = new Date(endDatetime);
  const now = new Date();

  if (start >= end || start > now || end > now) {
    alert("Please select valid historical date/time ranges.");
    return;
  }

  // Ocultar visualmente la selección de modos y botones
  const buttonGroup = document.querySelector('.button-group');
  const modeSelectorText = document.querySelector('.controls .mode-info');
  if (buttonGroup) buttonGroup.style.display = 'none';
  if (modeSelectorText) modeSelectorText.style.display = 'none';

  const historicalForm = document.getElementById('historical-form');
  historicalForm.innerHTML = `
    <p class="mode-info">Buscando en:</p>
    <p class="mode-info">${start.toLocaleString()}</p>
    <p class="mode-info">hasta:</p>
    <p class="mode-info">${end.toLocaleString()}</p>
    <button id="back-to-historical" class="load-button">Regresar al Histórico</button>
  `;

  const backBtn = document.getElementById('back-to-historical');
  backBtn.addEventListener('click', () => {
    location.reload();
  });

  try {
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();

    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      location.reload();
      return;
    }

    clearLayer(historicalPath);

    historicalPath = L.polyline([], {
      color: "#81A1C1",
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);

    const historicalCoordinates = data.map(loc => [loc.latitude, loc.longitude]);
    historicalPath.setLatLngs(historicalCoordinates);

    map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });

    marker.setLatLng(historicalCoordinates[historicalCoordinates.length - 1]);

  } catch (error) {
    console.error('Error fetching historical data:', error);
    alert("An error occurred while fetching historical data.");
    location.reload();
  }
});
