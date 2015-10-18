'use strict';

var SupportKit = require('supportkit-node');
var mongoose = require('mongoose');
var Q = require('q');

var secret = process.env.SK_SECRET;
var kid = process.env.SK_KID;

var jwt = SupportKit.jwt.generate({
    scope: 'app'
}, secret, kid);

// Mongoose
var AppUserSchema = require('../models/appUserSchema');
var AppUser = mongoose.model('AppUser', AppUserSchema);

function findAppUser(appUserId) {
    return Q.ninvoke(AppUser, 'findOne', {
        appUserId: appUserId
    });
}

function sendFromFlixBuddy(target, message) {
    return SupportKit.messages.create(target, {
        text: message,
        avatarUrl: 'https://media.smooch.io/appicons/5622718d670ab91900f3479e.jpg',
        name: 'FlixBuddy'
    }, 'appMaker', jwt);
}

module.exports = {
    getUsers: function(req, res) {
        Q.ninvoke(AppUser, 'find').then(function(appUsers) {
            res.json(appUsers);
        });
    },
    respondToWebhook: function(req, res) {
        var appUserId = req.body.appUserId;
        var message = req.body.messages[0].text;
        var role = req.body.messages[0].role;

        if (!appUserId) {
            return res.status(400).end();
        }

        if (role === 'appMaker') {
            return res.status(200).end();
        }

        findAppUser(appUserId).then(function(appUser) {
            if (appUser.connectedTo) {
                return findAppUser(appUser.connectedTo).then(function(targetUser) {
                    // Messages
                    return SupportKit.messages.create(targetUser.appUserId, {
                        text: message,
                        email: appUser.email,
                        name: appUser.firstName + ' ' + appUser.lastName
                    }, 'appMaker', jwt);
                });
            }
        }).done(function() {
            res.status(200).end();
        });
    },
    login: function(req, res) {
        var appUserId = req.body.appUserId;
        var appUser;

        if (!appUserId) {
            return res.status(400).end();
        }

        appUser = new AppUser({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            appUserId: appUserId
        });

        Q.ninvoke(appUser, 'save').then(function() {
            res.status(200).end();
        });
    },
    connect: function(req, res) {
        var appUserIdA = req.body.appUserA;
        var appUserIdB = req.body.appUserB;

        Q.all([
            findAppUser(appUserIdA),
            findAppUser(appUserIdB)
        ]).spread(function(appUserA, appUserB) {
            if (!(appUserA.connectedTo && appUserB.connectedTo)) {
                appUserA.connectedTo = appUserB.appUserId;
                appUserB.connectedTo = appUserA.appUserId;

                return Q.all([
                    Q.ninvoke(appUserA, 'save'),
                    Q.ninvoke(appUserB, 'save'),
                ]).then(function() {
                    return Q.all([
                        sendFromFlixBuddy(appUserIdA, 'You are now connected to ' + appUserB.firstName + ' ' + appUserB.lastName + '.' +
                            '\nAny messages you send will be delivered to them.'),
                        sendFromFlixBuddy(appUserIdB, 'You are now connected to ' + appUserA.firstName + ' ' + appUserA.lastName + '.' +
                            '\nAny messages you send will be delivered to them.')
                    ]);
                });
            } else {
                res.status(400).end();
            }
        }).done(function() {
            res.status(200).end();
        });
    },
    disconnect: function(req, res) {
        var appUserIdA = req.body.appUserA;
        var appUserIdB = req.body.appUserB;

        Q.all([
            findAppUser(appUserIdA),
            findAppUser(appUserIdB)
        ]).spread(function(appUserA, appUserB) {
            return Q.all([
                Q.ninvoke(appUserA, 'update', {
                    $unset: {
                        'connectedTo': 1
                    }
                }),
                Q.ninvoke(appUserB, 'update', {
                    $unset: {
                        'connectedTo': 1
                    }
                })
            ]).then(function() {
                return Q.all([
                    sendFromFlixBuddy(appUserIdA, 'You are no longer connected to ' + appUserB.firstName + ' ' + appUserB.lastName + '.'),
                    sendFromFlixBuddy(appUserIdB, 'You are no longer connected to ' + appUserA.firstName + ' ' + appUserA.lastName + '.')
                ]);
            });
        }).done(function() {
            res.status(200).end();
        });
    },
    checkIn: function(req, res) {
        var appUserId = req.body.appUserId;

        if (!appUserId) {
            return res.status(400).end();
        }

        findAppUser(appUserId).then(function(appUser) {
            appUser.checkinData = {
                flickTitle: req.body.flickTitle,
                remaining: req.body.remaining,
                lastSeen: Date.now()
            };

            return Q.ninvoke(appUser, 'save');
        }).fail(function() {
            res.status(404).end();
        }).done(function() {
            res.status(200).end();
        });
    }
};
