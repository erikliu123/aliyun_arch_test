const express = require('express');
const { getDb, saveDb } = require('../db');

const router = express.Router();

// 提交题目反馈
router.post('/', (req, res) => {
  const { questionId, flagType, reason } = req.body;
  const userId = req.userId;

  if (!questionId || !flagType) {
    return res.status(400).json({ error: '请提供题目ID和反馈类型' });
  }

  const validTypes = ['bad_question', 'wrong_answer', 'unclear', 'duplicate', 'other'];
  if (!validTypes.includes(flagType)) {
    return res.status(400).json({ error: '无效的反馈类型' });
  }

  const db = getDb();

  db.run(`
    INSERT INTO question_feedback (user_id, question_id, flag_type, reason)
    VALUES (?, ?, ?, ?)
  `, [userId, questionId, flagType, reason || '']);

  saveDb();
  res.json({ success: true });
});

// 获取我的反馈历史
router.get('/my', (req, res) => {
  const userId = req.userId;
  const db = getDb();

  const result = db.exec(`
    SELECT id, question_id, flag_type, reason, created_at
    FROM question_feedback
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId]);

  const feedbacks = result.length > 0
    ? result[0].values.map(row => ({
        id: row[0],
        questionId: row[1],
        flagType: row[2],
        reason: row[3],
        createdAt: row[4]
      }))
    : [];

  res.json({ feedbacks });
});

module.exports = router;
