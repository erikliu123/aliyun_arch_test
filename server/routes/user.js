const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('../db');
const { signToken } = require('../auth');

const router = express.Router();

// 注册
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需在 2-20 个字符之间' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '密码长度不能少于 4 个字符' });
  }

  const db = getDb();
  const existing = db.exec('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length > 0 && existing[0].values.length > 0) {
    return res.status(409).json({ error: '用户名已存在' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
  saveDb();

  const row = db.exec('SELECT id FROM users WHERE username = ?', [username]);
  const userId = row[0].values[0][0];

  const token = signToken({ userId, username });
  res.json({ token, user: { id: userId, username } });
});

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = getDb();
  const result = db.exec('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const [id, uname, passwordHash] = result[0].values[0];
  if (!bcrypt.compareSync(password, passwordHash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = signToken({ userId: id, username: uname });
  res.json({ token, user: { id, username: uname } });
});

module.exports = router;
