<template>
  <div class="login-page">
    <div class="login-header">
      <div class="logo">&#9729;</div>
      <h1>阿里云答题通</h1>
      <p>云产品知识科普 · 答题练习</p>
    </div>

    <div class="card login-card">
      <div class="tabs">
        <button :class="['tab', { active: mode === 'login' }]" @click="mode = 'login'">登录</button>
        <button :class="['tab', { active: mode === 'register' }]" @click="mode = 'register'">注册</button>
      </div>

      <div class="form">
        <div class="field">
          <label>用户名</label>
          <input class="input" v-model="username" placeholder="请输入用户名" @keyup.enter="handleSubmit" />
        </div>
        <div class="field">
          <label>密码</label>
          <input class="input" type="password" v-model="password" placeholder="请输入密码" @keyup.enter="handleSubmit" />
        </div>
        <p class="error" v-if="error">{{ error }}</p>

        <button class="btn btn-primary btn-block" :disabled="loading" @click="handleSubmit">
          {{ loading ? '请稍候...' : (mode === 'login' ? '登 录' : '注 册') }}
        </button>
      </div>

      <div class="divider">
        <span>或</span>
      </div>

      <button class="btn qq-login-btn" :disabled="qqLoading" @click="handleQQLogin">
        <svg class="qq-icon" viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.04 2 11c0 2.76 1.36 5.22 3.48 6.84-.2 1.16-.68 2.2-1.28 3.02-.12.16-.04.38.14.42.5.1 2.08-.14 3.54-1.1.66.18 1.36.28 2.12.28h.04c.66 1.5 2.18 2.54 3.96 2.54 1.78 0 3.3-1.04 3.96-2.54H18c.76 0 1.46-.1 2.12-.28 1.46.96 3.04 1.2 3.54 1.1.18-.04.26-.26.14-.42-.6-.82-1.08-1.86-1.28-3.02C20.64 16.22 22 13.76 22 11c0-4.96-4.48-9-10-9z"/>
        </svg>
        {{ qqLoading ? '跳转中...' : 'QQ 快速登录' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user.js'
import api from '../utils/api.js'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const mode = ref('login')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const qqLoading = ref(false)

async function handleQQLogin() {
  qqLoading.value = true
  try {
    const data = await api.get('/auth/qq/login')
    window.location.href = data.url
  } catch (err) {
    error.value = err.error || 'QQ 登录失败，请重试'
    qqLoading.value = false
  }
}

async function handleSubmit() {
  error.value = ''

  if (!username.value || !password.value) {
    error.value = '请填写用户名和密码'
    return
  }

  if (password.value.length < 4) {
    error.value = '密码长度不能少于4个字符'
    return
  }

  loading.value = true
  try {
    const endpoint = mode.value === 'login' ? '/login' : '/register'
    const data = await api.post(endpoint, {
      username: username.value,
      password: password.value
    })
    userStore.setLogin(data)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (err) {
    error.value = err.error || '操作失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 60px 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  font-size: 48px;
  margin-bottom: 8px;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 4px;
}

.login-header p {
  color: var(--text-hint);
  font-size: 14px;
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.tabs {
  display: flex;
  border-bottom: 1.5px solid var(--border);
  margin-bottom: 20px;
}

.tab {
  flex: 1;
  padding: 12px;
  background: none;
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  margin-bottom: -1.5px;
  transition: all 0.2s;
}

.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.error {
  color: var(--danger);
  font-size: 14px;
  margin-bottom: 12px;
}

.btn-block {
  margin-top: 8px;
}

.divider {
  display: flex;
  align-items: center;
  margin: 20px 0;
  color: var(--text-hint);
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.divider span {
  padding: 0 12px;
}

.qq-login-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #12B7F5;
  color: #fff;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.qq-login-btn:hover {
  background: #0ea5e0;
}

.qq-login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.qq-icon {
  flex-shrink: 0;
}
</style>
