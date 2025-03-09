// udp-listener/config.js
require('dotenv').config();

const config = {
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  udp: {
    port: Number(process.env.UDP_PORT),
  },
};

module.exports = config;
