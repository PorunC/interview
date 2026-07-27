# Pi-mono 全链路源码级深入分析与面试问答

> 定位：公司内部引入并开展源码级评估的 Coding Agent Harness 项目。我负责的是源码分析、内部适配和改造方案评估，不冒充上游原作者，也不把“建议方案”说成“已经实现”。<br>
> 事实口径：忽略源码日期、仓库地址和提交历史，当前实现结论以公司内部代码基线为准。外部资料只用于横向比较和延伸追问。

---

## 1. 先统一面试口径

这是公司内部引入研究的项目，但要准确说明个人贡献，不能把上游全部代码都算成自己开发。推荐口径是：

> 我参与了公司内部 Pi Coding Agent Harness 的源码评估与适配研究。它不是只有一个 ReAct 循环，而是从多 Provider 模型适配、Agent loop、文件工具、会话树和上下文压缩，一直做到终端差分渲染和多实例进程编排。我重点研究的是跨模型协议差异、并行工具一致性、长会话失控、文件修改正确性和宿主权限边界。下面讲的是我从内部代码验证到的当前实现；涉及尚未落地的改造时，我会明确说“如果让我设计”。

回答时坚持四个原则：

1. 先给结论，再讲请求链路。
2. 先讲为什么这样设计，再讲用了什么类或函数。
3. 明确区分“当前实现”“源码可验证默认值”“我的改进方案”。
4. 不虚构 QPS、延迟和准确率；没有 benchmark 就说应怎样测。

### 1.1 从真实面试复盘反推的考察重点

本稿参考了 `E:\面试\面试分析` 下安克创新、微众银行、丰泊国际、码云和京东的面试复盘。五类高频压力测试被映射进后文问题：

| 真实复盘里的追问模式 | 在 Pi 上的对应问题 |
|---|---|
| “成熟模型原生就能做，为什么还需要你的系统？” | 大上下文能否替代 compaction、为什么不用 LangGraph、为什么需要严格 edit executor |
| “这是不是换个名字的已有技术？” | Harness 与 loop、MCP 与内置工具、session persistence 与长期记忆的边界 |
| “说一个真实链路，不要只讲概念” | 从按回车到 Provider、tool result、JSONL 落盘和 TUI 渲染的完整时序 |
| “阈值怎么定、准确率和性能怎么证明？” | 16384/20000 只作为源码默认值，并给出压缩评估、trace 和容量验证方法 |
| “模型写危险命令怎么办？” | Project trust 与 sandbox 的区别、tool policy、审批绑定、Prompt Injection 防御 |
| “当前到底做到哪一步，哪些是设想？” | 明确指出 coding-agent 尚未迁移到 AgentHarness，企业化方案单列 |

因此后面的答案不会停在“用了 Provider、JSONL、Agent loop”这种名词层，而是继续回答存在价值、实现链路、失败边界、验证方法和替代方案。

---

## 2. 30 秒和 2 分钟项目介绍

### 2.1 30 秒版本

> Pi-mono 是一个 TypeScript Monorepo 形态的 Coding Agent Harness。它大体分五层：`pi-ai` 统一多家模型和流式协议，`pi-agent-core` 负责 Agent loop 和工具执行，`pi-coding-agent` 负责会话、压缩、扩展和文件工具，`pi-tui` 负责终端交互，实验性的 `pi-orchestrator` 负责多实例子进程编排。我觉得它最值得讲的不是“能调用工具”，而是它在不确定的模型输出、并发副作用、长上下文和终端状态之间，做了很多确定性约束。

### 2.2 2 分钟版本

> 我把 Pi 看成五层。最底层 `pi-ai` 不只是包一层 HTTP，而是把 Provider 当运行时单元，每个 Provider 自己拥有模型目录、认证和流式行为；不同 Provider 的消息、reasoning、tool call ID 再被转换成统一协议。再上一层 `pi-agent-core` 执行标准的“模型输出—工具调用—工具结果—继续推理”循环，工具参数先校验，同一批无依赖工具可以并行，但结果会按模型原调用顺序写回上下文。
>
> `pi-coding-agent` 才是产品级核心。它把会话保存成追加式 JSONL 树，用 `id/parentId` 原地分支；上下文快满时写一条 compaction 摘要，而不是删除历史。文件编辑要求旧文本唯一、多个修改不能重叠，并按真实文件路径串行化写操作，避免两个并行工具互相覆盖。`read` 和 `bash` 还采用不同截断方向：源码读取保留头部，命令输出保留尾部，超长 bash 完整输出落临时文件。
>
> 上层 `pi-tui` 用 16ms 最小渲染间隔、行级差分和 synchronized output 降低闪烁。实验性的 `pi-orchestrator` 给每个实例启动独立 RPC 子进程，用 JSONL 请求响应和事件流隔离故障。它也有一个新的 `AgentHarness`，但当前 coding-agent 仍由旧 `AgentSession + Agent` 驱动，迁移被明确留到 Pi 2.0。这种“当前事实和目标架构并存”的状态，也是我分析时特别注意的边界。

---

## 3. 五层架构

| 层 | 包 | 核心职责 | 关键源码 |
|---|---|---|---|
| 模型运行时 | `packages/ai` | Provider、认证、模型目录、流式事件、跨 Provider 消息转换 | `src/models.ts`、`src/api/transform-messages.ts` |
| Agent 内核 | `packages/agent` | Agent 状态、Agent loop、工具校验与执行、steer/follow-up | `src/agent.ts`、`src/agent-loop.ts` |
| Coding Agent | `packages/coding-agent` | 会话、压缩、扩展、资源加载、文件和 bash 工具、运行模式 | `src/core/agent-session.ts`、`src/core/session-manager.ts` |
| 终端 UI | `packages/tui` | 输入、组件、ANSI/Kitty 协议、差分渲染、虚拟终端测试 | `src/tui.ts` |
| 多实例编排 | `packages/orchestrator` | RPC 子进程、实例元数据、事件转发、Radius presence | `src/supervisor.ts`、`src/rpc-process.ts`、`src/radius.ts` |

依赖方向可以简化成：

```text
用户终端
   │
   ▼
pi-tui ──► pi-coding-agent ──► pi-agent-core ──► pi-ai ──► Provider API
                 │                     │
                 │                     └── 工具执行结果回到 Agent loop
                 ├── JSONL 会话树 / compaction / extensions
                 └── read / edit / write / bash

pi-orchestrator ──► 每个实例一个 coding-agent RPC 子进程
```

这套分层的价值是“变化隔离”：模型协议变化尽量停在 `ai`，Agent 控制流停在 `agent`，编码产品策略停在 `coding-agent`，终端兼容性停在 `tui`。代价是跨层事件和类型较多，调试时必须带着 correlation 信息追完整链路。

---

## 4. 一次请求的端到端链路

### 4.1 启动阶段

1. coding-agent 加载全局配置、项目配置、Prompt、Skill、扩展和主题等资源。
2. Project trust 决定项目本地资源能否加载。注意，它不是文件系统权限控制。
3. `Models` 集合注册 Provider。静态 Provider 直接提供模型目录，动态 Provider 显式 `refresh()`，读路径始终返回 last-known 列表。
4. 创建或恢复 `SessionManager`，从 JSONL 重建 entry 索引、父子关系和当前 leaf。
5. 当前产品路径创建 `AgentSession` 和低层 `Agent`，并不是直接使用新 `AgentHarness`。

### 4.2 用户输入到模型请求

1. TUI 收到输入，交给 `AgentSession.prompt()`。
2. 扩展可以在输入和上下文阶段拦截或改写。
3. Session 把用户消息追加到 JSONL，并构建当前 leaf 的活动路径。
4. 若路径上有 compaction，只把摘要、保留区和摘要之后的消息交给模型；原始 JSONL 历史仍在文件里。
5. `pi-ai` 根据 model 找到所属 Provider，解析认证，转换消息格式，开始统一事件流。

### 4.3 模型返回工具调用

1. 流中生成 assistant message 和一个或多个 tool call。
2. 如果 stop reason 是 `length`，说明工具参数可能被 token 上限截断，整批工具都拒绝执行并返回错误结果。
3. 正常情况先用 TypeBox schema 校验工具名和参数。
4. `beforeToolCall` 可以阻止执行；工具完成后 `afterToolCall` 可以改写结果。
5. 并行模式下，准备完成的调用通过 `Promise.all` 并发执行，但最终 `toolResult` 按原 tool call 顺序写入。
6. 结果加入上下文，再发起下一次模型调用，直到没有工具调用、被终止或用户 abort。

### 4.4 steer 和 follow-up

- steer 是“当前轮完成后立刻改变下一步方向”，不会粗暴插进正在生成的半条 assistant message。
- follow-up 是“Agent 原本准备停止时，再补一条用户请求”。
- 两者队列和触发时机不同，避免把 UI 的连续输入简化成不可控的并发 prompt。

### 4.5 会话落盘和渲染

1. 消息、模型变化、thinking level、compaction、label 等都作为 entry 追加，不覆盖旧 entry。
2. `AgentSession` 向上发事件；TUI 组件把当前状态渲染为行数组。
3. TUI 最快每 16ms 渲染一次，先比较新旧行。
4. 常规变化从第一处差异重绘；宽高变化、变化发生在不可见视口上方等情况执行全量重绘。
5. 写终端的更新包在 `CSI ? 2026 h/l` synchronized output 中，减少中间态闪烁。

---

## 5. 核心设计一：多 Provider 不是统一 URL，而是统一语义

### 5.1 Provider 为什么是运行时单元

`packages/ai/src/models.ts` 的核心思路是：Provider 同时拥有模型目录、认证策略和 stream 行为。模型只是 Provider 下的一个配置对象，底层 wire API 可以复用，例如多个厂商共用 OpenAI-compatible API，但认证、模型发现和请求细节仍归各自 Provider。

这样设计比“modelId 到 baseUrl 的表”更重，但能解决三个现实问题：

- API key、OAuth、云厂商 ambient credentials 的解析方式不同。
- 静态模型目录与 llama.cpp、OpenRouter 一类动态目录生命周期不同。
- 同样叫 tool calling，不同 API 对消息、reasoning、tool ID 和错误格式的约束不同。

### 5.2 为什么读模型目录是同步的，刷新是显式异步的

`getModels()` 返回 last-known 数据，`refresh()` 才访问远端。好处是 UI 列表、补全和状态栏不会因为一次网络请求都被迫异步化；刷新失败也不会把已有目录清空。全量刷新可并发、best effort，单 Provider 刷新则显式报错。

代价是数据存在陈旧窗口，所以调用方要能展示“最后已知”和刷新错误，不能把同步读取误解成强实时。

### 5.3 跨模型切换为什么必须转换历史

会话从 Anthropic 切到 OpenAI-compatible 模型时，历史不能原样转发：

- reasoning signature 往往只对原模型或原 Provider 有效，需要清除不可移植部分。
- tool call ID 的字符集和长度限制可能不同，需要规范化。
- 某些历史中可能存在 tool call 没有对应 tool result，需要补一个错误结果维持协议配对。
- 不同接口对图片、thinking 和空内容的表达不同。

所以“支持多模型”不是多写几个 SDK client，真正难的是跨模型延续同一条会话时仍保持协议合法。

---

## 6. 核心设计二：并行工具要同时满足吞吐和确定性

工具调用有两个顺序：执行完成顺序和模型声明顺序。Pi 可以并发执行没有显式依赖的调用，但 `executeToolCallsParallel()` 先按原顺序保存 promise，再用 `Promise.all` 等待，最后仍按原数组顺序生成 tool result。

这样做的收益是：

- 两个慢查询可以并发，减少 wall-clock time。
- 下轮模型看到的上下文顺序稳定，便于复现、缓存和测试。
- tool call 和 tool result 的配对关系不受网络完成时序影响。

但并发工具仍可能有副作用冲突。Pi 在文件层又加了一层约束：`file-mutation-queue.ts` 先对路径 `resolve`，已存在文件再取 `realpath`，同一真实文件串行，不同文件仍并行。这能挡住相对路径和符号链接指向同一文件时的覆盖竞争。

它不是事务系统。如果一个批次先改 A 文件、再改 B 文件，而 B 失败，A 不会自动回滚。需要跨文件原子性时，应在更高层增加 workspace snapshot、patch staging 或事务式工具，而不是误以为 `Promise.all` 提供事务。

---

## 7. 核心设计三：文件编辑正确性优先于“尽量猜中”

`edit` 工具采用 exact search/replace，不让模型直接提交一个模糊自然语言补丁。关键约束有：

1. 每个 `oldText` 在原文件中必须唯一。
2. 多个 edit 都相对同一个原文件匹配，不是前一个改完再匹配后一个。
3. 多个修改区间不能重叠或嵌套。
4. 写回时保留 UTF-8 BOM 和原有换行风格。
5. 文件变更进入同文件 mutation queue。

“唯一锚点”看起来会让模型多重试一次，但 silent wrong edit 的成本远高于显式失败。尤其在重复代码、生成文件和测试表格里，替换第一处匹配是危险行为。

和 Aider 的公开 edit format 对照看，二者都在降低整文件重写的 token 成本。Aider 会按模型选择 whole、search/replace、unified diff 等格式；Pi 的内置 `edit` 更像一个强约束 search/replace 执行器。这里没有绝对最优：whole format 简单但贵，diff 高效但解析和定位更复杂，AST edit 语义强但语言覆盖和格式保真成本高。

---

## 8. 核心设计四：工具输出截断是上下文预算策略

默认工具输出上限可从源码验证：2000 行或 50KB，先到哪个就截断。

- `read` 保留头部，因为源码的 import、类型声明、文件结构通常在前面，并且支持用 offset 继续读。
- `bash` 保留尾部，因为错误栈、测试总结、退出原因通常在最后；若截断，完整输出保存到临时文件。

这不是单纯的 UI 优化，而是 Agent 的信息架构。把 10MB 日志直接塞回上下文，会挤掉需求、已经做出的决定和关键代码。反过来，只截断不保留证据也不行，所以 bash 把完整输出卸载到文件，并把路径告诉模型。

风险是模型可能不知道中间被省略的部分是否关键。更强的方案可以增加结构化摘要、错误块检测、按测试用例分组和可按需检索的 artifact index，但这些属于改进方案，不是当前工具已经完整实现的能力。

---

## 9. 核心设计五：会话是追加式树，压缩是视图变化

### 9.1 为什么用 JSONL

`SessionManager` 把每个 entry 作为一行 JSON 追加到文件。它的工程优势是：

- 进程异常时，通常只影响最后一行，前面记录仍可恢复。
- 写放大低，不需要每轮重写整个大 JSON。
- 便于流式审计、迁移和人工排查。

它不等于数据库：多进程并发写、索引、权限、加密和大规模查询能力有限。Pi 的使用前提更接近单会话单 writer。

### 9.2 为什么是树而不是消息数组

每个 entry 有 `id` 和 `parentId`，Session 保存当前 `leafId`。从历史 entry 分支时，只移动 leaf；下一条 append 自然成为旧节点的新 child，原路径不删除。

这让“回到前面重试”“保留多个探索方向”“给放弃分支生成摘要”不需要复制整份历史。构建模型上下文时只沿当前 leaf 回溯一条路径。

### 9.3 compaction 为什么不删历史

