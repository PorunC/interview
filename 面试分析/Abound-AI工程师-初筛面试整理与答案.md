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
> Sure. I graduated about three years ago and joined [current company]. My official title has been **[fill in from HR records]**, and my work has included **[fill in the verified backend and AI application scope]**. I started working on company AI projects in **[fill in from actual project records]**, so I would not describe my entire tenure as an AI engineer unless that matches my formal role and responsibilities.
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
- 只有分阶段 RACI 和交付记录支持时，才说 "I own the architecture and lead the implementation"；否则直接说本人负责的模块和阶段，不能用更好听的英文继续扩大职责。
- 每个项目一句话讲清**设计原则**（numbers/narrative 分离、分层记忆），让面试官感到有工程思考，不是只会调 API。
- 结尾落到"为什么来 Abound"，呼应 Q1。

---

## 二、中文部分：项目角色与团队协作

> 这一段是本轮重点。面试官用一连串追问在确认一件事：**你是不是只会"一个人在小团队闷头干"，还是有正规的工程协作能力**。Abound 150 人、跨伦敦/深圳两地协作，他们要的是后者。

### Q3. 你现在做的最近的项目就是 AI weekly report？agent memory 那个也是？独立 own 是什么意思？整个组就你一个人吗？

**现场风险**：面试官连问"整个组就你一个人？""两三个人规模？""你还要拿工程师来做项目经理？"——说明你"独立 own"的表述让他理解成了"单打独斗"。**小团队 solo 开发者在 fintech 是减分项**（他们担心你不适应协作、不会写设计文档、不会对接别人）。

**参考答案**（校正表述）：
> "独立 own"我表达得不够准确，它把不同阶段的责任压成了一个词。我会按真实 RACI 重新说明，而不是先假定自己负责整个架构和所有核心技术决策。
>
> 这个项目的真实团队规模是 **[待本人按项目记录填写]**。我的角色是 **[待本人填写正式角色与责任范围]**：
> - 需求由 **[填写]** 提出，我负责 **[方案、模块或决策边界]**。
> - 我亲自实现的是 **[填写可由代码、评审或工单证明的模块]**，同事协作的是 **[填写]**。
> - 测试、排期、发布和验收分别由 **[填写]** 负责；如果没有专门 PM，就直接说实际由谁协调，不能为了显得流程正规虚构一个 PM。
>
> 所以我会把 "own" 具体拆成需求、设计、编码、联调、发布和维护六个阶段来讲。哪一阶段是我负责、参与或不负责，我都会说清楚，不用一个头衔代替事实。

**关键点**：把 "独立 own" 改成可核验的分阶段 RACI。团队人数、Tech Lead 头衔和 PM 分工只有内部记录支持时才能说。

### Q4. 你设计出来是怎么交互给同事的？中间怎么配合？

**参考答案**（体现有交付流程）：
> 我会先按这个项目真实使用的流程回答，工具、会议频率和角色都不能套模板。可核实的交付链路是：
>
> 1. **设计交付物**：实际产出是 **[详设、接口文档、流程图或原型，填写证据位置]**，其中我负责 **[填写]**。
> 2. **评审与决策**：参与人是 **[填写]**，关键分歧是 **[填写真实例子]**，最后由 **[填写实际决策人]** 决定。
> 3. **任务与接口**：使用 **[实际管理工具或方式]** 拆任务，跨模块先确认输入、输出、错误码和验收标准。
> 4. **实现与联调**：我负责 **[填写]**，通过 **[实际代码评审和联调方式]** 和同事对齐。
> 5. **发布与验收**：由 **[填写]** 执行，我承担 **[填写]**；如果本人没有生产权限，就明确说我只参与联调或验证。
>
> 我的原则是设计可追溯、接口有契约、完成标准提前确定，但面试时会用一条真实交付记录证明，而不是只背流程术语。

### Q5. 怎么监控任务进度？任务要花多长时间怎么预估？怎么标志任务完成？

