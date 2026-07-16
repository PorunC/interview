# Java 源码与中间件生产化面试题

> **定位与事实边界**：这是一份面向 Java 后端二面、三面和架构面的专项题库，重点不是背结论，而是把源码状态机、中间件故障语义和并发不变量讲清楚。当前三个公司内部项目的材料不能证明它们已经在线上使用了本题库中的全部 Java、MySQL、Redis 或 Kafka 方案，所以我在面试时会明确区分：通用知识、我做过的本地验证或故障演练、迁移设计，以及有内部记录能证明的真实生产经历。
>
> 全文都用第一人口语化表达。凡是排障题，我只把步骤说成知识和演练方法，不把假设场景包装成本人事故；凡是源码题，我按“入口方法 -> 关键字段或状态 -> 主要分支 -> 并发与可见性 -> JDK/框架版本边界”展开；凡是手写题，我会给出足够完整的代码、复杂度、并发不变量和边界测试。

## 一、Java 与 JUC 源码（Q001-Q025）

### Q001：`HashMap.put()` 从入口到落桶，源码主链路怎么走？

> **口语化回答：** 我会从 `put()` 进入 `putVal()` 讲。先对 key 的原始 hash 做高低位扰动，再用 `(n - 1) & hash` 定位桶；表还没初始化就先 `resize()`。空桶直接放新节点，非空桶依次处理同 key 覆盖、红黑树插入和链表尾插，最后更新 `modCount`、`size`，超过阈值再扩容。
>
> **深入追问：** 关键状态是 `table`、`size`、`threshold`、`loadFactor` 和 `modCount`。定位能用位运算，是因为容量保持 2 的幂；同 key 判断顺序是 hash 相同，再比较引用或 `equals()`。它没有同步和可见性保证，并发写可能丢更新，所以我不会把“源码里暂时没形成死循环”误说成并发可用。
>
> **易错点：** 我不会把 `HashMap` 说成插入时总在链表头，Java 8 的冲突节点通常尾插；也不会说阈值一到必然树化，树化还要求容量达到 `MIN_TREEIFY_CAPACITY`。具体字段和阈值要以目标 JDK 源码为准。

### Q002：`HashMap.resize()` 为什么能用一位判断新位置？树化和退化阈值是什么关系？

> **口语化回答：** 我会先说容量翻倍后，旧节点的新索引只可能是原索引，或者原索引加旧容量。因为新容量只多出一个高位，`hash & oldCap` 的结果只可能是 `0` 或 `oldCap`；前者留在原索引，后者移动到“原索引加旧容量”，不需要重新计算完整索引。
>
> **深入追问：** 扩容入口是 `resize()`，关键状态是 `oldTab`、`oldCap`、`oldThr`、`newCap`、`newThr`。链表达到 8 个节点只是候选树化，数组容量小于 64 时优先扩容；树节点较少时可能退回链表。8 和 6 留出滞回区，避免在边界附近频繁树化、退化。
>
> **易错点：** 我不会死背“8 就变树、6 就变链表”而漏掉容量条件，也不会把扩容说成完全无成本。迁移是 O(n)，容量预估不当会带来抖动；并发扩容仍然没有安全保证。

### Q003：`ConcurrentHashMap.putVal()` 怎么做到空桶 CAS、冲突桶加锁？

> **口语化回答：** 我会从 `put()` 进入 `putVal()`。表为空先 `initTable()`；定位到空桶时用 CAS 放节点，成功就不用锁；如果桶头 hash 是 `MOVED`，说明正在扩容，我会进入 `helpTransfer()`；普通冲突桶则对桶头对象 `synchronized`，再次确认桶头没变后，在链表或树里插入。
>
> **深入追问：** 关键状态包括 `table`、`sizeCtl`、桶头节点、`MOVED` 标记和计数槽。读路径主要依赖节点字段和数组元素的可见性，不为普通 `get()` 加全局锁；写路径把竞争限制在桶级。完成插入后调用 `addCount()`，它还可能触发扩容。
>
> **易错点：** 我不会再讲 Java 7 的 `Segment` 结构，也不会把“锁桶头”说成任何时候都绝对安全，源码会先验证 `tabAt(tab, i) == f`。`compute` 一类原子 API 的用户函数也不应做慢 IO 或递归更新同一映射。

### Q004：`ConcurrentHashMap` 多线程扩容时，`ForwardingNode` 和 `helpTransfer()` 怎么配合？

> **口语化回答：** 我会把扩容讲成协作迁移。一个线程创建 `nextTable` 后，通过 `transferIndex` 领取一段桶区间；迁完一个桶，就在旧表对应位置放 `ForwardingNode`。其他线程看到桶头 hash 为 `MOVED`，不会继续往旧桶写，而是通过 `helpTransfer()` 加入迁移，或者沿 forwarding node 去新表查。
>
> **深入追问：** 关键状态是 `sizeCtl` 中编码的扩容戳和参与迁移线程数、`transferIndex`、`nextTable`。桶迁移仍按 low/high 两组拆分；CAS 领取区间避免所有线程重复搬运。最后一个迁移线程负责把 `table` 切到新表并更新阈值，可见性依赖 volatile/CAS 语义。
>
> **易错点：** 我不会说扩容期间所有请求停顿，也不会说绝对无锁；冲突桶迁移仍会同步。扩容细节在不同 JDK 维护版本可能调整，面试时我会以 Java 8 之后的主机制为边界，不背行号。

### Q005：`ConcurrentHashMap.size()` 为什么不是简单读一个整数？`CounterCell` 怎么降低竞争？

> **口语化回答：** 我会说高并发写下，所有线程 CAS 同一个计数器会形成热点，所以它用 `baseCount` 加一组 `CounterCell` 分散更新。`size()` 或 `mappingCount()` 再把这些值求和，得到的是适合监控和容量判断的近似瞬时视图，不是和所有并发写线性化的一张快照。
>
> **深入追问：** 入口主要在 `addCount()` 和 `sumCount()`。低竞争先 CAS `baseCount`，失败后按线程探针落到某个 `CounterCell.value`，冲突严重时扩槽。单元格值用 volatile/CAS 保证可见更新，思想和 `LongAdder` 相近。
>
> **易错点：** 我不会用 `size()` 决定“如果小于 N 就插入”这种复合不变量，也不会把求和结果说成事务级精确值。超大映射还要注意 `size()` 的 int 上限，计数语义优先看 `mappingCount()`。

### Q006：`ArrayList.add()` 和 `grow()` 的源码路径是什么？为什么扩容倍数不能当接口契约？

> **口语化回答：** 我会从 `add()` 先检查现有数组是否够用，不够就进入 `grow()`，计算一个更大的容量，再用数组复制迁移旧元素。常见实现倾向增长到原来的 1.5 倍左右，这是在复制成本和空间浪费之间取平衡。
>
> **深入追问：** 关键状态是 `elementData` 和 `size`；结构修改会更新 `modCount`，迭代器据此做 fail-fast 检查。扩容后新数组引用被当前线程看到没有问题，但 `ArrayList` 本身没有跨线程安全发布和并发修改保证。
>
> **易错点：** 我不会把“每次严格 1.5 倍”当 Java API 规范，也不会把 `ensureCapacity()` 说成一定提升所有场景性能。已知规模时预分配有价值，但过大预分配会浪费堆。

### Q007：`CopyOnWriteArrayList` 的写时复制、快照迭代和内存可见性怎么实现？

> **口语化回答：** 我会从 `add()` 讲：写线程先拿写锁，复制当前数组，在副本上改完，再一次性发布新数组。读线程直接读当前数组，不需要跟写线程争同一把锁；迭代器保存创建时的数组引用，所以遍历的是稳定快照。
>
> **深入追问：** 关键状态是被 volatile 语义发布的数组引用和写锁。写锁保证多个写者串行，数组引用替换保证后续读者看见完整新快照；旧迭代器仍然持有旧数组，不会看到增量更新，也不支持迭代器修改。
>
> **易错点：** 我不会只说“读无锁所以快”而忽略每次写 O(n) 复制、旧快照滞留和 GC 压力。它只适合小规模、读远多于写的监听器或配置列表，不适合任务队列。

### Q008：`ThreadLocalMap` 为什么 key 用弱引用仍可能泄漏？清理入口在哪里？

> **口语化回答：** 我会说每个线程持有自己的 `ThreadLocalMap`，Entry 的 key 是 `ThreadLocal` 弱引用，但 value 是强引用。key 被 GC 后只会变成 null，value 不会自动从 map 消失；线程池里的线程寿命很长，value 就可能一直被线程间接持有。
>
> **深入追问：** 入口是 `ThreadLocal.get/set/remove()`，定位采用开放寻址。源码在访问时会通过 `expungeStaleEntry`、`cleanSomeSlots` 等顺带清理陈旧 Entry，但这不是及时回收保证。跨线程可见性不是它的目标，异步切线程也不会自动传播值。
>
> **易错点：** 我不会因为 key 是弱引用就说“不会泄漏”。业务使用必须在统一入口设置、`finally` 里 `remove()`；`InheritableThreadLocal` 也不能正确解决线程池复用和任务上下文隔离。

### Q009：`synchronized` 从字节码到 Monitor 的主路径怎么讲？

> **口语化回答：** 我会先区分同步方法和同步块。同步方法在方法标志上体现，代码块会生成 `monitorenter` 和 `monitorexit`，异常路径也必须释放 Monitor。线程进入临界区前获取同一个对象的监视器，退出时释放，既提供互斥，也建立 happens-before 可见性。
>
> **深入追问：** 关键状态和对象头、Monitor 所有者、重入计数、Entry/Wait 集合有关。实际 JVM 会根据竞争、对象状态和版本使用不同优化路径，不能把某一版 HotSpot 的锁标记位图当永久规范。`wait()` 会释放 Monitor，`sleep()` 不会。
>
> **易错点：** 我不会继续背“偏向锁一定按固定阶段升级且永不降级”这种过时模板；现代 JDK 的实现已有变化。业务上真正要证明的是锁对象一致、临界区覆盖完整不变量，并避免持锁做慢 IO。

### Q010：`volatile` 在源码和 JMM 层面怎么保证可见性与有序性？

> **口语化回答：** 我会说 volatile 读写不是简单“每次都去主内存”这句话，而是 JMM 给它定义了同步顺序：对一个 volatile 变量的写 happens-before 后续对它的读。JIT 和 CPU 要通过相应内存屏障或有序指令满足这个语义。
>
> **深入追问：** 源码层我关注字段是否声明 volatile，以及 CAS/VarHandle 操作采用哪种访问模式。volatile 能安全发布一个已经构造好的不可变快照引用，但不能让 `count++` 原子，也不能自动维护多个字段的联合不变量。
>
> **易错点：** 我不会把具体 x86 指令当跨架构答案，也不会把可见性、原子性和有序性混在一起。双重检查单例的实例引用必须 volatile，原因还包括禁止看见未完成初始化的对象。

### Q011：`Unsafe`、CAS 和 `VarHandle` 在 JUC 源码里分别是什么角色？

> **口语化回答：** 我会把 CAS 看成原子状态转换，把 `Unsafe` 看成早期 JDK 内部直接访问内存和原子指令的低层入口，把 `VarHandle` 看成更标准、带明确访问模式的变量句柄。现代源码可能用其中一种实现，但上层不变量仍是“只有比较到预期旧值才提交新值”。
>
> **深入追问：** 我会区分 plain、opaque、acquire、release、volatile 等访问语义，不把所有原子操作都笼统说成完全屏障。CAS 循环要处理竞争失败、ABA、活锁和退避；多个字段的不变量通常需要加锁、不可变快照或更高层状态机。
>
> **易错点：** 我不会在业务代码里为了“快”直接依赖非公开 `Unsafe`，也不会说 CAS 一定比锁快。高竞争下 CAS 自旋和缓存行抖动可能更差，选型要用正确性证明和压测决定。

### Q012：AQS 独占锁的 `acquire()` 主链路怎么走？

> **口语化回答：** 我会从 `acquire(arg)` 讲：先调用子类实现的 `tryAcquire()` 抢锁；失败后创建节点入同步队列，再在 `acquireQueued()` 一类循环里判断前驱是不是 head、是否可以再次抢锁，不能抢就根据前驱状态决定 park，醒来后重试。
>
> **深入追问：** 关键状态是 volatile `state`、独占 owner、同步队列 head/tail 和节点等待状态。入队通过 CAS，park 前必须再次确认条件，唤醒也只是让线程重新竞争，不等于直接把锁转交给它。中断版、超时版会走不同取消路径。
>
> **易错点：** 我不会把 AQS 队列说成严格 CLH 原算法或绝对 FIFO 公平队列，也不会认为 `unpark` 有次数累计。源码节点字段在不同 JDK 版本有调整，面试重点应是状态机和丢唤醒防护。

### Q013：AQS 的 `release()`、取消节点和唤醒为什么比“state 减一”复杂？

> **口语化回答：** 我会从 `release(arg)` 先调用 `tryRelease()`。只有子类确认同步状态真正释放，例如重入计数归零，AQS 才去唤醒合适的后继。取消或超时节点还要从有效等待链路中跳过，避免队首后面全是无效节点导致进展停住。
>
> **深入追问：** 释放写入 state 与后续获取之间要满足可见性；后继选择需要处理 next 为空、节点已取消等竞态，必要时从 tail 反向寻找有效节点。被唤醒线程仍需 CAS 抢锁，所以公平性由 `tryAcquire()` 的策略和队列检查共同决定。
>
> **易错点：** 我不会说 release 直接指定“下一个线程获得锁”，也不会忽略异常和中断造成的取消清理。业务自定义同步器如果错误实现 `tryRelease()`，可能提前暴露受保护状态。

