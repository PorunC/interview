# TypeScript / React 现场编码与故障面试题

> 定位：这 40 题用于补齐现有前端题库的“可执行代码、故障复现、系统设计”三层能力，不代表任何一家公司已经问过这些原题。真实面试只问过其中少量 React 基础和全栈边界，不能把演练题说成真实面经。
>
> 运行口径：Q001-Q013 的每个 TypeScript 代码块都按独立文件编写，可用 `tsx q001.ts` 运行，或用 `tsc --target ES2022 --module commonjs --lib ES2022,DOM q001.ts` 编译后执行。Q014-Q016 分别涉及流式协议、Worker 和类型编译检查。React 示例是最小复现或修复方案，当前 CodeWiki 没有前端测试脚本，不能把文中的 Vitest、Testing Library、Playwright、SSE、Worker 或可观测方案说成当前已上线能力。
>
> 现场顺序：我会先澄清输入、输出、错误和取消语义，再说不变量，随后写代码和测试，最后补复杂度、生产边界与项目事实。代码能运行不等于已经达到生产标准。

## 一、TypeScript / JavaScript 完整手写题（Q001-Q016）

### Q001. Event Loop 输出顺序：同步代码、Promise、`queueMicrotask`、`await` 和 Timer 怎样排？

**口语化回答：**

> 我不会凭印象背输出。我先执行完整个同步调用栈；遇到 Promise 回调、`queueMicrotask` 和 `await` 后续就按入队顺序进入微任务；当前 Task 结束后清空微任务，再进入 Timer 对应的后续 Task。微任务执行期间新加入的微任务也要在进入下一个 Task 前清空。浏览器可能在 Task 之间安排渲染，但不会在一段同步 JavaScript 中间强行绘制。

**完整代码：**

```ts
function assertDeepEqual(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(`expected ${right}, got ${left}`);
  }
}

const output: string[] = [];

output.push("sync-1");

setTimeout(() => {
  output.push("timer");
}, 0);

Promise.resolve().then(() => {
  output.push("promise-1");
  queueMicrotask(() => output.push("microtask-inner"));
});

queueMicrotask(() => output.push("microtask-1"));

void (async () => {
  output.push("async-start");
  await null;
  output.push("async-resume");
})();

output.push("sync-2");

setTimeout(() => {
  assertDeepEqual(output, [
    "sync-1",
    "async-start",
    "sync-2",
    "promise-1",
    "microtask-1",
    "async-resume",
    "microtask-inner",
    "timer",
  ]);
  console.log("Q001 passed", output);
}, 0);
```

**测试要点：** 我会继续换成 Promise 回调里抛错、Timer 里再排微任务、连续两个 `await`，每次都画“同步栈 + 入队顺序”，而不是记某一道题的固定答案。

**复杂度与易错点：** 调度题不以算法复杂度为重点。最常见错误是把 `await` 后续当成同步代码、以为微任务只清一批，或者把 Node.js 不同阶段的细节直接套到浏览器。

**事实边界：** 这是 JavaScript 运行时演练，不是 CodeWiki 当前故障案例。

### Q002. 手写支持 `leading`、`trailing`、`cancel` 和 `flush` 的 debounce

**口语化回答：**

> 我先确认语义：默认只在停止调用一段时间后执行最后一次；`leading` 表示一轮开始时立即执行；`trailing` 表示安静窗口结束时执行最后一次；`cancel` 清掉待执行任务；`flush` 立即执行待执行的最后一次。实现时必须保留最后一次参数和 `this`，不能只包一层 `setTimeout`。

**完整代码：**

```ts
type AnyFunction = (this: unknown, ...args: any[]) => unknown;

type Debounced<F extends AnyFunction> = {
  (this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined;
  cancel(): void;
  flush(): ReturnType<F> | undefined;
};

function debounce<F extends AnyFunction>(
  fn: F,
  waitMs: number,
  options: { leading?: boolean; trailing?: boolean } = {},
): Debounced<F> {
  if (!Number.isFinite(waitMs) || waitMs < 0) {
    throw new RangeError("waitMs must be a non-negative finite number");
  }

  const leading = options.leading ?? false;
  const trailing = options.trailing ?? true;
  if (!leading && !trailing) {
    throw new Error("leading and trailing cannot both be false");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<F> | undefined;
  let lastThis: ThisParameterType<F> | undefined;
  let result: ReturnType<F> | undefined;

  const clearPending = (): void => {
    lastArgs = undefined;
    lastThis = undefined;
  };

  const invoke = (): ReturnType<F> => {
    const args = lastArgs as Parameters<F>;
    const receiver = lastThis as ThisParameterType<F>;
    clearPending();
    result = fn.apply(receiver, args) as ReturnType<F>;
    return result;
  };

  const onTimer = (): void => {
    timer = undefined;
    if (trailing && lastArgs) {
      invoke();
    } else {
      clearPending();
    }
  };

  const wrapped = function (
    this: ThisParameterType<F>,
    ...args: Parameters<F>
  ): ReturnType<F> | undefined {
    const shouldInvokeLeading = timer === undefined && leading;
    lastArgs = args;
    lastThis = this;

    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(onTimer, waitMs);

    return shouldInvokeLeading ? invoke() : result;
  } as Debounced<F>;

  wrapped.cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    clearPending();
  };

  wrapped.flush = (): ReturnType<F> | undefined => {
    if (timer === undefined) return result;
    clearTimeout(timer);
    timer = undefined;
    if (trailing && lastArgs) return invoke();
    clearPending();
    return result;
  };

  return wrapped;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const calls: string[] = [];
  const save = debounce((value: string) => {
    calls.push(value);
    return value.toUpperCase();
  }, 10);

  save("a");
  save("b");
  await sleep(25);
  if (JSON.stringify(calls) !== JSON.stringify(["b"])) throw new Error("trailing failed");

  save("cancelled");
  save.cancel();
  await sleep(15);
  if (calls.includes("cancelled")) throw new Error("cancel failed");

  save("flushed");
  if (save.flush() !== "FLUSHED") throw new Error("flush failed");
  console.log("Q002 passed", calls);
}

void main();
```

**测试要点：** 正式测试应用 Fake Timer 验证连续调用、首尾触发组合、`this`、返回值、取消、Flush 和零等待时间，避免真实时间导致用例抖动。

**复杂度与易错点：** 每次调用时间和额外空间都是 `O(1)`。易错点是 leading 执行后又无条件 trailing 一次、取消后残留参数、箭头包装器丢失动态 `this`。

**事实边界：** 这是通用手写题；CodeWiki 当前搜索是否需要 debounce 要以真实 Profile 为准。

### Q003. 手写支持首尾触发、取消和 Flush 的 throttle

**口语化回答：**

> throttle 的核心是一个时间窗口最多执行一次，而 debounce 是等调用安静下来。我要明确首触发和尾触发语义：窗口内的新调用不立即执行，但可以保留最后一次参数，在剩余时间结束后补一次。系统时间可能跳变，所以生产代码可注入单调时钟；面试实现先把窗口不变量写正确。

**完整代码：**

```ts
type Fn = (this: unknown, ...args: any[]) => unknown;

type Throttled<F extends Fn> = {
  (this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined;
  cancel(): void;
  flush(): ReturnType<F> | undefined;
};

function throttle<F extends Fn>(
  fn: F,
  waitMs: number,
  options: { leading?: boolean; trailing?: boolean } = {},
): Throttled<F> {
  if (!Number.isFinite(waitMs) || waitMs < 0) throw new RangeError("invalid waitMs");
  const leading = options.leading ?? true;
  const trailing = options.trailing ?? true;
  if (!leading && !trailing) throw new Error("leading and trailing cannot both be false");

  let lastInvokeAt: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<F> | undefined;
  let lastThis: ThisParameterType<F> | undefined;
  let result: ReturnType<F> | undefined;

  const invoke = (now: number): ReturnType<F> => {
    lastInvokeAt = now;
    const args = lastArgs as Parameters<F>;
    const receiver = lastThis as ThisParameterType<F>;
    lastArgs = undefined;
    lastThis = undefined;
    result = fn.apply(receiver, args) as ReturnType<F>;
    return result;
  };

  const scheduleTrailing = (remaining: number): void => {
    if (!trailing || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (lastArgs) invoke(Date.now());
      else if (!leading) lastInvokeAt = undefined;
    }, remaining);
  };

  const wrapped = function (
    this: ThisParameterType<F>,
    ...args: Parameters<F>
  ): ReturnType<F> | undefined {
    const now = Date.now();
    lastArgs = args;
    lastThis = this;

    if (lastInvokeAt === undefined) {
      if (leading) return invoke(now);
      lastInvokeAt = now;
    }

    const remaining = waitMs - (now - lastInvokeAt);
    if (remaining <= 0 || remaining > waitMs) {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      return invoke(now);
    }

    scheduleTrailing(remaining);
    return result;
  } as Throttled<F>;

  wrapped.cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    lastInvokeAt = undefined;
    lastArgs = undefined;
    lastThis = undefined;
  };

  wrapped.flush = (): ReturnType<F> | undefined => {
    if (!trailing) {
      lastArgs = undefined;
      lastThis = undefined;
      return result;
    }
    if (timer === undefined) return result;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    return lastArgs ? invoke(Date.now()) : result;
  };

  return wrapped;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const calls: number[] = [];
  const limited = throttle((value: number) => {
    calls.push(value);
    return value;
  }, 15);

  limited(1);
  limited(2);
  limited(3);
  await delay(30);
  if (JSON.stringify(calls) !== JSON.stringify([1, 3])) throw new Error("throttle failed");

  limited(4); // Leading call executes immediately.
  limited(5); // This trailing call is still pending and can be cancelled.
  limited.cancel();
  await delay(20);
  if (calls.includes(5)) throw new Error("cancel failed");

  const noTrailingCalls: number[] = [];
  const noTrailing = throttle((value: number) => noTrailingCalls.push(value), 15, {
    trailing: false,
  });
  noTrailing(1);
  noTrailing(2);
  noTrailing.flush();
  if (JSON.stringify(noTrailingCalls) !== JSON.stringify([1])) {
    throw new Error("flush must respect trailing=false");
  }
  console.log("Q003 passed", calls);
}

void main();
```

**测试要点：** 用 Fake Timer 验证持续高频调用、leading/trailing 四种有效组合、边界时刻、取消和 Flush；真实时间测试只作为示例。

**复杂度与易错点：** 单次调用 `O(1)`。最容易错的是窗口内反复创建 Timer、尾触发使用了第一次而非最后一次参数，以及取消后没有重置窗口。

**事实边界：** 这是一道语言手写题，不代表当前项目已经有统一 throttle 工具。

### Q004. 不调用原生 `Promise.all`，手写保持顺序且快速失败的版本

**口语化回答：**

> 我会守住三个语义：空输入立即 Fulfill；普通值也通过 `Promise.resolve` 吸收；结果按输入位置保存，不按完成顺序保存；任意一个拒绝时外层 Promise 立即拒绝。快速失败只代表调用方先收到拒绝，其他已经启动的 Promise 不会被自动取消。

**完整代码：**

```ts
type AwaitedTuple<T extends readonly unknown[]> = {
  -readonly [K in keyof T]: Awaited<T[K]>;
};

function myPromiseAll<T extends readonly unknown[]>(
  values: readonly [...T],
): Promise<AwaitedTuple<T>> {
  return new Promise((resolve, reject) => {
    if (values.length === 0) {
      resolve([] as unknown as AwaitedTuple<T>);
      return;
    }

    const results: unknown[] = new Array(values.length);
    let completed = 0;

    values.forEach((value, index) => {
      Promise.resolve(value).then(
        (resolved) => {
          results[index] = resolved;
          completed += 1;
          if (completed === values.length) {
            resolve(results as AwaitedTuple<T>);
          }
        },
        reject,
      );
    });
  });
}

async function main(): Promise<void> {
  const result = await myPromiseAll([
    new Promise<number>((resolve) => setTimeout(() => resolve(1), 15)),
    2,
    Promise.resolve("three"),
  ] as const);

  if (JSON.stringify(result) !== JSON.stringify([1, 2, "three"])) {
    throw new Error("order was not preserved");
  }

  const empty = await myPromiseAll([] as const);
  if (empty.length !== 0) throw new Error("empty input failed");

  let rejected = false;
  try {
    await myPromiseAll([Promise.resolve(1), Promise.reject(new Error("boom"))]);
  } catch (error) {
    rejected = error instanceof Error && error.message === "boom";
  }
  if (!rejected) throw new Error("rejection was not propagated");
  console.log("Q004 passed", result);
}

void main();
```

**测试要点：** 我会测空数组、普通值、Thenable、乱序完成、首个拒绝和多个拒绝。若题目要求全部结果，则应该实现 `allSettled`，不能偷偷改变 `Promise.all` 语义。

**复杂度与易错点：** 时间取决于最慢任务，管理开销 `O(n)`，结果空间 `O(n)`。易错点是按完成顺序 `push`、忘记空数组，以及声称 Reject 会取消其他 Promise。

**事实边界：** 这是 Promise 语义练习，不是项目自研 Promise 库。

### Q005. 手写限制并发数、保持结果顺序并支持取消的 Promise Pool

**口语化回答：**

> 我不会先把全部任务变成 Promise，那样已经失去限流意义。我只启动不超过 `limit` 个 Runner，每个 Runner 同步领取下一个下标，完成后再领取；结果写回原下标。任何任务失败后停止领取新任务，但已经开始的任务只能靠共享的 AbortSignal 协作取消。

**完整代码：**

```ts
function makeAbortError(reason?: unknown): Error {
  const error = reason instanceof Error ? reason : new Error(String(reason ?? "aborted"));
  error.name = "AbortError";
  return error;
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number, signal?: AbortSignal) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError("limit must be a positive integer");
  }
  if (signal?.aborted) throw makeAbortError(signal.reason);
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let stopped = false;

  const run = async (): Promise<void> => {
    while (!stopped) {
      if (signal?.aborted) {
        stopped = true;
        throw makeAbortError(signal.reason);
      }

      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;

      try {
        const value = await mapper(items[index], index, signal);
        if (signal?.aborted) {
          stopped = true;
          throw makeAbortError(signal.reason);
        }
        results[index] = value;
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  };

  const runnerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: runnerCount }, () => run()));
  return results;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  let active = 0;
  let maxActive = 0;
  const result = await mapLimit([30, 5, 20, 10], 2, async (ms, index) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await sleep(ms);
    active -= 1;
    return `item-${index}`;
  });

  if (maxActive !== 2) throw new Error(`expected concurrency 2, got ${maxActive}`);
  if (JSON.stringify(result) !== JSON.stringify(["item-0", "item-1", "item-2", "item-3"])) {
    throw new Error("result order failed");
  }
  console.log("Q005 passed", { maxActive, result });
}

void main();
```

