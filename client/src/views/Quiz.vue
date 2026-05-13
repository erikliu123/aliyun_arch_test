<template>
  <div class="quiz-page">
    <!-- 顶部栏 -->
    <div class="quiz-header">
      <button class="back-btn" @click="handleBack">&larr; 返回</button>
      <span class="quiz-title">{{ currentQuestion?.categoryName || '答题' }}</span>
    </div>
    <div class="progress-wrap">
      <ProgressBar :current="currentIndex + 1" :total="questions.length" />
    </div>

    <!-- 加载中 -->
    <div class="loading" v-if="loading">加载题目中...</div>

    <!-- 无题目 -->
    <div class="empty" v-else-if="questions.length === 0">
      <p>暂无题目</p>
      <button class="btn btn-primary" @click="router.push('/')">返回首页</button>
    </div>

    <!-- 题目卡片 -->
    <div class="question-wrap" v-else>
      <QuestionCard
        :question="currentQuestion"
        :answered="currentAnswered"
        :selected-answer="currentSelected"
        :correct-answer="currentCorrectAnswer"
        :explanation="currentExplanation"
        @select="handleSelect"
        @submit-essay="handleEssaySubmit"
        @submit-multi="handleMultiSubmit"
      />

      <div class="action-row" v-if="currentAnswered">
        <button class="btn btn-primary btn-block" @click="handleNext">
          {{ isLast ? '查看结果' : '下一题 &rarr;' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QuestionCard from '../components/QuestionCard.vue'
import ProgressBar from '../components/ProgressBar.vue'
import api from '../utils/api.js'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const questions = ref([])
const currentIndex = ref(0)
const answerRecords = ref([])

const currentQuestion = computed(() => questions.value[currentIndex.value])
const isLast = computed(() => currentIndex.value === questions.value.length - 1)

const currentRecord = computed(() => answerRecords.value[currentIndex.value])
const currentAnswered = computed(() => !!currentRecord.value)
const currentSelected = computed(() => currentRecord.value?.selectedAnswer || '')
const currentCorrectAnswer = computed(() => currentRecord.value?.answer || '')
const currentExplanation = computed(() => currentRecord.value?.explanation || '')

onMounted(async () => {
  const { mode, category, count } = route.query
  try {
    let data
    if (mode === 'sequential') {
      data = await api.get('/questions/sequential', {
        params: { category, offset: 0, limit: count || 50 }
      })
    } else if (mode === 'wrong') {
      data = await api.get('/questions/wrong', { params: { category } })
    } else if (mode === 'generated') {
      data = await api.get('/generate/questions', {
        params: { category, count: count || 10 }
      })
    } else {
      data = await api.get('/questions/random', {
        params: { category, count: count || 10 }
      })
    }
    questions.value = data.questions
    answerRecords.value = new Array(data.questions.length).fill(null)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})

async function handleSelect(optionKey) {
  if (currentAnswered.value) return

  try {
    const result = await api.post('/answers/submit', {
      questionId: currentQuestion.value.id,
      selectedAnswer: optionKey
    })
    answerRecords.value[currentIndex.value] = {
      selectedAnswer: optionKey,
      answer: result.answer,
      explanation: result.explanation,
      correct: result.correct
    }
  } catch (e) {
    console.error(e)
  }
}

async function handleMultiSubmit(answers) {
  if (currentAnswered.value) return

  try {
    const result = await api.post('/answers/submit', {
      questionId: currentQuestion.value.id,
      selectedAnswer: answers
    })
    answerRecords.value[currentIndex.value] = {
      selectedAnswer: answers,
      answer: result.answer,
      explanation: result.explanation,
      correct: result.correct
    }
  } catch (e) {
    console.error(e)
  }
}

async function handleEssaySubmit(essayText) {
  if (currentAnswered.value) return

  try {
    const result = await api.post('/answers/submit', {
      questionId: currentQuestion.value.id,
      selectedAnswer: essayText,
      type: 'essay'
    })
    answerRecords.value[currentIndex.value] = {
      selectedAnswer: essayText,
      answer: '',
      explanation: result.explanation,
      correct: true
    }
  } catch (e) {
    console.error(e)
  }
}

function handleNext() {
  if (isLast.value) {
    const correct = answerRecords.value.filter(r => r?.correct).length
    const total = questions.value.length
    router.push({
      path: '/result',
      query: {
        correct,
        total,
        mode: route.query.mode,
        category: route.query.category || ''
      }
    })
  } else {
    currentIndex.value++
  }
}

function handleBack() {
  if (confirm('确定退出答题吗？当前进度将保留。')) {
    router.push('/')
  }
}
</script>

<style scoped>
.quiz-page {
  min-height: 100vh;
  background: var(--bg);
}

.quiz-header {
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

.quiz-title {
  font-size: 16px;
  font-weight: 600;
}

.progress-wrap {
  padding: 12px 16px 0;
}

.loading, .empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-hint);
}

.empty .btn {
  margin-top: 16px;
}

.question-wrap {
  padding: 16px;
}

.action-row {
  margin-top: 16px;
}
</style>
