/**
 * Created by xavi on 28/12/14.
 */
/**
 * ----------------------------------------------------------------------
 * Apiumtech: Smooth scroll
 */
Apiumtech.define('scroll', function($) {
    'use strict';

    var $doc = $(document);
    var win = window;
    var loc = win.location;
    var history = win.history;
    var validHash = /^[a-zA-Z][\w:.-]*$/;

    function ready() {
        // If hash is already present on page load, scroll to it right away
        if (loc.hash) {
            findEl(loc.hash.substring(1));
        }

        // When clicking on a link, check if it links to another part of the page
        $doc.on('click', 'a', function(e) {
            if (Apiumtech.env('design')) {
                return;
            }

            // Ignore links being used by jQuery mobile
            if (window.$.mobile && $(e.currentTarget).hasClass('ui-link')) return;

            // Ignore empty # links
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
                return;
            }

            var hash = this.hash ? this.hash.substring(1) : null;
            if (hash) {
                findEl(hash, e);
            }
        });
    }

    function findEl(hash, e) {
        if (!validHash.test(hash)) return;

        var el = $('#' + hash);
        if (!el.length) {
            return;
        }

        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Push new history state
        if (loc.hash !== hash && history && history.pushState) {
            var oldHash = history.state && history.state.hash;
            if (oldHash !== hash) {
                history.pushState({ hash: hash }, '', '#' + hash);
            }
        }

        // If a fixed header exists, offset for the height
        var header = $('header, body > .header, body > .w-nav');
        var offset = header.css('position') === 'fixed' ? header.outerHeight() : 0;

        win.setTimeout(function() {
            scroll(el, offset);
        }, e ? 0 : 300);
    }

    function scroll(el, offset){
        var start = $(win).scrollTop();
        var end = el.offset().top - offset;

        // If specified, scroll so that the element ends up in the middle of the viewport
        if (el.data('scroll') == 'mid') {
            var available = $(win).height() - offset;
            var elHeight = el.outerHeight();
            if (elHeight < available) {
                end -= Math.round((available - elHeight) / 2);
            }
        }

        var mult = 1;

        // Check for custom time multiplier on the body and the element
        $('body').add(el).each(function(i) {
            var time = parseFloat($(this).attr('data-scroll-time'), 10);
            if (!isNaN(time) && (time === 0 || time > 0)) {
                mult = time;
            }
        });

        // Shim for IE8 and below
        if (!Date.now) {
            Date.now = function() { return new Date().getTime(); };
        }

        var clock = Date.now();
        var animate = win.requestAnimationFrame || win.mozRequestAnimationFrame || win.webkitRequestAnimationFrame || function(fn) { win.setTimeout(fn, 15); };
        var duration = (472.143 * Math.log(Math.abs(start - end) +125) - 2000) * mult;

        var step = function() {
            var elapsed = Date.now() - clock;
            win.scroll(0, getY(start, end, elapsed, duration));

            if (elapsed <= duration) {
                animate(step);
            }
        };

        step();
    }

    function getY(start, end, elapsed, duration) {
        if (elapsed > duration) {
            return end;
        }

        return start + (end - start) * ease(elapsed / duration);
    }

    function ease(t) {
        return t<0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
    }

    // Export module
    return { ready: ready };
});