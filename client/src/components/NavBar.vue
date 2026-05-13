<template>
  <nav class="navbar">
    <router-link to="/" :class="['nav-item', { active: route.name === 'Home' }]">
      <span class="nav-icon">&#9776;</span>
      <span class="nav-label">首页</span>
    </router-link>
    <router-link to="/generate" :class="['nav-item', { active: route.name === 'Generate' }]">
      <span class="nav-icon">&#9889;</span>
      <span class="nav-label">出题</span>
    </router-link>
    <router-link to="/compare" :class="['nav-item', { active: route.name === 'Compare' }]">
      <span class="nav-icon">&#9878;</span>
      <span class="nav-label">对比</span>
    </router-link>
    <router-link to="/wrong" :class="['nav-item', { active: route.name === 'Wrong' }]">
      <span class="nav-icon">&#9998;</span>
      <span class="nav-label">错题</span>
    </router-link>
    <router-link to="/stats" :class="['nav-item', { active: route.name === 'Stats' }]">
      <span class="nav-icon">&#9636;</span>
      <span class="nav-label">统计</span>
    </router-link>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<style scoped>
.navbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  height: 56px;
  background: #fff;
  display: flex;
  border-top: 1px solid var(--border);
  z-index: 100;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-hint);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-item.active {
  color: var(--primary);
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-label {
  font-size: 11px;
}
</style>
