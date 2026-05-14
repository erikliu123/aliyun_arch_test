/**
 * DashScope (通义千问) API 服务
 * 使用 OpenAI 兼容接口调用 qwen-plus 模型生成题目
 */

const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

function getApiKey() {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key || key === 'sk-your-api-key-here') {
    throw new Error('请在 .env 文件中配置有效的 DASHSCOPE_API_KEY');
  }
  return key;
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt() {
  return `你是一位阿里云认证考试出题专家，擅长根据阿里云产品文档出高质量的考试题目。

要求：
1. 题目必须基于提供的文档内容，确保技术准确性
2. 选项必须具有迷惑性，不能有明显错误的选项
3. 解析必须详细说明为什么正确答案是对的，其他选项为什么不对
4. 难度要符合指定等级：1=基础概念，2=进阶应用，3=架构/专家级
5. 输出必须是严格的JSON数组格式，不要包含其他文字

输出格式要求（严格按此JSON Schema）：
[
  {
    "type": "single|multiple|essay",
    "question": "题目内容",
    "options": [
      {"key": "A", "text": "选项A内容"},
      {"key": "B", "text": "选项B内容"},
      {"key": "C", "text": "选项C内容"},
      {"key": "D", "text": "选项D内容"}
    ],
    "answer": "B",
    "explanation": "解析内容"
  }
]

注意：
- single 类型：answer 为单个字母如 "B"
- multiple 类型：answer 为逗号分隔的多个字母如 "A,C"，至少2个正确答案
- essay 类型：options 为空数组 []，answer 为空字符串 ""，explanation 作为参考答案
- 多选题的选项可以有4-6个`;
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(content, options) {
  const { types = ['single'], count = 10, difficulty = 3, productName = '' } = options;

  const typeDesc = types.map(t => {
    if (t === 'single') return `单选题`;
    if (t === 'multiple') return `多选题`;
    if (t === 'essay') return `简答题`;
    return t;
  }).join('、');

  const diffDesc = ['', '基础', '进阶', '高级/专家'][difficulty] || '高级';

  // 分配各题型数量
  const perType = Math.max(1, Math.floor(count / types.length));
  const typeAlloc = types.map((t, i) => {
    const n = i === types.length - 1 ? count - perType * (types.length - 1) : perType;
    const label = t === 'single' ? '单选题' : t === 'multiple' ? '多选题' : '简答题';
    return `${label} ${n} 道`;
  }).join('，');

  return `请根据以下阿里云产品文档内容，生成 ${count} 道考试题目。

产品：${productName}
题型要求：${typeAlloc}
难度等级：${diffDesc}（${difficulty}/3）

题目应覆盖文档中的核心概念、最佳实践、架构设计和常见问题。
对于专家级难度，请侧重架构选型、性能优化、故障排查和方案对比。

===文档内容===
${content}
===文档内容结束===

请直接输出JSON数组，不要添加任何额外说明文字。`;
}

/**
 * 调用 DashScope API 生成题目
 */
async function generateQuestions(content, options) {
  const apiKey = getApiKey();

  const requestBody = {
    model: 'qwen-plus',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(content, options) }
    ],
    temperature: 0.7,
    max_tokens: 4096
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 429) {
        throw new Error('AI 服务调用频率超限，请稍后再试');
      }
      throw new Error(`DashScope API 错误 (${response.status}): ${errBody.substring(0, 200)}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('AI 未返回有效内容');
    }

    const questions = parseResponse(rawContent);
    const validated = validateQuestions(questions, options.types || ['single']);

    if (validated.length === 0) {
      throw new Error('AI 生成的题目格式无效，请重试');
    }

    return validated;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 解析 LLM 响应内容，提取 JSON 数组
 */
function parseResponse(rawContent) {
  // 尝试直接解析
  try {
    const parsed = JSON.parse(rawContent.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // 继续尝试其他方式
  }

  // 尝试从 markdown 代码块中提取
  const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // 继续
    }
  }

  // 尝试找到 [ 开始和 ] 结束的部分
  const start = rawContent.indexOf('[');
  const end = rawContent.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(rawContent.substring(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // 放弃
    }
  }

  throw new Error('无法解析 AI 返回的内容为有效 JSON');
}

/**
 * 验证题目格式
 */
function validateQuestions(questions, allowedTypes) {
  return questions.filter(q => {
    // 基本字段检查
    if (!q.type || !q.question) return false;
    if (!allowedTypes.includes(q.type)) return false;

    if (q.type === 'essay') {
      // 简答题：不需要选项和标准答案
      if (!q.explanation) return false;
      q.options = q.options || [];
      q.answer = q.answer || '';
      return true;
    }

    // 选择题检查
    if (!Array.isArray(q.options) || q.options.length < 3) return false;
    if (!q.answer) return false;

    // 验证选项格式
    const validKeys = q.options.map(o => o.key);
    if (q.options.some(o => !o.key || !o.text)) return false;

    // 验证答案在选项中
    if (q.type === 'single') {
      if (!validKeys.includes(q.answer)) return false;
    } else if (q.type === 'multiple') {
      const answers = q.answer.split(',').map(a => a.trim());
      if (answers.length < 2) return false;
      if (answers.some(a => !validKeys.includes(a))) return false;
    }

    return true;
  });
}

/**
 * 生成云产品对比报告
 */
async function generateComparisonReport(scrapeResult) {
  const apiKey = getApiKey();

  const systemPrompt = `你是一位资深云计算分析师，擅长对比分析不同云厂商的产品。你的任务是根据提供的文档和定价信息，生成客观、专业的三方结构化对比报告（阿里云、腾讯云、火山引擎）。

要求：
1. 基于提供的文档内容进行对比，同时可以结合你的专业知识补充
2. 定价对比尽量给出具体数字（如有），并注明计费模式
3. 功能对比要覆盖核心差异点，每项给出简明结论
4. 保持客观中立，不偏向任何一方
5. 如果某一方文档信息不足，可结合你的知识进行补充，但需标注
6. 输出必须是严格的JSON格式

输出JSON Schema：
{
  "summary": "一句话总结三家产品的核心差异",
  "pricing": {
    "dimensions": [
      { "name": "计费维度名称", "aliyun": "阿里云价格/模式", "tencent": "腾讯云价格/模式", "volcengine": "火山引擎价格/模式", "verdict": "结论" }
    ],
    "notes": "定价补充说明"
  },
  "features": {
    "items": [
      { "feature": "功能点", "aliyun": "阿里云支持情况", "tencent": "腾讯云支持情况", "volcengine": "火山引擎支持情况", "verdict": "结论" }
    ]
  },
  "sla_ecosystem": {
    "sla": { "aliyun": "阿里云SLA", "tencent": "腾讯云SLA", "volcengine": "火山引擎SLA" },
    "ecosystem": [
      { "aspect": "生态维度", "aliyun": "阿里云情况", "tencent": "腾讯云情况", "volcengine": "火山引擎情况", "verdict": "结论" }
    ]
  },
  "recommendation": "综合建议：适合什么场景选哪家"
}`;

  let userContent = `请对比以下三家云厂商的同类产品，生成结构化对比报告。

产品类别：${scrapeResult.category}
阿里云产品：${scrapeResult.aliyun.name}
腾讯云产品：${scrapeResult.tencent.name}
火山引擎产品：${scrapeResult.volcengine.name}

`;

  if (scrapeResult.aliyun.docContent) {
    userContent += `===阿里云产品文档===\n${scrapeResult.aliyun.docContent}\n\n`;
  }
  if (scrapeResult.aliyun.pricingContent) {
    userContent += `===阿里云定价信息===\n${scrapeResult.aliyun.pricingContent}\n\n`;
  }
  if (scrapeResult.tencent.docContent) {
    userContent += `===腾讯云产品文档===\n${scrapeResult.tencent.docContent}\n\n`;
  }
  if (scrapeResult.tencent.pricingContent) {
    userContent += `===腾讯云定价信息===\n${scrapeResult.tencent.pricingContent}\n\n`;
  }
  if (scrapeResult.volcengine.docContent) {
    userContent += `===火山引擎产品文档===\n${scrapeResult.volcengine.docContent}\n\n`;
  }
  if (scrapeResult.volcengine.pricingContent) {
    userContent += `===火山引擎定价信息===\n${scrapeResult.volcengine.pricingContent}\n\n`;
  }

  userContent += `请直接输出JSON对比报告，不要添加任何额外说明文字。要求：
- pricing.dimensions 至少5个维度
- features.items 至少6个功能点
- sla_ecosystem.ecosystem 至少3个维度
- verdict 为简短结论，如"阿里云优"、"腾讯云优"、"火山引擎优"、"三方相当"等`;

  const requestBody = {
    model: 'qwen-plus',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: 0.3,
    max_tokens: 12000
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 429) {
        throw new Error('AI 服务调用频率超限，请稍后再试');
      }
      throw new Error(`DashScope API 错误 (${response.status}): ${errBody.substring(0, 200)}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('AI 未返回有效内容');
    }

    const report = parseComparisonResponse(rawContent);
    return report;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 解析对比报告 JSON
 */
function parseComparisonResponse(rawContent) {
  // 尝试直接解析
  try {
    const parsed = JSON.parse(rawContent.trim());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch (e) { /* continue */ }

  // 从 markdown 代码块中提取
  const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) { /* continue */ }
  }

  // 提取 { 到 } 的部分
  const start = rawContent.indexOf('{');
  const end = rawContent.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(rawContent.substring(start, end + 1));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) { /* give up */ }
  }

  throw new Error('无法解析AI返回的对比报告');
}

module.exports = { generateQuestions, generateComparisonReport };
