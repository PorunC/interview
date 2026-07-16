# Abound · AI Engineer · 初筛面试（Screen Call）整理与答案

> **说明**：这是 Abound 第一轮 screen call，**非技术面**——面试官 Guangyang（伦敦 lead）明确说"现在不是技术面试，相当于了解一下对方、了解一下公司"。技术面试在下一轮（含 leetcode 类编码题）。
>
> 本轮考察四件事：**①英文听说能力**（要和伦敦团队 sync）、**②项目真实性与你的角色**、**③项目管理与协作方法论**、**④动机匹配**。
>
> 面试官反复追问"独立 own 是什么意思""怎么交付给同事""怎么监控进度""怎么知道会不会逾期""谁做决定"——**核心担心是：小团队出来的人能不能适应 150 人 fintech 的正规协作流程**。所以答案要体现工程方法论，不能只是"我自己干"。

---

## 0. 公司与岗位关键信息（面试官介绍，必记）

> 后续技术面/谈薪会用到，先固化下来。

| 项 | 内容 |
|----|------|
| 公司 | **Abound**，伦敦 fintech，2020 年成立 |
| 使命 | "More affordable loans for more people"——更便宜地借钱给更多人 |
| 差异化 | **不用 credit score**，用 **Open Banking** 数据 + AI 做放贷决策，更快更智能 |
| 规模 | 英国增长最快 fintech，已放贷 **20 亿英镑+**，约 **150 人** |
| 扩张 | Open banking 在更多国家上线，有**欧洲多国**扩张计划 |
| 岗位 | **AI Engineer**，跨整个业务线：automated underwriting、customer service automation、**从 web 应用转向 native AI** |
| 协作 | 伦敦 lead = Guangyang；深圳团队每周 sync 3 次（深圳下午/伦敦上午） |
| 工具 | **Claude（team plan）**，每天有 token 额度，用完会按小时恢复 |
| 地点 | 深圳宝安区，近机场，地铁宝华/宝华中心站 |

**为什么招这个岗**："The people we hire now will help us shape this direction"——现在招的人帮公司定 AI 方向，是探索性/塑造性角色，不是螺丝钉。

---

## 一、英文部分（面试官要求用英文）

### 场景说明
面试官 Guangyang 先用英文做了自我介绍 + 公司介绍，然后要求你用英文 walk through background（约 2 分钟）。并明确：**不一定要很流利，能听懂、能表达就行**——他强调自己"也不太流利"。所以英文部分的目标是**清晰、自然、信息密度够**，不是炫词汇。

### Q1. What made you apply to Abound, and what do you already know about us?

**参考答案**（自然口语版，不堆砌）：
> Two main reasons. First, the mission — "more affordable loans for more people" — I like that it's a clear social impact goal, not just another tech product. Second, the technical approach really interests me: you don't use traditional credit scores, you use **Open Banking data plus AI** to make underwriting decisions. That's exactly the kind of problem I want to work on — using AI on real data to make decisions, not just chatbots.
>
> What I know: you're a London fintech, started 2020, fastest growing in the UK, over 2 billion lent, around 150 people, and you have plans to expand across Europe as open banking launches in more countries. The role is AI engineer working across the whole business — underwriting, customer service, moving from web to native AI.

**要点**：提到 mission + open banking + AI 决策这三个关键词，证明"做过功课"。面试官回应说 "Sounds like you've done your homework"，说明这个度刚好。

### Q2. Could you walk me through your background? Maybe in two minutes.

