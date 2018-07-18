const sinon = require('sinon');
const {Tracer, ExplicitContext, BatchRecorder} = require('zipkin');
const zipkinClient = require('../src/zipkinClient');

const mysqlConnectionOptions = {
  host: '127.0.0.1',
  database: 'mysql',
  user: 'mysql',
  password: process.env.MYSQL_PWD
};

const Mysql = require('mysql');

function getMysql(tracer) {
  return zipkinClient(tracer, Mysql);
}

function expectCorrectSpanData(span) {
  expect(span.name).to.equal(`query ${mysqlConnectionOptions.database}`);
  expect(span.localEndpoint.serviceName).to.equal('unknown');
  expect(span.remoteEndpoint.serviceName).to.equal('mysql');
  expect(span.remoteEndpoint.ipv4).to.equal(mysqlConnectionOptions.host);
}

describe('mysql interceptor', () => {
  it('should add zipkin annotations', (done) => {
    const logSpan = sinon.spy();

    const ctxImpl = new ExplicitContext();
    const recorder = new BatchRecorder({logger: {logSpan}});
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const mysql = (getMysql(tracer).createConnection)(mysqlConnectionOptions);
    mysql.connect();

    mysql.query('SELECT NOW()', () => {
      mysql.query('SELECT NOW()').on('end', () => {
        const query = Mysql.createQuery('SELECT NOW()');
        const result = mysql.query(query);
        result.on('end', () => {
          const spans = logSpan.args.map(arg => arg[0]);
          expect(spans).to.have.length(3);
          spans.forEach(expectCorrectSpanData);

          done();
        });
      });
    });
  });


  it('should annotate mysql errors', (done) => {
    const logSpan = sinon.spy();

    const ctxImpl = new ExplicitContext();
    const recorder = new BatchRecorder({logger: {logSpan}});
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const mysql = new (getMysql(tracer).createConnection)(mysqlConnectionOptions);
    mysql.connect();

    mysql.query('INVALID QUERY', (firstError) => {
      mysql.query('ERROR QUERY').on('error', (secondError) => {
        const query = Mysql.createQuery('FAILED QUERY()');
        const result = mysql.query(query);
        result.on('error', (thirdError) => {
          const errorTags = logSpan.args.map(arg => arg[0].tags.error);
          expect(errorTags[0]).to.equal(firstError.toString());
          expect(errorTags[1]).to.equal(secondError.toString());
          expect(errorTags[2]).to.equal(thirdError.toString());
        });

        done();
      });
    });
  });

  it('should run mysql calls', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const mysql = new (getMysql(tracer).createConnection)(mysqlConnectionOptions);
    mysql.connect();

    const queryText = 'SELECT ?';
    const queryValues = ['test'];
    mysql.query(queryText, queryValues, (error, firstResult) => {
      mysql.query({sql: queryText, values: queryValues},).on('result', (secondResult) => {
        const query = Mysql.createQuery(queryText, queryValues);
        const result = mysql.query(query);

        expect(query).to.equal(result);

        const submittableRows = [];
        query.on('result', (row) => submittableRows.push(row));
        query.on('end', () => {
          expect(firstResult[0].test).to.equal('test');
          expect(secondResult.test).to.equal('test');
          expect(submittableRows[0].test).to.equal('test');

          done();
        });
      });
    });
  });
});
