'use strict';

var SupportKit = require('node-supportkit');
var express = require('express');
var storage = require('node-persist');
var _ = require('underscore');
var mongoose = require('mongoose');
var db = mongoose.connection;

var STORAGE_PREFIX_USER = 'user.';
var STORAGE_PREFIX_CONNECTION = 'connection.';
var secret = process.env.SK_SECRET;
var kid = process.env.SK_KID;

var jwt = SupportKit.jwt.generate({
    scope: 'app'
}, secret, kid);

// Mongoose
var AppUserSchema = require('../models/appUserSchema');
var ConnectionSchema = require('../models/connectionSchema');
var AppUser = mongoose.model('AppUser', AppUserSchema);
var Connection = mongoose.model('ConnectionSchema', ConnectionSchema);

module.exports = express.Router()
    .get('/users', function(req, res) {
        var storageValues = storage.values();

        storageValues = _.reject(storageValues, function(value) {
            return !value.appUserId;
        });

        res.json(storageValues);
    })
    .post('/webhook', function(req, res) {
        var appUserId = req.body.appUserId;
        var targetUser = storage.getItem(STORAGE_PREFIX_CONNECTION + appUserId);
        var userInfo = storage.getItem(STORAGE_PREFIX_USER + appUserId);
        var message = req.body.items[0].text;
        var role = req.body.items[0].role;

        if (!appUserId) {
            return res.status(400).end();
        }

        if (role === 'appUser' && targetUser) {
            // Messages
            SupportKit.messages.create(targetUser, {
                text: message,
                name: userInfo.firstName + ' ' + userInfo.lastName,
                authorId: 'julian.garritano+flixbuddyuser@gmail.com'
            }, 'appMaker', jwt);
        } else {
            // do nothing!
        }

        res.status(200).end();
    })
    .post('/login', function(req, res) {
        var appUserId = req.body.appUserId;

        if (!appUserId) {
            return res.status(400).end();
        }

        storage.setItem(STORAGE_PREFIX_USER + appUserId, {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            appUserId: appUserId
        }).then(function() {
            res.status(200).end();
        });
    })
    .post('/connect', function(req, res) {
        var appUserIdA = req.body.appUserA;
        var appUserIdB = req.body.appUserB;

        if (!storage.getItem(STORAGE_PREFIX_CONNECTION + appUserIdA) && !storage.getItem(STORAGE_PREFIX_CONNECTION + appUserIdB)) {
            var appUserA = storage.getItem(STORAGE_PREFIX_USER + appUserIdA);
            var appUserB = storage.getItem(STORAGE_PREFIX_USER + appUserIdB);

            storage.setItem(STORAGE_PREFIX_CONNECTION + appUserIdA, appUserIdB);
            storage.setItem(STORAGE_PREFIX_CONNECTION + appUserIdB, appUserIdA);

            appUserA.connectedTo = appUserIdB;
            appUserB.connectedTo = appUserIdA;
            storage.setItem(STORAGE_PREFIX_USER + appUserIdA, appUserA);
            storage.setItem(STORAGE_PREFIX_USER + appUserIdB, appUserB);

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
        }

        res.status(400).end();
    })
    .post('/disconnect', function(req, res) {
        var appUserIdA = req.body.appUserA;
        var appUserIdB = req.body.appUserB;

        if (storage.getItem(STORAGE_PREFIX_CONNECTION + appUserIdA) && storage.getItem(STORAGE_PREFIX_CONNECTION + appUserIdB)) {
            var appUserA = storage.getItem(STORAGE_PREFIX_USER + appUserIdA);
            var appUserB = storage.getItem(STORAGE_PREFIX_USER + appUserIdB);

            storage.removeItem(STORAGE_PREFIX_CONNECTION + appUserIdA);
            storage.removeItem(STORAGE_PREFIX_CONNECTION + appUserIdB);

            delete appUserA.connectedTo;
            delete appUserB.connectedTo;

            storage.setItem(STORAGE_PREFIX_USER + appUserIdA, appUserA);
            storage.setItem(STORAGE_PREFIX_USER + appUserIdB, appUserB);

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

            res.status(201).end();
        }

        res.status(400).end();
    })
    .post('/checkIn', function(req, res) {
        var appUserId = req.body.appUserId;
        var appUser = storage.getItem(STORAGE_PREFIX_USER + appUserId);

        if (!appUserId || !appUser) {
            return res.status(400).end();
        }

        appUser.checkinData = {
            flickTitle: req.body.flickTitle,
            remaining: req.body.remaining,
            lastSeen: Date.now()
        };

        storage.setItem(STORAGE_PREFIX_USER + appUserId, appUser);

        res.status(200).end();
    });