**测试要点：** 测 `limit=1`、大于任务数、非法 limit、空输入、乱序完成、失败后不领取新任务、取消和 Mapper 同步抛错。并发测试要统计实时 `active` 峰值。

**复杂度与易错点：** 调度开销 `O(n)`，结果空间 `O(n)`，同时运行任务最多 `O(limit)`。快速失败不等于已经运行的外部副作用回滚，Mapper 必须真的使用 Signal。

**事实边界：** 这是前端和 Node 都常见的通用限流实现，不代表 CodeWiki 当前请求层采用了它。

### Q006. 手写带整体 Deadline、单次超时、指数退避、Jitter 和取消的重试器

**口语化回答：**

> 我先问这个操作是否幂等，哪些错误可重试。整体 Deadline 是用户愿意等待的总预算，不是每次重试都重新获得完整时间；每次尝试只能使用剩余预算。超时后我既让调用方停止等待，也 Abort 底层；但如果底层忽略 Signal，副作用仍可能继续，所以写操作还需要 Idempotency Key 和状态查询。

**完整代码：**

```ts
type RetryOptions = {
  maxAttempts: number;
  deadlineMs: number;
  attemptTimeoutMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
  signal?: AbortSignal;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  random?: () => number;
};

function abortError(reason?: unknown): Error {
  const error = reason instanceof Error ? reason : new Error(String(reason ?? "aborted"));
  error.name = "AbortError";
  return error;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal.reason));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError(signal?.reason));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function retryWithDeadline<T>(
  operation: (signal: AbortSignal, attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts <= 0) {
    throw new RangeError("maxAttempts must be positive");
  }
  if (options.deadlineMs <= 0 || options.attemptTimeoutMs <= 0) {
    throw new RangeError("timeouts must be positive");
  }

  const startedAt = Date.now();
  const deadlineAt = startedAt + options.deadlineMs;
  const random = options.random ?? Math.random;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw abortError(options.signal.reason);
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) throw new Error("deadline exceeded", { cause: lastError });

    const controller = new AbortController();
    let forwardAbort: (() => void) | undefined;
    const externalAbortPromise = new Promise<never>((_, reject) => {
      if (!options.signal) return;
      forwardAbort = () => {
        const error = abortError(options.signal?.reason);
        controller.abort(error);
        reject(error);
      };
      options.signal.addEventListener("abort", forwardAbort, { once: true });
    });

    const attemptBudget = Math.min(options.attemptTimeoutMs, remaining);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        const error = new Error(`attempt ${attempt} timed out`);
        controller.abort(error);
        reject(error);
      }, attemptBudget);
    });

    try {
      return await Promise.race([
        operation(controller.signal, attempt),
        timeoutPromise,
        externalAbortPromise,
      ]);
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) throw abortError(options.signal.reason);
      if (attempt === options.maxAttempts || !shouldRetry(error, attempt)) throw error;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (forwardAbort) options.signal?.removeEventListener("abort", forwardAbort);
    }

    const afterAttempt = deadlineAt - Date.now();
    if (afterAttempt <= 0) throw new Error("deadline exceeded", { cause: lastError });
    const exponential = Math.min(
      options.maxDelayMs,
      options.baseDelayMs * 2 ** (attempt - 1),
    );
    const fullJitterDelay = Math.floor(random() * exponential);
    await sleep(Math.min(fullJitterDelay, afterAttempt), options.signal);
  }

  throw new Error("unreachable", { cause: lastError });
}

async function main(): Promise<void> {
  let calls = 0;
  const value = await retryWithDeadline(
    async (_signal, attempt) => {
      calls += 1;
      if (attempt < 3) throw new Error("temporary");
      return "ok";
    },
    {
      maxAttempts: 4,
      deadlineMs: 1_000,
      attemptTimeoutMs: 100,
      baseDelayMs: 5,
      maxDelayMs: 20,
      random: () => 0,
    },
  );
  if (value !== "ok" || calls !== 3) throw new Error("retry failed");

  const external = new AbortController();
  const cancelled = retryWithDeadline(
    async () => new Promise<string>(() => undefined),
    {
      maxAttempts: 2,
      deadlineMs: 1_000,
      attemptTimeoutMs: 500,
      baseDelayMs: 1,
      maxDelayMs: 1,
      signal: external.signal,
    },
  );
  external.abort(new Error("stop now"));
  try {
    await cancelled;
    throw new Error("external cancellation should reject immediately");
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") throw error;
  }
  console.log("Q006 passed", { value, calls });
}

void main();
```

**测试要点：** 注入 Clock 和 Random 后测试首次成功、最终成功、不可重试错误、总 Deadline、单次超时、外部取消和 Retry-After。测试还要证明超时后不会再启动超出预算的新尝试。

**复杂度与易错点：** 最多调用 `O(maxAttempts)` 次，额外空间 `O(1)`。`Promise.race` 只停止等待，只有操作协作响应 Signal 才是真取消；不能对支付、创建任务等非幂等请求盲目重试。

**事实边界：** 这是通用迁移实现，不代表当前三个项目已共享同一 Deadline/Retry 库。

### Q007. 手写带运行时校验和错误分类的类型安全 `fetchJson`

**口语化回答：**

> 泛型 `T` 只约束编译期，服务端返回什么仍然是 `unknown`。我会先检查 HTTP 状态和 Content-Type，再解析 JSON，最后交给运行时 Schema；网络错误、HTTP 错误、响应格式错误、业务校验错误和主动取消要能区分。Secret 不应该因为写进 TypeScript 类型就放到浏览器。

**完整代码：**

```ts
interface Schema<T> {
  parse(value: unknown): T;
}

interface ResponseLike {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<ResponseLike>;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "HttpError";
  }
}

class DecodeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DecodeError";
  }
}

async function fetchJson<T>(
  url: string,
  schema: Schema<T>,
  options: {
    fetchImpl: FetchLike;
    signal?: AbortSignal;
    timeoutMs?: number;
    headers?: Record<string, string>;
  },
): Promise<T> {
  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
  ) {
    throw new RangeError("timeoutMs must be positive when provided");
  }
  const controller = new AbortController();
  const forwardAbort = (): void => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) controller.abort(options.signal.reason);
  options.signal?.addEventListener("abort", forwardAbort, { once: true });

  const timeout = options.timeoutMs === undefined
    ? undefined
    : setTimeout(() => controller.abort(new Error("request timed out")), options.timeoutMs);

  try {
    const response = await options.fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", ...options.headers },
    });
    if (!response.ok) throw new HttpError(response.status, response.statusText);

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("+json")) {
      throw new DecodeError(`expected JSON, got ${contentType || "unknown content type"}`);
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      throw new DecodeError("invalid JSON body", { cause: error });
    }

    try {
      return schema.parse(raw);
    } catch (error) {
      throw new DecodeError("response schema mismatch", { cause: error });
    }
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}

type Repository = { id: string; name: string };

const repositorySchema: Schema<Repository> = {
  parse(value: unknown): Repository {
    if (
      typeof value !== "object" || value === null ||
      typeof (value as Record<string, unknown>).id !== "string" ||
      typeof (value as Record<string, unknown>).name !== "string"
    ) {
      throw new TypeError("invalid repository");
    }
    return value as Repository;
  },
};

async function main(): Promise<void> {
  const mockFetch: FetchLike = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "application/json; charset=utf-8" },
    json: async () => ({ id: "repo-1", name: "CodeWiki" }),
  });

  const repository = await fetchJson("/api/repos/1", repositorySchema, {
    fetchImpl: mockFetch,
    timeoutMs: 100,
  });
  if (repository.id !== "repo-1") throw new Error("decode failed");
  console.log("Q007 passed", repository);
}

void main();
```

**测试要点：** Mock Fetch 覆盖网络拒绝、非 2xx、204、错误 Content-Type、坏 JSON、Schema 不匹配、超时和外部取消。还要验证 Listener 和 Timer 在所有分支都清理。

**复杂度与易错点：** 除响应解析外管理开销 `O(1)`，解析和校验通常是 `O(payload size)`。易错点是看到 `response.ok` 就直接 `as T`、把 HTTP 404 当网络异常，以及只用 `Promise.race` 不 Abort Fetch。

**事实边界：** CodeWiki 当前有手写 DTO，但不能据此声称已接入 Zod、生成 Client 或完整运行时 Schema。

### Q008. 手写类型安全的 EventEmitter，支持 `on`、`off`、`once` 和安全遍历

**口语化回答：**

> 我用事件到 Listener Set 的映射，公开 API 通过事件参数元组保证类型。Emit 时先复制快照，这样监听器在回调中取消自己或新增监听器，不会破坏本轮遍历。我要提前约定监听器抛错是立即传播、继续其他监听器还是聚合错误；下面采用立即传播。

**完整代码：**

```ts
type Listener<Args extends readonly unknown[]> = (...args: Args) => void;

class TypedEmitter<Events extends { [K in keyof Events]: readonly unknown[] }> {
  private readonly listeners = new Map<keyof Events, Set<Listener<any>>>();
  private readonly onceWrappers = new Map<
    keyof Events,
    Map<Listener<any>, Set<Listener<any>>>
  >();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<any>);
    return () => this.removeExact(event, listener as Listener<any>);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    const original = listener as Listener<any>;
    this.removeExact(event, original);
    const byOriginal = this.onceWrappers.get(event);
    const wrappers = byOriginal?.get(original);
    if (!wrappers) return;
    for (const wrapper of wrappers) this.removeExact(event, wrapper);
    byOriginal?.delete(original);
    if (byOriginal?.size === 0) this.onceWrappers.delete(event);
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const original = listener as Listener<any>;
    let active = true;
    const wrapper: Listener<Events[K]> = (...args) => {
      unsubscribe();
      listener(...args);
    };

    let byOriginal = this.onceWrappers.get(event);
    if (!byOriginal) {
      byOriginal = new Map();
      this.onceWrappers.set(event, byOriginal);
    }
    let wrappers = byOriginal.get(original);
    if (!wrappers) {
      wrappers = new Set();
      byOriginal.set(original, wrappers);
    }
    wrappers.add(wrapper as Listener<any>);
    this.on(event, wrapper);

    const unsubscribe = (): void => {
      if (!active) return;
      active = false;
      this.removeExact(event, wrapper as Listener<any>);
      const current = this.onceWrappers.get(event);
      current?.get(original)?.delete(wrapper as Listener<any>);
      if (current?.get(original)?.size === 0) current.delete(original);
      if (current?.size === 0) this.onceWrappers.delete(event);
    };
    return unsubscribe;
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    const snapshot = [...(this.listeners.get(event) ?? [])];
    for (const listener of snapshot) listener(...args);
  }

  clear(event?: keyof Events): void {
    if (event === undefined) {
      this.listeners.clear();
      this.onceWrappers.clear();
    } else {
      this.listeners.delete(event);
      this.onceWrappers.delete(event);
    }
  }

  private removeExact(event: keyof Events, listener: Listener<any>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(event);
  }
}

type AppEvents = {
  progress: [operationId: string, percent: number];
  done: [operationId: string];
};

const emitter = new TypedEmitter<AppEvents>();
const output: string[] = [];
const off = emitter.on("progress", (id, percent) => output.push(`${id}:${percent}`));
emitter.once("done", (id) => output.push(`done:${id}`));
const cancelledOnce = (id: string): void => {
  output.push(`cancelled:${id}`);
};
emitter.once("done", cancelledOnce);
emitter.off("done", cancelledOnce);

emitter.emit("progress", "op-1", 10);
off();
emitter.emit("progress", "op-1", 20);
emitter.emit("done", "op-1");
emitter.emit("done", "op-1");

if (JSON.stringify(output) !== JSON.stringify(["op-1:10", "done:op-1"])) {
  throw new Error(`unexpected events: ${JSON.stringify(output)}`);
}
console.log("Q008 passed", output);
```

**测试要点：** 覆盖重复订阅、取消不存在的 Listener、`once`、回调中自删/新增、嵌套 Emit、清空和监听器抛错语义。若要隔离错误，应明确收集并在本轮结束后抛 `AggregateError`。

**复杂度与易错点：** 普通 `on/off` 平均 `O(1)`；按原 Listener 取消 `once` 是 `O(该 Listener 的 once 注册数)`；Emit 是 `O(listener count)`，快照占同量空间。常见错误是 `once` 无法用原 Listener 取消，以及遍历原 Set 时修改导致语义不稳定。

**事实边界：** 这是通用实现；当前项目的 Store/Listener 结构是否相同要以实际代码为准。

### Q009. 手写带 TTL 的 LRU Cache，不为每个 Key 创建 Timer

**口语化回答：**

> 我把“最近使用”和“是否过期”分开。`Map` 的插入顺序可以维护 LRU：命中后删除再插入，最前面的 Key 最旧；每个 Entry 保存过期时间，在访问和写入时惰性清理。不给每个 Key 建 Timer，避免海量 Timer；如果要求严格准时回收，再设计统一最小堆或 Timing Wheel。

**完整代码：**

