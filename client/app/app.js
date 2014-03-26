'use strict';

//====================================================================

/* globals angular: false */
require('angular');

//require('angular-ui-router');

/* globals L: false */
require('mapbox.js');

//====================================================================

angular.module('app', [
  // 'ui.router',
]).directive('map', function () {
  return {
    restrict: 'E',
    replace: true,
    template: '<div class="map"></div>',
    link: function ($scope, $element /*, attrs*/) {
      L.mapbox.map($element[0], 'examples.map-9ijuk24y');
    },
  };
});
