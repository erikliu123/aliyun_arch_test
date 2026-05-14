<template>
  <div class="callback-page">
    <div class="callback-card">
      <div v-if="error" class="callback-error">
        <div class="icon">&#10060;</div>
        <h2>登录失败</h2>
        <p>{{ errorMessage }}</p>
        <button class="btn btn-primary" @click="goLogin">返回登录</button>
      </div>
      <div v-else class="callback-loading">
        <div class="spinner"></div>
        <p>QQ 登录中，请稍候...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user.js'

const router = useRouter()
const userStore = useUserStore()

const error = ref(false)
const errorMessage = ref('')

function goLogin() {
  router.push('/login')
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  const userJson = params.get('user')
  const errCode = params.get('error')

  if (errCode) {
    error.value = true
    const messages = {
      missing_code: 'QQ 授权失败，未获取到授权码',
      token_failed: 'QQ 授权令牌获取失败',
      openid_failed: '获取 QQ 用户信息失败',
      server_error: '服务器处理异常，请稍后重试'
    }
    errorMessage.value = messages[errCode] || '未知错误，请重试'
    return
  }

  if (token && userJson) {
    try {
      const user = JSON.parse(decodeURIComponent(userJson))
      userStore.setLogin({ token, user })
      router.replace('/')
    } catch (e) {
      error.value = true
      errorMessage.value = '登录信息解析失败，请重试'
    }
  } else {
    error.value = true
    errorMessage.value = '登录信息不完整，请重试'
  }
})
</script>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.callback-card {
  text-align: center;
  padding: 40px 20px;
}

.callback-loading p {
  margin-top: 16px;
  color: var(--text-secondary);
  font-size: 15px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.callback-error .icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.callback-error h2 {
  font-size: 20px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.callback-error p {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 24px;
}
</style>
