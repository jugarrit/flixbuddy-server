'use strict';

var flixbuddy = require('../controllers/flixbuddy');
var express = require('express');

module.exports = express.Router()
    .get('/users', flixbuddy.getUsers)
    .post('/webhook', flixbuddy.respondToWebhook)
    .post('/login', flixbuddy.login)
    .post('/connect', flixbuddy.connect)
    .post('/disconnect', flixbuddy.disconnect)
    .post('/checkIn', flixbuddy.checkIn);
