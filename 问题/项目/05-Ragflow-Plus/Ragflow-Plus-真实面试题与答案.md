# Ragflow-Plus 真实面试题与答案

> **源码基线**：`3f7aac2512f80a77cf0ad5c1f6e673f0fa39d63c`。分析开始时工作区已有 `M docs/_sidebar.md`、`?? docs/project-analysis/`，本次未修改。
>
> **题目口径**：先检索 `/mnt/e/面试/面试分析/`。标为“真实来源”的题确实在既有面试记录中出现，答案按 Ragflow-Plus 当前源码重写；没有来源命中的项目专项题一律标“补充高频题”。
>
> **答案卡固定结构**：`结论 -> 当前实现链路 -> 设计原因 -> 失败/限制 -> 下一版`。个人经历、规模和收益统一使用 `[待本人确认]`。

---

## 一、问题来源索引

### 1. 与本项目直接可复用的真实追问

| 编号 | 真实问题 | 来源定位 | 本文答案卡 |
|---|---|---|---|
| S01 | Chunk 怎么切分？ | `Ashley-AI应用开发岗-面试整理与答案.md:51` | Q4 |
| S02 | 检索后按什么优先级组装上下文？ | `Ashley-AI应用开发岗-面试整理与答案.md:70` | Q8 |
| S03 | 向量库如何选型？ | `码云-CodeWiki岗-面试整理与答案.md:104` | Q5 |
| S04 | 向量如何更新和删除？ | `码云-CodeWiki岗-面试整理与答案.md:120` | Q6 |
| S05 | 怎么找到原始向量位置？ | `码云-CodeWiki岗-面试整理与答案.md:140` | Q6 |
| S06 | 为什么选择 GraphRAG？ | `码云-CodeWiki岗-面试整理与答案.md:224` | Q16 |
| S07 | GraphRAG Token 爆炸怎么解决？ | `码云-CodeWiki岗-面试整理与答案.md:235` | Q17 |
| S08 | 模型幻觉怎么产生、怎样防治？ | `码云-CodeWiki岗-面试整理与答案.md:163,181` | Q11 |
| S09 | 什么是幂等，程序里怎么保证？ | `丰泊国际-Java后端-AI应用岗-面试整理与答案.md:307` | Q14 |
| S10 | 微服务如何保证分布式事务一致性？ | `丰泊国际-Java后端-AI应用岗-面试整理与答案.md:324` | Q15 |
| S11 | 把源码交给模型有没有安全问题？ | `丰泊国际-Java后端-AI应用岗-面试整理与答案.md:445` | Q21 |
| S12 | GraphRAG 和 MCP 是什么关系？ | `丰泊国际-Java后端-AI应用岗-面试整理与答案.md:463` | Q18 |
| S13 | Prompt 中间注意力最低，为什么？ | `微众银行-面试整理与答案.md:197` | Q8 |
| S14 | 长上下文导致准确率下降体现在哪？ | `微众银行-面试整理与答案.md:27` | Q8 |
| S15 | 怎么判断哪个模型效果更好？ | `京东-海外金融-面试整理与答案.md:274` | Q12 |
| S16 | 模型切换、抖动和降级怎么设计？ | `京东-海外金融-面试整理与答案.md:123,292` | Q13 |
| S17 | 怎样召回而不泄漏不该看的信息？ | `忆纪元-MemoraX-AI应用开发岗-面试整理与答案.md:447` | Q20 |
| S18 | 为什么不让 Agent 自己 grep/读文件？ | `美狮物流-AI-Agent岗-面试整理与答案.md:332` | Q19 |
| S19 | Skill、Prompt、Tool 和 RAG 的边界？ | `美狮物流-AI-Agent岗-面试整理与答案.md:392` | Q18 |
| S20 | 向量更新维护踩过什么坑？ | `美狮物流-AI-Agent岗-面试整理与答案.md:306` | Q6 |
| S21 | 落地过程中踩过什么坑？ | `美狮物流-AI-Agent岗-面试整理与答案.md:231` | Q29 |
| S22 | 项目是全部一个人开发的吗？团队和用户规模？ | `Abound-AI工程师-初筛面试整理与答案.md:71`；`美狮物流-AI-Agent岗-面试整理与答案.md:111,139,145` | Q30 |

### 2. 未命中的专项

在指定目录中没有检索到直接以 Ragflow-Plus、MinerU、双 Flask 后端、Redis Stream ACK、图文 Chunk 或跨语言检索为对象的真实问题。本文 Q1-Q3、Q7、Q9-Q10、Q22-Q28、Q31-Q34 标为**补充高频题**。

---

## 二、项目与架构

## Q1【补充高频题】请用 30 秒介绍 Ragflow-Plus

**结论**

> Ragflow-Plus 是基于 RAGFlow v0.17.2 演进线的二次开发。它保留上传、Redis 异步解析、Chunk/Embedding、ES/Infinity、Hybrid/Rerank、LLM、引用和 SSE 主链，Plus 主要增加独立管理系统、MinerU/Excel 解析、图片管理、文档撰写和跨语言查询。当前版本也有明确边界：Worker 缺 parser 模块、管理鉴权不完整、PDF 只按一页建任务、KG 查询契约没接通。

**当前实现链路**

原生 Flask/React 见 `api/ragflow_server.py:50-104`、`web/`；管理 Flask/Vue 见 `management/server/app.py:12-85`、`management/web/`；基础镜像见 `Dockerfile:1-18`。

**设计原因**

保留上游成熟 RAG 内核，Plus 用独立管理面快速补运营和特殊解析能力，改动面较小。

**失败/限制**

双后端直接共享存储但不共享 Service/ACL/状态机，造成语义分叉；不能宣称从零自研或生产无缺陷。

