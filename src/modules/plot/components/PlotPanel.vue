<script setup lang="ts">
import type { Viewer } from 'cesium'
import { computed, nextTick, ref, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import {
  defaultPlotStyle,
  PlotController,
  plotShapes,
  type PlotState,
  type PlotStyle,
  type PlotType,
} from '@/modules/plot'

import { plotToolEntries } from './plotTools'

const props = defineProps<{ viewer: Viewer | null }>()
const state = ref<PlotState>({ mode: 'idle' })
const defaults = ref<PlotStyle>({ ...defaultPlotStyle })
const showStyle = ref(false)
const textInput = ref<HTMLTextAreaElement | null>(null)
let controller: PlotController | undefined

const activeType = computed(() => ('type' in state.value ? state.value.type : undefined))
const style = computed(() => ('style' in state.value ? state.value.style : defaults.value))
const shapeKind = computed(() => activeType.value && plotShapes[activeType.value].kind)
const activeTool = computed(() => plotToolEntries.find(([type]) => type === activeType.value)?.[1])
const plotText = computed({
  get: () => ('text' in state.value ? state.value.text : ''),
  set: (text) => controller?.updateText(text),
})
const emptyText = computed(() => shapeKind.value === 'text' && !plotText.value.trim())
const message = computed(() => {
  if (!props.viewer) return '地球就绪后可开始标绘。'
  if (state.value.mode === 'deleting') return '点击图形删除。按 Esc 或右键退出。'
  if (shapeKind.value === 'text') {
    if (emptyText.value) return '请输入文本内容。'
    return state.value.mode === 'editing'
      ? '可修改文本，或拖动白色控制点移动位置。'
      : '单击地图放置文本。'
  }
  if (state.value.mode === 'editing') return '拖动白色控制点修改图形。'
  if (state.value.mode === 'idle') return '选择图形开始绘制，点击已有图形可编辑。'

  const { input, minimumPoints } = plotShapes[state.value.type]
  const hint = activeTool.value?.hint
  if (state.value.invalid) {
    return input === 'fixed'
      ? '这些点无法形成有效图形，请重新选择最后一个点。'
      : '当前轮廓无效，请撤回控制点后重画。'
  }
  if (input === 'freehand') return '单击起点，移动鼠标描绘，再单击或右键结束。'
  if (input === 'fixed') return hint ?? `在地球表面选择 ${minimumPoints} 个点。`
  return `${hint ?? `至少选择 ${minimumPoints} 个点。`}右键或点「完成」结束。`
})

watch(
  () => props.viewer,
  (viewer, _, cleanup) => {
    state.value = { mode: 'idle' }
    if (!viewer) return
    const plot = new PlotController(viewer, (next) => {
      state.value = next
    })
    controller = plot
    cleanup(() => {
      plot.destroy()
      controller = undefined
    })
  },
  { immediate: true },
)

function selectTool(type: PlotType) {
  controller?.start(type, defaults.value)
  if (type === 'text') void nextTick(() => textInput.value?.focus())
}

function updateStyle<K extends keyof PlotStyle>(key: K, value: PlotStyle[K]) {
  const change = { [key]: value } as Pick<PlotStyle, K>
  if ('style' in state.value) controller?.updateStyle(change)
  else defaults.value = { ...defaults.value, ...change }
}

function readValue(event: Event) {
  return (event.target as HTMLInputElement).value
}

function readNumber(event: Event) {
  return (event.target as HTMLInputElement).valueAsNumber
}

function toggleDelete() {
  if (state.value.mode === 'deleting') controller?.stop()
  else controller?.startDeleting()
}
</script>

<template>
  <div class="plot-panel">
    <div class="panel-head">
      <h2>标绘</h2>
      <div class="panel-actions">
        <button type="button" :aria-expanded="showStyle" @click="showStyle = !showStyle">
          <AppIcon name="tools" />
          样式
        </button>
        <button
          type="button"
          class="delete-tool"
          :aria-pressed="state.mode === 'deleting'"
          :disabled="!viewer"
          @click="toggleDelete"
        >
          <AppIcon name="trash" />
          删除
        </button>
      </div>
    </div>

    <label v-if="shapeKind === 'text'" class="plot-text">
      文本内容
      <textarea ref="textInput" v-model="plotText" rows="2" />
    </label>

    <fieldset v-if="showStyle && shapeKind === 'text'" class="style-fields">
      <legend>文本样式</legend>
      <label>
        字体颜色
        <input
          type="color"
          :value="style.textColor ?? defaultPlotStyle.textColor"
          @input="updateStyle('textColor', readValue($event))"
        />
      </label>
      <label>
        字号
        <input
          type="range"
          min="10"
          max="48"
          :value="style.textSize ?? defaultPlotStyle.textSize"
          @input="updateStyle('textSize', readNumber($event))"
        />
      </label>
    </fieldset>
    <fieldset v-else-if="showStyle" class="style-fields" :disabled="state.mode === 'deleting'">
      <legend>
        {{
          state.mode === 'editing'
            ? '选中图形'
            : state.mode === 'drawing'
              ? '当前图形'
              : '新图形样式'
        }}
      </legend>
      <label
        >{{ shapeKind === 'point' ? '点颜色' : '线条颜色' }}
        <input
          type="color"
          :value="style.strokeColor"
          @input="updateStyle('strokeColor', readValue($event))"
        />
      </label>
      <label v-if="shapeKind !== 'point'"
        >线宽
        <input
          type="range"
          min="1"
          max="16"
          :value="style.strokeWidth"
          @input="updateStyle('strokeWidth', readNumber($event))"
        />
        <output>{{ style.strokeWidth }} px</output>
      </label>
      <label v-if="!shapeKind || shapeKind === 'area'"
        >填充颜色
        <input
          type="color"
          :value="style.fillColor"
          @input="updateStyle('fillColor', readValue($event))"
        />
      </label>
      <label v-if="!shapeKind || shapeKind === 'area'"
        >填充不透明度
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="style.fillOpacity"
          @input="updateStyle('fillOpacity', readNumber($event))"
        />
        <output>{{ Math.round(style.fillOpacity * 100) }}%</output>
      </label>
      <label v-if="!shapeKind || shapeKind === 'point'"
        >点大小
        <input
          type="range"
          min="4"
          max="36"
          :value="style.pointSize"
          @input="updateStyle('pointSize', readNumber($event))"
        />
        <output>{{ style.pointSize }} px</output>
      </label>
    </fieldset>

    <div class="shape-tools" role="group" aria-label="标绘图形">
      <button
        v-for="[type, tool] in plotToolEntries"
        :key="type"
        type="button"
        :aria-label="`绘制${tool.label}`"
        :aria-pressed="activeType === type"
        :disabled="!viewer"
        @click="selectTool(type)"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            :d="tool.path"
            :fill="tool.filled ? 'currentColor' : 'none'"
            :fill-opacity="type === 'point' ? 1 : 0.24"
          />
        </svg>
        <span>{{ tool.label }}</span>
      </button>
    </div>

    <p class="plot-hint" role="status">{{ message }}</p>
    <div v-if="state.mode !== 'idle'" class="plot-actions">
      <button
        v-if="state.mode === 'drawing' || state.mode === 'deleting'"
        type="button"
        @click="controller?.stop()"
      >
        {{ state.mode === 'deleting' ? '退出删除' : '取消' }}
      </button>
      <button
        v-if="state.mode === 'drawing' && state.pointCount > 0"
        type="button"
        @click="controller?.undoLastPoint()"
      >
        撤回上一点
      </button>
      <button
        v-if="state.mode === 'drawing' && plotShapes[state.type].input !== 'fixed'"
        type="button"
        :disabled="!state.canFinish"
        @click="controller?.finish()"
      >
        完成
      </button>
      <button
        v-else-if="state.mode === 'editing'"
        type="button"
        :disabled="emptyText"
        @click="controller?.finish()"
      >
        完成编辑
      </button>
    </div>
  </div>
</template>

<style scoped>
.plot-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.panel-head,
.panel-actions,
.plot-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-head {
  justify-content: space-between;
}

.panel-head h2 {
  margin: 0;
  font-size: 0.9rem;
}

.plot-panel button {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid #34486a;
  border-radius: 7px;
  padding: 0 8px;
  color: #dfebff;
  font-size: 0.78rem;
}

.plot-panel button:enabled:hover,
.plot-panel button[aria-pressed='true'],
.plot-panel button[aria-expanded='true'] {
  border-color: #6b9de6;
  background: #263c5e;
}

.plot-panel button:disabled {
  opacity: 0.55;
}

.plot-panel .delete-tool[aria-pressed='true'] {
  border-color: #c66b82;
  background: #4b2536;
  color: #ffd6df;
}

.panel-actions svg {
  width: 15px;
}

.shape-tools {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  max-height: 52dvh;
  overflow: auto;
  scrollbar-width: thin;
  padding: 3px;
  margin: -3px;
}

.shape-tools button {
  display: grid;
  min-height: 51px;
  align-content: center;
  justify-items: center;
  gap: 2px;
  padding: 4px 2px;
  white-space: nowrap;
}

.shape-tools svg {
  width: 23px;
  color: #9ac4ff;
}

.style-fields {
  display: grid;
  min-width: 0;
  margin: 0;
  border: 1px solid #34486a;
  border-radius: 7px;
  padding: 4px 8px 8px;
  color: #cbdaf0;
  font-size: 0.75rem;
}

.style-fields label {
  display: flex;
  min-height: 26px;
  align-items: center;
  gap: 5px;
}

.style-fields input {
  width: 70px;
  margin-left: auto;
  accent-color: #87b6ff;
}

.style-fields input[type='color'] {
  width: 32px;
  height: 23px;
  padding: 0;
  border: 0;
  background: transparent;
}

.style-fields output {
  min-width: 2.75rem;
  text-align: right;
}

.plot-text {
  display: grid;
  gap: 4px;
  color: #cbdaf0;
  font-size: 0.78rem;
}

.plot-text textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid #34486a;
  border-radius: 7px;
  padding: 6px 8px;
  background: #0c1628;
  color: #dfebff;
  font: inherit;
  line-height: 1.45;
}

.plot-text textarea:focus-visible {
  outline: 2px solid #6b9de6;
  outline-offset: -1px;
}

.plot-hint {
  margin: 0;
  color: #bbcae1;
  font-size: 0.78rem;
  line-height: 1.5;
}

.plot-actions {
  justify-content: flex-end;
}
</style>
