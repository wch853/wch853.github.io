---
sidebarDepth: 2
date: 2019-03-02
desc: 基于实际应用，从源码角度分析Spring Security对表单登录配置的扩展。
tags: SpringSecurity 源码分析 表单
---

# Spring Security 源码分析（二）：表单登录

## 自定义表单登录

`FormLoginConfigurer` 提供了 `loginPage` 和 `loginProcessingUrl` 方法分别用于配置登录页面和表单提交请求处理路径。继承 `WebSecurityConfigurerAdapter`，重载关于过滤器和忽略请求的配置方法：

```java
  public class CustomSecurityConfig extends WebSecurityConfigurerAdapter {

    @Override
    protected void configure(HttpSecurity http) throws Exception {
      // 表单登录，配置表单页面和表单提交URL
      http.formLogin().loginPage("/login.html").loginProcessingUrl("/login").and()
      // 任何请求都需要认证
      .authorizeRequests().anyRequest().authenticated();
    }

    @Override
    public void configure(WebSecurity web) throws Exception {
      // 登录页面请求不走 Spring Security 过滤器链
      web.ignoring().mvcMatchers("/login.html");
    }
  }
```

### loginPage 自定义登录页面

```java
  protected T loginPage(String loginPage) {
    // 配置自定义登录
    setLoginPage(loginPage);
    // 更新登录错误 / 登出路径（基于 loginPage）
    updateAuthenticationDefaults();
    // 更新自定义标识
    this.customLoginPage = true;
    return getSelf();
  }
```

在配置自定义登录页面后，同时会更新认证错误认证策略：

```java
  private void setLoginPage(String loginPage) {
    this.loginPage = loginPage;
    // 更新认证异常时跳转页面
    this.authenticationEntryPoint = new LoginUrlAuthenticationEntryPoint(loginPage);
  }
```

上一节中说到，当 `ExceptionTranslationFilter` 拦截到认证异常后，会调用 `LoginUrlAuthenticationEntryPoint#commence` 方法进行处理，其主要逻辑为将用户请求重定向到登录页面。

```java
  public void commence(HttpServletRequest request, HttpServletResponse response,
      AuthenticationException authException) throws IOException, ServletException {
    // ...

    // 获取配置的 loginPage
    String loginForm = determineUrlToUseForThisRequest(request, response, authException);
    // 请求重定向
    RequestDispatcher dispatcher = request.getRequestDispatcher(loginForm);
    dispatcher.forward(request, response);

    // ...
  }
```

`loginPage` 方法更新 `customLoginPage` 标识后，`DefaultLoginPageGeneratingFilter` 的过滤逻辑也随之改变，其默认配置的需要拦截的相关路径为 `/login`，当开发者自定义登录页面路径后，经由此过滤器就不会再被拦截。

### loginPage 定义表单提交路径

`loginPage` 方法中调用了 `updateAuthenticationDefaults` 方法，可见当不手动配置 `loginProcessingUrl` 时，会使用 `loginPage` 作为表单提交路径。

```java
  protected final void updateAuthenticationDefaults() {
    if (loginProcessingUrl == null) {
      // 默认实用 loginPage 作为表单提交路径
      loginProcessingUrl(loginPage);
    }

    // ...
  }
```

但是 `FormLoginConfigurer` 配置的 `UsernamePasswordAuthenticationFilter` 则在默认构造方法中指定表单提交路径为 `/login`，也就是说如果开发者配置 `loginPage` 为其它路径，就无法正常进行认证。

```java
  public UsernamePasswordAuthenticationFilter() {
    super(new AntPathRequestMatcher("/login", "POST"));
  }

  /**
   * 路径匹配才进行认证
   */
  protected boolean requiresAuthentication(HttpServletRequest request,
    HttpServletResponse response) {
    return requiresAuthenticationRequestMatcher.matches(request);
  }
```

因此为了 `UsernamePasswordAuthenticationFilter` 能够正常执行，开发者需要手动指定 `loginProcessingUrl`。

