'use strict';

//====================================================================

var fs = require('fs');
var http = require('http');
var path = require('path');

//====================================================================

var _ = require('lodash');
var connect = require('connect');
var Promise = require('bluebird');
var stripJsonComments = require('strip-json-comments');
var yargs = require('yargs');

//====================================================================

var readFile = Promise.promisify(fs.readFile);

var waitEvent = function (emitter, name) {
  var deferred = Promise.defer();

  emitter.once(name, function () {
    deferred.resolve(
      arguments.length > 1 ?
      [].splice.call(arguments) :
      arguments[0]
    );
  });

  emitter.once('error', function () {
    deferred.reject(
      arguments.length > 1 ?
      [].splice.call(arguments) :
      arguments[0]
    );
  });

  return deferred.promise;
};

//====================================================================

module.exports = function (argv) {
  return Promise.bind({}).then(function () {
    var opts = this.opts = yargs
      .usage('Usage: $0 [<option>...]')
      .options({
        h: {
          alias: 'help',
          boolean: true,
          describe: 'display this help message',
        },
        v: {
          alias: 'version',
          boolean: true,
          describe: 'display the version number',
        },
        c: {
          alias: 'config',
          describe: 'changes the configuration file to use',
        }
      })
      .check(function (opts) {
        if (opts.help)
        {
          throw '';
        }
      })
      .parse(argv)
    ;

    if (opts.version)
    {
      var pkg = require('../package');
      console.log('MapBox-Proxy version', pkg.version);
    }

    // Reads the configuration file.
    this.configFile = opts.config || __dirname +'/../config.json';
    this.configPath = path.dirname(this.configFile);
    return readFile(this.configFile);
  }).then(function (config) {
    // Parses it.
    return JSON.parse(stripJsonComments(config.toString()));
  }).catch(function (error) {
    console.error(
      'Error while reading the config file:',
      error.message || error
    );
    console.error('Continuing with an empty configuration.');

    this.configFile = null;
    this.configPath = __dirname;
    return {};
  }).then(function (config) {
    // Inserts the configuration in the current context.
    this.config = config;

    // Creates the connect application.
    var app = connect();
    var configPath = this.configPath;
    _.each(config.mounts || {}, function (paths, mount) {
      _.each(_.isArray(paths) ? paths : [paths], function (mountPath) {
        app.use(mount, connect.static(
          path.resolve(configPath, mountPath)
        ));
      });
    });

    // Creates the HTTP server.
    var server = this.server = http.createServer(app);

    // Starts to listen.
    server.listen(
      'port' in config ? config.port : 80,
      'host' in config ? config.host : 'localhost'
    );
    return waitEvent(server, 'listening');
  }).then(function () {
    var address = this.server.address();
    if (!_.isString(address))
    {
      address = 'http://'+ address.address +':'+ address.port;
    }

    console.log('Server listening on', address);
  }).bind();
};
