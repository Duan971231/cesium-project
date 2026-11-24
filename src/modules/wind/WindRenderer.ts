import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  SceneMode,
  type Viewer,
} from 'cesium'

import type { WindField } from './WindField'
import { type WindPosition, WindProjector } from './WindProjector'

interface TrailPoint extends WindPosition {
  longitude: number
  latitude: number
  time: number
}

interface Particle {
  longitude: number
  latitude: number
  age: number
  life: number
  active: boolean
  head: TrailPoint
  history: TrailPoint[]
  next: number
  count: number
}

const trailDuration = 1.2
const sampleInterval = 0.05
const historyCapacity = Math.ceil(trailDuration / sampleInterval) + 1
const fadeSteps = 5

export const windColors = ['#8bd9ff', '#5ce5e0', '#91ed9b', '#f5eb83', '#ffb767', '#ff7784']

function createPoint(): TrailPoint {
  return {
    longitude: 0,
    latitude: 0,
    time: 0,
    world: new Cartesian3(),
    scaled: new Cartesian3(),
    flat: new Cartesian3(),
    screen: new Cartesian2(),
    viewVersion: -1,
    visible: false,
  }
}

export class WindRenderer {
  density = 1200
  speed = 1
  private readonly context: CanvasRenderingContext2D
  private readonly particles: Particle[] = []
  private readonly projector: WindProjector
  private readonly location = new Cartographic()
  private readonly previousScreen = new Cartesian2()
  private readonly currentScreen = new Cartesian2()
  private readonly removeRender: () => void
  private frame = 0
  private lastTime = 0
  private elapsedTime = 0
  private width = 0
  private height = 0
  private pixelRatio = 1

