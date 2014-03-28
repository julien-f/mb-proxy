'use strict';

//====================================================================

var fs = require('fs');
var http = require('http');
var path = require('path');

//--------------------------------------------------------------------

var _ = require('lodash');
var connect = require('connect');
var mkdirp = require('mkdirp');
var Promise = require('bluebird');
var stripJsonComments = require('strip-json-comments');
var yargs = require('yargs');

//--------------------------------------------------------------------

var util = require('./util');

//====================================================================

var mkdirp = Promise.promisify(mkdirp);
var readFile = Promise.promisify(fs.readFile);
var writeFile = Promise.promisify(fs.writeFile);

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
      process.exit(0);
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
    var mapId = this.config.mapId;
    var cache = path.resolve(configPath, this.config.cache +'/'+ mapId);
    var tileServer = this.config.tileServer;
    _.each(config.mounts || {}, function (paths, mount) {
      _.each(_.isArray(paths) ? paths : [paths], function (mountPath) {
        app.use(mount, connect.static(
          path.resolve(configPath, mountPath)
        ));
      });
    });
    app.use(function (req, res, next) {
      if (req.method !== 'GET')
      {
        return next();
      }

      var url = req.url;

      if (url === '/tiles.json')
      {
        var body = JSON.stringify({
          tilejson: '2.0.0',
          tiles: [
            // All tiles requests should go through this server.
            '/tiles/{z}/{x}/{y}.png',
          ],
          scheme: "xyz",
          maxzoom: 19,
          minzoom: 0,
          autoscale: true,
          bounds: [
            -180, // West
            -85,  // South
            85,   // East
            180,  // North
          ],
          center: [
            0,
            0,
            4, // Zoom
          ],

          attribution: "<a href='https://www.mapbox.com/about/maps/' target='_blank'>&copy; Mapbox &copy; OpenStreetMap</a> <a class='mapbox-improve-map' href='https://www.mapbox.com/map-feedback/' target='_blank'>Improve this map</a>",

          // Used for search.
          //geocoder: 'http://a.tiles.mapbox.com/v3/'+ mapId +'/geocode/{query}.jsonp',

          // Used to display custom data on the map.
          //data: [
          //  'http://a.tiles.mapbox.com/v3/'+ mapId +'/markers.geojsonp',
          //],

          // Unknown.
          //private: true,
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        });
        res.write(body);
        return res.end();
      }

      var matches = /^\/tiles\/(.*)$/.exec(url);
      if (matches)
      {
        var tile = cache +'/'+ matches[1];

        // TODO: use streams if possible.
        // TODO: handle if-modified-since.
        return readFile(tile).catch(function () {
          return mkdirp(path.dirname(tile)).then(function () {
            // Disables browser caches.
            delete req.headers['if-modified-since'];
            delete req.headers['if-none-match'];

            return util.proxyRequest(req, {
              hostname: tileServer,
              path: '/v3/'+ mapId +'/'+ matches[1],
            }, {
              allowedRedirections: 10,
            });
          }).then(function (response) {
            if (response.statusCode !== 200)
            {
              throw response.statusCode;
            }

            return util.readStream(response);
          }).then(function (data) {
            return writeFile(tile, data).return(data);
          });
        }).then(function (data) {
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': data.length,
          });
          res.end(data);
        }).catch(function (error) {
          console.error('Error', error);
        });
      }

      next();
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
