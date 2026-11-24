import type { Viewer } from 'cesium'
import { computed, type Ref, ref, watch } from 'vue'

import { GpuWindRenderer } from './gpu/GpuWindRenderer'
import { WindField } from './WindField'
import { WindRenderer } from './WindRenderer'

export function useWindLayer(viewer: Ref<Viewer | null>, canvas: Ref<HTMLCanvasElement | null>) {
  const showWind = ref(false)
  const windLoading = ref(false)
  const windError = ref('')
  const windTime = ref('')
  const windDensity = ref(4096)
  const windSpeed = ref(1)
  const windEngine = ref<'auto' | 'gpu' | 'canvas'>('auto')
  const windBackend = ref<'GPU' | 'Canvas' | ''>('')
  const windWarning = ref('')
  const windFps = ref(0)
  const windP95 = ref(0)
  const windDensityMax = computed(() => (windBackend.value === 'Canvas' ? 3000 : 16384))
  const windTimeLabel = computed(() => windTime.value.replace('T', ' ').replace(':00.000Z', ' UTC'))
  let cached: WindField | undefined
  let renderer: WindRenderer | GpuWindRenderer | undefined

  watch(
    [viewer, canvas, showWind, windEngine],
    async ([instance, element, enabled, engine], _, onCleanup) => {
      windLoading.value = false
      if (!instance || !element || !enabled) return
      const controller = new AbortController()
      let stopped = false
      let removeRenderError: (() => void) | undefined
      let monitor = 0
      let previousFrame = 0
      let reportedAt = 0
      const intervals: number[] = []
      const measureFrame = (now: number) => {
        if (stopped) return
        if (previousFrame && !document.hidden) intervals.push(now - previousFrame)
        previousFrame = now
        if (now - reportedAt >= 1000 && intervals.length) {
          const sum = intervals.reduce((total, value) => total + value, 0)
          windFps.value = Math.round((intervals.length * 1000) / sum)
          intervals.sort((a, b) => a - b)
          windP95.value = Number(
            intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * 0.95))]!.toFixed(
              1,
            ),
          )
          intervals.length = 0
          reportedAt = now
        }
        monitor = requestAnimationFrame(measureFrame)
      }
      const dispose = () => {
        if (renderer instanceof GpuWindRenderer) renderer.remove()
        else renderer?.destroy()
        renderer = undefined
      }
      onCleanup(() => {
        stopped = true
        controller.abort()
        cancelAnimationFrame(monitor)
        removeRenderError?.()
        dispose()
      })
      windLoading.value = true
      windError.value = ''
      windWarning.value = ''
      try {
        if (!cached) {
          const response = await fetch(`${import.meta.env.BASE_URL}wind/gfs-10m.json`, {
            signal: controller.signal,
          })
          if (!response.ok) throw new Error(`风场文件请求失败 (${response.status})`)
          const data: unknown = await response.json()
          if (stopped) return
          cached = new WindField(data)
        }
        if (stopped || instance.isDestroyed()) return
        windTime.value = cached.validTime
        const startCanvas = () => {
          dispose()
          windDensity.value = Math.min(windDensity.value, 3000)
          renderer = new WindRenderer(instance, element, cached!)
          windBackend.value = 'Canvas'
          renderer.density = windDensity.value
          renderer.speed = windSpeed.value
        }
        if (engine !== 'canvas') {
          try {
            renderer = new GpuWindRenderer(instance, cached)
            windBackend.value = 'GPU'
          } catch (error) {
            if (engine === 'gpu') throw error
            windWarning.value = '当前设备已自动使用兼容模式。'
            console.warn('GPU wind fallback', error)
            startCanvas()
          }
        } else startCanvas()
        if (renderer) {
          renderer.density = windDensity.value
          renderer.speed = windSpeed.value
        }
        removeRenderError = instance.scene.renderError.addEventListener((_scene, error) => {
          if (stopped || !(renderer instanceof GpuWindRenderer)) return
          console.error('GPU wind rendering failed', error)
          if (engine === 'gpu') {
            dispose()
            windError.value = 'GPU 风场绘制失败，请选择自动或兼容模式。'
            showWind.value = false
          } else {
            windWarning.value = 'GPU 绘制不可用，已切换到兼容模式。'
            startCanvas()
          }
          requestAnimationFrame(() => {
            if (instance.isDestroyed()) return
            instance.useDefaultRenderLoop = true
            instance.scene.requestRender()
          })
        })
        windFps.value = 0
        windP95.value = 0
        monitor = requestAnimationFrame(measureFrame)
      } catch (error) {
        if (stopped) return
        windError.value = error instanceof Error ? error.message : '风场加载失败'
        showWind.value = false
      } finally {
        if (!stopped) windLoading.value = false
      }
    },
    { flush: 'post' },
  )

  watch([windDensity, windSpeed], ([density, speed]) => {
    if (!renderer) return
    renderer.density = density
    renderer.speed = speed
  })

  return {
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
  }
}
