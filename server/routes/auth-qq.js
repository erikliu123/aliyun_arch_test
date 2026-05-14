const express = require('express');
const https = require('https');
const { getDb, saveDb } = require('../db');
const { signToken } = require('../auth');

const router = express.Router();

const QQ_APP_ID = process.env.QQ_APP_ID;
const QQ_APP_KEY = process.env.QQ_APP_KEY;
const QQ_CALLBACK_URL = process.env.QQ_CALLBACK_URL;
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://study.roamhong.site';

// 辅助：发起 HTTPS GET 请求
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// GET /api/auth/qq/login — 重定向到 QQ 授权页
router.get('/login', (req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  const authorizeUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${QQ_APP_ID}&redirect_uri=${encodeURIComponent(QQ_CALLBACK_URL)}&state=${state}&scope=get_user_info`;
  res.json({ url: authorizeUrl });
});

// GET /api/auth/qq/callback — QQ 回调，交换 code 获取用户信息
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${APP_ORIGIN}/qq-callback?error=missing_code`);
  }

  try {
    // 1. 用 code 换 access_token
    const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${QQ_APP_ID}&client_secret=${QQ_APP_KEY}&code=${code}&redirect_uri=${encodeURIComponent(QQ_CALLBACK_URL)}&fmt=json`;
    const tokenRaw = await httpsGet(tokenUrl);
    const tokenData = JSON.parse(tokenRaw);

    if (tokenData.error) {
      console.error('QQ token error:', tokenData);
      return res.redirect(`${APP_ORIGIN}/qq-callback?error=token_failed`);
    }

    const accessToken = tokenData.access_token;

    // 2. 获取 openid
    const meUrl = `https://graph.qq.com/oauth2.0/me?access_token=${accessToken}&fmt=json`;
    const meRaw = await httpsGet(meUrl);
    const meData = JSON.parse(meRaw);

    if (meData.error) {
      console.error('QQ me error:', meData);
      return res.redirect(`${APP_ORIGIN}/qq-callback?error=openid_failed`);
    }

    const openid = meData.openid;

    // 3. 获取用户信息
    const userInfoUrl = `https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${QQ_APP_ID}&openid=${openid}`;
    const userInfoRaw = await httpsGet(userInfoUrl);
    const userInfo = JSON.parse(userInfoRaw);

    const nickname = userInfo.nickname || `QQ用户${openid.substring(0, 6)}`;
    const avatar = userInfo.figureurl_qq_2 || userInfo.figureurl_qq_1 || '';

    // 4. 查找或创建用户
    const db = getDb();
    let userId, username;

    const existing = db.exec('SELECT id, username FROM users WHERE qq_openid = ?', [openid]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      // 已有 QQ 用户，更新昵称头像
      userId = existing[0].values[0][0];
      username = existing[0].values[0][1];
      db.run('UPDATE users SET qq_nickname = ?, qq_avatar = ? WHERE id = ?', [nickname, avatar, userId]);
      saveDb();
    } else {
      // 新建 QQ 用户
      // 生成唯一用户名
      username = `qq_${openid.substring(0, 8)}`;
      const checkName = db.exec('SELECT id FROM users WHERE username = ?', [username]);
      if (checkName.length > 0 && checkName[0].values.length > 0) {
        username = `qq_${openid.substring(0, 12)}`;
      }

      db.run(
        'INSERT INTO users (username, password_hash, qq_openid, qq_nickname, qq_avatar) VALUES (?, ?, ?, ?, ?)',
        [username, '', openid, nickname, avatar]
      );
      saveDb();

      const newUser = db.exec('SELECT id FROM users WHERE qq_openid = ?', [openid]);
      userId = newUser[0].values[0][0];
    }

    // 5. 签发 JWT
    const token = signToken({ userId, username });

    // 6. 重定向到前端 QQCallback 页面
    const userJson = encodeURIComponent(JSON.stringify({ id: userId, username, nickname, avatar }));
    res.redirect(`${APP_ORIGIN}/qq-callback?token=${token}&user=${userJson}`);

  } catch (err) {
    console.error('QQ OAuth error:', err);
    res.redirect(`${APP_ORIGIN}/qq-callback?error=server_error`);
  }
});

module.exports = router;
