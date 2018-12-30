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
            text: 'LeetCode',
            link: 'https://leetcode-cn.com/wch853/'
        }, {
            text: 'GitHub',
            link: 'https://github.com/wch853'
        }],
        accentColor: '#2c3e50',
        sidebar: {
            '/posts/': [{
                    title: 'Java',
                    collapsable: true,
                    children: [
                        ['并发编程（一）：并行计算概念', '并发编程（一）：并行计算概念'],
                        ['并发编程（二）：JDK支持', '并发编程（二）：JDK支持'],
                        ['并发编程（三）：锁的优化', '并发编程（三）：锁的优化'],
                        ['并发编程（四）：并行模式与策略', '并发编程（四）：并行模式与策略'],
                        ['深入理解Java虚拟机（一）：自动内存管理机制', '深入理解Java虚拟机（一）：自动内存管理机制']
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
                        ['微服务实践（一）：Docker入门', '微服务实践（一）：Docker入门'],
                        ['微服务实践（二）：微服务与容器化', '微服务实践（二）：微服务与容器化']
                    ]
                },
                {
                    title: '微信小程序',
                    collapsable: true,
                    children: [
                        ['使用云开发构建多媒体小程序', '使用云开发构建多媒体小程序']
                    ]
                }
            ]
        }
    }
}