# 面试问题资料索引

本目录以简历上的三个公司内部项目为主线，并补充 AI 框架、LLM 推理与 RAG 生产化、Java 与后端基础设施、Python/FastAPI、TypeScript/React、金融 AI、行为面、算法现场编码和公司内部 Pi Coding Agent 源码研究。所有回答默认采用第一人称、口语化表达；项目事实以当前简历、内部详设和对应项目源码为准，不根据源码日期、仓库地址或提交历史判断项目归属。

## 建议使用顺序

| 使用场景 | 主文档 | 用法 |
| --- | --- | --- |
| 全面准备 | [简历与项目全面面试作战手册](./00-总览/简历与项目全面面试作战手册.md) | 先统一简历口径、项目关系、指标和行为面答案 |
| 覆盖审计 | [全量面试问题覆盖矩阵](./00-总览/全量面试问题覆盖矩阵.md) | 从简历声明和每场真实面试反查主答案，优先处理缺口与口径冲突 |
| 事实核对 | [面试前个人事实核对清单](./00-总览/面试前个人事实核对清单.md) | 补齐团队、投产、用户、QPS、模型、部署和指标证据，禁止临场编数字 |
| 行为面与 STAR | [行为面与 STAR 证据化面试题](./00-总览/行为面与STAR证据化面试题.md) | 60 道口语题；先填写 RACI 与 S1-S12 故事卡，再练失败、冲突、延期、故障和跨团队追问 |
| 三小时深挖模拟 | [三小时深度挖掘题库](./00-总览/三小时面试-十年面试官视角深度挖掘题库.md) | 按面试官追问顺序做完整演练 |
| AI 周报专项 | [AI 周报系统专项面试问答](./01-AI周报系统/AI周报系统-专项面试问答.md) | 46 道题，覆盖批处理、数据完整性、根因诊断迁移、DAG、LLM Map-Reduce、重放和上游对账 |
| CodeWiki 专项 | [CodeWiki 全链路源码级深入分析](./02-CodeWiki/CodeWiki-全链路源码级深入分析.md) | 95 道题，覆盖多语言 AST、置信代码图、GraphRAG、Wiki 引用、增量、MCP 长任务和 Revision 一致性 |
| Agent Memory 专项 | [Agent Memory 全链路源码级深入分析](./03-Agent-Memory/Agent-Memory-全链路源码级深入分析.md) | 95 道题，覆盖长期记忆、Hybrid RRF、上下文卸载、Mermaid、原文追溯、多租户中台和失败语义 |
| Agent 基础补课 | [AI Agent 通用面试题](./04-AI-Agent通用/AI-Agent-通用面试题.md) | 查缺补漏，不建议从头背完整本 |
| AI 框架专项 | [LangChain、LangGraph 与主流 AI 框架面试题](./04-AI-Agent通用/LangChain-LangGraph与主流AI框架-面试题.md) | 272 道联网校准口语题，覆盖当前 API、Functional API、Agent Server、Context Engineering、状态恢复、MCP/A2A、Java/TypeScript/Python 主流框架、生产故障、Agent 前端与项目映射 |
| 英文面试 | [英文材料目录](./05-英文面试/README.md) | 先掌握中文事实口径，再练项目深挖、行为与 HR、20 道 Live Coding 和 3 道系统设计 |
| 英文行为与 HR | [英文行为面与 HR 追问口语模板](./05-英文面试/英文行为面与HR追问口语模板.md) | 40 道英文口语模板，覆盖求职动机、Ownership、冲突、失败、谈薪与反问；所有 `[FILL: ...]` 必须用真实事实替换 |
| Pi Coding Agent | [Pi-mono 全链路源码级分析与面试问答](./06-Pi/pi-mono-全链路源码级深入分析与面试问答.md) | 以公司内部引入研究项目口径准备 Provider、Loop、工具、Session、Compaction、TUI 和安全边界 |
| Java 后端 | [Java 后端高频面试题](./07-Java后端/Java后端高频面试题.md) | 120 道口语题，补齐 Java/JUC/JVM/Spring/MySQL/Redis/MQ/分布式和故障排查 |
| Java 源码与中间件 | [Java 源码与中间件生产化面试题](./07-Java后端/Java源码与中间件生产化面试题.md) | 100 道源码和生产题，覆盖 JUC、Spring/MyBatis、MySQL、Redis、Kafka 及 10 道完整手写题 |
| 算法与现场编码 | [算法与现场编码高频题](./08-算法与现场编码/算法与现场编码高频题.md) | 100 道口语题，按思路、不变量、复杂度和易错点练习算法、并发与后端现场设计 |
| 完整现场编码 | [Java/Python 现场编码完整题解](./08-算法与现场编码/Java-Python现场编码完整题解.md) | 30 道完整 Java/Python/SQL 题，包含澄清、不变量、可执行代码、测试、复杂度和 Follow-up |
| Python 与 FastAPI | [Python 与 FastAPI 高频面试题](./09-Python与FastAPI/Python与FastAPI高频面试题.md) | 120 道口语题，覆盖 Python 对象与异步、ASGI/FastAPI、Pydantic、SQLAlchemy、测试、观测、安全和部署 |
| Python 源码与异步故障 | [Python/FastAPI 源码与异步故障面试题](./09-Python与FastAPI/Python-FastAPI源码与异步故障面试题.md) | 60 道深挖题，覆盖 CPython、asyncio、ASGI、Pydantic、SQLAlchemy、故障现场和 6 道手写题 |
| LLM 推理与 RAG 生产化 | [LLM 推理与 RAG 生产化高频面试题](./10-LLM推理与RAG生产化/LLM推理与RAG生产化高频面试题.md) | 64 道深挖口语题，覆盖推理调度、KV Cache、Context/RAG、Eval、安全、成本与模型路由四连问 |
| 后端基础设施 | [Java 21、网络、Kubernetes、分布式与 AI 运行时](./10-后端基础设施/Java21-网络-Kubernetes-分布式与AI运行时面试题.md) | 45 道生产化口语题，覆盖 Virtual Threads、WebFlux、TCP/TLS/HTTP、Kubernetes、CDC、可靠流式与 Agent Runtime |
| 网络/Kubernetes/分布式故障 | [网络、Kubernetes 与分布式故障现场题](./10-后端基础设施/网络-Kubernetes-分布式故障现场题.md) | 80 道现场题，覆盖网络命令、Kubernetes 故障、Raft/Lease、SRE 证据链和综合演练 |
| 中文系统设计 | [大厂系统设计与故障追问题](./13-系统设计/大厂系统设计与故障追问题.md) | 60 道、10 个完整案例，覆盖容量、API、模型、一致性、分片、故障、安全、观测和演进 |
| 金融 AI | [金融 AI 与自动授信高频面试题](./11-金融AI/金融AI与自动授信高频面试题.md) | 80 道口语题，覆盖美股 point-in-time 数据、Open Banking、授信模型治理、公平合规和金融 Agent 安全 |
| 金融建模与风控实操 | [金融建模、风控、AML、SQL/Python 实操题](./11-金融AI/金融建模-风控-AML-SQL-Python实操题.md) | 48 道知识与实操题，覆盖三表/DCF、信贷指标、KYC/AML、6 道 PostgreSQL 和 6 道可运行 Python；不冒充本人金融生产经历 |
| TypeScript 与 React | [TypeScript 与 React 高频面试题](./12-TypeScript与React/TypeScript与React高频面试题.md) | 100 道口语题，覆盖 JS/TS、React 19、状态与流式、大图布局、安全、测试，并严格连接 CodeWiki 当前边界 |
| TypeScript/React 现场题 | [TypeScript/React 现场编码与故障面试题](./12-TypeScript与React/TypeScript-React现场编码与故障面试题.md) | 40 道完整现场题，覆盖 16 道 TS/JS 手写、14 道 React 故障复现和 10 道 CodeWiki 前端系统设计 |

