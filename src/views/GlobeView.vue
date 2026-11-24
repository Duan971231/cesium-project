<script setup lang="ts">
import 'cesium/Build/Cesium/Widgets/widgets.css'

import { ref, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'

import GlobeToolbar from '@/common/components/GlobeToolbar.vue'
import AppIcon from '@/components/AppIcon.vue'
import FloatingPanel from '@/components/FloatingPanel.vue'
import { useCesiumViewer } from '@/composables/useCesiumViewer'
import { baseMaps, sceneModes } from '@/modules/map/useMapControls'
import PlotPanel from '@/modules/plot/components/PlotPanel.vue'
import { RegionScreenshot } from '@/modules/screenshot'
import VolumetricCloudPanel from '@/modules/volumetric-clouds/components/VolumetricCloudPanel.vue'
import { useVolumetricClouds } from '@/modules/volumetric-clouds/useVolumetricClouds'
import { useWindLayer } from '@/modules/wind/useWindLayer'

const screenshotOpen = ref(false)

const {
  viewer,
  status,
  showImagery,
  showAtmosphere,
  camera,
  resetView,
  zoom,
  baseMap,
  showTerrain,
  terrainLoading,
  terrainError,
  imageryError,
  sceneMode,
  morphing,
  setSceneMode,
} = useCesiumViewer(useTemplateRef('globe'), useTemplateRef('credits'))

const {
  showWind,
  windLoading,
  windError,
  windTimeLabel,
  windDensity,
  windSpeed,
  windEngine,
  windBackend,
  windWarning,
  windDensityMax,
  windFps,
  windP95,
} = useWindLayer(viewer, useTemplateRef('windCanvas'))

const { showClouds, cloudOptions, cloudError } = useVolumetricClouds(viewer)

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
      <canvas ref="windCanvas" class="wind-canvas" aria-hidden="true"></canvas>
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
          <div class="mode-buttons" role="group" aria-label="地图视图模式">
            <button
              v-for="mode in sceneModes"
              :key="mode"
              class="mode-button"
              type="button"
              :disabled="status !== 'ready' || morphing"
              :aria-pressed="sceneMode === mode"
              :title="`切换到 ${mode}`"
              :aria-label="`切换到 ${mode}`"
              @click="setSceneMode(mode)"
            >
              {{ mode }}
            </button>
          </div>
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
          <label class="basemap-picker">
            <span>底图来源</span>
            <select v-model="baseMap" :disabled="status !== 'ready'" aria-label="底图来源">
              <option v-for="source in baseMaps" :key="source.id" :value="source.id">
                {{ source.label }}
              </option>
            </select>
          </label>
          <p v-if="imageryError && showImagery" class="layer-message" role="status">
            {{ imageryError }}
          </p>
          <button
            class="tool-row"
            type="button"
            role="switch"
            :aria-checked="showTerrain"
            :aria-busy="terrainLoading"
            :disabled="status !== 'ready'"
            @click="showTerrain = !showTerrain"
          >
            <AppIcon name="terrain" />
            <span>{{ terrainLoading ? '高程加载中…' : '地形高程' }}</span>
            <span class="switch-track" aria-hidden="true"></span>
          </button>
          <p v-if="terrainError" class="layer-message" role="status">{{ terrainError }}</p>
          <p v-else-if="showTerrain && sceneMode === '2D'" class="layer-hint">
            高程已开启，切换到 2.5D 或 3D 可查看地形起伏。
          </p>
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
          <button
            class="tool-row"
            type="button"
            role="switch"
            :aria-checked="showWind"
            :aria-busy="windLoading"
            :disabled="status !== 'ready'"
            @click="showWind = !showWind"
          >
            <AppIcon name="wind" />
            <span>{{ windLoading ? '风场加载中…' : '风场动画' }}</span>
            <span class="switch-track" aria-hidden="true"></span>
          </button>
          <p v-if="windError" class="layer-message" role="status">{{ windError }}</p>
          <div v-if="showWind" class="wind-controls">
            <p v-if="windFps" aria-label="风场页面流畅度">
              页面 {{ windFps }} fps · 帧间隔 P95 {{ windP95 }} ms
            </p>
            <label>
              <span
                >渲染模式 <output>{{ windBackend }}</output></span
              >
              <select v-model="windEngine" aria-label="风场渲染模式">
                <option value="auto">自动（推荐）</option>
                <option value="gpu">GPU 高性能</option>
                <option value="canvas">Canvas 兼容</option>
              </select>
            </label>
            <p v-if="windWarning" role="status">{{ windWarning }}</p>
            <label>
              <span
                >粒子密度 <output>{{ windDensity }}</output></span
              >
              <input
                v-model.number.lazy="windDensity"
                type="range"
                min="256"
                :max="windDensityMax"
                step="1"
              />
            </label>
            <label>
              <span
                >动画速度 <output>{{ windSpeed.toFixed(1) }}×</output></span
              >
              <input v-model.number="windSpeed" type="range" min="0.2" max="3" step="0.1" />
            </label>
            <div class="wind-legend" aria-label="风速色标，单位米每秒">
              <span>风速 m/s</span>
              <div class="wind-colorbar"></div>
              <div class="wind-ticks">
                <span>0</span><span>10</span><span>20</span><span>30+</span>
              </div>
            </div>
            <p>GFS · 近地面 10 m · 1° 网格</p>
            <p v-if="windTimeLabel">{{ windTimeLabel }}</p>
            <p>本地数据快照，非实时天气。<br />粒子沿风的去向流动，动画已加速。</p>
          </div>
          <button
            class="tool-row"
            type="button"
            role="switch"
            :aria-checked="showClouds"
            :disabled="status !== 'ready'"
            @click="showClouds = !showClouds"
          >
            <AppIcon name="cloud" />
            <span>体积云</span>
            <span class="switch-track" aria-hidden="true"></span>
          </button>
          <p v-if="cloudError" class="layer-message" role="status">{{ cloudError }}</p>
        </FloatingPanel>
        <VolumetricCloudPanel
          v-if="showClouds"
          v-model="cloudOptions"
          :suspended="sceneMode !== '3D' || morphing"
        />
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

.wind-canvas {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.wind-controls {
  display: grid;
  gap: 10px;
  margin: 4px 7px 12px;
  border-top: 1px solid #34445e;
  padding-top: 10px;
  color: #aabbd4;
  font-size: 0.7rem;
}

.wind-controls label {
  display: grid;
  gap: 5px;
}

.wind-controls label > span,
.wind-ticks {
  display: flex;
  justify-content: space-between;
}

.wind-controls input {
  width: 100%;
  margin: 0;
  accent-color: #81b9ff;
}

.wind-controls p {
  margin: 0;
  line-height: 1.5;
}

.wind-colorbar {
  height: 6px;
  margin: 5px 0;
  border-radius: 4px;
  background: linear-gradient(90deg, #8bd9ff, #5ce5e0, #91ed9b, #f5eb83, #ffb767, #ff7784);
}

.panel-area {
  z-index: 2;
  pointer-events: none;
}

.scene-message {
  position: absolute;
  z-index: 2;
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

.tool-row:disabled {
  color: #a2b0c7;
}

.tool-row svg {
  width: 17px;
  color: #89b7ff;
}

.tool-row:disabled svg {
  color: #8b9ebc;
}

.basemap-picker {
  display: grid;
  gap: 7px;
  padding: 6px 7px 10px;
  color: #aabbd4;
  font-size: 0.75rem;
}

.basemap-picker select,
.wind-controls select {
  width: 100%;
  min-width: 0;
  border: 1px solid #34445e;
  border-radius: 6px;
  padding: 7px;
  background: #17243b;
  color: #dbe5f6;
  font: inherit;
}

.layer-message,
.layer-hint {
  margin: 2px 7px 8px;
  color: #ffc38c;
  font-size: 0.75rem;
  line-height: 1.5;
}

.layer-hint {
  color: #aabbd4;
}

.mode-buttons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 6px;
  border: 1px solid #334364;
  border-radius: 6px;
  background: #17243b;
}

.mode-button {
  position: relative;
  min-height: 34px;
  padding: 0;
  color: #b8d4ff;
  font-size: 0.8rem;
  font-weight: 600;
}

.mode-button + .mode-button {
  border-left: 1px solid #334364;
}

.mode-button:first-child {
  border-radius: 5px 0 0 5px;
}

.mode-button:last-child {
  border-radius: 0 5px 5px 0;
}

.mode-button:focus-visible {
  z-index: 1;
  outline-offset: -3px;
}

.mode-button[aria-pressed='true'] {
  background: #365b8c;
  color: #fff;
}

.mode-button[aria-pressed='false']:enabled:hover {
  background: #253654;
}

.mode-button:disabled {
  opacity: 0.5;
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
  z-index: 2;
  right: 22px;
  bottom: 18px;
  display: grid;
  justify-items: end;
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
  z-index: 2;
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
