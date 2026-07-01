<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { usePwaInstall } from '../utils/pwaInstall'

const {
  canPromptInstall,
  isInstalled,
  isIosSafari,
  refreshInstalledState,
  promptPwaInstall,
} = usePwaInstall()

const installMessage = ref('')
const installLoading = ref(false)
const isAndroid = /Android/i.test(navigator.userAgent)

function refresh() {
  refreshInstalledState()
  installMessage.value = ''
}

async function handleInstall() {
  installMessage.value = ''
  installLoading.value = true
  try {
    const result = await promptPwaInstall()
    if (result === 'accepted') {
      installMessage.value = '安装成功，可从主屏幕打开应用。'
    } else if (result === 'dismissed') {
      installMessage.value = '已取消安装，可稍后再试。'
    } else {
      installMessage.value = '当前浏览器暂不支持一键安装，请按下方说明手动添加。'
    }
  } finally {
    installLoading.value = false
  }
}

onActivated(refresh)
refresh()
</script>

<template>
  <div class="page settings-page">
    <section class="card settings-section">
      <h2 class="settings-section__title">安装应用</h2>
      <p class="settings-section__desc">
        安装到主屏幕后，可像 App 一样全屏使用，计时与通知更稳定。
      </p>

      <div v-if="isInstalled" class="settings-status settings-status--ok">
        <p class="settings-status__title">已安装</p>
        <p class="settings-status__text">当前正在以已安装模式运行，或已从主屏幕打开。</p>
      </div>

      <template v-else>
        <button
          v-if="canPromptInstall"
          class="btn btn--primary btn--large settings-section__action"
          type="button"
          :disabled="installLoading"
          @click="handleInstall"
        >
          {{ installLoading ? '处理中…' : '安装到主屏幕' }}
        </button>

        <p v-else class="settings-status__text settings-section__manual-lead">
          当前浏览器暂未弹出安装提示，请按下方说明手动添加：
        </p>

        <ul class="settings-steps">
          <li v-if="isIosSafari">
            在 Safari 中点击底部分享按钮，选择「添加到主屏幕」。
          </li>
          <li v-else-if="isAndroid">
            在 Chrome 菜单中选择「安装应用」或「添加到主屏幕」。
          </li>
          <li v-else>
            在 Chrome / Edge 地址栏或菜单中查找「安装应用」选项。
          </li>
          <li>安装后请从主屏幕图标打开，不要只用浏览器标签页。</li>
        </ul>
      </template>

      <p v-if="installMessage" class="settings-section__feedback">{{ installMessage }}</p>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
  width: 100%;
}

@media (min-width: 768px) {
  .settings-page {
    max-width: 640px;
    margin: 0 auto;
  }
}

.settings-section {
  padding: 20px 16px;
}

.settings-section__title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.settings-section__desc {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.settings-section__action {
  width: 100%;
  margin-bottom: 14px;
}

.settings-section__manual-lead {
  margin: 0 0 12px;
}

.settings-section__feedback {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-primary);
  text-align: center;
}

.settings-status {
  padding: 14px;
  border-radius: var(--radius-md);
  margin-bottom: 14px;
}

.settings-status--ok {
  background: rgba(26, 107, 92, 0.08);
  border: 1px solid rgba(26, 107, 92, 0.2);
}

.settings-status--hint {
  background: var(--color-bg);
}

.settings-status--hint {
  background: var(--color-bg);
}

.settings-status__title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
}

.settings-status__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.settings-steps {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}
</style>