### Q014：`Condition.await()` 和 `signal()` 怎么在条件队列与同步队列之间转移节点？

> **口语化回答：** 我会说 `await()` 必须在持锁时调用。它先把当前线程包装成节点放进该 Condition 的条件队列，完整释放当前锁，然后 park；收到 `signal()` 后，节点只是从条件队列转移到 AQS 同步队列，等它重新竞争并拿回锁，`await()` 才能返回。
>
> **深入追问：** 关键状态包括 Condition 的 first/last waiter、节点的条件状态，以及 AQS 同步队列。`signal()` 同样要求持锁，这样状态修改和通知有稳定顺序。等待必须用 `while (!predicate) await()`，因为可能虚假唤醒，也可能条件被别的线程先消费。
>
> **易错点：** 我不会把 `signal()` 说成立即执行被通知线程，也不会用 `if` 检查一次条件。中断发生在转移前后有不同处理语义，写业务时优先使用标准阻塞队列，少手造复杂 Condition 协议。

### Q015：`ReentrantLock` 公平锁和非公平锁源码差异在哪里？

> **口语化回答：** 我会说两者都基于 AQS state 表示重入次数，owner 表示持有线程。非公平锁允许新线程直接 CAS 抢 state 为 0，可能插队；公平锁在尝试获取前会检查同步队列里是否已有等待更久的前驱。
>
> **深入追问：** 入口是 `lock()` 到具体 Sync 的 `lock/tryAcquire`。重入时 owner 相同就增加 state，释放时逐层递减到 0 才清 owner。公平只约束正常获取路径，`tryLock()` 某些形式仍可能不遵守公平排队，具体以 API 语义为准。
>
> **易错点：** 我不会说公平锁绝不饥饿、调度顺序绝对按入队时间，也不会默认公平更好。公平检查和上下文切换通常降低吞吐，只有业务确实需要等待上界时才考虑。

### Q016：`Semaphore` 和 `CountDownLatch` 怎样复用 AQS 共享模式？

> **口语化回答：** 我会说共享模式允许一次状态变化放行多个线程。Semaphore 把 state 当剩余许可，acquire 用 CAS 减许可，release 加许可并传播唤醒；CountDownLatch 把 state 当剩余计数，`countDown()` 减到 0 后，等待线程都可以共享通过。
>
> **深入追问：** 入口分别是 `acquire/release` 和 `await/countDown`，底层覆写共享获取与释放方法。共享传播与独占锁不同，head 推进后还需要确保后续节点得到唤醒。它们提供的是进程内同步，不是分布式许可或持久任务状态。
>
> **易错点：** 我不会把 Semaphore 当限速器，它限制在途并发而不是每秒请求数；也不会尝试重置一次性 CountDownLatch。需要多轮屏障时用 Phaser 或其他明确协议。

### Q017：`ThreadPoolExecutor.execute()` 的三段式决策和 `ctl` 状态怎么讲？

> **口语化回答：** 我会按源码顺序说：如果 worker 数小于 corePoolSize，先 `addWorker(command, true)`；否则尝试把任务入队；入队后必须重新检查池状态，关停了就移除并拒绝，池里没 worker 还要补一个；队列放不下时再尝试建非核心 worker，失败才拒绝。
>
> **深入追问：** `ctl` 把运行状态和 worker 数编码在一个原子整数里，状态大体从 RUNNING 到 SHUTDOWN、STOP、TIDYING、TERMINATED。双重检查是为了处理“入队成功同时池被关闭”的竞态。Worker 同时实现锁语义，避免运行任务时被错误中断。
>
> **易错点：** 我不会只背七参数而漏掉入队后的 recheck，也不会说最大线程数在无界队列下仍经常生效。具体位宽属于实现细节，重点是状态和数量要原子协调。

### Q018：线程池 Worker 从 `addWorker()` 到退出，生命周期怎么走？

> **口语化回答：** 我会从 `addWorker()` 先 CAS 增加 workerCount，再在主锁保护下把 Worker 放进 workers 集合并启动线程。线程进入 `runWorker()`，先跑 firstTask，再循环 `getTask()` 取队列任务；每次执行前后调用钩子，异常退出或取不到任务后进入 `processWorkerExit()` 做计数和必要补员。
>
> **深入追问：** `getTask()` 会综合池状态、队列是否为空、是否允许核心线程超时和当前数量决定阻塞等待还是退出。任务异常能导致 Worker 突然结束，因此线程工厂、异常观测和补员都很重要。线程池只管理执行，不自动赋予业务任务重试和幂等。
>
> **易错点：** 我不会说线程执行异常后池一定整体停止，也不会忽略 `submit()` 把异常包进 Future。自定义 `beforeExecute/afterExecute` 必须保证轻量且不破坏 Worker 生命周期。

### Q019：`shutdown()`、`shutdownNow()`、中断和拒绝策略的真实语义是什么？

> **口语化回答：** 我会说 `shutdown()` 进入 SHUTDOWN，不再接新任务，但会处理队列中的任务；`shutdownNow()` 进入 STOP，尝试中断正在执行的 Worker，并返回尚未开始的队列任务。中断是协作信号，不保证任务立刻停止。
>
> **深入追问：** 入口会检查权限、推进 `ctl` 状态并中断 idle worker 或全部 worker，之后 `tryTerminate()` 判断能否进入 TERMINATED。拒绝策略只处理提交失败的当下行为，不等于任务已经可靠落盘或业务方收到失败结果。
>
> **易错点：** 我不会把 `shutdownNow()` 说成强杀，也不会在关停后把未执行关键任务静默丢掉。生产关停要先停止接流、登记在途任务、设置总 deadline，并让可靠队列或状态表承接恢复。

### Q020：`CompletableFuture` 的完成栈、线程选择和异常传播怎么理解？

> **口语化回答：** 我会把每个阶段看成“结果槽位加后续动作”。上游未完成时，下游 Completion 被挂到栈上；上游完成后触发后续阶段。没有 `Async` 的方法可能由完成上游的线程继续执行，带 `Async` 又没传 Executor 时通常进入 commonPool。
>
> **深入追问：** 关键状态是结果对象、Completion 链和完成触发。`thenApply` 做同步映射，`thenCompose` 扁平化异步链；异常会沿链传播，`exceptionally/handle/whenComplete` 的恢复语义不同。取消 CompletableFuture 也不保证底层网络或线程任务真的停止。
>
> **易错点：** 我不会把所有阶段都默认扔进公共池，也不会到处 `join()` 把异步重新变成阻塞。请求链要显式 Executor、deadline、异常归类和上下文传播。

### Q021：`ForkJoinPool` 的工作窃取为什么适合拆分计算，不适合随便跑阻塞 IO？

> **口语化回答：** 我会说每个 Worker 有自己的双端队列，自己通常从一端取局部任务，空闲 Worker 从别人的另一端偷任务，减少共享队列竞争。递归任务把大问题拆成小任务后，这种局部性和负载均衡比较合适。
>
> **深入追问：** 关键状态包括工作队列、活动线程计数和任务完成状态。`fork()` 推任务，`join()` 等结果；如果大量任务阻塞 IO，Worker 不能继续处理其他计算，可能造成饥饿。某些受控阻塞可用 ManagedBlocker 告知池补偿，但不是通用 IO 架构。
>
> **易错点：** 我不会把 work stealing 说成没有调度开销，也不会把 commonPool 当全局万能执行器。小任务拆得过细、共享数据竞争或阻塞 join 都可能让性能更差。

### Q022：`LongAdder` 为什么高竞争时比 `AtomicLong` 更有吞吐，为什么又不能替代它？

> **口语化回答：** 我会说 `AtomicLong` 所有线程竞争一个 value，热点很集中；`LongAdder` 低竞争先更新 base，冲突后把增量分散到多个 Cell，读取时再求和，所以高并发统计吞吐更好。
>
> **深入追问：** 入口是 `add/increment`，关键状态是 base、cells 和线程探针。扩 Cell 和更新槽都靠 CAS；`sum()` 遍历聚合时并发写仍可能继续，所以它不是严格线性化快照，也没有方便的 compare-and-set 业务语义。
>
> **易错点：** 我不会用 LongAdder 做账户余额、库存扣减或序号生成。它适合指标计数；需要读改写原子决策时仍用 AtomicLong、锁或数据库约束。

### Q023：`ConcurrentLinkedQueue` 的无锁入队、出队和逻辑删除怎么理解？

> **口语化回答：** 我会把它看成 Michael-Scott 风格的链式无锁队列。入队创建新节点，通过 CAS 把某个尾节点的 next 指向它，再尽力推进 tail；出队从 head 向后找第一个 item 非空节点，用 CAS 把 item 置空完成逻辑删除，再推进 head。
>
> **深入追问：** 关键状态是 volatile head/tail、节点 item/next。head 和 tail 允许暂时滞后，其他线程会协助推进，因此 CAS 某一步失败不代表操作整体失败，而是重新读取状态继续。Java GC 降低了手工内存回收的 ABA 风险，但算法仍依赖正确可见性。
>
> **易错点：** 我不会说 `size()` 是 O(1) 或并发下精确，它通常要遍历；也不会用它需要阻塞等待的生产消费场景，那应选 BlockingQueue。

### Q024：`ArrayBlockingQueue` 和 `LinkedBlockingQueue` 的锁、Condition 与容量差异是什么？

> **口语化回答：** 我会说 ArrayBlockingQueue 用固定数组和一把主锁，`notEmpty/notFull` 两个 Condition 协调生产消费；LinkedBlockingQueue 用链表节点，常见实现把 put 和 take 分成两把锁，并用原子 count 协调，容量可配置但默认过大很危险。
>
> **深入追问：** 入口是 `put/take/offer/poll`。满队列生产者在 notFull 等，空队列消费者在 notEmpty 等；状态改变后只通知需要的一侧。数组内存局部性好，链表每项有节点开销，但分离锁在某些并发模型下更有吞吐。
>
> **易错点：** 我不会说 LinkedBlockingQueue 天生无界，也不会只看吞吐忽略容量。任何生产队列都要把最大积压、拒绝或阻塞语义和停机清理说清楚。

### Q025：Java 21 虚拟线程的创建、调度、park 和 pinning 边界怎么讲？

> **口语化回答：** 我会从 `Thread.ofVirtual().start()` 或 `startVirtualThread()` 讲。虚拟线程是 JVM 管理的 Thread，运行时挂载到较少的 carrier platform thread；遇到可感知的阻塞时可以卸载，让 carrier 去跑别的虚拟线程，所以它主要降低“一请求一线程”的线程成本。
>
> **深入追问：** 关键状态是虚拟线程生命周期、Continuation、调度器和 carrier 挂载关系。park、网络阻塞和取消由 JVM/JDK 协作；在某些持有 monitor 的阻塞路径或 native 调用中可能 pin 住 carrier。具体调度器和 pinning 改进会随 JDK 演进，必须用目标 JDK 的 JFR 和压测验证。
>
> **易错点：** 我不会说虚拟线程让 CPU 计算更快，也不会因此删掉数据库连接池、Provider 限流和业务并发上限。ThreadLocal 成本、下游容量和结构化取消仍要单独治理。

## 二、Spring 与 MyBatis 源码（Q026-Q040）

### Q026：Spring `ApplicationContext.refresh()` 的主流程怎么讲？

> **口语化回答：** 我会把 `refresh()` 当容器启动总编排：准备环境和 BeanFactory，加载 BeanDefinition，执行 BeanFactoryPostProcessor，注册 BeanPostProcessor，初始化消息、事件和相关基础设施，最后实例化非懒加载单例并发布容器刷新完成事件。
>
> **深入追问：** 关键状态是 BeanDefinitionRegistry、BeanFactory、各种 PostProcessor 列表和单例缓存。PostProcessor 的执行顺序受 PriorityOrdered、Ordered 等影响；刷新失败会销毁已创建单例并关闭资源。不同 Spring 版本的具体模板方法会调整，但“定义阶段”和“实例阶段”必须分清。
>
> **易错点：** 我不会把 refresh 说成只是扫描注解，也不会在 BeanFactoryPostProcessor 里随意触发 Bean 提前实例化。启动慢要用启动阶段证据定位，不能只凭 Bean 数量猜。

### Q027：Spring `getBean()` 到 `doCreateBean()` 的核心链路是什么？

> **口语化回答：** 我会从 `getBean()` 进入 `doGetBean()`，先按名称转换并查单例缓存；没有现成实例就合并 BeanDefinition、处理 dependsOn，再按 scope 创建。单例创建最终进入 `createBean/doCreateBean`，经历实例化、属性填充、初始化和后置处理。
>
> **深入追问：** 关键状态是合并后的 BeanDefinition、singletonObjects 等缓存、当前正在创建集合和 scope。`doCreateBean()` 里可能提前暴露引用，`initializeBean()` 前后调用 BeanPostProcessor，最终对象可能已经是代理而不是原始实例。
>
> **易错点：** 我不会说构造函数执行时字段注入已经完成，也不会假设 `getBean(Foo.class)` 永远只有一个候选。FactoryBean 本身和它生产的对象也要用 `&` 语义区分。

### Q028：`@Autowired` 的候选解析和字段/方法注入由谁完成？