**下一版**

先做 clean image、统一鉴权和任务状态机，再做 Outbox/DLQ、Chunk/Image DTO 和效果评测。

## Q2【补充高频题】它和上游 RAGFlow 到底是什么关系？Plus 新增了什么？

**结论**

> 它是上游 RAGFlow 代码和 v0.17.2-slim 镜像之上的二次开发，不是重新实现检索内核。Plus 的主要新增/强化是管理系统、MinerU/Excel 管理解析、文档撰写、跨语言前置翻译、图片集和 Chunk 换图。

**当前实现链路**

根 Dockerfile 从 `infiniflow/ragflow:v0.17.2-slim` 复制覆盖 `api/rag/graphrag/web`（`Dockerfile:1-18`）；管理系统由独立 Blueprint 注册（`management/server/routes/__init__.py:5-28`）；撰写与翻译入口见 `api/apps/conversation_app.py:414-450`、`api/apps/translate_app.py:103-244`。

**设计原因**

继承原生的模型供应商、解析、检索和引用能力，比重写一个 RAG 引擎更现实。

**失败/限制**

本次没有对官方 v0.17.2 做完整逐行 diff；Git 标签是 `v0.5.0-6-g3f7aac2`，包元数据写 0.18.0，基础镜像写 0.17.2，三套版本轴不能混说（`pyproject.toml:1-10`）。

**下一版**

建立正式 upstream remote、可重复 rebase/diff 报告、Plus patch 清单和兼容性测试矩阵。

## Q3【补充高频题】为什么要有两个 Flask 后端？

**结论**

> 当前代码体现的是“原生业务面 + 独立运营管理面”。好处是 Plus 能快速接 MinerU 和管理 CRUD，坏处是同一份 MySQL/ES/MinIO 被两套权限、状态和协议解释。

**当前实现链路**

原生路由动态扫描 `api/apps/*_app.py`（`api/apps/__init__.py:96-139`）；管理端显式注册六个 Blueprint，并直接连接共享数据库/ES/MinIO（`management/server/routes/__init__.py:5-28`；`management/server/database.py:28-80`）。

**设计原因**

管理需求与上游发布节奏解耦，MinerU/Excel 可以不侵入原生 Worker。

**失败/限制**

管理端没有复用原生 Peewee Service 和 `accessible()`，导致 JWT/RBAC、Task 状态、图片 key、Infinity 支持都分叉。

**下一版**

可以保留部署边界，但抽共享 AuthContext、Domain Service、Task API 和 Chunk DTO；管理端不再直接逐块写 ES。

---

## 三、Chunk、向量与检索

## Q4【真实来源 S01】Chunk 怎么切？是不是固定长度？

**结论**

> 这个项目不是统一固定长度切分。原生链按 `parser_id` 选择文档类型解析器，Parser 接收页范围、语言和 parser_config；管理链里 PDF/Office/图片走 MinerU，Excel/CSV 走 pandas。Chunk 还携带位置、token 和图片，不只是字符串。

**当前实现链路**

原生 Worker 的 `FACTORY` 和 `build_chunks()` 见 `rag/svr/task_executor.py:33-64,192-228`；管理主链见 `management/server/services/knowledgebases/document_parser.py:107-672`；Excel 见 `excel_parser.py:6-49`。

**设计原因**

PDF 版面、表格、问答对和普通文本的语义边界不同。按文档结构切比“一刀切 500 token”更能保留引用位置和图文关系。

**失败/限制**

原生 PDF 在任务层把总页数固定为 1，导致 Parser 通常只拿第一页；管理图文用块序号距离 `<5` 关联图片，是启发式而非版面语义（`api/db/services/task_service.py:226-254`；`management/server/services/knowledgebases/document_parser.py:621-651`）。

**下一版**

先修真实页数；再把 parser/schema version 写入 Chunk，用版面坐标和 section/table lineage 关联，基于黄金集比较不同 chunking 的 recall 与 citation，而不是只比 Chunk 数。

## Q5【真实来源 S03】为什么选 Elasticsearch/Infinity？向量库怎么选型？

**结论**

> 当前原生抽象支持 Elasticsearch 和 Infinity，默认 Compose 真正自洽的是 Elasticsearch；管理解析只支持 ES。选 ES 的直接理由是它同时承载全文、向量、过滤、聚合和图数据，适合这套 Hybrid 检索，不是因为“ES 向量一定最快”。

**当前实现链路**

`DOC_ENGINE` 初始化 ES/Infinity（`api/settings.py:113-124`）；Dealer 同时构造 MatchText/MatchDense（`rag/nlp/search.py:147-171`）；管理 parser 直接 `es_client.index`（`management/server/services/knowledgebases/document_parser.py:392-565`）。

**设计原因**

同一引擎做 tenant/KB/doc 过滤和 BM25+dense，降低双库同步复杂度。Infinity 是原生替代抽象。

**失败/限制**

Compose 声明 Infinity 变量/卷但没有 Infinity service；切到 Infinity 后管理链仍写 ES。当前没有真实容量、p95、召回率 Benchmark，不能说选型已被线上指标证明（`docker/docker-compose-base.yml:97-107`）。

**下一版**

固定数据集、维度、过滤比例、并发和 TopK，比较写入吞吐、过滤后召回、p95、重建和运维成本；要支持 Infinity，就让管理端走统一 DocStore 接口并补 Compose service。

## Q6【真实来源 S04/S05/S20】向量怎样更新、删除？怎么找到原始向量？踩过什么坑？

**结论**