compaction 本身也是一条 entry，保存摘要和 `firstKeptEntryId`。构建活动上下文时，用摘要替代更老的路径片段，再拼上最近原文；JSONL 中的原始消息仍然存在。

所以它同时满足两个目标：模型上下文变短，审计证据不丢。代价是摘要可能失真，磁盘文件仍会增长，后续仍需要 retention、导出和隐私删除策略。

### 9.4 什么时候压缩

默认设置为：

- `reserveTokens = 16384`
- `keepRecentTokens = 20000`
- 触发条件：`contextTokens > contextWindow - reserveTokens`

这里的 20000 是“近似保留”，因为切点必须满足消息协议。源码明确禁止从 `toolResult` 处切断，它必须跟在对应 tool call 后面。

### 9.5 超长单轮怎么处理

普通压缩总结旧历史，保留最近消息。如果单个用户轮次本身已经超长，切点可能落在这一轮中间，Pi 会分别总结更老历史和当前轮被裁掉的前缀，避免只做一个摘要后仍然装不下。

若 Provider 已返回 context overflow，`AgentSession` 会移除该错误消息，压缩后自动重试一次。恢复失败不会无限 compact-retry，避免不可终止循环。

---

## 10. 核心设计六：扩展能力强，也意味着信任边界很重

扩展 runner 按注册顺序执行 hook，可覆盖输入、上下文、请求、工具调用和会话生命周期。典型控制点包括：

- 输入是否消费、转换或继续。
- 发给模型前的 context 调整。
- `beforeToolCall` 阻止执行。
- `afterToolCall` 改写输出。
- Agent start/end/settled、session 生命周期事件。

顺序执行更容易理解和复现，但一个慢扩展会拖慢整条链路，一个恶意扩展也有很大权限。扩展通过 `jiti` 加载，运行在宿主进程，拥有宿主用户的实际权限。

必须把两个概念分开：

- Project trust：不信任项目时，不加载项目本地配置、Skill 和扩展等资源。
- Tool sandbox/permission：限制读写、进程、网络和凭据访问。

Pi README 明确说明它没有内置的文件系统、进程、网络或凭据权限系统，默认继承启动用户权限；需要强隔离应使用容器、微型虚拟机或策略沙箱。Project trust 不是 sandbox。

---

## 11. 核心设计七：TUI 不是反复 clear screen

TUI 组件统一返回“给定宽度下的行数组”，渲染器维护 previous lines、terminal width/height、viewport top 和 cursor row。

三类策略是：

1. 首次渲染：输出全部内容，但不清空 scrollback。
2. 宽高变化或差异发生在不可见区域上方：清屏后全量重绘。
3. 普通更新：定位到第一处变化，清除受影响区域并写新行。

`MIN_RENDER_INTERVAL_MS = 16`，因此更新频率上限约为 60 FPS。它用 synchronized output 包裹一次更新，避免用户看到光标移动、清行、写行的中间过程。Kitty 图片还需要把图像占用范围纳入差分判断，否则局部文字重绘可能破坏图片。

这里的难点不是 React 式组件 API，而是 ANSI 序列的可见宽度、宽字符、IME 光标、图片协议、resize、scrollback 和真实终端差异。项目提供 `VirtualTerminal` 做 headless 测试，是比只做字符串快照更可靠的方向。

---

## 12. 核心设计八：Orchestrator 用进程隔离换故障边界

实验性的 orchestrator 为每个 Pi 实例启动独立 RPC 子进程。父进程通过 JSONL 发送带关联信息的 command，接收 response 和持续 event，并把实例的 cwd、sessionId、sessionFile、status 等元数据持久化。

使用子进程而不是同进程多对象的收益是：

- 单实例崩溃、内存泄漏或扩展异常不必直接拖垮其他实例。
- cwd、环境和生命周期边界更自然。
- coding-agent 已有 RPC 模式，可以复用稳定协议。

代价是进程启动成本、IPC 背压、事件关联、异常退出清理和孤儿进程治理。Node 官方文档也提醒，stdout/stderr pipe 容量有限；若父进程不持续消费，子进程可能阻塞。因此 RPC reader、输出限流和 dispose 都是正确性问题，不只是性能问题。

Radius presence 侧通过心跳维持 machine/Pi 在线状态，临时错误使用退避，服务端记录失效时会重新注册。Supervisor 重启恢复时，把原先 online/starting 的持久化实例标为 stopped，并清理远端 presence，而不是假装子进程仍然存活。

---

## 13. 新 AgentHarness 与当前产品路径的边界

新 `packages/agent/src/harness/agent-harness.ts` 已经具备：

- 持久化 session 抽象和树导航；
- 基础事件、Provider/tool hook 点和 `on()` 注册能力；
- 明确的 `idle/turn/compaction/branch_summary/retry` 操作阶段；
- steer/follow-up；
- 对 pending session writes 的排序；
- 手动 compaction 和 branch summary。

但当前 `pi-coding-agent` 仍由 `AgentSession` 驱动低层 `Agent`，文档明确把 `AgentSession -> AgentHarness` 留为 Pi 2.0。新 Harness 也不能被描述为已经替代旧 session 的自动压缩、溢出恢复和自动重试决策；通用 typed reducer/hook facade 和崩溃后的完整 durable recovery 同样仍是设计或 TODO。

面试时这点非常重要：

> 我看到仓库里同时有旧运行路径和新 Harness，所以我沿实际调用关系确认了生产路径，而不是看到一个新类就把设计文档当现状。当前 Harness 已经把 session、基础 hook 点和 phase 抽到更通用的层，但 coding-agent 的自动 compaction/retry 仍在 AgentSession 里，迁移还没有完成。

---

## 14. 关键工程取舍

| 问题 | 当前选择 | 收益 | 代价/边界 |
|---|---|---|---|
| 多模型 | Provider 统一运行时和语义转换 | 可切换 Provider、上层协议稳定 | 转换矩阵复杂，需大量兼容测试 |
| 动态目录 | 同步 last-known read + 显式 refresh | UI 简单、刷新失败不清空 | 有陈旧窗口 |
| 工具并发 | 并发执行、按声明顺序写回 | 吞吐和确定性兼得 | 不提供跨工具事务 |
| 文件编辑 | 唯一 exact anchor、拒绝重叠 | 失败显式，降低误改 | 模型可能多轮重试 |
| 工具输出 | read 留头、bash 留尾、完整日志卸载 | 节省上下文且保留证据 | 中段信息需要二次读取 |
| 会话 | 追加式 JSONL 树 | 可审计、可分支、恢复简单 | 查询、并发写、retention 较弱 |
| 压缩 | 摘要改变活动视图，不删原记录 | 上下文可控、证据保留 | 摘要会丢信息，磁盘仍增长 |
| 扩展 | 宿主内高权限 hook | 自扩展能力强 | 必须信任扩展代码 |
| TUI | 行级差分 + 同步输出 | 低闪烁、保留 scrollback | 终端兼容状态复杂 |
| 多实例 | 每实例一个 RPC 子进程 | 故障隔离 | IPC、资源和进程治理成本 |

---

## 15. 失败模式和排查顺序

### 15.1 工具参数只生成了一半却执行了删除命令

当前防线是 stop reason 为 `length` 时整批拒绝执行。排查顺序：确认 Provider stop reason 是否正确映射；确认 partial JSON 是否被误判为完整；确认 Agent loop 是否走了 `failTruncatedToolCalls()`；最后补 provider-specific regression。

### 15.2 两个并行 edit 互相覆盖

先看是否指向同一真实文件，再看 mutation queue key 是否经过 `realpath`。如果是跨文件业务一致性问题，当前 queue 解决不了，需要事务式上层工具。

### 15.3 压缩后模型忘记关键约束

先区分原始消息是否还在 JSONL、活动上下文是否引用正确 compaction、摘要 prompt 是否漏掉 decision/constraint/file state。恢复原文不等于模型自动想起，必要时从证据重建更好的摘要。

### 15.4 Provider 返回 429 却触发 compaction

这是错误分类问题。Rate limit 应走指数退避，context overflow 才压缩。需要在 `pi-ai` 统一错误层保留 HTTP status 和 provider code，避免靠一条过宽的字符串正则分类。

### 15.5 TUI 偶发花屏

抓原始 ANSI 写日志，记录宽高、previous/new lines、viewport top、first changed row 和是否含图片；用 VirtualTerminal 重放。不能只在当前终端手工试，因为 Kitty、iTerm、Windows Terminal 对协议支持不同。

### 15.6 RPC 子进程看似在线但不响应

区分进程存活、RPC reader 存活、事件循环被阻塞和 Radius presence 四种状态。心跳成功不等于 Agent 可执行；生产化需要独立 readiness、请求 deadline、队列深度和最后成功响应时间。

---

## 16. 安全边界

### 16.1 当前能确认的事实

- 内置 `read/edit/write/bash` 默认继承宿主进程权限。
- 扩展在宿主内执行，不是隔离插件。
- Project trust 只约束项目本地资源加载。
- 强隔离依赖外部容器、微型 VM 或策略沙箱。

### 16.2 如果让我做企业版

我会把控制面拆成五层：

1. 能力声明：工具声明需要的 fs/process/network/secrets 能力。
2. 策略决策：按用户、仓库、分支、命令类别和数据级别计算 allow/ask/deny。
3. 执行隔离：workspace mount、网络 egress、资源上限和临时凭据放进 sandbox。
4. 人机确认：只对不可逆或跨边界动作确认，不对每次 read 弹窗。
5. 审计追踪：记录原始 tool call、规范化参数、策略结论、执行主体、结果摘要和 artifact hash。

仅加一个“是否允许执行”弹窗不够，因为被允许的命令仍可能通过 shell 间接访问所有凭据和网络。

---

## 17. 可观测性与性能验证

仓库源码能确认机制，不能据此编造性能结果。真正压测至少分四层：

| 层 | 核心指标 | 关键维度 |
|---|---|---|
| 模型 | TTFT、tokens/s、错误率、重试次数、成本 | Provider、模型、上下文长度、cache hit |
| Agent | 单轮 wall time、工具等待、轮数、abort 延迟 | 并行/串行、工具数、steer/follow-up |
| 工具 | p50/p95/p99、输出字节、截断率、失败类型 | read/edit/bash、文件大小、命令类型 |
| TUI/编排 | render time、写入字节、全量重绘率、IPC backlog | 终端、宽高、图片、多实例数 |

建议统一 trace 结构：

```text
session_id -> agent_run_id -> turn_id -> model_request_id
                                  └── tool_call_id -> execution_id
orchestrator_instance_id -> rpc_request_id
```

日志默认不能记录完整 prompt、代码、环境变量和工具输出。OpenAI Agents SDK 的公开 tracing 文档也专门提供禁用 tracing 和控制敏感数据的能力，这说明“可观测”与“数据最小化”必须一起设计。

---

## 18. 横向对比

### 18.1 与 OpenAI tool calling / Agents SDK

共同点是工具由 schema 描述，模型返回 call，应用执行并带 call id 回传。OpenAI 官方把它明确描述为多步对话，并提供 strict schema、parallel tool calls 和 tracing。Pi 的分析重点是：在统一 API 之上再处理跨 Provider 消息迁移、文件 mutation queue、JSONL 会话树和终端产品层。

### 18.2 与 MCP

MCP 解决宿主、client、server 之间的能力和上下文互操作，规范强调 host 管理权限、每个 client 与 server 维持 1:1 stateful session。Pi 的内置工具和扩展是本地宿主机制，不应直接叫 MCP。两者可以组合：把外部能力通过 MCP server 暴露，再由 Pi 宿主做策略和上下文编排。

### 18.3 与 Agent Skills

Agent Skills 规范要求一个目录至少包含带 YAML frontmatter 的 `SKILL.md`，可以配套 scripts、references、assets。它解决的是可发现、可渐进加载的过程知识；它本身不提供工具权限隔离。Pi 对项目 Skill 的 trust 策略正好说明“知识加载”和“执行授权”是两层问题。

### 18.4 与 LangGraph persistence

LangGraph 公开文档把 checkpointer 的 thread-scoped state 和 store 的 cross-thread long-term memory分开。Pi 的 JSONL session tree 更接近对话执行历史和分支日志，不是完整的长期用户记忆 store。不要把 session persistence、context compaction 和 long-term memory 混成一个概念。

### 18.5 与 Aider

Aider 的 repo map 用 tree-sitter 提取关键符号，再基于依赖图排序，在 token budget 内选择相关片段；edit format 会按模型选择 whole、diff、udiff 等。Pi 当前更强调多 Provider 运行时、可扩展会话和严格工具执行。若增强大仓库理解，repo map/符号图是值得借鉴的方向，但不能说 Pi 当前已经采用 Aider 的图排序算法。

### 18.6 与长上下文模型

“窗口足够大就不需要 compaction”并不成立。Lost in the Middle 论文发现，相关信息位于长上下文中部时，模型表现可能显著下降。上下文工程目标不只是“塞得下”，还包括相关性、位置、证据保真和成本。Pi 的保留近期原文加历史摘要是一个工程折中，不代表摘要损失已经被彻底解决。

---

## 19. 口语化面试问答

以下答案都按“我分析过这个项目”的第一人称口径组织。

### 19.1 题库覆盖矩阵与使用顺序

| 题号 | 覆盖范围 | 建议用法 |
|---|---|---|
| Q1-Q8 | 项目定位、架构和价值 | 任何面试先掌握 |
| Q9-Q16 | 多 Provider 基础 | AI 应用岗必问 |
| Q17-Q27 | Agent loop 与工具执行基础 | Harness/Agent 岗必问 |
| Q28-Q42 | 文件工具、会话树和压缩基础 | Coding Agent 核心 |
| Q43-Q49 | 扩展与安全基础 | 安全压力追问 |
| Q50-Q56 | TUI 与 Orchestrator 基础 | 客户端/Node.js 岗 |
| Q57-Q64 | 架构演进和系统设计 | 高级岗位收尾 |
| Q65-Q96 | `pi-ai` 流协议、认证、缓存和兼容层 | Provider 源码深挖 |
| Q97-Q126 | Agent、AgentHarness 生命周期和恢复边界 | 运行时源码深挖 |
| Q127-Q160 | 资源加载、配置、Skill、Prompt 和扩展 | 产品化能力深挖 |
| Q161-Q180 | Session、compaction、branch 和 retry | 长任务状态治理 |
| Q181-Q200 | 文件、进程、图片、安全和沙箱 | 副作用与安全治理 |
| Q201-Q225 | TUI、RPC、子进程和 Radius | 终端与多实例编排 |
| Q226-Q250 | 测试、性能、可观测性、真实性和开放题 | 压力面与终面 |

准备顺序建议是先熟练 Q1-Q64，再按岗位补对应模块，最后用 Q226-Q250 检查自己能否回答验证方法、项目边界和个人判断。

### A. 项目定位与架构

### Q1：你为什么选 Pi-mono 做源码分析？

> 我选它主要因为链路够完整。很多 Agent 示例只到模型调用和工具循环，Pi 还覆盖了多 Provider、会话分支、上下文压缩、文件并发写、扩展、TUI 和多进程编排。我可以沿一条真实请求讨论协议、状态、一致性和安全，而不是只讲一个 ReAct 概念。

