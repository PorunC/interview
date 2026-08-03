# CodeWiki 真实面试题与答案

> 本文收录 16 场真实面试中与 CodeWiki 直接相关的 12 张统一答案卡，并附一份可直接在面试中讲述的项目口语串讲。答案按“当前实现 / 下一版设计 / 待本人确认”区分事实边界；现场完整题号仍可在 [十六场面试映射](../../../面试分析/三个项目-实际面试提问汇总.md) 中反查。

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
| C01 | 丰泊国际 Q25-Q29；卓誉 Q9；安克创新 Q5-Q7；微众银行 Q16；忆纪元 Q7-Q8；美狮物流 Q23-Q24；货拉拉 Q3/Q8；颂拓 Suunto Q15；Autel Q2/Q15 |
| C02 | Ashley CodeWiki Q1；丰泊国际 Q25-Q29；安克创新 Q5-Q7；忆纪元 Q11；码云 Q7、Q17-Q18；货拉拉 Q5；颂拓 Suunto Q12；Autel Q2 |
| C03 | 卓誉 Q9；安克创新 Q5-Q7；忆纪元 Q9-Q10；码云 Q15-Q16；货拉拉 Q4；颂拓 Suunto Q12；Autel Q5 |
| C04 | Ashley CodeWiki Q2-Q4；忆纪元 Q11；码云 Q15-Q16；货拉拉 Q4-Q6；颂拓 Suunto Q12；Autel Q5 |
| C05 | Ashley CodeWiki Q5；微众银行 Q15；码云 Q17-Q18 |
| C06 | 码云 Q8-Q12；美狮物流 Q18-Q21 |
| C07 | 码云 Q8-Q12、Q19-Q20/Q20A；美狮物流 Q22；货拉拉 Q7；颂拓 Suunto Q13 |
| C08 | 丰泊国际 Q25-Q29；码云 Q13-Q14 |
| C09 | Ashley 工程题；丰泊国际 Q25-Q30；安克创新 Q5-Q7；忆纪元 Q13；码云 Q25A；美狮物流 Q25-Q28 |
| C10 | 忆纪元 Q12 |
| C11 | 卓誉 Q6-Q7；忆纪元 Q7-Q8；货拉拉 Q8；颂拓 Suunto Q15；Autel Q2 |
| C12 | 货拉拉 Q7；颂拓 Suunto Q13-Q15 |

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

## C12：Neo4j、关系型存储和 Git diff 怎样分工，增量更新为什么不能只跑 diff？

图数据库适合保存节点、边、方向、置信度和关系遍历；关系型存储适合仓库/Revision 元数据、任务状态、唯一约束、审计和事务；文件或对象存储保留源码快照和原文证据。三者通过稳定的 `repo_id + revision + symbol_id` 关联，不能让图数据库单独承担版本事实。

Git diff 只能告诉我可能受影响的文件和行，不能直接保证文档正确更新。函数重命名、移动、删除、宏/动态调用和跨文件类型变化可能让旧节点、边、向量、Wiki 和 Citation 残留。因此增量流程应把 diff 作为候选集合，再按内容 Hash、符号稳定 ID、反向依赖和删除 tombstone 重算受影响子图，最后在同一 Revision 下原子发布；无法证明一致时宁可标记 stale 并回退读原文。当前已有 Diff/Hash 增量思路，但没有统一不可变 Revision 的全链路强一致承诺。

## 附录：CodeWiki 口语化串讲

### 30 秒开场版

> CodeWiki 是一个本地优先的代码智能平台。它先用 tree-sitter 把仓库解析成符号和代码关系图，再结合全文检索、可选向量检索和受限图扩展，为代码问答和 Wiki 生成准备一份带文件、行号和关系证据的上下文。它不是简单地把代码切块后丢给大模型，核心价值是让模型回答“这个调用链怎么走、这个模块为什么依赖那个模块”时，能沿源码关系找到证据，而且代码变化后可以增量更新受影响内容。

### 一、为什么要做这个项目

> Coding Agent 看单个文件已经很强，但遇到跨模块调用、历史设计原因、多人反复查询和长篇架构文档时，仍然容易漏掉中间关系，或者给出一段看起来合理但没有源码依据的解释。所以 CodeWiki 不是为了替代 Codex、Claude Code 或 Cursor，而是给它们补一层可查询、可追溯、可复用的代码事实层。

小仓库的一次性问题，直接让强 Agent 读代码通常更划算；CodeWiki 更适合反复查询同一仓库、需要精确源码引用、团队复用知识或持续维护 Wiki 的场景。是否值得建索引，应该用正确率、Token、耗时、新鲜度和索引成本做对比，而不是先假设 GraphRAG 一定更强。

### 二、仓库是怎么变成代码图的

