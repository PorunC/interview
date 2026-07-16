# 金融建模、信贷风控、AML 与 SQL/Python 实操题

> **使用边界：** 这 48 道题是结合美股投研、海外金融、跨境电商融资岗位整理的知识题和下一轮高概率追问题，不是已经发生的真实面试原题。当前材料不能证明我做过财务建模、信贷模型、授信审批、KYC/AML 调查、监管报送或金融数据生产系统；没有本人证据的内容，我统一按知识理解或迁移设计回答。
>
> **回答规则：** 我会用第一人口语表达，先讲业务定义，再讲计算或系统边界。法规、阈值、名单、审批权限和报告义务会随司法辖区、产品和机构角色变化，最终必须由目标公司的财务、风险、法务和合规负责人确认。
>
> **实操环境：** Q037-Q042 使用 PostgreSQL 15+ 语法；Q043-Q048 只使用 Python 3.11+ 标准库。SQL 和代码用于面试演练，不代表处理过真实客户、贷款或可疑交易数据。

## 一、财务报表、盈利质量与估值（Q001-Q012）

### Q001：三张财务报表是怎么勾稽的？

> **口语化回答：** 我会从利润表的净利润开始讲。净利润进入现金流量表，经过折旧等非现金项目和营运资本变化，得到经营现金流；资本开支进入投资现金流，借款、还款、增发和分红进入融资现金流。三类现金流加总得到现金净变化，回到资产负债表的期末现金。利润还会通过留存收益进入权益，所以三张表不是三份独立报表，而是一套相互校验的记录。
>
> **深入追问：** 如果折旧增加且税率不变，我会先说明它降低利润和税，但本身不是现金流出，所以现金流量表要加回；同时固定资产账面净值下降。具体现金变化还要看税盾、资本开支和其他科目，不能只凭一个分录下最终结论。
>
> **易错点：** 我不会说“净利润等于现金流”，也不会忘记资产负债表必须满足资产等于负债加权益。做模型时只改利润表、不让现金和留存收益回表，是最常见的断表错误。
>
> **事实边界：** 这是财务建模知识题。我没有材料证明自己负责过公司三表模型、审计或财务关账，面试时不会把演练说成实际岗位经历。

### Q002：为什么净利润增长，经营现金流反而可能下降？

> **口语化回答：** 我会先看利润是不是还没真正收成现金。比如收入增长主要变成应收账款，或者企业为了增长提前囤库存，都会占用现金；反过来，应付账款增加会暂时释放现金。除此之外，资本化政策、一次性收益和非现金估值变动也可能抬高利润，但不形成当期经营现金流。
>
> **深入追问：** 我会把经营现金流拆成净利润、非现金调整和营运资本变化，并按收入增速一起看应收天数、库存天数、应付天数。如果应收增长长期快于收入，我会追问客户质量、账期和坏账准备，而不是只说“增长导致占款”。
>
> **易错点：** 我不会把资本开支混进经营现金流，也不会因为单季度现金流弱就直接判定造假。季节性、预付款和结算时点都可能影响短期数据，需要跨期和同业比较。
>
> **事实边界：** 我只是在说明分析框架，没有基于真实公司底稿判断过收入真实性，也没有审计权限。

### Q003：你怎么判断收入和盈利质量？

> **口语化回答：** 我不会只看收入和 EPS 增速。我会把收入与现金回款、应收、合同负债、退款、存货、毛利率和客户集中度放在一起看，再把利润里的股权激励、公允价值变动、资产处置和重组费用拆出来。我的目标不是武断地给“好或坏”，而是判断利润有多少来自可持续经营、多少依赖会计估计或一次性因素。
>
> **深入追问：** 对订阅业务，我会看递延收入、剩余履约义务、续费和获客成本；对电商，我会特别看退货、平台费用、广告投放、库存和 GMV 与净收入的口径差异。分析时还要回到脚注确认收入确认政策和总额法、净额法。
>
> **易错点：** 我不会把应收增加自动等同于虚假收入，也不会把所有 Non-GAAP 调整都视为欺骗。关键是调整是否经常发生、是否与经营实质一致、是否能和现金及脚注证据互相验证。
>
> **事实边界：** 这是面向投研产品的分析方法，不是本人给任何公司出过审计意见或投资建议。

### Q004：EBITDA、经营现金流和自由现金流有什么区别？

> **口语化回答：** 我把 EBITDA 当成剔除利息、税、折旧摊销后的经营利润近似，它既没反映营运资本占用，也没反映维持业务所需的资本开支。经营现金流补进了非现金项目和营运资本变化；自由现金流还要再扣资本开支。企业可以 EBITDA 很高，但因为应收、库存和重资产投入，真正可支配现金很少。
>
> **深入追问：** FCFF 通常站在全部资本提供者视角，常见起点是 `EBIT * (1-tax) + D&A - Capex - ΔNWC`；FCFE 站在股东视角，还要考虑利息影响和净借款。公式要和估值所用折现率一致，不能用 FCFE 配 WACC。
>
> **易错点：** 我不会把 EBITDA 叫现金流，也不会机械地用总资本开支而不区分维护和增长。现实披露往往无法精确拆分，所以假设要明示并做敏感性分析。
>
> **事实边界：** 公式是知识题口径，实际公司税率、租赁、资本化和债务分类要按其报表政策调整。

### Q005：营运资本和现金转换周期怎么分析？

> **口语化回答：** 我会重点看应收天数、库存天数和应付天数，现金转换周期通常理解为 `DSO + DIO - DPO`。周期拉长意味着更多现金被业务占用，但我要继续判断是主动备货、客户账期变化，还是库存滞销和回款恶化。对跨境电商，还要结合平台结算周期、退款、物流在途和季节性。
>
> **深入追问：** 建模时我会用收入或成本驱动应收、库存和应付，而不是让营运资本永久按固定金额增长。若业务快速增长，我会分正常扩张占款和异常效率恶化，并在压力情景里同时冲击销售、退款和回款天数。
>
> **易错点：** 我不会混淆资产负债表余额和现金流量表的期间变动，也不会忘记不同企业对交易性资产、合同资产和供应链融资的分类不同。
>
> **事实边界：** 我没有材料证明做过真实借款人的现金转换周期授信分析；这里是适用于下一轮面试的知识迁移。

### Q006：GAAP 与 Non-GAAP 指标怎么用？股权激励要不要加回？

> **口语化回答：** 我会同时保留 GAAP 原值和公司调整后的指标，再逐项检查调整理由。股权激励当期不是现金支付，但它会稀释股东，而且如果长期反复发生，就不是可以忽略的偶发成本。因此我可以在看经营现金生成时单独展示加回，也会在股权价值和每股结果里反映稀释，不能只挑对估值有利的一边。
>
> **深入追问：** 我会把重组、并购费用、减值和诉讼等项目按频率和经营相关性分类。所谓“一次性”如果年年出现，我会把它纳入正常化利润；同时核对公司定义是否跨期一致，避免 Non-GAAP 口径漂移。
>
> **易错点：** 我不会把 Non-GAAP 当成统一会计准则，也不会让 LLM 自己决定哪些项目该加回。调整表必须保留原始行、公司定义、我的判断和版本。
>
> **事实边界：** 这是分析框架，不构成会计政策结论；具体调整需要财务专业人员复核。

### Q007：ROE、ROIC 和杜邦分析分别告诉你什么？

> **口语化回答：** ROE 看股东权益产生净利润的效率，但可能被高杠杆或回购抬高；ROIC 更关注经营投入资本产生税后经营利润的能力，通常适合和 WACC 对比。杜邦分析把 ROE 拆成净利率、资产周转和权益乘数，让我知道回报来自盈利、效率还是杠杆。
>
> **深入追问：** 我会统一分子分母的期间口径，分母尽量用平均余额，并说明现金、商誉、租赁和非经营资产如何处理。真正创造价值通常要求可持续 ROIC 高于资金成本，但增长、风险和会计口径仍要一起看。
>
> **易错点：** 我不会直接跨行业比较 ROE，也不会用期末权益在大额回购后制造高回报。负权益、金融机构和重资产公司的指标解释也不同。
>
> **事实边界：** 我没有用这些指标对外发布过正式研究结论；面试时只展示计算与解释能力。

### Q008：做三表预测时，你会怎样设置驱动因素？

> **口语化回答：** 我会先把业务拆成能解释的驱动：销量、价格、客户数、ARPU 或分部收入，再推毛利率和费用率；应收、库存、应付用周转天数驱动，固定资产用期初余额、资本开支和折旧滚动，债务用到期和利率计划滚动。最后用现金或循环贷款作为平衡项，但不会用平衡项掩盖模型错误。
>
> **深入追问：** 我会建立 Base、Bull、Bear 三组有内在一致性的情景。例如销售下滑时，同时考虑库存周转变慢、退款上升、毛利承压和融资需求变化，而不是只改收入一格。每个假设要能追到历史、管理层指引或明确的分析判断。
>
> **易错点：** 我不会把所有科目都简单按收入同比增长，也不会硬编码结果。历史数据、假设、公式和输出要分层，模型要有资产负债平衡、现金滚动和符号检查。
>
> **事实边界：** 这里描述的是标准建模流程，不代表我维护过公司的预算或预测模型。

### Q009：DCF 为什么常用 FCFF？完整流程是什么？

> **口语化回答：** 我用 FCFF 时，是先预测经营业务给全部资本提供者创造的自由现金流，再用 WACC 折现。流程是明确预测期，预测收入、利润、税、营运资本和资本开支，得到每年 FCFF；然后计算终值，把显性期现金流和终值折到估值日，得到企业价值，最后通过净债务等调整得到股权价值。
>
> **深入追问：** 我会保证名义现金流配名义折现率、同一币种和同一估值时点。若中途现金流按年内产生，可以说明是否使用 Mid-year Convention；亏损、高增长或资本结构快速变化时，也要解释 DCF 的不稳定来源。
>
> **易错点：** 我不会用净利润直接当 FCFF，也不会把终值占比过高却不提示。DCF 输出依赖假设，所以我一定给敏感性和情景，而不是只报一个精确到小数点的目标价。
>
> **事实边界：** 这是估值知识题，不是投资建议，也没有真实持仓或收益可以归因给该模型。

### Q010：WACC 怎么算？Beta、无风险利率和债务成本怎么取？

> **口语化回答：** 我会把 WACC 写成权益资本成本和税后债务成本的市场价值加权。权益成本常用 CAPM，也就是无风险利率加 Beta 乘市场风险溢价；债务成本尽量用公司当前边际融资成本或可比信用利差，而不是历史票息。权重用目标或市场价值资本结构，并让币种、期限和通胀口径与现金流一致。
>
> **深入追问：** 对未上市或 Beta 不稳定的公司，我会用可比公司 Beta 去杠杆后取中位数，再按目标资本结构重新加杠杆。税盾要受可抵扣性和亏损状态约束；国家风险、小型公司溢价是否加入，要说明依据，不能为凑估值随意叠加。
>
> **易错点：** 我不会用账面权益权重代替市场价值，也不会拿美元无风险利率折人民币名义现金流。WACC 不是越精确越可信，输入的不确定性必须通过区间表达。
>
> **事实边界：** 参数选取是示范性方法；真实估值所需市场数据、评级和税务判断要由获授权数据源及专业人员确认。

