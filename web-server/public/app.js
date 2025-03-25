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

  if (start >= end) {
    alert("The start date/time must be earlier than the end date/time.");
    return;
  }

  if (start > now || end > now) {
    alert("Future dates/times are not allowed.");
    return;
  }

  // Mostrar pantalla de carga
  document.getElementById('interval-display').textContent = `${startDatetime} - ${endDatetime}`;
  document.getElementById('historical-form').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'block';

  try {
    const response = await fetch(`/historical?start=${encodeURIComponent(startDatetime)}&end=${encodeURIComponent(endDatetime)}`);
    const data = await response.json();

    if (data.length === 0) {
      alert("No route data found for the selected interval.");
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('historical-form').style.display = 'block';
      return;
    }

    clearLayer(historicalPath);

    historicalPath = L.polyline(data.map(loc => [loc.latitude, loc.longitude]), {
      color: "#81A1C1",
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);

    map.fitBounds(historicalPath.getBounds(), { padding: [50, 50] });
    marker.setLatLng([data[data.length - 1].latitude, data[data.length - 1].longitude]);

    // Después de cargar, ocultar pantalla de carga
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('historical-form').style.display = 'block';

  } catch (error) {
    console.error('Error fetching historical data:', error);
    alert("An error occurred while fetching historical data.");
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('historical-form').style.display = 'block';
  }
});
