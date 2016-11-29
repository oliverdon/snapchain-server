'use strict';

const fs = require('fs');
const stream = require('stream');
const EventEmitter = require('events');
const Path = require('path');
const photoEmitter = new EventEmitter();
const gm = require('gm');
const JWT = require('jsonwebtoken');
const Hashwords = require('hashwords');
const hw = Hashwords({salt: '^u6UOchM37ufODGIyJ'});

const hash = require('./utils').hash;

const CONFIG = require('./config');
const Photo = require('./models/photo');
const User = require('./models/user');

const newUser = (request, reply) => {
    let newUser = new User({
        date: new Date(),
        hit: 0,
        ua: request.headers['user-agent'],
        host: request.info.remoteAddress
    });
    newUser.hw = hw.hashStr(newUser._id);
    newUser.save((err, user) => {
        console.log('saved', user);
    });
    let session = {
        ua: hash(newUser.ua),
        hw: newUser.hw,
        id: newUser._id
    };
    let token = JWT.sign(session, CONFIG.SECRET);
    return reply('ok')
        .state('token', token, CONFIG.COOKIE_OPTIONS);
}

const staticHandlerProd = {
    directory: {
        path: './static',
        listing: false,
        index: true
    }
};

const staticHandlerDev = {
    proxy: {
        host: '127.0.0.1',
        port: 8181,
        protocol: 'http',
        passThrough: true
    }
};

const routes = [
    {
        method: 'GET',
        path: '/api/login',
        config: { auth: { strategy: 'jwt', mode: 'try'}},
        handler: (request, reply) => {
            if(request.auth.isAuthenticated && request.auth.credentials) {
                return reply('ok');
            } else {
                return newUser(request, reply);
            }
        }
    },

    // new photo list api
    {
        method: 'GET',
        path: '/api/photos',
        config: {auth: 'jwt'},
        handler: (request, reply) => {
            Photo.livePhotos(CONFIG.GALLERY_LIMIT, (err, photos) => {
                return reply(
                    {user: {
                        hw: request.auth.credentials.hw,
                        _id: request.auth.credentials._id,
                        live: request.auth.credentials.live
                    },
                    photos: photos});
            });
        }
    },

    // photo upload
    {
        method: 'POST',
        path: '/api/photo',
        config: {auth: 'jwt', payload: {
            output: 'stream',
            parse: true,
            allow: 'multipart/form-data'
        }},
        handler: (request, reply) => {
            let data = request.payload;
            if (data && data.img) {
                let userId = request.auth.credentials.id;
                let userHw = request.auth.credentials.hw;

                let newPhoto = new Photo({
                    date: new Date(),
                    live: true,
                    creator: userId
                });
                var img = data.img.replace(/^data:image\/\w+;base64,/, '');
                img = img.replace(/ /g, '+');
                const path =  CONFIG.STORE_PATH + '/orig/' + newPhoto._id + '.jpg';
                const pathBlur = CONFIG.STORE_PATH + '/blur/' + newPhoto._id + '.jpg';
                fs.writeFile(path, img, 'base64', (err) => {
                    if (err) return;
                    // check we were really given an image
                    gm(path).identify('%m', (err, format) => {
                        if (err) return;
                        if (format !== 'JPEG') {
                            fs.unlinkSync(path);
                            return;
                        }
                        gm(path).blur(20, 20).write(pathBlur, (err) => {
                            if (err) return;
                            User.updateLive(userId, CONFIG.GALLERY_LIMIT, Photo, (purgedIds) => {
                                photoEmitter.emit('photoremoved', purgedIds);

                                newPhoto.save((err, photo) => {
                                    if(err || !photo) {
                                        return reply(500, 'Photo save error');
                                    }

                                    photoEmitter.emit('photoadded', userId, userHw, newPhoto._id);
                                    return reply('Ok');
                                });
                            });
                        });

                    });

                });
            }
        }
    },

    // image file response
    {
        method: 'GET',
        path: '/api/photo/{filename}',
        config: {auth: 'jwt'},
        handler: (request, reply) => {
            let sharerer = request.auth.credentials.live;
            let dirType = sharerer ? '/orig/' : '/blur/';
            let path = CONFIG.STORE_PATH + dirType + request.params.filename;
            reply.file(path);
        }
    },

    // sse photo event api
    {
        method: 'GET',
        path: '/api/events/photos',
        handler: function(request, reply) {
            var eventChannel = new stream.PassThrough;

            let addHandler = (userId, userHw, photoId) => {
                eventChannel.write('event: photoadded\n');
                eventChannel.write(`data: {"userId": "${userId}", "userHw": "${userHw}", "photoId": "${photoId}"}\n\n`);
            };

            let removeHandler = (purgedIds) => {
                var purgedIdsString = JSON.stringify(purgedIds);
                eventChannel.write('event: photoremoved\n');
                eventChannel.write(`data: {"userIds": ${purgedIdsString}}\n\n`);
            };

            photoEmitter.on('photoadded', addHandler);
            photoEmitter.on('photoremoved', removeHandler);

            request.raw.req.on('close', function() {
                photoEmitter.removeListener('photoadded', addHandler);
                photoEmitter.removeListener('photoremoved', removeHandler);

            });

            reply(eventChannel)
                .code(200)
                .type('text/event-stream')
                .header('Connection', 'keep-alive')
                .header('Cache-Control', 'no-cache')
                .header('Content-Encoding', 'identity');
        }
    },

    {
        method: 'GET',
        path: '/{path*}',
        handler: process.env.NODE_ENV === 'production' ? staticHandlerProd : staticHandlerDev
    },

    {
        method: 'GET',
        path: '/admin/reconcile',
        config: {auth: 'jwt'},
        handler: (request, reply) => {
            var path = CONFIG.STORE_PATH + '/orig/';
            fs.readdir(path, (err, fileList) => {
                let fileIds = fileList.map((file) => {
                    let jpgIndex = file.indexOf('.jpg');
                    return (jpgIndex === -1) ? file : file.substring(0, jpgIndex);
                });
                Photo.find({}, '_id', (err, dbIds) => {
                    dbIds = dbIds.map((photoId) => {
                        return photoId._id + '';
                    });

                    let notOnDisk = dbIds.filter((dbId) => {
                        return (fileIds.indexOf(dbId) === -1);
                    });

                    let notInDb = fileIds.filter((fileId) => {
                        return (dbIds.indexOf(fileId) === -1);
                    });

                    Photo.remove({_id: {$in: notOnDisk}}).exec();

                    for (var diskId of notInDb) {
                        let origPath = CONFIG.STORE_PATH + /orig/ + diskId + '.jpg';
                        let blurPath = CONFIG.STORE_PATH + /blur/ + diskId + '.jpg';
                        fs.stat(origPath, (err) => {
                            if (err) return;
                            fs.unlink(origPath);
                        });
                        fs.stat(blurPath, (err) => {
                            if (err) return;
                            fs.unlink(blurPath);
                        });
                    }
                    return reply({notOnDisk: notOnDisk, notInDb: notInDb});
                });
            });
        }
    },

    {
        method: 'GET',
        path: '/api/logout',
        handler: (request, reply) => {
            return reply('Out')
                .state('token', '', CONFIG.COOKIE_OPTIONS);
        }
    }
];


module.exports = routes;
