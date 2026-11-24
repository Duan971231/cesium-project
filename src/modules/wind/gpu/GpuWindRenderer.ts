import {
  BlendingState,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  ComponentDatatype,
  IndexDatatype,
  Math as CesiumMath,
  Matrix4,
  PixelDatatype,
  PixelFormat,
  PrimitiveType,
  SceneMode,
  TextureMagnificationFilter,
  TextureMinificationFilter,
  type Viewer,
  WebMercatorProjection,
} from 'cesium'

import type { WindField } from '../WindField'

import {
  type Compute,
  type Context,
  type FrameState,
  Gpu,
  type Program,
  type Resource,
  type Texture,
} from './engine'
import { computeFragment, computeVertex, drawFragment, drawVertex } from './shaders'

const historySize = 16

/** GPU advection and bounded geographic history; camera moves never recreate particle state. */
export class GpuWindRenderer {
  density = 4096
  speed = 1
  private readonly context: Context
  private readonly resources: Resource[] = []
  private readonly viewProjection = new Matrix4()
  private readonly previousView = new Matrix4()
  private readonly viewport = new Cartesian2()
  private readonly scaledCamera = new Cartesian3()
  private readonly bounds = new Cartesian4(-180, -85, 180, 85)
  private readonly grid: Cartesian4
  private readonly gridSize: Cartesian2
  private readonly uniforms: Record<string, () => unknown>
  private windTexture!: Texture
  private readTexture!: Texture
  private writeTexture!: Texture
  private vertexArray: Resource | undefined
  private computeProgram!: Program
  private drawProgram!: Program
  private compute!: Compute
  private drawCommand: unknown
  private side = 0
  private configuredDensity = 0
  private dt = 0
  private time = 0
  private accumulator = 0
  private shift = false
  private lastStep = 0
  private lastRequest = 0
  private frame = 0
  private destroyed = false

  constructor(
    private readonly viewer: Viewer,
    private readonly field: WindField,
  ) {
    this.context = (viewer.scene as unknown as { context: Context }).context
    if (!this.context.webgl2 || !this.context.colorBufferFloat) {
      throw new Error('GPU 风场需要 WebGL 2 和浮点渲染纹理支持')
    }
    const h = field.header
    this.grid = new Cartesian4(h.lo1, h.la1, h.dx, h.dy)
    this.gridSize = new Cartesian2(h.nx, h.ny)
    this.uniforms = {
      u_state: () => this.readTexture,
      u_wind: () => this.windTexture,
      u_side: () => this.side,
      u_history: () => historySize,
      u_historySize: () => historySize,
      u_dt: () => this.dt,
      u_time: () => this.time,
      u_scale: () => Math.max(viewer.camera.positionCartographic.height, 10) * 0.012 * this.speed,
      u_shift: () => this.shift,
      u_grid: () => this.grid,
      u_gridSize: () => this.gridSize,
      u_gridSizeFloat: () => this.gridSize,
      u_bounds: () => this.bounds,
      u_viewProjection: () => this.viewProjection,
      u_mode: () => viewer.scene.mode,
      u_radius: () => viewer.scene.mapProjection.ellipsoid.maximumRadius,
      u_mercator: () => viewer.scene.mapProjection instanceof WebMercatorProjection,
      u_cameraMapX: () => viewer.camera.positionWC.y,
      u_cameraScaled: () => this.scaledCamera,
      u_inverseRadii: () => viewer.scene.ellipsoid.oneOverRadii,
      u_height: () => 5000,
      u_viewport: () => this.viewport,
      u_lineWidth: () => (1.8 * viewer.canvas.width) / Math.max(viewer.canvas.clientWidth, 1),
    }
    try {
      this.windTexture = this.texture(h.nx, h.ny, field.createTextureData(), true)
      this.resources.push(this.windTexture)
      this.computeProgram = Gpu.ShaderProgram.fromCache({
        context: this.context,
        vertexShaderSource: computeVertex,
        fragmentShaderSource: computeFragment,
        attributeLocations: { position: 0, textureCoordinates: 1 },
      })
      this.resources.push(this.computeProgram)
      this.drawProgram = Gpu.ShaderProgram.fromCache({
        context: this.context,
        vertexShaderSource: drawVertex,
        fragmentShaderSource: drawFragment,
        attributeLocations: { a_particle: 0, a_trail: 1 },
      })
      this.resources.push(this.drawProgram)
      // Compile before adding to the scene so unsupported shaders can cleanly fall back.
      void this.computeProgram.allUniforms
      void this.drawProgram.allUniforms
      this.allocateParticles()
      this.compute = new Gpu.ComputeCommand({
        owner: this,
        shaderProgram: this.computeProgram,
        outputTexture: this.writeTexture,
        uniformMap: this.uniforms,
        persists: true,
        postExecute: () => {
          const old = this.readTexture
          this.readTexture = this.writeTexture
          this.writeTexture = old
        },
      })
      viewer.scene.primitives.add(this)
      this.frame = requestAnimationFrame(this.animate)
    } catch (error) {
      this.release()
      throw error
    }
  }

