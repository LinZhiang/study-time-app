<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { usePwaInstall } from '../utils/pwaInstall'

const {
  canPromptInstall,
  installUiStatus,
  installStatusHint,
  refreshInstalledState,
  promptPwaInstall,
} = usePwaInstall()

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

      <div
        class="settings-status"
        :class="{
          'settings-status--ok': installUiStatus === 'installed',
          'settings-status--ready': installUiStatus === 'ready',
          'settings-status--wait': installUiStatus === 'waiting_browser' || installUiStatus === 'preparing',
          'settings-status--error': installUiStatus === 'error',
        }"
      >
        <p class="settings-status__title">
          {{
            installUiStatus === 'installed'
              ? '已安装'
              : installUiStatus === 'ready'
                ? '可以安装'
                : installUiStatus === 'error'
                  ? '准备失败'
                  : '准备中'
          }}
        </p>
        <p class="settings-status__text">{{ installStatusHint }}</p>
      </div>

      <button
        v-if="installUiStatus !== 'installed'"
        class="btn btn--primary btn--large settings-section__action"
        type="button"
        :disabled="!canPromptInstall || installLoading"
        @click="handleInstall"
      >
        {{ installLoading ? '处理中…' : '安装到主屏幕' }}
      </button>
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

.settings-status {
  padding: 14px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.settings-status--ok {
  background: rgba(26, 107, 92, 0.08);
  border: 1px solid rgba(26, 107, 92, 0.2);
}

.settings-status--ready {
  background: rgba(26, 107, 92, 0.08);
  border: 1px solid rgba(26, 107, 92, 0.25);
}

.settings-status--wait {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.settings-status--error {
  background: rgba(198, 40, 40, 0.06);
  border: 1px solid rgba(198, 40, 40, 0.2);
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