**参考答案**（体现有方法论）：
> 我会分估时、进度和完成标准三块回答，但先说明实际项目使用的是 **[填写真实流程和工具]**，不会机械套“每个任务 1-3 天”“15%-20% Buffer”或 Burn-down。
>
> **时间预估**：
> - 我先把任务拆到输入、输出、依赖和验收明确，再参考 **[真实类似任务或 Spike]** 给区间。
> - 未知项先做有时间上限的验证，并把联调、评审、测试和发布算进估时。
>
> **进度监控**：
> - 我看可验收产物、关键路径、阻塞时长和返工趋势；实际同步节奏是 **[填写]**。
> - 使用过看板或 Burn-down 才说具体工具；没有用过就讲真实的里程碑、工单或周会记录。
>
> **完成标志（DoD - Definition of Done）**：
> 不是“代码写完”就算完成。这个项目的真实 DoD 是 **[填写测试、评审、联调、文档、发布或验收要求]**；不同风险任务不能套同一门禁。

**关键点**：面试官要的是可预测交付，不是术语数量。只讲真实使用过的机制，并用一条任务从估时到验收的记录证明；没用过 Burn-down、ADR 或固定 DoD 时，不要临场补造。

### Q6. 怎么知道这个项目会不会逾期？

**参考答案**：
> 我不会靠一个固定百分比判断延期，也不会默认项目一定使用 Burn-down。结合当时真实流程，我主要看几类领先信号：
>
> 1. **可验收产物偏离计划**：不是只看任务数，而是关键接口、PoC、联调和测试是否按原计划形成可验证结果。
> 2. **关键路径阻塞**：依赖的接口、权限、数据或决策迟迟没有关闭，已经开始影响后续任务。
> 3. **未知项没有收敛**：Spike 到期仍无法回答核心可行性问题，或者估时区间越来越大。
> 4. **返工和缺陷上升**：完成项反复被打回，说明表面进度不能代表真实剩余工作。
> 5. **阶段检查点连续滑动**：小里程碑开始顺延时就重新预测，不等最终 Deadline 前才暴露。
>
> 一旦识别到风险，我会带着影响范围、剩余未知和几个选项尽早同步：调整范围、改变顺序、补依赖资源或调整日期，并记录最终决策。具体预警阈值、同步节奏和谁能改范围，必须按真实项目填写。

### Q7. 谁来主导项目流程？你做完设计后，组员有更好的意见怎么办？谁来做决定？

**现场风险**：面试官连问"谁做决定"，说明他在评估你的**决策机制是否成熟**——既不能是一言堂（听不进别人），也不能是没主见（谁说了算都不清楚）。

**参考答案**：
> **流程主导**：这个项目实际由 **[待本人填写角色]** 负责排期、进度和跨团队协调；我负责 **[填写技术决策范围]**。没有专门 PM 时不能回答“PM 主导”，我会直接说真实协作方式。
>
> **意见分歧的决策**：
> 1. **先听方案**：组员提出更好的意见，我让他讲完整方案和理由——好主意我当然接受，技术决策不是争面子，谁对听谁的。
> 2. **评估维度**：拿方案对比，看几个维度——是否满足需求、实现复杂度、对现有系统的影响、可维护性、工期。不是"谁嗓门大"。
> 3. **能达成共识就共识**：大多数情况讨论完能对齐。
> 4. **共识不了，按真实决策权拍板**：最终决策人是 **[填写 Owner/负责人]**。如果我只是提案人或模块 Owner，我不会冒充整个项目的 Tech Lead；我的责任是把证据、风险和建议讲清楚并执行最终决定。
> 5. **记录决策**：用项目真实采用的设计文档、评审结论或 ADR 记录方案、理由和风险；没有使用 ADR 时不硬套这个名称。
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
1. **"独立 own"表述被反复追问**——下一轮必须带着 [事实清单](../问题/00-总览/面试前个人事实核对清单.md) 里的分阶段 RACI 回答。不要再套“Tech Lead、2-3 人、PM 管流程”模板，除非团队记录能逐项证明。
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
