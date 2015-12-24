"use strict";
let sup = require('superagent'),
    post = require('./post'),
    cheerio = require('cheerio'),
    eventproxy = require('eventproxy'), //并发监听请求
    Q = require('Q'),
    async = require('async'),
    escaper = require("true-html-escape"); //解码工具库
let url = {
        course: 'http://www.chuanke.com/course/index.html', //主页路由
        index:'http://www.chuanke.com/'
    }
    /*
     * @function: 获取对应需要的目录内容，并返回处理后的html_String 
     */
const interval = 1000;
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
    grapAllHrefs(){
        this.sendReq(url.index)
            .then(($)=>{
                var all =$(".mn_mc .categ_m a"),  //获取所有的atitle类型
                    data = [];

                for(var i = 0;i<all.length;i++){
                    let target = all.eq(i);
                    data.push({
                        title:escaper.unescape(target.html().trim()),  //titles
                        href:target.attr('href')  //链接
                    })
                }
                console.log(data);
                post.saveHref(data)
                    .then(()=>{
                        console.log("ok");
                    })
                
            })
    },
    //获取连接数
    getAll() {
        post.getAllHrefs()
            .then((docs) => {
                async.mapLimit(docs, 1, (url, callback) => {
                        let href = url.href;
                        let cate = new Object(),
                            item,
                            date = this.dealDate(new Date());
                        cate.title = url.title;
                        cate.date = date,
                            cate.href = href;
                        this.findChildren(cate)
                            .then((children) => {
                                if (children) {
                                    cate.children = children;
                                }
                                return;
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
        console.log(cate.href);
        this.sendReq(cate.href)
            .then(($) => {
                cate.num = $('.search-crumb .keyword').find('em').html();
                if ($('.g-sort').length === 0) { //如果不存在children,则直接返回
                    deferred.resolve(false);
                    return;
                }
               
                items = $('.g-sort li a'); //找到所有的lis
                //删除第一个li"全部"的内容;
                for (var i = 1; i < items.length; i++) {
                    var title = GrapCateg.fillTitle(items.eq(i)); //获取内容的titles
                    if (title == "其他") {
                        title = `${cate.title}其他`;
                    }
                    children.push({
                        title: title,
                        href: items.eq(i).attr('href')
                    });
                }
                deferred.resolve(children);
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
        // this.getFirsetCate();  //获取第一级目录
        // this.getOthersCate(); //获取其他层目录, 刷过第一遍后，(或者说,刷过很多遍后，才能用下面的刷)
        this.getAll();  //遍历目录重新查询
        // this.grapAllHrefs();  //获取所有的连接，并且放入到hrefs collection中
    }
}
GrapCateg.init();
