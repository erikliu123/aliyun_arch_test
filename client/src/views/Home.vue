<template>
  <div class="page home-page">
    <div class="header">
      <h1>阿里云答题通</h1>
      <div class="user-info">
        <span>{{ userStore.user?.username }}</span>
        <button class="logout-btn" @click="handleLogout">退出</button>
      </div>
    </div>

    <!-- 快速概览 -->
    <div class="card overview" v-if="stats">
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-value">{{ stats.uniqueQuestions }}</span>
          <span class="stat-label">已做题</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.accuracy }}%</span>
          <span class="stat-label">正确率</span>
        </div>
        <div class="stat-item">
          <span class="stat-value danger">{{ stats.wrongCount }}</span>
          <span class="stat-label">错题</span>
        </div>
      </div>
    </div>

    <!-- 答题模式 -->
    <div class="section-title">选择模式</div>
    <div class="mode-grid">
      <button class="card mode-card" @click="startQuiz('sequential')">
        <span class="mode-icon">&#9776;</span>
        <span class="mode-name">顺序答题</span>
        <span class="mode-desc">按分类逐题练习</span>
      </button>
      <button class="card mode-card" @click="startQuiz('random')">
        <span class="mode-icon">&#9858;</span>
        <span class="mode-name">随机答题</span>
        <span class="mode-desc">随机抽取练习</span>
      </button>
    </div>
    <button class="card mode-card-wide" @click="startQuiz('wrong')" :disabled="!stats || stats.wrongCount === 0">
      <span class="mode-icon">&#10007;</span>
      <div>
        <span class="mode-name">错题重练</span>
        <span class="mode-desc">{{ stats ? stats.wrongCount : 0 }} 道错题</span>
      </div>
    </button>

    <button class="card mode-card-wide ai-card" @click="router.push('/generate')">
      <span class="mode-icon">&#9889;</span>
      <div>
        <span class="mode-name">AI 智能出题</span>
        <span class="mode-desc">根据阿里云文档自动生成题目</span>
      </div>
    </button>

    <button class="card mode-card-wide compare-card" @click="router.push('/compare')">
      <span class="mode-icon">&#9878;</span>
      <div>
        <span class="mode-name">云产品对比</span>
        <span class="mode-desc">阿里云 vs 腾讯云 定价/功能/生态对比</span>
      </div>
    </button>

    <!-- 分类选择 -->
    <div class="section-title">选择分类 <span class="hint">(可选)</span></div>
    <div class="category-scroll">
      <button
        :class="['cat-tag', { active: selectedCategory === '' }]"
        @click="selectedCategory = ''"
      >全部</button>
      <button
        v-for="cat in categories"
        :key="cat.key"
        :class="['cat-tag', { active: selectedCategory === cat.key }]"
        @click="selectedCategory = cat.key"
      >{{ cat.name }} ({{ cat.count }})</button>
    </div>

    <!-- 题数选择 -->
    <div class="section-title" v-if="selectedMode !== 'wrong'">答题数量</div>
    <div class="count-row" v-if="selectedMode !== 'wrong'">
      <button
        v-for="n in [10, 20, 30]"
        :key="n"
        :class="['count-btn', { active: quizCount === n }]"
        @click="quizCount = n"
      >{{ n }} 题</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.js'
import api from '../utils/api.js'

const router = useRouter()
const userStore = useUserStore()

const stats = ref(null)
const categories = ref([])
const selectedCategory = ref('')
const selectedMode = ref('random')
const quizCount = ref(10)

onMounted(async () => {
  try {
    const [statsData, catData] = await Promise.all([
      api.get('/stats/overview'),
      api.get('/questions/categories')
    ])
    stats.value = statsData
    categories.value = catData.categories
  } catch (e) {
    console.error(e)
  }
})

function startQuiz(mode) {
  selectedMode.value = mode
  const query = { mode }
  if (selectedCategory.value) query.category = selectedCategory.value
  if (mode !== 'wrong') query.count = quizCount.value
  router.push({ path: '/quiz', query })
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.home-page {
  padding-top: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h1 {
  font-size: 20px;
  color: var(--primary);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.logout-btn {
  background: none;
  color: var(--text-hint);
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.overview {
  margin-bottom: 20px;
}

.stat-row {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--primary);
}

.stat-value.danger {
  color: var(--danger);
}

.stat-label {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 2px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  margin-top: 20px;
}

.section-title .hint {
  color: var(--text-hint);
  font-weight: 400;
  font-size: 13px;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.mode-card {
  text-align: center;
  padding: 20px 12px;
  cursor: pointer;
  border: none;
  transition: transform 0.15s;
}

.mode-card:active {
  transform: scale(0.97);
}

.mode-card-wide {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px;
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  cursor: pointer;
  border: none;
  text-align: left;
  transition: transform 0.15s;
}

.mode-card-wide:active:not(:disabled) {
  transform: scale(0.97);
}

.mode-card-wide:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ai-card {
  margin-top: 12px;
  border: 1.5px solid var(--primary);
  background: var(--primary-bg);
}

.ai-card .mode-name {
  color: var(--primary);
}

.compare-card {
  margin-top: 12px;
  border: 1.5px solid #1976d2;
  background: #f0f7ff;
}

.compare-card .mode-name {
  color: #1976d2;
}

.mode-icon {
  font-size: 28px;
  display: block;
  margin-bottom: 6px;
}

.mode-name {
  display: block;
  font-size: 15px;
  font-weight: 600;
}

.mode-desc {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 2px;
  display: block;
}

.category-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.cat-tag {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  background: var(--card);
  color: var(--text-secondary);
  border: 1.5px solid var(--border);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.cat-tag.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.count-row {
  display: flex;
  gap: 10px;
}

.count-btn {
  flex: 1;
  height: 40px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--card);
  color: var(--text-secondary);
  border: 1.5px solid var(--border);
  cursor: pointer;
  transition: all 0.2s;
}

.count-btn.active {
  background: var(--primary-bg);
  color: var(--primary);
  border-color: var(--primary);
  font-weight: 600;
}
</style>
