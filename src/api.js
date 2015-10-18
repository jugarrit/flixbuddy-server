'use strict';

var SupportKit = require('supportkit-node');
var express = require('express');
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

module.exports = express.Router()
    .get('/users', function(req, res) {
        Q.ninvoke(AppUser, 'find').then(function(appUsers) {
            res.json(appUsers);
        });
    })

    .post('/webhook', function(req, res) {
        var appUserId = req.body.appUserId;
        var message = req.body.items[0].text;
        var role = req.body.items[0].role;

        if (!appUserId) {
            return res.status(400).end();
        }

        if (role === 'appMaker') {
            return res.status(200).end();
        }

        Q.ninvoke(AppUser, 'findOne', {
            appUserId: appUserId
        }).then(function(appUser) {
            if (appUser.connectedTo) {
                Q.ninvoke(AppUser, 'findOne', {
                    appUserId: appUser.connectedTo
                }).then(function(targetUser) {
                    // Messages
                    SupportKit.messages.create(targetUser.appUserId, {
                        text: message,
                        email: appUser.email,
                        name: appUser.firstName + ' ' + appUser.lastName
                    }, 'appMaker', jwt);
                }
                );
            }
        });
    })

    .post('/login', function(req, res) {
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
    })

    .post('/connect', function(req, res) {
        var appUserIdA = req.body.appUserA;
        var appUserIdB = req.body.appUserB;

        Q.all([
            Q.ninvoke(AppUser, 'findOne', {
                appUserId: appUserIdA
            }),
            Q.ninvoke(AppUser, 'findOne', {
                appUserId: appUserIdB
            })
        ]).spread(function(appUserA, appUserB) {
            if (!(appUserA.connectedTo && appUserB.connectedTo)) {
                appUserA.connectedTo = appUserB.appUserId;
                appUserB.connectedTo = appUserA.appUserId;

                Q.all([
                    Q.ninvoke(appUserA, 'save'),
                    Q.ninvoke(appUserB, 'save'),
                ]).then(function() {
                    SupportKit.messages.create(appUserIdA, {
                        text: 'You are now connected to ' + appUserB.firstName + ' ' + appUserB.lastName + '. Any messages you send will be delivered to them.',
                        avatarUrl: 'https://media.smooch.io/appicons/5622718d670ab91900f3479e.jpg',
                        name: 'FlixBuddy'
                    }, 'appMaker', jwt);

                    SupportKit.messages.create(appUserIdB, {
                        text: 'You are now connected to ' + appUserA.firstName + ' ' + appUserA.lastName + '. Any messages you send will be delivered to them.',
                        avatarUrl: 'https://media.smooch.io/appicons/5622718d670ab91900f3479e.jpg',
                        name: 'FlixBuddy'
                    }, 'appMaker', jwt);

                    res.status(201).end();
                });
            } else {
                res.status(400).end();
            }
        });
    })

    .post('/disconnect', function(req, res) {
        var appUserIdA = req.body.appUserA;
        var appUserIdB = req.body.appUserB;

        Q.all([
            Q.ninvoke(AppUser, 'findOne', {
                appUserId: appUserIdA
            }),
            Q.ninvoke(AppUser, 'findOne', {
                appUserId: appUserIdB
            })
        ]).spread(function(appUserA, appUserB) {
            Q.all([
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
                SupportKit.messages.create(appUserIdA, {
                    text: 'You are no longer connected to ' + appUserB.firstName + ' ' + appUserB.lastName + '.',
                    avatarUrl: 'https://media.smooch.io/appicons/5622718d670ab91900f3479e.jpg',
                    name: 'FlixBuddy'
                }, 'appMaker', jwt);

                SupportKit.messages.create(appUserIdB, {
                    text: 'You are no longer connected to ' + appUserA.firstName + ' ' + appUserA.lastName + '.',
                    avatarUrl: 'https://media.smooch.io/appicons/5622718d670ab91900f3479e.jpg',
                    name: 'FlixBuddy'
                }, 'appMaker', jwt);

                res.status(200).end();
            });
        });
    })

    .post('/checkIn', function(req, res) {
        var appUserId = req.body.appUserId;

        if (!appUserId) {
            return res.status(400).end();
        }

        Q.ninvoke(AppUser, 'findOne', {
            appUserId: appUserId
        }).then(function(appUser) {
            appUser.checkinData = {
                flickTitle: req.body.flickTitle,
                remaining: req.body.remaining,
                lastSeen: Date.now()
            };
            Q.ninvoke(appUser, 'save').then(function() {
                res.status(200).end();
            });
        }).fail(function() {
            res.status(404).end();
        });
    });