### Q011：终值怎么计算？为什么 `g` 不能大于或等于 WACC？

> **口语化回答：** 永续增长法通常是 `TV = FCF_next / (WACC - g)`。如果 `g` 接近 WACC，分母很小，终值会异常敏感；如果 `g >= WACC`，模型在数学和长期经济含义上都失去合理性。另一种是退出倍数法，我会用可比公司的长期倍数，但不会拿高景气峰值倍数直接套终值。
>
> **深入追问：** 我会让终值期公司的增长、利润率、再投资和 ROIC 互相一致。例如永续增长需要再投资支持，不能同时假设高增长、零再投资和超高回报永远不变。两种终值法差异很大时，要回头检查经营假设，而不是选更好看的一个。
>
> **易错点：** 我不会忘记终值也要折现，也不会把当年 FCF 误当下一年 FCF。终值占企业价值的比例、隐含倍数和隐含增长率都要做 sanity check。
>
> **事实边界：** 这是教学公式，不能据此对任何证券给出买卖结论。

### Q012：可比公司估值、EV-to-Equity Bridge 和敏感性分析怎么做？

> **口语化回答：** 我会先选业务模式、增长、利润率和风险相近的可比公司，再根据行业选择 EV/Revenue、EV/EBITDA、P/E 或其他有经济含义的倍数。企业价值转股权价值时，我会扣净债务，并逐项处理少数股东权益、优先股、养老金、非经营资产和稀释证券。最后把倍数、WACC、增长和利润率做成敏感性区间。
>
> **深入追问：** 我会区分 LTM 和 NTM，统一会计与租赁口径，并解释高增长亏损公司为什么不能机械用 P/E。可比法反映市场相对定价，DCF反映假设下的内在现金流，两者不一致时，我会拆出增长、风险和周期差异。
>
> **易错点：** 我不会因为公司名字相似就当可比，也不会把 Enterprise Value 和 Market Cap 混用。敏感性表不是随机上下浮动，而要覆盖真正影响价值的变量和合理范围。
>
> **事实边界：** 我只把这套方法用于面试演练；可比选择、实时价格和财务数据授权都需要另行核实。

## 二、信贷标签、模型指标、定价与贷后（Q013-Q024）

### Q013：信贷模型的标签、观察窗、表现窗和样本成熟分别是什么？

> **口语化回答：** 我会先固定申请或放款时点。观察窗只使用这个时点之前能看到的数据做特征；表现窗是在之后观察客户有没有达到约定的坏样本定义，比如未来 12 个月是否出现 90+ DPD。只有表现窗已经完整走完，样本才算成熟；还没走完的客户不能因为暂时没逾期就直接标成好样本。
>
> **深入追问：** 我会把违约定义、观察单位、表现期限、治愈、重组、核销和提前结清写进 Label Spec，并保存版本。对右删失样本，可以排除、缩短统一截止日，或者使用适合的生存分析方法，但不能悄悄当作零。
>
> **易错点：** 我不会让还款结果、催收动作或放款后的账户状态进入申请时模型，也不会把申请被拒的人标成好或坏。Label Leakage 和选择偏差会让离线指标虚高。
>
> **事实边界：** 我没有材料证明定义过生产信贷标签；具体 DPD 和期限由目标公司的产品、风险政策与监管口径决定。

### Q014：DPD、Current DPD、Ever DPD 和 First Payment Default 怎么理解？

> **口语化回答：** DPD 是相对到期日逾期了多少天，但计算前必须先明确还款计划、宽限期、部分还款和时区。Current DPD 看某个观察日当前逾期状态；Ever 30 或 Ever 90 看表现窗内是否曾经达到阈值。First Payment Default 通常关注首期或早期还款就严重异常，更偏欺诈或极高风险信号，但定义不能靠名字猜。
>
> **深入追问：** 我会从合同应还、实际入账、冲正和还款分配规则重建每日状态，并保存 as-of 快照。客户后来补齐后，Current DPD 可以回到正常，但历史 Ever DPD 不应被覆盖。
>
> **易错点：** 我不会用今天的最终状态回填历史，也不会把周末、节假日和支付在途随意算进逾期。不同产品的账期和宽限规则不同，SQL前必须澄清。
>
> **事实边界：** 这里只说明指标语义，没有真实贷款合同和还款分配规则可供本人确认。

### Q015：Vintage 和 MOB 怎么看？

> **口语化回答：** Vintage 是把客户按放款月份或季度分组，再在相同账龄下比较风险表现；MOB 就是 Months on Book。比如比较每个 Vintage 在 MOB3 的 Ever 30 DPD，能把“批次差异”和“只是活得更久”分开，比直接比较累计逾期更公平。
>
> **深入追问：** 我会同时看账户口径和余额口径，明确分母是初始放款额、当前余额还是成熟账户数；还会按渠道、模型、产品和首贷复贷切片。右侧尚未成熟的三角区域要留空，不能填零。
>
> **易错点：** 我不会把自然月差简单等同完整账龄，也不会把提前结清账户随意移出分母制造更好表现。Cohort 定义、截止日和坏样本定义必须固定。
>
> **事实边界：** 我能设计 Vintage 查询，但没有本人管理真实信贷组合或解释资产质量结果的生产证据。

### Q016：Roll Rate 和迁徙矩阵解决什么问题？

> **口语化回答：** 我会在连续两个账期，把账户从 Current、1-29、30-59、60-89、90+、结清或核销等状态做迁徙矩阵。它告诉我有多少账户向更坏状态滚动、多少治愈、多少保持不变，可用于早期预警、催收资源安排和损失预测。
>
> **深入追问：** 我会同时输出账户数和期初余额加权结果，并让每个期初状态的迁徙率加总为 100%。如果产品允许重组、延期或部分核销，这些必须作为明确状态，不能强塞进 Current。
>
> **易错点：** 我不会用月内任意一天代替统一月末快照，也不会只保留两个时点都存在的账户而无声丢掉结清和核销。状态优先级要唯一，否则一笔贷款会落入多个桶。
>
> **事实边界：** 迁徙分析属于知识与实操题；催收策略和核销权限不是我的已证明职责。

### Q017：ROC-AUC、KS 和 Gini 分别看什么？

> **口语化回答：** 我把 AUC 理解成随机抽一个坏样本和一个好样本，模型把坏样本排在更高风险位置的概率；KS 是累计坏样本分布和好样本分布的最大差；在常见定义下 Gini 等于 `2*AUC-1`。它们主要看排序区分度，不直接证明概率校准准确，也不告诉我业务阈值是否赚钱。
>
> **深入追问：** 我会在独立、时间外且标签成熟的数据上算指标，给置信区间，并按产品、渠道和关键群体切片。分数方向必须先统一，高分代表高风险还是低风险会直接反转结果。
>
> **易错点：** 我不会把训练集 AUC 当上线效果，也不会看到 AUC 高就宣布模型公平或稳定。样本重复、同一客户跨集合和政策选择偏差都会污染指标。
>
> **事实边界：** 我没有可核验的生产信贷 AUC、KS 或 Gini，面试时只讲定义和评估流程。

### Q018：坏样本很少时，为什么还要看 Precision、Recall 和 PR-AUC？

> **口语化回答：** 在坏样本占比很低时，一个全预测为好客户的模型也可能有很高 Accuracy，所以我更关注坏样本 Recall、告警 Precision 和整条 Precision-Recall 曲线。PR-AUC会更直接反映我抓住多少坏样本，以及为此需要付出多少误拒或人工复核。
>
> **深入追问：** 我会基于实际 Base Rate 解读 Precision，因为坏样本比例变化会改变它；训练时可用权重或采样，但验证集必须保留真实分布。阈值最终由损失、收益和人工容量决定，不是追求 Recall 100%。
>
> **易错点：** 我不会在验证集做 SMOTE 后再报 Precision，也不会把 PR-AUC 的随机基线当成固定 0.5。训练采样后若要输出 PD，还需要回到真实总体做校准。
>
> **事实边界：** 这里是统计评测知识，不代表本人训练过公司的欺诈或信用模型。

### Q019：Brier Score 和 Calibration 为什么重要？

> **口语化回答：** 如果模型给一组客户 10% PD，我希望在口径一致、样本成熟的长期观察里大约有 10% 违约。Calibration 就是在检查概率承诺是否兑现；Brier Score 是预测概率和真实 0/1 结果的均方误差，兼顾概率准确性，但会受基础违约率影响。定价、额度和 Expected Loss 都依赖概率，所以只会排序不够。
>
> **深入追问：** 我会看可靠性曲线、分箱样本量、Calibration Intercept/Slope，并在时间外样本上验证 Platt、Isotonic 等校准。校准器也只能在训练链路内拟合，不能偷看测试集。
>
> **易错点：** 我不会因为每个分箱平均接近就忽略个体和尾部误差，也不会用尚未成熟的短期样本校准长期 PD。不同群体的同一分数也要检查是否具有相近风险含义。
>
> **事实边界：** 当前三个内部 AI 项目的准确率不能类比信贷校准；这里没有真实 PD 模型结果。

### Q020：PSI 怎么算？它能不能证明模型失效？

> **口语化回答：** 我会先在基准样本冻结分箱，再比较当前样本和基准样本在每个箱的占比，计算 `(current-reference) * ln(current/reference)` 后求和。PSI 能提示分布发生变化，但不能单独证明模型坏了；变化可能来自季节、渠道、政策或数据故障，还要结合缺失率、分数、标签和业务事件判断。
>
> **深入追问：** 我会把缺失值单独成箱，处理零占比的平滑，并按特征、分数、渠道和时间监控。阈值只能作为内部预警规则，经历史回测确定，不能把网上流传的 0.1、0.25 当普适法规。
>
> **易错点：** 我不会每个月重新分箱后再算 PSI，那会掩盖漂移；也不会把 PSI 当 Concept Drift 指标。输入分布稳定时，特征与违约关系仍可能变化。
>
> **事实边界：** 我没有材料证明运行过生产信贷 PSI 监控，具体阈值和响应流程要由模型风险团队批准。

### Q021：信贷训练集为什么要按时间切？怎么防 Point-in-time Leakage？

> **口语化回答：** 我会按申请或决策时间做训练、验证和时间外测试，保证测试发生在训练之后；同一客户的相关样本也要避免跨集合泄漏。每条特征只能来自决策时已经可见的数据，查询条件不只看业务发生时间，还要看系统实际知道时间和后续修订版本。
>
> **深入追问：** 我会给特征建立 `event_time`、`known_at` 和 source version，用 as-of join 生成训练快照；标签再等表现窗成熟。模型、分箱、缺失填充和校准器都只在训练集拟合，再原样应用到验证与测试。
>
> **易错点：** 我不会随机切分同一时期的重复申请，也不会用全量数据先算均值、分箱或标准化。催收结果、最终交易分类和供应商后来回填的数据都可能泄漏未来。
>
> **事实边界：** 这是我会采用的迁移设计，不代表现有项目已经有信贷 Feature Store。

### Q022：审批阈值怎么定？为什么不能只取 KS 最大点？

