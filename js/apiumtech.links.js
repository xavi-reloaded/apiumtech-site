/**
 * Created by xavi on 28/12/14.
 */
/**
 * ----------------------------------------------------------------------
 * Apiumtech: Auto-select links to current page or section
 */
Apiumtech.define('links', function($, _) {
    'use strict';

    var api = {};
    var $win = $(window);
    var designer;
    var inApp = Apiumtech.env();
    var location = window.location;
    var linkCurrent = 'w--current';
    var validHash = /^#[a-zA-Z][\w:.-]*$/;
    var indexPage = /index\.(html|php)$/;
    var dirList = /\/$/;
    var anchors;
    var slug;

    // -----------------------------------
    // Module methods

    api.ready = api.design = api.preview = init;

    // -----------------------------------
    // Private methods

    function init() {
        designer = inApp && Apiumtech.env('design');
        slug = Apiumtech.env('slug') || location.pathname || '';

        // Reset scroll listener, init anchors
        Apiumtech.scroll.off(scroll);
        anchors = [];

        // Test all links for a selectable href
        var links = document.links;
        for (var i = 0; i < links.length; ++i) {
            select(links[i]);
        }

        // Listen for scroll if any anchors exist
        if (anchors.length) {
            Apiumtech.scroll.on(scroll);
            scroll();
        }
    }

    function select(link) {
        var href = link.getAttribute('href');

        // Ignore any hrefs with a colon to safely avoid all uri schemes
        if (href.indexOf(':') >= 0) return;

        var $link = $(link);

        // Check for valid hash links w/ sections and use scroll anchor
        if (href.indexOf('#') === 0 && validHash.test(href)) {
            // Ignore #edit anchors
            if (href === '#edit') return;
            var $section = $(href);
            $section.length && anchors.push({ link: $link, sec: $section, active: false });
            return;
        }

        // Ignore empty # links
        if (href === '#') return;

        // Determine whether the link should be selected
        var match = (link.href === location.href) || (href === slug) || (indexPage.test(href) && dirList.test(slug));
        setClass($link, linkCurrent, match);
    }

    function scroll() {
        var viewTop = $win.scrollTop();
        var viewHeight = $win.height();

        // Check each anchor for a section in view
        _.each(anchors, function(anchor) {
            var $link = anchor.link;
            var $section = anchor.sec;
            var top = $section.offset().top;
            var height = $section.outerHeight();
            var offset = viewHeight * 0.5;
            var active = ($section.is(':visible') &&
            top + height - offset >= viewTop &&
            top + offset <= viewTop + viewHeight);
            if (anchor.active === active) return;
            anchor.active = active;
            setClass($link, linkCurrent, active);
            if (designer) $link[0].__wf_current = active;
        });
    }

    function setClass($elem, className, add) {
        var exists = $elem.hasClass(className);
        if (add && exists) return;
        if (!add && !exists) return;
        add ? $elem.addClass(className) : $elem.removeClass(className);
    }

    // Export module
    return api;
});