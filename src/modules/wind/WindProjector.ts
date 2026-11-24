import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Matrix4,
  Occluder,
  SceneMode,
  type Viewer,
} from 'cesium'

export interface WindPosition {
  world: Cartesian3
  scaled: Cartesian3
  flat: Cartesian3
  screen: Cartesian2
  viewVersion: number
  visible: boolean
}

/** Batch screen projection without per-point camera getters or DOM measurements. */
export class WindProjector {
  private readonly matrix = new Matrix4()
  private readonly nextMatrix = new Matrix4()
  private readonly occluder = new Occluder(
    new BoundingSphere(Cartesian3.ZERO, 1),
    new Cartesian3(0, 0, 2),
  )
  private readonly scaledCamera = new Cartesian3()
  private version = 0
  private mode: SceneMode = SceneMode.MORPHING
  private width = 0
  private height = 0
  private cameraY = 0
  private worldWidth = 0

  constructor(private readonly viewer: Viewer) {}

  update(width: number, height: number) {
    const { camera, scene } = this.viewer
    Matrix4.multiply(camera.frustum.projectionMatrix, camera.viewMatrix, this.nextMatrix)
    if (
      this.mode !== scene.mode ||
      width !== this.width ||
      height !== this.height ||
      !Matrix4.equals(this.matrix, this.nextMatrix)
    ) {
      ++this.version
      Matrix4.clone(this.nextMatrix, this.matrix)
    }
    this.mode = scene.mode
    this.width = width
    this.height = height
    this.cameraY = camera.positionWC.y
    this.worldWidth = scene.mapProjection.ellipsoid.maximumRadius * 2 * Math.PI
    Cartesian3.multiplyComponents(
      camera.positionWC,
      scene.ellipsoid.oneOverRadii,
      this.scaledCamera,
    )
    this.occluder.cameraPosition = this.scaledCamera
  }

  project(point: WindPosition, result: Cartesian2) {
    if (point.viewVersion !== this.version) {
      point.viewVersion = this.version
      point.visible = false
      if (this.mode === SceneMode.SCENE3D && !this.occluder.isPointVisible(point.scaled))
        return false
      let { x, y, z } = point.world
      if (this.mode !== SceneMode.SCENE3D) {
        x = this.mode === SceneMode.SCENE2D ? 0 : point.flat.z
        y = point.flat.x
        z = point.flat.y
        // Use the nearest world copy across the 2D date-line seam.
        if (this.mode === SceneMode.SCENE2D) {
          y += Math.round((this.cameraY - y) / this.worldWidth) * this.worldWidth
        }
      }
      const m = this.matrix
      const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!
      if (!(w > 0)) return false
      const clipZ = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!
      if (clipZ < -w || clipZ > w) return false
      const sx = (((m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w + 1) * this.width) / 2
      const sy = ((1 - (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w) * this.height) / 2
      point.screen.x = sx
      point.screen.y = sy
      point.visible =
        Number.isFinite(sx) &&
        Number.isFinite(sy) &&
        sx >= 0 &&
        sy >= 0 &&
        sx <= this.width &&
        sy <= this.height
    }
    if (point.visible) Cartesian2.clone(point.screen, result)
    return point.visible
  }
}
