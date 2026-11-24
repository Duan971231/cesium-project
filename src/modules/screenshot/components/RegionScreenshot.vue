<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { useRegionScreenshot } from '../useRegionScreenshot'

const props = defineProps<{ prepareCanvas?: (canvas: HTMLCanvasElement) => void }>()
const emit = defineEmits<{ close: [] }>()
const overlay = useTemplateRef<HTMLElement>('overlay')
const {
  selectionStyle,
  selection,
  dragging,
  saving,
  error,
  crop,
  canSave,
  close,
  reset,
  startSelection,
  updateSelection,
  endSelection,
  cancelSelection,
  save,
} = useRegionScreenshot(overlay, () => emit('close'), {
  prepareCanvas: (canvas) => props.prepareCanvas?.(canvas),
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="overlay"
      class="screenshot-overlay"
      data-screenshot-ignore
      role="dialog"
      aria-modal="true"
      aria-label="页面区域截图"
      tabindex="-1"
      @pointerdown="startSelection"
      @pointermove="updateSelection"
      @pointerup="endSelection"
      @pointercancel="cancelSelection"
      @lostpointercapture="dragging && cancelSelection()"
      @contextmenu.prevent="close"
      @wheel.prevent
    >
      <div v-if="!selection" class="screenshot-shade" aria-hidden="true"></div>
      <div v-if="selection" class="screenshot-selection" :style="selectionStyle" aria-hidden="true">
        <span v-if="crop" class="selection-size">{{ crop.width }} × {{ crop.height }} px</span>
        <i v-for="corner in ['tl', 'tr', 'bl', 'br']" :key="corner" :class="corner"></i>
      </div>

      <div class="screenshot-controls" @pointerdown.stop>
        <div class="screenshot-hint" role="status">
          {{
            selection
              ? '可重新拖动框选；Enter 保存选区，Esc 取消'
              : '拖动框选截图范围，或直接保存当前页面；Esc 取消'
          }}
        </div>
        <div class="screenshot-buttons">
          <button type="button" :disabled="!selection || saving" @click="reset">取消选区</button>
          <button type="button" @click="close">取消（Esc）</button>
          <button class="save-button" type="button" :disabled="!canSave || saving" @click="save">
            {{ saving ? '正在保存…' : selection ? '保存选区 PNG' : '保存整张 PNG' }}
          </button>
        </div>
        <p v-if="error" class="screenshot-error" role="alert">{{ error }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.screenshot-overlay {
  position: fixed;
  z-index: 10000;
  inset: 0;
  overflow: hidden;
  outline: none;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}

.screenshot-shade {
  position: absolute;
  inset: 0;
  background: #02081588;
  pointer-events: none;
}

.screenshot-selection {
  position: absolute;
  border: 1px solid #a6cbff;
  box-shadow: 0 0 0 100vmax #02081588;
  pointer-events: none;
}

.selection-size {
  position: absolute;
  top: 4px;
  left: 4px;
  border-radius: 4px;
  padding: 4px 7px;
  background: #0b1529e6;
  color: #edf3ff;
  font: 0.75rem var(--mono);
  white-space: nowrap;
}

.screenshot-selection i {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 2px solid #fff;
}

.tl,
.tr {
  top: -2px;
}

.bl,
.br {
  bottom: -2px;
}

.tl,
.bl {
  left: -2px;
}

.tr,
.br {
  right: -2px;
}

.screenshot-controls {
  position: absolute;
  right: 12px;
  bottom: 12px;
  left: 12px;
  width: fit-content;
  max-width: calc(100% - 24px);
  margin-inline: auto;
  border: 1px solid #47638c;
  border-radius: 10px;
  padding: 12px 16px;
  background: #111c30;
  box-shadow: 0 8px 24px #01040c55;
  color: #e4efff;
  font-size: 0.875rem;
  text-align: center;
  cursor: default;
}

.screenshot-hint {
  margin-bottom: 10px;
}

.screenshot-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.screenshot-buttons button {
  min-height: 36px;
  border: 1px solid #47638c;
  border-radius: 6px;
  padding: 6px 12px;
  white-space: nowrap;
}

.screenshot-buttons button:enabled:hover {
  background: #263c5e;
}

.screenshot-buttons .save-button {
  background: #285eb0;
}

.screenshot-buttons button:disabled {
  opacity: 0.45;
}

.screenshot-error {
  max-width: 460px;
  margin: 10px 0 0;
  color: #ffb7b7;
}

@media (max-width: 580px) {
  .screenshot-controls {
    padding: 10px;
    font-size: 0.75rem;
  }

  .screenshot-buttons button {
    padding-inline: 8px;
  }
}
</style>