```ts
type CacheEntry<V> = { value: V; expiresAt: number };

class TtlLruCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();

  constructor(
    private readonly capacity: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError("invalid capacity");
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError("invalid ttlMs");
  }

  private pruneExpired(): void {
    const current = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= current) this.entries.delete(key);
    }
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    this.pruneExpired();
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });

    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  has(key: K): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  get size(): number {
    this.pruneExpired();
    return this.entries.size;
  }
}

let currentTime = 0;
const cache = new TtlLruCache<string, number>(2, 10, () => currentTime);
cache.set("a", 1);
cache.set("b", 2);
if (cache.get("a") !== 1) throw new Error("get failed");
cache.set("c", 3); // a was refreshed, so b is evicted.
if (cache.get("b") !== undefined || cache.get("c") !== 3) throw new Error("LRU failed");
currentTime = 11;
if (cache.get("a") !== undefined || cache.size !== 0) throw new Error("TTL failed");

const unusualKeyCache = new TtlLruCache<string | undefined, string>(1, 10, () => currentTime);
unusualKeyCache.set(undefined, "first");
unusualKeyCache.set("next", "second");
if (unusualKeyCache.size !== 1 || unusualKeyCache.get("next") !== "second") {
  throw new Error("undefined key eviction failed");
}

const undefinedValueCache = new TtlLruCache<string, number | undefined>(1, 10, () => currentTime);
undefinedValueCache.set("present", undefined);
if (!undefinedValueCache.has("present")) throw new Error("undefined value presence failed");
console.log("Q009 passed");
```

**测试要点：** 注入 Fake Clock，覆盖命中刷新顺序、更新已有 Key、容量一、`undefined` Key/Value、同一时刻过期、删除、过期后再写和大批过期数据。Value 允许为 `undefined` 时，用 `has` 区分“已缓存 undefined”和 Miss。

**复杂度与易错点：** `get` 平均 `O(1)`；这里 `set/size` 为了清理所有过期项最坏 `O(n)`，容量淘汰是平均 `O(1)`。TTL 是写入后固定到期，不因读取续期；若要 Sliding TTL 必须另行定义。

**事实边界：** CodeWiki 布局缓存当前是否是严格 LRU、是否有 TTL，要按实际实现回答，不能拿这道题替代项目事实。

### Q010. 手写支持循环引用、Date、RegExp、Map 和 Set 的 Clone，并明确拒绝边界

**口语化回答：**

> 生产里我优先用平台的 `structuredClone`，手写前先限定支持集合。下面支持对象图、循环引用、数组、Date、RegExp、Map、Set 和普通对象，函数与自定义类实例直接拒绝，而不是悄悄克隆成错误对象。WeakMap 记录“原对象到副本”，既防循环也保留共享引用关系。

**完整代码：**

```ts
function cloneSupported<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value === "function") throw new TypeError("functions are not cloneable");
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return seen.get(value) as T;

  if (value instanceof Date) {
    const copy = new Date(value.getTime());
    seen.set(value, copy);
    return copy as T;
  }
  if (value instanceof RegExp) {
    const copy = new RegExp(value.source, value.flags);
    copy.lastIndex = value.lastIndex;
    seen.set(value, copy);
    return copy as T;
  }

  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    seen.set(value, copy);
    for (const [key, item] of value) {
      copy.set(cloneSupported(key, seen), cloneSupported(item, seen));
    }
    return copy as T;
  }

  if (value instanceof Set) {
    const copy = new Set<unknown>();
    seen.set(value, copy);
    for (const item of value) copy.add(cloneSupported(item, seen));
    return copy as T;
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = new Array(value.length);
    seen.set(value, copy);
    for (const key of Reflect.ownKeys(value)) {
      if (key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      if ("value" in descriptor) descriptor.value = cloneSupported(descriptor.value, seen);
      Object.defineProperty(copy, key, descriptor);
    }
    return copy as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`unsupported prototype: ${prototype?.constructor?.name ?? "null"}`);
  }

  const copy = Object.create(prototype) as Record<PropertyKey, unknown>;
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if ("value" in descriptor) descriptor.value = cloneSupported(descriptor.value, seen);
    Object.defineProperty(copy, key, descriptor);
  }
  return copy as T;
}

type Cyclic = {
  name: string;
  self?: Cyclic;
  createdAt: Date;
  tags: Map<string, Set<number>>;
};

const original: Cyclic = {
  name: "root",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  tags: new Map([["a", new Set([1, 2])]]),
};
original.self = original;

const cloned = cloneSupported(original);
if (cloned === original || cloned.self !== cloned) throw new Error("cycle failed");
if (cloned.createdAt === original.createdAt || cloned.createdAt.getTime() !== original.createdAt.getTime()) {
  throw new Error("Date failed");
}
if (cloned.tags.get("a") === original.tags.get("a")) throw new Error("Map/Set failed");

const sharedDate = new Date("2026-02-01T00:00:00Z");
const sharedPattern = /wiki/gi;
const sparse: Array<number | undefined> = new Array(2);
sparse[1] = 7;
const sharedClone = cloneSupported({
  firstDate: sharedDate,
  secondDate: sharedDate,
  firstPattern: sharedPattern,
  secondPattern: sharedPattern,
  sparse,
});
if (sharedClone.firstDate !== sharedClone.secondDate) throw new Error("shared Date failed");
if (sharedClone.firstPattern !== sharedClone.secondPattern) throw new Error("shared RegExp failed");
if (0 in sharedClone.sparse || sharedClone.sparse[1] !== 7) throw new Error("sparse array failed");

let rejected = false;
try {
  cloneSupported({ fn: () => 1 });
} catch {
  rejected = true;
}
if (!rejected) throw new Error("function boundary failed");
console.log("Q010 passed");
```

**测试要点：** 测同一子对象被多处引用、循环、稀疏数组、Symbol Key、不可枚举属性、Accessor、Map 的对象 Key 和不支持类型。是否复制 Error、ArrayBuffer、TypedArray、DOM Node 要在契约里明确。

**复杂度与易错点：** 时间和空间都是 `O(V + E)`，其中 V 是对象数、E 是属性和集合关系数。JSON 往返会丢类型和循环；调用 Getter 复制还可能产生副作用，所以示例复制 Descriptor。

**事实边界：** 这是受限 Clone 演练，不应该包装成替代 `structuredClone` 的通用库。

### Q011. 用判别联合和 Reducer 建模异步状态，拒绝过期 Operation 回写

**口语化回答：**

> 我不会用 `loading/error/data` 三个互相独立的可选字段，因为它能表达“既 Loading 又 Success”这类非法状态。我用判别联合让每个状态只携带合法字段，再用 Operation ID 拒绝旧请求回写；Reducer 的 `never` 检查保证新增 Action 时编译器提醒我补分支。

**完整代码：**

```ts
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading"; operationId: string; previous?: T }
  | { status: "success"; operationId: string; data: T }
  | { status: "error"; operationId: string; error: Error; previous?: T };

type AsyncAction<T> =
  | { type: "start"; operationId: string }
  | { type: "resolve"; operationId: string; data: T }
  | { type: "reject"; operationId: string; error: Error }
  | { type: "reset" };

function assertNever(value: never): never {
  throw new Error(`unhandled action: ${JSON.stringify(value)}`);
}

function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  switch (action.type) {
    case "start": {
      const previous = state.status === "success"
        ? state.data
        : state.status === "loading" || state.status === "error"
          ? state.previous
          : undefined;
      return { status: "loading", operationId: action.operationId, previous };
    }
    case "resolve":
      if (state.status !== "loading" || state.operationId !== action.operationId) return state;
      return { status: "success", operationId: action.operationId, data: action.data };
    case "reject":
      if (state.status !== "loading" || state.operationId !== action.operationId) return state;
      return {
        status: "error",
        operationId: action.operationId,
        error: action.error,
        previous: state.previous,
      };
    case "reset":
      return { status: "idle" };
    default:
      return assertNever(action);
  }
}

let state: AsyncState<number> = { status: "idle" };
state = asyncReducer(state, { type: "start", operationId: "A" });
state = asyncReducer(state, { type: "start", operationId: "B" });
state = asyncReducer(state, { type: "resolve", operationId: "A", data: 1 });
if (state.status !== "loading" || state.operationId !== "B") throw new Error("stale result won");
state = asyncReducer(state, { type: "resolve", operationId: "B", data: 2 });
if (state.status !== "success" || state.data !== 2) throw new Error("latest result failed");
console.log("Q011 passed", state);
```

**测试要点：** 覆盖合法迁移、旧 Resolve/Reject、保留旧数据刷新、Reset 和新增 Action 的编译期穷尽检查。业务如果允许并行 Operation，就按 Key 保存多份状态，不能只用一个全局状态机。

**复杂度与易错点：** 单次 Reducer 是 `O(1)`，状态空间 `O(1)`。Operation ID 只防前端回写竞态，不会取消网络，也不会给后端写操作提供幂等。

**事实边界：** 这是推荐建模方式，不代表当前 CodeWiki 已统一迁移为该 Reducer。

### Q012. 用 Branded ID 防止 `RepoId`、`NodeId` 和 `OperationId` 被混用

**口语化回答：**

> TypeScript 是结构类型，三个 ID 如果都是 string，编译器允许互换。我会在边界校验字符串后打 Brand，让内部函数参数不能混用。Brand 只存在于编译期，运行时仍是 string，所以它不能替代格式、权限和资源归属校验。

**完整代码：**

```ts
declare const brand: unique symbol;

type Brand<T, Name extends string> = T & { readonly [brand]: Name };
type RepoId = Brand<string, "RepoId">;
type NodeId = Brand<string, "NodeId">;
type OperationId = Brand<string, "OperationId">;

function parseId<Name extends string>(value: unknown, name: Name): Brand<string, Name> {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value as Brand<string, Name>;
}

const toRepoId = (value: unknown): RepoId => parseId(value, "RepoId");
const toNodeId = (value: unknown): NodeId => parseId(value, "NodeId");
const toOperationId = (value: unknown): OperationId => parseId(value, "OperationId");

function nodeUrl(repoId: RepoId, nodeId: NodeId): string {
  return `/repos/${encodeURIComponent(repoId)}/nodes/${encodeURIComponent(nodeId)}`;
}

const repoId = toRepoId("repo-1");
const nodeId = toNodeId("node-9");
const operationId = toOperationId("op-3");
if (nodeUrl(repoId, nodeId) !== "/repos/repo-1/nodes/node-9") throw new Error("URL failed");

// 用 tsc 检查时，这一行必须产生类型错误，否则 @ts-expect-error 会反向报错。
// @ts-expect-error RepoId cannot be assigned to NodeId.
const invalidNode: NodeId = repoId;
void invalidNode;
void operationId;
console.log("Q012 passed");
```

**测试要点：** 一部分是运行时 Parser 测试，另一部分必须运行 `tsc --noEmit` 做编译期负例。还要测试空白、URL 编码和服务端返回错误类型。

**复杂度与易错点：** 运行时解析是 `O(id length)`，Brand 没有额外运行时空间。直接到处 `as RepoId` 会绕过安全边界，应该集中在可信 Parser。

**事实边界：** 这是类型增强建议；当前项目 ID 是否已 Brand 化必须以实际类型定义为准。

### Q013. 手写十万节点树的展开拍平和可见窗口计算

**口语化回答：**

> 我不会把整棵树递归渲染到 DOM。第一步只拍平根节点和已展开分支，保留 Depth；第二步根据 `scrollTop`、固定行高、Viewport 和 Overscan 只切出可见窗口；DOM 数量接近可见行数。稳定 ID 用于选中和展开，不能用可变数组下标。

**完整代码：**

```ts
type TreeNode = {
  id: string;
  label: string;
  children?: readonly TreeNode[];
};

type FlatRow = {
  id: string;
  label: string;
  depth: number;
  hasChildren: boolean;
};

function flattenExpanded(
  roots: readonly TreeNode[],
  expanded: ReadonlySet<string>,
): FlatRow[] {
  const rows: FlatRow[] = [];
  const stack = [...roots].reverse().map((node) => ({ node, depth: 0 }));
  const seen = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop() as { node: TreeNode; depth: number };
    if (seen.has(current.node.id)) throw new Error(`duplicate or cyclic id: ${current.node.id}`);
    seen.add(current.node.id);

    const children = current.node.children ?? [];
    rows.push({
      id: current.node.id,
      label: current.node.label,
      depth: current.depth,
      hasChildren: children.length > 0,
    });

    if (expanded.has(current.node.id)) {
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: children[index], depth: current.depth + 1 });
      }
    }
  }
  return rows;
}

function visibleWindow<T>(
  rows: readonly T[],
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
  overscan: number,
): { start: number; end: number; offsetTop: number; totalHeight: number; items: readonly T[] } {
  if (rowHeight <= 0 || viewportHeight < 0 || overscan < 0) throw new RangeError("invalid window");
  const firstVisible = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const lastVisibleExclusive = Math.ceil((Math.max(0, scrollTop) + viewportHeight) / rowHeight);
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(rows.length, lastVisibleExclusive + overscan);
  return {
    start,
    end,
    offsetTop: start * rowHeight,
    totalHeight: rows.length * rowHeight,
    items: rows.slice(start, end),
  };
}

const largeTree: TreeNode = {
  id: "root",
  label: "root",
  children: Array.from({ length: 100_000 }, (_, index) => ({
    id: `node-${index}`,
    label: `Node ${index}`,
  })),
};

const rows = flattenExpanded([largeTree], new Set(["root"]));
const windowed = visibleWindow(rows, 50_000, 24, 600, 5);
if (rows.length !== 100_001) throw new Error("flatten failed");
// A non-aligned scroll position can expose one extra partial row.
if (windowed.items.length > Math.ceil(600 / 24) + 1 + 10) throw new Error("window too large");
if (windowed.totalHeight !== rows.length * 24) throw new Error("height failed");
console.log("Q013 passed", { total: rows.length, rendered: windowed.items.length });
```

**测试要点：** 覆盖折叠/展开、空树、多 Root、重复 ID、深树避免调用栈溢出、滚动上下界、Overscan 和选中项在窗口外。动态行高要引入测量缓存，不能继续假设固定行高。

**复杂度与易错点：** 拍平访问的可见结构为 `O(v)` 时间和空间，窗口切片为 `O(k)`；DOM 约为 `O(k)`。拍平十万行仍有 CPU/内存成本，规模继续增长时应增量维护 Flat Index 或服务端分页。

**事实边界：** 这是大树方案演练；CodeWiki 当前是否达到十万可见树节点、是否已经虚拟化，需要真实数据和源码证明。

### Q014. 手写能跨 Chunk 处理 CR、LF、CRLF 和多行 Data 的增量 SSE Parser

**口语化回答：**