> 用户接入一个本地目录或 Git 仓库后，RepoScanner 先遍历文件，应用 ignore 规则，并记录路径、大小、修改时间、Git 时间和内容 Hash。接着用 tree-sitter 解析 AST，但 tree-sitter 只提供语法树，真正自研的是每种语言的 Capture Spec、Augmenter、统一 Symbol IR、稳定 ID 和跨文件关系解析。
>
> 解析后，系统把仓库、目录、文件、类、函数、接口、Endpoint、Schema 和配置等建成节点，把 `contains`、`defines`、`imports`、`calls`、`inherits`、`routes_to` 等建成边。确定关系保留源码来源，跨文件 Calls 或 References 如果只能启发式判断，就同时保存置信度和 provenance，不能包装成编译器级完整调用图。
>
> 然后系统按符号生成 Source Chunk，一个 Chunk 对应明确文件和行范围；再建立源码全文索引、节点索引和可选向量索引。向量只是增强能力，即使不开 Embedding，符号检索、FTS 和代码图仍然可以工作。

离线建库链路可以概括为：

```text
扫描仓库 -> tree-sitter AST -> 统一 Symbol IR -> Code Graph
-> 符号级 Source Chunk -> FTS / 可选 Vector -> Community
```

### 三、用户问一个问题时怎么检索

> 一个问题进来后，系统先从符号名、文件路径、节点 FTS、源码 FTS 和可选向量中找一批 Seed。找到 Seed 以后不会无限遍历整张图，而是在最大跳数和最大节点数预算内扩展调用、引用、继承和模块关系。
>
> 候选 Chunk 会综合语义相似度、关键词匹配、图距离、节点重要度和源码新鲜度排序，然后在最大 Chunk 数和近似 Token Budget 内组装成 Context Pack。模型拿到的不是整个仓库，也不是几个没有关系的相似切片，而是一组带 Source Ref、文件、行号和图关系的证据。

在线链路可以压缩成：

```text
用户问题 -> 多路 Seed 检索 -> 预算内扩图 -> 多因子排序
-> Context Pack -> Ask / Wiki / CLI / MCP
```

当前的 Token Budget 是近似值，最终序列化后不一定绝对不超；Lost in the Middle 的头尾双端布局也不是当前已经完成的能力。这些可以作为下一版优化，不能反过来说已经上线。

### 四、Wiki 页面是怎么生成的

> Wiki 不是让模型一次性自由写完整仓库文档。系统先用仓库级证据规划 Catalog，也就是要生成哪些页面；然后按页面取证，先做 GraphRAG，再根据允许引用的文件和行范围读取源码。模型返回受约束的 JSON 页面，服务端检查 Markdown 结构、Citation、Source Ref 和 Mermaid 语法，校验通过才保存为正式页面。

如果页面校验失败，系统会带错误信息让模型修复；仍然失败就保留 Draft，不把不可靠内容当正式 Wiki。Mermaid 失败也可以单独降级，不能因为一张图失败就丢掉已经验证的正文。

这里要把能力边界说准确：当前能够验证引用确实来自允许的文件和行范围，但还不能证明文章中的每一句自然语言都被引用在语义上完全蕴含。因此更准确的说法是“引用范围可追溯”，而不是“彻底消除幻觉”。

### 五、代码变化以后怎么更新

> 增量更新会结合 Git Diff、文件 Hash、mtime 和 AST Cache 判断哪些文件能复用、哪些需要重新解析；Chunk 内容变化后，新的 content hash 会让缓存和 Embedding 知道证据已经更新。Wiki 再根据页面引用和 Dirty Plan 只重生成受影响页面，未变化页面尽量复用。

当前还不能说已经做到全链路局部更新。文件扫描和 AST 可以大量复用，但图与社区仍可能需要较大范围重算；图、向量、Wiki 和引用也没有贯穿统一不可变 Revision。多分支和历史 Commit 最稳妥的方式仍是隔离 worktree 或快照分别建索引，Dirty Workspace 必须显式标记或拒绝旧索引回答。

### 六、MCP 和 Coding Agent 怎么配合

> CodeWiki 可以把 analyze、search、graph、wiki 等能力通过 MCP 暴露给 Coding Agent。MCP 只是标准化工具协议，不是检索算法；Skill 可以进一步告诉 Agent 什么时候先读 Repo Map、什么时候查调用图、什么时候回到源码原文。真正的检索和证据仍由 CodeWiki 的 Store、GraphRAG 和 Wiki 工作流完成。

所以它和强 Coding Agent 的关系不是二选一：Agent 负责理解任务、调用工具和最终推理；CodeWiki 负责提供结构化、可追溯、可复用的仓库证据。

### 七、项目难点和收尾表达

> 这个项目最难的不是接一个模型，而是把多语言 AST 映射成统一代码事实，处理跨文件关系的不确定性，在有限 Token 下把图和源码证据组织好，并让代码变化后旧引用不会悄悄继续生效。模型可以生成失败，但没有经过引用和结构校验的内容不能直接变成正式知识。

一句话收尾可以这样说：

> CodeWiki 的核心思路是“程序先解析、检索和取证，模型再基于证据组织表达”。图负责补跨文件关系，全文和向量负责找入口，Source Ref 负责追溯，增量链路负责新鲜度；它不替代 Coding Agent，而是让 Agent 理解大型仓库时更稳定、更容易核验。
