<template>
  <div class="page wrong-page">
    <h2 class="page-title">错题本</h2>

    <div class="loading" v-if="loading">加载中...</div>

    <div class="empty" v-else-if="wrongQuestions.length === 0">
      <p>&#127881; 暂无错题，继续保持！</p>
    </div>

    <template v-else>
      <div class="wrong-header">
        <span>共 {{ wrongQuestions.length }} 道错题</span>
        <button class="btn btn-primary btn-sm" @click="startRedo">开始重练</button>
      </div>

      <div class="wrong-list">
        <div
          v-for="(q, i) in wrongQuestions"
          :key="q.id"
          class="card wrong-item"
          @click="toggleExpand(i)"
        >
          <div class="wrong-item-header">
            <span class="cat-tag">{{ q.categoryName }}</span>
            <p class="wrong-question">{{ q.question }}</p>
            <span class="expand-icon">{{ expanded === i ? '&#9650;' : '&#9660;' }}</span>
          </div>
          <div class="wrong-detail" v-if="expanded === i">
            <div class="options-review">
              <div v-for="opt in q.options" :key="opt.key" class="option-review">
                <span class="opt-key">{{ opt.key }}.</span>
                <span>{{ opt.text }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/api.js'

const router = useRouter()
const loading = ref(true)
const wrongQuestions = ref([])
const expanded = ref(-1)

onMounted(async () => {
  try {
    const data = await api.get('/questions/wrong')
    wrongQuestions.value = data.questions
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})

function toggleExpand(i) {
  expanded.value = expanded.value === i ? -1 : i
}

function startRedo() {
  router.push({ path: '/quiz', query: { mode: 'wrong' } })
}
</script>

<style scoped>
.page-title {
  font-size: 20px;
  margin-bottom: 16px;
}

.loading, .empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-hint);
  font-size: 15px;
}

.wrong-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.btn-sm {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wrong-item {
  cursor: pointer;
  padding: 14px;
}

.wrong-item-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.cat-tag {
  flex-shrink: 0;
  background: var(--primary-bg);
  color: var(--primary);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 2px;
}

.wrong-question {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.expand-icon {
  flex-shrink: 0;
  color: var(--text-hint);
  font-size: 12px;
  margin-top: 4px;
}

.wrong-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.options-review {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-review {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.opt-key {
  font-weight: 600;
  margin-right: 4px;
}
</style>
