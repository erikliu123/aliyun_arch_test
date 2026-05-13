<template>
  <div class="question-card">
    <div class="question-meta">
      <span class="category-tag">{{ question.categoryName }}</span>
      <span class="difficulty">
        {{ ['', '基础', '进阶', '高级'][question.difficulty] || '' }}
      </span>
      <span v-if="question.type === 'essay'" class="type-tag essay-tag">简答题</span>
      <span v-if="question.type === 'multiple'" class="type-tag multi-tag">多选题</span>
    </div>
    <p class="question-text">{{ question.question }}</p>

    <!-- 单选题模式 -->
    <div class="options" v-if="question.type === 'single' || !question.type">
      <button
        v-for="opt in question.options"
        :key="opt.key"
        :class="['option', optionClass(opt.key)]"
        :disabled="answered"
        @click="$emit('select', opt.key)"
      >
        <span class="option-key">{{ opt.key }}</span>
        <span class="option-text">{{ opt.text }}</span>
        <span v-if="answered && isCorrectKey(opt.key)" class="option-icon correct-icon">&#10003;</span>
        <span v-else-if="answered && isSelectedKey(opt.key) && !isCorrectKey(opt.key)" class="option-icon wrong-icon">&#10007;</span>
      </button>
    </div>

    <!-- 多选题模式 -->
    <div class="options" v-else-if="question.type === 'multiple'">
      <button
        v-for="opt in question.options"
        :key="opt.key"
        :class="['option', multiOptionClass(opt.key)]"
        :disabled="answered"
        @click="toggleMultiOption(opt.key)"
      >
        <span class="option-key multi-key" :class="{ checked: multiSelected.includes(opt.key) }">
          {{ multiSelected.includes(opt.key) ? '&#10003;' : opt.key }}
        </span>
        <span class="option-text">{{ opt.text }}</span>
        <span v-if="answered && isCorrectKey(opt.key)" class="option-icon correct-icon">&#10003;</span>
        <span v-else-if="answered && multiSelected.includes(opt.key) && !isCorrectKey(opt.key)" class="option-icon wrong-icon">&#10007;</span>
      </button>
      <button
        v-if="!answered && multiSelected.length >= 2"
        class="btn btn-primary btn-confirm-multi"
        @click="$emit('submit-multi', multiSelected.sort().join(','))"
      >确认选择 (已选 {{ multiSelected.length }} 项)</button>
    </div>

    <!-- 简答题模式 -->
    <div class="essay-area" v-else-if="question.type === 'essay'">
      <textarea
        v-model="essayText"
        :disabled="answered"
        placeholder="请输入你的答案..."
        rows="5"
        class="essay-input"
      ></textarea>
      <button
        v-if="!answered"
        class="btn btn-primary btn-submit-essay"
        :disabled="!essayText.trim()"
        @click="$emit('submit-essay', essayText.trim())"
      >提交答案并查看参考</button>
    </div>

    <!-- 解析区域 -->
    <div v-if="answered && explanation && question.type !== 'essay'" class="explanation">
      <strong>解析：</strong>{{ explanation }}
    </div>

    <div v-if="answered && explanation && question.type === 'essay'" class="explanation essay-ref">
      <strong>参考答案：</strong>
      <p class="ref-text">{{ explanation }}</p>
    </div>

    <!-- 反馈按钮 -->
    <div class="feedback-row" v-if="answered">
      <button class="feedback-btn" :class="{ flagged: showFeedback }" @click="showFeedback = !showFeedback">
        <span class="flag-icon">&#9873;</span> 反馈
      </button>
    </div>

    <!-- 反馈表单 -->
    <div class="feedback-form" v-if="showFeedback">
      <div class="feedback-types">
        <button v-for="ft in feedbackTypes" :key="ft.value"
          :class="['fb-type-btn', feedbackType === ft.value && 'active']"
          @click="feedbackType = ft.value"
        >{{ ft.label }}</button>
      </div>
      <textarea v-model="feedbackReason" class="feedback-textarea" placeholder="补充说明（可选）" rows="2"></textarea>
      <button class="btn btn-primary btn-sm" :disabled="!feedbackType" @click="submitFeedback">提交反馈</button>
      <p v-if="feedbackDone" class="feedback-done">反馈已提交</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../utils/api.js'

const props = defineProps({
  question: { type: Object, required: true },
  answered: { type: Boolean, default: false },
  selectedAnswer: { type: String, default: '' },
  correctAnswer: { type: String, default: '' },
  explanation: { type: String, default: '' }
})

defineEmits(['select', 'submit-essay', 'submit-multi'])

const essayText = ref('')
const multiSelected = ref([])
const showFeedback = ref(false)
const feedbackType = ref('')
const feedbackReason = ref('')
const feedbackDone = ref(false)

const feedbackTypes = [
  { value: 'bad_question', label: '题目有误' },
  { value: 'wrong_answer', label: '答案错误' },
  { value: 'unclear', label: '表述不清' },
  { value: 'other', label: '其他' }
]

