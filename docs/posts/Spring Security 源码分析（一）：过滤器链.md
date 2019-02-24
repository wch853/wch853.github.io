---
sidebarDepth: 2
date: 2019-02-24
desc: 从源码角度分析Spring Security过滤器链生成过程。
tags: SpringSecurity 源码分析
---

# Spring Security 源码分析（一）：过滤器链

`Spring Security` 是一个能够为企业应用系统提供声明式的安全访问控制解决方案的安全框架，减少了为企业系统安全控制编写大量重复代码的工作，能够与 `Spring` 无缝集成。本文旨在从实际应用角度出发，阅读 `Spring Security` 源码，分析其实现原理。

## 注册过滤器链

引入 `spring-security` 包：

```xml
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
```

对 `Web` 资源的控制通过 `WebSecurityConfiguration` 配置，其在启动时装配名为 `springSecurityFilterChain` 的 `bean`：

```java
	@Bean(name = AbstractSecurityWebApplicationInitializer.DEFAULT_FILTER_NAME)
	public Filter springSecurityFilterChain() throws Exception {
		boolean hasConfigurers = webSecurityConfigurers != null
				&& !webSecurityConfigurers.isEmpty();
		if (!hasConfigurers) {
			WebSecurityConfigurerAdapter adapter = objectObjectPostProcessor
					.postProcess(new WebSecurityConfigurerAdapter() {
					});
      // 应用 WebSecurityConfigurerAdapter 中的各项配置
			webSecurity.apply(adapter);
		}
    // 生成 Spring Security 过滤器链
		return webSecurity.build();
	}
```

### WebSecurityConfigurerAdapter 实现

`spring-boot-autoconfigure` 在 `spring.factories` 中标识 `SecurityAutoConfiguration` 需要自动装配，在装配过程中又将 `SpringBootWebSecurityConfiguration` 引入，在此类中声明了一个继承自 `WebSecurityConfigurerAdapter` 的 `DefaultConfigurerAdapter`，由此装配了对 `WebSecurityConfigurerAdapter` 的默认实现，此类对 `spring security` 做了许多默认配置。
如果需要干预 `spring security` 配置，则需要继承 `WebSecurityConfigurerAdapter` 并装配到 `Spring` 容器中。

```java
@Configuration
@ConditionalOnClass(WebSecurityConfigurerAdapter.class)
@ConditionalOnMissingBean(WebSecurityConfigurerAdapter.class)
@ConditionalOnWebApplication(type = Type.SERVLET)
public class SpringBootWebSecurityConfiguration {

	@Configuration
	@Order(SecurityProperties.BASIC_AUTH_ORDER)
	static class DefaultConfigurerAdapter extends WebSecurityConfigurerAdapter {

	}

}
```

### AbstractSecurityBuilder#build

`WebSecurity` 实例 调用 `apply` 方法获取 `WebSecurityConfigurerAdapter` 中的配置，并调用 `build` 方法构造过滤器链，其实现为：

```java
	public final O build() throws Exception {
		if (this.building.compareAndSet(false, true)) {
			this.object = doBuild();
			return this.object;
		}
		throw new AlreadyBuiltException("This object has already been built");
	}

  protected final O doBuild() throws Exception {
		synchronized (configurers) {
			buildState = BuildState.INITIALIZING;

			beforeInit();
			init();

			buildState = BuildState.CONFIGURING;

			beforeConfigure();
			configure();

			buildState = BuildState.BUILDING;

			O result = performBuild();

			buildState = BuildState.BUILT;

			return result;
		}
	}

  /**
   * 内部配置初始化
   */
  private void init() throws Exception {
		Collection<SecurityConfigurer<O, B>> configurers = getConfigurers();

		for (SecurityConfigurer<O, B> configurer : configurers) {
			configurer.init((B) this);
		}

		for (SecurityConfigurer<O, B> configurer : configurersAddedInInitializing) {
			configurer.init((B) this);
		}
	}

  /**
   * 配置逻辑
   */
	private void configure() throws Exception {
		Collection<SecurityConfigurer<O, B>> configurers = getConfigurers();

		for (SecurityConfigurer<O, B> configurer : configurers) {
			configurer.configure((B) this);
		}
	}
```

