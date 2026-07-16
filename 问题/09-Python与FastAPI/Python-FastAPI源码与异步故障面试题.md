# Python、asyncio、ASGI 与 FastAPI 源码和故障面试题

> 定位：这是现有 120 道 Python/FastAPI 基础题的第二层追问，专门训练源码路径、运行时状态、线上故障和现场手写。所有回答都使用第一人口语化表达。
>
> 项目边界：CodeWiki 使用 Python/FastAPI，但本文出现的 CPython 源码、Free-threaded Python、Uvicorn 多进程、复杂故障和手写方案不自动代表当前项目已经采用或本人经历过。面试时先说知识、演练或迁移设计，再按真实代码和 RACI 认领个人经验。

## 一、CPython 对象模型与运行时源码（Q001-Q012）

### Q001. `PyObject`、引用计数和循环 GC 是怎样配合的？

**口语化回答：**

> 我会先把两套机制分开。大多数 CPython 对象头里有类型指针和引用计数，强引用增减会改变计数，归零时通常立即析构；但两个容器互相引用时，计数都不为零，所以还需要分代循环 GC 去找“外部不可达但内部成环”的容器对象。不是所有对象都参加循环 GC，纯标量通常没必要被追踪。

**深入追问：** 面试官继续问时，我会讲 `tp_traverse`、`tp_clear`、GC generations、`gc.is_tracked()`，以及扩展类型如果漏实现遍历和清理钩子为什么会泄漏。

**易错点：** 不要说“Python 全靠 GC”或“引用计数能解决所有内存回收”；`del x` 删除的是名字绑定，不保证对象当场释放。

### Q002. `pymalloc` 的 Arena、Pool、Block 是什么，RSS 为什么不一定下降？

**口语化回答：**

> 小对象通常先走 CPython 的私有分配器：Arena 切成 Pool，Pool 再服务固定大小等级的 Block；大对象或不适合的请求再走系统分配器。对象释放后，Block 可以回到 Pool，但只要一个 Arena 里还有活对象，整块地址空间就未必能归还操作系统，所以 Python 堆已经空了很多，RSS 仍可能保持高位。

**深入追问：** 我会结合 `PYTHONMALLOC`、`tracemalloc`、对象数量和 RSS 区分 Python 层存活、分配器碎片、C 扩展缓存和真正的系统泄漏。

**易错点：** 不能看到 RSS 不降就断言内存泄漏，也不能用 `gc.collect()` 当通用解决方案。

### Q003. CPython Dict 的 Compact Table、Hash 冲突和删除墓碑怎么工作？

**口语化回答：**

> 我会把 Dict 理解成稀疏索引加紧凑 Entry 数组。查找先算 Hash，再通过探测序列定位索引；冲突不是链表，而是继续探测。删除不能直接把槽变成从未使用，否则会截断其他 Key 的探测链，所以要保留 Dummy 墓碑；墓碑和装载率过高会触发 Resize 或重建。插入顺序来自紧凑 Entry 的组织，但它不改变 Hash 查找本质。

**深入追问：** 类实例属性还可能共享 Key Table，只为不同实例保存 Value；我也会说明 Hash 可变对象为什么不能做 Key，以及恶意冲突为什么是安全和性能问题。

**易错点：** 不要把 Python Dict 讲成 Java HashMap 的数组加链表，也不要承诺最坏情况仍是 O(1)。

### Q004. List 的动态数组和扩容策略意味着什么？

**口语化回答：**

> List 保存的是对象指针的连续数组，不是把每个对象内容内联进去。`append` 大多数时候只写一个空槽，是摊销 O(1)；空间不够时会按一定比例过量分配并搬迁指针。中间插入和删除需要移动后续指针，所以是 O(n)。切片通常创建新 List 和新指针数组，但里面仍指向原对象。

**深入追问：** 我会继续讲浅拷贝、对象共享、`list.clear()` 和重新赋值的差异，以及大 List 频繁扩缩为何会造成峰值内存。

**易错点：** 不要说 List 元素连续存放的是完整对象，也不要把 `append` 说成严格 O(1)。

### Q005. Python `str` 的 Unicode 表示、Hash 缓存和 Intern 有什么边界？

**口语化回答：**

> CPython 会根据字符串最大码点选择更紧凑的内部宽度，字符串本身不可变，因此 Hash 可以缓存。部分标识符和常量可能被 Intern，让相同内容复用对象，但这只是实现优化，业务逻辑必须用 `==` 比内容，不能靠 `is`。字符串切片通常会产生新对象，不应该假设共享底层 Buffer。

**深入追问：** 我会提到 Unicode 码点不等于用户看到的 Grapheme Cluster，长度、截断和正则在 Emoji、组合字符场景要按产品语义处理。

**易错点：** 小字符串偶然 `is` 为真不是语言保证；编码字节长度也不等于 `len(str)`。

### Q006. 属性查找时 Data Descriptor、实例字典和 Non-data Descriptor 谁优先？

**口语化回答：**

> 我会按查找顺序回答：先沿 MRO 找类属性；如果命中实现 `__set__` 或 `__delete__` 的 Data Descriptor，它优先于实例 `__dict__`；否则先看实例字典，再看 Non-data Descriptor 或普通类属性；仍没有才可能进入 `__getattr__`。函数就是典型 Non-data Descriptor，访问实例方法时通过 `__get__` 绑定 `self`。

**深入追问：** 重写 `__getattribute__` 会拦截所有属性访问，写错容易递归；ORM Field、`property` 和依赖注入框架都大量利用 Descriptor。

**易错点：** 不能简单说“实例属性永远覆盖类属性”，Data Descriptor 正是反例。

### Q007. `super()` 为什么不是“调用父类”，MRO 怎样保证协作式继承？

**口语化回答：**

> `super()` 不是写死找某个父类，而是从当前类在目标实例 MRO 中的下一个位置继续查找。多继承时只要每一层都用兼容签名并继续调用 `super()`，菱形结构就能按 C3 MRO 每个实现执行一次。直接点名父类容易跳过中间类或重复调用。

**深入追问：** 我会现场打印 `Class.__mro__`，解释无参 `super()` 依赖编译器保存的 `__class__` Cell，并说明 Mixin 应保持职责窄、构造参数可协作。

**易错点：** 不要把 MRO 说成简单深度优先，也不要在协作继承链里混用点名父类和 `super()`。

### Q008. 一段 Python 代码从 Bytecode 到 Frame 执行，大致经历什么？

**口语化回答：**

