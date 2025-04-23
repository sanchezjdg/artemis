// udp-listener/udp-listener.js

const dgram = require("dgram");
const mysql = require("mysql2");
const config = require("./config");

// Create UDP socket
const server = dgram.createSocket("udp4");

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

console.log("MySQL connection pool created.");

// Handle incoming UDP messages
server.on("message", (msg, rinfo) => {
  console.log(`Received message from ${rinfo.address}:${rinfo.port}`);
  console.log("Message content:", msg.toString());

  const lines = msg.toString().split("\n");
  let data = {
    vehicle_id: 1, // default vehicle ID
    rpm: null      // default rpm
  };

  lines.forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.substring(0, idx).trim().toLowerCase();
    const value = line.substring(idx + 1).trim();

    if (key.includes("latitud")) {
      data.latitude = parseFloat(value);
    }
    if (key.includes("longitud")) {
      data.longitude = parseFloat(value);
    }
    if (key.includes("tiempo")) {
      data.timestamp = parseTimestamp(value);
    }
    if (key.includes("vehiculo") || key.includes("vehicle")) {
      data.vehicle_id = parseInt(value, 10) || 1;
    }
    if (key === "rpm") {
      const parsed = parseInt(value, 10);
      data.rpm = Number.isNaN(parsed) ? null : parsed;
    }
  });

  // Insert into database, including rpm
  const query = `
    INSERT INTO steinstable
      (latitude, longitude, timestamp, vehicle_id, rpm)
    VALUES (?, ?, ?, ?, ?)
  `;

  pool.query(
    query,
    [
      data.latitude,
      data.longitude,
      data.timestamp,
      data.vehicle_id,
      data.rpm
    ],
    (err, results) => {
      if (err) {
        console.error("DB Insert Error:", err);
      } else {
        console.log("Inserted:", data);
      }
    }
  );
});

/**
 * Helper function to parse timestamp from format "HH:mm:ss - dd-MM-yyyy"
 * to MySQL DATETIME format "yyyy-MM-dd HH:mm:ss".
 */
function parseTimestamp(rawValue) {
  const parts = rawValue.split(" - ");
  if (parts.length !== 2) {
    return rawValue;
  }
  const timePart = parts[0].trim();
  const datePart = parts[1].trim();
  const dateParts = datePart.split("-");
  if (dateParts.length !== 3) {
    return rawValue;
  }
  const [dd, MM, yyyy] = dateParts;
  return `${yyyy}-${MM}-${dd} ${timePart}`;
}

// Bind the UDP listener
server.bind(config.udp.port, "0.0.0.0", () => {
  console.log(
    `UDP Listener bound on port ${config.udp.port} on all interfaces`
  );
});

// Error handling for the UDP server
server.on("error", (err) => {
  console.error("UDP Server encountered an error:", err);
  server.close();
});