> **口语化回答：** 我会说注解不是自己执行的，主要由 `AutowiredAnnotationBeanPostProcessor` 在属性填充阶段发现注入点，再交给 BeanFactory 的依赖解析逻辑按类型、泛型、Qualifier、Primary、名称和优先级筛候选。
>
> **深入追问：** 入口集中在 BeanPostProcessor 对注入元数据的构建和执行，关键状态是 InjectionMetadata、DependencyDescriptor 和候选 BeanDefinition。解析依赖时可能触发其他 Bean 创建，因此循环依赖和懒加载会在这里暴露。构造器解析发生得更早，能保证必需依赖完整。
>
> **易错点：** 我不会只背“Autowired 按类型、Resource 按名称”而忽略消歧规则，也不会把字段注入当方便就优先。构造器依赖过多通常是在提醒类职责过重。

### Q029：Spring 的 BeanPostProcessor 怎样创建 AOP 代理？原对象为什么可能被替换？

> **口语化回答：** 我会说自动代理创建器本身是 BeanPostProcessor，在 Bean 初始化前后判断这个 Bean 是否命中 Advisor。命中后构建代理工厂，选择 JDK 动态代理或 CGLIB 类代理，并把代理对象作为 `postProcessAfterInitialization` 的返回值交回容器，所以调用方拿到的可能不是原对象。
>
> **深入追问：** 关键状态是候选 Advisor、Pointcut 匹配结果、TargetSource 和拦截器链。调用代理方法时，链条按顺序执行 MethodInterceptor，最后才到目标方法。早期引用场景还要尽量保证循环依赖拿到的代理与最终代理一致。
>
> **易错点：** 我不会说所有方法都能拦截：私有方法、绕过代理的自调用、final 限制都要具体看代理方式。代理对象类型也不能想当然强转成实现类。

### Q030：Spring 三级缓存解决循环依赖的准确边界是什么？

> **口语化回答：** 我会说它只是在特定单例、非构造器循环中提前暴露引用。一级放完整单例，二级放早期引用，三级放能生成早期引用的 ObjectFactory；后者让 AOP 有机会提前返回代理，而不是简单多放一层 Map。
>
> **深入追问：** 入口在创建单例和 `getSingleton` 的早期引用分支，关键状态是 singletonObjects、earlySingletonObjects、singletonFactories 和正在创建标记。构造器 A 需要 B、B 又需要 A 时，A 连实例都还没产生，三级缓存无法凭空解决；prototype 也不走完整单例缓存协议。
>
> **易错点：** 我不会把“Spring 能解决循环依赖”说成设计合理。配置是否允许循环也随 Spring Boot 版本和设置变化；长期方案仍是拆职责、事件或中介边界。

### Q031：Spring AOP 一次代理调用的拦截器链怎么执行？

> **口语化回答：** 我会从代理的 invocation handler 或 method interceptor 进入，先根据目标类和方法拿到匹配的拦截器链，再创建 MethodInvocation。每个拦截器调用 `proceed()` 推进到下一层，全部通过后才反射或方法句柄调用目标方法，返回时按栈顺序退出。
>
> **深入追问：** 关键状态是 Advisor 顺序、动态方法匹配、当前拦截器索引和目标对象。事务、缓存、重试同时存在时，顺序会改变事务边界和重试范围，不能认为注解互不影响。异常也会沿同一调用链回退。
>
> **易错点：** 我不会在自定义环绕通知里忘记 `proceed()` 或调用两次，也不会用过宽切点拦截所有 Bean。切面顺序必须通过测试验证业务语义。

### Q032：`@Transactional` 从 Advisor 到数据库事务，源码链路怎么走？

> **口语化回答：** 我会说容器先为带事务属性的方法匹配 TransactionAdvisor，代理调用进入 `TransactionInterceptor`，再由事务基类读取方法和类上的事务配置，选择 PlatformTransactionManager。它获取或创建事务，调用目标方法，正常提交，符合回滚规则的异常则回滚。
>
> **深入追问：** 关键状态是 TransactionAttribute、TransactionStatus、事务同步管理器绑定的连接或 Session。传播行为决定复用、挂起、创建还是 Savepoint；提交阶段还可能因数据库错误失败。资源通常通过 ThreadLocal 绑定，所以跨线程不会自动继承同一事务。
>
> **易错点：** 我不会说抛任何异常都必然回滚，默认规则和显式 rollbackFor 要区分；自调用、非 Spring 管理对象、方法可见性和捕获异常不再抛出都会让预期事务失效。

### Q033：`REQUIRES_NEW`、`NESTED` 和挂起事务在源码语义上有什么差别？

> **口语化回答：** 我会说 `REQUIRES_NEW` 会挂起当前事务和相关资源，创建一个独立物理事务；`NESTED` 通常在同一物理事务里建 Savepoint，内层回滚可退到保存点，但外层最终回滚仍会把全部撤销。
>
> **深入追问：** 入口在事务管理器根据传播属性处理已有事务。关键状态是 SuspendedResourcesHolder、TransactionStatus、Savepoint。是否支持 nested 取决于事务管理器和数据库；连接池也要能承受外层占一条连接、内层再申请一条连接的并发压力。
>
> **易错点：** 我不会把 nested 说成另一个独立提交，也不会为了“记录日志一定成功”随便用 REQUIRES_NEW。池大小不足时可能互相等连接，业务补偿语义也要先确认。

### Q034：Spring MVC 从 `DispatcherServlet` 到响应写回，源码主链路是什么？

> **口语化回答：** 我会从 Servlet 容器 Filter 链进入 DispatcherServlet 的 `doDispatch()`。它通过 HandlerMapping 找处理器和拦截器，再由 HandlerAdapter 调 Controller；参数解析、数据绑定和校验完成后执行方法，返回值由 ReturnValueHandler、消息转换器写成响应，异常交给 HandlerExceptionResolver。
>
> **深入追问：** 关键状态是 HandlerExecutionChain、HandlerAdapter、WebDataBinder、ArgumentResolver、ReturnValueHandler 和 ModelAndView。异步请求会退出当前容器线程并在完成后重新分派，Filter、Interceptor、ControllerAdvice 的边界不能混淆。
>
> **易错点：** 我不会说请求直接从 DispatcherServlet 到 Controller，也不会把参数校验当授权。消息转换和异常处理可能泄露内部字段，Response DTO 与数据库实体要分开。

### Q035：Spring Boot 自动配置从导入候选到条件生效，主机制是什么？

> **口语化回答：** 我会说 Boot 启动配置会导入一批自动配置候选，每个候选再通过 `@ConditionalOnClass`、`@ConditionalOnMissingBean`、配置属性等条件判断是否生效。用户显式提供 Bean 时，很多默认配置会 back off。
>
> **深入追问：** 关键状态是自动配置元数据、ConditionEvaluationReport、Environment 和 BeanDefinition。不同 Boot 主版本的候选注册文件和内部选择器实现有变化，不能只背旧版 `spring.factories`。排障时我会看条件评估报告，而不是猜为什么没装配。
>
> **易错点：** 我不会说“扫描到依赖就一定创建 Bean”，条件组合、顺序和属性都可能阻止生效；也不会为了覆盖默认 Bean 随手允许 BeanDefinition 重名。

### Q036：`@Async` 为什么会丢事务、MDC 或 SecurityContext？源码边界在哪里？

> **口语化回答：** 我会说 `@Async` 也是代理拦截，拦截器把方法调用包装成任务提交给选定 Executor，真正方法在另一个线程执行。原线程通过 ThreadLocal 绑定的事务、MDC 和其他上下文不会天然跟过去。
>
> **深入追问：** 入口是 AsyncAnnotationBeanPostProcessor 创建 Advisor，调用进入 AsyncExecutionInterceptor。关键状态是方法对应的 Executor、返回 Future 类型和 TaskDecorator。事务要在异步线程内部重新建立，Context 传播要显式捕获、安装并在 finally 清理。
>
> **易错点：** 我不会在同类自调用上期待 `@Async` 生效，也不会用 `InheritableThreadLocal` 粗暴传播线程池上下文。异步提交成功不代表业务任务可靠完成，进程重启仍可能丢失。

### Q037：MyBatis Mapper 接口为什么没有实现类也能执行 SQL？

> **口语化回答：** 我会从 MapperScanner 把接口注册成 MapperFactoryBean 讲起。调用 Mapper 方法时实际进入 `MapperProxy.invoke()`，它把 Method 解析成 MapperMethod，再根据命令类型调用 SqlSession 的 select、insert、update 或 delete。
>
> **深入追问：** 关键状态是 MapperProxyFactory、方法缓存、MappedStatement ID、参数和返回类型解析。Object 自身方法、default method 和普通 Mapper 方法会走不同分支。Spring 集成下 SqlSessionTemplate 再把调用转给与当前事务绑定的实际 SqlSession。
>
> **易错点：** 我不会说 MyBatis “直接通过反射执行接口”，中间还有语句注册、参数映射、Executor 和 JDBC。Mapper 方法重载会让 statement ID 和参数解析变复杂，通常应避免。

### Q038：MyBatis `Executor`、一级缓存和二级缓存的调用顺序是什么？

> **口语化回答：** 我会说 SqlSession 最终委托 Executor。查询时先构造 CacheKey，查当前 Executor 的 localCache；未命中再走 `queryFromDatabase()`，经过 StatementHandler 执行 JDBC 并把结果回填。启用二级缓存时，CachingExecutor 包在具体 Executor 外层，以 namespace cache 再拦一层。
>
> **深入追问：** 关键状态是 MappedStatement、BoundSql、localCache、transactional cache 和 Executor 类型 SIMPLE/REUSE/BATCH。一级缓存默认是 SqlSession 级，更新会清理相关本地缓存；二级缓存通常到事务提交后才正式提交缓存变更。
>
> **易错点：** 我不会把缓存命中说成跨表一致，另一个 namespace 更新未必知道该清谁；也不会在集中系统里默认开启二级缓存替代 Redis 或业务缓存。

### Q039：MyBatis 的参数映射、结果映射和 `#{}` 预编译链路怎么走？

> **口语化回答：** 我会说动态 SQL 先生成 BoundSql，里面有最终 SQL、ParameterMapping 和附加参数。`#{}` 生成 JDBC 占位符，由 ParameterHandler 通过 TypeHandler 绑定值；ResultSet 返回后，ResultSetHandler 再按 ResultMap、自动映射和 TypeHandler 组装对象。
>
> **深入追问：** 关键状态是 SqlSource、BoundSql、ParameterMapping、TypeHandlerRegistry、ResultMap。`${}` 是文本替换，不走 PreparedStatement 参数绑定，所以只能用于受控白名单标识符，不能接用户输入。复杂嵌套映射还可能触发延迟加载或 N+1。
>
> **易错点：** 我不会说 `#{}` 能保护动态表名和排序字段，那些不能作为普通参数绑定；枚举、时间和 JSON 类型也要确认 TypeHandler 与数据库方言一致。

### Q040：MyBatis 插件链、分页插件和 Batch Executor 有哪些源码级坑？

> **口语化回答：** 我会说 MyBatis 插件通过 Interceptor 包装 Executor、StatementHandler、ParameterHandler 或 ResultSetHandler 的指定方法，多个插件形成代理链。分页插件通常拦 StatementHandler 或 Executor 改 SQL；Batch Executor 则把相同语句和参数批次交给 JDBC，最后 flush 才真正拿到结果。
>
> **深入追问：** 关键状态是 InterceptorChain 顺序、Invocation、BoundSql 是否被复制、BatchResult 和事务连接。插件顺序会改变 SQL、缓存键和计数语句；批处理异常可能只告诉某一批失败，必须明确提交边界、分批大小和回滚策略。
>
> **易错点：** 我不会把分页插件当深分页优化，也不会在插件里直接拼接不可信 SQL。Batch 不是循环调用就自动高效，驱动参数、包大小、生成主键和错误恢复都要测试。

## 三、MySQL 生产机制（Q041-Q060）

### Q041：InnoDB 页、区、段和 B+Tree 是怎么组织数据的？

> **口语化回答：** 我会先说 InnoDB 以页作为主要读写单位，多个连续页组成区，索引按段管理自己的叶子和非叶子空间。聚簇索引 B+Tree 的叶子页放整行记录，二级索引叶子页放索引列和主键，所以二级索引查非覆盖列通常还要回表。
>
> **深入追问：** 我会继续讲页内有目录槽和有序记录，页之间通过层级索引定位，不把 B+Tree 画成每个节点只存一个 key。分裂、合并和页利用率会受插入顺序影响；趋势递增主键通常比完全随机长主键更有局部性，但也要评估写热点。
>
> **易错点：** 我不会说所有查询固定三次 IO，树高、缓存命中和回表次数都在变化；也不会把逻辑页等同于磁盘一次物理 IO。具体页格式要以实际 MySQL/InnoDB 版本为准。

### Q042：Buffer Pool 的页读取、脏页刷新和淘汰主链路是什么？

> **口语化回答：** 我会说查询先按表空间和页号找 Buffer Pool，未命中才从存储读取；修改先改内存页并产生 redo，把页标成脏页，之后由后台按检查点和压力异步刷盘。热点页和冷页通过改造过的 LRU 管理，避免一次大扫描把真正热点全挤掉。
>
> **深入追问：** 关键状态包括页哈希、free list、LRU、flush list、页的 oldest modification LSN。刷脏受 redo 空间、脏页比例、IO 能力和 checkpoint 推进共同影响；预读、change buffer 等机制是否命中也会改变表现。
>
> **易错点：** 我不会说提交事务必须把对应数据页刷盘，持久性主要靠 redo；也不会看到 Buffer Pool 使用率高就判定内存泄漏。生产排查要看命中率、脏页、刷盘、redo 等待和存储延迟的组合。

