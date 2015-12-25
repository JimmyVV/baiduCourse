var mongodb = require('./database'),
    async = require('async'),
    getDate = require('./util/getDate'),
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

//保存数据库
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
                    href: cate.href,
                    date: date
                })
                .toArray(function(err, docs) {
                    if (docs.length === 0) {
                        //不存在则插入数据getAllHrefs
                        col.insert(cate, function(err) {
                            //检查插入是否成功
                            cb(err, true);
                            defer.resolve(true);
                        })
                    } else {
                        //已经存在,更新数据
                        // console.log(cate);
                        col.update({
                            href: cate.href,
                            date: date
                        }, {
                            $set: cate
                        }, {
                            upsert: true
                        }, function(err, r) {
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
    //获取所有的第三级目录的连接数,并且放入到另外一个库内，作为备份;
Post.backRate3 = function() {
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
                        date: date,
                        rate: 3
                    }) //获取所有的链接数
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
Post.getAllHrefs = function() {
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
                    col.find({
                            rate: {
                                $in: [1, 2]
                            }
                        }) //获取所有的链接数
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
            console.log(docs);
            for (var i of docs) {
                col.insert(i, function(err) {
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
//获取二级目录的所有href记录
Post.getCate2Content = function(date, href) {
        var defer = Q.defer();
        async.waterfall([
            function(cb) { //打开数据库
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            function(db, cb) { //打开col
                db.collection('cate', function(err, col) {
                    cb(err, col);
                });
            },
            function(col, cb) { //处理doc
                console.log(href);
                col.find({
                        date: date,
                        rate: 2,
                        href: {
                            $in: href
                        }
                    }, {
                        _id: 0,
                        title: 0,
                        href: 0,
                        children: 0,
                        rate: 0
                    })
                    .toArray(function(err, docs) {
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
    //获取第三级目录的所有href记录
Post.getCate3Content = function(date, href) {
    var defer = Q.defer();
    async.waterfall([
        function(cb) { //打开数据库
            mongodb.open(function(err, db) {
                cb(err, db);
            });
        },
        function(db, cb) { //打开col
            db.collection('cate', function(err, col) {
                cb(err, col);
            });
        },
        function(col, cb) { //处理doc
            col.find({
                    date: date,
                    rate: 3,
                    href: {
                        $in: href
                    }
                }, {
                    _id: 0,
                    title: 0,
                    href: 0,
                    children: 0,
                    rate: 0
                })
                .toArray(function(err, docs) {
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
Post.getSpecialRate2 = function(date, rate) {
        var defer = Q.defer();
        async.waterfall([
            function(cb) { //打开数据库
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            function(db, cb) { //打开col
                db.collection('cate', function(err, col) {
                    cb(err, col);
                });
            },
            function(col, cb) { //处理doc
                col.find({
                        date: date,
                        rate: rate
                    }, {
                        href: 1,
                        date: 1,
                        _id: 0,
                        children: 1
                    })
                    .toArray(function(err, docs) {
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
    //根据指定日期，处理第三级目录的数据
Post.getSpecialRate3 = function(date, rate) {
        var defer = Q.defer();
        async.waterfall([
            function(cb) { //打开数据库
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            function(db, cb) { //打开col
                db.collection('cate', function(err, col) {
                    cb(err, col);
                });
            },
            function(col, cb) { //处理doc
                col.find({
                        date: date,
                        rate: rate
                    }, {
                        freeCourses: 1,
                        VipCourses: 1,
                        href: 1,
                        date: 1,
                        _id: 0
                    })
                    .toArray(function(err, docs) {
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
    //获取指定日期的date
Post.getNum = function(date, href) {
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
                        date: date,
                        href: href
                    }, {
                        increase: 1,
                        decrease: 1,
                        freeIncrease: 1,
                        freeDecrease: 1,
                        VipIncrease: 1,
                        VipDecrease: 1,
                        students: 1,
                        freeCourses:1,
                        VipCourses:1,
                        rate:1,
                        _id:0
                    })
                    .toArray(function(err, docs) {
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
    //从hrefs库内，获取第三级目录连接数量
Post.getRate3Href = function() {
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
                    col.find({
                            rate: 3
                        }) //获取所有的链接数
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
    //根据href,查找对应的数据,然后存入
    // Post.getYesterDay().then(()=>{console.log("ok");})  //只能执行一遍
module.exports = Post;
