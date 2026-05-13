const express = require('express');
const { getDb, saveDb } = require('../db');
const { scrapeForComparison, getComparisonProductList } = require('../services/compare-scraper');
const { generateComparisonReport } = require('../services/dashscope');

const router = express.Router();

// 限流
const rateLimitMap = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(userId) {
  const now = Date.now();
  const calls = rateLimitMap.get(userId) || [];
  const recent = calls.filter(t => now - t < RATE_WINDOW);
  rateLimitMap.set(userId, recent);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  return true;
}

// 获取可对比的产品列表
router.get('/products', (req, res) => {
  const products = getComparisonProductList();
  res.json({ products });
});

// 生成对比报告
router.post('/generate', async (req, res) => {
  const { productKey } = req.body;
  const userId = req.userId;

  if (!productKey) {
    return res.status(400).json({ error: '请选择要对比的产品' });
  }

  // 检查缓存（7天内的报告直接返回）
  const db = getDb();
  const cached = db.exec(`
    SELECT report_json, created_at FROM comparison_reports
    WHERE product_key = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `, [productKey]);

  if (cached.length > 0 && cached[0].values.length > 0) {
    const report = JSON.parse(cached[0].values[0][0]);
    return res.json({ report, cached: true, generatedAt: cached[0].values[0][1] });
  }

  // 限流
  if (!checkRateLimit(userId)) {
    return res.status(429).json({ error: '生成频率过高，请稍后再试（每小时最多5次）' });
  }

  try {
    // 1. 爬取双方页面
    const scrapeResult = await scrapeForComparison(productKey);

    // 2. 调用 LLM 生成对比报告
    const report = await generateComparisonReport(scrapeResult);

    // 3. 保存到数据库（7天缓存）
    db.run(`
      INSERT INTO comparison_reports (product_key, report_json, aliyun_source_url, tencent_source_url, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
    `, [
      productKey,
      JSON.stringify(report),
      scrapeResult.aliyun.docUrl,
      scrapeResult.tencent.docUrl,
      userId
    ]);
    saveDb();

    res.json({ report, cached: false, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('对比报告生成失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 获取缓存的报告
router.get('/report/:productKey', (req, res) => {
  const { productKey } = req.params;
  const db = getDb();

  const result = db.exec(`
    SELECT report_json, created_at FROM comparison_reports
    WHERE product_key = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `, [productKey]);

  if (result.length > 0 && result[0].values.length > 0) {
    const report = JSON.parse(result[0].values[0][0]);
    return res.json({ report, generatedAt: result[0].values[0][1] });
  }

  res.status(404).json({ error: '暂无该产品的对比报告' });
});

module.exports = router;
