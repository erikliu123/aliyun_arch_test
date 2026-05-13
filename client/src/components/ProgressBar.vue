<template>
  <div class="progress-bar">
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: percent + '%' }"></div>
    </div>
    <span class="progress-text">{{ current }} / {{ total }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  current: { type: Number, required: true },
  total: { type: Number, required: true }
})
const percent = computed(() => props.total > 0 ? Math.round((props.current / props.total) * 100) : 0)
</script>

<style scoped>
.progress-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-track {
  flex: 1;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 13px;
  color: var(--text-hint);
  white-space: nowrap;
}
</style>
