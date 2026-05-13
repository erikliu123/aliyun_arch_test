<template>
  <div class="page stats-page">
    <h2 class="page-title">学习统计</h2>

    <div class="loading" v-if="loading">加载中...</div>

    <template v-else>
      <!-- 总览 -->
      <div class="card overview-card">
        <div class="stat-grid">
          <div class="stat-box">
            <span class="stat-num">{{ overview.uniqueQuestions }}</span>
            <span class="stat-desc">已做题目</span>
          </div>
          <div class="stat-box">
            <span class="stat-num">{{ overview.totalAnswered }}</span>
            <span class="stat-desc">总答题次数</span>
          </div>
          <div class="stat-box">
            <span class="stat-num accent">{{ overview.accuracy }}%</span>
            <span class="stat-desc">总正确率</span>
          </div>
          <div class="stat-box">
            <span class="stat-num danger">{{ overview.wrongCount }}</span>
            <span class="stat-desc">当前错题</span>
          </div>
        </div>
      </div>

      <!-- 分类正确率 -->
      <div class="section-title">分类正确率</div>
      <div class="card">
        <div class="cat-stat" v-for="cat in categoryStats" :key="cat.category">
          <div class="cat-info">
            <span class="cat-name">{{ cat.name }}</span>
            <span class="cat-detail">
              {{ cat.accuracy !== null ? cat.accuracy + '%' : '未答题' }}
              <span class="cat-count" v-if="cat.answered > 0">
                ({{ cat.correct }}/{{ cat.answered }})
              </span>
            </span>
          </div>
          <div class="cat-bar-track">
            <div
              class="cat-bar-fill"
              :style="{ width: (cat.accuracy || 0) + '%' }"
              :class="barClass(cat.accuracy)"
            ></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../utils/api.js'

const loading = ref(true)
const overview = ref({})
const categoryStats = ref([])

onMounted(async () => {
  try {
    const [overviewData, catData] = await Promise.all([
      api.get('/stats/overview'),
      api.get('/stats/by-category')
    ])
    overview.value = overviewData
    categoryStats.value = catData.categories
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})

function barClass(accuracy) {
  if (accuracy === null) return ''
  if (accuracy >= 80) return 'bar-good'
  if (accuracy >= 60) return 'bar-ok'
  return 'bar-bad'
}
</script>

<style scoped>
.page-title {
  font-size: 20px;
  margin-bottom: 16px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--text-hint);
}

.overview-card {
  margin-bottom: 20px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stat-box {
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
}

.stat-num.accent {
  color: var(--primary);
}

.stat-num.danger {
  color: var(--danger);
}

.stat-desc {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 2px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}

.cat-stat {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.cat-stat:last-child {
  border-bottom: none;
}

.cat-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.cat-name {
  font-size: 14px;
  font-weight: 500;
}

.cat-detail {
  font-size: 13px;
  color: var(--text-secondary);
}

.cat-count {
  color: var(--text-hint);
  font-size: 12px;
}

.cat-bar-track {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.cat-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.bar-good { background: var(--success); }
.bar-ok { background: var(--primary); }
.bar-bad { background: var(--danger); }
</style>
