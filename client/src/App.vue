<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <NavBar v-if="showNav" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from './stores/user.js'
import NavBar from './components/NavBar.vue'

const route = useRoute()
const userStore = useUserStore()

const showNav = computed(() => {
  const hideNavRoutes = ['Login', 'Quiz']
  return userStore.isLoggedIn && !hideNavRoutes.includes(route.name)
})
</script>
