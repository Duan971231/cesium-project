<script setup lang="ts">
import { ref } from 'vue'

import { useAppEvent } from '@/composables/useAppEvent'
import { appEmitter } from '@/events'
import { useCounterStore } from '@/stores/counter'

const counterStore = useCounterStore()
const appTitle = import.meta.env.VITE_APP_TITLE ?? 'Vue TS Template'
const lastEventMessage = ref('尚未触发事件')

useAppEvent('counter:incremented', ({ count }) => {
  lastEventMessage.value = `mitt 收到计数事件：${count}`
})

function increment() {
  counterStore.increment()
  appEmitter.emit('counter:incremented', { count: counterStore.count })
}
</script>

<template>
  <main class="page-shell">
    <section class="hero-card">
      <p class="eyebrow">Vue 3 + TypeScript</p>
      <h1>{{ appTitle }}</h1>
      <p>Pinia 管理可追踪状态，typed mitt 处理瞬时跨组件事件。</p>

      <div class="counter-row">
        <button type="button" @click="increment">计数：{{ counterStore.count }}</button>
        <span>两倍：{{ counterStore.doubleCount }}</span>
      </div>

      <p class="event-message">{{ lastEventMessage }}</p>
    </section>
  </main>
</template>
