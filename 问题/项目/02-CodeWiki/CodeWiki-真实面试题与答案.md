# CodeWiki 真实面试题与答案

> 本文收录 13 场真实面试中与 CodeWiki 直接相关的 11 张统一答案卡。答案按“当前实现 / 下一版设计 / 待本人确认”区分事实边界；现场完整题号仍可在 [十三场面试映射](../../../面试分析/三个项目-实际面试提问汇总.md) 中反查。

## 使用规则

| 标签 | 含义 | 面试时怎么说 |
|---|---|---|
| **当前实现** | 能从项目材料、源码或真实复盘确认 | 直接讲链路、取舍、失败语义和现有限制 |
| **下一版设计** | 合理的系统设计，但当前项目没有完整实现 | 先说“当前没有”，再说“如果重做，我会……” |
| **待本人确认** | 团队、时间、用户、QPS、模型、投产、事故等个人事实 | 只填可核验事实；没有证据就不报数字 |

项目事实入口为 `项目/CodeWiki/`，更完整的专项题库见 [CodeWiki 全链路源码级深入分析](./CodeWiki-全链路源码级深入分析.md)。

## 现场来源索引

| 答案卡 | 明确现场来源 |
|---|---|
| C01 | 丰泊国际 Q25-Q29；卓誉 Q9；安克创新 Q5-Q7；微众银行 Q16；忆纪元 Q7-Q8；美狮物流 Q23-Q24 |
| C02 | Ashley CodeWiki Q1；丰泊国际 Q25-Q29；安克创新 Q5-Q7；忆纪元 Q11；码云 Q7、Q17-Q18 |
| C03 | 卓誉 Q9；安克创新 Q5-Q7；忆纪元 Q9-Q10；码云 Q15-Q16 |
| C04 | Ashley CodeWiki Q2-Q4；忆纪元 Q11；码云 Q15-Q16 |
| C05 | Ashley CodeWiki Q5；微众银行 Q15；码云 Q17-Q18 |
| C06 | 码云 Q8-Q12；美狮物流 Q18-Q21 |
| C07 | 码云 Q8-Q12、Q19-Q20/Q20A；美狮物流 Q22 |
| C08 | 丰泊国际 Q25-Q29；码云 Q13-Q14 |
| C09 | Ashley 工程题；丰泊国际 Q25-Q30；安克创新 Q5-Q7；忆纪元 Q13；码云 Q25A；美狮物流 Q25-Q28 |
| C10 | 忆纪元 Q12 |
| C11 | 卓誉 Q6-Q7；忆纪元 Q7-Q8 |

## C01：CodeWiki 是什么，强 Coding Agent 时代还有什么价值？

CodeWiki 是本地优先的代码智能平台：把仓库解析为可追溯代码图，用符号、全文、可选向量和受限图扩展为 Ask/Wiki 提供证据。它不替代 Claude Code、Codex 或 Cursor；一次性小仓库任务通常直接用强 Agent 更合适。

它的净价值在反复跨模块问题、精确源码引用、团队知识复用和可审计 Wiki。是否值得使用要以原生 Agent、Repo Map/Skill、CodeWiki 三组任务的正确率、耗时、Token、建索引成本和新鲜度比较，而不是宣称“GraphRAG 一定更强”。

## C02：完整架构和 GraphRAG 流程是什么？

离线链路是 RepoScanner -> tree-sitter AST/语言增强器 -> 统一 Symbol IR -> Code Graph/Community -> 符号级 Source Chunk -> FTS/可选 Vector。在线链路先通过符号、路径、FTS 和可选向量找 Seed，再在跳数和节点数预算内扩图，按五因子排序并装成 Context Pack，最后供 Ask、Wiki、CLI 或 MCP 使用。

这里的 GraphRAG 是“代码图约束的检索增强”，不是照搬微软 GraphRAG；MCP 是把已有能力暴露给 Agent 的协议，不是检索算法。

## C03：tree-sitter 是开源的，自研了什么，支持哪些语言？

tree-sitter 只提供语法树底座。自研价值在各语言 Capture Spec 与 Augmenter、统一 Symbol IR、稳定 ID、跨文件启发式解析、置信度和 provenance、增量缓存、图存储、检索和 Agent 工具化。结构边相对确定，跨文件 Calls/References 受动态分派和类型缺失影响，不能说成编译器级完整调用图。

支持语言和本人熟练度要分开说：解析器支持不等于本人精通该语言。具体语言清单和熟练度按当前项目和本人事实回答。

## C04：节点、边和 Chunk 怎么设计？