> 流读取拿到的是任意字节分块，不保证一块就是一行，更不保证 CRLF 不被拆开。我会先用流式 `TextDecoder` 把字节变成字符串，再让 Parser 保留半行 Buffer；空行才提交一个事件，多行 `data` 用换行拼接，`id` 跨事件保留，注释行忽略，合法 `retry` 单独更新。还要给 Buffer 和单事件大小设上限，防止服务端或攻击者一直不发换行。

**完整代码：**

```ts
type SseMessage = {
  event: string;
  data: string;
  id: string;
};

class IncrementalSseParser {
  private buffer = "";
  private scanOffset = 0;
  private dataLines: string[] = [];
  private dataLength = 0;
  private eventType = "";
  private lastEventId = "";

  constructor(
    private readonly onMessage: (message: SseMessage) => void,
    private readonly onRetry: (milliseconds: number) => void = () => undefined,
    private readonly maxBufferLength = 1_000_000,
  ) {}

  push(chunk: string): void {
    this.buffer += chunk;
    let lineStart = 0;
    let index = this.scanOffset;

    while (index < this.buffer.length) {
      const char = this.buffer[index];
      if (char !== "\r" && char !== "\n") {
        index += 1;
        continue;
      }

      // A CR at the end may be the first half of CRLF, so keep it for the next chunk.
      if (char === "\r" && index === this.buffer.length - 1) break;
      const breakLength = char === "\r" && this.buffer[index + 1] === "\n" ? 2 : 1;
      const line = this.buffer.slice(lineStart, index);
      this.processLine(line);
      index += breakLength;
      lineStart = index;
    }

    // Drop all complete lines once per push. scanOffset prevents rescanning a partial line.
    if (lineStart > 0) {
      this.buffer = this.buffer.slice(lineStart);
      index -= lineStart;
    }
    this.scanOffset = index;

    if (this.buffer.length > this.maxBufferLength) {
      throw new Error("SSE partial line buffer exceeded limit");
    }
  }

  finish(): void {
    // Complete a trailing CR or a final line, then dispatch a pending event.
    this.push("\n");
    if (this.dataLines.length > 0) this.processLine("");
  }

  private processLine(line: string): void {
    if (line === "") {
      if (this.dataLines.length === 0) {
        this.eventType = "";
        return;
      }
      this.onMessage({
        event: this.eventType || "message",
        data: this.dataLines.join("\n"),
        id: this.lastEventId,
      });
      this.dataLines = [];
      this.dataLength = 0;
      this.eventType = "";
      return;
    }

    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    switch (field) {
      case "data":
        this.dataLength += value.length + 1;
        if (this.dataLength > this.maxBufferLength) {
          throw new Error("SSE event data exceeded limit");
        }
        this.dataLines.push(value);
        break;
      case "event":
        this.eventType = value;
        break;
      case "id":
        if (!value.includes("\0")) this.lastEventId = value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) this.onRetry(Number(value));
        break;
      default:
        break;
    }
  }
}

const messages: SseMessage[] = [];
const retries: number[] = [];
const parser = new IncrementalSseParser(
  (message) => messages.push(message),
  (milliseconds) => retries.push(milliseconds),
);

parser.push(": keep-alive\r");
parser.push("\nid: 7\r\nevent: progress\r\ndata: first\r");
parser.push("\ndata: second\r\nretry: 1500\r\n\r\nid: 8\ndata: done\n\n");
parser.finish();

const expected: SseMessage[] = [
  { event: "progress", data: "first\nsecond", id: "7" },
  { event: "message", data: "done", id: "8" },
];
if (JSON.stringify(messages) !== JSON.stringify(expected)) {
  throw new Error(`parse failed: ${JSON.stringify(messages)}`);
}
if (JSON.stringify(retries) !== JSON.stringify([1500])) throw new Error("retry failed");

const compactMessages: SseMessage[] = [];
const compactParser = new IncrementalSseParser(
  (message) => compactMessages.push(message),
  () => undefined,
  16,
);
compactParser.push(Array.from({ length: 100 }, (_, index) => `data:${index}\n\n`).join(""));
compactParser.finish();
if (compactMessages.length !== 100) throw new Error("large chunk with short lines failed");
console.log("Q014 passed", messages);
```

**测试要点：** 对每个字符边界切 Chunk，覆盖 CR、LF、CRLF、CRLF 被拆开、注释、无冒号字段、多行 Data、空 Data、NUL ID、非法 Retry、UTF-8 多字节跨 Chunk 和超大行。字节输入要用同一个 `TextDecoder.decode(bytes, { stream: true })`。

**复杂度与易错点：** 扫描是 `O(total characters)`，每个字符只从增量游标经过一次；每次 Push 最多裁掉一次已完成前缀。极端碎片输入下字符串拼接仍可能制造拷贝，生产实现可用分段 Byte Buffer。不能用 `chunk.split("\n\n")`，它会漏 CRLF 和跨 Chunk 分隔符。

**事实边界：** CodeWiki 当前没有 SSE；这是下一版流式协议演练，不能说成现有 Ask/Wiki 链路。

### Q015. 手写带请求 ID、超时、取消、错误传播和销毁的 Worker RPC

**口语化回答：**

> 我把 Worker 当成有消息边界的异步服务。主线程给每次调用分配 ID，把 Resolve/Reject 放进 Pending Map；响应按 ID 配对。超时或外部取消时，主线程既拒绝本地 Promise，也发 Cancel；Worker 为每个请求维护 AbortController，Handler 必须协作检查 Signal。组件卸载或版本切换时要 Reject 全部 Pending 并终止 Worker。

**主线程完整代码 `worker-rpc.ts`：**

```ts
type RpcRequest = { kind: "request"; id: number; method: string; payload: unknown };
type RpcCancel = { kind: "cancel"; id: number };
type RpcResponse =
  | { kind: "response"; id: number; ok: true; value: unknown }
  | { kind: "response"; id: number; ok: false; error: string };

type Pending = {
  resolve(value: unknown): void;
  reject(error: unknown): void;
  timer?: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort?: () => void;
};

export class WorkerRpc {
  private nextId = 1;
  private disposed = false;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly worker: Worker) {
    worker.addEventListener("message", this.onMessage);
    worker.addEventListener("error", this.onWorkerError);
    worker.addEventListener("messageerror", this.onWorkerMessageError);
  }

  call<T>(
    method: string,
    payload: unknown,
    options: { signal?: AbortSignal; timeoutMs?: number; transfer?: Transferable[] } = {},
  ): Promise<T> {
    if (this.disposed) return Promise.reject(new Error("WorkerRpc is disposed"));
    if (options.signal?.aborted) return Promise.reject(options.signal.reason ?? new Error("aborted"));
    if (
      options.timeoutMs !== undefined &&
      (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
    ) {
      return Promise.reject(new RangeError("timeoutMs must be positive when provided"));
    }

    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const entry: Pending = { resolve, reject, signal: options.signal };
      entry.onAbort = () => {
        this.worker.postMessage({ kind: "cancel", id } satisfies RpcCancel);
        this.rejectPending(id, options.signal?.reason ?? new Error("aborted"));
      };
      options.signal?.addEventListener("abort", entry.onAbort, { once: true });

      if (options.timeoutMs !== undefined) {
        entry.timer = setTimeout(() => {
          this.worker.postMessage({ kind: "cancel", id } satisfies RpcCancel);
          this.rejectPending(id, new Error(`RPC ${method} timed out`));
        }, options.timeoutMs);
      }

      this.pending.set(id, entry);
      const message: RpcRequest = { kind: "request", id, method, payload };
      try {
        this.worker.postMessage(message, options.transfer ?? []);
      } catch (error) {
        this.rejectPending(id, error);
      }
    });
  }

  dispose(reason: unknown = new Error("WorkerRpc disposed")): void {
    this.failWorker(reason);
  }

  private readonly onMessage = (event: MessageEvent<RpcResponse>): void => {
    const message = event.data;
    if (message?.kind !== "response") return;
    const entry = this.takePending(message.id);
    if (!entry) return; // Late response after timeout/cancel.
    if (message.ok) entry.resolve(message.value);
    else entry.reject(new Error(message.error));
  };

  private readonly onWorkerError = (event: ErrorEvent): void => {
    this.failWorker(event.error ?? new Error(event.message));
  };

  private readonly onWorkerMessageError = (): void => {
    this.failWorker(new Error("Worker response could not be deserialized"));
  };

  private takePending(id: number): Pending | undefined {
    const entry = this.pending.get(id);
    if (!entry) return undefined;
    this.pending.delete(id);
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    if (entry.onAbort) entry.signal?.removeEventListener("abort", entry.onAbort);
    return entry;
  }

  private rejectPending(id: number, error: unknown): void {
    this.takePending(id)?.reject(error);
  }

  private failWorker(reason: unknown): void {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.removeEventListener("error", this.onWorkerError);
    this.worker.removeEventListener("messageerror", this.onWorkerMessageError);
    for (const id of [...this.pending.keys()]) this.rejectPending(id, reason);
    this.worker.terminate();
  }
}
```

**Worker 端完整代码 `layout.worker.ts`：**

```ts
/// <reference lib="webworker" />

type RpcRequest = { kind: "request"; id: number; method: string; payload: unknown };
type RpcCancel = { kind: "cancel"; id: number };
type RpcResponse =
  | { kind: "response"; id: number; ok: true; value: unknown }
  | { kind: "response"; id: number; ok: false; error: string };

type Handler = (payload: unknown, signal: AbortSignal) => Promise<unknown>;
const controllers = new Map<number, AbortController>();

const handlers: Record<string, Handler> = {
  async layout(payload, signal) {
    const nodes = (payload as { nodes: Array<{ id: string }> }).nodes;
    const positions: Record<string, { x: number; y: number }> = {};
    for (let index = 0; index < nodes.length; index += 1) {
      // Yield periodically so this Worker can receive a cancel message.
      if (index % 1_024 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (signal.aborted) throw signal.reason ?? new Error("aborted");
      positions[nodes[index].id] = { x: (index % 20) * 160, y: Math.floor(index / 20) * 80 };
    }
    return positions;
  },
};

self.addEventListener("message", (event: MessageEvent<RpcRequest | RpcCancel>) => {
  const message = event.data;
  if (message.kind === "cancel") {
    controllers.get(message.id)?.abort(new Error("cancelled by caller"));
    return;
  }

  const controller = new AbortController();
  controllers.set(message.id, controller);
  void (async () => {
    try {
      const handler = handlers[message.method];
      if (!handler) throw new Error(`unknown RPC method: ${message.method}`);
      const value = await handler(message.payload, controller.signal);
      if (!controller.signal.aborted) {
        self.postMessage({ kind: "response", id: message.id, ok: true, value } satisfies RpcResponse);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        self.postMessage({
          kind: "response",
          id: message.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies RpcResponse);
      }
    } finally {
      controllers.delete(message.id);
    }
  })();
});
```

**测试要点：** 用 Fake Worker 测成功、`error`、`messageerror`、未知方法、乱序响应、晚到响应、超时、取消、Dispose 和 Pending Map 归零；Worker 失败后新 Call 必须立即拒绝。浏览器 E2E 再测真实结构化克隆、Transferable 和 Worker 文件加载失败。

**复杂度与易错点：** RPC 管理平均 `O(1)`，序列化成本取决于 Payload。Abort 消息不可能强行中断一个不检查 Signal 的同步大循环；可按 Chunk 检查、终止整个 Worker，或使用支持取消的算法。

**事实边界：** CodeWiki 当前 ELK 仍在主线程，本题是迁移方案，不是已实现 Worker RPC。

### Q016. 手写 `DeepReadonly`、递归 `Awaited` 和 `PickByValue` 类型工具

**口语化回答：**

> 类型工具本质是映射类型、条件类型和 `infer` 的组合。我会先写支持边界：函数保持可调用，Map/Set 变只读容器，数组和元组递归只读，普通对象逐字段递归。类型递归只存在编译期，不会冻结运行时对象，也不能验证外部 JSON。

**完整类型与编译期测试：**

```ts
type DeepReadonly<T> =
  T extends (...args: any[]) => unknown ? T
    : T extends Map<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends Set<infer U> ? ReadonlySet<DeepReadonly<U>>
        : T extends readonly unknown[] ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
          : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
            : T;

type MyAwaited<T> = T extends null | undefined
  ? T
  : T extends PromiseLike<infer U>
    ? MyAwaited<U>
    : T;

type PickByValue<T, Value> = {
  [K in keyof T as T[K] extends Value ? K : never]: T[K];
};

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

type Input = {
  id: string;
  nested: { values: number[] };
  callback(value: number): string;
};

type ExpectedReadonly = {
  readonly id: string;
  readonly nested: { readonly values: readonly number[] };
  readonly callback: (value: number) => string;
};

type _ReadonlyTest = Expect<Equal<DeepReadonly<Input>, ExpectedReadonly>>;
type _AwaitedTest = Expect<Equal<MyAwaited<Promise<Promise<number>>>, number>>;
type _PickTest = Expect<
  Equal<PickByValue<{ id: string; count: number; name: string }, string>, { id: string; name: string }>
>;

const value: DeepReadonly<Input> = {
  id: "x",
  nested: { values: [1, 2] },
  callback: String,
};

// @ts-expect-error DeepReadonly prevents this assignment at compile time.
value.nested.values[0] = 9;

console.log("Q016 passed typecheck");
```

**测试要点：** 必须运行 `tsc --noEmit`，不能只用会擦除类型的转译器。继续测 Tuple、ReadonlyArray、可选属性、联合类型、Date、自定义类和递归深度；是否分发联合类型要按工具契约确定。

**复杂度与易错点：** 这是编译器工作，运行时复杂度为零；过深递归会增加类型检查成本或触发实例化深度限制。`DeepReadonly` 不等于 `Object.freeze`，更不等于深冻结。

**事实边界：** 这些是面试类型练习，不能因为会写就声称项目中已有同名公共类型库。

## 二、React Hook 与 Debug 现场题（Q017-Q030）

### Q017. 手写只允许最新请求提交结果的 `useLatestRequest`

**口语化回答：**

> 我会做三层保护：Key 说明结果属于哪个参数，AbortController 尽量取消旧网络，递增 Version 保证即使取消不及时，旧响应也不能提交。Loading 和 Error 属于这次 Operation，旧请求的 `finally` 不能关掉新请求的 Loading。StrictMode 下第一次 Effect 会被清理，所以 Cleanup 必须真的 Abort。

