---
sidebarDepth: 2
date: 2018-12-01
desc: JDK提供的对并发编程的支持，包括线程同步工具、线程池支持以及线程安全的并发容器。
tags: Java并发编程 线程同步 线程池 并发容器
---

# 并发编程（二）：JDK 支持

## JDK 并发包

为了更好地支持并发程序，JDK 提供了大量的 API 和框架，主要包含三部分：

- 线程同步工具
- 线程池支持
- 线程安全的并发容器

## 线程同步工具

### 重入锁（ReentrantLock）

重入锁通过 `java.util.concurrent.locks.ReentrantLock` 类来实现。

```java
Lock lock = new ReentrantLock();

lock.lock();
lock.lock();
try {
    i++;
} finally {
    lock.unlock();
    lock.unlock();
}
```

与 `synchronized` 相比，`ReentrantLock` 有着显式的操作过程，开发人员需要手动指定何时加锁、何时释放锁，因此具有更好的灵活性。值得注意的是离开临界区时必须要使用 `unlock()` 释放锁，否则其他线程就没有机会访问临界区了。重入锁得名于这种锁能够在一个线程中反复进入，即一个线程连续多次获得同一把锁是被允许的。如果一个线程多次获得重入锁，在释放锁时也需要释放多次。

#### 中断响应

使用重入锁的线程允许被中断，也就是说在等待锁的过程中，程序可以根据需要取消对锁的请求。

```java
Lock lock = new ReentrantLock();

try {
    // 获取锁，但是优先响应中断
    lock.lockInterruptibly();
} catch (InterruptedException e) {
} finally {
    if (lock.isHeldByCurrentThread()) {
        lock.unlock();
    }
}
```

#### 锁申请等待时限

使用 `tryLock()` 可以对锁进行一次限时请求，如果直接获取不到锁或者在一定时间内获取不到锁，则放弃对锁的申请。

```java
public boolean tryLock();
public boolean tryLock(long timeout, TimeUnit unit);
```

#### 公平锁

公平锁要求系统维护一个有序队列，希望获取锁的线程按时间顺序进入队列，按照先来后到的原则分配锁资源。只要排队，线程都能获取锁资源，可以避免产生饥饿。但是公平锁因为需要维护队列所以实现成本较高，性能也相对低下；非公平锁调度时更倾向于已经获得锁的线程，即某个线程已经获得了锁，此后仍有多次对锁的申请，系统调度会更偏向于这个线程，因此是不公平的，但是更为高效。`synchronized` 是非公平锁，而 `ReentrantLock` 允许对锁的公平性进行设置：

```java
public ReentrantLock(boolean fair);
```

### 条件（Condition）

通过重入锁的 `newCondition()` 方法可以获取一个和当前重入锁绑定的 `Condition` 实例，利用这个实例就可以让线程在合适的时机等待（释放锁资源），在特定时刻获取唤醒通知线程继续执行。

- `wait()` ：使得当前线程等待，并释放锁资源。
- `awaitUninterruptibly()` ：使得当前线程等待，并释放锁资源，但不会在等待过程中响应中断。
- `singal()` ：唤醒一个等待中的线程，执行后需要释放锁，让给唤醒的线程执行。
- `singalAll()` ：唤醒所有等待中的线程。

### 信号量（Semaphore）

`Semaphore` 是计数信号量，用于限制获取某种资源的线程数量。`acquire()` 方法希望获取一个许可，如果无法获得，线程会等待，直到有其它线程释放了许可或线程被中断；`tryAcquire()` 尝试获取许可，如果无法获得会继续执行，不会等待；在线程访问资源结束后，需要通过 `release()` 释放许可，使其它等待许可的线程有机会访问资源。

```java
public Semaphore(int permits);
public Semaphore(int permits, boolean fair)

try {
    // 获取许可
    semaphore.acquire();
    // 一次获取多个许可
    semaphore.acquire(5);
    // 尝试获取许可
    semaphore.tryAcquire();
} finally {
    semaphore.release();
}
```

### 读写锁（ReadWriteLock）

读写的访问约束一般为：

- 读-读：读与读之间不阻塞。
- 读-写：读阻塞写，写阻塞读。
- 写-写：写与写之间阻塞。

如果在系统中，读操作次数远远大于写操作，此时使用重入锁或内部锁使得所有操作之间都是串行，这显然是不合理的，因此可以使用读写分离锁，允许多个线程同时读，读-写 与 写-写 仍是需要相互等待和持有锁的。

```java
ReentrantReadWriteLock readWriteLock = new ReentrantReadWriteLock();
Lock readLock = readWriteLock.readLock();
Lock writeLock = readWriteLock.writeLock();
```

### 计数器（CountDownLatch）

`CountDownLatch` 通常用于控制线程等待，他可以使某个线程等待计数器计数完成，再开始执行。