### Q043：Redo Log 为什么能做到 WAL？Checkpoint 解决什么问题？

> **口语化回答：** 我会说 WAL 的核心是先把修改的日志按顺序持久化，再允许随机数据页以后慢慢刷。事务提交需要保证对应 redo 达到配置要求的持久化位置；崩溃后 InnoDB 从 checkpoint 之后重放已记录修改，不需要扫描所有数据页。
>
> **深入追问：** 关键状态是 redo buffer、日志文件、LSN、checkpoint LSN 和脏页。mini-transaction 保护页级修改的日志原子性；checkpoint 推进太慢会让 redo 空间紧张，前台写入被迫等待。`innodb_flush_log_at_trx_commit` 会改变每次提交的写和 fsync 语义。
>
> **易错点：** 我不会把 redo 说成 SQL 逻辑日志，它更接近物理页修改；也不会说“有 redo 就绝不丢数据”，操作系统、磁盘缓存和参数会改变故障窗口，必须结合 binlog 和备份谈恢复。

### Q044：Undo Log 同时怎样支持回滚和 MVCC？

> **口语化回答：** 我会说更新一行时，InnoDB 保留足够的旧版本信息，并让记录通过回滚指针连接到历史版本。事务回滚可以用 undo 撤销未提交修改；一致性读则根据事务可见性沿版本链找到应该看到的版本。
>
> **深入追问：** 关键状态是事务 ID、roll pointer、undo record、Read View 和 purge 进度。旧版本只有在不再被任何活跃 Read View 需要时才能清理，所以长事务会拖住 purge，让 undo 空间和版本链持续增长。
>
> **易错点：** 我不会说 undo 是整行完整备份或永远保留，也不会把普通一致性读和 `SELECT ... FOR UPDATE` 当前读混在一起。排查历史列表增长时先找长事务，而不是直接删系统文件。

### Q045：Read View 怎样判断一条版本对当前事务可见？RC 和 RR 有什么不同？

> **口语化回答：** 我会把 Read View 讲成创建时的活跃事务边界：版本事务 ID 比最小活跃 ID 还小，通常已经提交可见；大于等于下一个待分配 ID，属于未来不可见；落在中间则看它是否仍在活跃集合，以及是不是当前事务自己产生的版本。
>
> **深入追问：** 在 Read Committed 下，一般每次一致性读都会形成新的 Read View，所以能看到之后已提交的数据；Repeatable Read 通常在事务第一次一致性读时建立并复用，保持快照。当前读仍要读最新可锁版本，不受同一快照规则完全限制。
>
> **易错点：** 我不会把 RR 说成任何查询都绝不出现新行，也不会把 MySQL 的实现直接套到所有数据库。隔离级别只限定并发现象，业务丢失更新仍可能需要条件更新或显式锁。

### Q046：记录锁、间隙锁、Next-Key Lock 和插入意向锁分别保护什么？

> **口语化回答：** 我会说记录锁锁索引记录，间隙锁锁两个索引值之间的范围，Next-Key Lock 是记录加前面间隙的组合；插入意向锁表示事务想在某个间隙插入，它与相同意图通常可并存，但会和阻止该间隙插入的锁冲突。
>
> **深入追问：** InnoDB 的行锁实际落在索引上，锁范围取决于隔离级别、查询是否当前读、索引是否唯一、条件是否精确命中以及扫描路径。没有合适索引时，扫描和锁住的记录或范围可能远超业务预期。
>
> **易错点：** 我不会说 `WHERE id = 1` 永远只锁一行，必须先确认执行计划和索引唯一性；也不会把意向锁和插入意向锁混为一谈。锁语义要用目标版本和真实 SQL 验证。

### Q047：给一条范围更新 SQL，怎么现场推导它会锁哪些范围？

> **口语化回答：** 我会先问表结构、索引、隔离级别和实际执行计划，再画索引有序值。例如 `WHERE age >= 20 AND age < 30 FOR UPDATE` 如果走非唯一 age 索引，我会沿扫描区间分析命中的记录、两侧必要间隙以及二级索引到主键记录的锁，而不是只看 SQL 文本。
>
> **深入追问：** 我会用两个独立事务做最小复现，观察 performance_schema 的 data_locks、data_lock_waits 和 InnoDB 状态，分别测试插入 19、20、25、30 以及更新已有行，验证边界。知识推导和实验结果都不等于我亲历过同样生产事故。
>
> **易错点：** 我不会在生产直接用大范围锁语句试探，也不会忽略隐式类型转换导致索引变化。面试时如果表定义没给全，我会明确假设，不凭空报锁区间。

### Q048：MySQL 死锁现场怎么读等待图、止损和根治？

> **口语化回答：** 我会先说明这是排障知识和演练方法，不冒充我的真实事故。现场先保留死锁日志、事务 SQL、参数、执行计划和时间线；InnoDB 会选择一个事务回滚，我让应用识别死锁错误，对可重试且幂等的短事务做有界退避重试，同时控制流量避免持续碰撞。
>
> **深入追问：** 我会从 `SHOW ENGINE INNODB STATUS` 或 performance_schema 里找每个事务已持有和正在等待的锁，画出等待环，再对照索引扫描顺序。长期修复通常是统一访问顺序、缩短事务、补合适索引、减少一次锁定范围，并用并发测试复现后验证。
>
> **易错点：** 我不会把所有 lock wait timeout 都叫死锁，也不会只把超时调大。重试非幂等外部副作用会重复扣款或发消息，事务外动作必须另行收口。

### Q049：隔离级别为什么仍不能自动防住所有 Lost Update？

> **口语化回答：** 我会举“先读库存 10，两个事务各自在应用里算成 9，再覆盖写回”的例子。即使每个事务内部读看起来一致，最后写仍可能覆盖另一个事务结果，所以我不会把隔离级别当完整业务并发控制。
>
> **深入追问：** 解决方式要按不变量选：`UPDATE ... SET stock = stock - 1 WHERE stock > 0` 用条件更新把判断和修改放同一语句；或者加 version 做乐观锁，冲突后重读；确实需要串行读改写时用 `FOR UPDATE`。Serializable 也要准备序列化失败重试。
>
> **易错点：** 我不会先查再在 Java 里判断后直接 update，也不会用 Redis 锁替代数据库唯一约束。锁只保护约定使用它的参与者，数据库约束才是最终防线。

### Q050：InnoDB Redo 和 MySQL Binlog 的两阶段提交怎么避免主从与恢复不一致？

> **口语化回答：** 我会说事务提交时，InnoDB 先把 redo 写到 prepare 状态，Server 层再写 binlog，成功后把 redo 标成 commit。崩溃恢复时，遇到 prepare 的 redo，会根据对应 binlog 事务是否完整存在，决定提交还是回滚，从而让存储引擎状态和复制日志尽量一致。
>
> **深入追问：** 关键状态是事务标识、redo prepare/commit、binlog event 完整性和刷盘策略。Binlog 是逻辑复制与时间点恢复的重要来源，redo 是 InnoDB 崩溃恢复来源，两者不能互相简单替代。XA 内部协调的具体实现随版本演进。
>
> **易错点：** 我不会说两阶段提交让任何外部 MQ 也自动原子，也不会把 prepare 理解成业务可见提交。参数组合会改变掉电窗口，回答时要区分进程崩溃、操作系统崩溃和整机掉电。

### Q051：Group Commit 怎样摊薄 fsync，又为什么会影响延迟分布？

> **口语化回答：** 我会说多个并发事务可以在一个提交批次里共享 redo 或 binlog 的一次刷盘，减少每个事务单独 fsync 的成本。吞吐上升的代价是事务可能等待凑批、前序阶段或存储设备完成，所以要看 p95、p99，不只看平均 TPS。
>
> **深入追问：** 我会按 redo flush、binlog write/sync、commit 等阶段理解协调顺序，并结合 `sync_binlog`、`innodb_flush_log_at_trx_commit` 和磁盘持久化语义分析。批次大小不是越大越好，它受并发、延迟目标和 IO 能力约束。
>
> **易错点：** 我不会通过关闭持久化参数换一个漂亮压测结果却不说明可丢窗口，也不会把应用批量提交和数据库 group commit 混成一件事。

### Q052：MySQL 崩溃恢复为什么既要 Redo，也要 Undo？

> **口语化回答：** 我会说重启时先用 redo 把已经记录但数据页没刷全的修改重做到一致状态，再识别崩溃时仍未提交的事务，用 undo 回滚它们。这样既不会丢掉已经承诺提交的修改，也不会把未提交中间态留给业务。
>
> **深入追问：** 我会区分 analysis、redo、undo 这类概念阶段，不把具体内部实现说死；还要结合 doublewrite 或原子写处理页撕裂风险。恢复时间受待重放日志、脏页、长事务和 IO 能力影响，RTO 需要演练测量。
>
> **易错点：** 我不会说 crash recovery 等于备份恢复，它不能处理误删、逻辑损坏或磁盘全部丢失。生产必须另有备份、binlog 和恢复演练。

### Q053：一条 SQL 突然变慢，怎样判断是计划漂移、锁等待还是 IO？

> **口语化回答：** 我会先说明这是通用排障方法。先按同一 SQL digest、真实参数和时间窗口拆分总耗时，确认慢在拿连接、等锁、执行、网络还是返回大结果；再看执行计划、实际扫描行数、统计信息、数据分布和近期 DDL/版本变更。
>
> **深入追问：** 我会结合 slow log、performance_schema、`EXPLAIN ANALYZE` 和等待事件。预估行数与实际差很大更像统计或分布问题；锁等待看 blocking transaction；读 IO 飙升看 Buffer Pool 命中、存储延迟和临时表。止损可回滚变更、限流或隔离坏查询，根修后用同参数回归。
>
> **易错点：** 我不会一上来就加索引或 `FORCE INDEX`，也不会在高风险生产语句上贸然跑会真实执行的分析命令。任何“我遇到过”都只在有内部事故记录时说。

### Q054：联合索引怎样结合等值、范围、排序和覆盖来设计？

> **口语化回答：** 我会先从高频查询和写入代价出发，把稳定等值过滤、范围、排序、返回列放在一张访问路径里评估。联合索引通常先利用连续最左前缀，遇到范围后，后续列对缩小扫描区间的能力可能受限，但仍可能用于索引下推、覆盖或部分排序优化。
>
> **深入追问：** 我会看选择性、数据分布、回表次数、排序/临时表、索引宽度和写放大，不机械按“选择性最高永远放最前”。同一个查询可通过覆盖索引减少回表，但把大文本全塞进索引会增加页数和维护成本。
>
> **易错点：** 我不会把函数、隐式转换和前导模糊匹配都笼统说成百分百失效，而会看实际计划；也不会为每个查询各建一个近似重复索引。

### Q055：深分页和大表 `COUNT(*)` 为什么慢，生产上怎么改？

> **口语化回答：** 我会说 `LIMIT offset, size` 仍要定位并丢弃前 offset 行，回表和排序会随 offset 放大。稳定排序场景我优先用基于唯一有序键的 seek/cursor pagination，例如带上上一页的 `(created_at, id)`；总数则按业务是否真的需要精确值决定实时算、延迟统计还是取消展示。
>
> **深入追问：** Cursor 必须包含完整排序键和方向，查询条件与索引顺序匹配；翻页期间数据新增删除时，要定义快照还是实时视图。Count 优化不能靠读取一个长期错误缓存值，需要明确一致性和刷新窗口。
>
> **易错点：** 我不会只把 offset 换成 `id > lastId` 而忽略复合排序、倒序和权限过滤，也不会把 MyBatis 分页插件说成已经解决数据库扫描成本。

### Q056：MySQL 主从复制从 Binlog 到 Relay Log 的链路是什么？

> **口语化回答：** 我会说主库事务提交后产生 binlog，副本的接收线程按位点或 GTID 拉取并写 relay log，再由应用线程重放。现代并行复制会按不冲突关系让多个 worker 执行，但副本对外可见仍受重放进度和提交顺序约束。
>
> **深入追问：** 关键状态是 source binlog position/GTID set、relay log、retrieved/executed set、复制线程状态和延迟。异步、半同步只改变确认边界，不等于零数据丢失；大事务、DDL、热点冲突、IO 或副本查询负载都会制造 lag。
>
> **易错点：** 我不会把 `Seconds_Behind_Source` 一个数当完整真相，也不会说半同步保证所有副本已应用。判断可读新数据要看目标事务是否已执行，而不是只看时间差。

### Q057：读写分离出现 Replica Lag，怎样保证 Read-your-writes？

> **口语化回答：** 我会先声明这是设计和演练方法。写成功后如果下一次读随机打到落后副本，用户可能看不到自己的修改。关键业务可以在一个短窗口读主库，或者把提交位点/GTID 带到读请求，只有副本执行到该位置才允许读，否则回主库或返回明确状态。
>
> **深入追问：** 我会按数据重要性分级：报表允许有界旧，支付状态通常不能随便旧。监控不仅看平均 lag，还看每个副本的 apply queue、目标事务位点和主库压力；故障时先摘除落后副本，不能把所有读立即压垮主库。
>
> **易错点：** 我不会用固定 sleep 等复制，也不会无限等待副本追平。真实采用哪种方案和是否发生过事故，必须有内部架构与记录才能说。

### Q058：主库故障切换时，怎样评估数据丢失、双主和回切风险？