> 源码先解析并编译成 Code Object，里面有 Bytecode、常量、名字和位置表；函数调用会创建或复用执行 Frame，保存本地变量、值栈、指令位置和异常状态。解释器循环读取指令、操作栈并调用对应实现。现代 CPython 还会做自适应专门化，把稳定类型的通用指令替换成更快路径，但语义仍不能依赖这些优化。

**深入追问：** 我会用 `dis` 看指令，用 Profiler 找热点；生成器暂停时保留的核心就是执行 Frame 和指令位置，而不是重新从函数开头跑。

**易错点：** 不要说 Python 每行都重新解析，也不要把 Bytecode 当跨版本稳定 ABI。

### Q009. Generator、Native Coroutine 和 Async Generator 的暂停状态有什么不同？

**口语化回答：**

> 三者都会保存 Frame 和局部状态，但协议不同：Generator 用 `yield` 产值，Coroutine 通过 `await` 把控制权交给可等待对象，Async Generator 则用异步迭代协议逐项产值。暂停不是创建线程，只是把当前执行状态挂起；恢复时从保存的指令位置继续。

**深入追问：** 资源清理要考虑 `close()`、`aclose()`、`GeneratorExit` 和取消；如果异步生成器没有被完整消费，仍要显式关闭或用 `async with` 管理拥有的资源。

**易错点：** `await` 一个已经完成且不挂起的对象，未必会让出执行权。

### Q010. Import Finder、Loader、`sys.modules` 和 Import Lock 怎样配合？

**口语化回答：**

> 导入先查 `sys.modules` 缓存，再通过 `sys.meta_path` 上的 Finder 找到 ModuleSpec，由 Loader 创建并执行模块。为了支持循环导入，模块对象通常会在代码执行完成前先放进缓存，因此另一边可能看到“部分初始化”的模块。导入锁防止同一模块并发初始化，但不解决设计上的循环依赖。

**深入追问：** 我会区分模块首次导入副作用和普通函数调用，说明为什么应用配置、网络连接和任务启动不应散落在模块顶层。

**易错点：** `importlib.reload()` 不会神奇更新其他模块已经持有的旧对象引用，也不是生产热升级方案。

### Q011. GIL、Per-interpreter GIL 和 Free-threaded Python 应该怎么回答？

**口语化回答：**

> 传统 CPython 的 GIL 让同一解释器里通常只有一个线程执行 Python Bytecode，但 I/O 等待和释放 GIL 的 C 扩展仍能并发。较新的版本还在推进 Subinterpreter 隔离和可选 Free-threaded 构建；这不意味着现有扩展、对象模型和性能都自动线程安全。生产选型要绑定 Python 版本、构建方式和依赖兼容性做压测。

**深入追问：** CPU 密集任务我会比较多进程、原生扩展、批处理和 Free-threaded 实测；I/O 服务则重点看连接池、线程池和 Event Loop，而不是只背 GIL。

**易错点：** 有 GIL 也会发生业务竞态；没有 GIL也不代表多线程一定线性加速。

### Q012. `__del__`、Weakref Finalizer 和循环引用为什么容易制造清理问题？

**口语化回答：**

> 析构时机受引用、循环、解释器退出和对象复活影响，所以我不把 `__del__` 当可靠资源管理。文件、连接、锁应该用 Context Manager 或明确的生命周期；需要不持有强引用的回调时可以考虑 `weakref.finalize`，但进程被强杀时任何 Python 清理都不能保证执行。

**深入追问：** 排查泄漏时我会看 `gc.get_referrers()`、`tracemalloc` 快照和对象增长趋势，同时警惕缓存、任务引用、Closure、Traceback 和 C 扩展。

**易错点：** “进程退出会清理一切”不能替代数据库事务、Lease、临时文件和外部副作用的恢复设计。

## 二、asyncio 与结构化并发源码（Q013-Q024）

### Q013. Event Loop 一次 Tick 怎样处理 Ready Queue、Timer 和 I/O？

**口语化回答：**

> 以 CPython 的 Selector Event Loop 为例，我会按实际顺序讲：先清理已取消的 Timer，并根据 Ready Queue 和下一 Timer 计算 Selector Timeout；再轮询 I/O，把就绪事件转成 Callback；然后把到期 Timer 移进 Ready Queue；最后只执行这一轮开始执行前的 Ready 快照。一个 Callback 如果长时间占着线程，后面的 I/O 和 Timer 都会一起延迟，所以 Async 服务最关键的指标之一是 Event Loop Lag。

**深入追问：** 同一 Tick 新加入的 Callback 是否本轮执行要看具体实现；业务代码不应依赖微妙顺序。需要公平时主动切分工作，而不是在一个 Callback 里跑大循环。

**易错点：** Async 并不是操作系统自动并行，Event Loop 线程上的同步 CPU 工作照样阻塞所有请求。

### Q014. `Task` 是怎样驱动 Coroutine，并被 `Future` 唤醒的？

**口语化回答：**

> Task 包住 Coroutine，并负责反复 Step。Coroutine `await` 一个未完成 Future 时，Task 把自己注册成 Future 的 Done Callback 后暂停；Future 完成，Callback 把 Task 放回 Ready Queue，下一次 Step 把结果或异常送回 Coroutine。Task 自己也像 Future，可被其他代码等待。

**深入追问：** 我会讲 Pending、Done、Cancelled 状态，以及为什么“创建 Task 后不保存引用”会失去错误观测和生命周期控制。

**易错点：** Task 创建不等于已经执行；是否开始取决于 Event Loop 何时获得控制权。

### Q015. Task Cancellation 是如何注入的，为什么取消不是立即终止？

**口语化回答：**

> `cancel()` 只是请求取消，通常在 Coroutine 下一次到达可取消的 `await` 时注入 `CancelledError`。代码可以在 `finally` 清理，也可能捕获后继续运行，所以调用方必须等待 Task 真正结束。底层线程、数据库或远端 HTTP 是否停止，要看驱动是否支持取消；超时不能自动证明外部副作用没发生。

**深入追问：** 我会说明多次取消、取消计数、`uncancel()` 的版本边界，以及清理逻辑本身也要有 Deadline。

**易错点：** 不要吞掉 `CancelledError` 后静默返回成功，也不要 `cancel()` 后不 `await`。

### Q016. `TaskGroup` 为什么比裸 `create_task()` 更接近结构化并发？

**口语化回答：**

> TaskGroup 把子任务生命周期绑定到一个词法作用域：正常退出前等待全部子任务，一个子任务非取消异常会触发同组其他任务取消，最后用 ExceptionGroup 汇总错误。这样调用方不会悄悄遗留孤儿任务，也能明确谁负责收尾。

