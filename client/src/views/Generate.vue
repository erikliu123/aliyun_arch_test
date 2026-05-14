<template>
  <div class="generate-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push('/')">&larr; 返回</button>
      <span class="page-title">AI 智能出题</span>
    </div>

    <div class="content" v-if="!generating && !result">
      <!-- 输入模式切换 -->
      <div class="section">
        <div class="mode-tabs">
          <button :class="['tab', inputMode === 'product' && 'active']" @click="inputMode = 'product'">按产品名</button>
          <button :class="['tab', inputMode === 'url' && 'active']" @click="inputMode = 'url'">指定URL</button>
        </div>
      </div>

      <!-- 产品名输入 -->
      <div class="section" v-if="inputMode === 'product'">
        <label class="label">产品名称</label>
        <input v-model="productName" type="text" class="input" placeholder="例如：Flink、ECS、ACK..." />
        <div class="product-tags" v-if="products.length > 0">
          <button
            v-for="p in popularProducts"
            :key="p.key"
            :class="['product-tag', productName.toLowerCase() === p.key && 'active']"
            @click="productName = p.key"
          >{{ p.name }}</button>
        </div>
      </div>

      <!-- URL输入 -->
      <div class="section" v-else>
        <label class="label">文档URL</label>
        <input v-model="customUrl" type="url" class="input" placeholder="https://help.aliyun.com/zh/..." />
        <p class="hint">粘贴阿里云文档页面或技术博客链接</p>
      </div>

      <!-- 题型选择 -->
      <div class="section">
        <label class="label">题目类型 <span class="hint">(可多选)</span></label>
        <div class="radio-group">
          <button
            v-for="t in typeOptions"
            :key="t.value"
            :class="['radio-btn', selectedTypes.includes(t.value) && 'active']"
            @click="toggleType(t.value)"
          >{{ t.label }}</button>
        </div>
      </div>

      <!-- 数量选择 -->
      <div class="section">
        <label class="label">题目数量</label>
        <div class="radio-group">
          <button v-for="n in [5, 10, 15]" :key="n"
            :class="['radio-btn', count === n && 'active']"
            @click="count = n">{{ n }} 题</button>
        </div>
      </div>

      <!-- 难度选择 -->
      <div class="section">
        <label class="label">难度等级</label>
        <div class="radio-group">
          <button v-for="d in difficultyOptions" :key="d.value"
            :class="['radio-btn', difficulty === d.value && 'active']"
            @click="difficulty = d.value">{{ d.label }}</button>
        </div>
      </div>

      <!-- 生成按钮 -->
      <button class="btn btn-primary btn-block btn-generate" :disabled="!canGenerate" @click="handleGenerate">
        生成题目
      </button>

      <!-- 历史记录 -->
      <div class="section history-section" v-if="history.length > 0">
        <label class="label">历史生成</label>
        <div class="history-list">
          <div class="history-item" v-for="h in history" :key="h.productName" @click="startQuizFromHistory(h)">
            <span class="history-name">{{ h.categoryName }}</span>
            <span class="history-count">{{ h.count }} 题</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 生成中状态 -->
    <div class="generating-state" v-if="generating">
      <div class="spinner"></div>
      <p class="gen-status">{{ genStatus }}</p>
      <p class="gen-hint">AI 正在根据文档生成专业题目，请稍候...</p>
    </div>

    <!-- 生成结果 -->
    <div class="result-state" v-if="result">
      <div class="result-header">
        <h3>生成完成</h3>
        <p class="result-meta">{{ result.categoryName }} - {{ result.generated }} 道题</p>
      </div>

      <div class="result-preview">
        <div class="preview-item" v-for="(q, i) in result.questions" :key="i">
          <span class="preview-num">{{ i + 1 }}.</span>
          <span class="preview-type" :class="q.type">{{ typeLabel(q.type) }}</span>
          <span class="preview-text">{{ q.question.substring(0, 50) }}{{ q.question.length > 50 ? '...' : '' }}</span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn btn-primary btn-block" @click="startQuiz">开始答题</button>
        <button class="btn btn-secondary btn-block" @click="resetForm">继续生成</button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div class="error-toast" v-if="errorMsg">
      <p>{{ errorMsg }}</p>
      <button @click="errorMsg = ''">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/api.js'

const router = useRouter()

const inputMode = ref('product')
const productName = ref('')
const customUrl = ref('')
const selectedTypes = ref(['single'])
const count = ref(10)
const difficulty = ref(3)

const generating = ref(false)
const genStatus = ref('')
const result = ref(null)
const errorMsg = ref('')

const products = ref([])
const history = ref([])

const typeOptions = [
  { value: 'single', label: '单选题' },
  { value: 'multiple', label: '多选题' },
  { value: 'essay', label: '简答题' }
]

const difficultyOptions = [
  { value: 1, label: '基础' },
  { value: 2, label: '进阶' },
  { value: 3, label: '专家' }
]

const popularProducts = computed(() => {
  return products.value.slice(0, 12)
})

const canGenerate = computed(() => {
  if (selectedTypes.value.length === 0) return false
  if (inputMode.value === 'product') return productName.value.trim().length > 0
  return customUrl.value.trim().length > 0
})

