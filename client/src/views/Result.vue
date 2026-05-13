<template>
  <div class="page result-page">
    <div class="result-card card">
      <div class="result-icon" :class="{ good: accuracy >= 60 }">
        {{ accuracy >= 80 ? '&#9733;' : accuracy >= 60 ? '&#9786;' : '&#9888;' }}
      </div>
      <h2 class="result-title">
        {{ accuracy >= 80 ? '非常棒！' : accuracy >= 60 ? '继续加油！' : '需要多练习' }}
      </h2>
      <div class="result-score">
        <span class="score-big">{{ correct }}</span>
        <span class="score-slash">/</span>
        <span class="score-total">{{ total }}</span>
      </div>
      <div class="result-accuracy">正确率 {{ accuracy }}%</div>

      <div class="result-bar">
        <div class="result-bar-fill" :style="{ width: accuracy + '%' }" :class="barClass"></div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-primary btn-block" @click="retry">再来一轮</button>
      <button class="btn btn-outline btn-block" @click="router.push('/wrong')" v-if="wrongCount > 0">
        查看错题 ({{ wrongCount }} 道)
      </button>
      <button class="btn btn-outline btn-block" @click="router.push('/')">返回首页</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const correct = computed(() => parseInt(route.query.correct) || 0)
const total = computed(() => parseInt(route.query.total) || 0)
const wrongCount = computed(() => total.value - correct.value)
const accuracy = computed(() => total.value > 0 ? Math.round((correct.value / total.value) * 100) : 0)
const barClass = computed(() => {
  if (accuracy.value >= 80) return 'bar-good'
  if (accuracy.value >= 60) return 'bar-ok'
  return 'bar-bad'
})

function retry() {
  router.push({
    path: '/quiz',
    query: {
      mode: route.query.mode || 'random',
      category: route.query.category || '',
      count: total.value
    }
  })
}
</script>

<style scoped>
.result-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40px;
}

.result-card {
  text-align: center;
  width: 100%;
  padding: 32px 20px;
  margin-bottom: 24px;
}

.result-icon {
  font-size: 48px;
  margin-bottom: 8px;
  color: var(--danger);
}

.result-icon.good {
  color: var(--success);
}

.result-title {
  font-size: 20px;
  margin-bottom: 16px;
}

.result-score {
  margin-bottom: 4px;
}

.score-big {
  font-size: 40px;
  font-weight: 700;
  color: var(--primary);
}

.score-slash {
  font-size: 24px;
  color: var(--text-hint);
  margin: 0 4px;
}

.score-total {
  font-size: 24px;
  color: var(--text-secondary);
}

.result-accuracy {
  font-size: 14px;
  color: var(--text-hint);
  margin-bottom: 20px;
}

.result-bar {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.result-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}

.bar-good { background: var(--success); }
.bar-ok { background: var(--primary); }
.bar-bad { background: var(--danger); }

.actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