节点包括仓库、目录、文件、类、函数、方法、接口、Endpoint、Schema、Config 等；边包括 contains、defines、imports、exports、calls、references、inherits、implements、routes_to 和 uses_config，边带方向、置信度、是否推断和来源。

当前是符号级 Chunk，一个符号对应精确文件和行范围，没有把超大函数二次切片。因此“大函数切成两个 Chunk 后是什么边”的正确回答是先纠正前提。下一版如要切，可用 `parent_symbol_id + ordinal + line_range` 和相邻片元回带，是否建 Sequential Edge 应由评测决定。

## C05：如何检索、组装上下文并控制 Token？

Seed 来自符号名/路径、节点 FTS、源码 FTS 和可选向量；扩图受最大跳数和节点数限制。候选按语义、关键词、图距离、节点重要度和源码新鲜度排序，再受最大 Chunk 数和近似 Token Budget 约束装包。

当前没有实现 Lost in the Middle 的头尾双端布局，也不能说 8000 的近似预算保证最终 Prompt 一定不超。下一版应对比降序、头尾双端和按证据类型分区，并在最终序列化后再次精确计数。

## C06：向量库怎么选，如何更新、删除和建索引？

本地优先场景用 SQLite/FTS 和可选 sqlite-vec；服务化、多并发和关系数据共存可用 PostgreSQL + pgvector。向量是增强，不启用 Embedding 时符号、FTS 和图仍可工作；只有规模、过滤、延迟和运维需求明确时才考虑独立向量数据库。

记录以稳定 `chunk_id` 定位，保存 `repo_id、revision、path、symbol_id、content_hash、model、dimension`。内容 Hash 变化时 upsert 新向量，删除 Chunk 时按外键/事务删除索引。HNSW 适合低延迟近邻查询但更新删除和内存成本更高；IVFFlat 需要训练并依赖 lists/probes 调参。具体生产使用过哪些库是 **[待本人确认]**。

## C07：多分支、历史版本和 Dirty Workspace 怎么保证一致？

正确的数据主键应绑定不可变 `repo_id + revision + path/symbol`。历史 Commit/Tag 要切到隔离 worktree 或快照单独建索引；不能把多个版本静默写进同一在线图。工作区有未提交修改时，要么实时覆盖索引并标记 dirty revision，要么直接拒绝旧索引回答并让 Agent 读当前文件。

当前实现有 Git Diff/Hash 增量，但没有贯穿图、向量、Wiki 和引用的统一不可变 Revision，因此不能承诺任意历史查询或强一致 Dirty Workspace。这是必须主动承认的现有缺口。

## C08：如何治理幻觉和源码安全？

幻觉来自模型先验、召回遗漏/噪声、陈旧索引、上下文冲突和无证据生成。治理链是：精确 Source Ref、受限 Context Pack、答案引用、引用存在性/行范围校验、必要时读取原文、低证据时拒答，以及按固定问题集评测。

源码安全需要本地/私有模型或获批网关、最小权限、仓库 ACL、Secret 扫描与脱敏、Prompt Injection 隔离、审计、保留期和删除传播。当前项目不具备完整 SaaS 多租户安全，不能只因“本地优先”就说没有风险。

## C09：MCP、Skill、Prompt、Tool、RAG 和 SDD 的边界是什么？

Prompt 定义本轮指令；Tool 提供可执行能力；MCP 标准化 Tool/Resource 的暴露；Skill 是渐进披露的过程知识，指导 Agent 何时、怎样使用工具；RAG 提供外部事实检索；SDD 用可审查 Spec 驱动实现和验收。它们可以组合，但互不替代。

CodeWiki 可把 analyze/search/graph/wiki 暴露成 MCP Tool，也可把“先读 repo map、再按需查图”的过程写成 Skill。生成文档可留在仓库 Markdown/JSON 并由 Git 管理；Skill 不使用数据库时通常依赖 Agent 的 read/grep/LSP/MCP 动态探索。

## C10：能否检测模块设计或架构坏味道？

图可以检测可计算候选，如循环依赖、层级逆向、热点中心、跨层调用、孤立模块和过度耦合；但“职责不清”“边界合理”需要架构规则或人工判断。正确做法是输出规则、证据边、置信度和受影响节点，不能让模型凭感觉宣布架构违规。

## C11：谁在用、是否仍在使用、是不是一个人做？

用户量、查询量、上线时间、当前采用场景和团队分工全部是 **[待本人确认]**。可回答的结构是：谁在什么工作流中使用、观察窗口多长、查询如何去重、本人负责哪些阶段、同事负责什么。没有日志就说验证过核心能力，不把试验工具包装成长期生产平台。
