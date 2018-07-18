const {Annotation, InetAddress} = require('zipkin');

function zipkinClient(tracer, Mysql, serviceName = tracer.localEndpoint.serviceName, remoteServiceName = 'mysql') {
  const ZipkinMysql = Object.assign({}, Mysql , {
    createConnection: function (config) {
      const Connection = Mysql.createConnection(config)
      const actualFn = Connection.query;

      Connection.query = function (sql, values, callback) {
        const id = tracer.createChildId();
        tracer.letId(id, () => {
          tracer.recordAnnotation(new Annotation.ClientSend());
          tracer.recordServiceName(serviceName);
          tracer.recordAnnotation(new Annotation.ServerAddr({
            serviceName: remoteServiceName,
            host: new InetAddress(this.config.host),
            port: this.config.port
          }));
          tracer.recordRpc(`query ${this.config.database}`);
        });

        const promise = actualFn.call(this, sql, values, callback);

        promise.on('end', function () {
          tracer.letId(id, () => {
            tracer.recordAnnotation(new Annotation.ClientRecv());
          });
        });

        promise.on('error', function (error) {
          tracer.letId(id, () => {
            tracer.recordBinary('error', error.toString());
            tracer.recordAnnotation(new Annotation.ClientRecv());
          });
        });
        return promise;
      };
      return Connection;
    }
  });
  return ZipkinMysql;
};

module.exports = zipkinClient