> **口语化回答：** 我会先把阈值当业务决策，不是纯统计题。每个阈值对应批准量、预期收入、资金成本、预期损失、欺诈损失、运营成本、人工容量和风险限制；我会在成熟时间外样本上算这些结果，再按风险偏好选阈值。KS 最大点只能提供排序分界参考，不能代表利润或客户公平性最优。
>
> **深入追问：** 我会把模型评分和 Policy Engine 分开：模型给风险，政策再处理硬规则、额度、渠道和人工复核。上线先做 Shadow 或 Champion/Challenger，监控批准率、分数漂移和成熟 Vintage，不允许模型自己在线改阈值。
>
> **易错点：** 我不会用同一阈值覆盖风险和收益完全不同的产品，也不会用尚未观察到坏账的新客户宣布阈值成功。阈值变化会改变后续样本分布和标签选择。
>
> **事实边界：** 我没有授信审批权，也没有本人决定过真实风险阈值；所有数值只能由目标公司授权团队确定。

### Q023：贷款怎么做风险定价？动态额度怎么确定？

> **口语化回答：** 我会把价格至少拆成资金成本、预期信用损失、欺诈与运营成本、渠道成本、资本或流动性缓冲和目标回报，再考虑期限、还款方式和客户可负担性。动态额度则基于可持续现金流、已有负债和压力情景，同时设产品与集中度上限。批准率高或利率高，都不自动等于组合更赚钱。
>
> **深入追问：** 对跨境电商，我会同时看销售、毛利、退款、库存周转、平台回款、广告支出、平台集中、币种和季节性；异常增长要由支付、物流和库存交叉验证。额度调整必须版本化、可解释，并给客户和运营稳定预期，不能随模型噪声频繁跳动。
>
> **易错点：** 我不会把 `PD*LGD*EAD` 当全部成本，也不会用历史平均坏账率覆盖不同期限与渠道。利率上升可能同时影响资金成本和客户违约，不能只改一边。
>
> **事实边界：** 这是系统和经济模型设计题，不表示我给真实客户定过价、批过额度或接触过丰泊内部模型。

### Q024：贷后监控、早期预警、催收、回收和核销怎么形成闭环？

> **口语化回答：** 我会在放款后持续看还款、余额、销售、退款、库存、平台状态和外部风险信号，把异常分成数据问题、暂时现金流压力、信用恶化和欺诈线索。预警先进入规则明确的任务队列，由运营或风险人员联系、核实并选择提醒、调整额度、重组或催收路径；结果再回写事件和标签，供组合监控和模型验证。
>
> **深入追问：** 我会按 Vintage、MOB、Roll Rate、30+/90+ DPD、回收率和净损失看组合，并区分首贷、复贷、渠道和产品。催收策略要考虑客户保护、接触频率、承诺还款、争议和困难客户，模型只能排序和提供证据，不能绕过授权自动采取高影响动作。
>
> **易错点：** 我不会把催回金额全部归因给模型，也不会让核销删除债权和历史证据。坏账、核销、出售和回收是不同状态，账务与风险口径要可对账。
>
> **事实边界：** 我没有贷后、催收或核销生产经历；具体流程、权限和客户保护要求由目标机构确认。

## 三、KYC、KYB、AML 与跨境电商融资（Q025-Q036）

### Q025：KYC 和 KYB 有什么区别？企业客户要核验什么？

> **口语化回答：** 我把 KYC 理解成识别并核实自然人客户，把 KYB 理解成核实企业主体和真实经营。企业场景除了注册名称、号码和地址，我还会核验存续状态、董事、授权签字人、所有权与控制结构、实际经营、预期交易和账户用途，并把关键自然人继续走身份核验。
>
> **深入追问：** 系统上我会把客户、企业、证件、角色、所有权关系和验证证据分开建模，每个字段保存来源、核验状态、生效期和复核时间。供应商给出的 `verified=true` 不是永久真相，原始证据、规则版本和人工处置仍要可追溯。
>
> **易错点：** 我不会把“上传过营业执照”当完成 KYB，也不会只核验法定代表人而忽略实控人。OCR 只负责提取候选字段，不能自己判定文件真实。
>
> **事实边界：** 我没有做过真实 KYC/KYB 审批，所需字段和可接受证据必须按目标司法辖区、客户类型和机构政策确定。

### Q026：CDD 和 EDD 是什么关系？什么时候做增强尽调？

> **口语化回答：** CDD 是建立客户身份、业务目的、预期活动和风险画像的基础尽调；EDD 是风险更高时增加证据和审查深度，不是对所有客户一刀切。触发可能来自客户、地域、产品、所有权复杂度、PEP、异常交易或信息不一致，但具体规则必须由合规政策定义。
>
> **深入追问：** 我会让风险引擎输出“触发因素和所需动作”，例如补充资金来源、财富来源、合同、发票或管理层批准，再由 Case 工作流跟踪完成。风险变化后可以升级或降级，但每次决定都保留版本和依据。
>
> **易错点：** 我不会让 LLM凭一段描述给客户贴“高风险”标签，也不会把 EDD 等同拒绝客户。更严格的尽调仍要遵循最小化、权限和客户沟通要求。
>
> **事实边界：** 触发阈值、审批层级和资料清单不是通用答案，我只讲工程实现和治理思路。

### Q027：UBO 怎么识别？复杂持股、循环持股和控制权怎么处理？

> **口语化回答：** 我会把企业和自然人建成带时间版本的所有权与控制关系图，从客户企业向上穿透，累计直接和间接权益，同时单独记录投票权、协议控制和高级管理控制。达到政策阈值只是候选 UBO 的一种路径；循环持股、代持、信托和信息缺失要进入人工调查，不能让算法硬猜。
>
> **深入追问：** 每条边要保存比例、关系类型、有效期、来源和验证状态。图遍历要有 visited 防环，比例传播要避免重复路径双算；最终输出不只是名字，还包括穿透路径和哪些证据尚未闭环。
>
> **易错点：** 我不会把“最大股东”自动当唯一 UBO，也不会假设所有地区使用同一比例阈值。企业后来变更股权时不能覆盖历史，因为过去筛查和决定需要按当时结构回放。
>
> **事实边界：** 我没有实际认定过 UBO；法律上的所有权与控制判断必须由合规或法务确认。

### Q028：制裁、PEP 和负面新闻筛查分别解决什么问题？

> **口语化回答：** 我会把三者分开：制裁筛查看客户或相关方是否与适用名单匹配；PEP 识别因职务带来更高腐败风险、需要相应风险措施的人；负面新闻提供涉嫌犯罪、欺诈或声誉风险线索。命中都只是候选信号，处置要结合身份属性、名单类型、关系和政策，不能靠姓名相同直接定性。
>
> **深入追问：** 我会保存名单提供方、版本、发布日期、系统获取时间、命中字段和处置结果。开户时筛一次不够，名单、客户资料和关系都会变化，所以需要持续重筛和影响分析。
>
> **易错点：** 我不会把 PEP 直接当犯罪者，也不会把搜索引擎文章当已核实事实。不同名单适用范围和义务不同，不能合成一个万能黑名单。
>
> **事实边界：** 我没有名单命中处置或法律判断权限，具体适用名单、冻结或报告动作必须由授权人员决定。

### Q029：姓名筛查怎么降低误报，同时避免漏报？

> **口语化回答：** 我会先做 Unicode 归一、大小写、标点、空格、姓名顺序、别名和音译处理，再用精确、Token、编辑距离和语音等候选策略召回；之后结合生日、国籍、证件、地址和关联实体做身份消歧。高相似度只决定调查优先级，不能直接自动宣告同一个人。
>
> **深入追问：** 我会按语言和名单类型建立标注集，分别评 Recall、Precision、候选量和调查工作量；阈值按风险分层。每次算法或名单版本变更要离线回放，并保留旧结果，防止升级后无法解释历史决定。
>
> **易错点：** 我不会简单删除所有短词或停用词，因为短姓名可能很重要；也不会只用一个 Levenshtein 阈值覆盖中文、阿拉伯文和拉丁文。缺少辅助属性时应提高人工审查，而不是假装确定。
>
> **事实边界：** 本题是匹配系统设计，不代表本人拥有制裁数据或测得真实误报率。

### Q030：交易监控系统端到端怎么设计？

> **口语化回答：** 我会把链路拆成交易标准化、客户与账户画像、规则/模型检测、Alert 去重聚合、Case 调查、处置与反馈。检测既看单笔，也看滑动窗口、对手方、地域、设备和资金路径；Alert 要带触发规则、特征快照和原始交易引用，调查员才能复核。
>
> **深入追问：** 流式链路要按 event_id 幂等，区分 event_time 和 processing_time，处理迟到、冲正和补数。规则版本、生效时间和名单版本必须随 Alert 保存；重大规则变更先 Shadow，再比较覆盖、告警量和调查产出。
>
> **易错点：** 我不会把金额超过一个阈值直接等同洗钱，也不会让每条规则各自产生大量重复 Case。告警合并要保持证据完整，重试也不能重复通知或重复建案。
>
> **事实边界：** 具体监控场景、阈值和处置义务属于机构内部敏感政策，我只提供技术架构，不声称做过生产 AML 监控。

### Q031：AML 告警应该看哪些指标？为什么 Accuracy 没意义？

> **口语化回答：** 可疑交易通常极少，绝大多数交易都是正常的，所以 Accuracy 很容易虚高。我会分层看场景覆盖、Alert 数、客户数、重复率、调查 Precision、已知高风险 Recall、单案调查时长、积压、升级率和最终处置，并同时评估潜在漏报伤害，不能只优化“少出告警”。
>
> **深入追问：** AML 真值不完整：未被调查的不代表正常，历史案件又受旧规则和调查能力影响。我会用已确认案件、合成 Typology、回溯抽样和专家 Review 组合评测，并明确每类标签的可信等级。
>
> **易错点：** 我不会把提交报告数量当模型准确率，也不会因为误报多就盲目抬阈值。调查产能、客户风险和规则覆盖变化都会影响表面指标。
>
> **事实边界：** 我没有真实 SAR/STR、案件或调查标签；报告名称、门槛和流程必须按目标地区确认。

### Q032：图分析怎么用于 AML？

> **口语化回答：** 我会把客户、账户、企业、UBO、设备、地址、电话和交易建成带时间的异构图，寻找共享设备、多跳资金快速转移、环形路径、星型归集、密集团伙和新账户突然连接高风险节点。图信号适合发现单账户规则看不到的关系，但输出仍是调查线索，不是定罪。
>
> **深入追问：** 我会区分静态身份关系和有金额、方向、时间的交易边，按时间窗口构图；候选社区要附关键路径、金额和基线对比。大图上可用分区、增量邻接和限制跳数控制成本，高风险结果再进入离线深挖。
>
> **易错点：** 我不会因为两个客户共享 IP 就认定关联，也不会忽略公司办公室、家庭和公共网络造成的正常共享。图特征也可能泄漏未来关系，训练时必须按 as-of 截断。
>
> **事实边界：** CodeWiki 的图谱经验只能迁移图建模方法，不能证明本人做过金融犯罪图分析。

### Q033：Alert、Case、人工调查和 SAR/STR 之间是什么关系？