可以看到构建操作为将通过 `apply` 方法应用进来的配置分别初始化和构建，链条为 `beforeInit -> init -> beforeConfigure -> configure -> performBuild`。`Spring Security` 中的 `AuthenticationManagerBuilder` （认证管理器生成配置）、`HttpSecurity` （过滤器管理器生成配置）、`WebSecurity` （过滤器生成配置） 都是继承 `AbstractConfiguredSecurityBuilder` 通过这个链条生成目标对象，这 3 个配置也是 `Spring Security` 的配置核心。

![SecuirtyBuilder](/img/security/SecurityBuilder.png)

### WebSecurityConfigurerAdapter 配置

由上文可知，过滤器链生成过程中调用了 `WebSecurityConfigurerAdapter` 的 `init` 和 `configure` 方法。

`init` 方法首先调用了 `getHttp` 方法，用于生成 `AuthenticationManager` 和 `HttpSecurity` 实例。

#### 认证管理器 AuthenticationManager 的配置

来看看 `WebSecurityConfigurerAdapter` 关于认证管理器的组成：

```java
	/**
	 * 认证管理器，管理多种认证方式（AuthenticationProvider），进行实际的认证调用
   */
	private AuthenticationManager authenticationManager;

  /**
   * 认证配置，装配认证方式，通过 @Autowired 自动注入
   */
  private AuthenticationConfiguration authenticationConfiguration;

  /**
   * 同于生成系统配置的认证管理器
   */
	private AuthenticationManagerBuilder authenticationBuilder;

	/**
	 * 用于生成开发者可干预的认证管理器
   */
	private AuthenticationManagerBuilder localConfigureAuthenticationBldr;

	/**
	 * true - 不使用可干预的认证管理器生成方式
   */
	private boolean disableLocalConfigureAuthenticationBldr;
```

`WebSecurityConfigurerAdapter` 在初始化过程中会调用 `authenticationManager` 方法配置认证管理器，当 `disableLocalConfigureAuthenticationBldr` 为 `true` 时会调用 `AuthenticationConfiguration#getAuthenticationManager` 生成认证管理器，当为 `false` 时会使用开发者干预过的 `localConfigureAuthenticationBldr` 生成认证管理器。

```java
	protected AuthenticationManager authenticationManager() throws Exception {
		if (!authenticationManagerInitialized) {
      // void configure(AuthenticationManagerBuilder auth); 开发者可以重载此方法干预认证管理器的成逻辑
			configure(localConfigureAuthenticationBldr);
			if (disableLocalConfigureAuthenticationBldr) {
        // 不需要干预，使用系统配置逻辑
				authenticationManager = authenticationConfiguration.getAuthenticationManager();
			} else {
				authenticationManager = localConfigureAuthenticationBldr.build();
			}
			authenticationManagerInitialized = true;
		}
		return authenticationManager;
	}
```

##### 认证管理器的系统配置逻辑

`WebSecurityConfigurerAdapter` 中通过 `@Autowired` 注入了 `AuthenticationConfiguration`，此类的主要功能是为 `AuthenticationManagerBuilder` 装配 `AuthenticationProvider`，可以装配的认证配置逻辑分为两类：

- （1）在 `spring context` 中查找 `UserDetailsService` 等类的相关实现，包装成 `DaoAuthenticationProvider` 配置到 `AuthenticationManagerBuilder` 中。

```java
  @Override
  public void configure(AuthenticationManagerBuilder auth) throws Exception {

    UserDetailsService userDetailsService = getBeanOrNull(UserDetailsService.class);

    // ...

    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(userDetailsService);

    // ...

    auth.authenticationProvider(provider);
  }
```

`DaoAuthenticationProvider` 继承自 `AbstractUserDetailsAuthenticationProvider`，这个抽象类实现了 `AuthenticationProvider` 接口的 `authenticate` 方法，此方法会调用子类实现的 `retrieveUser` 方法。`DaoAuthenticationProvider` 的实现是调用注入进来的 `UserDetailsService` 的 `loadUserByUsername` 方法。

