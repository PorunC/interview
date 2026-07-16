# 网络、Kubernetes 与分布式故障现场题

> **定位与事实边界**：这份题库用于后端二面、三面、系统设计面和故障现场面。当前三个公司内部项目的源码与材料不能证明我已经亲历过下面每一种网络、Kubernetes、etcd 或跨地域事故，所以我会严格区分通用知识、实验室复现、故障演练、迁移设计和有内部事件记录能证明的真实生产经历。没有证据时，我只说“我会怎么排查和验证”，不说“我当时就是这样处理的”。
>
> 故障回答统一按“先止损 -> 保留现场 -> 指标/日志/Trace/命令定位 -> 恢复 -> 根因修复 -> 验证”展开。命令只是取证手段，执行前仍要确认权限、开销、数据敏感性和变更审批；尤其不会在生产环境无评估地重启、抓全量明文流量、修改内核参数或恢复 etcd。

## 一、网络与 Linux（Q001-Q020）

### Q001：从用户输入域名到收到 HTTP 响应，完整链路怎么讲？

> **口语化回答：** 我会按分层讲：客户端先查浏览器、系统和本地 DNS 缓存，再经递归解析得到 IP；根据路由和 ARP/邻居表把包交给网关，可能经过 NAT、负载均衡和代理；然后完成 TCP，HTTPS 再做 TLS，最后发送 HTTP，请求经过网关、应用和下游，响应沿连接返回。
>
> **深入追问：** 我会在每一层给证据：`getent hosts`、`dig` 看名字；`ip route get`、`ip neigh` 看路由和邻居；`ss -tnpi` 看连接；`openssl s_client` 看 TLS；`curl -v --trace-time` 看 DNS、连接、首字节和响应。Trace 只能覆盖应用已经收到请求后的部分，不能替代客户端和网络证据。
>
> **易错点：** 我不会把“能 ping 通”当 HTTP 正常，也不会把域名解析到 IP 就说链路完整。ICMP、TCP 端口、TLS SNI、HTTP Host、代理路由和应用健康是不同检查点。

### Q002：DNS 解析慢、偶发 NXDOMAIN 或解析到旧 IP，怎么排查？

> **口语化回答：** 我会先止损到已验证的备用解析器或受控静态路由，避免全量请求反复重试；同时保留失败域名、客户端位置、时间、resolver、返回码和 TTL。然后分客户端缓存、NodeLocal/集群 DNS、递归 DNS、权威 DNS 和应用连接池逐层定位。
>
> **深入追问：** 我会用 `dig +trace` 看委派链，用 `dig @resolver name A/AAAA +dnssec` 对比解析器，用 `resolvectl status/query` 或 `/etc/resolv.conf` 看本机配置，用 `tcpdump -nn port 53` 在合规前提下确认超时、截断和 TCP 回退。恢复后核对 TTL、负缓存和连接池是否仍粘旧 IP，并做多地域重复采样。
>
> **易错点：** 我不会先清掉所有缓存破坏现场，也不会把固定 `/etc/hosts` 当长期修复。NXDOMAIN 可能被负缓存；改 DNS 记录也不会强制已建立的 HTTP/2 长连接立即迁移。这里是演练流程，不冒充本人事故。

### Q003：TCP 三次握手、SYN 队列和 Accept 队列是什么关系？

> **口语化回答：** 我会说服务端收到 SYN 后维护半连接状态，完成第三次握手后连接进入已完成连接队列，应用调用 `accept()` 才取走。三次握手确认双方收发能力和初始序号；应用处理慢时，即使握手能完成，Accept 队列也可能积压。
>
> **深入追问：** 我会用 `ss -lnt` 看监听套接字队列，用 `ss -s`、`nstat` 观察 listen overflow、SYN 重传等计数，再结合 `/proc/sys/net/core/somaxconn`、`tcp_max_syn_backlog` 和应用 `listen(backlog)`。SYN cookie 主要应对半连接压力，不会修复应用迟迟不 accept。
>
> **易错点：** 我不会把两类队列混成一个 backlog，也不会直接把内核参数调大当根修。上游连接洪峰、应用线程阻塞、FD 上限和负载均衡健康检查都要一起看。

### Q004：TIME_WAIT 和 CLOSE_WAIT 大量堆积分别说明什么？

> **口语化回答：** 我会说 TIME_WAIT 常出现在主动关闭连接的一侧，用来吸收旧报文并保证最后 ACK 可重传；CLOSE_WAIT 表示本端已经收到对端 FIN，但应用还没 close。本质上一个更多是协议生命周期，一个更像应用资源释放不及时。
>
> **深入追问：** 我会用 `ss -tan state time-wait`、`ss -tan state close-wait` 按本地/远端地址聚合，再用 `lsof -p PID`、线程栈和连接池指标找到谁创建、谁没有关闭。TIME_WAIT 还要看短连接率和临时端口范围；CLOSE_WAIT 要沿异常和取消路径检查 finally/try-with-resources。
>
> **易错点：** 我不会看到 TIME_WAIT 就盲目开启危险复用参数，也不会靠重启掩盖 CLOSE_WAIT 泄漏。修复后要用相同请求率验证连接复用、FD、端口和状态分布稳定；本题是排障知识，不是个人事故声明。

### Q005：TCP 重传突然升高，怎么区分网络丢包、接收端慢和应用超时配置？

> **口语化回答：** 我会先限住重试和新流量，防止重传与应用重试互相放大；保留源/目的、时间窗、RTT、重传率和发布事件。然后从客户端、链路、服务端三个方向对照，看是某路径丢包、单机网卡问题，还是应用没有及时读取导致窗口受限。
>
> **深入追问：** 我会用 `nstat` 看 `TcpRetransSegs` 等趋势，用 `ss -ti dst IP` 看 RTT、rto、cwnd、retrans，用 `ip -s link`、`ethtool -S` 看接口错误，在批准后用 `tcpdump -nn -i any host IP and port P` 对齐序号、重复 ACK 和重传。恢复后用同路径压测，并比较应用 deadline 是否短于合理网络尾延迟。
>
> **易错点：** 我不会只凭一端抓包就断言中间哪一跳丢包，也不会把 TCP 重传和 HTTP 重试混为一谈。抓包可能含敏感载荷，必须限过滤器、时长和访问权限；这里是演练方法。

### Q006：零窗口、接收窗口和拥塞窗口分别限制什么？

> **口语化回答：** 我会说接收窗口是接收端告诉发送端“我的缓冲还能收多少”，零窗口通常说明接收端应用或内核来不及消费；拥塞窗口是发送端根据网络反馈估计链路能承受多少。实际在途数据同时受两者和发送缓冲限制。
>
> **深入追问：** 我会在 `ss -ti` 和抓包里看窗口通告、zero-window、window update、RTT 和 cwnd，再对照接收进程 CPU、GC、事件循环、socket buffer 与读取速率。恢复可以先降入口或隔离慢消费者，根修是消除应用阻塞、合理背压和容量，而不是无限放大缓冲。
>
> **易错点：** 我不会把零窗口叫网络拥塞，也不会只调 `rmem/wmem`。更大缓冲可能只是延后失败并增加排队延迟；判断必须用端到端证据，不能冒充真实事故。

### Q007：`select`、`poll` 和 `epoll` 的核心差别是什么？

> **口语化回答：** 我会说 select 有 FD 集合大小和每次复制、扫描成本；poll 用数组描述符，去掉固定集合限制但仍要线性扫描；epoll 把关注集合维护在内核，`epoll_wait` 主要返回就绪事件，适合大量连接、少量活跃的场景。
>
> **深入追问：** 我会继续区分 level-triggered 和 edge-triggered：LT 只要仍就绪就继续通知，ET 通常只在状态边沿通知，所以必须非阻塞并一直读/写到 EAGAIN；`EPOLLONESHOT` 还需要显式 rearm。epoll 不是任何负载下都 O(1)，事件搬运和活跃连接处理仍有成本。
>
> **易错点：** 我不会把 epoll 说成异步 IO 本身，也不会认为用了 Netty/epoll 就不会阻塞。回调里做慢 SQL、CPU 计算或同步 DNS，一样会卡住事件循环。

### Q008：Reactor/Event Loop 为什么怕阻塞？怎么找到是哪段代码卡住？

> **口语化回答：** 我会说一个 Event Loop 线程负责很多连接的就绪事件，单个回调做慢 IO、锁等待或 CPU 重活，会让同一 Loop 上其他连接都排队。现场先摘掉坏实例或限制新连接，再保留 loop lag、任务队列、线程栈和慢请求 Trace。
>
> **深入追问：** 我会连续抓低风险线程栈，配合 async-profiler/JFR 的 wall-clock 或 event-loop 指标，看线程卡在 DNS、文件、数据库驱动、序列化还是用户代码；Linux 层用 `pidstat -t -p PID`、`perf top` 需评估开销。根修是把阻塞调用隔离到有界池、减少回调工作并增加 deadline/backpressure，随后压测 p99 和 loop lag。
>
> **易错点：** 我不会只增加 Event Loop 线程掩盖阻塞，也不会把所有同步方法都判断成一定阻塞。工具和采样开销要先评估；没有真实事件记录时我只说演练方法。

### Q009：监听 Backlog 已满时，客户端和服务端分别会看到什么？

