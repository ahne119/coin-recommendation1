const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const db = require('./db');  // db.js에서 데이터베이스 연결을 불러옴

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// 세션 설정
app.use(session({
    secret: 'supersecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// body-parser 설정 (JSON 및 form 데이터 파싱)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// 서버 실행
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

// 게시글 작성
app.post('/create-post', (req, res) => {
    const { title, content } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    if (!title || !content) {
        return res.status(400).send('제목과 내용을 작성해주세요.');
    }

    const sql = 'INSERT INTO posts (title, content, author, user_id) VALUES (?, ?, ?, ?)';
    db.query(sql, [title, content, req.session.user.nickname, userId], (err, result) => {
        if (err) {
            console.error('게시글 작성 실패:', err);
            res.status(500).send('게시글 작성에 실패했습니다.');
        } else {
            res.status(200).send('게시글이 등록되었습니다.');
        }
    });
});

// 기타 라우트 (게시글 수정, 삭제 등)

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

app.get('/posts', (req, res) => {
    const page = parseInt(req.query.page) || 1;  // 페이지 번호 (기본값 1)
    const limit = 10;  // 한 페이지당 게시글 수
    const offset = (page - 1) * limit;  // 오프셋 계산

    const sql = 'SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?';
    db.query(sql, [limit, offset], (err, results) => {
        if (err) {
            console.error('게시글 불러오기 실패:', err);
            res.status(500).send('게시글 불러오기 실패');
        } else {
            // 게시글 총 개수 조회
            db.query('SELECT COUNT(*) AS total FROM posts', (err, countResults) => {
                if (err) {
                    console.error('게시글 수 조회 실패:', err);
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
        return res.send('로그인이 필요합니다.');
    }

    const postId = req.params.id;
    const sql = 'DELETE FROM posts WHERE id = ? AND user_id = ?';
    db.query(sql, [postId, req.session.user.id], (err, result) => {
        if (err) {
            console.error('게시글 삭제 실패:', err);
            res.status(500).send('게시글 삭제에 실패했습니다.');
        } else {
            res.redirect('/board.html');
        }
    });
});

app.get('/posts', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
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

const multer = require('multer');
const path = require('path');

// 이미지 저장 경로 및 파일명 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');  // 업로드된 파일 저장 경로
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // 파일명 중복 방지
    }
});

const upload = multer({ storage: storage });

// 게시글 작성 (이미지 업로드 포함)
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
            console.log('게시글 작성 성공');
            res.redirect('/board.html');
        }
    });
});

// 댓글 불러오기
app.get('/comments/:postId', (req, res) => {
    const postId = req.params.postId;
    const sql = 'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC';
    db.query(sql, [postId], (err, results) => {
        if (err) {
            console.error('댓글 불러오기 실패:', err);
            res.status(500).send('댓글을 불러오는 데 실패했습니다.');
        } else {
            res.json(results);
        }
    });
});

// 댓글 불러오기
app.get('/post/:id', (req, res) => {
    const postId = req.params.id;
    const sqlPost = 'SELECT * FROM posts WHERE id = ?';
    const sqlComments = 'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC';

    db.query(sqlPost, [postId], (err, postResult) => {
        if (err || postResult.length === 0) {
            return res.status(404).send('게시글을 찾을 수 없습니다.');
        }
        db.query(sqlComments, [postId], (err, commentResults) => {
            if (err) {
                return res.status(500).send('댓글을 불러오는 데 실패했습니다.');
            }
            res.json({ post: postResult[0], comments: commentResults });
        });
    });
});

// 댓글 작성
app.post('/create-comment/:postId', (req, res) => {
    const { content } = req.body;
    const postId = req.params.postId;
    const userId = req.session.user?.id;

    if (!userId) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    if (!content) {
        return res.status(400).send('댓글 내용을 입력해주세요.');
    }

    const sql = 'INSERT INTO comments (post_id, user_id, content, author) VALUES (?, ?, ?, ?)';
    db.query(sql, [postId, userId, content, req.session.user.nickname], (err) => {
        if (err) {
            return res.status(500).send('댓글 작성에 실패했습니다.');
        }
        res.status(200).send('댓글이 등록되었습니다.');
    });
});


// 댓글 삭제
app.post('/delete-comment/:id', (req, res) => {
    if (!req.session.user) {
        return res.send('로그인이 필요합니다.');
    }

    const commentId = req.params.id;
    const sql = 'DELETE FROM comments WHERE id = ? AND user_id = ?';
    db.query(sql, [commentId, req.session.user.id], (err, result) => {
        if (err) {
            console.error('댓글 삭제 실패:', err);
            res.status(500).send('댓글 삭제에 실패했습니다.');
        } else {
            res.redirect('/board.html');
        }
    });
});

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
            res.status(200).send('게시글이 수정되었습니다.');
        }
    });
});

