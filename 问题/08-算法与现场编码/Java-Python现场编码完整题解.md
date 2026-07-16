# Java / Python 现场编码完整题解

> 定位：这是面向 Java 后端与 AI 应用岗位的现场练习，不代表任何公司已经问过这些原题。每题都按“先澄清、再讲不变量、写完整代码、主动测试、最后接 Follow-up”的顺序组织。
>
> 代码口径：Java 示例只使用 JDK 标准库并提供可运行的 `main`；Python 示例只使用标准库并提供断言。SQL 统一使用 PostgreSQL 口径。生产系统还要补认证、配置、监控、迁移和压测，不能把一道现场题的实现直接称为完整生产方案。

## 一、高频算法与数据结构（Q001-Q015）

### Q001. Two Sum：返回两个不同元素的下标

**澄清：**

> 我先确认返回的是下标，不是数值；同一个元素不能用两次；如果有多组答案，是返回任意一组还是最早的一组。下面按“返回扫描过程中最先找到的一组，无解返回空列表”实现。

**思路与不变量：**

> 我一边扫描，一边保存此前见过的数值到最早下标。处理 `nums[i]` 前，哈希表里只包含 `i` 之前的元素；我先查补数再写当前值，所以不会把当前位置用两次。

**完整代码：**

```python
from typing import List


def two_sum(nums: List[int], target: int) -> List[int]:
    seen: dict[int, int] = {}
    for i, value in enumerate(nums):
        need = target - value
        if need in seen:
            return [seen[need], i]
        seen.setdefault(value, i)
    return []


def main() -> None:
    assert two_sum([2, 7, 11, 15], 9) == [0, 1]
    assert two_sum([3, 3], 6) == [0, 1]
    assert two_sum([1, 2, 3], 100) == []
    assert two_sum([], 0) == []
    print("Q001 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 平均时间 `O(n)`，额外空间 `O(n)`；这里按哈希查询平均 `O(1)` 计算。

**测试用例：**

> 我会主动测普通答案、`[3,3]` 这种重复值、无解和空数组。若题目保证一定有解，可以把无解改为抛异常。

**Follow-up：**

> 如果输入已经有序，我可以用左右双指针做到 `O(n)` 时间、`O(1)` 额外空间；如果要求所有不重复组合，我会继续扫描并明确按下标还是数值去重。

### Q002. Minimum Window Substring：最短覆盖子串

**澄清：**

> 我先确认字符是否区分大小写、是否需要保留重复次数、空 `t` 怎么处理。下面按 Java `char` 计数，`t` 为空返回空串，答案不存在也返回空串。

**思路与不变量：**

> 右指针扩张直到窗口覆盖 `t` 的全部字符次数，左指针再尽量收缩。`missing` 表示还缺多少个字符实例，不是缺多少种字符；当它为零时，当前窗口有效。

**完整代码：**

```java
import java.util.HashMap;
import java.util.Map;

public class Q002MinimumWindow {
    public static String minWindow(String s, String t) {
        if (s == null || t == null || t.isEmpty() || s.length() < t.length()) {
            return "";
        }

        Map<Character, Integer> need = new HashMap<>();
        for (char c : t.toCharArray()) {
            need.merge(c, 1, Integer::sum);
        }

        int missing = t.length();
        int left = 0;
        int bestStart = 0;
        int bestLength = Integer.MAX_VALUE;

        for (int right = 0; right < s.length(); right++) {
            char added = s.charAt(right);
            int before = need.getOrDefault(added, 0);
            if (before > 0) {
                missing--;
            }
            need.put(added, before - 1);

            while (missing == 0) {
                int length = right - left + 1;
                if (length < bestLength) {
                    bestStart = left;
                    bestLength = length;
                }

                char removed = s.charAt(left++);
                int afterRemoval = need.getOrDefault(removed, 0) + 1;
                need.put(removed, afterRemoval);
                if (afterRemoval > 0) {
                    missing++;
                }
            }
        }

        return bestLength == Integer.MAX_VALUE
                ? ""
                : s.substring(bestStart, bestStart + bestLength);
    }

    private static void check(String actual, String expected) {
        if (!actual.equals(expected)) {
            throw new AssertionError("expected=" + expected + ", actual=" + actual);
        }
    }

    public static void main(String[] args) {
        check(minWindow("ADOBECODEBANC", "ABC"), "BANC");
        check(minWindow("aa", "aa"), "aa");
        check(minWindow("a", "aa"), "");
        check(minWindow("abc", ""), "");
        System.out.println("Q002 passed");
    }
}
```

**复杂度：**

> 左右指针各最多走一遍，时间 `O(|s| + |t|)`，计数表空间 `O(字符种类数)`。

**测试用例：**

> 我会测标准例子、目标有重复字符、无解和空目标。若输入按 Unicode Code Point 而不是 UTF-16 `char` 定义，需要改成 Code Point 序列。

**Follow-up：**

> 如果面试官问为什么不是 `O(n²)`，我会说明 `while` 虽然嵌套，但左指针全程只增不减，每个字符最多被加入和移除一次。

### Q003. 反转单链表

**澄清：**

> 我先确认能否原地修改节点、链表是否可能为空，以及是否要求递归。下面给迭代原地版本，空链表返回 `null`。

**思路与不变量：**

> 每轮开始时，`prev` 指向已经反转好的前缀，`current` 指向尚未处理的第一个节点。我先保存 `next`，再反转当前指针，最后整体前移。

**完整代码：**

```java
import java.util.ArrayList;
import java.util.List;

public class Q003ReverseList {
    static final class ListNode {
        final int value;
        ListNode next;

        ListNode(int value) {
            this.value = value;
        }
    }

    public static ListNode reverse(ListNode head) {
        ListNode prev = null;
        ListNode current = head;
        while (current != null) {
            ListNode next = current.next;
            current.next = prev;
            prev = current;
            current = next;
        }
        return prev;
    }

    private static ListNode build(int... values) {
        ListNode dummy = new ListNode(0);
        ListNode tail = dummy;
        for (int value : values) {
            tail.next = new ListNode(value);
            tail = tail.next;
        }
        return dummy.next;
    }

    private static List<Integer> values(ListNode head) {
        List<Integer> out = new ArrayList<>();
        for (ListNode node = head; node != null; node = node.next) {
            out.add(node.value);
        }
        return out;
    }

    public static void main(String[] args) {
        if (!values(reverse(build(1, 2, 3))).equals(List.of(3, 2, 1))) {
            throw new AssertionError("normal list failed");
        }
        if (!values(reverse(build(7))).equals(List.of(7))) {
            throw new AssertionError("single node failed");
        }
        if (reverse(null) != null) {
            throw new AssertionError("null failed");
        }
        System.out.println("Q003 passed");
    }
}
```

**复杂度：**

> 时间 `O(n)`，额外空间 `O(1)`。

**测试用例：**

> 我会测多节点、单节点和空链表，并在纸上走一次，重点确认先保存 `next`，否则后半段链表会丢失。

**Follow-up：**

> 递归版额外栈空间是 `O(n)`；如果要求反转 `[left,right]` 区间，我会用 dummy 节点加头插法或切段反转，并保护区间边界。

### Q004. 二叉树层序遍历

**澄清：**

> 我先确认输出是否按层分组，以及空树返回空列表。下面返回 `list[list[int]]`，不修改原树。

**思路与不变量：**

> 队列里始终放着尚未访问的节点。每轮先固定当前队列长度，它就是这一层节点数；只处理这批节点，新加入的孩子留给下一层。

**完整代码：**

```python
from collections import deque
from dataclasses import dataclass
from typing import Optional


@dataclass
class TreeNode:
    value: int
    left: Optional["TreeNode"] = None
    right: Optional["TreeNode"] = None


def level_order(root: Optional[TreeNode]) -> list[list[int]]:
    if root is None:
        return []

    queue = deque([root])
    result: list[list[int]] = []
    while queue:
        level: list[int] = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.value)
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        result.append(level)
    return result