```java
  public T loginProcessingUrl(String loginProcessingUrl) {
    this.loginProcessingUrl = loginProcessingUrl;
    // 设置过滤器处理登录逻辑的请求URL（可以指定其它名称覆盖 /login）
    authFilter.setRequiresAuthenticationRequestMatcher(createLoginProcessingUrlMatcher(loginProcessingUrl));
    return getSelf();
  }
```

### 忽略对自定义登录页面的拦截

上文示例中配置的是对所有请求进行拦截，当过滤器链发现没有认证就会跳转到登录页面，但是访问登录页面也需要认证，这就会造成一直重定向，无法完成登录。因此需要配置登录页面请求不走 `Spring Security` 过滤器链，这样所有人就可以正常访问登录页面。

### 登录后处理

登录成功后是跳转到首页还是用户原先想访问的页面？失败后是仍跳转到登录页面还是自定义的错误页面？`Spring Security` 提供了若干方法用于开发者自定义登录后处理：

```java
  @Resource
  private AuthenticationSuccessHandler successHandler;

  @Resource
  private AuthenticationFailureHandler failureHandler;

  protected void configure(HttpSecurity http) throws Exception {
    // 表单登录
    http.formLogin()
            // 认证成功后重定向URL
            .successForwardUrl("/")
            // 认证失败后重定向URL
            .failureForwardUrl("/login.html?error")
            // 如果是从其它页面重定向到登录页面，则成功后跳转到原请求URL，否则跳转到指定URL
            .defaultSuccessUrl("/", false)
            // 认证失败后重定向URL
            .failureUrl("/login.html?error")
            // 自定义认证成功后处理器
            .successHandler(successHandler)
            // 自定义认证失败后处理器
            .failureHandler(failureHandler)
            .and()
            // 任何请求都需要认证
            .authorizeRequests().anyRequest().authenticated();
  }
```

同样是重载 `void configure(HttpSecurity http)` 方法，干预认证过滤器的生成逻辑。可以看到 `HttpSecurity` 提供了 4 个修改重定向地址的方法，而实际上他们最后都是对 `successHandler` 和 `failureHandler` 进行配置。在 `UsernamePasswordAuthenticationFilter` 的认证逻辑中，当认证成功后会调用 `successfulAuthentication` 方法，而在此方法中又调用了 `AuthenticationSuccessHandler#onAuthenticationSuccess` 方法，如下是认证成功后处理器的一类实现：

```java
  public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
    request.getRequestDispatcher(forwardUrl).forward(request, response);
  }
```

但是在前后端分离的项目中，认证系统可能作为一个单独的后端模块单独拆出来，配置登录跳转就无法满足与前端交互的任务，因此开发者需要继承 `AuthenticationSuccessHandler` 和
`AuthenticationFailureHandler`，自定义认证后响应，以下为向前端返回认证失败的 `Json` 数据的一类实现：

```java
@Component
public class JsonAuthenticationFailureHandler implements AuthenticationFailureHandler {

  @Override
  public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception) throws IOException, ServletException {
    // 状态码 401
    response.setStatus(HttpStatus.UNAUTHORIZED.value());
    // 设置返回类型为 json
    response.setContentType("application/json;charset=UTF-8");
    response.getWriter().write(JSONUtils.toJSONString(exception));
  }
}
```

## 自定义过滤器

`HttpSecurity` 提供了若干方法为 `web` 请求添加过滤器，例如默认表单、认证过期、`CSRF` ` 保护等。同时开发者可以定义自已的过滤器，并指定在整个过滤器中的位置。如果需要在表单中添加验证码校验逻辑，可以使用如下示例：

```java
  /**
  * 认证失败后处理器
  */
  @Resource
  private AuthenticationFailureHandler failureHandler;

  @Override
  protected void configure(HttpSecurity http) throws Exception {
    // 在认证登录前验证验证码
    http.addFilterBefore(new CaptchaFilter(failureHandler),
    UsernamePasswordAuthenticationFilter.class)；
  }