### Q2：这个项目最核心的技术问题是什么？

> 我认为不是“让模型会调 shell”，而是把概率性的模型输出接到确定性的工程系统。模型可能输出半截 JSON、重复调用、选错工具；文件系统和进程有真实副作用；上下文和终端又是有状态的。Pi 的核心价值是用校验、顺序、追加日志、截断和恢复机制把这些不确定性收住。

### Q3：为什么要拆成五个包，一个包不能做吗？

> 一个包当然能跑，但变化会互相污染。Provider 协议更新不应该迫使 TUI 改；终端 resize bug 不应该进入 Agent loop；coding-agent 的 compaction 策略也不该固化到通用模型库。五层拆分让依赖方向清楚，代价是事件链更长，所以必须靠类型和 trace id 保持可调试。

### Q4：从用户按回车到看到结果，最短链路是什么？

> TUI 把输入交给 AgentSession，Session 追加用户消息并构建活动上下文，Agent 通过 Models 找到 Provider，Provider 流式返回 assistant 内容。如果没有工具调用，消息落盘后 TUI 根据事件更新组件并差分渲染；有工具调用就先执行工具，把 result 回传模型，再继续下一轮。

### Q5：哪一层是业务核心？

> 如果从产品看是 coding-agent，因为会话、压缩、扩展、工具和交互策略都在这里；如果从可复用内核看，`ai + agent` 更基础。我不会说某一层绝对核心，而会按问题分：模型兼容看 ai，控制流看 agent，产品行为看 coding-agent。

### Q6：这是一个工作流引擎吗？

> 当前主路径更像事件驱动的 Agent loop，不是显式 DAG 工作流。控制权主要由模型根据上下文决定，steer 和 follow-up 调整后续输入。它可以承载多步任务，但没有把每一步都建模成可独立重放、带幂等边界的图节点，所以不要直接等同于 LangGraph 这类工作流运行时。

### Q7：它是不是多 Agent 系统？

> 单个 coding-agent 会话本质上还是一个 Agent loop。Orchestrator 可以启动多个隔离实例，但“多实例”不自动等于“多 Agent 协作”，因为当前重点是进程生命周期和 RPC 转发，不是任务拆解、角色协商、共享黑板或冲突合并。

### Q8：你认为这个架构最大的风险是什么？

> 我认为是扩展性和权限耦合。扩展能力很强，但运行在宿主权限下；多 Provider 兼容矩阵也会持续扩大。前者需要 sandbox 和 policy，后者需要 contract test、faux provider 和 provider-specific regression，否则功能越多，行为漂移越难发现。

### B. 多模型与协议适配

### Q9：为什么 Provider 不只是一个 baseUrl？

> 因为 Provider 还拥有认证、模型发现和流行为。OpenAI key、OAuth、AWS ambient credential 生命周期完全不同；动态本地模型目录也不是静态 JSON。把这些都放进 Provider，`Models` 才能按模型找到真正负责这次请求的运行时。

### Q10：同步 getModels 和异步 refresh 有什么好处？

> 读路径拿 last-known 列表，UI 和补全不需要层层 async；网络刷新是显式动作，失败也保留旧目录。缺点是会有陈旧数据，所以我会补 lastUpdatedAt、stale 状态和刷新错误，而不是把缓存结果伪装成实时真相。

### Q11：切换模型为什么会破坏历史消息？

> 因为历史里不只有文本，还有 Provider 专属的 reasoning signature、tool call id 和内容块格式。一个 Provider 接受的 ID 可能被另一个拒绝，reasoning 签名也不能跨模型验证。Pi 在发送前做清理、规范化和孤立 tool result 修复，目标是让历史在新协议下仍合法。

### Q12：为什么要给孤立 tool call 补错误结果？

> 多数工具协议要求 call 和 result 配对。分支、abort 或旧数据迁移后，历史可能只剩 call，没有 result。直接发送会触发 Provider 400；补一个明确错误结果既维持结构合法，也诚实告诉模型这个调用没有成功，而不是伪造成功。

### Q13：统一 API 会不会抹平 Provider 特性？

> 会有这个风险，所以好的统一层应该统一稳定语义，同时保留 typed provider options。比如文本、thinking、tool call、usage 可以统一；reasoning budget、cache retention 或传输设置可以留在 API-specific options。完全取交集会让高级能力都丢掉，完全透传又失去统一价值。

### Q14：Provider 错误应该在哪一层重试？

> 我倾向只让一层拥有主要重试决策。Pi 文档也提醒 provider SDK retry 和 AgentSession retry 叠加会造成长时间阻塞。连接级短暂错误可以由底层有限处理，但 429、5xx、overflow 的分类、用户可见事件和取消应由 AgentSession 统一治理，避免指数级重试放大。

### Q15：怎么测试几十个 Provider，而不真的花 API 费用？

> 公共控制流用 faux provider，固定流事件、tool call、错误和 usage；每种 wire API 做 contract fixture，验证 request transform 和 stream parsing；再给关键 Provider 做少量线上 smoke test。不能所有测试都打真实 API，也不能只 mock 到连协议 bug 都看不到。

### Q16：多模型切换的验收标准是什么？

> 至少验证文本、图片、thinking、工具调用配对、abort、usage、overflow 和历史分支。测试要覆盖 A Provider 生成历史、B Provider 继续，而不只是分别单测 A 和 B。真正容易出错的是转换矩阵，不是单 Provider happy path。

### C. Agent loop 与工具执行

### Q17：Agent loop 的退出条件有哪些？

> 正常是 assistant 不再返回 tool call；另外还有 abort、致命错误、工具请求终止批次等路径。Session 层还可能在低层 run 结束后继续做 retry、overflow compaction 或 follow-up，所以 `agent_end` 不一定代表彻底空闲，真正对外的完成语义应看 settled。

### Q18：为什么工具参数要在 Agent 层再校验？

> 模型的 schema adherence 不是安全边界，而且不同 Provider strict 支持不一致。Agent 层用 TypeBox 对最终参数做一次确定性校验，失败作为 tool result 反馈模型，让它有机会修正。即使 API 声称 strict，我也不会跳过执行侧校验。

### Q19：为什么 token 截断时整批工具都不执行？

> 因为 stop reason 是 length 时，已解析出来的某个调用也可能只是 salvage 出来的半截参数。像删除路径、SQL 条件这种参数，少一个字段就可能扩大副作用。宁可整批显式失败并让模型重发，也不要猜哪个调用是完整的。

### Q20：为什么工具要并行？

> 模型一次可能请求读三个互不相关的文件，串行只会把 I/O 延迟相加。并行能降低 wall-clock time。但并行是优化，不是默认正确性假设，所以工具配置需要能选择 sequential，文件写还要有同目标串行队列。

### Q21：并行完成顺序不同，怎么保证上下文稳定？

> Pi 按模型声明顺序保存待执行项，`Promise.all` 虽然并发等待，但返回数组仍按输入顺序排列，最后按该顺序生成 tool result。这样真实完成顺序不会污染模型上下文，重放和测试也更稳定。

### Q22：按顺序写回会不会浪费流式收益？

> 工具执行事件仍可以实时上报，最终给模型的消息顺序保持稳定。若想让模型在第一个结果完成时就继续推理，那就改变了批次语义，需要支持增量 tool result 和未完成调用状态，复杂度更高。当前选择更偏确定性。

### Q23：beforeToolCall 和 afterToolCall 分别解决什么？

> before 适合授权、参数规范化和危险动作阻断；after 适合脱敏、结果裁剪、埋点或把宿主格式转成模型格式。前者发生在副作用前，后者不能撤销已经发生的副作用，所以安全策略不能只放 after。

### Q24：steer 和 follow-up 有什么区别？

> steer 是 Agent 还在工作时，要求当前轮结束后优先调整方向；follow-up 是它本来准备停下时再追加任务。分开能保证交互语义，避免用户新输入直接插进正在流式生成的 assistant/tool call 中间。

### Q25：用户 abort 时怎样保证一致性？

> AbortSignal 要一路传到模型请求和工具。已经完成的副作用不能假装回滚，结果和中止状态仍应落盘；未开始的串行调用不要继续启动。对 shell 还要处理子进程终止和子孙进程，否则只取消 JS promise 没有实际意义。

### Q26：工具执行需要 exactly-once 吗？

> 普遍做不到。网络断在“工具完成、结果尚未落盘”之间时，系统不知道是否执行过。更实际的是给可重试工具 idempotency key，记录 started/completed，恢复时按工具类型选择查询、补偿或让用户确认；危险工具默认不自动重放。

### Q27：工具调用怎么做可观测性？

> 我会记录 session、run、turn、toolCallId、工具名、参数摘要、策略结论、排队时间、执行时间、截断信息和结果状态。参数和结果默认脱敏或只存 hash/artifact reference，不能为了 tracing 把源码、token 和环境变量全打进日志。

### D. 文件工具、会话与压缩

### Q28：为什么 edit 不直接让模型输出完整文件？

> 完整文件最容易解析，但小改动也要重复输出大量未变化内容，token 成本高，还容易意外丢代码。Pi 用 exact search/replace，让模型只给目标片段；执行器再验证唯一性和重叠。代价是锚点不唯一时要重试，但这是显式失败，比静默改错位置更好。

### Q29：oldText 为什么必须唯一？

> 如果同一段代码出现三次，工具随便替换第一处，语法可能仍然通过，但业务已经改错。唯一性要求迫使模型补足类名、函数上下文或相邻语句，把“我猜是这里”变成可验证定位。

### Q30：一个 edit 调用里多个替换为什么都相对原文件？

> 这样每个 edit 的含义独立，不受前一个替换造成的行号和文本漂移影响，也能预先检测区间重叠。如果改成增量匹配，后一个 oldText 可能因为前一个修改消失，模型和执行器对基准版本的理解就不一致。

### Q31：怎么处理 CRLF 和 BOM？

> 匹配前把不可见 BOM 分离，模型不需要在 oldText 里生成 BOM；写回再恢复。换行也按原文件风格规范化和还原，避免在 Windows 仓库里因为一个小修改制造全文件 diff。这是文件工具应该承担的格式保真，不应交给模型碰运气。

### Q32：为什么同一文件串行，不同文件并行？

> 同一文件两个 read-modify-write 并发会发生 lost update；不同文件没有这个直接冲突，串行会白白损失吞吐。Pi 用规范化路径和 `realpath` 做 queue key，还能识别两个符号链接实际指向同一文件。

### Q33：realpath 能解决所有路径竞争吗？

> 不能。文件不存在时只能用 resolve 后路径；检查到写入之间还可能发生符号链接替换；跨进程也不共享内存 queue。企业安全场景需要 sandbox 内固定 workspace、`openat` 类安全路径解析、文件锁或单 writer 服务，不能只靠进程内 Map。

### Q34：read 为什么保留头，bash 为什么保留尾？

> 这是按信息分布做的策略。源码头部通常有 import、类型和总体结构，日志尾部通常有失败栈和测试总结。两者默认都是 2000 行或 50KB，但方向不同。这个细节说明上下文治理不能只设一个统一字符上限。

### Q35：bash 完整输出写临时文件有什么价值？

> 模型上下文只放尾部和文件路径，既避免日志淹没上下文，又保留可追溯证据。模型判断中段可能重要时可以再读文件。后续要补的是临时文件生命周期、权限、容量配额和敏感日志清理。

### Q36：为什么 session 用 JSONL，不用 SQLite？

> JSONL 很适合单 writer 的追加事件：写一条成本低，崩溃通常只伤最后一行，人工也能直接看。SQLite 更适合多会话索引、事务、查询和 retention。当前本地 CLI 选择 JSONL很务实；如果做服务端多租户，我会把事件日志和查询索引分开设计。

### Q37：JSONL 怎样支持分支？

> 每条 entry 有 id 和 parentId，当前 leaf 指向活动路径末端。回到旧节点只改变 leaf，下一条消息就成为它的新 child，旧分支原样保留。模型上下文通过从 leaf 沿 parent 回溯构造，不需要复制整个会话。

### Q38：compaction 和删除历史有什么本质区别？

> compaction 是新增一条摘要 entry，并改变以后构造给模型的活动视图；原始消息仍在 JSONL。删除历史则连审计和恢复证据都没有了。所以 Pi 的压缩解决 token 预算，不等同于数据 retention 或“用户要求删除数据”。

### Q39：为什么不能从 toolResult 处切断？

> toolResult 依赖前面的 assistant tool call。把结果留在上下文而删掉 call，会违反 Provider 的消息协议；只留 call 不留 result 也一样有问题。Pi 把合法切点限制在 user-like 或 assistant 边界，并保持调用结果组完整。

### Q40：16384 reserve 和 20000 keep 是怎么理解的？

> 它们是源码默认值，不是我声称的最优值。reserve 给下一次模型输出和工具循环留空间，keepRecent 让最近工作状态尽量保留原文。真正调参要按模型窗口、平均工具输出、任务轮数和摘要质量做数据验证，不能看到常量就编一个经验结论。

### Q41：单轮输入已经特别长，普通压缩为什么不够？

> 普通策略假设“旧历史大、最近一轮可保留”，但一轮里可能读了大量文件和日志。Pi 允许切点落在这一轮中间，然后分别总结旧历史和当前轮前缀，再保留后半段。否则总结完旧历史仍然超窗。

### Q42：压缩后的信息损失怎么评估？

> 我会从任务恢复能力而不是摘要 ROUGE 分数评估。准备包含约束、文件状态、失败尝试、待办和证据引用的长任务，在压缩前后继续完成同一目标，对比成功率、错误修改、回读次数和 token。还要专门把关键事实放在上下文中部，覆盖 Lost in the Middle 风险。

### E. 扩展与安全

### Q43：扩展为什么按注册顺序执行？

> 顺序执行让多个 hook 的覆盖关系可预测，例如第一个扩展规范化参数，第二个做策略判断，第三个脱敏。并行执行虽然快，但多个扩展同时改 context 或 tool result 时很难定义合并规则。代价是慢扩展会阻塞链路，所以需要耗时指标和可配置超时。

### Q44：扩展出错应该 fail-open 还是 fail-closed？

> 要按职责区分。安全授权、数据脱敏属于 fail-closed，扩展异常就不能继续危险动作；主题、状态栏、非关键 telemetry 可以 fail-open。统一吞异常会绕过安全，统一阻断又会让一个 UI 插件拖垮 Agent。

### Q45：Project trust 解决了什么？

> 它解决“进入陌生仓库时，要不要执行仓库提供的配置、Skill 和扩展代码”。不信任就不加载这些项目本地资源，能挡住一类供应链攻击。但内置 bash 仍继承宿主权限，所以 trust 不是工具授权，更不是 OS sandbox。

### Q46：Skill、Prompt 和 Tool 有什么区别？

> Skill 是可按需加载的过程知识，Prompt 是当前请求里的指令上下文，Tool 是能产生外部读取或副作用的能力。Skill 告诉模型“怎么做”，Tool 才真正“能做什么”。把三者分开后，知识发现、token 预算和权限决策才能分别治理。

### Q47：为什么本地 Coding Agent 特别需要 sandbox？

