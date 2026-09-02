# Vue 3 + TypeScript 项目模板搭建全过程

本文记录 `vue-ts-template` 从空目录到可运行、可提交、可持续集成的完整过程。命令以 Windows 为主；除特别说明外，Yarn、Git 和 Node.js 命令可同时用于 PowerShell 与 Command Prompt。

> 版本基线：2026-08-28。实际安装版本由 `yarn.lock` 锁定。模板明确不安装 Vitest 和 Vue Test Utils。

## 1. 最终技术栈

| 分类 | 工具                           | 职责                              |
| ---- | ------------------------------ | --------------------------------- |
| 基础 | Vue 3、Vite、TypeScript        | UI、构建和类型系统                |
| 路由 | Vue Router                     | SPA 路由                          |
| 状态 | Pinia                          | 可追踪的共享业务状态              |
| 事件 | mitt                           | 瞬时跨组件事件                    |
| 质量 | Oxlint、ESLint                 | 快速检查、语义规则和 import 排序  |
| 格式 | Prettier、EditorConfig         | 代码格式和编辑器基础规范          |
| Git  | Husky、lint-staged、commitlint | hooks、暂存文件检查、提交信息规范 |
| CI   | GitHub Actions                 | 格式、lint、类型和生产构建验证    |

脚手架使用 `create-vue 3.23.0`。首次安装时锁定的主要运行依赖为 Vue 3.5.42、Vue Router 5.3.0、Pinia 4.0.3 和 mitt 3.0.1，import 排序使用 `eslint-plugin-simple-import-sort 14.0.0`，精确版本以 `yarn.lock` 为准。

## 2. 安装和检查开发环境

项目要求：

- Node.js `^22.18.0 || >=24.12.0`
- Yarn Classic `>=1.22.22 <2`
- Git

推荐统一使用 Node.js 24.12.0 和 Yarn 1.22.22。

如果使用 nvm-windows，可在 PowerShell 或 Command Prompt 中执行：

```bat
nvm install 24.12.0
nvm use 24.12.0
```

安装 Yarn Classic：

```bat
npm install --global yarn@1.22.22
```

验证环境：

```bat
node --version
yarn --version
git --version
```

预期至少得到 Node.js 24.12.0、Yarn 1.22.22 和可用的 Git 版本。

## 3. 进入工作目录

PowerShell：

```powershell
Set-Location D:\Code\cli
```

Command Prompt：

```bat
cd /d D:\Code\cli
```

## 4. 创建 Vue 项目

使用 Vue 官方脚手架的非交互参数创建项目：

```bat
yarn create vue vue-ts-template --typescript --router --pinia --eslint --prettier --bare
```

这里没有传入 `--vitest`、`--cypress` 或 `--playwright`，因此不会安装测试框架。`--bare` 用于获得尽可能精简的示例工程。

进入项目并初始化 Git：

```bat
cd vue-ts-template
git init
```

## 5. 安装运行和工程化依赖

安装 typed event emitter：

```bat
yarn add mitt
```

安装 Git hooks 和提交规范工具：

```bat
yarn add --dev husky lint-staged @commitlint/cli @commitlint/config-conventional eslint-plugin-simple-import-sort
```

`create-vue` 已经安装 Vue Router、Pinia、ESLint、Prettier、Oxlint、`vue-tsc` 等依赖，无需重复添加。

### import 排序规则

在 `eslint.config.ts` 中注册 `eslint-plugin-simple-import-sort`，只启用 import 排序：

```ts
{
  name: 'app/import-sort',
  plugins: {
    'simple-import-sort': simpleImportSort,
  },
  rules: {
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          ['^\\u0000'],
          ['^node:'],
          ['^@?\\w'],
          ['^@/'],
          ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
          ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
        ],
      },
    ],
  },
}
```

排序分组依次为：副作用导入、Node.js 内置模块、第三方依赖、`@/` 项目内部模块、父级相对路径、同级相对路径。规则不负责对象属性或 Vue template 属性排序。`yarn lint` 只报告乱序，`yarn lint:fix` 和 pre-commit 中的 lint-staged 会自动修复。

