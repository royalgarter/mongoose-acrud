'use strict';
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Schema = mongoose.Schema;

const ERR = {
	ELEVEL: 'APIKEY INVALID',
	EAUTH: 'AUTHENTICATION MISSING'
};

const HELP_OBJ = {
	"body": {
		"id": "_id",
		"q": "query",
		"s": "sort",
		"sk": "skip",
		"u": "update",
		"o": "option",
		"l": "limit",
		"f": "field",
		"p": "populate",
		"dp": "deep populate",
	},
	"action" : {
		"save":"body is whole object",
		"remove":"body.q",
		"find|findone|count":"body.q[s,sk,l,f,p,dp]",
		"findid|updateid":"body.id",
		"update|findoneandupdate":"body.q, body.u, body.o",
		"aggregate":"body is whole aggregate object",
	},
	"levelKey": {
		"ACRUD": "11111 = 31",
		"Aggr": "10000 = 16",
		"Create": "01000 = 8",
		"Read": "00100 = 4",
		"Update": "00010 = 2",
		"Delete": "00001 = 1",
	}
};

const _reviverISODate = (key, value) => { // new Date().toISOString() = "2015-12-16T09:17:06.307Z"
	if (typeof value != 'string') return value;

	if (key === '$regex') return new RegExp(value);

	let a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
	if (!a) return value;

	return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
};

const _parseJSON = (obj, reviver) => {
	try {
		if (!obj) return null;

		switch (typeof obj) {
			case 'object':
				return obj;
			case 'string':
				return reviver ? JSON.parse(obj, reviver) : JSON.parse(obj);
			default:
				return null;
		}
	} catch (ex) {
		console.log(`${ex}\nObject is not valid JSON string:`, obj);
		return null;
	}
};

const _parseBody = body => {

	if (!body) return body;

	const rg = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z/;
	let obj = (typeof body == 'object') ? JSON.stringify(body) : body;
	obj = (~obj.search(rg)) ? _parseJSON(obj, _reviverISODate) : body;

	return obj;
};

const _parseDeepPop = obj => {

	let resPath = [];
	let resOption = null;

	const parseSingleObj = dp => {
		if (!dp.path) return;

		const path = dp.path; delete dp.path;

		resPath.push(path);
		resOption.populate[path] = dp;
	};

	switch (typeof obj) {
		case 'string':
			resPath = obj;
			resOption = null;
			break;
		case 'object':
			resPath = [];
			resOption = {populate: {}};

			if (Array.isArray(obj)) {
				if (obj[0] && typeof obj[0] == 'string') {
					resPath = obj;
					resOption = null;
				} else {
					for (let i = 0; i < obj.length; i++) {
						parseSingleObj(obj[i])
					};
				}
			} else {
				parseSingleObj(obj)
			}
			break;
	}

	if (Array.isArray(resPath))
		resPath = resPath.join(' ');

	return {
		path: resPath,
		option: resOption
	};
};

const _A = {
	ROUTE: '/acrud/:model/:action/:ressoon?/:rootmodel?',
	OPTIONS: {},
	CMD: {},
	ACL: {},
};

_A.init = (option, cmds, acl) => {
	option = option || {};
	_A.O = _A.OPTIONS;

	_A.O.keystone = option.keystone || null;

	_A.O.schemaFolder = option.schemaFolder || './schemas';
	_A.O.schemaHash = option.schemaHash || {};
	// console.log('_A.O', JSON.stringify(_A.O));

	_A.O.mongoose = option.mongoose || mongoose;
	_A.O.deepPopulate = require('mongoose-deep-populate')(_A.O.mongoose);

	_A.OPTIONS = _A.O;
	_A.CMD = cmds || {};
	_A.ACL = acl || {};
}