**完整 Hook：**

```tsx
import { useEffect, useRef, useState } from "react";

type RequestState<T> =
  | { status: "idle" }
  | { status: "loading"; previous?: T }
  | { status: "success"; data: T }
  | { status: "error"; error: Error; previous?: T };

export function useLatestRequest<T>(
  key: string | null,
  loader: (signal: AbortSignal) => Promise<T>,
): RequestState<T> {
  const [state, setState] = useState<RequestState<T>>({ status: "idle" });
  const versionRef = useRef(0);

  useEffect(() => {
    if (key === null) {
      versionRef.current += 1;
      setState({ status: "idle" });
      return;
    }

    const version = ++versionRef.current;
    const controller = new AbortController();
    setState((previous) => ({
      status: "loading",
      previous: previous.status === "success"
        ? previous.data
        : previous.status === "loading" || previous.status === "error"
          ? previous.previous
          : undefined,
    }));

    void loader(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted && version === versionRef.current) {
          setState({ status: "success", data });
        }
      },
      (reason: unknown) => {
        if (controller.signal.aborted || version !== versionRef.current) return;
        const error = reason instanceof Error ? reason : new Error(String(reason));
        setState((previous) => ({
          status: "error",
          error,
          previous: previous.status === "loading" ? previous.previous : undefined,
        }));
      },
    );

    return () => controller.abort(new Error(`request for ${key} was superseded`));
  }, [key, loader]);

  return state;
}
```

**测试要点：** 用 Deferred Promise 让 A 先发后回、B 后发先回，断言最终只显示 B；再测卸载、Loader Reject、Key 变 Null、StrictMode 双 Setup/Cleanup 和 Loader 身份不稳定。调用方应通过 `useCallback` 稳定 Loader，或把请求函数设计成模块级 API。

**复杂度与易错点：** Hook 自身每次切换 `O(1)`；数据处理取决于响应。只用 `cancelled` Boolean 能防回写但不省网络，只 Abort 又不能假设所有底层都立即终止，所以两者都要有。

**事实边界：** 当前 CodeWiki 部分 Hook 有失效标志，但不能把本题说成已经统一落地的 Abort + Version 方案。

### Q018. 手写不会重叠、支持终态、退避和 Cleanup 的轮询 Hook

**口语化回答：**

> 我不用 `setInterval(async () => ...)`，因为它不会等上一次请求结束。每次请求完成后再安排下一次 `setTimeout`，天然不重叠；任务返回 Done 就停止，失败做有上限的退避，卸载时清 Timer 并 Abort 当前请求。页面隐藏是否降频要按业务实时性再加。

**完整 Hook：**

```tsx
import { useEffect, useRef } from "react";

type PollResult = "continue" | "done";

export function useSerialPolling(
  enabled: boolean,
  task: (signal: AbortSignal) => Promise<PollResult>,
  options: {
    intervalMs: number;
    maxBackoffMs: number;
    onError?: (error: unknown) => void;
  },
): void {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let currentController: AbortController | undefined;

    const schedule = (delayMs: number): void => {
      if (cancelled) return;
      timer = setTimeout(() => void tick(), delayMs);
    };

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      currentController = new AbortController();
      try {
        const result = await taskRef.current(currentController.signal);
        if (cancelled) return;
        failures = 0;
        if (result === "continue") schedule(options.intervalMs);
      } catch (error) {
        if (cancelled || currentController.signal.aborted) return;
        options.onError?.(error);
        failures += 1;
        const delay = Math.min(
          options.maxBackoffMs,
          options.intervalMs * 2 ** Math.min(failures - 1, 10),
        );
        schedule(delay);
      }
    };

    schedule(0);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      currentController?.abort(new Error("polling stopped"));
    };
  }, [enabled, options.intervalMs, options.maxBackoffMs, options.onError]);
}
```

**测试要点：** Fake Timer 下让一次请求跨越多个 Interval，断言最大并发仍为一；测试 Continue、Done、失败退避、重新启用、卸载、StrictMode 和 AbortError 不上报。递归 Timer 不能盲目 `runAllTimers`，应逐步推进。

**复杂度与易错点：** 同时最多一个请求和一个 Timer，额外空间 `O(1)`。生产还应加入 Jitter、页面可见性、服务端 Retry-After、Operation TTL 和最大连续失败次数。

**事实边界：** CodeWiki 当前 Wiki 长任务使用轮询，但现状不能反向说成已经具备本题的防重叠和退避语义。

### Q019. 手写可关闭、可恢复状态且不会把断线都当失败的 SSE Hook

**口语化回答：**

> 原生 EventSource 已处理 SSE 分帧和自动重连，适合 GET + Cookie 的单向流。我会把业务事件放在 JSON 的 `kind` 字段里，记录 Last Event ID，终态主动 Close；网络断线先显示 Reconnecting，不立即清掉已有文本。原生 EventSource 不能随意加 Authorization Header，若必须加 Header 或使用 POST，我会改成 Fetch Stream 加 Q014 的 Parser。

**完整 Hook：**

```tsx
import { useEffect, useState } from "react";

type AskEvent =
  | { kind: "delta"; text: string }
  | { kind: "final"; sourceRefs: string[] }
  | { kind: "error"; message: string };

type StreamState = {
  status: "idle" | "connecting" | "streaming" | "reconnecting" | "done" | "error";
  text: string;
  sourceRefs: string[];
  lastEventId: string;
  error?: string;
};

const defaultEventSourceFactory = (url: string): EventSource =>
  new EventSource(url, { withCredentials: true });

function parseAskEvent(raw: string): AskEvent {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || typeof (value as any).kind !== "string") {
    throw new TypeError("invalid Ask event");
  }
  const event = value as Record<string, unknown>;
  if (event.kind === "delta" && typeof event.text === "string") {
    return { kind: "delta", text: event.text };
  }
  if (
    event.kind === "final" && Array.isArray(event.sourceRefs) &&
    event.sourceRefs.every((item) => typeof item === "string")
  ) {
    return { kind: "final", sourceRefs: event.sourceRefs as string[] };
  }
  if (event.kind === "error" && typeof event.message === "string") {
    return { kind: "error", message: event.message };
  }
  throw new TypeError("unknown Ask event shape");
}

export function useAskEventSource(
  url: string | null,
  createSource: (url: string) => EventSource = defaultEventSourceFactory,
): StreamState {
  const [state, setState] = useState<StreamState>({
    status: "idle",
    text: "",
    sourceRefs: [],
    lastEventId: "",
  });
  useEffect(() => {
    if (url === null) {
      setState({ status: "idle", text: "", sourceRefs: [], lastEventId: "" });
      return;
    }

    let closed = false;
    let opened = false;
    setState({ status: "connecting", text: "", sourceRefs: [], lastEventId: "" });
    const source = createSource(url);

    source.onopen = () => {
      if (closed) return;
      opened = true;
      setState((previous) => ({ ...previous, status: "streaming", error: undefined }));
    };

    source.onmessage = (message) => {
      if (closed) return;
      opened = true;
      try {
        const event = parseAskEvent(message.data);
        if (event.kind === "delta") {
          setState((previous) => ({
            ...previous,
            status: "streaming",
            text: previous.text + event.text,
            lastEventId: message.lastEventId || previous.lastEventId,
          }));
        } else if (event.kind === "final") {
          setState((previous) => ({
            ...previous,
            status: "done",
            sourceRefs: event.sourceRefs,
            lastEventId: message.lastEventId || previous.lastEventId,
          }));
          closed = true;
          source.close();
        } else {
          setState((previous) => ({ ...previous, status: "error", error: event.message }));
          closed = true;
          source.close();
        }
      } catch (error) {
        setState((previous) => ({
          ...previous,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }));
        closed = true;
        source.close();
      }
    };

    source.onerror = () => {
      if (closed) return;
      // EventSource normally reconnects itself. Keep accumulated text while it retries.
      setState((previous) => ({
        ...previous,
        status: opened ? "reconnecting" : "connecting",
      }));
    };

    return () => {
      closed = true;
      source.onopen = null;
      source.onmessage = null;
      source.onerror = null;
      source.close();
    };
  }, [url, createSource]);

  return state;
}
```

**测试要点：** 用 Fake EventSource 驱动 Open、Delta、Final、业务 Error、网络 Error、重连、坏 JSON、URL 切换和 Unmount；断言 Final 后 Close、断线不清文本、旧 Source 不能再更新。高频 Token 应再按 `requestAnimationFrame` 或小批量 Flush，不能每个 Token 都 Render。

**复杂度与易错点：** 示例用字符串反复拼接，累计文本很大时可能产生额外复制；可先收集 Chunk 再批量 Join。EventSource 的自动重连不等于服务端有可恢复事件日志，Exactly-once 仍需 ID、Cursor 和幂等消费。

**事实边界：** 当前 CodeWiki 没有 SSE，Wiki 是轮询，Ask 是一次性响应；本题只是一套下一版 Hook。

### Q020. 手写带防抖、竞态保护和键盘交互的异步搜索组件

**口语化回答：**

> 我把输入值、延迟后的 Query、请求状态和当前高亮项分开。输入立即回显，Query 防抖；请求复用 Q017 的取消与 Version 保护；Arrow Key 只移动高亮，Enter 选择，Escape 收起。Loading、空结果和错误要让视觉用户与读屏用户都能感知。

**完整组件：**

```tsx
import { KeyboardEvent, useCallback, useEffect, useId, useState } from "react";
import { useLatestRequest } from "./use-latest-request";

type Option = { id: string; label: string };

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function AsyncSearch(props: {
  search(query: string, signal: AbortSignal): Promise<Option[]>;
  onSelect(option: Option): void;
}) {
  const [input, setInput] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const query = useDebouncedValue(input.trim(), 250);
  const listId = useId();

  const loader = useCallback(
    (signal: AbortSignal) => props.search(query, signal),
    [props.search, query],
  );
  const state = useLatestRequest(query === "" ? null : query, loader);
  const options = state.status === "success" && query === input.trim() ? state.data : [];

  useEffect(() => {
    setActiveIndex(0);
    if (query === "") setOpen(false);
  }, [query]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, options.length - 1)));
  }, [options.length]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown" && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp" && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && options[activeIndex]) {
      event.preventDefault();
      props.onSelect(options[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setInput("");
      setActiveIndex(0);
    }
  };

  return (
    <div>
      <label htmlFor={`${listId}-input`}>Search repository</label>
      <input
        id={`${listId}-input`}
        role="combobox"
        value={input}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && options.length > 0}
        aria-activedescendant={
          open && options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined
        }
        onChange={(event) => {
          setInput(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (options.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <div aria-live="polite">
        {state.status === "loading" ? "Loading" : null}
        {state.status === "error" ? state.error.message : null}
        {state.status === "success" && options.length === 0 ? "No results" : null}
      </div>
      {open && options.length > 0 ? (
        <ul id={listId} role="listbox">
          {options.map((option, index) => (
            <li
              id={`${listId}-${option.id}`}
              key={option.id}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => props.onSelect(option)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

**测试要点：** Fake Timer 推进防抖，用 Deferred Promise 制造乱序；测试空查询不请求、Loading/Error/Empty、上下键边界、Enter、Escape、鼠标选择、Label 和 ARIA。大结果集还要限制条数或配虚拟列表。

**复杂度与易错点：** 渲染为 `O(result count)`；搜索复杂度在服务端或索引。不要用 `onClick` 之外没有键盘路径，也不要让输入 Blur 先于选项 Click 导致选择丢失。

**事实边界：** 这是完整交互练习，不代表 CodeWiki 当前搜索组件已经采用该实现或通过无障碍测试。

### Q021. Timer 回调一直读到旧 State，怎样复现并修 Stale Closure？

**口语化回答：**

> 每次 Render 的变量都是那一次 Render 的快照。空依赖 Effect 只注册首轮回调，所以回调里的 `count` 永远是零。若更新只依赖旧值，我用函数式更新；若外部订阅必须读最新值，我用 Ref 或 Effect Event；若依赖变化本就应该重订阅，则把依赖写全并正确 Cleanup。

**最小复现与修复：**

```tsx
import { useEffect, useState } from "react";

export function BrokenCounter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCount(count + 1), 1_000);
    return () => clearInterval(timer);
  }, []); // count is always the first render's 0.
  return <output>{count}</output>;
}

export function FixedCounter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCount((current) => current + 1), 1_000);
    return () => clearInterval(timer);
  }, []);
  return <output>{count}</output>;
}
```

**测试要点：** Fake Timer 前进三秒，Broken 仍为一，Fixed 为三；Unmount 后继续推进时间，断言没有更新。再测试动态 Delay 时 Effect 应重新订阅并清理旧 Timer。

**复杂度与易错点：** 每 Tick `O(1)`。把所有值塞进 Ref 会逃避 React 数据流；函数式更新只解决“基于旧 State 更新”，不自动解决回调读取其他最新 Props。

**事实边界：** 这是 React 机制演练，不冒充当前项目真实 Bug。

### Q022. Effect 依赖导致无限循环，怎样判断是依赖身份问题还是 StrictMode？

**口语化回答：**

> StrictMode 开发环境通常是额外做一次 Setup/Cleanup，用来暴露不对称副作用；无限循环则是 Effect 更新 State，Render 又产生新依赖，导致持续触发。我先看 React Profiler 和调用次数，再修依赖来源：把只在 Effect 内使用的对象移进去，或稳定真正需要共享的对象，不能直接删依赖压警告。

**最小复现与修复：**

```tsx
import { useEffect, useState } from "react";

type Repo = { id: string };

export function BrokenLoader(props: {
  repoId: string;
  load(input: Repo, signal?: AbortSignal): Promise<string>;
}) {
  const [value, setValue] = useState("");
  const input = { id: props.repoId }; // New object on every render.
  useEffect(() => {
    void props.load(input).then(setValue); // setValue renders, then input changes again.
  }, [input, props.load]);
  return <output>{value}</output>;
}