> 因为它同时能读源码、执行进程、访问网络，还经常继承云凭据和 Git 凭据。Prompt injection 一旦诱导它跑命令，影响不只是聊天内容。真正边界应在 OS/容器层限制 mount、egress、secret 和资源，而不是只靠系统提示词说“不要做危险操作”。

### Q48：你会怎样设计命令审批？

> 先解析能力，而不是硬编码几个字符串。只读 repo 内命令可自动允许；写 repo、访问网络、读取 repo 外路径、操作凭据、系统包管理分级处理；复合 shell 命令按最高风险判定。批准还要绑定规范化后的命令、cwd 和有效期，避免批准 A 实际执行 B。

### Q49：如何防 Prompt Injection 通过工具结果进入模型？

> 首先把工具内容标成不可信数据，不能让网页或仓库文本自动获得 system 权限。其次做能力最小化和高风险动作二次决策，因为文本检测一定会漏。对外部内容保留来源、隔离指令和数据区域，敏感工具还要通过独立 policy engine，而不是让同一个被注入的模型自我审批。

### F. TUI 与 Orchestrator

### Q50：TUI 为什么做行级差分？

> 每个 token 都 clear screen 会闪烁、破坏 scrollback，也会产生大量终端写入。Pi 先比较行数组，只从第一处变化重绘；结合 16ms 最小间隔，把高频 token 合并成帧。用户感知更稳定，终端 I/O 也更小。

### Q51：什么情况下必须全量重绘？

> 终端宽高改变、变化出现在旧 viewport 上方、删除内容导致视口位置不再可靠，或者图片覆盖范围让局部更新不安全时，都应全量重绘。差分渲染的原则不是“永不清屏”，而是只有状态无法可靠增量推导时才清屏。

### Q52：synchronized output 有什么作用？

> 一次更新往往包含移动光标、清行和写多行。没有同步输出，终端可能把中间步骤逐个显示出来。`\x1b[?2026h` 到 `\x1b[?2026l` 让支持该协议的终端把整批更新原子呈现，主要解决视觉撕裂，不替代差分算法本身。

### Q53：TUI 最难测试的是什么？

> 不是普通 ASCII 文本，而是 ANSI 样式宽度、CJK 宽字符、IME 光标、resize、scrollback、图片和不同终端协议差异。我会用 VirtualTerminal 验证屏幕状态，用原始 ANSI 日志重放，再选 Kitty、Ghostty、iTerm、Windows Terminal 做少量兼容矩阵测试。

### Q54：Orchestrator 为什么每实例一个子进程？

> 它用进程成本换故障和环境隔离。每个实例有独立 cwd、AgentSession、扩展和资源，单实例异常不直接污染其他实例。父进程只维护 RPC、事件订阅和元数据，边界比同进程放多个复杂对象清晰。

### Q55：为什么 RPC 用 JSONL？

> coding-agent 本来就有流式 JSON 协议，JSONL 易调试、跨语言、适合一行一事件。请求需要 id 做关联，事件则独立转发。它的缺点是 schema 演进、二进制数据和高吞吐不如专门协议，所以要有版本、大小限制和背压。

### Q56：心跳成功是否说明实例健康？

> 不一定。心跳只说明 presence 路径还能工作，Agent 可能死锁、RPC 堵塞或工具卡住。我会把 liveness 和 readiness 分开：进程/心跳是 liveness，轻量 RPC 探测、队列深度、最后完成时间和执行能力才更接近 readiness。

### G. 演进、系统设计与压力追问

### Q57：新 AgentHarness 已经替代 AgentSession 了吗？

> 没有。源码和设计文档都显示 coding-agent 当前仍由 AgentSession 驱动低层 Agent。AgentHarness 已有持久化 session 抽象、基础事件/hook 点、phase、tree navigation 和手动 compact，但通用 hook 架构、完整崩溃恢复、自动压缩和自动重试仍未全部完成；迁移被留到 Pi 2.0。

### Q58：为什么还要重做 Harness，旧 AgentSession 不能继续用吗？

> 旧 Session 把 coding-agent 的产品策略、会话持久化、扩展、压缩和 retry 聚在一起，可复用边界偏重。新 Harness 想把通用 durable agent 生命周期下沉，让不同宿主复用。不过迁移风险很大，必须逐项迁走语义，不能只替换类名后丢掉 settled、queue ordering 或 overflow recovery。

### Q59：如果让你设计迁移方案，怎么避免双轨行为不一致？

> 我会先列行为契约，不按类一对一搬：消息落盘顺序、hook 顺序、abort、steer/follow-up、compaction、retry、branch、事件 settled。然后建立旧新双跑的 trace 对比和同一 faux provider fixture，先影子运行、再按入口灰度，最后删除旧路径。迁移阶段明确只允许一个组件拥有 retry 和 compaction 决策。

### Q60：为什么不用 LangGraph 直接重写？

> 如果业务是显式、长运行、需要节点级 checkpoint 和人工中断的工作流，LangGraph 很合适。但 Pi 的核心还包括多 Provider wire transform、严格文件工具、终端渲染和本地扩展，这些不会因为换图框架自动消失。是否引入要看它能否减少恢复和编排复杂度，而不是因为 Agent 项目都应该套同一框架。

### Q61：模型上下文越来越大，还需要 compaction 吗？

> 需要。窗口大只解决硬容量，不解决成本、延迟和注意力利用。Lost in the Middle 表明相关信息在长上下文中间时可能更难被稳定使用。我的策略会是相关证据原文、稳定决策摘要、可回查 artifact 三层组合，而不是无限堆消息。

### Q62：如果要支持一百个并发 Agent 实例，先改哪里？

> 我不会先调 Promise 并发数，而会先做容量模型：每实例内存、子进程启动、Provider 限额、工具 CPU/I/O、RPC 字节和日志。然后加全局 admission control、Provider 配额队列、实例资源上限、空闲回收和背压。当前每实例一进程边界清楚，但一百进程是否合适要用数据决定。

### Q63：如果做团队共享服务，会话存储怎么升级？

> 保留 append-only 事件语义，但把 durable log 放到有事务和租户隔离的存储，materialized view 提供当前 leaf、活动上下文和查询。对象存储放大工具输出，数据库只存索引和引用。所有写带 tenant/session/version，敏感数据加密并支持 retention 和真正删除。

### Q64：你认为最值得优先改进的三点是什么？

> 第一是把权限从“宿主用户权限”升级为能力声明、策略和 sandbox；第二是完成 AgentHarness 迁移，让 retry、compaction、hooks 和 durable session 只有一套语义；第三是补端到端 trace 和评估集，量化压缩损失、Provider 兼容和工具误操作。三点分别解决安全、架构债和可验证性。

### H. `pi-ai` 流协议、认证、缓存与兼容层

### Q65：`stream()` 和 `complete()` 的关系是什么？

> `stream()` 暴露 start、text、thinking、tool call、done/error 等增量事件，最后通过 `result()` 得到完整 AssistantMessage；`complete()` 是等待同一类流完成后直接返回最终消息。需要实时 UI 或工具参数预览时用 stream，只关心最终结果时用 complete，但二者最终消息语义应一致。

### Q66：为什么流事件不能假设一个内容块连续输出？

> Provider 可能在同一上游 chunk 中交错发送 text、thinking 和 tool call，Pi 也会按收到的顺序发事件。因此消费者必须用 `contentIndex` 找到对应内容块，不能假设一次 `text_start` 后直到 `text_end` 中间不会出现 toolcall 事件。

### Q67：partial JSON 能直接执行吗？

> 不能。`toolcall_delta` 里的 arguments 是对半截 JSON 的 best-effort 解析，只适合 UI 预览。字段可能缺失，字符串可能截在中间，数组和对象也可能不完整；真正执行要等 `toolcall_end`，再做 schema 校验。

### Q68：所有 Provider 都支持工具参数流式输出吗？

> 不支持。比如 Google 路径没有函数参数增量流，Pi 会一次性给出带完整参数的 toolcall delta。统一事件接口不代表每家 Provider 的时序和粒度完全相同，客户端必须允许单次完整事件。

### Q69：Provider 请求失败为什么不从 stream 直接 throw？

> Pi 把错误也建模成流的终态：先发 error event，最终 AssistantMessage 的 stopReason 是 `error` 或 `aborted`，并保留已经收到的部分内容、usage 和 errorMessage。这样 UI、会话和上层 Agent 能用统一消息路径收尾，而不是一半走事件、一半走异常。

### Q70：被 abort 的半条回复还能继续对话吗？

> 可以。中止后的 AssistantMessage 可以保留部分内容并进入历史，再追加“继续”之类的用户消息。跨 Provider 转换也要能处理 aborted assistant。是否把半条回复放回业务上下文要由产品策略决定，但底层不会假装它从未发生。

### Q71：五种 stopReason 分别代表什么？

> `stop` 是正常结束，`length` 是输出 token 上限，`toolUse` 是等待工具结果，`error` 是请求失败，`aborted` 是外部取消。Agent 最关键的分支是 `length` 下不能执行可能被截断的工具参数，`error` 和 `aborted` 也不能继续普通工具循环。

### Q72：`responseId` 能作为系统主键吗？

> 不能。它只是 Provider 在有能力时返回的上游响应标识，并非所有 Provider 都有，格式和稳定性也不统一。它适合调试和上游关联，系统自己的 requestId、turnId 和 sessionId 仍要独立生成。

### Q73：usage 为什么要拆 input、output、cacheRead 和 cacheWrite？

> 因为四类 token 的计价和优化方向不同。总 token 相同，cacheRead 高可能成本更低；cacheWrite 高说明正在建立缓存前缀。Pi 同时累计各项 cost，面试时应分别看 token、费用和 cache 命中，不能只看 totalTokens。

### Q74：`sessionId` 和 prompt cache 有什么关系？

> `sessionId` 可被支持的 Provider 用作 cache affinity 或 prompt cache key，让同一会话尽量落到稳定缓存前缀。不同 API 的 header/body 表达不同，兼容层会转换。它是缓存亲和提示，不是安全会话令牌，也不能保证命中。

### Q75：认证信息的优先级是什么？

> 显式单请求 options 优先于 Provider 自动解析。自动解析里，已存 credential 拥有该 Provider；没有存储项时才看环境变量或 ambient credential。header 合并还要经过 provider auth、model headers、显式 headers 和最后的 transformHeaders。

### Q76：为什么 header 要大小写不敏感合并？

> HTTP header 名本来就大小写不敏感。如果把 `Authorization` 和 `authorization` 当两个键，覆盖和删除会失效，甚至泄漏旧凭据。Pi 在合并时按大小写不敏感处理，transformHeaders 还能用 `null` 删除下层默认值。

### Q77：`getAuth(providerId)` 和 `getAuth(model)` 有什么区别？

> Provider 版本只解析 Provider 级认证；传 model 时还会合并该 model 自带的静态 headers。真正发模型请求时更接近后者，但一般不应先手工 getAuth 再 stream，否则可能重复解析或重复刷新认证。

### Q78：CredentialStore 为什么每个 Provider 只存一个带类型 credential？

> 这样 API key 和 OAuth 的所有权清楚，读取、修改和退出登录都以 Provider 为边界。`list()` 只返回非秘密元数据，不能为了展示登录状态顺便解析 secret 或执行取 key 命令。

### Q79：OAuth 刷新为什么必须放在 `modify()` 锁里？

> refresh token 可能旋转。两个并发请求都读到旧 token 并同时刷新，后写入者可能覆盖有效的新 credential。`modify()` 把 read-modify-write 串行化，持久化实现还要处理跨进程锁，避免 double refresh。

### Q80：OAuth 刷新失败为什么不静默回退环境变量？

> 已存 credential 表示用户明确选择了这套身份。失败后偷偷换成环境变量可能切到另一个账号、组织或计费主体，既难审计也危险。Pi 保留 credential 并报 OAuth 错误，让用户重新登录。

### Q81：OAuth 登录为什么抽象成 `prompt()` 和 `notify()`？

> 不同 Provider 有浏览器回调、device code、manual code 等流程，但 TUI、CLI 和 RPC 的交互方式又不同。Provider 只描述需要什么交互，宿主用 prompt/notify 实现界面，从而避免认证代码直接依赖某个 UI。

### Q82：动态模型目录如何离线恢复？

> `ModelsStore` 可持久化动态 catalog，`refresh({ allowNetwork: false })` 只恢复本地目录，不访问网络。正常读取始终同步返回最后恢复或刷新成功的列表；全量刷新返回 aborted 和逐 Provider errors，不因为一个失败清空其他目录。

### Q83：Provider 和 API implementation 为什么分开？

> Provider 管身份、模型目录、认证和业务路由，API implementation 管 wire protocol。多个 Provider 可以复用 `openai-completions`，一个混合网关也可以按 model.api 分发到多种 wire API。这比“一个 Provider 必须对应一个 SDK”更贴近真实网关。

### Q84：直接调用 `api/<api-id>` 有什么代价？

> 直接调用能拿完整的 API-specific option 类型，但会绕过 Provider 认证解析，调用方必须显式给 apiKey 等参数，而且直接 import 会立即拉入对应 SDK。常规应用更适合走 Models 和 lazy provider factory。

### Q85：为什么 OpenAI-compatible 需要这么多 compat flags？

> “兼容 OpenAI”通常只是大体兼容。不同服务可能不支持 developer role、strict、stream usage、store、reasoning_effort，max token 字段也不同。compat flags 把已知差异显式化，比在请求失败后靠字符串猜测更可测试。

### Q86：本地无鉴权服务为什么有时仍要 dummy key？

> coding-agent 的模型可用性会考虑认证是否已配置，而 Ollama 可能完全忽略 key。给占位 key 是让统一可用性逻辑通过，不代表服务真的校验它。更干净的自定义 Provider 可以实现解析为空 auth 的 keyless auth。

### Q87：浏览器为什么不能直接复用所有 Provider？

> 核心和大多数 factory 可以 bundle 到浏览器，但环境变量不可用，OAuth 登录和 Bedrock 是 Node-only，前端暴露 API key 也不安全。生产浏览器应用应通过后端代理，pi-ai 的 tree shaking 只解决包体积，不解决凭据边界。

### Q88：为什么 chat model 和 image generation model 分成两套 collection？

> 图像生成是一次性输入输出，不参与 chat tool loop，模型元数据的 input/output 也不同。分成 Models 和 ImagesModels 能避免把两种能力硬塞进一个复杂联合接口。当前图像生成失败返回 stopReason error，而不是 throw。

### Q89：统一 reasoning level 怎样映射到各 Provider？

> simple API 接受 minimal 到 max 的统一层级，再由 Provider 映射成 reasoning effort、thinking budget 或 adaptive thinking。`xhigh` 和 `max` 是 opt-in，要用模型的 supported levels 判断，不能假设所有 reasoning model 都支持。

### Q90：给非 reasoning 模型传 thinking 参数会怎样？

> simple 接口会忽略不支持的 reasoning 选项，而不是强行报错。产品 UI 最好根据 model.reasoning 和 supported levels 提前限制选择，否则用户会误以为设置已经生效。

### Q91：给非视觉模型传图片会怎样？

> pi-ai 文档说明图片会被静默忽略。这保证兼容，但产品层应主动提示或阻止，因为静默丢图可能让用户以为模型看过附件。coding-agent 还有 blockImages 和自动缩放等更上层策略。

