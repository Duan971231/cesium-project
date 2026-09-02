# vue-ts-template

面向团队开发的 Vue 3 + TypeScript 项目模板。

## 内置能力

- Vite + Vue 3 + TypeScript
- Vue Router + Pinia
- typed mitt 事件总线及自动解绑 composable
- ESLint flat config + import 自动排序 + Oxlint + Prettier + EditorConfig
- Husky + lint-staged + commitlint
- 严格类型检查、生产构建和 GitHub Actions 质量门禁
- Yarn Classic 锁文件

本模板按要求不包含 Vitest、Vue Test Utils 或其他测试框架。

## 环境要求

- Node.js `^22.18.0 || >=24.12.0`
- Yarn `>=1.22.22 <2`
- Git

## 快速开始

```sh
yarn install --frozen-lockfile
```

将 `.env.example` 复制为 `.env.local`，然后启动开发服务：

```sh
yarn dev
```

提交前执行完整检查：

```sh
yarn validate
```

完整的从零创建、配置、验证和 Git 提交流程见
[项目模板搭建全过程](docs/PROJECT_SETUP.md)。

## 常用命令

| 命令                | 作用                               |
| ------------------- | ---------------------------------- |
| `yarn dev`          | 启动开发服务器                     |
| `yarn build`        | 并行执行类型检查和生产构建         |
| `yarn type-check`   | 检查 TypeScript 与 Vue SFC 类型    |
| `yarn lint`         | 只检查，不修改文件                 |
| `yarn lint:fix`     | 自动修复可修复的 lint 问题         |
| `yarn format`       | 使用 Prettier 格式化项目           |
| `yarn format:check` | 检查格式，不修改文件               |
| `yarn validate`     | 依次执行格式、lint、类型和构建检查 |

## mitt 使用边界

mitt 仅用于瞬时、松耦合的跨组件事件。需要持久化、派生计算、时间旅行调试或明确业务归属的状态应放入 Pinia。