app.get('/get-user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);  // JSON으로 사용자 정보 반환
    } else {
        res.status(401).json({ error: '로그인이 필요합니다.' });
    }
});

app.get('/get-user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);  // 로그인 상태 정보 반환
    } else {
        res.json({});  // 로그아웃 상태
    }
});

// 관리자 페이지 라우트
app.get('/admin', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        res.sendFile(__dirname + '/public/admin.html');
    } else {
        res.status(403).send('접근 권한이 없습니다.');
    }
});

app.get('/admin/posts', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const sql = 'SELECT * FROM posts ORDER BY status DESC, created_at DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('게시글 불러오기 실패:', err);
            res.status(500).send([]);
        } else {
            res.json(results);
        }
    });
});

// 회원 목록 불러오기
app.get('/admin/get-users', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const sql = 'SELECT id, nickname, email, role, created_at FROM users';
        db.query(sql, (err, results) => {
            if (err) {
                console.error('회원 목록 조회 실패:', err);
                res.status(500).send('회원 목록 조회 실패');
            } else {
                res.json({ users: results });
            }
        });
    } else {
        res.status(403).send('접근 권한이 없습니다.');
    }
});

// 회원 탈퇴 처리
app.post('/admin/delete-user/:id', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const userId = req.params.id;
        const sql = 'DELETE FROM users WHERE id = ?';
        db.query(sql, [userId], (err, result) => {
            if (err) {
                console.error('회원 탈퇴 실패:', err);
                res.status(500).send('회원 탈퇴 실패');
            } else {
                res.status(200).send('회원 탈퇴 완료');
            }
        });
    } else {
        res.status(403).send('접근 권한이 없습니다.');
    }
});

// 게시글 숨기기 (관리자 전용)
app.post('/admin/hide-post/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const postId = req.params.id;
    const sql = 'UPDATE posts SET status = "hidden" WHERE id = ?';
    
    db.query(sql, [postId], (err, result) => {
        if (err) {
            console.error('게시글 숨기기 실패:', err);
            res.status(500).send('게시글 숨기기에 실패했습니다.');
        } else {
            res.redirect('/admin');
        }
    });
});

// 게시글 공지로 설정 (관리자 전용)
app.post('/admin/make-notice/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const postId = req.params.id;
    const sql = 'UPDATE posts SET status = "notice" WHERE id = ?';
    
    db.query(sql, [postId], (err, result) => {
        if (err) {
            console.error('게시글 공지 설정 실패:', err);
            res.status(500).send('공지 설정에 실패했습니다.');
        } else {
            res.redirect('/admin');
        }
    });
});

// 게시글 삭제 (관리자 전용)
app.post('/admin/delete-post/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const postId = req.params.id;
    const sql = 'DELETE FROM posts WHERE id = ?';
    
    db.query(sql, [postId], (err, result) => {
        if (err) {
            console.error('게시글 삭제 실패:', err);
            res.status(500).send('게시글 삭제에 실패했습니다.');
        } else {
            res.redirect('/admin');
        }
    });
});