> 向量不是按“向量位置”更新，而是按稳定 Chunk ID 和 tenant index + KB 过滤定位。文本修改会重算 Embedding；只换图片时只改 `img_id`。删除则按 Chunk IDs 从文档引擎删。

**当前实现链路**

`/chunk/set` 由 `doc_id` 反查 tenant，文本变化时绑定 KB Embedding，写 `q_<dim>_vec`；只有图片变化时跳过 Embedding（`api/apps/chunk_app.py:109-170`）。Task 保存 chunk_ids，重解析用它清旧索引（`api/db/services/task_service.py:283-300`）。

**设计原因**

内容寻址/稳定 ID 比依赖 ANN 内部位置可靠；索引引擎内部 segment/向量位置不应该成为业务主键。

**失败/限制**

手工 ID 是 `hash(content+doc_id)`，重复段落会冲突；`/chunk/rm` 错用 `current_user.id` 当 tenant index，可能找不到或删错（`api/apps/chunk_app.py:192-225`）；分批写失败会留下部分新向量。

**下一版**

主键加入 parser generation 和逻辑位置；新向量写 staging generation，校验完成后切 active；删除做 tombstone + 异步 GC，并跑 MySQL/索引 reconciliation。

## Q7【补充高频题】Keyword、向量、Hybrid、Rerank 是怎么串起来的？

**结论**

> 这是两阶段检索：可选 LLM 关键词增强；搜索引擎用全文和向量初召回；应用层再用 token/向量/rank feature 或 Rerank 模型排序，最后应用阈值和 Top N。

**当前实现链路**

关键词拼接见 `api/db/services/dialog_service.py:187-192`；初筛固定全文 0.05、向量 0.95，零结果降阈值（`rag/nlp/search.py:147-194`）；无/有 Rerank 分支见 `rag/nlp/search.py:320-399`；最终 retrieval 见 `:404-529`。

**设计原因**

全文抓精确名词，向量抓语义改写；昂贵 Rerank 只处理候选集，rank feature 注入业务先验。

**失败/限制**

关键词会多一次 LLM 调用；初筛权重固定；没有当前项目黄金集证明某组权重最优。不能把 0.05/0.95 说成全链路最终权重。

**下一版**

离线记录每阶段候选与标签，做 BM25/dense/hybrid/rerank 消融；在线按 query 类型路由，但任何提升数字都要真实评测后再说。

## Q8【真实来源 S02/S13/S14】检索到内容后按什么优先级组装上下文？长上下文问题怎么处理？

**结论**

> 当前先由检索排序决定 Chunk 顺序，再由 `kb_prompt()` 按 token 预算逐块装入；对话历史另压到模型窗口 95%。它有长度控制，但没有专门解决“lost in the middle”的位置重排。

**当前实现链路**

最终 Chunk 排序/TopN 在 `rag/nlp/search.py:404-529`；知识预算在 `rag/prompts.py:136-166`；消息窗口在 `api/db/services/dialog_service.py:223-237`。

**设计原因**

先保证高分证据进入 Prompt，再控制总 token，避免模型请求超窗。

**失败/限制**

长上下文不只会“全都下降”：精确位置、跨段关系、相互冲突证据更容易被忽略。当前没有首尾重排、证据聚类/去冗余或位置敏感评测。

**下一版**

按文档/section 去冗余，保留高分与多样性；把问题、强证据放显著位置；对需要跨 Chunk 推理的题做分层摘要，但必须保留引用。用长度分桶报告准确率，不能口头杜撰阈值。

## Q9【补充高频题】Embedding 为什么把标题和正文混起来？

**结论**

> 原生 Worker 先编码一次标题并复制到每个 Chunk，再按 `filename_embd_weight` 与正文向量线性融合。它让局部段落保留文档主题先验。

**当前实现链路**

正文每 16 条批量编码，标题/正文融合后写 `q_<dim>_vec`（`rag/svr/task_executor.py:357-399`）。

**设计原因**

短 Chunk 单独看可能语义不完整；文件名/标题能补主题。线性融合实现简单且不增加索引字段。

**失败/限制**

标题不准确时会污染所有 Chunk；固定线性权重无法按 query 类型变化；管理链未证明使用完全相同策略。

**下一版**

把 title/body 作为独立 signal，在 Rerank/late fusion 时可调；离线对无意义文件名、标题改写和专业术语查询做消融。

## Q10【补充高频题】多个知识库 Embedding 不同怎么办？

**结论**

> 当前直接拒绝，不会把不同向量空间的分数硬融合。这是保守但正确的边界。

**当前实现链路**

Chat 取所有 KB 的 `embd_id` 去重，不等于 1 就返回错误（`api/db/services/dialog_service.py:119-123`）。

**设计原因**

不同模型的维度和空间不可直接比较；一次 query vector 也不能同时匹配多个空间。

**失败/限制**

用户不能跨异构 KB 查询；错误在运行时才暴露。

**下一版**

创建 Dialog 时提前校验；若必须跨模型，按 embd_id 分组编码/检索，再用 Rerank 或 RRF 合并，不直接归一化余弦分数。

---

## 四、生成、引用与模型

## Q11【真实来源 S08】RAG 有了引用，怎么防幻觉？

**结论**

> 引用提高可追溯性，但不能消除幻觉。当前引用既可能由模型按 `##i$$` 生成，也可能由系统按回答句子和 Chunk 相似度补上；后者尤其不等于逻辑蕴含。

**当前实现链路**

引用 Prompt 见 `rag/prompts.py:169-210`；模型无引用时调用 `insert_citations()`（`rag/nlp/search.py:219-294`；`api/db/services/dialog_service.py:253-269`）；React Popover 展示来源（`web/src/pages/chat/markdown-content/index.tsx:104-244`）。

**设计原因**