> **口语化回答：** 我会先说明这是故障演练方法。先冻结或隔离旧主写入口，比较候选副本 GTID/位点和事务完整性，选数据最完整且满足一致性策略的候选提升；更新路由后持续防止旧主恢复继续写。恢复服务前要明确可能的数据丢失窗口和受影响业务清单。
>
> **深入追问：** 我会检查复制拓扑、半同步确认边界、fencing 机制、DNS/代理传播和应用连接池旧连接。回切不是简单把原主启动，要先重新同步、校验数据，再走一次受控角色变更。RPO/RTO 必须靠定期演练测量。
>
> **易错点：** 我不会把“副本延迟是 0”当绝对无丢失证据，也不会允许两个节点都接受写。没有亲历记录时，我只说方案和演练，不说自己处理过真实主库事故。

### Q059：大表 Online DDL 怎样做 Expand-and-Contract，避免锁表和版本不兼容？

> **口语化回答：** 我会先确认目标版本对该 ALTER 支持 INSTANT、INPLACE 还是必须 COPY，并评估 metadata lock、临时空间、redo/binlog、复制延迟和回滚方式。应用发布采用先加兼容字段或索引、双版本共存、回填校验、切读写、最后清理旧结构的 expand-and-contract。
>
> **深入追问：** DDL 即使声称 online，也可能在开始或结束等 metadata lock；长事务会阻塞它。大规模回填要分批、限速、可续跑，并监控主库 IO、锁等待和副本 lag。工具化影子表迁移还会引入触发器、外键和切换风险。
>
> **易错点：** 我不会直接在高峰执行未评估 ALTER，也不会让每个应用 Pod 启动时抢着迁移。删除列和收紧约束必须等所有旧版本退出后再做。

### Q060：全量备份加 Binlog 的 PITR 怎么做，怎样证明真的可恢复？

> **口语化回答：** 我会说先恢复一个校验过的全量备份，再从它记录的 binlog/GTID 起点重放到目标时间或目标事务之前，最后做业务一致性校验并受控切流。备份成功日志不等于可恢复，必须在隔离环境定期演练恢复。
>
> **深入追问：** 我会明确 RPO、RTO、加密密钥、备份保留、跨故障域副本和恢复依赖；误删恢复要避免把错误事务也重放进去，可以按时间、GTID 或事件定位。演练记录下载、解密、恢复、重放、校验每阶段耗时和失败点。
>
> **易错点：** 我不会把主从复制当备份，误删会同步过去；也不会未经校验就覆盖原库。这里是知识和演练标准，不代表我完成过某公司真实灾备，除非内部证据能证明。

## 四、Redis 生产机制（Q061-Q075）

### Q061：Redis 为什么单线程执行命令仍能有高吞吐？IO 线程改变了什么？

> **口语化回答：** 我会说 Redis 的核心命令执行通常串行，省掉共享数据结构上的锁竞争；网络连接由事件循环配合非阻塞 IO 多路复用处理，内存操作又比较快。部分版本可以用 IO 线程并行读写网络数据，但命令对键空间的执行语义仍不是任意多线程并发。
>
> **深入追问：** 关键路径是文件事件、连接读事件、命令解析、执行、响应写回和时间事件。单线程不代表不会阻塞，大 key 命令、长 Lua、fork、AOF fsync、swap 或网络都会拖住所有请求。版本差异和线程配置要以实际 Redis 为准。
>
> **易错点：** 我不会只用“纯内存所以快”解释，也不会说启用 IO 线程就能解决慢命令。性能判断要拆服务端执行、事件循环、网络和客户端池等待。

### Q062：Redis Dict 的渐进式 Rehash 怎样避免一次性长停顿？

> **口语化回答：** 我会说字典扩缩容时会同时保留旧、新两张哈希表，用 `rehashidx` 记录迁移进度。后续普通增删查和定时任务每次搬少量桶，逐步把旧表迁空，所以不会一次 O(n) 全搬完。
>
> **深入追问：** Rehash 期间新写通常进入新表，查询和删除要检查两张表；迭代和某些后台状态会影响迁移节奏。渐进只把总工作摊开，不会消除额外内存和每次操作的迁移成本。
>
> **易错点：** 我不会说 rehash 完全没有延迟，也不会把它和 Cluster slot 迁移混为一谈。大规模 key 变化仍要监控 CPU、内存和延迟。

### Q063：String、Hash、List、Set、ZSet 的底层编码为什么会动态转换？

> **口语化回答：** 我会说 Redis 会按元素数量、大小和类型在紧凑编码与更通用结构之间取舍。例如字符串可能用整数或 SDS，Hash/小集合可能用 listpack，List 使用 quicklist，ZSet 常在紧凑表示和跳表加字典之间切换。
>
> **深入追问：** 紧凑编码减少指针和对象开销，适合小对象；规模超过配置阈值后转换，换取更稳定的查改复杂度。编码名称和阈值随 Redis 版本演进，面试时我会先说明版本边界，不把 ziplist 等旧实现当永久现状。
>
> **易错点：** 我不会只按抽象数据类型估内存，也不会通过极端调大紧凑阈值换空间后忽略单次操作 CPU。应结合 `OBJECT ENCODING`、memory usage 和真实分布验证。

### Q064：Redis 过期删除和内存淘汰是两套什么机制？

> **口语化回答：** 我会说过期删除处理已经到 TTL 的 key，常见是访问时惰性删除加后台主动抽样；内存淘汰是在超过 maxmemory 后，按 noeviction、LRU、LFU、random、TTL 等策略决定是否拒绝写或逐出候选 key。
>
> **深入追问：** 过期 key 不保证到点立刻物理消失，主动扫描要在 CPU 和回收速度间平衡；淘汰算法通常是近似采样，不是维护全局精确 LRU。副本、持久化和 keyspace notification 对过期的观察语义也要按版本确认。
>
> **易错点：** 我不会把 TTL 当定时任务精确触发，也不会在承担不可丢状态时随便配置 allkeys-lru。缓存和事实源的职责必须先分清。

### Q065：RDB、AOF、AOF Rewrite 和混合持久化分别解决什么？

> **口语化回答：** 我会说 RDB 是某时点快照，恢复快但可能丢快照后的数据；AOF 追加写命令，按 fsync 策略缩小丢失窗口，但日志更大。Rewrite 生成表达当前数据集的更短 AOF，不是简单压缩旧文件；混合方式用快照前缀加增量命令兼顾恢复速度和新鲜度。
>
> **深入追问：** 关键状态包括 dirty 计数、后台子进程、AOF buffer、rewrite buffer 和 fsync 策略。重写期间新写不能丢，切换新文件要原子；实际持久化格式和多部 AOF 管理会随版本变化。
>
> **易错点：** 我不会说 AOF everysec 最多只会丢“绝对一秒”，操作系统和故障模型要一起看；也不会把 Redis 持久化当数据库级备份替代品。

### Q066：Redis Fork、Copy-on-Write 和 AOF fsync 为什么会制造尾延迟？

> **口语化回答：** 我会说生成 RDB 或重写 AOF 往往需要 fork，父子进程初始共享页；后台期间父进程持续写，会触发写时复制，额外占内存和内存带宽。数据集大、页表大或写流量高时，fork 和 COW 都可能拉高 p99；磁盘 fsync 抖动也会阻塞相关路径。
>
> **深入追问：** 我会观察 latest_fork_usec、COW 大小、RSS、写入速率、AOF delayed fsync、磁盘延迟和主机 overcommit，而不是只看 Redis CPU。止损可降低大批写、迁移后台任务或保护内存，长期做容量和持久化窗口设计。
>
> **易错点：** 我不会在问题未定位时关闭持久化，也不会把 fork 说成完整复制所有内存。这里是排障知识和演练，不冒充真实事故。

### Q067：Redis 主从全量同步、部分重同步和复制积压缓冲区怎么配合？

> **口语化回答：** 我会说副本首次连接或无法续接时做全量同步：主节点生成快照并把期间写命令缓存，副本加载快照后追增量。短暂断线时，如果 replica 知道 replication ID 和 offset，且缺失数据仍在 backlog 里，就能部分重同步，不必重新传全量。
>
> **深入追问：** 关键状态是 replication ID、offset、backlog 范围和副本 ACK。全量同步会消耗 CPU、内存、网络和磁盘，多个副本同时重连可能形成风暴；无盘复制等配置也有不同资源权衡。
>
> **易错点：** 我不会说复制是同步提交或零丢失，也不会只调大 backlog 不看写速率和最大断线时间。副本过旧还可能返回陈旧读。

### Q068：Sentinel 怎样判主观下线、客观下线、选 Leader 并完成故障转移？

> **口语化回答：** 我会说单个 Sentinel 超时判断是主观下线；足够多个 Sentinel 达到 quorum 后形成客观下线判断。之后 Sentinel 之间选出本轮故障转移 Leader，由它选择合适副本提升、让其他副本跟随新主，并通知客户端或配置更新。
>
> **深入追问：** 候选副本要考虑优先级、复制 offset、断连时间等；quorum 负责确认故障，不等于选举 Leader 所需多数完全相同。网络分区下旧主可能仍接受写，所以客户端发现、写保护和业务 fencing 仍重要。
>
> **易错点：** 我不会说 Sentinel 自动给 Redis 带来强一致，也不会把三个 Sentinel 和三个数据副本混为一谈。故障转移期间可用性和丢数据窗口必须压测与演练。

### Q069：Redis Cluster 的 Slot、Gossip、MOVED/ASK 和迁移主链路是什么？

> **口语化回答：** 我会说 Cluster 把 key 映射到固定数量的 hash slot，每个主节点负责一部分 slot。客户端请求打错节点会收到 MOVED 更新长期路由；slot 迁移期间可能收到 ASK，表示这一次去目标节点并先 ASKING。节点通过 cluster bus 交换拓扑和故障信息。
>
> **深入追问：** 多 key 操作通常要求 key 在同一 slot，可以用 hash tag 明确归组。迁移会在源、目标节点间逐 key 搬运，客户端和代理必须正确处理重定向。多数主节点故障判断和副本提升不等于每次写都经过多数派提交。
>
> **易错点：** 我不会说 Cluster 自动解决热 key，一个 slot 或一个 key 仍可能打爆单节点；也不会在业务 key 上随意加 hash tag，导致所有流量集中。

### Q070：Cache Aside 在并发写、删除失败和读写穿插时怎样理解一致性？

> **口语化回答：** 我会说常见写路径是先提交数据库，再删除缓存；读路径未命中后查库再回填。它缩小了脏数据窗口，但不是强一致协议：删缓存失败、旧读回填覆盖、数据库事务与缓存操作不原子，都会出现短暂不一致。
>
> **深入追问：** 我会用时序分析每个竞态，并按业务选择 TTL、删除重试/Outbox、版本号、防旧值回填、单飞和主动失效。更新数据库前先删缓存也可能让并发读把旧值重新填回；所谓延迟双删也必须有明确时序和失败处理，不是口号。
>
> **易错点：** 我不会承诺 DB+Redis 强一致，也不会用分布式锁掩盖所有问题。最终事实仍在数据库，缓存故障时系统要能降级并对账。

### Q071：缓存穿透、击穿和雪崩的防护为什么不能只背三个名词？

> **口语化回答：** 我会先定位流量形态：穿透是大量不存在 key 穿过缓存，击穿是单个热点刚好失效，雪崩是大量 key 或缓存集群同时失效。对应措施分别可能是入口校验、空值/Bloom；单飞互斥与逻辑过期；TTL 抖动、多级缓存、容量隔离和降级。
>
> **深入追问：** 防护必须考虑误判、锁持有者崩溃、回源数据库容量和缓存恢复时的预热洪峰。Bloom filter 只能说“可能存在/一定不存在”的特定方向，删除和版本更新还要设计。演练要同时测缓存全断和慢响应。
>
> **易错点：** 我不会把所有 cache miss 都叫穿透，也不会让互斥锁无超时地排队。这里是通用设计和故障演练，不代表本人发生过相同线上事故。

### Q072：Redis 分布式锁的最小正确实现、续租和 Fencing Token 怎么配合？

> **口语化回答：** 我会说加锁至少用带随机 owner token 的原子 `SET key value NX PX ttl`，释放用 Lua 比较 token 后再删除。业务执行可能超过 TTL 时，续租要确认仍是原 owner；即使做到这些，进程长暂停或网络分区后旧持有者仍可能晚到，所以关键资源端还要验证单调 fencing token。
>
> **深入追问：** 锁提供的是一段租约，不是永生所有权。下游必须拒绝 `token < last_seen` 的旧持有者；如果同一个租约允许多次写，`token == last_seen` 还要结合业务版本、操作序号或幂等键判断，不能一概拒绝。只有业务明确规定“一个租约只允许一次写”时，才可以用严格递增条件。需要强协调时，我会评估数据库条件更新或 etcd/ZooKeeper，而不是默认 Redis 足够。
>
> **易错点：** 我不会用 `GET` 再 `DEL` 两条命令释放，也不会把 Redlock 名字当安全证明。下游不检查 fencing 时，生成 token 没有意义。

### Q073：Pipeline、Lua Script、MULTI/EXEC 各自保证什么，不保证什么？

> **口语化回答：** 我会说 Pipeline 主要减少网络往返，不保证一组命令隔离执行；Lua 脚本在 Redis 命令执行线程中原子运行，适合短小读改写；MULTI/EXEC 把命令排队后连续执行，但没有传统数据库那种执行期自动回滚。
>
> **深入追问：** WATCH 提供乐观检查，key 在 EXEC 前变化会让事务失败，由客户端重试。脚本执行太久会阻塞实例；Cluster 下多 key 仍受 slot 约束。Redis 7 的 Functions 等能力有版本边界，不能混讲。
>
> **易错点：** 我不会说 Pipeline 等于批量事务，也不会在 Lua 里扫描大 key 或调用不确定长逻辑。命令错误和业务失败需要调用方显式处理。

