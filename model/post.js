var mongodb = require('./database'),
    async = require('async'),
    Q = require('Q');

function dealDate(date) {
    return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
}

function Post() {

}

/*
 * 用来存放分类目录
 * @param cate 分类目录
 * 
 * 每个文档的数据应该为
 * @title: 分类名,String
 * @date: 日期 ,String
 * @children: 是否有子类目录, Array
 * @count: 该课程的总价, Number
 * @num: 一共有多少课程, String;
 */


Post.save = function(cate) {
    var defer = Q.defer(),
        date = dealDate(new Date());
    async.waterfall([
        function(cb) { //打开数据库
            mongodb.open(function(err, db) {
                cb(err, db);
            });
        },
        function(db, cb) { //打开col
            db.collection('cate', function(err, col) {
                cb(err, col)
            });
        },
        function(col, cb) { //处理doc
            col.find({
                    title: cate.title,
                    date: date
                })
                .toArray(function(err, docs) {
                    console.log(docs.length);
                    if (docs.length === 0) {
                        //不存在则插入数据
                        col.insert(cate, function(err) {
                            //检查插入是否成功
                            cb(err, true);
                            defer.resolve(true);
                        })
                    } else {
                        //已经存在,更新数据
                        col.update({
                                title: cate.title,
                                date: cate.date
                            }, {
                                $set: cate
                            })
                            .then((result) => {
                                cb(null, true);
                                defer.resolve(false);
                            })
                    }
                })

        },
    ], function(err, mark) {
        mongodb.close();
    });
    return defer.promise;
};
Post.getTitles = function() { //获取titles数量
        var defer = Q.defer(),
            date = dealDate(new Date());
        async.waterfall([
            function(cb) { //打开数据库
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            function(db, cb) { //打开col
                db.collection('cate', function(err, col) {
                    cb(err, col)
                });
            },
            function(col, cb) { //处理doc

                col.find({
                        children: {
                            "$exists": true
                        },
                        date: date
                    })
                    .toArray(function(err, docs) {
                        console.log(docs.length);
                        if (docs.length === 0) {
                            //不存在返回null
                            cb(err, true);
                            defer.resolve(false);
                        } else {
                            //已经存在,返回children数组
                            cb(null, true);
                            defer.resolve(docs);
                        }
                    })

            },
        ], function(err, mark) {
            mongodb.close();
        });
        return defer.promise;
    }
    //获取所有的连接数,并且放入到另外一个库内，作为备份;
Post.getAllHrefs = function() { //获取昨天的连接数
        var defer = Q.defer(),
            date = dealDate(new Date());
        async.waterfall([
                function(cb) { //打开数据库
                    mongodb.open(function(err, db) {
                        cb(err, db);
                    });
                },
                function(db, cb) { //打开col
                    db.collection('hrefs', function(err, col) {
                        cb(err, col)
                    });
                },
                function(col, cb) { //处理doc
                    col.find()
                        .toArray(function(err, docs) {
                            cb(null, null);
                            defer.resolve(docs);
                        })
                },
            ],
            function(err, mark) {
                mongodb.close();
            });
        return defer.promise;
    }
//获取昨天的所有数据，并调用getAllHrefs，放入到另外一个collection内
Post.getYesterDay = function() { //获取昨天的连接数
        var defer = Q.defer(),
            date = dealDate(new Date());
        async.waterfall([
                function(cb) { //打开数据库
                    mongodb.open(function(err, db) {
                        cb(err, db);
                    });
                },
                function(db, cb) { //打开col
                    db.collection('cate', function(err, col) {
                        cb(err, col)
                    });
                },
                function(col, cb) { //处理doc
                    col.find({
                            date: "2015-12-23"
                        })
                        .toArray(function(err, docs) {
                            Post.saveHref(docs)
                                .then(() => {
                                    cb(null, null);
                                    defer.resolve(true);
                                })
                        })
                },
            ],
            function(err, mark) {
                mongodb.close();
            });
        return defer.promise;
    }
//将获取到的连接放到另外一个表内
Post.saveHref = function(docs) {
    var defer = Q.defer(),
        date = dealDate(new Date());
    async.waterfall([
        function(cb) { //打开数据库
            mongodb.open(function(err, db) {
                cb(err, db);
            });
        },
        function(db, cb) { //打开col
            db.collection('hrefs', function(err, col) {
                cb(err, col)
            });
        },
        function(col, cb) { //处理doc
            for (var i of docs) {
                col.insert({
                    title: i.title,
                    href: i.href
                }, function(err) {
                    cb(null, true);
                    defer.resolve(true);
                })
            }


        },
    ], function(err, mark) {
        mongodb.close();
    });
    return defer.promise;
};
Post.getNum = function(date,title){
     var defer = Q.defer();
        async.waterfall([
            function(cb) { //打开数据库
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            function(db, cb) { //打开col
                db.collection('cate', function(err, col) {
                    cb(err, col)
                });
            },
            function(col, cb) { //处理doc
                col.find({
                   date:date,
                   title:title
                    })
                    .toArray(function(err, docs) {
                        console.log(docs.length);
                        if (docs.length === 0) {
                            //不存在返回null
                            cb(err, true);
                            defer.resolve(false);
                        } else {
                            //已经存在,返回children数组
                            cb(null, true);
                            defer.resolve(docs);
                        }
                    })

            },
        ], function(err, mark) {
            mongodb.close();
        });
        return defer.promise;
}
// Post.getYesterDay().then(()=>{console.log("ok");})  //只能执行一遍
module.exports = Post;
