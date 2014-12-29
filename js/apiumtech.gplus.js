/**
 * Created by xavi on 28/12/14.
 */

/**
 * ----------------------------------------------------------------------
 * Apiumtech: Google+ widget
 */
Apiumtech.define('gplus', function($) {
    'use strict';

    var $doc = $(document);
    var api = {};
    var loaded;

    api.ready = function() {
        // Load Google+ API on the front-end
        if (!Apiumtech.env() && !loaded) init();
    };

    function init() {
        $doc.find('.w-widget-gplus').length && load();
    }

    function load() {
        loaded = true;
        $.getScript('https://apis.google.com/js/plusone.js');
    }

    // Export module
    return api;
});