### Q074：热 Key、Big Key 和大批量命令怎样定位并改造？

> **口语化回答：** 我会先说明这是排障方法。热 key 看请求频率和节点/CPU 分布，big key 看单 key 内存、元素数和单次响应；两者可能同时存在。定位会结合命令统计、slowlog、安全采样、客户端 trace 和网络带宽，避免在线上跑 `KEYS *`。
>
> **深入追问：** 热 key 可用进程内只读缓存、请求合并、拆 key 或业务分区，但要设计一致性；big key 要改数据模型、分页、分桶和渐进删除。删除大对象优先异步/惰性释放能力，并观察内存峰值和副本传播。
>
> **易错点：** 我不会为了拆热 key 随机复制多份却没有失效协议，也不会直接 DEL 超大集合。是否亲历过要按内部记录回答，本题本身只是方法。

### Q075：Redis 延迟突然升高，怎样按服务端、主机、网络和客户端分层排查？

> **口语化回答：** 我会先保存时间窗口、p50/p99、命令分布和发布事件，再限流或绕过非关键缓存保护数据库。服务端看 slowlog、latency、fork/AOF、过期、迁移和热/大 key；主机看 CPU、内存、swap、磁盘；网络看重传；客户端看连接池等待、超时、重试和 DNS。
>
> **深入追问：** 我会用同一 trace 把客户端耗时拆成 pool wait、connect、write、server、read，避免服务端只花 1ms 而客户端排队 200ms。修复后用相同负载验证 p99、错误率和回源量，并检查是否把压力转移到数据库。
>
> **易错点：** 我不会先执行高风险全量扫描，也不会只扩客户端连接数。这里是知识和演练流程，不冒充本人真实事故。

## 五、Kafka 与 MQ 生产机制（Q076-Q090）

### Q076：Kafka 的 Topic、Partition、Segment 和索引怎样组织一条消息？

> **口语化回答：** 我会说 Topic 被拆成 Partition，每个 Partition 是有序追加日志；日志再按大小或时间滚成 Segment，Segment 内有日志数据和 offset、时间等稀疏索引。消息顺序只在单 Partition 内定义，offset 是该 Partition 的位置，不是全局业务 ID。
>
> **深入追问：** 查找通常先定位包含目标 offset 的 Segment，再用稀疏索引找到接近位置后顺序扫描。顺序写、页缓存和批处理共同提升吞吐；保留与压缩策略决定旧 Segment 何时可删除或重写。
>
> **易错点：** 我不会说 Kafka 每条消息单独随机落盘，也不会拿 offset 当跨 Topic 幂等键。分区数会影响并行度、文件句柄、元数据和重平衡成本。

### Q077：Kafka Producer 从 `send()` 到 Broker 落盘的主链路是什么？

> **口语化回答：** 我会说 `send()` 先序列化、选择 Partition，把 Record 放进按分区组织的本地 accumulator；Sender 线程按 batch.size、linger、压缩和 in-flight 条件组批发送给该分区 Leader，收到符合 acks 的响应后再完成 Future/Callback。
>
> **深入追问：** 关键状态是 metadata、RecordAccumulator、batch、buffer.memory、request timeout、delivery timeout 和每连接在途请求。分区器、key、批次和压缩影响顺序与吞吐；超时结果可能是未知，不代表 Broker 一定没写入。
>
> **易错点：** 我不会把 `send()` 返回 Future 当 Broker 已持久化，也不会在 Callback 里做阻塞重活。重试必须结合幂等 Producer 和消息业务键，不能每次生成新 eventId。

### Q078：`acks`、ISR、`min.insync.replicas` 怎样共同决定可用性和数据风险？

> **口语化回答：** 我会说 `acks=0` 不等确认，`acks=1` 只等 Leader，`acks=all` 等当前 ISR 达到要求的确认。真正保护写入下限的是 `acks=all` 配合 `min.insync.replicas`；ISR 不足时宁可拒绝写，换取更小的数据丢失风险。
>
> **深入追问：** ISR 是跟得上 Leader 的副本集合，具体判定受版本和延迟配置影响。副本数 3 不代表每次都等 3 份；如果 min ISR 设 2，通常至少要 Leader 加一个同步副本可确认。Leader 切换策略也会影响是否允许选落后副本。
>
> **易错点：** 我不会说 `acks=all` 等所有配置副本，也不会说它提供端到端 exactly-once。生产者确认后，消费者数据库副作用仍要单独幂等。

### Q079：Follower 拉取、LEO、HW 和 Leader Epoch 怎样参与副本一致性？

> **口语化回答：** 我会说 Follower 主动向 Leader 拉数据，各副本的 LEO 表示下一条写入位置，HW 表示当前可对消费者稳定可见的高水位。Leader 故障切换后，Leader Epoch 等元数据帮助识别日志分叉和截断边界，避免只比较一个裸 offset。
>
> **深入追问：** HW 推进与 ISR 副本进度相关；Leader 的最新未充分复制数据可能还不能作为已提交记录暴露。新 Leader 选出后，其他副本需要截断不一致尾部再追随。Kafka 具体复制协议和术语会随版本演进，回答以当前集群版本为准。
>
> **易错点：** 我不会把 HW 说成所有副本完全一样，也不会认为消费者读到的每条消息永久不会因错误配置丢失。unclean leader election 会改变可用性与数据一致性的权衡。

### Q080：幂等 Producer 的 PID、Sequence Number 和 Epoch 怎么消除重试重复？

> **口语化回答：** 我会说 Broker 给 Producer 会话分配身份，Producer 对每个 Partition 的 Batch 带递增序号；Broker 能识别同一会话重试的重复批次和乱序。Epoch 用于隔离旧实例或旧会话，避免恢复后的旧 Producer 继续写。
>
> **深入追问：** 幂等范围主要在单 Producer 会话向 Kafka Partition 写入，客户端会限制与顺序相关的配置组合。进程重启、业务重复提交、跨 Topic 流程和外部数据库并不会自动因开启幂等就全部去重。
>
> **易错点：** 我不会把 `enable.idempotence=true` 说成业务 exactly-once，也不会忽略 key 和业务 eventId。应用重建一条语义相同但新 ID 的消息，Broker 无法替业务识别。

### Q081：Kafka Transaction 和 Exactly-Once Semantics 的边界是什么？

> **口语化回答：** 我会说事务 Producer 用 `transactional.id` 获取带 epoch 的 Producer 身份，把多个 Partition 写入和消费 offset 提交纳入同一 Kafka 事务。消费者使用 read_committed 时不读取未提交或已中止事务数据，这适合 consume-transform-produce 的 Kafka 内闭环。
>
> **深入追问：** Transaction Coordinator 维护事务状态，分区日志里写事务标记；旧 Producer 会被 fencing。事务超时、长事务和协调器故障都有运维成本。外部 MySQL、HTTP、邮件或支付不在 Kafka 事务边界内。
>
> **易错点：** 我不会把 Kafka EOS 扩展成“数据库和所有副作用绝不重复”。跨系统仍要 Outbox、业务幂等和对账。

### Q082：Consumer Group 的 Coordinator、Join、Sync 和心跳主链路怎么走？

> **口语化回答：** 我会说同一个 group 内每个 Partition 同时只分配给一个 Consumer。Consumer 先找到 Group Coordinator，成员 JoinGroup，选出的 Leader 根据策略计算分配，Coordinator 再通过 SyncGroup 下发；运行期间持续心跳，超时或成员变化会触发新的分配。
>
> **深入追问：** 关键状态是 group generation/member epoch、成员订阅、assignment、heartbeat/session timeout 和 max poll interval。消费线程若长时间不 poll，即使心跳线程还活着，也可能被认为处理能力异常并失去分区，具体机制随客户端协议版本变化。
>
> **易错点：** 我不会说 Consumer 数超过 Partition 数还能线性提升同一 group 吞吐，也不会在 revoke 后继续提交旧成员 offset。分配变更要协调在途任务。

### Q083：Eager、Cooperative Rebalance 和 Static Membership 怎样减少重平衡停顿？

> **口语化回答：** 我会说传统 eager rebalance 往往先撤销所有分区再整体重分，停顿明显；cooperative 策略分阶段只迁必要分区，让未变化分区继续工作；static membership 给稳定实例固定身份，短暂重启不必立刻当新成员处理。
>
> **深入追问：** Rebalance Listener 的 revoke/assign 阶段要提交安全 offset、停止对应任务、清理局部状态；cooperative 要使用兼容 assignor 并按协议升级。Static member 长时间失联仍会超时，不能消除真正故障。
>
> **易错点：** 我不会说 cooperative 完全无停顿，也不会把 session timeout 调得极大掩盖故障。滚动发布要配合 drain 和处理时间设计。

### Q084：自动提交和手动提交 Offset 分别会在哪个窗口丢消息或重复？

> **口语化回答：** 我会说 offset 提交早于业务完成，进程崩溃后新 Consumer 从更后位置开始，可能丢业务处理；业务完成后再提交，提交前崩溃会重复拉取。所以生产常接受 at-least-once，再用稳定 eventId、数据库唯一约束和状态机把业务效果做成 effectively-once。
>
> **深入追问：** 同步/异步提交的错误处理不同，异步回调还要防旧 offset 回调覆盖新进度。按 Partition 维护下一条待消费 offset，在 revoke 和关停时有界提交。若业务写数据库，消费记录与业务更新应在同一本地事务。
>
> **易错点：** 我不会把 offset 当“这条消息业务成功”的充分证据，也不会每条消息无脑同步提交拖垮吞吐。批量处理要明确部分成功边界。

### Q085：Kafka 怎样保证同一业务 Key 的顺序？重试和扩分区为什么会破坏它？

> **口语化回答：** 我会说 Producer 用稳定 key 让同一业务实体路由到同一 Partition，Partition 内按 offset 有序；Consumer 对同一 Partition 或 key 串行推进。失败重试如果绕到另一个 Topic、并行线程或换 key，后续消息可能先完成，所以还要带业务 version 做状态机校验。
>
> **深入追问：** 扩分区会改变常见 hash 到 Partition 的映射，之后同一 key 可能进入新分区，与旧分区尚未消费的数据交错。方案可以冻结旧 Topic、迁移版本、业务侧排序或接受每实体版本拒旧，但不能宣称全局有序。
>
> **易错点：** 我不会为了全局顺序只建一个 Partition 而不评估吞吐和可用性，也不会把 Broker 顺序等同于多线程业务完成顺序。

### Q086：Kafka Lag 突增，怎样算清积压 ETA 并定位瓶颈？

> **口语化回答：** 我会先说明这是排障知识和演练。先按 Partition 看生产速率、消费完成速率、lag、oldest age、错误率和处理耗时；净清理速度是消费速率减生产速率，只有它为正才能估 ETA。再判断瓶颈在分区并行度、Consumer CPU、数据库、外部 API、锁还是毒消息。
>
> **深入追问：** 止损时可降级非关键逻辑、隔离毒消息、保护下游并按可并行度扩容；Consumer 数超过 Partition 数没有收益。清理历史积压还要避免挤占实时高优先级消息，必要时分 Topic 或旁路批处理。
>
> **易错点：** 我不会只看 group 总 lag 掩盖单个热点 Partition，也不会直接扩 Consumer 把数据库打挂。是否经历过真实积压必须按内部记录回答。

### Q087：Broker 宕机、Under-Replicated Partition 和 Leader Election 怎么排查？

> **口语化回答：** 我会先说明这是演练流程。先确认控制器视角下 Broker 存活、受影响 Partition Leader/ISR、生产错误和网络/磁盘状态；保护入口重试预算，避免所有客户端同步重试形成风暴。若仍有满足条件的 ISR，等待或触发正常选主；若没有，要按数据风险决定是否拒绝服务。
>
> **深入追问：** 我会检查 URP 数量、offline partition、ISR shrink、磁盘满/慢、请求队列和副本 fetch。恢复节点后观察 ISR 逐步追平，不在它数据未同步时贸然承载 Leader。是否允许 unclean election 是明确的数据丢失换可用性决策。
>
> **易错点：** 我不会重启所有 Broker“碰碰运气”，也不会只看进程存活。这里不是本人事故陈述，除非有真实事件证据。

### Q088：Retention 和 Log Compaction 能否替代业务数据库或归档？

> **口语化回答：** 我会说 retention 按时间或大小删除旧 Segment，compaction 则尽量为每个 key 保留较新的值和必要墓碑，但清理是后台渐进过程，不保证任意时刻每个 key 只剩一条。Kafka 适合事件日志和重放窗口，不自动提供业务查询模型。
>
> **深入追问：** Compaction 受 dirty ratio、segment、墓碑保留和清理线程影响；同一 key 的历史可能在一段时间内共存。没有 key 的消息无法按 key 压缩，key 变化也会留下旧记录。归档和合规删除还需对象存储或专门流程。
>
> **易错点：** 我不会把 compacted Topic 叫永久 KV 数据库，也不会认为 tombstone 到达后数据立刻从所有副本和备份消失。

### Q089：消息 Schema 演进、毒消息、DLQ 和重放怎样形成闭环？

