// server.js
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Serve static files from the public folder
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('index', {
    name: process.env.WEBSITE_NAME
  });
});

// MySQL connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Function to get the latest location
async function getLatestLocation() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM steinstable ORDER BY timestamp DESC LIMIT 1');
    connection.release();
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching latest location:', error);
    return null;
  }
}

// New API endpoint for available date range
app.get('/available-range', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT MIN(timestamp) as minTimestamp, MAX(timestamp) as maxTimestamp FROM steinstable');
    connection.release();
    if (rows.length > 0 && rows[0].minTimestamp && rows[0].maxTimestamp) {
      // Convert to ISO date strings (YYYY-MM-DD)
      const min = new Date(rows[0].minTimestamp).toISOString().split('T')[0];
      const max = new Date(rows[0].maxTimestamp).toISOString().split('T')[0];
      res.json({ min, max });
    } else {
      res.json({ min: null, max: null });
    }
  } catch (error) {
    console.error('Error fetching available range:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint for historical data
app.get('/historical', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end datetime parameter.' });
  }
  
  try {
    const connection = await pool.getConnection();
    const query = 'SELECT * FROM steinstable WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC';
    const [rows] = await connection.query(query, [start, end]);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.io connection handler for real-time updates
io.on('connection', async (socket) => {
  console.log('New client connected');
  
  try {
    const location = await getLatestLocation();
    if (location) {
      socket.emit('updateData', location);
      console.log('Sent last location data to client:', location);
    } else {
      console.log('No location data found');
    }
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  } catch (error) {
    console.error('Error in connection handler:', error);
  }
});

let lastKnownId = null;

// Function to check for updates and broadcast changes
async function checkForUpdates() {
  try {
    const location = await getLatestLocation();
    if (location && lastKnownId !== location.id) {
      lastKnownId = location.id;
      io.emit('updateData', location);
      console.log('Broadcasting updated data:', location);
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

// Poll for new location data every 5 seconds
const POLLING_INTERVAL = 5000;
setInterval(checkForUpdates, POLLING_INTERVAL);

// Start HTTP server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

// HTTPS setup
const options = {
  key: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DDNS}/privkey.pem`, 'utf8'),
  cert: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DDNS}/fullchain.pem`, 'utf8')
};

const httpsServer = https.createServer(options, app);
io.attach(httpsServer);
httpsServer
