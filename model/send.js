"use strict";
let sup = require('superagent'),
    post = require('./post'),
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
module.exports = {
    getContent
}
