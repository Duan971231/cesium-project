import {
  Cartesian2,
  Cartesian3,
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  HeadingPitchRange,
  type ImageryLayer,
  Math as CesiumMath,
  Matrix4,
  SceneMode,
  UrlTemplateImageryProvider,
  type Viewer,
} from 'cesium'
import { onScopeDispose, type Ref, ref, watch } from 'vue'

export const baseMaps = [
  {
    id: 'road',
    label: '高德电子地图',
    url: 'http://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
  },
  {
    id: 'satellite',
    label: '高德卫星影像',
    url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
  },
] as const

export const terrainUrl = 'http://127.0.0.1/terrain/'
export const sceneModes = ['2D', '2.5D', '3D'] as const
export type MapSceneMode = (typeof sceneModes)[number]

export function useMapControls(viewer: Ref<Viewer | null>) {
  const baseMap = ref<(typeof baseMaps)[number]['id']>('road')
  const showImagery = ref(true)
  const showTerrain = ref(false)
  const terrainLoading = ref(false)
  const terrainError = ref('')
  const imageryError = ref('')
  const sceneMode = ref<MapSceneMode>('3D')
  const morphing = ref(false)
  const flatTerrain = new EllipsoidTerrainProvider()
  let terrain: CesiumTerrainProvider | undefined
  let imageryLayer: ImageryLayer | undefined
  let terrainRequest = 0
  let removeImageryError: (() => void) | undefined
  let removeTerrainError: (() => void) | undefined
  let removeMorphStart: (() => void) | undefined
  let removeMorphComplete: (() => void) | undefined

  watch([viewer, baseMap], ([instance]) => {
    if (!instance) return
    const source = baseMaps.find((item) => item.id === baseMap.value)!
    // HTTPS pages cannot request the supplied HTTP road tiles.
    const url = location.protocol === 'https:' ? source.url.replace(/^http:/, 'https:') : source.url
    const provider = new UrlTemplateImageryProvider({
      url,
      maximumLevel: 18,
      credit: '© 高德地图',
    })
    removeImageryError?.()
    imageryError.value = ''
    removeImageryError = provider.errorEvent.addEventListener(() => {
      imageryError.value = '底图瓦片加载失败，请检查网络或切换底图。'
    })
    const previousLayer = imageryLayer
    imageryLayer = instance.imageryLayers.addImageryProvider(provider, 0)
    imageryLayer.show = showImagery.value
    if (previousLayer) instance.imageryLayers.remove(previousLayer, true)
    instance.scene.requestRender()
  })

  watch(showImagery, (visible) => {
    if (imageryLayer) imageryLayer.show = visible
    viewer.value?.scene.requestRender()
  })

  watch(
    [viewer, showTerrain],
    async ([instance, enabled]) => {
      const request = ++terrainRequest
      terrainLoading.value = false
      terrainError.value = ''
      if (!instance) return
      if (!enabled) {
        instance.terrainProvider = flatTerrain
        instance.scene.requestRender()
        return
      }

      terrainLoading.value = true
      try {
        const provider = terrain ?? (await CesiumTerrainProvider.fromUrl(terrainUrl))
        // Ignore pending requests after disabling terrain or leaving the page.
        if (request !== terrainRequest || instance.isDestroyed()) return
        terrain = provider
        removeTerrainError?.()
        removeTerrainError = provider.errorEvent.addEventListener(() => {
          if (instance.isDestroyed() || instance.terrainProvider !== provider) return
          showTerrain.value = false
          terrain = undefined
          terrainError.value = '高程瓦片加载失败，已恢复平面地形。'
        })
        instance.terrainProvider = provider
        instance.scene.requestRender()
      } catch (error) {
        if (request !== terrainRequest || instance.isDestroyed()) return
        showTerrain.value = false
        terrainError.value = '高程加载失败，请检查地形服务及跨域配置。'
        console.error('Cesium terrain 加载失败', error)
      } finally {
        if (request === terrainRequest) terrainLoading.value = false
      }
    },
    { flush: 'sync' },
  )

  watch(viewer, (instance) => {
    removeMorphStart?.()
    removeMorphComplete?.()
    if (!instance) return
    removeMorphStart = instance.scene.morphStart.addEventListener(() => {
      morphing.value = true
    })
    removeMorphComplete = instance.scene.morphComplete.addEventListener(() => {
      sceneMode.value =
        instance.scene.mode === SceneMode.SCENE2D
          ? '2D'
          : instance.scene.mode === SceneMode.COLUMBUS_VIEW
            ? '2.5D'
            : '3D'
      morphing.value = false
      instance.scene.requestRender()
    })
  })

  function setSceneMode(mode: MapSceneMode) {
    const instance = viewer.value
    if (!instance || morphing.value || mode === sceneMode.value) return
    // A zero-duration morph keeps the current region instead of flying to the world view.
    if (mode === '2D') instance.scene.morphTo2D(0)
    else if (mode === '3D') instance.scene.morphTo3D(0)
    else {
      const { camera, scene, canvas } = instance
      const center = new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
      const ray = camera.getPickRay(center)
      const position = camera.positionCartographic
      const target =
        (ray && scene.globe.pick(ray, scene)) ??
        camera.pickEllipsoid(center, scene.ellipsoid) ??
        Cartesian3.fromRadians(position.longitude, position.latitude, 0, scene.ellipsoid)
      const range = Math.max(position.height, 1) * Math.SQRT2
      const heading = camera.heading
      scene.morphToColumbusView(0)
      // Give the flat map an oblique view while keeping the visible center in focus.
      camera.lookAt(target, new HeadingPitchRange(heading, CesiumMath.toRadians(-45), range))
      camera.lookAtTransform(Matrix4.IDENTITY)
    }
    instance.scene.requestRender()
  }

  onScopeDispose(() => {
    ++terrainRequest
    removeImageryError?.()
    removeTerrainError?.()
    removeMorphStart?.()
    removeMorphComplete?.()
  })

  return {
    baseMap,
    showImagery,
    showTerrain,
    terrainLoading,
    terrainError,
    imageryError,
    sceneMode,
    morphing,
    setSceneMode,
  }
}