> **口语化回答：** 我会先保护入口并扩散到健康实例，保留连接超时、SYN/Accept 队列、listen drops 和应用吞吐。半连接压力可能表现为握手重传或超时，完成队列满则可能让已握手连接得不到应用及时 accept，具体行为受内核和配置影响。
>
> **深入追问：** 我会用 `ss -lntp` 对比 Recv-Q/Send-Q，`nstat -az` 看 ListenOverflows/ListenDrops，结合负载均衡连接错误、应用 accept 速率、FD 和线程状态。恢复可临时扩容、限流或回滚慢版本；根修要让 listen backlog、somaxconn、应用 accept 能力和上游连接策略配套，并复测突发流量。
>
> **易错点：** 我不会看到 connect timeout 就断言 backlog 满，也不会只加队列长度。队列更长会增加等待和超时占用；这里是故障演练，不是本人事故。

### Q010：临时端口或 NAT 端口耗尽，为什么会出现“有些下游连不上”？

> **口语化回答：** 我会说一个 TCP 连接由四元组区分，客户端对同一目的地址端口能用的源端口有限；大量短连接、TIME_WAIT、连接泄漏或 NAT 多主机共享一个公网地址，都可能耗尽映射，表现为新建连接失败而已有连接仍正常。
>
> **深入追问：** 我会用 `ss -s`、`ss -tan` 按目的聚合，查看 `ip_local_port_range`，在 NAT/云网关侧看 active connection、SNAT port utilization 和分配失败；应用侧检查连接池复用率、每请求新建 Client 和 DNS 地址数量。恢复先限新连接、复用池或扩 NAT 地址，根修后验证 connect error 与 TIME_WAIT 回落。
>
> **易错点：** 我不会直接扩大端口范围后宣称解决，也不会启用不理解的 TIME_WAIT 复用参数。NAT 指标往往不在应用主机上，必须把云网络证据纳入；本题只说方法。

### Q011：HTTP 连接池为什么会出现陈旧连接、负载不均和 Pool Wait？

> **口语化回答：** 我会说连接池能省 DNS、TCP 和 TLS 成本，但服务端/LB 已按 idle timeout 关掉连接时，客户端可能还拿出旧连接；长寿命连接又可能一直粘旧 IP 或少数后端；连接上限太小则请求先在池里等，表现为应用慢而服务端并不慢。
>
> **深入追问：** 我会拆 `pool_wait/connect/tls/ttfb/read` 指标，用客户端 debug/Trace、`ss -tnp` 和 LB 连接分布验证；对齐 keepalive、idle timeout、max lifetime、DNS TTL 和 HTTP/2 stream 上限。恢复可淘汰坏池或切实例，根修后用滚动地址变化和半关闭连接做故障测试。
>
> **易错点：** 我不会每次请求新建 Client，也不会把连接池调得无限大。HTTP/2 少量连接可承载大量流，但也可能形成单连接热点；这里是知识与演练边界。

### Q012：TLS 握手和证书校验失败，排查顺序是什么？

> **口语化回答：** 我会先判断影响范围和证书到期时间，必要时切到已验证证书或备用入口；保留客户端错误、SNI、目标 IP、证书链和时间。然后依次检查 TCP 可达、ClientHello/ServerHello、协议与 Cipher、证书链、域名 SAN、有效期、信任根和 OCSP/CRL 路径。
>
> **深入追问：** 我会用 `openssl s_client -connect host:443 -servername host -showcerts` 看服务端实际返回链，用 `curl -v https://host` 看客户端验证，用 `openssl x509 -noout -subject -issuer -dates -ext subjectAltName` 检查证书；再对比不同 LB 节点，防止只有部分实例证书没更新。恢复后做所有域名和链路的自动到期巡检。
>
> **易错点：** 我不会用 `-k` 关闭校验当修复，也不会只看 CN 忽略 SAN。客户端时钟错误、中间证书缺失和 SNI 错误都可能伪装成证书问题；命令输出也可能含内部域名，需脱敏。

### Q013：HTTP/1.1、HTTP/2、HTTP/3 的队头阻塞分别在哪里？

> **口语化回答：** 我会说 HTTP/1.1 在一个连接上难以高效并发，常靠多连接缓解；HTTP/2 把请求拆成多路 Stream，消除应用层按请求排队，但所有 Stream 仍共享一个 TCP，丢包时会受 TCP 层队头阻塞；HTTP/3 基于 QUIC，让不同 Stream 的丢包恢复更独立。
>
> **深入追问：** 我会从 ALPN 确认实际协商协议，用 `curl -v --http2`、浏览器网络面板或网关指标看 stream、reset 和连接数；QUIC 还要确认 UDP 可达、连接迁移和网关支持。恢复协议问题时先回退到已验证版本，根修必须用真实网络条件比较成功率和 p99。
>
> **易错点：** 我不会说 HTTP/3 任何场景都更快，也不会把 HTTP/2 多路复用当无限并发。流控、服务端处理和单连接拥塞仍需容量限制。

### Q014：零拷贝 `sendfile`、`mmap` 和 `splice` 到底减少了什么？

> **口语化回答：** 我会说传统文件发送可能在内核页缓存和用户缓冲之间来回复制，零拷贝路径尽量让数据留在内核，通过页引用或内核管道直接送到 socket，减少用户态复制和上下文切换。它不是数据从未经过任何内存或硬件复制。
>
> **深入追问：** 我会按场景区分：`sendfile` 适合文件到 socket，`splice` 在支持的 FD 间移动页引用，`mmap` 把文件映射进地址空间但访问仍会缺页。用 `strace -e sendfile,splice,mmap`、CPU profile、吞吐和 page cache 指标验证，不只看 API 名称。
>
> **易错点：** 我不会为了零拷贝放弃 TLS、压缩或业务转换的正确性，也不会说 Kafka 快只靠一个 sendfile。收益取决于文件大小、缓存命中、协议栈和 NIC 能力。

### Q015：TCP 没有消息边界，“粘包/拆包”应该怎么设计协议？

> **口语化回答：** 我会先纠正说法：TCP 是字节流，一次 write 不对应一次 read，收到合并或拆分是正常语义，不是 TCP 出错。应用协议要用固定长度、分隔符、长度前缀或成熟帧协议定义边界，并限制最大帧长。
>
> **深入追问：** 我会写状态机先读固定头，再校验 length，最后累计到完整 body；处理半包、多包、恶意超长、负长度、字符编码和连接关闭。抓包只证明字节到达方式，单元/属性测试要把任意分片组合喂给 decoder，验证输出相同。
>
> **易错点：** 我不会用一次 `read()` 就强转完整对象，也不会通过 sleep 等待“包收全”。Nagle 与 delayed ACK 影响时延，不负责提供应用消息边界。

### Q016：网关返回 502 Bad Gateway，怎么快速判断坏在代理还是上游？

> **口语化回答：** 我会先按路由和实例摘除坏上游或回滚，限制重试，保留网关 access/error log、upstream address/status、Trace ID 和发布时间线。502 通常表示代理没拿到有效上游响应，可能是连接拒绝、reset、协议/TLS 不匹配或上游提前断开。
>
> **深入追问：** 我会从网关所在网络执行 `curl -v` 到上游，用 `ss` 看连接，用 `openssl s_client` 验证上游 TLS，查应用日志和容器退出；对齐 `upstream_connect_time/header_time/response_time`。恢复后从入口做合成请求，确认所有 endpoint 和协议配置都正确，再补路由与健康检查门禁。
>
> **易错点：** 我不会把所有 502 都叫应用返回 500，也不会只在自己电脑 curl。代理到上游的网络、SNI、Host 和 mTLS 身份可能与外部不同；本题是演练步骤，不是个人事故。

### Q017：504 Gateway Timeout 与应用自己的超时怎样建立一条 Deadline 链？

> **口语化回答：** 我会先降低流量或关闭无效重试，保留网关总耗时、上游阶段耗时和慢 Trace。504 表示代理在自己的等待窗口内没拿到上游结果；根因可能是队列、连接池、数据库、锁、GC 或下游，并不等于网关本身慢。
>
> **深入追问：** 我会让入口生成总 deadline，向每层传剩余预算；检查网关 read timeout、应用 timeout、HTTP/DB pool wait 和重试次数，避免每层各等 30 秒。命令上用 `curl -v --max-time` 复现，结合 Trace Span、线程栈、`ss -ti` 和数据库等待定位。修复后验证取消能释放底层资源。
>
> **易错点：** 我不会只把网关 timeout 调大，也不会让上游 3 秒、下游每次 3 秒再重试三次。超时只是停止等待，底层动作是否停止和写请求幂等必须另证；这里不冒充事故。

### Q018：`Connection reset by peer` 和 `Broken pipe` 分别说明什么？

> **口语化回答：** 我会说 reset 表示读写时收到对端或中间设备的 RST，原因可能是进程退出、协议错误、积压溢出或设备超时；Broken pipe 常表示本端继续向已经关闭的连接写。先按错误方向、连接四元组和时间线判断是谁先关。
>
> **深入追问：** 我会对齐两端日志，在批准后用 `tcpdump` 看 FIN/RST 的序号与发起方，用 `ss -tinp` 看 socket 状态，检查 LB idle timeout、keepalive、请求体大小、应用崩溃和优雅关停。恢复后做长空闲、慢上传和滚动发布测试，确认没有无效重试。
>
> **易错点：** 我不会看到 reset 就断言网络丢包，也不会把客户端取消当服务端故障。TLS 加密下抓包看不到应用内容，但仍能看连接控制包；本题是方法论。

### Q019：线上网络故障时，`curl`、`dig`、`ss`、`tcpdump`、`mtr` 怎么分工？