export function FixedLoader(props: {
  repoId: string;
  load(input: Repo, signal?: AbortSignal): Promise<string>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void props.load({ id: props.repoId }, controller.signal).then(
      (next) => {
        if (!controller.signal.aborted) setValue(next);
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      },
    );
    return () => controller.abort();
  }, [props.repoId, props.load]);
  return <output>{error ?? value}</output>;
}
```

**测试要点：** 设置调用上限防测试挂死，验证 Broken 持续调用、Fixed 每个 RepoId 一次有效提交；在 StrictMode 下允许第一轮被 Abort 后重新执行，但最终无资源泄漏。

**复杂度与易错点：** 修复后每次有效参数变化一次请求。`useMemo(() => ({ id }), [id])` 可以稳定对象，但如果对象只供 Effect 使用，移进 Effect 更简单。

**事实边界：** 当前页面是否存在具体循环必须用 Trace 和源码证明，不能把训练复现说成线上事故。

### Q023. 用户先选 A 再选 B，最后却显示 A，怎样复现 A/B 请求竞态？

**口语化回答：**

> 根因不是“网络慢”，而是响应失去归属。A 先发但后回，如果任何响应都直接 `setData`，A 会覆盖 B。我用 Abort 减少无用工作，同时用 Operation Version 保证提交正确；缓存场景可以让 A 写回 A 的 Key，但绝不能写进当前 B 的视图。

**最小复现与修复：**

```tsx
import { useEffect, useRef, useState } from "react";

export function BrokenRepo(props: {
  repoId: string;
  load(repoId: string, signal?: AbortSignal): Promise<string>;
}) {
  const [data, setData] = useState("");
  useEffect(() => {
    void props.load(props.repoId).then(setData);
  }, [props.repoId, props.load]);
  return <output>{data}</output>;
}

export function FixedRepo(props: {
  repoId: string;
  load(repoId: string, signal?: AbortSignal): Promise<string>;
}) {
  const [data, setData] = useState("");
  const versionRef = useRef(0);

  useEffect(() => {
    const version = ++versionRef.current;
    const controller = new AbortController();
    void props.load(props.repoId, controller.signal).then((value) => {
      if (!controller.signal.aborted && version === versionRef.current) setData(value);
    }, (error: unknown) => {
      if (!controller.signal.aborted && version === versionRef.current) {
        console.error("repository load failed", error);
      }
    });
    return () => controller.abort();
  }, [props.repoId, props.load]);

  return <output>{data}</output>;
}
```

**测试要点：** Deferred A/B 是必测；再测 A Reject、B Success，旧请求 `finally` 不关新 Loading，Abort 不被展示成错误，以及快速 A→B→A 时 Operation ID 仍正确。

**复杂度与易错点：** 每次切换 `O(1)` 管理开销。一个共享 Boolean 若被下一轮重新置 True，旧闭包可能误判；版本必须属于每个 Operation。

**事实边界：** CodeWiki 某些 Hook 已有失效保护，但是否具备统一 Abort、按 Key 缓存和写请求幂等需要逐模块核实。

### Q024. 列表重排后输入框内容跑到另一行，为什么是 `key` 错位？

**口语化回答：**

> React 把 State 绑定在组件树的位置、类型和 Key 上。用数组下标做 Key 时，重排后“第零个位置”仍复用原组件状态，但业务实体已经换了，所以输入值跟错对象。稳定业务 ID 才能告诉 React 哪个 Row 是同一个实体；改 Key 也可以有意重置状态。

**最小复现与修复：**

```tsx
import { useState } from "react";

type Item = { id: string; name: string };

function Row(props: { item: Item }) {
  const [note, setNote] = useState("");
  return (
    <label>
      {props.item.name}
      <input value={note} onChange={(event) => setNote(event.target.value)} />
    </label>
  );
}

export function BrokenList(props: { items: Item[] }) {
  return <>{props.items.map((item, index) => <Row key={index} item={item} />)}</>;
}

export function FixedList(props: { items: Item[] }) {
  return <>{props.items.map((item) => <Row key={item.id} item={item} />)}</>;
}
```

**测试要点：** 先在第二行输入内容，再在头部插入、删除或反转列表；Broken 会把内容留在位置上，Fixed 会跟随业务 ID。还要测重复 ID 时主动失败或告警。

**复杂度与易错点：** 渲染仍为 `O(n)`；正确 Key 让 Reconciliation 复用正确实例，但不是性能万能药。随机数和每次变化的 Key 会让整行反复卸载、重建并丢 State。

**事实边界：** 这是通用列表故障，不代表当前 CodeWiki 已发现 Key 错位事故。

### Q025. 原地修改数组、Map 或 React Flow Node 后，为什么页面不更新或 Memo 失效？

**口语化回答：**

> React 和很多 Selector 依赖引用身份判断变化。原地改 Node 再把同一个数组交回去，React 可能直接跳过；原地 `sort` 还会污染旧快照。正确做法不是深拷贝全部，而是只复制变化路径：新数组、变化的 Node、新 Data，其余节点保留原引用。

**最小复现与修复：**

```tsx
import { useState } from "react";

type Node = { id: string; selected: boolean; data: { label: string } };

export function NodeList() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: "a", selected: false, data: { label: "A" } },
    { id: "b", selected: false, data: { label: "B" } },
  ]);

  const brokenSelect = (id: string): void => {
    const node = nodes.find((item) => item.id === id);
    if (node) node.selected = true;
    setNodes(nodes); // Same array and mutated old snapshot.
  };

  const fixedSelect = (id: string): void => {
    setNodes((current) => current.map((node) =>
      node.id === id ? { ...node, selected: true } : node,
    ));
  };

  const rename = (id: string, label: string): void => {
    setNodes((current) => current.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, label } } : node,
    ));
  };

  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.id}>
          {node.data.label}: {String(node.selected)}
          <button onClick={() => brokenSelect(node.id)}>broken</button>
          <button onClick={() => fixedSelect(node.id)}>select</button>
          <button onClick={() => rename(node.id, `${node.data.label}!`)}>rename</button>
        </li>
      ))}
    </ul>
  );
}
```

**测试要点：** 断言 Fixed 只改变目标 Node 和 Data 的引用，未变节点保持 `===`；测试 `Map/Set` 要创建新实例，排序使用 `toSorted()` 或先复制。可用 `Object.freeze` Fixture 暴露意外 Mutation。

**复杂度与易错点：** 更新一个节点仍需 `O(n)` 扫描，额外创建 `O(1)` 个业务对象加一个新数组；超大图可用按 ID 索引和专用更新 API。深拷贝整图会破坏全部引用并扩大重渲染。

**事实边界：** 当前图数据是否存在原地 Mutation 必须读实际更新路径，不能由本题推断。

### Q026. `memo` 了子组件为什么 Context 一变仍全部 Render？

**口语化回答：**

> `memo` 只比较 Props，不会屏蔽组件订阅的 Context。Provider 每次创建新对象会通知全部消费者；即使 `useMemo` 稳定对象，只要其中任一字段变化，所有读这个 Context 的组件仍收到更新。我先拆分变化频率不同的 Context，稳定 Provider Value；需要细粒度 Selector 时再用外部 Store。

**最小复现与修复：**

```tsx
import { createContext, memo, ReactNode, useContext, useMemo, useState } from "react";

const CombinedContext = createContext<{ theme: string; user: string } | null>(null);
const ThemeContext = createContext("light");
const UserContext = createContext("");

const ThemeLabel = memo(function ThemeLabel() {
  const combined = useContext(CombinedContext);
  return <span>{combined?.theme}</span>; // User changes still render this consumer.
});

const BetterThemeLabel = memo(function BetterThemeLabel() {
  const theme = useContext(ThemeContext);
  return <span>{theme}</span>;
});

export function Providers(props: { children?: ReactNode }) {
  const [theme] = useState("light");
  const [user, setUser] = useState("Alice");
  const combined = useMemo(() => ({ theme, user }), [theme, user]);

  return (
    <CombinedContext.Provider value={combined}>
      <ThemeContext.Provider value={theme}>
        <UserContext.Provider value={user}>
          <ThemeLabel />
          <BetterThemeLabel />
          <button onClick={() => setUser((value) => `${value}!`)}>change user</button>
          {props.children}
        </UserContext.Provider>
      </ThemeContext.Provider>
    </CombinedContext.Provider>
  );
}
```

**测试要点：** 用 React Profiler 或测试计数器比较 Change User 前后两个 Label 的 Render 次数；不要把开发 StrictMode 的额外 Render 算成生产回归。功能测试仍以输出正确为主。

**复杂度与易错点：** 广播成本与 Consumer 数量相关。把每个字段都拆一个 Context 也会增加复杂度；先按变化频率和所有权分域，不为追求零 Render 过度设计。

**事实边界：** CodeWiki 当前主要依靠 Hooks；依赖中虽声明了 Zustand，但是否在当前前端路径实际使用仍要按源码确认，不能说已经采用 Context Selector 或 Zustand Slice 优化。

### Q027. `await elk.layout()` 仍让页面卡住，怎样证明 CPU 还在主线程？

**口语化回答：**

> `async/await` 只描述 Promise 时序，不决定代码在哪个线程运行。如果 ELK 在返回 Promise 前或 Promise 内部用主线程做大量同步计算，输入、点击和绘制仍会被 Long Task 阻塞。我先用 Performance Trace 和 Long Task 证明时间花在哪里，再决定减少图规模、缓存、分片或通过 Q015 的 RPC 放 Worker。

**最小复现与修复骨架：**

```tsx
import { useEffect, useRef, useState } from "react";
import { WorkerRpc } from "./worker-rpc";

async function looksAsyncButBlocks(iterations: number): Promise<number> {
  let value = 0;
  for (let index = 0; index < iterations; index += 1) value += Math.sqrt(index);
  return value; // The entire loop ran before this Promise settled.
}

type PositionMap = Record<string, { x: number; y: number }>;

export function useWorkerLayout(
  rpc: WorkerRpc,
  graphRevision: string,
  payload: unknown,
): PositionMap | null {
  const [positions, setPositions] = useState<PositionMap | null>(null);
  const versionRef = useRef(0);

  useEffect(() => {
    const version = ++versionRef.current;
    const controller = new AbortController();
    performance.mark(`layout-${version}-start`);
    void rpc.call<PositionMap>("layout", payload, {
      signal: controller.signal,
      timeoutMs: 10_000,
    }).then((result) => {
      if (version === versionRef.current && !controller.signal.aborted) {
        setPositions(result);
        performance.mark(`layout-${version}-end`);
        performance.measure(`layout-${version}`, `layout-${version}-start`, `layout-${version}-end`);
      }
    }, (error: unknown) => {
      if (!controller.signal.aborted && version === versionRef.current) {
        console.error("layout failed", error);
        setPositions(null);
      }
    });
    return () => controller.abort(new Error(`layout ${graphRevision} superseded`));
  }, [rpc, graphRevision, payload]);

  return positions;
}

void looksAsyncButBlocks;
```

**测试要点：** 固定小图、代表图和压力图，采集 Long Task、INP、布局耗时、节点数、边数与帧率；切换 Revision 时让旧 Worker 结果晚到，断言不覆盖新图。Worker 加速主线程响应，不保证总计算更快。

**复杂度与易错点：** 布局复杂度由算法和图结构决定，可能远高于线性；Worker 还增加结构化克隆成本。每次微交互都新建 Worker、把 React 元素或函数发过去、只忽略旧结果却让无界任务继续跑，都会产生新问题。

**事实边界：** 当前 CodeWiki 的 ELK 在主线程，本题 Worker 路径是下一版设计，不能报成现有优化结果。

### Q028. 切换仓库多次后内存持续上涨，怎样复现和修 Cleanup 泄漏？

**口语化回答：**

> 我先用可重复操作确认每轮切换后堆是否回落，再比较 Heap Snapshot 和 Retainer。重点查 Timer、Window Listener、Observer、Store Subscription、Worker、未取消 Fetch 和无界缓存。Effect 的 Setup 拿到什么资源，Cleanup 就按相反顺序释放；StrictMode 正好可以暴露不对称。

**最小修复：**

```tsx
import { useEffect } from "react";

export function RepoSession(props: { repoId: string }): null {
  useEffect(() => {
    const controller = new AbortController();
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    const observer = new ResizeObserver(() => undefined);
    const target = document.documentElement;
    observer.observe(target);

    const onResize = (): void => worker.postMessage({ kind: "viewport", width: innerWidth });
    window.addEventListener("resize", onResize);
    const timer = setInterval(() => worker.postMessage({ kind: "heartbeat" }), 5_000);
    void fetch(`/api/repos/${encodeURIComponent(props.repoId)}`, {
      signal: controller.signal,
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) console.error("repository request failed", error);
    });

    return () => {
      controller.abort(new Error("repo changed"));
      clearInterval(timer);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      worker.terminate();
    };
  }, [props.repoId]);

  return null;
}
```

**测试要点：** Spy `add/removeEventListener`、Timer、Observer、Worker 和 Abort；在 StrictMode 下 Mount/Unmount 多轮，断言创建数与清理数相等。浏览器级测试循环切换 50 次，强制 GC 只作为实验工具，最后看 Retained Object 和趋势，不用单点 RSS 下结论。

**复杂度与易错点：** 正确 Cleanup 是每轮 `O(resource count)`。Fetch Abort 不撤销服务端已发生副作用；全局缓存、第三方库内部 Listener 和 Detached DOM 仍要单独调查。

**事实边界：** 这是一套故障演练；没有 Heap/Trace 证据时不能说当前项目发生过该内存泄漏。

### Q029. 怎样用 StrictMode 测出请求 Setup/Cleanup 不对称？

**口语化回答：**

> 我不把开发环境多一次调用当 Bug，也不会为了让测试“只调用一次”关掉 StrictMode。测试应该证明第一轮 Setup 的 Signal 被 Cleanup Abort，第二轮有效请求能完成，卸载后最后一个资源也被释放。这样生产只跑一次时也满足同一资源契约。

**完整测试示例：**

```tsx
import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLatestRequest } from "./use-latest-request";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("useLatestRequest in StrictMode", () => {
  it("aborts the probe request and commits only the active request", async () => {
    const calls: Array<{ signal: AbortSignal; work: Deferred<string> }> = [];
    const loader = vi.fn((signal: AbortSignal) => {
      const work = deferred<string>();
      calls.push({ signal, work });
      return work.promise;
    });

    const { result, unmount } = renderHook(
      () => useLatestRequest("repo-a", loader),
      { wrapper: StrictMode },
    );

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);

    await act(async () => calls[1].work.resolve("A"));
    await waitFor(() => expect(result.current).toEqual({ status: "success", data: "A" }));

    unmount();
    expect(calls[1].signal.aborted).toBe(true);
  });
});
```

**测试要点：** 测试后还要恢复 Fake Timer、Mock 和 Listener；不要断言 Effect 固定调用一次。Rejected Probe 不能产生 Unhandled Rejection，Loader 若响应 Abort 应以可控 AbortError 结束。

**复杂度与易错点：** 这是测试契约，不涉及业务算法复杂度。把 `loader` 写成组件内不稳定匿名函数会让 Effect 额外重跑，测试要分别覆盖稳定和误用场景。

**事实边界：** 当前 CodeWiki 前端没有已证明的 Vitest/Testing Library 测试资产，本题只能说“我会这样补”，不能说已跑通。

### Q030. Error Boundary 能捕获什么，事件和异步错误为什么还要单独处理？

**口语化回答：**

> Error Boundary 主要捕获子树 Render、构造和生命周期里的错误，并提供降级 UI；它不会自动捕获事件处理器、任意 Timer/Promise 回调、服务端错误或 Boundary 自己的错误。异步操作要在调用边界 `try/catch` 并进入显式 Error State；如果希望统一交给 Boundary，可以把错误保存后在下一次 Render 抛出，但要避免无限重试。

**完整最小实现：**

```tsx
import { Component, ErrorInfo, ReactNode, useState } from "react";