> **口语化回答：** 我会给事件加稳定 type、schema version、eventId、occurredAt 和业务 key，采用向前/向后兼容规则。消费者遇到不可重试的解析或业务错误，不无限热循环，而是记录原消息引用、错误类别和 attempt，进入隔离 Topic/DLQ 并告警。
>
> **深入追问：** 修复后重放保持原 eventId 和业务顺序信息，先 dry-run、限速，再对账输入消息与业务状态。Schema Registry 或契约测试要阻止不兼容 Producer 上线；敏感字段和删除要求也要进入演进设计。
>
> **易错点：** 我不会把 DLQ 当垃圾桶，也不会重放时生成新幂等键。参数错误不应反复重试，下游临时 5xx 才适合有界退避。

### Q090：Transactional Outbox 为什么仍可能重复？端到端一致性怎样收口？

> **口语化回答：** 我会说业务表和 Outbox 行在同一本地事务提交，先消除“业务成功但事件根本没记录”的窗口。投递器发送到 Broker 后如果还没来得及把 Outbox 标成功就崩溃，下次会重复发送，所以它提供可靠至少一次，不是天然 exactly-once。
>
> **深入追问：** 投递器要用状态条件、Lease 或 `SKIP LOCKED` 防并发重复领取，保留稳定 eventId；消费者把 eventId 去重记录和业务更新放同一本地事务。还需要失败重试、死信、归档、监控和定期对账，CDC 读取 Outbox 只是另一种投递方式。
>
> **易错点：** 我不会把发送成功日志当 Broker 已持久化证明，也不会删除 Outbox 后失去审计。当前三个项目是否实际使用这套方案必须按内部实现回答，不能从设计题反推已上线。

## 六、手写与并发不变量（Q091-Q100）

### Q091：手写一个线程安全的 O(1) LRU Cache，怎么证明它正确？

> **口语化回答：** 我会用 HashMap 做 O(1) 定位，用双向链表维护最近使用顺序。每次 get 或覆盖 put 都把节点移到头部，超过容量就删除尾部最久未使用节点。因为 Map 和链表必须一起变化，我用同一把锁保护这个联合不变量。

```java
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

public final class LruCache<K, V> {
    private static final class Node<K, V> {
        K key;
        V value;
        Node<K, V> prev;
        Node<K, V> next;

        Node(K key, V value) {
            this.key = key;
            this.value = value;
        }
    }

    private final int capacity;
    private final Map<K, Node<K, V>> index = new HashMap<>();
    private final Node<K, V> head = new Node<>(null, null);
    private final Node<K, V> tail = new Node<>(null, null);
    private final ReentrantLock lock = new ReentrantLock();

    public LruCache(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity must be positive");
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    public V get(K key) {
        lock.lock();
        try {
            Node<K, V> node = index.get(key);
            if (node == null) return null;
            unlink(node);
            linkFirst(node);
            return node.value;
        } finally {
            lock.unlock();
        }
    }

    public void put(K key, V value) {
        lock.lock();
        try {
            Node<K, V> node = index.get(key);
            if (node != null) {
                node.value = value;
                unlink(node);
                linkFirst(node);
                return;
            }
            Node<K, V> created = new Node<>(key, value);
            index.put(key, created);
            linkFirst(created);
            if (index.size() > capacity) {
                Node<K, V> victim = tail.prev;
                unlink(victim);
                index.remove(victim.key);
            }
        } finally {
            lock.unlock();
        }
    }

    public int size() {
        lock.lock();
        try {
            return index.size();
        } finally {
            lock.unlock();
        }
    }

    private void unlink(Node<K, V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void linkFirst(Node<K, V> node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }
}
```

> **深入追问：** 平均 get/put 是 O(1)，空间 O(capacity)。我要证明的核心不变量是：Map 中每个节点在链表里恰好一次，链表除哨兵外的节点都能由 Map 找到，size 永不超过 capacity。边界测试包括容量 1、重复覆盖、访问后淘汰顺序、null value 的语义，以及 100 个线程随机 get/put 后遍历结构无断链。
>
> **易错点：** 我不会只给 `LinkedHashMap` 一行答案后无法解释机制，也不会只给 Map 上锁、链表不锁。这里返回 null 无法区分“未命中”和“值就是 null”，生产接口可禁 null 或返回 Optional。

### Q092：手写一个支持阻塞、超时和中断的有界队列，关键不变量是什么？

> **口语化回答：** 我会用环形数组保存元素，一把 ReentrantLock 保护 head、tail、count，两组 Condition 分别表示 notEmpty 和 notFull。等待必须写在 while 循环里，既处理虚假唤醒，也处理醒来后条件又被别人抢走。

```java
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public final class BoundedQueue<E> {
    private final Object[] items;
    private int head;
    private int tail;
    private int count;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notEmpty = lock.newCondition();
    private final Condition notFull = lock.newCondition();

    public BoundedQueue(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity must be positive");
        this.items = new Object[capacity];
    }

    public void put(E value) throws InterruptedException {
        Objects.requireNonNull(value, "value");
        lock.lockInterruptibly();
        try {
            while (count == items.length) notFull.await();
            enqueue(value);
        } finally {
            lock.unlock();
        }
    }

    public boolean offer(E value, long timeout, TimeUnit unit) throws InterruptedException {
        Objects.requireNonNull(value, "value");
        long nanos = unit.toNanos(timeout);
        lock.lockInterruptibly();
        try {
            while (count == items.length) {
                if (nanos <= 0L) return false;
                nanos = notFull.awaitNanos(nanos);
            }
            enqueue(value);
            return true;
        } finally {
            lock.unlock();
        }
    }

    public E take() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (count == 0) notEmpty.await();
            return dequeue();
        } finally {
            lock.unlock();
        }
    }

    private void enqueue(E value) {
        items[tail] = value;
        tail = (tail + 1) % items.length;
        count++;
        notEmpty.signal();
    }

    @SuppressWarnings("unchecked")
    private E dequeue() {
        E value = (E) items[head];
        items[head] = null;
        head = (head + 1) % items.length;
        count--;
        notFull.signal();
        return value;
    }
}
```

> **深入追问：** put/take 都是 O(1)，空间 O(capacity)。不变量是 `0 <= count <= capacity`，head/tail 永远在数组范围内，每次成功 enqueue/dequeue 只改变一个槽和一次 count。测试要覆盖满队列超时、空队列中断、多个生产者消费者总数守恒、环绕下标和不允许 null。
>
> **易错点：** 我不会用 `if` 代替 `while`，也不会在没有持锁时 signal。生产代码优先使用 JDK BlockingQueue；手写是为了说明 Condition 协议，不是重复造轮子。

### Q093：手写双重检查单例，为什么实例字段必须是 `volatile`？

> **口语化回答：** 我会先说最简单可靠的单例通常是 enum 或静态内部类；如果面试官指定双重检查，我会让实例引用 volatile。第一次不加锁快速读，只有 null 时进入同步块，再检查一次并创建。

```java
public final class ConfigRegistry {
    private static volatile ConfigRegistry instance;

    private ConfigRegistry() {
        // 构造期间只建立对象内部状态，不把 this 发布到外部。
    }

    public static ConfigRegistry getInstance() {
        ConfigRegistry local = instance;
        if (local == null) {
            synchronized (ConfigRegistry.class) {
                local = instance;
                if (local == null) {
                    local = new ConfigRegistry();
                    instance = local;
                }
            }
        }
        return local;
    }
}
```

> **深入追问：** 时间复杂度 O(1)，额外空间 O(1)。volatile 保证发布写和后续读之间的可见性，并阻止其他线程观察到“引用非空但对象初始化尚未完成”的非法重排。测试包括高并发收集所有 identityHashCode 只有一个、反射/序列化是否属于威胁模型，以及构造失败能否再次尝试。
>
> **易错点：** 我不会省掉同步块内第二次检查，也不会在构造器里注册 this、启动线程或做不可控 IO。跨进程单例不是这个模式能解决的。

### Q094：手写不会死锁且不透支的账户转账，怎样定义锁顺序？

> **口语化回答：** 我会给账户一个全局唯一且稳定的 id，转账时总按较小 id 到较大 id 的顺序加锁。所有调用都遵守同一偏序，就不会形成 A 等 B、B 又等 A 的环；余额校验和两边更新放在两把锁同时持有的临界区里。

```java
import java.util.concurrent.locks.ReentrantLock;

public final class TransferService {
    public static final class Account {
        private final long id;
        private long cents;
        private final ReentrantLock lock = new ReentrantLock();

        public Account(long id, long cents) {
            if (cents < 0) throw new IllegalArgumentException("negative balance");
            this.id = id;
            this.cents = cents;
        }

        public long balance() {
            lock.lock();
            try {
                return cents;
            } finally {
                lock.unlock();
            }
        }
    }

    public static boolean transfer(Account from, Account to, long amount) {
        if (from == null || to == null) throw new NullPointerException();
        if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
        if (from == to) return true;
        if (from.id == to.id) throw new IllegalArgumentException("duplicate account id");

        Account first = from.id < to.id ? from : to;
        Account second = from.id < to.id ? to : from;
        first.lock.lock();
        try {
            second.lock.lock();
            try {
                if (from.cents < amount) return false;
                long nextFrom = from.cents - amount;
                long nextTo = Math.addExact(to.cents, amount);
                from.cents = nextFrom;
                to.cents = nextTo;
                return true;
            } finally {
                second.lock.unlock();
            }
        } finally {
            first.lock.unlock();
        }
    }
}
```

> **深入追问：** 单次转账时间 O(1)、空间 O(1)。不变量是任一余额非负，成功转账前后两账户总额不变，失败不改状态，所有锁遵循同一全序。测试包括 A->B 和 B->A 高并发、余额不足、同账户、重复 id、long 溢出以及所有线程结束后总额守恒。
>
> **易错点：** 我不会用 `identityHashCode` 当永久无碰撞业务顺序，也不会在扣款后才发现收款溢出；实际金融转账必须由数据库事务、账本、幂等和审计完成，这段代码只证明进程内锁不变量。

### Q095：手写一个基于单调时钟的 Token Bucket，怎么避免超发？

> **口语化回答：** 我会保存桶容量、每纳秒补充速率、当前 token 和上次补充时间。每次请求先按 `System.nanoTime()` 的增量补 token，最多到 capacity，再在同一个 synchronized 临界区判断和扣减，保证并发下不会读到同一批 token。

```java
public final class TokenBucket {
    private final long capacity;
    private final double tokensPerNano;
    private double tokens;
    private long lastRefillNanos;

    public TokenBucket(long capacity, double tokensPerSecond) {
        if (capacity <= 0 || !(tokensPerSecond > 0.0)) {
            throw new IllegalArgumentException("capacity and rate must be positive");
        }
        this.capacity = capacity;
        this.tokensPerNano = tokensPerSecond / 1_000_000_000.0;
        this.tokens = capacity;
        this.lastRefillNanos = System.nanoTime();
    }

    public synchronized boolean tryAcquire(long permits) {
        if (permits <= 0 || permits > capacity) {
            throw new IllegalArgumentException("invalid permits");
        }
        refill();
        if (tokens < permits) return false;
        tokens -= permits;
        return true;
    }

    private void refill() {
        long now = System.nanoTime();
        long elapsed = now - lastRefillNanos;
        if (elapsed <= 0) return;
        tokens = Math.min(capacity, tokens + elapsed * tokensPerNano);
        lastRefillNanos = now;
    }
}
```

> **深入追问：** 每次获取 O(1)、空间 O(1)。不变量是 `0 <= tokens <= capacity`，同一时刻成功扣减总量不超过已有 token；nanoTime 用于时长，不受系统时间回拨影响。测试要用可注入 FakeTicker 替代真实 sleep，覆盖初始突发、长期空闲封顶、并发总成功数和 `permits > capacity` 快速失败。
>
> **易错点：** 我不会用 currentTimeMillis 直接承诺单调，也不会让请求无限排队。这个实现只限单进程，集群总配额要放网关或共享原子存储，并说明时钟与故障语义。

### Q096：手写进程内幂等执行器，怎样处理同 Key 不同请求和并发等待？

> **口语化回答：** 我会用 `putIfAbsent` 原子决定一个 key 的 owner，Entry 同时保存请求摘要和 CompletableFuture。第一个线程执行副作用并完成 Future，其他同摘要请求等待同一个结果；同 key 不同摘要立即冲突，避免错误复用结果。

```java
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

public final class IdempotentExecutor<R> {
    private static final class Entry<R> {
        final String requestHash;
        final CompletableFuture<R> result = new CompletableFuture<>();

        Entry(String requestHash) {
            this.requestHash = requestHash;
        }
    }

    private final ConcurrentHashMap<String, Entry<R>> entries = new ConcurrentHashMap<>();

    public R execute(String key, String requestHash, Supplier<R> action) {
        Objects.requireNonNull(key);
        Objects.requireNonNull(requestHash);
        Objects.requireNonNull(action);

        Entry<R> candidate = new Entry<>(requestHash);
        Entry<R> existing = entries.putIfAbsent(key, candidate);
        Entry<R> selected = existing == null ? candidate : existing;
        if (!selected.requestHash.equals(requestHash)) {
            throw new IllegalStateException("same key with different request");
        }

        if (existing == null) {
            try {
                selected.result.complete(action.get());
            } catch (RuntimeException failure) {
                selected.result.completeExceptionally(failure);
            } catch (Error fatal) {
                selected.result.completeExceptionally(fatal);
                throw fatal;
            }
        }
        try {
            return selected.result.join();
        } catch (CompletionException failure) {
            throw failure;
        }
    }
}
```

