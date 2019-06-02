# SpringBoot 核心剖析（一）

## 创建容器

`SpringApplication` 提供了一个静态 `run` 方法创建 `Spring` 容器。

```java
@SpringBootApplication
public class FooApplication {

    public static void main(String[] args) {
        SpringApplication.run(FooApplication.class, args);
    }
}
```

### SpringApplication 对象

在创建 `SpringApplication` 对象时，判断了应用类型并加载了 `spring.factories` 文件中对 `ApplicationContextInitializer` 和 `ApplicationListener` 的扩展。

```java
	public SpringApplication(ResourceLoader resourceLoader, Class<?>... primarySources) {
		this.resourceLoader = resourceLoader;
		Assert.notNull(primarySources, "PrimarySources must not be null");
    // 主配置类
		this.primarySources = new LinkedHashSet<>(Arrays.asList(primarySources));
    // 判断应用类型是基于Servlet或Reactive的web应用，还是无需启动内置web服务器的其它应用
		this.webApplicationType = WebApplicationType.deduceFromClasspath();
    // 加载容器初始化配置
		setInitializers((Collection) getSpringFactoriesInstances(
				ApplicationContextInitializer.class));
    // 加载应用事件处理器
		setListeners((Collection) getSpringFactoriesInstances(ApplicationListener.class));
		this.mainApplicationClass = deduceMainApplicationClass();
	}
```

### 容器创建与初始化

进入 `SpringApplication` 的 `public ConfigurableApplicationContext run(String... args)` 方法后，容器开始创建。

#### 发布应用启动事件

在容器正式创建之前，`Spring` 会将应用启动事件 `ApplicationStartingEvent` 发布给创建 `SpringApplication` 对象时加载的 `ApplicationListener` 做一些初始化工作，例如初始化默认的日志配置 `LoggingSystem` 。

```java
		// 从spring.factories加载SpringApplicationRunListener的实现，组装到SpringApplicationRunListeners中
		SpringApplicationRunListeners listeners = getRunListeners(args);
		// 调用代理类，逐一发布应用启动事件
		listeners.starting();
```

对于支持启动事件类型和事件源类型的 `ApplicationListener`， `Spring` 会回调其 `onApplicationEvent` 做相应的事件处理。

```java
	private void doInvokeListener(ApplicationListener listener, ApplicationEvent event) {
		try {
			listener.onApplicationEvent(event);
		}
		catch (ClassCastException ex) {
			// ...
		}
	}
```

#### 配置环境

```java
  // 解析类型 --key=value 的命令行参数
  ApplicationArguments applicationArguments = new DefaultApplicationArguments(
    args);
	// 加载属性配置，选择激活的profile类型
  ConfigurableEnvironment environment = prepareEnvironment(listeners,
                                                           applicationArguments);
  configureIgnoreBeanInfo(environment);
  Banner printedBanner = printBanner(environment);
```





## 代理模式

代理模式是通过代理对象访问目标对象，在不修改目标对象的基础上对目标对象的功能进行扩展，因此代理模式也遵循了面向扩展开放，面向修改关闭的编程思想。

### 静态代理

静态代理是指代理对象和目标对象的关系在程序运行前就已经确定，代理类和目标类需要实现相同的接口：

- 需要共同实现的接口：

```java
public interface Subject {

  /**
   * 目标方法
   */
  void request();
}
```

- 目标对象实现：

```java
public class RealSubject implements Subject {

  @Override
  public void request() {
    System.out.println("real subject execute request.");
  }
}
```

- 静态代理类

```java
public class StaticProxy implements Subject {

  /**
   * 将目标对象委托给代理对象
   */
  private RealSubject realSubject;

  public StaticProxy(RealSubject realSubject) {
    this.realSubject = realSubject;
  }

  /**
   * 代理类实现相同方法来对目标对象进行增强
   */
  @Override
  public void request() {
    System.out.println("### before.");
    try {
      realSubject.request();
    } catch (Exception e) {
      System.out.println("ex: " + e.getMessage() + ".");
      throw e;
    } finally {
      System.out.println("### after.");
    }
  }
}
```

### 动态代理

动态代理是指代理对象由代理生成工具在程序运行时由 `JVM` 根据反射等机制动态生成的，代理对象和目标对象的关系在在程序运行时才确立。

#### JDK 动态代理

`JDK` 动态代理要求实现 `InvocationHandler` 接口，实现 `invoke` 方法，用于实现增强目标对象的具体逻辑：

```java
public class JdkProxySubject implements InvocationHandler {

  private RealSubject realSubject;

  public JdkProxySubject(RealSubject realSubject) {
    this.realSubject = realSubject;
  }

  /**
   * 基于反射的动态代理，针对目标方法进行动态代理
   *
   * @param proxy  方法反射的代理对象
   * @param method 目标方法
   * @param args   目标方法参数
   * @return 增强的返回值
   * @throws Throwable Throwable
   */
  @Override
  public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    System.out.println("### before.");
    Object result;
    try {
      result = method.invoke(realSubject, args);
    } catch (Exception e) {
      System.out.println("ex: " + e.getMessage());
      throw e;
    } finally {
      System.out.println("### after.");
    }
    return result;
  }
}
```

`java.lang.reflect.Proxy` 提供 `newProxyInstance` 方法用于动态生成代理对象：

```java
  /**
   * 生成动态代理对象
   *
   * @param loader 目标类的类加载器
   * @param interfaces 目标类实现的接口
   * @param h 业务增强逻辑
   * @return
   */
  public static Object newProxyInstance(ClassLoader loader, Class<?>[] interfaces, InvocationHandler h);

```

在此方法中`ProxyClassFactory` 会通过 `sun.misc.ProxyGenerator#generateClassFile` 方法生成一个前缀为 `com.sun.proxy.$Proxy` 的字节码文件并加载到虚拟机中，代理类通过反射执行 `InvocationHandler.invoke` 方法重写目标方法，实现增强。

#### CGLIB 动态代理

`JDK` 动态代理要求目标类和代理类实现相同的接口，如果目标类不存在对应的接口，则无法使用该方式实现。`CGLIB` 动态代理的实现原理是生成目标类的子类，子类对象即为对目标对象增强过的代理对象。`CGLIB` 动态代理要求实现 `MethodInterceptor` 接口：

```java
public class CglibMethodInterceptor implements MethodInterceptor {

  /**
   * CGLIB增强业务逻辑
   *
   * @param o           目标对象
   * @param method      目标对象方法
   * @param args        方法参数
   * @param methodProxy 方法代理
   * @return 增强的返回值
   * @throws Throwable Throwable
   */
  @Override
  public Object intercept(Object o, Method method, Object[] args, MethodProxy methodProxy) throws Throwable {
    System.out.println("### before.");
    Object result;
    try {
      result = method.invoke(o, args);
    } catch (Exception e) {
      System.out.println("ex: " + e.getMessage() + ".");
      throw e;
    } finally {
      System.out.println("### after.");
    }
    return result;
  }
}
```

通过 `Enhancer` 来生成动态代理对象：

```java
  Enhancer enhancer = new Enhancer();
  // 设置目标对象类型
  enhancer.setSuperclass(RealSubject.class);
  // 设置代理增强逻辑
  enhancer.setCallback(new CglibMethodInterceptor());
  // 创建代理对象
  RealSubject subject = (RealSubject) enhancer.create();
  subject.request();
```



















































