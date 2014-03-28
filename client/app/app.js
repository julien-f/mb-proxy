'use strict';

//====================================================================

/* globals angular: false */
require('angular');

/* globals L: false */
require('mapbox.js');

//====================================================================

angular.module('app', []).directive('map', function () {
  return {
    restrict: 'E',
    replace: true,
    template: '<div class="map"></div>',
    link: function ($scope, $element /*, attrs*/) {
      L.mapbox.map($element[0], '/tiles.json');
    },
  };
});