> **口语化回答：** 我会按低风险到高风险用工具：`dig/getent` 证明解析，`curl -v --resolve` 分离 DNS、目标 IP、TLS 和 HTTP，`ss -lntp/-tnpi` 看监听和连接，`mtr -rw` 看路径统计但不把 ICMP 丢包直接等同业务丢包，最后才用严格过滤的 `tcpdump` 看报文时序。
>
> **深入追问：** 我会同时记录执行位置、命令、时间、目标和输出，避免在办公网成功却推断 Pod 网络成功。`tcpdump -s`、过滤器、持续时间和文件权限要受控；必要时用 `tshark` 只提取握手、重传和 RTT 元数据。恢复后把关键检查做成无敏感数据的合成监控。
>
> **易错点：** 我不会把 traceroute 中间跳不回包当断网，也不会在生产无界抓 `-i any -s 0`。命令是证据，不是结论；多端时钟还要先校准。

### Q020：给你一个“部分用户偶发超时”的网络现场，完整处置框架是什么？

> **口语化回答：** 我会先按用户地域、运营商、域名、IP、协议版本、实例和接口分桶，若影响扩大就降级、限流或切稳定入口；随后冻结发布、保留客户端错误、LB/网关日志、Trace、连接和网络计数。再用一条失败样本沿 DNS、建连、TLS、代理、应用、下游逐段缩小。
>
> **深入追问：** 我会在客户端和服务端各做同时间窗证据，用 `dig`、`curl --trace-time`、`ss -ti`、`nstat`、受控抓包和 Trace 对齐。恢复不是“错误率下降就结束”，还要验证重试量、端口、连接池、p99 和各地域合成探针；根修后补告警、runbook 和故障注入回归。
>
> **易错点：** 我不会拿平均延迟掩盖局部故障，也不会在没有相关性时同时改 DNS、内核和应用参数。这里是标准演练框架；是否本人处理过相同事故只能按内部记录回答。

## 二、Kubernetes 内部与故障（Q021-Q045）

### Q021：Kubernetes 控制面的 API Server、etcd、Scheduler 和 Controller Manager 怎么协作？

> **口语化回答：** 我会把 API Server 讲成控制面入口和状态校验中心，etcd 保存集群期望与观测状态；Scheduler 为未绑定 Pod 选择 Node，Controller Manager 里的各控制器不断比较期望状态和实际状态并创建、更新对象。组件主要通过 API 对象和 watch 协作，不是彼此直接调用一条固定工作流。
>
> **深入追问：** 我会继续讲 resourceVersion、watch、乐观并发和 reconcile 的幂等性。API Server 的认证、授权、准入和持久化是不同阶段；etcd 多数派只保护已提交控制面状态，不代表业务数据库也有同样一致性。具体控制器和实现会随 Kubernetes 版本变化。
>
> **易错点：** 我不会说 Scheduler 负责启动容器，也不会说 etcd 保存容器日志和镜像。排障要看哪个控制器没有把实际状态推进到期望状态，而不是先重启整个控制面。

### Q022：一个 Pod 从提交 YAML 到容器 Ready，完整内部链路是什么？

> **口语化回答：** 我会说客户端把对象提交给 API Server，经认证、授权、准入和校验后写入 etcd；Scheduler watch 到未绑定 Pod，过滤打分后写 Binding；目标 Node 的 kubelet watch 到它，通过 CRI 拉镜像和建容器、通过 CNI 配网络、需要时经 CSI 挂卷，最后执行探针并更新 PodStatus。
>
> **深入追问：** 我会用 `kubectl get pod -o yaml` 看 spec、status、conditions、nodeName 和 containerStatuses，用 `kubectl get events --field-selector involvedObject.name=NAME --sort-by=.lastTimestamp` 对齐阶段；Node 上再看 kubelet、runtime、CNI/CSI 日志。Ready 只表示探针和条件满足，不代表所有业务依赖绝对健康。
>
> **易错点：** 我不会把 `kubectl apply` 成功当 Pod 已运行，也不会只看 Phase=Running。容器可以 Running 但 Readiness=False，Service 不会把它当可用 endpoint。

### Q023：Scheduler 的 Filter、Score、Preemption 和绑定分别做什么？

> **口语化回答：** 我会说 Filter 先排除资源、污点、亲和性、端口、卷等不满足的 Node，Score 再给可行节点排序，选定后写绑定。没有可行节点时可能评估抢占低优先级 Pod，但抢占也不保证立即可调度，因为终止、PDB 和其他约束仍存在。
>
> **深入追问：** 我会从 Pending Pod 的 scheduling events 读取具体插件原因，再查 `kubectl describe node`、资源 requests、taints/tolerations、affinity、topology spread、PVC zone 和 PriorityClass。调度按 request 而不是实时 CPU 利用率，过低 request 会形成节点过载。
>
> **易错点：** 我不会看到节点 CPU 空闲就断言能调度，也不会用高 Priority 解决所有容量问题。抢占会影响其他业务，必须有优先级治理和容量计划。

### Q024：kubelet、CRI、探针和 Pod 状态之间是什么关系？

> **口语化回答：** 我会说 kubelet 负责让本节点 PodSpec 落地，通过 CRI 调容器运行时，收集容器状态并执行 startup、liveness、readiness 探针。Startup 成功前可保护慢启动不被 liveness 误杀；readiness 决定是否接流量；liveness 失败触发容器重启。
>
> **深入追问：** 我会看 `kubectl describe pod` 的 probe failure、restartCount、lastState，再看 `kubectl logs --previous` 和节点 kubelet/runtime 日志。Exec、HTTP、TCP、gRPC 探针的成本和覆盖不同；探针本身也受 CPU throttling、网络和 timeout 影响。
>
> **易错点：** 我不会让 liveness 深查数据库导致下游故障变重启风暴，也不会把三个探针都指向一个恒定 200。探针阈值必须由真实启动和故障时延校准。

### Q025：Service、EndpointSlice 和 kube-proxy 怎样把 ClusterIP 流量送到 Pod？

> **口语化回答：** 我会说 Service Selector 只按 Label 匹配 Pod，EndpointSlice Controller 再把匹配结果和 `ready/serving/terminating` 等 Condition 写进 EndpointSlice；数据面通常只把流量送给可用 Endpoint，但还要考虑 `publishNotReadyAddresses` 等配置边界。随后 kube-proxy 的 iptables/IPVS 或平台的 eBPF 数据面，把虚拟 ClusterIP/Port 转到具体 Endpoint，路径不能一概而论。
>
> **深入追问：** 我会用 `kubectl get svc,endpointslices -o wide` 对比 selector、port、targetPort、address 和 readiness，从同 Namespace 调 `curl` Service，再直接 curl Pod IP，区分 Service 规则与应用监听问题。Node 上查规则必须先确认实际数据面模式，不能默认有某条 iptables 链。
>
> **易错点：** 我不会说 Service 自己转发报文或做应用层健康检查，也不会忽略命名 port、协议和 targetPort。外部负载均衡到 Node/Pod 还有额外链路。

### Q026：CoreDNS 的解析链路和 `ndots` 为什么可能放大 DNS 流量？

> **口语化回答：** 我会说 Pod 的 resolv.conf 通常把集群 DNS 作为 nameserver，并配置 search domain；短域名会按 search 和 ndots 规则尝试多个候选，外部域名也可能先产生多次集群后缀查询。CoreDNS 根据插件链解析集群 Service 或转发外部 DNS。
>
> **深入追问：** 我会从故障 Pod 查看 `/etc/resolv.conf`，用 `nslookup/dig` 测 FQDN 和短名，再看 `kubectl -n kube-system logs/deployment/coredns`、CoreDNS latency/rcode/cache 指标和上游 resolver。必要时检查 NodeLocal DNSCache，但不会默认所有集群都有。
>
> **易错点：** 我不会通过把所有 DNS policy 改成 Default 粗暴绕开，也不会认为 CoreDNS Pod Ready 就代表上游解析健康。修复后要测 NXDOMAIN、外部域名、Service 名和高并发缓存命中。

### Q027：CNI 在 Pod 网络创建时做了什么？Pod 跨节点不通怎么查？

> **口语化回答：** 我会说 kubelet 调 CRI 建 sandbox 后，运行时调用 CNI 插件给 Pod network namespace 配接口、IP、路由和必要规则；不同实现可能用 overlay、BGP、路由或 eBPF。跨节点不通时先隔离影响并保留源 Pod、目的 Pod、Node、IP 和时间，再分本机 namespace、Node 路由、隧道/路由协议和 NetworkPolicy 查。
>
> **深入追问：** 我会用 `kubectl get pod -o wide`、`kubectl get node -o wide`，在受控 debug 容器里查 `ip addr/route/neigh`、`ping` 或 `curl`，再看 CNI agent 日志和指标；Node 上用 `tcpdump` 分源 Pod veth、隧道和物理网卡观察包在哪消失。恢复后做跨节点矩阵测试。
>
> **易错点：** 我不会假设 Pod CIDR 一定可在物理网络直接路由，也不会先 flush iptables。NetworkPolicy、MTU、反向路径过滤和安全组都可能只影响部分流量；这里是演练方法。

### Q028：Ingress、Ingress Controller、Gateway API 和云负载均衡分别是什么？

> **口语化回答：** 我会说 Ingress/Gateway API 对象只是期望路由配置，必须有对应 Controller 才会落成代理、LB 或数据面规则。Ingress 主要表达 HTTP 路由；Gateway API 把基础设施拥有者、网关和路由职责拆得更清楚，支持更丰富的协议和跨 Namespace 授权。
>
> **深入追问：** 我会从外到内查 DNS、云 LB、Controller Service、Controller Pod、Route/Ingress status、backendRef/Service 和 EndpointSlice。命令用 `kubectl describe ingress`、`kubectl get gateway,httproute -A`、Controller access/error log，并从 Controller 网络直接访问上游。
>
> **易错点：** 我不会说创建 Ingress 就自动获得公网 IP，也不会混用不同 Controller 的注解。TLS 终止位置、Host/SNI、路径重写和客户端真实 IP 都要逐层确认。

