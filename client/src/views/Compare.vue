<template>
  <div class="page compare-page">
    <h2 class="page-title">云产品对比</h2>
    <p class="page-desc">选择产品，自动对比阿里云 vs 腾讯云的定价、功能和生态</p>

    <!-- 产品选择 -->
    <div v-if="!report && !loading" class="product-grid">
      <button
        v-for="p in products"
        :key="p.key"
        class="product-card"
        @click="selectProduct(p)"
      >
        <span class="product-category">{{ p.category }}</span>
        <span class="product-vs">{{ p.aliyunName }} <span class="vs-tag">VS</span> {{ p.tencentName }}</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-section">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingText }}</p>
      <p class="loading-hint">首次生成需要 30-60 秒，请耐心等待</p>
    </div>

    <!-- 报告展示 -->
    <div v-if="report && !loading" class="report-section">
      <div class="report-header">
        <div class="report-title-row">
          <h3>{{ selectedProduct.aliyunName }} vs {{ selectedProduct.tencentName }}</h3>
          <button class="back-btn" @click="resetReport">返回选择</button>
        </div>
        <p class="report-summary">{{ report.summary }}</p>
        <div class="report-meta" v-if="reportMeta">
          <span v-if="reportMeta.cached" class="cache-tag">缓存</span>
          <span class="meta-time">{{ formatTime(reportMeta.generated_at) }}</span>
        </div>
      </div>

      <!-- Tab 切换 -->
      <div class="tab-row">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >{{ tab.label }}</button>
      </div>

      <!-- 定价对比 -->
      <div v-if="activeTab === 'pricing'" class="tab-content">
        <div class="compare-table">
          <div class="table-header">
            <span class="col-name">计费维度</span>
            <span class="col-aliyun">阿里云</span>
            <span class="col-tencent">腾讯云</span>
            <span class="col-verdict">结论</span>
          </div>
          <div
            v-for="(item, idx) in report.pricing?.dimensions || []"
            :key="idx"
            class="table-row"
          >
            <span class="col-name">{{ item.name }}</span>
            <span class="col-aliyun">{{ item.aliyun }}</span>
            <span class="col-tencent">{{ item.tencent }}</span>
            <span :class="['col-verdict', verdictClass(item.verdict)]">{{ item.verdict }}</span>
          </div>
        </div>
        <p v-if="report.pricing?.notes" class="section-notes">{{ report.pricing.notes }}</p>
      </div>

      <!-- 功能特性 -->
      <div v-if="activeTab === 'features'" class="tab-content">
        <div class="compare-table">
          <div class="table-header">
            <span class="col-name">功能点</span>
            <span class="col-aliyun">阿里云</span>
            <span class="col-tencent">腾讯云</span>
            <span class="col-verdict">结论</span>
          </div>
          <div
            v-for="(item, idx) in report.features?.items || []"
            :key="idx"
            class="table-row"
          >
            <span class="col-name">{{ item.feature }}</span>
            <span class="col-aliyun">{{ item.aliyun }}</span>
            <span class="col-tencent">{{ item.tencent }}</span>
            <span :class="['col-verdict', verdictClass(item.verdict)]">{{ item.verdict }}</span>
          </div>
        </div>
      </div>

      <!-- SLA与生态 -->
      <div v-if="activeTab === 'sla'" class="tab-content">
        <div class="sla-block" v-if="report.sla_ecosystem?.sla">
          <h4>SLA 可用性</h4>
          <div class="sla-row">
            <div class="sla-item aliyun">
              <span class="sla-label">阿里云</span>
              <span class="sla-value">{{ report.sla_ecosystem.sla.aliyun }}</span>
            </div>
            <div class="sla-item tencent">
              <span class="sla-label">腾讯云</span>
              <span class="sla-value">{{ report.sla_ecosystem.sla.tencent }}</span>
            </div>
          </div>
        </div>
        <div class="compare-table" v-if="report.sla_ecosystem?.ecosystem?.length">
          <div class="table-header">
            <span class="col-name">生态维度</span>
            <span class="col-aliyun">阿里云</span>
            <span class="col-tencent">腾讯云</span>
            <span class="col-verdict">结论</span>
          </div>
          <div
            v-for="(item, idx) in report.sla_ecosystem.ecosystem"
            :key="idx"
            class="table-row"
          >
            <span class="col-name">{{ item.aspect }}</span>
            <span class="col-aliyun">{{ item.aliyun }}</span>
            <span class="col-tencent">{{ item.tencent }}</span>
            <span :class="['col-verdict', verdictClass(item.verdict)]">{{ item.verdict }}</span>
          </div>
        </div>
      </div>

      <!-- 综合建议 -->
      <div v-if="report.recommendation" class="recommendation-block">
        <h4>综合建议</h4>
        <p>{{ report.recommendation }}</p>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-block">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="error = ''">确定</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../utils/api.js'

const products = ref([])
const selectedProduct = ref(null)
const loading = ref(false)
const loadingText = ref('')
const report = ref(null)
const reportMeta = ref(null)
const activeTab = ref('pricing')
const error = ref('')

