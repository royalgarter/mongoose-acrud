/*	ACRUD: 		11111	31
	Aggr: 		10000	16
	Create: 	01000	8
	Read: 		00100	4
	Update: 	00010	2
	Delete: 	00001	1
*/

var ERR = {
	API_WEAK: 'APIKEY IS NOT VALID',
	AUTH_ERROR: 'AUTHENTICATION ERROR'
};

var HELP_OBJ = {
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
	}
};

var _reviverISODate = function (key, value) { // new Date().toISOString() = "2015-12-16T09:17:06.307Z"
    var a;
    if (typeof value === 'string') {
        a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
        if (a) {
            return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
        }
    }
    return value;
}
var _parseJSON = function (obj, reviver) {
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
		console.log(ex + '\nObject is not valid JSON string:', obj);
		return null;
	}
}
var _parseDeepPop = function (obj) {

	var resPath = [];
	var resOption = null;

	var parseSingleObj = function (dp) {
		if (!dp.path) return;

		var path = dp.path; delete dp.path;

		resPath.push(path);
		resOption.populate[path] = dp;
	}

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
					for (var i = 0; i < obj.length; i++) {
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
}

var ACRUD = {};

ACRUD.OPTIONS = {
	keystone: null,
	express: null,
	mongoose: null,
	schemaFolder: null,
}

ACRUD.init = function(option) {
	ACRUD.OPTIONS.keystone = option.keystone || null;
	ACRUD.OPTIONS.mongoose = option.mongoose || require('mongoose');
	ACRUD.OPTIONS.schemaFolder = option.schemaFolder || './schemas/';
	ACRUD.OPTIONS.deepPopulate = require('mongoose-deep-populate')(ACRUD.OPTIONS.mongoose);
	ACRUD.OPTIONS.ObjectId = ACRUD.OPTIONS.mongoose.Types.ObjectId;
}

ACRUD.controller = function(req, res) {

	try {
		// var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		//**/console.log('ip', ip);

		var reqID = new Date().getTime();

		var action = req.params.action;
		var model = req.params.model;
		var root = req.params.root;
		var resSoon = req.params.ressoon == 'true'  || req.params.ressoon == 1;

		var body = req.body;
		var sentAPPNAME = req.headers.APPNAME || req.headers.appname;
		var sentAPIKEY = req.headers.authorization || body.apikey;
		sentAPIKEY = '_' + sentAPIKEY + '_'
		var lvAPIKEY = ~~process.env[sentAPIKEY] || 0;

		//**/console.log('body', body);
		//**/console.log('root', root);

		var id = body.id; //_id
		var q = body.q; //query
		var s = body.s; //sort
		var sk = body.sk; //skip
		var u = body.u; //update
		var o = body.o; //option
		var l = body.l; //limit
		var f = body.f; //field
		var p = body.p; //populate
		var dp = body.dp; //deep populate

		var KSList = ACRUD.OPTIONS.keystone.list(model);

		if (dp) {
			KSList.schema.plugin(ACRUD.OPTIONS.deepPopulate);
			dp = _parseDeepPop(dp);
			console.log('dp=', JSON.stringify(dp));
		}
		var Model = KSList.model;

		var key = [model,action,q,s,sk,u,o,l,f,p].join('_');

		var fnResult = function (err, result, result2) {
			if (err) console.log('MONGO_ERR=' + err);

			if (!res.headersSent)
				res.json({err: err, result: result, result2: result2});
		}

		var fnVoid = function (err, result, result2) {
			if (err) _utils.log('VOID_MONGO_ERR=' + err);
			console.log('result='+reqID, JSON.stringify([result, result2]));
		}

		if (!process.env[sentAPIKEY] || !lvAPIKEY) {
			console.log(ERR.AUTH_ERROR, sentAPPNAME, lvAPIKEY, JSON.stringify(body));
			return fnResult(ERR.AUTH_ERROR, null, null);
		}

		// /**/console.log('model='+model,'action='+action,'body='+reqID, JSON.stringify(body));

		switch (action.toLowerCase()) {
			case 'help':
				return fnResult(null, HELP_OBJ);
				break;
			case 'save':
				if (!(lvAPIKEY&8)) return res.json({err: ERR.API_WEAK});

				var obj = body.toObject ? body.toObject() : body;
				if (obj._id) {
					var mrId = obj._id;
					delete obj._id;delete obj.__v;
					Model.findOneAndUpdate({_id: mrId}, obj, {new: true, upsert: true}, function (err, doc) {
						return resSoon
							? fnVoid(err, doc, !err && doc ? 1 : 0)
							: fnResult(err, doc, !err && doc ? 1 : 0);
					});

				} else {
					var doc = new Model(obj);
					doc.save(resSoon ? fnVoid : fnResult);
				}
				/*RES_SOON*/if (resSoon) return fnResult(null, doc, 1);
				break;
			case 'remove':
				if (!(lvAPIKEY&1)) return res.json({err: ERR.API_WEAK});

				Model.remove(q, resSoon ? fnVoid : fnResult);
				/*RES_SOON*/if (resSoon) return fnResult(null, 1);
				break;
			case 'find':
				if (!(lvAPIKEY&4)) return res.json({err: ERR.API_WEAK});
				var query = Model.find(q);
				if (sk) query.skip(sk);
				if (l) query.limit(l);
				if (f) query.select(f);
				if (p) query.populate(p);
				if (dp) query.deepPopulate(dp.path, dp.option);
				if (s) query.sort(s);
				query.exec(fnResult);
				break;
			case 'findid':
				if (!(lvAPIKEY&4)) return res.json({err: ERR.API_WEAK});

				if (!id) return res.json({err: 'ID ' + id + ' invalid'});

				var query = Model.findOne({'_id': new ACRUD.OPTIONS.ObjectId(id)});

				if (f) query.select(f);
				if (p) query.populate(p);
				if (dp) query.deepPopulate(dp.path, dp.option);

				query.exec(fnResult);
				break;
			case 'findone':
				if (!(lvAPIKEY&4)) return res.json({err: ERR.API_WEAK});

				var query = Model.findOne(q);

				if (s) query.sort(s);
				if (sk) query.skip(sk);
				if (l) query.limit(l);
				if (f) query.select(f);
				if (p) query.populate(p);
				if (dp) query.deepPopulate(dp.path, dp.option);

				query.exec(fnResult);
				break;
			case 'findoneandupdate':
				if (!(lvAPIKEY&2)) return res.json({err: ERR.API_WEAK});

				if (!u) return res.json({err: 'Update ' + u + ' invalid'});

				var opt = o ? o : {'new': true};
				opt.new = true;

				Model.findOneAndUpdate(q, u, opt, fnResult);
				break;
			case 'count':
				if (!(lvAPIKEY&4)) return res.json({err: ERR.API_WEAK});

				var query = Model.count(q);

				if (s) query.sort(s);
				if (sk) query.skip(sk);
				if (l) query.limit(l);
				if (f) query.select(f);

				query.exec(fnResult);
				break;
			case 'update':
				if (!(lvAPIKEY&2)) return res.json({err: ERR.API_WEAK});

				if (!u) return res.json({err: 'Update ' + u + ' invalid'});
				Model.update(q, u, o ? o : null, resSoon ? fnVoid : fnResult);
				/*RES_SOON*/if (resSoon) return fnResult(null, 1);
				break;
			case 'updateid':
				if (!(lvAPIKEY&2)) return res.json({err: ERR.API_WEAK});

				if (!id) return res.json({err: 'ID ' + id + ' invalid'});
				if (!u) return res.json({err: 'Update ' + u + ' invalid'});

				Model.findOneAndUpdate({'_id': new ACRUD.OPTIONS.ObjectId(id)}, u, o ? o : null, fnResult);
				break;
			case 'aggregate':
				if (!(lvAPIKEY&4)) return res.json({err: ERR.API_WEAK});

				var aggr = body;
				if (typeof body == 'string') {
					aggr = _parseJSON(body, _reviverISODate);
				} else if (typeof body == 'object') {
					aggr = _parseJSON(JSON.stringify(body), _reviverISODate);
				}

				// _utils.log('### aggr=', _utils.strJSON(aggr));
				// _utils.log('### match=', typeof aggr[0]['$match']['createdAt']['$gt']);

				var query = Model.aggregate(aggr);
				query.exec(fnResult);
				break;
			default:
				return res.json({err: 'Action ' + action + ' not found'});
		}
	} catch (ex) {
		console.log(ex);
		return res.json({err: ex.toString() + ex.stack});
	}
};

exports = module.exports = ACRUD; 
