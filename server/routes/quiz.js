const express = require('express');
const { getDb, saveDb } = require('../db');

const router = express.Router();

function getQuestionBank() {
  return global.questionBank || [];
}

function getCategoryMap() {
  return global.categoryMap || {};
}

function getQuestionMap() {
  return global.questionMap || {};
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripAnswer(q) {
  const { answer, explanation, ...rest } = q;
  return rest;
}

// 获取所有分类及题数
router.get('/categories', (req, res) => {
  const catMap = getCategoryMap();
  const categories = Object.entries(catMap).map(([key, questions]) => ({
    key,
    name: questions[0]?.categoryName || key,
    count: questions.length
  }));
  res.json({ categories, total: getQuestionBank().length });
});

// 顺序出题
router.get('/sequential', (req, res) => {
  const { category, offset = '0', limit = '10' } = req.query;
  const off = parseInt(offset, 10);
  const lim = parseInt(limit, 10);

  let questions;
  if (category) {
    questions = getCategoryMap()[category] || [];
  } else {
    questions = getQuestionBank();
  }

  const slice = questions.slice(off, off + lim);
  res.json({
    questions: slice.map(stripAnswer),
    total: questions.length,
    offset: off,
    hasMore: off + lim < questions.length
  });
});

// 随机出题
router.get('/random', (req, res) => {
  const { category, count = '10' } = req.query;
  const n = Math.min(parseInt(count, 10), 50);

  let pool;
  if (category) {
    pool = getCategoryMap()[category] || [];
  } else {
    pool = getQuestionBank();
  }

  const selected = shuffle(pool).slice(0, n);
  res.json({
    questions: selected.map(stripAnswer),
    total: selected.length
  });
});

// 获取错题
router.get('/wrong', (req, res) => {
  const { category } = req.query;
  const userId = req.userId;
  const db = getDb();

  const result = db.exec(`
    SELECT question_id FROM answer_records
    WHERE user_id = ? AND id IN (
      SELECT MAX(id) FROM answer_records
      WHERE user_id = ?
      GROUP BY question_id
    ) AND is_correct = 0
  `, [userId, userId]);

  const wrongIds = result.length > 0 ? result[0].values.map(r => r[0]) : [];
  const qMap = getQuestionMap();
  let wrongQuestions = wrongIds.map(id => qMap[id]).filter(Boolean);

  if (category) {
    wrongQuestions = wrongQuestions.filter(q => q.category === category);
  }

  res.json({
    questions: wrongQuestions.map(stripAnswer),
    total: wrongQuestions.length
  });
});

// 提交单题答案
router.post('/submit', (req, res) => {
  const { questionId, selectedAnswer, type } = req.body;
  const userId = req.userId;

  if (!questionId || !selectedAnswer) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const question = getQuestionMap()[questionId];
  if (!question) {
    return res.status(404).json({ error: '题目不存在' });
  }

  // 简答题：不判断对错，直接记录并返回参考答案
  if (type === 'essay' || question.type === 'essay') {
    const db = getDb();
    db.run(`
      INSERT INTO answer_records (user_id, question_id, selected_answer, is_correct)
      VALUES (?, ?, ?, ?)
    `, [userId, questionId, selectedAnswer.substring(0, 500), 1]);
    saveDb();

    return res.json({
      correct: true,
      answer: '',
      explanation: question.explanation
    });
  }

  // 多选题：排序后比较
  let isCorrect;
  if (question.type === 'multiple') {
    const userAnswers = selectedAnswer.split(',').map(a => a.trim()).sort().join(',');
    const correctAnswers = question.answer.split(',').map(a => a.trim()).sort().join(',');
    isCorrect = userAnswers === correctAnswers ? 1 : 0;
  } else {
    // 单选题：直接比较
    isCorrect = question.answer === selectedAnswer ? 1 : 0;
  }

  const db = getDb();

  db.run(`
    INSERT INTO answer_records (user_id, question_id, selected_answer, is_correct)
    VALUES (?, ?, ?, ?)
  `, [userId, questionId, selectedAnswer, isCorrect]);
  saveDb();

  res.json({
    correct: isCorrect === 1,
    answer: question.answer,
    explanation: question.explanation
  });
});

// 批量提交答案
router.post('/submit-batch', (req, res) => {
  const { answers, mode, category } = req.body;
  const userId = req.userId;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: '答案不能为空' });
  }

  const qMap = getQuestionMap();
  const db = getDb();
  let correctCount = 0;
  const results = [];

  for (const { questionId, selectedAnswer } of answers) {
    const question = qMap[questionId];
    if (!question) continue;

    const isCorrect = question.answer === selectedAnswer ? 1 : 0;
    if (isCorrect) correctCount++;

    db.run(`
      INSERT INTO answer_records (user_id, question_id, selected_answer, is_correct)
      VALUES (?, ?, ?, ?)
    `, [userId, questionId, selectedAnswer, isCorrect]);

    results.push({
      questionId,
      correct: isCorrect === 1,
      answer: question.answer,
      explanation: question.explanation
    });
  }

  db.run(`
    INSERT INTO quiz_sessions (user_id, mode, category, total, correct)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, mode || 'unknown', category || null, answers.length, correctCount]);

  saveDb();

  res.json({
    total: answers.length,
    correct: correctCount,
    accuracy: Math.round((correctCount / answers.length) * 100),
    results
  });
});

module.exports = router;
