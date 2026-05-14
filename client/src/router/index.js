import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/quiz',
    name: 'Quiz',
    component: () => import('../views/Quiz.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/result',
    name: 'Result',
    component: () => import('../views/Result.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/wrong',
    name: 'Wrong',
    component: () => import('../views/Wrong.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('../views/Stats.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/generate',
    name: 'Generate',
    component: () => import('../views/Generate.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/compare',
    name: 'Compare',
    component: () => import('../views/Compare.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/ruankao',
    name: 'Ruankao',
    component: () => import('../views/Ruankao.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/qq-callback',
    name: 'QQCallback',
    component: () => import('../views/QQCallback.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('token')
    if (!token) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }
})

export default router