## 项目与事实来源

### AI 周报系统

- 项目事实入口：`项目/详设.md`。
- 面试主线：多源采集、周级完整性检查、七类分析模块、LLM 分段解读、周报组装和推送。
- 特别注意：详设里 `PROC_DATE` 的 T/T-1 表述存在冲突；面试时应明确区分业务日期 `business_date=T-1` 和技术运行日期 `batch_date=T`。
- `outbox`、细粒度状态机、指数退避、fact_id 数字校验属于基于现状提出的工程化改进，除非实际已经投产，否则不要说成当前实现。

### CodeWiki 代码智能平台

- 项目事实入口：`项目/CodeWiki/`。
- 面试主线：仓库扫描、多语言 AST、确定性代码图、GraphRAG 检索、Wiki 生成、源码引用校验、增量更新和多交互入口。
- 特别注意：跨文件符号解析带启发式和置信度，不要说成编译器级完整类型推导；向量检索是可选能力，默认 FTS 与图扩展也能工作；当前产品以 local-first 为主，不要虚构完整 SaaS 多租户能力。

### Agent Memory 与上下文压缩系统

- 项目事实入口：`项目/TencentDB-Agent-Memory/`，面试统一称“公司内部 Agent Memory 项目”。
- 面试主线：长期记忆与短期上下文两条链路、L0-L3 分层、SQLite/云向量库双后端、BM25+向量+RRF、异步调度、checkpoint、context offload 和 Mermaid 任务画布。
- 特别注意：Mermaid 是任务状态和证据索引，不等于真正的压缩；真正释放上下文的是把原始 tool result 外移到 `refs`，在 prompt 里保留摘要、`node_id` 和 `result_ref`。

