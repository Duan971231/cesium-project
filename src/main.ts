import './styles/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

Object.assign(globalThis, { CESIUM_BASE_URL: `${import.meta.env.BASE_URL}cesium/` })

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
