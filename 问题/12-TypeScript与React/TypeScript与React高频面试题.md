# TypeScript 与 React 高频面试题

> 定位：这份题库用于准备后端 / AI 应用岗位里的前端深挖，也覆盖 CodeWiki 全栈经历可能引出的追问。答案全部按第一人口语表达；项目事实以当前源码为准，不把建议方案说成已上线能力。
>
> 当前事实口径：CodeWiki 前端当前是 React 19、TypeScript 5.7、Vite 6，使用 `@xyflow/react`、ELK.js、Fuse.js、Mermaid 和 `react-markdown`。`zustand` 已在依赖中声明，但当前 `src` 没有实际 import；页面状态主要由 Hooks 管理，Wiki 生成操作另有基于 `useSyncExternalStore` 的小型外部 Store。当前请求是普通 `fetch`，Wiki 长任务用轮询，没有已实现的 SSE / WebSocket；`package.json` 只有 `dev`、`build`、`lint`，没有前端测试脚本。

## 一、JavaScript 运行时与语言基础（Q001-Q020）

### Q001. JavaScript 的执行上下文和调用栈是怎么工作的？

**口语化回答：** 我会把它理解成“每次调用函数，运行时都压入一张执行现场”。这张现场里有当前作用域、变量绑定、`this` 和返回位置；函数结束后出栈。JavaScript 主线程一次只执行栈顶任务，所以一个同步死循环会把点击、渲染和异步回调全堵住。

**原理追问：** 如果继续问词法环境，我会说标识符解析不是在调用栈里到处搜，而是沿当前 Lexical Environment 的 outer 引用向外找；函数定义在哪里，作用域链基本就在哪里确定。调用栈描述“现在执行到哪”，作用域链描述“变量去哪里找”，两者不能混成一个概念。

**容易踩坑：** 我不会把“单线程”说成浏览器只有一个线程。JavaScript 执行主线程通常是单线程，但网络、定时器、渲染管线和 Worker 可以由浏览器其他线程协作；回调最终仍要排队回主线程。

**CodeWiki 连接：** CodeWiki 的 ELK 布局当前直接从主线程调用异步 API；异步返回不等于计算一定离开主线程。下一版如果大图布局出现 Long Task，我会把 ELK 放进 Web Worker，而不会只给 `layout()` 前面加一个 `await` 就宣称不卡 UI。

### Q002. `var`、`let`、`const` 的提升和暂时性死区有什么区别？

**口语化回答：** 我一般会说三者声明都会在进入作用域时被运行时登记，但表现不同。`var` 是函数作用域，初始化为 `undefined`，声明前读取不会报错；`let`、`const` 是块级作用域，在声明执行前处于 TDZ，读取会抛 `ReferenceError`。`const` 约束的是绑定不能重新赋值，不代表对象内部不可变。

**原理追问：** `for (let i...)` 每轮会形成适合闭包捕获的独立绑定，`var` 往往共享同一个函数级绑定。这也是旧代码里异步回调打印同一个最终值，而改成 `let` 后能得到每轮值的根因。

**容易踩坑：** 我不会用“`let` 不提升”这种省事但不准确的说法；它被创建了，只是未初始化，TDZ 正是这个差异。也不会把 `const object` 当深冻结对象，需要不可变约束还得靠编码方式或 `Object.freeze` 等机制。

**CodeWiki 连接：** CodeWiki 前端大量用 `const` 保存数组、Map 和配置对象，但后续仍可能修改对象内容。所以做 React 状态更新时，我关注的是有没有创建新引用，而不是看到 `const` 就误以为数据天然不可变。

### Q003. 闭包到底是什么，为什么既有用又容易导致问题？

**口语化回答：** 我把闭包解释成：函数不仅带着代码，还能继续访问它定义时那条词法作用域链。外层函数即使已经返回，只要内部函数还被引用，它需要的变量就不会消失。它很适合封装私有状态、回调和 Hooks，但也可能捕获旧值或让大对象长期不能回收。

**原理追问：** 如果问 React stale closure，我会说每次 Render 都创建一套新的 props、state 和函数；某次 Render 创建的异步回调，会看到那一帧的值。要拿最新状态，我会优先改成函数式更新、正确声明依赖，或在确实需要可变最新值时用 Ref。

**容易踩坑：** 我不会一见旧值就把所有东西塞进 `useRef`，那会绕开 React 数据流；也不会为了“解决闭包”盲目关闭 Hooks 依赖检查。先判断业务需要的是快照语义还是最新值语义。

**CodeWiki 连接：** CodeWiki 的 Wiki 数据加载和图布局 Effect 都用 `cancelled` 闭包阻止卸载后的状态提交，这能避免旧结果覆盖 UI，但不会真的取消底层 `fetch` 或 ELK 计算。下一版会进一步接 `AbortSignal` 或 Worker 终止。

### Q004. 普通函数的 `this` 是怎么确定的？

**口语化回答：** 我会先给结论：普通函数的 `this` 主要由调用方式决定，不是由定义位置决定。对象方法调用看点号左边，`call/apply/bind` 可以显式指定，构造调用指向新对象；严格模式下普通独立调用是 `undefined`，不能笼统说永远是 `window`。

**原理追问：** 多条规则同时出现时，我会按大致优先级看：`new`、显式绑定、隐式对象调用、默认绑定。把方法单独赋给变量再调用会丢失接收者，因为“函数来自哪个对象”不等于“这次是谁调用它”。

**容易踩坑：** 事件回调、类方法传递和解构方法最容易丢 `this`。我不会靠到处 `.bind(this)` 修补不清晰的设计；在 React 函数组件里一般直接用闭包和 Hooks，根本不需要组件实例 `this`。

**CodeWiki 连接：** CodeWiki 当前全是函数组件，因此面试中我会先讲 JavaScript 规则，再明确项目没有依赖类组件实例绑定。这样能证明我理解原理，也不会拿旧式类组件经验冒充当前实现。

### Q005. 箭头函数和普通函数有什么关键区别？

**口语化回答：** 我会这么回答：箭头函数没有自己的 `this`、`arguments`、`super` 和 `new.target`，它词法捕获外层 `this`，也不能作为构造器。普通函数的 `this` 随调用方式变化，能有自己的 `arguments`，也可能被 `new`。所以箭头函数适合回调，但不适合需要动态接收者的方法。

**原理追问：** `call/apply/bind` 不能改箭头函数捕获到的 `this`；`bind` 最多预绑定参数。箭头函数也没有 `prototype` 用于构造实例，这不是简单的“普通函数短写法”。

**容易踩坑：** 我不会说箭头函数性能一定更好，也不会把对象所有方法都写成箭头函数。类字段箭头函数会给每个实例创建函数，换来自动绑定，是否值得要看对象数量和使用方式。

**CodeWiki 连接：** CodeWiki 的 Hooks 回调大量使用箭头函数，是为了局部闭包和表达简洁，不是为了处理组件 `this`。我会结合丰泊国际真实追问先把这条说清，再自然过渡到 Hooks。

### Q006. 原型链和 `class` 的关系是什么？

**口语化回答：** 我会说 JavaScript 对象查属性时，先查自身，再沿 `[[Prototype]]` 一层层向上找。`class` 给构造器、原型方法、继承和私有字段提供了更清晰的语法，但底层仍建立在原型机制上，不是 Java 那套类模型的简单复制。

**原理追问：** 实例方法通常在 `Constructor.prototype` 上共享，静态方法在构造函数本身；`extends` 同时建立实例侧和构造器侧的继承关系。`Object.create(proto)` 可以直接指定新对象原型，`instanceof` 主要检查构造器的 `prototype` 是否出现在对象原型链上。

**容易踩坑：** 我不会用 `__proto__` 做业务逻辑，也不会把 `instanceof` 当跨 Realm 或所有数据类型的可靠类型判断。接口数据更应该做显式 Schema 校验，而不是猜原型。

**CodeWiki 连接：** CodeWiki 的 API DTO 都是 JSON 普通对象，前端不能因为 TypeScript 写了接口就认为运行时拿到了某个 class 实例。这里我会把原型、结构类型和运行时校验三者串起来回答。

### Q007. 浏览器 Event Loop、宏任务和微任务怎么执行？

**口语化回答：** 我会先说规范里更准确的叫 task 和 microtask。事件、定时器等产生任务；Promise reaction、`queueMicrotask` 进入微任务队列。当前任务跑完且调用栈清空后，浏览器会把微任务清到空，再获得渲染机会，然后进入后续任务。

**原理追问：** 例如同步日志先执行，`Promise.then` 通常早于 `setTimeout(..., 0)`；但 `setTimeout(0)` 也不是立即执行，只是到最小延迟后具备排队资格。不同宿主环境细节不同，Node.js 还要区分它自己的阶段和 `process.nextTick`。

**容易踩坑：** 微任务不是越多越好；微任务不断自我追加会让渲染和后续任务饥饿。我也不会只背一道输出顺序题，而忽略异步回调里的错误传播和取消问题。

**CodeWiki 连接：** CodeWiki Wiki 生成当前用 `setInterval` 轮询状态，网络 Promise 完成后更新状态。面试时我会说明轮询间隔、Promise 回调和 React 批处理是三层不同机制，不能把“异步”都归因于 Event Loop 一个词。

### Q008. `requestAnimationFrame`、微任务和页面渲染是什么关系？

**口语化回答：** 我会把一帧粗略讲成：执行任务，清空微任务，然后浏览器在合适时机做 `requestAnimationFrame` 回调、样式计算、布局和绘制。`requestAnimationFrame` 适合与视觉帧同步的更新，不保证每 16.7ms 一定执行；后台标签页还可能降频。

**原理追问：** 如果在一帧里连续读写布局属性，会触发 forced synchronous layout。我会把 DOM 读集中、写集中，或用 CSS transform 做缩放；对重计算则用 Worker，而不是把计算塞进 rAF 继续阻塞主线程。

**容易踩坑：** `requestAnimationFrame` 不是通用防抖，也不会让重任务自动并行。微任务如果一直不结束，rAF 一样得不到机会。

**CodeWiki 连接：** CodeWiki 在切换 Wiki 页面后用 rAF 等 DOM 提交再滚动文章区域，这属于视觉时序协调；ELK 布局是计算任务，不能照搬这一招。两种场景我会分别处理。

### Q009. Promise 的状态、链式调用和“值穿透”怎么理解？

**口语化回答：** 我会先说：Promise 只有 pending、fulfilled、rejected 三种状态，一旦 settled 就不能再变。`then` 每次都会返回一个新的 Promise；回调返回普通值，新 Promise 用它 fulfilled，返回 Promise 或 thenable 则会吸收它的最终状态，抛异常则 rejected。

**原理追问：** `then` 缺少成功或失败处理器时，会把对应值或错误向下传，这就是常说的值穿透。链式调用能把异步步骤和错误传播串起来，但 Promise 本身没有通用的“取消”状态，取消通常由具体操作接受 `AbortSignal` 实现。

**容易踩坑：** 我会避免 `new Promise(async resolve => ...)` 这类反模式，也会确保链条被 `return` 或 `await`。漏掉 `return` 会让外层提前完成，错误也可能变成未处理拒绝。

**CodeWiki 连接：** CodeWiki 的 Wiki 生成外部 Store 保存正在运行的 Promise，重复点击时复用同一个 Promise，避免同 Key 重复发任务。这个做法是前端去重，不代表后端已经有完整幂等键。

### Q010. `async/await` 底层语义是什么？

**口语化回答：** 我会这么解释：`async` 函数一定返回 Promise。执行到 `await` 时，函数会暂停当前这一段，把后续逻辑安排成 Promise settlement 之后的 continuation；它不会把整个 JavaScript 线程阻塞住。`await` 普通值也会按已完成 Promise 的语义继续。

**原理追问：** 多个互不依赖的请求如果连续 `await`，会被我无意串行化；我会先启动，再用 `Promise.all` 等待。需要顺序依赖时才串行，不能为了代码看起来直就牺牲延迟。

**容易踩坑：** `forEach(async ...)` 不会等待回调，我会改用 `for...of` 串行或 `Promise.all(items.map(...))` 并行。`try/catch` 也只能捕获我真正 `await` 或返回到链上的拒绝。

**CodeWiki 连接：** CodeWiki 的图 builder 会 `await` ELK 布局后再提交视觉图；不同视图切换可能产生并发结果，所以代码还用 cancelled 标志防止旧布局回写。`await` 解决顺序，不自动解决竞态。

### Q011. `Promise.all`、`allSettled`、`race`、`any` 怎么选？

**口语化回答：** 我按业务语义选：全部成功才有意义用 `all`，它会 fail-fast；希望收集每项成败用 `allSettled`；谁先 settled 就采用谁用 `race`；谁先 fulfilled 就采用谁用 `any`，全部失败会得到 `AggregateError`。

**原理追问：** 这些组合器都不会因为外层提前失败就自动取消其他底层任务。真要节省资源，我会给每个请求传共享或独立的 `AbortSignal`，并在胜负确定后主动 abort。

**容易踩坑：** 我不会拿 `race([request, timeoutPromise])` 就说请求已超时取消；那通常只是忽略了晚到结果，网络仍在跑。还要考虑空数组语义，例如 `Promise.any([])` 会拒绝。

**CodeWiki 连接：** 如果下一版并行加载 Wiki、图状态和仓库元信息，我会按页面是否允许部分展示决定 `all` 还是 `allSettled`。当前代码没有这样一套通用聚合层，我不会把方案说成现状。

### Q012. 异步错误是怎么传播的，怎么处理未捕获拒绝？

**口语化回答：** 同步抛错沿调用栈传播；Promise 回调里抛错会把链上的下一个 Promise 变成 rejected。我的原则是底层保留有上下文的错误，上层在真正能恢复或展示的位置处理；不能既吞掉错误又给用户假成功。

**原理追问：** 全局 `unhandledrejection` 只能做最后观测，不是正常业务错误处理。请求错误还要区分网络失败、超时、主动取消、HTTP 非 2xx、响应格式错误和业务错误，重试策略也不同。