_A.controller = (req, res) => {
	const reqID = new Date().getTime();

	const action = req.params.action;
	const model = req.params.model;
	const rootmodel = req.params.rootmodel;
	const resSoon = req.params.ressoon == 'true'  || req.params.ressoon == '1';

	const body = req.body;

	const AUTH_KEY = req.headers.authorization;
	const LEVEL_KEY = Number( _A.ACL[AUTH_KEY] ? (_A.ACL[AUTH_KEY][model] || 0) : (process.env[AUTH_KEY] || 0) );

	console.log('AUTH_KEY, LEVEL_KEY', AUTH_KEY, LEVEL_KEY);
	// console.log('req.params', JSON.stringify(req.params));
	// console.log('req.body', JSON.stringify(req.body));

	const fnResult = (err, result, result2) => {
		if (err) console.log(`RESULT_ERR=${err}`);

		if (!res.headersSent)
			res.json({err, result, result2});
	};

	const fnVoid = (err, result, result2) => {
		if (err) console.log(`VOID_ERR=${err} ${result} ${result2}`);
	};

	if (!process.env[AUTH_KEY] || !LEVEL_KEY) {
		console.log(ERR.EAUTH, LEVEL_KEY, JSON.stringify(body));
		return fnResult(ERR.EAUTH);
	}

	const id = body.id; 
	const q = _parseBody(body.q);
	const s = body.s; 
	const sk = body.sk; 
	const u = _parseBody(body.u);
	const o = body.o; 
	const l = body.l; 
	const f = body.f; 
	const p = body.p; 
	const dp = body.dp ? _parseDeepPop(body.dp) : null;

	const fnExec = (Model, isNative) => {
		const actionLow = action.toLowerCase();
		let query = null;
		switch (actionLow) {
			case 'help':
				return fnResult(null, HELP_OBJ);
				break;
			case 'save':
				if (!(LEVEL_KEY&8)) return res.json({err: ERR.ELEVEL});

				const obj = body.toObject ? body.toObject() : body;
				if (obj._id) {
					const mrId = obj._id;
					delete obj._id;delete obj.__v;
					Model.findOneAndUpdate({_id: mrId}, obj, {new: true, upsert: true}, (err, doc) => resSoon
						? fnVoid(err, doc, !err && doc ? 1 : 0)
						: fnResult(err, doc, !err && doc ? 1 : 0));

				} else {
					let doc = new Model(obj);
					doc.save(resSoon ? fnVoid : fnResult);
				}
				/*RES_SOON*/if (resSoon) return fnResult(null, doc, 1);
				break;
			case 'remove':
				if (!(LEVEL_KEY&1)) return res.json({err: ERR.ELEVEL});

				Model.remove(q, resSoon ? fnVoid : fnResult);
				/*RES_SOON*/if (resSoon) return fnResult(null, 1);
				break;
			case 'find':
				if (!(LEVEL_KEY&4)) return res.json({err: ERR.ELEVEL});
				
				query = Model.find(q);
				
				if (sk) query.skip(sk);
				if (l) query.limit(l);
				if (f) query.select(f);
				if (p) query.populate(p);
				if (dp) query.deepPopulate(dp.path, dp.option);
				if (s) query.sort(s);
				
				if (isNative) query.toArray(fnResult)
				else query.exec(fnResult);
				break;
			case 'findid':
				if (!(LEVEL_KEY&4)) return res.json({err: ERR.ELEVEL});

				if (!id) return res.json({err: `ID ${id} invalid`});

				if (isNative) Model.findOne({'_id': new ObjectId(id)}, fnResult);
				else {
					query = Model.findOne({'_id': new ObjectId(id)});

					if (f) query.select(f);
					if (p) query.populate(p);
					if (dp) query.deepPopulate(dp.path, dp.option);

					query.exec(fnResult);
				}
				break;
			case 'findone':
				if (!(LEVEL_KEY&4)) return res.json({err: ERR.ELEVEL});

				if (isNative) Model.findOne(q, fnResult);
				else {
					query = Model.findOne(q);

					if (s) query.sort(s);
					if (sk) query.skip(sk);
					if (l) query.limit(l);
					if (f) query.select(f);
					if (p) query.populate(p);
					if (dp) query.deepPopulate(dp.path, dp.option);

					query.exec(fnResult);
				}
				break;
			case 'findoneandupdate':
				if (!(LEVEL_KEY&2)) return res.json({err: ERR.ELEVEL});

				if (!u) return res.json({err: `Update ${u} invalid`});

				const opt = o ? o : {'new': true};
				opt.new = true;

				Model.findOneAndUpdate(q, u, opt, fnResult);
				break;
			case 'count':
				if (!(LEVEL_KEY&4)) return res.json({err: ERR.ELEVEL});

				if (isNative) Model.count(q, fnResult);
				else {
					query = Model.count(q);

					if (s) query.sort(s);
					if (sk) query.skip(sk);
					if (l) query.limit(l);
					if (f) query.select(f);

					query.exec(fnResult);
				}
				break;
			case 'update':
				if (!(LEVEL_KEY&2)) return res.json({err: ERR.ELEVEL});

				if (!u) return res.json({err: `Update ${u} invalid`});
				Model.update(q, u, o ? o : null, resSoon ? fnVoid : fnResult);
				/*RES_SOON*/if (resSoon) return fnResult(null, 1);
				break;
			case 'updateid':
				if (!(LEVEL_KEY&2)) return res.json({err: ERR.ELEVEL});

				if (!id) return res.json({err: `ID ${id} invalid`});
				if (!u) return res.json({err: `Update ${u} invalid`});

				Model.findOneAndUpdate({'_id': new ObjectId(id)}, u, o ? o : null, fnResult);
				break;
			case 'aggregate':
				if (!(LEVEL_KEY&16)) return res.json({err: ERR.ELEVEL});

				let aggr = _parseBody(body);

				// console.log('### aggr=', JSON.stringify(aggr));
				// console.log('### match=', typeof aggr[0]['$match']['createdAt']['$gt']);

				if (isNative) Model.aggregate(aggr, fnResult);
				else {
					query = Model.aggregate(aggr);
					query.exec(fnResult);
				}
				break;
			default:
				if (_A.CMD && _A.CMD[actionLow]) {
					return _A.CMD[actionLow](req, res, {
						model: Model, 
						authKey: AUTH_KEY,
						levelKey: LEVEL_KEY
					});
				}

				return res.json({err: `Action ${action} not found`});
		}
	}

	let Model = null, Schema = null;
	switch (true) {
		case (!!_A.O.keystone): {
			const KSList = _A.O.keystone.list(model);
			Schema = KSList.schema;
			if (dp) Schema.plugin(_A.O.deepPopulate);
			Model = KSList.model;
		} break;
		default:{
			Schema = _A.O.schemaHash[model];

			if (!Schema) {
				let pathSchema = path.join(_A.O.schemaFolder, (rootmodel || model));
				if (fs.existsSync(pathSchema)) {
					Schema = require(pathSchema);
					if (dp) Schema.plugin(_A.O.deepPopulate);
					Model = _A.O.mongoose.model(model, Schema);
					return fnExec(Model);
				} else {
					return _A.O.mongoose.connection.db.collection(model, function (err, collection){
						if (collection) return fnExec(collection, true);
					});	
				}
			} else {
				if (dp) Schema.plugin(_A.O.deepPopulate);
				Model = _A.O.mongoose.model(model, Schema);
				return fnExec(Model);
			}
		}
	}
};

exports = module.exports = _A; 
