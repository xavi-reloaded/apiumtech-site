/**
 * Created by xavi on 28/12/14.
 */
/**
 * ----------------------------------------------------------------------
 * Apiumtech: Maps widget
 */
Apiumtech.define('maps', function($, _) {
    'use strict';

    var api = {};
    var $doc = $(document);
    var google = null;
    var $maps;
    var namespace = '.w-widget-map';

    // -----------------------------------
    // Module methods

    api.ready = function() {
        // Init Maps on the front-end
        if (!Apiumtech.env()) initMaps();
    };

    api.preview = function() {
        // Update active map nodes
        $maps = $doc.find(namespace);
        // Listen for resize events
        Apiumtech.resize.off(triggerRedraw);
        if ($maps.length) {
            Apiumtech.resize.on(triggerRedraw);
            triggerRedraw();
        }
    };

    api.design = function(evt) {
        // Update active map nodes
        $maps = $doc.find(namespace);
        // Stop listening for resize events
        Apiumtech.resize.off(triggerRedraw);
        // Redraw to account for page changes
        $maps.length && _.defer(triggerRedraw);
    };

    api.destroy = removeListeners;

    // -----------------------------------
    // Private methods

    // Trigger redraw in designer or preview mode
    function triggerRedraw() {
        if ($maps.length && Apiumtech.app) {
            $maps.each(Apiumtech.app.redrawElement);
        }
    }

    function initMaps() {
        $maps = $doc.find(namespace);
        if (!$maps.length) return;

        if (google === null) {
            $.getScript('https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false&callback=_wf_maps_loaded');
            window._wf_maps_loaded = mapsLoaded;
        } else {
            mapsLoaded();
        }

        function mapsLoaded() {
            window._wf_maps_loaded = function() {};
            google = window.google;
            $maps.each(renderMap);
            removeListeners();
            addListeners();
        }
    }

    function removeListeners() {
        Apiumtech.resize.off(resizeMaps);
        Apiumtech.redraw.off(resizeMaps);
    }

    function addListeners() {
        Apiumtech.resize.on(resizeMaps);
        Apiumtech.redraw.on(resizeMaps);
    }

    // Render map onto each element
    function renderMap(i, el) {
        var data = $(el).data();
        getState(el, data);
    }

    function resizeMaps() {
        $maps.each(resizeMap);
    }

    // Resize map when window changes
    function resizeMap(i, el) {
        var state = getState(el);
        google.maps.event.trigger(state.map, 'resize');
        state.setMapPosition();
    }

    // Store state on element data
    var store = 'w-widget-map';
    function getState(el, data) {

        var state = $.data(el, store);
        if (state) return state;

        var $el = $(el);
        state = $.data(el, store, {
            // Default options
            latLng: '51.511214,-0.119824',
            tooltip: '',
            style: 'roadmap',
            zoom: 12,

            // Marker
            marker: new google.maps.Marker({
                draggable: false
            }),

            // Tooltip infowindow
            infowindow: new google.maps.InfoWindow({
                disableAutoPan: true
            })
        });

        // LatLng center point
        var latLng = data.widgetLatlng || state.latLng;
        state.latLng = latLng;
        var coords = latLng.split(',');
        var latLngObj = new google.maps.LatLng(coords[0], coords[1]);
        state.latLngObj = latLngObj;

        // Disable touch events
        var mapDraggable = (Apiumtech.env.touch && data.disableTouch) ? false : true;

        // Map instance
        state.map = new google.maps.Map(el, {
            center: state.latLngObj,
            zoom: state.zoom,
            maxZoom: 18,
            mapTypeControl: false,
            panControl: false,
            streetViewControl: false,
            scrollwheel: !data.disableScroll,
            draggable: mapDraggable,
            zoomControl: true,
            zoomControlOptions: {
                style: google.maps.ZoomControlStyle.SMALL
            },
            mapTypeId: state.style
        });
        state.marker.setMap(state.map);

        // Set map position and offset
        state.setMapPosition = function() {
            state.map.setCenter(state.latLngObj);
            var offsetX = 0;
            var offsetY = 0;
            var padding = $el.css(['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']);
            offsetX -= parseInt(padding.paddingLeft, 10);
            offsetX += parseInt(padding.paddingRight, 10);
            offsetY -= parseInt(padding.paddingTop, 10);
            offsetY += parseInt(padding.paddingBottom, 10);
            if (offsetX || offsetY) {
                state.map.panBy(offsetX, offsetY);
            }
            $el.css('position', ''); // Remove injected position
        };

        // Fix position after first tiles have loaded
        google.maps.event.addListener(state.map, 'tilesloaded', function() {
            google.maps.event.clearListeners(state.map, 'tilesloaded');
            state.setMapPosition();
        });

        // Set initial position
        state.setMapPosition();
        state.marker.setPosition(state.latLngObj);
        state.infowindow.setPosition(state.latLngObj);

        // Draw tooltip
        var tooltip = data.widgetTooltip;
        if (tooltip) {
            state.tooltip = tooltip;
            state.infowindow.setContent(tooltip);
            if (!state.infowindowOpen) {
                state.infowindow.open(state.map, state.marker);
                state.infowindowOpen = true;
            }
        }

        // Map style - options.style
        var style = data.widgetStyle;
        if (style) {
            state.map.setMapTypeId(style);
        }

        // Zoom - options.zoom
        var zoom = data.widgetZoom;
        if (zoom != null) {
            state.zoom = zoom;
            state.map.setZoom(+zoom);
        }

        // Click marker to open in google maps
        google.maps.event.addListener(state.marker, 'click', function() {
            window.open('https://maps.google.com/?z=' + state.zoom + '&daddr=' + state.latLng);
        });

        return state;
    }

    // Export module
    return api;
});