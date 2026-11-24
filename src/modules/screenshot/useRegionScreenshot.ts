import { computed, nextTick, onBeforeUnmount, onMounted, type Ref, ref } from 'vue'

import { capturePage, type PageCaptureOptions } from './capturePage'

export function useRegionScreenshot(
  overlay: Readonly<Ref<HTMLElement | null>>,
  onClose: () => void,
  options: Omit<PageCaptureOptions, 'signal'> = {},
) {
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const anchor = ref<{ x: number; y: number }>()
  const selection = ref<{ x: number; y: number; width: number; height: number }>()
  const dragging = ref(false)
  const saving = ref(false)
  const error = ref('')
  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  let pointerId: number | undefined
  let request: AbortController | undefined
  let disposed = false

  const selectionStyle = computed(() => ({
    left: `${selection.value?.x ?? 0}px`,
    top: `${selection.value?.y ?? 0}px`,
    width: `${selection.value?.width ?? 0}px`,
    height: `${selection.value?.height ?? 0}px`,
  }))
  const crop = computed(() => selection.value ?? { x: 0, y: 0, ...viewport })
  const canSave = computed(
    () => !dragging.value && !saving.value && crop.value.width > 0 && crop.value.height > 0,
  )

  function close() {
    request?.abort()
    onClose()
  }

  function reset() {
    selection.value = undefined
    anchor.value = undefined
    error.value = ''
    overlay.value?.focus()
  }

  function startSelection(event: PointerEvent) {
    if (event.button !== 0 || dragging.value || saving.value) return
    if ((event.target as Element).closest('button, .screenshot-controls')) return
    if (
      event.clientX < 0 ||
      event.clientX > viewport.width ||
      event.clientY < 0 ||
      event.clientY > viewport.height
    )
      return
    event.preventDefault()
    overlay.value?.focus()
    anchor.value = { x: event.clientX, y: event.clientY }
    selection.value = { ...anchor.value, width: 0, height: 0 }
    error.value = ''
    dragging.value = true
    pointerId = event.pointerId
    overlay.value?.setPointerCapture(event.pointerId)
  }

  function updateSelection(event: PointerEvent) {
    if (!dragging.value || pointerId !== event.pointerId || !anchor.value) return
    const x = Math.max(0, Math.min(event.clientX, viewport.width))
    const y = Math.max(0, Math.min(event.clientY, viewport.height))
    selection.value = {
      x: Math.min(x, anchor.value.x),
      y: Math.min(y, anchor.value.y),
      width: Math.abs(x - anchor.value.x),
      height: Math.abs(y - anchor.value.y),
    }
  }

  function endSelection(event: PointerEvent) {
    if (!dragging.value || pointerId !== event.pointerId) return
    updateSelection(event)
    dragging.value = false
    pointerId = undefined
    if (overlay.value?.hasPointerCapture(event.pointerId))
      overlay.value.releasePointerCapture(event.pointerId)
    if (!selection.value?.width || !selection.value.height) selection.value = undefined
  }

  function cancelSelection() {
    dragging.value = false
    pointerId = undefined
    selection.value = undefined
  }

  async function save() {
    if (!canSave.value || disposed) return
    const area = { ...crop.value }
    const current = new AbortController()
    request = current
    saving.value = true
    error.value = ''
    try {
      // Capture only now. The live mask is excluded by data-screenshot-ignore.
      const source = await capturePage({ ...options, signal: current.signal })
      if (disposed || current.signal.aborted) return
      const scaleX = source.width / viewport.width
      const scaleY = source.height / viewport.height
      const x = Math.round(area.x * scaleX)
      const y = Math.round(area.y * scaleY)
      const width = Math.round((area.x + area.width) * scaleX) - x
      const height = Math.round((area.y + area.height) * scaleY) - y
      const output = document.createElement('canvas')
      output.width = width
      output.height = height
      const context = output.getContext('2d')
      if (!context) throw new Error('无法创建图片画布。')
      context.drawImage(source, x, y, width, height, 0, 0, width, height)
      const blob = await new Promise<Blob>((resolve, reject) => {
        output.toBlob((result) => {
          if (result) resolve(result)
          else reject(new Error('图片导出失败，请重试。'))
        }, 'image/png')
      })
      if (disposed || current.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const now = new Date()
      const timestamp = [
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
      ]
        .map((part) => String(part).padStart(2, '0'))
        .join('')
      link.download = `页面截图_${timestamp}.png`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      close()
    } catch (cause) {
      if (!disposed && !current.signal.aborted)
        error.value = cause instanceof Error ? cause.message : '截图失败，请重试。'
    } finally {
      saving.value = false
      if (request === current) request = undefined
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      close()
    } else if (event.key === 'Enter' && event.target === overlay.value) {
      event.preventDefault()
      void save()
    } else if (event.key === 'Tab' && overlay.value) {
      const buttons = Array.from(
        overlay.value.querySelectorAll<HTMLButtonElement>('button:enabled'),
      )
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.shiftKey
        ? (index <= 0 ? buttons.length : index) - 1
        : (index + 1) % buttons.length
      event.preventDefault()
      buttons[next]?.focus()
    }
  }

  onMounted(() => {
    overlay.value?.focus()
    window.addEventListener('keydown', handleKeydown, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
  })

  onBeforeUnmount(() => {
    disposed = true
    request?.abort()
    window.removeEventListener('keydown', handleKeydown, true)
    window.removeEventListener('resize', close)
    window.removeEventListener('scroll', close, true)
    void nextTick(() => previousFocus?.isConnected && previousFocus.focus())
  })

  return {
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
  }
}
