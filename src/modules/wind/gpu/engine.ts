// Cesium Renderer APIs are internal. Keep the version-dependent surface isolated here.
import * as Cesium from 'cesium'

export interface Resource {
  destroy(): unknown
  isDestroyed(): boolean
}
export interface Texture extends Resource {
  width: number
  height: number
}
export interface Program extends Resource {
  readonly allUniforms: unknown
}
export interface Context {
  webgl2: boolean
  colorBufferFloat: boolean
  floatingPointTexture: boolean
}
export interface FrameState {
  context: Context
  passes: { render: boolean }
  commandList: unknown[]
}
export interface Compute {
  outputTexture: Texture
  shaderProgram: Program
}
type Options = Record<string, unknown>
interface Engine {
  TextureWrap: { REPEAT: number; CLAMP_TO_EDGE: number }
  Texture: new (options: Options) => Texture
  Framebuffer: new (options: Options) => Resource & { status: number }
  Sampler: new (options: Options) => unknown
  ShaderProgram: { fromCache(options: Options): Program }
  VertexArray: new (options: Options) => Resource
  Buffer: {
    createVertexBuffer(options: Options): Resource
    createIndexBuffer(options: Options): Resource
  }
  ComputeCommand: new (options: Options) => Compute
  DrawCommand: new (options: Options) => unknown
  RenderState: { fromCache(options: Options): unknown }
  Pass: { TRANSLUCENT: number }
  BufferUsage: { STATIC_DRAW: number }
}
export const Gpu = Cesium as unknown as Engine