**参考答案**（2 分钟版，结构 = 现状 → 核心项目 → 为什么来）：
> Sure. I graduated about three years ago, and since then I've been working as an AI engineer at [当前公司]. My work focuses on applied AI — building systems that use LLMs in production, not just demos.
>
> Two projects I'd highlight:
>
> **First, an AI weekly operations report system.** It is an internal operations-assurance report for our online-payment systems, not an employee activity report based on Git, Jira, or CI. A daily batch collects operational data such as error logs, long transactions, slow SQL, failed transactions, TPS, and response time. Predefined SQL and deterministic code handle completeness checks and statistics; the LLM only interprets the verified module results and turns them into the table-and-text report that is pushed through our internal messaging channel. The current system does not use free-form Text-to-SQL or a conversational RAG flow.
>
> **Second, an agent long-term memory and context management system.** It separates long-term memory from short-term tool-result offloading. The long-term path keeps raw conversations, atomic memories, scenario-level summaries, and a persona layer; retrieval combines full-text and vector candidates when the configured backend supports them. The short-term path moves large tool results to external references and keeps compact summaries and pointers in the active context, so the agent can drill back into the original evidence when needed. The current conflict flow retrieves similar candidates and asks the model to choose store, skip, update, or merge; it does not yet have a complete attribute-level conflict state machine or fact-confidence model. My verified ownership scope is **[fill in from the actual RACI and delivery evidence]**, so I would not claim that I alone handled design, testing, deployment, and operations unless the records support it.
>
> What I'm looking for next is a place where AI is core to the business, not a side feature — and where I can work on harder, real-world AI problems at scale. That's why Abound appeals to me.
>
> Outside of work, [一句话个人兴趣，可选].

**要点**：
- 用 "I own the architecture and lead the implementation" 而不是 "I did everything alone"——准确且显得有团队意识（对应后面中文追问的"独立 own"）。
- 每个项目一句话讲清**设计原则**（numbers/narrative 分离、分层记忆），让面试官感到有工程思考，不是只会调 API。
- 结尾落到"为什么来 Abound"，呼应 Q1。

---

## 二、中文部分：项目角色与团队协作

> 这一段是本轮重点。面试官用一连串追问在确认一件事：**你是不是只会"一个人在小团队闷头干"，还是有正规的工程协作能力**。Abound 150 人、跨伦敦/深圳两地协作，他们要的是后者。

### Q3. 你现在做的最近的项目就是 AI weekly report？agent memory 那个也是？独立 own 是什么意思？整个组就你一个人吗？

**现场风险**：面试官连问"整个组就你一个人？""两三个人规模？""你还要拿工程师来做项目经理？"——说明你"独立 own"的表述让他理解成了"单打独斗"。**小团队 solo 开发者在 fintech 是减分项**（他们担心你不适应协作、不会写设计文档、不会对接别人）。

**参考答案**（校正表述）：
> "独立 own"我表达得不够准确，澄清一下：**我负责的是架构设计和核心技术方案的决策，不是一个人把所有事做完**。
>
> 具体来说，我们组大概 2-3 人。我的角色是 **tech lead / 主导设计**：
> - 我做**架构设计和技术选型**，出详细设计文档。
> - 设计经过评审后，拆成任务，我和组里的同事一起实现——我做核心模块（比如记忆系统的压缩层、冲突检测），同事做配合模块（比如数据采集、接口层）。
> - 项目流程由**专门的项目经理**主导，不是我来当 PM——我专注技术，PM 跟进度和排期。
>
> 所以"own"指的是**技术决策的责任在我**，不是"组里只有我一个人干"。

**关键点**：把"独立 own"重新定义成"**技术主导 + 团队协作 + 有 PM 管流程**"，消除"单打独斗"的印象。

### Q4. 你设计出来是怎么交互给同事的？中间怎么配合？

**参考答案**（体现有交付流程）：
> 大致几步：
>
> 1. **详细设计文档**：我先把架构、模块划分、接口定义、数据模型写成文档（不是口头说）。包括关键流程图、模块职责、对外接口契约。
> 2. **设计评审**：拉组里同事 + 相关方过一遍设计，大家提问题、提建议，有分歧当场讨论定方向（下面 Q8 单独讲分歧怎么决策）。
> 3. **任务拆解**：设计定稿后拆成具体任务，每个任务有明确**输入、输出、验收标准**，录入项目管理工具（Jira/类似工具），分配到人。
> 4. **接口先行**：跨模块协作先定接口契约，各方按契约并行开发，避免互相阻塞。
> 5. **日常同步**：通过站会/周会同步进度，代码走 PR review 合并，不是直接推主干。
>
> 核心原则：**设计文档化、接口契约化、进度可视化**，让协作不依赖口头沟通。