const tabs = [
  { key: 'pricing', label: '定价对比' },
  { key: 'features', label: '功能特性' },
  { key: 'sla', label: 'SLA与生态' }
]

onMounted(async () => {
  try {
    const data = await api.get('/compare/products')
    products.value = data.products
  } catch (e) {
    error.value = e.error || '获取产品列表失败'
  }
})

async function selectProduct(product) {
  selectedProduct.value = product
  loading.value = true
  error.value = ''
  report.value = null

  const steps = [
    '正在抓取阿里云文档...',
    '正在抓取腾讯云文档...',
    '正在分析对比数据...',
    '正在生成对比报告...'
  ]

  let stepIdx = 0
  loadingText.value = steps[0]
  const interval = setInterval(() => {
    stepIdx++
    if (stepIdx < steps.length) {
      loadingText.value = steps[stepIdx]
    }
  }, 8000)

  try {
    const data = await api.post('/compare/generate', { productKey: product.key }, { timeout: 120000 })
    report.value = data.report
    reportMeta.value = { cached: data.cached, generated_at: data.generated_at }
    activeTab.value = 'pricing'
  } catch (e) {
    error.value = e.error || '报告生成失败，请稍后重试'
    selectedProduct.value = null
  } finally {
    loading.value = false
    clearInterval(interval)
  }
}

function resetReport() {
  report.value = null
  reportMeta.value = null
  selectedProduct.value = null
  activeTab.value = 'pricing'
}

function verdictClass(verdict) {
  if (!verdict) return ''
  if (verdict.includes('阿里云')) return 'verdict-aliyun'
  if (verdict.includes('腾讯云')) return 'verdict-tencent'
  return 'verdict-equal'
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
</script>

<style scoped>
.compare-page {
  padding-top: 20px;
  padding-bottom: 80px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 4px;
}

.page-desc {
  font-size: 13px;
  color: var(--text-hint);
  margin-bottom: 20px;
}

.product-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.product-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: var(--card);
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.product-card:active {
  transform: scale(0.97);
  border-color: var(--primary);
}

.product-category {
  font-size: 12px;
  color: var(--text-hint);
}

.product-vs {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.vs-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  padding: 1px 6px;
  border-radius: 4px;
  margin: 0 4px;
  vertical-align: middle;
}

.loading-section {
  text-align: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.loading-hint {
  font-size: 13px;
  color: var(--text-hint);
}

.report-section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.report-header {
  margin-bottom: 16px;
}

.report-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.report-title-row h3 {
  font-size: 16px;
  font-weight: 700;
}

.back-btn {
  font-size: 13px;
  color: var(--primary);
  background: none;
  border: 1px solid var(--primary);
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
}

.report-summary {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.report-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.cache-tag {
  font-size: 11px;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 4px;
}

.meta-time {
  font-size: 12px;
  color: var(--text-hint);
}

.tab-row {
  display: flex;
  gap: 0;
  border-bottom: 1.5px solid var(--border);
  margin-bottom: 16px;
}

.tab-btn {
  flex: 1;
  padding: 10px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-hint);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}

.compare-table {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 12px;
}

.table-header {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1.5fr 0.8fr;
  padding: 10px 12px;
  background: var(--bg);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.table-row {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1.5fr 0.8fr;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  line-height: 1.4;
}

.table-row:last-child {
  border-bottom: none;
}

.col-name {
  font-weight: 500;
}

.col-verdict {
  font-weight: 600;
  font-size: 11px;
}

.verdict-aliyun {
  color: var(--primary);
}

.verdict-tencent {
  color: #1976d2;
}

.verdict-equal {
  color: var(--text-hint);
}

.section-notes {
  font-size: 12px;
  color: var(--text-hint);
  padding: 8px 12px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  line-height: 1.5;
}

.sla-block {
  margin-bottom: 16px;
}

.sla-block h4 {
  font-size: 14px;
  margin-bottom: 10px;
}

.sla-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.sla-item {
  padding: 12px;
  border-radius: var(--radius);
  text-align: center;
}

.sla-item.aliyun {
  background: #fff8f0;
  border: 1px solid #ffe0b2;
}

.sla-item.tencent {
  background: #f0f7ff;
  border: 1px solid #bbdefb;
}

.sla-label {
  display: block;
  font-size: 12px;
  color: var(--text-hint);
  margin-bottom: 4px;
}

.sla-value {
  display: block;
  font-size: 14px;
  font-weight: 600;
}

.recommendation-block {
  margin-top: 20px;
  padding: 14px 16px;
  background: var(--primary-bg);
  border: 1px solid var(--primary);
  border-radius: var(--radius);
}

.recommendation-block h4 {
  font-size: 14px;
  color: var(--primary);
  margin-bottom: 6px;
}

.recommendation-block p {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
}

.error-block {
  text-align: center;
  padding: 30px 20px;
  background: #fff3e0;
  border-radius: var(--radius);
  margin-top: 20px;
}

.error-block p {
  font-size: 14px;
  color: var(--danger);
  margin-bottom: 12px;
}

.retry-btn {
  padding: 8px 20px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
}
</style>