**深入追问：** 我会比较 `gather` 的兼容行为、嵌套 TaskGroup 的取消传播，以及如何用 `except*` 按类型处理异常组。

**易错点：** 结构化并发不等于 Exactly-once；已经发生的外部写操作仍要幂等或补偿。

### Q017. `gather`、`wait`、`as_completed` 在失败和取消时的语义差异是什么？

**口语化回答：**

> `gather` 适合保持输入顺序地收集结果，但一个异常怎样传播、其他任务是否继续要看参数和版本语义；`wait` 只返回 Done/Pending 集合，不替我抛子任务异常；`as_completed` 适合谁先完成先消费，但结果顺序不再等于输入顺序。我会按失败策略和背压需要选，不只看 API 短不短。

**深入追问：** 任何模式都要给并发上限、总 Deadline 和结果去重，成千上万 Coroutine 一次性创建仍会压垮内存和下游。

**易错点：** `gather(return_exceptions=True)` 容易把失败当普通结果漏掉，必须逐项分类。

### Q018. `asyncio.timeout()`、`wait_for()` 和 `shield()` 如何影响取消？

**口语化回答：**

> Timeout 本质上通过取消当前等待来打断控制流；`wait_for` 管一个 Awaitable，Timeout Context 可以包一段代码；`shield` 只隔离外层取消对内部 Awaitable 的直接传播，不代表调用方还会等它，也不保证进程重启后继续。关键写操作如果要越过客户端断线继续，应该进入有状态任务系统，而不是无限 Shield。

**深入追问：** 我会把请求 Deadline、数据库 Statement Timeout、HTTP Timeout 和任务 Lease 统一预算，避免每层各自超时后产生幽灵工作。

**易错点：** 超时异常不等于远端动作失败；重试前先查远端状态和幂等记录。

### Q019. `contextvars` 为什么能跨 `await`，但不天然跨进程？

**口语化回答：**

> Event Loop 在创建和切换 Task 时保存并恢复 Context，所以同一线程里并发 Task 的 Trace ID 不会像普通 ThreadLocal 那样串。创建新 Task 通常会复制当前 Context；跨线程的部分 API 会传播，普通手工线程和进程则要显式传递。它适合请求级 Metadata，不适合存可变业务状态或数据库 Session。

**深入追问：** 我会检查 Framework、Middleware 和 Executor 边界是否保留 Context，并避免把用户身份只放 ContextVar 而不在下游重新鉴权。

**易错点：** ContextVar 隔离不是安全边界，值仍可能被日志或错误响应泄露。

### Q020. `to_thread` 和默认 Executor 饱和时会发生什么？

**口语化回答：**

> `to_thread` 只是把同步函数提交到线程池，让 Event Loop 不被直接阻塞；线程池任务太多会排队，延迟和内存照样上升。同步库内部如果又占数据库连接或全局锁，还会形成线程池和连接池互相等待。我要限制提交并发、监控队列等待，并优先使用真正异步驱动或独立 Worker。

**深入追问：** CPU 密集工作放线程池通常仍受 GIL 影响；Process Pool 又有序列化、启动、取消和内存复制成本。

**易错点：** `to_thread` 不是无限弹性，也不会让被取消的 Python 线程强制停下。

### Q021. Async Generator 在客户端断线或提前退出时怎样可靠清理？

**口语化回答：**

> Consumer 提前退出后，Producer 不一定自然跑到末尾，所以拥有的连接、临时文件和锁要放在 `try/finally`，并确保 `aclose()` 被调用。流式响应还要把客户端断线传播成取消信号，让上游停止拉新数据；已经提交的可靠后台任务则按业务策略继续。

**深入追问：** 我会区分 Generator 拥有资源还是只借用资源，避免内层和外层重复关闭；测试要覆盖只消费一条、超时和断线。

**易错点：** 只在正常循环末尾清理，遇到 `break`、异常和取消时会泄漏。

### Q022. Async Queue 和 Transport Backpressure 分别控制哪一层？

**口语化回答：**

> 有界 Queue 控制应用内部 Producer 比 Consumer 快的问题，满了以后 Producer 应等待、拒绝或降级；Transport 的高低水位控制 Socket 写 Buffer，`drain()` 让写方在缓冲过高时暂停。两层都需要，只有 Semaphore 限制并发并不能控制结果堆积和慢客户端。

**深入追问：** 我会给队列定义容量、等待上限、丢弃策略、优先级和 Shutdown 语义，并监控 Queue Age 而不只看长度。

**易错点：** 无界 Queue 在压测初期看似吞吐高，真正过载时会把延迟转成 OOM。

### Q023. Async 服务优雅关停时，Signal、接流量、取消和清理顺序怎样设计？

**口语化回答：**

> 收到终止信号后我会先让 Readiness 失败并停止接新请求，再给在途请求一个 Drain Deadline；后台 Consumer 停止领新任务，保存 Checkpoint 或释放 Lease；然后取消剩余 Task、等待 `finally` 清理，最后关闭 HTTP Client、数据库池和 Trace Exporter。超过总期限再强制退出。

**深入追问：** Kubernetes 的 `terminationGracePeriodSeconds`、PreStop、负载均衡摘流延迟和应用 Deadline 必须一起算。

**易错点：** 一收到 SIGTERM 就关闭数据库池，会让尚在执行的请求全部失败。

### Q024. Uvloop、多进程和 Subprocess 会改变哪些 Async 边界？

**口语化回答：**

> Uvloop 可以替换 Event Loop 实现，但不改变业务的取消、背压和幂等语义；多 Worker 是多个独立进程，内存状态、Lock、Cache 和定时任务都不共享；Subprocess 适合隔离外部命令，但要限制输入、环境、超时、输出大小和子进程树。选型必须用真实负载压测，不凭“更快”两个字上线。

**深入追问：** 我会检查目标平台、Signal、Debug 工具和 Library 兼容性，并明确一次性初始化到底每进程一次还是整个集群一次。

**易错点：** 多 Worker 后用进程内 Lock 做全局单例任务，通常会每个 Worker 各跑一份。

## 三、ASGI、FastAPI 与 Pydantic 内部链路（Q025-Q036）

### Q025. HTTP 请求在 ASGI 里具体用哪些 Message 交互？

**口语化回答：**

> Server 为每个 HTTP 请求构造一个 HTTP Scope，再调用应用并提供 `receive`、`send`；同一条 Keep-alive 连接可以先后承载多个 HTTP Scope。应用通过 `http.request` 分块读取 Body，通过 `http.response.start` 发送状态和 Header，再用一个或多个 `http.response.body` 发送正文；客户端断线可能表现为 `http.disconnect` 或发送异常。WebSocket Scope 通常对应一条 WebSocket 连接，使用另一套 Connect、Receive、Send、Close 消息。