```java
	protected final UserDetails retrieveUser(String username, UsernamePasswordAuthenticationToken authentication) throws AuthenticationException {
		// ...

    UserDetails loadedUser = this.getUserDetailsService().loadUserByUsername(username);

    // ...
	}
```

![DaoAuthenticationProvider](/img/security/DaoAuthenticationProvider.png)

在不自定义任何配置的情况下启动引入 `spring-boot-starter-security` 包的项目，会发现控制台输出了这样的日志：

```text
2049-04-09 00:00:00.000  INFO 8504 --- [  restartedMain] .s.s.UserDetailsServiceAutoConfiguration : Using generated security password: 1a1890f2-97d5-421d-a775-953f7641b579
```

打开 `UserDetailsServiceAutoConfiguration` 类，此类在没有 `UserDetailsService` 的自定义实现时，会装配一个实现了 `UserDetailsService` 接口的 `InMemoryUserDetailsManager`，默认生成一个登录名为 `user` 的用户，密码通过 `UUID` 随机生成，并在控制台输出。默认的用户配置取自 `SecurityProperties`，开发者可以在配置文件中加以覆盖。
到此为止，用户在不做任何额外配置的情况下，拥有了一个可以认证通过的账号。

- （2）在 `spring context` 中查找 `AuthenticationProvider` 的实现，直接配置到 `AuthenticationManagerBuilder` 中，但是 `spring` 没有装配 `AuthenticationProvider` 的默认实现。

```java
  @Override
  public void configure(AuthenticationManagerBuilder auth) throws Exception {
    // ...

    AuthenticationProvider authenticationProvider = getBeanOrNull(AuthenticationProvider.class);

    // ...

    auth.authenticationProvider(authenticationProvider);
  }
```

##### 开发者可干预的认证管理器

上文说到，系统会默认装配两类 `AuthenticationProvider`，如果开发者需要干预认证管理器的生成，同样可以提供这两类认证逻辑。
先看如何干预：`disableLocalConfigureAuthenticationBldr` 在 `WebSecurityConfigurerAdapter` 中默认为 `false`，`void configure(AuthenticationManagerBuilder auth)` 方法将此属性修改为 `true`，如果开发者需要干预，则需要覆盖此方法：

```java
  @Resource
  private UserDetailsService userDetailsService;

  @Override
  protected void configure(AuthenticationManagerBuilder auth) throws Exception {
    auth
      // 自定义 AuthenticationProvider 实现
      // .authenticationProvider(...)
      // 自定义 UserDetailsService 实现
      .userDetailsService(userDetailsService).passwordEncoder(new BCryptPasswordEncoder());
  }
```

开发者可以实现 `AuthenticationProvider` 或 `UserDetailsService` 接口，填充自定义用户逻辑。在注入自定义用户认证逻辑时，实际还是包装为
`AuthenticationProvider`，因此往后的认证逻辑就与系统的默认配置相符了。

```java
	public <T extends UserDetailsService> DaoAuthenticationConfigurer<AuthenticationManagerBuilder, T> userDetailsService(T userDetailsService) throws Exception {
		this.defaultUserDetailsService = userDetailsService;
		return apply(new DaoAuthenticationConfigurer<>(userDetailsService));
	}
```

在 `AuthenticationManagerBuilder` 配置完成后，`build` 方法会将所有的 `AuthenticationProvider` 交给 `ProviderManager` 管理。在进行认证时，`ProviderManager` 会逐个调用认证逻辑进行认证，有一个通过即认证成功。

### 过滤器管理器 HttpSecurity 配置

当认证管理器初始化完成，`WebSecurityConfigurerAdapter` 会继续配置 `HttpSecurity`，它用于配置 `web` 请求的安全配置，默认会应用到所有请求，开发者也可通过 `RequestMatcher` 配置例外。
来看看 `HttpSecurity` 的默认配置：

