# Python 与 FastAPI 高频面试题

> 定位：简历明确写了 Python/FastAPI 全栈后端，CodeWiki 的 HTTP 服务、数据处理和 LLM 编排也基于这套技术栈。本文不把语言八股和项目事实混在一起；知识题给可直接口述的答案，项目规模、部署和个人贡献仍以事实核对清单为准。
>
> 回答结构统一为四段：先给结论，再解释原理，然后主动讲坑，最后连接到真实项目或生产判断。面试时不必逐字背，但必须能沿着追问继续展开。

## 1. Python 对象模型、容器与函数

### Q001：Python 是动态类型还是弱类型？

> **口语化回答：** 我会说 Python 是动态类型、强类型。动态是变量名不固定绑定某一种类型，运行时可以重新指向别的对象；强类型是不同类型不会为了让表达式通过就随便隐式混算，比如字符串和整数不能直接相加。
>
> **原理追问：** 类型属于对象，不属于变量名。赋值本质上是名字绑定到对象，函数参数和容器里传递的也都是对象引用。
>
> **容易踩坑：** 动态类型不等于没有类型，也不等于可以不做契约。服务边界仍要用 Type Hint、Pydantic Schema 和运行时业务校验。
>
> **项目连接：** CodeWiki 的 API Payload 和 LLM Structured Output 都不能靠“Python 灵活”兜底，我会在入口把外部数据校验成稳定模型，内部再使用明确类型。

### Q002：`is` 和 `==` 有什么区别？

> **口语化回答：** `is` 比较是不是同一个对象，`==` 比较两个对象的值是否相等。判断 `None` 我用 `is None`，判断字符串、数字或业务对象内容我用 `==`。
>
> **原理追问：** `is` 对应对象身份；`==` 会走类型定义的 `__eq__`。两个不同列表内容可以相等，但对象身份不同。
>
> **容易踩坑：** CPython 可能缓存小整数或驻留部分字符串，导致某些测试里 `is` 碰巧为真，但这是实现细节，不能拿它做值比较。
>
> **项目连接：** 数据库实体、Pydantic Model 和 AST Node 要按稳定业务 ID 或字段比较，不能依赖进程内对象身份。

### Q003：可变对象和不可变对象有什么区别？哪些对象能做字典 Key？

> **口语化回答：** 可变对象可以原地改变内容，比如 list、dict、set；不可变对象创建后值不能原地修改，比如 int、str、tuple。字典 Key 要在生命周期内保持稳定 hash，一般要求对象可哈希。
>
> **原理追问：** Dict 先根据 `hash()` 找桶，再用相等比较确认 Key。Key 如果入表后 hash 变了，后续就可能再也找不到原位置。
>
> **容易踩坑：** Tuple 不一定可哈希，里面只要包含 list 这类不可哈希元素，整个 Tuple 也不能做 Key。自定义对象同时改 `__eq__` 和 `__hash__` 时要保持相等对象 hash 相等。
>
> **项目连接：** CodeWiki 的节点 Key 会用规范化路径、符号类型和稳定 ID 组合，不会把可变 Dict 直接当缓存键。

### Q004：Python 函数为什么说是“一等对象”？

> **口语化回答：** 函数可以赋给变量、放进容器、作为参数传入，也可以由另一个函数返回，所以它和普通对象一样可以被组合。
>
> **原理追问：** 装饰器、回调、策略表和依赖注入都利用这个特性。调用 `func()` 是对函数对象执行调用协议，`func` 本身只是对象引用。
>
> **容易踩坑：** 注册回调时把 `func` 写成 `func()`，会在注册阶段提前执行；闭包里捕获可变状态也容易造成隐式共享。
>
> **项目连接：** FastAPI Dependency、任务路由表和 Parser Registry 都适合用函数对象注册，但注册时要明确生命周期和异常边界。

### Q005：Python 参数传递到底是值传递还是引用传递？

> **口语化回答：** 我更准确地说是对象引用按值传递。函数拿到的是同一个对象引用的副本，所以可以看到对可变对象的原地修改，但在函数里把参数名重新绑定，不会改变调用方那个名字的绑定。
>
> **原理追问：** `items.append()` 修改的是共享 list；`items = []` 只是让局部名字指向新 list。
>
> **容易踩坑：** 把“引用传递”理解成函数能直接替换调用方变量，会解释错很多问题。需要返回新对象时应显式返回并由调用方接收。
>
> **项目连接：** Pipeline State 如果允许节点原地改共享 Dict，会让并发和测试很难推理；我更倾向返回明确的更新结果。

### Q006：为什么可变默认参数是经典坑？

> **口语化回答：** 默认参数在函数定义时只创建一次，不是每次调用都创建。把 list 或 dict 当默认值，多次调用会共享同一个对象，数据就会串起来。
>
> **原理追问：** 我通常写成 `items=None`，进入函数后再创建新 list；如果 `None` 本身也是合法业务值，可以用私有 Sentinel 区分“没传”和“显式传 None”。
>
> **容易踩坑：** Dataclass 里同样不能直接写可变默认值，应使用 `field(default_factory=list)`。
>
> **项目连接：** API 请求状态、检索候选和工具参数都不能共享默认容器，否则并发请求可能出现跨请求污染。

### Q007：`*args` 和 `**kwargs` 怎么用，为什么不能滥用？

> **口语化回答：** `*args` 收集额外位置参数，`**kwargs` 收集额外关键字参数；调用时也可以用单星和双星解包。它适合写包装器和兼容层，但不适合掩盖一个本来应该清晰的接口。
>
> **原理追问：** Python 参数还有 positional-only、keyword-only 等边界，可以用 `/` 和 `*` 明确，减少调用方传错位置或依赖参数名。
>
> **容易踩坑：** 包装函数只写 `*args, **kwargs` 会丢掉类型和 IDE 提示；转发时还可能把不支持的参数静默传到底层。
>
> **项目连接：** LLM Provider Adapter 可以在边界做兼容映射，但对业务 Tool Schema 我会保留显式字段，不让模型面对一个任意 kwargs 黑盒。

### Q008：LEGB、闭包和 `nonlocal` 怎么解释？

> **口语化回答：** 名字查找通常按 Local、Enclosing、Global、Builtins。闭包是内部函数记住了外层作用域里的变量；需要重新绑定外层局部变量时用 `nonlocal`，修改模块全局变量才用 `global`。
>
> **原理追问：** 闭包捕获的是变量单元，不是简单把当时的值复制一份，所以变量后续变化可能影响调用结果。
>
> **容易踩坑：** 过度用 `global` 或闭包藏状态会让并发、测试和热重载都难处理。共享可变状态更适合封装成对象并明确同步策略。
>
> **项目连接：** FastAPI 服务里的缓存、模型 Client 和 Store 不会随手放模块全局可变变量，我会通过 Lifespan 创建，再由依赖注入传递。

### Q009：循环里创建 Lambda，为什么最后都拿到同一个值？

> **口语化回答：** 这是闭包晚绑定。Lambda 真正执行时才查外层变量，循环结束后外层变量已经是最后一个值，所以多个函数看起来都返回最后一项。
>
> **原理追问：** 可以用默认参数 `lambda x=x: ...` 在创建函数时固定当前值，或者用 `functools.partial` 显式绑定。
>
> **容易踩坑：** 异步创建一组 Task 时也会遇到类似问题，尤其是回调和日志都引用循环变量。
>
> **项目连接：** 批量生成 Wiki 页面或注册多语言 Parser 时，我会把 repoId、slug、language 显式作为参数传入，不依赖闭包碰巧捕获正确值。

### Q010：List 和 Tuple 怎么选？Tuple 一定更快吗？

> **口语化回答：** 需要修改、追加和删除时用 List；表达固定结构或希望不可变语义时用 Tuple。Tuple 通常更紧凑，某些操作有小幅优势，但选型第一依据是语义，不是微小性能差。
>
> **原理追问：** List 为动态增长保留容量，Tuple 长度固定。Tuple 可否哈希还取决于内部元素。
>
> **容易踩坑：** 不可变的是 Tuple 的槽位，槽位里如果放了 List，那个 List 仍能变化；需要字段名时 NamedTuple、Dataclass 或 Pydantic Model 往往更清楚。
>
> **项目连接：** 内部短小、固定的返回对可以用 Tuple；跨层 API 和持久化数据我会用有字段名的模型，避免靠下标猜语义。

### Q011：Python Dict 为什么查找通常接近 O(1)？顺序能依赖吗？

> **口语化回答：** Dict 是哈希表，先用 hash 定位，再处理冲突，所以平均查找和写入接近 O(1)，最坏情况仍可能退化。现代 Python 的 Dict 保证插入顺序，但这个顺序不等于排序。
>
> **原理追问：** 扩容会重新组织表结构，删除后再插入同一个 Key 通常会出现在末尾。Hash 随机化还能降低某些恶意碰撞攻击。
>
> **容易踩坑：** 依赖 Dict 顺序做业务优先级却没有显式字段；自定义 Key 的 hash/eq 不稳定；遍历时修改结构。
>
> **项目连接：** JSON 字段展示可以利用稳定插入顺序，但 Catalog 页面顺序和任务优先级必须显式排序并持久化 order，不能只靠 Dict 当前排列。

### Q012：Set 适合什么场景？为什么它不能直接替代 List？

> **口语化回答：** Set 适合去重和成员判断，平均复杂度接近 O(1)；List 适合保留顺序、重复项和按位置访问。两个容器表达的业务语义不一样。
>
> **原理追问：** Set 同样基于哈希，元素必须可哈希。交集、并集、差集对权限、标签和依赖集合很实用。
>
> **容易踩坑：** Set 的迭代顺序不应该作为稳定接口；直接把列表转 Set 去重会丢原顺序。需要有序去重可利用 Dict Key 或显式 seen Set 加结果 List。
>
> **项目连接：** GraphRAG 会用 Set 去重节点 ID 和 Edge，但最终给模型的证据顺序还要按分数、来源位置和预算重新排序。

### Q013：列表推导式和普通循环怎么选？

> **口语化回答：** 简单映射和过滤我会用推导式，表达紧凑；一旦有多层分支、副作用、异常处理或难读的嵌套，就改普通循环。可读性比少写几行更重要。
>
> **原理追问：** 列表推导式会一次性构造完整 List；只需要流式消费时用生成器表达式，避免全部驻留内存。
>
> **容易踩坑：** 在推导式里调用有副作用的函数；对超大数据生成完整列表；为了炫技写三层嵌套。
>
> **项目连接：** 扫描大仓库文件和流式读取 JSONL 时我不会先做全量 List Comprehension，而会用 Iterator、Batch 和背压控制内存。

### Q014：Iterable 和 Iterator 有什么区别？

> **口语化回答：** Iterable 是可以拿到迭代器的对象，实现 `__iter__`；Iterator 还实现 `__next__`，每次给下一个值，结束时抛 `StopIteration`。List 可重复迭代，Generator 通常只能消费一遍。
>
> **原理追问：** `for` 循环先调用 `iter()`，再不断调用 `next()`。把遍历协议和数据存储分开，才能做惰性流式处理。
>
> **容易踩坑：** 对同一个 Generator 先做一次 `list()`，后面再遍历已经为空；为了算长度提前耗尽流。
>
> **项目连接：** 文件扫描、数据库游标和流式模型输出都要明确是不是 One-shot Iterator，跨层传递时不能让两个消费者抢同一条流。

### Q015：Generator、`yield` 和 `yield from` 怎么理解？

> **口语化回答：** 函数里出现 `yield` 后，调用返回 Generator，不会立即跑完整函数；每次 `next()` 执行到下一个 `yield` 暂停并保存现场。`yield from` 可以把子迭代器的值和部分控制协议委托出去。
>
> **原理追问：** Generator 节省的是中间结果内存，不代表数据源本身免费；读取文件、网络或数据库仍需要关闭和异常处理。
>
> **容易踩坑：** Generator 内部持有文件句柄却没有明确关闭；异常在真正迭代时才发生，调用点看起来成功但消费阶段失败。
>
> **项目连接：** 大仓库 Chunk 和导出接口适合按批 Yield，但请求取消、连接释放和最终统计要放在可验证的清理路径里。

### Q016：装饰器的执行时机是什么？怎么保留原函数信息？

> **口语化回答：** 装饰器在函数定义被加载时执行，返回一个替代或包装后的可调用对象。包装器要用 `functools.wraps`，否则函数名、Docstring、签名相关元数据容易丢。
>
> **原理追问：** 带参数装饰器通常是“配置函数返回真正装饰器，再返回 Wrapper”三层。装饰顺序是靠近函数的先应用，调用时则按包装层进入和退出。
>
> **容易踩坑：** 在装饰阶段建立网络连接或读取动态配置；同步装饰器错误包装 Async Function；重试装饰器重复执行有副作用操作。
>
> **项目连接：** Trace、权限和重试可以用装饰器，但 FastAPI 依赖和 Middleware 往往能更清楚地表达请求生命周期，不能所有横切逻辑都叠在函数上。

### Q017：Context Manager 解决什么？`with` 背后发生了什么？