**容易踩坑：** `fetch` 遇到 404/500 默认不会 reject，所以我会显式检查 `response.ok`。我也不会把所有异常转成同一句 “failed”，否则排障时没有状态码和响应摘要。

**CodeWiki 连接：** 当前 `readJson` 会检查 HTTP 状态和 Content-Type，并提取错误详情或响应片段，这是已有实现；但请求还没有统一 timeout、trace id 和分类错误对象，这些属于下一版生产化补项。

### Q013. 浅拷贝、深拷贝和不可变更新有什么区别？

**口语化回答：** 展开运算符、`Object.assign` 只复制第一层，嵌套对象仍共享引用。深拷贝是复制整张对象图，但不一定是状态更新的最佳做法；React 里我通常只复制被修改路径，既保持不可变语义，也保留未变分支的引用共享。

**原理追问：** `structuredClone` 能处理循环引用和不少内建类型，但不能复制函数，某些平台对象也有限制；JSON 序列化会丢 `undefined`、函数、Symbol，并改变 Date 等类型。选择方式要看数据契约，不是背一个万能函数。

**容易踩坑：** 我不会先深拷贝整棵大图再改一个节点，那会制造大量对象、破坏引用稳定并触发广泛重渲染。Map/Set 更新也要创建新实例，原地 `set/add` 后把同一个引用交给 React 可能不触发期望更新。

**CodeWiki 连接：** CodeWiki 的视觉状态目前通过 `map` 只重建需要附加选中、邻居、高亮标志的节点对象。下一版做超大图时，我会进一步只更新受影响子集，而不是每次复制所有节点和边。

### Q014. `==`、`===`、`Object.is` 有什么区别？

**口语化回答：** 我业务代码默认用 `===`，避免 `==` 的隐式类型转换。`Object.is` 大体像严格相等，但把 `NaN` 和自身视为相等，并区分 `+0` 与 `-0`。React 的一些依赖和状态比较语义使用 `Object.is`，所以这个差异不是纯面试冷知识。

**原理追问：** 对象比较始终看引用，不看结构内容；两个内容一样的对象也不相等。要做深比较我会先问是否数据模型或稳定引用设计出了问题，因为通用深比较可能很贵，也处理不了所有特殊对象。

**容易踩坑：** `NaN === NaN` 是 false，判断它应使用 `Number.isNaN`；`null == undefined` 虽然是 true，但我不会借这个规则写模糊业务分支。

**CodeWiki 连接：** React Effect 依赖里如果每次 Render 都新建筛选对象，哪怕内容相同也会被视为变化。CodeWiki 的图控制器大量用 Memo 和稳定标量依赖，目的就是减少这类引用抖动。

### Q015. 防抖和节流有什么区别，怎么正确实现？

**口语化回答：** 防抖是事件停止一段时间后再执行，适合搜索输入；节流是持续事件中限制执行频率，适合滚动、拖拽和 Resize。我实现时会明确 leading、trailing、取消和 flush 语义，不只写一个 `setTimeout` 面试版本。

**原理追问：** 搜索除了防抖，还要处理旧请求晚到、组件卸载和 IME 输入；视觉更新可以考虑 rAF 节流。限频解决的是调用次数，不能代替请求取消和结果版本控制。

**容易踩坑：** 每次 Render 新建 debounced 函数会让计时器失效或泄漏；组件卸载时也要 cancel。对无障碍交互不能为了防抖让键盘反馈明显滞后。

**CodeWiki 连接：** CodeWiki 当前 Fuse 搜索在本地数组上同步执行，规模可控时无需过度优化。下一版如果仓库列表或文件树明显变大，我会先测耗时，再做防抖、预索引或 Worker 搜索。

### Q016. 事件冒泡、捕获和事件委托怎么理解？

**口语化回答：** 我会先按三个阶段讲：浏览器事件通常经历捕获、目标和冒泡。事件委托就是把监听器放在稳定祖先上，根据 `event.target` 或 `closest` 判断实际来源，适合大量动态子项。`target` 是最初触发元素，`currentTarget` 是当前执行监听器的元素。

**原理追问：** `stopPropagation` 阻止继续传播，`preventDefault` 阻止默认行为，两者不是一回事。React 事件系统提供跨浏览器封装，但我仍按组件边界和可访问语义设计，不把所有事件都拦在根上。

**容易踩坑：** 委托时如果只看 `target`，点击图标子元素可能匹配失败；Shadow DOM 还要考虑 composed path。我也不会为了省监听器牺牲清晰的键盘交互和按钮语义。

**CodeWiki 连接：** React Flow 画布和自定义节点有点击、双击、隐藏按钮等多层交互，当前代码用 `stopPropagation` 避免隐藏按钮同时触发节点选择。回答时我会用这个真实冲突解释传播机制。

### Q017. `AbortController` 能解决哪些问题，不能解决哪些问题？

**口语化回答：** 我用 `AbortController` 给支持 `AbortSignal` 的操作发取消信号，最常见是 `fetch`。切换仓库、改变查询或组件卸载时，我会 abort 旧请求，既防旧结果回写，也尽量释放网络和解析资源。

**原理追问：** abort 后 Promise 通常以 `AbortError` 拒绝，我会把它和真实故障区分，不给用户弹错误。多个任务可共享一个 Signal，也可以组合超时和外部取消，但已经提交到服务端的副作用不一定能撤销。

**容易踩坑：** cancelled 布尔值只能阻止 `setState`，不能停止请求；反过来，abort 请求也不等于后端事务回滚。对于 POST 长任务，还要用任务取消 API、幂等键或状态机解决服务端语义。

**CodeWiki 连接：** 当前 CodeWiki 多数 Hook 只有 `cancelled` 标志，API 函数没有接 `signal`。所以我会把 AbortController 作为下一版明确改造，不会说当前请求已经支持真实取消。

### Q018. JavaScript 垃圾回收和常见内存泄漏怎么讲？

**口语化回答：** 我不会背某个引擎的固定算法，先讲共同原则：只要对象从 GC roots 仍可达，就不能回收；现代引擎通常结合分代、标记清扫和压缩等策略。所谓前端泄漏，很多时候不是 GC 失效，而是代码还保留着不需要的引用。

**原理追问：** 常见来源有未清理的事件监听、定时器、订阅、闭包捕获、无限缓存、Detached DOM 和长期 Map。排查时我会看 Heap Snapshot、Allocation Timeline 和 Retainers，而不是只盯任务管理器内存瞬时值。

**容易踩坑：** `WeakMap` 只对键是弱引用，不是把整套缓存自动变安全；LRU 也要有容量和生命周期。开发环境 Strict Mode 的额外执行会暴露 cleanup 问题，但不能直接当生产泄漏证据。

**CodeWiki 连接：** CodeWiki 的布局缓存当前上限是 128 项，Wiki 生成完成状态有 TTL 和清理定时器，这些是已有的有界设计；但 Mermaid 动态渲染和大图仍应做长会话 Heap 验证。

### Q019. ESM、动态 `import()` 和 Tree Shaking 是什么关系？

**口语化回答：** 我会这么回答：ESM 的静态 `import/export` 让构建工具能在构建期分析依赖，Tree Shaking 才有机会删除未使用导出。动态 `import()` 返回 Promise，通常形成按需加载 Chunk，适合重依赖和低频功能。能否真正摇掉还受副作用标记、模块写法和打包器分析能力影响。

**原理追问：** Code Splitting 优化首屏，但会增加网络请求和运行时加载失败场景；我会对关键路径预加载，对低频功能懒加载，并监控 Chunk 失败。CommonJS 的动态性通常让静态消除更困难。

**容易踩坑：** 我不会认为“用了 ESM 就一定没有死代码”，也不会把每个组件都拆 Chunk。过度切分会让瀑布、缓存碎片和部署版本不一致更严重。

**CodeWiki 连接：** CodeWiki 的 Mermaid 用动态 `import("mermaid")` 延迟加载，因为它只在 Wiki 图出现时需要；这是当前真实的按需加载点。React 页面本身目前没有全面路由级拆包，我不会扩大表述。

### Q020. 浏览器从 JavaScript 更新到页面绘制经历什么，怎么定位卡顿？

**口语化回答：** 我会按 Style、Layout、Paint、Composite 讲渲染管线。JavaScript 修改 DOM 或 class 后，浏览器在需要时重新计算样式和布局，再绘制并合成；并非每次修改都完整走所有阶段。定位时我先录 Performance Trace，看 Long Task、Layout、Paint 和 FPS，再针对瓶颈优化。

**原理追问：** `transform`、`opacity` 常能主要走合成，但层太多也会吃显存；读取 `getBoundingClientRect` 等布局信息可能迫使浏览器提前 Layout。优化目标是减少工作量和关键路径阻塞，不是迷信某个 CSS 属性。

**容易踩坑：** React 重渲染不等于 DOM 一定重建，DOM 更新也不等于一定重绘整页。我会区分 React Profiler 的组件成本和浏览器 Performance 的渲染成本。

**CodeWiki 连接：** CodeWiki 大图同时涉及 React 节点计算、ELK 布局、React Flow DOM/SVG 渲染和 CSS 合成。我会分阶段测，而不是看到卡顿就盲目加 `useMemo`。

## 二、TypeScript 类型系统与运行时边界（Q021-Q038）

### Q021. TypeScript 到底解决什么问题，为什么不能替代运行时校验？

**口语化回答：** 我把 TypeScript 定位成开发期的静态分析和表达工具，它能在编译前发现属性、参数和控制流里的很多错误，也让重构更可靠。但类型大多在输出 JavaScript 时被擦除，浏览器拿到的接口响应并不会因为我写了 `GraphResponse` 就自动被验证。

**原理追问：** 编译器证明的是“在这些声明和假设成立时，代码怎样更安全”，不是外部世界一定遵守声明。网络、Local Storage、`JSON.parse`、第三方脚本和用户输入都属于 `unknown` 边界，需要 Schema 或显式 Guard 把运行时值收窄后再进入业务层。

**容易踩坑：** 我不会把类型断言 `as T` 当校验；它只是告诉编译器相信我，不会生成检查代码。API Client 直接 `response.json() as Promise<T>` 在类型上方便，但仍可能把坏数据带进组件。

**CodeWiki 连接：** 当前 CodeWiki 的 `readJson<T>` 检查状态码和 Content-Type，但返回体仍直接按 `T` 使用，没有完整 Schema 校验。面试里我会如实说这是当前边界，下一版在 API 边界引入 Zod、Valibot 或手写 Guard。

### Q022. `any`、`unknown`、`never` 分别什么时候用？

**口语化回答：** `any` 基本关闭类型检查，我只在迁移或确实无法建模的边界短暂使用；`unknown` 表示“我还不知道是什么”，使用前必须收窄；`never` 表示不可能出现的值，适合穷尽检查、永不返回函数和不可能分支。

**原理追问：** `unknown` 是安全的顶层类型，几乎任何值都能赋给它，但它不能随便赋给具体类型；`never` 是底层类型，可以赋给其他类型。判别联合的 `default` 分支把值赋给 `never`，能在以后新增变体时触发编译错误。

**容易踩坑：** `catch` 里的错误不一定是 `Error`，我会用 `error instanceof Error` 收窄；也不会用 `any` 绕过第三方类型问题后让它扩散到整个业务层。

**CodeWiki 连接：** CodeWiki 的 API 错误和 Mermaid Render Error 都以 `unknown` 接住，再判断是否为 `Error`。图节点类型则适合用 `never` 做穷尽分支，避免新增节点种类后静默走默认样式。

### Q023. TypeScript 的 narrowing 是怎么工作的？

**口语化回答：** 我把 narrowing 说成编译器结合控制流，把宽类型一步步缩到当前分支能确定的类型。常见手段有 `typeof`、`instanceof`、`in`、相等判断、真值判断和判别字段；分支返回后，后续路径也会根据可达性继续收窄。

**原理追问：** 收窄依赖当前控制流和赋值历史，不只是某一行 if。对 `string | null`，先判断 null 后就能安全用字符串；但把值交给可能异步执行的回调或可变别名后，编译器可能不能继续保证先前结论。

**容易踩坑：** 真值判断会同时排除空字符串、0、NaN 等合法值，我会按业务语义显式判断 `value == null` 或具体判别字段。`in` 只能证明属性存在语义，仍需考虑可选属性和原型链。

**CodeWiki 连接：** CodeWiki 的 Wiki 生成快照从 Session Storage 恢复时，当前用 `isWikiGenerationOperation` 检查字段类型和枚举值，这就是运行时 Guard 加 narrowing 的真实例子。

### Q024. 自定义 Type Guard 和 Assertion Function 有什么区别？

**口语化回答：** 返回 `value is T` 的 Guard 让调用方根据布尔结果收窄；`asserts value is T` 的断言函数失败时应抛错，成功返回后编译器直接把值当 T。我会在可恢复分支用 Guard，在违反前置条件就不能继续时用 Assertion。

**原理追问：** 这两类函数的签名只是给编译器的承诺，函数体必须真的检查足够条件。检查一个 `id` 是字符串，并不能证明整个深层对象符合接口；需要递归 Schema 时我会用成熟验证库并从 Schema 推导类型。

**容易踩坑：** 写一个永远返回 true 的 Guard 能骗过编译器，是比 `as` 更隐蔽的风险。我会给 Guard 准备合法、缺字段、错类型、边界枚举和恶意嵌套输入测试。

**CodeWiki 连接：** 当前 `isWikiGenerationOperation` 只验证恢复逻辑真正依赖的关键字段，并不证明所有 message/error 字段完整。面试里我会说明 Guard 的验证范围，而不是把它宣传成全面 DTO Schema。

### Q025. 判别联合为什么适合建模 UI 状态？

**口语化回答：** 我喜欢用一个稳定字面量字段把互斥状态写成联合，例如 `idle | loading | success | error`，每种状态只带自己合法的数据。这样就不会出现 `loading=true`、`data` 和 `error` 同时存在这种无效组合，组件 switch 后也能自动收窄。