> **口语化回答：** Alert 是系统发现的单个或一组异常信号；Case 是把相关 Alert、客户、交易和证据聚合后交给调查员的工作对象。调查员记录核验步骤、证据和结论，是否升级、限制业务或提交何种报告，由有权限的合规人员按政策决定。LLM 可以整理时间线和草拟摘要，但不能替人做法律结论或自动提交。
>
> **深入追问：** Case 系统要有明确状态机、角色权限、SLA、任务分派、四眼复核、不可变审计和关联案件查询。模型建议、人工修改和最终决定分别保存，报告内容只能引用经过授权的真实证据。
>
> **易错点：** 我不会让“关闭 Case”删除 Alert，也不会把无报告结论理解为交易一定正常。避免把完整敏感调查内容写进普通应用日志或发送给未经批准的模型服务。
>
> **事实边界：** 我没有调查、报送或客户限制权限；这里严格是 Case Management 系统设计。

### Q034：持续监控、定期复核和名单版本回放怎么做？

> **口语化回答：** 我会把客户风险看成随时间变化的状态。证件到期、UBO 变化、业务模式变化、名单更新或交易行为偏离，都能触发事件驱动复核；另外按风险等级做周期复核。名单更新后，我会记录新版本差异，只重筛受影响实体，同时保留按旧版本做出的历史结果。
>
> **深入追问：** 回放要区分“当时按旧名单是否正确”和“今天新名单是否要求采取新动作”。数据模型至少保存名单 `effective_at`、系统 `known_at`、筛查时间和匹配器版本，避免用今天信息穿越解释过去。
>
> **易错点：** 我不会原地覆盖客户风险评级，也不会每次名单更新都无差别扫描全量、造成重复 Case。缓存键和筛查结果必须包含版本，撤销或更正也要能传播。
>
> **事实边界：** 复核频率、名单更新后的义务和客户通知方式由合规政策决定，不是我个人设定。

### Q035：跨境电商融资里，信用风险、欺诈和 Trade-Based Money Laundering 怎么区分？

> **口语化回答：** 信用风险更关心真实生意是否有能力还款；欺诈可能是虚假身份、刷单、假订单或骗贷；贸易型洗钱则可能利用虚假贸易背景、价格或数量异常转移价值。三者会重叠，所以我会把商流、物流、金流和合同、发票、平台记录交叉验证，并分别进入风险、反欺诈和 AML 的处置链路。
>
> **深入追问：** 我会检查订单、发货、签收、退款和平台回款是否能按时间与金额闭环，关注关联方循环交易、异常整数价格、商品与经营范围不符、同一物流凭证复用和资金快速转出。模型给异常分，证据工具展示不一致，最终由相应专业团队判断。
>
> **易错点：** 我不会因为价格偏离平均就直接定性洗钱，也不会假设平台数据天然真实。促销、季节、汇率、运费和商品差异都可能解释异常。
>
> **事实边界：** 我没有调查跨境贸易洗钱或真实骗贷案件；这些是结合目标公司业务推导的高概率追问，不是丰泊真实面试原题。

### Q036：设计跨境电商融资的动态额度和借款基础系统，你会怎么拆？

> **口语化回答：** 我会先接入客户授权的电商、支付、物流、库存和银行数据，原始事件不可变留存；标准化层做实体、订单、退款、库存和回款对账。风险层计算可持续销售、毛利、集中度、库存可变现性和异常信号；Policy Engine 再按产品规则、合格资产、Advance Rate、已有敞口和压力情景生成额度建议，人工或授权流程最终确认。
>
> **深入追问：** 一次提款我会冻结数据快照、特征版本、模型、政策和额度版本，检查总额度与可用额度，再用幂等账本记账。数据迟到或平台中断时按预先批准的降级策略转人工、保持旧额度或限制新提款；不能让缺失值自动变成低风险。贷后持续对账，退款、库存跌价、平台封店或资金方资产资格变化触发预警和重新评估。
>
> **易错点：** 我不会把 GMV 当收入或可还款现金，也不会把累计放款、当前余额和机构资金额度混为一谈。额度模型、贷款审批和资金方资产合格性是三层不同约束。
>
> **事实边界：** 这是结合公开业务信息设计的下一轮高概率系统题，不代表我接触过丰泊内部数据、资金条款、模型或审批链路。

## 四、PostgreSQL 完整实操（Q037-Q042）

### Q037：按放款月份和 MOB 计算 Ever 30 DPD Vintage 矩阵

> **口语化回答：** 我会先确认 Cohort 用放款月，MOB0 是放款所在月，坏样本是截至目标月末曾达到 30 DPD。查询只展示截止日已经成熟的格子，并同时给账户口径和初始本金口径；没有状态快照的贷款不会被默认为好客户。

```sql
-- PostgreSQL 15+
CREATE TEMP TABLE q37_loans (
    loan_id BIGINT PRIMARY KEY,
    origination_date DATE NOT NULL,
    original_principal NUMERIC(18, 2) NOT NULL CHECK (original_principal > 0)
);

CREATE TEMP TABLE q37_daily_status (
    loan_id BIGINT NOT NULL REFERENCES q37_loans(loan_id),
    as_of_date DATE NOT NULL,
    dpd INTEGER NOT NULL CHECK (dpd >= 0),
    outstanding NUMERIC(18, 2) NOT NULL CHECK (outstanding >= 0),
    PRIMARY KEY (loan_id, as_of_date)
);

INSERT INTO q37_loans VALUES
    (1, DATE '2025-01-10', 1000),
    (2, DATE '2025-01-20', 2000),
    (3, DATE '2025-02-05', 1500),
    (4, DATE '2025-03-01',  900);

INSERT INTO q37_daily_status VALUES
    (1, DATE '2025-01-31',  0, 1000),
    (1, DATE '2025-02-28',  0,  900),
    (1, DATE '2025-03-31', 35,  800),
    (1, DATE '2025-04-30',  0,  700),
    (2, DATE '2025-01-31',  0, 2000),
    (2, DATE '2025-02-28', 10, 1900),
    (2, DATE '2025-03-31', 40, 1800),
    (2, DATE '2025-04-30', 70, 1700),
    (3, DATE '2025-02-28',  0, 1500),
    (3, DATE '2025-03-31',  0, 1400),
    (3, DATE '2025-04-30', 20, 1300),
    (3, DATE '2025-05-31', 35, 1200),
    (4, DATE '2025-03-31',  0,  900),
    (4, DATE '2025-04-30',  0,  800),
    (4, DATE '2025-05-31',  0,  700);

WITH params AS (
    SELECT DATE '2025-05-31' AS cutoff_date, 3 AS max_mob
),
loan_mob AS (
    SELECT
        l.loan_id,
        date_trunc('month', l.origination_date)::date AS vintage_month,
        l.original_principal,
        m.mob,
        (
            date_trunc('month', l.origination_date)::date
            + make_interval(months => m.mob + 1)
            - INTERVAL '1 day'
        )::date AS target_month_end
    FROM q37_loans l
    CROSS JOIN params p
    CROSS JOIN LATERAL generate_series(0, p.max_mob) AS m(mob)
),
per_loan AS (
    SELECT
        lm.*,
        COUNT(s.as_of_date) AS observed_snapshots,
        COALESCE(MAX(s.dpd), 0) >= 30 AS ever_30
    FROM loan_mob lm
    CROSS JOIN params p
    LEFT JOIN q37_daily_status s
      ON s.loan_id = lm.loan_id
     AND s.as_of_date >= lm.vintage_month
     AND s.as_of_date <= lm.target_month_end
    WHERE lm.target_month_end <= p.cutoff_date
    GROUP BY lm.loan_id, lm.vintage_month, lm.original_principal,
             lm.mob, lm.target_month_end
)
SELECT
    vintage_month,
    mob,
    COUNT(*) FILTER (WHERE observed_snapshots > 0) AS observed_loans,
    COUNT(*) FILTER (WHERE observed_snapshots > 0 AND ever_30) AS ever_30_loans,
    ROUND(
        COUNT(*) FILTER (WHERE observed_snapshots > 0 AND ever_30)::numeric
        / NULLIF(COUNT(*) FILTER (WHERE observed_snapshots > 0), 0),
        4
    ) AS account_bad_rate,
    ROUND(
        SUM(original_principal) FILTER (WHERE observed_snapshots > 0 AND ever_30)
        / NULLIF(SUM(original_principal) FILTER (WHERE observed_snapshots > 0), 0),
        4
    ) AS exposure_bad_rate
FROM per_loan
GROUP BY vintage_month, mob
ORDER BY vintage_month, mob;

-- 样例检查：2025-01 的 MOB2 为 2/2，account_bad_rate = 1.0000；
-- 2025-02 的 MOB3 为 1/1；2025-03 不会产生尚未成熟的 MOB3。
```

> **深入追问：** 我会在生产版增加快照完整性字段；如果目标月末应该有快照却缺失，就单独报 Coverage Error，而不是仅靠 `observed_snapshots > 0`。若数据只有每日快照，我会先归一成合同口径的月末状态。
>
> **易错点：** 我不会让右侧未成熟格子显示 0%，也不会用当前余额作为唯一分母后忽略已经核销或结清的账户。示例里的 MOB 是日历月口径，真实产品要确认完整账龄定义。
>
> **事实边界：** SQL使用虚构数据。按索引 `(loan_id, as_of_date)`，核心扫描约为每个贷款-MOB读取其历史快照；大表应预计算月末快照和累计最大 DPD，避免重复扫描。

### Q038：用月末快照计算 Roll Rate 迁徙矩阵

> **口语化回答：** 我会先把每笔贷款在统一月末映射到唯一 DPD 桶，再用 `LAG` 找上一期状态。分母按上一期状态分组，同时输出账户数和上一期余额加权迁徙率，这样既看客户数量，也看风险敞口。

```sql
CREATE TEMP TABLE q38_month_end_status (
    loan_id BIGINT NOT NULL,
    month_end DATE NOT NULL,
    dpd INTEGER NOT NULL CHECK (dpd >= 0),
    outstanding NUMERIC(18, 2) NOT NULL CHECK (outstanding >= 0),
    PRIMARY KEY (loan_id, month_end)
);

INSERT INTO q38_month_end_status VALUES
    (1, DATE '2025-01-31',  0, 1000),
    (1, DATE '2025-02-28', 35,  900),
    (2, DATE '2025-01-31',  0, 2000),
    (2, DATE '2025-02-28',  0, 1900),
    (3, DATE '2025-01-31', 40, 1500),
    (3, DATE '2025-02-28', 65, 1400),
    (4, DATE '2025-01-31', 45,  500),
    (4, DATE '2025-02-28',  0,  450);

WITH bucketed AS (
    SELECT
        *,
        CASE
            WHEN outstanding = 0 THEN 'CLOSED'
            WHEN dpd = 0 THEN 'CURRENT'
            WHEN dpd < 30 THEN '01-29'
            WHEN dpd < 60 THEN '30-59'
            WHEN dpd < 90 THEN '60-89'
            ELSE '90+'
        END AS state
    FROM q38_month_end_status
),
paired AS (
    SELECT
        loan_id,
        month_end AS to_month,
        LAG(state) OVER (PARTITION BY loan_id ORDER BY month_end) AS from_state,
        state AS to_state,
        LAG(outstanding) OVER (PARTITION BY loan_id ORDER BY month_end) AS from_balance
    FROM bucketed
),
aggregated AS (
    SELECT
        to_month,
        from_state,
        to_state,
        COUNT(*) AS account_count,
        SUM(from_balance) AS from_balance
    FROM paired
    WHERE from_state IS NOT NULL
    GROUP BY to_month, from_state, to_state
)
SELECT
    to_month,
    from_state,
    to_state,
    account_count,
    ROUND(
        account_count::numeric
        / SUM(account_count) OVER (PARTITION BY to_month, from_state), 4
    ) AS account_roll_rate,
    from_balance,
    ROUND(
        from_balance
        / NULLIF(SUM(from_balance) OVER (PARTITION BY to_month, from_state), 0), 4
    ) AS balance_roll_rate
FROM aggregated
ORDER BY to_month, from_state, to_state;

-- 样例检查：CURRENT -> CURRENT 和 CURRENT -> 30-59 各占 50%账户；
-- 余额口径分别为 2000/3000 和 1000/3000。
```

