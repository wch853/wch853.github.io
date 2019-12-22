module.exports = {
  base: '/',
  title: 'wch的个人主页',
  description: '用于分享wch的学习笔记和项目~',
  head: [
    ['link', {
      rel: 'icon',
      href: '/favicon.ico'
    }]
  ],
  dest: 'dist',
  markdown: {
    lineNumbers: false,
    anchor: {
      permalink: true,
      permalinkBefore: true,
      permalinkSymbol: '#'
    }
  },
  themeConfig: {
    displayAllHeaders: false,
    activeHeaderLinks: true,
    nav: [{
      text: '主页',
      link: '/'
    }, {
      text: '博客',
      link: '/posts/'
    }, {
      text: '项目',
      link: '/project/'
    }, {
      text: '简书',
      link: 'https://www.jianshu.com/u/778216ebe79c'
    }, {
      text: 'GitHub',
      link: 'https://github.com/wch853'
    }],
    accentColor: '#2c3e50',
    sidebar: {
      '/posts/': [{
          title: 'Java虚拟机',
          collapsable: true,
          children: [
            ['jvm/深入理解Java虚拟机（一）：自动内存管理机制', '深入理解Java虚拟机（一）：自动内存管理机制']
          ]
        },
        {
          title: 'Java并发编程',
          collapsable: true,
          children: [
            ['concurrent/并发编程（一）：并行计算概念', '并发编程（一）：并行计算概念'],
            ['concurrent/并发编程（二）：JDK支持', '并发编程（二）：JDK支持'],
            ['concurrent/并发编程（三）：锁的优化', '并发编程（三）：锁的优化'],
            ['concurrent/并发编程（四）：并行模式与策略', '并发编程（四）：并行模式与策略']
          ]
        },
        {
          title: 'MyBatis 源码分析',
          collapsable: true,
          children: [
            ['mybatis/MyBatis源码分析（一）：MyBatis简介和整体架构', 'MyBatis 源码分析（一）：MyBatis 简介和整体架构'],
            ['mybatis/MyBatis源码分析（二）：反射模块', 'MyBatis 源码分析（二）：反射模块'],
            ['mybatis/MyBatis源码分析（三）：基础支持模块', 'MyBatis 源码分析（三）：基础支持模块'],
            ['mybatis/MyBatis源码分析（四）：运行时配置解析', 'MyBatis 源码分析（四）：运行时配置解析'],
            ['mybatis/MyBatis源码分析（五）：Mapper通用配置解析', 'MyBatis 源码分析（五）：Mapper 通用配置解析'],
            ['mybatis/MyBatis源码分析（六）：statement解析', 'MyBatis 源码分析（六）：statement 解析'],
            ['mybatis/MyBatis源码分析（七）：接口层', 'MyBatis 源码分析（七）：接口层'],
            ['mybatis/MyBatis源码分析（八）：执行器', 'MyBatis 源码分析（八）：执行器'],
            ['mybatis/MyBatis源码分析（九）：集成Spring', 'MyBatis 源码分析（九）：集成 Spring']
          ]
        },
        {
          title: 'Spring Security 源码分析',
          collapsable: true,
          children: [
            ['security/SpringSecurity源码分析（一）：过滤器链', 'Spring Security 源码分析（一）：过滤器链'],
            ['security/SpringSecurity源码分析（二）：表单登录', 'Spring Security 源码分析（二）：表单登录'],
            ['security/SpringSecurity源码分析（三）：授权管理', 'Spring Security 源码分析（三）：授权管理'],
            ['security/SpringSecurity源码分析（四）：OAth2实现', 'Spring Security 源码分析（四）：OAth2实现'],
            ['security/SpringSecurity源码分析（五）：JWT实现', 'Spring Security 源码分析（五）：JWT实现']
          ]
        },
        // {
        //     title: '大数据',
        //     collapsable: true,
        //     children: [
        //         ['大数据入门', '大数据入门']
        //     ]
        // },
        {
          title: '微服务',
          collapsable: true,
          children: [
            ['microservice/微服务实践（一）：Docker入门', '微服务实践（一）：Docker入门'],
            ['microservice/微服务实践（二）：微服务与容器化', '微服务实践（二）：微服务与容器化']
          ]
        },
        {
          title: '微信小程序',
          collapsable: true,
          children: [
            ['mp/使用云开发构建多媒体小程序', '使用云开发构建多媒体小程序']
          ]
        },
        {
          title: 'Elasticsearch',
          collapsable: true,
          children: [
            ['elasticsearch/Elasticsearch（一）：概念与基本API', 'Elasticsearch（一）：概念与基本API'],
            ['elasticsearch/Elasticsearch（二）：SearchAPI', 'Elasticsearch（二）：SearchAPI'],
            ['elasticsearch/Elasticsearch（三）：集群特性', 'Elasticsearch（三）：集群特性'],
            ['elasticsearch/Elasticsearch（四）：Search运行机制', 'Elasticsearch（四）：Search运行机制'],
            ['elasticsearch/Elasticsearch（五）：聚合分析', 'Elasticsearch（五）：聚合分析']
          ]
        }
      ],
      '/project/': [{
        title: 'dmall商城',
        collapsable: true,
        children: [
          ['基于SpringBoot全家桶搭建项目后端工程', '基于SpringBoot全家桶搭建项目后端工程']
        ]
      }]
    }
  }
}