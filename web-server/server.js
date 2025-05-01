// server.js
const express = require("express");
const http = require("http");
const https = require("https");
const fs = require("fs");
const socketIO = require("socket.io");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Set EJS as the view engine
app.set("view engine", "ejs");

// Serve static files from the public folder
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index", {
    name: process.env.WEBSITE_NAME,
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
  queueLimit: 0,
});

// Helper function to validate date inputs
function isValidDateRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const now = new Date();

  if (startDate >= endDate) {
    return {
      valid: false,
      message: "Start datetime must be before end datetime.",
    };
  }

  if (startDate > now || endDate > now) {
    return { valid: false, message: "Future dates/times are not allowed." };
  }

  return { valid: true };
}

// API endpoint for historical data - optimized to fetch all vehicles at once
app.get("/historical", async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res
      .status(400)
      .json({ error: "Missing start or end parameter." });
  }

  const validation = isValidDateRange(start, end);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  try {
    const connection = await pool.getConnection();
    const query = `
      SELECT * FROM steinstable 
      WHERE timestamp BETWEEN ? AND ? 
      ORDER BY timestamp ASC`;
    const [rows] = await connection.query(query, [start, end]);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching historical data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Socket.io connection handler for real-time updates
io.on("connection", async (socket) => {
  console.log("New client connected");

  try {
    // Get latest locations for all vehicles on initial connection
    const locations = await getLatestLocations();
    if (locations && locations.length > 0) {
      socket.emit("updateMultipleVehicles", locations);
      console.log("Sent last location data for all vehicles to client:", locations);
    } else {
      console.log("No location data found");
    }

    // Listen for client-side request to fetch latest data again (e.g., on mode switch)
    socket.on("requestLatest", async () => {
      try {
        const latest = await getLatestLocations();
        if (latest && latest.length > 0) {
          socket.emit("updateMultipleVehicles", latest);
          console.log("Sent latest locations on client request:", latest);
        } else {
          console.log("No location data available to send on client request.");
        }
      } catch (err) {
        console.error("Error handling 'requestLatest' event:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });

  } catch (error) {
    console.error("Error in connection handler:", error);
  }
});

let lastKnownId = null;

// Function to get the latest locations for all vehicles
async function getLatestLocations() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT t1.* 
       FROM steinstable t1
       INNER JOIN (
         SELECT vehicle_id, MAX(timestamp) as max_timestamp
         FROM steinstable
         GROUP BY vehicle_id
       ) t2 
       ON t1.vehicle_id = t2.vehicle_id 
       AND t1.timestamp = t2.max_timestamp`
    );
    connection.release();
    return rows.length > 0 ? rows : [];
  } catch (error) {
    console.error("Error fetching latest locations:", error);
    return [];
  }
}

// Track last known IDs for each vehicle
let lastKnownIds = new Map();

// Function to check for updates and broadcast changes
async function checkForUpdates() {
  try {
    const locations = await getLatestLocations();
    let hasUpdates = false;

    for (const location of locations) {
      const lastId = lastKnownIds.get(location.vehicle_id);
      if (!lastId || lastId !== location.id) {
        lastKnownIds.set(location.vehicle_id, location.id);
        hasUpdates = true;
      }
    }

    if (hasUpdates && locations.length > 0) {
      io.emit("updateMultipleVehicles", locations);
      console.log("Broadcasting updated data for multiple vehicles:", locations);
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
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
  key: fs.readFileSync(
    `/etc/letsencrypt/live/${process.env.DDNS}/privkey.pem`,
    "utf8",
  ),
  cert: fs.readFileSync(
    `/etc/letsencrypt/live/${process.env.DDNS}/fullchain.pem`,
    "utf8",
  ),
};

const httpsServer = https.createServer(options, app);
io.attach(httpsServer);
httpsServer.listen(443, () => {
  console.log("HTTPS running on port 443");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  await pool.end();
  server.close(() => {
    console.log("Server shut down successfully");
    process.exit(0);
  });
});
