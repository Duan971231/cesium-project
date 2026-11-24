import { Cartesian3, Color, Math as CesiumMath, Viewer } from 'cesium'
import { onBeforeUnmount, onMounted, onUnmounted, type Ref, ref, shallowRef, watch } from 'vue'

import { useMapControls } from '@/modules/map/useMapControls'

const initialPosition = Cartesian3.fromDegrees(105, 26, 21_500_000)

export function useCesiumViewer(
  container: Ref<HTMLElement | null>,
  credits: Ref<HTMLElement | null>,
) {
  const status = ref<'loading' | 'ready' | 'error'>('loading')
  const showAtmosphere = ref(true)
  const camera = ref({ longitude: 0, latitude: 0, altitude: 0, heading: 0 })
  const viewer = shallowRef<Viewer | null>(null)
  const mapControls = useMapControls(viewer)
  let disposed = false

  function updateCamera() {
    const activeCamera = viewer.value?.camera
    if (!activeCamera) return
    const position = activeCamera.positionCartographic
    camera.value = {
      longitude: CesiumMath.toDegrees(position.longitude),
      latitude: CesiumMath.toDegrees(position.latitude),
      altitude: position.height / 1000,
      heading: CesiumMath.toDegrees(activeCamera.heading),
    }
  }

  function resetView() {
    viewer.value?.camera.setView({ destination: initialPosition })
    updateCamera()
  }

  function zoom(direction: 'in' | 'out') {
    const activeCamera = viewer.value?.camera
    if (!activeCamera) return
    const amount = Math.max(0, activeCamera.positionCartographic.height * 0.22)
    if (direction === 'in') activeCamera.zoomIn(amount)
    else activeCamera.zoomOut(amount)
    updateCamera()
  }

  onMounted(() => {
    try {
      if (!container.value || !credits.value || disposed) return

      const instance = new Viewer(container.value, {
        animation: false,
        baseLayer: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        creditContainer: credits.value,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
      })
      viewer.value = instance

      instance.scene.backgroundColor = Color.fromCssColorString('#080d19')
      instance.scene.globe.baseColor = Color.fromCssColorString('#203656')
      instance.camera.percentageChanged = 0.005
      instance.camera.changed.addEventListener(updateCamera)
      instance.camera.moveEnd.addEventListener(updateCamera)
      instance.scene.morphComplete.addEventListener(updateCamera)
      resetView()

      status.value = 'ready'
    } catch (error) {
      if (disposed) return
      viewer.value?.destroy()
      viewer.value = null
      status.value = 'error'
      console.error('Cesium 初始化失败', error)
    }
  })

  watch(showAtmosphere, (atmosphereVisible) => {
    const scene = viewer.value?.scene
    if (!scene) return
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = atmosphereVisible
    scene.globe.showGroundAtmosphere = atmosphereVisible
    scene.requestRender()
  })

  onBeforeUnmount(() => {
    disposed = true
  })

  onUnmounted(() => {
    viewer.value?.destroy()
    viewer.value = null
  })

  return { viewer, status, showAtmosphere, camera, resetView, zoom, ...mapControls }
}