```java
  /**
   * 创建 HttpSecurity 实例
   */
	protected final HttpSecurity getHttp() throws Exception {
		// ...

		http = new HttpSecurity(objectPostProcessor, authenticationBuilder, sharedObjects);
		if (!disableDefaults) {
			http
        // csrf 跨站请求伪造保护
				.csrf().and()
        // 配置异步支持
				.addFilter(new WebAsyncManagerIntegrationFilter())
        // security 异常处理
				.exceptionHandling().and()
        // 将请求的 header 写入响应的 header
				.headers().and()
        // session 管理器，可以配置一个用户仅有一个会话有效
				.sessionManagement().and()
        // 保存认证信息（session维度）
				.securityContext().and()
        // 保存 request cache
				.requestCache().and()
        // 匿名认证配置
				.anonymous().and()
        // 配置重载 servlet 相关安全方法
				.servletApi().and()
        // 表单登录页配置
				.apply(new DefaultLoginPageConfigurer<>()).and()
        // 匹配 /logout 做登出逻辑，成功后跳转登录页
				.logout();

      // ...
		}
    // HttpSecurity 扩展配置
		configure(http);
		return http;
	}

  /**
   * HttpSecurity 扩展配置
   */
	protected void configure(HttpSecurity http) throws Exception {
		http
      // 约束基于 HttpServletRequest 的请求
			.authorizeRequests()
        // 任何请求 需要认证
				.anyRequest().authenticated()
				.and()
      // 表单登录
			.formLogin().and()
      // http basic 认证
			.httpBasic();
	}
```

与配置认证管理器相同的是，在配置 `HttpSecurity` 的过程中，留有一个名为 `configure` 的方法供开发者配置。默认的配置方法拦截了所有请求，要求必须经过身份认证才能正确访问 `web` 资源，默认有表单登录和 `http basic` 两种认证方式可以选择。`HttpSecurity` 提供的大多数配置方法，都是通过过滤器实现的。

#### form login 表单登录

`formLogin` 方法引入了 `FormLoginConfigurer`，此类中配置了两个过滤器：

- `UsernamePasswordAuthenticationFilter`：在创建过滤器时默认使用 `/login POST` 作为表单登录请求，这个过滤器的过滤逻辑就是调用上文中配置的 `AuthenticationManager` 进行认证。

```java
	public UsernamePasswordAuthenticationFilter() {
		super(new AntPathRequestMatcher("/login", "POST"));
	}
```

如果认证成功，默认会保存认证信息，并重定向到相应的请求地址；如果认证失败，默认会重定向到登录页面。

- `DefaultLoginPageGeneratingFilter`：用于配置登录页面，登录页面默认的登录、登出、登录错误地址分别为 `/login /login?logout /login?error`，其初始化配置在 `HttpSecurity` 的默认配置中。过滤逻辑为当请求为这 3 个地址时，会生成一个表单登录的 `HTML` 并立即返回。

```java
	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
			throws IOException, ServletException {
		HttpServletRequest request = (HttpServletRequest) req;
		HttpServletResponse response = (HttpServletResponse) res;

		boolean loginError = isErrorPage(request);
		boolean logoutSuccess = isLogoutSuccess(request);
    // 登录、登出或登录失败时跳转到登录页。
		if (isLoginUrlRequest(request) || loginError || logoutSuccess) {
      // 生成 HTML 表单
			String loginPageHtml = generateLoginPageHtml(request, loginError, logoutSuccess);
			response.setContentType("text/html;charset=UTF-8");
			response.setContentLength(loginPageHtml.getBytes(StandardCharsets.UTF_8).length);
			response.getWriter().write(loginPageHtml);

			return;
		}

		chain.doFilter(request, response);
	}
```

#### http basic 认证

`httpBasic` 方法配置了 `BasicAuthenticationFilter` 过滤器，其过滤逻辑是从取出 `Authorization` 头，请求头内容为 `username:password` 的 `Base64` 编码形式。在获取用户名、密码后，同样调用 `AuthenticationManager` 进行认证。

#### csrf 跨站请求伪造保护

