# DSH MCP Tool Dispatch

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 MCP 工具检索与按需执行插件。会话的 MCP 工具定义达到默认 30,000 个估算 token 后，模型通过 BM25 搜索、按精确名称读取参数，再经 DSH 执行。预检优先提示与任务相关的候选，超预算的定义只提示名称和用途。

## 兼容性与安装

目标版本为公开 npm 发行版 **DSH 0.2.2-rc.5**，使用 Native 工具执行模式。插件接管该版本的默认 Native 执行器配置项，并复用官方执行器及调用管线。请使用单独的 DSH profile 验证与其他原生执行器扩展的组合。

从 Release 下载本项目的 `dsh-mcp-tool-dispatch-0.1.4.tgz`，用 DSH 安装：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-mcp-tool-dispatch-0.1.4.tgz
dsh web
```

也可以通过 DSH 插件界面的本地文件入口安装此包。已接入 MCP 且达到阈值的会话会看到 `tool_search` 和 `execute_tool`。PTC 执行器由 DSH 继续管理。

## 配置

在所用 profile 的 `cordis.patch.yml` 修改下列配置，然后重启该 profile：

```yaml
- id: dsh-mcp-tool-dispatch
  config:
    toolDefinitionTokenThreshold: 30000
    directReadonlyTools: []
```

- `toolDefinitionTokenThreshold` 只估算当前步可调用的 MCP 定义。设为 `0` 可在存在 MCP 工具时强制开启。
- `directReadonlyTools` 仅接受管理员确认可直接调用的只读工具精确名称。默认空列表。
- MCP 的服务器连接、工具可见范围、参数校验和调用审批由 DSH 处理。检索在本机进行，无需外部向量服务。
- 使用 `dsh plugin --profile web remove dsh-mcp-tool-dispatch` 并重启，可恢复默认 Native 执行器配置。

## 构建

需要 Node.js 22.19+ 或 24+。安装与该 DSH 版本相符的公开依赖后运行 `npm run build` 和 `npm test`，使用 `npm pack` 打包。通过 Git 安装时，仓库随附预编译的 `lib/`。

第三方 BM25 实现的 MIT 许可声明见 `THIRD-PARTY-NOTICES`。

宿主链路可用 `test/host-fixture.mjs` 做离线验证。测试模型确认首轮只收到大工具的候选摘要，再按名称查到完整定义，验证宿主拒绝和允许两条执行路径。