### Q029：PV、PVC、StorageClass、CSI 和 `volumeBindingMode` 怎么协作？

> **口语化回答：** 我会说 PVC 表达工作负载对存储的请求，PV 表达实际卷，StorageClass 定义动态供应参数，CSI Controller/Node 插件负责创建、附着、挂载。`WaitForFirstConsumer` 可以等 Pod 调度约束确定后再在对应 Zone 供应卷，避免卷先建在错误故障域。
>
> **深入追问：** 我会用 `kubectl get pvc,pv,storageclass` 和 `describe pvc/pod` 看 Pending 原因、access mode、capacity、zone、attach/mount event；再看 CSI controller/node 日志。恢复前区分“对象绑定失败”“云盘 attach 失败”“Node mount 失败”和文件系统错误，避免错误重建有数据卷。
>
> **易错点：** 我不会删除 PVC 试运气，也不会把 StatefulSet 当自动备份。ReclaimPolicy、快照、一致性和跨 Zone 恢复必须有明确 runbook。

### Q030：StatefulSet 的稳定身份和有序操作解决什么，不解决什么？

> **口语化回答：** 我会说 StatefulSet 给 Pod 稳定序号、DNS 身份和按模板创建的独立 PVC，并可按策略有序创建、删除和更新。它适合需要稳定成员身份的有状态程序，但不会自动完成数据库复制、Leader 选举、备份或一致性恢复。
>
> **深入追问：** 我会检查 headless Service、podManagementPolicy、updateStrategy、partition、PVC retention 和应用成员协议。滚动更新前先确认新旧版本、Schema 和复制协议兼容；故障时不能只按序号判断谁数据最新。
>
> **易错点：** 我不会把副本数从 1 改 3 就称高可用，也不会共享一个不支持多写的卷。应用级 quorum、fencing 和恢复验证仍要单独设计。

### Q031：Requests、Limits、QoS、CPU Throttling 和 OOMKill 怎么一起理解？

> **口语化回答：** 我会说 Scheduler 主要按 request 放置，CPU 超 limit 通常被节流，内存超过 cgroup 限制可能被 OOMKill。Pod 的 request/limit 组合形成 Guaranteed、Burstable、BestEffort 等 QoS，节点内存压力时会影响被驱逐优先级，但不是绝对不会被杀的承诺。
>
> **深入追问：** 我会同时看 `kubectl top`、容器 working set、CPU throttled seconds、OOM event、Node allocatable 和应用堆外内存。Java 的 Xmx、Direct/Metaspace/线程栈，Python native 库和 page cache 都会进入容器 RSS，不应只看语言堆。
>
> **易错点：** 我不会把 limit 设等于历史平均就称合理，也不会因 CPU 使用率低就忽略 throttling。参数要结合 p99、并发、GC、启动峰值和节点超卖压测。

### Q032：ServiceAccount、RBAC、Admission 和 NetworkPolicy 各守哪一层？

> **口语化回答：** 我会说 ServiceAccount 表示工作负载身份，RBAC 控制它能对哪些 API 资源做哪些动作；Admission 在对象持久化前做变更或校验；NetworkPolicy 控制 Pod 网络可达。它们互补，任何一个都不等于完整租户授权。
>
> **深入追问：** 我会用 `kubectl auth can-i --as=system:serviceaccount:NS:SA VERB RESOURCE -n NS` 验证权限，审查 RoleBinding/ClusterRoleBinding、Token audience/expiry、admission deny 事件和 NetworkPolicy 默认拒绝。Secret 访问还要结合 KMS、轮换和审计。
>
> **易错点：** 我不会给应用 cluster-admin 解决 403，也不会认为 NetworkPolicy 能理解 HTTP 路径。具体策略是否生效还取决于 CNI 支持；真实权限配置只能按内部事实回答。

### Q033：ConfigMap、Secret 更新和应用热加载为什么经常不一致？

> **口语化回答：** 我会说环境变量在进程启动时读取，后续对象更新不会自动改变进程环境；挂载卷的更新由 kubelet 最终传播，但应用是否重新读取、原子切换和校验是另一层。`subPath`、外部 Secret CSI 和不同平台还有各自刷新边界。
>
> **深入追问：** 我会比较 API 对象 resourceVersion、Pod 挂载文件内容、应用当前配置版本和发布时间；用配置 checksum 触发受控 rollout，或让应用 watch 文件后先校验再原子替换快照。Secret 轮换必须允许旧新凭据短暂共存并验证撤销。
>
> **易错点：** 我不会重启所有 Pod 之前不确认配置兼容，也不会把 Secret base64 当加密。热加载失败要保留旧可用配置并报警，不能半应用。

### Q034：Pod `CrashLoopBackOff`，现场怎么查？

> **口语化回答：** 我会先阻止坏版本继续扩散，必要时回滚或暂停 rollout；保留 Pod YAML、events、restartCount、lastState 和崩溃前日志。然后判断是进程立即退出、探针杀死、OOM、配置/Secret 缺失、依赖不可达还是启动命令错误。
>
> **深入追问：** 我会用 `kubectl describe pod POD`、`kubectl logs POD -c C --previous --timestamps`、`kubectl get pod POD -o jsonpath='{.status.containerStatuses}'`，需要时用临时 debug Pod 复现环境。恢复后先单副本验证启动、探针和依赖，再逐步放量；根修要增加启动校验和失败可观测性。
>
> **易错点：** 我不会反复 delete Pod 让现场消失，也不会只看当前容器日志漏掉 `--previous`。BackOff 是重启退避表现，不是根因；这里是故障演练而非个人事故。

### Q035：Pod 长时间 `Pending`，怎样区分调度、PVC 和配额问题？

> **口语化回答：** 我会先确认业务能否降级或临时扩已有健康副本，保留 Pending Pod 和 events。若 `PodScheduled=False`，从资源不足、taint、affinity、topology、hostPort、配额查；若已调度但没运行，则看 PVC、sandbox/CNI、镜像和 Node 状态。
>
> **深入追问：** 我会用 `kubectl describe pod`、`kubectl get events --sort-by=.lastTimestamp`、`kubectl describe node`、`kubectl get resourcequota,limitrange -n NS` 和 `kubectl get pvc`。恢复可增加容量、修正约束或卷绑定；根修要让 requests、自动扩容和故障域约束进入容量测试。
>
> **易错点：** 我不会只看 Node 当前使用率，也不会为了调度删除所有 affinity/taint。每个约束通常有隔离目的；本题只描述演练流程。

### Q036：`ImagePullBackOff` 怎么定位是镜像、凭据、网络还是架构不匹配？

> **口语化回答：** 我会暂停坏发布并保留 event，先区分 image not found、unauthorized、TLS/DNS timeout、rate limit、磁盘满和 manifest architecture 不匹配。若旧镜像健康就回滚，避免所有新 Pod 同时反复拉取。
>
> **深入追问：** 我会看 `kubectl describe pod` 的精确 pull error，核对 image digest/tag、imagePullSecrets、ServiceAccount、Node 到 registry 的 DNS/TLS；在受控 Node debug 环境看 container runtime 日志和磁盘。恢复后用 digest 固定镜像，做目标架构 smoke test 和 registry 可用性探针。
>
> **易错点：** 我不会把 Secret 内容打印到终端或日志，也不会用 `latest` 反复覆盖。Pod 里能访问外网不代表 Node runtime 能访问 registry；这里不是个人事故声明。

### Q037：Pod 被 `OOMKilled`，怎么判断是内存泄漏、瞬时峰值还是 Limit 太小？

> **口语化回答：** 我会先回滚、限流或提高经评估的临时余量保护服务，同时保留容器退出码、limit、working set、RSS、语言堆、GC 和请求分布。然后比较 OOM 前趋势：Full GC 后基线持续上升更像保留泄漏，单次大请求或批处理更像峰值，稳定贴 limit 则要重新做容量设计。
>
> **深入追问：** 我会用 `kubectl describe pod`、`kubectl top pod --containers`，查 cgroup/监控的 OOM event 和内存组成；Java 用 JFR/NMT/安全 histogram，Python 用采样和 tracemalloc，但先评估线上开销。根修后以同数据和 limit 压测峰值、关停和持续运行。
>
> **易错点：** 我不会只把 limit 加倍，也不会在线上大堆直接 dump 填满磁盘。Node OOM、容器 cgroup OOM 和应用自身 OutOfMemoryError 要分清；这里是演练方法。

### Q038：Pod 被 `Evicted` 或 Node 出现 Pressure，怎么处置？

> **口语化回答：** 我会先确认受影响 Node 和工作负载，cordon 防止继续调度，保护关键副本并保留 Node conditions、eviction message 和资源趋势。MemoryPressure、DiskPressure、PIDPressure、ephemeral-storage 超限的根因和恢复方式不同。
>
> **深入追问：** 我会用 `kubectl describe node`、`kubectl get pod -A --field-selector spec.nodeName=NODE`、`kubectl top node`，再通过批准的 `kubectl debug node/NODE` 查磁盘、inode、容器日志和进程数。恢复要清理可重建数据、修复日志轮转或容量，再 uncordon；根修后验证 eviction threshold 和 QoS。
>
> **易错点：** 我不会直接删未知目录释放磁盘，也不会把 Evicted Pod 当自动回到原地。是否 drain 要评估 PDB、StatefulSet 和本地盘；本题是演练流程。

### Q039：Pod 内 DNS 不通但 IP 直连正常，怎么查？

