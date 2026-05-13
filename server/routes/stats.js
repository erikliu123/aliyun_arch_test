const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function queryOne(sql, params) {
  const db = getDb();
  const result = db.exec(sql, params);
  if (result.length === 0 || result[0].values.length === 0) return 0;
  return result[0].values[0][0];
}

// 总览统计
router.get('/overview', (req, res) => {
  const userId = req.userId;

  const totalAnswered = queryOne('SELECT COUNT(*) FROM answer_records WHERE user_id = ?', [userId]);
  const totalCorrect = queryOne('SELECT COUNT(*) FROM answer_records WHERE user_id = ? AND is_correct = 1', [userId]);
  const wrongCount = queryOne(`
    SELECT COUNT(*) FROM (
      SELECT question_id FROM answer_records
      WHERE user_id = ? AND id IN (
        SELECT MAX(id) FROM answer_records WHERE user_id = ? GROUP BY question_id
      ) AND is_correct = 0
    )
  `, [userId, userId]);
  const uniqueQuestions = queryOne('SELECT COUNT(DISTINCT question_id) FROM answer_records WHERE user_id = ?', [userId]);

  res.json({
    totalAnswered,
    totalCorrect,
    accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
    wrongCount,
    uniqueQuestions
  });
});

// 按分类统计
router.get('/by-category', (req, res) => {
  const userId = req.userId;
  const questionBank = global.questionBank || [];
  const questionMap = global.questionMap || {};
  const db = getDb();

  const categories = {};
  for (const q of questionBank) {
    if (!categories[q.category]) {
      categories[q.category] = { name: q.categoryName, total: 0 };
    }
    categories[q.category].total++;
  }

  const catStats = {};
  for (const [key, info] of Object.entries(categories)) {
    catStats[key] = {
      name: info.name,
      totalQuestions: info.total,
      answered: 0,
      correct: 0
    };
  }

  const result = db.exec('SELECT question_id, is_correct FROM answer_records WHERE user_id = ?', [userId]);
  if (result.length > 0) {
    for (const row of result[0].values) {
      const [questionId, isCorrect] = row;
      const q = questionMap[questionId];
      if (q && catStats[q.category]) {
        catStats[q.category].answered++;
        if (isCorrect) catStats[q.category].correct++;
      }
    }
  }

  const stats = Object.entries(catStats).map(([key, stat]) => ({
    category: key,
    ...stat,
    accuracy: stat.answered > 0 ? Math.round((stat.correct / stat.answered) * 100) : null
  }));

  res.json({ categories: stats });
});

module.exports = router;
