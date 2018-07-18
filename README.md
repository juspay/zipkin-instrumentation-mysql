# zipkin-instrumentation-mysql

This library will wrap [mysql](https://www.npmjs.com/package/mysql).

## Usage

```javascript
const {Tracer} = require('zipkin');
const Mysql = require('mysql');
const zipkinClient = require('zipkin-instrumentation-mysql');

const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const ZipkinMysql = zipkinClient(tracer, Mysql);

const connectionOptions = {
  user: 'mysql',
  password: 'secret',
  host: 'localhost',
  database: 'mydb'
};

const client = ZipkinMysql.createConnection(connectionOptions);

// Your application code here
client.query('SELECT NOW()', (err, result, fields) => {
  console.log(err, result, fields);
});
```