> **深入追问：** 如果贷款中途结清或核销，我会要求数据源仍产出显式 `CLOSED`、`CHARGED_OFF` 状态，避免窗口函数把消失账户无声丢掉。跨多月缺快照时应先构造完整月份骨架并标记缺失。
>
> **易错点：** 我不会把 30 DPD 账户后来回正当成历史从未逾期，也不会让一笔贷款同时落多个桶。月末定义、宽限期和状态优先级必须固定。
>
> **事实边界：** 示例仅演示两个月。排序窗口在每个贷款上约为 `O(n log n)`；生产表需要 `(loan_id, month_end)` 唯一键并按月份分区或裁剪。

### Q039：按模型版本统计申请漏斗和成熟坏账率

> **口语化回答：** 我会把申请、自动批准、人工复核、放款和成熟坏账分别计数，每个比率写清分母。坏账率只在已经走完表现窗的放款中计算；新模型即使批准率很好，只要标签还没成熟，我也不会宣称风险更低。

```sql
CREATE TEMP TABLE q39_applications (
    application_id BIGINT PRIMARY KEY,
    submitted_at TIMESTAMPTZ NOT NULL,
    model_version TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'REVIEW', 'REJECT'))
);

CREATE TEMP TABLE q39_loans (
    loan_id BIGINT PRIMARY KEY,
    application_id BIGINT UNIQUE NOT NULL REFERENCES q39_applications(application_id),
    disbursed_at TIMESTAMPTZ NOT NULL,
    principal NUMERIC(18, 2) NOT NULL
);

CREATE TEMP TABLE q39_status (
    loan_id BIGINT NOT NULL REFERENCES q39_loans(loan_id),
    as_of_date DATE NOT NULL,
    dpd INTEGER NOT NULL,
    PRIMARY KEY (loan_id, as_of_date)
);

INSERT INTO q39_applications VALUES
    (1, '2025-01-01 00:00+00', 'v1', 'APPROVE'),
    (2, '2025-02-01 00:00+00', 'v1', 'APPROVE'),
    (3, '2025-03-01 00:00+00', 'v1', 'REJECT'),
    (4, '2025-12-01 00:00+00', 'v1', 'REVIEW'),
    (5, '2025-01-15 00:00+00', 'v2', 'APPROVE'),
    (6, '2025-02-15 00:00+00', 'v2', 'REJECT');

INSERT INTO q39_loans VALUES
    (101, 1, '2025-01-02 00:00+00', 1000),
    (102, 2, '2025-02-02 00:00+00', 2000),
    (104, 4, '2025-12-02 00:00+00',  500),
    (105, 5, '2025-01-16 00:00+00', 1200);

INSERT INTO q39_status VALUES
    (101, DATE '2025-03-31', 95),
    (101, DATE '2025-07-01',  0),
    (102, DATE '2025-08-01',  0),
    (104, DATE '2025-12-31',  0),
    (105, DATE '2025-07-15', 10);

WITH params AS (
    SELECT DATE '2026-01-31' AS cutoff_date, 180 AS performance_days
),
per_application AS (
    SELECT
        a.*,
        l.loan_id,
        l.disbursed_at,
        (
            l.loan_id IS NOT NULL
            AND l.disbursed_at::date + p.performance_days <= p.cutoff_date
        ) AS is_mature,
        (
            SELECT MAX(s.as_of_date) >= l.disbursed_at::date + p.performance_days
            FROM q39_status s
            WHERE s.loan_id = l.loan_id
              AND s.as_of_date BETWEEN l.disbursed_at::date
                                   AND l.disbursed_at::date + p.performance_days
        ) AS has_label_coverage,
        (
            SELECT MAX(s.dpd) >= 90
            FROM q39_status s
            WHERE s.loan_id = l.loan_id
              AND s.as_of_date BETWEEN l.disbursed_at::date
                                   AND l.disbursed_at::date + p.performance_days
        ) AS ever_90
    FROM q39_applications a
    CROSS JOIN params p
    LEFT JOIN q39_loans l ON l.application_id = a.application_id
    WHERE a.submitted_at::date <= p.cutoff_date
)
SELECT
    model_version,
    COUNT(*) AS applications,
    COUNT(*) FILTER (WHERE decision = 'APPROVE') AS auto_approved,
    COUNT(*) FILTER (WHERE decision = 'REVIEW') AS sent_to_review,
    COUNT(*) FILTER (WHERE decision = 'REJECT') AS rejected,
    COUNT(*) FILTER (WHERE loan_id IS NOT NULL) AS booked,
    COUNT(*) FILTER (WHERE is_mature) AS mature_booked,
    COUNT(*) FILTER (
        WHERE is_mature AND has_label_coverage IS TRUE
    ) AS mature_with_label,
    COUNT(*) FILTER (
        WHERE is_mature AND has_label_coverage IS TRUE AND ever_90 IS TRUE
    ) AS mature_ever_90,
    ROUND(
        COUNT(*) FILTER (WHERE decision = 'APPROVE')::numeric / COUNT(*), 4
    ) AS auto_approval_rate,
    ROUND(
        COUNT(*) FILTER (WHERE loan_id IS NOT NULL)::numeric / COUNT(*), 4
    ) AS booking_per_application,
    ROUND(
        COUNT(*) FILTER (
            WHERE is_mature AND has_label_coverage IS TRUE AND ever_90 IS TRUE
        )::numeric
        / NULLIF(COUNT(*) FILTER (
            WHERE is_mature AND has_label_coverage IS TRUE
        ), 0), 4
    ) AS mature_bad_rate
FROM per_application
GROUP BY model_version
ORDER BY model_version;

-- 样例检查：v1 applications=4、booked=3、mature_booked=2、
-- mature_with_label=2、mature_ever_90=1、mature_bad_rate=0.5000；
-- 12月新贷款不进成熟分母，没有覆盖到表现窗末日的贷款不进坏账率分母。
```

> **深入追问：** 我会再按申请月、渠道、产品和首贷复贷切片，并给样本量和置信区间。人工复核后放款不能悄悄算作自动批准，策略版本和模型版本也要分别保存。
>
> **易错点：** 我不会用申请数做坏账率分母，也不会把拒绝客户或缺失状态的客户当好客户。示例用“状态至少覆盖到表现窗末日”做最低完整性门槛；生产版还要从完整还款计划重建 Ever 90，并监控表现窗内的缺失日期和数据源断档。
>
> **事实边界：** 数据完全虚构。相关子查询依赖 `q39_status(loan_id, as_of_date)`；大规模计算应物化贷款表现标签，而不是每次扫描全历史。

### Q040：按申请时点生成 30/90 天交易特征，防止未来泄漏

> **口语化回答：** 我会同时约束交易发生时间和系统知道时间：只有 `event_time < submitted_at` 且 `known_at <= submitted_at` 的记录能进入特征。这样可以排除申请后的交易，也能排除虽然业务上较早、但后来才补传或修订的数据。

```sql
CREATE TEMP TABLE q40_applications (
    application_id BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL
);

CREATE TEMP TABLE q40_transactions (
    event_id BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    known_at TIMESTAMPTZ NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('INCOME', 'REFUND', 'OTHER')),
    amount NUMERIC(18, 2) NOT NULL
);

INSERT INTO q40_applications VALUES
    (101, 7, '2025-04-01 12:00+00'),
    (102, 7, '2025-04-03 12:00+00');

INSERT INTO q40_transactions VALUES
    (1, 7, '2025-03-20 09:00+00', '2025-03-20 09:01+00', 'INCOME', 1000),
    (2, 7, '2025-03-25 09:00+00', '2025-04-02 08:00+00', 'INCOME',  500),
    (3, 7, '2025-04-01 13:00+00', '2025-04-01 13:01+00', 'INCOME',  700),
    (4, 7, '2025-02-01 10:00+00', '2025-02-01 10:01+00', 'REFUND', -100);

SELECT
    a.application_id,
    a.submitted_at,
    COALESCE(f.income_30d, 0) AS income_30d,
    COALESCE(f.income_90d, 0) AS income_90d,
    COALESCE(f.refund_90d, 0) AS refund_90d,
    COALESCE(f.visible_tx_count_90d, 0) AS visible_tx_count_90d
FROM q40_applications a
LEFT JOIN LATERAL (
    SELECT
        SUM(t.amount) FILTER (
            WHERE t.category = 'INCOME'
              AND t.event_time >= a.submitted_at - INTERVAL '30 days'
        ) AS income_30d,
        SUM(t.amount) FILTER (WHERE t.category = 'INCOME') AS income_90d,
        SUM(ABS(t.amount)) FILTER (WHERE t.category = 'REFUND') AS refund_90d,
        COUNT(*) AS visible_tx_count_90d
    FROM q40_transactions t
    WHERE t.customer_id = a.customer_id
      AND t.event_time >= a.submitted_at - INTERVAL '90 days'
      AND t.event_time < a.submitted_at
      AND t.known_at <= a.submitted_at
) f ON true
ORDER BY a.application_id;

-- 样例检查：申请101看不到迟到的event 2和申请后的event 3；
-- income_30d=1000、income_90d=1000、refund_90d=100、count=2。
```

> **深入追问：** 如果同一事件会修订，我会把版本建成 append-only，并在申请时点选择当时已知的最新版本，而不是把多个版本都求和。时区、冲正、账户授权范围和数据缺口也要进入特征快照。
>
> **易错点：** 我不会只限制 `event_time`，也不会用今天清洗后的 Merchant Category 回填过去。`BETWEEN` 的双闭区间可能把申请时刻事件误纳入，所以这里显式使用 `< submitted_at`。
>
> **事实边界：** 索引建议为 `(customer_id, event_time)` 并包含 `known_at`；LATERAL 适合面试表达，大批量离线训练应使用时点化特征表或高效 as-of pipeline。

### Q041：识别 24 小时内多笔阈值下入账的候选拆分交易

> **口语化回答：** 我会把阈值作为参数，用每笔交易作窗口右端，统计过去 24 小时同账户、单笔低于阈值的入账总额、笔数和不同对手方。达到条件只生成调查候选，不直接给客户定性；后续还要结合正常业务基线和客户风险。

