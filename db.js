const mysql = require('mysql2');

// MySQL 연결 풀 설정
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'qwqw1212!!',
    database: 'coin_community',
    waitForConnections: true,  // 연결이 대기 상태일 때 대기하도록 설정
    connectionLimit: 10,      // 최대 연결 수
    queueLimit: 0             // 연결 대기 제한 (무제한)
});

// 프로미스를 반환하는 pool 사용
const db = pool.promise();

module.exports = db;
