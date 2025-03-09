// udp-listener/udp-listener.js

const dgram = require('dgram');
const mysql = require('mysql2');
const config = require('./config');  

const server = dgram.createSocket('udp4');

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Log a message to confirm the pool is created
console.log('MySQL connection pool created.');

// Handle incoming UDP messages
server.on('message', (msg, rinfo) => {
    console.log(`Received message from ${rinfo.address}:${rinfo.port}`);
    console.log("Message content:", msg.toString());

    const message = msg.toString();
    // Split into lines and build the data object
    const lines = message.split('\n');
    let data = {};

    lines.forEach(line => {
        // Split only on the first colon
        const index = line.indexOf(':');
        if (index === -1) return;
        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim();

        if (key.toLowerCase().includes('latitud')) data.latitude = parseFloat(value);
        if (key.toLowerCase().includes('longitud')) data.longitude = parseFloat(value);
        if (key.toLowerCase().includes('tiempo')) {
            // Convert "HH:mm:ss - dd-MM-yyyy" to "yyyy-MM-dd HH:mm:ss"
            data.timestamp = parseTimestamp(value);
        }
    });

    const query = `INSERT INTO locations (latitude, longitude, timestamp) VALUES (?, ?, ?)`;

    // Use the pool to execute the query
    pool.query(query, [data.latitude, data.longitude, data.timestamp], (err, results) => {
        if (err) {
            console.error('DB Insert Error:', err);
        } else {
            console.log('Inserted:', data);
        }
    });
});

// Helper function to parse the timestamp string
function parseTimestamp(rawValue) {
    // Expected format: "HH:mm:ss - dd-MM-yyyy"
    const parts = rawValue.split(' - ');
    if (parts.length !== 2) {
        return rawValue;
    }
    const timePart = parts[0].trim();       // e.g., "12:21:02"
    const datePart = parts[1].trim();         // e.g., "09-03-2025"
    const dateParts = datePart.split('-');    // e.g., ["09", "03", "2025"]
    if (dateParts.length !== 3) {
        return rawValue;
    }
    const [dd, MM, yyyy] = dateParts;
    return `${yyyy}-${MM}-${dd} ${timePart}`; // MySQL DATETIME format: "yyyy-MM-dd HH:mm:ss"
}

// Bind the UDP listener to the port specified in the config on all interfaces
server.bind(config.udp.port, '0.0.0.0', () => {
    console.log(`UDP Listener bound on port ${config.udp.port} on all interfaces`);
});

// Add error handling for the UDP server
server.on('error', (err) => {
    console.error('UDP Server encountered an error:', err);
    server.close();
});
