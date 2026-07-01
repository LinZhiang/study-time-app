<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { usePwaInstall } from '../utils/pwaInstall'

const { canPromptInstall, isInstalled, refreshInstalledState, promptPwaInstall } = usePwaInstall()

const installLoading = ref(false)

function refresh() {
  refreshInstalledState()
}

async function handleInstall() {
  if (!canPromptInstall.value || installLoading.value) return
  installLoading.value = true
  try {
    await promptPwaInstall()
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
        <p class="settings-status__text">当前已从主屏幕或独立窗口打开。</p>
      </div>

      <template v-else>
        <button
          class="btn btn--primary btn--large settings-section__action"
          type="button"
          :disabled="!canPromptInstall || installLoading"
          @click="handleInstall"
        >
          {{ installLoading ? '处理中…' : '安装到主屏幕' }}
        </button>
        <p v-if="!canPromptInstall" class="settings-section__hint">
          安装提示尚未就绪，请刷新页面后再试（与底部安装条相同的一键安装）。
        </p>
      </template>
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
}

.settings-section__hint {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  text-align: center;
}

.settings-status {
  padding: 14px;
  border-radius: var(--radius-md);
}

.settings-status--ok {
  background: rgba(26, 107, 92, 0.08);
  border: 1px solid rgba(26, 107, 92, 0.2);
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
</style>
