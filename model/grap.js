"use strict";
let sup = require('superagent'),
    post = require('./post'),
    cheerio = require('cheerio'),
    Q = require('Q'),
    escaper = require("true-html-escape"); //解码工具库
let url = {
        course: 'http://www.chuanke.com/course/index.html' //主页路由
    }
    /*
     * @function: 获取对应需要的目录内容，并返回处理后的html_String 
     */

let GrapCateg = {
    url: url.course,
    flag: 0, //获取插入记录的数量
    //获取第一级目录内容
    sendReq(url) { //发送指定路由，并返回解析后的网页$;
        var deferred = Q.defer();
        sup.get(url)
            .end((err, res) => {
                if (err) {
                    html = "the url doesn't work";
                    return;
                }
                let $ = cheerio.load(res.text);
                deferred.resolve($);
            })
        return deferred.promise;
    },
    //得到一级目录
    getFirsetCate() {
        let items;
        this.sendReq(url.course)
            .then(($) => {
                items = $('.g-sort li a'); //找到所有的lis
                //删除第一个li"全部"的内容;
                items.eq(0).remove();
                GrapCateg.flag = items.length;
                //遍历其他目录
                GrapCateg.insertCate(items); //插入数据
            })
    },
    // 查询子层目录
    getOthersCate() {
        post.getTitles()
            .then((docs) => {
                if (!docs) {
                    console.log("不存在子层目录");
                    return;
                }
                for (var item of docs) { //获得所有的children的titles和href
                    for (var data of item.children) {
                        let items;
                        GrapCateg.sendReq(data.href)
                            .then(($) => {
                                if ($('.g-sort').length === 0) {  //如果没有子类的话，则开始查找该类下的课程信息
                                    return;
                                }
                                 items = $('.g-sort li a'); //找到所有的lis
                                //删除第一个li"全部"的内容;
                                items.eq(0).remove();
                                GrapCateg.flag = items.length;
                                //遍历其他目录
                                GrapCateg.insertCate(items); //插入数据
                            })
                    }
                }
            })
    },
    //递归插入数据
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
                    if(children){
                        cate.children = children;
                    }
                    return;
                })
                .then((data) => { //获得chldren的节点后，插入数据
                    post.save(cate)
                        .then((flag) => {
                            if (flag) {
                                GrapCateg.insertCate(items);
                                console.log("插入成功~");
                            } else {
                                GrapCateg.insertCate(items);
                                console.log("更新成功~");
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
                if ($('.g-sort').length === 0) {  //如果不存在children
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
        this.getOthersCate();
    }
}
GrapCateg.init();
