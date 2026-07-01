import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'
import { setupGlobalAudioUnlock } from './utils/audio'
import { setupDailyStarsSync } from './utils/dailyStarsArchive'
import './utils/pwaInstall'

setupGlobalAudioUnlock()
setupDailyStarsSync()

createApp(App).use(router).mount('#app')