  private texture(width: number, height: number, values: Float32Array, wind = false) {
    return new Gpu.Texture({
      context: this.context,
      width,
      height,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.FLOAT,
      flipY: false,
      source: { arrayBufferView: values },
      sampler: new Gpu.Sampler({
        minificationFilter: TextureMinificationFilter.NEAREST,
        magnificationFilter: TextureMagnificationFilter.NEAREST,
        wrapS: wind ? Gpu.TextureWrap.REPEAT : Gpu.TextureWrap.CLAMP_TO_EDGE,
        wrapT: Gpu.TextureWrap.CLAMP_TO_EDGE,
      }),
    })
  }

  private allocateParticles() {
    this.readTexture?.destroy()
    this.writeTexture?.destroy()
    this.vertexArray?.destroy()
    this.vertexArray = undefined
    this.configuredDensity = Math.max(256, Math.min(16384, Math.round(this.density)))
    this.side = Math.ceil(Math.sqrt(this.configuredDensity))
    const height = this.side * historySize
    const values = new Float32Array(this.side * height * 4)
    this.readTexture = this.texture(this.side, height, values)
    this.writeTexture = this.texture(this.side, height, values)
    const check = new Gpu.Framebuffer({
      context: this.context,
      colorTextures: [this.readTexture],
      destroyAttachments: false,
    })
    const status = check.status
    check.destroy()
    if (status !== 0x8cd5) throw new Error('GPU 浮点帧缓冲不可用')

    const vertexCount = this.configuredDensity * historySize * 2
    const vertices = new Float32Array(vertexCount * 4)
    const indices = new Uint32Array(this.configuredDensity * (historySize - 1) * 6)
    let cursor = 0
    for (let particle = 0; particle < this.configuredDensity; particle++) {
      for (let slot = 0; slot < historySize; slot++) {
        for (let edge = 0; edge < 2; edge++) {
          const offset = ((particle * historySize + slot) * 2 + edge) * 4
          vertices[offset] = ((particle % this.side) + 0.5) / this.side
          vertices[offset + 1] = (Math.floor(particle / this.side) + 0.5) / this.side
          vertices[offset + 2] = slot
          vertices[offset + 3] = edge === 0 ? -1 : 1
        }
        if (slot < historySize - 1) {
          const a = (particle * historySize + slot) * 2
          indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], cursor)
          cursor += 6
        }
      }
    }
    const vertexBuffer = Gpu.Buffer.createVertexBuffer({
      context: this.context,
      typedArray: vertices,
      usage: Gpu.BufferUsage.STATIC_DRAW,
    })
    const indexBuffer = Gpu.Buffer.createIndexBuffer({
      context: this.context,
      typedArray: indices,
      usage: Gpu.BufferUsage.STATIC_DRAW,
      indexDatatype: IndexDatatype.UNSIGNED_INT,
    })
    this.vertexArray = new Gpu.VertexArray({
      context: this.context,
      indexBuffer,
      attributes: [0, 1].map((index) => ({
        index,
        vertexBuffer,
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
        offsetInBytes: index * 8,
        strideInBytes: 16,
      })),
    })
    this.drawCommand = new Gpu.DrawCommand({
      owner: this,
      vertexArray: this.vertexArray,
      shaderProgram: this.drawProgram,
      uniformMap: this.uniforms,
      primitiveType: PrimitiveType.TRIANGLES,
      count: indices.length,
      pass: Gpu.Pass.TRANSLUCENT,
      cull: false,
      renderState: Gpu.RenderState.fromCache({
        depthTest: { enabled: true },
        depthMask: false,
        blending: BlendingState.ALPHA_BLEND,
        cull: { enabled: false },
      }),
    })
    this.lastStep = 0
    this.accumulator = 0
  }

  private updateView() {
    const { camera, scene, canvas } = this.viewer
    Matrix4.multiply(camera.frustum.projectionMatrix, camera.viewMatrix, this.viewProjection)
    this.viewport.x = canvas.width
    this.viewport.y = canvas.height
    Cartesian3.multiplyComponents(
      camera.positionWC,
      scene.ellipsoid.oneOverRadii,
      this.scaledCamera,
    )
    if (Matrix4.equals(this.viewProjection, this.previousView)) return
    Matrix4.clone(this.viewProjection, this.previousView)
    const rectangle = camera.computeViewRectangle(scene.ellipsoid)
    if (!rectangle) {
      this.bounds.x = -180
      this.bounds.z = 180
      this.bounds.y = -85
      this.bounds.w = 85
      return
    }
    const west = CesiumMath.toDegrees(rectangle.west)
    let east = CesiumMath.toDegrees(rectangle.east)
    if (east <= west) east += 360
    const buffer = (east - west) * 0.12
    this.bounds.x = east - west + buffer * 2 >= 360 ? -180 : west - buffer
    this.bounds.z = east - west + buffer * 2 >= 360 ? 180 : east + buffer
    this.bounds.y = Math.max(-85, CesiumMath.toDegrees(rectangle.south) - 5)
    this.bounds.w = Math.min(85, CesiumMath.toDegrees(rectangle.north) + 5)
  }

  update(frameState: FrameState) {
    if (
      this.destroyed ||
      !frameState.passes.render ||
      this.viewer.scene.mode === SceneMode.MORPHING
    )
      return
    if (this.configuredDensity !== Math.max(256, Math.min(16384, Math.round(this.density))))
      this.allocateParticles()
    this.updateView()
    const now = performance.now()
    if (now - this.lastStep >= 1000 / 30) {
      this.dt = this.lastStep ? Math.min((now - this.lastStep) / 1000, 0.067) : 1 / 30
      this.lastStep = now
      this.time += this.dt
      this.accumulator += this.dt
      this.shift = this.accumulator >= 0.08
      if (this.shift) this.accumulator %= 0.08
      this.compute.outputTexture = this.writeTexture
      frameState.commandList.push(this.compute)
    }
    frameState.commandList.push(this.drawCommand)
  }

  private animate = (now: number) => {
    if (this.destroyed) return
    if (!document.hidden && now - this.lastRequest >= 1000 / 30) {
      this.lastRequest = now
      this.viewer.scene.requestRender()
    }
    this.frame = requestAnimationFrame(this.animate)
  }

  isDestroyed() {
    return this.destroyed
  }

  private release() {
    cancelAnimationFrame(this.frame)
    for (const resource of [
      this.readTexture,
      this.writeTexture,
      this.vertexArray,
      ...this.resources,
    ]) {
      if (resource && !resource.isDestroyed()) resource.destroy()
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.release()
  }

  remove() {
    if (!this.viewer.isDestroyed()) this.viewer.scene.primitives.remove(this)
    if (!this.destroyed) this.destroy()
  }
}