> **深入追问：** Map 操作平均 O(1)，等待时间取决于 action。不变量是每个 key 最多一个 owner 执行 action，同 key 同请求看到同一完成结果，同 key 异请求绝不合并。测试用 Barrier 同时启动几十线程，断言 action 计数为 1，并覆盖业务异常结果复用、致命 Error 不被吞、不同 hash 冲突和清理策略。
>
> **易错点：** 我不会把这段代码称为生产跨实例幂等：进程崩溃会丢状态，owner 卡死会让等待无界，Map 还会增长。生产要用数据库唯一约束、状态机、响应快照、租约/超时和过期归档。

### Q097：手写可取消的生产者消费者，关停时怎样避免永久卡住？

> **口语化回答：** 我会让队列有界，Consumer 用带超时的 poll 周期检查 running；close 先把 running 置 false，再 interrupt 唤醒阻塞线程。循环条件是“仍运行或者队列还有任务”，因此正常关停会尽量排空已接收任务，但有总等待上限。

```java
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public final class CancellableConsumer<T> implements AutoCloseable {
    private static final class Item<T> {
        final T value;

        Item(T value) {
            this.value = value;
        }
    }

    private final BlockingQueue<Item<T>> queue;
    private final Consumer<T> handler;
    private final Thread worker;
    private volatile boolean running = true;

    public CancellableConsumer(int capacity, Consumer<T> handler) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity");
        this.queue = new ArrayBlockingQueue<>(capacity);
        this.handler = Objects.requireNonNull(handler);
        this.worker = new Thread(this::runLoop, "cancellable-consumer");
        this.worker.start();
    }

    public boolean submit(T task, Duration timeout) throws InterruptedException {
        Item<T> item = new Item<>(Objects.requireNonNull(task));
        if (!running) return false;
        boolean offered = queue.offer(item, timeout.toNanos(), TimeUnit.NANOSECONDS);
        if (offered && !running && queue.remove(item)) return false;
        return offered;
    }

    private void runLoop() {
        while (running || !queue.isEmpty()) {
            try {
                Item<T> item = queue.poll(100, TimeUnit.MILLISECONDS);
                if (item != null) handler.accept(item.value);
            } catch (InterruptedException interrupted) {
                // close() 会先把 running 设为 false；其他中断只用于唤醒本轮等待。
            } catch (RuntimeException taskFailure) {
                // 生产实现应上报，并按任务语义决定重试或死信。
            }
        }
    }

    @Override
    public void close() {
        running = false;
        worker.interrupt();
        try {
            worker.join(5_000);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
        if (worker.isAlive()) {
            throw new IllegalStateException("worker did not terminate within 5 seconds");
        }
    }
}
```

> **深入追问：** 提交平均 O(1)，空间 O(capacity)。不变量是队列不超过容量，close 后不再有新任务被可靠接受，已返回 true 的任务要么被 handler 处理，要么由更高层持久状态恢复。测试覆盖队列满超时、空队列关停、handler 抛异常、提交与 close 竞态、close 调用线程被中断。
>
> **易错点：** 我不会承诺这段进程内代码崩溃不丢任务，也不会吞掉关停超时。真正关键任务要先落数据库/MQ，handler 必须幂等；这里演示的是取消协议，不是可靠任务平台。

### Q098：手写一个 `DelayQueue` 重试调度器，怎样保证退避有上限且不热循环？

> **口语化回答：** 我会把任务包装成实现 Delayed 的条目，保存 attempt 和基于 nanoTime 的到期时间。Worker 从 DelayQueue `take()`，只有到期任务才返回；失败后按指数退避计算下一次时间，超过最大次数进入失败回调，不在 catch 里立即 while 重试。

```java
import java.util.Objects;
import java.util.concurrent.DelayQueue;
import java.util.concurrent.Delayed;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public final class RetryScheduler<T> implements AutoCloseable {
    private record Retry<T>(T task, int attempt, long dueNanos) implements Delayed {
        @Override
        public long getDelay(TimeUnit unit) {
            return unit.convert(dueNanos - System.nanoTime(), TimeUnit.NANOSECONDS);
        }

        @Override
        public int compareTo(Delayed other) {
            return Long.compare(dueNanos, ((Retry<?>) other).dueNanos);
        }
    }

    private final DelayQueue<Retry<T>> queue = new DelayQueue<>();
    private final Consumer<T> action;
    private final Consumer<T> exhausted;
    private final int maxAttempts;
    private final long baseDelayNanos;
    private final Thread worker;
    private volatile boolean running = true;

    public RetryScheduler(Consumer<T> action, Consumer<T> exhausted,
                          int maxAttempts, long baseDelay, TimeUnit unit) {
        if (maxAttempts <= 0 || baseDelay <= 0) throw new IllegalArgumentException();
        this.action = Objects.requireNonNull(action);
        this.exhausted = Objects.requireNonNull(exhausted);
        this.maxAttempts = maxAttempts;
        this.baseDelayNanos = unit.toNanos(baseDelay);
        this.worker = new Thread(this::runLoop, "retry-scheduler");
        this.worker.start();
    }

    public void submit(T task) {
        if (!running) throw new IllegalStateException("closed");
        Retry<T> item = new Retry<>(Objects.requireNonNull(task), 1, System.nanoTime());
        queue.put(item);
        if (!running && queue.remove(item)) throw new IllegalStateException("closed");
    }

    private void runLoop() {
        while (running || !queue.isEmpty()) {
            try {
                Retry<T> item = queue.take();
                try {
                    action.accept(item.task());
                } catch (RuntimeException failure) {
                    if (item.attempt() >= maxAttempts) {
                        try {
                            exhausted.accept(item.task());
                        } catch (RuntimeException callbackFailure) {
                            // 必须告警并持久化补偿，不能让失败回调杀死唯一 Worker。
                        }
                    } else {
                        int shift = Math.min(item.attempt() - 1, 20);
                        long maxDelay = TimeUnit.MINUTES.toNanos(5);
                        long multiplier = 1L << shift;
                        long delay = baseDelayNanos > maxDelay / multiplier
                                ? maxDelay : baseDelayNanos * multiplier;
                        Retry<T> next = new Retry<>(item.task(), item.attempt() + 1,
                                System.nanoTime() + delay);
                        if (running) {
                            queue.put(next);
                            if (!running) queue.remove(next);
                        }
                    }
                }
            } catch (InterruptedException interrupted) {
                // close() 清空队列后用中断唤醒 take()；不恢复标记，避免忙循环。
            }
        }
    }

    @Override
    public synchronized void close() {
        if (!running) return;
        running = false;
        queue.clear();
        worker.interrupt();
        try {
            worker.join(5_000);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
        if (worker.isAlive()) {
            throw new IllegalStateException("worker did not terminate within 5 seconds");
        }
    }
}
```

> **深入追问：** 入队 O(log n)，取到期头部 O(log n)，空间 O(n)。不变量是 attempt 单调递增且不超过 maxAttempts，同一失败分支只产生一个后继条目，delay 有上限。测试最好注入 Clock/DelayPolicy，覆盖首次立即执行、退避序列、上限、exhausted 一次和关停时未来任务策略。
>
> **易错点：** 我不会把所有异常都重试，也不会把这段内存队列说成重启可恢复。示例为了保住 Worker 捕获了失败回调的 `RuntimeException`，生产不能只写一条日志后丢掉任务，而要把死信状态持久化并告警。生产还应持久化 attempt/dueAt/eventId，加抖动、防重复领取和幂等；位移计算也要防溢出。

### Q099：手写按业务 Key 保序的执行器，怎样避免全局串行？

> **口语化回答：** 我会用固定数量的单线程 Stripe。相同 key 永远哈希到同一 Stripe，所以提交顺序就是执行顺序；不同 Stripe 可以并行。它牺牲了一点不同 key 碰到同一 Stripe 时的并行度，换来实现简单且没有每 key 队列泄漏。

```java
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public final class KeyOrderedExecutor implements AutoCloseable {
    private final ExecutorService[] stripes;

    public KeyOrderedExecutor(int stripeCount) {
        if (stripeCount <= 0) throw new IllegalArgumentException("stripeCount");
        this.stripes = new ExecutorService[stripeCount];
        for (int i = 0; i < stripeCount; i++) {
            int stripe = i;
            stripes[i] = Executors.newSingleThreadExecutor(r ->
                    new Thread(r, "key-stripe-" + stripe));
        }
    }

    public void execute(Object key, Runnable task) {
        Objects.requireNonNull(key);
        Objects.requireNonNull(task);
        int index = Math.floorMod(spread(key.hashCode()), stripes.length);
        stripes[index].execute(task);
    }

    private static int spread(int hash) {
        return hash ^ (hash >>> 16);
    }

    @Override
    public void close() {
        for (ExecutorService stripe : stripes) stripe.shutdown();
        for (ExecutorService stripe : stripes) {
            try {
                if (!stripe.awaitTermination(5, TimeUnit.SECONDS)) stripe.shutdownNow();
            } catch (InterruptedException interrupted) {
                stripe.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}
```

> **深入追问：** 路由 O(1)，空间 O(stripe 数加排队任务)。不变量是相同 key 映射稳定、同 Stripe 单 Worker、因此同 key 按 submit 顺序执行。测试为多个 key 各提交递增序号并断言每 key 有序，同时确认不同 Stripe 可并行；还要覆盖负 hash、`Integer.MIN_VALUE` 和任务异常后线程继续工作。
>
> **易错点：** 我不会直接使用 `Math.abs(hash) % n`，MIN_VALUE 仍是负数；也不会用无界队列承接无限流量。生产要替换成有界单线程池并定义拒绝、热点 key 和扩 Stripe 时顺序迁移策略。

### Q100：手写一个有界线程池，怎样协调接收、执行、关停和拒绝？

> **口语化回答：** 我会固定 Worker 数和有界队列，execute 用 offer 快速决定接收或拒绝；关停时先原子禁止新提交，再中断 Worker 唤醒阻塞 poll，Worker 在“仍运行或队列未空”条件下排空任务。普通业务 `RuntimeException` 只结束当前任务，不能杀掉整个 Worker；`OutOfMemoryError` 这类致命错误不能被线程池悄悄吞掉。

```java
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public final class SmallBoundedPool implements AutoCloseable {
    private final BlockingQueue<Runnable> queue;
    private final List<Thread> workers = new ArrayList<>();
    private final AtomicBoolean running = new AtomicBoolean(true);
    private final Object lifecycle = new Object();

    public SmallBoundedPool(int workerCount, int queueCapacity) {
        if (workerCount <= 0 || queueCapacity <= 0) throw new IllegalArgumentException();
        this.queue = new ArrayBlockingQueue<>(queueCapacity);
        for (int i = 0; i < workerCount; i++) {
            Thread worker = new Thread(this::runWorker, "small-pool-" + i);
            workers.add(worker);
            worker.start();
        }
    }

    public void execute(Runnable task) {
        Objects.requireNonNull(task);
        synchronized (lifecycle) {
            if (!running.get()) throw new RejectedExecutionException("pool is closed");
            if (!queue.offer(task)) throw new RejectedExecutionException("queue is full");
        }
    }

    private void runWorker() {
        while (running.get() || !queue.isEmpty()) {
            try {
                Runnable task = queue.poll(100, TimeUnit.MILLISECONDS);
                if (task != null) {
                    try {
                        task.run();
                    } catch (RuntimeException taskFailure) {
                        // 生产实现要记录任务标识、异常分类和失败指标。
                    }
                }
            } catch (InterruptedException interrupted) {
                // close() 会改变状态并中断 poll；其他中断只唤醒本轮等待。
            }
        }
    }

    @Override
    public void close() {
        synchronized (lifecycle) {
            if (!running.compareAndSet(true, false)) return;
        }
        for (Thread worker : workers) worker.interrupt();
        for (Thread worker : workers) {
            try {
                worker.join(5_000);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        if (workers.stream().anyMatch(Thread::isAlive)) {
            throw new IllegalStateException("workers did not terminate within 5 seconds");
        }
    }
}
```

> **深入追问：** 提交平均 O(1)，空间 O(worker+capacity)。不变量是接受队列永不超过容量、close 的线性化点之后没有新任务被成功接受、Worker 最多并发 workerCount 个。测试覆盖满队列拒绝、任务抛 `RuntimeException` 后继续、致命 `Error` 不被吞、execute-close 竞态、重复 close、关停排空、关停超时和调用方中断。
>
> **易错点：** 我不会把这份教学实现替代 ThreadPoolExecutor：它没有 Future、动态线程、Worker 异常退出后的自动补位、超时任务取消、完整统计和成熟状态机。关键业务也不能只存在内存队列；可靠性仍要数据库或 MQ 收口。

## 七、学习与面试使用顺序

1. **第一轮先建立主链路**：Q001-Q025 只要求能从入口方法讲到关键状态和并发不变量，不背源码行号。
2. **第二轮连框架调用栈**：Q026-Q040 要能把 Spring 代理、事务、MVC 与 MyBatis JDBC 链路在白板上串起来，并主动说明自调用、跨线程和缓存边界。
3. **第三轮按故障语义学中间件**：MySQL 先学 WAL/MVCC/锁，再学复制与恢复；Redis 先学事件循环/持久化，再学复制与 Cluster；Kafka 先学 Partition/副本，再学消费、事务和重放。
4. **第四轮手写并证明**：Q091-Q100 不只默写代码，每次都口述复杂度、不变量、线性化点、取消语义和边界测试。
5. **最后做连续追问演练**：每题按“结论 -> 入口 -> 状态 -> 竞态 -> 故障 -> 版本边界 -> 当前项目事实边界”回答。没有内部记录证明的投产、指标和事故一律不补造。