`csrf` 方法配置了 `CsrfFilter`，其过滤逻辑为默认放行 `GET` 等请求，其它请求需要进行 `CsrfToken` 校验。访问请求走到这个过滤器时，如果没有携带 `CsrfToken`，会新生成并放入请求中。过滤器链继续走到 `DefaultLoginPageGeneratingFilter`，由于在 `DefaultLoginPageConfigurer` 配置时，从请求中会取出 `CsrfToken` 交给 `DefaultLoginPageGeneratingFilter`，所以 `CsrfToken` 会一并生成 `HTML` 表单，我们使用默认的登录页面就能正确提交表单。

#### securityContext 认证上下文

`securityContext` 方法配置了 `SecurityContextPersistenceFilter`，其过滤逻辑为为每个会话创建一个 `SecurityContext`。

```java
  HttpRequestResponseHolder holder = new HttpRequestResponseHolder(request, response);
  // 从 session 中取出或在 session中设置 SecurityContext
  SecurityContext contextBeforeChainExecution = repo.loadContext(holder);
  SecurityContextHolder.setContext(contextBeforeChainExecution);
```

在 `UsernamePasswordAuthenticationFilter` 中，如果认证成功，则会调用 `successfulAuthentication` 方法，将认证成功的 `Authentication` 信息放入 `SecurityContextHolder` 中。开发者由此可以使用 `SecurityContextHolder.getContext().getAuthentication();` 获取当前会话的认证用户信息。

#### authorizeRequests 最后的守门员

在经历一系列过滤逻辑之后，请求来到 `spring security` 最后的过滤器 `FilterSecurityInterceptor`，此过滤器通过调用 `authorizeRequests` 方法加载 `ExpressionUrlAuthorizationConfigurer` 配置：

```java
	public void configure(H http) throws Exception {
		// ...

		FilterSecurityInterceptor securityInterceptor = createFilterSecurityInterceptor(
				http, metadataSource, http.getSharedObject(AuthenticationManager.class));

    // ...

		http.addFilter(securityInterceptor);
		http.setSharedObject(FilterSecurityInterceptor.class, securityInterceptor);
	}

	private FilterSecurityInterceptor createFilterSecurityInterceptor(H http,
			FilterInvocationSecurityMetadataSource metadataSource,
			AuthenticationManager authenticationManager) throws Exception {
		FilterSecurityInterceptor securityInterceptor = new FilterSecurityInterceptor();
		securityInterceptor.setSecurityMetadataSource(metadataSource);
    // 创建权限验证配置，默认为 AffirmativeBased，即满足一项则验权成功
		securityInterceptor.setAccessDecisionManager(getAccessDecisionManager(http));
    // 配置认证管理器
		securityInterceptor.setAuthenticationManager(authenticationManager);
		securityInterceptor.afterPropertiesSet();
		return securityInterceptor;
	}
```

在此过滤器的逻辑中，视图对此次访问进行权限验证，如果无权限，则会抛出 `AccessDeniedException`：

```java
  // Attempt authorization
  try {
    this.accessDecisionManager.decide(authenticated, object, attributes);
  }
  catch (AccessDeniedException accessDeniedException) {
    publishEvent(new AuthorizationFailureEvent(object, attributes, authenticated, accessDeniedException));
    throw accessDeniedException;
  }
```

一旦抛出了异常，顺序排在 `FilterSecurityInterceptor` 前一位的过滤器 `ExceptionTranslationFilter` 正好就能捕捉到此异常。此过滤器在 `HttpSecurity` 通过调用`exceptionHandling` 方法配置 `ExceptionHandlingConfigurer` 声明。过滤逻辑如下：