type BoundaryProps = { children: ReactNode; fallback?: ReactNode };
type BoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Production code reports release, route and componentStack to an approved platform.
    console.error("render failed", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback ?? <p role="alert">This section failed to render.</p>;
    }
    return this.props.children;
  }
}

export function SaveButton(props: { save(): Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const onSave = async (): Promise<void> => {
    try {
      setError(null);
      await props.save();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <div>
      <button onClick={() => void onSave()}>Save</button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
```

**测试要点：** 子组件 Render 抛错应显示 Fallback 并记录 Component Stack；按钮 Promise Reject 应显示局部错误而不是依赖 Boundary；切换 Route/Reset Key 后是否允许重试要明确。测试中只对预期的 React Console Error 做局部 Mock。

**复杂度与易错点：** Boundary 本身 `O(1)`，但边界粒度影响故障范围；整页一个 Boundary 会让局部节点错误变白屏，每个小元素一个又过度复杂。Fallback 自己也必须稳定。

**事实边界：** 这是应补的错误边界示例，不代表当前 CodeWiki 已部署错误上报、Release 关联或完整 Boundary 分层。

## 三、前端系统设计与浏览器故障现场题（Q031-Q040）

### Q031. 现场设计 CodeWiki 工作台：Repo、Analyze、Graph、Wiki 和 Ask 怎样组成一个可靠前端？

**口语化回答：**

> 我先确认用户的主任务不是“看一个漂亮 Dashboard”，而是注册仓库、观察分析任务、从总览下钻到代码证据、阅读带引用的 Wiki，再用 Ask 回到源码。然后我把 URL State、局部交互 State、服务端数据和长任务状态分开，避免一个大 Store 同时承担所有职责。每个页面都要能处理首次加载、保留旧数据刷新、空结果、权限错误、可重试失败和过期 Revision。

**现场设计：**

```text
Browser Router
  /repos                              RepositoryList
  /repos/:repoId/analyze              AnalyzeOperation
  /repos/:repoId/revisions/:rev/graph GraphWorkspace
  /repos/:repoId/revisions/:rev/wiki  WikiWorkspace
  /repos/:repoId/revisions/:rev/ask   AskWorkspace

URL state: repoId, revision, view, selectedNodeId, wikiSlug, shareable filters
Server state: repo, operation snapshot, graph slice, wiki catalog/page, Ask result
Local state: panel size, hover, draft query, temporary selection, modal state
Long-task state: operationId -> status, progress, lastEventId, updatedAt, error
```

> 我会让 Analyze 的 Mutation 只返回 `operationId` 和目标 Revision，随后按 Operation 查询权威状态；刷新页面后可恢复，而不是把“某个组件的 Promise 还在不在”当任务状态。Graph 请求按 `repo + revision + scope + filters` 建 Key，Wiki 与 Ask 的引用都绑定同一 Revision，防止新旧代码证据混用。权限由服务端按 Repo/Revision 校验，前端隐藏按钮只改善体验，不承担授权。

**关键契约：**

```ts
type OperationSnapshot = {
  operationId: string;
  repoId: string;
  targetRevision: string;
  status: "queued" | "running" | "succeeded" | "retryable_failed" | "failed" | "cancelled";
  progress?: { completed: number; total?: number; stage: string };
  updatedAt: string;
  error?: { code: string; message: string; retryable: boolean };
};

type GraphQuery = {
  repoId: string;
  revision: string;
  scope: { kind: "overview" } | { kind: "node"; nodeId: string };
  edgeTypes: string[];
  confidence: "deterministic" | "all";
};
```

**验证要点：** 我会做纯函数测试覆盖 Query Key、URL Parse 和状态迁移，组件测试覆盖 Loading/Error/Stale，浏览器测试覆盖 Repo→Analyze→Graph→Wiki→Ask 主路径、刷新恢复、Revision 切换和权限失败；再用小图、代表图和大图 Fixture 做性能与视觉验证。

**复杂度与易错点：** 前端不应一次下载并渲染完整仓库图，复杂度要随当前视图子图增长。最危险的是用一个 `isLoading` 表示多个并发操作、把旧 Revision 的 Wiki/Graph 混进新页面，以及刷新后把服务端仍 Running 的任务误判失败。

**事实边界：** 当前 CodeWiki 确实有 React 工作台和这些业务入口，但具体 URL、Store、任务恢复、权限、测试和发布责任必须按实际代码与 RACI 回答；上面是完整现场设计，不是全部现状。

### Q032. 现场设计流式 Ask：Token、引用、断线恢复、取消和最终一致性怎么做？

**口语化回答：**

> 我会把“开始一次 Ask”和“订阅结果”拆开。POST 创建 Operation 并返回 ID，SSE 用这个 ID 读取事件；每条事件有单调 Event ID，客户端保存 Cursor，重连可以续接。Token Delta 只是临时展示，最终答案、引用集合和完成状态以 Final 事件为准，不能边流文字边猜 Citation。取消要区分“前端停止显示”和“后端任务确认取消”。

**事件契约与状态机：**

```ts
type AskStreamEvent =
  | { id: number; kind: "started"; operationId: string; revision: string }
  | { id: number; kind: "answer_delta"; text: string }
  | { id: number; kind: "source_refs"; refs: Array<{ id: string; label: string }> }
  | { id: number; kind: "final"; answer: string; refs: string[]; usage?: { tokens: number } }
  | { id: number; kind: "error"; code: string; message: string; retryable: boolean }
  | { id: number; kind: "cancelled" };

type AskClientState =
  | { status: "idle" }
  | { status: "connecting"; operationId: string; text: string; lastEventId: number }
  | { status: "streaming" | "reconnecting" | "cancelling"; operationId: string; text: string; lastEventId: number }
  | { status: "done"; operationId: string; answer: string; refs: string[] }
  | { status: "error"; operationId: string; text: string; message: string; retryable: boolean }
  | { status: "cancelled"; operationId: string };
```

```text
POST /asks { repoId, revision, question, idempotencyKey }
  -> { operationId, streamUrl, snapshotUrl }

GET streamUrl?after=<lastEventId>
  -> started -> answer_delta* -> source_refs* -> final | error | cancelled

Refresh / gap / event log expired
  -> GET snapshotUrl -> authoritative state -> resume after snapshot cursor
```

> 客户端按帧或每几十毫秒批量合并 Delta，避免每个 Token 一次 Render。相同 Event ID 去重，Event Gap 先取 Snapshot；服务器只保留有界事件日志，过期后用快照恢复。用户点 Stop 后发带 Operation ID 的取消请求，UI 进入 Cancelling，收到 Cancelled 或权威 Snapshot 后才确认。

**验证要点：** 我会测试重复、乱序、断线、Cursor 过期、Final 与临时文本不同、引用晚到、取消竞态、刷新恢复、鉴权过期和慢消费者；性能测试记录 Delta 频率、Render 次数、长答案内存和 INP。

**复杂度与易错点：** 客户端文本累计至少 `O(answer length)`；逐 Token 字符串拼接和 Render 可能产生额外复制。SSE 自动重连不提供 Exactly-once，前端 Close 也不代表模型任务已经停止。

**事实边界：** 当前 CodeWiki Ask 是一次性响应、Wiki 用轮询；上述 SSE、事件日志和取消状态机都是下一版设计。

### Q033. 现场设计十万节点代码图：怎样保证可理解、可交互和可恢复？

**口语化回答：**

> 十万节点不是“把 React Flow 再优化一下”就能直接展示。即使每个节点和边序列化后只有几百字节，进入 JavaScript 对象、索引、布局和 DOM/SVG 后也会放大。我先按用户任务做目录、社区、文件和符号多层聚合，服务端按视图返回子图；前端只布局和渲染当前层，搜索或选中后再下钻。图的目标是回答调用链和依赖问题，不是证明系统能画满屏幕。

**现场设计：**

```text
Graph API(repo, revision, level, scope, filters, cursor)
  -> aggregate nodes + aggregate edges + rawNodeIds + nextCursor + graphRevision
             |
             v
normalized entity index ---- selectors ---- visible graph
             |                                  |
             |                                  +-- React Flow viewport/culling
             +-- bounded cache                  +-- Worker layout RPC
                                                 +-- detail/source panel
```

> 服务端聚合边要保留底层边数、类型、置信分布和 Raw ID，用户才能解释并下钻。布局请求 Key 包含 Graph Revision、Node ID/尺寸、Edge、方向和 Options；旧版本响应按 Version 丢弃。稳定 Node ID 保留选中和 Mental Map，筛选时不无条件 Fit View。布局失败回退到可预测的列表或线性布局，不能白屏。

**容量与验证：** 我不会现场编项目实测数字。我会用真实 Fixture 分别测网络字节、JSON Parse、索引、布局、React Commit、Heap、Long Task、INP 和可见节点数，再据基线定 Budget。功能上测聚合可逆、Breadcrumb、源码跳转、搜索定位、过滤语义和 Revision 隔离。

**复杂度与易错点：** 当前视图若有 v 个节点、e 条边，归一化至少 `O(v + e)`；布局复杂度取决于算法，可能显著更高。前端下载全图再隐藏只减少绘制，不减少网络、Parse 和内存；Worker 也不降低算法总复杂度。

**事实边界：** 当前 CodeWiki 有多层视图、下钻与布局缓存相关能力，但服务端子图分页、真正增量布局、Worker 和十万节点生产指标不能由本题反向认领。

### Q034. 发布后部分用户白屏并出现 Chunk 404，怎样止损、定位和根修？

**口语化回答：**

> 我先看 Network 里失败的是不是旧 HTML 引用的 Hash Chunk，再比对 HTML 的 Release ID、Asset Manifest、CDN/代理缓存和 Service Worker。止损可以回滚到上一套完整制品或保留旧 Chunk；根修是原子发布、HTML 可及时重新验证、Hash Asset 长缓存且跨兼容窗口保留。一次性刷新只是兜底，不能无限刷新掩盖发布不一致。

**最小兜底：**

```ts
declare const __BUILD_ID__: string;

const reloadKey = "chunk-reload-build";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const alreadyReloadedFor = sessionStorage.getItem(reloadKey);
  if (alreadyReloadedFor !== __BUILD_ID__) {
    sessionStorage.setItem(reloadKey, __BUILD_ID__);
    location.reload();
    return;
  }

  // The app shell can listen for this and show a manual recovery action.
  window.dispatchEvent(new CustomEvent("app:chunk-load-failed", {
    detail: { buildId: __BUILD_ID__ },
  }));
});
```

**现场排障顺序：**

> 我会保存失败 URL、响应状态、HTML/JS Response Header、客户端 Build ID 和服务端 Release；确认是否只影响长时间未刷新的 Tab、特定 CDN PoP 或 Service Worker 用户。若 API 同期有 Breaking Change，即使静态资源回滚成功也可能继续故障，所以前后端要有兼容窗口。

**验证要点：** E2E 先打开 V1 页面，发布 V2 后再触发 V1 的懒加载，验证旧 Chunk 可用或只安全刷新一次；再测离线、CDN 缓存、Base Path、Service Worker 和 API 版本组合。告警要按 Release 聚合 Chunk Error 与白屏率。

**复杂度与易错点：** 兜底 Handler 是 `O(1)`。把所有 Asset 都设 `no-store` 会牺牲缓存收益；立即删除旧版本、HTML 长缓存、循环 Reload 都是高风险做法。

**事实边界：** 当前材料只能证明 Vite Build 和 FastAPI 静态入口，不能说已有原子发布、CDN、Service Worker、灰度和 Chunk 错误监控。

### Q035. 开发环境正常，生产却 CORS 或 401，怎样区分浏览器拦截、认证失败和代理配置？

**口语化回答：**

> CORS 是浏览器是否允许前端读取跨源响应，401 是服务端明确拒绝认证，两者不是一件事。我先看是否发了 Preflight、OPTIONS 返回什么、实际请求有没有发出，再看 Origin、Allow-Origin、Allow-Credentials、Cookie 的 Domain/Path/SameSite/Secure 和反向代理。Vite Dev Proxy 能把开发请求伪装成同源，不能证明生产跨域配置正确。

**最小客户端请求：**

```ts
type ApiResult = { operationId: string };

export async function startAnalysis(
  apiOrigin: string,
  repoId: string,
  csrfToken: string,
  signal?: AbortSignal,
): Promise<ApiResult> {
  const response = await fetch(`${apiOrigin}/api/repos/${encodeURIComponent(repoId)}/analyze`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ mode: "incremental" }),
    signal,
  });

  if (response.status === 401) throw new Error("authentication required");
  if (response.status === 403) throw new Error("operation is not authorized or CSRF check failed");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<ApiResult>;
}
```

> 带 Cookie 的跨源请求要求服务端返回精确 Origin 和 `Access-Control-Allow-Credentials: true`，不能用 `*`。自定义 CSRF Header 会触发 Preflight，OPTIONS 也要经过正确的代理和 CORS 层，但通常不应被业务认证中间件误拦。跨站 Cookie 还需要合适的 SameSite/Secure，具体方案取决于部署是否真的跨站。

**测试要点：** 用两个真实 Origin 的 Playwright 测试，而不是只在 JSDOM Mock Fetch；覆盖 Preflight、允许/拒绝 Origin、Cookie 缺失、过期会话、CSRF、代理剥 Header 和 OPTIONS 401。浏览器 Console 的 CORS 文案要和 Network/服务端日志交叉确认。

**复杂度与易错点：** 请求管理为 `O(1)`。前端不能用 `mode: "no-cors"` 修 CORS，那只会得到不可读 Opaque Response；也不能为省事允许任意 Origin 携带凭证。

**事实边界：** 当前 CodeWiki 开发环境有 API Proxy，服务端可见 CORS 配置；实际生产 Origin、Cookie、认证和 CSRF 是否采用上述方案必须按部署事实回答。

### Q036. HTML、Hash Asset、API 和图数据分别怎样设计缓存与失效？

**口语化回答：**

> 我不会给所有资源套同一条 Cache-Control。HTML 是版本入口，要能及时重新验证；带内容 Hash 的 JS/CSS 名字变化即失效，可以长期 immutable；用户相关 API 默认按私有数据处理；绑定 Repo Revision 的不可变图快照可以用 Revision + ETag 复用。前端 Query Key、HTTP Cache 和 Service Worker 是三层不同缓存，必须有统一版本和失效语义。

**现场设计：**

```text
GET /index.html
  Cache-Control: no-cache
  ETag: "html-build-42"

