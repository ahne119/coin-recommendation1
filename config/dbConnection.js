const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'your_database'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ' + err.stack);
    return;
  }
  console.log('Connected as id ' + connection.threadId);
});

function registerUser(username, password) {
  connection.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return;
    }
    console.log('User added:', results);
  });
}

function closeConnection() {
  connection.end((err) => {
    if (err) {
      console.error('Error closing the connection:', err);
    } else {
      console.log('Connection closed');
    }
  });
}

module.exports = {
  registerUser,
  closeConnection
};