```java
	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
			throws IOException, ServletException {
		HttpServletRequest request = (HttpServletRequest) req;
		HttpServletResponse response = (HttpServletResponse) res;

		try {
			chain.doFilter(request, response);

			logger.debug("Chain processed normally");
		} catch (IOException ex) {
			throw ex;
		} catch (Exception ex) {
      // 捕捉 FilterSecurityInterceptor 过滤逻辑抛出的异常
			// ...

			if (ase == null) {
				ase = (AccessDeniedException) throwableAnalyzer.getFirstThrowableOfType(
						AccessDeniedException.class, causeChain);
			}

			if (ase != null) {
				// ...
        // 捕捉到 AccessDeniedException
				handleSpringSecurityException(request, response, chain, ase);
			}
			else {
				// ...
			}
		}
	}

	private void handleSpringSecurityException(HttpServletRequest request,
			HttpServletResponse response, FilterChain chain, RuntimeException exception)
			throws IOException, ServletException {
		if (exception instanceof AuthenticationException) {
			// ...
      // 认证异常
			sendStartAuthentication(request, response, chain,
					(AuthenticationException) exception);
		} else if (exception instanceof AccessDeniedException) {
      // 权限异常
			Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
			if (authenticationTrustResolver.isAnonymous(authentication) || authenticationTrustResolver.isRememberMe(authentication)) {
				// ...
				sendStartAuthentication(request, response, chain,
						new InsufficientAuthenticationException(
							messages.getMessage(
								"ExceptionTranslationFilter.insufficientAuthentication",
								"Full authentication is required to access this resource")));
			}
			else {
				// ...
        // 其它异常
				accessDeniedHandler.handle(request, response,
						(AccessDeniedException) exception);
			}
		}
	}

	protected void sendStartAuthentication(HttpServletRequest request,
			HttpServletResponse response, FilterChain chain,
			AuthenticationException reason) throws ServletException, IOException {
		// ...
		SecurityContextHolder.getContext().setAuthentication(null);
    // 缓存被中断的请求
		requestCache.saveRequest(request, response);
		// ...
    // 错误处理
		authenticationEntryPoint.commence(request, response, reason);
	}
```

`ExceptionTranslationFilter` 对 `AuthenticationException` 、 `AccessDeniedException` 和其它异常分别处理。`FormLoginConfigurer` 在初始化调用 `init` 方法时，对 `ExceptionTranslationFilter` 配置了 `LoginUrlAuthenticationEntryPoint`，因此对于认证和授权异常，会将请求重定向到登录页面。而对于其它异常，使用 `AccessDeniedHandlerImpl`，如果有错误页面，跳转到错误页面；否则发送 `403` 错误给客户端。

### WebSecurityConfigurerAdapter#configure

在 `WebSecurityConfigurerAdapter` 中 `void configure(WebSecurity web)` 方法默认为空实现，通过覆盖此方法，开发者可以配置不需要经过 `Spring Security` 认证的请求。

```java
  public void configure(WebSecurity web) throws Exception {
      // 忽略指定url的请求（不走过滤器链）
      web.ignoring().mvcMatchers("/**");
  }
```

#### WebSecurity#performBuild

完成加载 `WebSecurityConfigurerAdapter` 中的配置后，进入 `WebSecurity#performBuild`，生成真正的安全过滤器链：

```java
	protected Filter performBuild() throws Exception {
		// ...

		int chainSize = ignoredRequests.size() + securityFilterChainBuilders.size();
		List<SecurityFilterChain> securityFilterChains = new ArrayList<>(chainSize);
    // 上文配置的需要忽略的请求
		for (RequestMatcher ignoredRequest : ignoredRequests) {
			securityFilterChains.add(new DefaultSecurityFilterChain(ignoredRequest));
		}
    // 上文配置的 HttpSecurity 实例
		for (SecurityBuilder<? extends SecurityFilterChain> securityFilterChainBuilder : securityFilterChainBuilders) {
      // 调用 build 方法生成 DefaultSecurityFilterChain
			securityFilterChains.add(securityFilterChainBuilder.build());
		}
    // 过滤器链代理
		FilterChainProxy filterChainProxy = new FilterChainProxy(securityFilterChains);

    // ...
	}
```

### FilterChainProxy 执行各过滤器

生成 `FilterChainProxy` 的过程中，先是加载开发者配置的需要忽略的请求，包装到 `DefaultSecurityFilterChain` 中，生成一个没有过滤器的过滤器链。随之又调用 `HttpSecurity#build` 方法生成真正有过滤逻辑的过滤器链：

```java
  private FilterComparator comparator = new FilterComparator();

	protected DefaultSecurityFilterChain performBuild() throws Exception {
    // 先对配置的各过滤器进行排序，再加到过滤器链中
		Collections.sort(filters, comparator);
		return new DefaultSecurityFilterChain(requestMatcher, filters);
	}
```