### Q92：模型目录为什么生成，而不是手写一个大文件？

> 模型能力、价格和窗口变化快，生成脚本可以从上游源统一归一化并产出 typed catalog。新增 Provider 应改生成脚本再生成结果，不能直接改生成文件，否则下次刷新会被覆盖。

### Q93：新增 Provider 最少要覆盖哪些测试？

> 除基础 stream 和 tool use，还要测 token、abort、空消息、overflow、图片、Unicode、孤立工具调用、跨 Provider handoff 和 auth resolution。难点是转换矩阵和错误边界，不是只验证“能回答 hello”。

### Q94：faux provider 能替代全部真实 Provider 测试吗？

> 不能。它适合脚本化 Agent 流程、增量 tool args、缓存和并发测试，稳定且不花费用；但它发现不了真实 SDK、SSE、header 和 Provider payload 兼容问题。因此要配合 wire fixture 和少量受控 smoke test。

### Q95：跨 Provider 时把 thinking 转成 `<thinking>` 文本有什么取舍？

> 好处是保留信息并避免无效签名，坏处是原本的 reasoning 块变成普通上下文，可能增加 token，也改变模型对它的权重。安全上还要考虑是否应该跨 Provider 传递隐藏推理，企业产品可以选择只保留摘要。

### Q96：为什么 provider-level retry 默认应保持 0？

> coding-agent 默认由 AgentSession 做三次 2s、4s、8s 的可见重试，Provider/SDK 层默认 0。两层都重试会叠乘等待时间，且上层看不到真实限流状态。只有明确需要底层连接恢复时才应开启，并设 60s 的 server-requested delay 上限。

### I. Agent 与 AgentHarness 生命周期深挖

### Q97：AgentMessage 和 LLM Message 为什么要分开？

> AgentMessage 可以包含 UI 通知、bash execution、custom message 等宿主类型，模型只认识 user、assistant 和 toolResult。分开后产品能保留丰富事件，调用前再投影成 LLM Message，不必污染 Provider 类型。

### Q98：`transformContext` 和 `convertToLlm` 的职责有什么区别？

> transformContext 在 AgentMessage 层做裁剪或注入，仍可处理自定义消息；convertToLlm 是必经边界，负责过滤 UI-only 类型并转成标准模型消息。前者是策略，后者是协议适配，不能混成一个不可测试的大函数。

### Q99：`prompt()` 和 `continue()` 有什么区别？

> prompt 会先追加一个新用户消息，continue 从现有上下文继续，适合错误重试或手工补入 toolResult 后恢复。continue 要求最后一条是 user 或 toolResult，不能从完整 assistant 后无条件续跑。

### Q100：为什么原始 `agentLoop()` 的异步消费者不能充当执行屏障？

> 低层 async iterable 保证事件产出顺序，但不会等消费者自己的异步处理完成再进入后续阶段。`Agent` 类会按注册顺序 await subscriber，并把 assistant message_end 当作 tool preflight 前的屏障。需要落盘先于工具授权时应使用 Agent 或 Harness 边界。

### Q101：Agent subscriber 的顺序和异常有什么影响？

> subscriber 按注册顺序 await，所以后一个能看到前一个已完成的外部状态。代价是慢 listener 会延迟 settlement，listener 异常也必须有明确处理。它是控制生命周期的一部分，不等同于旁路 telemetry。

### Q102：为什么收到 `agent_end` 后 `isStreaming` 可能还没立刻变 false？

> `agent_end` listener 本身仍属于 run settlement。Pi 等这些 awaited subscriber 完成后，prompt/waitForIdle 才真正返回，`isStreaming` 才结束。对外部状态同步来说这能避免“UI 已空闲但最后落盘还没完成”。

### Q103：工具进度事件应发 delta 还是累计快照？

> AgentTool 的 onUpdate 可以上报 partial result；RPC 对 bash 暴露的是累计输出快照，客户端可以直接替换显示。delta 更省带宽但要求客户端正确拼接，快照更简单但输出越大传输越重，需要截断和节流。

### Q104：一个 sequential 工具为什么会让整批串行？

> 同一批 tool calls 可能存在隐含顺序。只把该工具自己串行而让兄弟并发，仍可能破坏它的前置条件。因此只要任一调用目标标成 sequential，Pi 会让整个批次按声明顺序执行。

### Q105：`terminate: true` 为什么要求整批所有结果都同意才终止？

> 混合批次里只要有一个普通结果，模型可能还需要综合它继续回答。只有每个 finalized result 都表示终止，才跳过自动 follow-up LLM call，避免某个通知类工具意外吞掉其他工具结果后的总结。

### Q106：`shouldStopAfterTurn` 和 abort 有什么区别？

> shouldStopAfterTurn 在当前 assistant 和工具都正常完成、turn_end 已发出后优雅停止，不取消流或工具；abort 是立即传播取消信号。前者适合到达 compaction/save point，后者适合用户中止。

### Q107：工具为什么应该 throw，而不是返回一段“失败”文本？

> throw 会被 Agent 统一转成 `isError: true` 的 toolResult，模型和 UI 能可靠区分成功失败。返回普通文本会伪装成成功，影响终止判断、统计和后续策略。

### Q108：`afterToolCall` 能做什么，不能做什么？

> 它可以改 content、details、isError 相关结果或给 terminate 提示，发生在 tool_execution_end 和最终 toolResult 之前。它不能撤销已经发生的文件或进程副作用，所以授权和危险参数阻断必须在 beforeToolCall。

### Q109：steeringMode 的 `all` 和 `one-at-a-time` 有什么差别？

> one-at-a-time 每个安全点只取一条 steering，给模型逐条响应；all 会把当前队列一起注入。前者交互可控，后者减少轮数但可能把互相冲突的指令同时送入。队列 mode 是 live config，修改后影响下一次 drain。

### Q110：steer、follow-up 和 nextTurn 的优先级是什么？

> steer 在当前 turn 工具结束后、下次 LLM call 前处理；follow-up 只在没有工具和 steer、Agent 本要停止时处理；新 Harness 的 nextTurn 会保留到下一次用户主动 prompt，并插在新用户消息前。三者解决不同时间语义。

### Q111：Agent state 数组复制能保证深度不可变吗？

> 不能。赋值 tools/messages 时只复制顶层数组，数组里的对象仍共享；读取返回的数组也可继续 mutate 当前状态。它防的是调用方持有原数组再 push 的一部分问题，不是 immutable state store。

### Q112：运行中改 model 或 tools 会立即影响当前请求吗？

> 低层 Agent 的行为要看修改时点；新 Harness 明确用 turn snapshot 隔离，setter 更新最新 config，只影响下一个 save point 后的 turn，不改正在飞行的 Provider 请求。这是避免半轮配置撕裂的关键。

### Q113：AgentHarness 把状态分成哪四类？

> 分成最新 harness config、单轮 turn snapshot、已持久化 session、运行中的 pending session writes。面试时要强调 getter 读的是未来轮次的最新 config，session read 不包含排队写，当前 Provider 使用的是冻结 snapshot。

### Q114：为什么 system prompt callback 每个 turn snapshot 只调用一次？

> 同一轮的 prompt、tool schema 和 Provider 请求必须看到一致结果。如果一个回调在不同阶段多次执行并读取动态文件，内容可能漂移。save point 需要继续下一轮时再创建新 snapshot。

### Q115：Harness save point 具体解决什么？

> assistant 和该轮 tool results 完成后，Harness 先按顺序 flush pending writes，再重新解析 model、thinking、tools、resources、stream options 和 context。这样运行中配置变化能在下一次 Provider 请求生效，同时不污染当前请求。

### Q116：为什么 structural operation 要在第一个 await 前设置 phase？

> 如果先 await 再标 busy，两个并发 prompt 都可能通过 idle 检查，形成竞态。同步把 phase 从 idle 改成 turn/compaction 等，第二个结构操作会立即收到 busy 错误。

### Q117：哪些操作可以在 Harness busy 时调用？

> steer、followUp、nextTurn、abort 和未来 snapshot 的 runtime config setter 可以在合适阶段调用；prompt、skill、template、compact 和 tree navigation 属于结构操作，只能 idle。允许集合必须文档化，否则 extension 很容易制造死锁。

### Q118：pending session writes 怎样保持顺序？

> Agent 自己的 message_end 先持久化，运行中外部请求的 session write 进入队列，在 save point、settlement 或失败清理时逐条 flush。某一条失败不会把后面的静默丢掉，但当前公开 session facade 仍在规划中。

### Q119：Harness abort 为什么不清 nextTurn？

> abort 清掉当前 steering/follow-up，避免旧指令在取消后继续；nextTurn 明确属于下一次用户发起的轮次，所以保留。pending writes 也不丢，会在可到达的保存点或清理路径落盘。

### Q120：AgentHarness 当前已经自动压缩和重试了吗？

> 没有。文档明确写着 auto-compaction 和 retry decision point 尚未实现。coding-agent 当前的这些产品策略还在 AgentSession，所以不能因为 Harness 有 `compact()` 和 `retry` phase 类型就说自动机制已经迁移。

### Q121：hook 在状态提交后失败，是否回滚？

> 当前 Harness 原则是事件观察 committed state。若通知 hook/subscriber 在提交后失败，公开方法会以 hook error 拒绝，但已提交状态不回滚。要做到事务回滚，需要副作用隔离和补偿，不是简单 catch。

### Q122：为什么低层用 Result，高层仍用 throw/reject？

> 文件、shell、资源加载等预期失败用 typed Result，迫使调用方显式处理；Session 和 Harness 这类高层 mutation 如果返回容易被忽略的裸 Result，状态错误可能继续扩散，所以用 typed error reject，并保留 cause。

### Q123：为什么说 Harness 只能做到 semi-durable？

> 工具实现、Provider、扩展函数、资源 loader 和 system prompt callback 都是运行时 JS，不能可靠序列化。Session 可以持久化名称、配置和操作状态，但恢复时宿主必须重新提供兼容依赖并校验版本。

### Q124：崩溃时有一个未完成工具调用，应该自动重试吗？

> 默认不应该。工具可能已经产生外部副作用，只是结果没来得及落盘。只有工具声明 idempotent/retry-safe，并有稳定 call id 或可查询执行状态时才自动恢复，否则应标 interrupted 并让用户决定。

### Q125：Provider stream 能从断点继续吗？

> 设计文档明确认为不能把它当可恢复流。崩溃恢复只能从已落盘的 durable boundary 重跑或标记中断。要避免丢失完整响应，可在 Provider response 后、assistant message 持久化前增加 journal，但这也是新的成本和敏感数据风险。

### Q126：新 Harness 的通用 hook 系统完成了吗？

> 还没有完全完成。当前已有基础事件、provider/tool hook 和 `on()` 能力，但文档中的 generic hooks instance、typed reducer、provenance 和 facade 仍标记为 designed/not implemented。回答时要区分已存在的 hook 点和目标 hook 架构。

### J. 资源加载、配置、Skill、Prompt 与扩展

### Q127：资源加载为什么要分 trust 前后两遍？

> trust 决策本身可能由用户级或 CLI 扩展参与，但项目扩展必须先被判可信才能执行。Pi 先以不信任项目的设置加载 global/CLI extensions，完成 trust 决策，再重载 settings、packages 和项目资源，避免用待审代码决定自己是否可信。

### Q128：不信任项目时 `AGENTS.md` 和 `CLAUDE.md` 会加载吗？

> 会，除非关闭 context loading。安全文档明确把它们当上下文文件而非可执行项目扩展，所以不受 Project trust 拦截。这也意味着其中的 Prompt Injection 仍是风险，trust 不能被描述成“陌生仓库内容完全不进入模型”。

### Q129：为什么系统 Prompt 只有在 read 工具可用时才列 Skill？

> Skill 采用渐进披露，模型先看到名称和描述，再用 read 加载完整 SKILL.md。如果当前 active tools 没有 read，把 Skill 列出来却不给加载路径，只会制造不可执行承诺，所以构建 Prompt 时会跳过 Skill 列表。

### Q130：`SYSTEM.md` 和 `APPEND_SYSTEM.md` 有什么区别和优先级？

> SYSTEM 替换默认 system prompt，APPEND_SYSTEM 在现有 prompt 后追加。可信项目文件优先于 global 对应文件，每类只选择一个；项目不可信时回退 global。上下文文件和 Skill 仍按构建规则追加到最终 prompt。

### Q131：global settings 和 project settings 怎么合并？

> `.pi/settings.json` 覆盖 `~/.pi/agent/settings.json`，嵌套对象做合并而不是整块替换。例如项目只改 reserveTokens，不会顺便删除 global compaction.enabled。项目配置能否参与合并受 trust 控制。

### Q132：sessionDir 的优先级是什么？

> 命令行 `--session-dir` 最高，其次是 `PI_CODING_AGENT_SESSION_DIR`，最后是 settings.json。把优先级固定下来能让 CI、临时运行和持久配置互不含糊。

### Q133：`--offline` 具体应该影响什么？

> 它关闭启动时的 update check、package update check 和安装 telemetry 等网络动作，不等同于给工具层断网。模型 Provider 和 bash 的网络访问仍要由调用路径或外部 sandbox 控制。

### Q134：`models.json` 修改后为什么不必重启？

> coding-agent 每次打开 `/model` 都会重载该文件，便于现场调本地模型和代理配置。代价是解析、认证可用性和 model override 必须在 reload 时稳定，错误要诊断而不是破坏当前已选模型。

### Q135：`models.json` 的 `!command` 什么时候执行？

> shell 取值在真正请求时解析，不在模型列表可用性检查时执行。这样 `/model` 不会因为展示列表就调用密码管理器。Pi 不替任意命令做 TTL 或 stale cache，慢命令需要用户自己包缓存脚本。

### Q136：为什么 Pi 不统一缓存所有取 key 命令？

> 不同命令的有效期、旋转和失败回退语义不同，框架无法安全猜测。盲目 stale reuse 可能继续使用已撤销凭据，固定 TTL 也可能频繁触发限流。把策略交给具体命令或 CredentialStore 更诚实。

### Q137：自定义 header 支持环境插值有什么风险？

> 它方便多租户网关和代理，但 header 可能包含 secret，不能进入日志、错误报告或系统 Prompt。环境变量缺失应让值 unresolved，不能把 `$TOKEN` 原样发到网络；转义规则也要避免把普通 `$` 或 `!` 误执行。

### Q138：扩展的加载来源有哪些？

> 有 global、可信 project、packages、settings path、CLI `-e` 和 SDK inline factory。CLI 适合临时测试，自动发现位置支持 `/reload`。每个扩展还带 user/project/temporary 等 source info，便于诊断和信任判断。

### Q139：两个扩展注册同名命令或工具怎么办？

> 资源加载器保留扩展并报告 conflict diagnostic，最终行为按加载顺序和注册类型处理。同名 command 会分配数字后缀供调用；同名工具可以覆盖内置工具。企业版应把 winner、来源和权限影响显式展示，不能静默冲突。

### Q140：`/reload` 为什么不只是重新 import 文件？

> 资源、扩展实例和 session-scoped 状态有生命周期。reload 要清模块缓存、重新发现资源、发 session_shutdown 清理旧资源，再构造新实例并发 session_start/resources_discover。只 import 新代码会遗留 watcher、socket 和旧 handler。

