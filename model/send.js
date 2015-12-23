"use strict";
let sup = require('superagent'),
    cheerio = require('cheerio'),
    Q = require('Q');
let url = {
        course: 'http://www.chuanke.com/course/index.html' //主页路由
    }
    /*
     * @function: 获取对应需要的目录内容，并返回处理后的html_String
     * @param: order;  获取第几个内容的目录
     */
function changeSrc(ele) {
    ele.attr('data-src', ele.attr('href'));
    ele.attr('href', "javascript:void(0)");
}

function getContent(order, res) {
    let html = "",
        deferred = Q.defer();
    sup.get(url.course)
        .end((err, sres) => {
            if (err) {
                html = "the url doesn't work";
                return;
            }
            let $ = cheerio.load(sres.text);
            html = $('.mn_mc .item').eq(order - 1) //找到.mn_mc下第n个item
                .find('.categ_m');
            changeSrc(html.find("a"));
            deferred.resolve(html.html()); //获取该item下的.categ_m的html内容;
        });
    return deferred.promise;
}
let GrapCateg = {
    url: url.course,
    //获取第一级目录内容
    getFirsetCate() {
        let items,
            item,
            cate = new Object();
            date = this.dealDate(new Date());
        sup.get(url.course)
            .end((err, sres) => {
                if (err) {
                    html = "the url doesn't work";
                    return;
                }
                let $ = cheerio.load(sres.text);
                items = $('.g-sort li a'); //找到所有的lis
                //删除第一个li"全部"的内容;
                items.eq(0).remove();
                //遍历其他目录
                /*
                * 每个文档的数据应该为
                * @title: 分类名,String
                * @date: 日期 ,String
                * @children: 是否有子类目录, Array
                * @count: 该课程的总价, Number
                * @num: 一共有多少课程, String;
                */
                for (var i = 0; i < items.length; i++) {
                    item = items.eq(i);
                    cate.num = item.find('em').html();
                    cate.title = encodeURIComponent(GrapCateg.fillTitle(item));
                    cate.date = date;
                    cate.children = [];
                    cate.count = 0;

                }
            });
    },
    //处理元素节点,并返回文本节点
    fillTitle(item){
    	item.find('em').remove();
    	return item.html();
    },
    dealDate(date){
    	return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
    },
    init(){
    	this.getFirsetCate();
    }
}

module.exports = {
    getContent,
    GrapCateg
}