过滤器过滤顺序排序依赖 `FilterComparator`。自此，`springSecurityFilterChain` 配置完成并被加入全局请求过滤器列表。

当请求经由 `FilterChainProxy` 过滤时，先根据 `request` 匹配过滤器：

```java
	private List<Filter> getFilters(HttpServletRequest request) {
		for (SecurityFilterChain chain : filterChains) {
			if (chain.matches(request)) {
				return chain.getFilters();
			}
		}
		return null;
	}
```

当请求配置为忽略，会匹配到无过滤器的 `DefaultSecurityFilterChain`，因此无需经历 `Spring Security` 各过滤器；否则走正常过滤逻辑。
拿到请求匹配的过滤器列表后，`FilterChainProxy` 生成一个 `VirtualFilterChain`，`Spring Security` 相关过滤器的过滤逻辑均在此执行，当相关过滤器执行完毕，再回到 `Spring MVC` 的过滤器链上来继续执行。

```java
  private VirtualFilterChain(FirewalledRequest firewalledRequest, FilterChain chain, List<Filter> additionalFilters) {
    // Spring MVC 过滤器链
    this.originalChain = chain;
    // 请求匹配到的过滤器列表
    this.additionalFilters = additionalFilters;
    this.size = additionalFilters.size();
    this.firewalledRequest = firewalledRequest;
  }

  @Override
  public void doFilter(ServletRequest request, ServletResponse response)
      throws IOException, ServletException {
    if (currentPosition == size) {
      // ...

      // Spring Security 相关过滤器执行完毕，回到 Spring MVC 的过滤器链上来继续执行
      originalChain.doFilter(request, response);
    }
    else {
      currentPosition++;
      Filter nextFilter = additionalFilters.get(currentPosition - 1);

      // 按顺序来执行 Spring Security 相关过滤器
      nextFilter.doFilter(request, response, this);
    }
  }
```

## 小结

（1） `Spring Security` 开箱即用，拥有完善的默认配置机制，基于过滤器对 `web` 应用进行保护。
（2） 如果开发者需要对 `Spring Security` 自动配置进行干预，可以继承 `WebSecurityConfigurerAdapter` 并实现它的 3 个 `configure` 方法：

- `void configure(AuthenticationManagerBuilder auth)`：配置认证管理器，开发者需要实现 `UserDetailsService` 接口，编写自定义认证逻辑，并将接口实现注册到 `Spring` 容器，在此方法中指定认证逻辑实现。

```java
  protected void configure(AuthenticationManagerBuilder auth) throws Exception {
      auth.userDetailsService(userDetailsService).passwordEncoder(new BCryptPasswordEncoder());
  }
```

- `void configure(HttpSecurity http)`：配置过滤器管理器，开发者在此方法中对默认的 `HttpSecurity` 进行修改：

```java
  protected void configure(HttpSecurity http) throws Exception {
      http
              // 表单登录
              .formLogin().and()
              // 关闭 csrf 保护
              .csrf().disable()
              // 任何请求都需要认证
              .authorizeRequests().anyRequest().authenticated();
  }
```

- `void configure(WebSecurity web)`：请求忽略配置，开发者在此可以配置不需要进行安全认证的请求：

```java
  public void configure(WebSecurity web) throws Exception {
      // 忽略指定url的请求（不走过滤器链）
      web.ignoring().mvcMatchers("/**");
  }
```

（3）重要的定义

- `springSecurityFilterChain`：`Spring Security` 过滤器链。
- `AuthenticationManager`：认证管理器，负责对用户身份进行认证。
- `AuthenticationProvider`：认证逻辑具体实现，由认证管理器调用。
- `UserDetailsService`：通过 `username` 认证，包装成 `AuthenticationProvider` 使用。
- `FilterSecurityInterceptor`：最终决定是否放行请求，如果需要认证而未认证，或没有相应的权限，都会判断请求失败。
- `FilterChainProxy`：`Spring Security` 过滤器代理，关于安全的过滤逻辑均在此过滤器中执行，执行完成后才回到 `Spring MVC` 过滤器链中继续执行。
