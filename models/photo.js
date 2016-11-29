'use strict';

const Mongoose = require('./db');
const Schema = Mongoose.Schema;

var photoSchema = new Schema({
    uri: Schema.Types.String,
    date: Schema.Types.Date,
    live: Schema.Types.Boolean,
    creator: {type: Schema.Types.ObjectId, ref: 'User'}
});

photoSchema.statics.livePhotos = function (limit, callback) {
    this.find({live: true}).sort({date: 'desc'}).limit(limit).populate('creator', 'hw').exec((err, photos) => {
        return callback ? callback(err, photos) : null;
    });
};


module.exports = Mongoose.model('Photo', photoSchema);