## 6. 配置 package.json

质量命令遵循“检查不改文件、修复显式执行”的原则：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "run-p type-check \"build-only {@}\" --",
    "preview": "vite preview",
    "build-only": "vite build",
    "type-check": "vue-tsc --build",
    "lint": "run-s lint:oxlint lint:eslint",
    "lint:oxlint": "oxlint .",
    "lint:eslint": "eslint . --cache",
    "lint:fix": "run-s lint:oxlint:fix lint:eslint:fix",
    "lint:oxlint:fix": "oxlint . --fix",
    "lint:eslint:fix": "eslint . --fix --cache",
    "lint:staged": "lint-staged",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "commitlint": "commitlint --verbose",
    "validate": "run-s format:check lint type-check build-only",
    "prepare": "husky"
  },
  "engines": {
    "node": "^22.18.0 || >=24.12.0",
    "yarn": ">=1.22.22 <2"
  },
  "packageManager": "yarn@1.22.22"
}
```

执行 Husky 初始化：

```bat
yarn prepare
```

## 7. 配置 lint-staged 和 commitlint

创建 `lint-staged.config.mjs`：

```js
export default {
  '*.{ts,mts,tsx,vue}': ['oxlint --fix', 'eslint --fix --cache', 'prettier --write'],
  '*.{js,mjs,cjs,json,jsonc,yml,yaml,md,css,scss,html}': ['prettier --write'],
}
```

创建 `commitlint.config.mjs`：

```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
  },
}
```

提交信息格式为：

```text
<type>(<scope>): <subject>
```

常用 `type`：

- `feat`：新增功能
- `fix`：修复问题
- `refactor`：重构但不改变功能
- `docs`：文档修改
- `style`：纯格式修改
- `chore`：工具链或杂项
- `ci`：持续集成配置

示例：

```text
feat(router): add user routes
```

## 8. 配置 Husky hooks

`.husky/pre-commit`：

```sh
yarn lint:staged
```

只检查并修复已经 `git add` 的文件，避免每次提交扫描整个工程。

`.husky/commit-msg`：

```sh
yarn commitlint --edit "$1"
```

`.husky/pre-push`：

```sh
yarn type-check
yarn build-only
```

本模板没有测试框架，因此推送前只执行类型检查和生产构建。

## 9. TypeScript、格式和编辑器规范

`tsconfig.app.json` 在 Vue 官方配置基础上启用：

- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `noFallthroughCasesInSwitch`
- `noImplicitOverride`
- `noPropertyAccessFromIndexSignature`

根目录包含：

- `.editorconfig`：统一 UTF-8、LF、2 空格缩进和文件末尾换行
- `.prettierrc.json`：不使用分号、单引号、100 字符换行
- `.prettierignore`：排除产物、依赖、覆盖率和锁文件
- `.vscode/extensions.json`：推荐 Vue Official、ESLint、Prettier、EditorConfig
- `.vscode/settings.json`：保存时格式化并执行 ESLint 修复
- `.node-version`：声明 Node.js 24.12.0

## 10. 初始化 Pinia 和 typed mitt

Pinia 在 `src/main.ts` 中注册：

```ts
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
```

所有 mitt 事件集中声明在 `src/events/index.ts`，禁止散落字符串事件名：

```ts
export interface AppEvents extends Record<string | symbol, unknown> {
  'counter:incremented': { count: number }
  'notification:show': {
    level: 'info' | 'success' | 'warning' | 'error'
    message: string
  }
}
```

组件中优先通过 `useAppEvent` 订阅事件。它使用 `onScopeDispose` 自动解绑，避免组件销毁后残留监听器。

使用边界：

- Pinia：用户信息、权限、业务实体、可派生状态等需要追踪的状态
- mitt：刷新信号、通知、跨层级的一次性动作等瞬时事件
- 父子组件通信仍优先使用 props 和 emits

## 11. 环境变量

模板只提交 `.env.example`：

```dotenv
VITE_APP_TITLE=Vue TS Template
```

PowerShell 复制命令：

```powershell
Copy-Item .env.example .env.local
```

Command Prompt 复制命令：

```bat
copy .env.example .env.local
```

`.env.local` 已被 Git 忽略。新增变量时，需要同时更新 `.env.example` 和 `env.d.ts`，但不得把密码、Token 等秘密提交到仓库。

## 12. 安装、启动和验证

团队成员拉取项目后使用锁文件安装：

```bat
yarn install --frozen-lockfile
```

启动开发服务：

```bat
yarn dev
```

分别执行检查：

```bat
yarn format:check
yarn lint
yarn type-check
yarn build-only
```

一次执行全部检查：

```bat
yarn validate
```

自动修复：

```bat
yarn format
yarn lint:fix
```

## 13. 首次提交

```bat
git add -A
git commit -m "feat: initialize vue typescript template"
```

提交时会执行 lint-staged 和 commitlint。配置远程仓库后推送：

```bat
git branch -M main
git remote add origin <repository-url>
git push -u origin main
```

推送前会自动执行类型检查和生产构建。

## 14. CI 质量门禁

`.github/workflows/quality.yml` 在向 `main` 推送或创建 Pull Request 时执行：

1. 使用 Node.js 24.12.0；
2. 安装 Yarn Classic 1.22.22；
3. 使用 `yarn install --frozen-lockfile` 安装锁定依赖；
4. 执行 `yarn validate`。

本地 hooks 可以通过 `--no-verify` 绕过，因此 CI 才是最终质量门禁。

## 15. 目录结构

```text
vue-ts-template/
├─ .github/workflows/quality.yml
├─ .husky/
│  ├─ commit-msg
│  ├─ pre-commit
│  └─ pre-push
├─ .vscode/
├─ docs/PROJECT_SETUP.md
├─ public/
├─ src/
│  ├─ composables/useAppEvent.ts
│  ├─ events/index.ts
│  ├─ router/index.ts
│  ├─ stores/counter.ts
│  ├─ styles/main.css
│  ├─ views/
│  ├─ App.vue
│  └─ main.ts
├─ commitlint.config.mjs
├─ eslint.config.ts
├─ lint-staged.config.mjs
├─ package.json
├─ tsconfig.app.json
├─ vite.config.ts
└─ yarn.lock
```

## 16. 常见问题

### Yarn 报 Node engine 不兼容

不要长期使用 `--ignore-engines`。切换到 Node.js 22.18+ 或 24.12+，删除旧环境生成的 `node_modules` 后重新执行：

```bat
yarn install --frozen-lockfile
```

### Git hooks 没有执行

确认项目已经执行 `git init`，然后重新安装 hooks：

```bat
yarn prepare
```

### 提交信息被拒绝

使用 Conventional Commits，例如：

```bat
git commit -m "fix(store): handle empty user profile"
```

### CI 中不需要安装 hooks

CI 安装依赖时设置 `HUSKY=0`，避免创建本地 Git hooks；质量检查仍由 `yarn validate` 完成。

## 17. 参考与复核

以下资料均在 2026-08-28 复核：

- [Vue Quick Start](https://vuejs.org/guide/quick-start.html)：官方 `create-vue`、TypeScript、Router、Pinia、ESLint、Prettier 选项
- [Vue Tooling Guide](https://vuejs.org/guide/scaling-up/tooling)：`vue-tsc`、ESLint、Prettier 和 lint-staged 建议
- [eslint-plugin-vue User Guide](https://eslint.vuejs.org/user-guide/)：ESLint flat config 与 Vue/TypeScript 配置
- [eslint-plugin-simple-import-sort](https://github.com/lydell/eslint-plugin-simple-import-sort)：flat config、import 分组和自动修复规则
- [Husky Get Started](https://typicode.github.io/husky/get-started.html)：Husky 9 初始化与 Git hooks
- [Pinia Getting Started](https://pinia.vuejs.org/getting-started.html)：Pinia 应用注册方式

最终配置通过本地 `format:check`、`lint`、`type-check`、`build-only` 四项检查，并由 GitHub Actions 再执行一次相同验证，形成双重校验。