```

在上文中我们说到，登录表单提交请求无论是成功还是失败，默认都会交由认证处理器进行跳转。因此在整个过滤器链中，关于验证码的过滤逻辑需要排在 `UsernamePasswordAuthenticationFilter` 之前。

```java
  public HttpSecurity addFilterBefore(Filter filter, Class<? extends Filter> beforeFilter) {
    // 过滤器排序器注册
    comparator.registerBefore(filter.getClass(), beforeFilter);
    return addFilter(filter);
  }
```

所有 `Spring Security` 配置的过滤器，其顺序由 `FilterComparator` 管理：

```java
final class FilterComparator implements Comparator<Filter>, Serializable {

  /**
   * 初始化顺序
   */
  private static final int INITIAL_ORDER = 100;

  /**
   * order 步长
   */
  private static final int ORDER_STEP = 100;

  /**
   * 过滤器名称 - 在过滤器中的顺序（order 越小，排序越靠前）
   */
  private final Map<String, Integer> filterToOrder = new HashMap<>();

  FilterComparator() {
    Step order = new Step(INITIAL_ORDER, ORDER_STEP);
    // ...

    put(SecurityContextPersistenceFilter.class, order.next());
    // ...

    put(UsernamePasswordAuthenticationFilter.class, order.next());
    // ...

    put(FilterSecurityInterceptor.class, order.next());
    // ...
  }

  public void registerBefore(Class<? extends Filter> filter, Class<? extends Filter> beforeFilter) {
    Integer position = getOrder(beforeFilter);
    // ...

    // 注册自定义过滤器
    put(filter, position - 1);
  }
}
```

可以看到，`FilterComparator` 对 `Spring Security` 配置的默认过滤器维护了一个 `filterToOrder`，用于描述各个过滤器在过滤器链中的顺序，前后两个过滤器的顺序相差 100。`registerBefore` 方法将开发者自定义的过滤器注册到 `FilterComparator` 方法中，并指定其顺序与 `UsernamePasswordAuthenticationFilter` 相差 1。这样在过滤器中就能保证自定义的验证码过滤器 [CaptchaFilter](https://github.com/wch853/snippet/blob/master/security/security-web/src/main/java/com/wch/snippet/security/config/filter/CaptchaFilter.java) 能够在认证过滤器前一位执行。

## 记住我

在过滤器配置中，可以通过 `remember` 方法配置 `记住我` 功能：

```java
  @Override
  protected void configure(HttpSecurity http) throws Exception {
    // 在认证登录前验证验证码
    http.rememberMe().and()
        // 任何请求都需要认证
        .authorizeRequests().anyRequest().authenticated();
  }
```

`rememberMe` 方法通过 `RememberMeConfigurer` 配置 `RememberMeAuthenticationFilter`，在 `init` 方法中先生成了一个 `RememberMeServices`：

```java
  private RememberMeServices getRememberMeServices(H http, String key) throws Exception {
    // ...

    //
    AbstractRememberMeServices tokenRememberMeServices = createRememberMeServices(
        http, key);
    // 表单登录参数名默认为 remember-me
    tokenRememberMeServices.setParameter(this.rememberMeParameter);
    // Cookie 名称默认为 remember-me
    tokenRememberMeServices.setCookieName(this.rememberMeCookieName);
    // ...

    // 配置记住我过期时间，默认为两周
    if (this.tokenValiditySeconds != null) {
  		tokenRememberMeServices.setTokenValiditySeconds(this.tokenValiditySeconds);
    }
    // ...

    // 如果用户主动登出了，需要清除记住我功能做的相关配置
    this.logoutHandler = tokenRememberMeServices;
    this.rememberMeServices = tokenRememberMeServices;
    return tokenRememberMeServices;
  }