**深入追问：** Middleware 必须正确转发 Scope 和消息，读取 Body 后如果不回放，后面的应用就可能读不到；流式响应也不能重复发送 Start。

**易错点：** ASGI 是协议接口，不负责自动提供持久任务、鉴权或流式重连。

### Q026. Uvicorn 从 Socket 到调用 FastAPI，大致经过哪些状态？

**口语化回答：**

> Listener 接受连接，HTTP Protocol Parser 解析请求并构造 ASGI Scope，创建应用 Task；应用发送响应消息后，Protocol 层编码回 HTTP，并按 Keep-alive 决定复用或关闭连接。Worker、Loop、HTTP Parser 和 Proxy Header 都是独立配置，出现 502 或断连时要先判断请求是否进入应用。

**深入追问：** 我会通过 Access Log、应用 Trace、反向代理 Upstream 状态和 Packet Evidence 划分故障层，而不是一看到 FastAPI 日志没有异常就说网络问题。

**易错点：** `--workers` 是多进程，不是一个进程里多线程共享所有状态。

### Q027. Starlette 路由匹配为什么会受声明顺序影响？

**口语化回答：**

> Router 会按注册顺序遍历 Route，判断 Path、Method 和 Host 是否匹配；更宽泛的动态路径放在具体静态路径前面，可能先吞掉请求。Mount 和子应用还会修改 `root_path`、Path Params 和 URL 生成语义，所以我会把具体路由放前面，并用契约测试覆盖冲突路径。

**深入追问：** 405 和 404 的区分、尾斜杠重定向、反向代理 Prefix 都可能影响客户端和签名验证。

**易错点：** 不要认为 Framework 一定按“最具体路径”自动排序。

### Q028. FastAPI 的 Dependency Graph、缓存和 Override 怎样工作？

**口语化回答：**

> FastAPI 启动时从 Route 签名构建依赖图，请求时递归解析参数并执行依赖。同一个依赖在同一请求、同一缓存 Key 下默认只执行一次，`use_cache=False` 才会重复；测试 Override 是替换依赖 Provider，不是全局 Monkeypatch。请求级缓存不等于跨请求缓存。

**深入追问：** Security Scope、可调用对象实例、子依赖参数都会影响依赖身份；用户和租户仍要在真正资源访问处鉴权。

**易错点：** 不要把带状态的 Session 或 Client 作为全局依赖返回后跨并发请求共享。

### Q029. `yield` Dependency 的清理时机为什么会影响 Streaming Response？

**口语化回答：**

> `yield` 前相当于进入资源，响应结束或异常后再执行退出清理。但不同 FastAPI 版本对“路径函数返回后”还是“响应真正发送完后”的清理时机有过调整，Streaming Response 尤其敏感：过早关闭 Session 会让 Generator 后续取数失败，过晚又会长期占连接。面试时我会绑定当前版本，并让 Stream 自己明确拥有或借用资源。

**深入追问：** 我会测试首块后断线、慢消费、生成器异常和服务关停，确认 Session 归还和事务回滚。

**易错点：** 不能用普通 JSON Response 的生命周期经验直接推断长流。

### Q030. `BaseHTTPMiddleware` 为什么可能影响 ContextVar 和请求体？

**口语化回答：**

> 这类 Middleware 为了提供 Request/Response 抽象，内部可能跨 Task 调用下游，导致某些 ContextVar 变化不能按预期向上传播；如果 Middleware 先消费 Body，又没有正确缓存和回放，下游也可能卡住或读空。需要底层控制时，我更倾向写纯 ASGI Middleware，显式转发消息。

**深入追问：** PII 日志、Body 大小限制和 Trace 注入都不能无界读取完整请求体；测试要覆盖 Chunked Body 和断线。

**易错点：** Middleware 能访问请求不代表适合做所有事务和业务鉴权。

### Q031. FastAPI 流式响应怎样感知客户端断线并停止上游？

**口语化回答：**

> 我会同时处理接收侧的 Disconnect、发送异常和 Task Cancellation，并把取消信号传到模型流、数据库游标或内部 Queue。短聊天可以随连接取消，长任务则只取消订阅，后台 Run 继续并持久化结果。无论哪种都要在 `finally` 释放资源，并记录最终 Run 状态。

**深入追问：** 反向代理可能缓冲响应或延迟发现断线，所以还要配置 Flush、Idle Timeout 和心跳。

**易错点：** 客户端关闭浏览器不保证服务端立刻收到取消，也不保证 Provider 已停止计费。

### Q032. SSE 的 `Last-Event-ID` 怎样做成真正可恢复的事件流？

**口语化回答：**

> 每个业务事件要有 Run ID 和单调 Event ID。服务端保留可重放事件或关键快照，重连时读取 `Last-Event-ID`，先鉴权 Run 归属，再从下一条补发；历史已经过期时返回明确的 Reset 或当前快照。逐 Token 不一定全部持久化，关键状态和最终 Artifact 必须可查。

**深入追问：** 多实例下 Event Log 放共享存储或 Stream，单调性按 Run 分区保证；慢客户端需要 Buffer 上限和断开策略。

**易错点：** Event ID 不能只用进程内自增，重启和多 Worker 会冲突。

### Q033. 大文件上传怎样避免请求体、临时文件和解压炸弹拖垮服务？

**口语化回答：**

> 我会在代理和应用两层限制 Content Length，但也不盲信 Header；Body 分块读，超过预算立即停止；大文件落受控临时目录或对象存储，不一次读入内存。还要校验真实文件类型、压缩展开大小、文件数、路径穿越，完成后异步扫描并设置保留清理。

**深入追问：** 可靠大文件更适合预签名直传、分片校验和 Complete API；应用只保存 Metadata 与状态。

**易错点：** `UploadFile` 使用临时文件不代表没有磁盘耗尽风险。

### Q034. Pydantic v2 的 Core Schema 和 Rust Validator 带来了什么？

**口语化回答：**

> Pydantic v2 会把 Python 类型和配置编译成 Core Schema，再由 `pydantic-core` 执行校验与序列化。这样公共路径更快，也让自定义类型能通过 Core Schema 明确输入、校验和输出。Model Schema 构建和每次实例校验是两阶段，动态创建大量不同模型会放大编译成本。

**深入追问：** 我会区分 Validation Schema 与 JSON Schema，说明 `TypeAdapter` 适合非 BaseModel 类型，Strict Mode 和默认 Coercion 要按边界选择。