## 目录职责

- `00-总览`：当前综合主入口，优先维护。
- `01-AI周报系统`、`02-CodeWiki`、`03-Agent-Memory`：三个简历项目的专项事实和深挖问答。
- `04-AI-Agent通用`：不绑定具体项目的基础知识和系统设计题。
- `05-英文面试`：英文项目、行为/HR、Live Coding 和系统设计表达材料，不单独定义项目事实。
- `06-Pi`：公司内部引入的 Coding Agent 源码研究与改造评估，不冒充上游全部实现。
- `07-Java后端`：针对真实 Java 面试暴露项和后端岗位的系统化口语题。
- `08-算法与现场编码`：针对后续 Coding Round 的算法、并发和 AI/后端现场编码训练，不冒充已经被问过的原题。
- `09-Python与FastAPI`：针对简历 Python/FastAPI 技术栈的语言、Web、数据库、测试与生产工程专项，答案连接 CodeWiki 但不反向虚构项目能力。
- `10-LLM推理与RAG生产化`：补齐推理引擎、上下文生命周期、RAG 权限与删除、评测统计、Agent 安全和全局成本；论文结果不冒充项目指标。
- `10-后端基础设施`：补齐 Java 21、网络协议、Kubernetes、CDC、可靠流式和 AI Runtime；项目未实现的能力统一按下一版设计回答。
- `11-金融AI`：补齐海外金融岗位涉及的市场数据、财务建模、自动授信、模型风险、KYC/AML 和金融 Agent，并提供 SQL/Python 实操；没有本人生产经历的内容只按知识或迁移设计回答。
- `12-TypeScript与React`：补齐 CodeWiki 前端栈、可执行手写题、React 故障和浏览器系统设计；Zustand、SSE/WebSocket、Worker 与前端测试等当前未实现能力必须明确按下一版回答。
- `13-系统设计`：用完整中文案例训练需求澄清、变量估算、API、数据模型、一致性、故障、安全和演进；案例不是本人现有项目经历。
- `90-补充与历史题库`：保留早期题目、真实面试来源和不同组织方式，只作为补充检索，不作为项目事实的最终口径。

## 统一回答规则

1. 先说结论，再讲链路、取舍、结果和边界。
2. “当前实现”和“下一版改进”必须分开说，不能把设计建议包装成线上事实。
3. 指标必须能说明样本、基线、计算公式和统计窗口；拿不出证据时就说清楚口径限制。
4. 讲“独立负责”时，按项目和阶段说明需求、设计、实现、联调、测试、发布和验收中的真实 RACI；只有证据支持时才认领架构主线或核心实现。
5. 所有项目均按公司内部项目回答，不讨论公开仓库归属，也不使用源码日期推断项目经历。