> **口语化回答：** Context Manager 把资源获取和释放绑定到一个作用域，哪怕中间抛异常也能清理。`with` 会调用 `__enter__` 和 `__exit__`；异步版本对应 `__aenter__` 和 `__aexit__`。
>
> **原理追问：** `__exit__` 可以看到异常类型、值和 Traceback，返回真还能吞异常，但业务代码通常不应该无声吞掉。
>
> **容易踩坑：** 只在正常路径 Close；把事务 Commit 写进错误的清理分支；一个 Context Manager 同时管太多不相关资源。
>
> **项目连接：** 数据库 Session、文件、分布式 Trace Span 和临时目录都会用上下文管理，确保 Wiki 生成失败时事务和资源状态可预测。

### Q018：`property` 和 Descriptor 是什么关系？

> **口语化回答：** `property` 是 Descriptor 的一种。Descriptor 通过 `__get__`、`__set__`、`__delete__` 接管属性访问，很多 ORM 字段、校验字段和方法绑定都基于这个协议。
>
> **原理追问：** 数据 Descriptor 和实例 `__dict__` 的查找优先级不同。理解属性解析顺序有助于解释为什么某些框架字段不是普通值。
>
> **容易踩坑：** Property 里做慢 IO，调用方看起来只是读属性却触发网络；Setter 隐式改多个状态；Descriptor 缓存没有线程安全。
>
> **项目连接：** 业务数据转换我更倾向显式方法，不把数据库查询藏进 Property；ORM Lazy Load 也要警惕由一次属性访问引出 N+1。

### Q019：`__new__` 和 `__init__` 有什么区别？

> **口语化回答：** `__new__` 负责创建并返回实例，`__init__` 负责初始化已经创建的实例。普通类大多只写 `__init__`；不可变类型子类、单例控制或对象创建框架才可能需要 `__new__`。
>
> **原理追问：** 如果 `__new__` 返回的不是当前类实例，Python 可能不会继续调用当前类的 `__init__`。
>
> **容易踩坑：** 用 `__new__` 实现进程级单例，却忽略多线程、测试隔离和多 Worker；在构造函数里做不可控 IO。
>
> **项目连接：** 模型 Client 和数据库 Engine 的生命周期由 FastAPI Lifespan 管理，比用魔法单例更容易测试和关闭。

### Q020：Dataclass、NamedTuple、TypedDict 和 Pydantic Model 怎么选？

> **口语化回答：** Dataclass 适合内部有行为的数据对象；NamedTuple 适合轻量不可变记录；TypedDict 主要给静态类型检查描述 Dict 形状，运行时还是 Dict；Pydantic Model 适合外部输入输出，需要运行时解析、校验和 Schema。
>
> **原理追问：** 选择要看运行时校验、可变性、序列化、性能和边界位置，不能只看写法像不像。
>
> **容易踩坑：** 把 TypedDict 当运行时校验；在核心热路径无差别构造大量 Pydantic 对象；跨层都复用同一个巨大 Model。
>
> **项目连接：** FastAPI Request/Response 用 Pydantic，AST 内部中间态可以用 Dataclass，LangGraph State 常用 TypedDict，各自职责分开。

## 2. 继承、类型系统、异常与运行时

### Q021：Python 多继承的 MRO 和 `super()` 怎么工作？

> **口语化回答：** Python 用 C3 Linearization 计算方法解析顺序。`super()` 不是简单找“父类”，而是沿当前实例对应的 MRO 从当前类之后继续找，所以协作式多继承要求每一层都正确调用 `super()`。
>
> **原理追问：** 可以看 `Class.__mro__`。Mixin 应职责单一、尽量无独立状态，并让方法签名能协作转发。
>
> **容易踩坑：** 某一层直接写死父类名，导致后续 Mixin 被跳过；多个父类都初始化同一字段；菱形继承里重复调用。
>
> **项目连接：** Parser 扩展优先组合和注册表，不用复杂继承树表达所有语言差异；确实使用 Mixin 时会保持无状态和小接口。

### Q022：Metaclass 是什么？什么场景才值得用？

> **口语化回答：** 类本身也是对象，Metaclass 是创建类的类，可以在类定义完成时修改或注册它。ORM、框架声明和插件自动注册会用，但业务代码通常不需要自己写。
>
> **原理追问：** 类定义过程会准备 Namespace、执行类体，再由 Metaclass 创建类对象；`__init_subclass__` 或 Class Decorator 往往能用更低复杂度解决同类问题。
>
> **容易踩坑：** Metaclass 冲突、导入时副作用、IDE 和类型检查难理解，都会增加维护成本。
>
> **项目连接：** CodeWiki 多语言 Parser 注册用显式 Registry 更容易发现和测试，不会为了“自动”引入难排查的 Metaclass 魔法。

### Q023：自定义对象实现 `__eq__` 时为什么要考虑 `__hash__`？

> **口语化回答：** Hash 容器要求相等对象必须有相同 Hash。如果我按业务字段定义相等，就必须决定对象是否仍适合作为 Key；对象可变时通常直接禁用 Hash。
>
> **原理追问：** Python 在自定义 `__eq__` 后可能把 `__hash__` 设为 None，避免默认身份 Hash 和值相等冲突。
>
> **容易踩坑：** 用会变化的字段算 Hash；Eq 只支持部分类型却不返回 `NotImplemented`；把数据库实体的当前字段当永久身份。
>
> **项目连接：** AST Symbol 的身份用稳定 ID，内容变化单独版本化，避免增量分析时节点在 Set 或 Dict 里失联。

### Q024：`__slots__` 能带来什么，为什么不是默认优化？

> **口语化回答：** `__slots__` 可以限制实例属性并在大量小对象时减少每实例 `__dict__` 开销，但会影响动态加字段、继承、弱引用和部分序列化工具，所以不是所有类都应该开。
>
> **原理追问：** 真正收益要看对象数量、字段和 Python 版本，用内存 Profile 测，不能只凭教程结论。
>
> **容易踩坑：** 以为 Slots 让对象不可变；子类没声明 Slots 又重新有 Dict；框架依赖动态属性时兼容性出问题。
>
> **项目连接：** 只有 AST 扫描产生百万级小对象并确认内存是瓶颈时，我才会评估 Slots，先做对象数和峰值内存测量。

### Q025：CPython 怎么管理内存？循环引用会不会泄漏？

> **口语化回答：** 传统 CPython 主要用引用计数，引用降到零时通常立即释放；另外有循环垃圾回收器处理容器之间的引用环。循环引用不一定永远泄漏，但资源释放时机不能交给 GC 猜。
>
> **原理追问：** GC 重点追踪可能形成环的容器对象；文件、Socket、数据库连接仍应显式用 Context Manager 关闭。
>
> **容易踩坑：** 把内存常驻都叫泄漏，实际可能是缓存、Allocator 没立即还给 OS 或对象仍被全局引用；带复杂 Finalizer 的环也更难处理。
>
> **项目连接：** 处理大仓库时我会用 Tracemalloc、对象快照和 RSS 一起看，区分 Python 对象增长、Native 库和正常缓存。

### Q026：Weak Reference 适合解决什么问题？

> **口语化回答：** Weakref 不增加对象的强引用计数，适合缓存、观察者和对象注册表，让对象没有其他使用者时仍能被回收。
>
> **原理追问：** `WeakKeyDictionary`、`WeakValueDictionary` 可以避免 Registry 把对象永久留住，但取值时对象可能已经消失。
>
> **容易踩坑：** 把 Weakref 当可靠持久缓存；使用前没重新确认对象仍存在；对象类型不支持弱引用。
>
> **项目连接：** 请求级对象不会用全局强引用 Registry 长期保存；真正需要跨请求的数据要放有生命周期和容量上限的 Cache。

### Q027：异常的 `raise`、`raise ... from ...` 和 Bare Raise 有什么区别？

> **口语化回答：** `raise` 重新抛当前异常并保留原 Traceback；`raise NewError(...) from err` 明确建立异常原因链；直接抛新异常但不 From 会保留上下文，不过语义没那么清楚。
>
> **原理追问：** 分层系统应该把底层异常翻译成稳定领域错误，同时保留 Cause 给日志和 Trace，不把数据库或供应商细节直接返回客户端。
>
> **容易踩坑：** `raise err` 可能改变 Traceback 起点；Catch 后只打日志不再抛会把事务失败吞掉；返回完整异常文本会泄露密钥或 SQL。
>
> **项目连接：** LLM、解析、存储和 API 各层会用稳定错误码串起来，原始 Cause 只进入受控日志并先脱敏。

### Q028：怎么设计业务异常体系？

> **口语化回答：** 我会区分参数/业务拒绝、资源不存在、冲突、权限、可重试依赖故障和内部错误，每类有稳定 Code、可公开 Message、HTTP 映射和是否重试，而不是到处抛字符串。
>
> **原理追问：** 异常类型服务代码控制流，错误码服务跨进程契约；两者都要稳定。内部 Cause、Trace ID 和安全上下文不直接暴露。
>
> **容易踩坑：** 任何异常都映射 500；把 429、超时和参数错误统一重试；HTTP 200 包一个失败字符串。
>
> **项目连接：** Wiki 生成的 Validation Failure、Provider Failure 和 Persist Failure 要分开，前者可有限 Repair，后两者按幂等与依赖状态处理。

### Q029：`Any`、`object` 和 `Protocol` 有什么区别？

> **口语化回答：** `Any` 基本退出静态检查，什么操作都允许；`object` 表示任意 Python 对象，但使用前必须 Narrow；`Protocol` 用结构化子类型表达“只要具备这些方法就符合接口”。
>
> **原理追问：** Protocol 很适合 Adapter 和测试替身，不要求业务类显式继承同一个基类。
>
> **容易踩坑：** 大量 Any 会让 Type Checker 失去价值；Protocol 只保证声明层面，外部动态对象仍需要运行时校验。
>
> **项目连接：** Model Provider、Store 和 Parser 会定义小 Protocol，生产实现和 Fake 都遵守同一契约，避免一个巨大抽象基类。

### Q030：`TypeVar`、Generic 和 `ParamSpec` 分别解决什么？

> **口语化回答：** TypeVar 表达输入输出类型之间的关系，Generic 定义可参数化类或接口；ParamSpec 用在高阶函数和装饰器，保留被包装函数的参数签名。
>
> **原理追问：** 如果一个函数只是接收任意类型再原样返回，TypeVar 比 Any 更准确，因为返回类型会跟输入关联。
>
> **容易踩坑：** 为了“类型高级”写出难懂泛型；错误使用协变逆变；装饰器返回 Callable[..., Any] 抹掉所有信息。
>
> **项目连接：** 通用 Repository、Result 和 Middleware 可以用泛型，但跨服务 JSON 契约仍以具体 Schema 为准。

### Q031：`Optional[T]`、`T | None` 和“字段没传”是一回事吗？

> **口语化回答：** `Optional[T]` 就是值可以是 T 或 None，现代写法也可以是 `T | None`。但“字段没传”和“显式传 None”是两种业务语义，需要默认值或 Sentinel 另外表达。
>
> **原理追问：** PATCH 接口尤其要区分：没传表示不修改，传 Null 可能表示清空。
>
> **容易踩坑：** 类型写 Optional 却没有默认值，以为字段自动可缺省；用 None 同时代表未知、删除和默认。
>
> **项目连接：** Repo Settings 更新会使用 Unset 语义，避免用户只改模型时把其他配置清空。

### Q032：静态类型检查怎么做 Type Narrowing？

> **口语化回答：** 通过 `isinstance`、None 判断、Literal 判别字段或自定义 TypeGuard，Type Checker 能把联合类型收窄到具体分支。业务事件我更喜欢带明确 `kind` 的判别联合。
>
> **原理追问：** 静态 Narrow 不等于运行时数据可信，外部 JSON 仍要校验。Match/Case 也可以配合稳定枚举做分支。
>
> **容易踩坑：** 用 Assert 代替外部输入校验，因为优化模式可能移除 Assert；分支没穷尽导致新类型静默落到默认。
>
> **项目连接：** LLM Run Result 会区分 success、validation_error、provider_error，处理层按 Kind 穷尽，而不是检查一堆可能为空的字段。

### Q033：Module 导入时发生什么？为什么循环导入常出问题？

> **口语化回答：** 第一次 Import 会查找模块、创建对象、执行模块顶层代码并放进 `sys.modules`；后续通常复用缓存。循环导入时，对方可能只执行了一半，所以访问的名字还没定义。
>
> **原理追问：** 解决方式优先是重新划分依赖、抽公共契约，不是到处把 Import 塞进函数。局部 Import 只能作为有意识的延迟加载或临时解环。
>
> **容易踩坑：** 模块顶层启动线程、连数据库、读取环境，导致 CLI、测试和 Worker Import 都产生副作用。
>
> **项目连接：** FastAPI App Factory 和 Lifespan 会承担初始化，Route Module 只声明路由和依赖，不在 Import 时做远程操作。

### Q034：`pyproject.toml`、虚拟环境和 Lock File 各解决什么？