onMounted(async () => {
  try {
    const [prodData, histData] = await Promise.all([
      api.get('/generate/products'),
      api.get('/generate/history')
    ])
    products.value = prodData.products || []
    history.value = histData.history || []
  } catch (e) {
    // 非关键错误，静默处理
  }
})

async function handleGenerate() {
  generating.value = true
  genStatus.value = '正在抓取文档内容...'
  errorMsg.value = ''

  try {
    // 短暂延迟让用户看到状态变化
    await new Promise(r => setTimeout(r, 500))
    genStatus.value = 'AI 正在生成题目...'

    const body = {
      types: selectedTypes.value,
      count: count.value,
      difficulty: difficulty.value
    }

    if (inputMode.value === 'product') {
      body.productName = productName.value.trim()
    } else {
      body.url = customUrl.value.trim()
      body.productName = ''
    }

    const data = await api.post('/generate', body, { timeout: 90000 })
    result.value = data

    // 刷新历史
    const histData = await api.get('/generate/history')
    history.value = histData.history || []
  } catch (e) {
    errorMsg.value = e.error || e.message || '生成失败，请稍后重试'
  } finally {
    generating.value = false
  }
}

function toggleType(val) {
  const idx = selectedTypes.value.indexOf(val)
  if (idx >= 0) {
    if (selectedTypes.value.length > 1) {
      selectedTypes.value.splice(idx, 1)
    }
  } else {
    selectedTypes.value.push(val)
  }
}
function startQuiz() {
  if (result.value) {
    router.push({
      path: '/quiz',
      query: {
        mode: 'generated',
        category: result.value.category,
        count: result.value.generated
      }
    })
  }
}

function startQuizFromHistory(h) {
  router.push({
    path: '/quiz',
    query: {
      mode: 'generated',
      category: h.category,
      count: h.count
    }
  })
}

function resetForm() {
  result.value = null
}

function typeLabel(type) {
  if (type === 'single') return '单选'
  if (type === 'multiple') return '多选'
  if (type === 'essay') return '简答'
  return type
}
</script>

<style scoped>
.generate-page {
  min-height: 100vh;
  background: var(--bg);
}

.page-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid var(--border);
}

.back-btn {
  background: none;
  color: var(--text-secondary);
  font-size: 15px;
  padding: 4px 0;
  margin-right: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
}

.content {
  padding: 16px;
}

.section {
  margin-bottom: 20px;
}

.label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.mode-tabs {
  display: flex;
  background: var(--bg);
  border-radius: var(--radius-sm);
  padding: 3px;
  border: 1px solid var(--border);
}

.tab {
  flex: 1;
  padding: 8px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.tab.active {
  background: #fff;
  color: var(--primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.input {
  width: 100%;
  padding: 12px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 15px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--primary);
}

.hint {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 6px;
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.product-tag {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 13px;
  background: #F5F5F5;
  color: var(--text-secondary);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.product-tag.active {
  background: var(--primary-bg);
  color: var(--primary);
  border-color: var(--primary);
}

.checkbox-group {
  display: flex;
  gap: 16px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}

.radio-group {
  display: flex;
  gap: 10px;
}

.radio-btn {
  flex: 1;
  padding: 10px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  background: #fff;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.radio-btn.active {
  border-color: var(--primary);
  background: var(--primary-bg);
  color: var(--primary);
}

.btn-generate {
  margin-top: 24px;
  padding: 14px;
  font-size: 16px;
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #fff;
  color: var(--text-secondary);
  border: 1.5px solid var(--border);
  margin-top: 10px;
}

.history-section {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #fff;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  cursor: pointer;
}

.history-item:active {
  background: var(--primary-bg);
}

.history-name {
  font-size: 14px;
  font-weight: 500;
}

.history-count {
  font-size: 13px;
  color: var(--text-hint);
}

/* 生成中状态 */
.generating-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.gen-status {
  margin-top: 20px;
  font-size: 16px;
  font-weight: 500;
  color: var(--primary);
}

.gen-hint {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-hint);
}

/* 结果状态 */
.result-state {
  padding: 16px;
}

.result-header {
  text-align: center;
  padding: 20px 0;
}

.result-header h3 {
  font-size: 20px;
  color: var(--primary);
}

.result-meta {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.result-preview {
  background: #fff;
  border-radius: var(--radius);
  padding: 12px;
  margin-bottom: 20px;
  max-height: 300px;
  overflow-y: auto;
}

.preview-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-num {
  color: var(--text-hint);
  flex-shrink: 0;
}

.preview-type {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

.preview-type.single {
  background: #E3F2FD;
  color: #1565C0;
}

.preview-type.multiple {
  background: #FFF3E0;
  color: #E65100;
}

.preview-type.essay {
  background: #E8F5E9;
  color: #2E7D32;
}

.preview-text {
  color: var(--text-primary);
  line-height: 1.4;
}

.result-actions {
  padding: 0 0 20px;
}

/* 错误提示 */
.error-toast {
  position: fixed;
  bottom: 80px;
  left: 16px;
  right: 16px;
  background: #FFF3F3;
  border: 1px solid #FFCDD2;
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
}

.error-toast p {
  font-size: 14px;
  color: #C62828;
}

.error-toast button {
  background: none;
  color: #C62828;
  font-size: 13px;
  font-weight: 500;
}
</style>