先鼓励模型显式引用，再用算法补齐覆盖率，用户至少可以回查原 Chunk。

**失败/限制**

相似文段不一定支撑具体事实；系统没有 entailment 校验、数字核对或无证据句阻断。召回错误也会让引用“看起来完整但来源错”。

**下一版**

分开测 citation coverage、precision、entailment 和 source correctness；数字/日期做精确证据校验；没有支持的句子标“缺少证据”或拒答。

## Q12【真实来源 S15】你怎么判断模型或检索策略效果更好？

**结论**

> 当前仓库没有可证明的系统 Benchmark，所以不能报准确率提升。正确做法是把索引、召回、重排、生成和引用分层评测，不能只看最终主观回答。

**当前实现链路**

代码能切 keyword、Rerank、threshold、vector weight（`api/db/services/dialog_service.py:178-213`），但 CI 没执行测试（`.github/workflows/tests.yml:24-46`），也没有仓库内黄金评测门禁。

**设计原因**

分层才能定位提升来自召回还是模型表达，也能避免强模型掩盖索引缺失。

**失败/限制**

没有真实 query relevance、answer/citation 标签；线上用户量、质量和成本均 `[待本人确认]`。

**下一版**

固定文档版本、模型、Embedding 和随机参数；报告 Recall@K、MRR/nDCG、Rerank、answer correctness、citation precision/coverage、拒答、p50/p95、Token/成本，并做多次运行与置信区间。

## Q13【真实来源 S16】模型超时、抖动或 Rerank 不可用，怎么降级？

**结论**

> 当前已有局部降级：无 Rerank 就走 token+向量+特征，跨语言翻译失败用原问，零召回可降低阈值或返回 empty_response；但没有统一 deadline、熔断和降级标识。

**当前实现链路**

无模型排序见 `rag/nlp/search.py:320-399`；零结果重试见 `:178-194`；翻译 fallback 见 `api/apps/translate_app.py:98-100`；empty_response 见 `api/db/services/dialog_service.py:217-221`。

**设计原因**

非关键增强失败时继续服务，比整条 Chat 失败体验更好。

**失败/限制**

Keyword LLM、Embedding、Chat LLM 的超时/重试策略不统一；SSE 中途错误仍可能是 HTTP 200；用户不知道当前回答是否降级。

**下一版**

总 deadline 分配到 rewrite/retrieval/rerank/generation；只重试 timeout/429/可恢复 5xx；熔断后走明确 fallback；响应携带 `degraded_components` 和模型版本。

---

## 五、异步任务、一致性与可靠性

## Q14【真实来源 S09】解析任务如何保证幂等？

**结论**

> 当前有“有限幂等”，不是 exactly-once。Task digest 能复用同文档、同页范围、同分块配置的成功 Chunk；Chunk 写入也有 ID，但并发解析和多存储切换没有统一幂等代际。

**当前实现链路**

digest 生成和旧 Task 复用见 `api/db/services/task_service.py:260-338`；Worker 按 Task chunk_ids 记录已写结果（`rag/svr/task_executor.py:529-548`）。

**设计原因**

重解析时避免重复 Parser/Embedding，失败时也能知道部分已写 Chunk。

**失败/限制**

digest 没包含明确 parser/model version；两次并发 run 可能互删 Task/Chunk；业务异常后消息 ACK；手工 Chunk 内容 hash 会折叠重复段落。

**下一版**

解析请求先分配 generation/idempotency key；数据库唯一约束防重复 active Task；Worker 输出全部带 generation；完成校验后 CAS 切 active，重复消息返回已完成结果。

## Q15【真实来源 S10】MySQL、Redis、MinIO、ES 如何保证一致性？

**结论**

> 当前没有分布式事务，主要靠顺序调用和少量补偿，存在对象、Task、Chunk 部分成功。下一版更适合 Outbox + 幂等消费者 + generation + reconciliation，而不是强行 2PC。

**当前实现链路**

上传跨 MySQL/MinIO（`api/db/services/file_service.py:332-389`）；Task 插库后逐个推 Redis（`api/db/services/task_service.py:304-313`）；索引分批写后更新计数（`rag/svr/task_executor.py:529-557`）。

**设计原因**

对象存储、Redis、ES 不共享事务管理器；顺序调用实现成本低。

**失败/限制**

Redis 失败时 Task 已建；ES 第 N 批失败时前批已存在；管理 Parser 失败不回滚 Chunk/图片；没有周期对账。

**下一版**

MySQL 事务提交业务状态与 Outbox；dispatcher 幂等投递；索引 staging generation 原子切换；MinIO/旧索引延迟 GC；reconciler 校验 Document/Task/Chunk/Image 不变量。

## Q16【真实来源 S06】为什么用 GraphRAG？当前真的能用吗？

**结论**

> GraphRAG 的价值是实体、关系和社区证据能补普通 Chunk 相似度的多跳问题。当前构建任务入口是真实可达的，但 KG 问答调用契约断裂，所以不能宣称端到端可用。

**当前实现链路**

文档完成后可追加 GraphRAG Task（`api/db/services/document_service.py:335-418`）；Worker 调 `run_graphrag()`（`rag/svr/task_executor.py:491-502`）；KG 查询签名见 `graphrag/search.py:139-150`。

**设计原因**

普通向量检索擅长相似片段，不天然表达实体关系路径；图检索能返回多跳结构与社区摘要。

**失败/限制**

`ask()` 按 Dealer 参数调用 KGSearch，还传不支持的 `aggs`；KG 返回也不是 `chunks/doc_aggs`，`kb_prompt` 无法消费（`api/db/services/dialog_service.py:509-524`）。

**下一版**