> **口语化回答：** `pyproject.toml` 是项目元数据、构建系统和工具配置入口；虚拟环境隔离当前项目的安装环境；Lock File 固定解析后的依赖版本和哈希，提高可复现性。三者职责不同。
>
> **原理追问：** 生产构建要从受控 Lock 安装并记录 Python、平台和 Native Wheel 信息，因为同版本包在不同平台也可能不同。
>
> **容易踩坑：** 只写宽松依赖范围就认为可复现；把本地 Venv 提交；构建时偷偷访问不受控源。
>
> **项目连接：** CodeWiki 的 Parser 和 SQLite Native 扩展对 ABI 敏感，CI 要在目标平台安装并跑解析 Smoke Test，不能只在开发机成功。

### Q035：为什么生产配置不应该散落在模块全局？

> **口语化回答：** 模块 Import 时读取环境会固定得太早，测试难覆盖，热加载和多实例配置也容易混乱。我会集中定义 Settings，在进程启动时校验一次，再通过依赖显式传递。
>
> **原理追问：** 配置要区分静态启动配置和动态业务配置；Secret 只从 Secret Manager 或受控环境注入，不进入代码、日志和前端 Schema。
>
> **容易踩坑：** 默认空密码让服务“能启动”；在 `repr()` 或异常里打印 API Key；不同 Worker 读取到不一致配置。
>
> **项目连接：** LLM Provider、数据库和 Repo 路径会在启动时校验，缺关键配置就让相关能力明确不可用，不做静默错误路由。

### Q036：`pickle` 为什么不能处理不可信数据？

> **口语化回答：** Pickle 不是纯数据格式，反序列化过程中可以调用任意可导入对象，恶意 Payload 可能直接执行代码，所以只能用于完全受信边界。
>
> **原理追问：** 对外接口用 JSON、MessagePack、Protobuf 等数据格式，并做 Schema、大小和字段校验。签名只能证明来源，不能让一个本来不可信的生产者变可信。
>
> **容易踩坑：** 从对象存储、缓存或用户上传文件直接 `pickle.loads`；把模型文件格式默认当安全。
>
> **项目连接：** Wiki Task、Checkpoint 和缓存会保存可验证结构化数据，不接收用户上传的 Pickle 作为任务状态。

### Q037：`eval` 和 `exec` 有什么风险？限制 Builtins 就安全了吗？

> **口语化回答：** 它们会执行 Python 代码，不能用于不可信输入。只删 Builtins 也很难构造真正安全沙箱，对象图、导入和资源耗尽都有绕过空间。
>
> **原理追问：** 如果需求只是表达式、过滤或配置，应该设计受限 DSL、AST 白名单或固定操作符；真正跑代码要进独立容器/VM，限制网络、文件、CPU、内存和时间。
>
> **容易踩坑：** 把 `ast.literal_eval` 当通用无限安全，它虽不执行任意代码，也仍要限制输入大小和嵌套深度。
>
> **项目连接：** CodeWiki 不执行被分析仓库代码，只做静态解析；未来增加 Code Executor 也必须与 API 进程物理隔离。

### Q038：日志为什么要结构化？`print` 有什么问题？

> **口语化回答：** 结构化日志让时间、级别、服务、runId、repoId、错误码和阶段成为可查询字段；`print` 缺少级别、上下文、路由和统一格式，不适合生产排障。
>
> **原理追问：** 日志、Metric 和 Trace 分工不同。日志描述离散事件，Metric 看趋势和告警，Trace 串请求内因果。
>
> **容易踩坑：** 记录完整 Prompt、源码、Token 和凭证；每个 Chunk 打一条 Info；异常只记 Message 不记受控 Stack 和关联 ID。
>
> **项目连接：** CodeWiki 会按 analysisRun、llmRun 和 pageSlug 关联，但公开日志仍要做密钥与源码内容治理，不能因为是内部系统就全量打印。

### Q039：Python 代码性能差，第一步应该做什么？

> **口语化回答：** 先测再改。我会先确认是 CPU、IO、锁、序列化、数据库、网络还是算法复杂度，用 Profile 和分段指标找最大头，不会一上来把所有函数改成 Async。
>
> **原理追问：** 常用方法包括 `cProfile`/Sampling Profiler、Tracemalloc、Event-loop Lag、SQL Explain、HTTP Timing 和业务阶段 Span。
>
> **容易踩坑：** 用单次本地计时下结论；优化微秒级语法却忽略 N+1 或模型调用；Benchmark 没预热、没固定数据。
>
> **项目连接：** CodeWiki 会把扫描、AST、构图、Embedding、社区、LLM 和落库分段计时，才能解释增量复用高但端到端收益有限的原因。

### Q040：Python 中怎样安全处理 Secret 和敏感数据？

> **口语化回答：** Secret 不进 Git、不写默认值、不返回前端，也不进入普通日志。由环境或 Secret Manager 注入，启动时校验，使用最小权限，并支持轮换和撤销。
>
> **原理追问：** 日志出口统一 Redaction，比要求每个调用点自觉更可靠；错误响应只给公开 Code 和 Trace ID，原始上游 Body 受控保存。
>
> **容易踩坑：** Pydantic Model 的 `repr`、HTTP Debug、异常字符串或配置 Dump 泄露 Key；把“内部项目”当成无攻击面。
>
> **项目连接：** LLM Gateway、Git 凭证和数据库 DSN 都要做字段级脱敏；公开 GitHub 前还要跑 Secret Scan。

## 3. GIL、线程、进程与 asyncio

### Q041：GIL 是什么？Python 多线程是不是完全没用？

> **口语化回答：** 传统 CPython 默认构建里的 GIL 会限制同一解释器内多个线程同时执行 Python Bytecode，所以 CPU 密集型代码不能只靠加线程线性扩展；但线程在等待网络、文件和很多释放 GIL 的 Native 操作时仍然有价值。
>
> **原理追问：** Python 已经有可选的 Free-threaded 构建方向，但部署时必须明确解释器构建、第三方扩展兼容性和实际 Benchmark，不能笼统说“新 Python 已经没有 GIL”。
>
> **容易踩坑：** 把 GIL 说成所有操作线程安全；把 IO 密集请求也全部改多进程；忽略 C 扩展内部是否释放 GIL。
>
> **项目连接：** HTTP/数据库/LLM 调用适合 Async 或线程并发，CPU 重的 Tree-sitter 后处理、图算法和本地模型要根据 Profile 评估进程池、Native 实现或独立 Worker。

### Q042：Thread、Process 和 Coroutine 怎么选？

> **口语化回答：** IO 阻塞且依赖同步库时可以用线程；纯 Python CPU 密集任务更适合多进程或外部计算服务；大量可异步 IO 适合 Coroutine。选型看工作负载和依赖，不是哪个概念更新。
>
> **原理追问：** 线程共享内存、通信方便但有竞态；进程隔离强但序列化和启动成本高；Coroutine 在单线程 Event Loop 上协作切换，要求任务主动 Await。
>
> **容易踩坑：** 在 Coroutine 里调用阻塞库；向进程池传不可 Pickle 的对象；把共享内存竞态误认为 GIL 会保护。
>
> **项目连接：** FastAPI 请求和远程 LLM 用 Async；同步 Git/解析库放受控线程池；大规模 CPU 图计算可以拆进独立 Worker，并通过 Artifact 引用传结果。

### Q043：有 GIL，`count += 1` 为什么仍可能有竞态？

> **口语化回答：** GIL 不等于一整段业务操作原子。`count += 1` 包含读取、计算和写回，多线程可能在这些步骤间切换；更复杂的“先查再写”同样会竞态。
>
> **原理追问：** 正确性要靠 Lock、原子化数据库语句、队列所有权或不可变消息传递证明，不能靠某个 Python 版本的偶然字节码实现。
>
> **容易踩坑：** 看到单次 Dict 赋值当前没出问题，就把一组 Dict 操作也当事务；依赖压测“没复现”。
>
> **项目连接：** 同 Repo 分析任务去重会由数据库唯一约束或任务租约裁决，不用进程内 Dict 先查后写保证跨 Worker 幂等。

### Q044：`Lock`、`RLock`、`Semaphore`、`Event` 和 `Condition` 怎么区分？

> **口语化回答：** Lock 保护互斥临界区；RLock 允许同一线程重入；Semaphore 限制同时进入的数量；Event 广播一个状态已发生；Condition 让线程在持锁条件下等待某个谓词变化。
>
> **原理追问：** Condition 等待要放在 While 里重新检查条件，因为可能虚假唤醒或条件已被别的线程消费。
>
> **容易踩坑：** 锁内做长网络请求；漏 Release；把 Semaphore 当速率限制，它只限制并发，不限制每秒请求数。
>
> **项目连接：** LLM Provider 用 Semaphore 控并发，真正的 RPM/TPM 还要 Token Bucket；共享本地文件更新用窄范围 Lock，并避免锁内调用模型。

### Q045：ThreadPoolExecutor 的 Worker 数是不是越多越好？

> **口语化回答：** 不是。线程数要看阻塞比例、下游连接池、Rate Limit、内存和上下文切换。超过下游容量只会把等待搬到本机队列，还可能造成超时雪崩。
>
> **原理追问：** 要同时限制提交速度和队列长度，设置端到端 Deadline，并观察 Active、Queued、Wait Time 和 Reject。
>
> **容易踩坑：** 默认无界提交；请求超时后后台 Future 仍继续占线程；在线程池任务里再同步等待同一个小线程池产生饥饿死锁。
>
> **项目连接：** 仓库文件解析并发会和数据库连接、CPU 核数一起定，不会只把 `max_workers` 调到几百。

### Q046：ProcessPoolExecutor 有哪些边界？

> **口语化回答：** 进程池能绕开传统 GIL 做 CPU 并行，但参数和返回值要可序列化，进程启动、IPC 和数据复制都有成本。大对象频繁往返可能比计算本身更贵。
>
> **原理追问：** 不同平台和启动方式有 Fork、Spawn 等差异；服务进程里要显式管理 Worker 生命周期和崩溃恢复。
>
> **容易踩坑：** 把数据库连接、锁、打开文件或巨大图对象直接传进池；在 Import 顶层创建进程；任务没有超时和幂等。
>
> **项目连接：** 若图算法需要多进程，我会让 Worker 按 Repo Artifact ID 自己加载数据，只传小任务描述和结果引用。

### Q047：`asyncio` Event Loop 是怎么工作的？

> **口语化回答：** Event Loop 负责调度可运行 Task、处理 IO 就绪和 Timer。Coroutine 执行到尚未完成的 Await 时把控制权交回 Loop，Loop 再运行其他 Task，所以它是协作式并发。
>
> **原理追问：** Async 提高的是等待期间的并发利用率，不会让单个 CPU 运算自动变快。
>
> **容易踩坑：** 在 Loop 里 `time.sleep()`、同步 HTTP、重 CPU 循环；一个 Task 长时间不 Await 会卡住所有请求。
>
> **项目连接：** FastAPI 的远程检索和模型调用会用 Async Client，但 AST CPU 阶段要离开 Event Loop，并监控 Loop Lag。

### Q048：Coroutine、Task 和 Future 有什么区别？

> **口语化回答：** 调用 `async def` 得到 Coroutine 对象；把它交给 `create_task` 后成为被 Event Loop 调度的 Task；Future 是一个将来会有结果或异常的低层占位，Task 本身也是 Future 的一种。
>
> **原理追问：** 直接 `await coroutine` 是当前 Task 等它完成；`create_task` 才允许它与当前流程并发推进。
>
> **容易踩坑：** 创建 Coroutine 却从不 Await；Fire-and-forget Task 没保存引用和异常；把 Task 当可靠后台任务系统。
>
> **项目连接：** 请求内短并发可以建 Task；跨请求、要重试恢复的 Wiki 生成必须持久化为 Run/Job，不能依赖进程内 Task。

### Q049：是不是只要写了 `await` 就一定会切换任务？

> **口语化回答：** 不一定。Await 的对象如果已经完成，可能立即返回；是否真正挂起取决于 Awaitable 状态。正确性不能依赖某一行“应该会切一下”来避免竞态。
>
> **原理追问：** Coroutine 在两个可能挂起点之间通常连续执行，但调用的库内部可能新增 Await，未来版本也可能改变时序。
>
> **容易踩坑：** 因为当前没有 Await 就不加同步，后来重构加入 IO 后出现竞态；在临界区中不知情地调用会 Await 的函数。
>
> **项目连接：** 任务状态更新靠事务和 CAS，不靠“这几行 Async 代码大概不会切换”的假设。

### Q050：为什么要保留 `create_task()` 返回的引用？

> **口语化回答：** 我需要跟踪 Task 的生命周期、异常、取消和关闭 Drain。裸 Fire-and-forget 容易让异常无人获取，服务停机时也不知道还有多少任务。
>
> **原理追问：** 可以放进集合并在 Done Callback 中移除，同时读取异常；更推荐有父作用域的 TaskGroup 做结构化并发。
>
> **容易踩坑：** Done Callback 自己抛错；请求结束后 Task 还引用巨大 Request；进程退出时任务被直接截断。
>
> **项目连接：** Memory Deferred Embedding 的教训就是后台任务必须登记并 Drain；更可靠的工作还要进入持久队列。

