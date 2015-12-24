"use strict";
var express = require('express'),
	router = express.Router(),
    fs = require('fs'),
    utils = require('utility'),
    send = require('../model/send'),
    post = require('../model/post');

module.exports = function(app) {
    app.route('/')
        .get((req,res)=>{
            res.render('index');
        })
     app.route('/getType')
        .get((req, res)=>{
        	// 获得order之后，向指定路由发送请求
        	'use strict';
            let order = Number(req.query.order);  //接受像/getType?order=1 这样的路由
            res.setHeader("Content-Type","text/plain");
            send.getContent(order)  //将res传入，并发送获取到的首页数据
                .then((data)=>{
                    res.send(data);
                    res.end();
                })
        });
    app.route('/getDetail')
        .post((req,res)=>{
            //获取，两个请求数据日期,请求类型
            let start = req.body.start,
                end = req.body.end,
                type = req.body.type,
                startNum,endNum;
            //获取两次日期对应课程类型的课程数量
            post.getNum(start,type)
            .then((docs)=>{
                console.log(docs);
                if(!docs){
                startNum = 0;    
                }else{
                startNum = docs[0].num;
                 }
                post.getNum(end,type)
                .then((docs)=>{
                    endNum = docs[0].num;
                    res.json({
                        startNum,endNum
                    });
                })
            })
        })
}
