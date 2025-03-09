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

// Serve static files from the public folder
app.use(express.static('public'));

// Track the last known location to avoid unnecessary broadcasts
let lastKnownLocation = null;

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
    const [rows] = await pool.query('SELECT * FROM locations ORDER BY timestamp DESC LIMIT 1');
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching latest location:', error);
    return null;
  }
}

// Socket.io connection handler
io.on('connection', async (socket) => {
  console.log('New client connected');
  
  try {
    // Send the latest location to the newly connected client
    const location = await getLatestLocation();
    if (location) {
      socket.emit('updateData', location);
      console.log('Sent last location data to client:', location);
    } else {
      console.log('No location data found');
    }

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  } catch (error) {
    console.error('Error in connection handler:', error);
  }
});

// Function to check for DB updates and broadcast changes
async function checkForUpdates() {
  try {
    const location = await getLatestLocation();
    
    // Only broadcast if there's a new location or if details have changed
    if (location && (!lastKnownLocation || 
        location.id !== lastKnownLocation.id || 
        location.timestamp !== lastKnownLocation.timestamp)) {
      
      lastKnownLocation = location;
      io.emit('updateData', location);
      console.log('Broadcasting updated data:', location);
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

// Set up database change detection
const POLLING_INTERVAL = 10000; // 10 seconds
setInterval(checkForUpdates, POLLING_INTERVAL);

// Start the server
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

// Keys and certificates for HTTPS
const options = {
  key: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DDNS}/fullchain.pem`, 'utf8'),
  cert: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DDNS}/privkey.pem`, 'utf8')
};

// Server HTTPS
https.createServer(options, (req, res) => {
  res.writeHead(200);
  res.end('');
}).listen(443, () => {
  console.log('HTTPS running on 443');
});



// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await pool.end();
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});