**易错点：** Pydantic 只证明结构和声明的约束成立，不证明引用真实、金额业务合法或用户有权限。

### Q035. Field Validator、Model Validator、Serializer 的顺序怎样避免双重转换？

**口语化回答：**

> Before Validator 面对原始输入，适合归一化但必须处理任意类型；After Validator 面对已解析值，适合业务局部约束；Model Validator 处理跨字段关系；Serializer 只控制输出，不应该偷偷修正输入。我要让同一转换只发生一处，并用 Round-trip Test 防止时区、Decimal 和 Enum 被悄悄改写。

**深入追问：** Union 分支里 Before Validator 修改输入后再失败，可能影响其他分支判断；Error Location 和稳定错误码也属于 API 契约。

**易错点：** 不要在 Serializer 里做数据库查询或权限判断。

### Q036. OpenAPI Schema 变化怎样做兼容发布？

**口语化回答：**

> 我会把 OpenAPI 当契约产物做版本 Diff。新增可选字段通常向后兼容；删字段、改类型、收紧枚举、把可选改必填或改变错误结构都可能破坏客户端。发布采用 Additive Change、双读双写或版本路由，先更新 Consumer，再移除旧字段，并用契约测试验证真实 SDK。

**深入追问：** Tool Schema 和 MCP Tool 也有同样问题，暂停任务恢复时尤其要绑定原 Schema Version。

**易错点：** HTTP 仍返回 200 不代表协议兼容，语义和默认值变化也会破坏调用方。

## 四、SQLAlchemy 状态机与数据库边界（Q037-Q044）

### Q037. Session 的 Identity Map、Unit of Work 和对象状态怎样配合？

**口语化回答：**

> Session 用 Identity Map 保证同一主键在同一 Session 里通常对应同一 Python 对象，Unit of Work 收集 New、Dirty、Deleted 变化并在 Flush 时排序成 SQL。对象会经历 Transient、Pending、Persistent、Deleted、Detached 等状态。Session 是事务工作单元，不是全局仓库，也不能跨并发 Task 共享。

**深入追问：** `expire_on_commit` 会让属性下次访问重新加载；Detached 对象再访问懒加载关系会失败，API 层应该显式加载所需数据。

**易错点：** Identity Map 不是二级缓存，也不保证读到其他事务的最新提交。

### Q038. Flush 怎样决定 INSERT/UPDATE/DELETE 顺序，为什么会提前发生？

**口语化回答：**

> Flush 会根据对象依赖关系和外键生成 SQL 顺序，把内存状态同步到当前事务，但不提交。查询、Commit 或显式 `flush()` 都可能触发 Autoflush，所以未完整构造的对象可能在一次查询前提前写出并报约束错。需要时我会用小范围 `no_autoflush`，更重要的是让事务内状态始终合法。

**深入追问：** 循环外键、数据库生成主键、Cascade 和 Bulk API 会改变 Unit of Work 行为。

**易错点：** Flush 成功不等于其他事务可见，也不等于外部副作用已经一致。

### Q039. `AsyncSession` 为什么仍可能经过 Greenlet，哪些操作会触发隐式 I/O？

**口语化回答：**

> SQLAlchemy Async 层把很多成熟同步 Core/ORM 逻辑桥接到异步 Driver，内部可能使用 Greenlet 切换。懒加载、Expired 属性和某些关系访问会在看似普通属性读取时触发 I/O；如果不在正确 Async Context 里就会报错。我的做法是显式查询或 Eager Load，避免序列化阶段偷偷访问数据库。

**深入追问：** 每个并发 Task 独立 Session，事务和连接通过 Context Manager 管理；Async 不会让数据库本身并行能力无限增加。

**易错点：** 不能把 ORM 对象直接交给后台 Task 后关闭 Session，再期待懒加载可用。

### Q040. Connection Pool 从 Checkout 到 Invalidate 的生命周期怎么讲？

**口语化回答：**

> 请求 Checkout 连接，使用后 Rollback/Reset 再 Checkin；池满时等待到 `pool_timeout`，而不是自动无限新建。`pre_ping` 可以在 Checkout 时发现部分死连接，`recycle` 处理连接寿命，但网络在查询中途断开仍要让本次事务失败并 Invalidate。Pool 大小要和数据库总连接预算、Worker 数和并发事务一起算。

**深入追问：** 多进程 Fork 后不能安全共享父进程连接；代理、PgBouncer 模式和 Server-side Prepared Statement 也会影响设置。

**易错点：** 增大 Pool 可能把排队从应用移到数据库，整体更慢。

### Q041. Async 请求被取消时，怎样保证事务回滚和连接归还？

**口语化回答：**

> 事务必须放在 `async with` 或 `try/except/finally` 里，请求取消也会经过清理；捕获取消时先 Rollback，再重新抛出，不能把半完成事务当成功。清理本身需要短 Deadline，并验证 Driver 在取消查询后连接是否仍可复用，否则就 Invalidate。

**深入追问：** 数据库 Commit 已成功但响应前断线时，客户端重试必须依赖 Idempotency Key 查原结果。

**易错点：** 不要在 `finally` 里无条件 Commit，也不要吞取消后复用未知状态连接。

### Q042. Version Column、唯一键和 Idempotency Record 各防哪类并发问题？

**口语化回答：**

> Version Column 用 Compare-and-Swap 检测并发更新，防 Lost Update；唯一键防两个请求创建同一业务实体；Idempotency Record 把请求 Key、输入 Hash、状态和结果绑定，解决重试返回同一结果。它们可以组合，但都不能替代业务状态机和事务边界。

**深入追问：** 同 Key 不同 Payload 必须拒绝；处理中 Lease 超时后由谁接管、原 Worker 晚到结果怎么处理，需要 Fencing Token。

**易错点：** 捕获唯一键异常后，PostgreSQL 事务已 Aborted，必须 Rollback 或使用 Savepoint/On Conflict。

### Q043. Cursor Pagination 为什么必须有唯一稳定排序？

**口语化回答：**

> Cursor 表示“上次排序键之后”，如果只按非唯一时间排序，同一时间的记录会重复或漏掉，所以我会用 `(created_at, id)` 这样的唯一复合顺序，并按方向构造严格比较。Cursor 要签名或编码，服务端仍验证租户、过滤条件和版本。

**深入追问：** 数据在翻页中间更新会影响快照语义；需要稳定导出时要固定 Snapshot、Watermark 或数据库一致性视图。

**易错点：** 把 Offset 数字 Base64 一下不叫 Cursor Pagination。

### Q044. Alembic 的 Expand/Contract 怎样支持不停机 Schema Migration？

