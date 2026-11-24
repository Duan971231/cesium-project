import {
  Cartesian2,
  Cartesian3,
  Color,
  createGuid,
  PostProcessStage,
  PostProcessStageComposite,
  type Scene,
  SceneMode,
} from 'cesium'

import compositeShader from './composite.glsl?raw'
import { getCloudNoiseAtlas } from './noiseAtlas'
import {
  cloudQualityPresets,
  defaultCloudOptions,
  normalizeCloudOptions,
  type VolumetricCloudOptions,
} from './options'
import raymarchShader from './raymarch.glsl?raw'

const animationInterval = 1000 / 30

interface DepthContext {
  readonly defaultTexture: unknown
  readonly uniformState: { globeDepthTexture?: unknown }
}

export function createVolumetricCloudLayer(
  scene: Scene,
  initialOptions: Partial<VolumetricCloudOptions> = {},
) {
  if (!scene.pickPositionSupported) throw new Error('当前环境不支持体积云所需的场景深度纹理。')

  let options = normalizeCloudOptions({ ...defaultCloudOptions, ...initialOptions })
  let stage: PostProcessStageComposite | undefined
  let timer: number | undefined
  let lastTick = 0
  let windAngle = 0
  let moving = false
  let enabled = false
  let destroyed = false
  const dayColor = new Color()
  const nightColor = new Color()
  Color.fromCssColorString(options.dayColor, dayColor)
  Color.fromCssColorString(options.nightColor, nightColor)
  const windRotation = new Cartesian2(1, 0)
  const radii = scene.ellipsoid.radii
  const radiiKm = Cartesian3.multiplyByScalar(radii, 0.001, new Cartesian3())
  // Cesium's packed globe depth can be absent when all geometry is outside the view.
  const { context } = scene as Scene & { readonly context: DepthContext }
  const hasSceneDepth = () => Boolean(context.uniformState.globeDepthTexture)

  function createStage() {
    const profile = cloudQualityPresets[options.quality]
    const volume = new PostProcessStage({
      name: `cloud-volume-${createGuid()}`,
      textureScale: profile.resolution,
      clearColor: Color.TRANSPARENT,
      fragmentShader: raymarchShader,
      uniforms: {
        u_noiseAtlas: getCloudNoiseAtlas(),
        u_globeDepthTexture: () => context.uniformState.globeDepthTexture ?? context.defaultTexture,
        u_hasSceneDepth: hasSceneDepth,
        u_radiiKm: radiiKm,
        u_windRotation: windRotation,
        u_baseKm: () => options.baseHeight * 0.001,
        u_thicknessKm: () => options.thickness * 0.001,
        u_coverage: () => options.coverage,
        u_density: () => options.density,
        u_shapeFrequency: () => 1 / (280 * options.cloudScale),
        u_detailStrength: () => options.detailStrength,
        u_brightness: () => options.brightness,
        u_baseLight: () => options.baseLight,
        u_sunlightInfluence: () => options.sunlightInfluence,
        u_sunHighlight: () => options.sunHighlight,
        u_dayColor: dayColor,
        u_nightColor: nightColor,
        u_steps: () => (moving ? profile.movingSteps : profile.steps),
        u_detail: () => profile.detail && !moving && options.detailStrength > 0,
        u_readGlobeDepth: () => Boolean(scene.globe?.show),
      },
    })

    return new PostProcessStageComposite({
      inputPreviousStageTexture: false,
      stages: [
        volume,
        new PostProcessStage({
          fragmentShader: compositeShader,
          uniforms: { u_cloudTexture: volume.name, u_hasSceneDepth: hasSceneDepth },
        }),
      ],
    })
  }

  function stopAnimation() {
    window.clearTimeout(timer)
    timer = undefined
  }

  function advanceAnimation() {
    timer = undefined
    if (!stage || scene.isDestroyed() || document.hidden || options.windSpeed === 0) return
    const now = performance.now()
    const seconds = Math.min((now - lastTick) / 1000, 0.15)
    lastTick = now
    windAngle += (options.windSpeed * seconds) / radii.x
    windRotation.x = Math.cos(windAngle)
    windRotation.y = Math.sin(windAngle)
    scene.requestRender()
    timer = window.setTimeout(advanceAnimation, animationInterval)
  }

  function syncAnimation() {
    if (!stage || options.windSpeed === 0 || document.hidden) stopAnimation()
    else if (timer === undefined) {
      lastTick = performance.now()
      timer = window.setTimeout(advanceAnimation, animationInterval)
    }
  }

  function removeStage() {
    if (!stage) return
    if (!scene.isDestroyed()) scene.postProcessStages.remove(stage)
    stage = undefined
  }

  function syncScene() {
    if (destroyed || scene.isDestroyed()) return
    if (enabled && options.coverage > 0 && scene.mode === SceneMode.SCENE3D) {
      stage ??= scene.postProcessStages.add(createStage()) as PostProcessStageComposite
    } else {
      removeStage()
    }
    syncAnimation()
    scene.requestRender()
  }

  const removeMoveStart = scene.camera.moveStart.addEventListener(() => {
    moving = true
  })
  const removeMoveEnd = scene.camera.moveEnd.addEventListener(() => {
    moving = false
    if (stage) scene.requestRender()
  })
  const removeMorphStart = scene.morphStart.addEventListener(() => {
    removeStage()
    stopAnimation()
  })
  const removeMorphComplete = scene.morphComplete.addEventListener(() => {
    moving = false
    syncScene()
  })
  document.addEventListener('visibilitychange', syncAnimation)

  return {
    setEnabled(visible: boolean) {
      if (enabled === visible) return
      enabled = visible
      syncScene()
    },
    update(next: Partial<VolumetricCloudOptions>) {
      const previous = options
      options = normalizeCloudOptions({ ...options, ...next })
      if (options.dayColor !== previous.dayColor)
        Color.fromCssColorString(options.dayColor, dayColor)
      if (options.nightColor !== previous.nightColor)
        Color.fromCssColorString(options.nightColor, nightColor)
      if (options.quality !== previous.quality) removeStage()
      syncScene()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      stopAnimation()
      removeStage()
      removeMoveStart()
      removeMoveEnd()
      removeMorphStart()
      removeMorphComplete()
      document.removeEventListener('visibilitychange', syncAnimation)
      if (!scene.isDestroyed()) scene.requestRender()
    },
  }
}

export type VolumetricCloudLayer = ReturnType<typeof createVolumetricCloudLayer>
