<script setup lang="ts">
import 'cesium/Build/Cesium/Widgets/widgets.css'

import { ref, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'

import GlobeToolbar from '@/common/components/GlobeToolbar.vue'
import AppIcon from '@/components/AppIcon.vue'
import FloatingPanel from '@/components/FloatingPanel.vue'
import { useCesiumViewer } from '@/composables/useCesiumViewer'
import PlotPanel from '@/modules/plot/components/PlotPanel.vue'
import { RegionScreenshot } from '@/modules/screenshot'

const screenshotOpen = ref(false)

const { viewer, status, showImagery, showAtmosphere, camera, resetView, zoom } = useCesiumViewer(
  useTemplateRef('globe'),
  useTemplateRef('credits'),
)

function prepareScreenshotCanvas(canvas: HTMLCanvasElement) {
  const activeViewer = viewer.value
  if (activeViewer && !activeViewer.isDestroyed() && canvas === activeViewer.scene.canvas) {
    activeViewer.scene.requestRender()
    activeViewer.render()
  }
}
</script>

<template>
  <main class="workspace">
    <header class="workspace-header">
      <div class="brand">
        <span class="brand-icon"><AppIcon name="globe" /></span>
        <span>寰图</span>
        <h1>三维地球工作台</h1>
      </div>
      <RouterLink class="home-link" :to="{ name: 'home' }">
        <AppIcon name="home" />
        <span>返回首页</span>
      </RouterLink>
    </header>

    <section class="stage" aria-label="三维地球场景">
      <div ref="globe" class="globe-container"></div>
      <div v-if="status !== 'ready'" class="scene-message" role="status">
        <template v-if="status === 'loading'">正在加载三维地球…</template>
        <template v-else>地球加载失败。请确认浏览器支持 WebGL 2，然后刷新页面。</template>
      </div>

      <GlobeToolbar @screenshot="screenshotOpen = true">
        <template #plot>
          <PlotPanel :viewer="viewer" />
        </template>
      </GlobeToolbar>

      <RegionScreenshot
        v-if="screenshotOpen"
        :prepare-canvas="prepareScreenshotCanvas"
        @close="screenshotOpen = false"
      />

      <div class="panel-area">
        <FloatingPanel title="场景图层" side="left" icon="layers">
          <button
            class="tool-row"
            type="button"
            role="switch"
            :aria-checked="showImagery"
            :disabled="status !== 'ready'"
            @click="showImagery = !showImagery"
          >
            <AppIcon name="globe" />
            <span>地球底图</span>
            <span class="switch-track" aria-hidden="true"></span>
          </button>
          <button
            class="tool-row"
            type="button"
            role="switch"
            :aria-checked="showAtmosphere"
            :disabled="status !== 'ready'"
            @click="showAtmosphere = !showAtmosphere"
          >
            <AppIcon name="sun" />
            <span>大气效果</span>
            <span class="switch-track" aria-hidden="true"></span>
          </button>
          <button class="tool-row" type="button" role="switch" aria-checked="false" disabled>
            <AppIcon name="cloud" />
            <span>体积云</span>
            <small>待接入</small>
          </button>
        </FloatingPanel>
      </div>

      <div v-if="status === 'ready'" class="camera-controls" role="group" aria-label="视角操作">
        <div class="compass" aria-hidden="true">
          <span>N</span>
          <AppIcon name="compass" :style="{ transform: `rotate(${-camera.heading}deg)` }" />
        </div>
        <div class="camera-buttons">
          <button type="button" title="放大" aria-label="放大" @click="zoom('in')">
            <AppIcon name="plus" />
          </button>
          <button type="button" title="缩小" aria-label="缩小" @click="zoom('out')">
            <AppIcon name="minus" />
          </button>
          <button type="button" title="重置视角" aria-label="重置视角" @click="resetView">
            <AppIcon name="reset" />
          </button>
        </div>
      </div>
      <div ref="credits" class="scene-credits"></div>
    </section>

    <footer class="status-bar">
      <span class="navigation-hint">拖动旋转 · 滚轮缩放</span>
      <div v-if="status === 'ready'" class="camera-stats" aria-label="相机位置">
        <span><span class="stat-label">经度</span> {{ camera.longitude.toFixed(2) }}°</span>
        <span><span class="stat-label">纬度</span> {{ camera.latitude.toFixed(2) }}°</span>
        <span><span class="stat-label">高度</span> {{ camera.altitude.toFixed(1) }} km</span>
      </div>
    </footer>
  </main>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-rows: 64px minmax(290px, 1fr) 38px;
  height: 100dvh;
  background: #0a101d;
}