**口语化回答：**

> 先 Expand：新增兼容字段或表、部署能同时读旧新结构的代码、后台 Backfill 并对账；再切读路径；确认旧版本和回滚窗口结束后 Contract，删除旧字段和兼容逻辑。大表变更要评估锁、日志、复制延迟和失败恢复，Migration 自身也要可观测。

**深入追问：** Rename 通常拆成 Add、双写、回填、切读、删旧；多服务共享表时 Consumer 升级顺序更重要。

**易错点：** “DDL 支持事务”不代表大表上线没有锁表和资源风险。

## 五、生产故障现场题（Q045-Q054）

### Q045. Event Loop Lag 突然升高，你怎样从止损到根因定位？

**口语化回答：**

> 我先确认是 Loop Lag，不是单纯下游慢：看事件循环延迟、请求并发、CPU、线程池队列和各下游 P95。先限流、关高成本功能或扩容止损，再保留 Profile 和慢请求 Trace。定位时用 `py-spy`、Slow Callback、Task Stack 和日志时间线找哪个同步函数或大循环长期占住 Loop；修复后用同流量回放验证 Lag、吞吐和尾延迟都恢复。

**深入追问：** 如果 CPU 不高但 Lag 高，我会查同步 DNS、文件 I/O、锁等待、GC Pause 和 C 扩展；如果只有单 Worker 异常，则对比 Worker Stack 和流量分布。

**易错点：** 不要一上来把 Uvicorn Worker 加倍，阻塞代码会被复制，数据库和线程池可能先被打挂。

### Q046. 一个同步 SDK 混进 `async def`，怎样证明它堵住了 Loop？

**口语化回答：**

> 我会做最小复现并同时记录函数耗时和 Loop Lag；在 Profile 里如果 Event Loop 线程长时间停在同步 HTTP、文件或加密函数，就能证明。短期用 `to_thread` 隔离并限制并发，长期优先换真正异步 SDK，或者把任务放独立 Worker。还要检查 SDK 是否有全局锁和不可取消调用。

**深入追问：** 在线程池里运行后尾延迟仍高，就看线程排队时间、下游连接池和调用 Deadline；不是“移出 Loop”就完成治理。

**易错点：** 给同步函数前面加 `await` 不会使它异步。

### Q047. 默认线程池饱和时，为什么连 DNS 和文件操作都可能变慢？

**口语化回答：**

> 一些 Async 封装会把同步 DNS、文件或用户函数放到共享默认 Executor。大批慢任务把 Worker 占满后，其他看似无关的操作也要排队。我会记录 Submit-to-start Queue Delay，按用途拆专用 Executor，限制入口并发，并给长任务迁移到可靠队列；线程数按 CPU、阻塞比例和下游容量测，不盲目加大。

**深入追问：** 我还会查线程是否卡在数据库连接、远端超时或锁上，避免把线程池当真正根因。

**易错点：** 线程池队列通常不会自动替业务做背压，无界提交仍可耗尽内存。

### Q048. 数据库连接池耗尽，你按什么证据顺序排查？

**口语化回答：**

> 我先看 Pool Checked-out、Waiter、Checkout Delay、事务时长和数据库 Active/Idle-in-transaction。止损可以降入口并发、暂停非核心任务和杀掉确认无用的超长事务。然后按 Trace 找连接持有时间：是 Session 没关闭、Streaming 长期占连接、查询慢、锁等待，还是 Worker 数乘 Pool Size 超过数据库预算。修复要让事务变短、生命周期明确，并补连接泄漏测试和告警。

**深入追问：** 如果数据库连接并不满但应用超时，我会查 Pool Lock、DNS、TLS、连接创建和 Driver 状态。

**易错点：** 单纯把 `pool_size` 调大可能加重数据库上下文切换和锁竞争。

### Q049. Python 服务 RSS 持续上涨，怎样区分缓存、泄漏、碎片和 C 扩展？

**口语化回答：**

> 我会同时看 RSS、Python Traced Memory、对象数量和请求后是否回落。`tracemalloc` 两个时间点做 Diff，配合 `gc` 和 Heap 工具找增长引用链；如果 Python 分配稳定而 RSS 涨，考虑分配器碎片、Native Buffer、模型库或 C 扩展。还会核对 Cache 上限、Task/Traceback 引用、未关闭 Response 和临时文件。

**深入追问：** 通过固定流量复现、逐功能禁用和 Worker 滚动重启只能止损，最终要证明某条引用或 Native Allocation 被消除。

**易错点：** 强制 `gc.collect()` 后 RSS 不降不能直接证明 GC 有 Bug。

### Q050. CPU 打满但吞吐下降，你怎样定位 Python 热点？

**口语化回答：**

> 先确认是用户态 CPU、系统调用、GC 还是容器 Throttling，再用采样 Profiler 看函数和 Native Stack。常见根因是 JSON/正则、图算法、压缩、序列化、Busy Loop 或过多小对象。优化顺序是减少工作量和算法复杂度，再做批处理、缓存或更合适的 Native/多进程实现；每次用相同输入测吞吐、P95 和内存。

**深入追问：** 多 Worker CPU 都满要看共享下游和负载特征；只有一个 Worker 满则看流量粘滞、热点租户和任务不均衡。

**易错点：** 不看 Profile 就改成多进程，可能把 O(n²) 和内存峰值一起放大。

### Q051. 多 Worker 为什么会重复跑定时任务，怎样修？

**口语化回答：**

> 每个 Worker 都会执行模块初始化和 Lifespan，所以进程内 Scheduler 会各启动一份。可靠方案是把调度器独立部署，或者用数据库/队列做带 Lease 和 Fencing 的 Leader；业务任务自身仍要幂等。短期只让一个固定 Worker 跑并不可靠，因为重启和扩容会改变身份。

**深入追问：** Leader 失联后新 Leader 接管，旧 Leader 晚到写入必须被 Fencing Token 拒绝；仅有分布式锁续租仍可能脑裂。

**易错点：** `if __name__ == '__main__'` 不能解决生产 Server 的多进程任务唯一性。

### Q052. SSE 慢客户端导致内存和连接上涨，怎么处理？

**口语化回答：**

> 每个连接的发送 Buffer 和待发 Queue 都必须有上限。客户端消费过慢时，我会合并可覆盖的进度事件、丢弃非关键 Token、发送快照，超过阈值就断开并让它凭 Last-Event-ID 重连。服务端监控连接数、每连接积压、事件年龄和发送耗时；后台任务状态不能绑在单条 Socket 上。

