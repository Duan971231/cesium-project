<script setup lang="ts">
import { onMounted, onUnmounted, ref, useId, useTemplateRef, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'

const props = defineProps<{ title: string; side: 'left' | 'right'; icon: 'draw' | 'layers' }>()

const panel = useTemplateRef('panel')
const contentId = useId()
const collapsed = ref(false)
const offset = ref({ x: 0, y: 0 })
let drag: { id: number; x: number; y: number } | undefined

function constrain(x: number, y: number) {
  const element = panel.value
  const boundary = element?.parentElement
  if (!element || !boundary) return

  offset.value = {
    x: Math.max(
      -element.offsetLeft,
      Math.min(x, boundary.clientWidth - element.offsetWidth - element.offsetLeft),
    ),
    y: Math.max(
      -element.offsetTop,
      Math.min(y, boundary.clientHeight - element.offsetHeight - element.offsetTop),
    ),
  }
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || drag) return
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  drag = {
    id: event.pointerId,
    x: event.clientX - offset.value.x,
    y: event.clientY - offset.value.y,
  }
}

function moveDrag(event: PointerEvent) {
  if (drag?.id !== event.pointerId) return
  constrain(event.clientX - drag.x, event.clientY - drag.y)
}

function endDrag(event: PointerEvent) {
  if (drag?.id === event.pointerId) drag = undefined
}

function resetPosition() {
  offset.value = { x: 0, y: 0 }
}

watch(collapsed, () => constrain(offset.value.x, offset.value.y), { flush: 'post' })
onMounted(() => window.addEventListener('resize', resetPosition))
onUnmounted(() => window.removeEventListener('resize', resetPosition))
</script>

<template>
  <aside
    ref="panel"
    class="floating-panel"
    :class="`panel-${props.side}`"
    :aria-label="title"
    :style="{ transform: `translate(${offset.x}px, ${offset.y}px)` }"
  >
    <header>
      <div
        class="drag-handle"
        title="拖动面板"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @lostpointercapture="endDrag"
      >
        <AppIcon name="grip" class="grip" />
        <AppIcon :name="icon" class="section-icon" />
        <h2>{{ title }}</h2>
      </div>
      <button
        type="button"
        class="collapse-button"
        :aria-label="`${collapsed ? '展开' : '收起'}${title}`"
        :aria-controls="contentId"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <AppIcon name="chevron" :class="{ collapsed }" />
      </button>
    </header>
    <div v-show="!collapsed" :id="contentId" class="panel-content">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.floating-panel {
  position: absolute;
  top: 24px;
  width: 210px;
  overflow: hidden;
  border: 1px solid #334364;
  border-radius: 12px;
  background: #111a2bed;
  box-shadow: 0 8px 28px #01040c66;
  backdrop-filter: blur(18px);
  pointer-events: auto;
}

.floating-panel:focus-within,
.floating-panel:has(.drag-handle:active) {
  z-index: 1;
}

.panel-left {
  left: 22px;
}

.panel-right {
  right: 22px;
}

header,
.drag-handle {
  display: flex;
  align-items: center;
}

header {
  padding-right: 9px;
}

.drag-handle {
  flex: 1;
  gap: 8px;
  min-width: 0;
  padding: 13px 0 13px 9px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

h2 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}

.grip {
  width: 14px;
  color: #71829f;
}

.section-icon {
  width: 17px;
  color: #8ab8ff;
}

.collapse-button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 6px;
  color: #adbed8;
}

.collapse-button:hover {
  background: #253654;
}

.collapse-button svg {
  width: 16px;
  transform: rotate(180deg);
}

.collapse-button svg.collapsed {
  transform: none;
}

.panel-content {
  border-top: 1px solid #52658942;
  padding: 8px;
}

@media (max-width: 580px) {
  .floating-panel {
    top: 12px;
    width: min(43vw, 190px);
  }

  .panel-left {
    left: 10px;
  }

  .panel-right {
    right: 10px;
  }

  header {
    padding-right: 3px;
  }

  .drag-handle {
    gap: 4px;
    padding-left: 5px;
  }
}
</style>
