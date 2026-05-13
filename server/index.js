require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const { initDb, getDb } = require('./db');

async function start() {
  // 初始化数据库
  await initDb();

  // 加载静态题库到内存
  const questionsPath = path.join(__dirname, 'data', 'questions.json');
  const questionBank = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));

  const questionMap = {};
  const categoryMap = {};
  for (const q of questionBank) {
    questionMap[q.id] = q;
    if (!categoryMap[q.category]) {
      categoryMap[q.category] = [];
    }
    categoryMap[q.category].push(q);
  }

  // 加载已生成的动态题目到内存
  const db = getDb();
  const genResult = db.exec(`
    SELECT question_id, category, category_name, difficulty, type, question, options, answer, explanation
    FROM generated_questions WHERE is_active = 1
  `);

  let genCount = 0;
  if (genResult.length > 0) {
    for (const row of genResult[0].values) {
      const q = {
        id: row[0],
        category: row[1],
        categoryName: row[2],
        difficulty: row[3],
        type: row[4],
        question: row[5],
        options: JSON.parse(row[6] || '[]'),
        answer: row[7],
        explanation: row[8]
      };
      questionBank.push(q);
      questionMap[q.id] = q;
      if (!categoryMap[q.category]) {
        categoryMap[q.category] = [];
      }
      categoryMap[q.category].push(q);
      genCount++;
    }
  }

  global.questionBank = questionBank;
  global.questionMap = questionMap;
  global.categoryMap = categoryMap;

  console.log(`题库加载完成: ${questionBank.length} 道题 (静态 ${questionBank.length - genCount}, 动态 ${genCount}), ${Object.keys(categoryMap).length} 个分类`);

  // 创建 Express 应用
  const app = express();
  app.use(express.json());
  app.use(cors());

  // 请求日志
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[${req.method}] ${req.path}`, req.method === 'POST' ? JSON.stringify(req.body).substring(0, 200) : '');
      const origJson = res.json.bind(res);
      res.json = (data) => {
        console.log(`  -> ${res.statusCode}`, JSON.stringify(data).substring(0, 100));
        return origJson(data);
      };
    }
    next();
  });

  // 路由
  const { authMiddleware } = require('./auth');
  const userRoutes = require('./routes/user');
  const quizRoutes = require('./routes/quiz');
  const statsRoutes = require('./routes/stats');
  const generateRoutes = require('./routes/generate');
  const feedbackRoutes = require('./routes/feedback');
  const compareRoutes = require('./routes/compare');

  app.use('/api', userRoutes);
  app.use('/api/questions', authMiddleware, quizRoutes);
  app.use('/api/answers', authMiddleware, quizRoutes);
  app.use('/api/stats', authMiddleware, statsRoutes);
  app.use('/api/generate', authMiddleware, generateRoutes);
  app.use('/api/feedback', authMiddleware, feedbackRoutes);
  app.use('/api/compare', authMiddleware, compareRoutes);

  // 生产模式下 serve 前端静态文件
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`服务器启动: http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
