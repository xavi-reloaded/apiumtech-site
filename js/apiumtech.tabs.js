/**
 * Created by xavi on 28/12/14.
 */
/**
 * ----------------------------------------------------------------------
 * Apiumtech: Tabs component
 */
Apiumtech.define('tabs', function($, _) {
    'use strict';

    var api = {};
    var tram = window.tram;
    var $win = $(window);
    var $doc = $(document);
    var $tabs;
    var design;
    var env = Apiumtech.env;
    var safari = env.safari;
    var inApp = env();
    var tabAttr = 'data-w-tab';
    var namespace = '.w-tabs';
    var linkCurrent = 'w--current';
    var tabActive = 'w--tab-active';
    var ix = Apiumtech.ixEvents();

    // -----------------------------------
    // Module methods

    api.ready = api.design = api.preview = init;

    // -----------------------------------
    // Private methods

    function init() {
        design = inApp && Apiumtech.env('design');

        // Find all instances on the page
        $tabs = $doc.find(namespace);
        if (!$tabs.length) return;
        $tabs.each(build);
    }

    function build(i, el) {
        var $el = $(el);

        // Store state in data
        var data = $.data(el, namespace);
        if (!data) data = $.data(el, namespace, { el: $el, config: {} });
        data.current = null;
        data.menu = $el.children('.w-tab-menu');
        data.links = data.menu.children('.w-tab-link');
        data.content = $el.children('.w-tab-content');
        data.panes = data.content.children('.w-tab-pane');

        // Remove old events
        data.el.off(namespace);
        data.links.off(namespace);

        // Set config from data attributes
        configure(data);

        // Wire up events when not in design mode
        if (!design) {
            data.links.on('click' + namespace, linkSelect(data));

            // Trigger first intro event from current tab
            var $link = data.links.filter('.' + linkCurrent);
            var tab = $link.attr(tabAttr);
            tab && changeTab(data, { tab: tab, immediate: true });
        }
    }

    function configure(data) {
        var config = {};
        var old = data.config || {};

        // Set config options from data attributes
        config.easing = data.el.attr('data-easing') || 'ease';

        var intro = +data.el.attr('data-duration-in');
        intro = config.intro = intro === intro ? intro : 0;

        var outro = +data.el.attr('data-duration-out');
        outro = config.outro = outro === outro ? outro : 0;

        config.immediate = !intro && !outro;

        // Store config in data
        data.config = config;
    }

    function linkSelect(data) {
        return function(evt) {
            var tab = evt.currentTarget.getAttribute(tabAttr);
            tab && changeTab(data, { tab: tab });
        };
    }

    function changeTab(data, options) {
        options = options || {};

        var config = data.config;
        var easing = config.easing;
        var tab = options.tab;

        // Don't select the same tab twice
        if (tab === data.current) return;
        data.current = tab;

        // Select the current link
        data.links.each(function(i, el) {
            var $el = $(el);
            if (el.getAttribute(tabAttr) === tab) $el.addClass(linkCurrent).each(ix.intro);
            else if ($el.hasClass(linkCurrent)) $el.removeClass(linkCurrent).each(ix.outro);
        });

        // Find the new tab panes and keep track of previous
        var targets = [];
        var previous = [];
        data.panes.each(function(i, el) {
            var $el = $(el);
            if (el.getAttribute(tabAttr) === tab) {
                targets.push(el);
            } else if ($el.hasClass(tabActive)) {
                previous.push(el);
            }
        });

        var $targets = $(targets);
        var $previous = $(previous);

        // Switch tabs immediately and bypass transitions
        if (options.immediate || config.immediate) {
            $targets.addClass(tabActive).each(ix.intro);
            $previous.removeClass(tabActive);
            Apiumtech.redraw.up();
            return;
        }

        // Fade out the currently active tab before intro
        if ($previous.length && config.outro) {
            $previous.each(ix.outro);
            tram($previous)
                .add('opacity ' + config.outro + 'ms ' + easing, { fallback: safari })
                .start({ opacity: 0 })
                .then(intro);
        } else {
            // Skip the outro and play intro
            intro();
        }

        // Fade in the new target
        function intro() {
            // Clear previous active class + inline style
            $previous.removeClass(tabActive).removeAttr('style');

            // Add active class to new target
            $targets.addClass(tabActive).each(ix.intro);
            Apiumtech.redraw.up();

            // Set opacity immediately if intro is zero
            if (!config.intro) return tram($targets).set({ opacity: 1 });

            // Otherwise fade in opacity
            tram($targets)
                .set({ opacity: 0 })
                .redraw()
                .add('opacity ' + config.intro + 'ms ' + easing, { fallback: safari })
                .start({ opacity: 1 });
        }
    }

    // Export module
    return api;
});