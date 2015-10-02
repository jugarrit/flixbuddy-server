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

/*
 * Routes
 */

app.get('/users', function(req, res) {
    var storageValues = storage.values();
    storageValues = _.reject(storageValues, function(value) {
        return !value.appUserId;
    });
    console.log('storage.values :: ', storageValues);
    res.json(storageValues);
});

app.post('/webhook', function(req, res) {
    var appUserId = req.body.appUserId;
    var targetUser = storage.getItem(STORAGE_PREFIX_CONNECTION + appUserId);
    var userInfo = storage.getItem(STORAGE_PREFIX_USER + appUserId);
    var message = req.body.items[0].text;
    var role = req.body.items[0].role;

    if (role === 'appUser' && targetUser) {
        // Messages
        SupportKit.messages.create(targetUser, {
            text: message,
            name: userInfo.firstName + ' ' + userInfo.lastName
        }, 'appMaker', jwt);
    } else {
        // do nothing!
    }

    res.status(200).end();
});

app.post('/login', function(req, res) {
    storage.setItem(STORAGE_PREFIX_USER + req.body.appUserId, {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        appUserId: req.body.appUserId
    }).then(function() {
        res.status(200).end();
    });
});

app.post('/connect', function(req, res) {
    var appUserA = req.body.appUserA;
    var appUserB = req.body.appUserB;

    console.log('appUserA :: ', appUserA);
    console.log('appUserB :: ', appUserB);

    if (!storage.getItem(STORAGE_PREFIX_CONNECTION + appUserA) && !storage.getItem(STORAGE_PREFIX_CONNECTION + appUserB)) {
        storage.setItem(STORAGE_PREFIX_CONNECTION + appUserA, appUserB);
        storage.setItem(STORAGE_PREFIX_CONNECTION + appUserB, appUserA);
        res.status(201).end();
    }

    res.status(400).end();
});

app.listen(process.env.PORT || port);
console.log('Express started on port ' + port);