**深入追问：** 反向代理也要关闭不必要缓冲并配置 Idle Timeout、心跳和最大连接；多租户要有连接配额。

**易错点：** 无界 `asyncio.Queue` 会把一个慢浏览器变成服务端 OOM 风险。

### Q053. Readiness 摘流、Liveness 或 Startup Probe 又触发重启风暴时，你怎么止损？

**口语化回答：**

> 我会先纠正一个前提：Readiness 失败原生只会让 Endpoint 进入未就绪状态并摘流，不会直接重启容器；真正的重启要查 Liveness、Startup Probe、主进程退出、OOM、Eviction 或外部控制器。止损时先暂停或回滚发布，修正错误探针并保留 `lastState`、Previous Log 和事件。根因可能是启动迁移太慢、依赖检查过严、初始连接洪峰或 Probe Deadline 过短；修复后再配置合适的 Startup Probe、阈值、抖动和分阶段 Warm-up，并做节点故障演练。

**深入追问：** Readiness Endpoint 本身不能串行探测所有下游，否则一个非关键依赖会让整个服务离线。

**易错点：** 把所有健康检查失败都交给 Kubernetes 重启，会放大数据库和模型服务压力。

### Q054. 502、504 和 Connection Reset 分别从哪一层开始查？

**口语化回答：**

> 502 通常表示代理没拿到合法 Upstream 响应，我先查连接建立、进程崩溃和协议错误；504 表示代理等 Upstream 超时，我对齐代理、应用、数据库和 Provider 的 Deadline；Reset 要看是哪一端发 RST、是否 Keep-alive 复用到已关闭连接、Pod 退出或中间网络设备回收。统一用 Request ID、代理日志、应用 Trace、`ss`/`tcpdump` 和发布时间线切层。

**深入追问：** 如果应用已经成功 Commit 但代理返回 504，客户端重试只能通过 Idempotency Key 查原结果。

**易错点：** 不能把所有 5xx 都归到 FastAPI，也不能为了消除 504 只把超时无限调大。

## 六、现场手写与并发不变量（Q055-Q060）

### Q055. 手写一个有背压、保序、失败可取消的 Async 并发 Map。

**口语化回答：**

> 我会用固定数量 Worker 和有界 Queue，而不是先创建十万个 Task。结果按原索引写回，所以并发完成顺序不会改变输出；TaskGroup 中任一 Worker 失败会取消同组任务。

```python
import asyncio
from collections.abc import Awaitable, Callable, Sequence
from typing import TypeVar, cast

T = TypeVar("T")
R = TypeVar("R")


async def bounded_map(
    items: Sequence[T],
    fn: Callable[[T], Awaitable[R]],
    *,
    concurrency: int,
    queue_size: int | None = None,
) -> list[R]:
    if concurrency <= 0:
        raise ValueError("concurrency must be positive")
    if queue_size is not None and queue_size <= 0:
        raise ValueError("queue_size must be positive")

    sentinel = object()
    queue: asyncio.Queue[tuple[int, T] | object] = asyncio.Queue(
        maxsize=queue_size if queue_size is not None else concurrency * 2
    )
    unset = object()
    results: list[R | object] = [unset] * len(items)

    async def produce() -> None:
        for index, item in enumerate(items):
            await queue.put((index, item))
        for _ in range(concurrency):
            await queue.put(sentinel)

    async def consume() -> None:
        while True:
            job = await queue.get()
            try:
                if job is sentinel:
                    return
                index, item = job
                results[index] = await fn(item)
            finally:
                queue.task_done()

    async with asyncio.TaskGroup() as group:
        group.create_task(produce())
        for _ in range(concurrency):
            group.create_task(consume())

    if any(value is unset for value in results):
        raise RuntimeError("a worker exited without producing every result")
    return [cast(R, value) for value in results]
```

**深入追问：** 还要给单项和总任务 Deadline、重试分类与部分结果策略；输入是无限 Async Iterator 时，结果也应改成流式输出而不是保留完整 List。

**易错点：** 复杂度是 O(n) 额外结果空间，活跃工作和 Queue 是 O(concurrency)；创建全部 Task 再套 Semaphore 不解决 Task 对象内存。

### Q056. 手写带总 Deadline、指数退避、Full Jitter 的异步重试。

**口语化回答：**

> 我只重试明确的瞬时错误，并把所有尝试放进一个总 Deadline；每次睡眠也不能越过剩余预算。写操作调用方还必须复用同一个业务幂等键。

```python
import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import TypeVar

R = TypeVar("R")


async def retry_with_deadline(
    operation: Callable[[], Awaitable[R]],
    *,
    timeout_s: float,
    max_attempts: int = 4,
    base_s: float = 0.1,
    cap_s: float = 2.0,
    retryable: tuple[type[BaseException], ...] = (TimeoutError,),
) -> R:
    if timeout_s <= 0 or max_attempts <= 0:
        raise ValueError("invalid retry budget")

    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_s
    last_error: BaseException | None = None

    for attempt in range(max_attempts):
        remaining = deadline - loop.time()
        if remaining <= 0:
            raise TimeoutError("retry deadline exceeded") from last_error
        try:
            async with asyncio.timeout(remaining):
                return await operation()
        except asyncio.CancelledError:
            raise
        except retryable as exc:
            last_error = exc
            if attempt + 1 == max_attempts:
                raise

        delay_cap = min(cap_s, base_s * (2**attempt))
        delay = random.uniform(0.0, delay_cap)
        if loop.time() + delay >= deadline:
            raise TimeoutError("no budget left for backoff") from last_error
        await asyncio.sleep(delay)

    raise AssertionError("unreachable")
```

**深入追问：** HTTP 429 要尊重可信的 Retry-After；DNS、Connect、Read、业务拒绝和参数错误不能共用同一重试策略。

**易错点：** `asyncio.TimeoutError` 与内置 `TimeoutError` 的版本关系要按目标 Python 确认；测试要固定随机源或只断言范围。

### Q057. 手写一个 TTL Cache，并用 Singleflight 防止缓存击穿。

**口语化回答：**

> 同一个 Key 过期时只允许一个 Loader 执行，其他请求等待同一个 Task；等待者取消不能把共享加载一起取消。示例是单进程版，多 Worker 仍需要共享缓存或下游保护。