### Q051：`asyncio.gather` 和 `TaskGroup` 怎么选？

> **口语化回答：** Gather 适合收集一组明确 Awaitable 的结果；TaskGroup 更强调结构化并发，作用域退出前等待子任务，并用异常组表达并发失败。需要“一个失败就取消同组其他任务”的清晰生命周期时我优先 TaskGroup。
>
> **原理追问：** Gather 的异常、取消和 `return_exceptions` 语义要仔细定义，不能开关一设就把失败当成功结果。
>
> **容易踩坑：** 并发任务有外部副作用却在同组失败时重复重跑；结果顺序和完成顺序混淆。
>
> **项目连接：** 并行生成独立 Wiki 叶子页时，每页有稳定 ID 和独立状态；汇总按 Slug，不依赖哪个 Task 先完成。

### Q052：`wait`、`as_completed` 和 `gather` 的差别是什么？

> **口语化回答：** Gather 适合按输入顺序收结果；Wait 适合拿 Done/Pending 集合并控制 First Completed 或 First Exception；As-completed 适合哪个先完成就先处理哪个结果。
>
> **原理追问：** 选 API 前先定义部分成功、超时后 Pending 怎么办、结果是否需要稳定顺序。
>
> **容易踩坑：** 只停止等待不取消底层；As-completed 返回顺序被误当业务顺序；部分结果落库后整体重试重复写。
>
> **项目连接：** 多页面生成可以先落完成页，但 Run 总状态必须记录每页成功/失败，恢复只重跑缺失页。

### Q053：Async Task 取消后怎样正确清理？

> **口语化回答：** 取消是协作式的，通常在下一个 Await 处抛 `CancelledError`。我会用 `try/finally` 释放资源，做完最小清理后继续向上抛，不把取消吞成普通成功。
>
> **原理追问：** 库层要把 Cancel 传播到 HTTP、数据库和子任务；外部写操作还要按状态和幂等键确认，因为取消到达时它可能已经成功。
>
> **容易踩坑：** `except BaseException` 或宽泛 Catch 吞 Cancel；清理阶段无限等待；取消后仍 Commit 业务结果。
>
> **项目连接：** 用户取消 Repo 分析时，当前 Stage 要落 Cancelled/Unknown，不能直接标 Failed 后盲目重跑所有副作用。

### Q054：`asyncio.timeout` 能保证底层操作已经停止吗？

> **口语化回答：** 它能限制调用方等待时间并通过取消推动 Coroutine 退出，但是否真正停止取决于下游是否响应取消。线程池函数、某些驱动和远端服务可能继续执行。
>
> **原理追问：** 我会传端到端 Deadline，各层按剩余时间设置自己的超时；对未知结果的写操作要查询状态而不是直接重试。
>
> **容易踩坑：** 每层重新给 30 秒导致总时长叠加； Timeout 后立即复用仍被占用的连接；把超时等同于失败未执行。
>
> **项目连接：** LLM、Embedding、Git 和数据库都会接受剩余 Deadline，Run Trace 记录实际在哪一层超时。

### Q055：`asyncio.shield` 应该什么时候用？

> **口语化回答：** Shield 可以让外层取消时不直接取消被保护 Awaitable，但外层仍会收到取消。它只适合很短、必须收尾的一致性步骤，不能拿来让所有后台任务无视关闭。
>
> **原理追问：** 被 Shield 的 Task 仍要保留引用、设置自己的 Deadline，并在关闭阶段统一等待。
>
> **容易踩坑：** Shield 一个可能永久挂起的网络调用；认为外层取消后结果会自动被消费。
>
> **项目连接：** 最多 Shield 原子写入后的短状态落盘；长 LLM 调用和页面生成应该可取消或可恢复。

### Q056：Async Lock、Semaphore 和 Queue 各解决什么？

> **口语化回答：** Async Lock 保护同一 Event Loop 中的临界区；Semaphore 限制并发数量；Queue 解耦生产消费并提供缓冲。它们都只作用于当前进程或 Loop，不是分布式协调。
>
> **原理追问：** Queue 的 `maxsize` 可以形成背压，消费者处理完要正确 `task_done`，关闭还要有 Sentinel 或明确 Cancel 协议。
>
> **容易踩坑：** 用 Async Lock 保护跨 Worker 数据；Queue 无界；锁内 Await 慢依赖。
>
> **项目连接：** 单进程页面并发可用 Semaphore，跨 Worker 的同 Repo 互斥必须落数据库 Lease 或唯一约束。

### Q057：在 Async 代码里遇到阻塞同步库怎么办？

> **口语化回答：** 短期可以用 `asyncio.to_thread` 或受控 Executor 把阻塞 IO 移出 Event Loop；长期优先换真正 Async Client。CPU 重任务不应该无限塞线程池。
>
> **原理追问：** 转线程只保护 Loop，不减少阻塞本身，还要限制线程并发和下游连接。
>
> **容易踩坑：** 每个请求创建新线程池；超时后线程继续跑；在线程里使用绑定当前 Loop 的对象。
>
> **项目连接：** 同步 Git 库和少量文件操作可转线程；Tree-sitter 批量 CPU 是否转线程要用实际 GIL 行为和 Profile 决定。

### Q058：什么是 Backpressure？Async 系统为什么更需要它？

> **口语化回答：** Backpressure 是下游处理不过来时，让上游减速、排队受限或拒绝，而不是无限积压。Async 很容易快速创建大量 Task，把内存、连接池和 Provider 配额瞬间打满。
>
> **原理追问：** 常用手段包括有界 Queue、Semaphore、批处理、Rate Limit、Admission Control 和按租户配额。
>
> **容易踩坑：** 只限制 Worker 并发却让待处理队列无限长；超时请求仍留队列；没有 Queue Age 告警。
>
> **项目连接：** Wiki 批量生成会限制页并发、Repo Run 并发和 Provider Token，队列满时明确返回 429/Accepted，而不是假装立即执行。

### Q059：怎样写可靠的 Producer/Consumer？

> **口语化回答：** 我会定义有界 Queue、任务身份、成功 Ack、失败重试、退出协议和重复处理语义。进程内 Queue 适合短生命周期并发，不适合要求崩溃恢复的核心任务。
>
> **原理追问：** 消费者拿到任务后直到结果持久化前都可能崩溃，所以外部副作用需要幂等，可靠队列还要有 Visibility Timeout 或 Lease。
>
> **容易踩坑：** `task_done` 放错位置；消费者异常退出后 Queue 永久 Join；Poison Message 无限重试。
>
> **项目连接：** LLM 页面任务会保存 Attempt、Error Class 和 Next Retry，超过上限进 Failed/Draft，不在内存队列里永久转圈。

### Q060：Async Generator 和普通 Generator 有什么不同？

> **口语化回答：** Async Generator 用 `async def` 加 `yield`，消费者用 `async for`，每次产出之间可以 Await IO，适合 SSE、流式模型和异步分页。
>
> **原理追问：** 关闭时要处理 `aclose` 和取消，生产速度也要受消费者和网络背压影响。
>
> **容易踩坑：** 客户端断开后仍继续读取完整模型响应；在 Generator 里持有数据库事务太久；异常后没发送可解析终止事件。
>
> **项目连接：** Ask Wiki 的 Token 流会传播断开信号，最终 Usage 和 Run 状态走独立收尾，不靠最后一个 Token 碰巧送达。

### Q061：`contextvars` 解决什么？能自动跨进程吗？

> **口语化回答：** ContextVar 保存当前异步上下文里的值，适合 requestId、tenantId 和 Trace Context，能避免普通 ThreadLocal 在 Coroutine 间串值。它不会自动跨进程、消息队列或所有线程边界。
>
> **原理追问：** 创建 Task 时上下文通常会复制；跨线程/进程要显式传播可信字段。
>
> **容易踩坑：** 把 ContextVar 当权限来源，用户仍可能伪造 Header；请求结束没 Reset；后台 Task 继承了不该长期保留的上下文。
>
> **项目连接：** 入口鉴权后生成可信 Tenant Context，写入 ContextVar 便于日志关联，但数据库查询仍强制接收 Tenant Filter。

### Q062：异步数据库连接池怎么定大小？

> **口语化回答：** Pool 大小由数据库最大连接、服务实例数、查询耗时和并发目标共同决定，不等于 FastAPI 并发数。要给管理连接和故障恢复留余量。
>
> **原理追问：** 关键指标是 Pool Wait、Active/Idle、Query p95、事务时长和 Timeout；请求排队比把数据库打死更可控。
>
> **容易踩坑：** 每个 Worker 都按数据库总上限建池；事务里等待 LLM；连接取出后没归还；健康检查制造额外风暴。
>
> **项目连接：** CodeWiki 不会在数据库事务中调用模型，先确定性落任务，再由 Worker 处理并短事务写结果。

### Q063：HTTP Client 为什么要复用？

> **口语化回答：** 每次新建 Client 会重复 DNS、TCP/TLS 和连接池初始化，性能差且容易耗尽 Socket。我会在应用 Lifespan 创建受控 Async Client，设置连接池、超时和关闭。
>
> **原理追问：** 超时要分 Connect、Read、Write、Pool，重试只针对明确可恢复且幂等的情况。
>
> **容易踩坑：** 一个全局 Client 没有租户隔离 Header；不限制响应体大小；流式响应没关闭。
>
> **项目连接：** Model Provider 和 Git 服务各用独立 Client/Pool/限流，避免一个供应商慢连接占满所有下游容量。

### Q064：重试怎样同时处理 Deadline、退避、抖动和幂等？

> **口语化回答：** 先按错误分类，只有网络抖动、429 和部分 5xx 才重试；每次用指数退避加 Jitter，并检查总 Deadline 剩余时间。写操作必须有业务幂等键或状态查询。
>
> **原理追问：** 优先尊重 Retry-After；重试预算要小于端到端 Deadline，还要限制整条调用链的总尝试次数。
>
> **容易踩坑：** 401、Schema 错误也重试；每层各重试三次形成放大；Timeout 后不知道远端是否成功就再次写。
>
> **项目连接：** LLM 生成可以安全重算但落库按 Page Slug/Run ID Upsert；发布、发送和建任务则必须稳定幂等。

### Q065：Python 服务里 CPU 密集的 Embedding、解析或图算法怎么隔离？

> **口语化回答：** 我会先 Profile 确认 CPU 占比和 Native 库是否释放 GIL。短任务可以受控转线程或进程，重任务更适合独立 Worker 服务，并用队列、资源配额和 Artifact Store 隔离 API 进程。
>
> **原理追问：** 还要防 Oversubscription：多 Worker、每个 Worker 的线程池、BLAS 线程和模型内部线程叠加会把机器打满。
>
> **容易踩坑：** 把模型加载到每个 Web Worker 导致内存倍增；大向量跨进程反复复制；CPU 任务没有取消和租约。
>
> **项目连接：** CodeWiki API 只做任务入口和查询，仓库分析与大批 Embedding 可由独立 Worker 承担，Web 延迟不和批处理抢同一 Event Loop。

## 4. ASGI、FastAPI、Pydantic 与 API 工程

### Q066：WSGI 和 ASGI 有什么区别？为什么 FastAPI 通常跑在 ASGI Server 上？

> **口语化回答：** WSGI 面向传统同步 HTTP 请求，一个调用返回一个响应；ASGI 把连接抽象成异步事件，可以统一承载 HTTP、流式响应和 WebSocket。FastAPI 本身是 ASGI 应用，通常由 Uvicorn 这类 ASGI Server 接收网络请求并驱动它。
>
> **原理追问：** ASGI 不是“用了 Async 就自动更快”，它主要让大量 IO 等待期间可以复用线程；CPU 重任务、同步数据库和阻塞 SDK 仍要隔离。
>
> **容易踩坑：** 把 Uvicorn、FastAPI 和 ASGI 混成一个概念；在 Async Route 里直接执行阻塞代码；认为 ASGI 天然保证多进程状态一致。
>
> **项目连接：** 当前 CodeWiki 的 FastAPI Route 会把部分同步扫描和存储工作交给 `run_blocking`，也就是用线程保护 Event Loop；这能证明做了阻塞隔离，但不能证明所有路径都已完成高并发压测。

### Q067：ASGI 的 `scope`、`receive` 和 `send` 分别是什么？

> **口语化回答：** Scope 是这条连接的元数据，比如协议类型、路径、Header 和客户端信息；Receive 用来接收入站事件；Send 用来发送响应开始、响应体或 WebSocket 事件。一个 ASGI Application 本质上就是接收这三个参数的异步可调用对象。
>
> **原理追问：** HTTP Body 可以分多个事件到达，响应也可以分块发送；WebSocket 则是一条连接上的持续双向事件流。Middleware 正是通过包装这三个对象拦截或改写事件。
>
> **容易踩坑：** 假设请求体一定一次读完；流式响应发出 Header 后还想修改状态码；Middleware 消费了 Body 却没有正确转发。
>
> **项目连接：** 当前 CodeWiki 的公开 API 主要使用 FastAPI 高层 Route 和普通 JSON Response，没有自定义底层 ASGI 协议层；如果下一版做可恢复流式输出，我才会下沉处理断开、事件 ID 和背压。

