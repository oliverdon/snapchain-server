'use strict';

const Mongoose = require('./db');
const Schema = Mongoose.Schema;

var userSchema = new Schema({
    name: Schema.Types.String,
    ua: Schema.Types.String,
    hw: Schema.Types.String,
    host: Schema.Types.String,
    date: Schema.Types.Date,
    active: Schema.Types.Date,
    live: {type: Schema.Types.Boolean, default: false},
    hit: Schema.Types.Number
});

userSchema.methods.touch = function () {
    this.hit++;
    this.active = new Date();
};

userSchema.methods.livePhotos = function (live, Photos, callback) {
    Photos.find({creator: this._id, live: live}).exec((err, photos) => {
        callback(photos);
    });
};


userSchema.statics.updateLive = function (idAddingPhoto, limit, Photo, callback) {
    var self = this;
    Photo.find({live: true}).sort({date: 'desc'}).exec((err, photos) => {
        if (err) return;
        let purgedPhotos = photos.slice(limit);
        if (!purgedPhotos) return callback ? callback() : null;
        let purgedPhotoIds = [];

        // disable photos that have been pushed out of the top N
        for (var purgedPhoto of purgedPhotos) {
            this.update({_id: purgedPhoto.creator}, {live: false}).exec();
            Photo.update({_id: purgedPhoto._id}, {live: false}).exec();
            purgedPhotoIds.push(purgedPhoto._id);
        }

        // disable any other photos the same user may have previously sent
        Photo.find({creator: idAddingPhoto, live: true}).exec((err, creatorPhotos) => {
            console.log('---', err, creatorPhotos);
            if (err) return;

            for (var purgedCreatorPhoto of creatorPhotos) {
                if (purgedCreatorPhoto && purgedCreatorPhoto._id) {
                    Photo.update({_id: purgedCreatorPhoto._id}, {live: false}).exec();
                    purgedPhotos.push(purgedCreatorPhoto._id);
                }
            }



            self.update({_id: idAddingPhoto}, {live: true}).exec();
            return callback ? callback(purgedPhotos) : null;
        });



    });
};

module.exports = Mongoose.model('User', userSchema);
