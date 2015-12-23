"use strict";
var express = require('express'),
	router = express.Router(),
    fs = require('fs'),
    utils = require('utility'),
    send = require('../model/send');

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
    app.route('/startGrap')
        .get((req,res)=>{
            send.GrapCateg.init();  //启动抓取程序
        });
}