**原理追问：** 判别字段必须在所有成员上存在并且是互斥字面量。配合 `assertNever` 能做穷尽检查；Reducer 的 Action 也适合这样建模，让 payload 和 type 一一对应。

**容易踩坑：** 我不会把远程请求所有状态拆成多个互不约束的 boolean，也不会在 `default` 里静默返回。新增状态如果没有 UI，应该在编译阶段暴露出来。

**CodeWiki 连接：** Wiki 生成当前 `status` 是 `running | success | error`，已经接近判别联合，但 Record 仍是一个字段较宽的对象。下一版可以把三种快照拆成真正联合，让 `completedAt`、`error`、`message` 的合法组合由类型保证。

### Q026. `type` 和 `interface` 怎么选？

**口语化回答：** 两者都能描述对象结构，日常没有谁绝对更高级。我通常用 `interface` 表达可扩展的公共对象契约，用 `type` 表达联合、交叉、映射、条件类型和局部组合。团队一致性比机械规则更重要。

**原理追问：** `interface` 支持声明合并，能 `extends`；`type` 别名不能重复声明，但组合能力更广。两者都受结构类型系统约束，很多对象场景可互换；真正要关注的是公开 API 是否希望被扩展和错误信息可读性。

**容易踩坑：** 我不会为了继承滥用深层 interface hierarchy，也不会用交叉类型硬拼出逻辑上互相冲突的属性。类型设计应让非法状态难以表达，而不是只追求复用行数。

**CodeWiki 连接：** CodeWiki 的 API Record 和组件 Props 目前以 `type` 为主，尤其图节点有联合与组合需求。我不会为了面试偏好重写成 interface；会解释选择与模型复杂度的对应关系。

### Q027. 泛型解决什么问题，和 `any` 有什么本质区别？

**口语化回答：** 我把泛型理解成用一个类型参数保留输入和输出之间的关系。比如 `readJson<T>` 返回调用方指定的 `T`，`fuzzySearch<T>` 输入什么项就返回什么项；`any` 会丢掉这种关系，让后续检查失效。泛型的价值是复用约束，不是把尖括号写得复杂。

**原理追问：** 类型参数可以从实参推断，也可以显式提供；默认参数和多个参数能表达更复杂关系。但如果函数内部对 T 一无所知，就不能随意访问属性，需要加约束或把所需操作作为参数传入。

**容易踩坑：** 单个泛型只出现一次通常没有建立任何关系，可能直接用具体类型或 `unknown` 更清楚。我也不会用 `T = any` 作为默认值把安全性悄悄关掉。

**CodeWiki 连接：** 当前 `fuzzySearch<T>` 把 key 限定为 `keyof T & string`，既复用搜索逻辑，又避免传一个完全不存在的字段；这是比 `items: any[]` 更有价值的泛型例子。

### Q028. 泛型约束、`keyof` 和索引访问类型怎么配合？

**口语化回答：** 我会用 `K extends keyof T` 表达“这个 key 必须来自对象 T”，再用 `T[K]` 表达对应属性值类型。这样写取值、排序、表格列和搜索字段时，字段名与值类型能一起变化，不靠字符串约定。

**原理追问：** `keyof` 对对象得到属性名联合，对索引签名可能得到 `string | number`；`typeof` 放在类型位置能从运行时变量取得静态类型。常量配置配合 `as const` 可以把宽字符串收成字面量联合。

**容易踩坑：** `Object.keys()` 通常返回 `string[]`，因为运行时对象可能有比声明更多的键，我不会随便断言成 `(keyof T)[]` 而忽略开放世界边界。

**CodeWiki 连接：** CodeWiki 的 Fuse 包装器要求 `keys: Array<keyof T & string>`，仓库搜索可传 `name/path/source_type/commit_hash`，文件搜索可传 `path/language`；拼错字段能在编译时发现。

### Q029. 条件类型和 `infer` 是怎么工作的？

**口语化回答：** 条件类型类似类型层面的分支：`T extends U ? X : Y`。`infer` 可以在匹配结构里提取一部分类型，例如从函数提取返回值、从 Promise 提取内部值。我主要用它封装公共工具类型，不会让业务代码每一行都变成类型谜题。

**原理追问：** 裸类型参数参与条件时会对联合分发，例如 `T extends ...` 对每个联合成员分别计算；用元组包住 `[T] extends [U]` 可以阻止分发。这是很多高级类型结果“怎么散开了”的根因。

**容易踩坑：** 条件类型递归太深会拖慢编译、让错误不可读。已有 `Awaited`、`ReturnType`、`Parameters` 等内建工具时，我优先使用而不是重复造轮子。

**CodeWiki 连接：** CodeWiki 当前 DTO 和图类型没有必要大量使用高级条件类型。面试时我会证明自己理解原理，但也会说明项目更重视 API 边界清晰，而不是炫技式类型体操。

### Q030. 映射类型和模板字面量类型有什么实际用途？

**口语化回答：** 我会这么解释：映射类型能遍历 `keyof T` 批量调整属性，比如只读、可选或生成表单状态；模板字面量类型能把有限字符串组合成事件名、CSS Token 或 API Key。它们适合从一个事实源派生类型，减少手工同步。

**原理追问：** 映射时可以用 `+/-readonly`、`+/-?` 调整修饰符，也能用 `as` 重映射键。模板联合做笛卡尔积，成员太多会造成编译性能和可读性问题。

**容易踩坑：** 我不会用模板类型假装验证任意 URL、文件路径或复杂语法；编译期字符串形状和运行时合法性是两回事。对外部输入仍要真正解析和校验。

**CodeWiki 连接：** 图节点和边类型来自后端数据，当前前端接受字符串并结合已知集合展示。下一版如果双方共享 OpenAPI 生成类型，我会从 Schema 派生联合，避免前后端各维护一份字面量清单。

### Q031. TypeScript 的结构类型和 Excess Property Check 怎么理解？

**口语化回答：** 我会先说 TypeScript 主要看对象“有没有所需结构”，而不是名义上属于哪个类。直接把对象字面量传给目标类型时会做额外属性检查，帮助发现拼写错误；但先放进变量再赋值，只要至少包含所需字段，通常可以通过。

**原理追问：** 这是结构兼容和对象字面量新鲜度的差异，不是类型系统前后矛盾。若业务要求严格禁止额外字段，静态类型不够，还要在运行时 Schema 里选择 strip、passthrough 或 strict 策略。

**容易踩坑：** 我不会通过 `as Target` 压掉额外字段错误，也不会认为多余字段会在编译后自动删除。序列化发给后端时，它们仍可能真实存在。

**CodeWiki 连接：** CodeWiki 图 API 返回的节点 metadata 是开放对象，结构类型很方便；但 Wiki 生成操作从 Session Storage 恢复属于不可信输入，需要显式挑关键字段校验，不能只靠接口声明。

### Q032. 协变、逆变和不变怎么用口语解释？

**口语化回答：** 我会用“谁能替谁”解释。只产出 T 的容器通常可以协变：能产出 Dog 的地方可当作产出 Animal；只消费 T 的函数参数方向相反，通常是逆变：能处理所有 Animal 的函数，当然能用于只会传 Dog 的位置；既读又写往往需要不变。

**原理追问：** 开启 `strictFunctionTypes` 后，普通函数类型参数检查更严格，但方法参数历史上有双变兼容性。数组在 TypeScript 里还有实用主义取舍，所以我不会拿理论结论推导出“可变数组绝对安全”。

**容易踩坑：** 把 `(dog: Dog) => void` 交给可能传 Cat 的 `(animal: Animal) => void` 是不安全的。回调类型过宽或过窄都可能靠断言掩盖运行时错误。

**CodeWiki 连接：** React Flow 的节点回调和通用组件 Props 会涉及函数参数兼容。当前代码使用库提供的 `NodeProps<Node<...>>` 精确约束数据类型，比把回调都写成 `(node: any) => void` 更稳。

### Q033. 联合类型和交叉类型有什么区别？

**口语化回答：** 我会这样区分：`A | B` 表示值可以是 A 或 B，使用时只能直接依赖二者共同安全的部分，收窄后再访问特有字段；`A & B` 表示值同时满足 A 和 B，常用于组合能力。它们不是集合上的“或字段”和“把对象随便合并”。

**原理追问：** 冲突属性交叉可能得到 `never`，说明这个组合根本不可能。联合更适合建模互斥状态，交叉更适合给基础结构附加元信息；复杂对象组合还要考虑同名属性语义。

**容易踩坑：** 我不会用 `A & B` 表达“二选一”，也不会访问联合某成员特有字段而不收窄。Optional 属性堆出来的“大接口”通常不如判别联合准确。

**CodeWiki 连接：** CodeWiki 的视觉节点分 `code` 和 `container` 两种数据，适合用判别联合；选中、高亮、淡化等公共视觉标志适合组合到基础数据上。这样 builder 和组件都能保持类型边界。

### Q034. `as const` 和 `satisfies` 有什么区别？

**口语化回答：** `as const` 会把字面量尽量收窄成只读字面量类型；`satisfies` 检查表达式满足某个目标类型，同时尽量保留表达式自己的精确信息。我常用 `satisfies` 校验配置表，用 `as const` 定义枚举式常量，两者可以配合但目的不同。

**原理追问：** 类型注解 `const x: Config = ...` 可能把具体字面量拓宽成 Config；`satisfies Config` 往往还能保留每个键的具体值。两者都不会生成运行时冻结或校验逻辑。

**容易踩坑：** `as const` 会让嵌套字面量只读，可能和期望可变 API 不兼容；`satisfies` 也不是类型转换。需要运行时严格配置，仍要 Parse。

**CodeWiki 连接：** 图的 `flowNodeTypes`、密度模式和已知边类型都适合用常量表加 `satisfies`，既检查库契约又保留具体键。当前实现已经依赖静态 NodeTypes，但没有必要宣称用了所有新语法。

### Q035. `strictNullChecks`、可选属性和可选链怎么区分？

**口语化回答：** 我会这么回答：开启 `strictNullChecks` 后，`null/undefined` 不再悄悄属于所有类型。`prop?: T` 表示属性可能缺失，读取通常是 `T | undefined`；`obj?.prop` 只在左边为 nullish 时短路，不会把 0、空字符串当缺失。

**原理追问：** `??` 只在 `null/undefined` 时取默认值，`||` 还会把 0、false、空字符串当假值。精确可选属性语义还受 `exactOptionalPropertyTypes` 影响：“不存在”和“明确写 undefined”可能需要区分。

**容易踩坑：** 非空断言 `!` 不会在运行时检查，我只在 DOM 入口这类有外部不变量且能解释的地方使用。业务数据一路 `?.` 到最后给默认值，可能把真实数据错误藏掉。

**CodeWiki 连接：** CodeWiki 的 `createRoot(document.getElementById("root")!)` 依赖 HTML 模板保证 root 存在；API 数据则不能照搬非空断言，图和 Wiki 页面都通过显式空状态处理。

### Q036. 运行时 Schema 校验应该放在哪里，怎么避免重复类型？

**口语化回答：** 我把校验放在不可信边界：HTTP 响应、Storage、消息流、URL 和第三方输入。校验成功后马上转成内部可信 DTO，后面的组件就不用重复防守。为了避免 Schema 和类型两份漂移，我会优先从 Schema 推导 TypeScript 类型，或从 OpenAPI 生成客户端。

**原理追问：** Schema 策略要明确未知字段、默认值、日期转换、递归深度和错误路径。大响应全量深校验有成本，可以按风险选完整校验、关键字段校验或服务端版本契约，但不能假装没有成本就跳过。

**容易踩坑：** 我不会把后端 Pydantic 校验当成前端永远安全，代理错误页、版本错配和缓存污染都可能改变响应。也不会在每次 Render 重复 Parse 同一大对象。

**CodeWiki 连接：** 下一版我会在 `readJson` 后按 Endpoint Schema Parse，至少先覆盖 Graph、Wiki 和 Ask 三个核心响应；当前只校验 Content-Type 和部分 Session Storage 快照，所以面试会明确这是改造建议。

### Q037. 前后端 API 类型怎样设计才不容易漂移？

**口语化回答：** 我希望后端 Schema 是单一事实源，通过 OpenAPI 生成 TS Client 或类型，CI 检查 Breaking Change；同时运行时仍按版本校验。DTO 和前端 View Model 分开，API 字段变化只在 Adapter 层消化，不让页面到处直接依赖后端原始结构。

**原理追问：** 兼容演进里新增可选字段通常安全，删除、改名、收窄枚举和改变 nullability 都可能破坏客户端。流式协议还要给每类 Event 带 version、id 和判别字段，不能只生成普通 REST 类型。

**容易踩坑：** 共享一个手写 `types.ts` 不等于契约自动一致；生成代码也不是运行时验证。前后端同时部署时还要考虑旧前端配新后端、缓存 HTML 配新 Chunk 等窗口。

**CodeWiki 连接：** 当前 CodeWiki 前端在 `api/types.ts` 手写 DTO，FastAPI 能产 OpenAPI 但尚未形成生成式客户端流程。下一版我会先加 Contract Diff 和生成 Client，再逐步迁移，而不会说当前已自动同步。

### Q038. `tsconfig` 里哪些严格选项和构建方式最重要？

**口语化回答：** 我至少关注 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、未使用代码检查，以及浏览器目标、模块解析和 JSX 配置。`tsc -b` 的 Build Mode 支持按 Project References 构建多个 TS Project，但是否真的用了 Reference 要看配置；之后再交给 Vite 打包。Vite 转译快，但它本身不能替代完整 Type Check。

**原理追问：** 严格选项不能一次全开后靠大量断言清零，我会按错误类别迁移、补边界类型和回归测试。`skipLibCheck` 能缩短构建但会跳过声明文件检查，需要理解它隐藏的风险。

