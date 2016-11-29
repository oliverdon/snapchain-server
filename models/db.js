'use strict';

const DB_URI = 'mongodb://localhost/snapchain';
const Mongoose = require('mongoose');

Mongoose.connect(DB_URI);
const db = Mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('db connected');
});

module.exports = Mongoose;