> **口语化回答：** 我会先让关键调用使用已验证的备用解析路径或降级，避免重试洪峰；保留失败 Pod、Node、Namespace、域名、rcode 和时间。然后查 Pod resolv.conf、CoreDNS Service/Endpoint、NetworkPolicy、CoreDNS Pod、上游 DNS 和特定 Node 网络。
>
> **深入追问：** 我会在同 Pod 网络执行 `cat /etc/resolv.conf`、`nslookup kubernetes.default.svc.cluster.local` 和外部 FQDN；用 `kubectl get svc,endpointslices -n kube-system`、CoreDNS logs/metrics，并对比迁移到另一 Node 后是否恢复。修复后测集群域名、外部域名、NXDOMAIN 和并发延迟。
>
> **易错点：** 我不会只重启 CoreDNS，也不会长期写死 Service ClusterIP。`ndots`、搜索域和 NodeLocal DNS 都可能让故障只出现在部分名字；这里不冒充事故。

### Q040：Service ClusterIP 不通，但直接访问 Pod IP 正常，怎么查？

> **口语化回答：** 我会先绕过或摘除错误 Service 路径保护流量，保留 Service、EndpointSlice、Pod readiness 和源 Node。然后按 selector 是否选中、port/targetPort、endpoint 地址、数据面规则和 NetworkPolicy 逐层查。
>
> **深入追问：** 我会用 `kubectl get svc S -o yaml`、`kubectl get endpointslices -l kubernetes.io/service-name=S -o yaml`，从同源 Pod 分别 curl ClusterIP、endpoint IP；再按集群实现检查 kube-proxy/eBPF agent 健康和 Node 规则。恢复后做跨 Node、同 Node、IPv4/IPv6 和 sessionAffinity 测试。
>
> **易错点：** 我不会重启所有 kube-proxy 试运气，也不会只看 Endpoints 数量忽略 readiness 和端口。具体数据面可能不是 iptables；这里是演练方法。

### Q041：滚动发布期间出现 5xx，怎样判断是新版本、Readiness 还是连接 Drain？

> **口语化回答：** 我会立即暂停 rollout，按版本和 Pod 分桶错误；若新版本明确异常就回滚。保留 Deployment revision、ReplicaSet、Pod readiness 时间、EndpointSlice 变化、网关 upstream 和应用关停日志，再区分新 Pod 过早接流、旧 Pod 摘流不及时、Schema 不兼容或代码回归。
>
> **深入追问：** 我会用 `kubectl rollout status/history`、`kubectl get rs,pod -w`、`kubectl describe deployment`，对齐 preStop、SIGTERM、terminationGracePeriodSeconds、LB/代理连接复用和 readiness。根修采用 expand-and-contract、startup/readiness、停止接新流量后有界 drain；再做带长连接的滚动故障测试。
>
> **易错点：** 我不会把 readiness 失败等同已有连接立即断开，也不会直接执行 rollout restart。PDB 不保证发布零 5xx；这里是演练流程，真实事故需证据。

### Q042：HPA 扩缩容抖动或越扩越慢，怎么排查？

> **口语化回答：** 我会先设置安全的最小副本和扩缩速率，保护下游，保留 HPA desired/current、指标延迟、Pod 启动时间、队列和请求错误。抖动可能来自指标噪声、采集延迟、request 配错、冷启动、短周期负载或扩容后数据库/Provider 被打满。
>
> **深入追问：** 我会用 `kubectl describe hpa`、`kubectl get hpa -w`、`kubectl top`，对齐 custom metric 原始值、missing metrics 和 rollout；检查 behavior 的 stabilizationWindow 和 scaleUp/scaleDown policy。根修选择能反映瓶颈的指标，例如队列 lag/oldest age，同时限制每 Pod 下游并发，压测扩缩完整闭环。
>
> **易错点：** 我不会只提高 maxReplicas，也不会用 CPU 平均值代表长任务 backlog。每个新 Pod 会放大连接池和缓存预热，HPA 不是下游容量生成器；本题不冒充事故。

### Q043：Node `NotReady`，怎样 cordon、drain、恢复而不扩大故障？

> **口语化回答：** 我会先确认是单 Node 还是控制面/网络共因，cordon 阻止新调度，核对关键副本和本地状态；若 Node 无法恢复且业务允许，再按 PDB、StatefulSet、DaemonSet 和 emptyDir 风险执行受控 drain。保留 Node conditions、kubelet/runtime、网络和系统日志。
>
> **深入追问：** 我会用 `kubectl describe node`、`kubectl get lease -n kube-node-lease`、`kubectl get pod -A --field-selector spec.nodeName=NODE`，再看 kubelet、container runtime、磁盘、时间同步和 CNI。修复后确认 Node Ready、网络和运行时稳定，再 uncordon，并验证被迁移工作负载和卷 attach。
>
> **易错点：** 我不会对失联 Node 盲目 `drain --force --delete-emptydir-data`，也不会忽略单副本和本地盘。这里是 runbook 演练，不代表我处理过真实 Node 事故。

### Q044：etcd 怎么做一致快照、恢复和恢复后验证？

> **口语化回答：** 我会把 etcd 恢复当高风险控制面操作，先隔离故障、停止自动化写入并确认多数派和当前成员；优先从健康 endpoint 获取维护的 snapshot，记录 revision、hash、集群和证书信息。恢复在隔离的新数据目录和明确 runbook 中进行，不覆盖唯一原数据。
>
> **深入追问：** 我会用与部署版本匹配的 `etcdctl endpoint status --cluster -w table`、`endpoint health`、`snapshot save`、`snapshot status`；恢复后验证成员、alarm、revision、API Server 读写和核心对象。Kubernetes watch 对 revision 回退敏感，是否需要 revision bump/mark compacted 要按官方版本化恢复流程执行。
>
> **易错点：** 我不会在活跃集群随意 restore，也不会把复制副本当备份。命令需要证书和敏感 endpoint，输出要受控；这里是恢复演练设计，不冒充亲历，真实执行必须审批和双人复核。

### Q045：Pod 长时间 `Terminating`，Finalizer、PreStop、卷卸载和强删怎么查？

> **口语化回答：** 我会先确认业务是否还在接流、是否持有 Lease 或本地数据，避免为了界面干净强删；保留 Pod deletionTimestamp、finalizers、events、container 状态和 Node 可达性。然后区分 preStop/应用 drain 卡住、进程不响应 SIGTERM、卷 detach、网络清理、finalizer controller 失败或 Node 失联。
>
> **深入追问：** 我会用 `kubectl get pod POD -o yaml`、`kubectl describe pod`、Controller/CSI/CNI 日志和 Node 状态定位；确认外部资源已安全清理后，才按 runbook 修复 controller 或移除特定 finalizer。恢复后验证没有双实例副作用、卷多重挂载或旧 endpoint 残留。
>
> **易错点：** 我不会默认 `--force --grace-period=0` 是修复，它只会让 API 对象消失，不保证 Node 上进程已停。强删有状态 Pod 可能造成双写；这里是演练方法。

## 三、分布式原理（Q046-Q060）

### Q046：线性一致、顺序一致、因果一致和最终一致怎么区分？

> **口语化回答：** 我会先按外部可观察语义区分：线性一致要求每个操作像在调用与返回之间某一瞬间生效，并尊重真实时间先后；顺序一致只要求所有参与者同意一个与各自程序顺序一致的全局顺序；因果一致只固定有因果关系的先后；最终一致只承诺停止新写后副本最终收敛。
>
> **深入追问：** 我会通过历史记录和并发操作说明模型，而不是说“强一致就是马上同步”。实现线性一致通常需要 Leader/共识、quorum 或单点序列化，但仍要定义读走哪条路径、故障时拒绝还是返回旧值。模型是单个对象、事务还是整个系统的承诺也要说清。
>
> **易错点：** 我不会把最终一致理解成可以无限错误，也不会把复制延迟小等同线性一致。面试现场要先问业务需要哪一种读写保证，再选成本。

### Q047：数据库 Serializable 和分布式线性一致为什么不是一回事？

> **口语化回答：** 我会说 Serializable 主要约束并发事务结果等价于某个串行顺序，但这个顺序不一定尊重真实时间；线性一致约束单次操作的实时顺序，但不自动提供多对象事务。Strict Serializable 才把事务串行化和真实时间要求结合起来。
>
> **深入追问：** 我会举两个互不重叠事务：前一个已经返回后，后一个才开始，普通 serializable 的理论模型未必仅靠名称保证实时顺序。具体数据库实现还可能通过 SSI、锁或时间戳提供不同异常和重试语义，不能只看隔离级别字符串。
>
> **易错点：** 我不会把 ACID 的 C 与 CAP 的 C 混淆，也不会说用了 Serializable 就无需业务唯一约束、幂等和外部副作用治理。

### Q048：Read-your-writes、Monotonic Reads 和 Causal Consistency 有什么实际价值？

> **口语化回答：** 我会说这些是比全局线性一致更有针对性的会话保证。Read-your-writes 确保用户写完能读到自己的结果；Monotonic Reads 防止先看到新版本又退回旧版本；因果一致保证“回复”不会先于它依赖的“原消息”出现。
>
> **深入追问：** 我会用版本、提交位点、session token 或 sticky routing 实现：客户端携带已见版本，副本追到该版本才读，否则等有界时间、切主或明确降级。跨设备或跨会话是否延续 token，是产品和身份边界问题。
>
> **易错点：** 我不会用固定 sleep 等副本，也不会把粘同一副本当永久保证，副本切换后仍要比较版本。业务若只需会话一致，就不必为所有读支付全局强一致成本。

### Q049：N、R、W 的 Quorum 为什么依赖交集？`R + W > N` 就绝对安全吗？