```sql
CREATE TEMP TABLE q41_transactions (
    event_id BIGINT PRIMARY KEY,
    account_id TEXT NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    counterparty_id TEXT NOT NULL
);

INSERT INTO q41_transactions VALUES
    (1, 'A', '2025-01-01 09:00+00', 'IN', 4000, 'CP1'),
    (2, 'A', '2025-01-01 13:00+00', 'IN', 3500, 'CP2'),
    (3, 'A', '2025-01-02 08:00+00', 'IN', 3000, 'CP3'),
    (4, 'B', '2025-01-01 10:00+00', 'IN', 12000, 'CP9'),
    (5, 'C', '2025-01-01 08:00+00', 'IN', 4000, 'CP1'),
    (6, 'C', '2025-01-03 09:00+00', 'IN', 4000, 'CP2');

WITH params AS (
    -- 这里只是虚构面试参数，不代表任何地区法定门槛。
    SELECT 10000::numeric AS amount_threshold,
           3::integer AS min_count,
           2::integer AS min_counterparties
),
window_features AS (
    SELECT
        anchor.event_id AS anchor_event_id,
        anchor.account_id,
        anchor.event_time AS window_end,
        f.window_start,
        f.tx_count,
        f.distinct_counterparties,
        f.total_amount
    FROM q41_transactions anchor
    CROSS JOIN params p
    CROSS JOIN LATERAL (
        SELECT
            MIN(t.event_time) AS window_start,
            COUNT(*) AS tx_count,
            COUNT(DISTINCT t.counterparty_id) AS distinct_counterparties,
            SUM(t.amount) AS total_amount
        FROM q41_transactions t
        WHERE t.account_id = anchor.account_id
          AND t.direction = 'IN'
          AND t.amount < p.amount_threshold
          AND t.event_time > anchor.event_time - INTERVAL '24 hours'
          AND t.event_time <= anchor.event_time
    ) f
    WHERE anchor.direction = 'IN'
      AND anchor.amount < p.amount_threshold
      AND f.tx_count >= p.min_count
      AND f.distinct_counterparties >= p.min_counterparties
      AND f.total_amount >= p.amount_threshold
)
SELECT *
FROM window_features
ORDER BY account_id, window_end;

-- 样例检查：只返回账户A、anchor_event_id=3、total_amount=10500。
```

> **深入追问：** 生产版会对连续命中的窗口做 Episode 聚合，避免每个新事件都重复建案；迟到和冲正事件要触发受控重算。客户画像还应提供历史正常交易范围，减少季节性收款商户的误报。
>
> **易错点：** 我不会把示例 10000 当监管阈值，也不会把一笔正常大额拆成多笔的技术现象直接说成规避申报。查询只筛入账，真实场景还要看出账、现金、渠道和关系图。
>
> **事实边界：** 相关范围扫描需要索引 `(account_id, event_time)`；最坏情况下窗口内交易很多，单个锚点成本与窗口记录数成正比，流式生产更适合维护有界状态。

### Q042：按筛查时点选择当时可见的名单版本

> **口语化回答：** 我会同时限制名单的业务生效时间和系统知道时间，再选择筛查时点前最新版本。这样 2 月新增的名字不会被穿越回 1 月的历史筛查；历史回放能回答“当时按已知名单是否处理正确”。

```sql
CREATE TEMP TABLE q42_watchlist_versions (
    version_id BIGINT PRIMARY KEY,
    list_name TEXT NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    known_at TIMESTAMPTZ NOT NULL
);

CREATE TEMP TABLE q42_watchlist_entries (
    version_id BIGINT NOT NULL REFERENCES q42_watchlist_versions(version_id),
    entry_id BIGINT NOT NULL,
    alias_name TEXT NOT NULL,
    PRIMARY KEY (version_id, entry_id, alias_name)
);

CREATE TEMP TABLE q42_screenings (
    screening_id BIGINT PRIMARY KEY,
    list_name TEXT NOT NULL,
    screened_at TIMESTAMPTZ NOT NULL,
    candidate_name TEXT NOT NULL
);

INSERT INTO q42_watchlist_versions VALUES
    (1, 'DEMO_LIST', '2025-01-01 00:00+00', '2025-01-01 02:00+00'),
    (2, 'DEMO_LIST', '2025-02-01 00:00+00', '2025-02-05 08:00+00');

INSERT INTO q42_watchlist_entries VALUES
    (1, 10, 'Alpha Trading'),
    (2, 10, 'Alpha Trading'),
    (2, 20, 'Beta Limited');

INSERT INTO q42_screenings VALUES
    (101, 'DEMO_LIST', '2025-02-01 12:00+00', 'Beta Limited'),
    (102, 'DEMO_LIST', '2025-02-10 12:00+00', 'Beta Limited'),
    (103, 'DEMO_LIST', '2025-02-10 12:00+00', 'Alpha-Trading');

SELECT
    s.screening_id,
    s.screened_at,
    s.candidate_name,
    v.version_id,
    e.entry_id,
    e.alias_name,
    (e.entry_id IS NOT NULL) AS exact_normalized_hit
FROM q42_screenings s
LEFT JOIN LATERAL (
    SELECT w.version_id
    FROM q42_watchlist_versions w
    WHERE w.list_name = s.list_name
      AND w.effective_at <= s.screened_at
      AND w.known_at <= s.screened_at
    ORDER BY w.effective_at DESC, w.known_at DESC, w.version_id DESC
    LIMIT 1
) v ON true
LEFT JOIN q42_watchlist_entries e
  ON e.version_id = v.version_id
 AND regexp_replace(upper(e.alias_name), '[^[:alnum:]]', '', 'g')
     = regexp_replace(upper(s.candidate_name), '[^[:alnum:]]', '', 'g')
ORDER BY s.screening_id;

-- 样例检查：101选择version 1且不命中Beta；102选择version 2并命中；
-- 103通过仅用于演示的规范化精确匹配命中Alpha。
```

> **深入追问：** 真正姓名匹配不会只靠 SQL 正则；我会先生成候选，再用生日、国籍和证件等属性消歧，并把匹配器版本与名单版本一起存档。版本更正或撤回要追加事件，不能改掉历史。
>
> **易错点：** 我不会只看 `effective_at` 而忽略系统尚未获取名单，也不会把规范化精确命中直接当制裁确认。`LEFT JOIN LATERAL` 能保留当时没有可用版本的筛查，便于暴露数据缺口。
>
> **事实边界：** 示例名单和名称完全虚构。生产表应索引 `(list_name, effective_at DESC, known_at DESC)`；姓名候选索引需按获批准的规范化与搜索方案设计。

## 五、Python 标准库完整实操（Q043-Q048）

### Q043：实现 AUC、KS、Gini、PR-AUC、Brier、Calibration 和成本阈值

> **口语化回答：** 我会先约定 `1` 是坏样本、概率越高风险越高。AUC、KS和Gini看排序，Average Precision近似概括 PR 曲线，Brier和分箱结果看概率质量；阈值则按误放和误拒成本选。下面不依赖 sklearn，方便我现场讲清每个指标的计算。

```python
from __future__ import annotations

from collections import defaultdict
from math import isclose, nextafter, inf
from typing import Iterable


def _validate_observations(y_true: list[int], prob: list[float]) -> None:
    if len(y_true) != len(prob) or not y_true:
        raise ValueError("y_true and prob must have the same non-zero length")
    if any(y not in (0, 1) for y in y_true):
        raise ValueError("labels must be 0 or 1")
    if any(not 0.0 <= p <= 1.0 for p in prob):
        raise ValueError("probabilities must be in [0, 1]")


def _require_both_classes(y_true: list[int]) -> None:
    if len(set(y_true)) != 2:
        raise ValueError("both good and bad samples are required")


def roc_auc(y_true: list[int], prob: list[float]) -> float:
    """Mann-Whitney AUC with average ranks for tied scores."""
    _validate_observations(y_true, prob)
    _require_both_classes(y_true)
    ordered = sorted(zip(prob, y_true), key=lambda item: item[0])
    positive_rank_sum = 0.0
    i = 0
    while i < len(ordered):
        j = i + 1
        while j < len(ordered) and ordered[j][0] == ordered[i][0]:
            j += 1
        average_rank = ((i + 1) + j) / 2.0
        positive_rank_sum += average_rank * sum(y for _, y in ordered[i:j])
        i = j
    positives = sum(y_true)
    negatives = len(y_true) - positives
    return (
        positive_rank_sum - positives * (positives + 1) / 2.0
    ) / (positives * negatives)


def ks_statistic(y_true: list[int], prob: list[float]) -> float:
    _validate_observations(y_true, prob)
    _require_both_classes(y_true)
    groups: dict[float, list[int]] = defaultdict(lambda: [0, 0])
    for y, p in zip(y_true, prob):
        groups[p][y] += 1
    total_bad = sum(y_true)
    total_good = len(y_true) - total_bad
    seen_bad = seen_good = 0
    best = 0.0
    for score in sorted(groups, reverse=True):
        seen_good += groups[score][0]
        seen_bad += groups[score][1]
        best = max(best, abs(seen_bad / total_bad - seen_good / total_good))
    return best


def average_precision(y_true: list[int], prob: list[float]) -> float:
    """Step-wise PR area, commonly called Average Precision."""
    _validate_observations(y_true, prob)
    _require_both_classes(y_true)
    groups: dict[float, list[int]] = defaultdict(lambda: [0, 0])
    for y, p in zip(y_true, prob):
        groups[p][y] += 1
    total_bad = sum(y_true)
    tp = fp = 0
    previous_recall = 0.0
    area = 0.0
    for score in sorted(groups, reverse=True):
        fp += groups[score][0]
        tp += groups[score][1]
        recall = tp / total_bad
        precision = tp / (tp + fp)
        area += (recall - previous_recall) * precision
        previous_recall = recall
    return area


def brier_score(y_true: list[int], prob: list[float]) -> float:
    _validate_observations(y_true, prob)
    return sum((p - y) ** 2 for y, p in zip(y_true, prob)) / len(y_true)


def calibration_table(
    y_true: list[int], prob: list[float], bins: int = 10
) -> list[dict[str, float | int]]:
    _validate_observations(y_true, prob)
    if bins <= 0:
        raise ValueError("bins must be positive")
    rows = [[0, 0.0, 0] for _ in range(bins)]  # count, sum_prob, sum_bad
    for y, p in zip(y_true, prob):
        index = min(int(p * bins), bins - 1)
        rows[index][0] += 1
        rows[index][1] += p
        rows[index][2] += y
    return [
        {
            "bin": index,
            "count": int(count),
            "mean_probability": total_p / count,
            "observed_bad_rate": total_y / count,
        }
        for index, (count, total_p, total_y) in enumerate(rows)
        if count
    ]


def minimum_cost_threshold(
    y_true: list[int],
    prob: list[float],
    false_negative_cost: float,
    false_positive_cost: float,
) -> tuple[float, float]:
    """Predict bad when probability >= threshold."""
    _validate_observations(y_true, prob)
    if false_negative_cost < 0 or false_positive_cost < 0:
        raise ValueError("costs must be non-negative")
    candidates = sorted(set(prob) | {0.0, nextafter(1.0, inf)})
    best_threshold = candidates[0]
    best_cost = inf
    for threshold in candidates:
        cost = 0.0
        for y, p in zip(y_true, prob):
            predicted_bad = p >= threshold
            if y == 1 and not predicted_bad:
                cost += false_negative_cost
            elif y == 0 and predicted_bad:
                cost += false_positive_cost
        if cost < best_cost:
            best_threshold, best_cost = threshold, cost
    return best_threshold, best_cost


if __name__ == "__main__":
    labels = [0, 0, 1, 1]
    probabilities = [0.10, 0.40, 0.35, 0.80]
    auc = roc_auc(labels, probabilities)
    assert isclose(auc, 0.75)
    assert isclose(2 * auc - 1, 0.50)  # Gini
    assert isclose(ks_statistic(labels, probabilities), 0.50)
    assert isclose(average_precision(labels, probabilities), 5 / 6)
    assert isclose(brier_score(labels, probabilities), 0.158125)
    assert sum(row["count"] for row in calibration_table(
        labels, probabilities, bins=2
    )) == 4
    threshold, cost = minimum_cost_threshold(labels, probabilities, 5.0, 1.0)
    assert 0.0 <= threshold <= nextafter(1.0, inf)
    assert cost >= 0
    assert isclose(brier_score([0, 0], [0.1, 0.2]), 0.025)
    assert calibration_table([1, 1], [0.8, 0.9], bins=2)[0]["count"] == 2
    assert minimum_cost_threshold([1, 1], [0.8, 0.9], 5.0, 1.0)[1] == 0
    try:
        roc_auc([1, 1], [0.8, 0.9])
        raise AssertionError("ranking metrics must reject a one-class sample")
    except ValueError:
        pass
    print({"auc": auc, "ks": ks_statistic(labels, probabilities),
           "average_precision": average_precision(labels, probabilities),
           "brier": brier_score(labels, probabilities),
           "threshold": threshold, "cost": cost})
```

