const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'qwqw1212!!',
    database: 'coin_community'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed: ' + err.message);
    } else {
        console.log('Connected to the MySQL database.');
    }
});

module.exports = db;