def main() -> None:
    root = TreeNode(
        3,
        TreeNode(9),
        TreeNode(20, TreeNode(15), TreeNode(7)),
    )
    assert level_order(root) == [[3], [9, 20], [15, 7]]
    assert level_order(TreeNode(1)) == [[1]]
    assert level_order(None) == []
    print("Q004 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 每个节点进出队一次，时间 `O(n)`；队列最坏保存最宽一层，空间 `O(w)`，`w` 是最大宽度。

**测试用例：**

> 我会测普通树、单节点和空树。如果树退化成链，结果应是一层一个节点。

**Follow-up：**

> 如果要求锯齿遍历，我会按层维护方向，收集后反转或用双端队列；如果是超大树的流式处理，仍至少需要保存当前层边界。

### Q005. Top K 高频元素

**澄清：**

> 我先确认 `k` 是否保证合法，以及并列频次的输出顺序。下面要求 `0 <= k <= 不同元素数`，并列时数值小的优先，结果按频次降序、数值升序返回。

**思路与不变量：**

> 我先统计频次，再维护大小最多为 `k` 的小顶堆。堆顶始终是当前候选中“最应该被淘汰”的元素：频次最低；频次相同时数值更大。

**完整代码：**

```java
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

public class Q005TopKFrequent {
    public static List<Integer> topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> frequency = new HashMap<>();
        for (int value : nums) {
            frequency.merge(value, 1, Integer::sum);
        }
        if (k < 0 || k > frequency.size()) {
            throw new IllegalArgumentException("invalid k");
        }

        Comparator<Map.Entry<Integer, Integer>> worstFirst = (a, b) -> {
            int byFrequency = Integer.compare(a.getValue(), b.getValue());
            return byFrequency != 0
                    ? byFrequency
                    : Integer.compare(b.getKey(), a.getKey());
        };
        PriorityQueue<Map.Entry<Integer, Integer>> heap =
                new PriorityQueue<>(worstFirst);

        for (Map.Entry<Integer, Integer> entry : frequency.entrySet()) {
            heap.offer(entry);
            if (heap.size() > k) {
                heap.poll();
            }
        }

        List<Integer> result = new ArrayList<>();
        while (!heap.isEmpty()) {
            result.add(heap.poll().getKey());
        }
        result.sort((a, b) -> {
            int byFrequency = Integer.compare(frequency.get(b), frequency.get(a));
            return byFrequency != 0 ? byFrequency : Integer.compare(a, b);
        });
        return result;
    }

    private static void check(List<Integer> actual, List<Integer> expected) {
        if (!actual.equals(expected)) {
            throw new AssertionError("expected=" + expected + ", actual=" + actual);
        }
    }

    public static void main(String[] args) {
        check(topKFrequent(new int[]{1, 1, 1, 2, 2, 3}, 2), List.of(1, 2));
        check(topKFrequent(new int[]{4, 4, 5, 5, 6}, 2), List.of(4, 5));
        check(topKFrequent(new int[]{9}, 0), List.of());
        System.out.println("Q005 passed");
    }
}
```

**复杂度：**

> 统计 `O(n)`，维护堆 `O(m log k)`，最终排序 `O(k log k)`；`m` 是不同元素数。空间 `O(m + k)`。

**测试用例：**

> 我会测普通频次、并列频次、`k=0` 和非法 `k`。比较器使用 `Integer.compare`，避免直接相减溢出。

**Follow-up：**

> 如果频次上限不大，可以用 Bucket Sort 做到 `O(n)`；如果数据持续到来，我会维护计数与可更新堆，或者按时间窗使用流式近似算法。

### Q006. 在有序数组中找目标值的第一个和最后一个位置

**澄清：**

> 我先确认数组按升序排列，重复值允许存在，无解返回 `[-1,-1]`。下面不调用库里的二分函数。

**思路与不变量：**

> 我写一个 `lower_bound(x)`，返回第一个大于等于 `x` 的位置，维护左闭右开区间 `[left,right)`：答案始终在这个区间中。左边界是 `lower_bound(target)`，右边界是 `lower_bound(target+1)-1`；为避免整数溢出，我实际再写一个“第一个大于 target”的 upper bound。

**完整代码：**

```python
from typing import Sequence


def lower_bound(nums: Sequence[int], target: int) -> int:
    left, right = 0, len(nums)
    while left < right:
        middle = left + (right - left) // 2
        if nums[middle] < target:
            left = middle + 1
        else:
            right = middle
    return left


def upper_bound(nums: Sequence[int], target: int) -> int:
    left, right = 0, len(nums)
    while left < right:
        middle = left + (right - left) // 2
        if nums[middle] <= target:
            left = middle + 1
        else:
            right = middle
    return left


def search_range(nums: Sequence[int], target: int) -> list[int]:
    start = lower_bound(nums, target)
    if start == len(nums) or nums[start] != target:
        return [-1, -1]
    return [start, upper_bound(nums, target) - 1]


def main() -> None:
    assert search_range([5, 7, 7, 8, 8, 10], 8) == [3, 4]
    assert search_range([5, 7, 7, 8, 8, 10], 6) == [-1, -1]
    assert search_range([2, 2, 2], 2) == [0, 2]
    assert search_range([], 1) == [-1, -1]
    print("Q006 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 两次二分，时间 `O(log n)`，额外空间 `O(1)`。

**测试用例：**

> 我会测目标在中间、多次重复、目标不存在、全相同和空数组，重点检查右边界是开区间。

**Follow-up：**

> 如果数据在磁盘或远程存储，我会讨论块索引和减少随机访问；如果数组发生频繁插入，有序数组不再是合适结构，可以考虑有序树或数据库索引。

### Q007. Course Schedule：判断有向图是否有环

**澄清：**

> 我先确认先修关系 `[course, prerequisite]` 表示从 prerequisite 指向 course，课程编号范围是 `[0,n)`；重复边是否可能出现。下面对重复边去重，避免入度被重复增加。

**思路与不变量：**

> 我用 Kahn 拓扑排序。队列只放当前入度为零的节点；每弹出一个节点，就相当于删除它的出边。最终处理节点数等于课程数才无环。

**完整代码：**

```java
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Queue;
import java.util.Set;

public class Q007CourseSchedule {
    public static boolean canFinish(int courseCount, int[][] prerequisites) {
        if (courseCount < 0) {
            throw new IllegalArgumentException("negative course count");
        }

        List<Set<Integer>> graph = new ArrayList<>(courseCount);
        for (int i = 0; i < courseCount; i++) {
            graph.add(new HashSet<>());
        }
        int[] indegree = new int[courseCount];

        for (int[] edge : prerequisites) {
            if (edge.length != 2
                    || edge[0] < 0 || edge[0] >= courseCount
                    || edge[1] < 0 || edge[1] >= courseCount) {
                throw new IllegalArgumentException("invalid edge");
            }
            int course = edge[0];
            int prerequisite = edge[1];
            if (graph.get(prerequisite).add(course)) {
                indegree[course]++;
            }
        }

        Queue<Integer> ready = new ArrayDeque<>();
        for (int i = 0; i < courseCount; i++) {
            if (indegree[i] == 0) {
                ready.offer(i);
            }
        }

        int visited = 0;
        while (!ready.isEmpty()) {
            int current = ready.poll();
            visited++;
            for (int next : graph.get(current)) {
                if (--indegree[next] == 0) {
                    ready.offer(next);
                }
            }
        }
        return visited == courseCount;
    }

    public static void main(String[] args) {
        if (!canFinish(2, new int[][]{{1, 0}})) {
            throw new AssertionError("acyclic graph failed");
        }
        if (canFinish(2, new int[][]{{1, 0}, {0, 1}})) {
            throw new AssertionError("cycle failed");
        }
        if (!canFinish(2, new int[][]{{1, 0}, {1, 0}})) {
            throw new AssertionError("duplicate edge failed");
        }
        System.out.println("Q007 passed");
    }
}
```

**复杂度：**

> 时间 `O(V+E)`，空间 `O(V+E)`；这里的 `E` 按去重后的边数计算。

**测试用例：**

> 我会测单向依赖、两节点成环、重复边、没有依赖和自环。

**Follow-up：**

> 如果要输出一条拓扑序，我会记录弹出顺序；如果要找具体环，可以改用 DFS 三色标记并保存父节点恢复环路径。

### Q008. Coin Change：凑出金额所需的最少硬币数

**澄清：**

> 我先确认硬币可无限使用，金额和硬币都是非负整数，硬币面额必须大于零。金额为零返回零，无法组成返回 `-1`。

**思路与不变量：**

> `dp[x]` 表示组成金额 `x` 的最少硬币数。计算 `x` 时，所有更小金额都已经是最优；对每个不超过 `x` 的硬币，尝试从 `dp[x-coin]+1` 转移。

**完整代码：**

```python
from math import inf
from typing import Iterable


def coin_change(coins: Iterable[int], amount: int) -> int:
    if amount < 0:
        raise ValueError("amount must be non-negative")
    normalized = sorted(set(coins))
    if any(coin <= 0 for coin in normalized):
        raise ValueError("coin values must be positive")

    dp = [0] + [inf] * amount
    for current in range(1, amount + 1):
        for coin in normalized:
            if coin > current:
                break
            if dp[current - coin] != inf:
                dp[current] = min(dp[current], dp[current - coin] + 1)
    return -1 if dp[amount] == inf else int(dp[amount])


def main() -> None:
    assert coin_change([1, 2, 5], 11) == 3
    assert coin_change([2], 3) == -1
    assert coin_change([1], 0) == 0
    assert coin_change([1, 1, 3], 6) == 2
    print("Q008 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 设去重后硬币数为 `c`，时间 `O(amount*c)`，空间 `O(amount)`。

**测试用例：**

> 我会测普通情况、不可达、金额零、重复面额和非法零面额。

**Follow-up：**

> 如果要求组合数量，状态转移和遍历顺序会改变；如果每种硬币数量有限，就转成有界背包，不能继续使用这个无限转移。

### Q009. 手写 O(1) 的 LRU Cache

**澄清：**

> 我先确认 `get` 和 `put` 要求平均 `O(1)`，容量可以为零，当前先做单线程版本。返回值是否允许存 `-1` 会影响 Miss 表达，下面按 LeetCode 口径用 `-1` 表示不存在。

**思路与不变量：**

> 哈希表负责 O(1) 找节点，双向链表负责新旧顺序。头哨兵后是最新，尾哨兵前是最旧；Map 中每个 Key 恰好对应链表中的一个真实节点。

**完整代码：**

```java
import java.util.HashMap;
import java.util.Map;

public class Q009LruCache {
    private static final class Node {
        final int key;
        int value;
        Node prev;
        Node next;

        Node(int key, int value) {
            this.key = key;
            this.value = value;
        }
    }

    private final int capacity;
    private final Map<Integer, Node> nodes = new HashMap<>();
    private final Node head = new Node(0, 0);
    private final Node tail = new Node(0, 0);

    public Q009LruCache(int capacity) {
        if (capacity < 0) {
            throw new IllegalArgumentException("negative capacity");
        }
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    public int get(int key) {
        Node node = nodes.get(key);
        if (node == null) {
            return -1;
        }
        moveToFront(node);
        return node.value;
    }

    public void put(int key, int value) {
        if (capacity == 0) {
            return;
        }
        Node existing = nodes.get(key);
        if (existing != null) {
            existing.value = value;
            moveToFront(existing);
            return;
        }

        Node created = new Node(key, value);
        nodes.put(key, created);
        addAfterHead(created);
        if (nodes.size() > capacity) {
            Node victim = tail.prev;
            detach(victim);
            nodes.remove(victim.key);
        }
    }

    private void moveToFront(Node node) {
        detach(node);
        addAfterHead(node);
    }

    private void detach(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void addAfterHead(Node node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private static void check(int actual, int expected) {
        if (actual != expected) {
            throw new AssertionError("expected=" + expected + ", actual=" + actual);
        }
    }

    public static void main(String[] args) {
        Q009LruCache cache = new Q009LruCache(2);
        cache.put(1, 1);
        cache.put(2, 2);
        check(cache.get(1), 1);
        cache.put(3, 3);
        check(cache.get(2), -1);
        cache.put(1, 10);
        check(cache.get(1), 10);

        Q009LruCache zero = new Q009LruCache(0);
        zero.put(1, 1);
        check(zero.get(1), -1);
        System.out.println("Q009 passed");
    }
}
```

**复杂度：**

> `get`、`put`、移动和淘汰平均都是 `O(1)`，空间 `O(capacity)`。

**测试用例：**

> 我会测访问刷新顺序、容量满淘汰、更新已有 Key、容量一和容量零。

**Follow-up：**

> 线程安全版不能只把 HashMap 换成 ConcurrentHashMap，因为 Map 与链表是组合不变量。我会用一把锁保护完整 `get/put` 变更，或重新选择适合高并发近似淘汰的数据结构。

### Q010. 实现 Trie：插入、完整词查询和前缀查询

**澄清：**

> 我先确认字符集和大小写规则。下面支持任意 Python 字符，不自动归一化大小写；空串允许作为一个词，空前缀总是存在。

**思路与不变量：**

> 每个节点表示一个前缀，孩子边由下一个字符索引；`terminal` 只表示到这个节点是否恰好存在完整词，不能用“没有孩子”代替。

**完整代码：**

```python
from dataclasses import dataclass, field


@dataclass
class TrieNode:
    children: dict[str, "TrieNode"] = field(default_factory=dict)
    terminal: bool = False


class Trie:
    def __init__(self) -> None:
        self._root = TrieNode()

    def insert(self, word: str) -> None:
        node = self._root
        for char in word:
            node = node.children.setdefault(char, TrieNode())
        node.terminal = True

    def search(self, word: str) -> bool:
        node = self._find(word)
        return node is not None and node.terminal

    def starts_with(self, prefix: str) -> bool:
        return self._find(prefix) is not None

    def _find(self, text: str) -> TrieNode | None:
        node = self._root
        for char in text:
            node = node.children.get(char)
            if node is None:
                return None
        return node


def main() -> None:
    trie = Trie()
    trie.insert("apple")
    assert trie.search("apple")
    assert not trie.search("app")
    assert trie.starts_with("app")
    trie.insert("app")
    assert trie.search("app")
    trie.insert("")
    assert trie.search("")
    print("Q010 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 插入、查询和前缀查询都是 `O(L)`，`L` 是字符串长度；空间与所有新建前缀节点总数成正比。

**测试用例：**

> 我会测完整词、只有前缀、插入短词、空串和不存在前缀。

**Follow-up：**

> 如果要删除，我会在路径回溯时只清理“非 terminal 且没有孩子”的节点；如果字符集固定且追求速度，可以用数组孩子换取更多空间。

### Q011. Quickselect：找数组中第 k 大元素

**澄清：**

> 我先确认 `k` 从 1 开始、重复值按出现次数计算，以及是否允许修改输入。下面复制数组后原地选择，不改变调用方数据；非法 `k` 抛异常。

**思路与不变量：**

> 第 `k` 大对应升序下标 `n-k`。每次随机选 Pivot 做分区，Pivot 左侧不大于它、右侧大于它；如果 Pivot 下标不是目标，我只进入目标所在一侧。

**完整代码：**

```java
import java.util.Arrays;
import java.util.concurrent.ThreadLocalRandom;

public class Q011Quickselect {
    public static int findKthLargest(int[] input, int k) {
        if (input == null || k < 1 || k > input.length) {
            throw new IllegalArgumentException("invalid input or k");
        }
        int[] values = Arrays.copyOf(input, input.length);
        int target = values.length - k;
        int left = 0;
        int right = values.length - 1;

        while (left <= right) {
            int pivotIndex = ThreadLocalRandom.current().nextInt(left, right + 1);
            int finalIndex = partition(values, left, right, pivotIndex);
            if (finalIndex == target) {
                return values[finalIndex];
            }
            if (finalIndex < target) {
                left = finalIndex + 1;
            } else {
                right = finalIndex - 1;
            }
        }
        throw new IllegalStateException("unreachable");
    }

    private static int partition(int[] values, int left, int right, int pivotIndex) {
        int pivotValue = values[pivotIndex];
        swap(values, pivotIndex, right);
        int store = left;
        for (int i = left; i < right; i++) {
            if (values[i] <= pivotValue) {
                swap(values, store++, i);
            }
        }
        swap(values, store, right);
        return store;
    }

    private static void swap(int[] values, int a, int b) {
        int temporary = values[a];
        values[a] = values[b];
        values[b] = temporary;
    }

    private static void check(int actual, int expected) {
        if (actual != expected) {
            throw new AssertionError("expected=" + expected + ", actual=" + actual);
        }
    }

    public static void main(String[] args) {
        check(findKthLargest(new int[]{3, 2, 1, 5, 6, 4}, 2), 5);
        check(findKthLargest(new int[]{3, 2, 3, 1, 2, 4, 5, 5, 6}, 4), 4);
        check(findKthLargest(new int[]{-1}, 1), -1);
        System.out.println("Q011 passed");
    }
}
```

**复杂度：**

> 随机 Pivot 的期望时间 `O(n)`，最坏 `O(n²)`；复制数组空间 `O(n)`，若允许修改输入则算法本身额外空间 `O(1)`。

**测试用例：**

> 我会测普通数组、重复值、负数、`k=1` 和 `k=n`，并确认原输入没有被改动。

**Follow-up：**

> 如果要求严格最坏 `O(n)`，可以用 Median of Medians；如果数据流持续到来，更适合维护大小为 `k` 的小顶堆，单次更新 `O(log k)`。

### Q012. 合并重叠区间

**澄清：**

> 我先确认区间是闭区间，因此 `[1,4]` 和 `[4,5]` 算重叠；输入可能无序，返回新列表，不修改调用方的子列表。

**思路与不变量：**

> 先按起点、终点排序。扫描时，结果列表已经按起点有序且互不重叠；新段只可能和结果最后一段重叠。

**完整代码：**

```python
from collections.abc import Iterable


def merge_intervals(intervals: Iterable[tuple[int, int]]) -> list[tuple[int, int]]:
    ordered = sorted(intervals, key=lambda item: (item[0], item[1]))
    for start, end in ordered:
        if start > end:
            raise ValueError(f"invalid interval: {(start, end)}")

    merged: list[tuple[int, int]] = []
    for start, end in ordered:
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
        else:
            previous_start, previous_end = merged[-1]
            merged[-1] = (previous_start, max(previous_end, end))
    return merged


def main() -> None:
    assert merge_intervals([(1, 3), (2, 6), (8, 10), (15, 18)]) == [
        (1, 6), (8, 10), (15, 18)
    ]
    assert merge_intervals([(1, 4), (4, 5)]) == [(1, 5)]
    assert merge_intervals([(1, 10), (2, 3)]) == [(1, 10)]
    assert merge_intervals([]) == []
    print("Q012 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 排序 `O(n log n)`，扫描 `O(n)`，结果空间最坏 `O(n)`。

**测试用例：**

> 我会测部分重叠、端点接触、完全包含、无重叠、空输入和非法反向区间。

**Follow-up：**

> 如果区间持续到来且需要动态查询，我会考虑有序树或区间树；如果输入已经按起点排序，可以直接 `O(n)` 扫描。

### Q013. 统计和为 k 的连续子数组数量

**澄清：**

> 我先确认是连续子数组，不是子序列，元素可以为负数，所以普通滑动窗口不成立。结果可能很大，下面用 `long` 记录前缀和与答案。

**思路与不变量：**

> 当前前缀和为 `sum` 时，每个此前出现的 `sum-k` 都对应一个以当前位置结尾的合法子数组。哈希表在处理当前位置前，只统计此前的前缀和频次；初始空前缀频次是 1。

**完整代码：**

```java
import java.util.HashMap;
import java.util.Map;

public class Q013SubarraySum {
    public static long countSubarrays(int[] values, long target) {
        Map<Long, Long> frequency = new HashMap<>();
        frequency.put(0L, 1L);
        long prefix = 0L;
        long answer = 0L;

        for (int value : values) {
            prefix += value;
            answer += frequency.getOrDefault(prefix - target, 0L);
            frequency.merge(prefix, 1L, Long::sum);
        }
        return answer;
    }

    private static void check(long actual, long expected) {
        if (actual != expected) {
            throw new AssertionError("expected=" + expected + ", actual=" + actual);
        }
    }

    public static void main(String[] args) {
        check(countSubarrays(new int[]{1, 1, 1}, 2), 2);
        check(countSubarrays(new int[]{1, -1, 0}, 0), 3);
        check(countSubarrays(new int[]{0, 0, 0}, 0), 6);
        check(countSubarrays(new int[]{}, 0), 0);
        System.out.println("Q013 passed");
    }
}
```

**复杂度：**

> 平均时间 `O(n)`，空间 `O(n)`。

**测试用例：**

> 我会测全正数、负数与零、重复前缀、全零和空数组，确保哈希表存的是频次而不是一个下标。

**Follow-up：**

> 如果要求最长子数组，我会保存前缀和最早下标；如果所有数非负且只问存在性或最短长度，才可能使用滑动窗口。

### Q014. 并查集：找第一条形成环的冗余边

**澄清：**

> 我先确认输入是一棵无向树额外加边，节点标签不一定连续；按输入顺序返回第一条连接同一连通分量的边，无则返回空。

**思路与不变量：**

> 处理完前缀边后，并查集准确表示这个前缀图的连通分量。若一条边两端已经同根，它会形成环；否则合并两个根。路径压缩和按大小合并控制树高。

**完整代码：**

```python
from collections.abc import Iterable


class DisjointSet:
    def __init__(self) -> None:
        self.parent: dict[int, int] = {}
        self.size: dict[int, int] = {}

    def add(self, value: int) -> None:
        if value not in self.parent:
            self.parent[value] = value
            self.size[value] = 1

    def find(self, value: int) -> int:
        self.add(value)
        root = value
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[value] != value:
            parent = self.parent[value]
            self.parent[value] = root
            value = parent
        return root

    def union(self, left: int, right: int) -> bool:
        root_left = self.find(left)
        root_right = self.find(right)
        if root_left == root_right:
            return False
        if self.size[root_left] < self.size[root_right]:
            root_left, root_right = root_right, root_left
        self.parent[root_right] = root_left
        self.size[root_left] += self.size[root_right]
        return True


def redundant_connection(edges: Iterable[tuple[int, int]]) -> tuple[int, int] | None:
    groups = DisjointSet()
    for left, right in edges:
        if left == right or not groups.union(left, right):
            return (left, right)
    return None


def main() -> None:
    assert redundant_connection([(1, 2), (1, 3), (2, 3)]) == (2, 3)
    assert redundant_connection([(10, 20), (20, 30)]) is None
    assert redundant_connection([(7, 7)]) == (7, 7)
    print("Q014 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> `m` 条边的时间近似 `O(m * alpha(n))`，空间 `O(n)`。

**测试用例：**

> 我会测普通环、无环、标签不连续和自环。

**Follow-up：**

> 普通并查集不擅长删除边；如果图是动态增删并持续询问连通性，需要离线回滚并查集或更复杂的动态图结构。

### Q015. Dijkstra：非负权图单源最短路

**澄清：**

> 我先确认边权非负、图是有向还是无向、不可达如何表示。下面实现有向图，返回 `long[]`，不可达为 `Long.MAX_VALUE`，负边直接拒绝。

**思路与不变量：**

> 小顶堆保存候选距离。每次弹出时，如果距离不是当前 `distance[node]`，说明是过期记录；否则这个非负权图中的最短距离已经确定，再用它松弛出边。

**完整代码：**

```java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.PriorityQueue;

public class Q015Dijkstra {
    public record Edge(int to, int weight) {}
    private record State(int node, long distance) {}

    public static long[] shortestPaths(List<List<Edge>> graph, int source) {
        int nodeCount = graph.size();
        if (source < 0 || source >= nodeCount) {
            throw new IllegalArgumentException("invalid source");
        }
        for (List<Edge> edges : graph) {
            for (Edge edge : edges) {
                if (edge.to() < 0 || edge.to() >= nodeCount || edge.weight() < 0) {
                    throw new IllegalArgumentException("invalid edge");
                }
            }
        }

        long[] distance = new long[nodeCount];
        Arrays.fill(distance, Long.MAX_VALUE);
        distance[source] = 0L;
        PriorityQueue<State> queue = new PriorityQueue<>(
                Comparator.comparingLong(State::distance));
        queue.offer(new State(source, 0L));

        while (!queue.isEmpty()) {
            State state = queue.poll();
            if (state.distance() != distance[state.node()]) {
                continue;
            }
            for (Edge edge : graph.get(state.node())) {
                long candidate = state.distance() + edge.weight();
                if (candidate < distance[edge.to()]) {
                    distance[edge.to()] = candidate;
                    queue.offer(new State(edge.to(), candidate));
                }
            }
        }
        return distance;
    }

    private static List<List<Edge>> graph(int size) {
        List<List<Edge>> graph = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            graph.add(new ArrayList<>());
        }
        return graph;
    }

    public static void main(String[] args) {
        List<List<Edge>> graph = graph(5);
        graph.get(0).add(new Edge(1, 4));
        graph.get(0).add(new Edge(2, 1));
        graph.get(2).add(new Edge(1, 2));
        graph.get(1).add(new Edge(3, 1));
        graph.get(2).add(new Edge(3, 5));
        long[] actual = shortestPaths(graph, 0);
        long[] expected = {0, 3, 1, 4, Long.MAX_VALUE};
        if (!Arrays.equals(actual, expected)) {
            throw new AssertionError("actual=" + Arrays.toString(actual));
        }
        System.out.println("Q015 passed");
    }
}
```

**复杂度：**

> 邻接表加二叉堆时间 `O((V+E) log V)`，空间 `O(V+E)`。

**测试用例：**

> 我会测存在更短绕路、过期堆记录、不可达节点、单节点和负边拒绝。

**Follow-up：**

> 有负边要改 Bellman-Ford 等算法；如果所有边权相同，BFS 更简单；如果要恢复路径，松弛时额外保存 predecessor。

## 二、AI / 后端现场编码（Q016-Q023）

### Q016. 手写有界阻塞队列

**澄清：**

> 我先确认生产者在队列满时阻塞、消费者在空时阻塞，操作支持中断，当前不接受 `null`。关闭协议由上层通过哨兵或单独状态完成；下面示例用哨兵结束一个消费者。

**思路与不变量：**

> 一把锁保护队列与大小不变量，`notEmpty` 和 `notFull` 分别唤醒消费者与生产者。等待必须放在 `while` 中，既防虚假唤醒，也防被唤醒后条件已被别的线程抢走。

**完整代码：**

```java
import java.util.ArrayDeque;
import java.util.Objects;
import java.util.Queue;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public class Q016BoundedBlockingQueue {
    public static final class BoundedQueue<T> {
        private final int capacity;
        private final Queue<T> queue = new ArrayDeque<>();
        private final ReentrantLock lock = new ReentrantLock();
        private final Condition notEmpty = lock.newCondition();
        private final Condition notFull = lock.newCondition();

        public BoundedQueue(int capacity) {
            if (capacity <= 0) {
                throw new IllegalArgumentException("capacity must be positive");
            }
            this.capacity = capacity;
        }

        public void put(T value) throws InterruptedException {
            Objects.requireNonNull(value, "null values are not supported");
            lock.lockInterruptibly();
            try {
                while (queue.size() == capacity) {
                    notFull.await();
                }
                queue.add(value);
                notEmpty.signal();
            } finally {
                lock.unlock();
            }
        }

        public T take() throws InterruptedException {
            lock.lockInterruptibly();
            try {
                while (queue.isEmpty()) {
                    notEmpty.await();
                }
                T value = queue.remove();
                notFull.signal();
                return value;
            } finally {
                lock.unlock();
            }
        }

        public int size() {
            lock.lock();
            try {
                return queue.size();
            } finally {
                lock.unlock();
            }
        }
    }

    public static void main(String[] args) throws Exception {
        BoundedQueue<Integer> queue = new BoundedQueue<>(2);
        AtomicInteger sum = new AtomicInteger();

        Thread consumer = new Thread(() -> {
            try {
                while (true) {
                    int value = queue.take();
                    if (value == -1) {
                        return;
                    }
                    sum.addAndGet(value);
                }
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
        });
        consumer.start();

        queue.put(1);
        queue.put(2);
        queue.put(3);
        queue.put(-1);
        consumer.join(2_000);

        if (consumer.isAlive() || sum.get() != 6 || queue.size() != 0) {
            throw new AssertionError("queue test failed");
        }
        System.out.println("Q016 passed");
    }
}
```

**复杂度：**

> 入队和出队都是 `O(1)`，空间 `O(capacity)`；等待时间由上下游速度决定，不属于算法 CPU 复杂度。

**测试用例：**

> 我会测队列满时生产者阻塞、空时消费者阻塞、多生产者竞争、中断、容量一和关闭。示例验证了容量限制、阻塞唤醒和哨兵退出。

**Follow-up：**

> 多消费者用哨兵时需要每个消费者一个哨兵，或者增加显式 `close()` 并广播唤醒。生产代码优先用 `ArrayBlockingQueue`，手写版本用于说明锁与条件不变量。

### Q017. 支持总 Deadline、退避和抖动的异步重试器

**澄清：**

> 我先确认操作本身幂等或带幂等键，只重试瞬时异常；同时有最大次数和端到端 Deadline，等待与单次调用都算在 Deadline 内。下面不阻塞业务线程。

**思路与不变量：**

> 整条逻辑只有一个最终 Future，每次尝试前重算剩余时间。成功、不可重试、次数耗尽和 Deadline 到期都会且只会完成最终 Future 一次；下一次调度使用指数退避加抖动，但不超过剩余时间。

**完整代码：**

```java
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;
import java.util.function.Supplier;

public class Q017DeadlineRetry {
    public static <T> CompletableFuture<T> retryAsync(
            Supplier<? extends CompletionStage<T>> operation,
            Predicate<Throwable> retryable,
            int maxAttempts,
            Duration baseDelay,
            Duration totalDeadline,
            ScheduledExecutorService scheduler) {
        Objects.requireNonNull(operation);
        Objects.requireNonNull(retryable);
        Objects.requireNonNull(baseDelay);
        Objects.requireNonNull(totalDeadline);
        Objects.requireNonNull(scheduler);
        if (maxAttempts <= 0 || baseDelay.isNegative()
                || baseDelay.isZero() || totalDeadline.isNegative()
                || totalDeadline.isZero()) {
            throw new IllegalArgumentException("invalid retry policy");
        }

        long deadlineNanos = saturatingAdd(System.nanoTime(), totalDeadline.toNanos());
        CompletableFuture<T> result = new CompletableFuture<>();
        attempt(operation, retryable, maxAttempts, baseDelay.toNanos(),
                scheduler, deadlineNanos, 1, result);
        return result;
    }

    private static <T> void attempt(
            Supplier<? extends CompletionStage<T>> operation,
            Predicate<Throwable> retryable,
            int maxAttempts,
            long baseDelayNanos,
            ScheduledExecutorService scheduler,
            long deadlineNanos,
            int attemptNumber,
            CompletableFuture<T> result) {
        if (result.isDone()) {
            return;
        }
        long remaining = deadlineNanos - System.nanoTime();
        if (remaining <= 0) {
            result.completeExceptionally(new TimeoutException("total deadline exceeded"));
            return;
        }

        CompletableFuture<T> current;
        try {
            current = operation.get().toCompletableFuture();
        } catch (RuntimeException startFailure) {
            current = CompletableFuture.failedFuture(startFailure);
        }

        current.orTimeout(remaining, TimeUnit.NANOSECONDS).whenComplete((value, error) -> {
            if (error == null) {
                result.complete(value);
                return;
            }
            Throwable cause = unwrap(error);
            if (cause instanceof Error
                    || attemptNumber >= maxAttempts
                    || !retryable.test(cause)) {
                result.completeExceptionally(cause);
                return;
            }

            long left = deadlineNanos - System.nanoTime();
            if (left <= 0) {
                result.completeExceptionally(new TimeoutException("total deadline exceeded"));
                return;
            }
            long exponential = saturatingMultiply(
                    baseDelayNanos, 1L << Math.min(attemptNumber - 1, 20));
            long jitterBound = Math.max(1L, exponential / 2L);
            long jitter = ThreadLocalRandom.current().nextLong(jitterBound);
            long delay = Math.min(left, saturatingAdd(exponential, jitter));
            if (delay >= left) {
                result.completeExceptionally(new TimeoutException("no time left for retry"));
                return;
            }
            scheduler.schedule(
                    () -> attempt(operation, retryable, maxAttempts, baseDelayNanos,
                            scheduler, deadlineNanos, attemptNumber + 1, result),
                    delay,
                    TimeUnit.NANOSECONDS);
        });
    }

    private static Throwable unwrap(Throwable error) {
        if ((error instanceof CompletionException || error instanceof ExecutionException)
                && error.getCause() != null) {
            return error.getCause();
        }
        return error;
    }

    private static long saturatingAdd(long left, long right) {
        if (right > 0 && left > Long.MAX_VALUE - right) {
            return Long.MAX_VALUE;
        }
        return left + right;
    }

    private static long saturatingMultiply(long left, long right) {
        if (left > 0 && right > Long.MAX_VALUE / left) {
            return Long.MAX_VALUE;
        }
        return left * right;
    }

    public static void main(String[] args) throws Exception {
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        try {
            AtomicInteger calls = new AtomicInteger();
            String value = retryAsync(
                    () -> {
                        int call = calls.incrementAndGet();
                        return call < 3
                                ? CompletableFuture.failedFuture(
                                        new IllegalStateException("transient"))
                                : CompletableFuture.completedFuture("ok");
                    },
                    error -> error instanceof IllegalStateException,
                    5,
                    Duration.ofMillis(2),
                    Duration.ofSeconds(1),
                    scheduler).get(2, TimeUnit.SECONDS);

            if (!value.equals("ok") || calls.get() != 3) {
                throw new AssertionError("retry test failed");
            }
            System.out.println("Q017 passed");
        } finally {
            scheduler.shutdownNow();
        }
    }
}
```

**复杂度：**

> 最多 `r` 次尝试，调度器侧 CPU 工作 `O(r)`；墙钟时间由调用耗时和退避决定。最终 Future 与少量状态是 `O(1)`，底层调度器队列不超过待调度重试数。

**测试用例：**

> 我会测失败两次后成功、不可重试异常、次数耗尽、单次调用挂住触发 Deadline、取消和调度器关闭。

**Follow-up：**

> 这个版本用 `orTimeout` 限制等待，但不保证底层网络调用被真正取消。生产接口应接收 Cancellation Token/AbortSignal，并把最终取消向 Provider Client 传播。

### Q018. 线程安全 Token Bucket 限流器

**澄清：**

> 我先确认容量表示允许的最大突发，补充速率按每秒 Token，单次请求可以消耗多个 Token。`cost > capacity` 永远不可能成功，必须立即拒绝，不能返回一个永远等待的时间。

**思路与不变量：**

> 每次操作先用单调时钟按经过时间补 Token，再判断并扣减；“补充、判断、扣减”在同一同步块中完成。Token 始终位于 `[0,capacity]`。

**完整代码：**

```java
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

public class Q018TokenBucket {
    public static final class TokenBucket {
        private final double capacity;
        private final double refillPerSecond;
        private final LongSupplier nanoClock;
        private double tokens;
        private long lastRefillNanos;

        public TokenBucket(
                double capacity,
                double refillPerSecond,
                LongSupplier nanoClock) {
            if (!(capacity > 0.0) || !(refillPerSecond > 0.0)) {
                throw new IllegalArgumentException("capacity and rate must be positive");
            }
            this.capacity = capacity;
            this.refillPerSecond = refillPerSecond;
            this.nanoClock = nanoClock;
            this.tokens = capacity;
            this.lastRefillNanos = nanoClock.getAsLong();
        }

        public synchronized boolean tryConsume(double cost) {
            validateCost(cost);
            refill();
            if (tokens + 1e-12 < cost) {
                return false;
            }
            tokens -= cost;
            return true;
        }

        public synchronized long nanosUntilAvailable(double cost) {
            validateCost(cost);
            refill();
            if (tokens >= cost) {
                return 0L;
            }
            double missing = cost - tokens;
            return (long) Math.ceil(missing / refillPerSecond * 1_000_000_000.0);
        }

        private void validateCost(double cost) {
            if (!(cost > 0.0) || cost > capacity) {
                throw new IllegalArgumentException("cost must be in (0, capacity]");
            }
        }

        private void refill() {
            long now = nanoClock.getAsLong();
            long elapsed = now - lastRefillNanos;
            if (elapsed <= 0) {
                return;
            }
            tokens = Math.min(
                    capacity,
                    tokens + elapsed / 1_000_000_000.0 * refillPerSecond);
            lastRefillNanos = now;
        }
    }

    public static void main(String[] args) {
        AtomicLong clock = new AtomicLong(1_000_000L);
        TokenBucket bucket = new TokenBucket(10.0, 2.0, clock::get);

        if (!bucket.tryConsume(10.0) || bucket.tryConsume(1.0)) {
            throw new AssertionError("initial capacity failed");
        }
        if (bucket.nanosUntilAvailable(1.0) != 500_000_000L) {
            throw new AssertionError("wait calculation failed");
        }
        clock.addAndGet(500_000_000L);
        if (!bucket.tryConsume(1.0)) {
            throw new AssertionError("refill failed");
        }
        try {
            bucket.tryConsume(11.0);
            throw new AssertionError("oversized cost should fail");
        } catch (IllegalArgumentException expected) {
            // Expected.
        }
        System.out.println("Q018 passed");
    }
}
```

**复杂度：**

> 每次消费和等待时间计算都是 `O(1)`，单桶状态 `O(1)`；按租户建桶时总体空间与活跃租户数成正比。

**测试用例：**

> 我用可控单调时钟测满桶、耗尽、精确补充、突发上限、非法零 Cost 和 `cost > capacity`。

**Follow-up：**

> 分布式版本可以用 Redis Lua 或带版本的数据库原子更新，但还要明确存储故障时 Fail Open/Closed、冷 Key TTL、时钟来源以及 RPM 与 Token Cost 是否需要两层桶。

### Q019. 实现多路检索结果的 RRF 融合

**澄清：**

> 我先确认每条文档有稳定 ID，同一路召回可能错误地出现重复 ID，各路原始分数不可直接比较。下面按去重后的名次计算 RRF，支持每路权重、稳定 Tie-break 和最终 Top K。

**思路与不变量：**

> 同一文档在所有列表中的贡献都累加到同一 ID；同一列表内只认第一次出现，重复项既不重复加分，也不挤占后续文档的唯一名次。分数是 `weight/(rrf_k+rank)`。

**完整代码：**

```python
from collections import defaultdict
from collections.abc import Sequence


def reciprocal_rank_fusion(
    ranked_lists: Sequence[Sequence[str]],
    *,
    rrf_k: int = 60,
    limit: int | None = None,
    weights: Sequence[float] | None = None,
) -> list[tuple[str, float]]:
    if rrf_k < 0:
        raise ValueError("rrf_k must be non-negative")
    if limit is not None and limit < 0:
        raise ValueError("limit must be non-negative")
    if weights is None:
        weights = [1.0] * len(ranked_lists)
    if len(weights) != len(ranked_lists) or any(weight < 0 for weight in weights):
        raise ValueError("weights must match lists and be non-negative")

    scores: dict[str, float] = defaultdict(float)
    first_seen: dict[str, int] = {}
    encounter = 0

    for documents, weight in zip(ranked_lists, weights, strict=True):
        seen_in_list: set[str] = set()
        unique_rank = 0
        for document_id in documents:
            if document_id in seen_in_list:
                continue
            seen_in_list.add(document_id)
            unique_rank += 1
            if document_id not in first_seen:
                first_seen[document_id] = encounter
                encounter += 1
            scores[document_id] += weight / (rrf_k + unique_rank)

    ordered = sorted(
        scores.items(),
        key=lambda item: (-item[1], first_seen[item[0]], item[0]),
    )
    return ordered if limit is None else ordered[:limit]


def main() -> None:
    result = reciprocal_rank_fusion(
        [["a", "a", "b"], ["b", "a", "c"]],
        rrf_k=0,
        limit=3,
    )
    assert [document for document, _ in result] == ["a", "b", "c"]
    assert abs(dict(result)["a"] - 1.5) < 1e-12
    assert abs(dict(result)["b"] - 1.5) < 1e-12
    assert reciprocal_rank_fusion([], limit=0) == []
    print("Q019 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 所有候选条目总数为 `N`，累加 `O(N)`；去重后文档数 `M`，全排序 `O(M log M)`，空间 `O(M)`。只取 Top K 可用堆降到 `O(M log K)`。

**测试用例：**

> 我会测跨路重复、同一路重复、并列分数、不同权重、空输入和 `limit=0`。示例特意验证重复 `a` 没有让后面的 `b` 名次偏移。

**Follow-up：**

> 融合后仍要做权限校验或保证各路已用同一 ACL；RRF 常数、权重和截断深度必须版本化，并用标注 Query 验证，不能只凭经验固定。

### Q020. 实现受 Token 预算约束的 Parent-child Chunker

**澄清：**

> 我先确认这里用可注入 Tokenizer；为了让示例只依赖标准库，测试 Tokenizer 用非空白 Token，生产要替换成目标模型真实 Tokenizer。父块按空行分段，子块限制最大 Token，并保存原文绝对偏移和重叠。

**思路与不变量：**

> 每个 Child 都属于一个 Parent，`text == source[start:end]`，Token 数不超过上限，顺序单调且不会产生空块。下一块起点按 `max_tokens-overlap` 前进，要求 overlap 小于上限，避免死循环。

**完整代码：**

```python
from dataclasses import dataclass
import re


@dataclass(frozen=True)
class ParentChunk:
    parent_id: str
    text: str
    start: int
    end: int


@dataclass(frozen=True)
class ChildChunk:
    child_id: str
    parent_id: str
    text: str
    start: int
    end: int
    token_count: int
    order: int


def _paragraphs(source: str) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for match in re.finditer(r".*?(?:\n\s*\n|\Z)", source, flags=re.DOTALL):
        raw = match.group(0)
        if not raw:
            continue
        left_trim = len(raw) - len(raw.lstrip())
        right_trimmed = raw.rstrip()
        if not right_trimmed.strip():
            continue
        start = match.start() + left_trim
        end = match.start() + len(right_trimmed)
        if start < end:
            ranges.append((start, end))
    return ranges


def chunk_document(
    source: str,
    *,
    max_tokens: int,
    overlap_tokens: int = 0,
) -> tuple[list[ParentChunk], list[ChildChunk]]:
    if max_tokens <= 0 or overlap_tokens < 0 or overlap_tokens >= max_tokens:
        raise ValueError("require max_tokens > overlap_tokens >= 0")

    parents: list[ParentChunk] = []
    children: list[ChildChunk] = []
    for parent_index, (parent_start, parent_end) in enumerate(_paragraphs(source)):
        parent_id = f"p{parent_index}"
        parent_text = source[parent_start:parent_end]
        parent = ParentChunk(parent_id, parent_text, parent_start, parent_end)
        parents.append(parent)

        token_spans = [(m.start(), m.end()) for m in re.finditer(r"\S+", parent_text)]
        token_start = 0
        child_order = 0
        while token_start < len(token_spans):
            token_end = min(token_start + max_tokens, len(token_spans))
            local_start = token_spans[token_start][0]
            local_end = token_spans[token_end - 1][1]
            absolute_start = parent_start + local_start
            absolute_end = parent_start + local_end
            children.append(
                ChildChunk(
                    child_id=f"{parent_id}-c{child_order}",
                    parent_id=parent_id,
                    text=source[absolute_start:absolute_end],
                    start=absolute_start,
                    end=absolute_end,
                    token_count=token_end - token_start,
                    order=child_order,
                )
            )
            if token_end == len(token_spans):
                break
            token_start = token_end - overlap_tokens
            child_order += 1
    return parents, children


def main() -> None:
    source = "one two three four five\n\nalpha beta gamma"
    parents, children = chunk_document(source, max_tokens=3, overlap_tokens=1)
    assert len(parents) == 2
    assert [child.text for child in children] == [
        "one two three", "three four five", "alpha beta gamma"
    ]
    assert all(child.token_count <= 3 and child.text for child in children)
    assert all(child.text == source[child.start:child.end] for child in children)
    assert chunk_document("   ", max_tokens=2) == ([], [])
    print("Q020 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 正则扫描和分块总体近似 `O(n + 输出重叠量)`，空间也是输出规模。若每扩一个字符都从头 Tokenize，会退化到 `O(n²)`，这个实现没有重复扫描已完成前缀。

**测试用例：**

> 我会测多父块、需要重叠、单块刚好上限、空白文档、非法 overlap，并校验每个 Offset 能精确切回原文。

**Follow-up：**

> Markdown、代码和表格需要结构感知父块；单个超长 Token/代码行要由真实 Tokenizer 做硬切。索引时召回 Child，组装时是否扩 Parent 要再次受总 Token 预算约束。

### Q021. 实现增量流式 JSON / Tool Call 参数解析器

**澄清：**

> 我先确认流里是一到多个 JSON Object/Array，UTF-8 字符可能跨 Chunk，字符串里可能含转义引号和括号；只有完整且通过标准 JSON Parser 校验后才能执行 Tool。下面按 call_id 分别维护解析状态。

**思路与不变量：**

> 增量 UTF-8 Decoder 保证多字节字符不被切坏；状态机只扫描每个字符一次，维护括号栈、字符串内外和 Escape。已经扫描的未完成前缀保留状态，不会每来一个 Chunk 都从头 Parse。

**完整代码：**

```python
import codecs
import json
from typing import Any


class StreamingJsonParser:
    def __init__(self, max_chars: int = 1_000_000) -> None:
        self._decoder = codecs.getincrementaldecoder("utf-8")()
        self._buffer = ""
        self._scan = 0
        self._start: int | None = None
        self._stack: list[str] = []
        self._in_string = False
        self._escaped = False
        self._max_chars = max_chars

    def feed(self, data: bytes, *, final: bool = False) -> list[Any]:
        self._buffer += self._decoder.decode(data, final=final)
        if len(self._buffer) > self._max_chars:
            raise ValueError("JSON value exceeds configured limit")

        completed: list[Any] = []
        while self._scan < len(self._buffer):
            char = self._buffer[self._scan]
            if self._start is None:
                if char.isspace():
                    self._scan += 1
                    continue
                if char not in "[{":
                    raise ValueError("expected JSON object or array")
                self._start = self._scan

            if self._in_string:
                if self._escaped:
                    self._escaped = False
                elif char == "\\":
                    self._escaped = True
                elif char == '"':
                    self._in_string = False
            else:
                if char == '"':
                    self._in_string = True
                elif char in "[{":
                    self._stack.append(char)
                elif char in "]}":
                    if not self._stack:
                        raise ValueError("unexpected closing bracket")
                    opening = self._stack.pop()
                    if (opening, char) not in {("[", "]"), ("{", "}")}:
                        raise ValueError("mismatched brackets")
                    if not self._stack:
                        end = self._scan + 1
                        raw = self._buffer[self._start:end]
                        completed.append(json.loads(raw))
                        self._buffer = self._buffer[end:]
                        self._scan = 0
                        self._start = None
                        self._in_string = False
                        self._escaped = False
                        continue
            self._scan += 1

        if final:
            if self._start is not None or self._stack or self._buffer.strip():
                raise ValueError("incomplete JSON at end of stream")
            self._buffer = ""
            self._scan = 0
        return completed


class ToolCallArgumentParser:
    def __init__(self) -> None:
        self._parsers: dict[str, StreamingJsonParser] = {}

    def feed(self, call_id: str, data: bytes, *, final: bool = False) -> list[Any]:
        parser = self._parsers.setdefault(call_id, StreamingJsonParser())
        values = parser.feed(data, final=final)
        if final:
            del self._parsers[call_id]
        return values


def main() -> None:
    payload = '{"text":"中{文}","quote":"a\\\"b"}'.encode("utf-8")
    parser = ToolCallArgumentParser()
    output: list[Any] = []
    # 中文字符从第 9 个字节开始；10 和 11 会把一个 UTF-8 字符拆开。
    cuts = [1, 3, 10, 11, len(payload)]
    start = 0
    for end in cuts:
        output.extend(parser.feed("call-1", payload[start:end], final=end == len(payload)))
        start = end
    assert output == [{"text": "中{文}", "quote": 'a"b'}]

    many = StreamingJsonParser()
    assert many.feed(b'{"a":1} [2,3]', final=True) == [{"a": 1}, [2, 3]]
    print("Q021 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 总输入 `n` 个字符时扫描 `O(n)`，缓冲空间 `O(当前未完成 JSON 大小)`；按 call_id 并行时空间是所有未完成调用缓冲之和。

**测试用例：**

> 我会测 UTF-8 中文跨 Chunk、字符串内括号、转义引号、连续多个 JSON、括号不匹配、最终不完整和超大 Payload。

**Follow-up：**

> 生产实现还要限制嵌套深度、总字节和并行 call_id 数。完成 JSON 只表示语法合法，执行前仍要做 Tool Schema、权限、业务约束和幂等校验。

### Q022. 用 CAS 和租约避免两个 Worker 同时完成同一任务

**澄清：**

> 我先确认租约只解决任务所有权，不自动保证外部副作用 Exactly-once。下面用 SQLite 演示单条条件更新、版本和过期接管；生产 PostgreSQL 应使用数据库时间并配合业务幂等键。

**思路与不变量：**

> 领取只有在期望版本匹配，且任务待处理或旧租约过期时成功。续租和完成都必须携带当前 owner 与 version；旧 Worker 在租约过期、版本递增后无法提交。

**完整代码：**

```python
from dataclasses import dataclass
import sqlite3


@dataclass(frozen=True)
class Lease:
    owner: str
    version: int
    lease_until: float


def create_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE tasks (
            task_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            owner TEXT,
            lease_until REAL,
            version INTEGER NOT NULL
        )
        """
    )


def acquire(
    connection: sqlite3.Connection,
    task_id: str,
    owner: str,
    *,
    now: float,
    ttl_seconds: float,
    expected_version: int,
) -> Lease | None:
    if ttl_seconds <= 0:
        raise ValueError("ttl must be positive")
    lease_until = now + ttl_seconds
    with connection:
        cursor = connection.execute(
            """
            UPDATE tasks
               SET status = 'RUNNING',
                   owner = ?,
                   lease_until = ?,
                   version = version + 1
             WHERE task_id = ?
               AND version = ?
               AND (status = 'PENDING' OR lease_until <= ?)
            """,
            (owner, lease_until, task_id, expected_version, now),
        )
        if cursor.rowcount != 1:
            return None
        row = connection.execute(
            "SELECT owner, version, lease_until FROM tasks WHERE task_id = ?",
            (task_id,),
        ).fetchone()
    assert row is not None
    return Lease(str(row[0]), int(row[1]), float(row[2]))


def complete(
    connection: sqlite3.Connection,
    task_id: str,
    lease: Lease,
    *,
    now: float,
) -> bool:
    with connection:
        cursor = connection.execute(
            """
            UPDATE tasks
               SET status = 'SUCCEEDED',
                   version = version + 1
             WHERE task_id = ?
               AND status = 'RUNNING'
               AND owner = ?
               AND version = ?
               AND lease_until > ?
            """,
            (task_id, lease.owner, lease.version, now),
        )
    return cursor.rowcount == 1


def main() -> None:
    connection = sqlite3.connect(":memory:")
    create_schema(connection)
    connection.execute(
        "INSERT INTO tasks VALUES ('t1', 'PENDING', NULL, NULL, 0)"
    )

    first = acquire(connection, "t1", "worker-a", now=100.0,
                    ttl_seconds=10.0, expected_version=0)
    assert first == Lease("worker-a", 1, 110.0)
    assert acquire(connection, "t1", "worker-b", now=101.0,
                   ttl_seconds=10.0, expected_version=1) is None

    second = acquire(connection, "t1", "worker-b", now=111.0,
                     ttl_seconds=10.0, expected_version=1)
    assert second == Lease("worker-b", 2, 121.0)
    assert not complete(connection, "t1", first, now=112.0)
    assert complete(connection, "t1", second, now=112.0)
    print("Q022 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 命中主键时每次领取和完成是一次索引定位加单行条件更新，通常 `O(log n)`；应用侧额外状态 `O(1)`。

**测试用例：**

> 我会测首次领取、未过期抢占失败、过期接管、旧 Worker 提交失败、当前 Worker 完成和租约边界时间。

**Follow-up：**

> 生产库用 `clock_timestamp()` 等数据库时间减少机器时钟差；长任务在租约过半前续租。外部副作用仍需幂等键，因为 Worker 可能在副作用成功、状态提交前崩溃。

### Q023. 实现带 Idempotency-Key 的异步任务创建服务

**澄清：**

> 我先确认幂等范围是租户加 Key，同一个 Key 只能代表一个规范化请求；相同请求返回同一 task_id，不同请求返回冲突。下面用 SQLite 和标准库实现服务核心，真实 HTTP 层只负责认证与映射状态码。

**思路与不变量：**

> 请求体做稳定 JSON 规范化并计算 SHA-256。任务与幂等记录在同一事务创建，数据库唯一约束裁决并发；不能依赖“先查没有再插入”。

**完整代码：**

```python
from dataclasses import dataclass
import hashlib
import json
import sqlite3
import uuid
from typing import Any


class IdempotencyConflict(Exception):
    pass


@dataclass(frozen=True)
class CreateResponse:
    task_id: str
    status: str


class TaskService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection
        self.connection.execute(
            """
            CREATE TABLE tasks (
                task_id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                status TEXT NOT NULL
            )
            """
        )
        self.connection.execute(
            """
            CREATE TABLE idempotency_records (
                tenant_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                request_hash TEXT NOT NULL,
                task_id TEXT NOT NULL,
                response_json TEXT NOT NULL,
                PRIMARY KEY (tenant_id, idempotency_key),
                FOREIGN KEY (task_id) REFERENCES tasks(task_id)
            )
            """
        )

    def create_task(
        self,
        tenant_id: str,
        idempotency_key: str,
        payload: dict[str, Any],
    ) -> CreateResponse:
        if not tenant_id or not idempotency_key:
            raise ValueError("tenant and idempotency key are required")
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        request_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

        with self.connection:
            existing = self.connection.execute(
                """
                SELECT request_hash, response_json
                  FROM idempotency_records
                 WHERE tenant_id = ? AND idempotency_key = ?
                """,
                (tenant_id, idempotency_key),
            ).fetchone()
            if existing is not None:
                if existing[0] != request_hash:
                    raise IdempotencyConflict("same key used for a different request")
                stored = json.loads(existing[1])
                return CreateResponse(stored["task_id"], stored["status"])

            task_id = str(uuid.uuid4())
            response = CreateResponse(task_id, "PENDING")
            response_json = json.dumps(response.__dict__, sort_keys=True)
            self.connection.execute(
                "INSERT INTO tasks VALUES (?, ?, ?, ?)",
                (task_id, tenant_id, canonical, response.status),
            )
            self.connection.execute(
                "INSERT INTO idempotency_records VALUES (?, ?, ?, ?, ?)",
                (tenant_id, idempotency_key, request_hash, task_id, response_json),
            )
            return response


def main() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys = ON")
    service = TaskService(connection)

    first = service.create_task("tenant-a", "key-1", {"b": 2, "a": 1})
    repeated = service.create_task("tenant-a", "key-1", {"a": 1, "b": 2})
    assert first == repeated
    assert connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 1

    try:
        service.create_task("tenant-a", "key-1", {"a": 999})
        raise AssertionError("different request should conflict")
    except IdempotencyConflict:
        pass

    other_tenant = service.create_task("tenant-b", "key-1", {"a": 1, "b": 2})
    assert other_tenant.task_id != first.task_id
    print("Q023 passed")


if __name__ == "__main__":
    main()
```

**复杂度：**

> 规范化和哈希是 `O(payload_size)`，唯一索引查询/插入通常 `O(log n)`；存储与有效幂等记录数成正比。

**测试用例：**

> 我会测相同 Key 同 Payload、字段顺序不同、相同 Key 不同 Payload、不同租户同 Key，以及并发插入由唯一约束裁决。

**Follow-up：**

> 真正并发下，首次插入要捕获唯一键冲突后回读并比较 Hash；SQLite 示例用单连接串行展示语义。任务创建后投递队列要用 Outbox，避免数据库成功但消息丢失。

## 三、PostgreSQL 与 Debug（Q024-Q030）

### Q024. SQL：每个分类取销售额 Top N 商品

**澄清：**

> 我先确认 Top N 是严格返回 N 行还是并列都返回。下面按严格 N 行处理，先聚合商品销售额，再用 `ROW_NUMBER`；并列时 product_id 小的优先，保证结果确定。

**思路与不变量：**

> 不能直接对原始订单行排名，否则同一商品会占多行。我先按分类和商品汇总，再在每个分类分区内按销售额排序编号。

**可执行 SQL：**

```sql
DROP TABLE IF EXISTS sales_q024;
CREATE TABLE sales_q024 (
    sale_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id  bigint NOT NULL,
    product_id   bigint NOT NULL,
    amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
    sold_at      timestamptz NOT NULL
);

INSERT INTO sales_q024 (category_id, product_id, amount_cents, sold_at) VALUES
    (1, 101, 500, now()),
    (1, 101, 700, now()),
    (1, 102, 900, now()),
    (1, 103, 900, now()),
    (2, 201, 300, now()),
    (2, 202, 600, now()),
    (2, 203, 100, now());

WITH product_totals AS (
    SELECT category_id,
           product_id,
           SUM(amount_cents) AS revenue_cents
      FROM sales_q024
     GROUP BY category_id, product_id
), ranked AS (
    SELECT category_id,
           product_id,
           revenue_cents,
           ROW_NUMBER() OVER (
               PARTITION BY category_id
               ORDER BY revenue_cents DESC, product_id ASC
           ) AS position
      FROM product_totals
)
SELECT category_id, product_id, revenue_cents, position
  FROM ranked
 WHERE position <= 2
 ORDER BY category_id, position;

-- 期望：分类 1 返回 (101,1200)、(102,900)；
--       分类 2 返回 (202,600)、(201,300)。
```

**复杂度：**

> 扫描与聚合近似 `O(n)`，每个分类内排序合计最坏 `O(m log m)`，`m` 是聚合后商品数。真实执行计划受分区、索引、内存和并行聚合影响。

**测试用例：**

> 我会测同一商品多订单、销售额并列、分类商品不足 N、空分类和时间窗过滤。严格 N 用 `ROW_NUMBER`，并列全收则改 `DENSE_RANK`。

**Follow-up：**

> 数据量大时可按日期分区，先做日级商品聚合再汇总；但补单和退款必须能修正聚合，不能只追加一个越来越错的缓存表。

### Q025. SQL：按业务键去重，只保留最新一条

**澄清：**

> 我先确认“最新”按业务更新时间，时间相同再按自增 ID；需要物理删除还是只查询最新视图。下面演示可审计地先预览、再删除旧行，生产执行前会备份或放进事务。

**思路与不变量：**

> 用 `ROW_NUMBER` 按 business_key 分区，排序第一行保留，其余 ID 删除。删除必须按稳定主键，不用 `ctid` 作为长期业务标识。

**可执行 SQL：**

```sql
DROP TABLE IF EXISTS customer_profiles_q025;
CREATE TABLE customer_profiles_q025 (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_key text NOT NULL,
    updated_at   timestamptz NOT NULL,
    payload      jsonb NOT NULL
);

INSERT INTO customer_profiles_q025 (business_key, updated_at, payload) VALUES
    ('u1', '2026-01-01 00:00:00+00', '{"version":1}'),
    ('u1', '2026-01-02 00:00:00+00', '{"version":2}'),
    ('u1', '2026-01-02 00:00:00+00', '{"version":3}'),
    ('u2', '2026-01-01 00:00:00+00', '{"version":1}');

-- 先预览将被删除的行。
WITH ranked AS (
    SELECT id,
           business_key,
           updated_at,
           ROW_NUMBER() OVER (
               PARTITION BY business_key
               ORDER BY updated_at DESC, id DESC
           ) AS row_number_in_key
      FROM customer_profiles_q025
)
SELECT *
  FROM ranked
 WHERE row_number_in_key > 1
 ORDER BY business_key, id;

-- 再按主键删除旧行。
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY business_key
               ORDER BY updated_at DESC, id DESC
           ) AS row_number_in_key
      FROM customer_profiles_q025
), deleted AS (
    DELETE FROM customer_profiles_q025 AS target
     USING ranked
     WHERE target.id = ranked.id
       AND ranked.row_number_in_key > 1
    RETURNING target.id, target.business_key
)
SELECT * FROM deleted ORDER BY business_key, id;

SELECT business_key, updated_at, payload
  FROM customer_profiles_q025
 ORDER BY business_key;

-- 清理后再建立唯一约束，防止问题复发。
CREATE UNIQUE INDEX customer_profiles_q025_business_key_uq
    ON customer_profiles_q025 (business_key);
```

**复杂度：**

> 窗口排序最坏 `O(n log n)`，删除按主键定位；合适的 `(business_key, updated_at DESC, id DESC)` 索引可以降低排序和定位成本，但大批删除仍会产生 WAL 和 Vacuum 压力。

**测试用例：**

> 我会测单条 Key、多条 Key、更新时间相同、Payload 不同和重复执行。删除前后行数、保留 ID 和唯一索引创建都要验证。

**Follow-up：**

> 在线系统更稳的方案是先定义正确唯一键，用 `INSERT ... ON CONFLICT ...` 阻止新增重复；历史清理按批次执行，避免长事务锁表和一次性产生大量 WAL。

### Q026. SQL：找连续登录至少三天的用户区间

**澄清：**

> 我先确认同一天多次登录只算一天，连续按 UTC 还是业务时区的自然日。下面数据已是 `date`，按连续日期找 Islands，并返回每段起止和天数。

**思路与不变量：**

> 先去重用户日期，再按用户排序编号。连续日期减去连续行号会得到相同分组键，于是可以按这个键聚合一段连续区间。

**可执行 SQL：**

```sql
DROP TABLE IF EXISTS login_events_q026;
CREATE TABLE login_events_q026 (
    user_id    bigint NOT NULL,
    login_date date NOT NULL
);

INSERT INTO login_events_q026 VALUES
    (1, '2026-01-01'),
    (1, '2026-01-01'),
    (1, '2026-01-02'),
    (1, '2026-01-03'),
    (1, '2026-01-05'),
    (2, '2026-02-10'),
    (2, '2026-02-11'),
    (2, '2026-02-12'),
    (2, '2026-02-13');

WITH distinct_days AS (
    SELECT DISTINCT user_id, login_date
      FROM login_events_q026
), numbered AS (
    SELECT user_id,
           login_date,
           ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY login_date
           ) AS day_number
      FROM distinct_days
), islands AS (
    SELECT user_id,
           login_date,
           login_date - day_number::integer AS island_key
      FROM numbered
)
SELECT user_id,
       MIN(login_date) AS start_date,
       MAX(login_date) AS end_date,
       COUNT(*) AS consecutive_days
  FROM islands
 GROUP BY user_id, island_key
HAVING COUNT(*) >= 3
 ORDER BY user_id, start_date;

-- 期望：用户 1 为 2026-01-01 到 2026-01-03，共 3 天；
--       用户 2 为 2026-02-10 到 2026-02-13，共 4 天。
```

**复杂度：**

> 去重和窗口排序通常受 `O(n log n)` 排序主导；`(user_id, login_date)` 索引有助于去重和排序。

**测试用例：**

> 我会测同日重复、刚好三天、超过三天、中间断一天、跨月和业务时区切日。

**Follow-up：**

> 如果要求“任意 7 天内登录 3 天”而非严格连续，就不能使用这个 Islands 技巧，应改窗口框架或自连接；先澄清题意非常重要。

### Q027. SQL：按注册 Cohort 统计七天内转化漏斗

**澄清：**

> 我先确认漏斗必须按顺序发生：注册后查看、查看后申请、申请后批准，且全部在注册后七天内。Cohort 按注册月；每个用户每一步只取第一次合法事件。

**思路与不变量：**

> 我逐层计算第一合法时间，后一层 Join 条件引用前一层时间，这样不会把“先申请后查看”错误算进漏斗。最后按注册月聚合人数和转化率。

**可执行 SQL：**

```sql
DROP TABLE IF EXISTS funnel_events_q027;
CREATE TABLE funnel_events_q027 (
    user_id   bigint NOT NULL,
    event_name text NOT NULL,
    event_time timestamptz NOT NULL
);

INSERT INTO funnel_events_q027 VALUES
    (1, 'signup',   '2026-01-01 09:00+00'),
    (1, 'view',     '2026-01-01 10:00+00'),
    (1, 'apply',    '2026-01-02 10:00+00'),
    (1, 'approved', '2026-01-03 10:00+00'),
    (2, 'signup',   '2026-01-05 09:00+00'),
    (2, 'view',     '2026-01-06 09:00+00'),
    (3, 'signup',   '2026-02-01 09:00+00'),
    (3, 'apply',    '2026-02-01 10:00+00'),
    (3, 'view',     '2026-02-01 11:00+00'),
    (3, 'approved', '2026-02-01 12:00+00');

WITH signups AS (
    SELECT user_id, MIN(event_time) AS signup_time
      FROM funnel_events_q027
     WHERE event_name = 'signup'
     GROUP BY user_id
), views AS (
    SELECT signup.user_id,
           signup.signup_time,
           MIN(event.event_time) AS view_time
      FROM signups AS signup
      LEFT JOIN funnel_events_q027 AS event
        ON event.user_id = signup.user_id
       AND event.event_name = 'view'
       AND event.event_time >= signup.signup_time
       AND event.event_time < signup.signup_time + interval '7 days'
     GROUP BY signup.user_id, signup.signup_time
), applications AS (
    SELECT view.user_id,
           view.signup_time,
           view.view_time,
           MIN(event.event_time) AS apply_time
      FROM views AS view
      LEFT JOIN funnel_events_q027 AS event
        ON event.user_id = view.user_id
       AND event.event_name = 'apply'
       AND view.view_time IS NOT NULL
       AND event.event_time >= view.view_time
       AND event.event_time < view.signup_time + interval '7 days'
     GROUP BY view.user_id, view.signup_time, view.view_time
), approvals AS (
    SELECT application.user_id,
           application.signup_time,
           application.view_time,
           application.apply_time,
           MIN(event.event_time) AS approved_time
      FROM applications AS application
      LEFT JOIN funnel_events_q027 AS event
        ON event.user_id = application.user_id
       AND event.event_name = 'approved'
       AND application.apply_time IS NOT NULL
       AND event.event_time >= application.apply_time
       AND event.event_time < application.signup_time + interval '7 days'
     GROUP BY application.user_id,
              application.signup_time,
              application.view_time,
              application.apply_time
)
SELECT date_trunc('month', signup_time) AS cohort_month,
       COUNT(*) AS signed_up,
       COUNT(view_time) AS viewed,
       COUNT(apply_time) AS applied,
       COUNT(approved_time) AS approved,
       ROUND(COUNT(view_time)::numeric / NULLIF(COUNT(*), 0), 4) AS view_rate,
       ROUND(COUNT(apply_time)::numeric / NULLIF(COUNT(*), 0), 4) AS apply_rate,
       ROUND(COUNT(approved_time)::numeric / NULLIF(COUNT(*), 0), 4) AS approval_rate
  FROM approvals
 GROUP BY date_trunc('month', signup_time)
 ORDER BY cohort_month;

-- 2026-01 Cohort：2 注册、2 查看、1 申请、1 批准。
-- 2026-02 的用户先申请后查看，因此不进入申请和批准步骤。
```

**复杂度：**

> 每层按用户和事件条件查找，合适的 `(user_id, event_name, event_time)` 索引可让查找接近索引范围扫描；没有索引时多层 Join 成本会很高。

**测试用例：**

> 我会测完整漏斗、停在中间、乱序事件、七天边界、重复事件、跨月注册和没有注册的孤儿事件。

**Follow-up：**

> 大规模事件表可以一次条件聚合后用窗口或专用漏斗函数优化，但必须保持“后一步发生在前一步之后”的语义；只按每步是否出现会高估转化。

### Q028. SQL：设计可冲正、可审计的追加式账本

**澄清：**

> 我先确认冲正不是更新或删除原流水，而是追加一条金额相反、明确引用原交易的记录；同一原交易最多冲正一次，同一请求可幂等重试。

**思路与不变量：**

> 原流水不可变，余额是所有 Entry 金额之和。冲正函数先按 request_id 查幂等结果，再锁原流水，验证它确实是原始条目，最后插入相反金额；唯一约束防止双重冲正。

**可执行 SQL：**

```sql
DROP FUNCTION IF EXISTS reverse_entry_q028(bigint, text);
DROP TABLE IF EXISTS ledger_entries_q028 CASCADE;
CREATE TABLE ledger_entries_q028 (
    entry_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id        bigint NOT NULL,
    amount_cents      bigint NOT NULL CHECK (amount_cents <> 0),
    entry_type        text NOT NULL CHECK (entry_type IN ('ORIGINAL', 'REVERSAL')),
    reverses_entry_id bigint UNIQUE REFERENCES ledger_entries_q028(entry_id),
    request_id        text NOT NULL UNIQUE,
    created_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        (entry_type = 'ORIGINAL' AND reverses_entry_id IS NULL)
        OR
        (entry_type = 'REVERSAL' AND reverses_entry_id IS NOT NULL)
    )
);

CREATE OR REPLACE FUNCTION reverse_entry_q028(
    p_original_entry_id bigint,
    p_request_id text
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing ledger_entries_q028%ROWTYPE;
    v_original ledger_entries_q028%ROWTYPE;
    v_reversal_id bigint;
BEGIN
    SELECT * INTO v_existing
      FROM ledger_entries_q028
     WHERE request_id = p_request_id;
    IF FOUND THEN
        IF v_existing.entry_type <> 'REVERSAL'
           OR v_existing.reverses_entry_id <> p_original_entry_id THEN
            RAISE EXCEPTION 'idempotency key reused for another operation';
        END IF;
        RETURN v_existing.entry_id;
    END IF;

    SELECT * INTO v_original
      FROM ledger_entries_q028
     WHERE entry_id = p_original_entry_id
     FOR UPDATE;
    IF NOT FOUND OR v_original.entry_type <> 'ORIGINAL' THEN
        RAISE EXCEPTION 'original entry not found';
    END IF;

    INSERT INTO ledger_entries_q028 (
        account_id, amount_cents, entry_type, reverses_entry_id, request_id
    ) VALUES (
        v_original.account_id,
        -v_original.amount_cents,
        'REVERSAL',
        v_original.entry_id,
        p_request_id
    )
    RETURNING entry_id INTO v_reversal_id;

    RETURN v_reversal_id;
END;
$$;

INSERT INTO ledger_entries_q028 (
    account_id, amount_cents, entry_type, reverses_entry_id, request_id
) VALUES (1001, 10000, 'ORIGINAL', NULL, 'credit-001');

SELECT reverse_entry_q028(1, 'reverse-001') AS first_reversal;
SELECT reverse_entry_q028(1, 'reverse-001') AS idempotent_retry;

SELECT account_id, SUM(amount_cents) AS balance_cents
  FROM ledger_entries_q028
 GROUP BY account_id;

-- 期望余额为 0；账本保留 +10000 原条目和 -10000 冲正条目。
```

**复杂度：**

> request_id、entry_id 和 reverses_entry_id 都有唯一索引，单次冲正是常数次 `O(log n)` 索引访问和一条追加写。余额全量求和 `O(n)`，生产可维护可对账的余额快照。

**测试用例：**

> 我会测正常冲正、相同 request_id 重试、不同 request_id 重复冲正、冲正一条冲正记录、原条目不存在和并发冲正。

**Follow-up：**

> 完整复式记账还要让一笔 Transaction 的借贷分录合计为零，并在同一事务提交。缓存余额只是派生状态，必须能从不可变账本重建和对账。

### Q029. SQL：并发转账怎样避免丢更新和死锁

**澄清：**

> 我先确认转账需要原子扣加、余额不能为负、同一 transfer_id 幂等。下面在一个 PostgreSQL 事务函数里先占用幂等键，再按账户 ID 固定顺序锁两行，防止 A 转 B 与 B 转 A 反向加锁死锁。

**思路与不变量：**

> 所有调用都按相同账户顺序 `FOR UPDATE`；扣款条件再次检查余额。转账记录、扣款和加款在同一事务中，要么全部提交，要么全部回滚。

**可执行 SQL：**

```sql
DROP FUNCTION IF EXISTS transfer_q029(text, bigint, bigint, bigint);
DROP TABLE IF EXISTS transfers_q029;
DROP TABLE IF EXISTS accounts_q029;

CREATE TABLE accounts_q029 (
    account_id   bigint PRIMARY KEY,
    balance_cents bigint NOT NULL CHECK (balance_cents >= 0)
);

CREATE TABLE transfers_q029 (
    transfer_id   text PRIMARY KEY,
    from_account  bigint NOT NULL REFERENCES accounts_q029(account_id),
    to_account    bigint NOT NULL REFERENCES accounts_q029(account_id),
    amount_cents  bigint NOT NULL CHECK (amount_cents > 0),
    status        text NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED')),
    created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (from_account <> to_account)
);

CREATE OR REPLACE FUNCTION transfer_q029(
    p_transfer_id text,
    p_from bigint,
    p_to bigint,
    p_amount bigint
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_inserted boolean;
    v_existing transfers_q029%ROWTYPE;
    v_balance bigint;
    v_account_count integer;
BEGIN
    IF p_amount <= 0 OR p_from = p_to THEN
        RAISE EXCEPTION 'invalid transfer';
    END IF;

    INSERT INTO transfers_q029 (
        transfer_id, from_account, to_account, amount_cents, status
    ) VALUES (
        p_transfer_id, p_from, p_to, p_amount, 'PENDING'
    )
    ON CONFLICT (transfer_id) DO NOTHING
    RETURNING true INTO v_inserted;

    IF COALESCE(v_inserted, false) = false THEN
        SELECT * INTO v_existing
          FROM transfers_q029
         WHERE transfer_id = p_transfer_id;
        IF v_existing.from_account <> p_from
           OR v_existing.to_account <> p_to
           OR v_existing.amount_cents <> p_amount THEN
            RAISE EXCEPTION 'transfer_id reused with different payload';
        END IF;
        RETURN;
    END IF;

    -- 所有调用统一按 account_id 升序加锁，避免反向锁顺序。
    PERFORM account_id
      FROM accounts_q029
     WHERE account_id IN (p_from, p_to)
     ORDER BY account_id
     FOR UPDATE;

    SELECT COUNT(*) INTO v_account_count
      FROM accounts_q029
     WHERE account_id IN (p_from, p_to);
    IF v_account_count <> 2 THEN
        RAISE EXCEPTION 'account not found';
    END IF;

    SELECT balance_cents INTO v_balance
      FROM accounts_q029
     WHERE account_id = p_from;
    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'insufficient funds';
    END IF;

    UPDATE accounts_q029
       SET balance_cents = balance_cents - p_amount
     WHERE account_id = p_from;
    UPDATE accounts_q029
       SET balance_cents = balance_cents + p_amount
     WHERE account_id = p_to;
    UPDATE transfers_q029
       SET status = 'SUCCEEDED'
     WHERE transfer_id = p_transfer_id;
END;
$$;

INSERT INTO accounts_q029 VALUES (1, 10000), (2, 5000);
SELECT transfer_q029('tx-001', 1, 2, 3000);
SELECT transfer_q029('tx-001', 1, 2, 3000); -- 幂等重试

SELECT * FROM accounts_q029 ORDER BY account_id;
SELECT * FROM transfers_q029 ORDER BY transfer_id;

-- 期望：账户 1 为 7000，账户 2 为 8000，且只有一条 SUCCEEDED 转账。
```

**复杂度：**

> 每次转账是常数次主键索引定位和行更新，通常 `O(log n)`；并发等待时间取决于热点账户竞争，不在渐进复杂度里。

**测试用例：**

> 我会测正常转账、相同 ID 重试、相同 ID 不同 Payload、余额不足、账户不存在，以及两个会话并发执行 A→B 与 B→A 不发生锁顺序死锁。

**Follow-up：**

> 数据库仍可能因其他锁顺序产生死锁，调用方要识别 PostgreSQL `40P01` 并在总 Deadline 内重试整个事务。跨库转账不能靠本地行锁解决，需要账本、状态机、Outbox 和对账。

### Q030. Debug：固定线程池为什么会“无报错卡死”？

**澄清：**

> 我先确认现象是 CPU 不高、没有异常、所有父任务都卡在 `Future.get()`，线程 Dump 显示线程池 Worker 在等同一个线程池里的子任务。我要区分真正的锁死和线程池饥饿。

**思路与不变量：**

> Bug 代码把两个父任务都提交到容量为 2 的池，每个父任务又向同一池提交子任务并同步等待。两个 Worker 都被父任务占满，子任务永远拿不到线程。这不是增加超时就能从根上修好的问题，而是“在线程池 Worker 中阻塞等待同池新任务”的结构错误。

Bug 代码核心如下：

```java
ExecutorService pool = Executors.newFixedThreadPool(2);
for (int id : List.of(1, 2)) {
    pool.submit(() -> {
        Future<String> child = pool.submit(() -> remoteCall(id));
        return child.get(); // 两个父任务占满线程，并等待同池子任务。
    });
}
```

> 我的修复是从调用方直接创建非阻塞 `CompletableFuture`，不再用池内父任务占住 Worker 等待子任务。聚合只注册 Completion，不消耗一个 Worker 阻塞等待。

**完整修复代码：**

```java
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class Q030ThreadPoolStarvation {
    public static CompletableFuture<List<String>> fetchAll(
            List<Integer> ids,
            ExecutorService ioPool,
            Duration deadline) {
        List<CompletableFuture<String>> calls = new ArrayList<>();
        for (int id : ids) {
            calls.add(CompletableFuture.supplyAsync(() -> remoteCall(id), ioPool));
        }

        CompletableFuture<Void> all = CompletableFuture.allOf(
                calls.toArray(CompletableFuture[]::new));
        return all.orTimeout(deadline.toNanos(), TimeUnit.NANOSECONDS)
                .thenApply(ignored -> calls.stream()
                        .map(CompletableFuture::join)
                        .toList());
    }

    private static String remoteCall(int id) {
        try {
            Thread.sleep(20);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted", interrupted);
        }
        return "value-" + id;
    }

    public static void main(String[] args) throws Exception {
        ExecutorService ioPool = Executors.newFixedThreadPool(2);
        try {
            List<String> values = fetchAll(
                    List.of(1, 2, 3, 4),
                    ioPool,
                    Duration.ofSeconds(1))
                    .get(2, TimeUnit.SECONDS);
            if (!values.equals(List.of("value-1", "value-2", "value-3", "value-4"))) {
                throw new AssertionError("unexpected values: " + values);
            }
            System.out.println("Q030 passed");
        } finally {
            ioPool.shutdownNow();
        }
    }
}
```

**复杂度：**

> 创建和聚合 `n` 个 Future 的 CPU/空间都是 `O(n)`；总墙钟时间约为任务总耗时除以可用并发度，另外受外部 I/O 和 Deadline 影响。

**测试用例：**

> 我会用池大小 1、2 和任务数大于池大小验证都能完成，再测一个调用异常、总 Deadline、取消和线程池关闭。排障时会抓 Thread Dump，而不是只看 CPU。

**Follow-up：**

> 如果底层调用是阻塞 I/O，仍要给连接池和并发设上限；Java 21 可评估 Virtual Threads，但它不会消除下游连接、配额和背压限制。`orTimeout` 也不一定取消正在执行的底层调用，生产接口要传播取消。