### Q141：一次用户输入的扩展事件顺序是什么？

> 扩展 command 先匹配，再过 input；未 handled 才做 Skill/template 展开。之后 before_agent_start 可注入消息或改 system prompt，进入 agent/turn/context/provider/tool 事件，低层结束后还可能 retry、compact 或 follow-up，最后才是 agent_settled。

### Q142：`context` hook 为什么给 deep copy？

> 它允许扩展为本次 Provider 请求过滤或重排消息，但不应直接改写持久化 session。deep copy 把临时上下文变换和 durable transcript 分开，避免一个 hook 的原地修改永久污染历史。

### Q143：`before_provider_headers` 和 `before_provider_request` 有何区别？

> 前者处理认证合并后的 headers，可增删 header；后者看到已经序列化的 Provider payload，可替换 body。payload 修改不会反映回 `getSystemPrompt()`，因为那是 wire 层变换，不是 Pi 的逻辑 prompt。

### Q144：Provider retry 时 header hook 会重新执行吗？

> coding-agent 扩展文档说明，同一请求的 retries 复用第一次生成的 headers，不重复触发 before_provider_headers。这样 request identity 稳定，但短期 token 若在 retry 间过期，需要认证层在更高请求边界处理，不能指望 hook 每次刷新。

### Q145：`tool_call` hook 修改参数后为什么危险？

> event.input 可原地修改，后续 handler 和实际工具都会看到，但修改后不会再次 schema 校验。扩展可以做有用的路径重写，也可能把已验证参数改成越界值。因此安全扩展应在最终执行前再次检查规范化结果，或限制可变字段。

### Q146：普通扩展异常和 `tool_call` hook 异常怎样处理？

> 普通扩展错误会记录 extension_error，Agent 尽量继续；tool_call 阶段错误按 fail-safe 阻止工具。显示主题失败可以降级，授权检查失败不能放行，这体现了按风险区分 fail-open/fail-closed。

### Q147：`custom entry` 和 `custom message` 有什么区别？

> custom entry 用来持久化扩展状态，默认不进入 LLM context；custom message 会投影成 AgentMessage，可以选择在 TUI 显示并参与模型上下文。把计数器误写成 message 会浪费 token，把关键约束只写 entry 又会让模型看不到。

### Q148：Skill 的 progressive disclosure 怎么实现？

> 启动时只扫描 name 和 description，并把目录清单放进 system prompt；任务匹配后模型用 read 打开完整 SKILL.md，再按相对路径访问 scripts、references 和 assets。这样大量技能不会一次性占满上下文。

### Q149：Skill 从哪些位置发现，冲突怎么处理？

> 来源包括 global `.pi`、global `.agents`、可信项目目录、packages、settings 和 CLI。包含 SKILL.md 的目录递归发现，部分目录还允许根级 md。相同 name 会告警并保留先发现者，所以加载顺序决定 winner。

### Q150：Skill 校验为什么大多只告警？

> Pi 对 Agent Skills 规范保持兼容但偏宽松，例如名称和父目录不一致仍可加载；缺 description 则直接不加载，因为模型无法判断何时使用。宽松有利于跨 Harness 复用，但 CI 可以加严格 lint 保障团队质量。

### Q151：`allowed-tools` 是否等于安全授权？

> 不是。它只是 Skill frontmatter 中实验性的预批准工具元数据，仍运行在宿主能力范围内。真正安全边界要由 tool registry、policy 和 OS sandbox 执行，不能把一行 YAML 当权限系统。

### Q152：Prompt template 怎样传参数？

> 文件名变 slash command，支持 `$1`、`$@`、默认值和简单切片，frontmatter 可以给 description 和 argument-hint。它是文本展开，不做 shell escaping；模板若把参数拼进命令指令，仍要让工具层做安全校验。

### Q153：动态工具加载怎样避免一开始暴露几百个 schema？

> 扩展先注册所有工具，只激活一个 search/load 工具；loader 执行时用 `setActiveTools()` 纯追加匹配工具。支持原生 deferred tools 的模型在 tool result 位置引用新定义，其他模型下一次请求发送完整 active list。

### Q154：动态激活工具为什么可能打破 prompt cache？

> fallback 模型需要重发变化后的 tool schema，稳定前缀随之改变。即使 Provider 支持原生延迟加载，工具的 promptSnippet 或 promptGuidelines 也会重建 system prompt。最佳实践是保留 loader、只追加、让懒加载工具主要依赖 description。

### Q155：移除工具时还能用 native deferred loading 吗？

> 不能按纯追加优化处理。移除或替换 active set 会走安全 fallback，在下一请求发送正常完整列表。功能仍可用，但缓存收益下降，所以工具集合频繁抖动要谨慎。

### Q156：`models.json` 和 extension `registerProvider` 应怎么选？

> 标准 OpenAI/Anthropic-compatible endpoint、静态模型和简单 header 用 models.json 更轻；需要 OAuth、动态模型发现、自定义 stream parsing 或运行时逻辑时用 extension Provider。不要为了一个 baseUrl 写完整 SDK，也不要把复杂认证硬塞 JSON。

### Q157：扩展在四种运行模式下有什么差异？

> TUI 模式有完整组件；RPC 模式有 dialog/notify 子协议但不支持 custom component；JSON 和 print 没有 UI，UI 方法为空操作。扩展应先看 ctx.mode/hasUI，不能在无人值守模式等待一个永远不会出现的终端输入。

### Q158：RPC 模式下扩展弹窗怎么工作？

> select/confirm/input/editor 发带 id 的 `extension_ui_request` 并阻塞，客户端回对应 `extension_ui_response`；notify、status、widget、title 是 fire-and-forget。宿主要处理超时、取消和客户端断开，否则 Agent 会卡在等待 UI。

### Q159：项目 package 自动安装为什么受 trust 控制？

> package 不只是静态数据，可能带 extension、Skill、Prompt 和依赖安装。可信项目才能加载或安装缺失 project packages，避免打开仓库就执行供应链代码。依赖脚本、版本锁和来源审核仍是另一层安全问题。

### Q160：资源去重为什么要保留 provenance？

> 相同 canonical path 不应重复加载，name collision 又需要知道谁赢、谁输。source/scope/origin/baseDir 让 UI 和诊断能解释资源来自 global、project、package 还是 CLI，也为后续权限策略提供依据。

### K. Session、Compaction、Branch 与 Retry 深挖

### Q161：Session format 为什么有版本迁移？

> v1 是线性序列，v2 加 id/parentId 树，v3 把旧 hookMessage 角色统一成 custom。加载时自动迁移能继续读历史文件，但迁移测试必须覆盖父子关系、compaction 边界和未知扩展数据，不能只改 header version。

### Q162：`/tree`、`/fork` 和 `/clone` 的区别是什么？

> tree 在同一 JSONL 内移动 leaf，保留完整分支；fork 从较早用户消息生成新 session 文件；clone 把当前 active branch 复制为新文件。tree 适合探索替代方案，fork/clone 适合隔离后续工作。

### Q163：tree 选中 user message 和 assistant message 行为为何不同？

> 选 user/custom message 时 leaf 移到它的 parent，并把原文本放回编辑器，用户可改后重发；选 assistant/tool/compaction 时 leaf 停在该 entry，编辑器为空，直接从那个状态继续。这样“重写问题”和“续接结果”语义分开。

### Q164：Session 里的哪些 entry 不进入模型上下文？

> custom entry 和 label 等元数据默认不投影；message、compaction、branch_summary、custom_message 会按规则变成 AgentMessage。模型和 thinking level 则从完整 active path 还原运行状态，不一定作为消息文本发送。

### Q165：模型切换和 thinking level 为什么也要写 entry？

> 它们是 branch-scoped 的运行状态。回到旧分支时应恢复当时的 model/thinking，而不是使用全局最后值；追加 entry 还能审计某次回答为何由不同模型生成。

### Q166：新 Harness 为什么要求 leaf 变化也持久化？

> 只在内存移动 leaf，进程重启后无法知道用户当前选了哪个分支。新 Session storage 通过 leaf entry 保存 targetId 或 root，让 reopen 能恢复游标。这个要求属于新 Harness durable session，不应混说成所有旧格式都已完整恢复运行中操作。

### Q167：重复 compaction 为什么从上次 kept boundary 开始总结？

> 上次保留的近期原文在下一次可能变成旧历史，需要和旧摘要一起纳入新总结。如果只总结上一条 compaction entry，可能丢掉上次 kept 区里的决策。找不到旧 boundary 时才回退到上一 compaction 后的 entry。

### Q168：`keepRecentTokens` 是精确 tokenizer 结果吗？

> 不是绝对精确承诺。Pi 优先利用 usage，并对消息做估算，再受合法切点约束，所以最终保留量是近似值。阈值需要留 reserve，不能把窗口刚好填满，否则不同 Provider tokenizer 偏差会直接 overflow。

### Q169：结构化摘要为什么包含 Goal、Progress、Decisions 和 Files？

> 长任务恢复最需要的是目标、约束、已完成/进行中/阻塞、关键决策、下一步和证据位置。自由散文容易漏掉未完成项；read/modified file 列表还能让模型按需回读。但格式只能提高概率，仍需任务级评估。

### Q170：为什么工具输出有两层不同截断？

> 正常工具回模型前是 50KB 或 2000 行；生成 compaction 文本时，每条 tool result 又只序列化最多 2000 字符。前者控制在线上下文，后者控制摘要请求。两者单位不同，不能把“2000”误说成同一个限制。

### Q171：readFiles 和 modifiedFiles 怎样跨多次摘要保留？

> 当前摘要扫描本次消息中的工具调用，并合并之前 compaction/branch summary details 的文件集合。因此多次压缩或嵌套分支后仍能累计证据路径，而不是只记最近一段。

### Q172：Branch summary 为什么先找 common ancestor？

> 目标分支和旧分支共享 ancestor 之前的内容本来就会进入新路径，不应重复总结。只总结 old leaf 到 common ancestor 的放弃区间，既减少 token，也避免同一事实在原文和摘要中重复。

### Q173：compaction 的三个 reason 有什么语义？

> manual 是用户 `/compact`，threshold 是正常超过预留阈值，overflow 是 Provider 已经拒绝或 usage 超窗。事件里还带 willRetry，只有需要恢复失败请求的 overflow 路径才自动继续。

### Q174：为什么 threshold compaction 不自动 continue？

> threshold 往往发生在一个正常 assistant 回答完成后，若直接 `continue()`，最后消息是 assistant，协议和用户意图都不明确。系统压缩后等待下一次用户输入；overflow 则是在原请求失败后恢复，才有明确的重试对象。

### Q175：切到更大模型后，旧模型的 overflow 为什么不能触发压缩？

> `AgentSession` 会确认 error message 的 provider/model 与当前 model 相同。否则用户刚从小窗口切到大窗口，旧错误可能已经不成立，继续压缩反而无谓丢信息。

### Q176：自动重试的默认参数是什么？

> Agent 层默认开启，最多三次，base delay 2000ms，对应 2s、4s、8s。适用于 overloaded、rate limit、5xx 等瞬态错误，context overflow 单独走 compaction，不混进普通 retry。

### Q177：为什么限制 Provider 要求的最大等待时间？

> 有些错误会说配额数小时后恢复。如果 Agent 无上限照等，用户以为进程卡死，资源也长期占用。默认超过 60000ms 就失败并明确提示，设 0 才表示取消上限。

### Q178：用户取消 retry 时要取消什么？

> 要 abort 当前 backoff sleep，并清理 retry controller 和状态，不能只把 UI spinner 停掉。若请求已经重新发出，还要把 signal 继续传到 Provider。RPC 提供 `abort_retry` 作为独立控制。

### Q179：扩展怎样接管 compaction？

> `session_before_compact` 可以 cancel，或返回自定义 summary、firstKeptEntryId、tokensBefore 和 details；成功后仍写标准 compaction entry 并发 session_compact。扩展必须尊重合法 cut point 和 JSON 可序列化边界。

### Q180：compaction 失败后事件怎样表达？

> compaction_end 的 result 为空、aborted 为 false，并带 errorMessage；用户主动取消则 result 为空且 aborted 为 true。overflow 路径只有压缩成功才 willRetry，不能在摘要失败后继续用同一超长上下文死循环。

### L. 文件、进程、图片与安全治理

### Q181：`write` 和 `edit` 应怎样选择？

> 新文件或整体内容明确时用 write，局部修改已有文件用 edit。write 传完整内容，token 和覆盖风险更高；edit 要求唯一锚点和非重叠区间。两者都进入同文件 mutation queue。

### Q182：`realpath` 之后还有 TOCTOU 风险吗？

> 有。检查真实路径到实际 open/write 之间，符号链接或目录仍可能被替换；不存在文件也只能按 resolved path 排队。强安全场景要在 sandbox 内固定 mount，并用更接近文件描述符的安全路径操作。

### Q183：文件 mutation queue 能跨进程保护吗？

> 不能，它是当前 Node 进程内的 Map 和 Promise 链。另一个 Pi 进程、IDE 或 git 操作仍可同时改文件。企业协作场景需要 workspace 锁、版本条件写、patch apply 检查或每任务独立副本。

### Q184：为什么取消 bash 不能只 reject Promise？

> shell 和它启动的子进程可能继续运行、继续写文件。Abort/timeout 必须终止进程树并等 close/exit 收尾，Windows 和 Unix 的行为还不同。Pi 有专门的 bash close、signal 和 late output regression，说明这是实质正确性问题。

### Q185：bash timeout 和用户 abort 有什么共同点和区别？

> 两者最终都要终止执行并生成 cancelled/error 状态；timeout 是工具参数或策略触发，abort 是用户/上层 signal。日志和事件应区分原因，方便判断命令太慢还是用户主动取消。

### Q186：用户输入的 `!!` shell 命令为什么可以排除模型上下文？

> BashExecutionMessage 有 excludeFromContext，用于用户只想本地执行、不希望输出影响 Agent 推理的命令。记录仍可用于 UI/session 审计，但构建 LLM context 时跳过，减少噪声和敏感信息暴露。

### Q187：bash 流式更新为什么返回累计输出？

> RPC 客户端每次直接替换当前显示，不用维护 delta 拼接和丢包恢复。代价是输出越长重复传输越多，所以在线快照同样需要截断、节流和 fullOutputPath。

### Q188：完整 bash 输出落临时文件后还缺什么治理？

> 当前机制解决了可回查，但企业版还要定义权限、命名、容量配额、保留期、退出清理和敏感信息擦除。否则长期任务会堆积日志，或让同机其他用户读到内容。

### Q189：图片进入模型前有哪些产品策略？

> coding-agent 默认可自动缩到最大 2000x2000，也能用 blockImages 完全禁止发送；终端显示还有独立 showImages 和宽度配置。模型是否支持 vision、文件体积和隐私都应在发送前检查。

### Q190：Tool result 可以带图片吗？

> 可以，统一 ToolResult content 支持 text 和 image。跨 Provider replay 也要转换，但目标模型若不支持视觉，产品层不能静默假设图片已被理解，最好附文字摘要或提示能力不匹配。

### Q191：扩展覆盖内置工具有什么用途和风险？

