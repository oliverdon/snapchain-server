'use strict';

const Path = require('path');
const Hapi = require('hapi');
const Good = require('good');
const Inert = require('inert');
const HapiAuthJWT = require('hapi-auth-jwt2');

const User = require('./models/user');

const hash = require('./utils').hash;
const CONFIG = require('./config');


const server = new Hapi.Server();
server.connection({address: 'localhost', port: 8080});


var validate = function (decoded, request, callback) {
    User.findById(decoded.id, (err, user) => {
        if ((err || !user) ||
        (decoded.ua !== hash(user.ua)) ||
        (decoded.ua !== hash(request.headers['user-agent'])))  {
            return callback(null, false);
        }
        return callback(null, true, user);
    });
};

server.register([
    {register: HapiAuthJWT, options: {}},
    {register: require('h2o2'), options: {}},
    {register: Inert, options: {}},
    {register: Good,
        options: {
            ops: {
                interval: CONFIG.DAY_IN_MILLISECONDS
            },
            reporters: {
                console: [{
                    module: 'good-console',
                    args: [{log: '*', response: '*'}]
                }, 'stdout']
            }
        }
    }
],
(err) => {

    if (err) {
        console.error(err);
        return;
    }

    server.auth.strategy('jwt', 'jwt',
    { key: CONFIG.SECRET,
      validateFunc: validate,
      verifyOptions: {algorithms: ['HS256']}
    });

    server.route(require('./routes'));

    server.ext('onPreResponse', function (request, reply) {
        if (request.response.isBoom) {
            return reply.redirect('/');
        }
        return reply.continue();
    });

    server.start(() => console.log(`server started at ${server.info.uri} NODE_ENV=${process.env.NODE_ENV}`));
});