```java
CountDownLatch latch = new CountDownLatch(10);
for (int i = 0; i < 10; i++) {
    new Thread() {
        @Override
        public void run() {
            // 计数器减1
            latch.countDown();
        }
    }.start();
}

// 调用者线程等待
latch.await();
```

### 循环栅栏（CyClicBarrier）

`CyClicBarrier` 类似 `CountDownLatch`，也是一种多线程并发控制工具，相对于计数器，循环栅栏能够反复计数。

```java
CyclicBarrier cyclicBarrier = new CyclicBarrier(10, new Runnable() {
    @Override
    public void run() {
        // 执行完成回调
    }
});

for (int i = 0; i < 10; i++) {
    new Thread() {
        @Override
        public void run() {
            try {
                cyclicBarrier.await();
            } catch (InterruptedException | BrokenBarrierException e) {
            }
        }
    }.start();
}
```

### 线程阻塞工具 LockSupport

`LockSupport` 提供一系列静态方法用于阻塞线程：

- `park()` ：阻塞调用线程。
- `parkNanos(long nanos) / parkUntil(long deadline)`：限时阻塞。
- `unpark(Thread thread)`：通知阻塞线程继续执行。
  `LockSupport` 与 `Thread.suspend()` 相比，弥补了 `Thread.resume()` 在之前发送导致线程无法继续执行的情况，因为 `LockSupport` 使用类似信号了的机制，它为每个线程准备了一个许可，如果许可可用，那么 `park()` 方法会直接返回，如果不可用则线程阻塞。而 `unpark()` 方法会使得线程的许可变为可用，这样即使 `unpark()` 发生在 `park()` 之前，也能使得线程继续执行。同时，如果线程通过 `park()` 挂起，线程状态会明确给出 `WAITING`，而不是像 `Thread.suspend()` 给出一个令人费解的 `RUNNABLE`。

## 线程池

在真实的生产环境中可能会开启多个线程来支撑应用。线程虽然是一种轻量级的工具，但创建和销毁仍需要花费时间，当线程数量过大时，就会耗尽 CPU，造成系统性能下降；其次线程本身也是要占用内存空间的，大量线程抢占宝贵的内存资源，可能会导致内存溢出，即使没有，大量的线程回收也会给 GC 带来很大压力，延长 GC 时间。因此，线程的数量必须被合理控制在一个范围内。
使用线程池后，创建线程变为从线程池中获取空闲线程，关闭线程变为向线程池归还线程，线程的数量因此得到合理控制。

### ThreadPoolExecutor

JDK 提供 `ThreadPoolExecutor` 类用于创建线程池，其构造方法的参数如下：

- `corePoolSize`：核心线程数。
- `maximumPoolSize`：最大线程数。
- `keepAliveTime`：当线程数超过 `corePoolSize`，多余空闲线程的存活时间。
- `unit`：`keepAliveTime` 的时间单位。
- `workQueue`：任务队列，被提交但未执行的任务。
- `threadFactory`：线程工厂，用于创建线程。
- `rejectHandler`：任务来不及处理时，拒绝处理任务的策略。

### 线程池扩容策略

`workQueue` 是一个用于存放 `Runnable` 的 `BlockingQueue` 接口的对象，如果是一个有界队列，线程池的扩容策略为：

1. 线程数少于 `corePoolSize`，优先创建新线程。
2. 线程数大于 `corePoolSize` 且 `workQueue` 未满，将任务加入 `workQueue`。
3. `workQueue` 已满，线程数少于 `maximumPoolSize`，创建新的线程。
4. `workQueue` 已满，线程数等于 `maximumPoolSize`，执行拒绝策略。

### 线程池拒绝策略

- `AbortPolicy`：直接抛出异常。
- `CallerRunsPolicy`：在调用者线程中执行被拒绝的任务。
- `DiscardOledestPolicy`：丢弃一个即将执行的任务，并再次尝试提交任务。
- `DiscardPolicy`：丢弃无法处理的任务。

### ThreadFactory

`ThreadFactory` 是一个接口，只有一个用于创建线程的方法 `Thread newThread(Runnable r);`。通过 `ThreadFactory` 可以自定义创建线程的名称、线程组、线程优先级等。`java.util.concurrent.Executors.DefaultThreadFactory` 实现的线程工厂如下：

```java
static class DefaultThreadFactory implements ThreadFactory {
    private static final AtomicInteger poolNumber = new AtomicInteger(1);
    private final ThreadGroup group;
    private final AtomicInteger threadNumber = new AtomicInteger(1);
    private final String namePrefix;

    DefaultThreadFactory() {
        SecurityManager s = System.getSecurityManager();
        group = (s != null) ? s.getThreadGroup() :
                                Thread.currentThread().getThreadGroup();
        namePrefix = "pool-" +
                        poolNumber.getAndIncrement() +
                        "-thread-";
    }

    public Thread newThread(Runnable r) {
        Thread t = new Thread(group, r,
                                namePrefix + threadNumber.getAndIncrement(),
                                0);
        if (t.isDaemon())
            t.setDaemon(false);
        if (t.getPriority() != Thread.NORM_PRIORITY)
            t.setPriority(Thread.NORM_PRIORITY);
        return t;
    }
}
```