**容易踩坑：** 只跑 Vite Dev Server 可能看不出类型错误；只跑 `tsc --noEmit` 又验证不了 Bundler、资源和环境变量。CI 至少应拆出 lint、typecheck、test、build 四类信号。

**CodeWiki 连接：** CodeWiki 当前 `build` 是 `tsc -b && vite build`，但根 `tsconfig.json` 没有 `references`，所以当前主要检查其 `include` 的 `src`，不能说已经按多 Project Reference 构建；Vite 再输出到 FastAPI 静态目录。当前也没有前端 `test` 脚本，不能说已有完整 CI 质量体系。

## 三、React 19 核心模型与 Hooks（Q039-Q068）

### Q039. React 组件为什么会重新 Render？

**口语化回答：** 我先区分触发源和实际 DOM 变化。组件首次挂载会 Render；自身 State 更新、父组件重新 Render、订阅的 Context 或外部 Store 快照变化，都可能触发 Render。Render 只是重新计算下一棵 UI，不代表每次都改 DOM。

**原理追问：** 默认情况下父组件 Render 会调用子组件函数；`memo` 可以在 Props 比较相等时跳过一部分工作，但自身 State、Context 变化仍能触发它。React Compiler 或手工 Memo 都不能修复组件本身不纯的问题。

**容易踩坑：** 我不会把“函数组件执行一次”理解成组件实例永久存在；每次 Render 都会重新调用函数。也不会看到 Console 打两次就立刻判断生产重复渲染，要先考虑 Strict Mode 和并发中被放弃的 Render。

**CodeWiki 连接：** CodeWiki 图控制器有很多筛选、选择和高亮状态，一次状态变化可能让画布父层重新 Render。当前自定义节点用 `memo`，但是否真正减少成本还取决于 nodes/data 引用是否稳定。

### Q040. React 的 Render Phase 和 Commit Phase 有什么区别？

**口语化回答：** 我会把它分成两段：Render Phase 是 React 调用组件、计算下一棵 UI 和差异，必须保持纯；Commit Phase 才把必要变更写到 DOM，并处理 Ref 和 Effect 的相关时序。并发模式下 Render 可能暂停、重启或丢弃，但一次 Commit 应保持一致。

**原理追问：** Layout Effect 在 DOM 提交后、浏览器绘制前执行，普通 Effect 通常在绘制后执行。因为 Render 可能重跑，我不会在组件函数体里发请求、写 Storage 或改全局变量。

**容易踩坑：** “Virtual DOM Diff”只是 Render 工作的一部分，不能把全部机制压成一句。Render 没 Commit 的结果用户看不到，但其中误写的副作用却可能已经发生，所以纯函数约束很关键。

**CodeWiki 连接：** CodeWiki Wiki 页面在 Effect 中读取标题 DOM、注册 Scroll Listener，而不是在 Render 里直接写 DOM；文章滚动和 Mermaid 渲染都依赖 Commit 后的节点，这能作为真实例子解释阶段边界。

### Q041. “State 是一次 Render 的快照”是什么意思？

**口语化回答：** 我会说每次 Render 拿到的是当时那一帧 State。事件处理器和异步回调闭包也属于那一帧，调用 `setState` 是请求下一次 Render，不会把当前函数里的变量原地改掉。所以同一个处理器里打印更新前后的 State，常常还是旧值。

**原理追问：** React 把 State 存在组件对应的位置，组件函数每次被调用时拿到当前快照。需要基于上一状态连续计算时用函数式更新；需要某个异步逻辑明确使用提交时输入时，快照反而是正确语义。

**容易踩坑：** 我不会通过直接给 State 对象属性赋值来“立即更新”，也不会用 `setTimeout` 猜下一次 Render 何时结束。需要 Commit 后做事就根据数据流或 Effect 组织。

**CodeWiki 连接：** CodeWiki 的 `setSelectedSlug(current => ...)` 会基于当前已提交选择判断新 Wiki 是否仍包含该页面，这比闭包里直接读取旧 `selectedSlug` 更适合异步刷新场景。

### Q042. React 的批处理是什么，React 19 下怎么理解？

**口语化回答：** 批处理就是 React 把同一批事件里的多个 State 更新合并后再统一 Render，减少中间态和重复工作。现代 React 使用 `createRoot` 时，Promise、Timer 等异步来源里的更新也通常会自动批处理；但我不会依赖“每一处都恰好只 Render 一次”来写业务正确性。

**原理追问：** 同一 State 连续写固定值时，每次闭包看到的还是当前快照；函数式 updater 会按队列依次基于前一个结果计算。确实需要同步把 DOM 提交出来才会考虑 `flushSync`，而且它是性能上的逃生口。

**容易踩坑：** 批处理不是把多个异步请求变成原子事务，也不保证 Effect 只跑一次。过度使用 `flushSync` 会破坏调度和性能，我只在第三方 DOM 集成等明确场景用。

**CodeWiki 连接：** Wiki 请求结束时会更新 data、selected page、loading 等状态，React 可合并一部分 Render；但旧请求覆盖新请求是业务竞态，不能靠批处理解决，仍需要取消或 request id。

### Q043. 为什么基于旧 State 更新要用函数式写法？

**口语化回答：** 当新值依赖旧值时，我写 `setCount(c => c + 1)`，因为 updater 会收到队列里的最新中间结果。直接写 `setCount(count + 1)` 多次，用的是同一帧闭包里的 `count`，很可能只得到一次加一。

**原理追问：** Updater 应保持纯，因为开发环境可能额外调用它检查纯度。对对象状态，我在 updater 里返回新对象并只复制修改路径；复杂多动作状态可以升级到 Reducer。

**容易踩坑：** 函数式更新只解决“基于前值”的队列问题，不会自动解决异步请求先后顺序。把外部可变变量塞进 updater 也会破坏可预测性。

**CodeWiki 连接：** CodeWiki 的刷新 Nonce、侧栏宽度 Clamp、缩放比例等都使用函数式更新。图数据请求若要 latest-wins，还需另外维护请求版本或 AbortSignal。

### Q044. React 为什么强调 State 不可变？

**口语化回答：** React 常通过引用判断值有没有变化，快照和并发渲染也依赖旧数据不会被偷偷修改。我更新数组、对象、Map 和 Set 时会产生新引用，只复制改变的路径；这让回滚、Memo 和调试都更可靠。

**原理追问：** 不可变不是要求深拷贝全部数据，而是旧快照可观察的部分不能被改。结构共享能保留没变分支的引用，降低内存和比较成本；需要复杂嵌套时可评估 Immer，但仍要理解它产出的不可变结果。

**容易踩坑：** `array.push` 后再 `setArray(array)` 可能因为引用没变而不更新；反过来每次无差别重建全图，又会让 Memo 全失效。正确目标是最小必要的新引用。

**CodeWiki 连接：** 当前图选中效果会映射 nodes/edges 生成视觉状态，逻辑清楚但可能全量创建对象。下一版针对大图，我会保留未受影响对象引用并用性能数据验证收益。

### Q045. React Reconciliation 和 `key` 到底在解决什么？

**口语化回答：** 我会先讲身份：React 用元素类型和同层 `key` 判断前后两次 UI 中谁是同一个对象。稳定 Key 能让列表项在插入、删除和重排后保留正确 State；Key 变了则会被当成另一个组件，旧 State 被重置。

**原理追问：** Key 只需在兄弟列表中唯一，不会作为普通 Prop 自动传给组件。React 对不同类型通常重建子树，对同类型继续比较 Props 和 Children；这是一套实用启发式，不是对任意树做最昂贵的最优 Diff。

**容易踩坑：** 可重排列表不能用 index 当身份，也不能每次用 `Math.random()`，否则输入框状态、焦点和动画会错位。故意用 Key Reset State 可以，但要清楚会丢整个子树状态。

**CodeWiki 连接：** CodeWiki 图节点 ID 和 Wiki slug 都是稳定身份，React Flow 也依赖稳定 node id。`flowKey` 变化会主动重建画布以切视图，这是有意 Reset，不是随便规避更新问题。

### Q046. 受控组件和非受控组件怎么选？

**口语化回答：** 受控输入的值由 React State 决定，更新走 `onChange`，适合校验、联动和统一提交；非受控输入让 DOM 自己保存当前值，通过 Ref 或表单读取，适合简单表单或第三方组件。我按谁是事实源来选，不混着控制同一个字段。

**原理追问：** `value` 配合 `onChange` 是受控，初始值用 `defaultValue` 是非受控。文件输入通常由浏览器管理；大型表单也可以通过字段级订阅减少每次键入的父层 Render。

**容易踩坑：** 输入从 `undefined` 变字符串可能产生 uncontrolled-to-controlled 警告；受控值却忘记 `onChange` 会变只读。表单性能问题应先 Profile，不是看到受控就全改 Ref。

**CodeWiki 连接：** CodeWiki Ask 输入、仓库选择和筛选条件目前都是受控状态，便于禁用提交和组合查询。若下一版出现超大动态设置表单，我会再评估字段级表单库，而不是把现状说成已有。

### Q047. Props、State、Context 各自应该放什么？

**口语化回答：** Props 是父层显式传入的数据和行为，State 是组件树某个位置拥有、会随交互变化的数据，Context 适合跨很多层共享且语义稳定的依赖。我的原则是 State 尽量靠近使用者，只有真正跨域共享时才上提或放 Store。

**原理追问：** Context Provider 的 value 变化会让读取该 Context 的消费者重新 Render；如果把频繁变化的大对象全部放一个 Context，更新范围会很大。可以拆 Context、稳定 value，或用支持 Selector 的外部 Store。

**容易踩坑：** 我不会把 Context 当全球变量仓库，也不会为了避免两层 Props 就引入状态库。派生数据能从 Props/State 算出来时，不再额外存一份 State。

**CodeWiki 连接：** 当前 CodeWiki 页面大多用局部 Hooks 和显式 Props，图页面状态集中在 Controller Hook；并没有因为 `zustand` 在依赖里就把状态全放 Zustand，这一点面试时要如实说。

### Q048. `useReducer` 什么时候比多个 `useState` 更合适？

**口语化回答：** 当多个字段经常一起变化、状态转换有明确事件，或者我要让非法状态更难出现时，我会用 Reducer。它把“发生什么”写成 Action，把“怎么变”集中在纯 Reducer 里，比散落的 Set 调用更容易测试和回放。

**原理追问：** Reducer 仍然是组件局部状态工具，不自动变成全局 Store。Action 最好用判别联合，Reducer 保持纯；副作用放事件层或 Effect，不在 Reducer 里发请求。

**容易踩坑：** 简单开关硬上 Reducer 会增加模板代码；把所有请求副作用塞进 Reducer 又会破坏纯度。是否采用看转换复杂度，不看字段数量一个指标。

**CodeWiki 连接：** 图控制器当前有 View Mode、筛选、选中、高亮和隐藏节点等多组 State，下一版如果状态转换继续增多，我会考虑 Reducer 或显式状态机；当前仍是 Hooks 实现，不能说已经迁移。

### Q049. Hooks 为什么不能放在条件或循环里？

**口语化回答：** 我会从底层约定解释：React 依赖 Hooks 在每次 Render 中以相同顺序被调用，才能把当前这次 `useState/useEffect` 对应到之前的那一个。条件分支改变调用顺序后，State 槽位会错配，所以规则要求只在组件或自定义 Hook 顶层调用。

**原理追问：** 条件应该放进 Hook 内部，例如 Effect 里先判断；或者拆成子组件，让组件是否存在由条件控制。Hooks Lint 不只是风格检查，它在静态层面保护这套调用约定和依赖完整性。

**容易踩坑：** 普通函数名字以 `use` 开头不自动拥有魔法，它必须遵守 Hook 规则；事件处理器里也不能临时调用 Hook。关闭 Lint 只会把错误推迟到运行时。

**CodeWiki 连接：** CodeWiki 的 `useVisualGraph`、`useWikiData`、`useAsk` 都在顶层组合 Hooks，视图模式的分支放在 Effect 内部选择 builder，这正符合调用顺序要求。

### Q050. `useEffect` 的真正用途是什么？

**口语化回答：** 我不会把 Effect 叫“组件生命周期万能入口”，它的核心是让 React 状态和外部系统同步，例如网络、订阅、浏览器 API、第三方 Widget。纯派生值能在 Render 里算就直接算，用户动作能在事件里完成就放事件里，不需要多绕一次 Effect。

**原理追问：** Effect 的 Setup 在 Commit 后运行；依赖变化前会先执行上一次 Cleanup，再执行新 Setup；卸载时也 Cleanup。我要描述的是一段可独立开始和停止的同步过程，而不是机械背 Mount/Update/Unmount 对应表。

**容易踩坑：** Effect 里无条件 Set 一个它自己依赖的 State 会循环；用 Effect 同步两个本可派生的 State 会产生中间不一致和额外 Render。我会先问“外部系统是什么”。

**CodeWiki 连接：** 当前 CodeWiki Effect 用于 Fetch、轮询、Window 事件、Local/Session Storage、MutationObserver 和 Mermaid 第三方渲染；这些都有真实外部对象。筛选后的图则用 `useMemo` 派生，不另用 Effect 存副本。

### Q051. Effect 依赖数组应该怎么写？

**口语化回答：** 我按 Effect 代码实际读取的响应式值声明依赖，而不是凭感觉删。Props、State，以及组件体内定义并被 Effect 使用的函数和对象通常都属于依赖；如果依赖变化太频繁，我会重构数据流，而不是欺骗 Lint。

**原理追问：** React 用 `Object.is` 比较依赖。如果对象或函数只为 Effect 服务，我可以把它放进 Effect；如果要跨处复用，再根据语义用 `useMemo/useCallback` 稳定，或把非响应式逻辑移到组件外。

**容易踩坑：** 空数组不是“只执行一次”的魔法声明，而是我承诺 Effect 不依赖会变化的响应式值。漏依赖导致旧闭包，乱加每次新建的对象又可能反复重连，两边都要靠设计解决。

