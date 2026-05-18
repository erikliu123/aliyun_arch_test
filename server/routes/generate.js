const express = require('express');
const { getDb, saveDb } = require('../db');
const { getDocContent, getProductList } = require('../services/scraper');
const { generateQuestions } = require('../services/dashscope');

const router = express.Router();

// 简单的内存限流：每用户每小时最多 10 次生成
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId) {
  const now = Date.now();
  const userCalls = rateLimitMap.get(userId) || [];
  const recent = userCalls.filter(t => now - t < RATE_WINDOW);
  rateLimitMap.set(userId, recent);

  if (recent.length >= RATE_LIMIT) {
    return false;
  }
  recent.push(now);
  return true;
}

// 获取支持的产品列表
router.get('/products', (req, res) => {
  res.json({ products: getProductList() });
});

// SSE 生成题目（实时进度）
router.post('/sse', async (req, res) => {
  const { productName, url, types = ['single'], count = 10, difficulty = 3 } = req.body;
  const userId = req.userId;

  // 参数校验
  if (!productName && !url) {
    return res.status(400).json({ error: '请提供产品名或文档URL' });
  }

  const validTypes = ['single', 'multiple', 'essay'];
  const filteredTypes = types.filter(t => validTypes.includes(t));
  if (filteredTypes.length === 0) {
    return res.status(400).json({ error: '请至少选择一种题型' });
  }

  const clampedCount = Math.max(3, Math.min(20, parseInt(count) || 10));
  const clampedDifficulty = Math.max(1, Math.min(3, parseInt(difficulty) || 3));

  // 限流检查
  if (!checkRateLimit(userId)) {
    return res.status(429).json({ error: '生成频率过高，请稍后再试（每小时最多10次）' });
  }

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // SSE 辅助函数
  function sendEvent(event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    // 1. 抓取文档内容
    sendEvent('progress', { stage: 'scraping', message: '正在抓取文档内容...' });
    const docResult = await getDocContent(productName, url);
    sendEvent('progress', { stage: 'scraping_done', message: '文档抓取完成', productName: docResult.productName });

    // 2. 分批生成题目
    const questions = await generateQuestions(docResult.content, {
      types: filteredTypes,
      count: clampedCount,
      difficulty: clampedDifficulty,
      productName: docResult.productName
    }, (batch, totalBatches, soFar) => {
      sendEvent('progress', { 
        stage: 'generating', 
        message: `正在生成题目（批次 ${batch}/${totalBatches}）...`,
        current: soFar,
        total: clampedCount
      });
    });

    // 3. 保存到数据库
    sendEvent('progress', { stage: 'saving', message: '正在保存题目...' });
    
    const db = getDb();
    const timestamp = Date.now();
    const category = (productName || 'CUSTOM').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const categoryName = docResult.productName || productName || '自定义';

    const savedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionId = `gen-${category.toLowerCase()}-${timestamp}-${String(i + 1).padStart(3, '0')}`;

      try {
        db.run(`
          INSERT INTO generated_questions (question_id, category, category_name, difficulty, type, question, options, answer, explanation, source_url, product_name, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          questionId,
          category,
          categoryName,
          clampedDifficulty,
          q.type,
          q.question,
          JSON.stringify(q.options || []),
          q.answer || '',
          q.explanation || '',
          docResult.url,
          docResult.productName,
          userId
        ]);

        const saved = {
          id: questionId,
          category,
          categoryName,
          difficulty: clampedDifficulty,
          type: q.type,
          question: q.question,
          options: q.options || [],
          answer: q.answer || '',
          explanation: q.explanation || ''
        };
        savedQuestions.push(saved);

        // 同步到内存中的题库
        if (global.questionMap) global.questionMap[questionId] = saved;
        if (global.questionBank) global.questionBank.push(saved);
        if (global.categoryMap) {
          if (!global.categoryMap[category]) global.categoryMap[category] = [];
          global.categoryMap[category].push(saved);
        }
      } catch (dbErr) {
        console.error('保存题目失败:', dbErr.message);
      }
    }

    saveDb();

    // 4. 发送完成事件
    sendEvent('done', {
      generated: savedQuestions.length,
      category,
      categoryName,
      sourceUrl: docResult.url,
      questions: savedQuestions.map(q => {
        const { answer, explanation, ...rest } = q;
        return rest;
      })
    });

  } catch (err) {
    console.error('生成题目失败:', err.message);
    sendEvent('error', { error: err.message });
  } finally {
    res.end();
  }
});

// 生成题目
router.post('/', async (req, res) => {
  const { productName, url, types = ['single'], count = 10, difficulty = 3 } = req.body;
  const userId = req.userId;

  // 参数校验
  if (!productName && !url) {
    return res.status(400).json({ error: '请提供产品名或文档URL' });
  }

  const validTypes = ['single', 'multiple', 'essay'];
  const filteredTypes = types.filter(t => validTypes.includes(t));
  if (filteredTypes.length === 0) {
    return res.status(400).json({ error: '请至少选择一种题型' });
  }

  const clampedCount = Math.max(3, Math.min(20, parseInt(count) || 10));
  const clampedDifficulty = Math.max(1, Math.min(3, parseInt(difficulty) || 3));

  // 限流检查
  if (!checkRateLimit(userId)) {
    return res.status(429).json({ error: '生成频率过高，请稍后再试（每小时最多10次）' });
  }

  try {
    // 1. 抓取文档内容
    const docResult = await getDocContent(productName, url);

    // 2. 调用 LLM 生成题目
    const questions = await generateQuestions(docResult.content, {
      types: filteredTypes,
      count: clampedCount,
      difficulty: clampedDifficulty,
      productName: docResult.productName
    });

    // 3. 保存到数据库
    const db = getDb();
    const timestamp = Date.now();
    const category = (productName || 'CUSTOM').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const categoryName = docResult.productName || productName || '自定义';

    const savedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionId = `gen-${category.toLowerCase()}-${timestamp}-${String(i + 1).padStart(3, '0')}`;

      try {
        db.run(`
          INSERT INTO generated_questions (question_id, category, category_name, difficulty, type, question, options, answer, explanation, source_url, product_name, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          questionId,
          category,
          categoryName,
          clampedDifficulty,
          q.type,
          q.question,
          JSON.stringify(q.options || []),
          q.answer || '',
          q.explanation || '',
          docResult.url,
          docResult.productName,
          userId
        ]);

        const saved = {
          id: questionId,
          category,
          categoryName,
          difficulty: clampedDifficulty,
          type: q.type,
          question: q.question,
          options: q.options || [],
          answer: q.answer || '',
          explanation: q.explanation || ''
        };
        savedQuestions.push(saved);

        // 同步到内存中的题库
        if (global.questionMap) {
          global.questionMap[questionId] = saved;
        }
        if (global.questionBank) {
          global.questionBank.push(saved);
        }
        if (global.categoryMap) {
          if (!global.categoryMap[category]) {
            global.categoryMap[category] = [];
          }
          global.categoryMap[category].push(saved);
        }
      } catch (dbErr) {
        // 跳过重复题目
        console.error('保存题目失败:', dbErr.message);
      }
    }

    saveDb();

    res.json({
      generated: savedQuestions.length,
      category,
      categoryName,
      sourceUrl: docResult.url,
      questions: savedQuestions.map(q => {
        const { answer, explanation, ...rest } = q;
        return rest;
      })
    });
  } catch (err) {
    console.error('生成题目失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 获取生成历史
router.get('/history', (req, res) => {
  const userId = req.userId;
  const db = getDb();

  const result = db.exec(`
    SELECT product_name, category, category_name, COUNT(*) as count,
           MAX(created_at) as last_generated, source_url
    FROM generated_questions
    WHERE created_by = ? AND is_active = 1
    GROUP BY product_name
    ORDER BY last_generated DESC
  `, [userId]);

  const history = result.length > 0
    ? result[0].values.map(row => ({
        productName: row[0],
        category: row[1],
        categoryName: row[2],
        count: row[3],
        lastGenerated: row[4],
        sourceUrl: row[5]
      }))
    : [];

  res.json({ history });
});

// 获取已生成的题目（答题用，去除答案）
router.get('/questions', (req, res) => {
  const { category, product, count = '10' } = req.query;
  const userId = req.userId;
  const db = getDb();
  const n = Math.min(parseInt(count) || 10, 50);

  let sql = `
    SELECT question_id, category, category_name, difficulty, type, question, options
    FROM generated_questions
    WHERE is_active = 1 AND created_by = ?
  `;
  const params = [userId];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (product) {
    sql += ' AND product_name = ?';
    params.push(product);
  }

  sql += ' ORDER BY RANDOM() LIMIT ?';
  params.push(n);

  const result = db.exec(sql, params);

  const questions = result.length > 0
    ? result[0].values.map(row => ({
        id: row[0],
        category: row[1],
        categoryName: row[2],
        difficulty: row[3],
        type: row[4],
        question: row[5],
        options: JSON.parse(row[6] || '[]')
      }))
    : [];

  res.json({ questions, total: questions.length });
});

module.exports = router;
