# Metaprise (Metaprise LLC) — 深度背景调查报告

**报告日期**: 2026-06-13
**调查范围**: 公司基本信息、产品分析、技术验证、透明度评估、竞争格局、风险提示

---

## ⚠️ 前置说明：信息透明度极低

这是一份 **"高不确定性"** 报告。与本次调查的其他公司不同，Metaprise 的公开信息极度有限，存在多处不一致和警示信号。本报告将如实呈现已确认的信息和未确认的存疑点，不做过度推断。

---

## 1. 公司基本信息

| 项目 | 内容 |
|------|------|
| **公司名** | **Metaprise（Metaprise LLC）** |
| **网站** | https://metaprise.ai/ |
| **产品名称** | **Enterprise Agent Operating System** |
| **成立时间** | 推测 **2024 年**（© 2024-2026） |
| **法律实体** | **Metaprise LLC**（美国有限责任公司） |
| **总部** | 未公开（LinkedIn 显示 New York, NY） |
| **LinkedIn 粉丝** | 191 人 |
| **LinkedIn 员工** | **2-10 人**，仅 **1 人** 列出 |
| **Crunchbase** | ❌ 无收录 |
| **Wikipedia** | ❌ 无条目 |
| **Google 搜索结果** | ❌ 无独立搜索结果 |
| **GitHub** | ✅ 有开发活动（OrgKernel, 1,430 stars） |
| **公开管理层** | ❌ 无任何团队信息 |

---

## 2. 产品与服务

### 定位
**Enterprise Agent Operating System** — 企业级 AI 代理操作系统

### 核心模块
| 模块 | 说明 |
|------|------|
| **AURA Runtime** | AI agent 执行运行时，持久化状态 + 治理 |
| **Agent Store** | 代理商店，号称 5,500+ 企业级 agent |
| **Six Engines** | Truth（真实）、Audit（审计）、Compliance（合规）、Execution（执行）、Business State Machine（业务状态机）、Knowledge Graph（知识图谱） |
| **Observability** | 全链路追踪、LLM-as-judge、AI 调试 |
| **Orchestration** | 9 种架构模式、时间旅行调试、跨 Agent RPC |
| **Harness** | Agent 安全层 |
| **Model Library** | 642 个模型，40+ 提供商 |
| **Developer Platform** | Python、TypeScript、Go、Java |

### 定价模式
| 模式 | 说明 |
|------|------|
| **核心工具** | 免费（Observability, Orchestration, Governance） |
| **按次计费** | $0.45–$2.00/run（Mission 完成付费，含 token 成本） |
| **部署方式** | Cloud、Hybrid、**完全隔离（air-gapped）** |

### 目标行业
金融（JPMorgan Chase、Goldman Sachs、Morgan Stanley）、保险（Cigna、Allstate、Humana）、医疗、资本市场

---

## 3. 技术验证 — GitHub 存在

| 仓库 | 说明 | Stars | 语言 |
|------|------|-------|------|
| **MetapriseAI/OrgKernel** | AI agent 开源可信层 — 加密身份（Ed25519）、执行令牌、SHA-256 哈希链审计日志、企业 SSO/SCIM | **1,430** | Python |
| **MetapriseAI/MetapriseInc-Moose-1.0** | Moose — 面向企业组织管理的 LLM | 1 | — |

### GitHub 分析
- **OrgKernel** 有 1,430 stars，是实际的开源项目，代码可查
- 最后更新：2026 年 3 月（仍在活跃开发）
- 内容与产品描述一致（加密 agent 身份、审计链、SSO）
- ⚠️ 但这个量级的开源项目不一定能证明商业产品的成熟度

---

## 4. 重大警示信号（Red Flags）