### Q068：一次 FastAPI 请求大致经过哪些阶段？

> **口语化回答：** 我会从 ASGI Server 接收请求讲起，然后进入 Middleware，完成路由匹配、依赖解析、参数和 Body 校验，执行 Endpoint，再做 Response Model 序列化，最后按相反方向经过 Middleware 发回响应；异常会进入对应 Exception Handler。
>
> **原理追问：** Dependency 本身也是一张有缓存语义的调用图，校验失败通常在业务函数执行前就返回 422。流式响应与普通 JSON 的生命周期不同，资源不能默认在 Endpoint Return 时就已经释放。
>
> **容易踩坑：** 在 Middleware 和 Endpoint 重复读 Body；依赖里开事务却跨完整流式响应持有；把所有异常都包成 200。
>
> **项目连接：** 当前 CodeWiki 用 Router 区分 repos、files、graph、wiki、ask、runs 和 settings，依赖层提供 Store 与 Service；我会按这条请求链定位错误究竟发生在校验、服务、模型还是存储。

### Q069：FastAPI 里的 `def` 和 `async def` Route 怎么选？

> **口语化回答：** 调用真正异步的 HTTP、数据库或流式 SDK 时用 `async def`；只有同步阻塞库时可以写普通 `def` 让框架放线程池，或者在 Async Route 中显式用受控线程隔离。不能为了统一样式把阻塞函数直接塞进 Event Loop。
>
> **原理追问：** 普通 `def` Route 通常在线程池执行，`async def` 在 Event Loop 执行。线程池也有容量和队列，不能把它当无限后台 Worker。
>
> **容易踩坑：** Async Route 里调用同步 SQL、Git 或 `time.sleep`；线程池任务超时后仍在后台运行；CPU 重任务把共享线程池占满。
>
> **项目连接：** 当前 CodeWiki 的 Route 多为 Async，但 Store 是同步 SQLAlchemy，实现通过 `run_blocking` 隔离部分同步工作。下一版是否改 Async Engine，要根据 Pool Wait、Loop Lag 和实际并发决定，不会只为“全异步”重写。

### Q070：Uvicorn 多 Worker 后，模块全局变量和进程内锁会发生什么？

> **口语化回答：** 每个 Worker 是独立进程，各自有 Event Loop、内存、连接池和模块全局对象。一个 Worker 里的 Dict、Cache 或 Lock 对其他 Worker 不可见，所以它不能保证跨 Worker 去重或互斥。
>
> **原理追问：** Worker 数增加会同时放大数据库连接、模型 Client 和内存占用。共享状态要放数据库、Redis 或可靠队列，并用唯一约束、Lease 或 Fencing 做一致性。
>
> **容易踩坑：** 只把 Worker 从 1 调到 8，却仍按单进程计算连接池；用进程内 Lock 宣称分布式互斥；每个 Worker 都加载一份大模型。
>
> **项目连接：** 当前 CodeWiki 的 `repo_write_lock` 是进程内 per-repo 锁，适合现有 Local-first 单进程边界；如果下一版多 Worker 部署，必须换成数据库条件更新或分布式租约，不能直接沿用现状。

### Q071：FastAPI Lifespan 适合管理哪些资源？

> **口语化回答：** Lifespan 适合在应用启动时创建长期资源，比如 HTTP Client、数据库 Engine、模型 Client 和限流器，在关闭时按顺序 Drain 并释放。它比 Import 时初始化或魔法单例更容易测试和控制失败。
>
> **原理追问：** 启动失败要让进程明确失败，不能带着半初始化资源接流量；关闭则先停止接新任务，再等待有界时间，最后关闭 Client、Pool 和文件句柄。
>
> **容易踩坑：** 每个请求创建 Client；Import 阶段连数据库；Shutdown 无限等待；多 Worker 下误以为 Lifespan 只执行一次。
>
> **项目连接：** 当前 CodeWiki 有缓存化的 Settings 和 Store，但 `main.py` 没有一套完整 Lifespan 关停编排。把 Store、LLM Client、后台任务登记和 Drain 统一进 Lifespan 是下一版设计，不说成当前已有。

### Q072：FastAPI 的路径、查询、Header 和 Body 参数是怎么解析的？

> **口语化回答：** FastAPI 根据函数签名和类型注解决定参数来源，Path 来自路由模板，Query 来自 URL，Header 和 Cookie 要显式声明，Pydantic Model 通常承载 JSON Body。边界参数我会写清长度、范围、枚举和格式，不让任意 Dict 直接进入业务层。
>
> **原理追问：** 路由声明顺序可能影响固定路径和动态路径的匹配；OpenAPI Schema 来自这些声明，但 Schema 正确不代表业务权限正确。
>
> **容易踩坑：** `/repos/me` 被 `/repos/{repo_id}` 提前匹配；把敏感 Token 放 Query；把客户端 Header 直接当可信 Tenant ID。
>
> **项目连接：** CodeWiki 当前通过 repoId、slug 和 Pydantic Payload 组织 API；下一版加入身份后，Repo 访问权限必须由服务端身份映射得出，不能信任用户自己传的租户或仓库权限字段。

### Q073：Pydantic v2 的校验和序列化主流程怎么讲？

> **口语化回答：** 外部数据进入时用 `model_validate` 或 FastAPI 自动校验成 Model，内部使用明确类型，输出时用 `model_dump` 或 Response Model 序列化。Pydantic 会做解析和约束校验，但不会自动理解业务正确性。
>
> **原理追问：** v2 的核心校验由 pydantic-core 执行；输入别名、输出别名、字段排除和序列化器要分别设计，不能把 ORM 实体原样暴露。
>
> **容易踩坑：** 认为类型通过就代表 Repo 存在、用户有权限；默认值未经预期校验；把 Secret 字段通过 `repr` 或 `model_dump` 打进日志。
>
> **项目连接：** 当前 CodeWiki 的 Request/Response Schema 已经把 API 契约和内部 Store Record 分开；LLM Structured Output 也应先过 Pydantic，再过 Source Ref、状态和权限等业务校验。

### Q074：`field_validator` 和 `model_validator` 怎么选？

> **口语化回答：** 单字段格式、归一化和范围用 Field Validator；需要比较多个字段或校验整体不变量时用 Model Validator。能用声明式 Field Constraint 表达的，我不会先写自定义 Validator。
>
> **原理追问：** Before Validator 处理原始输入，After Validator 面对已解析值；Validator 应尽量纯函数、确定且快速，不在里面查数据库或调模型。
>
> **容易踩坑：** Before 阶段假设输入类型；Validator 静默改写用户数据；交叉字段错误挂在错误位置；校验里做 IO 导致不可预测延迟。
>
> **项目连接：** CodeWiki 可以在 Schema 层校验语言码、页 Slug 和数值边界，但 Repo 是否存在、Source Ref 是否允许必须在 Service 层查当前状态，不能塞进 Pydantic Validator。

### Q075：Pydantic 默认类型转换和 Strict Mode 怎么取舍？

> **口语化回答：** Pydantic 默认会做一定的类型转换，适合友好的外部输入；身份、金额、版本和安全策略这类不能含糊的字段，我会用 Strict 类型或显式约束，避免字符串和布尔值被意外接受。
>
> **原理追问：** 严格度可以按字段、Model 或单次校验控制。选择依据是兼容性和风险，不是所有接口一刀切 Strict。
>
> **容易踩坑：** 把字符串 `false` 当成真假转换；ID 前导零被转整数；从环境变量读取时又忘了配置天然是字符串。
>
> **项目连接：** CodeWiki 的模型参数和环境配置可以做有意识转换，但 Repo ID、Run ID、版本和危险操作确认字段要更严格；当前实际约束以 Schema 为准，不补造已经启用全局 Strict Mode。

### Q076：Discriminated Union 为什么适合事件和多种 LLM 结果？

> **口语化回答：** 我会给不同结构一个稳定判别字段，比如 `kind=success|validation_error|provider_error`，再用 Discriminated Union 解析。这样类型收窄明确，新增分支也更容易发现漏处理。
>
> **原理追问：** 它比“几十个 Optional 字段加 if 判断”更清楚，OpenAPI 也能表达 `oneOf`。判别值应稳定版本化，不能拿自然语言 Message 当类型。
>
> **容易踩坑：** 多个分支判别值重叠；客户端没有兜底未知版本；把内部异常对象直接放进公开结果。
>
> **项目连接：** 下一版可以把 Wiki 页生成结果统一成成功、校验失败、模型失败和持久化失败的判别联合；当前项目已有分层错误，但不能反过来说所有接口已经统一成这套 Schema。

### Q077：Request Model、Response Model、数据库 Model 为什么不建议共用一个？

> **口语化回答：** 三者的信任边界和字段生命周期不同。Request 只接收用户允许填写的字段，Response 只暴露可公开字段，数据库 Model 包含内部状态和关系；拆开能防止 Mass Assignment 和敏感字段泄露。
>
> **原理追问：** 创建、更新和读取通常也不是同一个 Schema，PATCH 还要区分 Unset 与显式 Null。映射代码看似多一点，但契约更稳定。
>
> **容易踩坑：** 用户提交 `is_admin`、ownerId 或内部状态并被 ORM 自动写入；Response 懒加载关系引发 N+1；内部字段随表变更破坏 API。
>
> **项目连接：** 当前 CodeWiki 的 API Schema、SQLAlchemy Model 和 Record/DTO 已分层，这是可讲的现状；未来加用户和 ACL 时更不能让数据库实体直接作为写入 Schema。

### Q078：FastAPI Dependency Injection 的缓存语义是什么？

> **口语化回答：** FastAPI 会先解析依赖图，同一次请求里相同依赖默认复用结果，避免重复创建 Session 或重复鉴权；确实需要每次重新执行时才关闭缓存。它是请求依赖机制，不是自动解决所有对象生命周期的通用容器。
>
> **原理追问：** 子依赖可以组合身份、权限、Store 和业务 Service。依赖函数的参数同样会被 FastAPI 解析和校验。
>
> **容易踩坑：** 依赖有隐藏可变状态；误以为请求缓存能跨请求；同一个依赖因参数不同被当成同一实例。
>
> **项目连接：** 当前 CodeWiki 的 Store 和 ServiceContainer 通过 Dependency 提供；我会保持依赖小而明确，下一版鉴权可作为子依赖组合进 Repo ACL，而不是在每个 Route 复制判断。

### Q079：带 `yield` 的 Dependency 怎样管理数据库 Session？

> **口语化回答：** `yield` 前获取资源并把它交给 Endpoint，`finally` 中 Commit、Rollback 或 Close。关键是先定义事务边界和依赖作用域，不能让一次 Session 跨到不确定长度的流式响应或后台任务。
>
> **原理追问：** Session 应按请求或更窄的 Unit of Work 创建，不跨并发 Task 共享。后台任务需要自己重新获取资源，不能继续用请求已经关闭的 Session。
>
> **容易踩坑：** 异常路径仍 Commit；Response 发出后才发现事务失败；Streaming Generator 一直占连接；Dependency Cleanup 吞掉原异常。
>
> **项目连接：** 当前 CodeWiki Store 自己用 `orm_session()` Context Manager 管短事务，并不是一条 AsyncSession-per-request 链。若下一版改请求级 Session，要先梳理现有 Repository 的提交边界，不能简单套一个 `yield`。

### Q080：怎么 Override FastAPI Dependency，为什么这比全局 Monkeypatch 更稳？

> **口语化回答：** 测试可以通过 `app.dependency_overrides` 把生产 Store、身份或 Provider 换成 Fake，并在用例后恢复。这样替换点就是公开依赖契约，影响范围比 Patch 任意模块全局更清楚。
>
> **原理追问：** Fake 要满足同一 Protocol，并验证调用参数和副作用；对 Lifespan 资源还要确保测试真正执行启动和关闭。
>
> **容易踩坑：** Override 没清理导致用例串扰；替身行为比真实实现宽松；只测到 Dependency 返回值，没有测异常和权限分支。
>
> **项目连接：** 当前 CodeWiki 测试已经使用临时 SQLite、Monkeypatch 和 Fake LLM。下一步可以把 Store 与身份依赖更多改成显式 Override，但不能把建议说成所有现有测试都已这样实现。

### Q081：Middleware、Dependency、Decorator 和 Exception Handler 怎么选？

> **口语化回答：** 全请求都要做的 Trace、统一安全 Header 和耗时适合 Middleware；需要路由参数、身份或业务上下文的校验适合 Dependency；稳定异常到 HTTP 的映射放 Exception Handler；Decorator 只留给不依赖 FastAPI 生命周期的小型横切逻辑。
>
> **原理追问：** Middleware 位于路由外层，不天然知道最终 Endpoint 的业务语义；Dependency 更接近业务入口，也能被测试替换。
>
> **容易踩坑：** 在 Middleware 里做所有权限判断；Decorator 丢函数签名；同一异常被多层重复记录；重复读请求 Body。
>
> **项目连接：** 当前 CodeWiki 只明确配置了 CORS Middleware。Trace、统一错误和鉴权层是下一版设计，现有 Route 中的错误转换不能包装成已经存在完整 Middleware 体系。

