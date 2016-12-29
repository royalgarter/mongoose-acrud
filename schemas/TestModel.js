var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Schema_Test = new Schema({
	key:  { type: String, required: true, index: true },
	value:  { type: String, required: false },
	time:  { type: Date, required: false, default: new Date() },
});

module.exports = Schema_Test;