**CodeWiki 连接：** CodeWiki Wiki 轮询 Effect 依赖 `isGenerating` 和稳定的 `refresh`；图布局 Effect 明确列出图、筛选、模式和选中项。依赖较多说明它编排的输入多，也提示未来可拆更小 Hook。

### Q052. Effect Cleanup 如何处理请求竞态？

**口语化回答：** Cleanup 可以把本轮 Effect 标记失效，旧 Promise 回来时不再提交 State；更完整的做法是同时 Abort 底层请求。对于快速切换参数，我还会用 Request ID 或 Query Key 做 latest-wins，确保只有当前请求能更新对应缓存。

**原理追问：** Cleanup 在下一次 Setup 前执行，所以它天然对应“一次同步过程的终止”。但网络请求可能已经到后端并产生副作用，前端 Cleanup 只控制客户端处理；写操作还要靠幂等、取消 API 或后端状态机。

**容易踩坑：** 只设 `loading=false` 不代表旧请求不能覆盖新数据；多个请求共享一个 boolean 也可能互相误伤。取消异常应单独处理，不当真实错误展示。

**CodeWiki 连接：** 当前 `useRepos`、`useWikiData`、`useVisualGraph` 都用 `cancelled` 标志保护状态，这是已有防回写；API 层尚未接 AbortSignal，因此我会明确它是“忽略旧结果”，不是“真正取消任务”。

### Q053. Strict Mode 为什么开发环境会额外执行 Render 或 Effect？

**口语化回答：** Strict Mode 在开发环境故意额外调用某些纯函数，并对 Effect 做一次 Setup、Cleanup、再 Setup，用来暴露不纯 Render 和缺失 Cleanup。它不会让生产环境固定执行两次，我应该修复副作用不对称，而不是移除 Strict Mode 掩盖问题。

**原理追问：** 能正确 Cleanup 的订阅、计时器和第三方连接，经历重连后结果应该和只执行一次一致。请求也需要取消、去重或允许旧结果失效；“加一个 didRun Ref 跳过第二次”通常绕过了检测目的。

**容易踩坑：** Console 日志重复不一定是 Bug，但重复创建订单、重复注册监听就是设计有问题。Render 本身必须纯，Effect 也要能独立启停。

**CodeWiki 连接：** CodeWiki 入口当前包了 `<StrictMode>`。面试中我会用 Mermaid Effect 的 cancelled 标志、事件监听 Cleanup 和轮询 `clearInterval` 说明现有对称处理，同时承认还需测试验证。

### Q054. `useEffect` 和 `useLayoutEffect` 怎么选？

**口语化回答：** 我默认用 `useEffect`，让浏览器先绘制；只有必须在用户看到之前测量 DOM 并同步修正布局时，才用 `useLayoutEffect`。Layout Effect 会阻塞 Paint，里面做重活会直接影响首帧。

**原理追问：** 两者都在 Commit 之后，差别主要是相对 Paint 的时序。Tooltip 定位、滚动位置恢复可能需要 Layout Effect；网络请求、订阅和日志通常不需要。

**容易踩坑：** 把所有 Effect 改成 Layout Effect 不能消除闪烁根因，只会把工作挤到关键路径。SSR 环境还没有浏览器 Layout，需要考虑客户端边界。

**CodeWiki 连接：** Wiki 文章目录当前在普通 Effect 中扫描标题并监听滚动，允许首帧后建立目录；若实际出现明显目录跳动，我会测量后再决定是否局部改 Layout Effect，不先假设。

### Q055. `useRef` 为什么更新后不会触发 Render？

**口语化回答：** 我把 Ref 理解成一个跨 Render 保持身份的可变容器，React 不把 `ref.current` 的变化当 UI 状态，所以改它不会触发 Render。它适合 DOM 引用、Timer ID、上一值、请求版本或不参与显示的可变句柄。

**原理追问：** Ref 对象本身通常在组件生命周期内稳定；Commit 时 React 会设置 DOM Ref。需要把值展示到 UI 时应该用 State，否则 Ref 改了页面不会自动更新。

**容易踩坑：** 我不会在 Render 中随意读写会影响输出的 Ref，那会破坏纯度和并发安全；也不会用 Ref 逃避所有依赖问题。Ref 保存最新值是有意采用可变语义，不是默认方案。

**CodeWiki 连接：** CodeWiki 用 Ref 保存文章 DOM、全屏关闭按钮、当前选中仓库和已刷新操作 ID，这些都不需要单独驱动 UI；真正的 loading、error、selection 仍然是 State。

### Q056. `memo`、`useMemo`、`useCallback` 分别缓存什么？

**口语化回答：** 我会这样区分：`memo` 尝试在 Props 没变时跳过组件 Render；`useMemo` 缓存计算结果；`useCallback` 缓存函数引用，本质上相当于缓存一个函数值。它们都是性能优化，不是正确性工具，React 也可以在特定情况下丢掉 Memo 缓存。

**原理追问：** `memo` 默认逐项用 `Object.is` 比较 Props，父层每次新建对象和回调会让它失效。只有计算确实昂贵、下游依赖引用稳定，或 Profile 显示收益时我才加；React 19 生态里的 Compiler 也在减少一部分手工 Memo 需求，但项目是否启用要看构建配置。

**容易踩坑：** 到处 Memo 会增加依赖管理、比较成本和旧闭包风险。自定义比较器如果漏比函数 Props，子组件可能一直拿旧状态；深比较大对象也可能比重新 Render 更慢。

**CodeWiki 连接：** 当前图自定义节点用 `memo`，图筛选、视觉状态和目录索引用 `useMemo`，事件处理器大量 `useCallback`。我会用 Profiler 验证它们，不会只凭使用数量宣称性能很好。

### Q057. React 里的 Stale Closure 怎么系统解决？

**口语化回答：** 我先判断回调应该看到“创建时快照”还是“执行时最新值”。基于旧 State 更新用函数式 updater；Effect 读响应式值就补依赖；订阅回调若必须稳定又要最新值，可以用 Ref 或 React 提供的相应非响应式事件模式，具体按当前稳定 API 选择。

**原理追问：** 每次 Render 都有独立闭包，所以问题不是闭包坏了，而是我的业务语义没表达清。把函数放进依赖会重建同步过程，使用 Ref 则绕开响应式更新，两者取舍必须明确。

**容易踩坑：** 我不会用 `// eslint-disable-next-line react-hooks/exhaustive-deps` 当常规修复，也不会让 Ref 成为第二套隐藏 State。Timer、WebSocket Listener 和第三方订阅最需要覆盖旧闭包测试。

**CodeWiki 连接：** `useRepos` 用 Ref 保存最新 `selectedRepoId` 和回调，让数据加载 Effect 不因回调身份变化重跑；这是有意的“执行时最新值”设计，不等于所有值都该放 Ref。

### Q058. 自定义 Hook 的价值是什么，边界在哪里？

**口语化回答：** 我认为自定义 Hook 复用的是有状态逻辑和副作用协议，不是共享同一份 State；每次调用仍有自己的 Hook 实例。一个好 Hook 会暴露清晰输入、状态和命令，把取消、Cleanup、错误语义封装起来，不泄漏太多实现细节。

**原理追问：** Hook 名必须以 `use` 开头并遵守调用规则。逻辑太复杂时可以在 Hook 内组合 Reducer、外部 Store 或普通纯函数；纯计算本身不需要硬包装成 Hook。

**容易踩坑：** 万能 `useEverything` 会把大量无关依赖绑在一个 Effect 里，难测试也易竞态。我会按资源生命周期或用户工作流拆分，而不是按文件行数拆。

**CodeWiki 连接：** CodeWiki 已有 `useAsk`、`useWikiData`、`useVisualGraph` 和 `useGraphPageController`。最后一个职责较重，下一版可以按数据加载、导航状态和图布局继续拆，但当前我不会声称已经完成重构。

### Q059. Portal 的 DOM 位置、React 树和事件传播是什么关系？

**口语化回答：** 我会这么回答：Portal 让子节点渲染到另一个 DOM 容器，但它在 React 树里仍是原来的子节点，所以 Context 仍能读取，React 事件也按 React 树传播。它适合 Modal、Tooltip 和全屏层，解决堆叠上下文和裁剪问题。

**原理追问：** Portal 不自动提供 Modal 行为，我还要处理焦点进入、焦点回归、Escape、背景不可交互、ARIA 标注和 Scroll Lock。DOM 上看似在 body 下，也不代表事件一定只按 DOM 祖先理解。

**容易踩坑：** 只把一个 div Portal 到 body 就叫可访问 Dialog 是不够的；背景仍可聚焦、Tab 跑出去、关闭后焦点丢失都属于缺陷。

**CodeWiki 连接：** Mermaid 全屏当前用 `createPortal` 到 `document.body`，带 `role="dialog"`、`aria-modal`、Escape 和关闭按钮聚焦；但完整 Focus Trap、背景 inert 和关闭后焦点恢复仍可继续加强。

### Q060. Concurrent Rendering 是什么，不是什么？

**口语化回答：** 我会说并发渲染是 React 能把 Render 工作分优先级、暂停、继续或放弃，让紧急交互不必等低优先级 Render 全做完。它不是 JavaScript 多线程，也不是所有更新自动并行；最终 Commit 仍要保持一致。

**原理追问：** 因为 Render 可能重启，组件函数、Memo 计算和 State Updater 都必须纯。并发能力需要通过 Transition、Suspense 或框架数据层等具体 API 使用，不能只升级 React 版本就说应用已经优化。

**容易踩坑：** 用并发掩盖 O(n²) 布局不能减少总 CPU；主线程被 ELK 或巨大 JS 循环占满时，React 也拿不到执行机会。重计算需要降复杂度、切片或 Worker。

**CodeWiki 连接：** CodeWiki 使用 React 19，但当前没有证据表明大量采用 Transition 或 Suspense 数据流。面试中我会说具备并发 Runtime 基础，不把“依赖版本”说成“功能已落地”。

### Q061. `useTransition` 适合解决什么问题？

**口语化回答：** 我用 Transition 把非紧急的 State 更新标成可中断后台更新，让输入、点击等紧急反馈先响应，并通过 `isPending` 给用户适度提示。它优化的是更新优先级，不会让网络更快，也不会把计算搬到 Worker。

**原理追问：** Transition 中的更新可能被更紧急更新打断；用于控制文本输入本身通常不合适，因为输入值需要同步。异步边界之后是否需要再次包装更新，要按当前 React API 语义和官方文档处理。

**容易踩坑：** 把每个 Set 都包 Transition 会让 UI 状态模糊，Pending 也可能闪烁。若一次 Render 仍占满主线程太久，调度收益有限。

**CodeWiki 连接：** 下一版切换大图筛选或社区层级时，可以把视觉图重建标成 Transition，让控制器立即响应；当前代码尚未使用 `useTransition`，我会把它作为待 Profile 的方案。

### Q062. `useDeferredValue` 和防抖有什么区别？

**口语化回答：** 我会先区分目标：`useDeferredValue` 让一部分 UI 可以滞后于最新值，React 会在后台尝试渲染；防抖是按时间延迟调用。Deferred 不会减少每次输入的网络请求，也没有固定毫秒语义，适合“输入立即显示、昂贵结果稍后跟上”。

**原理追问：** 当新值不断到来，后台 Render 可以被放弃并重来；我可以用旧值与新值不一致判断结果是否陈旧。网络搜索仍需防抖、缓存和取消，Deferred 只处理渲染优先级。

**容易踩坑：** 把 Deferred 当请求限流会造成每次仍发请求；把所有数据都 Deferred 又可能让用户看不懂当前筛选对应什么结果。

**CodeWiki 连接：** 文件树 Fuse 搜索未来若在大列表上变慢，可以让输入值立即更新、结果使用 Deferred Query；若计算本身很重还要预建索引或 Worker。当前规模未证明需要它。

### Q063. Suspense 的边界和 fallback 是怎么工作的？

**口语化回答：** 我会这样解释：Suspense Boundary 在子树等待受支持的异步资源或 Lazy Component 时显示 fallback，准备好后再揭示内容。它是一种声明式加载边界，不是给任意 `fetch` 加个 `throw Promise` 就完成生产数据层；通常要配合框架或支持 Suspense 的缓存。

**原理追问：** 边界位置决定用户看到的揭示粒度，可以嵌套；已经显示的内容因更新再次 Suspend 时，Transition 能帮助避免整块闪回 fallback。Suspense 不负责捕获普通 Error，那是 Error Boundary 的职责。

**容易踩坑：** fallback 放太高会整页闪白，放太碎会形成 Loading 噪声。自己造无缓存 Promise 会每次 Render 重启请求，必须有稳定资源身份。

**CodeWiki 连接：** 当前 CodeWiki 用显式 `loading/error/data` State，没有 Suspense 数据框架。Mermaid 动态 import 也由组件自己的 Effect 和 loading 文案处理，所以我不会把项目说成已采用 Suspense。

### Q064. Error Boundary 能捕获哪些错误，不能捕获哪些？

**口语化回答：** 我会先说边界：Error Boundary 能捕获其子树在 Render、生命周期以及相关构造过程中的错误，展示降级 UI 并上报；它通常捕获不了事件处理器、任意异步回调、服务端渲染自身错误，也不能捕获 Boundary 自己抛出的错误。函数组件当前常通过 Boundary 组件或库来承载这项能力。

**原理追问：** 我会按页面、重要 Widget 或第三方渲染区设置边界，错误后可用 Key 或 Reset API 重建子树。Boundary 是 UI 隔离，不取代 API 的 `try/catch` 和全局监控。

**容易踩坑：** 顶层只放一个 Boundary 会让一个 Mermaid 图拖垮整页；边界太细又可能把系统性错误切成许多无意义占位。Fallback 本身也要安全、可恢复。

**CodeWiki 连接：** 当前 Mermaid Render Promise 有本地 error State，但 React Render 错误没有专门 Error Boundary，`package.json` 也无相关测试。下一版我会至少隔离 Wiki Renderer 和 Graph Canvas。

