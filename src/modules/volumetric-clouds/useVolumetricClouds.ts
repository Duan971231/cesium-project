import type { Viewer } from 'cesium'
import { type Ref, ref, watch } from 'vue'

import { createVolumetricCloudLayer } from './createVolumetricCloudLayer'
import { defaultCloudOptions, type VolumetricCloudOptions } from './options'

export function useVolumetricClouds(viewer: Ref<Viewer | null>) {
  const showClouds = ref(false)
  const cloudOptions = ref<VolumetricCloudOptions>({ ...defaultCloudOptions })
  const cloudError = ref('')

  watch([viewer, showClouds], ([instance, visible], _, onCleanup) => {
    if (!instance || !visible || instance.isDestroyed()) return
    cloudError.value = ''

    try {
      const layer = createVolumetricCloudLayer(instance.scene, cloudOptions.value)
      const stopOptions = watch(cloudOptions, (options) => layer.update(options))
      onCleanup(() => {
        stopOptions()
        layer.destroy()
      })
      layer.setEnabled(true)
    } catch (error) {
      showClouds.value = false
      cloudError.value = error instanceof Error ? error.message : '体积云初始化失败。'
    }
  })

  return { showClouds, cloudOptions, cloudError }
}