| # | 警示 | 严重程度 | 详情 |
|---|------|---------|------|
| 1 | **LinkedIn 描述完全不同** | 🔴🔴🔴 | LinkedIn 上说 Metaprise 是 "a social platform designed specifically for startup founders"（创业者的社交平台），完全不是 Agent OS。191 粉丝、2-10 人 |
| 2 | **无任何团队/创始人信息** | 🔴🔴🔴 | 网站没有 About、Team、Company 页面。无 LinkedIn 员工信息可查 |
| 3 | **页脚包含完全无关的金融法律文本** | 🔴🔴🔴 | 页脚出现 Visa Global Services、FinCEN、MSB、Currency Cloud 等支付/汇款公司的监管信息——显然是从其他网站模板复制粘贴的 |
| 4 | **声称企业客户但零证据** | 🔴🔴🔴 | 首页展示 JPMorgan Chase、Goldman Sachs、Cigna、SAP、Morgan Stanley、Oracle 等logo，但没有案例研究、引用、采访、PR 等任何证据支撑 |
| 5 | **零新闻/媒体/公关覆盖** | 🔴🔴 | 全球主要 AI 和科技媒体均无 Metaprise 报道 |
| 6 | **核心页面全部不存在** | 🔴🔴 | Blog(404)、About(404)、Careers(404)、Docs(404)、Pricing(404) |
| 7 | **Solutions 页 403** | 🔴🔴 | solutions 页面返回 403（禁止访问），说明可能有付费墙但产品详情不可见 |
| 8 | **无合规/隐私政策页面** | 🔴🔴 | 对于声称面向受监管行业（金融、保险、医疗）的产品，无 Terms、Privacy、Compliance 页面 |

---

## 5. 竞争格局

### 直接竞品对比（来自网站自身）
| 维度 | Metaprise | LangSmith（LangChain） | Temporal |
|------|-----------|----------------------|----------|
| **Observability** | ✅ 免费 | 💰 付费附加 | ❌ 无 |
| **Execution Runtime** | ✅ AURA | ❌ | ✅ Temporal |
| **Governance** | ✅ 内置 | ❌ | ❌ |
| **Agent Marketplace** | ✅ 5,500+ agent | ❌ | ❌ |
| **定价** | 按 Mission 执行 $0.45-$2.00 | 按 Trace + seats + 部署 | 按 Action + Storage |

### 更广泛的竞争环境
| 公司 | 产品 | 赛道 |
|------|------|------|
| **LangChain** | LangSmith | Agent 开发框架 + 可观测性 |
| **CrewAI** | Multi-agent orchestration | Agent 编排 |
| **AutoGen (Microsoft)** | Agent 框架 | Agent 框架 |
| **Semantic Kernel (Microsoft)** | AI orchestration | AI 编排 |
| **Dify** | LLM 应用平台 | LLM 开发平台 |
| **Fixie.ai** | AI agent 平台 | Agent 平台 |

---

## 6. 综合评估

### 已确认的事实
- ✅ **metaprise.ai** 网站存在，产品描述详细且一致
- ✅ **GitHub 上有真实代码** — OrgKernel 项目（1,430 stars）是开源的 Agent 可信层
- ✅ 产品定位清晰：企业级 AI Agent 操作系统，对标 LangSmith + Temporal
- ✅ 页面设计精良，功能描述技术细节丰富

### 未确认/存疑的问题
- ❓ **公司身份不清晰** — LinkedIn 描述与产品完全不符
- ❓ **团队背景完全未知** — 无法验证创始人和技术团队资历
- ❓ **企业客户造假风险** — JPMorgan 等 logo 无任何证据支撑
- ❓ **产品商业化程度未知** — 无法判断产品是真正可用还是纯概念
- ❓ **页脚模板残留** — Visa/FinCEN 等金融法律文本与产品无关，暗示网站可能由模板生成

### 几种可能性

| 可能性 | 概率评估 | 依据 |
|--------|---------|------|
| **真实早期创业公司，营销急于求成** | ~40% | GitHub 代码真实，产品概念合理，但过度包装客户 logo 和页脚有模板残留 |
| **伪装成企业的个人/小型团队项目** | ~35% | 无团队信息、LinkedIn 不一致、2-10 人、无融资记录 |
| **成熟的深科技创业，刻意低调** | ~15% | GitHub 代码质量高，但极低的公开透明度与客户声称严重矛盾 |
| **概念验证/占位项目** | ~10% | 精美的 landing page + 开源项目，但无实际可用的商业产品 |

---

### ⚠️ 核心结论

Metaprise 是本次调查中 **透明度最低** 的公司。与这条街上其他公司（世界五百强级别的 Ashley Furniture、Expedia，到头部独角兽 Klook、HouseSigma）相比，Metaprise 无法提供任何可核实的团队背景、公司历史、融资记录、客户案例或公众认可证据。

**GitHub 上的 OrgKernel 项目（1,430 stars）证明这是真实的开发活动**，但产品本身（Enterprise Agent OS）是否已商业化、是否有真实的企业客户、背后的团队是谁——这些核心问题在网上完全无法回答。

**建议**：在确认其企业客户真实性或团队背景之前，将 Metaprise 视为 **"高风险的早期/未验证项目"**。其产品概念和企业级定位之间的落差，需要实质性的尽职调查来弥合。