### 线程池扩展

`ThreadPoolExecutor` 提供 `beforeExecute()`、`afterExecute()`、`terminated()` 3 个方法对线程池进行扩展。这 3 个方法分别用于记录一个任务执行前、执行后和整个线程池的退出。

#### 一个阻塞线程池

当线程池线程数已扩展至最大线程，且任务队列已满，需要对提交任务的线程进行阻塞，当有任务执行完毕，唤醒阻塞线程继续提交任务，适用于扩展消息队列并发能力等情况。

```java
/**
 * 阻塞线程池
 */
public class BlockedThreadPoolExecutor extends ThreadPoolExecutor {

    private ReentrantLock lock = new ReentrantLock();

    private Condition condition = lock.newCondition();

    public BlockedThreadPoolExecutor(int corePoolSize, int maximumPoolSize, long keepAliveTime, TimeUnit unit, BlockingQueue<Runnable> workQueue) {
        super(corePoolSize, maximumPoolSize, keepAliveTime, unit, workQueue);
    }

    public BlockedThreadPoolExecutor(int corePoolSize, int maximumPoolSize, long keepAliveTime, TimeUnit unit, BlockingQueue<Runnable> workQueue, ThreadFactory threadFactory) {
        super(corePoolSize, maximumPoolSize, keepAliveTime, unit, workQueue, threadFactory);
    }

    public BlockedThreadPoolExecutor(int corePoolSize, int maximumPoolSize, long keepAliveTime, TimeUnit unit, BlockingQueue<Runnable> workQueue, RejectedExecutionHandler handler) {
        super(corePoolSize, maximumPoolSize, keepAliveTime, unit, workQueue, handler);
    }

    public BlockedThreadPoolExecutor(int corePoolSize, int maximumPoolSize, long keepAliveTime, TimeUnit unit, BlockingQueue<Runnable> workQueue, ThreadFactory threadFactory, RejectedExecutionHandler handler) {
        super(corePoolSize, maximumPoolSize, keepAliveTime, unit, workQueue, threadFactory, handler);
    }

    @Override
    public void execute(Runnable command) {
        if (getPoolSize() == getMaximumPoolSize() && super.getQueue().remainingCapacity() == 0) {
            // 线程池已经创建最大线程数且任务队列已满
            try {
                lock.lock();
                condition.wait();
                super.execute(command);
            } catch (InterruptedException e) {
                e.printStackTrace();
            } finally {
                lock.unlock();
            }
        } else {
            super.execute(command);
        }
    }

    @Override
    protected void afterExecute(Runnable r, Throwable t) {
        super.afterExecute(r, t);
        lock.lock();
        // 任务执行完成，存在空闲线程，唤醒提交任务线程
        condition.signal();
        lock.unlock();
    }
}
```

### 线程池数量调优

- `NCPU`：CPU 数量。
- `UCPU`：目标 CPU 使用率（0 <= UCPU <= 1）。
- `W/C`：等待时间与计算时间的比率

为保持处理器达到期望的使用率，最优线程池大小为：`Nthreads = NCPU * UCPU * (1 + W/C)`。

## 并发容器

### Collections 工具类包装

`Collections` 工具类提供一系列方法将原本线程不安全的容器转为线程安全容器。如：`synchronizedList(List<T> list)`、`synchronizedMap(Map<K,V> m)`、`synchronizedSet(Set<T> s)` 等。其原理是对原有容器的相关操作使用 `synchronized` 进行同步。

### ConcurrentLinkedQueue

`ConcurrentLinkedQueue` 是 Queue 的一个安全实现．以链表作为其数据结构。Queue 中元素按 FIFO 原则进行排序．采用 CAS 操作，来保证元素的一致性，基本是高并发环境下性能最好的容器。

### CopyOnWriteArrayList

在很多应用场景中，读操作次数可能远大于写操作次数，`CopyOnWriteArrayList` 就是这种将读取性能发挥到极致的并发容器。`CopyOnWriteArrayList` 在写入操作时，并不修改原有内容，而是进行一次自我复制，将修改的内容写入副本中，再用副本替换原有的数据。这样就保证写操作不会影响读操作了。

### ArrayBlockingQueue

`ArrayBlockingQueue` 是 `BlockingQueue` 的一个实现，可以用来实现线程间数据共享。`Blocking` 的关键在于：

- `put()`：将元素压入队列末尾，如果队列已满则会一直等待，直到队列中有快线位置。
- `take()`：如果队列为空，则会一直等待，直到有元素入队。
  其原理是通过 `ReentrantLock` 和 `Condition` 对线程挂起和唤醒。
