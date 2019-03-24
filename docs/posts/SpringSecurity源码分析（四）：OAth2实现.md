---
sidebarDepth: 2
date: 2019-03-16
desc: 基于实际应用，从源码角度分析Spring Security对OAuth2的实现。
tags: SpringSecurity 源码分析 OAuth2
---

# Spring Security 源码分析（四）：OAuth2 实现

## OAuth2

`OAuth2`是一个开放[标准](https://tools.ietf.org/html/rfc6749#section-4.1.1)，允许用户在不将用户名和密码提供给第三方应用的情况下，授权第三方应用访问用户存储在其它服务提供者服务器上的资源。

### 角色

`OAuth` 标准中定义了以下几种角色：

- `Resource Owner`：资源所有者。拥有访问受保护资源权限的实体，即用户。
- `Resource Server`：托管受保护资源的服务器，能够接收和响应持有 `access token` 的对受保护资源的请求。
- `Client` ：资源所有者许可访问受保护资源的第三方应用。
- `Authorization Server`：授权服务器，在对资源所有者及其权限认证完成后向第三方应用颁发 `access token`。

### 申请授权流程

```
 +--------+                               +---------------+
 |        |--(A)- Authorization Request ->|   Resource    |
 |        |                               |     Owner     |
 |        |<-(B)-- Authorization Grant ---|               |
 |        |                               +---------------+
 |        |
 |        |                               +---------------+
 |        |--(C)-- Authorization Grant -->| Authorization |
 | Client |                               |     Server    |
 |        |<-(D)----- Access Token -------|               |
 |        |                               +---------------+
 |        |
 |        |                               +---------------+
 |        |--(E)----- Access Token ------>|    Resource   |
 |        |                               |     Server    |
 |        |<-(F)--- Protected Resource ---|               |
 +--------+                               +---------------+
```

上图描述了 `OAuth 2.0` 四种角色之间的交互流程，包括以下步骤：

- （A）第三方应用向资源所有者请求授权。
- （B）第三方应用收到授权许可。
- （C）第三方应用向授权服务器出示授权许可。
- （D）授权服务器验证第三方应用身份和授权许可，颁发访问令牌。
- （E）第三方应用持有访问令牌向资源服务器请求受保护资源。
- （F）资源服务器验证访问令牌并响应。

### 授权方式

- `authorization_code`：授权码模式，第三方应用引导资源所有者前往授权服务器进行授权，完成后引导资源所有者携带授权码会回到第三方应用，通过授权码第三方应用可以获取真正的访问令牌。
- `implicit`：隐式许可，相对于授权码模式，第三方应用不再需要授权码，而是在资源所有者授权后直接被颁发一个访问令牌。
- `password`：资源所有者密码凭据，将资源所有者的密码凭据直接作为获取访问令牌的授权许可。通常用于资源所有者高度信任第三方应用的情况。
- `client_credentials`：第三方应用凭证，仅使用 `client_id` 和 `client_secret` 进行授权，用来获取第三方应用下控制的资源，或者事先与授权服务器商定好的受保护资源。

## Spring OAuth2 自动装配

引入 `spring-security-oauth2-autoconfigure` 依赖：

```xml
<dependency>
	<groupId>org.springframework.security.oauth.boot</groupId>
	<artifactId>spring-security-oauth2-autoconfigure</artifactId>
</dependency>
```

此依赖中的 `spring.factories` 文件指定加载 `OAuth2AutoConfiguration`，此类通过 `@Import` 注解引入 `OAuth2AuthorizationServerConfiguration`，这是一个实现了 `AuthorizationServerConfigurer` 接口的类，接口中的注释说到：此接口中的方法都是用来配置 `OAuth2` 授权服务器的，如果使用了 `@EnableAuthorizationServer` 注解，这个接口的实现类都会自动被注入到 `Spring` 容器中。

### 授权服务器自动化配置

通过添加 `@EnableAuthorizationServer` 注解，一系列默认配置就被引入 `Spring` 容器。

#### 第三方应用认证配置

```java
@Configuration
public class ClientDetailsServiceConfiguration {

  @SuppressWarnings("rawtypes")
  private ClientDetailsServiceConfigurer configurer = new ClientDetailsServiceConfigurer(new ClientDetailsServiceBuilder());

  /**
   * 将第三方应用认证服务配置器注入 Spring 容器，使得认证服务可被干预
   */
  @Bean
  public ClientDetailsServiceConfigurer clientDetailsServiceConfigurer() {
    return configurer;
  }

  /**
   * 懒加载第三方应用认证服务，等待认证服务加载干预配置
   */
  @Bean
  @Lazy
  @Scope(proxyMode=ScopedProxyMode.INTERFACES)
  public ClientDetailsService clientDetailsService() throws Exception {
    return configurer.and().build();
  }

}
```

可以看到 `ClientDetailsServiceConfigurer` 的一个实例被注入到 `Spring` 容器中，此配置生成的 `ClientDetailsService` 实例标记了 `@Lazy` 注解，要求被懒加载，此实例加载其它配置后在第一次使用时进行实例化。

#### 授权端点配置

在 `OAuth2` 框架标准（[端点协议](https://tools.ietf.org/html/rfc6749)）中，获取授权需要经由两个授权服务器端点：

- `Authorization Endpoint`：通过客户端跳转引导资源所有者向第三方应用授权。
- `Token Endpoint`：第三方应用携带授权许可与授权服务器交换访问令牌。

`AuthorizationServerEndpointsConfiguration` 以 `Spring MVC` 接口的形式注入了两个端点的实现：

```java
@Configuration
@Import(TokenKeyEndpointRegistrar.class)
public class AuthorizationServerEndpointsConfiguration {

  /**
   * 授权端点配置
   */
  private AuthorizationServerEndpointsConfigurer endpoints = new AuthorizationServerEndpointsConfigurer();

  /**
   * 第三方应用认证服务
   */
  @Autowired
  private ClientDetailsService clientDetailsService;

  /**
   * 自定义授权服务器配置
   */
  @Autowired
  private List<AuthorizationServerConfigurer> configurers = Collections.emptyList();

  @PostConstruct
  public void init() {
    for (AuthorizationServerConfigurer configurer : configurers) {
      try {
        // 将自定义配置应用到授权服务器
        configurer.configure(endpoints);
      } catch (Exception e) {
        throw new IllegalStateException("Cannot configure enpdoints", e);
      }
    }
    endpoints.setClientDetailsService(clientDetailsService);
  }

  /**
   * 配置 /oauth/authorize 接口
   */
  @Bean
  public AuthorizationEndpoint authorizationEndpoint() throws Exception {
    // 声明 /oauth/authorize GET 和 POST 请求
    AuthorizationEndpoint authorizationEndpoint = new AuthorizationEndpoint();

    // 获取自定义授权端点配置的 URL 映射
    FrameworkEndpointHandlerMapping mapping = getEndpointsConfigurer().getFrameworkEndpointHandlerMapping();
    // 默认授权确认页面为 /oauth/confirm_access，允许自定义
    authorizationEndpoint.setUserApprovalPage(extractPath(mapping, "/oauth/confirm_access"));
    authorizationEndpoint.setProviderExceptionHandler(exceptionTranslator());
    // 默认授权失败页面为 /oauth/error，允许自定义
    authorizationEndpoint.setErrorPage(extractPath(mapping, "/oauth/error"));
    // 配置访问令牌授权器，访问令牌默认存储在内存中，允许多种授权方式
    authorizationEndpoint.setTokenGranter(tokenGranter());
    authorizationEndpoint.setClientDetailsService(clientDetailsService);
    authorizationEndpoint.setAuthorizationCodeServices(authorizationCodeServices());
    authorizationEndpoint.setOAuth2RequestFactory(oauth2RequestFactory());
    authorizationEndpoint.setOAuth2RequestValidator(oauth2RequestValidator());
    // 授权确认策略，允许配置为自动确认和跳转确认等多种方式
    authorizationEndpoint.setUserApprovalHandler(userApprovalHandler());
    // 跳转处理器，验证允许跳转的授权方式，验证跳转路径是否注册
    authorizationEndpoint.setRedirectResolver(redirectResolver());
    return authorizationEndpoint;
  }

  /**
   * 配置 /oauth/token 接口
   */
  @Bean
  public TokenEndpoint tokenEndpoint() throws Exception {
    // 声明 /oauth/token GET 和 POST 请求
    TokenEndpoint tokenEndpoint = new TokenEndpoint();
    tokenEndpoint.setClientDetailsService(clientDetailsService);
    tokenEndpoint.setProviderExceptionHandler(exceptionTranslator());
    // 配置访问令牌授权器
    tokenEndpoint.setTokenGranter(tokenGranter());
    tokenEndpoint.setOAuth2RequestFactory(oauth2RequestFactory());
    tokenEndpoint.setOAuth2RequestValidator(oauth2RequestValidator());
    // 配置 /oauth/token 接口允许的请求方法，默认只允许 POST 方法
    tokenEndpoint.setAllowedRequestMethods(allowedTokenEndpointRequestMethods());
    return tokenEndpoint;
  }

  /**
   * 配置 /oauth/check_token 接口
   */
  @Bean
  public CheckTokenEndpoint checkTokenEndpoint() {
    // 校验 token 是否有效并返回相关信息
    CheckTokenEndpoint endpoint = new CheckTokenEndpoint(getEndpointsConfigurer().getResourceServerTokenServices());
    endpoint.setAccessTokenConverter(getEndpointsConfigurer().getAccessTokenConverter());
    endpoint.setExceptionTranslator(exceptionTranslator());
    return endpoint;
  }

  /**
   * 配置授权确认页面，可以自定义覆盖
   */
  @Bean
  public WhitelabelApprovalEndpoint whitelabelApprovalEndpoint() {
    return new WhitelabelApprovalEndpoint();
  }

  /**
   * 配置授权错误页面，可以自定义覆盖
   */
  @Bean
  public WhitelabelErrorEndpoint whitelabelErrorEndpoint() {
    return new WhitelabelErrorEndpoint();
  }
  // ...

}
```

`Spring OAuth2` 为这些端点配置了 `@FrameworkEndpoint` 注解，通过此注解，端点的 `URL` 即其映射方法会被 `Spring MVC` 读取到，使得各个端点可以像其它 `REST` 接口一样提供服务。

#### 授权服务器安全配置

`AuthorizationServerSecurityConfiguration` 继承了 `WebSecurityConfigurerAdapter`，`Spring Security` 允许在容器中配置多个 `WebSecurityConfigurerAdapter` 实例，不同实例分别构造成为 `SecurityFilterChain`，多个过滤器链交由 `FilterChainProxy` 进行代理，当接受到请求后，`Proxy` 会根据请求路径匹配相应的过滤器链：

```java
  private List<Filter> getFilters(HttpServletRequest request) {
    // 根据请求路径匹配过滤器链
    for (SecurityFilterChain chain : filterChains) {
      if (chain.matches(request)) {
        return chain.getFilters();
      }
    }
    return null;
  }
```

来看看 `AuthorizationServerSecurityConfiguration` 的实现：

```java
@Configuration
// 优先级高
@Order(0)
@Import({ ClientDetailsServiceConfiguration.class, AuthorizationServerEndpointsConfiguration.class })
public class AuthorizationServerSecurityConfiguration extends WebSecurityConfigurerAdapter {

  /**
   * 自定义授权服务器配置
   */
  @Autowired
  private List<AuthorizationServerConfigurer> configurers = Collections.emptyList();

  /**
   * 第三方客户端认证配置
   */
  @Autowired
  private ClientDetailsService clientDetailsService;

  /**
   * 授权端点配置
   */
  @Autowired
  private AuthorizationServerEndpointsConfiguration endpoints;

  @Autowired
  public void configure(ClientDetailsServiceConfigurer clientDetails) throws Exception {
    for (AuthorizationServerConfigurer configurer : configurers) {
      // 干预第三方客户端认证配置
      configurer.configure(clientDetails);
    }
  }

  @Override
  protected void configure(AuthenticationManagerBuilder auth) throws Exception {
    // Over-riding to make sure this.disableLocalConfigureAuthenticationBldr = false
    // 默认使用 UserDetailsService 的实现类生成认证过滤器，而本套过滤器链是面向第三方应用认证而不是用户认证，所以不需要初始化 AuthenticationManager
  }

  /**
   * 过滤器配置
   */
  @Override
  protected void configure(HttpSecurity http) throws Exception {
    // 授权服务器安全配置扩展
    AuthorizationServerSecurityConfigurer configurer = new AuthorizationServerSecurityConfigurer();
    // 自定义授权确认、授权失败页面路径映射
    FrameworkEndpointHandlerMapping handlerMapping = endpoints.oauth2EndpointHandlerMapping();
    http.setSharedObject(FrameworkEndpointHandlerMapping.class, handlerMapping);
    // 加载自定义授权服务器安全配置扩展
    configure(configurer);
    http.apply(configurer);

    String tokenEndpointPath = handlerMapping.getServletPath("/oauth/token");
    String tokenKeyPath = handlerMapping.getServletPath("/oauth/token_key");
    String checkTokenPath = handlerMapping.getServletPath("/oauth/check_token");
    if (!endpoints.getEndpointsConfigurer().isUserDetailsServiceOverride()) {
      // 从自定义配置和容器中取得配置的 AuthenticationManager，用于刷新 token
      UserDetailsService userDetailsService = http.getSharedObject(UserDetailsService.class);
      endpoints.getEndpointsConfigurer().userDetailsService(userDetailsService);
    }

    http
      .authorizeRequests()
      // 访问 /oauth/token 接口需要完全认证
      .antMatchers(tokenEndpointPath).fullyAuthenticated()
      // 配置访问 /oauth/token_key 和 /oauth/check_token 接口的权限
      .antMatchers(tokenKeyPath).access(configurer.getTokenKeyAccess())
      .antMatchers(checkTokenPath).access(configurer.getCheckTokenAccess())
      .and()
      .requestMatchers()
      .antMatchers(tokenEndpointPath, tokenKeyPath, checkTokenPath)
      .and()
      .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.NEVER);
    http.setSharedObject(ClientDetailsService.class, clientDetailsService);
  }

  protected void configure(AuthorizationServerSecurityConfigurer oauthServer) throws Exception {
    for (AuthorizationServerConfigurer configurer : configurers) {
      // 应用自定义授权服务器安全配置扩展
      configurer.configure(oauthServer);
    }
  }
}
```

### 授权服务器配置扩展

#### 默认扩展

在授权端点配置和授权服务器安全配置中，都注入了 `AuthorizationServerConfigurer` 接口的实现，`spring-security-oauth2-autoconfigure` 对此接口中的 3 个 `configure` 方法的实现如下：

```java
  /**
    * 第三方应用认证配置
    */
  @Override
  public void configure(ClientDetailsServiceConfigurer clients) throws Exception {
    // 根据配置初始化第三方认证信息，放入内存
    ClientDetailsServiceBuilder<InMemoryClientDetailsServiceBuilder>.ClientBuilder builder = clients
      .inMemory().withClient(this.details.getClientId());
    builder.secret(this.details.getClientSecret())
    // ...

    // 配置 token 有效时间，默认12小时
    if (this.details.getAccessTokenValiditySeconds() != null) {
      builder.accessTokenValiditySeconds(
        this.details.getAccessTokenValiditySeconds());
    }
    // 配置刷新令牌有效时间，默认30天
    if (this.details.getRefreshTokenValiditySeconds() != null) {
      builder.refreshTokenValiditySeconds(
        this.details.getRefreshTokenValiditySeconds());
    }
    // 配置运行跳转的 URL
    if (this.details.getRegisteredRedirectUri() != null) {
      builder.redirectUris(
        this.details.getRegisteredRedirectUri().toArray(new String[0]));
    }
  }

  /**
    * 授权端点自定义配置
    */
  @Override
  public void configure(AuthorizationServerEndpointsConfigurer endpoints)
    throws Exception {
    if (this.tokenConverter != null) {
      // 配置 /oauth/check_token 接口验证验证成功返回 token 信息逻辑
      endpoints.accessTokenConverter(this.tokenConverter);
    }
    if (this.tokenStore != null) {
      // 配置 token 存储策略，默认在内存中
      endpoints.tokenStore(this.tokenStore);
    }
    if (this.details.getAuthorizedGrantTypes().contains("password")) {
      // 配置用户认证管理器，用于密码模式中对用户身份进行认证
      endpoints.authenticationManager(this.authenticationManager);
    }
  }

  /**
    * 配置授权安全策略
    */
  @Override
  public void configure(AuthorizationServerSecurityConfigurer security)
    throws Exception {
    security.passwordEncoder(NoOpPasswordEncoder.getInstance());
    if (this.properties.getCheckTokenAccess() != null) {
      // 配置 /oauth/check_token 接口访问权限
      security.checkTokenAccess(this.properties.getCheckTokenAccess());
    }
    if (this.properties.getTokenKeyAccess() != null) {
      // 配置 /oauth/token_key 接口访问权限
      security.tokenKeyAccess(this.properties.getTokenKeyAccess());
    }
    if (this.properties.getRealm() != null) {
      // 配置 realm 名称，默认为 realm
      security.realm(this.properties.getRealm());
    }
  }
```

## OAuth2 授权

### 授权码授权

#### 获取授权码

`Spring OAuth2` 装配了 `AuthorizationEndpoint` 用于实现授权码模式中的 `/authroize` 接口。在启动项目分析这个接口的实现之前，我们需要增加一个默认的 `WebSecurityConfigurerAdapter` 实现：

```java
@Configuration
@EnableAuthorizationServer
public class OAuth2SecurityConfig extends WebSecurityConfigurerAdapter {
}
```

在第一章的分析中，我们说到如果 `Spring` 容器中有 `WebSecurityConfigurerAdapter` 的实例，那么默认的实例将不会被装配。引入 `OAuth2` 相关依赖后，自动配置的 `AuthorizationServerSecurityConfiguration` 就是一个 `WebSecurityConfigurerAdapter` 实例，而其中并没有对 `/authorize` 接口做保护（匹配不到过滤器链，会直接访问），而此接口中需要用户的认证信息，所以我们需要另外添加 `WebSecurityConfigurerAdapter` 实现，用于配置 `/authorize` 接口需要认证后才能访问。

添加此配置后启动应用，在浏览器中访问：

```
http://localhost:8080/oauth/authorize?response_type=code&client_id=wch&state=xyz&scope=all&redirect_uri=http://localhost:8080
```

传参为 `OAuth2` 标准获取授权码的标准参数：

- `response_type` ：传固定值 `code` 表示使用授权码模式申请授权。
- `client_id`：第三方应用认证账号。
- `state`：用于保持请求和回调的状态，会照原样回传此参数。
- `scope`：申请 `scope` 权限。
- `redirect_uri`：授权回调地址。

来看看 `GET /authorize` 接口：

```java
  @RequestMapping(value = "/oauth/authorize")
  public ModelAndView authorize(Map<String, Object> model, @RequestParam Map<String, String> parameters, SessionStatus sessionStatus, Principal principal) {
    // 提取请求参数，生成 AuthorizationRequest
    AuthorizationRequest authorizationRequest = getOAuth2RequestFactory().createAuthorizationRequest(parameters);
    // 授权类型
    Set<String> responseTypes = authorizationRequest.getResponseTypes();
    // ...

    try {
      // 验证用户是否已认证
      if (!(principal instanceof Authentication) || !((Authentication) principal).isAuthenticated()) {
        throw new InsufficientAuthenticationException("User must be authenticated with Spring Security before authorization can be completed.");
      }
      // 查询第三方应用信息
      ClientDetails client = getClientDetailsService().loadClientByClientId(authorizationRequest.getClientId());
      // ...
      // 配置回调地址
      authorizationRequest.setRedirectUri(resolvedRedirect);
      // 验证参数中的 scope 是否有效
      oauth2RequestValidator.validateScope(authorizationRequest, client);
      // 验证请求授权的 scope 是否默认确认授权。userApprovalHandler 可配置，默认为所有请求的 scope 自动确认授权方可直接授权
      authorizationRequest = userApprovalHandler.checkForPreApproval(authorizationRequest, (Authentication) principal);
      // ...

      if (authorizationRequest.isApproved()) {
        // 如果默认确认授权
        if (responseTypes.contains("token")) {
          // 隐式授权模式直接返回访问令牌
          return getImplicitGrantResponse(authorizationRequest);
        }
        if (responseTypes.contains("code")) {
          // 授权码模式直接返回授权码
          return new ModelAndView(getAuthorizationCodeResponse(authorizationRequest, (Authentication) principal));
        }
      }

      // 如果没有自动授权，跳转到 /oauth/confirm_access 进行确认授权
      model.put("authorizationRequest", authorizationRequest);
      return getUserApprovalPageResponse(model, authorizationRequest, (Authentication) principal);

    }
    // ...

  }
```

如果没用配置自动确认， `GET /authorize` 接口并不会直接返回授权码，而是会跳转到 `/oauth/confirm_access` 页面进行二次授权确认。端点配置中配置了 `WhitelabelApprovalEndpoint` 用于生成默认的二次确认页面，此页面中有一个表单，将用户的确认结果发往 `POST /oauth/authorize` 接口，在此接口中的验证逻辑中，如果用户进行了确认授权，则会在跳转地址中携带授权码。

#### 换取访问令牌

拥有授权码即可访问 `OAuth2` 标准中获取访问令牌的接口 `POST /token`：

```
http://localhost:8080/oauth/token?grant_type=authorization_code&code=E2voni&scope=all&redirect_uri=http://localhost:8080
```

传参为 `OAuth2` 标准获取访问令牌的标准参数：

- `grant_type`：为固定值 `authorization_code`。
- `code`：获取的授权码。
- `scope`：申请的 `scope` 。
- `redirect_uri` ：需传入获取授权码使用的跳转路径用于验证。

`AuthorizationServerSecurityConfiguration` 在配置过滤器时指定 `/oauth/token` 需要进行 `fullyAuthenticated` 认证后才能访问，但是用于认证的并不是注入到 `Spring` 容器中的 `UserDetailsService` 实现，而是上文提到的配置懒加载的 `ClientDetailsService` ，`AuthorizationServerSecurityConfigurer#init` 配置如下：

```java
  @Override
  public void init(HttpSecurity http) throws Exception {
    // ...

    if (passwordEncoder != null) {
      // 有密码的配置
      // ...
    else {
      // 无密码的配置
      // 配置认证服务为第三方认证服务
      http.userDetailsService(new ClientDetailsUserDetailsService(clientDetailsService()));
    }
    // 配置不对 SecurityContext 进行存储和读取
    http.securityContext().securityContextRepository(new NullSecurityContextRepository()).and().csrf().disable()
      // 配置 http basic 认证
      .httpBasic().realmName(realm);
    // ...
  }
```

因此，访问 `/token` 请求还需要加上用于第三方认证的 `header`：

```htm
Authorization: Basic d2NoOndjaA==
```

`Basic` 后的编码为配置的 `clien_id:client_secret` 的 `Base64` 编码。

`DefaultTokenServices#createAccessToken` 方法为生成访问令牌的逻辑，其传入参数为不同授权方式生成的 `OAuth2Authentication` 认证对象。授权码模式获是根据授权码获取存储在 `authorizationCodeStore` 中的认证对象的。随后在 `DefaultTokenServices#createAccessToken` 方法中创建真正的访问令牌，并以 `Json` 的形式返回：

```json
{
  "access_token": "9d77b23b-b397-4e73-bf01-291ef474862f",
  "token_type": "bearer",
  "refresh_token": "c38cea17-28c8-43af-ab11-fcacc90c6ef7",
  "expires_in": 43199,
  "scope": "all"
}
```

### 隐式授权

隐式授权相对于授权码模式省略了使用授权码换取访问令牌的过程，直接通过浏览器访问 `/authroize` 即可获得访问令牌：

```
http://localhost:8080/oauth/authorize?response_type=token&client_id=wch&state=xyz&scope=all&redirect_uri=http://localhost:8080
```

传参为 `OAuth2` 标准获取访问令牌的标准参数：

- `response_type`：为固定值 `token`。
- `client_id`：第三方应用认证账号。
- `state`：用于保持请求和回调的状态，会照原样回传此参数。
- `scope`：申请 `scope` 权限。
- `redirect_uri` ：需传入获取授权码使用的跳转路径用于验证。

在用户认证成功后，路径参数中会包含访问令牌：

```
http://localhost:8080/#access_token=9d77b23b-b397-4e73-bf01-291ef474862f&token_type=bearer&state=xyz&expires_in=40375
```

### 密码授权

密码授权要求将资源所有者的认证信息提交给 `/token` 接口，访问令牌在认证成功后以 `Json` 的形式颁发给第三方客户端，请求参数如下：

```
POST http://localhost:8080/oauth/token?grant_type=password&username=user&password=123&scope=all
```

密码模式同样需要加上第三方应用认证信息的 `header`。

传参为 `OAuth2` 标准获取访问令牌的标准参数：

- `grant_type`：为固定值 `password`。
- `username`：资源所有者认证账号。
- `password`：资源所有者认证密码。
- `scope`：申请 `scope` 权限。

密码授权模式获取 `OAuth2` 认证信息的逻辑在 `ResourceOwnerPasswordTokenGranter#getOAuth2Authentication` 方法中：

```java
  // 从请求参数中读取账户密码
  String username = parameters.get("username");
  String password = parameters.get("password");
  // ...

  Authentication userAuth = new UsernamePasswordAuthenticationToken(username, password);
  // ...
  try {
    // 对用户信息进行认证
    userAuth = authenticationManager.authenticate(userAuth);
  }
  // ...
```

可以看到用于认证用户信息的是一个 `AuthenticationManager` 实例。在第一章中曾说道，`Spring Security` 会配置 `AuthenticationConfiguration` 到 `Spring` 容器中，此配置会加载 `UserDetailsService` ，并最终组装成为 `AuthenticationManager`。而 `OAuth2AuthorizationServerConfiguration` 在构造函数中将 `AuthenticationConfiguration` 注入，并将生成的认证管理器加载到授权端点配置中。在配置默认的 `tokenGranter` 时，传入认证管理器。比较特殊的是之前介绍的认证过程都是在过滤器链中完成的，而密码模式则在生成访问令牌的过程中对用户身份进行认证。

```java
  private List<TokenGranter> getDefaultTokenGranters() {
    // ...

    if (authenticationManager != null) {
      // 传入用户认证管理器，密码模式有了校验用户身份的能力
      tokenGranters.add(new ResourceOwnerPasswordTokenGranter(authenticationManager, tokenServices, clientDetails, requestFactory));
    }
    return tokenGranters;
  }
```

### 第三方应用凭证授权

第三方应用凭证授权仅需要验证第三方应用自身的信息，访问 `/token` 接口的参数如下：

```
POST http://localhost:8080/oauth/token?grant_type=client_credentials&scope=all
```

传参为 `OAuth2` 标准获取访问令牌的标准参数：

- `grant_type`：为固定值 `client_credentials`。
- `scope`：申请 `scope` 权限。

第三方应用凭证授权同样需要加上第三方应用认证信息的 `header`。此种授权方式是无法区分不同用户权限的。

### 刷新令牌

出于安全方面的考虑，用于获取资源的访问令牌设置的失效时间比较短，在授权服务器颁发访问令牌的同时，还会携带一个 `refresh_token`。当用户使用过期的访问令牌访问资源服务器，会收到一个 `401` 响应，随后第三方应用可以携带被颁发的刷新令牌重新向授权服务器申请访问令牌，其流程如下：

```
+--------+                                           +---------------+
|        |--(A)------- Authorization Grant --------->|               |
|        |                                           |               |
|        |<-(B)----------- Access Token -------------|               |
|        |               & Refresh Token             |               |
|        |                                           |               |
|        |                            +----------+   |               |
|        |--(C)---- Access Token ---->|          |   |               |
|        |                            |          |   |               |
|        |<-(D)- Protected Resource --| Resource |   | Authorization |
| Client |                            |  Server  |   |     Server    |
|        |--(E)---- Access Token ---->|          |   |               |
|        |                            |          |   |               |
|        |<-(F)- Invalid Token Error -|          |   |               |
|        |                            +----------+   |               |
|        |                                           |               |
|        |--(G)----------- Refresh Token ----------->|               |
|        |                                           |               |
|        |<-(H)----------- Access Token -------------|               |
+--------+           & Optional Refresh Token        +---------------+
```

上图所示流程包含以下步骤：

- （A）第三方应用向授权服务器出示授权许可。
- （B）授权服务器验证第三方应用身份和授权许可，颁发访问令牌和刷新令牌。
- （C）第三方应用持有访问令牌向资源服务器请求受保护资源。
- （D）资源服务器验证访问令牌并返回受保护资源。
- （E）第三方应用重复（C）请求，直到访问令牌过期。
- （F）由于访问令牌已经过期，资源服务器返回无效令牌错误。
- （G）第三方应用向授权服务器出示刷新令牌。
- （H）授权服务器验证用户身份后颁发一个新的访问令牌。

在 `Spring Security` 的实现中，`TokenStore` 中维护了 `refresh_token` 与用户认证信息的映射，当授权服务器收到类型为 `refresh_token` 的授权请求时，会取出对应的用户认证信息，重新使用用户认证管理器进行认证。如果认证成功则会颁发新的访问令牌和刷新令牌。如果刷新令牌也是过期的，同样会刷新失败，`DefaultTokenServices#refreshAccessToken` 方法对刷新令牌的实现逻辑如下：

```java
  @Transactional(noRollbackFor={InvalidTokenException.class, InvalidGrantException.class})
  public OAuth2AccessToken refreshAccessToken(String refreshTokenValue, TokenRequest tokenRequest) throws AuthenticationException {
    // ...

    // 查询存储的 refresh_token
    OAuth2RefreshToken refreshToken = tokenStore.readRefreshToken(refreshTokenValue);
    // ..
    // 获取刷新令牌对应的用户认证信息
    OAuth2Authentication authentication = tokenStore.readAuthenticationForRefreshToken(refreshToken);
    if (this.authenticationManager != null && !authentication.isClientOnly()) {
      // 进行用户认证
      Authentication user = new PreAuthenticatedAuthenticationToken(authentication.getUserAuthentication(), "", authentication.getAuthorities());
      user = authenticationManager.authenticate(user);
      Object details = authentication.getDetails();
      authentication = new OAuth2Authentication(authentication.getOAuth2Request(), user);
      authentication.setDetails(details);
    }
    // ...

    if (isExpired(refreshToken)) {
      // 如果刷新令牌过期，授权失败
      tokenStore.removeRefreshToken(refreshToken);
      throw new InvalidTokenException("Invalid refresh token (expired): " + refreshToken);
    }
    // 重新创建用户认证信息
    authentication = createRefreshedAuthentication(authentication, tokenRequest);

    if (!reuseRefreshToken) {
      // 是否重用 refresh_token
      tokenStore.removeRefreshToken(refreshToken);
      refreshToken = createRefreshToken(authentication);
    }

    // 重新创建访问令牌
    OAuth2AccessToken accessToken = createAccessToken(authentication, refreshToken);
    tokenStore.storeAccessToken(accessToken, authentication);
    if (!reuseRefreshToken) {
      tokenStore.storeRefreshToken(accessToken.getRefreshToken(), authentication);
    }
    return accessToken;
  }
```

对用户重新认证的逻辑需要传入用户认证管理器 `authenticationManager`，通过自定义授权端点时，通过 `AuthorizationServerEndpointsConfiguration#userDetailsService` 方法配置用户认证服务。

刷新令牌访问 `/token` 接口的参数如下：

```
POST http://localhost:8080/oauth/token?grant_type=refresh_token&refresh_token=95ba5fd8-1b9e-4142-81fa-b41cdc27a769&scope=all
```

传参为 `OAuth2` 标准获取访问令牌的标准参数：

- `grant_type`：为固定值 `refresh_token`。
- `refresh_token`：刷新令牌值。
- `refresh_token`：申请的 `scope` 权限。

## 访问资源服务器

启动资源服务器需要配置 `@EnableResourceServer` 注解，此注解引入了 `ResourceServerConfiguration`，这是一个 `WebSecurityConfigurerAdapter` 实例，其重载了配置过滤器的配置方法：

```java
  protected void configure(HttpSecurity http) throws Exception {
    // 资源服务器保护配置
    ResourceServerSecurityConfigurer resources = new ResourceServerSecurityConfigurer();
    ResourceServerTokenServices services = resolveTokenServices();
    if (services != null) {
      resources.tokenServices(services);
    } else {
      if (tokenStore != null) {
        resources.tokenStore(tokenStore);
      } else if (endpoints != null) {
        // Spring 容器中有授权端点实例，说明资源服务器和授权服务器在同一实例中，则使用相同的 TokenStore
        resources.tokenStore(endpoints.getEndpointsConfigurer().getTokenStore());
      }
    }
    if (eventPublisher != null) {
      resources.eventPublisher(eventPublisher);
    }
    for (ResourceServerConfigurer configurer : configurers) {
      // 自定义资源保护配置
      configurer.configure(resources);
    }
    http.authenticationProvider(new AnonymousAuthenticationProvider("default"))
      .exceptionHandling()
      .accessDeniedHandler(resources.getAccessDeniedHandler()).and()
      .sessionManagement()
      .sessionCreationPolicy(SessionCreationPolicy.STATELESS).and()
      .csrf().disable();
    http.apply(resources);
    if (endpoints != null) {
      // 授权端点中的路径排除在外，不受资源服务器保护
      http.requestMatcher(new NotOAuthRequestMatcher(endpoints.oauth2EndpointHandlerMapping()));
    }
    for (ResourceServerConfigurer configurer : configurers) {
      // 自定义过滤器配置
      configurer.configure(http);
    }
    if (configurers.isEmpty()) {
      // 默认在没有自定义配置的情况下访问所有路径都需要权限
      http.authorizeRequests().anyRequest().authenticated();
    }
  }
```

此配置中引人了 `ResourceServerSecurityConfigurer` 用于配置 `OAuth2` 资源服务器认证过滤器 `OAuth2AuthenticationProcessingFilter`，其过滤逻辑如下：

```java
  public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
    // ...

    try {
      // 读取 Authorization 头，取出 Bearer 的值，即访问令牌
      Authentication authentication = tokenExtractor.extract(request);
      if (authentication == null) {
        // ...
      } else {
        // ...

        // 认证逻辑为验证 TokenStore 中的访问令牌
        Authentication authResult = authenticationManager.authenticate(authentication);
        // ...

        // 认证信息存入 SecurityContext
        SecurityContextHolder.getContext().setAuthentication(authResult);

      }
    }

    // ...

    chain.doFilter(request, response);
  }
```

通过实现 `ResourceServerConfigurer` 接口并注入 `Spring` 容器，可以实现对资源服务器保护服务的干预。 `OAuth2AutoConfiguration` 中引入了 `OAuth2ResourceServerConfiguration` 配置，是对 `ResourceServerConfigurer` 的默认实现，其配置了所有请求都需要经过认证。

## 小结

- `OAuth2` 是一个通用的 `web` 安全标准，`Spring Security` 对 `OAuth2` 有一系列开箱即用的实现。
- `OAuth2` 标准提供了 4 种授权（颁发访问令牌）和 1 种刷新令牌的方式。
- 资源服务器通过解析 `Authorization` 头获取访问令牌，对访问令牌进行验证判断是否运行访问受保护资源。
