/**
 * Created by xavi on 28/12/14.
 */
/**
 * ----------------------------------------------------------------------
 * Apiumtech: Touch events
 */
Apiumtech.define('touch', function($, _) {
    'use strict';

    var api = {};
    var fallback = !document.addEventListener;
    var getSelection = window.getSelection;

    // Fallback to click events in old IE
    if (fallback) {
        $.event.special.tap = { bindType: 'click', delegateType: 'click' };
    }

    api.init = function(el) {
        if (fallback) return null;
        el = typeof el === 'string' ? $(el).get(0) : el;
        return el ? new Touch(el) : null;
    };

    function Touch(el) {
        var active = false;
        var dirty = false;
        var useTouch = false;
        var thresholdX = Math.min(Math.round(window.innerWidth * 0.04), 40);
        var startX, startY, lastX;

        el.addEventListener('touchstart', start, false);
        el.addEventListener('touchmove', move, false);
        el.addEventListener('touchend', end, false);
        el.addEventListener('touchcancel', cancel, false);
        el.addEventListener('mousedown', start, false);
        el.addEventListener('mousemove', move, false);
        el.addEventListener('mouseup', end, false);
        el.addEventListener('mouseout', cancel, false);

        function start(evt) {
            // We don’t handle multi-touch events yet.
            var touches = evt.touches;
            if (touches && touches.length > 1) {
                return;
            }

            active = true;
            dirty = false;

            if (touches) {
                useTouch = true;
                startX = touches[0].clientX;
                startY = touches[0].clientY;
            } else {
                startX = evt.clientX;
                startY = evt.clientY;
            }

            lastX = startX;
        }

        function move(evt) {
            if (!active) return;

            if (useTouch && evt.type === 'mousemove') {
                evt.preventDefault();
                evt.stopPropagation();
                return;
            }

            var touches = evt.touches;
            var x = touches ? touches[0].clientX : evt.clientX;
            var y = touches ? touches[0].clientY : evt.clientY;

            var velocityX = x - lastX;
            lastX = x;

            // Allow swipes while pointer is down, but prevent them during text selection
            if (Math.abs(velocityX) > thresholdX && getSelection && getSelection() + '' === '') {
                triggerEvent('swipe', evt, { direction: velocityX > 0 ? 'right' : 'left' });
                cancel();
            }

            // If pointer moves more than 10px flag to cancel tap
            if (Math.abs(x - startX) > 10 || Math.abs(y - startY) > 10) {
                dirty = true;
            }
        }

        function end(evt) {
            if (!active) return;
            active = false;

            if (useTouch && evt.type === 'mouseup') {
                evt.preventDefault();
                evt.stopPropagation();
                useTouch = false;
                return;
            }

            if (!dirty) triggerEvent('tap', evt);
        }

        function cancel(evt) {
            active = false;
        }

        function destroy() {
            el.removeEventListener('touchstart', start, false);
            el.removeEventListener('touchmove', move, false);
            el.removeEventListener('touchend', end, false);
            el.removeEventListener('touchcancel', cancel, false);
            el.removeEventListener('mousedown', start, false);
            el.removeEventListener('mousemove', move, false);
            el.removeEventListener('mouseup', end, false);
            el.removeEventListener('mouseout', cancel, false);
            el = null;
        }

        // Public instance methods
        this.destroy = destroy;
    }

    // Wrap native event to supoprt preventdefault + stopPropagation
    function triggerEvent(type, evt, data) {
        var newEvent = $.Event(type, { originalEvent: evt });
        $(evt.target).trigger(newEvent, data);
    }

    // Listen for touch events on all nodes by default.
    api.instance = api.init(document);

    // Export module
    return api;
});