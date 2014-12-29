/**
 * Created by xavi on 28/12/14.
 */


/**
 * ----------------------------------------------------------------------
 * Apiumtech: Interactions
 */
Apiumtech.define('ix', function($, _) {
    'use strict';

    var api = {};
    var designer;
    var $win = $(window);
    var namespace = '.w-ix';
    var tram = window.tram;
    var env = Apiumtech.env;
    var ios = env.ios;
    var inApp = env();
    var emptyFix = env.chrome && env.chrome < 35;
    var transNone = 'none 0s ease 0s';
    var introEvent = 'w-ix-intro' + namespace;
    var outroEvent = 'w-ix-outro' + namespace;
    var fallbackProps = /width|height/;
    var eventQueue = [];
    var $subs = $();
    var config = {};
    var anchors = [];
    var loads = [];
    var readys = [];
    var destroyed;

    // Component types and proxy selectors
    var components = {
        tabs: '.w-tab-link, .w-tab-pane',
        dropdown: '.w-dropdown',
        slider: '.w-slide',
        navbar: '.w-nav'
    };

    // -----------------------------------
    // Module methods

    api.init = function(list) {
        setTimeout(function() { configure(list); }, 1);
    };

    api.preview = function() {
        designer = false;
        setTimeout(function() { configure(window.__wf_ix); }, 1);
    };

    api.design = function() {
        designer = true;
        api.destroy();
    };

    api.destroy = function() {
        destroyed = true;
        $subs.each(teardown);
        Apiumtech.scroll.off(scroll);
        asyncEvents();
        anchors = [];
        loads = [];
        readys = [];
    };

    api.ready = function() {
        // Ready should only be used after destroy, as a way to re-init
        if (config && destroyed) {
            destroyed = false;
            init();
        }
    };

    api.run = run;
    api.events = {};
    api.style = inApp ? styleApp : stylePub;

    // -----------------------------------
    // Private methods

    function configure(list) {
        if (!list) return;

        // Map all interactions to a hash using slug as key.
        config = {};
        _.each(list, function(item) {
            config[item.slug] = item.value;
        });

        // Init ix after config
        init();
    }

    function init() {
        // Build each element's interaction keying from data attribute
        var els = $('[data-ix]');
        if (!els.length) return;
        els.each(teardown);
        els.each(build);

        // Listen for scroll events if any anchors exist
        if (anchors.length) {
            Apiumtech.scroll.on(scroll);
            setTimeout(scroll, 1);
        }

        // Handle loads or readys if they exist
        if (loads.length) Apiumtech.load(runLoads);
        if (readys.length) setTimeout(runReadys, 1);

        // Trigger queued events, must happen after init
        initEvents();
    }

    function build(i, el) {
        var $el = $(el);
        var id = $el.attr('data-ix');
        var ix = config[id];
        if (!ix) return;
        var triggers = ix.triggers;
        if (!triggers) return;

        // Set initial styles, unless we detect an iOS device + any non-iOS triggers
        var setStyles = !(ios && _.any(triggers, isNonIOS));
        if (setStyles) api.style($el, ix.style);

        _.each(triggers, function(trigger) {
            var state = {};
            var type = trigger.type;
            var stepsB = trigger.stepsB && trigger.stepsB.length;

            function runA() { run(trigger, $el, { group: 'A' }); }
            function runB() { run(trigger, $el, { group: 'B' }); }

            if (type == 'load') {
                (trigger.preload && !inApp) ? loads.push(runA) : readys.push(runA);
                return;
            }

            if (type == 'click') {
                $el.on('click' + namespace, function(evt) {
                    // Avoid late clicks on touch devices
                    if (!Apiumtech.validClick(evt.currentTarget)) return;

                    // Prevent default on empty hash urls
                    if ($el.attr('href') === '#') evt.preventDefault();

                    run(trigger, $el, { group: state.clicked ? 'B' : 'A' });
                    if (stepsB) state.clicked = !state.clicked;
                });
                $subs = $subs.add($el);
                return;
            }

            if (type == 'hover') {
                $el.on('mouseenter' + namespace, runA);
                $el.on('mouseleave' + namespace, runB);
                $subs = $subs.add($el);
                return;
            }

            // Check for a component proxy selector
            var proxy = components[type];
            if (proxy) {
                var $proxy = $el.closest(proxy);
                $proxy.on(introEvent, runA).on(outroEvent, runB);
                $subs = $subs.add($proxy);
                return;
            }

            // Ignore the following triggers on iOS devices
            if (ios) return;

            if (type == 'scroll') {
                anchors.push({
                    el: $el, trigger: trigger, state: { active: false },
                    offsetTop: convert(trigger.offsetTop),
                    offsetBot: convert(trigger.offsetBot)
                });
                return;
            }
        });
    }

    function isNonIOS(trigger) {
        return trigger.type == 'scroll';
    }

    function convert(offset) {
        if (!offset) return 0;
        offset = offset + '';
        var result = parseInt(offset, 10);
        if (result !== result) return 0;
        if (offset.indexOf('%') > 0) {
            result = result / 100;
            if (result >= 1) result = 0.999;
        }
        return result;
    }

    function teardown(i, el) {
        $(el).off(namespace);
    }

    function scroll() {
        var viewTop = $win.scrollTop();
        var viewHeight = $win.height();

        // Check each anchor for a valid scroll trigger
        var count = anchors.length;
        for (var i = 0; i < count; i++) {
            var anchor = anchors[i];
            var $el = anchor.el;
            var trigger = anchor.trigger;
            var stepsB = trigger.stepsB && trigger.stepsB.length;
            var state = anchor.state;
            var top = $el.offset().top;
            var height = $el.outerHeight();
            var offsetTop = anchor.offsetTop;
            var offsetBot = anchor.offsetBot;
            if (offsetTop < 1 && offsetTop > 0) offsetTop *= viewHeight;
            if (offsetBot < 1 && offsetBot > 0) offsetBot *= viewHeight;
            var active = (top + height - offsetTop >= viewTop && top + offsetBot <= viewTop + viewHeight);
            if (active === state.active) continue;
            if (active === false && !stepsB) continue;
            state.active = active;
            run(trigger, $el, { group: active ? 'A' : 'B' });
        }
    }

    function runLoads() {
        var count = loads.length;
        for (var i = 0; i < count; i++) {
            loads[i]();
        }
    }

    function runReadys() {
        var count = readys.length;
        for (var i = 0; i < count; i++) {
            readys[i]();
        }
    }

    function run(trigger, $el, opts, replay) {
        opts = opts || {};
        var done = opts.done;

        // Do not run in designer unless forced
        if (designer && !opts.force) return;

        // Operate on a set of grouped steps
        var group = opts.group || 'A';
        var loop = trigger['loop' + group];
        var steps = trigger['steps' + group];
        if (!steps || !steps.length) return;
        if (steps.length < 2) loop = false;

        // One-time init before any loops
        if (!replay) {

            // Find selector within element descendants, siblings, or query whole document
            var selector = trigger.selector;
            if (selector) {
                $el = (
                    trigger.descend ? $el.find(selector) :
                        trigger.siblings ? $el.siblings(selector) :
                            $(selector)
                );
                if (inApp) $el.attr('data-ix-affect', 1);
            }

            // Apply empty fix for certain Chrome versions
            if (emptyFix) $el.addClass('w-ix-emptyfix');
        }

        var _tram = tram($el);

        // Add steps
        var meta = {};
        for (var i = 0; i < steps.length; i++) {
            addStep(_tram, steps[i], meta);
        }

        function fin() {
            // Run trigger again if looped
            if (loop) return run(trigger, $el, opts, true);

            // Reset any 'auto' values
            if (meta.width == 'auto') _tram.set({ width: 'auto' });
            if (meta.height == 'auto') _tram.set({ height: 'auto' });

            // Run callback
            done && done();
        }

        // Add final step to queue if tram has started
        meta.start ? _tram.then(fin) : fin();
    }

    function addStep(_tram, step, meta) {
        var addMethod = 'add';
        var startMethod = 'start';

        // Once the transition has started, we will always use then() to add to the queue.
        if (meta.start) addMethod = startMethod = 'then';

        // Parse transitions string on the current step
        var transitions = step.transition;
        if (transitions) {
            transitions = transitions.split(',');
            for (var i = 0; i < transitions.length; i++) {
                var transition = transitions[i];
                var options = fallbackProps.test(transition) ? { fallback: true } : null;
                _tram[addMethod](transition, options);
            }
        }

        // Build a clean object to pass to the tram method
        var clean = tramify(step) || {};

        // Store last width and height values
        if (clean.width != null) meta.width = clean.width;
        if (clean.height != null) meta.height = clean.height;

        // When transitions are not present, set values immediately and continue queue.
        if (transitions == null) {

            // If we have started, wrap set() in then() and reset queue
            if (meta.start) {
                _tram.then(function() {
                    var queue = this.queue;
                    this.set(clean);
                    if (clean.display) {
                        _tram.redraw();
                        Apiumtech.redraw.up();
                    }
                    this.queue = queue;
                    this.next();
                });
            } else {
                _tram.set(clean);

                // Always redraw after setting display
                if (clean.display) {
                    _tram.redraw();
                    Apiumtech.redraw.up();
                }
            }

            // Use the wait() method to kick off queue in absence of transitions.
            var wait = clean.wait;
            if (wait != null) {
                _tram.wait(wait);
                meta.start = true;
            }

            // Otherwise, when transitions are present
        } else {

            // If display is present, handle it separately
            if (clean.display) {
                var display = clean.display;
                delete clean.display;

                // If we've already started, we need to wrap it in a then()
                if (meta.start) {
                    _tram.then(function() {
                        var queue = this.queue;
                        this.set({ display: display }).redraw();
                        Apiumtech.redraw.up();
                        this.queue = queue;
                        this.next();
                    });
                } else {
                    _tram.set({ display: display }).redraw();
                    Apiumtech.redraw.up();
                }
            }

            // Otherwise, start a transition using the current start method.
            _tram[startMethod](clean);
            meta.start = true;
        }
    }

    // (In app) Set styles immediately and manage upstream transition
    function styleApp(el, data) {
        var _tram = tram(el);

        // Get computed transition value
        el.css('transition', '');
        var computed = el.css('transition');

        // If computed is disabled, clear upstream
        if (computed === transNone) computed = _tram.upstream = null;

        // Disable upstream temporarily
        _tram.upstream = transNone;

        // Set values immediately
        _tram.set(tramify(data));

        // Only restore upstream in preview mode
        _tram.upstream = computed;
    }

    // (Published) Set styles immediately on specified jquery element
    function stylePub(el, data) {
        tram(el).set(tramify(data));
    }

    // Build a clean object for tram
    function tramify(obj) {
        var result = {};
        var found = false;
        for (var x in obj) {
            if (x === 'transition') continue;
            result[x] = obj[x];
            found = true;
        }
        // If empty, return null for tram.set/stop compliance
        return found ? result : null;
    }

    // Events used by other webflow modules
    var events = {
        reset: function(i, el) {
            el.__wf_intro = null;
        },
        intro: function(i, el) {
            if (el.__wf_intro) return;
            el.__wf_intro = true;
            $(el).triggerHandler(introEvent);
        },
        outro: function(i, el) {
            if (!el.__wf_intro) return;
            el.__wf_intro = null;
            $(el).triggerHandler(outroEvent);
        }
    };

    // Trigger events in queue + point to sync methods
    function initEvents() {
        var count = eventQueue.length;
        for (var i = 0; i < count; i++) {
            var memo = eventQueue[i];
            memo[0](0, memo[1]);
        }
        eventQueue = [];
        $.extend(api.events, events);
    }

    // Replace events with async methods prior to init
    function asyncEvents() {
        _.each(events, function(func, name) {
            api.events[name] = function(i, el) {
                eventQueue.push([func, el]);
            };
        });
    }

    asyncEvents();

    // Export module
    return api;
});