### Q082：FastAPI Middleware 的执行顺序和 `BaseHTTPMiddleware` 有什么坑？

> **口语化回答：** Middleware 像洋葱，请求按外到内进入，响应再按内到外返回；新增多个 Middleware 时我会用测试确认实际顺序。涉及流式 Body、ContextVar 或底层取消语义时，我更倾向写纯 ASGI Middleware，而不是盲目套高层包装。
>
> **原理追问：** `BaseHTTPMiddleware` 为调用方式做了便利封装，但在上下文传播、请求体消费和流式场景有额外边界；纯 ASGI 包装 `scope/receive/send` 控制更直接。
>
> **容易踩坑：** Trace Context 在意外的 Task 边界丢失；读取 Body 后下游拿不到；异常响应漏安全 Header；压缩 Middleware 缓冲了流式输出。
>
> **项目连接：** 当前 CodeWiki 没有自定义 Middleware 链。若下一版加入 Trace、鉴权和流式输出，我会先画清顺序并为断开、异常和 Header 写集成测试。

### Q083：FastAPI 的异常处理和 HTTP 状态码怎么设计？

> **口语化回答：** 我会把参数校验、未认证、无权限、不存在、冲突、限流、依赖故障和内部错误分开，映射成稳定状态码和业务 Code；公开 Message 不带 SQL、路径、Prompt 或密钥，日志用 Trace ID 关联原始 Cause。
>
> **原理追问：** 401 表示还没建立有效身份，403 表示身份有效但没有权限；409 适合状态冲突，422 常用于请求语义校验失败，429 要配重试提示。
>
> **容易踩坑：** 所有错误都 500 或 200；把供应商原始 Body 返回用户；Catch 后丢 Cause；客户端按中文 Message 写逻辑。
>
> **项目连接：** 当前 CodeWiki 已把部分 ValueError 和 LLMCallError 转成 HTTPException。下一版应统一错误 Envelope 和 Trace ID，但不能说当前所有 Router 已有完整一致的错误合同。

### Q084：CORS 能不能替代鉴权？反向代理 Header 为什么也不能盲信？

> **口语化回答：** 不能。CORS 是浏览器限制前端脚本跨域读取响应，不会阻止 Curl、脚本或内网其他主机直接请求；鉴权必须由服务端完成。代理传来的用户、IP 和协议 Header 也只能在请求确实来自受信代理时接受。
>
> **原理追问：** 要配置明确 Origin、Credential 和 Method；生产还要有 TLS、Trusted Host、受信代理网段和身份令牌校验。
>
> **容易踩坑：** `allow_origins=*` 又带 Cookie；把 `X-User-Id` 当认证；无条件信 `X-Forwarded-For`；把预检成功理解成业务授权成功。
>
> **项目连接：** 当前 CodeWiki CORS 只允许本地 Vite Origin，但没有 Bearer、Session、RBAC 或 Tenant Filter，所以它仍是单用户 Local-first 边界；任何网络暴露前都必须补服务端身份与 Repo ACL。

### Q085：大文件上传和大请求体怎样避免把内存打满？

> **口语化回答：** 我会在反向代理和应用两层限制请求大小，使用流式读取或临时文件，边读边算 Hash 和校验类型，设置总时限、文件数和解压后大小。真正的大对象优先直传对象存储，API 只接收受控引用。
>
> **原理追问：** `UploadFile` 可利用 Spooled File，避免小文件都落盘、大文件都驻内存；但压缩炸弹、路径穿越和恶意 Parser 仍要单独防。
>
> **容易踩坑：** 只看扩展名和客户端 MIME；一次 `await file.read()` 读完整文件；解压到用户提供路径；上传完成前就创建不可清理的业务记录。
>
> **项目连接：** 当前 CodeWiki 主要按服务器可访问的仓库路径或 Git 操作接入，不是通用文件上传平台。若下一版支持压缩包上传，上述限制和沙箱是新增能力，不能映射成当前已有。

### Q086：SSE 的协议特点是什么？怎样支持断线续传？

> **口语化回答：** SSE 是基于 HTTP 的服务端单向事件流，浏览器用 EventSource 消费。事件可以带 `id`、`event`、`data` 和 `retry`；断线后客户端用 Last-Event-ID 重连，服务端按事件序号补发或返回当前快照。
>
> **原理追问：** SSE 的自动重连不等于 Exactly-once，客户端仍要按稳定 Event ID 去重。还要发心跳、关闭代理缓冲，并让事件有明确终止和错误类型。
>
> **容易踩坑：** 把每个 Token 当永久数据库事件导致写放大；没有事件 ID；客户端断开后模型仍生成；中间代理攒够 Buffer 才返回。
>
> **项目连接：** CodeWiki 的 LLM Gateway 当前有内部 Stream Iterator，但 FastAPI API 没有可证明的 SSE Endpoint。把 Ask/Wiki 进度做成带 Run ID 和事件序号的 SSE 是下一版设计。

### Q087：WebSocket 和 SSE 怎么选？多 Worker 下连接状态放哪里？

> **口语化回答：** 只需要服务端推送 Token 或进度时 SSE 更简单；需要客户端持续发送控制、协同编辑或双向实时消息时再用 WebSocket。连接对象只存在当前 Worker，多 Worker 广播需要外部 Pub/Sub 或消息系统。
>
> **原理追问：** WebSocket 要处理握手鉴权、Ping/Pong、断线、消息边界、每连接队列和慢消费者；不能把内存连接表当持久会话。
>
> **容易踩坑：** Token 只在握手时校验却从不处理过期；每连接无界 Queue；把大文件塞 WebSocket；发布后 Worker 重启导致状态丢失。
>
> **项目连接：** 当前 CodeWiki 没有 WebSocket。下一版若只是展示分析进度，我会先选 SSE 或轮询；只有明确双向需求才增加 WebSocket 和跨 Worker 通道。

### Q088：流式响应怎样处理背压、取消和最终状态？

> **口语化回答：** 生产者不能无限快地把 Chunk 塞进内存，我会用有界 Queue 或直接 Await Socket 写出，让慢客户端形成背压；检测断开后取消下游读取，并在 `finally` 里完成有界清理。最终业务状态要独立持久化，不能靠最后一个 Chunk 是否送达决定。
>
> **原理追问：** 客户端取消、代理断开和模型完成是三种不同状态。远端调用可能不响应取消，因此仍要 Deadline、幂等和 Usage 对账。
>
> **容易踩坑：** 用无界 Queue；吞 `CancelledError`；数据库事务跨整条 Stream；错误时发送一半 JSON 后直接断开。
>
> **项目连接：** 当前 CodeWiki 的 Ask Route 返回完整响应，不是 FastAPI 流式接口。下一版接入 SSE 时要复用现有 Run/LLM Run 状态做收尾，而不是只把 Gateway 的 Iterator 直接暴露给前端。

### Q089：JWT、Session 和 OAuth 2.0 分别解决什么？

> **口语化回答：** Session 常由服务端保存会话状态，浏览器只持有随机 Session ID；JWT 是可验证声明载体，不等于完整登录协议；OAuth 2.0 是委托授权框架，配合 OIDC 才解决用户身份登录。选型要看客户端、撤销、跨服务和风险。
>
> **原理追问：** JWT 至少校验签名算法、Issuer、Audience、过期时间和 Not-before，Key 要支持轮换；敏感信息不能因为 Payload 编码成 Base64 就放进去。
>
> **容易踩坑：** 接受 `alg=none` 或错误算法；只解码不验签；长期 Token 无撤销；把 OAuth Access Token 当任意服务都能用的万能票据。
>
> **项目连接：** 当前 CodeWiki 没有 Bearer 或 Session。下一版公司内部接入应优先复用统一身份平台，再把用户映射到 Repo ACL；具体 IdP、Token 期限和部署方式需按真实内部环境填写。

### Q090：认证和授权为什么必须分开？多租户过滤放在哪里？

> **口语化回答：** 认证回答“你是谁”，授权回答“你能对这个资源做什么”。身份建立后，每次 Repo、Wiki、Source 和删除操作仍要按用户、角色、租户和资源重新判断；Tenant Filter 必须进入 Repository 查询，不能只写在 Prompt 或前端。
>
> **原理追问：** 我会默认拒绝，按资源做 RBAC/ABAC，缓存权限时带权限版本。后台任务保存发起者和授权快照，但执行敏感动作前还要按策略决定是否重新校验。
>
> **容易踩坑：** 只在 API Gateway 鉴权；对象 ID 可枚举导致 IDOR；共享 Cache Key 不带租户；管理员能力被普通 Tool 间接调用。
>
> **项目连接：** 当前 CodeWiki 是无多用户 Auth 的 Local-first 实现。Repo ACL、Tenant Filter、审计和删除权限都属于集中部署下一版，不能因为 Route 有 repoId 就说已经隔离。

### Q091：API 限流应该按什么维度做？Semaphore 为什么不等于 Rate Limit？

> **口语化回答：** Semaphore 只限制同时在途数量，Rate Limit 控制一段时间内允许多少请求或 Token。我会按用户、租户、接口、Provider 和成本分层，用 Token Bucket 或滑动窗口，超限返回 429 和合理 Retry-After。
>
> **原理追问：** 多 Worker 要用共享存储或网关统一裁决；LLM 接口还要同时考虑 RPM、TPM、并发和单任务预算，避免少量超长请求占满资源。
>
> **容易踩坑：** 只按 IP 误伤 NAT；本地限流宣称集群总限额；被限流请求仍排进无界队列；重试再次放大流量。
>
> **项目连接：** 当前 CodeWiki 有局部并发保护和模型侧配置，但没有可证明的多租户 API 限流体系。下一版要把 Repo 分析、Ask 和 Wiki 生成分开配额，并以实际 Provider 限额和压测定参数。

### Q092：写接口的 Idempotency Key 应该怎样设计？

> **口语化回答：** Idempotency Key 要绑定用户、接口和规范化请求 Hash，服务端用唯一约束原子抢占并记录处理中、成功、失败和响应。重复同 Key 同 Payload 返回原结果；同 Key 不同 Payload 应明确冲突。
>
> **原理追问：** Key 只是入口，真正副作用还要用业务唯一键、状态机或 Outbox 收口。记录要有过期与清理策略，但过期不能早于业务可能重放的窗口。
>
> **容易踩坑：** 只用进程内 Lock；先产生副作用再写幂等记录；失败重试换 Key；把网络超时当作远端一定没执行。
>
> **项目连接：** 当前 CodeWiki 用 Run ID、活动任务检查和 per-repo 锁降低重复分析，但这不等于通用 HTTP Idempotency。下一版任务创建接口应补请求 Hash、唯一约束和结果复用。

### Q093：FastAPI `BackgroundTasks` 和可靠任务队列有什么区别？

> **口语化回答：** `BackgroundTasks` 适合响应后执行短小、允许随进程丢失的工作，它仍在当前服务进程里；需要重试、恢复、跨实例、进度和长时间运行的任务，必须持久化到任务表或可靠队列，由独立 Worker 领取。
>
> **原理追问：** 可靠任务要有稳定 ID、Lease/Heartbeat、Attempt、重试分类、Dead Letter、取消和幂等副作用。返回 202 只代表已接收，不代表已经完成。
>
> **容易踩坑：** 把几分钟模型任务放 BackgroundTasks 后宣称可靠异步；部署重启直接丢任务；请求级 Session 被后台继续使用；多 Worker 重复领取。
>
> **项目连接：** 当前 CodeWiki 的分析与更新接口确实使用 FastAPI `BackgroundTasks`，并把 Run 状态落库；但任务执行仍依赖 Web 进程和进程内锁。独立可靠 Worker 是下一版生产化方向，不说成现状。

### Q094：FastAPI 服务怎样优雅关停？

> **口语化回答：** 收到终止信号后先让 Readiness 失败并停止接新任务，再给在途请求和已登记后台任务一个有界 Drain 时间，传播取消，落清楚状态，最后关闭 HTTP Client、数据库 Pool 和其他资源；超过 Deadline 就强制退出并依靠恢复机制收口。
>
> **原理追问：** 关停不能只等 Coroutine，还要处理线程池任务和远端未知结果。长任务要有 Checkpoint、Lease 或可重入 Stage，不能要求每次部署无限等它完成。
>
> **容易踩坑：** Liveness 先失败导致容器立刻被杀；Shutdown 无上限；先 Close 数据库再等后台任务；把 Cancelled 记录成成功。
>
> **项目连接：** 当前 CodeWiki 没有可证明的完整 Lifespan Drain 和独立 Worker 恢复协议。下一版至少要登记 Background Task、停止领取、更新 Run 状态并按顺序关闭 Store 与 LLM Client。

### Q095：FastAPI 上线时 Uvicorn、反向代理、健康检查和部署参数怎么配合？

