/**
 * Created by xavi on 28/12/14.
 */

/**
 * ----------------------------------------------------------------------
 * Apiumtech: Navbar component
 */
Apiumtech.define('navbar', function($, _) {
    'use strict';

    var api = {};
    var tram = window.tram;
    var $win = $(window);
    var $doc = $(document);
    var $body;
    var $navbars;
    var designer;
    var inApp = Apiumtech.env();
    var overlay = '<div class="w-nav-overlay" data-wf-ignore />';
    var namespace = '.w-nav';
    var buttonOpen = 'w--open';
    var menuOpen = 'w--nav-menu-open';
    var linkOpen = 'w--nav-link-open';
    var ix = Apiumtech.ixEvents();

    // -----------------------------------
    // Module methods

    api.ready = api.design = api.preview = init;
    api.destroy = removeListeners;

    // -----------------------------------
    // Private methods

    function init() {
        designer = inApp && Apiumtech.env('design');
        $body = $(document.body);

        // Find all instances on the page
        $navbars = $doc.find(namespace);
        if (!$navbars.length) return;
        $navbars.each(build);

        // Wire events
        removeListeners();
        addListeners();


    }

    function removeListeners() {
        Apiumtech.resize.off(resizeAll);
    }

    function addListeners() {
        Apiumtech.resize.on(resizeAll);
    }

    function resizeAll() {
        $navbars.each(resize);
    }

    function build(i, el) {
        var $el = $(el);

        // Store state in data
        var data = $.data(el, namespace);
        if (!data) data = $.data(el, namespace, { open: false, el: $el, config: {} });
        data.menu = $el.find('.w-nav-menu');
        data.links = data.menu.find('.w-nav-link');
        data.dropdowns = data.menu.find('.w-dropdown');
        data.button = $el.find('.w-nav-button');
        data.container = $el.find('.w-container');
        data.outside = outside(data);

        // Remove old events
        data.el.off(namespace);
        data.button.off(namespace);
        data.menu.off(namespace);

        // Set config from data attributes
        configure(data);

        // Add events based on mode
        if (designer) {
            removeOverlay(data);
            data.el.on('setting' + namespace, handler(data));
        } else {
            addOverlay(data);
            data.button.on('tap' + namespace, toggle(data));
            data.menu.on('click' + namespace, 'a', navigate(data));
        }

        // Trigger initial resize
        resize(i, el);
    }

    function removeOverlay(data) {
        if (!data.overlay) return;
        close(data, true);
        data.overlay.remove();
        data.overlay = null;
    }

    function addOverlay(data) {
        if (data.overlay) return;
        data.overlay = $(overlay).appendTo(data.el);
        data.parent = data.menu.parent();
        close(data, true);
    }

    function configure(data) {
        var config = {};
        var old = data.config || {};

        // Set config options from data attributes
        var animation = config.animation = data.el.attr('data-animation') || 'default';
        config.animOver = /^over/.test(animation);
        config.animDirect = /left$/.test(animation) ? -1 : 1;

        // Re-open menu if the animation type changed
        if (old.animation != animation) {
            data.open && _.defer(reopen, data);
        }

        config.easing = data.el.attr('data-easing') || 'ease';
        config.easing2 = data.el.attr('data-easing2') || 'ease';

        var duration = data.el.attr('data-duration');
        config.duration = duration != null ? +duration : 400;

        config.docHeight = data.el.attr('data-doc-height');

        // Store config in data
        data.config = config;
    }

    function handler(data) {
        return function(evt, options) {
            options = options || {};
            var winWidth = $win.width();
            configure(data);
            options.open === true && open(data, true);
            options.open === false && close(data, true);
            // Reopen if media query changed after setting
            data.open && _.defer(function() {
                if (winWidth != $win.width()) reopen(data);
            });
        };
    }

    function reopen(data) {
        if (!data.open) return;
        close(data, true);
        open(data, true);
    }

    function toggle(data) {
        // Debounce toggle to wait for accurate open state
        return _.debounce(function(evt) {
            data.open ? close(data) : open(data);
        });
    }

    function navigate(data) {
        return function(evt) {
            var link = $(this);
            var href = link.attr('href');

            // Avoid late clicks on touch devices
            if (!Apiumtech.validClick(evt.currentTarget)) {
                evt.preventDefault();
                return;
            }

            // Close when navigating to an in-page anchor
            if (href && href.indexOf('#') === 0 && data.open) {
                close(data);
            }
        };
    }

    function outside(data) {
        // Unbind previous tap handler if it exists
        if (data.outside) $doc.off('tap' + namespace, data.outside);

        // Close menu when tapped outside, debounced to wait for state
        return _.debounce(function(evt) {
            if (!data.open) return;
            var menu = $(evt.target).closest('.w-nav-menu');
            if (!data.menu.is(menu)) {
                close(data);
            }
        });
    }

    function resize(i, el) {
        var data = $.data(el, namespace);
        // Check for collapsed state based on button display
        var collapsed = data.collapsed = data.button.css('display') != 'none';
        // Close menu if button is no longer visible (and not in designer)
        if (data.open && !collapsed && !designer) close(data, true);
        // Set max-width of links + dropdowns to match container
        if (data.container.length) {
            var updateEachMax = updateMax(data);
            data.links.each(updateEachMax);
            data.dropdowns.each(updateEachMax);
        }
        // If currently open, update height to match body
        if (data.open) {
            setOverlayHeight(data);
        }
    }

    var maxWidth = 'max-width';
    function updateMax(data) {
        // Set max-width of each element to match container
        var containMax = data.container.css(maxWidth);
        if (containMax == 'none') containMax = '';
        return function(i, link) {
            link = $(link);
            link.css(maxWidth, '');
            // Don't set the max-width if an upstream value exists
            if (link.css(maxWidth) == 'none') link.css(maxWidth, containMax);
        };
    }

    function open(data, immediate) {
        if (data.open) return;
        data.open = true;
        data.menu.addClass(menuOpen);
        data.links.addClass(linkOpen);
        data.button.addClass(buttonOpen);
        var config = data.config;
        var animation = config.animation;
        if (animation == 'none' || !tram.support.transform) immediate = true;
        var bodyHeight = setOverlayHeight(data);
        var menuHeight = data.menu.outerHeight(true);
        var menuWidth = data.menu.outerWidth(true);
        var navHeight = data.el.height();
        var navbarEl = data.el[0];
        resize(0, navbarEl);
        ix.intro(0, navbarEl);
        Apiumtech.redraw.up();

        // Listen for tap outside events
        if (!designer) $doc.on('tap' + namespace, data.outside);

        // No transition for immediate
        if (immediate) return;

        var transConfig = 'transform ' + config.duration + 'ms ' + config.easing;

        // Add menu to overlay
        if (data.overlay) {
            data.overlay.show().append(data.menu);
        }

        // Over left/right
        if (config.animOver) {
            tram(data.menu)
                .add(transConfig)
                .set({ x: config.animDirect * menuWidth, height: bodyHeight }).start({ x: 0 });
            data.overlay && data.overlay.width(menuWidth);
            return;
        }

        // Drop Down
        var offsetY = navHeight + menuHeight;
        tram(data.menu)
            .add(transConfig)
            .set({ y: -offsetY }).start({ y: 0 });
    }

    function setOverlayHeight(data) {
        var config = data.config;
        var bodyHeight = config.docHeight ? $doc.height() : $body.height();
        if (config.animOver) {
            data.menu.height(bodyHeight);
        } else if (data.el.css('position') != 'fixed') {
            bodyHeight -= data.el.height();
        }
        data.overlay && data.overlay.height(bodyHeight);
        return bodyHeight;
    }

    function close(data, immediate) {
        if (!data.open) return;
        data.open = false;
        data.button.removeClass(buttonOpen);
        var config = data.config;
        if (config.animation == 'none' || !tram.support.transform) immediate = true;
        var animation = config.animation;
        ix.outro(0, data.el[0]);

        // Stop listening for tap outside events
        $doc.off('tap' + namespace, data.outside);

        if (immediate) {
            tram(data.menu).stop();
            complete();
            return;
        }

        var transConfig = 'transform ' + config.duration + 'ms ' + config.easing2;
        var menuHeight = data.menu.outerHeight(true);
        var menuWidth = data.menu.outerWidth(true);
        var navHeight = data.el.height();

        // Over left/right
        if (config.animOver) {
            tram(data.menu)
                .add(transConfig)
                .start({ x: menuWidth * config.animDirect }).then(complete);
            return;
        }

        // Drop Down
        var offsetY = navHeight + menuHeight;
        tram(data.menu)
            .add(transConfig)
            .start({ y: -offsetY }).then(complete);

        function complete() {
            data.menu.height('');
            tram(data.menu).set({ x: 0, y: 0 });
            data.menu.removeClass(menuOpen);
            data.links.removeClass(linkOpen);
            if (data.overlay && data.overlay.children().length) {
                // Move menu back to parent
                data.menu.appendTo(data.parent);
                data.overlay.attr('style', '').hide();
            }

            // Trigger event so other components can hook in (dropdown)
            data.el.triggerHandler('w-close');
        }
    }

    // Export module
    return api;
});