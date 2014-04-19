'use strict';

//====================================================================

var http = require('http');
var https = require('https');
var url = require('url');

//--------------------------------------------------------------------

var _ = require('lodash');
var Promise = require('bluebird');

//====================================================================

var parseUrl = url.parse;

//====================================================================

// Reads a stream into a buffer.
exports.readStream =  function (stream) {
  return new Promise(function (resolve, reject) {
    var bufs = [];
    var n = 0;

    var clean;
    var listeners = {
      data: function (buf) {
        n += buf.length;
        bufs.push(buf);
      },
      end: function () {
        clean();
        resolve(Buffer.concat(bufs, n));
      },
      error: function (error) {
        clean();
        reject(error);
      },
    };

    // Function to unregister all listeners.
    clean = _.each.bind(null, listeners, function (listener, event) {
      stream.removeListener(event, listener);
    });

    // Registers all listeners.
    _.each(listeners, function (listener, event) {
      stream.on(event, listener);
    });
  });
};

//--------------------------------------------------------------------

// Proxies an http/https request to an URL.
//
// The response is returned.
exports.proxyRequest = function proxyRequest(request, url, opts) {
  return new Promise(function (resolve, reject) {
    opts || (opts = {});

    _.isString(url) && (url = parseUrl(url));
    var secure = url.protocol === 'https:';

    var proxyReq = (secure ? https : http).request({
      hostname: url.hostname,
      port: url.port || (secure ? 443 : 80),
      path: url.path || '/',
      headers: _.omit(request.headers, 'host'),
    });

    proxyReq.once('response', function (response) {
      var headers = response.headers;

      if (opts.allowedRedirections && headers.location)
      {
        --opts.allowedRedirections;
        return resolve(proxyRequest(request, headers.location, opts));
      }

      deferred.resolve(response);
    });
    proxyReq.once('error', deferred.reject.bind(deferred));

    request.pipe(proxyReq);
  });
};