```

对于创建基础的 `AbstractRememberMeServices`，`Spring Security` 提供了两种方式，一种是 `TokenBasedRememberMeServices`：是否能够使用 `记住我` 功能、校验都只依赖请求中的 `Cookie`；另一种是配置 `PersistentTokenRepository`：`InMemoryTokenRepositoryImpl` 在内存中维护一个 `Map` 用于对 `记住我` 进行校验，`JdbcTokenRepositoryImpl` 会从数据库中查询相关的 `token` 进行校验。这两种方式都是依赖请求中携带的 `Cookie`。当用户提交登出请求，应该取消 `记住我` 功能，`AbstractRememberMeServices` 对此的实现为清除名为 `remember-me` 的 `Cookie`：

```java
  protected void cancelCookie(HttpServletRequest request, HttpServletResponse response) {
    // ...
    Cookie cookie = new Cookie(cookieName, null);
    cookie.setMaxAge(0);
    cookie.setPath(getCookiePath(request));
    // ...

    response.addCookie(cookie);
  }
```

`RememberMeServices` 配置完成后，`RememberMeAuthenticationFilter` 被加到过滤器链中，其过滤逻辑如下：

```java
  public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
    // ...

    if (SecurityContextHolder.getContext().getAuthentication() == null) {
      // 没有经过认证，SecurityContext 为空，尝试使用 记住我 功能

      // 检验 Cookie，如果有效进行自动登录
      Authentication rememberMeAuth = rememberMeServices.autoLogin(request, response);

      if (rememberMeAuth != null) {
        // remeber-me Cookie 有效，走用户认证逻辑
        try {
          rememberMeAuth = authenticationManager.authenticate(rememberMeAuth);
          SecurityContextHolder.getContext().setAuthentication(rememberMeAuth);
          // ...
        } catch (AuthenticationException authenticationException) {
          // 认证失败了，也会清除 remeber-me Cookie
          rememberMeServices.loginFail(request, response);
          // ...
        }
      }

      chain.doFilter(request, response);
    } else {
      // ...

      chain.doFilter(request, response);
    }
  }
```

如果 `SecurityContext` 没有认证信息，过滤器会尝试使用 `记住我` 功能，调用 `autoLogin` 方法：

```java
  public final Authentication autoLogin(HttpServletRequest request, HttpServletResponse response) {
    // 从请求中获取名为 remember-me 的 Cookie
    String rememberMeCookie = extractRememberMeCookie(request);
    // ...

    UserDetails user = null;
    try {
      // 原 Cookie 解码
      String[] cookieTokens = decodeCookie(rememberMeCookie);
      user = processAutoLoginCookie(cookieTokens, request, response);
      // 校验用户账号是否有效
      userDetailsChecker.check(user);
      // 创建认证信息
      return createSuccessfulAuthentication(request, user);
    } catch (CookieTheftException cte) {
      // 清理客户端的 remember-me Cookie
      cancelCookie(request, response);
      throw cte;
    }
    // ...

    cancelCookie(request, response);
    return null;
  }
```

`TokenBasedRememberMeServices` 中对于 `processAutoLoginCookie` 方法的实现为：

```java
  protected UserDetails processAutoLoginCookie(String[] cookieTokens, HttpServletRequest request, HttpServletResponse response) {
    // ...

    long tokenExpiryTime;

    try {
      tokenExpiryTime = new Long(cookieTokens[1]).longValue();
    } catch (NumberFormatException nfe) {
      throw new InvalidCookieException(
          "Cookie token[1] did not contain a valid number (contained '"
              + cookieTokens[1] + "')");
    }

    // ...

    // 根据用户名加载用户信息
    UserDetails userDetails = getUserDetailsService().loadUserByUsername(cookieTokens[0]);

    // 根据过期时间、用户名、密码生成 MD5 签名
    String expectedTokenSignature = makeTokenSignature(tokenExpiryTime,
        userDetails.getUsername(), userDetails.getPassword());

    // 校验签名
    if (!equals(expectedTokenSignature, cookieTokens[2])) {
      throw new InvalidCookieException("Cookie token[2] contained signature '"
          + cookieTokens[2] + "' but expected '" + expectedTokenSignature + "'");
    }

    return userDetails;
  }
