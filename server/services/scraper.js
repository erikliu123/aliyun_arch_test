const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

// 加载产品URL映射
const productUrlsPath = path.join(__dirname, '..', 'data', 'product-urls.json');
const productUrls = JSON.parse(fs.readFileSync(productUrlsPath, 'utf-8'));

/**
 * 根据产品名查找对应的文档URL
 */
function resolveProductUrl(productName) {
  const key = productName.toLowerCase().trim();

  // 精确匹配
  if (productUrls[key]) {
    return productUrls[key];
  }

  // 模糊匹配：搜索 name 字段
  for (const [k, v] of Object.entries(productUrls)) {
    if (v.name.toLowerCase().includes(key) || k.includes(key)) {
      return v;
    }
  }

  return null;
}

/**
 * 获取所有支持的产品列表
 */
function getProductList() {
  return Object.entries(productUrls).map(([key, val]) => ({
    key,
    name: val.name
  }));
}

/**
 * 抓取URL内容并提取文本
 */
async function scrapeContent(url, options = {}) {
  const { timeout = 15000, maxLength = 6000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const text = extractContent(html);

    if (text.length < 100) {
      throw new Error('页面内容过少，无法生成有效题目');
    }

    return text.substring(0, maxLength);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从HTML中提取主要文本内容
 */
function extractContent(html) {
  const $ = cheerio.load(html);

  // 移除无关元素
  $('script, style, nav, footer, header, .sidebar, .breadcrumb, .navigation, .toc').remove();

  // 尝试多种内容选择器（阿里云文档页面结构）
  const selectors = [
    '.content-body',
    '.documentation-content',
    '#China_Chinese_Content',
    'article',
    '.main-content',
    '.doc-content',
    '[class*="content"]',
    'main',
    '.container'
  ];

  let content = '';

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0) {
      content = el.first().text();
      if (content.trim().length > 200) {
        break;
      }
    }
  }

  // 如果特定选择器没找到足够内容，取 body
  if (content.trim().length < 200) {
    content = $('body').text();
  }

  // 清理文本
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return content;
}

/**
 * 根据产品名或URL获取文档内容
 */
async function getDocContent(productName, url) {
  if (url) {
    // 用户指定URL，直接抓取
    return { content: await scrapeContent(url), url, productName: productName || 'custom' };
  }

  if (!productName) {
    throw new Error('请提供产品名或URL');
  }

  const product = resolveProductUrl(productName);
  if (!product) {
    // 尝试构造URL
    const guessUrl = `https://help.aliyun.com/zh/${productName.toLowerCase()}/`;
    try {
      const content = await scrapeContent(guessUrl);
      return { content, url: guessUrl, productName };
    } catch (e) {
      throw new Error(`未找到产品"${productName}"的文档，请尝试手动输入URL`);
    }
  }

  const content = await scrapeContent(product.url);
  return { content, url: product.url, productName: product.name };
}

module.exports = { getDocContent, getProductList, resolveProductUrl };