### Q065. React 19 的 Actions 和 `useActionState` 怎么理解？

**口语化回答：** 我会把 Action 理解成围绕异步变更组织 Pending、Error、表单提交和结果更新的一套 React 19 模式。`useActionState` 接收 Action 和初始 State，返回当前 State、分发函数和 Pending 状态，适合表单或 Mutation，不等于把所有 API 调用都改成它。

**原理追问：** Action 可能和 `<form action>`、Transition 以及框架服务端函数配合；客户端仍要考虑幂等、校验、重试和并发提交。React 管 UI 状态，不会替后端提供事务语义。

**容易踩坑：** 我不会看到 React 19 就宣称项目用了 Server Actions；同名概念在具体框架里还有服务端约束。迁移前要确认当前 Vite SPA 和 FastAPI API 的边界。

**CodeWiki 连接：** 当前仓库创建、分析和 Wiki 生成使用普通事件处理器、Promise 与自定义 Store，没有 `useActionState`。下一版可先在仓库注册表单试点，但这是设计选项，不是现状。

### Q066. `useOptimistic` 什么时候适合，怎样回滚？

**口语化回答：** 当用户操作成功概率高、结果可预测，而且即时反馈明显改善体验时，我会用 `useOptimistic` 暂时显示预期结果；服务端确认后用真实数据收敛，失败则回到权威 State 并提示。它适合点赞、轻量编辑，不适合不可逆高风险动作随便乐观。

**原理追问：** 乐观项要有客户端临时 ID、Pending 标志和与服务端响应的合并规则；多个并发变更还要定义顺序、冲突和回滚粒度。后端幂等键可以避免重试产生重复副作用。

**容易踩坑：** 只在 UI 删除项目、失败后不知道插回哪里，或者服务端返回规范化结果却仍保留乐观副本，都会导致漂移。错误不能静默吞掉。

**CodeWiki 连接：** CodeWiki 的分析、Wiki 生成都属于长任务，不适合伪装成瞬间成功；当前明确显示 running 并轮询更稳。节点隐藏是纯本地视觉状态，倒不需要服务端乐观协议。

### Q067. React 19 的 `use` API、Server Component 和普通客户端请求是什么关系？

**口语化回答：** 我会这么区分：`use` 可以读取 Promise 或 Context，并与 Suspense/Error Boundary 协作；在支持的 Server Component/框架数据流里很有价值。但 Server Component 是架构和构建协议，不是安装 React 19 后 Vite SPA 自动具备。普通客户端 `fetch + Effect` 仍是另一条路径。

**原理追问：** Server Component 不发送其组件代码到客户端，可直接访问服务端资源，但交互组件需要 `'use client'` 边界；序列化、缓存和安全都由框架协议约束。FastAPI 返回 JSON 并不等价于 React Server Component Payload。

**容易踩坑：** 我不会把 React 的 `use` 和传统 Hook 顶层规则简单等同，也不会把服务端 Secret 通过 Client Bundle 暴露。具体采用前必须确认框架支持和部署模型。

**CodeWiki 连接：** CodeWiki 当前是 Vite 构建的客户端 SPA，由 FastAPI 提供静态资源和 REST API，没有 RSC。面试中我会讲清知识点，同时守住项目事实。

### Q068. Hydration 和 CodeWiki 当前客户端渲染有什么区别？

**口语化回答：** 我会先区分：Hydration 是浏览器在服务端已经生成的 HTML 上绑定 React 逻辑，并要求客户端首次输出与服务端标记匹配；纯客户端渲染则从 Root 开始在浏览器生成 UI。Hydration 能改善首屏和 SEO，但会引入一致性、流式和缓存部署问题。

**原理追问：** 时间、随机数、浏览器专属 API 和环境差异都可能造成 mismatch；我会把客户端专属逻辑放 Effect 或明确边界。SSR 还要防请求间共享全局 Store 导致串用户。

**容易踩坑：** `suppressHydrationWarning` 只能用于明确局部差异，不是全局消音器。SSR 也不等于 Server Component，两者可以组合但概念不同。

**CodeWiki 连接：** 当前 CodeWiki 通过 `createRoot` 做客户端渲染，不存在 Hydration。作为内部本地工作台，SSR 不是当前优先级；我不会为了技术新潮把它包装成下一版必做项。

## 四、状态管理、请求竞态与流式通信（Q069-Q079）

### Q069. Local State、Global State 和 Server State 怎么划分？

**口语化回答：** 我先按所有权分：只影响一个组件或小子树的交互放 Local State；跨页面共享的选择、权限或客户端工作流才考虑 Global State；来自后端、有缓存新鲜度和并发语义的数据属于 Server State。三者混在一个大 Store 里，失效、重试和重渲染都会变乱。

**原理追问：** Server State 通常需要 Query Key、缓存、去重、Stale Time、重试和失效；这些不是普通 Zustand Slice 天然提供的。是否引入 TanStack Query 等库，要看请求复杂度，不是项目用了 React 就必须上。

**容易踩坑：** 我不会把能派生的数据重复存到 Global Store，也不会让组件各自缓存同一个仓库列表而互相不一致。URL 代表可分享视图时，还应考虑把筛选或选中项放 URL。

**CodeWiki 连接：** 当前 CodeWiki 的仓库、Wiki、图响应由各 Hook 自己 Fetch，选中项和筛选是本地状态；还没有专门 Server-State Cache。下一版请求增多时，我会先统一 Query Key 和取消语义，再决定是否引库。

### Q070. Zustand 的核心模型是什么，为什么比较轻？

**口语化回答：** 我把 Zustand 的核心理解成一个独立 Store，提供 `getState`、`setState`、`subscribe`，React Hook 再按 Selector 订阅切片。它不要求 Provider 才能使用，Action 可以和 State 放一起，也可以用 Vanilla Store；轻量不等于没有设计成本。

**原理追问：** React 订阅外部 Store 必须保证快照一致，Zustand 在 React 层处理相应订阅；更新默认是浅层合并，嵌套对象仍要不可变更新。Middleware 可做 persist、devtools、selector subscribe，但每项都要理解生命周期。

**容易踩坑：** 我不会把整个 Store 一次选出来，任何变化都会重渲染；也不会从 `getState()` 读完就期待组件自动订阅。SSR 或多实例场景还要防全局 Store 泄漏状态。

**CodeWiki 连接：** CodeWiki 的 `package.json` 声明了 Zustand 5，但当前 `src` 没有实际 import。面试里我会说“依赖已引入、现状未采用”，再谈如果图状态跨页面共享时如何按 Slice 迁移。

### Q071. Zustand Selector、Equality Function 和 `useShallow` 为什么重要？

**口语化回答：** Selector 决定组件订阅 Store 的哪一部分；如果返回基本值，比较简单；如果每次返回新对象或数组，即使内容没变也可能重渲染。`useShallow` 或定制 Equality 能在适合的浅结构上稳定结果，但我会先让 Selector 尽量小而直接。

**原理追问：** 浅比较只比较第一层引用，嵌套内容原地修改反而可能漏更新；复杂 Equality 每次都执行，也有成本。最稳的方式通常是独立订阅字段、保持不可变更新、把重派生做 Memo 化 Selector。

**容易踩坑：** 我不会用深比较给不稳定 Store 兜底，也不会让 Selector 返回一个每次排序的新大数组。Action 引用和数据切片也可分别选择，降低变化范围。

**CodeWiki 连接：** 如果下一版把 Graph View 状态迁到 Zustand，我会让画布只订阅 nodes/edges，工具栏只订阅模式和计数，详情面板只订阅 selected id；当前尚未迁移，不能说已有 Selector 优化结果。

### Q072. `useSyncExternalStore` 解决了什么问题？

**口语化回答：** 我把它理解成 React 为外部可变数据源提供的标准订阅桥梁。组件给出 `subscribe` 和 `getSnapshot`，React 能在并发渲染和 Hydration 场景里更一致地读取快照，避免自己在 Effect 里订阅时出现撕裂或时序窗口。

**原理追问：** `getSnapshot` 在 Store 没变化时必须返回缓存过的同一快照，否则会无限重渲染；订阅函数也要稳定并正确取消。SSR 时还可提供 `getServerSnapshot`，它必须与 Hydration 初始数据一致。

**容易踩坑：** 外部 Store 更新了内部可变对象，却继续返回同一个引用，React 可能看不到变化；每次 `getSnapshot` 都构造新对象则相反。快照身份设计是关键。

**CodeWiki 连接：** Wiki 生成操作当前就是一个模块级 Map + Listener Set，通过 `useSyncExternalStore` 订阅；Snapshot 对象只有状态变化时替换，还会持久化到 Session Storage。这是当前真实实现，不是 Zustand。

### Q073. CodeWiki 当前前端状态管理应该怎样如实介绍？

**口语化回答：** 我会直接说：页面和图工作流主要用 `useState/useMemo/useCallback/useEffect` 加自定义 Hook；Wiki 长任务为了跨组件复用运行状态，做了一个很小的 External Store，并通过 `useSyncExternalStore` 接入。Zustand 在依赖里，但当前源码没有用它，所以不能说项目已经是 Zustand 架构。

**原理追问：** 这种现状适合当前本地工作台，因为大多数状态所有权清楚；问题是图控制器逐渐变重、Server State 缺统一缓存、模块级 Store 测试不足。只有这些复杂度真实增长时，我才会引入 Store 或 Query Library。

**容易踩坑：** 简历写了一个技术栈，不等于每个库都在核心链路；面试官一搜 import 就会发现。比起硬圆，我会讲选型边界和迁移触发条件。

**CodeWiki 连接：** 我的下一版候选方案是：Zustand 管跨 Graph/Ask 的客户端导航和高亮，Query 层管 API 数据，局部输入仍留组件内；但在代码落地和测试前只称方案。

### Q074. 如何处理切换参数导致的请求竞态？

**口语化回答：** 我会同时做三层保护：用 Query Key 标识请求属于哪个参数，用 AbortController 取消不再需要的请求，用 Request ID 或闭包失效保证只有最新结果提交。这样即使底层取消不及时，旧响应也不会覆盖新页面。

**原理追问：** 对缓存型请求不一定总要 abort，旧请求可以完成后写入自己的 Key 缓存，但不能写到当前 Key。写请求则要考虑重复提交、客户端超时后服务端成功等不确定状态，通常需要 Idempotency Key 和查询任务状态。

**容易踩坑：** 一个全局 `loading` boolean 无法表示多个并发请求；旧请求的 `finally` 还可能把新请求的 Loading 关掉。我会让 loading/error 归属具体 Key 或 Operation ID。

**CodeWiki 连接：** 当前 `useWikiData` 用 `selectedRepoId + language` 形成 wikiKey，并用 cancelled 阻止旧回写，但 Fetch 未 Abort；`useAsk` 还没有完整 latest-wins 设计。下一版应统一 API Signal 和 Operation ID。

### Q075. Loading、Error、Empty 和 Stale UI 应该怎么设计？

**口语化回答：** 我不会只用一个 Spinner 覆盖所有状态。首次加载、后台刷新、空数据、权限错误、可重试故障和保留旧数据时的 Stale 状态要分开；能保留已有结果时我通常保留，并给轻量刷新提示，减少页面闪烁。

**原理追问：** 状态可以用判别联合建模，错误里保留类别、状态码和可重试性。Retry 要有上限、退避和取消；Mutation 失败还要明确用户是否可以安全重试。

**容易踩坑：** 请求失败就把旧数据清空，会让临时网络故障变成空白页；反过来保留旧数据却不标 Stale，会让用户误以为是当前仓库结果。

**CodeWiki 连接：** 当前 Wiki Hook 在同一个 repo/language 刷新时会尽量保留内容，只在首载显示完整 Loading；但错误分类和 Stale 标识还比较简单，属于可改进点。

### Q076. 轮询怎样做才不造成重复请求和状态漂移？

**口语化回答：** 我会先让轮询只在任务 Running 时开启，卸载或结束时清理；下一次最好在上一次完成后调度，或至少防止请求重叠。间隔要退避并加 Jitter，页面隐藏时降频，服务端返回明确终态和更新时间。

**原理追问：** `setInterval` 不会等异步回调完成，慢请求可能叠加；递归 `setTimeout` 更容易“完成后再等”。多 Tab 还要考虑重复轮询，可用 BroadcastChannel 或服务端推送减少浪费。

**容易踩坑：** 只看前端 Promise 成功不代表后台生成完成；反过来刷新页面后也不能把运行中任务直接判失败。Operation ID、过期时间和后端状态查询要配合。

**CodeWiki 连接：** 当前 Wiki 页面在 `isGenerating` 时用固定 `setInterval(refresh)`，Cleanup 会清 Interval，Session Storage 快照有 30 分钟 Running TTL。下一版需要防重叠、退避和真实后端 Task ID。

### Q077. SSE 和普通轮询相比有什么特点？

**口语化回答：** 我会先说定位：SSE 是服务端通过一个 HTTP 长连接持续推送文本事件，浏览器 `EventSource` 原生支持事件 ID 和自动重连，适合任务进度、通知和 Token 流这类服务端单向流。它比轮询延迟低、重复请求少，但不是双向协议。

**原理追问：** 服务端用 `text/event-stream`，事件之间用空行分隔，可带 `id/event/data/retry`；断线后浏览器可通过 `Last-Event-ID` 续接。生产上还要处理代理缓冲、心跳、连接上限、认证、断线补偿和事件去重。

**容易踩坑：** 原生 `EventSource` 不能像普通 Fetch 那样随意加 Authorization Header，跨域 Cookie 和 CSRF 要谨慎；只实现自动重连却不保存可恢复事件，会丢中间进度。流式传输也需要背压或服务端有界缓冲。

**CodeWiki 连接：** CodeWiki 当前没有 SSE，Wiki 状态靠轮询，Ask 也是一次性 JSON 响应。下一版优先可以给 Wiki 进度做 SSE，但要先让后端任务拥有单调 Event ID 和可恢复状态，不能只改前端。

