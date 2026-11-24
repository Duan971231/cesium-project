# Cesium 体积云

在「场景图层」打开「体积云」，右侧会出现独立的「体积云参数」浮窗。浮窗支持拖动和收起，开关留在原图层列表。切换至 2D 或 2.5D 会暂停体积云，返回 3D 时继续使用已设参数。

- 「光照与颜色」可调整体亮度、云底补光、日照影响、逆光高光和日间、夜间云色。日照影响设为 0% 时，全天使用日间云色，并关闭随太阳方向变化的高光。
- 「形态与运动」可调覆盖率、密度、云底高度、云层厚度、云团尺度、边缘细节和移速。边缘细节用于均衡和高画质档的近景。移速为零时云层静止。

## 开源实现对比

| 实现                               | 做法与优势                                                                                             | 代价与适用范围                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cesium `CloudCollection`           | Cesium 原生积云公告板，适合成批放置有限数量的云朵，接入成本低。                                        | 适用于局部点缀。全球连续云层、穿云和体积透射需要其他渲染方法。 [官方文档](https://cesium.com/learn/cesiumjs/ref-doc/CloudCollection.html)                                                                               |
| Cesium Sandcastle Volumetric Cloud | 在限定体积内用三维纹理做光线步进，可观察和穿行局部云体。                                               | 云体范围固定，扩展到从地面到轨道的全球云层需要加地球壳、深度裁剪和像素预算控制。 [官方示例库](https://sandcastle.cesium.com/)                                                                                           |
| Cesium Volumetric Cloud Lab        | Cesium 双通道方案，按宽高各 40% 生成云，再全分辨率合成。支持地形和 3D Tiles 遮挡，带自阴影及地表云影。 | 太阳方向的积分和地面云影占用额外 GPU 时间。适合同时要求体积云和云影的场景。 [GitHub](https://github.com/tatsuya-ogawa/cesium-volumetric-clouds)                                                                         |
| `cesium-geospatial`                | Cesium 上的大气散射和体积云方案，支持 LUT、天气演化、日照和云影等组合效果，并提供独立云阶段。          | 完整效果涉及素材、太阳时钟和后处理链的编排，适合一起替换大气渲染的项目。 [GitHub](https://github.com/Zhliyun/cesium-geospatial)                                                                                         |
| `@takram/three-clouds`             | 球壳步进与时域超分辨率，开启时域放大时每帧可只步进云缓冲区的 1/16 像素，同时支持级联云影。             | 依赖 Three.js 及其后处理链。移植到 Cesium 要处理历史缓冲、重投影和遮挡变化，快速转动下还需处理残影。 [渲染流程](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds#rendering-path) |

本项目采用 Cesium 原生双通道后处理。体积通道在地球椭球壳内沿视线累积透射率，用 Cesium 场景深度限制采样范围。高频噪声只用于近处可能有云的样本，空区可以跨步，接近不透明时提前退出。全分辨率合成通道检查前景深度变化，以减少山脊或模型边缘的云色溢出。照明采用近似日照与高度剖面，预算优先分配给地图交互、云体形状和深度合成。

| 档位         | 体积缓冲宽高 | 名义像素比例 | 静止 / 移动时步进上限 |
| ------------ | ------------ | ------------ | --------------------- |
| 性能优先     | 25%          | 6.25%        | 18 / 12               |
| 均衡（默认） | 37.5%        | 约 14%       | 28 / 18               |
| 高画质       | 50%          | 25%          | 40 / 26               |

像素比例只描述体积通道工作量，合成通道仍覆盖全视口。动画每秒最多主动请求约 30 次画面刷新，拖拽期间由 Cesium 负责相机刷新并降低云采样预算。关闭图层、覆盖率为零、进入平面模式或离开页面时停止体积通道。页面隐藏时停止动画请求。实际帧耗时随设备、视口和场景内容变化。

## 模块接入

`src/modules/volumetric-clouds/index.ts` 是渲染层入口。Vite 以原始文本载入 GLSL，噪声纹理首次启用时本地生成。渲染接口仅接收 Cesium `Scene`，可以脱离 Vue 使用。模块通过 Cesium 1.144 的 `Scene.context` 读取地形深度纹理，视野内没有地物时使用默认纹理占位。

```ts
import { createVolumetricCloudLayer } from './modules/volumetric-clouds'

const clouds = createVolumetricCloudLayer(viewer.scene, { quality: 'balanced' })
clouds.setEnabled(true)
clouds.update({ baseHeight: 2400, coverage: 0.65, windSpeed: 18 })
clouds.update({ brightness: 1.35, baseLight: 0.72, sunlightInfluence: 0.35 })

// When releasing the view:
clouds.destroy()
```

`useVolumetricClouds` 管理本项目的 Vue 生命周期，`VolumetricCloudPanel.vue` 通过 `v-model` 读写配置。高度和厚度以米计，移速是赤道处模拟的东向平流速度，以米每秒计。云体是程序模拟，可在 `raymarch.glsl` 的天气覆盖率与密度采样处扩展实况天气纹理。当前渲染预算包含云体和透明度合成，地面云影需要独立通道。场景深度主要覆盖地形和不透明几何，透明对象边缘的排序由 Cesium 的深度写入决定。
