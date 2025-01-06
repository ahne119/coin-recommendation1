const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const db = require('./db');  // db.js에서 데이터베이스 연결을 불러옴

const app = express();

// Body-parser 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(bodyParser.json());

// 세션 설정
app.use(session({
    secret: 'supersecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// 중복 선언된 데이터베이스 연결 제거

// 회원가입 라우트
app.post('/signup', async (req, res) => {
    const { nickname, email, password } = req.body;

    if (!nickname || !email || !password) {
        return res.send('모든 필드를 입력해 주세요.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (nickname, email, password) VALUES (?, ?, ?)';

    db.query(sql, [nickname, email, hashedPassword], (err, result) => {
        if (err) {
            console.error('회원가입 실패:', err);
            res.send('회원가입에 실패했습니다.');
        } else {
            res.redirect('/login.html');
        }
    });
});

// 로그인 처리
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.send('이메일이 존재하지 않습니다.');
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            req.session.user = {
                id: user.id,
                nickname: user.nickname,
                role: user.role  // 관리자 권한 반영
            };
            res.redirect('/index.html');  // ✅ 메인 페이지로 이동
        } else {
            res.send('비밀번호가 일치하지 않습니다.');
        }
    });
});

// 로그아웃 처리
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login.html');
    });
});

// 게시글 작성 (이미지 업로드 포함)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');  // 업로드된 파일 저장 경로
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // 파일명 중복 방지
    }
});

const upload = multer({ storage: storage });

app.post('/create-post', upload.single('image'), (req, res) => {
    if (!req.session.user) {
        return res.send('로그인이 필요합니다.');
    }
    
    const { title, content } = req.body;
    const nickname = req.session.user.nickname;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = 'INSERT INTO posts (title, content, author, image) VALUES (?, ?, ?, ?)';
    db.query(sql, [title, content, nickname, imagePath], (err, result) => {
        if (err) {
            console.error('게시글 작성 실패: ' + err.message);
            res.send('게시글 작성에 실패했습니다.');
        } else {
            res.redirect('/board.html');
        }
    });
});

// 게시글 수정
app.post('/edit-post/:id', (req, res) => {
    if (!req.session.user) {
        return res.send('로그인이 필요합니다.');
    }

    const { title, content } = req.body;
    const postId = req.params.id;

    const sql = 'UPDATE posts SET title = ?, content = ? WHERE id = ? AND user_id = ?';
    db.query(sql, [title, content, postId, req.session.user.id], (err, result) => {
        if (err) {
            console.error('게시글 수정 실패:', err);
            res.status(500).send('게시글 수정에 실패했습니다.');
        } else {
            res.redirect('/board.html');
        }
    });
});

// 게시글 목록 조회 (페이지네이션 포함)
app.get('/posts', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const searchQuery = req.query.search || '';

    let sql = 'SELECT * FROM posts WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    let countSql = 'SELECT COUNT(*) AS total FROM posts WHERE title LIKE ? OR content LIKE ?';
    const searchValue = `%${searchQuery}%`;

    db.query(sql, [searchValue, searchValue, limit, offset], (err, results) => {
        if (err) {
            console.error('게시글 검색 실패: ' + err.message);
            res.send([]);
        } else {
            db.query(countSql, [searchValue, searchValue], (err, countResults) => {
                if (err) {
                    console.error('게시글 수 조회 실패: ' + err.message);
                } else {
                    const totalPosts = countResults[0].total;
                    const totalPages = Math.ceil(totalPosts / limit);
                    res.json({ posts: results, totalPages, currentPage: page });
                }
            });
        }
    });
});

// 게시글 삭제
app.post('/delete-post/:id', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    const postId = req.params.id;
    const sql = 'DELETE FROM posts WHERE id = ? AND user_id = ?';
    db.query(sql, [postId, req.session.user.id], (err, result) => {
        if (err) {
            console.error('게시글 삭제 실패:', err);
            res.status(500).send('게시글 삭제에 실패했습니다.');
        } else {
            res.status(200).send('게시글이 삭제되었습니다.');
        }
    });
});

// 관리자 권한 확인
app.get('/admin', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        res.sendFile(__dirname + '/public/admin.html');
    } else {
        res.status(403).send('접근 권한이 없습니다.');
    }
});

// 서버 실행
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