### Q078. WebSocket 和 SSE 怎么选？

**口语化回答：** 如果主要是服务端单向进度和文本流，我优先 SSE，部署和重连语义更贴近 HTTP；需要低延迟双向消息、协同编辑或客户端高频指令时才考虑 WebSocket。选择看通信方向、消息类型、代理环境和可靠性，不看哪个更“实时”。

**原理追问：** WebSocket 从 HTTP Upgrade 建连后使用自己的 Frame，应用层要自己定义消息版本、心跳、确认、重放、鉴权刷新和背压。SSE 是文本且单向，但天然带 Event ID，浏览器支持更直接。

**容易踩坑：** WebSocket 连接成功不等于消息可靠；断线期间数据、重复消息、乱序和横向扩容都要设计。也不能把数据库事务跨长连接保持住。

**CodeWiki 连接：** 当前 CodeWiki 没有多人协同或双向实时编辑，因此我不会为了 Wiki 进度直接上 WebSocket。若未来做协作图谱标注，双向协议才有更充分理由。

### Q079. 流式连接的重连、去重和背压怎么设计？

**口语化回答：** 我会给每条事件一个单调 ID 和业务 Operation ID，客户端记录最后确认位置，重连带 Cursor，收到重复 ID 就去重；服务端保留有限事件日志或能从任务状态重建快照。消费者慢时要限制队列，必要时合并进度事件或断开让它从快照恢复。

**原理追问：** Exactly-once 通常不是连接层白送的，我会实现 At-least-once 投递加幂等消费。重连采用指数退避和 Jitter，区分正常完成、鉴权失败、可重试网络错误；Token 流和业务状态事件也应分类型。

**容易踩坑：** 每个 Token 都触发一次 React Set State 会造成高频 Render，我会按帧或小批量 Flush；无限缓存断线消息会让服务端 OOM。客户端刷新后还要从权威任务快照恢复。

**CodeWiki 连接：** 下一版 Ask 若做流式回答，我会让后端发 `answer_delta/source_refs/final/error` 判别事件，前端批量合并文本，最终以 final 的引用集合为准。当前一次性 Ask 不具备这些语义。

## 五、性能、React Flow 与大图布局（Q080-Q089）

### Q080. React 页面性能应该按什么顺序排查？

**口语化回答：** 我先复现并定义指标，再用 React Profiler 看哪些组件 Render 慢、为什么 Render，用浏览器 Performance 看 JS、Layout、Paint 和 Long Task。确认瓶颈后再优化数据量、算法、组件边界或引用稳定，最后用同一场景复测，而不是先全局加 Memo。

**原理追问：** 我会区分启动、交互延迟、滚动帧率、内存和网络，它们不是一个指标。开发构建的性能和生产构建不同，Strict Mode 也会影响观察，所以最终要在接近生产的 Build 上测。

**容易踩坑：** Console 日志数量、React Render 次数和用户卡顿没有一一对应关系；一个组件 Render 很多次但很便宜可能没问题，ELK 一次 300ms 才是真瓶颈。

**CodeWiki 连接：** 我会为 CodeWiki 准备固定规模的仓库图，分别记录 API、builder、ELK、React Commit 和交互 INP；当前文档没有可信的前端性能基线，因此不编造毫秒数据。

### Q081. React Flow 为什么强调稳定的 `nodeTypes`、`edgeTypes` 和回调？

**口语化回答：** React Flow 接收大量配置、节点和事件 Props；如果每次 Render 都新建 `nodeTypes`、`edgeTypes` 或回调，库可能重复处理、子组件 Memo 也更容易失效。我会把静态类型表定义在组件外，把有依赖的回调用 `useCallback` 稳定。

**原理追问：** 引用稳定只是必要条件之一，节点 `data` 每次全量重建仍会让自定义节点更新。还要避免组件订阅整个 nodes 数组后只为了读一个选中状态，应该让状态粒度和 Render 边界匹配。

**容易踩坑：** `useCallback` 的依赖每次变化时函数还是会变；为了稳定写空依赖又可能拿旧状态。静态配置放模块级比无意义 Memo 更清楚。

**CodeWiki 连接：** 当前 `flowNodeTypes` 定义在模块顶层，自定义 `code/container` 节点用 `memo`；画布事件由 Controller `useCallback` 提供。这是已有优化，但节点数据稳定性仍要 Profile。

### Q082. React Flow 的 nodes/edges 更新怎样保持正确和高效？

**口语化回答：** 我会把 Node ID 当稳定身份，更新时只替换确实变化的 Node/Edge，没变对象保留引用；不能原地修改同一个对象后期待库识别。拖拽、选择和业务数据也尽量分层，避免一次交互重算所有拓扑。

**原理追问：** 对可编辑 Flow 可以用库提供的 Change Helper 或受控 State；只读图则可以让后端事实图、视觉图和交互覆盖层分开。选择态最好不要污染每个 Raw Node 后触发全量转换，规模大时可由 Store Selector 或 CSS/Overlay 处理。

**容易踩坑：** 每次选节点都重新 Layout 会让位置跳动且成本高；用数组 Index 当 Node ID 会在过滤后错配。边的 source/target 必须引用仍可见的稳定 ID。

**CodeWiki 连接：** CodeWiki 当前先构建 Base Visual Graph，再应用 Hidden、Selected、Ask Highlight 视觉状态，选择本身不重新跑 ELK；但 `applyVisualState` 仍遍历全量 nodes/edges，下一版可做邻接索引和局部更新。

### Q083. “虚拟化大图”为什么比虚拟化列表更难？

**口语化回答：** 列表通常是一维、每项高度可估，视口外项可以直接不挂载；图有任意坐标、跨视口边、缩放、选中和布局依赖，隐藏节点还可能影响边和聚合，所以不能简单套 `react-window`。我会先做 Level of Detail 和按视口裁剪，再验证交互正确性。

**原理追问：** 视口裁剪需要空间索引快速找可见节点，边可只画至少一端可见或与视口相交的部分；缩放较小时显示社区/目录聚合，放大后再展开文件和符号。React Flow 也提供只渲染可见元素等能力，但开启前要评估计算和边界开销。

**容易踩坑：** 只隐藏 DOM 不减少 Layout 和数据转换成本；过滤节点却不处理关联边会产生悬空引用。MiniMap、FitView 和键盘导航也要适配裁剪后的图。

**CodeWiki 连接：** CodeWiki 当前已经按 Overview、Focus、File Detail、Container Drilldown 构建不同层次，而不是一次展示全仓全部符号，这本身是 LOD；当前没有通用视口虚拟化，不能说已经解决超大图。

### Q084. ELK 的 Layered Layout 适合什么图，关键参数怎么讲？

**口语化回答：** Layered Layout 适合有方向的依赖和流程图，大致经过分层、节点排序、坐标分配和边路由，让主方向清楚并尽量减少交叉。我会根据 LR/TB 设置方向，用 Node/Layer/Edge Spacing 控密度，用 Orthogonal Routing 增强可读性。

**原理追问：** 布局质量、速度和稳定性通常互相取舍；有环图需要内部处理 Cycle，Compound Node 和 Port Constraint 又会增加复杂度。参数不是凭审美拍脑袋，我会用代表性图集比较交叉数、面积、耗时和位置稳定性。

**容易踩坑：** ELK 不知道业务上哪条边更重要，全部平权会让噪声边主导布局；节点宽高不准确也会重叠。布局失败必须有可预测降级。

**CodeWiki 连接：** 当前 CodeWiki 用 ELK Layered、LR/TB、Orthogonal Routing 和 Merge Edges，输入固定 Node Size；异常时回退成稳定线性布局。这些是源码可证明的现状。

### Q085. 为什么要把 ELK 放到 Web Worker，具体怎么设计？

**口语化回答：** 当布局 CPU 时间足以形成 Long Task 时，我会把纯布局计算放 Worker，让主线程继续处理输入和绘制。主线程发送可结构化克隆的精简 Nodes、Edges、Options，Worker 返回 Position Map；每次请求带 layoutVersion，旧结果到达就丢弃。

**原理追问：** Worker 和主线程不共享 DOM，数据传输也有序列化成本；超大数组可评估 Transferable，但普通对象仍会 Clone。要支持取消，可以终止 Worker、发取消消息或只忽略旧 Version；真正中断 ELK 内部计算取决于库能力。

**容易踩坑：** 把整个 React Node 对象和函数传 Worker 会 Clone 失败；每次小交互都新建 Worker 也有启动成本。我会复用 Worker、限制并发，并在失败时回退当前主线程或稳定布局。

**CodeWiki 连接：** 当前 `elkjs/lib/elk.bundled.js` 在前端主线程实例化，没有 Worker 文件。下一版只有在 Trace 证明布局阻塞后才迁移，届时保持现有 Layout Cache Key 和 fallback 语义。

### Q086. 图布局缓存怎么做，怎样避免内存和错误复用？

**口语化回答：** 我会先定义 Key：它必须包含影响结果的 Scope、节点 ID 与尺寸、边、方向和 Options；返回值最好复制或按不可变方式使用，避免调用方改坏缓存。缓存还要有容量、TTL 或 LRU，并在算法版本变化时失效。

**原理追问：** Key 排序可消除输入数组顺序的无意义差异，但构造和 Hash 大图本身也有成本；可以上游维护 Graph Revision。缓存命中优化重复布局，不解决第一次大图计算，也不能跨错误版本盲目持久化。

**容易踩坑：** Key 漏掉 Node Size 会复用重叠位置；无限 Map 会在长会话泄漏；直接返回缓存 Map 后被修改会污染后续视图。

**CodeWiki 连接：** 当前 `layoutBoxesCached` 的 Key 已包含 Scope、排序后的 Node 尺寸、Edge、Direction 和 Options，命中时 Clone，最多保留 128 项。淘汰是最旧插入项，不是严格访问型 LRU，我会如实区分。

### Q087. 增量布局怎样保留用户的“心理地图”？

**口语化回答：** 用户已经看懂一张图后，小更新不应该让所有节点换位置。我会固定未变化节点或给它们位置偏好，只布局新增局部，再做碰撞消解；必要时提供“保持位置”和“重新整理”两个动作，让用户掌控。

**原理追问：** 稳定性可能牺牲全局最优交叉数，所以我会定义位移成本与布局质量的权重。Graph Revision 和稳定 Node ID 是增量布局前提，手工拖拽位置还应作为约束持久化。

**容易踩坑：** 每次 Filter 都重新 FitView 会让用户失去位置；只冻结旧节点又可能把新增节点挤在一起。不同视图层级的坐标不一定能直接复用。

**CodeWiki 连接：** CodeWiki 当前节点 ID 稳定、相同图输入可命中布局缓存，但视图 `flowKey` 变化会重建并 FitView，还没有用户位置持久化或真正增量布局。下一版才讨论 Mental Map 约束。

### Q088. 超大代码图怎样做聚合、筛选和按需下钻？

**口语化回答：** 我不会把十万符号一次画出来。入口先显示社区或目录级节点和关键跨模块边，用户按文件、容器、调用链或搜索下钻；低置信和低价值边默认隐藏，密度模式控制信息量。每层都保留回到源码和原始 Node ID 的映射。

**原理追问：** 聚合边要说明它代表多少底层边、哪些类型和置信分布；下钻需要 Breadcrumb 和可逆导航。服务端最好按视图 Query 返回子图，避免前端先下载全图再隐藏。

**容易踩坑：** 聚合只为了性能却丢语义，会让图变成不可解释的气泡；前端过滤不减少网络和 Parse 成本。默认阈值也要在真实任务上评估。

**CodeWiki 连接：** 当前已经有 Overview、Focus、File Detail、Container Drilldown、Community Level 和 Readable/Full Density，多层 Builder 保留 Raw Node IDs。下一步是服务端分页/子图查询，而不是继续在浏览器堆全量数据。

### Q089. Fuse.js 搜索和大列表性能怎么平衡？

**口语化回答：** Fuse 适合本地中小规模模糊搜索，我会控制 Keys、Threshold 和结果数，并避免每次按键重复构建 Index。数据更大时先测构建和查询成本，可复用 Index、放 Worker，或改成服务端/专用索引；精确 ID 和路径还应优先走直接匹配。

**原理追问：** 模糊分数不是业务相关性真理，字段权重、Location、最短匹配长度都会影响结果。搜索还要处理大小写、路径分隔符、中文和高亮位置，不能只看能搜到。

**容易踩坑：** 当前包装器每次调用会 `new Fuse(items, ...)`，输入每变一次都重建；列表很大时这是明确候选瓶颈。防抖只能减少次数，不能降低单次建索引成本。

**CodeWiki 连接：** CodeWiki 当前仓库和文件树通过 `fuzzySearch` 每次构建 Fuse，Threshold 分别配置；这是规模可控下的简单实现。下一版是否缓存 Index 要用真实仓库规模 Profile 决定。

## 六、安全、可访问性、测试与构建部署（Q090-Q100）

### Q090. Markdown 渲染为什么会有 XSS 风险，应该怎么防？

**口语化回答：** Markdown 最终会变成 HTML/React Element，内容如果来自仓库或 LLM，我一律按不可信输入处理。默认不允许原始 HTML，链接协议做 Allowlist，自定义组件不直接拼 HTML；若业务必须支持 HTML，就用成熟 Sanitizer 且严格配置标签、属性和 URL。

**原理追问：** XSS 不只来自 `<script>`，还可能来自事件属性、`javascript:` URL、危险 SVG、Style、Iframe 和解析器组合差异。输入转义、输出编码、Sanitize 和 CSP 各解决不同层，不能相互替代。

**容易踩坑：** 先 Sanitize 后又用字符串替换拼回未转义内容，会重新引入漏洞；Markdown Safe 也不代表其中 Mermaid 或导出 HTML Safe。我会给每个 Renderer 单独定义信任边界。

**CodeWiki 连接：** 当前 Wiki 使用 `react-markdown + remark-gfm`，没有启用 `rehype-raw`，原始 HTML 默认不会直接执行；内部 Wiki Link 和 External Link 有自定义处理。下一版仍应补恶意 Markdown 回归集和显式 URL Allowlist 验证。