// 댓글 목록 조회 (관리자 전용)
app.get('/admin/get-comments', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const sql = `
        SELECT comments.id, comments.content, comments.created_at, posts.title AS postTitle, users.nickname AS author
        FROM comments
        JOIN posts ON comments.post_id = posts.id
        JOIN users ON comments.user_id = users.id
        ORDER BY comments.created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('댓글 조회 실패:', err);
            return res.status(500).send('서버 오류로 댓글 조회에 실패했습니다.');
        }
        res.json({ comments: results });
    });
});

// 댓글 삭제 (관리자 전용)
app.post('/admin/delete-comment/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const commentId = req.params.id;

    const sql = 'DELETE FROM comments WHERE id = ?';
    db.query(sql, [commentId], (err, result) => {
        if (err) {
            console.error('댓글 삭제 실패:', err);
            return res.status(500).send('댓글 삭제에 실패했습니다.');
        }
        res.status(200).send('댓글이 삭제되었습니다.');
    });
});

// 회원 권한 변경 (관리자 전용)
app.post('/admin/update-role/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const userId = req.params.id;
    const { role } = req.body;

    const sql = 'UPDATE users SET role = ? WHERE id = ?';
    db.query(sql, [role, userId], (err, result) => {
        if (err) {
            console.error('권한 변경 실패:', err);
            res.status(500).send('회원 권한 변경에 실패했습니다.');
        } else {
            res.status(200).send('회원 권한이 변경되었습니다.');
        }
    });
});

// 게시글 상세 조회 API
app.get('/posts/:id', (req, res) => {
    const postId = req.params.id;
    const sql = 'SELECT * FROM posts WHERE id = ?';
    db.query(sql, [postId], (err, results) => {
        if (err || results.length === 0) {
            console.error('게시글 불러오기 실패:', err);
            return res.status(404).send('게시글을 찾을 수 없습니다.');
        }
        res.json(results[0]);
    });
});

// 게시글 상세 페이지 데이터 반환
app.get('/post/:id', (req, res) => {
    const postId = req.params.id;
    const sql = 'SELECT * FROM posts WHERE id = ?';

    db.query(sql, [postId], (err, results) => {
        if (err || results.length === 0) {
            console.error('게시글 조회 실패:', err);
            res.status(500).send('게시글을 불러오는 데 실패했습니다.');
        } else {
            res.json(results[0]);
        }
    });
});

// 게시글 삭제
app.post('/delete-post/:id', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    const postId = req.params.id;
    const sql = 'DELETE FROM posts WHERE id = ? AND (user_id = ? OR ? = "admin")';

    db.query(sql, [postId, req.session.user.id, req.session.user.role], (err, result) => {
        if (err) {
            console.error('게시글 삭제 실패:', err);
            res.status(500).send('게시글 삭제에 실패했습니다.');
        } else {
            res.status(200).send('게시글이 삭제되었습니다.');
        }
    });
});

// 권한 변경 라우트
app.post('/admin/change-role/:id', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const userId = req.params.id;
        const newRole = req.body.role;

        const sql = 'UPDATE users SET role = ? WHERE id = ?';
        db.query(sql, [newRole, userId], (err, result) => {
            if (err) {
                console.error('권한 변경 실패:', err);
                res.status(500).send('권한 변경에 실패했습니다.');
            } else {
                res.status(200).send('권한이 변경되었습니다.');
            }
        });
    } else {
        res.status(403).send('접근 권한이 없습니다.');
    }
});

// 사용자 활동 기록 함수
function logActivity(userId, action, targetType = null, targetId = null) {
    const sql = `INSERT INTO activity_logs (user_id, action, target_type, target_id) VALUES (?, ?, ?, ?)`;
    db.query(sql, [userId, action, targetType, targetId], (err) => {
        if (err) console.error('활동 로그 저장 실패:', err);
    });
}

// 게시글 작성 시 활동 기록
app.post('/create-post', (req, res) => {
    const { title, content } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    const sql = `INSERT INTO posts (title, content, author, user_id) VALUES (?, ?, ?, ?)`;
    db.query(sql, [title, content, req.session.user.nickname, userId], (err, result) => {
        if (err) {
            console.error('게시글 작성 실패:', err);
            res.status(500).send('게시글 작성에 실패했습니다.');
        } else {
            // 활동 로그 기록
            logActivity(userId, '게시글 작성', 'post', result.insertId);
            res.status(200).send('게시글이 등록되었습니다.');
        }
    });
});

// 활동 로그 조회
app.get('/admin/get-activity-logs', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const sql = 'SELECT * FROM activity_logs ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('활동 로그 조회 실패:', err);
            res.status(500).send('활동 로그 조회 실패');
        } else {
            res.json({ logs: results });
        }
    });
});

// 댓글 작성
app.post('/create-comment/:postId', (req, res) => {
    const { content } = req.body;
    const postId = req.params.postId;
    const userId = req.session?.user?.id;

    if (!userId) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    const sql = 'INSERT INTO comments (post_id, user_id, content, author) VALUES (?, ?, ?, ?)';
    db.query(sql, [postId, userId, content, req.session.user.nickname], (err, result) => {
        if (err) {
            console.error('댓글 작성 실패:', err);
            res.status(500).send('댓글 작성에 실패했습니다.');
        } else {
            // 댓글 작성 활동 기록
            logActivity(userId, '댓글 작성', 'comment', result.insertId);
            res.status(200).send('댓글이 등록되었습니다.');
        }
    });
});

// 관리자 활동 로그 페이지 제공 라우트
app.get('/admin/activity_log.html', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        res.sendFile(__dirname + '/public/activity_log.html');
    } else {
        res.status(403).send('접근 권한이 없습니다.');
    }
});

// 활동 로그 기록 함수
function logActivity(userId, action, description) {
    const sql = 'INSERT INTO activity_log (user_id, action, description) VALUES (?, ?, ?)';
    db.query(sql, [userId, action, description], (err, result) => {
        if (err) {
            console.error('활동 로그 기록 실패:', err);
        }
    });
}

app.get('/admin/get-activity-log', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }

    const sql = `
        SELECT activity_log.*, users.nickname 
        FROM activity_log 
        JOIN users ON activity_log.user_id = users.id 
        ORDER BY activity_log.created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('활동 로그 조회 실패:', err);
            res.status(500).send('활동 로그 조회 실패');
        } else {
            res.json(results);
        }
    });
});