### Q5. 怎么监控任务进度？任务要花多长时间怎么预估？怎么标志任务完成？

**参考答案**（体现有方法论）：
> 分三块：
>
> **时间预估**：
> - 拆任务时按**颗粒度对齐**——单个任务控制在 1-3 天可完成，超过 3 天的继续拆。太粗的任务估不准。
> - 预估基于**历史类似任务的实际耗时**，不是凭感觉。新类型的任务按"乐观/正常/悲观"三档估，取正常偏悲观。
> - 留 buffer：整体排期留 15-20% 余量应对突发。
>
> **进度监控**：
> - 任务状态在管理工具里流转：todo → in progress → review → done，状态可见。
> - 站会同步：每天说昨天做了什么、今天做什么、有没有阻塞。
> - 看 **burn down / 进度看板**：剩余任务 vs 剩余时间，趋势是否健康。
>
> **完成标志（DoD - Definition of Done）**：
> 不是"代码写完"就算完成，完成标准是：**代码写完 + 自测通过 + PR review 通过 + 合并主干 + 相关测试更新**。关键模块还要过验收用例。每条任务在拆的时候就把"怎么算完成"写清楚，避免最后扯皮。

**关键点**：用上"DoD""burn down""接口契约""PR review"这些正规工程术语，证明你不是野路子。

### Q6. 怎么知道这个项目会不会逾期？

**参考答案**：
> 几个信号和方法：
>
> 1. **进度趋势对比**：看 burn down，如果剩余任务曲线没在预期时间内收敛（比如时间过了一半、任务剩 60%），就是预警信号。
> 2. **关键路径监控**：识别哪些任务在关键路径上（卡住会整体延期），这些任务延期要提前预警，非关键路径的有 slack 可以缓冲。
> 3. **阻塞上报**：站会上暴露阻塞（等别人接口、等决策、技术卡点），阻塞超过 1 天就升级处理，不能闷着。
> 4. **里程碑检查点**：项目分阶段里程碑，每个里程碑有小 deadline，到点验收，而不是到最终 deadline 才发现延期。
> 5. **buffer 消耗监控**：预留的 15-20% buffer 如果提前消耗大半，说明低估了复杂度，要重新评估后续排期。
>
> 一旦识别到延期风险，**早沟通、早调整**——要么砍非核心范围、要么加资源、要么调 deadline，最忌讳的是闷头硬扛到最后一刻才说来不及。

### Q7. 谁来主导项目流程？你做完设计后，组员有更好的意见怎么办？谁来做决定？

**现场风险**：面试官连问"谁做决定"，说明他在评估你的**决策机制是否成熟**——既不能是一言堂（听不进别人），也不能是没主见（谁说了算都不清楚）。

**参考答案**：
> **流程主导**：项目经理（PM）主导项目流程——排期、进度跟踪、跨团队协调。我主导**技术决策**，不主导流程。这是分工。
>
> **意见分歧的决策**：
> 1. **先听方案**：组员提出更好的意见，我让他讲完整方案和理由——好主意我当然接受，技术决策不是争面子，谁对听谁的。
> 2. **评估维度**：拿方案对比，看几个维度——是否满足需求、实现复杂度、对现有系统的影响、可维护性、工期。不是"谁嗓门大"。
> 3. **能达成共识就共识**：大多数情况讨论完能对齐。
> 4. **共识不了，tech lead 拍板**：我是 tech lead，技术决策的最终责任在我——我会基于评估做决定，并对决定负责。**民主讨论，集中决策**。
> 5. **记录决策**：重要决策记到 ADR（Architecture Decision Record）里，写清为什么这么定、考虑过哪些方案，方便以后回溯。
>
> 核心原则：**充分听取意见，但决策权明确**——避免"讨论没完没了"或"没人敢定"两种极端。

---

## 三、反问环节

