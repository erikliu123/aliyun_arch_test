const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

// 加载云产品映射
const mappingPath = path.join(__dirname, '..', 'data', 'cloud-comparison-urls.json');
const comparisonMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

/**
 * 获取可对比的产品列表
 */
function getComparisonProductList() {
  return Object.entries(comparisonMapping).map(([key, val]) => ({
    key,
    category: val.category,
    aliyunName: val.aliyun.name,
    tencentName: val.tencent.name,
    volcengineName: val.volcengine.name
  }));
}

/**
 * 获取某个产品的映射信息
 */
function getProductMapping(productKey) {
  return comparisonMapping[productKey] || null;
}

/**
 * 通用页面抓取
 */
async function fetchPage(url, options = {}) {
  const { timeout = 15000, maxLength = 4000 } = options;
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
      return { success: false, error: `HTTP ${response.status}`, content: '' };
    }

    const html = await response.text();
    return { success: true, content: html, url };
  } catch (e) {
    return { success: false, error: e.message, content: '' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从阿里云页面提取内容
 */
function extractAliyunContent(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, .sidebar, .breadcrumb, .navigation, .toc').remove();

  const selectors = [
    '.content-body',
    '.documentation-content',
    'article',
    '.main-content',
    '.doc-content',
    '[class*="content"]',
    'main'
  ];

  let content = '';
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length > 0) {
      content = el.first().text();
      if (content.trim().length > 200) break;
    }
  }

  if (content.trim().length < 200) {
    content = $('body').text();
  }

  return content.replace(/\s+/g, ' ').trim();
}

/**
 * 从腾讯云页面提取内容
 */
function extractTencentContent(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, .sidebar, .J-navBox, .rno-nav').remove();

  const selectors = [
    '.J-markdownWrap',
    '.rno-markdown',
    '.markdown-text-wraper',
    '#docArticleContent',
    '.document-content',
    '.doc-content-wrap',
    '[class*="markdown"]',
    'article',
    'main'
  ];

  let content = '';
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length > 0) {
      content = el.first().text();
      if (content.trim().length > 200) break;
    }
  }

  if (content.trim().length < 200) {
    content = $('body').text();
  }

  return content.replace(/\s+/g, ' ').trim();
}

/**
 * 从火山引擎页面提取内容
 */
function extractVolcengineContent(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, .sidebar, .doc-menu, .toc, .breadcrumb, [class*="nav"]').remove();

  const selectors = [
    '.doc-content-container',
    '.markdown-body',
    '.article-content',
    '.doc-content',
    '[class*="markdown"]',
    '[class*="content"]',
    'article',
    'main'
  ];

  let content = '';
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length > 0) {
      content = el.first().text();
      if (content.trim().length > 200) break;
    }
  }

  if (content.trim().length < 200) {
    content = $('body').text();
  }

  return content.replace(/\s+/g, ' ').trim();
}

/**
 * 爬取三方云产品的文档和定价页面
 */
async function scrapeForComparison(productKey) {
  const mapping = getProductMapping(productKey);
  if (!mapping) {
    throw new Error(`未找到产品"${productKey}"的对比配置`);
  }

  const maxLen = 4000;

  // 并行爬取6个页面
  const [aliyunDoc, aliyunPricing, tencentDoc, tencentPricing, volcengineDoc, volcenginePricing] = await Promise.all([
    fetchPage(mapping.aliyun.doc_url),
    fetchPage(mapping.aliyun.pricing_url),
    fetchPage(mapping.tencent.doc_url),
    fetchPage(mapping.tencent.pricing_url),
    fetchPage(mapping.volcengine.doc_url),
    fetchPage(mapping.volcengine.pricing_url)
  ]);

  const result = {
    productKey,
    category: mapping.category,
    aliyun: {
      name: mapping.aliyun.name,
      docContent: aliyunDoc.success ? extractAliyunContent(aliyunDoc.content).substring(0, maxLen) : '',
      pricingContent: aliyunPricing.success ? extractAliyunContent(aliyunPricing.content).substring(0, maxLen) : '',
      docUrl: mapping.aliyun.doc_url,
      errors: []
    },
    tencent: {
      name: mapping.tencent.name,
      docContent: tencentDoc.success ? extractTencentContent(tencentDoc.content).substring(0, maxLen) : '',
      pricingContent: tencentPricing.success ? extractTencentContent(tencentPricing.content).substring(0, maxLen) : '',
      docUrl: mapping.tencent.doc_url,
      errors: []
    },
    volcengine: {
      name: mapping.volcengine.name,
      docContent: volcengineDoc.success ? extractVolcengineContent(volcengineDoc.content).substring(0, maxLen) : '',
      pricingContent: volcenginePricing.success ? extractVolcengineContent(volcenginePricing.content).substring(0, maxLen) : '',
      docUrl: mapping.volcengine.doc_url,
      errors: []
    }
  };

  if (!aliyunDoc.success) result.aliyun.errors.push(`文档页抓取失败: ${aliyunDoc.error}`);
  if (!aliyunPricing.success) result.aliyun.errors.push(`定价页抓取失败: ${aliyunPricing.error}`);
  if (!tencentDoc.success) result.tencent.errors.push(`文档页抓取失败: ${tencentDoc.error}`);
  if (!tencentPricing.success) result.tencent.errors.push(`定价页抓取失败: ${tencentPricing.error}`);
  if (!volcengineDoc.success) result.volcengine.errors.push(`文档页抓取失败: ${volcengineDoc.error}`);
  if (!volcenginePricing.success) result.volcengine.errors.push(`定价页抓取失败: ${volcenginePricing.error}`);

  // 至少需要两方有内容
  const totalContent = (result.aliyun.docContent + result.aliyun.pricingContent +
    result.tencent.docContent + result.tencent.pricingContent +
    result.volcengine.docContent + result.volcengine.pricingContent).length;

  if (totalContent < 200) {
    throw new Error('三方文档内容抓取量过少，无法生成有效对比报告');
  }

  return result;
}

module.exports = { scrapeForComparison, getComparisonProductList, getProductMapping };