```python
import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Generic, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class SingleflightTTL(Generic[K, V]):
    def __init__(self, ttl_s: float) -> None:
        if ttl_s <= 0:
            raise ValueError("ttl_s must be positive")
        self._ttl_s = ttl_s
        self._values: dict[K, tuple[float, V]] = {}
        self._inflight: dict[K, asyncio.Task[V]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: K, loader: Callable[[], Awaitable[V]]) -> V:
        now = time.monotonic()
        async with self._lock:
            cached = self._values.get(key)
            if cached is not None and cached[0] > now:
                return cached[1]
            task = self._inflight.get(key)
            if task is None:
                task = asyncio.create_task(loader())
                self._inflight[key] = task

        try:
            value = await asyncio.shield(task)
        except BaseException:
            async with self._lock:
                if self._inflight.get(key) is task and task.done():
                    self._inflight.pop(key, None)
            raise

        async with self._lock:
            if self._inflight.get(key) is task:
                self._inflight.pop(key, None)
                self._values[key] = (time.monotonic() + self._ttl_s, value)
        return value
```

**深入追问：** 生产还要限制 Key 数、负缓存、Loader Deadline、Stale-while-revalidate，并把租户、权限版本和数据 Revision 放进 Key。

**易错点：** Singleflight 只合并并发请求，不等于跨进程锁或事务；异常是否短暂缓存要按错误类型决定。

### Q058. 怎样用 SQL 手写一个带 Lease 和 Fencing Token 的任务领取？

**口语化回答：**

> 我会让领取、状态变更和 Fencing Token 自增在一个事务里完成，`SKIP LOCKED` 让多个 Worker 领取不同任务。完成时必须同时匹配 Worker 和 Token，旧 Worker 即使晚到也写不进去。

```sql
WITH candidate AS (
    SELECT id
    FROM task
    WHERE status = 'pending'
       OR (status = 'running' AND lease_until < now())
    ORDER BY priority DESC, id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE task AS t
SET status = 'running',
    lease_owner = :worker_id,
    lease_until = now() + interval '30 seconds',
    fencing_token = fencing_token + 1,
    attempt = attempt + 1
FROM candidate AS c
WHERE t.id = c.id
RETURNING t.*;

UPDATE task
SET status = 'succeeded', result_ref = :result_ref
WHERE id = :task_id
  AND status = 'running'
  AND lease_owner = :worker_id
  AND fencing_token = :fencing_token;
```

**深入追问：** Heartbeat 续租也必须匹配 Token；任务副作用使用稳定 Action ID，数据库任务状态不能单独证明远端操作 Exactly-once。

**易错点：** 领取后先提交再处理是正常 Lease 模式，不要持有数据库事务跑三十秒外部任务。

### Q059. 手写稳定复合 Cursor 的编码和查询条件。

**口语化回答：**

> 我用 `(created_at, id)` 做唯一稳定顺序，Cursor 带这两个字段和过滤版本，并做签名防篡改。下面只展示核心编码，生产还要固定时区和 Schema Version。

```python
import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone

SECRET = b"replace-with-managed-secret"


def encode_cursor(created_at: datetime, row_id: int) -> str:
    if created_at.tzinfo is None:
        raise ValueError("created_at must be timezone-aware")
    payload = json.dumps(
        {"ts": created_at.astimezone(timezone.utc).isoformat(), "id": row_id, "v": 1},
        separators=(",", ":"),
    ).encode()
    signature = hmac.new(SECRET, payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload + signature).decode().rstrip("=")


def decode_cursor(token: str) -> tuple[datetime, int]:
    raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
    payload, signature = raw[:-32], raw[-32:]
    expected = hmac.new(SECRET, payload, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        raise ValueError("invalid cursor signature")
    data = json.loads(payload)
    return datetime.fromisoformat(data["ts"]), int(data["id"])
```

```sql
SELECT *
FROM event
WHERE tenant_id = :tenant_id
  AND (created_at, id) > (:cursor_ts, :cursor_id)
ORDER BY created_at ASC, id ASC
LIMIT :page_size;
```

**深入追问：** 过滤条件变化时 Cursor 必须失效；需要跨页一致快照时还要带 Snapshot ID 或 Watermark。

**易错点：** 示例中的 Secret 必须来自密钥管理，不能硬编码；这里是教学占位，不是项目配置。

### Q060. 手写一个支持 `Last-Event-ID` 的单进程 SSE Replay Buffer。

**口语化回答：**

> 我按 Run 保存单调 ID 和有界历史；重连先校验最早可用 ID，如果已经过期就要求客户端拉快照。示例只说明协议不变量，多实例生产要换共享 Event Log。

```python
import asyncio
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass


@dataclass(frozen=True)
class Event:
    event_id: int
    event_type: str
    data: str


class ReplayBuffer:
    def __init__(self, max_events: int = 1_000) -> None:
        if max_events <= 0:
            raise ValueError("max_events must be positive")
        self._events: deque[Event] = deque(maxlen=max_events)
        self._next_id = 1
        self._condition = asyncio.Condition()

    async def publish(self, event_type: str, data: str) -> Event:
        async with self._condition:
            event = Event(self._next_id, event_type, data)
            self._next_id += 1
            self._events.append(event)
            self._condition.notify_all()
            return event

    async def subscribe(self, after_id: int) -> AsyncIterator[Event]:
        cursor = after_id
        while True:
            async with self._condition:
                if self._events and cursor < self._events[0].event_id - 1:
                    raise LookupError("event history expired; fetch a snapshot")
                available = [e for e in self._events if e.event_id > cursor]
                if not available:
                    await self._condition.wait()
                    continue
            for event in available:
                cursor = event.event_id
                yield event


def encode_sse(event: Event) -> str:
    if "\r" in event.event_type or "\n" in event.event_type:
        raise ValueError("event_type must not contain CR or LF")
    normalized = event.data.replace("\r\n", "\n").replace("\r", "\n")
    data_lines = "\n".join(f"data: {line}" for line in normalized.split("\n"))
    return f"id: {event.event_id}\nevent: {event.event_type}\n{data_lines}\n\n"
```

**深入追问：** 我会再补心跳、连接配额、慢客户端 Buffer、Run 归属鉴权、最终 Artifact 查询和进程重启恢复。

**易错点：** `notify_all()` 不做跨进程广播；SSE 的 CR、LF、CRLF 都是行边界，Event Type 不能允许换行注入字段；逐 Token 全持久化成本高，关键业务事件和快照必须优先。

## 七、使用顺序

1. 先练 Q013-Q024，把取消、超时、背压和结构化并发讲清。
2. 再练 Q025-Q044，能从 ASGI Message 一直追到 Session、连接池和迁移。
3. 故障题统一按“止损、保现场、分层证据、根修、验证、复盘”回答，没有真实事故就明确说是演练。
4. Q055-Q060 必须自己敲一遍，并补取消、超时、空输入、重复请求、跨进程和重启测试。