app.post('/admin/suspend-user/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('권한이 없습니다.');
    }

    const userId = req.params.id;
    const sql = 'UPDATE users SET status = ? WHERE id = ?';
    
    db.query(sql, ['suspended', userId], (err, result) => {
        if (err) {
            console.error('회원 정지 실패:', err);
            res.status(500).send('회원 정지에 실패했습니다.');
        } else {
            res.status(200).send('회원이 정지되었습니다.');
        }
    });
});

app.get('/admin/get-users', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const search = req.query.search ? `%${req.query.search}%` : '%';
        const sql = `
            SELECT id, nickname, email, created_at, role, status
            FROM users
            WHERE nickname LIKE ? OR email LIKE ?
        `;
        db.query(sql, [search, search], (err, results) => {
            if (err) {
                console.error('회원 목록 조회 실패:', err);
                res.status(500).send('회원 목록 조회 실패');
            } else {
                res.json({ users: results });
            }
        });
    } else {
        res.status(403).send('접근 권한이 없습니다.');
    }
});

app.get('/admin/user-details.html', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('접근 권한이 없습니다.');
    }
    res.sendFile(__dirname + '/public/admin/user-details.html');
});

const moment = require('moment');  // 날짜 포맷 라이브러리 추가

// 방문자 기록 미들웨어
app.use((req, res, next) => {
    const ipAddress = req.ip || req.connection.remoteAddress;  // IP 주소 가져오기
    const today = moment().format('YYYY-MM-DD');

    // 중복 방문 확인 (오늘 같은 IP 방문 여부 확인)
    const checkVisitSql = `SELECT * FROM visitor_logs WHERE ip_address = ? AND visit_date = ?`;

    db.query(checkVisitSql, [ipAddress, today], (err, results) => {
        if (err) {
            console.error('방문자 확인 오류:', err);
            return next();  // 오류 발생 시 다음 미들웨어로 진행
        }

        if (results.length === 0) {
            // 새로운 방문 기록 추가
            const insertVisitSql = `INSERT INTO visitor_logs (ip_address, visit_date) VALUES (?, ?)`;
            db.query(insertVisitSql, [ipAddress, today], (err) => {
                if (err) {
                    console.error('방문 기록 추가 실패:', err);
                    return next();
                }

                // 일일 방문자 수 업데이트 (upsert)
                const updateDailyVisitsSql = `
                    INSERT INTO daily_visits (visit_date, visit_count)
                    VALUES (?, 1)
                    ON DUPLICATE KEY UPDATE visit_count = visit_count + 1
                `;
                db.query(updateDailyVisitsSql, [today]);
            });
        }
    });
    next();
});

// 관리자 페이지에서 일일 방문자 조회 API
app.get('/admin/daily-visits', (req, res) => {
    const sql = `SELECT visit_date, visit_count FROM daily_visits ORDER BY visit_date DESC LIMIT 30`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('일일 방문자 조회 실패:', err);
            return res.status(500).send('서버 오류');
        }
        res.json(results);  // 일일 방문자 수 반환
    });
});

const express = require('express');
const bodyParser = require('body-parser');
const signupRoute = require('./src/routes/signup'); // signup.js 라우터


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 회원가입 라우트 등록
app.use('/api', signupRoute);

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