> **口语化回答：** 我会说经典 quorum 通过读集合与写集合相交，让读有机会看到最新写；`R + W > N` 保证集合大小上的交集，`W + W > N` 可让并发写集合相交。但它只是基础条件，不自动解决节点返回旧版本、并发冲突和网络分区。
>
> **深入追问：** 我会继续要求版本比较、冲突解决、read repair、hinted handoff 和失败节点恢复协议。Sloppy quorum 可能在临时替代节点上写，集合不再是固定 N 个副本，简单公式的含义会变；动态成员和跨地域延迟也要纳入。
>
> **易错点：** 我不会只背公式就宣称线性一致，也不会把“收到 W 个响应”当所有副本已持久化。要看响应来自哪些成员、版本规则和 Leader/无 Leader 架构。

### Q050：CAP 和 PACELC 怎样用于真实系统，而不是背“三选二”？

> **口语化回答：** 我会说网络分区发生时，系统必须决定更偏一致还是可用；平时没有分区时，仍要在延迟和一致性之间取舍，这就是 PACELC 提醒我的部分。不是整个产品一次性选 CP/AP，而是每类数据和操作各自定义降级。
>
> **深入追问：** 我会问分区时订单创建能否拒绝、商品描述能否读旧、余额写是否必须停；再定义错误码、最大陈旧窗口、冲突合并和恢复对账。网络分区也不是二元开关，延迟、丢包、单向可达和故障检测误判都会影响决策。
>
> **易错点：** 我不会说 CA 系统在真实分布式环境永远不考虑 P，也不会用 BASE 为数据错误开脱。选择必须落到接口语义和恢复流程。

### Q051：Raft Leader 选举如何保证同一 Term 最多一个合法 Leader？

> **口语化回答：** 我会说节点超时后递增 term、转 Candidate、先投自己并请求投票；每个节点在同一 term 最多投一票，候选拿到多数才成为 Leader。随机选举超时降低多个 Candidate 持续碰撞的概率，收到更高 term 消息必须退回 Follower。
>
> **深入追问：** 我会强调投票还要比较候选日志是否至少和自己一样新，防止缺关键已提交日志的节点当选。多数集合相交是安全基础，但时钟只用于超时和活性，不用于决定日志正确性；网络不稳定时可能反复换 Leader。
>
> **易错点：** 我不会说 Raft 依赖全局精准时钟，也不会说拿到最多票而非多数就能上任。Pre-vote 等扩展用于减少隔离节点抬高 term，具体看实现版本。

### Q052：Raft 日志复制、Commit Index 和“已提交不丢”怎样证明？

> **口语化回答：** 我会说 Leader 给日志带 term/index，通过 AppendEntries 让 Follower 匹配前缀后追加；一条当前 term 日志复制到多数后，Leader 推进 commitIndex，再按顺序应用状态机。后续任何 Leader 也要来自与该多数相交的选举集合，并满足日志新鲜度规则。
>
> **深入追问：** 我会讲冲突日志截断、nextIndex/matchIndex 回退，以及为什么旧 term 日志不能仅靠“它现在在多数副本上”随意单独提交，而是随当前 term 已提交条目一起被覆盖证明。客户端响应应在承诺的持久化/提交点之后。
>
> **易错点：** 我不会把“写到 Leader 内存”说成提交，也不会认为 Follower apply 慢就一定没复制。复制、提交和状态机应用是三个位置指标。

### Q053：Raft Snapshot、日志压缩和成员变更为什么需要专门协议？

> **口语化回答：** 我会说日志无限增长不现实，所以状态机可生成包含 lastIncludedIndex/Term 的 snapshot，落后太多的 Follower 通过安装快照追上，再接增量日志。成员变更不能直接从旧集合瞬间切新集合，否则两个不相交多数可能各自做决定。
>
> **深入追问：** 我会解释 joint consensus 或实现规定的单节点逐步变更，让过渡期决策同时受旧、新配置约束。Snapshot 要和状态机数据一致并原子发布，安装中断可重试；压缩后仍要保留匹配和恢复所需元数据。
>
> **易错点：** 我不会把删除旧日志当备份，也不会一次替换多数成员。具体成员变更能力因 etcd、Consul 等实现而不同，必须按版本 runbook。

### Q054：Lease 为什么受暂停和时钟影响？什么时候不能只靠 TTL？

> **口语化回答：** 我会把 Lease 说成有期限的权限：协调系统认为到期后可以给新持有者，但旧进程可能因 GC、调度暂停或网络隔离没有及时知道自己失效，恢复后仍尝试操作。TTL 只能约束协调记录，不会自动阻止旧持有者访问外部资源。
>
> **深入追问：** 我会优先用协调服务端时间和续租结果，给客户端留安全余量，但最终对关键写使用 fencing token。持有者在每次副作用前携带单调 token，资源端拒绝小于已见版本的请求，才能挡住“死而复生”的旧 owner。
>
> **易错点：** 我不会用本机 wall clock 直接判断自己一定持锁，也不会把续租线程还活着当业务线程仍有权限。长 STW、网络单向故障和进程 suspend 都要演练。

### Q055：Fencing Token 怎样与数据库、对象存储或任务执行配合？

> **口语化回答：** 我会说每次成功取得租约时拿一个单调递增 token，写资源时一起提交；资源记录最后见过的 token，并拒绝更小 token 的旧 Worker。`token == last_seen` 能不能继续写要看协议：同一租约允许多次操作时，还要靠业务版本、操作序号或幂等键判断；如果每个租约只授权一次写，才可以要求严格大于。
>
> **深入追问：** 数据库里我会把规则写成“先拒绝 `incoming_token < last_token`，同 token 再比较 operation version 或 idempotency key”，也可以使用资源服务原生条件写。如果业务定义每个 Lease 只允许一次操作，才用 `WHERE last_token < ?` 这种严格条件。Token 必须由强一致序列产生，资源端必须真正校验；多个资源的原子性仍不因一个 token 自动解决。
>
> **易错点：** 我不会只在日志里打印 token 就称 fencing，也不会用可回拨时间戳当严格单调序列。资源不支持条件写时，要重构副作用边界或接受风险。

### Q056：脑裂是怎么发生的？恢复时为什么不能只选“看起来还活着”的节点？

> **口语化回答：** 我会说脑裂是不同分区各自认为有权提供冲突操作，常见原因是网络分区、故障检测误判、仲裁配置错误或旧主未 fencing。现场先停止或隔离至少一侧写入，保留各节点 term/epoch、日志位点和客户端路由，避免冲突继续扩大。
>
> **深入追问：** 我会比较哪一侧拥有合法多数、最新已提交日志和更高 epoch，再按系统协议选权威历史；旧主必须被 STONITH、凭据撤销、路由隔离或资源 fencing。恢复后对差异数据分类合并/补偿并做业务对账，不能把文件较大直接当更新。
>
> **易错点：** 我不会同时保留双写以“提高可用性”，也不会未经数据分析让旧节点重新加入。这里是故障演练，不冒充本人事故；真实恢复必须按产品 runbook。

### Q057：心跳和 Failure Detector 为什么只能“怀疑”，不能证明进程已死？

> **口语化回答：** 我会说在异步网络里，没收到心跳可能是进程死了，也可能是网络延迟、GC、CPU 饥饿或单向丢包。故障检测器只能在超时和误判之间取舍，所以“判故障”要和 quorum、epoch、fencing 配合，不能直接授予两个节点写权限。
>
> **深入追问：** 我会看连续丢失、RTT 分布、phi accrual 或多观察者证据，按服务类型设置检测和恢复门槛。恢复要渐进探测、半开流量和稳定窗口，防止节点在 healthy/unhealthy 间抖动；告警也要区分探测失败和业务失败。
>
> **易错点：** 我不会只 ping 一次就摘节点，也不会把 timeout 设极短追求“秒级恢复”。更快检测会提高 false positive，必须用历史分布和故障演练校准。

### Q058：服务注册发现怎样处理实例上线、下线、缓存和健康抖动？

> **口语化回答：** 我会说实例注册身份、地址、版本和元数据，通过 Lease/心跳维持；客户端或代理 watch 注册表并维护本地快照。新实例只有 readiness 和预热完成后才接流，关停先从发现系统摘除再 drain 已有连接。
>
> **深入追问：** 我会给更新带 revision/version，watch 断线后从已知版本续接，若历史已 compact 就全量 resync；本地缓存要有最后更新时间、最大陈旧窗口和降级策略。健康抖动用连续阈值、渐进权重和恢复稳定期处理。
>
> **易错点：** 我不会说注册中心是流量代理，也不会让实例一启动就注册 Ready。客户端连接池不会因注册表删除立即断开，摘流和连接 drain 必须配套。

### Q059：配置中心推送怎样避免丢事件、乱序和半应用？

> **口语化回答：** 我会给每版配置稳定 version、schema 和 checksum，客户端先拉完整快照、校验，再原子替换当前只读引用；watch 只作为变化通知，断线重连后按 version 补拉，而不是把每条事件当唯一事实源。
>
> **深入追问：** 我会设计 staged/canary 发布、旧新版本兼容、失败保留 last-known-good、回滚和审计。多个相关键要么组合成一版快照，要么有显式事务/依赖顺序，防止一半新一半旧。Secret 轮换还需双凭据窗口。
>
> **易错点：** 我不会在回调线程边收事件边原地修改全局 Map，也不会因 watch 没报错就认为配置最新。版本倒退和 Schema 不兼容应拒绝并告警。

### Q060：分布式调用超时后，为什么结果是 Unknown？重试怎样不重复副作用？