GET /assets/app.8f3a2c.js
  Cache-Control: public, max-age=31536000, immutable

GET /api/me
  Cache-Control: private, no-store

GET /api/repos/r1/revisions/abc/graph?scope=overview
  Cache-Control: private, max-age=0, must-revalidate
  ETag: "graph:abc:overview:schema-v3"
  Vary: Accept-Encoding
```

> 浏览器带 `If-None-Match` 后，服务端可回 304 复用 Body。前端 Query Key 至少包含 `repoId + revision + scope + filters + schemaVersion`；Mutation 成功后只失效受影响 Revision/Scope，不全局清空。若响应受 Authorization、Tenant 或语言影响，缓存 Key 和服务端策略也必须包含这些维度，不能跨用户复用私有内容。

**测试要点：** 验证首次 200、条件请求 304、内容变化换 ETag、不同 Revision 不串、Logout 清私有客户端缓存、旧 HTML 不引用已删除 Chunk。用浏览器 Network 的“Disable cache”只能做对照，不能代替真实缓存测试。

**复杂度与易错点：** 命中缓存可以省网络与 Parse，但 Key 构造和失效表会增加管理成本。`no-cache` 表示使用前重新验证，不等于不存；`no-store` 才是不保存。给含鉴权数据返回 `public` 或遗漏租户维度会造成数据泄漏。

**事实边界：** 当前可证明 Vite 生成 Hash Asset，但 CDN、ETag、Service Worker、私有缓存 Header 和 Query Cache 都不能按本设计视为已实现。

### Q037. 从输入 URL 到页面可交互经历什么，白屏和慢首屏怎样定位？

**口语化回答：**

> 我会按证据链讲：先解析 URL，查缓存和 Service Worker；需要联网时做 DNS、连接和 TLS，再收 HTML；浏览器流式解析 HTML，遇到资源形成请求，构建 DOM/CSSOM 和 Render Tree，随后 Layout、Paint、Composite；JavaScript 下载、编译、执行并挂载 React，应用再取数据。白屏要看是哪一段断了，不能一上来就说“后端慢”或“React 卡”。

**现场排障分层：**

```text
1. Navigation: DNS / TCP or QUIC / TLS / TTFB / redirects / cache
2. Resources: blocking CSS, module graph, fonts, images, failed dynamic chunks
3. Main thread: JS parse/compile/execute, Long Task, React Render/Commit
4. Rendering: style, layout, paint, composite, layout shift
5. Data: API waterfall, authentication, retry, empty/error state
6. Interaction: event delay, handler cost, next paint
```

**最小观测代码：**

```ts
performance.mark("app-bootstrap-start");

const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log("long-task", { start: entry.startTime, duration: entry.duration });
  }
});
try {
  longTaskObserver.observe({ type: "longtask", buffered: true });
} catch {
  // Unsupported browsers need a feature-detected fallback.
}

window.addEventListener("DOMContentLoaded", () => {
  performance.mark("dom-content-loaded");
});

window.addEventListener("load", () => {
  performance.mark("window-loaded");
  performance.measure("bootstrap-to-load", "app-bootstrap-start", "window-loaded");
});
```

> 生产观测还要采集 LCP、INP、CLS、JS Error、资源失败、API 延迟和核心工作流成功率，并附 Release、Route、浏览器和采样信息；示例 Console 只用于现场说明。

**测试要点：** 用冷缓存/热缓存、Fast/Slow Network、CPU Throttle、禁用 JS、Chunk 失败、API 慢和大图 Fixture 分别对照；Performance Trace 要保存调用栈和 Screenshot，优化后用同一环境复测。

**复杂度与易错点：** 这是跨阶段延迟分解，不是单一 Big-O。DOMContentLoaded、Load、LCP 和可交互不是同一个时刻；React Render 也不等于 DOM 一定变化。

**事实边界：** 当前材料不能证明 CodeWiki 已采集 Web Vitals、Long Task 或真实用户监控，本题是排障与观测设计。

### Q038. 现场设计前端 CI/CD、可观测、灰度和回滚

**口语化回答：**

> 我会把 Build 成功和可发布分开。提交阶段跑 Lint、Typecheck、单元/组件测试和 Build；候选制品再跑 E2E、安全 Smoke 和兼容检查。制品只构建一次，带 Commit/Build ID，先部署内部或小流量环境；JS Error、白屏、Chunk Error、Web Vitals 和主流程异常超过基线就暂停或回滚。回滚必须包含兼容的前端、静态资源和 API，而不是只换一个 HTML。

**目标流水线：**

```yaml
frontend:
  steps:
    - run: npm ci
    - run: npm run lint
    - run: npm run typecheck
    - run: npm run test -- --run
    - run: npm run build
    - run: npm run e2e -- --project=chromium
    - run: upload-private-source-maps --release "$COMMIT_SHA"
    - run: publish-immutable-assets --release "$COMMIT_SHA"
    - run: deploy-html-candidate --release "$COMMIT_SHA"
    - run: smoke-test --release "$COMMIT_SHA"
    - run: promote-or-rollback --release "$COMMIT_SHA"
```

**观测与关联：**

```text
Client event: release, route, repo/revision (脱敏), operationId, requestId,
              error class, stack fingerprint, browser, sampled timing
Backend link: W3C traceparent or approved request/trace ID
Golden signals: JS/resource error rate, API error/latency, Long Task/Web Vitals,
                Repo->Analyze->Graph->Wiki->Ask step success
```

> Source Map 上传到受控错误平台并按 Release 匹配，不必公开。Feature Flag 要有默认值和 Kill Switch，新旧 API 保留兼容窗口。回滚演练要实际验证旧 HTML、旧 Chunk 和当前数据库/API 是否还能组合，而不是只写文档。

**测试要点：** 人为注入 Chunk 404、JS Render Error、API 500、慢接口和新 Feature 故障，验证告警、Release 聚合、Flag 关闭和回滚时限；还要扫描 Source Map、Secret、依赖和 CSP Header。

**复杂度与易错点：** 流水线时间不是越短越好，要按风险并行化且保持信号独立。前端上报要采样、脱敏和限流，不能把源码、用户问题或仓库内容直接上传外部平台。

**事实边界：** 当前前端可证明的脚本主要是 Dev、Build、Lint，没有测试、灰度、前端观测和回滚闭环；以上全部按目标方案回答。

### Q039. Token 应该放 Cookie、Memory、Session Storage 还是 Local Storage？

**口语化回答：**

> 我不会脱离威胁模型给唯一答案。只要 JavaScript 能读到 Token，XSS 就可能窃取它；HttpOnly Cookie 能阻止脚本直接读取，但浏览器会自动携带，所以要处理 SameSite、Origin 和 CSRF。优先同源 BFF/Session Cookie，Cookie 设 HttpOnly、Secure 和合适的 SameSite；若必须让 SPA 持有 Access Token，我倾向短时放内存，Refresh Token 仍放受保护边界，并接受刷新页面后的恢复设计。

**推荐请求边界：**

```ts
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:required"));
  }
  return response;
}
```

**安全设计：**

> 我不会把 Token 放 URL、日志、错误上报、HTML 或 Vite 环境变量。Cookie Session 还需要服务端轮换、过期、注销和设备/会话撤销；敏感 Mutation 使用 SameSite、CSRF Token 和 Origin/Referer 校验的组合。前端隐藏资源不等于授权，服务端每次仍按用户、租户、Repo 和 Action 判定。

**测试要点：** 测 Cookie 属性、跨站表单、跨源 Fetch、XSS 模拟、Token 过期、多 Tab Logout、刷新竞态和撤销；安全测试应在隔离环境并使用无真实权限账号。CSP 和 Sanitization 是纵深防御，不是 Token Storage 的替代品。

**复杂度与易错点：** 认证状态管理通常 `O(1)`，难点是生命周期和攻击面。Local Storage 方便持久化但任何同源脚本可读；HttpOnly 不是“绝对安全”，XSS 仍可借用户会话发请求。

**事实边界：** 当前 CodeWiki 的真实认证、Cookie、Token 和部署拓扑没有在本题中核实，不能说已经采用 BFF 或上述 Session 方案。

### Q040. 代码图主要靠视觉，怎样让键盘和非视觉用户完成同一任务？

**口语化回答：**

> 我不会试图把一张十万节点 SVG 逐个塞给读屏器。图是视觉增强，必须提供等价的搜索、层级列表、详情和源码跳转。列表使用稳定顺序和 Roving Tabindex，方向键移动，Enter 打开，Escape 返回；选中、加载和错误用适度的 Live Region 播报。颜色不是唯一编码，焦点必须可见，缩放到 200% 也不能挡住操作。

**最小等价导航组件：**

```tsx
import { KeyboardEvent, useEffect, useRef, useState } from "react";

type AccessibleNode = {
  id: string;
  label: string;
  level: number;
  kind: string;
  edgeSummary: string;
};

export function AccessibleGraphNavigation(props: {
  nodes: AccessibleNode[];
  selectedId?: string;
  onOpen(node: AccessibleNode): void;
}) {
  const initial = Math.max(0, props.nodes.findIndex((node) => node.id === props.selectedId));
  const [activeIndex, setActiveIndex] = useState(initial);
  const shouldMoveFocus = useRef(false);

  useEffect(() => {
    if (props.nodes.length === 0) {
      setActiveIndex(0);
      return;
    }
    const selectedIndex = props.nodes.findIndex((node) => node.id === props.selectedId);
    setActiveIndex((index) => (
      selectedIndex >= 0 ? selectedIndex : Math.min(index, props.nodes.length - 1)
    ));
  }, [props.nodes, props.selectedId]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (props.nodes.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      shouldMoveFocus.current = true;
      setActiveIndex((index) => Math.min(index + 1, props.nodes.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      shouldMoveFocus.current = true;
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      shouldMoveFocus.current = true;
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      shouldMoveFocus.current = true;
      setActiveIndex(props.nodes.length - 1);
    } else if (event.key === "Enter" && props.nodes[activeIndex]) {
      props.onOpen(props.nodes[activeIndex]);
    }
  };

  useEffect(() => {
    if (!shouldMoveFocus.current) return;
    shouldMoveFocus.current = false;
    const activeNode = props.nodes[activeIndex];
    if (activeNode) document.getElementById(`graph-node-${activeNode.id}`)?.focus();
  }, [activeIndex, props.nodes]);

  return (
    <section aria-labelledby="graph-navigation-title">
      <h2 id="graph-navigation-title">Code graph navigation</h2>
      <ul role="tree" aria-label="Code graph nodes" onKeyDown={onKeyDown}>
        {props.nodes.map((node, index) => (
          <li
            id={`graph-node-${node.id}`}
            key={node.id}
            role="treeitem"
            aria-level={node.level}
            aria-selected={node.id === props.selectedId}
            tabIndex={index === activeIndex ? 0 : -1}
            onFocus={() => setActiveIndex(index)}
            onDoubleClick={() => props.onOpen(node)}
          >
            <strong>{node.label}</strong> <span>{node.kind}</span>
            <span className="sr-only">{node.edgeSummary}</span>
          </li>
        ))}
      </ul>
      <p aria-live="polite">
        {props.nodes[activeIndex]
          ? `Selected ${props.nodes[activeIndex].label}, ${activeIndex + 1} of ${props.nodes.length}`
          : "No graph nodes"}
      </p>
    </section>
  );
}
```

**测试要点：** 只用键盘完成搜索、选择、下钻、回退和源码跳转；测试 Home/End、焦点回归、空图、动态更新、200% 缩放、窄屏和高对比度。自动 Axe Scan 只能发现一部分问题，还要用真实读屏器和用户任务验证。大列表虚拟化时必须保证焦点项不会被意外卸载。

**复杂度与易错点：** 示例渲染 `O(n)`，大图的等价列表仍需分层、搜索或虚拟化。仅添加 `aria-label` 不会自动提供键盘行为；频繁播报每个 Token、进度或 Hover 会淹没读屏用户。

**事实边界：** 当前 CodeWiki 已有部分 ARIA 和键盘支持，但完整图节点下钻、等价非视觉视图、焦点管理和浏览器级无障碍测试仍不能声称已经完成。

## 四、现场复习顺序

> 我会先练 Q001-Q016，保证能在无提示下写完并自己跑边界；再把 Q017-Q030 每个故障做成“失败测试先红、修复后绿”；最后对白板题 Q031-Q040 固定使用“约束、状态、数据流、失败、观测、演进、事实边界”七步回答。任何建议方案都只称为演练或下一版设计，只有代码、测试、发布和 RACI 证据齐全时才称为当前实现或个人经历。
