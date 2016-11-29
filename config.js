'use strict';

const CONFIG = {
    STORE_PATH: __dirname + '/store',
    GALLERY_LIMIT: 8,
    COOKIE_OPTIONS: {
        ttl: 365 * 24 * 60 * 60 * 1000, // a year
        encoding: 'none',
        isSecure: false,
        isHttpOnly: true,
        clearInvalid: false,
        strictHeader: true
    },
    SECRET: '$Qf8QZUXMq@h#796Yp',
    DAY_IN_MILLISECONDS: 86400000
};

module.exports = CONFIG;