实现 KG Adapter 和统一 `RetrievalResult`；纯 KG、普通、混合 KB 分别测；图抽取/社区构建失败要可降级普通 RAG。

## Q17【真实来源 S07】GraphRAG Token 爆炸怎么处理？

**结论**

> 当前普通 RAG 有 `kb_prompt` token 上限，但 KG 查询本身未接通，因此不能把“已解决 GraphRAG Token 爆炸”说成现有能力。

**当前实现链路**

普通知识按 token 逐块截断（`rag/prompts.py:136-166`）；KGSearch 支持实体、关系、社区 TopN 与 max_token 参数（`graphrag/search.py:139-150`），但调用方参数不匹配。

**设计原因**

图的邻居和社区展开会指数式增加证据，必须在召回阶段限实体/边/社区，再在 Prompt 阶段限 token。

**失败/限制**

仅截断尾部可能丢关键路径；社区摘要本身也可能幻觉；当前没有图路径去重、证据覆盖评测。

**下一版**

问题实体种子 -> 带权有限 hop -> 路径去重 -> 证据预算分配 -> 社区摘要只作导航、原始 Chunk 作引用；按问题复杂度动态分配 ent/rel/comm topn。

---

## 六、Agent、权限与安全

## Q18【真实来源 S12/S19】GraphRAG、RAG、Prompt、Tool、Skill、MCP 的边界是什么？

**结论**

> RAG/GraphRAG 负责找证据，Prompt 负责告诉模型如何使用证据，Tool 执行受控动作，Skill 封装一套可复用工作方法，MCP 是把资源和工具暴露给 Agent 的协议。它们不是互相替代的同一层。

**当前实现链路**

当前项目可达的是普通 RAG、GraphRAG 构建和 LLM 生成；`agentic_reasoning/deep_research.py::DeepResearcher` 无调用方，Agent/Canvas 主代码已删除，`web/src/utils/api.ts:138-148` 残留 URL 只是死代码。

**设计原因**

把检索与执行分离后，知识访问可只读，工具动作可单独做权限、超时和审计。

**失败/限制**

当前不能说有完整 Agent Runtime、MCP 服务或 Deep Research 产品链；也没有工具 allowlist、持久状态和 human approval。

**下一版**

先把检索封装为只读工具，返回 source refs；再定义 Agent 状态机、工具 ACL、预算/deadline、审批、审计和回放。是否用 MCP 取决于外部 Agent 接入需求。

## Q19【真实来源 S18】为什么不让强模型或 Agent 直接读文件，不建 RAG？

**结论**

> 小文件、一次性问题直接让 Agent 读更简单；RAG 的价值是大规模共享索引、权限过滤、重复查询成本、稳定引用和运营管理。两者应按场景组合，不是非此即彼。

**当前实现链路**

Ragflow-Plus 把 Document/Chunk 持久化，按 tenant/KB/doc 过滤，并维护引用/图片（`rag/nlp/search.py:404-529`；`api/db/services/dialog_service.py:253-307`）。

**设计原因**

同一批文档被多人反复查询时，预解析/Embedding 摊薄成本；引用和权限也比 Agent 临时读目录更可治理。

**失败/限制**

索引有新鲜度和一致性成本；当前权限还有绕过路由，GraphRAG 查询也未接通。对单个小文件，上传建库可能过重。

**下一版**

提供两种路径：临时附件走短生命周期直读/轻索引，团队知识走持久 RAG；Agent 可先 grep/metadata 探索，再按需调 RAG，不强制全量索引。

## Q20【真实来源 S17】多租户怎样保证召回不泄漏别人数据？

**结论**

> 正确原则是“先做权限过滤，再做相关性”，不能全局召回后靠 Prompt 不展示。当前 Dealer 接收 tenant_ids/kb_ids，但 HTTP 对象授权不统一，管理端更有无 Token 全局查询问题。

**当前实现链路**

Chat 从 KB 得 tenant_ids 并传 Retrieval（`api/db/services/dialog_service.py:194-213`）；原生有 KB/Document accessible（`api/db/services/knowledgebase_service.py:237-266`；`api/db/services/document_service.py:222-242`）。管理列表无 token 时不加过滤（`management/server/routes/teams/routes.py:6-26` 等）。

**设计原因**

把 tenant/KB 作为查询 filter，未授权文档根本不进入候选和 Prompt，才能防止模型泄漏。

**失败/限制**

上传、下载、图片代理、Chunk list 等路由存在检查缺口；索引层没有独立强 ACL，错误 tenant 参数可造成越权。

**下一版**

统一 AuthContext、fail-closed 管理 JWT、服务端 RBAC 和对象归属；索引查询由服务端从授权 KB 集合生成 filter，不接受客户端 tenant；加跨租户负向测试。

## Q21【真实来源 S11】把企业文档交给模型有什么安全问题？Prompt Injection 怎么办？

**结论**

> 风险包括文档外发、模型供应商留存、敏感日志、间接 Prompt Injection 和未来 Agent 工具滥用。当前项目把召回文本直接放进 system template，没有可证明的防注入层。

**当前实现链路**

知识被拼到 Prompt（`api/db/services/dialog_service.py:213-231`）；请求 loader 还打印 Authorization 和邮箱（`api/apps/__init__.py:146-170`）；租户模型 API Key 存数据库（`api/db/db_models.py:633-661`）。

**设计原因**

RAG 必须把证据给模型才能生成，但“给数据”不应等于“赋予数据指令权”。

**失败/限制**

没有数据分级、DLP、出站审计、Prompt Injection 评测；图片公开桶和无鉴权下载扩大泄露面。

**下一版**