### Q091. Mermaid 为什么仍可能有 XSS 风险，`securityLevel: strict` 够不够？

**口语化回答：** Mermaid 接收的是一门可表达节点文本、链接和交互的 DSL，输出又是 SVG，所以它是独立的内容执行边界。`securityLevel: "strict"` 会编码 HTML 标签并禁用一部分点击能力，是重要保护；但我仍会限制输入规模、使用固定配置、及时升级依赖，并把最终 SVG 当不可信产物审视。

**原理追问：** `dangerouslySetInnerHTML` 本身不自动危险，危险来自我把什么字符串交给它；React 不会再转义那段 SVG。服务端语法 Parse 只证明 Mermaid 语法成立，不证明没有安全 Payload，前后端库版本差异也要考虑。

**容易踩坑：** 我不会因为图由 LLM 生成或服务端验证过就默认可信，也不会把 Mermaid 的 `loose` 模式用于内部代码内容。CSP 是额外防线，不代替 Library Sanitization。

**CodeWiki 连接：** 当前 `MermaidBlock` 明确设置 `securityLevel: "strict"`，动态加载 Mermaid 后把返回 SVG 用 `dangerouslySetInnerHTML` 插入；服务端还做语法校验。下一版应加恶意 DSL 测试、SVG Sanitize 评估和资源预算。

### Q092. Markdown 链接、`target="_blank"` 和 URL 协议怎样处理？

**口语化回答：** 我只允许业务需要的协议，例如 `https/http` 和受控内部 Scheme；相对 Wiki Link 要解析成明确 Slug，不让任意字符串进入导航。新窗口链接至少加 `rel="noreferrer"` 或 `noopener`，避免新页面拿到 opener，也减少 Referrer 泄漏。

**原理追问：** URL 校验应使用 URL Parser 和明确 Base，而不是只做 `startsWith` 后就认为安全；大小写、空白、编码和协议相对 URL 都会绕过幼稚判断。下载文件名和导出路径还要防目录穿越与公式/HTML 注入。

**容易踩坑：** React 会转义文本，不代表 `href` 业务上合法；`source-link` 这种哨兵值也必须在组件内截获，不能最终落成可点击未知链接。

**CodeWiki 连接：** 当前外链会开新窗口并设置 `noreferrer`，Wiki 内链被转换成页内选择，`source-link` 只显示文本；不过自定义代码主要用前缀识别，下一版可统一成 URL/Scheme Allowlist Helper 并测试编码绕过。

### Q093. CSP 能给这类内部前端提供什么保护？

**口语化回答：** CSP 是浏览器侧的最后一道执行限制。我会尽量设置 `default-src 'self'`，细分 script/style/img/connect/font，关闭 `object-src`，限制 `base-uri` 和 `frame-ancestors`；有条件时用 Nonce/Hash 和 Trusted Types，减少某处漏 Sanitization 后的利用面。

**原理追问：** Mermaid SVG、内联 Style、Vite 资源和未来 SSE/WebSocket 都会影响策略，`connect-src` 要明确；先用 Report-Only 收集违例，再收紧。CSP Header 应由实际提供 HTML 的 FastAPI 或反向代理设置，而不是 Meta 随便补全。

**容易踩坑：** `unsafe-inline`、`unsafe-eval` 会显著削弱策略；只写 `default-src` 也可能误伤资源或留下空洞。我不会把 CSP 当 XSS 修复本身。

**CodeWiki 连接：** 当前 FastAPI 入口只看到 CORS 配置，没有可证明的 CSP/Security Header Middleware。下一版部署前应补 Header、Report 流程和 Mermaid/Vite 兼容测试，不能说现在已经有。

### Q094. 做前端可访问性时，最优先检查什么？

**口语化回答：** 我先保证语义元素、键盘可操作、可见焦点、表单 Label、状态公告、颜色对比和合理标题层级。能用原生 Button、Link、Input 就不用带 Click 的 div；图这种视觉内容还要给出列表、搜索或详情等替代路径。

**原理追问：** ARIA 只能补充语义，不能自动补键盘行为。动态状态可用合适的 `aria-live`，但不能每次细小进度都打断屏幕阅读器；缩放和响应式也要保证 200% 下内容不重叠。

**容易踩坑：** 只有 `aria-label` 不代表组件可访问；如果元素不能 Tab、没有 Enter/Space 行为或焦点不可见，仍然失败。图节点只靠颜色区分类型也不够。

**CodeWiki 连接：** 当前工具栏、文件树、按钮和图控制已有不少 `aria-label/aria-current/aria-live`，侧栏 Resize 也支持键盘；但 React Flow 自定义图节点的完整键盘下钻和非视觉等价视图仍需专项审计。

### Q095. Modal/全屏图的焦点管理怎么做才完整？

**口语化回答：** 打开时我把焦点移到 Dialog 内合适元素，Tab/Shift+Tab 限制在对话框，Escape 可关闭；背景内容设为不可交互，关闭后焦点还给触发按钮。Dialog 要有可感知名称，危险动作不能默认聚焦。

**原理追问：** Portal 只是换 DOM 容器，Focus Trap 和 `inert` 需要我或成熟 Dialog Library 实现。嵌套 Dialog、触发元素被删除、页面滚动锁和手机屏幕阅读器都要覆盖。

**容易踩坑：** 只给 `role="dialog" aria-modal="true"` 而背景仍能 Tab，不是完整实现；只监听 Escape 又忘记 Cleanup 会累积监听器。

**CodeWiki 连接：** Mermaid 全屏当前会聚焦关闭按钮、支持 Escape、有 Dialog 语义并 Portal 到 Body；尚未实现完整焦点循环、背景 inert 和焦点回归。面试时我会把已做与待做分开。

### Q096. CodeWiki 前端测试金字塔应该怎样设计？

**口语化回答：** 我会把纯函数单测放底层，例如过滤、分组、Source Navigation、Markdown Normalize、布局 Cache Key；组件测试覆盖用户可见行为和无障碍查询；少量集成/E2E 覆盖 Repos→Analyze→Graph→Wiki→Ask 主路径。数量不是目标，风险覆盖才是。

**原理追问：** 测试按外部行为断言，不绑内部 State 和 Hook 调用次数；网络用可控 Mock Server 保留真实 Request/Response 形状。ELK、Mermaid 和 React Flow 可在单元层隔离，在少量浏览器测试里验证真实集成。

**容易踩坑：** Snapshot 整页 HTML 很容易变成无人审查的噪声；只测纯函数又覆盖不了焦点、滚动、Canvas/SVG 和浏览器时序。测试环境与真实浏览器职责要分清。

**CodeWiki 连接：** 当前前端没有 Test Script，也没找到 Vitest/Playwright/Testing Library 测试文件；后端测试多不能替代前端。以上是应该补的体系，不是现有覆盖率。

### Q097. 请求取消、竞态、轮询和 Timer 应该怎么测试？

**口语化回答：** 我会构造可控 Deferred Promise：先发 A 再发 B，让 B 先返回，断言界面最终还是 B；切仓库或卸载时断言 Signal 被 Abort，AbortError 不展示成故障。轮询用 Fake Timer 推进，并断言结束、错误和卸载后不再请求。

**原理追问：** `act` 只保证 React 更新被正确 Flush，不替我定义异步顺序。对 Strict Mode 还要验证 Setup/Cleanup 对称；对重复点击验证同 Operation Key 去重，对过期 Session Snapshot 验证恢复为错误状态。

**容易踩坑：** `runAllTimers` 遇到递归 Timer 可能无限跑；只 Mock `fetch` 成立即 resolve 永远测不出竞态。测试后必须恢复 Timer 和清理 Listener，避免用例互相污染。

**CodeWiki 连接：** 我会优先给 `useWikiData` 的旧响应、Wiki 轮询 Cleanup、External Store TTL/去重和 `useVisualGraph` 的旧布局回写补测试，因为这些是当前源码里最直接的异步风险。

### Q098. 图谱、Mermaid 和可访问性如何做浏览器级测试？

**口语化回答：** 我会在真实浏览器装载固定 Fixture 图，验证节点数量、关键 Label、点击下钻、筛选、Ask 高亮、缩放和全屏关闭；Mermaid 验证 SVG 非空、错误图有降级、恶意图不执行脚本。再跑自动 A11y Scan，并用键盘完整走一遍主路径。

**原理追问：** 像素截图适合发现布局回归，但要固定 Viewport、字体、动画和数据，且只对关键区域做容差比较；功能断言仍以 DOM、ARIA 和业务状态为主。大图还要做性能预算测试而非只看截图。

**容易踩坑：** JSDOM 没有真实 Layout、ResizeObserver 和 SVG 渲染，不能证明 React Flow/ELK 视觉正确；截图全量更新也可能把真正重叠问题批准掉。

**CodeWiki 连接：** 下一版我会用 Playwright 建三套代表图：小图功能、大图性能、恶意 Wiki 安全，并覆盖桌面与窄屏。当前没有这套 E2E 资产，所以不会声称已经验证。

### Q099. Vite 的环境变量和生产构建有哪些安全边界？

**口语化回答：** 我会先明确安全边界：Vite 会把客户端可见环境变量打进 Bundle，默认 `VITE_` 前缀只是暴露约定，不是 Secret Vault；任何进前端的 Key 用户都能看到。Secret 必须留在 FastAPI/模型网关，前端只拿必要的公开配置和短期权限。

**原理追问：** `vite build` 生成带 Hash 的静态 Asset，HTML 通常不应长期缓存，Hash Asset 可长期 immutable；部署要保证 HTML 和 Chunk 版本一致。Source Map 是否发布、Base Path、动态 Import 失败和旧缓存都要设计。

**容易踩坑：** `.env.production` 不等于保密，`import.meta.env` 引用会被静态替换；把 Provider API Key 放进去就是泄漏。开发 Proxy 只服务本地开发，不代表生产跨域配置。

**CodeWiki 连接：** 当前 Vite Dev Server 把 `/api` 代理到 `127.0.0.1:8000`，Build 输出到 `backend/app/static`，由 FastAPI 挂载；当前没证据表明前端持有模型 Secret，这个边界应继续保持。

### Q100. 如何把 CodeWiki 前端做成可回滚、可观测的生产交付？

**口语化回答：** 我会建立 `lint → typecheck → unit/component test → build → E2E/security smoke` 门禁，产物带版本和 Commit 标识；先灰度或在内部环境验证，出现错误率、白屏、INP 或核心流程异常就回滚到上一份前后端兼容制品。发布和数据库/接口版本要有兼容窗口。

**原理追问：** 前端观测至少有 JS Error、Unhandled Rejection、资源加载失败、API 延迟/状态、Web Vitals 和业务步骤成功率，并通过 Request/Trace ID 和后端关联。Source Map 上传到受控错误平台，不必公开；告警要有基线和采样。

**容易踩坑：** Build 成功不等于可发布；静态 Asset 回滚了但 API 已 Breaking Change，仍会故障。也不能在没有真实数据时编造覆盖率、SLA 或“零线上事故”。

**CodeWiki 连接：** 当前可证明的前端命令只有 `dev/build/lint`，没有 Test Script、前端观测和完整安全 Header；`build` 会把静态文件写进 FastAPI 目录。我的回答会把这条现状说清，再把上面作为下一版交付清单。

## 官方资料来源

> 联网核对日期：2026-07-17。版本表述以 CodeWiki 当前依赖清单为准；下面资料用于核对语言与框架机制，不代表项目已经采用其中全部能力。

### JavaScript 与浏览器

- [MDN: JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model)
- [MDN: Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures)
- [MDN: `this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)
- [MDN: Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN: WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

### TypeScript

- [TypeScript Handbook: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript Handbook: Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Handbook: Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
- [TypeScript Handbook: Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [TypeScript Handbook: Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)
- [TypeScript TSConfig: Strict](https://www.typescriptlang.org/tsconfig/strict.html)

### React 19

- [React: Render and Commit](https://react.dev/learn/render-and-commit)
- [React: State as a Snapshot](https://react.dev/learn/state-as-a-snapshot)
- [React: Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates)
- [React: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [React: Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects)
- [React: `memo`](https://react.dev/reference/react/memo)
- [React: `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
- [React: `useTransition`](https://react.dev/reference/react/useTransition)
- [React: Suspense](https://react.dev/reference/react/Suspense)
- [React: Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [React 19 release](https://react.dev/blog/2024/12/05/react-19)
- [React: `useActionState`](https://react.dev/reference/react/useActionState)
- [React: `useOptimistic`](https://react.dev/reference/react/useOptimistic)
- [React: `use`](https://react.dev/reference/react/use)

### 状态、图布局与渲染

- [Zustand: Introduction](https://zustand.docs.pmnd.rs/learn/getting-started/introduction)
- [Zustand: Prevent rerenders with `useShallow`](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow)
- [React Flow: Performance](https://reactflow.dev/learn/advanced-use/performance)
- [React Flow: Layouting](https://reactflow.dev/learn/layouting/layouting)
- [React Flow: Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [Eclipse Layout Kernel: Layered algorithm](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)
- [ELK.js official repository](https://github.com/kieler/elkjs)
- [Fuse.js official documentation](https://www.fusejs.io/)
- [Mermaid: Configuration and security level](https://mermaid.js.org/config/usage.html)
- [react-markdown documentation](https://github.com/remarkjs/react-markdown)

### 安全、可访问性、测试与构建

- [OWASP: Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP: Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [WAI-ARIA APG: Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [W3C WCAG: Keyboard Accessible](https://www.w3.org/WAI/WCAG22/Understanding/keyboard-accessible)
- [Testing Library: Guiding Principles](https://testing-library.com/docs/guiding-principles/)
- [Vitest Guide](https://vitest.dev/guide/)
- [Playwright Test](https://playwright.dev/docs/intro)
- [Vite: Building for Production](https://vite.dev/guide/build.html)
- [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode.html)