```

对 `Cookie` 进行解码后，根据登录用户的相关信息做 `MD5` 校验，如果认定 `Cookie` 中的 `Token` 有效，则会查询用户信息，生成认证身份，通过认证流程。那么，`记住我` 的 `Cookie` 是在何时放入的呢？在 `RememberMeConfigurer` 的初始化过程中，默认的 `remember-me` 表单名被传递给表单生成过滤器：

```java
private void initDefaultLoginFilter(H http) {
  DefaultLoginPageGeneratingFilter loginPageGeneratingFilter = http
    .getSharedObject(DefaultLoginPageGeneratingFilter.class);
  if (loginPageGeneratingFilter != null) {
    // 将表单名 remember-me 传递给默认表单生成过滤器，生成 记住我 复选框
    loginPageGeneratingFilter.setRememberMeParameter(getRememberMeParameter());
  }
}
```

表单中会根据传入的名称生成如下 `HTML` 代码：

```html
<p>
  <input type="checkbox" name="remember-me" /> Remember me on this computer.
</p>
```

`UsernamePasswordAuthenticationFilter` 在用户认证成功后会调用 `successfulAuthentication` 方法，在此方法中会取出 `remember-me` 参数，判断是否使用 `记住我` 功能。而后又调用了 `RememberMeServices` 的 `loginSuccess` 方法：

```java
  public final void loginSuccess(HttpServletRequest request, HttpServletResponse response, Authentication successfulAuthentication) {
    // 请求参数中是否要求使用记住我功能
    if (!rememberMeRequested(request, parameter)) {
      logger.debug("Remember-me login not requested.");
      return;
    }

    // 要求使用记住我功能，响应中构造 Cookie
    onLoginSuccess(request, response, successfulAuthentication);
  }
```

`TokenBasedRememberMeServices` 中对于 `onLoginSuccess` 方法的实现为：

```java
public void onLoginSuccess(HttpServletRequest request, HttpServletResponse response, Authentication successfulAuthentication) {

  String username = retrieveUserName(successfulAuthentication);
  String password = retrievePassword(successfulAuthentication);
  // ...

  // Cookie 失效时间
  int tokenLifetime = calculateLoginLifetime(request, successfulAuthentication);
  long expiryTime = System.currentTimeMillis();
  expiryTime += 1000L * (tokenLifetime < 0 ? TWO_WEEKS_S : tokenLifetime);

  // 构造 MD5 签名，与校验 Cookie 的逻辑一致
  String signatureValue = makeTokenSignature(expiryTime, username, password);

  // 在响应中添加 Cookie
  setCookie(new String[] { username, Long.toString(expiryTime), signatureValue },
            tokenLifetime, request, response);
  // ...
}
```

如果配置了 `PersistentTokenRepository` 其流程大致相同，区别在于 `Cookie` 的生成和校验逻辑不同，在此不多做赘述。

## 小结

- 通过配置 `FormLoginConfigurer` 的 `loginPage` 和 `loginProcessingUrl` 可以切换默认登录页面和表单请求地址。

- 通过配置 `FormLoginConfigurer` 的 `successHandler` 和 `failureHandler` 可以干预认证成功 / 失败后的服务端控制行为。

- `Spring Security` 过滤器链中的过滤器执行顺序由 `FilterComparator` 管理。如果需要在过滤器链中增加自定义过滤器，可以通过 `HttpSecurity` 的 `addFilterBefore` 或者 `addFilterAfter` 方法将自定义过滤器加在指定过滤器前 / 后。

- 配置 `RememberMe` 后，认证成功和失败，响应都会返回 `Cookie` 给客户端，下一次未经认证即访问 `web` 资源时，会对请求携带的 `Cookie` 进行校验，如果有效则会自动登录，执行认证逻辑。

- 表单登录的相关扩展仍然离不开过滤器的支持，以下是几个较为重要的 `Spring Security` 过滤器：

  ![SpringSecuirty主要过滤器](/img/security/SpringSecuirty主要过滤器.png)