> **口语化回答：** Uvicorn 负责 ASGI 运行，反向代理或平台负责 TLS、请求大小、超时和流量治理；容器编排用 Startup、Readiness、Liveness 区分“启动完成、可以接流量、进程还活着”。Worker、线程池和连接池要一起按容量设计。
>
> **原理追问：** Readiness 应检查接流量必需但成本可控的依赖，Liveness 不应因短暂数据库故障反复重启；代理超时必须大于应用内部可控 Deadline，又不能掩盖无限请求。
>
> **容易踩坑：** 直接把开发 `--reload` 上生产；无条件信 Proxy Header；一个简单 200 Health 就宣称所有依赖就绪；Worker 翻倍导致连接超限。
>
> **项目连接：** 当前 CodeWiki 只有返回 `status=ok` 的简单 Health，真实部署平台、CI/CD、TLS 和回滚责任仍需本人按事实清单填写。依赖级 Readiness、发布 Drain 和容量参数属于下一版设计。

## 5. SQLAlchemy、事务、连接池与 SQLite

### Q096：SQLAlchemy 2.x 里的 Engine、Connection、Session 和 ORM Model 怎么分工？

> **口语化回答：** Engine 管数据库方言和连接池，Connection 表示一次底层数据库连接与 SQL 执行上下文，Session 是 ORM 的 Unit of Work 和 Identity Map，Model 是数据映射。Session 不是数据库本身，也不是可以全局共享的缓存。
>
> **原理追问：** 同一 Session 内查询同一主键可能复用对象身份，但跨 Session 不保证；事务边界应该由 Service 或 Unit of Work 决定，Repository 负责查询和持久化细节。
>
> **容易踩坑：** 全局共享 Session；把 ORM 对象脱离 Session 后继续触发 Lazy Load；每个 Repository 自己 Commit 导致业务事务被切碎。
>
> **项目连接：** 当前 CodeWiki 用统一 Store 和 Repository Mixin 封装 SQLite/PostgreSQL，底层是同步 Engine 与 `sessionmaker(expire_on_commit=False)`；这个现状可以讲，但不能说成 Async SQLAlchemy。

### Q097：`Session` 或 `AsyncSession` 能不能被多个并发 Task 共用？

> **口语化回答：** 不能把一个可变 Session 同时给多个线程或 Task 操作。我的原则是一条并发控制流一个 Session/事务，需要并行查询就各自创建 Session，最终在明确边界合并结果。
>
> **原理追问：** Session 内有事务状态、待 Flush 对象和 Identity Map，并发修改会破坏状态机。AsyncSession 只是异步接口，不会因此变成并发安全对象。
>
> **容易踩坑：** `gather` 多个函数共享同一 Session；后台任务复用请求 Session；把 ORM 对象跨线程传递后继续 Lazy Load。
>
> **项目连接：** 当前 CodeWiki 的 `orm_session()` 每次 Context Manager 创建独立同步 Session。下一版若引入 AsyncSession，也要保持 Task 隔离，而不是把一个全局 AsyncSession 注入所有 Route。

### Q098：SQLAlchemy 的事务边界、Autobegin、Commit 和 Rollback 怎么设计？

> **口语化回答：** 我会让一次业务不变量所需的数据库操作处在同一事务里，成功 Commit，任何异常 Rollback。SQLAlchemy 2.x 会在首次需要时 Autobegin，但我仍会用 Context Manager 明确作用域，不靠隐式状态猜事务何时开始。
>
> **原理追问：** 数据库事务只能覆盖同一资源，不能自动把 LLM、Git、对象存储或 HTTP 副作用一起回滚；跨资源要用状态机、Outbox、补偿和幂等。
>
> **容易踩坑：** 在事务里等待模型；Catch 异常后继续复用失败 Session；Helper 内部偷偷 Commit；把 Flush 成功当业务已提交。
>
> **项目连接：** 当前 CodeWiki 的 `orm_session()` 在退出时 Commit、异常时 Rollback，但整条 Analyze 跨扫描、构图、LLM 和多次分批持久化，不是一个全局事务；中途崩溃仍可能半更新，这个边界必须如实说。

### Q099：`flush`、`commit`、`refresh` 和 `expire` 有什么区别？

> **口语化回答：** Flush 把当前变更发到数据库但事务还没提交，适合拿数据库生成的 ID 或提前发现约束错误；Commit 提交事务；Refresh 主动从数据库重读；Expire 标记属性下次访问时重新加载。
>
> **原理追问：** Flush 后其他事务通常仍看不到未提交数据，Rollback 还能撤销。`expire_on_commit=False` 能让提交后对象继续读已有字段，但也更容易拿到旧值，要按边界选择。
>
> **容易踩坑：** Flush 后发送外部消息；提交后假设对象一定是数据库最新状态；序列化时意外触发 Refresh 或 Lazy Load。
>
> **项目连接：** 当前 CodeWiki 的 Session Factory 明确设置了 `expire_on_commit=False`，适合短事务后把 Record 传出 Store；如果需要依赖数据库触发器或并发更新，仍要显式 Refresh 或重查。

### Q100：SQLAlchemy 连接池的 `pool_size`、`max_overflow`、`pool_timeout`、`pre_ping` 和 `recycle` 怎么理解？

> **口语化回答：** `pool_size` 是常驻连接基线，`max_overflow` 是突发额外连接，`pool_timeout` 限制等连接时间；`pre_ping` 借出前探活，`recycle` 控制连接最长复用时间。它们解决不同问题，不能靠把 Pool 调大掩盖慢 SQL。
>
> **原理追问：** 总连接数要按每实例每 Worker 的 Pool 相乘，再给数据库管理和迁移留余量。关键指标是 Checked-out、Pool Wait、Overflow、Query p95 和长事务。
>
> **容易踩坑：** 多 Worker 后连接数成倍增长；`pre_ping` 被宣传成自动故障恢复；连接泄漏；Pool Wait 超时又被上层无限重试。
>
> **项目连接：** 当前 CodeWiki 的 PostgreSQL Engine 配置了 `pool_size=5`、`max_overflow=10`、`pool_pre_ping=True` 和 `pool_recycle=1800`。这些是代码默认值，不代表已经针对真实生产 QPS 完成容量验证。

### Q101：ORM 的 N+1 查询是什么？`joinedload` 和 `selectinload` 怎么选？

> **口语化回答：** 先查一批父对象，再在循环里对每个对象懒加载关联，就会变成 1+N 次 SQL。单值关系且结果不会爆炸时可用 Joined Load；一对多集合常用 Select-in Load，用第二条 `IN` 查询避免笛卡尔膨胀。
>
> **原理追问：** 最稳的是先看实际 SQL 和行数，必要时用 `raiseload` 在测试中禁止意外懒加载。GraphQL 或 Response 序列化尤其容易把属性访问变成隐藏查询。
>
> **容易踩坑：** 所有关联一律 Joined 导致重复行和内存暴涨；Session 关闭后才触发 Lazy Load；只看 SQL 条数不看每条返回量。
>
> **项目连接：** CodeWiki 的图、Wiki 和 Run 查询很多走显式 Repository 与批量查询，不应把 ORM Relationship 当自动数据装配器。新增关联接口时会用 SQL Trace 检查 N+1，而不是宣称现有代码绝无此问题。

### Q102：什么时候用 ORM Query，什么时候用 Core 或原生 SQL？

> **口语化回答：** 普通 CRUD 和明确实体关系优先 ORM，复杂聚合、全文检索、向量检索、方言能力或批量操作可以用 SQLAlchemy Core/参数化 SQL。选择目标是正确、可测和可维护，不是坚持一种写法。
>
> **原理追问：** 即使用原生 SQL，也要绑定参数并把方言差异封装在 Store 层；Explain、索引和返回行数决定性能，ORM 标签本身不决定快慢。
>
> **容易踩坑：** 用字符串拼接用户输入；业务层到处判断 SQLite/Postgres；ORM 一次加载整张图；原生 SQL 返回结构没有契约。
>
> **项目连接：** 当前 CodeWiki 正是混用 ORM/Core 和参数化 SQL：普通实体走 Repository，SQLite FTS5、PostgreSQL tsvector、sqlite-vec/pgvector 留在方言适配层。这是当前实现，不需要包装成纯 ORM。

### Q103：悲观锁和乐观锁怎么在 SQLAlchemy 中实现？

> **口语化回答：** 悲观锁通常用 `SELECT ... FOR UPDATE` 在事务内锁住目标行，适合冲突高且事务很短的更新；乐观锁用版本号和条件更新，`WHERE id=? AND version=?` 影响零行就说明冲突。两者都要配合数据库语义和重试上限。
>
> **原理追问：** 分布式任务领取常用状态条件更新或 Lease，比先查再写更可靠。SQLite 对 `FOR UPDATE` 的语义和 PostgreSQL 不同，不能跨方言想当然。
>
> **容易踩坑：** 持锁期间调用 LLM；冲突后无限重试；只在 Python 里比较版本没有原子条件；把进程锁当数据库锁。
>
> **项目连接：** 当前 CodeWiki 的同 Repo 写入主要依赖进程内锁和 Store 事务，不是跨 Worker 悲观锁方案。下一版多 Worker 任务领取应使用数据库条件更新、版本或租约。

### Q104：事务隔离级别能不能自动防止 Lost Update？

> **口语化回答：** 不能只背隔离级别名字就认为所有业务竞争都解决了。Lost Update、写偏斜和重复副作用要结合具体 SQL、数据库实现和业务不变量，用条件更新、唯一约束、锁或 Serializable 证明。
>
> **原理追问：** Read Committed、Repeatable Read 和 Serializable 的异常范围不同，SQLite 和 PostgreSQL 的实现也不同。重试 Serializable 事务时，事务外副作用必须幂等。
>
> **容易踩坑：** 先读状态再无条件更新；把 Python Lock 当多实例保护；Serializable 失败后整段重复发送消息；长事务扩大冲突窗口。
>
> **项目连接：** CodeWiki 的 Run 状态和 Repo 图更新需要明确合法状态迁移。当前没有跨所有阶段的 Serializable 事务，下一版要用版本化快照或 CAS 缩小半更新窗口。

### Q105：数据库 Schema 迁移为什么不能只靠 `create_all()`？Alembic 发布怎么做更安全？

> **口语化回答：** `create_all()` 适合创建缺失对象，但不会完整表达重命名、数据回填、删除和可回滚演进。生产迁移要有版本、审查和 Expand-Migrate-Contract：先加兼容结构，再回填和切读写，最后删除旧结构。
>
> **原理追问：** Alembic Autogenerate 只是草稿，仍要人工检查类型、索引、锁表和方言差异。应用版本与数据库版本要明确兼容窗口。
>
> **容易踩坑：** 在启动时多个实例同时改表；一条 DDL 锁大表；先删列再发新代码；回滚只回应用不回数据语义。
>
> **项目连接：** 当前 CodeWiki 使用 `Base.metadata.create_all()` 加显式 Column Patch 和 Index 创建，没有完整 Alembic 版本链。Local-first 尚可，但集中式滚动发布前应补正式迁移流程；这是下一版，不冒充现状。

### Q106：Offset Pagination 和 Cursor Pagination 怎么选？

> **口语化回答：** Offset 简单，适合小结果和可跳页后台；数据大或持续变化时用 Cursor/Keyset，根据稳定排序键从上次位置继续，避免深 Offset 扫描和重复漏项。
>
> **原理追问：** Cursor 要包含排序字段和唯一 Tie-breaker，比如 `created_at,id`，并做签名或编码；一致性要求高时还要绑定过滤条件和快照版本。
>
> **容易踩坑：** 只按非唯一时间排序；Cursor 可被用户篡改跨租户；分页期间新数据插入导致重复；返回无限大的 Page Size。
>
> **项目连接：** 当前 CodeWiki 的部分图和列表接口仍可能一次返回较多数据，集中部署下一版应按 Run、Page、Node 等稳定键分页；具体接口是否改 Cursor 要按前端访问模式决定。

### Q107：批量写入和 Upsert 怎样兼顾性能、幂等与方言差异？

> **口语化回答：** 我会按数据库参数和事务大小分批，用稳定业务 Key 建唯一约束，再用方言支持的 Upsert 或先判冲突策略。批量不是越大越好，要看锁时间、内存、错误定位和重试成本。
>
> **原理追问：** PostgreSQL `ON CONFLICT` 和 SQLite 的能力相近但细节不同，虚拟表又可能不支持相同语法；适配层应统一业务语义，不强求生成完全相同 SQL。
>
> **容易踩坑：** 一条百万行事务；失败后整批盲重；没有稳定 Key；Delete+Insert 破坏外键或审计；旧版本事件覆盖新数据。
>
> **项目连接：** 当前 CodeWiki 的 `DatabaseDialect` 封装 Insert-ignore/Upsert，图替换和 Chunk 也会分批；sqlite-vec 的物理向量又有独立边界，所以不能笼统说所有表都天然原子 Upsert。

### Q108：SQLite 的 WAL、Busy Timeout 和“单写者”意味着什么？什么时候该换 PostgreSQL？

