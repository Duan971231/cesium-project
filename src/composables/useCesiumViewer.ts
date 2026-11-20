import {
  buildModuleUrl,
  Cartesian3,
  Color,
  type ImageryLayer,
  Math as CesiumMath,
  TileMapServiceImageryProvider,
  Viewer,
} from 'cesium'
import { onBeforeUnmount, onMounted, type Ref, ref, watch } from 'vue'

const initialPosition = Cartesian3.fromDegrees(105, 26, 21_500_000)

export function useCesiumViewer(
  container: Ref<HTMLElement | null>,
  credits: Ref<HTMLElement | null>,
) {
  const status = ref<'loading' | 'ready' | 'error'>('loading')
  const showImagery = ref(true)
  const showAtmosphere = ref(true)
  const camera = ref({ longitude: 0, latitude: 0, altitude: 0, heading: 0 })
  let viewer: Viewer | undefined
  let imageryLayer: ImageryLayer | undefined
  let disposed = false

  function updateCamera() {
    if (!viewer) return
    const position = viewer.camera.positionCartographic
    camera.value = {
      longitude: CesiumMath.toDegrees(position.longitude),
      latitude: CesiumMath.toDegrees(position.latitude),
      altitude: position.height / 1000,
      heading: CesiumMath.toDegrees(viewer.camera.heading),
    }
  }

  function resetView() {
    viewer?.camera.setView({ destination: initialPosition })
    updateCamera()
  }

  function zoom(direction: 'in' | 'out') {
    if (!viewer) return
    const amount = Math.max(0, viewer.camera.positionCartographic.height * 0.22)
    if (direction === 'in') viewer.camera.zoomIn(amount)
    else viewer.camera.zoomOut(amount)
    updateCamera()
  }

  onMounted(async () => {
    try {
      const imagery = await TileMapServiceImageryProvider.fromUrl(
        buildModuleUrl('Assets/Textures/NaturalEarthII'),
        { credit: 'Natural Earth II' },
      )
      if (!container.value || !credits.value || disposed) return

      viewer = new Viewer(container.value, {
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

      imageryLayer = viewer.imageryLayers.addImageryProvider(imagery)
      viewer.scene.backgroundColor = Color.fromCssColorString('#080d19')
      viewer.scene.globe.baseColor = Color.fromCssColorString('#203656')
      viewer.camera.percentageChanged = 0.005
      viewer.camera.changed.addEventListener(updateCamera)
      viewer.camera.moveEnd.addEventListener(updateCamera)
      resetView()

      status.value = 'ready'
    } catch (error) {
      if (disposed) return
      viewer?.destroy()
      viewer = undefined
      status.value = 'error'
      console.error('Cesium 初始化失败', error)
    }
  })

  watch([showImagery, showAtmosphere], ([imageryVisible, atmosphereVisible]) => {
    if (!viewer || !imageryLayer) return
    imageryLayer.show = imageryVisible
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = atmosphereVisible
    viewer.scene.globe.showGroundAtmosphere = atmosphereVisible
    viewer.scene.requestRender()
  })

  onBeforeUnmount(() => {
    disposed = true
    viewer?.destroy()
    viewer = undefined
  })

  return { status, showImagery, showAtmosphere, camera, resetView, zoom }
}
