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
                    title: 'Java',
                    collapsable: true,
                    children: [
                        ['深入理解Java虚拟机', '深入理解Java虚拟机']
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