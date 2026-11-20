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

| 文件                                 | 用途                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `src/views/GlobeView.vue`            | 定义绘制工具、场景图层和视角按钮。点、线、面和体积云的入口已预留。 |
| `src/components/FloatingPanel.vue`   | 通用面板，包含拖拽、折叠和内容插槽。                               |
| `src/composables/useCesiumViewer.ts` | 初始化和释放 Viewer，处理底图、大气效果和相机操作。                |

新增操作时，在工作台页面添加工具入口，并在 `useCesiumViewer.ts` 中封装对应的 Cesium 操作。新增面板可以复用 `FloatingPanel`。

## 开发命令

| 命令            | 用途                                   |
| --------------- | -------------------------------------- |
| `yarn dev`      | 启动开发服务器                         |
| `yarn build`    | 运行类型检查并构建到 `dist/`           |
| `yarn preview`  | 预览生产构建                           |
| `yarn validate` | 运行格式检查、Lint、类型检查和生产构建 |

仓库模板和 Git 工作流见 [项目搭建文档](docs/PROJECT_SETUP.md)。
