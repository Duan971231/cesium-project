<script setup lang="ts">
import FloatingPanel from '@/components/FloatingPanel.vue'

import type { VolumetricCloudOptions } from '../options'
import { cloudOptionLimits, cloudQualityPresets, defaultCloudOptions } from '../options'

defineProps<{ suspended: boolean }>()
const options = defineModel<VolumetricCloudOptions>({ required: true })

type SliderKey = keyof typeof cloudOptionLimits
type Slider = {
  key: SliderKey
  label: string
  format: (value: number) => string
  hint?: string
}

const colors = [
  { key: 'dayColor', label: '日间云色' },
  { key: 'nightColor', label: '夜间云色' },
] as const

const sliderGroups: { name: string; open?: boolean; sliders: Slider[]; colors?: typeof colors }[] =
  [
    {
      name: '光照与颜色',
      open: true,
      colors,
      sliders: [
        { key: 'brightness', label: '整体亮度', format: formatMultiplier },
        { key: 'baseLight', label: '云底补光', format: formatPercent, hint: '越高，云底越亮。' },
        {
          key: 'sunlightInfluence',
          label: '日照影响',
          format: formatPercent,
          hint: '设为 0% 时，云层全天使用日间云色。',
        },
        {
          key: 'sunHighlight',
          label: '逆光高光',
          format: formatPercent,
          hint: '朝太阳方向观察时的提亮强度，随日照影响减弱。',
        },
      ],
    },
    {
      name: '形态与运动',
      sliders: [
        { key: 'coverage', label: '覆盖率', format: formatPercent },
        { key: 'density', label: '密度', format: formatMultiplier },
        { key: 'baseHeight', label: '云底高度', format: formatHeight },
        { key: 'thickness', label: '云层厚度', format: formatHeight },
        { key: 'cloudScale', label: '云团尺度', format: formatMultiplier },
        {
          key: 'detailStrength',
          label: '边缘细节',
          format: formatMultiplier,
          hint: '用于均衡和高画质档的近景，移动相机时暂停采样。',
        },
        { key: 'windSpeed', label: '云层移速', format: (value) => `${value} m/s` },
      ],
    },
  ]

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatMultiplier(value: number) {
  return `${value.toFixed(2)}×`
}

function formatHeight(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`
}

function updateQuality(event: Event) {
  const quality = (event.target as HTMLSelectElement).value as VolumetricCloudOptions['quality']
  options.value = { ...options.value, quality }
}

function updateSlider(key: SliderKey, event: Event) {
  options.value = { ...options.value, [key]: (event.target as HTMLInputElement).valueAsNumber }
}

function updateColor(key: (typeof colors)[number]['key'], event: Event) {
  options.value = { ...options.value, [key]: (event.target as HTMLInputElement).value }
}
</script>

<template>
  <FloatingPanel class="cloud-panel" title="体积云参数" side="right" icon="cloud">
    <div class="cloud-controls">
      <p v-if="suspended" role="status">切回 3D 后恢复渲染，可以继续调整参数。</p>
      <label>
        <span>渲染质量</span>
        <select :value="options.quality" @change="updateQuality">
          <option v-for="(quality, key) in cloudQualityPresets" :key="key" :value="key">
            {{ quality.label }}
          </option>
        </select>
      </label>
      <details v-for="group in sliderGroups" :key="group.name" :open="group.open">
        <summary>{{ group.name }}</summary>
        <div class="group-controls">
          <label v-for="slider in group.sliders" :key="slider.key" :title="slider.hint">
            <span>
              {{ slider.label }} <output>{{ slider.format(options[slider.key]) }}</output>
            </span>
            <input
              :value="options[slider.key]"
              type="range"
              v-bind="cloudOptionLimits[slider.key]"
              :aria-label="slider.label"
              :aria-description="slider.hint"
              :aria-valuetext="slider.format(options[slider.key])"
              @input="updateSlider(slider.key, $event)"
            />
          </label>
          <label v-for="color in group.colors" :key="color.key" class="color-control">
            <span>{{ color.label }}</span>
            <input
              :value="options[color.key]"
              type="color"
              @input="updateColor(color.key, $event)"
            />
          </label>
        </div>
      </details>
      <button type="button" class="reset-button" @click="options = { ...defaultCloudOptions }">
        恢复默认
      </button>
    </div>
  </FloatingPanel>
</template>

<style scoped>
.cloud-panel {
  top: 78px;
}

.cloud-panel :deep(.panel-content) {
  max-height: max(100px, calc(100dvh - 245px));
}

.cloud-controls {
  display: grid;
  gap: 12px;
  padding: 4px 5px;
  color: #dbe5f6;
  font-size: 0.75rem;
}

.cloud-controls label {
  display: grid;
  gap: 5px;
}

.cloud-controls label > span {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.cloud-controls output {
  color: #a8cfff;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.cloud-controls input[type='range'] {
  width: 100%;
  margin: 0;
  accent-color: #81b9ff;
}

.cloud-controls details {
  border-top: 1px solid #34445e;
}

.cloud-controls summary {
  padding-block: 8px 2px;
  color: #b8d4ff;
  cursor: pointer;
  font-weight: 600;
}

.group-controls {
  display: grid;
  gap: 10px;
  margin-top: 9px;
}

.cloud-controls .color-control {
  grid-template-columns: 1fr auto;
  align-items: center;
}

.color-control input {
  width: 36px;
  height: 24px;
  border: 1px solid #34445e;
  border-radius: 5px;
  padding: 2px;
  background: #17243b;
  cursor: pointer;
}

.cloud-controls select,
.reset-button {
  width: 100%;
  min-width: 0;
  border: 1px solid #34445e;
  border-radius: 6px;
  padding: 6px;
  background: #17243b;
  color: inherit;
  font: inherit;
}

.reset-button:hover {
  background: #253654;
}

.cloud-controls p {
  margin: 0;
  color: #aabbd4;
  line-height: 1.5;
}

@media (max-width: 580px) {
  .cloud-panel {
    top: 64px;
  }
}
</style>
