<script setup lang="ts">
import { ref, useId } from 'vue'

import AppIcon from '@/components/AppIcon.vue'

const emit = defineEmits<{ screenshot: [] }>()

const expanded = ref(false)
const showPlot = ref(false)
const actionsId = useId()
const plotId = useId()
</script>

<template>
  <section class="globe-toolbar" aria-label="地图工具">
    <button
      class="tool-launcher"
      type="button"
      :aria-expanded="expanded"
      :aria-controls="actionsId"
      @click="expanded = !expanded"
    >
      <AppIcon name="tools" />
      工具
    </button>

    <Transition name="slide-left">
      <div v-show="expanded" :id="actionsId" class="tool-actions">
        <button
          class="tool-action"
          type="button"
          :aria-expanded="showPlot"
          :aria-controls="plotId"
          @click="showPlot = !showPlot"
        >
          <AppIcon name="draw" />
          标绘
        </button>
        <button
          class="tool-action"
          type="button"
          title="截取当前网页，包含工具栏、面板和地图"
          @click="emit('screenshot')"
        >
          <AppIcon name="camera" />
          截图
        </button>
      </div>
    </Transition>

    <div v-show="expanded && showPlot" :id="plotId" class="plot-slot">
      <slot name="plot" />
    </div>
  </section>
</template>

<style scoped>
.globe-toolbar {
  --toolbar-border: #34486a;
  position: absolute;
  z-index: 3;
  top: 24px;
  right: 22px;
}

.tool-launcher,
.tool-actions,
.plot-slot {
  border: 1px solid var(--toolbar-border);
  border-radius: 10px;
  background: #111c30f5;
  box-shadow: 0 8px 24px #01040c55;
}

.tool-launcher,
.tool-action {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 13px;
  color: #e4efff;
  font-size: 0.875rem;
  white-space: nowrap;
}

.tool-launcher {
  position: relative;
}

.tool-actions {
  position: absolute;
  top: 0;
  right: calc(100% + 8px);
  display: flex;
  overflow: hidden;
}

.tool-action + .tool-action {
  border-left: 1px solid var(--toolbar-border);
}

.tool-action:disabled {
  color: #9aa9c1;
}

.tool-launcher:hover,
.tool-action:enabled:hover,
button[aria-expanded='true'] {
  background: #263c5e;
}

.tool-launcher svg,
.tool-action svg {
  width: 17px;
  color: #96c0ff;
}

.tool-action:disabled svg {
  color: inherit;
}

.tool-action:focus-visible {
  outline-offset: -3px;
}

.plot-slot {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(300px, calc(100vw - 20px));
  max-height: max(160px, calc(100dvh - 192px));
  overflow-y: auto;
  scrollbar-width: thin;
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition:
    clip-path 200ms ease,
    opacity 200ms ease,
    transform 200ms ease;
  clip-path: inset(0);
}

.slide-left-enter-from,
.slide-left-leave-to {
  clip-path: inset(0 0 0 100%);
  opacity: 0;
  transform: translateX(8px);
}

@media (prefers-reduced-motion: reduce) {
  .slide-left-enter-active,
  .slide-left-leave-active {
    transition: none;
  }
}

@media (max-width: 580px) {
  .globe-toolbar {
    top: 12px;
    right: 10px;
  }
}
</style>
