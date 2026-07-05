# 目录约定预设

> 规范章节库：目录约定。每个预设提供可验证的规范条目。

## 预设 A：功能模块化（React/Next 项目）

```text
- src/features/{模块名}/：功能模块，每个模块自包含（组件+hooks+类型+测试）
- src/shared/：跨模块共享的工具和类型
- src/config/：配置文件，不放业务逻辑
- src/pages/：页面级组件（如使用 Next.js 的 app 目录则不需要）
- tests/：集成测试，单元测试放在各模块内
- public/：静态资源
```

判定标准：新文件放入 `src/features/{对应模块}/`；跨模块工具放入 `src/shared/`。

## 预设 B：分层结构（API 服务）

```text
- src/routes/：路由定义
- src/services/：业务逻辑
- src/repositories/：数据访问
- src/types/：类型定义
- src/utils/：工具函数
- src/config/：配置
- tests/：测试
```

判定标准：新路由放入 `src/routes/`；业务逻辑放入 `src/services/`；数据访问放入 `src/repositories/`。

## 预设 C：扁平结构（CLI/小项目）

```text
- src/：所有源码
- tests/：所有测试
- src/cli.ts：入口文件
- src/commands/：命令实现
```

判定标准：新源码放入 `src/`；测试放入 `tests/`；入口固定为 `src/cli.ts`。