> **深入追问：** 我会说明这里的 PR-AUC 采用 step-wise Average Precision，不同库的插值定义可能略有差异；生产对账必须固定实现和版本。阈值成本例子也只是演示，实际还要加入收益、资金、人工容量和约束。
>
> **易错点：** 我不会把高分方向弄反，也不会忽略并列分数。测试集必须标签成熟并保持真实 Base Rate，置信区间和分群结果不能只靠这段小样本代码。
>
> **事实边界：** 代码没有使用真实客户或模型数据。排序主导时间复杂度为 `O(n log n)`，校准表为 `O(n)`，当前阈值穷举为 `O(n^2)`；生产可按分数排序后用累计计数降到 `O(n log n)`。

### Q044：用冻结分箱实现 PSI，并单独处理缺失值

> **口语化回答：** 我会让基准期先确定 Cut Points，当前期只能应用，不能重新分箱。缺失值单独成箱，零频箱做平滑；最终不仅输出总 PSI，还输出每个箱的贡献，方便定位变化来自哪里。

```python
from __future__ import annotations

from bisect import bisect_right
from math import isclose, log
from typing import Iterable


def _bin_index(value: float | None, cut_points: list[float]) -> int:
    if value is None:
        return len(cut_points) + 1
    return bisect_right(cut_points, value)


def population_stability_index(
    reference: Iterable[float | None],
    current: Iterable[float | None],
    cut_points: list[float],
    smoothing: float = 0.5,
) -> tuple[float, list[dict[str, float | int]]]:
    if cut_points != sorted(set(cut_points)):
        raise ValueError("cut_points must be sorted and unique")
    if smoothing <= 0:
        raise ValueError("smoothing must be positive")
    reference_values = list(reference)
    current_values = list(current)
    if not reference_values or not current_values:
        raise ValueError("both populations must be non-empty")

    bin_count = len(cut_points) + 2  # numeric bins plus missing
    reference_counts = [0] * bin_count
    current_counts = [0] * bin_count
    for value in reference_values:
        reference_counts[_bin_index(value, cut_points)] += 1
    for value in current_values:
        current_counts[_bin_index(value, cut_points)] += 1

    reference_denominator = len(reference_values) + smoothing * bin_count
    current_denominator = len(current_values) + smoothing * bin_count
    details: list[dict[str, float | int]] = []
    total = 0.0
    for index, (reference_count, current_count) in enumerate(
        zip(reference_counts, current_counts)
    ):
        reference_share = (reference_count + smoothing) / reference_denominator
        current_share = (current_count + smoothing) / current_denominator
        contribution = (
            (current_share - reference_share)
            * log(current_share / reference_share)
        )
        total += contribution
        details.append({
            "bin": index,
            "reference_count": reference_count,
            "current_count": current_count,
            "reference_share": reference_share,
            "current_share": current_share,
            "psi_contribution": contribution,
        })
    return total, details


if __name__ == "__main__":
    baseline = [1.0, 2.0, 3.0, 4.0, None]
    shifted = [1.0, 1.0, 4.0, 5.0, None]
    same_psi, _ = population_stability_index(
        baseline, baseline, [2.5, 3.5]
    )
    psi, rows = population_stability_index(
        baseline, shifted, [2.5, 3.5]
    )
    assert isclose(same_psi, 0.0, abs_tol=1e-12)
    assert psi > 0
    assert len(rows) == 4  # 3 numeric bins plus missing
    assert rows[-1]["reference_count"] == 1
    assert rows[-1]["current_count"] == 1
    print({"psi": psi, "details": rows})
```

> **深入追问：** 我会把 Cut Points、基准窗口、特征版本和人群过滤一起版本化；PSI升高后再检查数据质量、渠道、政策、季节和成熟标签，而不是自动重训。
>
> **易错点：** 我不会引用网上阈值当法规，也不会把分箱边界在当前期重新拟合。平滑值会影响小样本结果，所以样本量和每箱计数必须一起展示。
>
> **事实边界：** 这是无权重样本实现，不处理抽样权重。时间复杂度约为 `O((n+m) log b)`，`b` 是分箱数；通常 `b` 很小。

### Q045：用 `event_time + known_at` 生成 Point-in-time 交易特征

> **口语化回答：** 我会先按客户和事件时间建索引，再用二分查找截取申请前 90 天候选，之后检查 `known_at`。它能同时挡住申请后的未来交易和当时尚未进入系统的迟到数据。

```python
from __future__ import annotations

from bisect import bisect_left
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from collections import defaultdict


@dataclass(frozen=True)
class Transaction:
    event_id: int
    customer_id: int
    event_time: datetime
    known_at: datetime
    category: str
    amount: Decimal


@dataclass(frozen=True)
class Application:
    application_id: int
    customer_id: int
    submitted_at: datetime


class PointInTimeFeatureIndex:
    def __init__(self, transactions: list[Transaction]) -> None:
        seen_ids: dict[int, Transaction] = {}
        for transaction in transactions:
            if transaction.event_time.tzinfo is None or transaction.known_at.tzinfo is None:
                raise ValueError("timestamps must be timezone-aware")
            previous = seen_ids.get(transaction.event_id)
            if previous is not None and previous != transaction:
                raise ValueError("conflicting duplicate event_id")
            seen_ids[transaction.event_id] = transaction

        grouped: dict[int, list[Transaction]] = defaultdict(list)
        for transaction in seen_ids.values():
            grouped[transaction.customer_id].append(transaction)
        self._transactions: dict[int, list[Transaction]] = {}
        self._times: dict[int, list[datetime]] = {}
        for customer_id, rows in grouped.items():
            rows.sort(key=lambda row: (row.event_time, row.event_id))
            self._transactions[customer_id] = rows
            self._times[customer_id] = [row.event_time for row in rows]

    def features(self, application: Application) -> dict[str, Decimal | int]:
        if application.submitted_at.tzinfo is None:
            raise ValueError("submitted_at must be timezone-aware")
        rows = self._transactions.get(application.customer_id, [])
        times = self._times.get(application.customer_id, [])
        start = bisect_left(times, application.submitted_at - timedelta(days=90))
        end = bisect_left(times, application.submitted_at)
        visible = [
            row for row in rows[start:end]
            if row.known_at <= application.submitted_at
        ]
        income_30d = sum(
            (row.amount for row in visible
             if row.category == "INCOME"
             and row.event_time >= application.submitted_at - timedelta(days=30)),
            Decimal("0"),
        )
        income_90d = sum(
            (row.amount for row in visible if row.category == "INCOME"),
            Decimal("0"),
        )
        refund_90d = sum(
            (abs(row.amount) for row in visible if row.category == "REFUND"),
            Decimal("0"),
        )
        return {
            "income_30d": income_30d,
            "income_90d": income_90d,
            "refund_90d": refund_90d,
            "visible_tx_count_90d": len(visible),
        }


if __name__ == "__main__":
    dt = datetime.fromisoformat
    transactions = [
        Transaction(1, 7, dt("2025-03-20T09:00+00:00"),
                    dt("2025-03-20T09:01+00:00"), "INCOME", Decimal("1000")),
        Transaction(2, 7, dt("2025-03-25T09:00+00:00"),
                    dt("2025-04-02T08:00+00:00"), "INCOME", Decimal("500")),
        Transaction(3, 7, dt("2025-04-01T13:00+00:00"),
                    dt("2025-04-01T13:01+00:00"), "INCOME", Decimal("700")),
        Transaction(4, 7, dt("2025-02-01T10:00+00:00"),
                    dt("2025-02-01T10:01+00:00"), "REFUND", Decimal("-100")),
    ]
    index = PointInTimeFeatureIndex(transactions)
    result = index.features(Application(
        101, 7, dt("2025-04-01T12:00+00:00")
    ))
    assert result == {
        "income_30d": Decimal("1000"),
        "income_90d": Decimal("1000"),
        "refund_90d": Decimal("100"),
        "visible_tx_count_90d": 2,
    }
    print(result)
```

> **深入追问：** 如果交易会修订，我会以稳定业务键保存版本，并在申请时点先选 `known_at` 不晚于申请的最新版本；这段示例只做事件去重，没有实现版本折叠。
>
> **易错点：** 我不会只比较日期而丢失时区和盘中顺序，也不会用浮点数处理金额。Merchant 分类如果后来修正，同样要按当时可见版本读取。
>
> **事实边界：** 建索引为 `O(t log t)`；单次申请为 `O(log t + k)`，`k` 是90天候选数。大量申请应批量 as-of join，而不是把全部数据放进单进程内存。

### Q046：实现带平滑、缺失箱和冻结边界的 WOE/IV

> **口语化回答：** 我会约定 `1` 是坏样本，先用训练集和固定 Cut Points 统计每箱好坏分布，再做平滑，定义 `WOE = ln(坏样本占比/好样本占比)`。验证和测试阶段只能应用训练得到的边界与 WOE，不能重新分箱。

