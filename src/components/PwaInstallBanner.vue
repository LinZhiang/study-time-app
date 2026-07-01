<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { usePwaInstall } from '../utils/pwaInstall'

const {
  showInstallBanner,
  canPromptInstall,
  browserInstallInfo,
  promptPwaInstall,
  dismissInstallBanner,
} = usePwaInstall()

async function installApp() {
  if (canPromptInstall.value) {
    await promptPwaInstall()
  }
}
</script>

<template>
  <div v-if="showInstallBanner" class="pwa-install-banner">
    <p class="pwa-install-banner__text">
      {{
        canPromptInstall
          ? '安装到主屏幕，使用更方便'
          : browserInstallInfo.isHuaweiBrowser
            ? '华为浏览器：请点菜单 → 添加到主屏幕'
            : '请从浏览器菜单添加到主屏幕'
      }}
    </p>
    <div class="pwa-install-banner__actions">
      <button class="btn btn--ghost btn--small" type="button" @click="dismissInstallBanner">
        稍后
      </button>
      <button
        v-if="canPromptInstall"
        class="btn btn--primary btn--small"
        type="button"
        @click="installApp"
      >
        安装
      </button>
      <RouterLink v-else class="btn btn--primary btn--small" to="/settings">
        查看步骤
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.pwa-install-banner {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(var(--nav-height) + var(--safe-bottom) + 12px);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(26 107 92 / 18%);
}

.pwa-install-banner__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text);
}

.pwa-install-banner__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.pwa-install-banner__actions .btn {
  text-decoration: none;
  white-space: nowrap;
}
</style>
