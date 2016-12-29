require('dotenv').load();
var path = require('path');
var mongoose = require('mongoose');
mongoose.connect('mongodb://testuser:passtestacrud@candidate.36.mongolayer.com:10708/jmlog', function (err) {
	console.log('mongoose.connect', err);
});

var express = require('express');

/*ACRUD*/
var acrud = require('./index.js');
acrud.init({
	mongoose: mongoose,
	schemaFolder: path.join(__dirname, 'schemas')
});

var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/*ACRUD*/
app.post(acrud.OPTIONS.route, acrud.controller);

app.listen(3000, function () {
	console.log('Example app listening on port 3000!')
})