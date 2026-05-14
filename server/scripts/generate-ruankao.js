/**
 * 软考高级架构师题目批量生成脚本
 * 
 * 使用 DashScope API 根据考纲知识点文件为每个知识域生成练习题
 * 
 * 用法: node server/scripts/generate-ruankao.js [--domain SA_ARCH] [--count 30]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');

const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const API_KEY = process.env.DASHSCOPE_API_KEY;

if (!API_KEY) {
  console.error('错误: 未配置 DASHSCOPE_API_KEY');
  process.exit(1);
}

// 知识域配置
const DOMAINS = [
  { code: 'SA_ARCH', name: '系统架构设计', count: 45, essayCount: 5 },
  { code: 'SA_SE', name: '软件工程', count: 35, essayCount: 3 },
  { code: 'SA_DB', name: '数据库系统', count: 25, essayCount: 3 },
  { code: 'SA_NET', name: '计算机网络', count: 20, essayCount: 0 },
  { code: 'SA_OS', name: '操作系统', count: 18, essayCount: 0 },
  { code: 'SA_SECURITY', name: '信息安全', count: 25, essayCount: 3 },
  { code: 'SA_PATTERN', name: '设计模式', count: 30, essayCount: 3 },
  { code: 'SA_OOP', name: '面向对象技术', count: 25, essayCount: 3 },
  { code: 'SA_RELIABILITY', name: '可靠性与系统设计', count: 18, essayCount: 2 },
  { code: 'SA_PM', name: '项目管理', count: 15, essayCount: 0 },
  { code: 'SA_LAW', name: '知识产权与法规', count: 12, essayCount: 0 },
  { code: 'SA_MATH', name: '数学与经济管理', count: 12, essayCount: 0 },
  { code: 'SA_ENGLISH', name: '专业英语', count: 10, essayCount: 0 }
];

const SYLLABUS_DIR = path.join(__dirname, '..', 'data', 'ruankao-syllabus');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'ruankao-questions.json');

/**
 * 构建软考专用系统 prompt
 */
function buildSystemPrompt(type) {
  if (type === 'essay') {
    return `你是一位全国软件水平考试（软考）高级系统架构设计师考试的资深命题专家。你需要根据提供的考纲知识点，出案例分析/简答题。

要求：
1. 题目应贴近软考真题风格，考查深层理解和实际应用能力
2. 案例题通常给出一个项目场景，然后提出2-3个问题
3. 参考答案要详尽、有条理，涵盖得分要点
4. 难度等级3（高级），符合系统架构设计师考试水平
5. 输出必须是严格的JSON数组格式

输出格式：
[
  {
    "type": "essay",
    "question": "【案例背景】某互联网公司...\n\n问题1：...\n问题2：...\n问题3：...",
    "options": [],
    "answer": "",
    "explanation": "【问题1参考答案】...\n\n【问题2参考答案】...\n\n【问题3参考答案】..."
  }
]`;
  }

  return `你是一位全国软件水平考试（软考）高级系统架构设计师考试的资深命题专家。你需要根据提供的考纲知识点，出高质量的综合知识选择题。

要求：
1. 题目风格应贴近历年软考真题，考查核心概念和理解深度
2. 四个选项都要有一定的合理性和迷惑性，避免一眼看出答案
3. 解析要清晰说明正确答案的原因，并简要指出其他选项为什么不对
4. 每道题只有一个正确答案
5. 难度应为中等偏上（难度2-3），符合上午综合知识科目水平
6. 输出必须是严格的JSON数组格式，不要包含任何额外文字

输出格式：
[
  {
    "type": "single",
    "question": "关于软件架构评估方法，以下说法正确的是（）。",
    "options": [
      {"key": "A", "text": "选项A内容"},
      {"key": "B", "text": "选项B内容"},
      {"key": "C", "text": "选项C内容"},
      {"key": "D", "text": "选项D内容"}
    ],
    "answer": "B",
    "explanation": "解析：..."
  }
]`;
}

/**
 * 调用 DashScope API
 */
async function callAI(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 8192
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API 错误 (${response.status}): ${err.substring(0, 200)}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('AI 未返回内容');
    return raw;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 解析 AI 响应为 JSON 数组
 */
function parseResponse(raw) {
  // 直接解析
  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}

  // markdown 代码块
  const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }

  // 提取 [ ... ]
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.substring(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }

  throw new Error('无法解析 AI 返回内容');
}

/**
 * 验证选择题格式
 */
function validateSingle(q) {
  if (q.type !== 'single') return false;
  if (!q.question || !q.answer || !q.explanation) return false;
  if (!Array.isArray(q.options) || q.options.length < 4) return false;
  const keys = q.options.map(o => o.key);
  if (!keys.includes(q.answer)) return false;
  return true;
}

/**
 * 验证案例分析题格式
 */
function validateEssay(q) {
  if (q.type !== 'essay') return false;
  if (!q.question || !q.explanation) return false;
  return true;
}