### 面试官回应要点（已整理）：
- **工具**：用 **Claude**（不是 Claude Code 单独产品，是 Claude），team plan，每天有 token 额度，用完会按小时恢复。
- **面试官自己遇到的困难**：管理任务太多太杂，挤压开发时间，自己的事容易被拖长——**需要协调和排优先级**。（这其实是个信号：Abound 的 lead 也在平衡管理和技术，节奏快、人少事多。）

### 你可以问的方向（备选，体现你有思考）：

1. **技术方向类**（呼应"native AI"）：
   > "You mentioned moving from web application to native AI — could you give an example of what that looks like in practice? Is it more like AI embedded in existing flows, or rebuilding some flows around AI?"

2. **团队协作类**（呼应跨伦敦/深圳）：
   > "How does the Shenzhen team and London team split the work? Are there areas where Shenzhen owns end-to-end, or is everything tightly coupled with London?"

3. **AI 落地现状类**（务实，了解你进去要接手什么）：
   > "What's the current state of AI at Abound right now? Is there already an AI team in place, or would I be one of the early hires building it?"

4. **评估与成长类**：
   > "For this role, what does success look like in the first 3 to 6 months?"

**注意**：面试官说"今天差不多到这里"，反问不宜太多，挑 1-2 个即可。建议问 **2（团队分工）+ 3（AI 现状）**，最务实且体现你想清楚进去要干什么。

---

## 四、面试官自己暴露的信息（值得注意）

1. **他在招能"shape direction"的人**——"The people we hire now will help us shape this direction"。意味着这不是执行岗，有一定探索性和话语权。你在后续技术面可以体现"我能做技术决策"，不是只等派活。

2. **他自己也被管理任务困扰**——"每天事情太多太杂，开发时间变少"。说明 Abound 节奏快、lead 也要兼管理和开发。如果你进去，要能**自主管理优先级**，不能等别人替你排。这也是他前面一直追问"你怎么监控进度、怎么排期"的原因——**他在找能自我管理的人**。

3. **token 额度制 Claude team plan**——说明公司对 AI 工具是支持态度，但有限额。后续技术面如果聊到用 AI 工具，可以说"用过 Claude / Cursor，理解 team plan 的额度机制"。

4. **下一轮是技术面 + leetcode 类编码题**——面试官明确提醒"多做一些 leetcode 练习，了解形式"。**下来必须刷题准备**，这是明确的下一步信号。

---

## 五、复盘：这场的得失与风险

### 风险点（下一轮前要补）：
1. **"独立 own"表述被反复追问**——暴露你对自己角色的描述不够清晰。下一轮技术面如果再被问项目角色，直接用"**tech lead，主导架构设计，和 2-3 人协作，PM 管流程**"这个框架答，别再用"独立 own"这种容易误解的词。
2. **项目管理方法论要内化**——DoD、burn down、关键路径、ADR、接口契约这些不是背术语，要能结合真实项目讲出"我当时怎么拆的、怎么估的、有没有延期、怎么处理的"。下一轮如果技术面也问协作，要有具体例子。
3. **英文要继续练**——面试官明确要和伦敦 sync。下一轮可能还有英文环节。你的英文自我介绍要练到能自然说出来，不是背稿。重点不是词汇高级，是**清晰、节奏稳、信息密度够**。

### 得分点（继续巩固）：
- 公司功课做得到位（open banking + 不用 credit score + AI 决策），面试官认可。
- 项目能讲到设计原则层面（numbers/narrative 分离、分层记忆），不是只讲"做了什么"。
- 动机匹配——"AI core to business"这个点接得上 Abound 的方向。

### 下来必做：
1. **刷 leetcode**——面试官明确点名下一轮有编码题，这是硬通货，没准备就是送命。
2. **准备 2 分钟英文自我介绍**，练到流畅。
3. **准备 1-2 个项目细节故事**（STAR 法：situation/task/action/result），下一轮技术面深挖项目用。
4. **熟悉 Abound 业务**：open banking 放贷、automated underwriting 怎么用 AI——技术面很可能问"你觉得 AI 在我们业务里能怎么用"，要有思路。