```python
from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from math import isclose, log


@dataclass(frozen=True)
class WoeBin:
    index: int
    good_count: int
    bad_count: int
    woe: float
    iv_contribution: float


def _woe_bin_index(value: float | None, cut_points: list[float]) -> int:
    if value is None:
        return len(cut_points) + 1
    return bisect_right(cut_points, value)


def fit_woe_iv(
    values: list[float | None],
    labels: list[int],
    cut_points: list[float],
    smoothing: float = 0.5,
) -> tuple[list[WoeBin], float]:
    if len(values) != len(labels) or not values:
        raise ValueError("values and labels must have equal non-zero length")
    if any(label not in (0, 1) for label in labels):
        raise ValueError("labels must be 0 or 1")
    if cut_points != sorted(set(cut_points)):
        raise ValueError("cut_points must be sorted and unique")
    if smoothing <= 0:
        raise ValueError("smoothing must be positive")

    bin_count = len(cut_points) + 2
    good = [0] * bin_count
    bad = [0] * bin_count
    for value, label in zip(values, labels):
        index = _woe_bin_index(value, cut_points)
        if label == 1:
            bad[index] += 1
        else:
            good[index] += 1

    total_good = sum(good)
    total_bad = sum(bad)
    if total_good == 0 or total_bad == 0:
        raise ValueError("both good and bad samples are required")
    good_denominator = total_good + smoothing * bin_count
    bad_denominator = total_bad + smoothing * bin_count

    bins: list[WoeBin] = []
    total_iv = 0.0
    for index in range(bin_count):
        good_share = (good[index] + smoothing) / good_denominator
        bad_share = (bad[index] + smoothing) / bad_denominator
        woe = log(bad_share / good_share)
        contribution = (bad_share - good_share) * woe
        total_iv += contribution
        bins.append(WoeBin(index, good[index], bad[index], woe, contribution))
    return bins, total_iv


def apply_woe(
    values: list[float | None],
    cut_points: list[float],
    fitted_bins: list[WoeBin],
) -> list[float]:
    mapping = {row.index: row.woe for row in fitted_bins}
    return [mapping[_woe_bin_index(value, cut_points)] for value in values]


if __name__ == "__main__":
    train_x = [20, 25, 35, 45, 55, 65, None, None]
    train_y = [0, 0, 0, 1, 1, 1, 0, 1]
    cuts = [30, 50]
    fitted, iv = fit_woe_iv(train_x, train_y, cuts)
    transformed = apply_woe([22, 40, 70, None], cuts, fitted)
    assert len(fitted) == 4
    assert isclose(iv, 1.072958608, rel_tol=1e-6)
    assert transformed[0] < 0 < transformed[2]
    assert isclose(transformed[1], 0.0, abs_tol=1e-12)
    assert isclose(transformed[3], 0.0, abs_tol=1e-12)
    print({"iv": iv, "bins": fitted, "transformed": transformed})
```

> **深入追问：** 我会在训练阶段检查单调性、每箱样本量和业务可解释性，Cut Points 本身也要版本化。IV只能描述单变量区分信息，不代表因果、稳定或模型一定应该使用该特征。
>
> **易错点：** 我不会用全量数据分箱，也不会因为 IV 高就忽略泄漏。WOE正负方向有两种常见约定，必须在文档和实现中固定；这里正值代表坏样本相对更多。
>
> **事实边界：** 示例不自动寻优分箱，也不支持样本权重。时间复杂度为 `O(n log b)`，没有任何真实信贷特征或阈值。

### Q047：实现 FCFF DCF 与 WACC × 永续增长率敏感性矩阵

> **口语化回答：** 我会把显性期 FCFF 按年末折现，终值使用下一期 FCFF 除以 `WACC-g`，再扣净债务并除以稀释后股数。代码会拒绝 `g >= WACC`，并用测试确认 WACC下降或永续增长上升时估值应提高。

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DcfResult:
    enterprise_value: float
    equity_value: float
    per_share_value: float


def dcf_value(
    fcff: list[float],
    wacc: float,
    perpetual_growth: float,
    net_debt: float,
    diluted_shares: float,
) -> DcfResult:
    if not fcff:
        raise ValueError("at least one forecast FCFF is required")
    if wacc <= -1.0:
        raise ValueError("wacc must be greater than -100%")
    if perpetual_growth >= wacc:
        raise ValueError("perpetual growth must be lower than wacc")
    if diluted_shares <= 0:
        raise ValueError("diluted_shares must be positive")

    present_value = sum(
        cash_flow / (1.0 + wacc) ** year
        for year, cash_flow in enumerate(fcff, start=1)
    )
    terminal_value = (
        fcff[-1] * (1.0 + perpetual_growth)
        / (wacc - perpetual_growth)
    )
    present_value_terminal = terminal_value / (1.0 + wacc) ** len(fcff)
    enterprise_value = present_value + present_value_terminal
    equity_value = enterprise_value - net_debt
    return DcfResult(
        enterprise_value=enterprise_value,
        equity_value=equity_value,
        per_share_value=equity_value / diluted_shares,
    )


def sensitivity_matrix(
    fcff: list[float],
    wacc_values: list[float],
    growth_values: list[float],
    net_debt: float,
    diluted_shares: float,
) -> dict[float, dict[float, float]]:
    return {
        wacc: {
            growth: dcf_value(
                fcff, wacc, growth, net_debt, diluted_shares
            ).per_share_value
            for growth in growth_values
        }
        for wacc in wacc_values
    }


if __name__ == "__main__":
    cash_flows = [100.0, 110.0, 120.0]
    matrix = sensitivity_matrix(
        cash_flows,
        wacc_values=[0.08, 0.10],
        growth_values=[0.02, 0.03],
        net_debt=50.0,
        diluted_shares=10.0,
    )
    assert matrix[0.08][0.02] > matrix[0.10][0.02]
    assert matrix[0.08][0.03] > matrix[0.08][0.02]
    try:
        dcf_value(cash_flows, 0.03, 0.03, 50.0, 10.0)
    except ValueError:
        pass
    else:
        raise AssertionError("g >= wacc must be rejected")
    print(matrix)
```

> **深入追问：** 我会补充这是假设年末现金流的简化模型；如果用 Mid-year Convention、Stub Period、多币种或资本结构变化，折现时点要重写。净债务调整也可能包含租赁、少数股东、优先股和非经营资产。
>
> **易错点：** 我不会把 FCFE 用 WACC 折现，也不会把终值忘记折现。测试只验证数学单调性，不证明输入假设合理；真实模型还要做三表勾稽和隐含倍数检查。
>
> **事实边界：** 所有现金流和参数均为虚构。时间复杂度为 `O(w * g * y)`，分别是 WACC 数、增长率数和预测年数；结果不构成投资建议。

### Q048：处理乱序、重复事件的 24 小时 AML 滑动窗口

> **口语化回答：** 我会先按 `event_id` 幂等去重，冲突重复直接报错；再按账户和事件时间排序，用 `deque` 维护24小时窗口和对手方计数。离线回放可以排序修复乱序，真正流式系统则要定义 Watermark 和迟到重算策略。

```python
from __future__ import annotations

from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal


@dataclass(frozen=True)
class TxEvent:
    event_id: int
    account_id: str
    event_time: datetime
    direction: str
    amount: Decimal
    counterparty_id: str


@dataclass(frozen=True)
class WindowAlert:
    account_id: str
    anchor_event_id: int
    window_start: datetime
    window_end: datetime
    tx_count: int
    distinct_counterparties: int
    total_amount: Decimal


def detect_window_candidates(
    events: list[TxEvent],
    amount_threshold: Decimal,
    window: timedelta = timedelta(hours=24),
    min_count: int = 3,
    min_counterparties: int = 2,
) -> list[WindowAlert]:
    if amount_threshold <= 0 or window <= timedelta(0):
        raise ValueError("threshold and window must be positive")
    if min_count <= 0 or min_counterparties <= 0:
        raise ValueError("minimum counts must be positive")

    deduplicated: dict[int, TxEvent] = {}
    for event in events:
        if event.event_time.tzinfo is None:
            raise ValueError("event_time must be timezone-aware")
        if event.amount <= 0:
            raise ValueError("amount must be positive")
        previous = deduplicated.get(event.event_id)
        if previous is not None and previous != event:
            raise ValueError("conflicting duplicate event_id")
        deduplicated[event.event_id] = event

    grouped: dict[str, list[TxEvent]] = defaultdict(list)
    for event in deduplicated.values():
        if event.direction == "IN" and event.amount < amount_threshold:
            grouped[event.account_id].append(event)

    alerts: list[WindowAlert] = []
    for account_id, rows in grouped.items():
        rows.sort(key=lambda row: (row.event_time, row.event_id))
        active: deque[TxEvent] = deque()
        counterparties: Counter[str] = Counter()
        total = Decimal("0")
        for event in rows:
            boundary = event.event_time - window
            while active and active[0].event_time <= boundary:
                expired = active.popleft()
                total -= expired.amount
                counterparties[expired.counterparty_id] -= 1
                if counterparties[expired.counterparty_id] == 0:
                    del counterparties[expired.counterparty_id]
            active.append(event)
            total += event.amount
            counterparties[event.counterparty_id] += 1
            if (
                len(active) >= min_count
                and len(counterparties) >= min_counterparties
                and total >= amount_threshold
            ):
                alerts.append(WindowAlert(
                    account_id=account_id,
                    anchor_event_id=event.event_id,
                    window_start=active[0].event_time,
                    window_end=event.event_time,
                    tx_count=len(active),
                    distinct_counterparties=len(counterparties),
                    total_amount=total,
                ))
    return alerts


if __name__ == "__main__":
    dt = datetime.fromisoformat
    e1 = TxEvent(1, "A", dt("2025-01-01T09:00+00:00"),
                 "IN", Decimal("4000"), "CP1")
    e2 = TxEvent(2, "A", dt("2025-01-01T13:00+00:00"),
                 "IN", Decimal("3500"), "CP2")
    e3 = TxEvent(3, "A", dt("2025-01-02T08:00+00:00"),
                 "IN", Decimal("3000"), "CP3")
    # 输入故意乱序，并重复投递e2；幂等去重后只生成一个候选。
    alerts = detect_window_candidates(
        [e3, e1, e2, e2], amount_threshold=Decimal("10000")
    )
    assert len(alerts) == 1
    assert alerts[0].anchor_event_id == 3
    assert alerts[0].total_amount == Decimal("10500")
    assert alerts[0].distinct_counterparties == 3
    print(alerts[0])
```

> **深入追问：** 生产流式实现不会无限等待乱序事件，我会按数据源延迟分布设置 Watermark，把过晚事件放入补偿队列，并按账户和 Episode 幂等更新 Case。冲正事件不能作为普通负金额简单加入，还要引用原事件并重算受影响窗口。
>
> **易错点：** 我不会把示例阈值当法定门槛，也不会让一次窗口命中直接触发客户限制。连续锚点可能生成多个重叠 Alert，真实系统还要做 Episode 聚合和调查去重。
>
> **事实边界：** 代码是离线演练，排序时间复杂度为 `O(n log n)`，滑动扫描为 `O(n)`，状态空间与单账户窗口事件数成正比；它不是可直接投产的 AML 引擎。

## 六、使用顺序

1. 我先练 Q013-Q024，把信贷标签、指标和业务决策讲清，再做 Q037-Q040，证明自己不只是背名词。
2. 我再练 Q025-Q036，所有 AML 回答都以“产生调查线索、由授权人员决定”为边界，再做 Q041、Q042 和 Q048。
3. 投研或美股岗位重点练 Q001-Q012、Q043、Q044 和 Q047，并始终说明财务事实由结构化数据和代码计算，LLM只做受约束解释。
4. 面试官问“你实际做过吗”时，我会直接说这是知识题和迁移设计；本人真实金融业务模块、数据权限和成果只能按内部证据回答。
