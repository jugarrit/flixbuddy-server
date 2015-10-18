'use strict';

// Libs
var SupportKit = require('supportkit-node');
var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');
var mongoose = require('mongoose');

// Env vars
var port = process.env.PORT || 3000;
var secret = process.env.SK_SECRET;
var kid = process.env.SK_KID;
var mongolabUri = process.env.MONGOLAB_URI;

var app = express();
var db = mongoose.connection;

var jwt = SupportKit.jwt.generate({
    scope: 'app'
}, secret, kid);

function initialize() {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(require('./src/api'));

    // Connect to Mongo
    mongoose.connect(mongolabUri || 'mongodb://localhost/flixbuddy-test');

    db.once('open', function() {
        // Start the server
        app.listen(process.env.PORT || port);
        console.log('Mongo connection established');
        console.log('Express started on port ' + port);
    });

    db.on('error', console.error.bind(console, 'connection error:'));
}

function createWebhook() {
    SupportKit.apiVersion = 1;

    SupportKit.webhooks.list(jwt).then(function(webhookList) {
        _.each(webhookList.webhooks, function(webhook) {
            SupportKit.webhooks.destroy(webhook._id, jwt).catch(function() {});
        });
    });

    SupportKit.webhooks.create('https://api.flixbuddy.co/webhook', jwt);
}

initialize();
createWebhook();