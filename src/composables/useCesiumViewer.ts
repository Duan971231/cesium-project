import {
  buildModuleUrl,
  Cartesian3,
  Color,
  type ImageryLayer,
  Math as CesiumMath,
  TileMapServiceImageryProvider,
  Viewer,
} from 'cesium'
import { onBeforeUnmount, onMounted, onUnmounted, type Ref, ref, shallowRef, watch } from 'vue'

const initialPosition = Cartesian3.fromDegrees(105, 26, 21_500_000)

export function useCesiumViewer(
  container: Ref<HTMLElement | null>,
  credits: Ref<HTMLElement | null>,
) {
  const status = ref<'loading' | 'ready' | 'error'>('loading')
  const showImagery = ref(true)
  const showAtmosphere = ref(true)
  const camera = ref({ longitude: 0, latitude: 0, altitude: 0, heading: 0 })
  const viewer = shallowRef<Viewer | null>(null)
  let imageryLayer: ImageryLayer | undefined
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

  onMounted(async () => {
    try {
      const imagery = await TileMapServiceImageryProvider.fromUrl(
        buildModuleUrl('Assets/Textures/NaturalEarthII'),
        { credit: 'Natural Earth II' },
      )
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

      imageryLayer = instance.imageryLayers.addImageryProvider(imagery)
      instance.scene.backgroundColor = Color.fromCssColorString('#080d19')
      instance.scene.globe.baseColor = Color.fromCssColorString('#203656')
      instance.camera.percentageChanged = 0.005
      instance.camera.changed.addEventListener(updateCamera)
      instance.camera.moveEnd.addEventListener(updateCamera)
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

  watch([showImagery, showAtmosphere], ([imageryVisible, atmosphereVisible]) => {
    const scene = viewer.value?.scene
    if (!scene || !imageryLayer) return
    imageryLayer.show = imageryVisible
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

  return { viewer, status, showImagery, showAtmosphere, camera, resetView, zoom }
}