function isCorrectKey(key) {
  if (!props.correctAnswer) return false
  return props.correctAnswer.split(',').map(k => k.trim()).includes(key)
}

function isSelectedKey(key) {
  return props.selectedAnswer.split(',').map(k => k.trim()).includes(key)
}

function optionClass(key) {
  if (!props.answered) return ''
  if (isCorrectKey(key)) return 'correct'
  if (isSelectedKey(key) && !isCorrectKey(key)) return 'wrong'
  return 'dimmed'
}

function multiOptionClass(key) {
  if (!props.answered) {
    return multiSelected.value.includes(key) ? 'selected' : ''
  }
  if (isCorrectKey(key)) return 'correct'
  if (multiSelected.value.includes(key) && !isCorrectKey(key)) return 'wrong'
  return 'dimmed'
}

function toggleMultiOption(key) {
  const idx = multiSelected.value.indexOf(key)
  if (idx >= 0) {
    multiSelected.value.splice(idx, 1)
  } else {
    multiSelected.value.push(key)
  }
}

async function submitFeedback() {
  if (!feedbackType.value) return
  try {
    await api.post('/feedback', {
      questionId: props.question.id,
      flagType: feedbackType.value,
      reason: feedbackReason.value
    })
    feedbackDone.value = true
    setTimeout(() => { showFeedback.value = false }, 1500)
  } catch (e) {
    // 静默处理
  }
}
</script>

<style scoped>
.question-card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 20px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.category-tag {
  background: var(--primary-bg);
  color: var(--primary);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.difficulty {
  font-size: 12px;
  color: var(--text-hint);
}

.question-text {
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 16px;
  font-weight: 500;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 12px 14px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: #fff;
  text-align: left;
  font-size: 15px;
  line-height: 1.4;
  transition: all 0.2s;
  cursor: pointer;
}

.option:not(:disabled):active {
  background: var(--primary-bg);
  border-color: var(--primary);
}

.option:disabled {
  cursor: default;
}

.option.selected {
  border-color: var(--primary);
  background: var(--primary-bg);
}

.option-key {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg);
  font-size: 13px;
  font-weight: 600;
  margin-right: 10px;
  flex-shrink: 0;
}

.option-key.multi-key {
  border-radius: 4px;
  border: 1.5px solid var(--border);
  background: #fff;
}

.option-key.multi-key.checked {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.option-text {
  flex: 1;
}

.option-icon {
  margin-left: 8px;
  font-size: 16px;
  flex-shrink: 0;
}

.correct-icon { color: var(--success); }
.wrong-icon { color: var(--danger); }

.option.correct {
  border-color: var(--success);
  background: var(--success-bg);
}

.option.correct .option-key {
  background: var(--success);
  color: #fff;
}

.option.wrong {
  border-color: var(--danger);
  background: var(--danger-bg);
}

.option.wrong .option-key {
  background: var(--danger);
  color: #fff;
}

.option.dimmed {
  opacity: 0.5;
}

.btn-confirm-multi {
  margin-top: 12px;
  padding: 12px;
  font-size: 15px;
}

.explanation {
  margin-top: 16px;
  padding: 12px;
  background: #F7F8FA;
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.explanation strong {
  color: var(--primary);
}

.type-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.essay-tag {
  background: #E8F5E9;
  color: #2E7D32;
}

.multi-tag {
  background: #FFF3E0;
  color: #E65100;
}

.essay-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.essay-input {
  width: 100%;
  padding: 12px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
  min-height: 120px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.essay-input:focus {
  outline: none;
  border-color: var(--primary);
}

.essay-input:disabled {
  background: #F7F8FA;
  color: var(--text-secondary);
}

.btn-submit-essay {
  align-self: flex-end;
  padding: 10px 20px;
  font-size: 15px;
}

.btn-submit-essay:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.essay-ref {
  background: #E8F5E9;
}

.essay-ref .ref-text {
  margin-top: 8px;
  white-space: pre-wrap;
  line-height: 1.8;
}

/* 反馈 */
.feedback-row {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.feedback-btn {
  background: none;
  color: var(--text-hint);
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.feedback-btn:hover, .feedback-btn.flagged {
  color: #C62828;
  background: #FFF3F3;
}

.flag-icon {
  font-size: 14px;
}

.feedback-form {
  margin-top: 12px;
  padding: 12px;
  background: #FAFAFA;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.feedback-types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.fb-type-btn {
  padding: 5px 10px;
  border-radius: 14px;
  font-size: 12px;
  background: #fff;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: all 0.2s;
}

.fb-type-btn.active {
  background: #FFF3F3;
  border-color: #C62828;
  color: #C62828;
}

.feedback-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  resize: none;
  margin-bottom: 8px;
  box-sizing: border-box;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

.feedback-done {
  font-size: 13px;
  color: var(--success);
  margin-top: 6px;
}
</style>
