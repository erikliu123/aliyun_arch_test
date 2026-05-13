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
</style>