.workspace-header,
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: 22px;
  background: #101827;
}

.workspace-header {
  border-bottom: 1px solid #293651;
}

.workspace-header h1 {
  margin: 0 0 0 6px;
  border-left: 1px solid #3d4d68;
  padding-left: 16px;
  color: #b4c3db;
  font-size: 0.88rem;
  font-weight: 500;
}

.home-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #34445e;
  border-radius: 8px;
  padding: 8px 11px;
  color: #d1dcf1;
  font-size: 0.875rem;
  text-decoration: none;
  white-space: nowrap;
}

.home-link:hover {
  background: #24334e;
}

.home-link svg {
  width: 16px;
}

.stage {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #080d19;
}

.globe-container,
.panel-area {
  position: absolute;
  inset: 0;
}

.panel-area {
  z-index: 2;
  pointer-events: none;
}

.scene-message {
  position: absolute;
  inset: 50% auto auto 50%;
  width: max-content;
  max-width: calc(100% - 30px);
  border: 1px solid #34445e;
  border-radius: 10px;
  padding: 14px 21px;
  background: #111a2b;
  color: #d1dcf1;
  text-align: center;
  transform: translate(-50%, -50%);
}

.tool-row {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  width: 100%;
  min-height: 42px;
  align-items: center;
  gap: 9px;
  border-radius: 6px;
  padding: 0 7px;
  color: #dbe5f6;
  font-size: 0.875rem;
  text-align: left;
  white-space: nowrap;
}

.tool-row:not(:disabled):hover {
  background: #253654;
}

.tool-row:disabled,
.tool-row small {
  color: #a2b0c7;
}

.tool-row svg {
  width: 17px;
  color: #89b7ff;
}

.tool-row:disabled svg {
  color: #8b9ebc;
}

.tool-row small {
  font-size: 0.75rem;
}

.switch-track {
  width: 30px;
  height: 17px;
  border-radius: 10px;
  padding: 3px;
  background: #52617a;
}

.switch-track::after {
  display: block;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #eef5ff;
  content: '';
}

[aria-checked='true'] .switch-track {
  background: #528de9;
}

[aria-checked='true'] .switch-track::after {
  transform: translateX(13px);
}

.camera-controls {
  position: absolute;
  right: 22px;
  bottom: 18px;
  display: grid;
  gap: 9px;
}

.camera-buttons,
.compass {
  overflow: hidden;
  border: 1px solid #334364;
  border-radius: 9px;
  background: #111a2bed;
}

.compass,
.camera-buttons button {
  display: grid;
  width: 40px;
  height: 38px;
  place-items: center;
  color: #b8d4ff;
}

.compass {
  height: 48px;
  padding: 4px 0;
  font: 0.7rem/1 var(--mono);
}

.camera-buttons button + button {
  border-top: 1px solid #334364;
}

.camera-buttons button:hover {
  background: #253654;
}

.camera-controls svg {
  width: 18px;
}

.compass svg {
  fill: #8ab8ff;
}

.scene-credits {
  position: absolute;
  bottom: 8px;
  left: 12px;
  max-width: calc(100% - 80px);
  font-size: 0.75rem;
}

.status-bar {
  border-top: 1px solid #293651;
  color: #aabbd4;
  font-size: 0.8rem;
}

.camera-stats {
  display: flex;
  gap: 18px;
  color: #d7e4fa;
  font-family: var(--mono);
  white-space: nowrap;
}

.stat-label {
  color: #aabbd4;
  font-family: var(--sans);
}

@media (max-width: 580px) {
  .workspace-header,
  .status-bar {
    padding-inline: 10px;
  }

  .workspace-header h1 {
    margin-left: 0;
    padding-left: 8px;
    font-size: 0.75rem;
  }

  .home-link {
    gap: 4px;
    padding-inline: 6px;
    font-size: 0.75rem;
  }

  .tool-row {
    grid-template-columns: 14px 1fr auto;
    gap: 4px;
    padding-inline: 2px;
    font-size: 0.76rem;
  }

  .tool-row svg {
    width: 14px;
  }

  .camera-controls {
    right: 10px;
  }

  .navigation-hint {
    display: none;
  }

  .camera-stats {
    justify-content: space-between;
    width: 100%;
    gap: 4px;
    font-size: 0.7rem;
  }
}
</style>