  constructor(
    private readonly viewer: Viewer,
    private readonly canvas: HTMLCanvasElement,
    private readonly field: WindField,
  ) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器不支持风场 Canvas 绘制')
    this.context = context
    this.projector = new WindProjector(viewer)
    this.removeRender = viewer.scene.postRender.addEventListener(() => this.draw())
    this.frame = requestAnimationFrame(this.animate)
  }

  private animate = () => {
    // The overlay has its own canvas; animating it does not require rendering the globe.
    if (!document.hidden && !this.viewer.isDestroyed()) this.draw()
    this.frame = requestAnimationFrame(this.animate)
  }

  private writePoint(point: TrailPoint, longitude: number, latitude: number) {
    point.longitude = longitude
    point.latitude = latitude
    point.time = this.elapsedTime
    const ellipsoid = this.viewer.scene.ellipsoid
    // Cache world coordinates once per sample, then reproject them for every camera view.
    Cartesian3.fromDegrees(longitude, latitude, 2000, ellipsoid, point.world)
    Cartesian3.multiplyComponents(point.world, ellipsoid.oneOverRadii, point.scaled)
    this.viewer.scene.mapProjection.project(
      Cartographic.fromDegrees(longitude, latitude, 2000, this.location),
      point.flat,
    )
    point.viewVersion = -1
  }

  private appendHistory(particle: Particle) {
    const point = particle.history[particle.next] ?? createPoint()
    this.writePoint(point, particle.longitude, particle.latitude)
    particle.history[particle.next] = point
    particle.next = (particle.next + 1) % historyCapacity
    particle.count = Math.min(particle.count + 1, historyCapacity)
  }

  private seed(particle: Particle) {
    particle.age = 0
    particle.life = 2 + Math.random() * 4
    particle.active = false
    particle.count = 0
    particle.next = 0
    for (let attempt = 0; attempt < 6; attempt++) {
      const point = new Cartesian2(Math.random() * this.width, Math.random() * this.height)
      const world = this.viewer.camera.pickEllipsoid(point, this.viewer.scene.ellipsoid)
      if (!world) continue
      const location = this.viewer.scene.ellipsoid.cartesianToCartographic(world)
      const latitude = CesiumMath.toDegrees(location.latitude)
      const longitude = CesiumMath.toDegrees(location.longitude)
      if (Math.abs(latitude) > 85 || !this.field.sample(longitude, latitude)) continue
      particle.longitude = longitude
      particle.latitude = latitude
      particle.active = true
      this.writePoint(particle.head, longitude, latitude)
      this.appendHistory(particle)
      return
    }
    particle.life = 0.5
  }

  private project(point: TrailPoint, result: Cartesian2) {
    return this.projector.project(point, result)
  }

  private drawTrail(particle: Particle, speed: number, paths: Path2D[]) {
    const color = Math.min(Math.floor(speed / 5), windColors.length - 1)
    let previous: TrailPoint | undefined
    let previousVisible = false
    const first = (particle.next - particle.count + historyCapacity) % historyCapacity
    for (let index = 0; index <= particle.count; index++) {
      const point =
        index === particle.count
          ? particle.head
          : particle.history[(first + index) % historyCapacity]!
      const age = this.elapsedTime - point.time
      if (age >= trailDuration) {
        previousVisible = false
        continue
      }
      const visible = this.project(point, this.currentScreen)
      if (previous && previousVisible && visible) {
        const seam =
          this.viewer.scene.mode !== SceneMode.SCENE3D &&
          Math.abs(point.longitude - previous.longitude) > 180
        const distance = Cartesian2.distance(this.previousScreen, this.currentScreen)
        if (!seam && distance < Math.max(this.width, this.height) / 2) {
          const opacity = Math.min(Math.floor((1 - age / trailDuration) * fadeSteps), fadeSteps - 1)
          const path = paths[color * fadeSteps + opacity]!
          path.moveTo(this.previousScreen.x, this.previousScreen.y)
          path.lineTo(this.currentScreen.x, this.currentScreen.y)
        }
      }
      previous = point
      previousVisible = visible
      if (visible) Cartesian2.clone(this.currentScreen, this.previousScreen)
    }
  }

  private draw() {
    const { viewer, canvas, context } = this
    if (viewer.isDestroyed() || viewer.scene.mode === SceneMode.MORPHING) return
    const now = performance.now()
    if (now - this.lastTime < 1000 / 30) return
    const elapsed = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.1) : 1 / 30
    this.lastTime = now
    this.elapsedTime += elapsed
    const width = viewer.canvas.clientWidth
    const height = viewer.canvas.clientHeight
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    if (width !== this.width || height !== this.height || ratio !== this.pixelRatio) {
      this.width = width
      this.height = height
      this.pixelRatio = ratio
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    if (!width || !height) return
    // Repaint geographical trails rather than retaining pixels from the previous camera view.
    context.clearRect(0, 0, width, height)
    this.projector.update(width, height)
    while (this.particles.length < this.density) {
      const particle: Particle = {
        longitude: 0,
        latitude: 0,
        age: 0,
        life: 0,
        active: false,
        head: createPoint(),
        history: [],
        next: 0,
        count: 0,
      }
      this.seed(particle)
      particle.age = Math.random() * particle.life
      this.particles.push(particle)
    }
    this.particles.length = this.density
    context.lineWidth = 1.3
    context.lineCap = 'round'
    const paths = Array.from({ length: windColors.length * fadeSteps }, () => new Path2D())
    const seconds =
      elapsed * Math.max(viewer.camera.positionCartographic.height, 10) * 0.012 * this.speed
    for (const particle of this.particles) {
      particle.age += elapsed
      if (particle.age > particle.life) this.seed(particle)
      if (!particle.active) continue
      // Moving the camera only retires individual particles that actually leave the view.
      if (!this.project(particle.head, this.currentScreen)) {
        this.seed(particle)
        continue
      }
      const wind = this.field.sample(particle.longitude, particle.latitude)
      if (!wind) {
        this.seed(particle)
        continue
      }
      const latitude = particle.latitude + (wind.v * seconds) / 111_320
      const longitude =
        particle.longitude +
        (wind.u * seconds) /
          (111_320 * Math.max(Math.cos(CesiumMath.toRadians(particle.latitude)), 0.087))
      if (Math.abs(latitude) > 85) {
        this.seed(particle)
        continue
      }
      particle.longitude = ((((longitude + 180) % 360) + 360) % 360) - 180
      particle.latitude = latitude
      this.writePoint(particle.head, particle.longitude, latitude)
      if (!this.project(particle.head, this.currentScreen)) {
        this.seed(particle)
        continue
      }
      const newest = particle.history[(particle.next - 1 + historyCapacity) % historyCapacity]!
      if (this.elapsedTime - newest.time >= sampleInterval) this.appendHistory(particle)
      this.drawTrail(particle, wind.speed, paths)
    }
    for (let color = 0; color < windColors.length; color++) {
      context.strokeStyle = windColors[color]!
      for (let opacity = 0; opacity < fadeSteps; opacity++) {
        context.globalAlpha = (opacity + 1) / fadeSteps
        context.stroke(paths[color * fadeSteps + opacity]!)
      }
    }
    context.globalAlpha = 1
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.removeRender()
    this.context.clearRect(0, 0, this.width, this.height)
    this.particles.length = 0
  }
}
