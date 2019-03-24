---
sidebarDepth: 2
date: 2019-03-09
desc: 探究Spring Security授权配置，分析鉴权流程。
tags: SpringSecurity 源码分析 配置授权

---

# Spring Security 源码分析（三）：授权管理

## URL访问权限配置

`Spring Security` 允许在过滤器配置中使用如下方式对特定 `URL` 做权限配置：

```java
  @Override
  public void configure(HttpSecurity http) throws Exception {
    http.authorizeRequests()
      // /api1/** 需要 ROLE_ADMIN 角色才能访问
      .antMatchers("/api1/**").hasRole("ADMIN")
      // /api2/** 需要 USER 权限才能访问
      .antMatchers("/api2/**").hasAuthority("USER")
      // /api3/** 允许任何人访问
      .antMatchers("/api3/**").permitAll()
      // 其它所有接口都需要认证后才能访问
      .anyRequest().authenticated();
  }
```

`HttpSecurity#authorizeRequests` 方法引入了 `ExpressionUrlAuthorizationConfigurer`  配置了 `ExpressionInterceptUrlRegistry`，这是一个包含了多组 `RequestMatcher` 和不同访问权限的注册对象。`antMatchers` 方法生成指定路径匹配对象 `RequestMatcherConfigurer`，`hasRole` 、`hasAuthority` 等方法则根据配置的访问权限生成 `SpEL` 表达式，其最终目的是通过 `SpEL expressions` 来做权限控制：

```java
private static String hasRole(String role) {
  // 根据配置的角色添加了 ROLE_ 前缀
  return "hasRole('ROLE_" + role + "')";
}

private static String hasAuthority(String authority) {
  return "hasAuthority('" + authority + "')";
}
```

这些配置的 `SpEL` 表达式最终通过 `interceptUrl` 方法与对应的路径匹配对象注册到 `REGISTRY` 中：

```java
  public ExpressionInterceptUrlRegistry hasRole(String role) {
    return access(ExpressionUrlAuthorizationConfigurer.hasRole(role));
  }

  public ExpressionInterceptUrlRegistry hasAnyRole(String... roles) {
    return access(ExpressionUrlAuthorizationConfigurer.hasAnyRole(roles));
  }

  public ExpressionInterceptUrlRegistry access(String attribute) {
    if (not) {
      attribute = "!" + attribute;
    }
    interceptUrl(requestMatchers, SecurityConfig.createList(attribute));
    return ExpressionUrlAuthorizationConfigurer.this.REGISTRY;
  }
  private void interceptUrl(Iterable<? extends RequestMatcher> requestMatchers,
                            Collection<ConfigAttribute> configAttributes) {
    for (RequestMatcher requestMatcher : requestMatchers) {
      // 注册 路径匹配对象-访问权限 SpEL 表达式
      REGISTRY.addMapping(new AbstractConfigAttributeRequestMatcherRegistry.UrlMapping(
        requestMatcher, configAttributes));
    }
  }
```

## 载入权限配置

在第一章中我们说到，通过调用 `HttpSecurity#authorizeRequests` 方法可以配置 `Spring Security` 最后的守门员 `FilterSecurityInterceptor`，这是过滤器链中的最后一个过滤器。

```java
  // 获取访问权限配置
  FilterInvocationSecurityMetadataSource metadataSource = createMetadataSource(http);
  // 使用访问权限配置创建 FilterSecurityInterceptor
  FilterSecurityInterceptor securityInterceptor = createFilterSecurityInterceptor(http, metadataSource, http.getSharedObject(AuthenticationManager.class));
```

在创建 `FilterSecurityInterceptor` 时要求传入 `metadataSource`，而这就是上文中所说的 `REGISTRY` 相关配置：

```java
  final ExpressionBasedFilterInvocationSecurityMetadataSource createMetadataSource(H http) {
    // 获取配置的 RequestMatcher 与 访问权限关系
    LinkedHashMap<RequestMatcher, Collection<ConfigAttribute>> requestMap = REGISTRY.createRequestMap();
    // ...
    return new ExpressionBasedFilterInvocationSecurityMetadataSource(requestMap, getExpressionHandler(http));
  }
```

## 鉴权流程

进入最后一个过滤器 `FilterSecurityInterceptor` 后，认证流程会调用 `AbstractSecurityInterceptor#beforeInvocation` 方法：

```java
  protected InterceptorStatusToken beforeInvocation(Object object) {
    // ...
    // 根据当前的 request 对象获取对应的访问权限
    Collection<ConfigAttribute> attributes = this.obtainSecurityMetadataSource().getAttributes(object);
    // ...

    try {
      // 决定是否允许访问
      this.accessDecisionManager.decide(authenticated, object, attributes);
    }
    // ...
  }
```

根据当前请求匹配到对应的访问权限后，使用 `AccessDecisionManager` 决定是否对当前请求放行，`AccessDecisionManager` 有三种实现：

- `AffirmativeBased`：任一个投票器通过即允许访问。
- `ConsensusBased`：投票器通过半数即运行访问。
- `UnanimousBased`：所有投票器通过才允许访问。

默认实现为 `AffirmativeBased`，投票器用来判定当前请求是否允许访问，默认实现为 `WebExpressionVoter` 这是一种根据 `SpEL` 表达式匹配来判断访问权限的投票器。

```java
  public void decide(Authentication authentication, Object object, Collection<ConfigAttribute> configAttributes) throws AccessDeniedException {
    int deny = 0;
		// 遍历所有投票器
    for (AccessDecisionVoter voter : getDecisionVoters()) {
      // 根据用户权限列表做 SpEL 比较
      int result = voter.vote(authentication, object, configAttributes);
      switch (result) {
        case AccessDecisionVoter.ACCESS_GRANTED:
          // 有一个允许通过则结束投票
          return;
        case AccessDecisionVoter.ACCESS_DENIED:
          // 不允许通过次数+1
          deny++;
          break;
        default:
          break;
      }
    }
		// 投票不通过，抛出 AccessDeniedException
    if (deny > 0) {
      throw new AccessDeniedException(messages.getMessage(
        "AbstractAccessDecisionManager.accessDenied", "Access is denied"));
    }
  }
```

`AffirmativeBased` 的投票逻辑如上，只要有一个投票器投票通过则投票结束，否则抛出 `AccessDeniedException` 异常。

## 小结

- 在配置过滤器链时，结合使用 `antMatchers` 和权限配置访问可以对匹配 `URL` 做权限控制。
- 通过比较用户认证信息的权限与请求的访问权限的 `SpEL` 表达式来最终确认是否可以访问。