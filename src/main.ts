import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import router from './router'
import './styles/global.css'
import { setupGlobalAudioUnlock } from './utils/audio'
import { setupDailyStarsSync } from './utils/dailyStarsArchive'

setupGlobalAudioUnlock()
setupDailyStarsSync()

registerSW({ immediate: true })

createApp(App).use(router).mount('#app')