> 同名注册可以把 read/edit/bash 路由到 SSH、容器或审批包装器，是实现 sandbox delegation 的重要机制。风险是恶意或错误扩展替换了可信工具，所以来源、加载顺序和 trust 必须可见。

### Q192：远程工具为什么抽象 operations，而不是重写整个 Tool？

> ReadOperations、BashOperations 等把 schema、截断、渲染和 Agent 协议留在本地，只替换实际文件/进程能力。这样 SSH、容器实现复用同一上层语义，也更容易做 contract test。

### Q193：Pi 文档给出的三种隔离方案怎样选？

> Gondolin 保留 host Pi/auth，只把内置工具和 `!` 命令送进 micro-VM；Docker 把整个 Pi 放容器，简单但 key 也进入容器；OpenShell 提供受策略控制的完整 sandbox。自定义 extension tool 是否也隔离取决于它运行在哪，不能只隔离内置工具就宣称全隔离。

### Q194：Project trust 决策怎样继承？

> 决策按 canonical directory 存在 `trust.json`，当前目录向父路径寻找最近的已保存决定，再看 global default。`/trust` 写入后当前 session 不热重载，需要重启才能按新资源集合运行。

### Q195：非交互模式遇到 defaultProjectTrust=`ask` 怎么办？

> 因为没有 UI，它不会弹窗，而是忽略受保护项目资源；`never` 同样忽略，`always` 才加载。单次运行可用 `--approve` 或 `--no-approve` 覆盖，自动化脚本不应卡在隐式确认。

### Q196：为什么信任关闭后仍不能抵御仓库 Prompt Injection？

> AGENTS.md/CLAUDE.md 和源码、日志都可能进入上下文，模型输出又能请求内置工具。Project trust 只阻止项目改变 Pi 配置或执行项目扩展，不验证文本指令。真正防线是最小能力、审批、sandbox 和人工 review。

### Q197：模型请求和日志中如何保护 secret？

> secret 应停留在 Provider auth/header 层，不进入 system prompt、tool args、trace payload和错误正文。日志默认只记 Provider、model、status、token 和时间；需要内容采样时必须显式 opt-in、redact 并设 retention。

### Q198：`!command` 取 API key 的最大风险是什么？

> 它在宿主 shell 执行，继承用户权限和环境，命令配置本身就是代码。`~/.pi/agent/models.json` 是用户级可信配置，不应由仓库内容自动生成或修改；stdout 还要去掉多余换行并防止错误信息泄漏，高价值凭据更适合专用 CredentialStore。

### Q199：安全扩展在参数重写后应做什么？

> 因为 tool_call 修改后不自动重新 schema validate，最终 gate 应基于规范化后的 path/command 再做 schema、能力和策略检查。审批记录也要绑定最终参数、cwd 和 policy version，而不是绑定模型最初的输入。

### Q200：你怎样用一句话总结本地 Agent 的安全模型？

> Prompt 不是边界，Project trust 不是沙箱，扩展也不是低权限插件；Pi 默认等同于启动它的本地用户。要跑不可信内容，就把真正能力放进 OS/容器/VM 边界，并只注入任务需要的文件、网络和短期凭据。

### M. TUI、RPC、Orchestrator 与 Radius 深挖

### Q201：TUI Component 最重要的不变量是什么？

> `render(width)` 返回的每一行可见宽度都不能超过 width，否则 TUI 直接报错。组件必须自己 wrap 或 truncate，不能依赖终端自动折行，因为自动折行会破坏 cursor row 和差分计算。

### Q202：为什么 TUI 每行末尾都追加样式和超链接 reset？

> ANSI SGR 和 OSC 8 状态会跨字符持续，如果上一行忘记关闭颜色或链接，下一组件会被污染。每行强制 reset 让行成为相对独立的渲染单元，代价是跨行样式必须由 wrap 工具重新应用。

### Q203：可见宽度为什么不能用 JavaScript `string.length`？

> ANSI escape 不占列，CJK 常占两列，组合字符、emoji 和 regional indicator 也不等于 UTF-16 code unit 数。Pi 用专门的 visibleWidth/wrap/truncate 工具，测试里也覆盖 CJK 和 regional indicator 边界。

### Q204：IME 为什么需要 `CURSOR_MARKER`？

> TUI 通常画假光标并隐藏硬件光标，但中文输入法候选窗依赖终端光标位置。Focusable 组件在假光标前放零宽 marker，渲染后 TUI 扫描并移动硬件光标；容器还必须把 focused 状态传给内部 Editor/Input。

### Q205：Overlay 的 focus 为什么比“最后打开的窗口”复杂？

> Overlay 可 capturing、nonCapturing、临时 hidden、主动 unfocus，还可以指定 fallback target。TUI 要在可见 overlay 和基础组件间恢复焦点，既保证 modal 截获输入，也允许状态提示层不抢编辑器键盘。

### Q206：大段粘贴为什么要识别 bracketed paste？

> 终端会把粘贴内容包在专用序列里，Editor 可把它当一次输入，而不是把换行误判成多次 submit。超过十行的 paste 会折成 marker，避免界面和上下文被瞬间刷满，同时保留后续展开或提交语义。

### Q207：为什么 keybinding 不能直接比较原始字符串？

> 不同终端对修饰键、Enter 和功能键编码不同，Kitty keyboard protocol 还提供更完整信息。`matchesKey` 和 Key helper 把协议差异归一化，coding-agent 再用可配置的 namespaced keybinding ID，避免硬编码 ctrl+x。

### Q208：终端图片怎样降级？

> 支持 Kitty/Ghostty/WezTerm 或 iTerm2 协议时按 cell/pixel 范围显示 PNG/JPEG/GIF/WebP，不支持时返回文字 placeholder。差分渲染必须知道图片占用区，否则文字局部刷新可能留下残影。

### Q209：组件缓存什么时候必须失效？

> width、内容、主题或影响渲染的内部状态变化时要 invalidate；否则返回旧行会导致布局错。缓存键至少包含 width，动态组件可复用同一实例并更新文本，减少每 token 创建对象。

### Q210：TUI 哪些情况下从增量渲染退回 full render？

> 首次渲染可以直接输出；宽高变化、差异发生在旧 viewport 上方、删除导致视口上移或图片范围不安全时 full render。普通变化才从 first changed line 清到末尾。正确性优先于少写几个字节。

### Q211：VirtualTerminal 能验证什么，不能验证什么？

> 它基于 headless xterm 验证 ANSI 后的屏幕、光标和 resize 状态，能稳定复现差分 bug；但不能完全代表所有真实终端的 Kitty 图片、IME 和平台输入行为，所以仍需小规模真实终端矩阵。

### Q212：RPC 为什么只允许 LF 分帧？

> 协议把一行 JSON 定义成一个 record，只以 `\n` 切分，输入可剥末尾 `\r`。Node readline 还会把 U+2028/U+2029 当分隔符，而它们在 JSON 字符串里合法，会错误拆包，所以文档明确不建议用通用 readline。

### Q213：RPC 的 prompt response 成功代表任务完成吗？

> 不代表。response 只说明 prompt 已接受、排队或被 extension 处理；后续失败通过事件和 AssistantMessage 报告，不会再给同 id 第二个 response。客户端要等 agent_settled 或自己的终态条件。

### Q214：RPC event 没有 request id，怎样关联？

> command response 用 id 一一对应，但 Agent events 是 session 级流，只靠事件里的 toolCallId、session state 和顺序。若一个通道允许多任务并发，现协议关联力不足；当前 AgentSession 主要串行，企业版应补 runId/turnId。

### Q215：`tool_execution_update` 为什么带累计 partialResult？

> 客户端只需用新快照替换旧显示，不用担心 delta 丢失或顺序错。缺点是大输出会重复传输，所以应结合截断、更新频率限制和 artifact reference。

### Q216：RPC extension UI 的阻塞风险是什么？

> dialog request 会等匹配 id 的 response；客户端崩溃、漏回或用户永久不操作都会挂住 extension。生产宿主要实现 timeout、cancel、连接关闭清理，并决定无人值守模式下的默认拒绝策略。

### Q217：Orchestrator 为什么有两层 IPC？

> CLI/client 先通过本地 socket 访问 orchestrator server，orchestrator 再通过 stdin/stdout JSONL 控制每个 coding-agent 子进程。外层管理实例，内层复用 coding-agent RPC。分层清楚，但错误、背压和 correlation 必须跨两跳传播。

### Q218：子进程 stdout 混入普通日志会怎样？

> RpcProcessInstance 对每一行直接 JSON.parse，并按 type 分 response、UI request 或 event。若子进程把调试文本写 stdout，会破坏协议并可能触发未捕获解析错误；普通日志必须去 stderr，RPC 模式还要做 stdout cleanliness 测试。

### Q219：当前 Orchestrator RPC 请求有 deadline 吗？

> 从 `RpcProcessInstance.send()` 看，pending request 只有子进程响应、写失败、进程退出或 dispose 才结算，没有每请求 timeout。这是实验性实现的明确缺口，生产化要加 deadline、abort、最大 pending 数和迟到 response 处理。

### Q220：`instances.json` 存储有什么一致性风险？

> 当前每次 load 整个 JSON、修改数组后 `writeFileSync` 整体覆盖，没有临时文件加 rename、文件锁或多进程 CAS。单 orchestrator 进程下简单可用，但崩溃中途和多个 supervisor 会导致损坏或 lost update。

### Q221：RPC 子进程意外退出后 Supervisor 做什么？

> 若不是主动 stopping/stopped，就把实例标 error，解绑 listener/UI handler，清 RPC process，尽力从 Radius disconnect，再从 liveInstances 移除。持久记录保留 error 状态，便于后续 list/status 看到失败。

### Q222：为什么不是每个 RPC 后都刷新 session metadata？

> 大多数命令只改瞬时状态，额外 get_state 是浪费 I/O。当前只在 prompt、new/switch/fork/clone、set_session_name 等可能改变 sessionId/sessionFile 的命令后同步，属于基于命令语义的定向刷新。

### Q223：Orchestrator 重启后会自动复活旧实例吗？

> 不会。recoverAfterRestart 把持久化的 online/starting 改成 stopped，并清理对应 Radius presence，因为旧子进程是否仍存活不可安全假设。真正自动恢复需要 PID 身份校验、socket 重连和 session resume 协议。

### Q224：Radius heartbeat 的退避和重新注册规则是什么？

> 瞬态失败从约 1 秒指数退避，加 jitter，最大 30 秒；连续 404 达到 3 次才认为服务端 registration 丢失并重新注册 machine/Pi。成功后清 failure count 并恢复服务端给的正常 heartbeat interval。

### Q225：Orchestrator 怎样优雅退出？

> SIGINT/SIGTERM、uncaughtException 和 unhandledRejection 都进入同一个只执行一次的 shutdown promise：关 IPC server，逐实例 stop/dispose，停止 Radius，再删本地 socket。重复信号复用同一 promise，避免两次并发清理。

### N. 测试、性能、可观测性、真实性与开放题

### Q226：为什么仓库的 `test.sh` 要先移走 auth.json 并清空环境变量？

> 避免普通单测因为开发机有 key 就意外激活付费或 e2e 路径，也保证测试可复现。脚本退出时恢复 auth，并禁用本地 LLM。测试隔离凭据本身就是 Agent 仓库的安全要求。

### Q227：faux provider 的确定性来自哪里？

> 每个 handle 有按请求开始顺序消费的 scripted response queue，可生成 text、thinking、tool call、usage 和增量事件。队列空会返回明确 error。并发独立流程建议用不同 provider id，避免共享队列让测试依赖时序。

### Q228：跨 Provider 兼容测试最容易漏什么？

> 只测文本会漏 thinking signature、tool ID、孤立 tool call、图片 result、aborted partial、usage 和 Unicode。测试矩阵应是“Provider A 生成，Provider B replay”，并覆盖不同 model family，而不是每家各自 hello world。

### Q229：TUI 测试为什么不用 Vitest？

> package script 使用 Node 原生 test runner，并用 `@xterm/headless` 做 VirtualTerminal。选择框架不是重点，关键是断言最终屏幕和光标，而不只 snapshot render() 返回的字符串。

### Q230：Orchestrator 当前测试成熟度如何？

> package.json 没有 test script，源码目录也没有对应 package test 套件，且 README 明确标 experimental。因此不能把 heartbeat、存储或 RPC 超时说成生产验证完成；这是我会优先补的工程缺口。

### Q231：issue regression 应该怎样写？

> 把能触发历史 bug 的最小事件序列固定下来，例如 queued slash follow-up、late bash output、agent_settled、network retry。coding-agent 已有 suite/regressions 和 faux harness，回归要断言事件顺序和 durable state，而不只最终文本。

### Q232：文件 edit 的测试除 happy path 还要覆盖什么？

> 重复锚点、零匹配、重叠/nested edits、CRLF、BOM、Unicode、符号链接别名、并行 edit/write、写入中 abort 和文件外部变化。最危险的是“成功但改错位置”，所以要检查最终 diff，不只返回状态。

### Q233：这个系统的主要性能瓶颈在哪里？

> 通常 Provider latency 和 token 占大头，其次是 bash/test、扩展 hook 和大量终端输出。先按 model request、tool、session append、render 和 IPC 分 span，再判断并行、缓存或批处理；不能看到 TypeScript 就先优化 CPU 小函数。

### Q234：怎样判断 prompt cache 优化是否有效？

> 记录 cacheRead/cacheWrite、input token、TTFT、总成本和 system/tool schema hash，按 sessionId 和 Provider 对比。只看命中率不够，动态 system prompt 或 tool list 可能让写缓存很多但读不到。

### Q235：成本统计会有哪些误差？

> 目录价格可能滞后，Provider usage 可能缺字段，abort 只有部分 usage，本地模型成本也不等于零资源。Pi 的 cost 适合会话估算和对比，财务结算仍以 Provider bill 为准，并要记录 catalog version。

### Q236：一百个并发实例首先会打满什么？

> 要实测，但风险包括一百个 Node/Bun 进程内存、Provider rate limit、并行测试 CPU、workspace I/O、RPC pipe 和日志。应先 admission control 和资源配额，再考虑进程池；不能只把 Map 容量调大。

### Q237：仓库里的 observability 文档代表已经实现了吗？

> 不代表，它标题就是 design notes。里面提出 runtime-neutral event contract、trace/span 和 adapter，但是否落地要继续看 exports 和 instrumentation。面试时我会把它作为合理演进方案，不当成当前完整能力。

### Q238：为什么不能用一个全局 `currentTrace`？

> JavaScript 单线程不代表只有一条 async chain，两个 Promise 流会交错，全局变量会串 trace。Node 可用 AsyncLocalStorage 类似 ThreadLocal 传播上下文，但 core 还支持 browser/Bun，所以应把 ALS 放 runtime adapter。

### Q239：Observability subscriber 和 extension hook 为什么必须分开？

> hook 属于控制面，可以改 payload、block tool，异常会影响执行；telemetry 应被动且隔离异常，不能因为上报平台挂了让 Agent 失败。默认 payload 只含 model、status、tokens、cost、duration 等安全元数据。

### Q240：这个仓库如何做供应链加固？

