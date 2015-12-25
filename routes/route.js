"use strict";
var express = require('express'),
    router = express.Router(),
    fs = require('fs'),
    utils = require('utility'),
    date = require('../model/util/getDate'),
    send = require('../model/send'),
    post = require('../model/post');

module.exports = function(app) {
    app.route('/')
        .get((req, res) => {
            res.render('index');
        })
    app.route('/getType')
        .get((req, res) => {
            // 获得order之后，向指定路由发送请求
            'use strict';
            let order = Number(req.query.order); //接受像/getType?order=1 这样的路由
            res.setHeader("Content-Type", "text/plain");
            send.getContent(order) //将res传入，并发送获取到的首页数据
                .then((data) => {
                    res.send(data);
                    res.end();
                })
        });
    app.route('/getDetail')
        .post((req, res) => {
            //获取，两个请求数据日期,请求类型
            let start = req.body.start,
                href = req.body.href,
                end = date.getDate(-1); //获取昨天的日期
            //获取两次日期对应课程类型的课程数量
            post.getNum(start, href)
                .then((docs) => {
                    
                    if (docs[0].rate === 3) {
                        docs[0].freeCourses = docs[0].freeCourses.num;
                        docs[0].VipCourses = docs[0].VipCourses.num;
                    }
                    docs[0].num =  docs[0].freeCourses+docs[0].VipCourses;
                    res.json(docs[0]);
                    // res.json({
                    //       num, increase, decrease,freeCourses, freeIncrease, freeDecrease, VipCourses, VipIncrease, VipDecrease, students
                    // })
                    // post.getNum(end, type) //获取昨天的数据
                    //     .then((docs) => {

                    //     })
                })
        })
}
