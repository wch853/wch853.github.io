---
sidebarDepth: 2
date: 2019-03-23
desc: 默认的token实现依赖于后端存储，使用更为轻量级的安全验证方式——JWT替换token实现。
tags: SpringSecurity 源码分析 OAuth2
---

# Spring Security 源码分析（五）：JWT 实现

## JWT

`JWT(Json Web Token)` 是一个开放[标准](https://tools.ietf.org/html/rfc7519)，它定义了一种紧凑和自包含的方式，用于在各方之间作为 `JSON` 对象安全地传输信息。

- 紧凑：`token` 值是一个很小的 `Base64` 编码的字符串，可以通过 `http` 请求参数或者 `header` 传递。
- 自包含：`token` 可以包含很多信息，包括用户名、权限、过期时间等，支持开发者自定义。

通常一个 `JWT` 字符串的[解析结果](https://jwt.io)如下：

![JWT编码解码](/img/security/JWT编码解码.png)

`JWT` 串由 3 部分组成：

- `header`：头部，用于标识 `token` 为 `JWT` 类型和使用的签名算法。
- `payload`：有效数据，`JWT` 自包含的信息。

- `signature`：对头部和有效信息的签名。

因此 `JWT` 能够安全地传输安全信息。

## 使用 JWT 替换默认 token 实现

`Spring Security` 提供了诸多的 `TokenStore` 实现，如存在内存中的 `InMemoryTokenStore` 、存在数据库中的 `JdbcTokenStore`、存在 `Redis` 中的 `RedisTokenStore`，这些都是通过将生成的 `token` 存储下来，当第三方应用请求受保护资源部时，会去 `TokenStore` 查询是否有相应的令牌。仅将令牌存储在内存中不支持分布式环境；存储在数据库或 `Redis` 中，每次请求都去查询又会增加后端的负担；一旦服务器宕机，势必又要影响用户访问。而 `JWT` 对于令牌的实现由于自包含的特性，能有效解决上述问题。

### JwtTokenStore

无论是 4 种授权方式的哪一种，在授权认证完成后，都是通过在 `AbstractTokenGranter` 中调用 `AuthorizationServerTokenServices#createAccessToken` 方法颁发令牌的，`JWT` 由于其自包含的特性，是不会存储在后端应用中的，因此每次都需要申请授权都会直接创建新的令牌。普通令牌中只有 `scope`、`refresh_token` 等基本信息，`JWT` 如何实现其自包含特性呢？在创建令牌时，`DefaultTokenServices#createAccessToken` 方法使用了 `TokenEnhancer` 向 `JWT` 中添加附加信息：

```java
	private OAuth2AccessToken createAccessToken(OAuth2Authentication authentication, OAuth2RefreshToken refreshToken) {
		// ...
		return accessTokenEnhancer != null ? accessTokenEnhancer.enhance(token, authentication) : token;
	}
```

因此需要配置 `JwtAccessTokenConverter` 来增强 `JWT` 的构成。

### JwtAccessTokenConverter

在授权端点配置 `AuthorizationServerEndpointsConfigurer` 中，我们可以配置 `JwtAccessTokenConverter` ：

```java
  public AuthorizationServerEndpointsConfigurer accessTokenConverter(AccessTokenConverter accessTokenConverter) {
    // 配置 JwtAccessTokenConverter
    this.accessTokenConverter = accessTokenConverter;
    return this;
  }
  private TokenEnhancer tokenEnhancer() {
  	if (this.tokenEnhancer == null && accessTokenConverter() instanceof JwtAccessTokenConverter) {
      // JwtAccessTokenConverter 也实现了 TokenEnhancer 接口
  		tokenEnhancer = (TokenEnhancer) accessTokenConverter;
  	}
  	return this.tokenEnhancer;
  }

  private TokenStore tokenStore() {
    if (tokenStore == null) {
      if (accessTokenConverter() instanceof JwtAccessTokenConverter) {
        // 如果配置了 JwtAccessTokenConverter，那么配置 JwtTokenStore
        this.tokenStore = new JwtTokenStore((JwtAccessTokenConverter) accessTokenConverter());
      } else {
      	this.tokenStore = new InMemoryTokenStore();
    	}
    }
  	return this.tokenStore;
  }
```

一旦设置了 `JwtAccessTokenConverter` 就可以默认配置 `tokenEnhancer`，并将 `tokenStore` 设置为 `JwtTokenStore`。`JwtAccessTokenConverter#enhance` 方法中对于增加 `JWT` 附加信息的逻辑如下：

```java
  public OAuth2AccessToken enhance(OAuth2AccessToken accessToken, OAuth2Authentication authentication) {
    DefaultOAuth2AccessToken result = new DefaultOAuth2AccessToken(accessToken);
    Map<String, Object> info = new LinkedHashMap<String, Object>(accessToken.getAdditionalInformation());
    String tokenId = result.getValue();
    if (!info.containsKey(TOKEN_ID)) {
      // 增加 jti，即授权服务器生成的原始访问令牌字符串
      info.put(TOKEN_ID, tokenId);
    } else {
      tokenId = (String) info.get(TOKEN_ID);
    }
    result.setAdditionalInformation(info);
    // 按照 JWT 生成算法拼装 JWT
    result.setValue(encode(result, authentication));
    OAuth2RefreshToken refreshToken = result.getRefreshToken();
    if (refreshToken != null) {
      // 拼接刷新令牌的 JWT
      // ...
    }
    return result;
  }
```

在对 `payload` 部分编码时调用了 `DefaultAccessTokenConverter#convertAccessToken` 方法：

```java
  public Map<String, ?> convertAccessToken(OAuth2AccessToken token, OAuth2Authentication authentication) {
    // ...
		// 增加用户名及其权限信息
    if (!authentication.isClientOnly()) {
      response.putAll(userTokenConverter.convertUserAuthentication(authentication.getUserAuthentication()));
    } else {
      if (clientToken.getAuthorities()!=null && !clientToken.getAuthorities().isEmpty()) {
        response.put(UserAuthenticationConverter.AUTHORITIES,
                     AuthorityUtils.authorityListToSet(clientToken.getAuthorities()));
      }
    }
		// 增加 scope 信息
    if (token.getScope()!=null) {
      response.put(scopeAttribute, token.getScope());
    }
    // 增加原始访问令牌
    if (token.getAdditionalInformation().containsKey(JTI)) {
      response.put(JTI, token.getAdditionalInformation().get(JTI));
    }
		// 增加令牌过期时间
    if (token.getExpiration() != null) {
      response.put(EXP, token.getExpiration().getTime() / 1000);
    }
    // 增加授权类型
    if (includeGrantType && authentication.getOAuth2Request().getGrantType()!=null) {
      response.put(GRANT_TYPE, authentication.getOAuth2Request().getGrantType());
    }
		// 增加其他附加信息
    response.putAll(token.getAdditionalInformation());
		// ...
    return response;
  }
```

`JWT` 的加密、解密是通过 `Spring Security` 提供的工具 `JwtHelper` 实现的，开发者可以自定义秘钥。

## TokenKeyEndpoint

关于 `JWT`，`Spring Security` 还留有一个彩蛋：在配置授权端点时，引入了 `TokenKeyEndpointRegistrar` 配置，当 `Spring` 容器中有 `JwtAccessTokenConverter` 实例时会注册 `TokenKeyEndpoint`，此配置提供了 `/oauth/token_key` 接口用于查询生成 `JWT` 签名的算法以及用于验证的密钥。

`/oauth/token_key` 接口默认拒绝任何访问请求，通过授权服务器安全配置扩展设置接口的访问权限：

```java
@Override
public void configure(AuthorizationServerSecurityConfigurer security) throws Exception {
  security.tokenKeyAccess("authenticated");
}
```

## 小结

- `JWT` 是一种紧凑和自包含的 `token` 实现方式，其有效数据包含了用户的认证信息，并通过加密签名来保证安全性。
- `JWT` 可以存储在客户端，由于其无状态特性，天然支持分布式。由于自包含有效数据，避免了每次访问资源服务器都需要查询后端数据。
- 在 `Spring Security` 中通过配置 `JwtAccessTokenConverter` 来使用 `JWT`。开发者可以干预 `JWT` 中的附加信息和加密方式等。
