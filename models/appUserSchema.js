var mongoose = require('mongoose');

module.exports = mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    appUserId: String,
    checkinData: {
        flickTitle: String,
        remaining: String,
        lastSeen: Date
    },
    connectedTo: String
});
