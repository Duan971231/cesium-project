# 寰图 · 三维地球工作台

基于 Vue 3、TypeScript 和 CesiumJS 的个人项目。欢迎页位于 `/`，点击「进入工作台」进入 `/globe`。

## 本地启动

需要 Node.js 22.18 或更新的 22.x 版本，或 Node.js 24.12 及以上版本，以及 Yarn 1.22.22 和支持 WebGL 2 的浏览器。

```sh
yarn install --frozen-lockfile
yarn dev
```

打开终端显示的本地地址。开发和生产构建都会将 Cesium 的运行资源同步到 `public/cesium`。欢迎页预览图和工作台底图使用 Natural Earth II 数据，运行时无需配置 Cesium ion Token。

## 扩展工具

| 文件                                     | 用途                                                          |
| ---------------------------------------- | ------------------------------------------------------------- |
| `src/views/GlobeView.vue`                | 组装三维场景、地图工具、场景图层和视角按钮。                  |
| `src/components/FloatingPanel.vue`       | 通用面板，包含拖拽、折叠和内容插槽。                          |
| `src/composables/useCesiumViewer.ts`     | 初始化和释放 Viewer，处理底图、大气效果和相机操作。           |
| `src/common/components/GlobeToolbar.vue` | 右上角工具栏，提供标绘面板插槽和截图入口。                    |
| `src/modules/plot/`                      | 标绘模块，提供独立的控制点交互、各图形的几何方法和 Vue 面板。 |

在工作台打开「工具 → 标绘」，从三列图标中选择图形并按提示取点。固定点数的图形在选够点后自动完成，折线、多边形等用右键或「完成」结束。自由线和自由面可单击起点、移动鼠标描绘，再单击或右键结束。

点击已有图形后可以拖动白色控制点，或通过「样式」修改点大小、线条颜色和宽度、面填充颜色和不透明度。未选中图形时，样式设置用于之后新建的图形。点击「删除」进入点选删除模式，再点击图形即可删除，按 Esc、右键或「退出删除」退出。

图形类型参考 [cesium-plot-js](https://github.com/ethan-zf/cesium-plot-js)。新增标绘类型时，在 `src/modules/plot/core/shapes.ts` 登记控制点要求和几何方法，再在 `src/modules/plot/components/plotTools.ts` 定义图标和操作提示。

## 开发命令

| 命令            | 用途                                   |
| --------------- | -------------------------------------- |
| `yarn dev`      | 启动开发服务器                         |
| `yarn build`    | 运行类型检查并构建到 `dist/`           |
| `yarn preview`  | 预览生产构建                           |
| `yarn validate` | 运行格式检查、Lint、类型检查和生产构建 |

仓库模板和 Git 工作流见 [项目搭建文档](docs/PROJECT_SETUP.md)。

## 页面截图

点击「工具 → 截图」会直接在当前网页上显示蒙版。拖动框选范围后保存选区，或不框选直接保存整个可见页面。只有点击保存（或按 Enter）时才会生成截图，蒙版和截图操作按钮不会进入图片。按 Esc 或右键取消，页面大小或滚动位置变化时自动退出。

`src/modules/screenshot/capturePage.ts` 负责页面合成，`useRegionScreenshot.ts` 管理蒙版交互、截图和 PNG 下载；Vue 组件只负责展示与事件绑定。没有单独的预览图和图片源状态。导出按设备像素分辨率保存，画面以点击保存时为准。

截图模块不依赖 Cesium。普通页面直接使用 `RegionScreenshot`；WebGL 等需要刷新绘制缓冲区的页面，通过可选的 `prepareCanvas(canvas)` 回调同步刷新，Cesium 适配仅保留在 `GlobeView.vue`。`data-screenshot-ignore` 用于排除蒙版等临时元素。

截图在本地生成并下载。外部图片需要允许跨域读取；跨域 iframe、DRM 视频等浏览器限制内容无法直接合成。