按租户/文档分级决定可用模型；出站最小化、脱敏和审计；检索文本用不可执行数据边界；Agent 工具参数独立 allowlist；secret KMS 化；日志只留 ID/哈希。

## Q22【补充高频题】管理端鉴权最大的漏洞是什么？

**结论**

> 不是 JWT 算法本身，而是 JWT 没有全局强制：缺失/无效 token 返回 None，很多路由继续执行，甚至退化为全局查询。

**当前实现链路**

`decode_token()` 见 `management/server/services/auth/auth_utils.py:8-33`；无 token 的 team/file/KB 列表不加过滤（`management/server/routes/teams/routes.py:6-26`；`management/server/routes/files/routes.py:34-58`；`management/server/routes/knowledgebases/routes.py:11-31`）；解析路由无角色检查（`management/server/routes/knowledgebases/routes.py:235-252`）。

**设计原因**

从代码看是逐路由可选解析 token 的快速实现，但安全策略变成 fail-open。

**失败/限制**

5000 端口映射宿主，默认密码/secret 又是公开值（`docker/docker-compose.yml:52-73`），可直接形成读取和管理操作风险。

**下一版**

全局 before_request 默认拒绝；登录/OPTIONS/health allowlist；JWT 含 issuer/audience/jti；服务端 RBAC + 对象归属；默认 secret 启动失败；管理 API 只在内网/网关后。

## Q23【补充高频题】文件上传有哪些安全和并发问题？

**结论**

> 管理分块上传有路径穿越面，普通上传有同名临时文件竞争，身份缺失还会回退最早用户；撰写图片上传无鉴权、无大小/魔数限制且公开。

**当前实现链路**

分块目录/合并路径直接使用 `upload_id/file_name`（`management/server/services/files/service.py:616-740`）；普通上传和身份回退见 `:455-609`；公开图片见 `api/db/services/write_service.py:132-180`。

**设计原因**

前端生成 uploadId 和文件名清洗能覆盖正常操作，但不能作为服务端安全边界。

**失败/限制**

攻击者可绕过前端构造路径；同名并发覆盖；扩展名与真实 MIME 不一致；失败/中止临时文件缺统一 GC。

**下一版**

服务端 UUID、resolve containment、每块 checksum/配额/用户绑定、原子合并；文件魔数/解码重编码/沙箱 Parser；私有桶 + 签名 URL；过期任务 GC。

---

## 七、Plus 专项能力

## Q24【补充高频题】原生解析和 MinerU/Excel 管理解析有什么区别？

**结论**

> 两条链最终都写 Chunk，但不是同一套实现。原生是 MySQL Task + Redis Stream + Worker、支持 ES/Infinity；管理链默认同步，MinerU/pandas 后逐块调 Embedding 和 ES，只支持 ES。

**当前实现链路**

原生见 `api/db/services/task_service.py:193-313`、`rag/svr/task_executor.py:150-588`；管理见 `management/server/routes/knowledgebases/routes.py:235-252`、`management/server/services/knowledgebases/document_parser.py:107-672`。

**设计原因**

管理链快速接入高质量版面/表格解析，不依赖原生 parser 工厂和 Worker。

**失败/限制**

管理逐块 Embedding/ES，失败无回滚；批量状态只在内存；图片 key、token、状态语义和 Infinity 支持都不一致。

**下一版**

MinerU/Excel 只实现 ParserAdapter，输出统一 ChunkEnvelope；所有解析提交同一持久 Task/Worker，由统一 IndexWriter 写 generation。

## Q25【补充高频题】Redis Stream 的消费和重试语义是什么？

**结论**

> Worker 会先读 pending 再读新消息，能恢复 ACK 前崩溃；但业务异常捕获后仍 ACK，所以失败不会自动重投。不能说 exactly-once 或完整 at-least-once。

**当前实现链路**

领取和取消 ACK 见 `rag/svr/task_executor.py:150-185`；成功/异常最终 ACK 见 `:564-588`；Redis 封装见 `rag/utils/redis_conn.py:196-265`。

**设计原因**

Stream consumer group 提供 pending 恢复，显式 ACK 能避免重复消费。

**失败/限制**

异常一律 ACK；没有 retryable/permanent 分类、退避、DLQ 和人工 replay。Compose 的 Valkey 还使用 128 MiB `allkeys-lru`，队列键可能受逐出策略影响（`docker/docker-compose-base.yml:81-93`）。

**下一版**

异常分类；可恢复错误不 ACK/延时重投，超次数进 DLQ；幂等 generation；队列使用 `noeviction` 或独立实例，监控 lag/pending/oldest age。

## Q26【补充高频题】为什么多页 PDF 只检索到第一页？

**结论**

> 这是已定位的任务切分缺陷，不是检索阈值问题：入队前把 PDF 总页数硬编码为 1。

**当前实现链路**

`queue_tasks()` 在 PDF 分支 `pages=1`，再裁剪 `page_ranges`，一般只创建 from_page=0、to_page=1 的 Task（`api/db/services/task_service.py:226-254`）。Worker 按这个范围调用 Parser。

**设计原因**

代码保留了按 page_size 切 Task 的框架，但真实页数读取被移除/替换成占位值。

**失败/限制**

Document progress 可到 100%，用户误以为全篇已索引；已有文档需要重建才能补齐。

**下一版**

从 PDF 元数据读真实页数，校验用户页范围；加入 1/2/13 页和部分范围测试；修复后按 parser generation 批量重建受影响 PDF。

## Q27【补充高频题】图片从解析到引用展示是怎么流动的？

**结论**

> Parser 把图片写对象存储并在 Chunk 保存 `img_id`；Retrieval 返回时归一成 `image_id`；Chat 在对应 `##i$$` 后插 MinIO 图片，React 同时展示引用。问题是原生、管理、代理和前端有多套 key/URL 协议。