> **口语化回答：** 我会说客户端超时只证明没及时收到响应，服务端可能没收到、正在执行、已经成功但响应丢了，状态是 Unknown。读和天然幂等操作可按 deadline 有界重试；写操作要带稳定 idempotency key，服务端原子记录请求摘要、状态和结果。
>
> **深入追问：** 我会让重复同 key 同请求返回原结果，同 key 不同请求报冲突；处理中状态有 Lease/查询接口，Unknown 先查外部系统而不是立即重做。跨数据库/MQ 用 Outbox、消费幂等和对账收口，端到端 exactly-once 不能只靠 RPC 框架。
>
> **易错点：** 我不会换一个 requestId 重试，也不会让每层各重试三次。总 deadline、退避抖动、熔断和幂等必须统一设计。

## 四、SRE 与可观测（Q061-Q070）

### Q061：SLI、SLO、SLA 和 Error Budget 怎么落到接口上？

> **口语化回答：** 我会说 SLI 是实际测量，例如合格请求成功率和延迟；SLO 是目标，例如一个滚动窗口内的可用性；SLA 是对外承诺和后果；Error Budget 是 1-SLO 允许消耗的失败空间。先定义“哪些请求算有效、哪些算好”，再谈百分比。
>
> **深入追问：** 我会按用户旅程、租户、区域和接口分层，避免全站平均掩盖核心写接口。多窗口 burn rate 告警同时看短期急剧消耗和长期持续消耗；发布速度、功能开关和可靠性工作可按预算状态决策。
>
> **易错点：** 我不会把内部 500 数直接当用户可用性，也不会现场编一个没有历史数据的 99.99%。真实 SLO 必须由业务和监控证据确认。

### Q062：RED、USE 和四个黄金信号分别适合看什么？

> **口语化回答：** 我会用 RED 看请求型服务的 Rate、Errors、Duration；用 USE 看资源的 Utilization、Saturation、Errors；黄金信号把延迟、流量、错误、饱和度串起来。它们是检查框架，不是固定 Dashboard 模板。
>
> **深入追问：** 我会从入口 RED 发现用户影响，再用线程池/队列/连接池/CPU/内存的 USE 找资源瓶颈，并沿 Trace 到依赖。饱和度常比利用率更早暴露问题，例如 Pool Wait、run queue、队列 oldest age。
>
> **易错点：** 我不会只看 CPU，也不会为每个组件照抄同一组指标。指标必须能回答一个运维决策，否则只增加噪声和成本。

### Q063：日志、指标和 Trace 在一次故障中怎么分工？

> **口语化回答：** 我会先用指标确定影响范围、时间和趋势，用 Trace 找慢在哪个服务和阶段，再用对应日志看具体错误和受控上下文。三者通过 traceId/requestId、服务版本和统一时间关联，但不会把高基数字段都塞进指标标签。
>
> **深入追问：** 我会让日志结构化并保留错误类别、版本和业务匿名 ID；Trace Span 记录队列、连接池、SQL、HTTP 和重试；指标负责聚合 SLI 和容量。异步/MQ 跨边界通过标准 context 和 message metadata 传播，同时防止信任不受控外部 baggage。
>
> **易错点：** 我不会全量记录请求体、源码、Prompt 或 Token，也不会认为有 traceId 就自动能跨线程传播。脱敏、采样、保留和访问控制是设计的一部分。

### Q064：OpenTelemetry Context 跨 HTTP、线程池、MQ 和异步任务怎么传播？

> **口语化回答：** 我会在入口提取受信任的 W3C Trace Context，创建服务端 Span；出站 HTTP 注入子 Span context；线程池提交时捕获、执行前安装、finally 清理；MQ Producer 把 context 写消息 header，Consumer 建新的消费 Span 并用 link 或 parent 表达关系。
>
> **深入追问：** 我会验证 traceId 连续但 spanId 每阶段不同，Context 不跨租户串号，采样位和 baggage 有大小/白名单限制。批量消费一条 Span 对多个消息可用 links，长异步任务通过持久 runId 关联，不能让内存 Context 成唯一进度。
>
> **易错点：** 我不会直接信任外网传入的任意 trace/baggage 字段，也不会在 Worker 结束后漏清 ThreadLocal。Context 传播正确不代表业务事务也跨线程。

### Q065：P99、Histogram 和平均值有哪些常见统计陷阱？

> **口语化回答：** 我会说平均值会掩盖少量很慢请求，P99 表示该窗口约 99% 样本不超过它，但样本量、小流量和聚合方式都会影响解释。Histogram 用固定 bucket 累计，能跨实例聚合近似分位数；客户端 Summary 分位数通常不能直接平均。
>
> **深入追问：** 我会让 bucket 覆盖 SLO 边界和真实长尾，按路由/版本/区域分桶但控制基数；对比服务处理时间与端到端时间。`histogram_quantile` 的结果是 bucket 插值近似，窗口和 scrape 丢失也要说明。
>
> **易错点：** 我不会把各实例 P99 再平均，也不会在只有几十个样本时过度解释 99.9。监控必须同时显示请求量和错误，否则“延迟变好”可能只是请求全失败了。

### Q066：怎样设计低噪声、可行动的告警和多窗口 Burn Rate？

> **口语化回答：** 我会让告警对应用户影响或即将耗尽的硬容量，并附 owner、范围、Dashboard 和 runbook。SLO 告警用短窗口高 burn 捕获急性故障，用长窗口较低 burn 捕获慢性消耗，两者组合减少瞬时噪声。
>
> **深入追问：** 我会区分 page、ticket 和 dashboard；告警表达症状，根因指标用于诊断。发布、维护和依赖故障要有抑制/关联，但不能永久静音。每次 page 后复盘是否及时、准确、可行动，并删除无人负责的告警。
>
> **易错点：** 我不会为 CPU 超 80% 一律半夜叫人，也不会只看单点瞬时阈值。阈值要从容量、SLO 和历史基线推导，不能现场编造。

### Q067：采样和高基数怎样兼顾故障可见性与成本？

> **口语化回答：** 我会让指标标签只保留有界维度，repoId、userId、traceId 等放日志或 Trace 属性。Trace 可用 head sampling 控制基础成本，再用 tail sampling 优先保留错误、慢请求和重要租户，同时留少量正常样本做基线。
>
> **深入追问：** 我会监控 collector queue、drop、export error 和每类样本保留率；tail sampling 需要在决策前汇聚完整 Trace，会增加内存、延迟和部署复杂度。故障时临时提高采样也要限范围、时间和敏感字段。
>
> **易错点：** 我不会把 traceId 放 Prometheus label，也不会只采错误导致无法比较正常路径。采样后统计外推必须知道权重和偏差。

### Q068：怎样用 Little's Law 和排队指标做容量估算？

> **口语化回答：** 我会用稳定系统里的 `L = λW` 把在途数、吞吐和平均停留时间联系起来，例如请求率不变但耗时翻倍，在途和连接需求也会接近翻倍。它帮助我检查线程池、连接池和队列量级，但不能替代压测和尾延迟分析。
>
> **深入追问：** 我会测服务时间、Pool Wait、队列长度/oldest age、到达突发、重试和下游上限，按峰值和故障余量估算。系统不稳定、流量非平稳或重尾分布时，简单平均公式会失真，所以必须做阶跃、突发和依赖变慢测试。
>
> **易错点：** 我不会用“CPU 核数乘固定系数”算所有线程池，也不会让入口并发超过数据库/Provider 总容量。真实 QPS 和 SLA只按内部压测证据回答。

### Q069：Runbook、Incident Timeline 和无责复盘各要记录什么？

> **口语化回答：** 我会让 Runbook 写触发条件、风险、只读取证、止损动作、回滚、升级联系人和恢复判据；Incident Timeline 记录事实发生时间、观察、决策和执行者；复盘聚焦系统为什么允许错误发生和扩大，而不是找个人背锅。
>
> **深入追问：** 我会区分根因、触发因素、放大因素和探测/恢复缺口，Action Item 必须有 owner、期限和验收证据。重要命令及输出引用要脱敏保留；不确定推断在时间线中标为假设，后续用证据更新。
>
> **易错点：** 我不会把“加强责任心”当修复，也不会在故障中边猜边改却不记录。没有真实事故时可做 GameDay 复盘，但必须标为演练。

### Q070：Chaos Engineering 怎样证明系统会恢复，而不是只证明能把它弄坏？

> **口语化回答：** 我会先定义 steady-state 指标和业务不变量，再选最小故障半径、明确 abort 条件和回滚。实验可以杀单 Pod、延迟依赖、断网络、重复消息或耗尽池，但目标是验证检测、降级、恢复和数据正确性。
>
> **深入追问：** 我会先在 Fake/测试环境，再 canary 到生产；同时记录告警是否触发、自动化是否误动作、恢复耗时、队列和副作用对账。实验后确认资源、网络规则和故障注入全部清理，并把发现固化进测试和 runbook。
>
> **易错点：** 我不会在没有观测和停止开关时直接 Chaos，也不会只看 HTTP 恢复 200。数据重复、丢失和旧 Worker 复活必须单独验证；没有做过真实实验就如实说设计方案。

## 五、综合故障演练（Q071-Q080）

### Q071：接口平均延迟正常但 P99 飙升，怎么做跨层定位？

> **口语化回答：** 我会先按版本、实例、区域、路由和状态码隔离坏分组，必要时摘实例、回滚和关闭无效重试；保留慢请求 exemplar、Trace、线程/连接池、GC 和下游时间。然后从入口 queue、应用执行、DB、缓存、HTTP 和网络逐 Span 找长尾。
>
> **深入追问：** 我会结合 Histogram bucket 和 trace exemplar，查 Pool Wait、队列 oldest age、`ss -ti`、慢 SQL、Redis slowlog、JFR/采样 profile；对比慢样本是否大请求、冷缓存、单坏 Node 或重试。恢复后以相同分桶验证 p99、错误率、吞吐和资源，而不是只看平均值。
>
> **易错点：** 我不会一上来扩全部副本，也不会把采不到的慢 Trace当不存在。这里是演练题，不冒充本人事故；真实阈值必须有监控证据。

