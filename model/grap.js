"use strict";
let sup = require('superagent'),
    post = require('./post'),
    cheerio = require('cheerio'),
    eventproxy = require('eventproxy'), //并发监听请求
    Q = require('Q'),
    async = require('async'),
    parseDate = require('./util/getDate'),
    // operate = require('./util/arrayOper'), //数组的交并补差运算
    escaper = require("true-html-escape"); //解码工具库
let url = {
        course: 'http://www.chuanke.com/course/index.html', //主页路由
        index: 'http://www.chuanke.com/'
    }
    /*
     * @function: 获取对应需要的目录内容，并返回处理后的html_String 
     */
const interval = 1000;
const LIMIT = 1;
let GrapCateg = {
    url: url.course,
    flag: 0, //获取插入记录的数量
    childrenFlag: 0, //children的flags标记
    //获取第一级目录内容
    sendReq(url) { //发送指定路由，并返回解析后的网页$;
        var deferred = Q.defer();
        sup.get(url)
            .end((err, res) => {
                if (err) {
                    console.log("the url doesn't work");
                    return;
                }
                let $ = cheerio.load(res.text);
                console.log($('.ck-page').length);
                deferred.resolve($);
            })
        return deferred.promise;
    },
    sleep(millis) { //睡眠函数
        var deferredResult = Q.defer();
        setTimeout(function() {
            deferredResult.resolve();
        }, millis);
        return deferredResult.promise;
    },
    //得到一级目录
    getFirsetCate() {
        let items;
        this.sendReq(url.course)
            .then(($) => {
                items = $('.g-sort li a'); //找到所有的lis
                //删除第一个li"全部"的内容;
                items.eq(0).remove();
                this.flag = items.length;
                //遍历其他目录
                this.insertCate(items); //插入数据
            })
    },
    // 查询子层目录
    getOthersCate() {
        let children = [], //先置空
            ep = new eventproxy();
        post.getTitles()
            .then((docs) => {
                if (!docs) {
                    console.log("不存在子层目录");
                    return;
                }
                for (var item of docs) { //获得所有的children的titles和href
                    for (var data of item.children) {
                        children.push(data);
                    }
                }
                this.flag = children.length;
                //发送请求
                async.mapLimit(children, 1, (url, callback) => {
                        let href = url.href;
                        sup.get(href)
                            .end((err, res) => {
                                if (err) {
                                    console.log("the url doesn't work");
                                    return;
                                }
                                let $ = cheerio.load(res.text),
                                    items = $('.g-sort li a'); //找到所有的lis

                                if (items.html()) { //如果为最后一层的话
                                    //删除第一个li"全部"的内容;
                                    items.eq(0).remove();
                                    this.flag = items.length;
                                    //遍历其他目录
                                    this.insertCate(items); //插入数据
                                }
                                setTimeout(function() {
                                    callback(null, null);
                                }, interval);
                            })

                    },
                    function(err, result) {

                    });

                //发送html内容

            })
    },
    fillHrefs(data, target, rate) {
        data.push({
            title: escaper.unescape(target.html().trim()), //titles
            href: target.attr('href'), //链接
            rate: rate
        });
    },
    //获取所有的hrefs和titile, 并且分类，如果为1,2级目录的话,则应该还有children
    // 如果为第三级目录则忽略
    grapAllHrefs() {
        this.sendReq(url.index)
            .then(($) => {
                var all = $('.mn_mc .categ_m');
                //找到一级目录
                let allHrefs = [];
                var first = all.find('h3'),
                    second = all.find('dl');
                for (var i = 0; i < first.length; i++) {
                    let nowNode = first.eq(i).find('a'),
                        child = first.eq(i).nextUntil('h3'),
                        data = {
                            href: nowNode.attr('href'),
                            title: escaper.unescape(nowNode.html().trim()),
                            rate: 1
                        },
                        children = [];
                    for (var j = 0; j < child.length; j++) {
                        var flag = child.eq(j).find('dt a');
                        children.push({
                                href: flag.attr('href'),
                                title: escaper.unescape(flag.html().trim())
                            }) //放入数据
                    }
                    data.children = children;
                    allHrefs.push(data);
                }
                console.log(allHrefs.length);
                //找到第二季目录，并添加rate
                for (var i = 0; i < second.length; i++) {
                    let nowNode = second.eq(i).find('dt a'),
                        child = second.eq(i).find('dd a'),
                        data = {
                            href: nowNode.attr('href'),
                            title: escaper.unescape(nowNode.html().trim()),
                            rate: 2
                        },
                        children = [];
                    for (var j = 0; j < child.length; j++) {
                        var flag = child.eq(j);
                        children.push({
                                href: flag.attr('href'),
                                title: escaper.unescape(flag.html().trim())
                            }) //放入数据
                    }
                    data.children = children;
                    allHrefs.push(data);
                }
                console.log(allHrefs.length);
                //遍历第三级目录
                let third = all.find('dd a');
                for (var i = 0; i < third.length; i++) {
                    this.fillHrefs(allHrefs, third.eq(i), 3);
                }
                post.saveHref(allHrefs)
                    .then(() => {
                        console.log("ok");
                    })
            })
    },
    //获取连接数,并添加num(课程数量)和date,rate. 获取1,2级目录数量，添加子节点
    //获取1,2级目录,添加num,date
    getAll() {
        post.getAllHrefs()
            .then((docs) => {
                async.mapLimit(docs, 1, (url, callback) => {
                        let href = url.href;
                        let cate = new Object(),
                            item,
                            date = this.dealDate(new Date());
                        //设置相应的参数,有@title:分类名，@date:日期，@href:连接，@rate:目录层级
                        cate.title = url.title;
                        cate.date = date;
                        cate.href = href;
                        cate.rate = url.rate;
                        this.findChildren(cate)
                            .then((children) => {
                                cate.children = url.children;
                            })
                            .then(() => {
                                console.log(cate.num);
                                post.save(cate)
                                    .then((flag) => {
                                        if (flag) {
                                            console.log("插入成功~");
                                        } else {
                                            console.log("更新成功~");
                                        }
                                        setTimeout(function() {
                                            callback(null, null);
                                        }, interval);
                                    })
                            })
                    },
                    function(err, result) {});
            })
    },
    //获取第三级目录的内容
    getThirdRate() {
        post.getRate3Href()
            .then((docs) => { //docs是包含所有数据的数组, rate,href,title
                // 获取第三级目录
                docs = docs.slice(50);
                let amount = 50;
                async.mapLimit(docs, LIMIT, (item, callback) => { //遍历3级目录的url地址
                        console.log(++amount);
                        let url = item.href,
                            title = item.title;
                        this.sendReq(url)
                            .then(($) => {
                                let page = $(".ck-page"), //获取分页栏目
                                    urls = [],
                                    cate = {};
                                cate.title = title,
                                    cate.href = url,
                                    cate.rate = 3,
                                    cate.date = this.dealDate(new Date()), //获取日期
                                    cate.children = []; //子类课程目录
                                if (page.html()) { //如果存在分页,则遍历搜索
                                    let maxPage = page.find('.next').prev('a').html(); //获取分页的最大值
                                    for (var i = 1; i <= maxPage; i++) {
                                        urls.push(`${url.replace(".html",'_2.html')}?page=${i}`);
                                    }
                                    //异步发送请求,获取分页内容
                                    async.mapLimit(urls, 2, (url, cb) => {
                                        this.sendReq(url)
                                            .then(($) => {
                                                this.fillChildren($, cate.children);
                                                setTimeout(function() {
                                                    cb(null, null);
                                                }, interval);
                                            })

                                    }, (err, result) => {
                                        post.save(cate)
                                            .then((flag) => {
                                                if (flag) {
                                                    console.log("3级目录插入成功");
                                                } else {

                                                    console.log("3级目录更新成功");
                                                }

                                            })
                                        setTimeout(function() {
                                            callback(null, null);
                                        }, interval);
                                    });

                                } else { //不存在遍历则直接搜索
                                    this.fillChildren($, cate.children);
                                    post.save(cate)
                                        .then((flag) => {
                                            if (flag) {
                                                console.log("3级目录插入成功");
                                            } else {
                                                console.log("3级目录更新成功");
                                            }
                                            setTimeout(function() {
                                                callback(null, null);
                                            }, interval);
                                        })
                                }

                            })
                    },
                    function(err, result) {

                    });
            })
    },
    //处理第三级目录上的children,添加
    //totalPrice: 课程总价值
    //freeCourses: 免费课程{num:数量,href:[] //链接数}
    //VipCourses: 收费课程{num:数量,href:[] //链接数}
    //student: 总的报名人数
    dealThirdRateDate() {
        post.backRate3()
            .then((docs) => {
                var i = 0,
                    array = [];
                for (var item of docs) {
                    item.totalPrice = 0;
                    item.freeCourses = {
                        num: 0,
                        href: []
                    };
                    item.VipCourses = {
                        num: 0,
                        href: []
                    };
                    item.students = 0;
                    for (var child of item.children) {
                        item.totalPrice += child.totalPrice;
                        item.students += Number(child.students);
                        if (child.price == 0) {
                            item.freeCourses.num++;
                            item.freeCourses.href.push(child.href);
                        } else {
                            item.VipCourses.num++;
                            item.VipCourses.href.push(child.href);
                        }
                    }
                    array.push(item);
                }
                async.mapLimit(array, 1, (val, callback) => {
                        post.save(val)
                            .then(() => {
                                setTimeout(function() {
                                    callback(null, null);
                                }, 100);
                            })
                    },
                    function(err, result) {
                        console.log('ok');
                    })
            })

    },
    //计算出今天 免费课程，收费课程，以及所有课程的上架数，下架数
    /*
     * 添加字段 @freeCourses.increase： 上架数, @freeCourses.decrease:下架书,
     *          @Vipcourses.increase： 上架数, @Vipcourses.decrease:下架书
     *          @increase: 总的上架数=上面两者之和, @decrease: 等于上面两者之和
     */
    calcuThirdRate() {
        let date = this.dealDate(new Date()),
            yester = parseDate.getDate(-1), //获取昨天的日期
            data = {
                yest: [],
                today: []
            };
        post.getSpecialRate3(date, 3) //获取今天第三级目录的数据
            .then((docs) => {
                data.today = docs;
                post.getSpecialRate3(yester, 3)
                    .then((docs) => { //获取昨天的数据
                        data.yester = docs;
                        this.calcuDate(data);
                    })
            })
    },
    //处理昨天和今天第三级目录的数据
    /*
     * @data: {today:今天的数据(Array),yester:昨天的数据(Array)}
     */
    calcuDate(data) {
        let today = data.today,
            lastDay = data.yester,
            Data = [];
        //获取都存在的数据
        for (var i of today) { //遍历today的数据
            for (var j of lastDay) {
                if (i.href == j.href) {
                    this.getAmount(i, j, Data);
                }
            }
        }
        //最后存入数据
        async.mapLimit(Data, 1, (val, callback) => {
                post.save(val)
                    .then(() => {
                        setTimeout(function() {
                            callback(null, null);
                        }, 100);
                    })
            },
            function(err, result) {
                console.log('ok');
            })
    },
    dealCate1() {
        let date = this.dealDate(new Date());

        post.getSpecialRate2(date, 1)
            .then((docs) => {
                async.mapLimit(docs, 1, (i, callback) => {

                        let hrefs = [];
                        i.freeCourses = 0,
                            i.VipCourses = 0,
                            i.students = 0,
                            i.freeIncrease = 0,
                            i.freeDecrease = 0,
                            i.VipIncrease = 0,
                             i.VipDecrease = 0,
                            i.increase = 0,
                            i.decrease = 0;
                        console.log(i.children);
                        for (var j of i.children) {

                            hrefs.push(j.href);
                        }

                        
                        post.getCate2Content(date, hrefs)
                            .then((docs) => {
                                console.log(docs);
                                if (!docs) {
                                    setTimeout(function() {
                                        callback(null, null);
                                    }, 100);
                                }

                                for (var item of docs) {
                                    i.freeCourses += item.freeCourses;
                                    i.VipCourses += item.VipCourses;
                                    i.students += item.students;
                                    i.freeIncrease += item.freeIncrease;
                                    i.freeDecrease += item.freeDecrease;
                                    i.VipIncrease += item.VipIncrease;
                                    i.VipDecrease += item.VipDecrease;
                                    i.increase += item.increase;
                                    i.decrease += item.decrease;
                                }
                                i.num = i.freeCourses + i.VipCourses;

                                post.save(i)
                                    .then(() => {
                                        setTimeout(function() {
                                            callback(null, null);
                                        }, 100);
                                    })

                            })
                    },
                    function(err, result) {
                        console.log('ok');
                    })

            })
    },
    //处理二级目录的数据,添加vipCourses,students等数据
    dealCate2() {
        let date = this.dealDate(new Date());
        post.getSpecialRate2(date, 2)
            .then((docs) => {
                async.mapLimit(docs, 1, (i, callback) => {
                        let hrefs = [];
                        i.freeCourses = 0,
                            i.VipCourses = 0,
                            i.students = 0,
                            i.freeIncrease = 0,
                            i.freeDecrease = 0,
                            i.VipIncrease = 0,
                            i.VipDecrease = 0,
                            i.increase = 0,
                            i.decrease = 0;
                        for (var j of i.children) {
                            hrefs.push(j.href);
                        }
                        post.getCate3Content(date, hrefs)
                            .then((docs) => {
                                for (var item of docs) {
                                    i.freeCourses += item.freeCourses.num;
                                    i.VipCourses += item.VipCourses.num;
                                    i.students += item.students;
                                    i.freeIncrease += item.freeIncrease;
                                    i.freeDecrease += item.freeDecrease;
                                    i.VipIncrease += item.VipIncrease;
                                    i.VipDecrease += item.VipDecrease;
                                    i.increase += item.increase;
                                    i.decrease += item.decrease;
                                }
                                i.num = i.freeCourses + i.VipCourses;
                                post.save(i)
                                    .then(() => {
                                        setTimeout(function() {
                                            callback(null, null);
                                        }, 100);
                                    })

                            })
                    },
                    function(err, result) {
                        console.log('ok');
                    })

            })
    },
    getAmount(today, yester, data) {
        let todayFree = today.freeCourses.href,
            todayVip = today.VipCourses.href,
            lastDayFree = yester.freeCourses.href,
            lastDayVip = yester.VipCourses.href;
        let free = Array.intersect(todayFree, lastDayFree), //交集
            Vip = Array.intersect(lastDayVip, todayVip);

        // _overFree = Array.minus(lastDayFree,free),  //昨天与今天的免费课程差集
        // _overVip = Array.minus(lastDayVip,Vip),  //昨天与今天的VIP课程差集
        // VipToFree = Array.intersect(Vip,_overFree), //免费专收费的集合
        // FreeToVip = Array.intersect(free,_overVip);  //收费转免费的集合
        let freeIncrease = todayFree.length - free.length,
            freeDecrease = lastDayFree.length - free.length,
            VipIncrease = todayVip.length - Vip.length,
            VipDecrease = lastDayVip.length - Vip.length,
            increase = freeIncrease + VipIncrease,
            decrease = VipDecrease + freeDecrease;
        if (VipDecrease < 0) console(VipDecrease);
        // console.log("ok");
        data.push({
            href: today.href,
            date: today.date,
            freeIncrease: freeIncrease,
            freeDecrease: freeDecrease,
            VipIncrease: VipIncrease,
            VipDecrease: VipDecrease,
            increase: increase,
            decrease: decrease
        });


    },
    //获取3th级目录下的href,price,students和totalPrice
    //参数为: @param:$:网页的解析值, @param: children,cate里面的子目录
    fillChildren($, children) {
        let all = $(".ck-product-list .clearfix li");
        all.each((i, ele) => {
            let child = {
                href: $(ele).find('.item-title a').attr('href'),
                price: this.fillTitle($(ele).find('.hot-price')),
                students: $(ele).find('.number em').html().trim(),
            };
            child.totalPrice = child.price * child.students;
            children.push(child); //添加孩纸~
        })
        console.log(all.length);
    },
    //递归插入数据
    // @items: 是页面上含有g-sort的分类标题, type: a标签
    insertCate(items) {
        /*
         * 每个文档的数据应该为
         * @title: 分类名,String
         * @date: 日期 ,String
         * @children: 是否有子类目录, Array
         * @count: 该课程的总价, Number
         * @num: 一共有多少课程, String;
         */
        let cate = new Object(),
            item,
            date = this.dealDate(new Date());
        if (GrapCateg.flag !== 1) {
            GrapCateg.flag--;
            item = items.eq(GrapCateg.flag);
            cate.num = item.find('em').html();
            cate.title = GrapCateg.fillTitle(item);
            cate.date = date;
            cate.count = 0;
            cate.href = item.attr('href');
            //再次往下搜索一层href,并且添加到children里面
            GrapCateg.findChildren(cate)
                .then((children) => {
                    //将绑定子节点,以数组的方式放入，如果子节点里面含有其他的话需要加上上一级
                    // 的title. ex: 外语其他,金融其他等等
                    if (children) {
                        cate.children = children;
                    }
                    return;
                })
                .then((data) => { //获得chldren的节点后，插入数据
                    post.save(cate)
                        .then((flag) => {
                            if (flag) {
                                this.sleep(interval).then(() => { //睡眠1s
                                    console.log("插入成功~");
                                    GrapCateg.insertCate(items);
                                })

                            } else {
                                this.sleep(interval).then(() => {
                                    console.log("更新成功~");
                                    GrapCateg.insertCate(items);
                                })
                            }
                        })
                    return;
                })
        } else {
            //插入完成
            return;
        }
    },
    // 查找子节点有哪些~
    findChildren(cate) {
        var deferred = Q.defer(),
            children = [],
            items;
        this.sendReq(cate.href)
            .then(($) => {
                cate.num = $('.search-crumb .keyword').find('em').html(); //获取所有的数量              
                deferred.resolve("ok");
            })
        return deferred.promise;
    },
    //处理元素节点,并返回文本节点
    fillTitle(item) {
        item.find('em').remove();
        return escaper.unescape(item.html().trim());
    },
    dealDate(date) {
        return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
    },
    init() {
        /*
         * 爬数据顺序（1. this.grapAllHrefs() )-> 2. this.getAll()->3. this.getThirdRate()->4. this.dealThirdRateDate()->5. this.calcuThirdRate()
         * -> this.dealCate2() -> this.dealCate1();
         */
        // this.getAll(); //遍历目录重新查询 
        // this.grapAllHrefs();  //分类获取所有的链接,一共有3级目录
        this.getThirdRate(); //获得第三级目录
        // this.dealThirdRateDate();  //处理三级目录的数据
        // this.calcuThirdRate(); //给今天的第三级目录加上,上架课程，下架课程数
        // this.dealCate2();  //处理二级目录
        // this.dealCate1(); //处理一级目录数据
    }
}


//绑定数组的差并补集；
Array.prototype.each = function(fn) {
    fn = fn || Function.K;
    var a = [];
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < this.length; i++) {
        var res = fn.apply(this, [this[i], i].concat(args));
        if (res != null) a.push(res);
    }
    return a;
};
//数组是否包含指定元素
Array.prototype.contains = function(suArr) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == suArr) {
                return true;
            }
        }
        return false;
    }
    //不重复元素构成的数组
Array.prototype.uniquelize = function() {
    var ra = new Array();
    for (var i = 0; i < this.length; i++) {
        if (!ra.contains(this[i])) {
            ra.push(this[i]);
        }
    }

    return ra;
};
//两个数组的补集 
Array.complement = function(a, b) {
    return Array.minus(Array.union(a, b), Array.intersect(a, b));
};
//两个数组的交集  
Array.intersect = function(a, b) {
    return a.uniquelize().each(function(o) {
        return b.contains(o) ? o : null
    });
};
//两个数组的差集
Array.minus = function(a, b) {
    return a.uniquelize().each(function(o) {
        return b.contains(o) ? null : o
    });
};
//两个数组并集
Array.union = function(a, b) {
    return a.concat(b).uniquelize();
};
GrapCateg.init();
