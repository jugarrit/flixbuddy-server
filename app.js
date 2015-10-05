'use strict';

var SupportKit = require('node-supportkit');
var express = require('express');
var bodyParser = require('body-parser');
var storage = require('node-persist');
var _ = require('underscore');

var port = process.env.PORT || 3000;
var secret = process.env.SK_SECRET;
var kid = process.env.SK_KID;
var appId = process.env.SK_APP_ID;

var app = express();

var jwt = SupportKit.jwt.generate({
    scope: 'app'
}, secret, kid);

var STORAGE_PREFIX_USER = 'user.';
var STORAGE_PREFIX_CONNECTION = 'connection.';

SupportKit.apiUrl = 'https://supportkit-staging.herokuapp.com';
SupportKit.webhooks.list(appId, jwt).then(function(webhookList) {
    _.each(webhookList, function(webhook) {
        SupportKit.webhooks.destroy(appId, webhook._id, jwt).catch(function() {});
    });
});
SupportKit.webhooks.create(appId, 'http://bfe85653.ngrok.io/webhook', jwt);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

storage.initSync();
// storage.clear();

/*
 * Routes
 */

app.get('/users', function(req, res) {
    var storageValues = storage.values();

    storageValues = _.reject(storageValues, function(value) {
        return !value.appUserId;
    });

    res.json(storageValues);
});

app.post('/webhook', function(req, res) {
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
});

app.post('/login', function(req, res) {
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
});

app.post('/connect', function(req, res) {
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
            authorId: 'julian.garritano+flixbuddy@gmail.com'
        }, 'appMaker', jwt);

        SupportKit.messages.create(appUserIdB, {
            text: 'You are now connected to ' + appUserA.firstName + ' ' + appUserA.lastName + '. Any messages you send will be delivered to them.',
            authorId: 'julian.garritano+flixbuddy@gmail.com'
        }, 'appMaker', jwt);

        res.status(201).end();
    }

    res.status(400).end();
});

app.post('/disconnect', function(req, res) {
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
            authorId: 'julian.garritano+flixbuddy@gmail.com'
        }, 'appMaker', jwt);

        SupportKit.messages.create(appUserIdB, {
            text: 'You are no longer connected to ' + appUserA.firstName + ' ' + appUserA.lastName + '.',
            authorId: 'julian.garritano+flixbuddy@gmail.com'
        }, 'appMaker', jwt);

        res.status(201).end();
    }

    res.status(400).end();
});

app.post('/checkIn', function(req, res) {
    var appUserId = req.body.appUserId;
    var appUser = storage.getItem(STORAGE_PREFIX_USER + appUserId);

    if (!appUserId || !appUser) {
        return res.status(400).end();
    }

    appUser.flickTitle = req.body.flickTitle;
    appUser.remaining = req.body.remaining;
    appUser.lastSeen = Date.now();

    storage.setItem(STORAGE_PREFIX_USER + appUserId, appUser);

    res.status(200).end();
});

app.listen(process.env.PORT || port);
console.log('Express started on port ' + port);