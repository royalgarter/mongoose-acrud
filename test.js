'use strict';
require('dotenv').load();

const path = require('path');
const mongoose = require('mongoose');
mongoose.connect('mongodb://testuser:passtestacrud@candidate.36.mongolayer.com:10708/jmlog', err => {
	console.log('mongoose.connect', err);
});

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/*ACRUD*/
const acrud = require('./index.js');
acrud.init({
	mongoose: mongoose,
	schemaFolder: path.join(__dirname, 'schemas')
});
app.post(acrud.ROUTE, acrud.controller);

app.listen(3000, () => {
	console.log('Listening on port: 3000')
});