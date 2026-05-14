const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db');
const { scrapeForComparison, getComparisonProductList } = require('../services/compare-scraper');
const { generateComparisonReport } = require('../services/dashscope');

// 速率限制：每用户每小时5次
const rateLimits = {};

function checkRateLimit(userId) {
  const now = Date.now();
  const key = `compare_${userId}`;
  if (!rateLimits[key]) {
    rateLimits[key] = [];
  }
  rateLimits[key] = rateLimits[key].filter(t => now - t < 3600000);
  if (rateLimits[key].length >= 5) {
    return false;
  }
  rateLimits[key].push(now);
  return true;
}

/**
 * GET /api/compare/products - 获取可对比的产品列表
 */
router.get('/products', (req, res) => {
  try {
    const products = getComparisonProductList();
    res.json({ products });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/compare/generate - 生成对比报告
 */
router.post('/generate', async (req, res) => {
  const userId = req.userId;
  const { productKey } = req.body;

  if (!productKey) {
    return res.status(400).json({ error: '请选择要对比的产品' });
  }

  // 检查缓存（7天内）
  const db = getDb();
  const cached = db.exec(`
    SELECT report_json, created_at FROM comparison_reports
    WHERE product_key = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `, [productKey]);

  if (cached.length > 0 && cached[0].values.length > 0) {
    const row = cached[0].values[0];
    try {
      const report = JSON.parse(row[0]);
      return res.json({
        report,
        cached: true,
        generated_at: row[1]
      });
    } catch (e) {
      // 缓存数据损坏，重新生成
    }
  }

  // 速率限制
  if (!checkRateLimit(userId)) {
    return res.status(429).json({ error: '生成频率超限，每小时最多 5 次，请稍后再试' });
  }

  try {
    // 1. 爬取双云文档
    const scrapeResult = await scrapeForComparison(productKey);

    // 2. 调用大模型生成报告
    const report = await generateComparisonReport(scrapeResult);

    // 3. 存入数据库缓存
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    db.run(`
      INSERT INTO comparison_reports (product_key, report_json, aliyun_source_url, tencent_source_url, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      productKey,
      JSON.stringify(report),
      scrapeResult.aliyun.docUrl || '',
      scrapeResult.tencent.docUrl || '',
      userId,
      expiresAt
    ]);
    saveDb();

    res.json({
      report,
      cached: false,
      generated_at: new Date().toISOString(),
      scrape_errors: [
        ...scrapeResult.aliyun.errors,
        ...scrapeResult.tencent.errors
      ]
    });
  } catch (e) {
    console.error('对比报告生成失败:', e.message);
    res.status(500).json({ error: e.message || '对比报告生成失败，请稍后重试' });
  }
});

/**
 * GET /api/compare/report/:productKey - 获取缓存的对比报告
 */
router.get('/report/:productKey', (req, res) => {
  const { productKey } = req.params;
  const db = getDb();

  const result = db.exec(`
    SELECT report_json, created_at FROM comparison_reports
    WHERE product_key = ?
    ORDER BY created_at DESC LIMIT 1
  `, [productKey]);

  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(404).json({ error: '暂无该产品的对比报告' });
  }

  const row = result[0].values[0];
  try {
    const report = JSON.parse(row[0]);
    res.json({ report, generated_at: row[1] });
  } catch (e) {
    res.status(500).json({ error: '报告数据解析失败' });
  }
});

module.exports = router;