**当前实现链路**

字段归一见 `rag/nlp/search.py:496-516`；Chat 插图见 `api/db/services/dialog_service.py:271-295`；管理写 `<kb>/images/uuid` 见 `management/server/services/knowledgebases/document_parser.py:574-616`；原生代理按 `-` 拆路径见 `api/apps/document_app.py:459-469`。

**设计原因**

Chunk 带图片引用能让图文问答和引用来源关联，避免把图片本体放 ES。

**失败/限制**

协议不一致会导致正文可见、预览失败；管理图片公开；图片集遍历每文档最多 1024 Chunk后内存分页（`api/apps/kb_app.py:261-327`）。

**下一版**

统一 ImageAsset/对象 key；私有桶和签名 URL；Chunk 存 asset_id；资产列表单独分页；引用计数与孤儿 GC。

## Q28【补充高频题】跨语言检索是如何实现的？

**结论**

> 当前是 React 前置翻译，不是后端统一多语检索。只在最后一问含中文且 Dialog 开关开启时固定 zh->en；失败使用原问。

**当前实现链路**

React 先查 Conversation/Dialog，再调翻译并替换消息（`web/src/hooks/logic-hooks.ts:185-309`）；T5 模型懒加载、CPU、最大 512 token（`api/apps/translate_app.py:30-100`）；后端 Chat 明确只记录前端处理（`api/db/services/dialog_service.py:134-136`）。

**设计原因**

前端改造小，能复用现有 Chat API，翻译失败不阻断问答。

**失败/限制**

SDK 不获得同样能力；只按中文字符判断；固定到英文可能不匹配 KB 语言；首次模型下载/加载延迟大。

**下一版**

后端语言检测和 query expansion；原问/译问并行检索后 RRF；记录翻译版本与降级；React/SDK 共用同一契约。

---

## 八、工程质量、排障与个人边界

## Q29【真实来源 S21】这个项目落地最容易踩什么坑？

**结论**

> 最大坑不是调一个阈值，而是“看起来成功、实际链路不完整”：Worker 可能 import 失败、PDF 成功但只有一页、异常 ACK、管理失败但 ES 已有部分 Chunk、图片 key 不一致、KG 构建有入口但问答契约断裂。

**当前实现链路**

对应证据依次是 `rag/svr/task_executor.py:33-64`、`api/db/services/task_service.py:226-254`、`rag/svr/task_executor.py:564-588`、`management/server/services/knowledgebases/document_parser.py:392-672`、`api/db/services/dialog_service.py:271-295`、`api/db/services/dialog_service.py:509-524`。

**设计原因**

RAG 是多存储、多模型、异步链，单个 API 返回 200 不能代表端到端正确。

**失败/限制**

当前缺 trace、对账和有效 CI，问题容易到用户查询时才暴露。

**下一版**

把不变量和 smoke test 变成发布门禁；request_id/task_id/doc_id 串联 trace；故障注入覆盖 Redis/MinIO/ES/Embedding/LLM；上线数据仍 `[待本人确认]`。

## Q30【真实来源 S22】这个项目是不是你一个人做的？团队、用户和效果多少？

**结论**

> 源码和 Git 作者不能证明我的个人 ownership，也不能证明团队人数、用户量、QPS 或收益。面试必须按真实任务记录回答。

**当前实现链路**

可客观陈述仓库架构和当前提交；个人部分填写：`[待本人确认：本人角色、负责模块、设计/编码/测试/部署边界、协作方、时间范围]`。

**设计原因**

把“项目能力”和“个人贡献”分开，避免把团队代码包装成个人从零主导。

**失败/限制**

禁止用 commit 作者、仓库 owner 或发布日期推断；禁止编造用户量、p95、准确率、Token 节省和业务收益。

**下一版**

准备一张 RACI 和三条可验证案例：我做的决策、证据/PR/评审、结果与反思。所有数字带时间窗、数据源、口径和基线。

## Q31【补充高频题】测试和 CI 做得怎么样？

**结论**

> 当前测试门禁很弱。名为 tests 的 workflow 只 checkout；React/Vue 虽声明测试命令，但仓库只发现 3 个 Vue 测试；SDK 的 23 个 Python 测试偏真实 HTTP 接口。

**当前实现链路**

CI 见 `.github/workflows/tests.yml:24-46`；前端脚本见 `web/package.json:4-12`、`management/web/package.json:8-16`；SDK 测试见 `sdk/python/test/`。

**设计原因**

SDK 接口测试可覆盖用户流程，Ruff/Jest/Vitest 也已具备工具入口。

**失败/限制**

工具存在不等于执行；当前没有权限负向、Task 重试、PDF 多页、KG 契约、双 parser schema 和故障注入门禁。

**下一版**

CI 至少跑 AST/import、Ruff、前端 typecheck/lint/test、核心单测、Docker smoke；夜间起依赖栈跑 E2E 和检索黄金集。

## Q32【补充高频题】系统如何做可观测性？

**结论**

> 当前有轮转日志、Worker Redis 心跳和 Chat 阶段耗时，但没有统一 metrics/tracing。`langfuse` 只是依赖声明，不代表已接入。

**当前实现链路**

日志见 `api/utils/log_utils.py:33-80`；Worker pending/lag/done/failed/current 见 `rag/svr/task_executor.py:591-613`；Chat 阶段耗时见 `api/db/services/dialog_service.py:314-329`；`langfuse` 仅见 `pyproject.toml:127`。

**设计原因**

现有信息足以做单机日志排查和观察队列粗状态。

**失败/限制**

