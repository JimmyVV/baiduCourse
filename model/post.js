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
                    date: cate.date
                })
                .toArray(function(err, docs) {
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
Post.getTitles = function() {
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
    /*
     * 用来保存用户对应的土豪名字
     * @param tyrant: 土豪名字
     *        name: hash值, 用来存放的名字;
     */
Post.saveUser = function(name, tyrant, callback) {
        async.waterfall([
            function(cb) {
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            function(db, cb) {
                db.collection('user', function(err, col) {
                    cb(err, col);
                })
            },
            function(col, cb) {
                //查找对应的测试者
                col.update({
                        name: name
                    }, {
                        $push: {
                            tyrant: tyrant
                        }
                    }, {
                        insert: true
                    })
                    .then(function(result) {
                        cb(true, true);
                    }, function() {
                        cb(true, true);
                    });

            }
        ], function(err, mark) {
            mongodb.close();
            callback(mark);
        })
    }
    /*
     *  获取对应用户的土豪信息
     *  @param  name: 用户的名字
     */
Post.fetchTyrant = function(name, callback) {
        var user = { //设置用户姓名
            name: name
        }
        async.waterfall([
            function(cb) { //打开数据库
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            function(db, cb) { //打开col
                db.collection('user', function(err, col) {
                    cb(err, col)
                });
            },
            function(col, cb) { //处理doc
                col.find(user).toArray(function(err, doc) {
                    //检测是否存在,并返回测试结果;
                    cb(err, doc[0]);
                })
            },
        ], function(err, doc) { //如果没有错误err为null
            mongodb.close();
            callback(!err, doc);
        });
    }
    //检测是否存在测试者姓名;
Post.get = function(name, callback) {
        async.waterfall([
            function(cb) {
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            function(db, cb) {
                db.collection('user', function(err, col) {
                    cb(err, col);
                })
            },
            function(col, cb) {
                //查找对应的测试者
                col.find({
                    name: name
                }).toArray(function(err, doc) {
                    //检测是否存在,并返回测试结果;
                    cb(err, doc);
                })
            }
        ], function(err, doc) {
            mongodb.close();
            callback(err, doc);
        })
    }
    //获得土豪信息
Post.getTyrant = function(name, callback) {
    async.waterfall([
        function(cb) { //打开数据库
            mongodb.open(function(err, db) {
                cb(err, db)
            });
        },
        function(db, cb) { //打开col
            db.collection('posts', function(err, col) {
                cb(err, col)
            });
        },
        function(col, cb) {
            col.count({
                name: {
                    $nin: name
                }
            }).then(function(count) {
                var ran = Math.floor(count * Math.random());
                col.find({
                        name: {
                            $nin: name
                        }
                    }).skip(ran).limit(1)
                    .toArray().then(function(docs) {
                        cb(null, docs[0]);
                    })
            });
        }
    ], function(err, data) {
        mongodb.close();
        callback(err, data);
    });
}
Post.prototype.saveData = function(tyrant, callback) {
    async.waterfall([
        function(cb) { //打开数据库
            mongodb.open(function(err, db) {
                cb(err, db);
            });
        },
        function(db, cb) { //打开col
            db.collection('posts', function(err, col) {
                cb(err, col)
            });
        },
        function(col, cb) { //处理doc
            col.insert(tyrant, function(err) {
                cb(err, true);
            })
        },
    ], function(err, mark) {
        mongodb.close();
        callback(err, mark);
    });
};

module.exports = Post;