/**
 * 为单个知识域生成题目
 */
async function generateForDomain(domain) {
  const syllabusFile = path.join(SYLLABUS_DIR, `${domain.code}.txt`);
  if (!fs.existsSync(syllabusFile)) {
    console.error(`  [跳过] 考纲文件不存在: ${syllabusFile}`);
    return [];
  }

  const syllabus = fs.readFileSync(syllabusFile, 'utf-8');
  const questions = [];

  // 生成选择题（分批，每批15题）
  const batchSize = 15;
  const batches = Math.ceil(domain.count / batchSize);

  for (let i = 0; i < batches; i++) {
    const thisCount = Math.min(batchSize, domain.count - i * batchSize);
    console.log(`  选择题 batch ${i + 1}/${batches} (${thisCount}题)...`);

    const userPrompt = `请根据以下考纲知识点，生成 ${thisCount} 道软考高级系统架构设计师综合知识选择题。

知识域：${domain.name}
要求覆盖考纲中的不同知识点，避免集中在同一个小节。

===考纲知识点===
${syllabus}
===考纲结束===

请直接输出JSON数组，每题包含 type, question, options, answer, explanation 字段。`;

    try {
      const raw = await callAI(buildSystemPrompt('single'), userPrompt);
      const parsed = parseResponse(raw);
      const valid = parsed.filter(validateSingle);
      questions.push(...valid);
      console.log(`    成功: ${valid.length}/${parsed.length} 题有效`);
    } catch (e) {
      console.error(`    失败: ${e.message}`);
    }

    // 避免 API 限频
    await sleep(2000);
  }

  // 生成案例分析题
  if (domain.essayCount > 0) {
    console.log(`  案例分析题 (${domain.essayCount}题)...`);
    const userPrompt = `请根据以下考纲知识点，生成 ${domain.essayCount} 道软考高级系统架构设计师案例分析/简答题。

知识域：${domain.name}
每道题应给出一个具体的技术场景，提出2-3个分析问题。

===考纲知识点===
${syllabus}
===考纲结束===

请直接输出JSON数组。`;

    try {
      const raw = await callAI(buildSystemPrompt('essay'), userPrompt);
      const parsed = parseResponse(raw);
      const valid = parsed.filter(validateEssay);
      questions.push(...valid);
      console.log(`    成功: ${valid.length}/${parsed.length} 题有效`);
    } catch (e) {
      console.error(`    失败: ${e.message}`);
    }

    await sleep(2000);
  }

  // 为每道题添加元信息
  const timestamp = Date.now();
  return questions.map((q, idx) => ({
    id: `sa-${domain.code.toLowerCase()}-${timestamp}-${String(idx + 1).padStart(3, '0')}`,
    category: domain.code,
    categoryName: domain.name,
    difficulty: q.type === 'essay' ? 3 : 2,
    ...q
  }));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 主函数
 */
async function main() {
  console.log('=== 软考高级架构师题库生成 ===\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  let targetDomain = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--domain' && args[i + 1]) {
      targetDomain = args[i + 1].toUpperCase();
      i++;
    }
  }

  const domainsToGenerate = targetDomain
    ? DOMAINS.filter(d => d.code === targetDomain)
    : DOMAINS;

  if (domainsToGenerate.length === 0) {
    console.error(`未找到知识域: ${targetDomain}`);
    console.log('可用知识域:', DOMAINS.map(d => d.code).join(', '));
    process.exit(1);
  }

  // 加载已有题库（增量生成）
  let existingQuestions = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    existingQuestions = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`已有题库: ${existingQuestions.length} 道题`);

    // 如果指定了单个 domain，则移除该 domain 旧题目
    if (targetDomain) {
      existingQuestions = existingQuestions.filter(q => q.category !== targetDomain);
      console.log(`移除 ${targetDomain} 旧题后: ${existingQuestions.length} 道题`);
    }
  }

  const allQuestions = [...existingQuestions];

  for (const domain of domainsToGenerate) {
    console.log(`\n[${domain.code}] ${domain.name} (目标: ${domain.count}选择 + ${domain.essayCount}案例)`);
    const questions = await generateForDomain(domain);
    allQuestions.push(...questions);
    console.log(`  完成: 新增 ${questions.length} 道题`);
  }

  // 保存题库
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allQuestions, null, 2), 'utf-8');
  console.log(`\n=== 生成完毕 ===`);
  console.log(`总计: ${allQuestions.length} 道题`);
  console.log(`文件: ${OUTPUT_FILE}`);

  // 打印各域统计
  const stats = {};
  for (const q of allQuestions) {
    if (!stats[q.category]) stats[q.category] = { single: 0, essay: 0 };
    if (q.type === 'essay') stats[q.category].essay++;
    else stats[q.category].single++;
  }
  console.log('\n各知识域统计:');
  for (const [code, s] of Object.entries(stats)) {
    console.log(`  ${code}: 选择${s.single}题 + 案例${s.essay}题`);
  }
}

main().catch(e => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});