> 直接依赖精确 pin，CI 用 ignore-scripts 安装，coding-agent 发布带 shrinkwrap 固定传递依赖，新增 lifecycle-script dependency 需要显式 allowlist。锁文件是被审查的代码，不是随手生成的噪声。

### Q241：为什么 Coding Agent 需要单独发布 Node 包和 Bun binary？

> Node 包便于生态安装和 SDK 使用，Bun compiled binary 提供更独立的分发体验。两条产物要做相同的 help、version、model listing、真实 prompt 和交互 smoke test，否则运行时差异会只在发布后暴露。

### Q242：你认为 Pi 最难的设计取舍是什么？

> 我认为是可扩展性与确定性之间的平衡。它允许 Provider、扩展和工具高度定制，同时又用事件顺序、snapshot、schema、JSONL 和 file queue 收住状态。能力越开放，权限和生命周期证明越难。

### Q243：当前实现最明确的五个限制是什么？

> 没有内置 sandbox；coding-agent 尚未迁移 AgentHarness；Harness 自动 compaction/retry 和完整 durable recovery 未完成；文件 queue 不跨进程/不提供跨文件事务；Orchestrator 仍 experimental 且测试、deadline、原子存储不足。

### Q244：如果面试官问“这是不是你开发的”，怎么回答？

> 我会说明这是公司内部引入研究的项目，我负责源码级分析、适配评估和改造建议，不会把上游全部实现都说成个人从零开发。我的价值在于能从调用链验证当前行为、指出实现边界、给出测试证据和内部改造方案。

### Q245：怎样证明你不是只看 README？

> 我会讲 README 不容易暴露的细节：length 时整批工具拒绝、并行完成但 result 按源顺序、同真实文件 queue、重复 compaction 的 kept boundary、AgentSession 与 Harness 双轨、RPC 没 request timeout、instances.json 整体覆盖。这些都能落到具体源码。

### Q246：没有 benchmark 时怎么回答性能提升？

> 直接说当前只能确认机制，不能给百分比。然后给实验设计、数据集、基线、指标和预期瓶颈，等实测再报数。虚构一个“提升 30%”比坦诚没有数据更容易被追问击穿。

### Q247：如果只能先提交一个改动，你选什么？

> 我会先给 Orchestrator RPC pending request 加 timeout/abort 和测试，因为它边界清楚，能消除永久挂起；若目标是用户安全，则先做 tool capability policy 和 sandbox integration。优先级要按当前产品风险决定。

### Q248：哪些模块你不会轻易重写？

> 我不会先重写 Provider 统一层、Session JSONL 树和 TUI 差分核心，它们已有大量兼容细节和回归价值。更稳妥的是补 contract、观测和边界，再渐进迁移 AgentHarness，而不是换框架后重新踩协议坑。

### Q249：Pi 与 Claude Code、Codex、Aider 对比时怎样避免空泛？

> 只比较公开、可验证的机制：Pi 的自扩展和 JSONL tree、Aider 的 repo map/edit formats、MCP/Skills 的规范边界。闭源产品内部架构不能凭 UI 猜；体验差异可说观察，不能当源码事实。

### Q250：最后怎样总结你的分析能力？

> 我不是停在“它是一个 Agent”这层，而是把模型协议、Agent 控制流、副作用、durable session、终端和多进程串成一条可验证链路；同时能指出哪些已实现、哪些只是设计、哪些需要数据。这种边界意识比背框架名更重要。

---

## 20. 系统设计加试：企业级 Coding Agent

### 20.1 题目

> 设计一个支持 1000 个开发者、可长时间运行、支持多模型和高风险工具审批的企业级 Coding Agent 平台。要求任务可恢复、代码和凭据隔离、成本可控，并支持审计。

### 20.2 口语化答题框架

> 我会先拆控制面和执行面。控制面负责身份、任务状态、模型路由、预算、策略、审批和审计；执行面每个任务进入短生命周期 sandbox，挂载最小化 workspace 和临时凭据。Agent runtime 内部仍然是 model turn 和 tool turn，但每个有副作用的 tool execution 都成为可持久化步骤。
>
> 状态上我不会只存一份 messages JSON。事件日志保存用户输入、模型输出、工具调用、策略结论和 artifact reference；checkpoint 保存可恢复的活动状态；长期用户偏好进入独立 store，不能和 session compaction 混在一起。大日志和 patch 放对象存储，消息里只留摘要、hash 和 URI。
>
> 调度上先做 admission control，再按 tenant、Provider、模型和工具资源建立分层队列。模型侧限制并发和 token budget，工具侧限制 CPU、内存、磁盘、网络和 wall time。每个步骤要有 idempotency key；恢复时只自动重放明确幂等的读取，写操作查询状态或走补偿/人工确认。
>
> 安全上，工具先声明能力，policy engine 结合用户、仓库、数据等级和参数给出 allow/ask/deny。真正执行发生在 sandbox，网络默认 deny，secret 用短期 token 注入且不进入模型上下文。审批绑定规范化参数，审计记录策略版本和 artifact hash。
>
> 最后我会用任务成功率、错误修改率、人工接管率、token 成本、工具 p95、恢复成功率和策略误拦截率验收，而不是只看模型回答是否流畅。

### 20.3 核心状态机

```text
QUEUED
  │ admission + budget
  ▼
RUNNING_MODEL ──tool call──► POLICY_CHECK
  ▲                              │
  │                              ├── deny ──► RUNNING_MODEL（错误结果）
  │                              ├── ask  ──► WAITING_APPROVAL
  │                              └── allow ─► RUNNING_TOOL
  │                                               │
  └──────────────────── tool result ──────────────┘

任意运行态 ── transient failure ─► RETRY_WAIT
任意运行态 ── context threshold ─► COMPACTING
任意运行态 ── user abort ───────► CANCELLING ─► CANCELLED
无后续工作 ─────────────────────► COMPLETED
不可恢复错误 ───────────────────► FAILED
```

### 20.4 容量估算时应主动问的参数

- 峰值在线开发者、同时运行任务数、单任务平均持续时间。
- 每轮平均 input/output token、平均轮数、模型限流和预算。
- 每轮工具调用数、bash 输出分布、workspace 大小和并行测试 CPU。
- 会话保留期、artifact 大小、审计保留期和删除 SLA。
- 人工审批比例及等待时间，是否占用执行资源。

没有这些输入，不应该直接报机器数或 QPS。

---

## 21. 高频陷阱题速答

| 陷阱问题 | 一句话回答 |
|---|---|
| Pi 有内置沙箱吗？ | 没有，默认继承启动用户权限，Project trust 也不是沙箱。 |
| compaction 会删除历史吗？ | 不会，它追加摘要并改变活动上下文视图，原始 JSONL 仍在。 |
| 新 Harness 已用于 coding-agent 吗？ | 还没有，当前主路径仍是 `AgentSession + Agent`。 |
| 工具是全部串行吗？ | 不是，可并行执行，但结果按声明顺序写回；同一真实文件的写操作额外串行。 |
| length 截断后会执行已经解析出的工具吗？ | 不会，整批拒绝，防止半截参数产生副作用。 |
| read 和 bash 截断一样吗？ | 上限相同，方向不同：read 留头，bash 留尾，bash 完整输出落临时文件。 |
| JSONL 就是长期记忆吗？ | 不是，它主要是 session 执行历史；长期跨会话记忆是另一类 store。 |
| Orchestrator 是多 Agent 协作吗？ | 当前更准确说是多实例进程编排，不等于协作式多 Agent。 |
| 大上下文能替代压缩吗？ | 不能完全替代，成本、延迟和中部信息利用问题仍存在。 |
| exact edit 为什么不智能猜测？ | 因为错误位置的静默成功比明确失败更危险。 |

---

## 22. 源码索引

### 22.1 模型运行时

- `packages/ai/src/models.ts`：Provider/Models、动态刷新、认证和请求路由。
- `packages/ai/src/models-store.ts`：动态模型目录的持久化抽象。
- `packages/ai/src/auth/credential-store.ts`：CredentialStore 和串行 modify 语义。
- `packages/ai/src/auth/resolve.ts`：认证解析、OAuth 刷新和所有权规则。
- `packages/ai/src/api/transform-messages.ts`：跨模型消息、reasoning 和 tool call 兼容。
- `packages/ai/src/providers/faux.ts`：确定性脚本响应、缓存和流式测试 Provider。
- `packages/ai/src/types.ts`：统一消息、事件、模型和工具类型。

### 22.2 Agent 内核

- `packages/agent/src/agent-loop.ts`：turn loop、工具校验、并行执行、截断拒绝、顺序回填。
- `packages/agent/src/agent.ts`：状态、队列、steer/follow-up 和生命周期。
- `packages/agent/src/harness/agent-harness.ts`：新 durable Harness、phase、hook、compact 和 tree navigation。
- `packages/agent/docs/agent-harness.md`：已实现生命周期与剩余 TODO 的权威边界。
- `packages/agent/docs/durable-harness.md`：semi-durable 恢复模型和未完成工具策略。
- `packages/agent/docs/observability.md`：可观测性设计稿，不代表全部已实现。

### 22.3 Coding Agent

- `packages/coding-agent/src/core/agent-session.ts`：当前产品会话控制、自动压缩和重试。
- `packages/coding-agent/src/core/session-manager.ts`：追加式 JSONL 树、leaf、branch、compaction view。
- `packages/coding-agent/src/core/messages.ts`：Bash/custom/summary 消息到 LLM context 的投影。
- `packages/coding-agent/src/core/compaction/compaction.ts`：阈值、切点、长轮次摘要。
- `packages/coding-agent/src/core/resource-loader.ts`：trust 前后加载、资源去重、来源和冲突诊断。
- `packages/coding-agent/src/core/system-prompt.ts`：工具、context files、Skill 和自定义 Prompt 组装。
- `packages/coding-agent/src/core/settings-manager.ts`：global/project 设置合并与默认值。
- `packages/coding-agent/src/core/skills.ts`：Skill 发现、校验、冲突和 Prompt 清单。
- `packages/coding-agent/src/core/extensions/runner.ts`：扩展 hook 顺序和事件调度。
- `packages/coding-agent/src/core/tools/edit.ts`：edit 工具入口。
- `packages/coding-agent/src/core/tools/edit-diff.ts`：唯一匹配、重叠检测、BOM/换行处理。
- `packages/coding-agent/src/core/tools/file-mutation-queue.ts`：同真实文件串行化。
- `packages/coding-agent/src/core/tools/read.ts`：头部截断和 offset 续读。
- `packages/coding-agent/src/core/tools/bash.ts`：尾部截断和完整输出卸载。
- `packages/coding-agent/src/core/tools/truncate.ts`：2000 行/50KB 默认限制。
- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`：RPC command、异步接受语义和事件输出。
- `packages/coding-agent/src/modes/rpc/rpc-types.ts`：RPC request/response/UI 子协议类型。

### 22.4 TUI 与编排

- `packages/tui/src/tui.ts`：16ms 调度、视口、差分和同步输出。
- `packages/tui/src/keys.ts`：终端按键协议归一化。
- `packages/tui/src/components/input.ts`、`packages/tui/src/components/editor.ts`：输入、IME、粘贴和编辑状态。
- `packages/tui/src/terminal-image.ts`：Kitty/iTerm 图片能力和降级。
- `packages/orchestrator/src/supervisor.ts`：实例生命周期和 RPC 绑定。
- `packages/orchestrator/src/rpc-process.ts`：子进程 JSONL RPC。
- `packages/orchestrator/src/radius.ts`：presence、心跳、退避和重新注册。
- `packages/orchestrator/src/storage.ts`：当前整文件 JSON 元数据存储及其边界。
- `packages/orchestrator/src/serve.ts`：本地 IPC server 和统一 shutdown。
- `packages/agent/docs/models.md`：当前 AgentSession 与 AgentHarness 迁移边界。

---

## 23. 联网检索资料与可延伸面试点

检索日期均为 2026-07-16。优先列官方规范、官方工程文档和论文，不用搜索摘要替代原文结论。

1. [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)<br>
   可延伸：JSON Schema、strict mode、parallel tool calls、call/result 配对、执行侧为什么仍要校验。

2. [OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-python/tracing/)<br>
   可延伸：trace/span 层级、tool/handoff/guardrail 观测、敏感数据和禁用 tracing。

3. [Model Context Protocol Architecture](https://modelcontextprotocol.io/specification/latest/architecture)<br>
   可延伸：host-client-server、1:1 stateful connection、capability negotiation、安全和 consent 应归谁负责。

4. [Agent Skills Specification](https://agentskills.io/specification)<br>
   可延伸：`SKILL.md`、YAML frontmatter、渐进披露、Skill 与工具权限为何是两层。

5. [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)<br>
   可延伸：thread checkpointer、cross-thread store、interrupt/resume、fault tolerance、checkpoint retention。

6. [Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)<br>
   可延伸：长窗口不等于有效利用、关键信息位置、compaction 和 retrieval 的评估方法。

7. [Aider Edit Formats](https://aider.chat/docs/more/edit-formats.html)<br>
   可延伸：whole、search/replace、unified diff 的 token、解析和正确性取舍。

8. [Aider Repository Map](https://aider.chat/docs/repomap.html)<br>
   可延伸：tree-sitter 符号抽取、依赖图排序、token budget、大仓库上下文选择。

9. [Kitty Graphics Protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/)<br>
   可延伸：raster image 传输和 placement、cell/pixel 坐标、TUI 差分渲染为什么要感知图片范围。

10. [Node.js Child Process](https://nodejs.org/api/child_process.html)<br>
    可延伸：`spawn`、stdio pipe 容量、IPC、AbortSignal、子进程退出和父进程背压。

11. [Node.js Async Context / AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)<br>
    可延伸：并发 async chain 的 trace context、为什么全局 currentTrace 会串线、Node adapter 边界。

12. [OWASP LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)<br>
    可延伸：不可信内容、间接 Prompt Injection、最小权限、输出验证和 human-in-the-loop。

13. [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)<br>
    可延伸：trace/span/parent、事件与属性、Provider request 和 tool call 的因果关系。

14. [JSON Lines](https://jsonlines.org/)<br>
    可延伸：UTF-8、一行一个 JSON value、换行分帧、追加日志和尾部损坏恢复。

15. [Docker Bind Mounts](https://docs.docker.com/engine/storage/bind-mounts/)<br>
    可延伸：容器内 Agent 仍能修改 host bind mount、read-only mount、凭据和 workspace 边界。

16. [OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)<br>
    可延伸：稳定前缀、cache key、命中指标、动态 system/tool schema 为什么会打破缓存。

17. [MDN Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)<br>
    可延伸：SSE 流消费、断线、事件边界、为什么 transport reader 与下游 hook settlement 要解耦。

---

## 24. 最后一分钟收尾

> 我分析 Pi 以后最大的体会是，Coding Agent 的难点不在第一次调用工具，而在第几十轮以后还能不能保持协议合法、文件不被并发覆盖、历史可恢复、权限不越界、终端状态不乱。Pi 当前在多 Provider 转换、工具确定性、追加式会话树和 TUI 上给了很扎实的实现；它仍然有明确的演进空间，比如 AgentHarness 双轨迁移、内置权限隔离、跨文件事务和更系统的 trace/评估。面试里我会把已经实现的机制和我的企业化方案分开讲，这样结论才可验证。
