<template>
    <div class="article-list">
        <div class="article" :key="page.key" v-for="page in articlesByPage">
            <router-link :to="page.path">
                <div>
                    <a class="article-title">
                        {{wrapTitle(page.title)}}
                    </a>
                    <div class="article-date">
                        {{wrapDate(page.frontmatter.date)}}
                    </div>
                    <div class="article-desc">
                        {{wrapDesc(page.frontmatter.desc)}}
                        <hr>
                    </div>
                </div>
            </router-link>
            <div>
                <div class="article-tag" :key="tag" v-for="tag in splitTags(page.frontmatter.tags)">
                    {{tag}}
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        pages: {
            type: Array
        }
    },
    data () {
        return {
            // 所有文章
            allArticles: [],
            // 分页文章 TODO
            articlesByPage: []
        }
    },
    mounted () {
        let allArticles = this.pages.filter(e => {
            return e.path.startsWith('/posts/') && e.path !== '/posts/'
        })
        if (undefined != allArticles && 0 !== allArticles.length) {
            allArticles.sort((page1, page2) => {
                return this.getTimeStamp(page2.frontmatter.date) - this.getTimeStamp(page1.frontmatter.date)
            })
        }
        this.allArticles = allArticles
        this.articlesByPage = allArticles
    },
    methods: {
        /**
         * 获取时间戳
         */
        getTimeStamp: date => {
            let stamp
            try {
                stamp = Date.parse(new Date(date))
            } catch (err) {
                // 无效时间，以当前时间戳代替
                stamp = new Date().getTime()
            }
            return stamp
        },
        /**
         * 包装日期
         */
        wrapDate: date => {
            let time
            try {
                time = new Date(date)
            } catch(err) {
                time = new Date()
            }
            let month = time.getMonth() + 1
            if (month < 10) {
                month = '0' + month
            }
            let day = time.getDate()
            if (day < 10) {
                day = '0' + day
            }
            return time.getFullYear() + '-' + month + '-' + day
        },
        /**
         * 包装文章标题
         */
        wrapTitle: title => {
            if (undefined === title) {
                title = '标题开小差了~'
            }
            return title
        },
        /**
         * 包装文章描述
         */
        wrapDesc: desc => {
            if (undefined == desc) {
                desc = '文章摘要开小差了~'
            }
            return desc
        },
        /**
         * 构建tags
         */
        splitTags: tags => {
            let tagArray = []
            if (undefined !== tags) {
                tagArray = tags.split(" ")
            }
            return tagArray
        }
    }
}
</script>

<style scoped>
.article {
  padding: 2rem 1.5rem 1.5rem;
  margin-bottom: 1rem;
  border: 0.1px solid #e6ecf0;
  box-shadow: 2px 2px 3px #e6ecf0;
}

.article-date {
    color: #2c3e50 !important;
    font-size: 0.9rem;
    margin: 0.5rem;
}

.article-title {
  font-size: 1.4rem;
  font-weight: 500;
  position: relative;
}

a,
a:link,
a:visited,
a:focus {
  text-decoration: none !important;
}

.article-title::after {
  content: "";
  display: block;
  width: 100%;
  height: 1.8px;
  position: absolute;
  bottom: -3px;
  background: #3eaf7c;
  transition: all 0.3s ease-in-out;
  transform: scale3d(0, 1, 1);
  transform-origin: 50% 0;
}

.article-title:hover::after {
  transform: scale3d(1, 1, 1);
}

.article-desc {
  padding: 1rem 0 0.5rem;
  color: #2c3e50;
}

.article-tag {
  display: inline-block;
  width: auto;
  font-size: 0.9rem;
  padding: 0.2rem 0.3rem;
  border: 0.08rem solid #e6ecf0;
  color: #2c3e50;
  margin: 0 0.25rem;
  color: #0c57a7;
}
</style>
