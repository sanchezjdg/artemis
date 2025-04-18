CREATE TABLE steinstable (
    id INT AUTO_INCREMENT PRIMARY KEY,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    timestamp DATETIME NOT NULL,
    vehicle_id INT NOT NULL DEFAULT 1
);