API、Task、ES、模型调用无法用 trace_id 串联；SSE 错误不反映在 HTTP 状态；日志还泄露 token/邮箱。

**下一版**

OpenTelemetry/Prometheus 贯穿 request_id->task_id->doc_id；记录队列 oldest age、Parser/Embedding/索引/首 token/总耗时；Prompt/原文默认不入日志。

## Q33【补充高频题】当前最重要的 P0/P1/P2 是什么？

**结论**

> P0 先解决可启动和安全，P1 解决可靠任务与一致性，P2 才做效果、性能和 Agent 化。顺序不能反过来。

**当前实现链路**

P0 证据：缺 parser（`rag/svr/task_executor.py:33-64`）、管理越权（`management/server/routes/teams/routes.py:6-26`；`management/server/routes/files/routes.py:34-58`；`management/server/routes/knowledgebases/routes.py:11-31`）、PDF 页数（`api/db/services/task_service.py:226-254`）、KG 契约（`api/db/services/dialog_service.py:509-524`）。

**设计原因**

不先保证“能跑、不能越权、数据完整”，任何召回调优数字都不可信。

**失败/限制**

当前没有完整测试/监控证明整改结果；路线是建议，不是已有能力。

**下一版**

P0：clean image、JWT/RBAC/对象授权、路径/上传、PDF/KG；P1：Outbox/DLQ/generation/reconciliation/统一 DTO；P2：黄金集、trace、多语、性能、受治理 Agent。

## Q34【补充高频题】如果让你现场设计下一版可靠解析平台，你怎么讲？

**结论**

> 我会把原生和 MinerU/Excel 收敛到“统一任务状态机 + Parser Adapter + ChunkEnvelope + generation IndexWriter”，而不是继续维护两套写索引逻辑。

**当前实现链路**

当前原生 Task/Redis/Worker 在 `api/db/services/task_service.py:193-313`、`rag/svr/task_executor.py:150-588`；管理同步 Parser 在 `management/server/services/knowledgebases/document_parser.py:107-672`。

**设计原因**

Parser 可以多样，但身份、任务、重试、Chunk schema、索引提交和观测必须统一，才能控制复杂度。

**失败/限制**

当前没有统一状态机、DLQ、代际切换、跨存储对账；管理 daemon thread 重启丢状态。

**下一版**

> API 在 MySQL 事务里创建 Task+Outbox；dispatcher 投 Redis；Worker 按 parser_type 调 Adapter；输出先做 schema/向量维度校验，再写 staging generation；全部成功 CAS 切 active；可恢复异常退避重试，永久错误进 DLQ；补偿器回收旧索引/孤儿图片；trace 串起 request/task/model/index。这样不追求虚假的 exactly-once，而用幂等和可对账实现业务上的一次生效。

---

## 九、现场追问速答

| 追问 | 20 秒回答 |
|---|---|
| Session 在哪？ | 原生 Flask Session 是 filesystem；Authorization 是 itsdangerous token，管理端才是 HS256 JWT（`api/apps/__init__.py:83-91,142-171`）。 |
| 消息失败会重试吗？ | ACK 前进程崩溃可从 pending 恢复，但业务异常后仍 ACK，没有自动重投/DLQ（`rag/svr/task_executor.py:564-588`）。 |
| 管理 Parser 支持 Infinity 吗？ | 不支持，它直接写 ES；原生 DocStore 才抽象 ES/Infinity。 |
| 引用可靠吗？ | 可回查但不是事实证明；无引用时会按相似度补引。 |
| GraphRAG 可用吗？ | 构建入口可达，查询签名和返回 DTO 接错，端到端不可宣称可用。 |
| Agent 呢？ | 当前 Agent/Canvas 主实现已删除，Deep Research 无调用方；不能说已上线。 |
| 跨语言支持什么？ | 当前 React 检测中文后固定 zh->en；SDK 不自动执行。 |
| 最大安全问题？ | 管理 API fail-open，加上默认 secret/宿主 5000 暴露；另有无鉴权下载/图片上传和分块路径问题。 |
| 最大可靠性问题？ | 双解析链、异常 ACK 和多存储部分成功，没有统一 generation/补偿/对账。 |
| 性能多少？ | `[待本人确认：真实压测环境、数据集、并发、p50/p95、资源]`，源码不能推出线上数字。 |

## 十、面试事实红线

1. 不说“从零自研 RAGFlow”；明确上游 v0.17.2 基线。
2. 不说“所有路由都有权限”；原生对象检查散落，管理端有明确 fail-open。
3. 不说“PDF 全文解析”；当前默认通常只建第一页任务。
4. 不说“Redis 保证 exactly-once”；业务异常仍 ACK。
5. 不说“管理 MinerU 是可靠异步任务”；默认同步，批量只是 daemon thread + 内存状态。
6. 不说“Hybrid 最终固定 0.05/0.95”；那是搜索引擎初筛，应用层另排序。
7. 不说“引用消除幻觉”；它只增强可追溯。
8. 不说“GraphRAG/Deep Research/Agent 已打通”；当前可达性不同且有阻断。
9. 不编造 QPS、p95、准确率、Token 节省、用户、上线时间、事故和收益。
10. 不把 Git 作者或仓库 owner 当作本人贡献证据；个人内容全部 `[待本人确认]`。

## 十一、验证说明

本次对 160 个 Python 文件执行 AST 解析，0 个语法失败；两个 shell 入口通过 `bash -n`；静态确认 Worker 所引用的 11 个 parser 文件在当前仓库缺失。没有可用的 MySQL、Redis、MinIO、ES/Infinity、MinerU、Embedding 和 LLM 测试环境，因此答案不宣称真实运行、性能或质量结果。所有路径/行号以文首提交为准。
