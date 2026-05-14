<template>
  <div class="page ruankao-page">
    <div class="header">
      <button class="back-btn" @click="router.push('/')">&#8592;</button>
      <h1>软考高级架构师</h1>
    </div>

    <div class="card intro">
      <p>系统架构设计师（高级）专项练习，覆盖 12 个核心知识域，共 <strong>{{ totalCount }}</strong> 道题。</p>
    </div>

    <div class="section-title">知识域列表</div>
    <div class="domain-list">
      <button
        v-for="domain in domains"
        :key="domain.key"
        class="card domain-card"
        @click="startDomain(domain.key)"
      >
        <div class="domain-info">
          <span class="domain-name">{{ domain.name }}</span>
          <span class="domain-count">{{ domain.count }} 题</span>
        </div>
        <span class="domain-arrow">&#8250;</span>
      </button>
    </div>

    <div class="action-row">
      <button class="btn-primary" @click="startAll">全部随机练习</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/api.js'

const router = useRouter()
const categories = ref([])

const domainMap = {
  SA_ARCH: '系统架构设计',
  SA_PATTERN: '设计模式',
  SA_SE: '软件工程',
  SA_DB: '数据库系统',
  SA_SECURITY: '信息安全',
  SA_OOP: '面向对象技术',
  SA_NET: '计算机网络',
  SA_OS: '操作系统',
  SA_RELIABILITY: '系统可靠性',
  SA_PM: '项目管理',
  SA_LAW: '知识产权与法规',
  SA_MATH: '数学与经济管理',
  SA_ENGLISH: '专业英语'
}

const domains = computed(() => {
  return categories.value
    .filter(c => c.key.startsWith('SA_'))
    .map(c => ({ key: c.key, name: domainMap[c.key] || c.name, count: c.count }))
    .sort((a, b) => b.count - a.count)
})

const totalCount = computed(() => domains.value.reduce((s, d) => s + d.count, 0))

onMounted(async () => {
  try {
    const data = await api.get('/questions/categories')
    categories.value = data.categories
  } catch (e) {
    console.error(e)
  }
})

function startDomain(key) {
  router.push({ path: '/quiz', query: { mode: 'sequential', category: key, count: 20 } })
}

function startAll() {
  const saKeys = domains.value.map(d => d.key).join(',')
  router.push({ path: '/quiz', query: { mode: 'random', category: saKeys, count: 20 } })
}
</script>

<style scoped>
.ruankao-page {
  padding-top: 20px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.header h1 {
  font-size: 18px;
  color: #e65100;
}

.back-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-secondary);
}

.intro {
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.intro strong {
  color: #e65100;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}

.domain-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.domain-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  border: none;
  text-align: left;
  transition: transform 0.15s;
}

.domain-card:active {
  transform: scale(0.98);
}

.domain-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.domain-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.domain-count {
  font-size: 12px;
  color: var(--text-hint);
}

.domain-arrow {
  font-size: 20px;
  color: var(--text-hint);
}

.action-row {
  margin-top: 20px;
  padding-bottom: 20px;
}

.btn-primary {
  width: 100%;
  height: 44px;
  border-radius: var(--radius);
  background: #e65100;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:active {
  opacity: 0.8;
}
</style>