> **口语化回答：** WAL 让读写更容易并行，但 SQLite 仍然只有受限的并发写路径；Busy Timeout 只是等待锁，不会增加写吞吐。单机、本地、低运维场景很合适，多实例高写入、复杂权限和集中运维则更适合 PostgreSQL。
>
> **原理追问：** 事务要短，批量写要有边界，数据库文件不应随便放不支持锁语义的共享文件系统。备份、扩展和 Migration 也要按 SQLite 特性设计。
>
> **容易踩坑：** 开 WAL 就宣称支持任意多进程写；Timeout 调大掩盖长事务；多个容器共享同一个本地 DB 文件；在事务里做模型调用。
>
> **项目连接：** 当前 CodeWiki 默认 SQLite，启用 Foreign Key、30 秒 Busy Timeout、WAL 和 Normal Synchronous，适合 Local-first；同时支持 PostgreSQL Store。真实切换仍要迁移、校验和回滚，不能说改 URL 就零成本完成。

## 6. 测试、性能、观测、安全与部署

### Q109：Pytest Fixture 和 Scope 怎么设计才不让测试串状态？

> **口语化回答：** Fixture 用来显式准备和清理测试依赖，Scope 选 Function、Class、Module 或 Session 要看状态能否安全共享。默认我优先 Function Scope，只有昂贵且只读的资源才扩大 Scope，并用 `yield` 确保清理。
>
> **原理追问：** Fixture 依赖本身也是图，参数化可以系统覆盖边界；临时目录、环境变量、缓存和数据库都要在用例后恢复。
>
> **容易踩坑：** Session Fixture 里放可变数据库；Monkeypatch 后不清缓存；测试依赖执行顺序；Fixture 自动启用过多导致行为隐藏。
>
> **项目连接：** 当前 CodeWiki 测试大量使用 `tmp_path`、`monkeypatch`，并清理 Settings/Store Cache。这是可以讲的事实；下一步可抽统一 App/Store Fixture 减少重复并强化清理断言。

### Q110：单元、集成、契约和端到端测试怎样分工？

> **口语化回答：** 单元测试验证纯逻辑和错误分支；集成测试验证数据库、ASGI 路由和真实组件组合；契约测试确认 Provider、数据库方言或前后端 Schema 没漂；端到端测试只覆盖少量核心用户流程。分层是为了定位快，不是追求某一层数量最多。
>
> **原理追问：** 测试金字塔在 AI 系统里还要加离线 Eval：代码正确不代表检索和生成质量正确。外部服务契约可用 Sandbox 或录制响应，但必须脱敏和版本化。
>
> **容易踩坑：** 全部 Mock 导致集成失真；所有测试都起完整系统太慢；只测 Happy Path；用测试数量代替风险覆盖。
>
> **项目连接：** CodeWiki 当前有 AST、GraphRAG、增量、Store、API、MCP 和 Wiki 等测试，也有仓库 Benchmark；但现有材料不能证明完整线上 E2E、部署回滚和检索质量门禁。

### Q111：`pytest-asyncio` 测异步代码时要注意什么？

> **口语化回答：** 异步用例要在受控 Event Loop 中执行，显式 Await 所有 Coroutine，并在结束时确认没有 Pending Task、未消费异常或未关闭 Client。超时、取消、乱序和部分失败必须单独测。
>
> **原理追问：** Fake Clock、Event 和 Barrier 比真实 `sleep` 更稳定；并发测试要验证不变量和事件顺序，而不是依赖机器调度碰巧复现。
>
> **容易踩坑：** 测试结束时后台 Task 还活着；用长 Sleep 等待；吞掉 `CancelledError`；不同 Loop 复用绑定资源。
>
> **项目连接：** 当前 CodeWiki 使用 `pytest.mark.asyncio` 测 QuestionAnswerer、`run_blocking` 和 per-repo Lock，并用 Event 控制并发顺序。这能证明关键局部行为，不能外推成所有后台生命周期都已覆盖。

### Q112：FastAPI `TestClient`、HTTPX `AsyncClient` 和真实网络测试怎么选？

> **口语化回答：** 同步接口测试可以用 TestClient；需要原生 Async、并发和取消语义时用 HTTPX AsyncClient 配 ASGI Transport；反向代理、TLS、Socket 和 Worker 行为只有真实启动服务的测试才能覆盖。
>
> **原理追问：** 测试要确认 Lifespan 是否真的运行，ASGI 内存调用不会自动证明代理超时、SSE 缓冲或断线行为。每层只证明自己的边界。
>
> **容易踩坑：** TestClient 未用 Context Manager 导致 Startup/Shutdown 没执行；把内存 ASGI 延迟当真实网络性能；Dependency Override 没恢复。
>
> **项目连接：** 当前 CodeWiki 的 Repo/File API 测试使用 FastAPI TestClient 和临时 SQLite。下一版增加 Lifespan、SSE 或关停协议后，需要补 AsyncClient 与真实进程级测试。

### Q113：怎样 Mock LLM、Embedding 和外部 HTTP，避免测试偷偷花钱？

> **口语化回答：** 我会给 Provider 定义小 Protocol，测试注入 Fake，固定返回内容、Usage、延迟和错误；HTTP 层用 Mock Transport 验证 URL、Header、Body 和重试。CI 默认不允许访问真实模型，只有显式 Sandbox 契约任务例外。
>
> **原理追问：** Fake 不只返回成功，还要支持超时、429、无效 JSON、流中断、重复 Chunk 和维度错误。录制响应必须去掉源码、Token 和个人信息。
>
> **容易踩坑：** Patch 错命名空间导致真实 SDK 仍被调用；Fake 永远完美；断言只看最终文本，不看 Tool/Source/Usage；测试日志泄密。
>
> **项目连接：** 当前 CodeWiki 测试已有 `_FakeQALLM`，会检查 GraphRAG Prompt 并返回固定 Usage，说明核心生成链可以脱离真实模型测试；覆盖全部 Provider 故障仍是后续工作。

### Q114：数据库测试怎样同时保证隔离和方言真实性？

> **口语化回答：** 单测可以用临时 SQLite 快速验证通用 Repository，测试间用新数据库或事务回滚隔离；但 PostgreSQL 的锁、全文检索、JSON、向量和 Upsert 语义必须在真实 PostgreSQL 集成测试中验证，不能拿 SQLite 代替。
>
> **原理追问：** Migration 从空库升级、旧版本升级和回滚都要测；并发问题要用多个真实连接，而不是同一 Session 里顺序调用。
>
> **容易踩坑：** 内存 SQLite 与文件 SQLite 连接行为不同；测试共享同一个 Engine 留脏数据；只 Mock SQL 不执行；生产方言分支长期没人跑。
>
> **项目连接：** 当前 CodeWiki 有临时 SQLite 测试和 PostgreSQL Store 专项测试文件，但真实 PostgreSQL 扩展环境与 CI 门禁范围要以流水线事实为准，不能只凭文件名宣称全量覆盖。

### Q115：Property-based Test、故障注入和并发测试分别适合发现什么？

> **口语化回答：** Property-based Test 适合路径、分页 Cursor、Parser 和序列化的不变量；故障注入适合超时、半写、重试和恢复；并发测试验证同一 Repo、同一幂等 Key 和状态迁移不会竞态。三者补的是普通案例测试难覆盖的组合空间。
>
> **原理追问：** 先写业务不变量，再生成输入或安排故障点；失败 Case 要能 Shrink 和固定复现。并发正确性最终仍要靠数据库约束证明。
>
> **容易踩坑：** 只随机不设 Seed 和失败样本；故障点没有可观察状态；用一百次压测“没出错”代替原子性证明。
>
> **项目连接：** CodeWiki 当前有增量、锁、校验和大仓 Benchmark；下一版值得对 Slug/Source Ref、更新中断和重复任务增加 Property/Failure Test，但不能说现有测试已经系统使用 Hypothesis 或 Chaos。

### Q116：Python/FastAPI 性能排查要看哪些指标和工具？

> **口语化回答：** 我先按入口排 Queue、Event-loop Lag、线程池、连接池、SQL、外部 HTTP、序列化和 CPU Profile，再看 p50/p95/p99，不先猜是 Python 慢。工具可以用 Sampling Profiler、Tracemalloc、SQL Explain、HTTP Timing 和分阶段 Trace。
>
> **原理追问：** 吞吐和单请求延迟会互相影响，负载测试要固定数据、并发模型、预热和资源限制；LLM 接口还要拆 TTFT、Token 速度、检索和工具阶段。
>
> **容易踩坑：** 只看平均值；在开发 `--reload` 下压测；用一个小仓库外推所有规模；优化语言微细节却忽略全图加载和模型调用。
>
> **项目连接：** CodeWiki 当前 Benchmark 能证明 Cold/Warm/Small-delta 的文件、节点、边和端到端耗时，不能证明 FastAPI 并发 p99。下一版应补 API、Pool Wait、Loop Lag、峰值内存和模型阶段观测。

### Q117：日志、Metric、Trace 和 OpenTelemetry 在 AI 服务里怎么分工？

> **口语化回答：** 日志记录离散事件和受控错误细节，Metric 用于趋势、容量和告警，Trace 把一次请求里的检索、模型、工具和数据库 Span 串起来。OpenTelemetry 提供统一上下文和语义约定，但字段和采样策略仍要自己设计。
>
> **原理追问：** 我会传播 Trace Context，记录模型/Prompt 版本、Token、阶段耗时和错误类别，但对源码、Prompt、Response、密钥做脱敏、截断和权限控制。
>
> **容易踩坑：** 高基数 repoId/pageSlug 全放 Metric Label；全量记录源码；每个 Token 建 Span；异步/线程边界丢 Context。
>
> **项目连接：** 当前 CodeWiki 有 Run/LLM Run、阶段信息、日志和 Benchmark，但没有可证明的完整 OpenTelemetry 链路。下一版可以按 analysisRun 串 API、扫描、图、检索、LLM 和落库 Span。

### Q118：FastAPI 服务的安全测试至少覆盖哪些方面？

> **口语化回答：** 我会覆盖未认证、越权和 IDOR，恶意路径、超大 Body、压缩炸弹、SSRF、SQL/命令注入、CORS/Host、错误泄密、Rate Limit、依赖漏洞和 Secret Scan；危险写操作还要测重放与幂等。
>
> **原理追问：** 安全测试要从信任边界出发，既测 HTTP 入口，也测 LLM 检索内容、Tool 参数和外发目标。SAST、依赖扫描和动态测试各自只覆盖一部分。
>
> **容易踩坑：** 只测登录成功；认为参数化 SQL 就没有 SSRF/路径穿越；测试数据里放真实 Token；只在上线前跑一次扫描。
>
> **项目连接：** 当前 CodeWiki 没有 Auth/RBAC，能读取本地仓库且启用模型后可能外发源码，所以网络暴露前的 P0 是身份、Repo ACL、路径边界、源码 Secret Scan 和 Provider 策略；这些不能描述成当前已完成。

### Q119：Python/FastAPI 容器镜像和发布流程有哪些关键点？

> **口语化回答：** 我会用可复现 Lock 构建精简镜像，固定 Python 和 Native 依赖，非 Root 运行，最小文件权限，不把 Secret 烤进镜像；启动命令不用 `--reload`，正确处理 PID 1 信号，并设置资源、健康检查和只读文件系统边界。
>
> **原理追问：** Tree-sitter、sqlite-vec 和数据库 Driver 有 ABI/平台差异，必须在目标镜像跑 Smoke Test。数据库迁移应作为受控发布步骤，不让每个副本同时抢着改 Schema。
>
> **容易踩坑：** 把 `.env`、Git 凭证和仓库缓存复制进镜像；多阶段构建漏运行时库；容器只读后临时目录和 SQLite 无可写卷；滚动发布直接杀长任务。
>
> **项目连接：** CodeWiki 的 Python 包包含 FastAPI、前端静态资源和 Native Parser/SQLite 扩展，容器化要验证这些资产。真实内部镜像、平台、流水线和回滚负责人仍按事实清单回答，不能现场补造。

### Q120：如果面试官让你把这些 Python/FastAPI 知识连回 CodeWiki，你怎么总结？

> **口语化回答：** 我会先讲现状：CodeWiki 用 FastAPI 暴露 Repo、Graph、Wiki、Ask、Run 和 Settings API；远程 LLM 是 Async，部分阻塞扫描和同步 SQLAlchemy Store 调用通过受控线程隔离；默认 SQLite/WAL，也支持 PostgreSQL；长分析目前用 BackgroundTasks、持久化 Run 状态和进程内 per-repo 锁。
>
> **原理追问：** 这套设计符合 Local-first、单用户和低运维目标，但边界也很明确：同步 Store 不是 AsyncSession，多 Worker 下进程锁失效，BackgroundTasks 不是可靠队列，简单 Health 不是完整 Readiness，CORS 更不是鉴权。
>
> **容易踩坑：** 为了显得“生产级”声称已经有 JWT、RBAC、SSE、分布式锁、Alembic、OpenTelemetry、容器集群和完整 CI/CD；这些都需要代码、配置或流水线证据。
>
> **项目连接：** 下一版如果做集中部署，我会按顺序补身份与 Repo ACL、可靠任务 Worker 和幂等、跨 Worker 租约、正式迁移、Lifespan Drain、分层健康检查、Trace/Eval 和容量压测。部署平台、用户量、SLA 与个人 RACI 仍只按内部事实回答。
