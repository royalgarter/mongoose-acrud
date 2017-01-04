## Install

* npm i mongoose-acrud --save

## Feature list

 * ACRUD (Aggregate, Create, Read, Update, Delete)
 * Build for usage with [ExpressJS](http://expressjs.com/)
 * Support populate & deep populate
 * Support APIKEY for database / model


## Usage

(with basic Mongoose)
* Assume that folder that contain schema files is './schemas'

```javascript
const acrud = require('mongoose-acrud');
acrud.init({
  mongoose: mongoose,
  schemaFolder: path.join(__dirname, 'schemas')
});
app.post(acrud.ROUTE, acrud.controller);
```

(with [KeystoneJS](http://keystonejs.com/))
* Assume that you setup & init keystone somewhere else

```javascript
const keystone = require('keystone');
const acrud = require('mongoose-acrud');
acrud.init({
  keystone: keystone,
  mongoose: keystone.get('mongoose'),
});
app.post(acrud.ROUTE, acrud.controller);
```

See [Detail example with ExpressJS, Mongoose](https://github.com/royalgarter/mongoose-acrud/blob/master/test.js):

## POST Authorization using Header

```javascript
curl -X POST -H "Authorization: <YOUR_APIKEY>"
```

Authorization level by Bitwise value on process.env

* ACRUD: 11111 = 31
* Aggr: 10000 = 16
* Create: 01000 = 8
* Read: 00100 = 4
* Update: 00010 = 2
* Delete: 00001 = 1

### Example:

* Set Enviroment: MY_SUPER_APIKEY=31 (mean this key is fullaccess to every action)

Query by cURL
```javascript
curl -X POST -H "Authorization: MY_SUPER_APIKEY"
```

### Set permission for each Model on 3rd init parameter:

```javascript
process.env.MY_SUPER_APIKEY=31
acrud.init({
  keystone: keystone,
  mongoose: keystone.get('mongoose'),
}, null, {
  MY_SUPER_APIKEY: {
      MyModel: 4 // Read Only
    }
    // Other models are full access
});
```

## POST request using JSON for data/query/aggregate

```javascript
curl -X POST -H "Authorization: <YOUR_APIKEY>" -H "Content-Type: application/json"
```

**Available fields:**
```javascript
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
```

**Require fields per action:**

* save: body is whole object
* remove: body.q
* find|findone|count: body.q[s,sk,l,f,p,dp]
* findid|updateid: body.id
* update|findoneandupdate: body.q, body.u, body.o
* aggregate: body is whole aggregate object

**Notes:**

* query, update, aggregate automatically parse with ISO Date String reviver (2015-12-16T09:17:06.307Z)
* Regex is supported as below example format
```javascript
// Basic mongoose example
{ "name" : { $regex: /Ghost/, $options: 'gi' } }

// Use mongoose-acrud, value is replace with: new RegExp("Ghost")
{
  "q": { "name" : { $regex: "Ghost", $options: 'gi' } }
}
```

## Postman Example

Create:

```javascript
curl -X POST -H "Authorization: <YOUR_APIKEY>" -H "Content-Type: application/json" -d '{"key":"akey","value":"avalue"}' "http://localhost:3000/acrud/<YOUR_MODELNAME_CASE_SENSITIVE>/save"
```

Find:

```javascript
curl -X POST -H "Authorization: <YOUR_APIKEY>" -H "Content-Type: application/json" -d '{"q": {}}' "http://localhost:3000/acrud/<YOUR_MODELNAME_CASE_SENSITIVE>/find"
```

Update:

```javascript
curl -X POST -H "Authorization: <YOUR_APIKEY>" -H "Content-Type: application/json" -d '{
  "q": {"key":"key"},
  "u": {"value":"123456789"}
}
' "http://localhost:3000/acrud/<YOUR_MODELNAME_CASE_SENSITIVE>/update"
```

Find with deep populate:

```javascript
curl -X POST -H "Authorization: <YOUR_APIKEY>" -H "Content-Type: application/json" -d '{
  "q": {
    "localDateInt": 20160815
  },
  "l": 2,
  "dp": {
    "path": "skedId.aircraft",
    "select": "-_id code"
  }
}
' "http://localhost:3000/acrud/<YOUR_MODELNAME_CASE_SENSITIVE>/update"
```

## Deep Populate

* Assume that your models are

```javascript
PlanningGood.add({
  localDateInt: {
    type: Number,
    index: true
  },
  skedId: {
    type: Types.Relationship,
    ref: 'Sked',
    many: false,
    initial: true
  },
  aircraft: {
    type: Types.Relationship,
    ref: 'Aircraft',
    many: false,
    index: true
  }
});

Sked.add({
  skedId: {
    type: String,
    required: true,
    initial: true,
    index: true,
    unique: true
  },
  aircraft: {
    type: Types.Relationship,
    ref: 'Aircraft',
    index: true
  },
  flightNumber: {
    type: Types.Relationship,
    ref: 'Flight'
  }
});

Aircraft.add({
  code: {
    type: String,
    index: true,
    initial: true,
    required: true
  }
});

Flight.add({
  flightNumber: {
    type: String,
    required: true,
    index: true,
    initial: true
  }
});

```

"dp" fields could be

* String (field that need to be populate, could also multi level)
```javascript
"skedId"
"skedId.attds" // skedId will be populated first, then come the skedId.attds
```
* Single object that contain (path, select[optional]):  

```javascript
{
  "path": "skedId", 
  "select": "_id, code"
}
```
* Array of single object 

```javascript
[
  {
    "path": "skedId.aircraft",
    "select": "code"
  },
  {
    "path": "skedId.flightNumber",
    "select": "flightNumber"
  },
  {
    "path": "skedId.attds"
  }
]
```

### Credit:

 * [mongoose-deep-populate](https://www.npmjs.com/package/mongoose-deep-populate) 






















