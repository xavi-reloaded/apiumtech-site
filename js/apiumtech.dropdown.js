/**
 * Created by xavi on 28/12/14.
 */
/**
 * ----------------------------------------------------------------------
 * Apiumtech: Dropdown component
 */
Apiumtech.define('dropdown', function($, _) {
    'use strict';

    var api = {};
    var tram = window.tram;
    var $doc = $(document);
    var $dropdowns;
    var designer;
    var inApp = Apiumtech.env();
    var namespace = '.w-dropdown';
    var stateOpen = 'w--open';
    var closeEvent = 'w-close' + namespace;
    var ix = Apiumtech.ixEvents();

    // -----------------------------------
    // Module methods

    api.ready = api.design = api.preview = init;

    // -----------------------------------
    // Private methods

    function init() {
        designer = inApp && Apiumtech.env('design');

        // Find all instances on the page
        $dropdowns = $doc.find(namespace);
        $dropdowns.each(build);
    }

    function build(i, el) {
        var $el = $(el);

        // Store state in data
        var data = $.data(el, namespace);
        if (!data) data = $.data(el, namespace, { open: false, el: $el, config: {} });
        data.list = $el.children('.w-dropdown-list');
        data.toggle = $el.children('.w-dropdown-toggle');
        data.links = data.list.children('.w-dropdown-link');
        data.outside = outside(data);
        data.complete = complete(data);

        // Remove old events
        $el.off(namespace);
        data.toggle.off(namespace);

        // Set config from data attributes
        configure(data);

        if (data.nav) data.nav.off(namespace);
        data.nav = $el.closest('.w-nav');
        data.nav.on(closeEvent, handler(data));

        // Add events based on mode
        if (designer) {
            $el.on('setting' + namespace, handler(data));
        } else {
            data.toggle.on('tap' + namespace, toggle(data));
            $el.on(closeEvent, handler(data));
            // Close in preview mode
            inApp && close(data);
        }
    }

    function configure(data) {
        data.config = {
            hover: +data.el.attr('data-hover'),
            delay: +data.el.attr('data-delay') || 0
        };
    }

    function handler(data) {
        return function(evt, options) {
            options = options || {};

            if (evt.type == 'w-close') {
                return close(data);
            }

            if (evt.type == 'setting') {
                configure(data);
                options.open === true && open(data, true);
                options.open === false && close(data, true);
                return;
            }
        };
    }

    function toggle(data) {
        return _.debounce(function(evt) {
            data.open ? close(data) : open(data);
        });
    }

    function open(data, immediate) {
        if (data.open) return;
        closeOthers(data);
        data.open = true;
        data.list.addClass(stateOpen);
        data.toggle.addClass(stateOpen);
        ix.intro(0, data.el[0]);
        Apiumtech.redraw.up();

        // Listen for tap outside events
        if (!designer) $doc.on('tap' + namespace, data.outside);

        // Clear previous delay
        window.clearTimeout(data.delayId);
    }

    function close(data, immediate) {
        if (!data.open) return;
        data.open = false;
        var config = data.config;
        ix.outro(0, data.el[0]);

        // Stop listening for tap outside events
        $doc.off('tap' + namespace, data.outside);

        // Clear previous delay
        window.clearTimeout(data.delayId);

        // Skip delay during immediate
        if (!config.delay || immediate) return data.complete();

        // Optionally wait for delay before close
        data.delayId = window.setTimeout(data.complete, config.delay);
    }

    function closeOthers(data) {
        var self = data.el[0];
        $dropdowns.each(function(i, other) {
            var $other = $(other);
            if ($other.is(self) || $other.has(self).length) return;
            $other.triggerHandler(closeEvent);
        });
    }

    function outside(data) {
        // Unbind previous tap handler if it exists
        if (data.outside) $doc.off('tap' + namespace, data.outside);

        // Close menu when tapped outside
        return _.debounce(function(evt) {
            if (!data.open) return;
            var $target = $(evt.target);
            if ($target.closest('.w-dropdown-toggle').length) return;
            if (!data.el.is($target.closest(namespace))) {
                close(data);
            }
        });
    }

    function complete(data) {
        return function() {
            data.list.removeClass(stateOpen);
            data.toggle.removeClass(stateOpen);
        };
    }

    // Export module
    return api;
});