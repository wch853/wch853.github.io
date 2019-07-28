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























