### Q072：多系统日志里看到下游报错，怎样用拓扑、Trace 和错误码找到真正根因？

> **口语化回答：** 我会先控制故障流量并冻结变更，保留告警时间、traceId、错误码、服务版本和拓扑快照。以失败 Trace 为主线，从入口 Span 沿 parent/child 和 service dependency 逐跳找“第一个异常”，把后续级联错误与最早的超时、资源饱和或错误响应分开。
>
> **深入追问：** 我会说明拓扑来自服务清单、Kubernetes Service/Endpoint、网关路由和 Trace 聚合，不靠模型凭空生成；存储带节点、边、版本和有效时间。命令层用日志平台按 traceId/error code 查，`kubectl get pod -o wide` 对版本/Node，Trace 对阶段耗时，再到具体 DB/MQ/网络证据。恢复后用同请求和反事实健康路径验证。
>
> **易错点：** 我不会把“报错服务”直接认作根因，也不会让大模型仅凭相似日志自动修代码上线。模型可以归并证据和提候选，最终因果要由时间、拓扑和可复现实验确认；这是演练方法。

### Q073：下游抖动引发超时、重试风暴和级联故障，怎么止住？

> **口语化回答：** 我会先在最外层或统一调用层减少重试、限流、熔断坏下游并降级非关键功能，保护线程池和数据库；保留原始错误率、在途、每层重试次数和 deadline。然后画调用扇出，算一次入口请求在最坏配置下会放大成多少下游请求。
>
> **深入追问：** 我会用 Trace 的 retry attempt、客户端池等待、线程队列和下游 saturation 证明放大链；根修是端到端 deadline、只在一层对可重试错误退避加抖动、写请求幂等、并发隔离和半开探测。恢复时渐进放量，确认请求放大倍数、p99 和错误预算恢复。
>
> **易错点：** 我不会在每层各重试三次，也不会一熔断就立即全量探测恢复。这里是故障演练，不代表亲历；阈值要由实测校准。

### Q074：线程池满、数据库连接池空、请求全超时，如何判断谁是因谁是果？

> **口语化回答：** 我会先限入口、关闭非关键任务并回滚近期变更，保留线程 dump、线程池 active/queue/reject、DB pool active/idle/wait、慢 SQL 和锁等待。按时间顺序看是 SQL/事务先变慢占住连接，还是线程先被其他阻塞占满导致连接归还不及时。
>
> **深入追问：** 我会连续抓低风险线程栈，检查 `jcmd PID Thread.print`、Hikari 等 pool metric、数据库 activity/locks 和 Trace 的 acquire span。恢复可终止经确认的异常长事务或隔离坏查询；根修要缩短事务、finally 归还、对齐线程与连接容量、设置获取超时，并做依赖变慢压测。
>
> **易错点：** 我不会只加线程和连接，也不会随意 kill 正常大事务。队列变短可能只是请求被拒绝，验证必须同时看成功率和业务状态；本题是方法。

### Q075：Redis 集群不可用时，怎样防止回源数据库被打垮？

> **口语化回答：** 我会先按数据重要性降级：限制入口、关闭非关键查询、保留短期本地只读快照或返回明确稍后重试；对回源做全局并发上限和请求合并，不能让所有 miss 直接穿库。保留 Redis 节点/slot、客户端连接、错误和数据库负载现场。
>
> **深入追问：** 我会用客户端分阶段 Trace、Redis cluster info/nodes、slowlog/latency 和 DB QPS/Pool Wait 判断是集群故障、DNS/连接池还是慢命令。恢复缓存时分批预热并加 TTL 抖动，避免瞬时回填洪峰；最后对账缓存版本和事实源。
>
> **易错点：** 我不会无限重试 Redis，也不会在数据库已满时旁路所有缓存。这里是演练设计，不冒充真实事故；降级数据能否读旧要由业务定义。

### Q076：Kafka 积压同时伴随重复和乱序，完整恢复步骤是什么？

> **口语化回答：** 我会先保护下游、暂停有毒发布，按 Topic/Partition 保存生产率、完成率、lag、oldest age、rebalance 和错误；积压看容量，重复靠幂等，乱序靠 key/version 状态机，三件事不能用“多开 Consumer”一起解决。
>
> **深入追问：** 我会算净清理速度和 ETA，定位热点 Partition、慢 DB/API 或毒消息；保持原 eventId 隔离 DLQ，按 key/version 拒绝旧事件。恢复时分优先级限速清积压，提交安全 offset，最后对账消息输入、幂等记录和业务状态。
>
> **易错点：** 我不会重放时换 eventId，也不会为提速关闭幂等。Consumer 超过 Partition 数无收益，扩容还可能打垮数据库；本题不是事故声明。

### Q077：一次 Kubernetes 发布造成 502、旧新 Schema 不兼容和任务重复，怎么一起处理？

> **口语化回答：** 我会先暂停/回滚应用版本、停止新任务领取并保护数据库，保留 revision、Pod/endpoint 时间线、迁移记录和任务 attempt。502 按 readiness/drain 查，Schema 按旧新兼容窗口查，重复任务按 Lease、幂等 key 和执行账本查。
>
> **深入追问：** 我会用 `kubectl rollout history/status`、EndpointSlice、网关 upstream log、数据库 migration history 和任务表重建时间线。恢复采用向后兼容版本、必要的数据修复与对账；根修是 expand-and-contract、迁移单独门禁、Worker drain/fencing 和发布演练。
>
> **易错点：** 我不会只 rollout undo 就宣布结束，因为数据库和外部副作用可能无法自动回滚。这里是综合演练，真实动作必须按内部 runbook。

### Q078：全站部分地域同时出现 DNS 慢和 TLS 失败，怎样避免误判成应用故障？

> **口语化回答：** 我会先按地域、运营商、resolver、目标 IP 和证书节点分桶，切已验证备用入口或 CDN 路径；保留客户端 DNS/TLS 错误、权威记录、证书链和 LB 节点。应用内部成功率只能证明收到请求后的路径，不能排除入口前故障。
>
> **深入追问：** 我会从各地域探针运行 `dig @resolver`、`curl -v --resolve` 和 `openssl s_client -servername`，对齐 DNS TTL/rcode、SNI、证书 serial 和 LB 后端；受控抓包看是否 DNS 超时或 TLS alert。恢复后持续跨地域探测到 TTL 窗口结束，并检查旧长连接。
>
> **易错点：** 我不会因单个办公室网络正常就否定用户故障，也不会用关闭证书校验止损。这里是演练方法，外部供应商结论也要用自身证据验证。

### Q079：多可用区网络分区后出现双写和数据差异，恢复顺序是什么？

> **口语化回答：** 我会先停止至少一侧写并 fencing 旧 Leader，保存 term/epoch、提交位点、客户端路由和差异数据，先保护正确性再追可用性。确认哪一侧持合法 quorum 和最新已提交历史，再恢复单一权威写路径。
>
> **深入追问：** 我会按业务键和版本对比两侧增量，把已确认提交、未确认和冲突写分开；可自动合并的按规则处理，不可逆副作用进入人工/补偿。网络恢复后旧节点先重同步和校验再加入，最后跑跨区切换、fencing 和 RPO/RTO 演练。
>
> **易错点：** 我不会按机器时间选“最新”数据，也不会让两侧继续写等之后再说。这里是高风险恢复演练，不冒充真实经历；执行需明确决策人和审计。

### Q080：Agent 长任务显示 Running、SSE 已断、Tool 可能执行成功，怎么恢复而不重复副作用？

> **口语化回答：** 我会先停止该 Run 的自动重试和旧 Worker Lease，保留 runId、stepId、attempt、SSE eventId、Tool idempotency key、远端请求 ID 和 Trace。客户端断流只说明传输断了，不代表 Run 失败；Tool 超时也可能已经成功，所以状态先标 Unknown，而不是直接重做。
>
> **深入追问：** 我会查持久 Run/Step/Execution 账本、Worker heartbeat、Provider/Tool 查询接口和外部业务状态；确认成功就补写结果和后续状态，确认未执行才用同 idempotency key 重试，无法确认则人工决策或补偿。恢复 SSE 按 last event ID 重放已持久事件，不重新生成副作用。
>
> **易错点：** 我不会把 Kubernetes 重启、Checkpoint 或 Kafka exactly-once 当外部 Tool 自动幂等，也不会让旧 Worker 恢复后继续写。这里是架构与故障演练，当前三个项目是否已有完整分布式 Run 账本必须按源码事实回答。

## 六、学习与演练顺序

1. 我会先用 Q001-Q020 建立“客户端 -> 内核 -> 代理 -> 应用”的证据链，确保每个网络结论至少能说出一个反证方法。
2. 我会再用 Q021-Q045 练 Kubernetes 期望状态与实际状态的对照，先看对象、事件和 endpoint，再进入 Node 与数据面。
3. 我会用 Q046-Q060 证明一致性和故障权限，重点掌握 quorum、Raft、Lease、fencing、Unknown outcome，而不是只背名词。
4. 我会把 Q061-Q070 的 SLI、Trace、采样、容量和 Runbook 接到每道故障题上，确保恢复有量化判据。
5. 最后我会对 Q071-Q080 做限时演练：前 2 分钟确认影响和止损，接着保现场、提出可证伪假设，最后给恢复、根修和验证；没有内部记录的事故与指标一律不补造。
