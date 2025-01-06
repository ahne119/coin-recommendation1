const express = require('express');
const router = express.Router();
const { registerUser, closeConnection } = require('../config/dbConnection');

// 회원가입 API
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  // 사용자 등록
  registerUser(username, password);

  res.send('User registered successfully');
  closeConnection();  // 작업이 끝난 후 연결 종료
});

module.exports = router;
