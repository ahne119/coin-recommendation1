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

// signup.js (회원가입 처리 라우터)
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');  // db.js 파일을 불러오기

const router = express.Router();

// 회원가입 라우트
router.post('/signup', async (req, res) => {
  const { nickname, email, password } = req.body;

  if (!nickname || !email || !password) {
    return res.status(400).send('모든 필드를 입력해 주세요.');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // 비동기적으로 쿼리 실행
    const sql = 'INSERT INTO users (nickname, email, password) VALUES (?, ?, ?)';
    const [result] = await db.query(sql, [nickname, email, hashedPassword]);

    res.status(200).send('회원가입 완료');
  } catch (error) {
    console.error('회원가입 실패:', error);
    res.status(500).send('회원가입에 실패했습니다.');
  }
});

module.exports = router;
