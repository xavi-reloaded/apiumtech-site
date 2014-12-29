/**
 * Created by xavi on 28/12/14.
 */
/**
 * ----------------------------------------------------------------------
 * Apiumtech: Lightbox component
 */
var lightbox = (function (window, document, $, tram, undefined) {
    'use strict';

    var isArray = Array.isArray;
    var namespace = 'w-lightbox';
    var prefix = namespace + '-';
    var prefixRegex = /(^|\s+)/g;

    // Array of objects describing items to be displayed.
    var items = [];

    // Index of the currently displayed item.
    var currentIndex;

    // Object holding references to jQuery wrapped nodes.
    var $refs;

    // Instance of Spinner
    var spinner;

    function lightbox(thing, index) {
        items = isArray(thing) ? thing : [thing];

        if (!$refs) {
            lightbox.build();
        }

        if (items.length > 1) {
            $refs.items = $refs.empty;

            items.forEach(function (item) {
                var $thumbnail = dom('thumbnail');
                var $item = dom('item').append($thumbnail);

                $refs.items = $refs.items.add($item);

                loadImage(item.thumbnailUrl || item.url, function ($image) {
                    if ($image.prop('width') > $image.prop('height')) {
                        addClass($image, 'wide');
                    }
                    else {
                        addClass($image, 'tall');
                    }
                    $thumbnail.append(addClass($image, 'thumbnail-image'));
                });
            });

            $refs.strip.empty().append($refs.items);
            addClass($refs.content, 'group');
        }

        tram(
            // Focus the lightbox to receive keyboard events.
            removeClass($refs.lightbox, 'hide').focus()
        )
            .add('opacity .3s')
            .start({opacity: 1});

        // Prevent document from scrolling while lightbox is active.
        addClass($refs.html, 'noscroll');

        return lightbox.show(index || 0);
    }

    /**
     * Creates the DOM structure required by the lightbox.
     */
    lightbox.build = function () {
        // In case `build` is called more than once.
        lightbox.destroy();

        $refs = {
            html: $(document.documentElement),
            // Empty jQuery object can be used to build new ones using `.add`.
            empty: $()
        };

        $refs.arrowLeft = dom('control left inactive');
        $refs.arrowRight = dom('control right inactive');
        $refs.close = dom('control close');

        $refs.spinner = dom('spinner');
        $refs.strip = dom('strip');

        spinner = new Spinner($refs.spinner, prefixed('hide'));

        $refs.content = dom('content')
            .append($refs.spinner, $refs.arrowLeft, $refs.arrowRight, $refs.close);

        $refs.container = dom('container')
            .append($refs.content, $refs.strip);

        $refs.lightbox = dom('backdrop hide')
            .append($refs.container);

        // We are delegating events for performance reasons and also
        // to not have to reattach handlers when images change.
        $refs.strip.on('tap', selector('item'), itemTapHandler);
        $refs.content
            .on('swipe', swipeHandler)
            .on('tap', selector('left'), handlerPrev)
            .on('tap', selector('right'), handlerNext)
            .on('tap', selector('close'), handlerHide)
            .on('tap', selector('image, caption'), handlerNext);
        $refs.container
            .on('tap', selector('view, strip'), handlerHide)
            // Prevent images from being dragged around.
            .on('dragstart', selector('img'), preventDefault);
        $refs.lightbox
            .on('keydown', keyHandler)
            // IE loses focus to inner nodes without letting us know.
            .on('focusin', focusThis);

        // The `tabindex` attribute is needed to enable non-input elements
        // to receive keyboard events.
        $('body').append($refs.lightbox.prop('tabIndex', 0));

        return lightbox;
    };

    /**
     * Dispose of DOM nodes created by the lightbox.
     */
    lightbox.destroy = function () {
        if (!$refs) {
            return;
        }

        // Event handlers are also removed.
        $refs.lightbox.remove();
        $refs = undefined;
    };

    /**
     * Show a specific item.
     */
    lightbox.show = function (index) {
        // Bail if we are already showing this item.
        if (index === currentIndex) {
            return;
        }

        var item = items[index];
        var previousIndex = currentIndex;
        currentIndex = index;
        spinner.show();

        // For videos, load an empty SVG with the video dimensions to preserve
        // the video’s aspect ratio while being responsive.
        var url = item.html && svgDataUri(item.width, item.height) || item.url;
        loadImage(url, function ($image) {
            // Make sure this is the last item requested to be shown since
            // images can finish loading in a different order than they were
            // requested in.
            if (index != currentIndex) {
                return;
            }

            var $figure = dom('figure', 'figure').append(addClass($image, 'image'));
            var $frame = dom('frame').append($figure);
            var $newView = dom('view').append($frame);
            var $html, isIframe;

            if (item.html) {
                $html = $(item.html);
                isIframe = $html.is('iframe');

                if (isIframe) {
                    $html.on('load', transitionToNewView);
                }

                $figure.append(addClass($html, 'embed'));
            }

            if (item.caption) {
                $figure.append(dom('caption', 'figcaption').text(item.caption));
            }

            $refs.spinner.before($newView);

            if (!isIframe) {
                transitionToNewView();
            }

            function transitionToNewView() {
                spinner.hide();

                if (index != currentIndex) {
                    $newView.remove();
                    return;
                }


                toggleClass($refs.arrowLeft, 'inactive', index <= 0);
                toggleClass($refs.arrowRight, 'inactive', index >= items.length - 1);

                if ($refs.view) {
                    tram($refs.view)
                        .add('opacity .3s')
                        .start({opacity: 0})
                        .then(remover($refs.view));

                    tram($newView)
                        .add('opacity .3s')
                        .add('transform .3s')
                        .set({x: index > previousIndex ? '80px' : '-80px'})
                        .start({opacity: 1, x: 0});
                }
                else {
                    $newView.css('opacity', 1);
                }

                $refs.view = $newView;

                if ($refs.items) {
                    // Mark proper thumbnail as active
                    addClass(removeClass($refs.items, 'active').eq(index), 'active');
                }
            }
        });

        return lightbox;
    };

    /**
     * Hides the lightbox.
     */
    lightbox.hide = function () {
        tram($refs.lightbox)
            .add('opacity .3s')
            .start({opacity: 0})
            .then(hideLightbox);

        return lightbox;
    };

    lightbox.prev = function () {
        if (currentIndex > 0) {
            lightbox.show(currentIndex - 1);
        }
    };

    lightbox.next = function () {
        if (currentIndex < items.length - 1) {
            lightbox.show(currentIndex + 1);
        }
    };

    function createHandler(action) {
        return function (event) {
            // We only care about events triggered directly on the bound selectors.
            if (this != event.target) {
                return;
            }

            event.stopPropagation();
            event.preventDefault();

            action();
        };
    }

    var handlerPrev = createHandler(lightbox.prev);
    var handlerNext = createHandler(lightbox.next);
    var handlerHide = createHandler(lightbox.hide);

    var itemTapHandler = function(event) {
        var index = $(this).index();

        event.preventDefault();
        lightbox.show(index);
    };

    var swipeHandler = function (event, data) {
        // Prevent scrolling.
        event.preventDefault();

        if (data.direction == 'left') {
            lightbox.next();
        }
        else if (data.direction == 'right') {
            lightbox.prev();
        }
    };

    var focusThis = function () {
        this.focus();
    };

    function preventDefault(event) {
        event.preventDefault();
    }

    function keyHandler(event) {
        var keyCode = event.keyCode;

        // [esc]
        if (keyCode == 27) {
            lightbox.hide();
        }

        // [◀]
        else if (keyCode == 37) {
            lightbox.prev();
        }

        // [▶]
        else if (keyCode == 39) {
            lightbox.next();
        }
    }

    function hideLightbox() {
        removeClass($refs.html, 'noscroll');
        addClass($refs.lightbox, 'hide');
        $refs.strip.empty();
        $refs.view && $refs.view.remove();

        // Reset some stuff
        removeClass($refs.content, 'group');
        addClass($refs.arrowLeft, 'inactive');
        addClass($refs.arrowRight, 'inactive');

        currentIndex = $refs.view = undefined;
    }

    function loadImage(url, callback) {
        var $image = dom('img', 'img');

        $image.one('load', function () {
            callback($image);
        });

        // Start loading image.
        $image.attr('src', url);

        return $image;
    }

    function remover($element) {
        return function () {
            $element.remove();
        };
    }

    /**
     * Spinner
     */
    function Spinner($spinner, className, delay) {
        this.$element = $spinner;
        this.className = className;
        this.delay = delay || 200;
        this.hide();
    }

    Spinner.prototype.show = function () {
        var spinner = this;

        // Bail if we are already showing the spinner.
        if (spinner.timeoutId) {
            return;
        }

        spinner.timeoutId = setTimeout(function () {
            spinner.$element.removeClass(spinner.className);
            delete spinner.timeoutId;
        }, spinner.delay);
    };

    Spinner.prototype.hide = function () {
        var spinner = this;
        if (spinner.timeoutId) {
            clearTimeout(spinner.timeoutId);
            delete spinner.timeoutId;
            return;
        }

        spinner.$element.addClass(spinner.className);
    };

    function prefixed(string, isSelector) {
        return string.replace(prefixRegex, (isSelector ? ' .' : ' ') + prefix);
    }

    function selector(string) {
        return prefixed(string, true);
    }

    /**
     * jQuery.addClass with auto-prefixing
     * @param  {jQuery} Element to add class to
     * @param  {string} Class name that will be prefixed and added to element
     * @return {jQuery}
     */
    function addClass($element, className) {
        return $element.addClass(prefixed(className));
    }

    /**
     * jQuery.removeClass with auto-prefixing
     * @param  {jQuery} Element to remove class from
     * @param  {string} Class name that will be prefixed and removed from element
     * @return {jQuery}
     */
    function removeClass($element, className) {
        return $element.removeClass(prefixed(className));
    }

    /**
     * jQuery.toggleClass with auto-prefixing
     * @param  {jQuery}  Element where class will be toggled
     * @param  {string}  Class name that will be prefixed and toggled
     * @param  {boolean} Optional boolean that determines if class will be added or removed
     * @return {jQuery}
     */
    function toggleClass($element, className, shouldAdd) {
        return $element.toggleClass(prefixed(className), shouldAdd);
    }

    /**
     * Create a new DOM element wrapped in a jQuery object,
     * decorated with our custom methods.
     * @param  {string} className
     * @param  {string} [tag]
     * @return {jQuery}
     */
    function dom(className, tag) {
        return addClass($(document.createElement(tag || 'div')), className);
    }

    function isObject(value) {
        return typeof value == 'object' && null != value && !isArray(value);
    }

    function svgDataUri(width, height) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"/>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURI(svg);
    }

    // Compute some dimensions manually for iOS, because of buggy support for VH.
    // Also, Android built-in browser does not support viewport units.
    (function () {
        var ua = window.navigator.userAgent;
        var iOS = /(iPhone|iPod|iPad).+AppleWebKit/i.test(ua);
        var android = ua.indexOf('Android ') > -1 && ua.indexOf('Chrome') == -1;

        if (!iOS && !android) {
            return;
        }

        var styleNode = document.createElement('style');
        document.head.appendChild(styleNode);
        window.addEventListener('orientationchange', refresh, true);

        function refresh() {
            var vh = window.innerHeight;
            var vw = window.innerWidth;
            var content =
                '.w-lightbox-content, .w-lightbox-view, .w-lightbox-view:before {' +
                'height:' + vh + 'px' +
                '}' +
                '.w-lightbox-view {' +
                'width:' + vw + 'px' +
                '}' +
                '.w-lightbox-group, .w-lightbox-group .w-lightbox-view, .w-lightbox-group .w-lightbox-view:before {' +
                'height:' + (0.86 * vh) + 'px' +
                '}' +
                '.w-lightbox-image {' +
                'max-width:' + vw + 'px;' +
                'max-height:' + vh + 'px' +
                '}' +
                '.w-lightbox-group .w-lightbox-image {' +
                'max-height:' + (0.86 * vh) + 'px' +
                '}' +
                '.w-lightbox-strip {' +
                'padding: 0 ' + (0.01 * vh) + 'px' +
                '}' +
                '.w-lightbox-item {' +
                'width:' + (0.1 * vh) + 'px;' +
                'padding:' + (0.02 * vh) + 'px ' + (0.01 * vh) + 'px' +
                '}' +
                '.w-lightbox-thumbnail {' +
                'height:' + (0.1 * vh) + 'px' +
                '}' +
                '@media (min-width: 768px) {' +
                '.w-lightbox-content, .w-lightbox-view, .w-lightbox-view:before {' +
                'height:' + (0.96 * vh) + 'px' +
                '}' +
                '.w-lightbox-content {' +
                'margin-top:' + (0.02 * vh) + 'px' +
                '}' +
                '.w-lightbox-group, .w-lightbox-group .w-lightbox-view, .w-lightbox-group .w-lightbox-view:before {' +
                'height:' + (0.84 * vh) + 'px' +
                '}' +
                '.w-lightbox-image {' +
                'max-width:' + (0.96 * vw) + 'px;' +
                'max-height:' + (0.96 * vh) + 'px' +
                '}' +
                '.w-lightbox-group .w-lightbox-image {' +
                'max-width:' + (0.823 * vw) + 'px;' +
                'max-height:' + (0.84 * vh) + 'px' +
                '}' +
                '}';

            styleNode.textContent = content;
        }

        refresh();
    })();

    return lightbox;
})(window, document, jQuery, window.tram);

Apiumtech.define('lightbox', function ($, _) {
    'use strict';

    var api = {};
    var $doc = $(document);
    var $body;
    var $lightboxes;
    var designer;
    var inApp = Apiumtech.env();
    var namespace = '.w-lightbox';
    var groups;

    // -----------------------------------
    // Module methods

    api.ready = api.design = api.preview = init;

    // -----------------------------------
    // Private methods

    function init() {
        designer = inApp && Apiumtech.env('design');
        $body = $(document.body);

        // Reset Lightbox
        lightbox.destroy();

        // Reset groups
        groups = {};

        // Find all instances on the page
        $lightboxes = $doc.find(namespace);
        $lightboxes.each(build);
    }

    function build(i, el) {
        var $el = $(el);

        // Store state in data
        var data = $.data(el, namespace);
        if (!data) data = $.data(el, namespace, {
            el: $el,
            mode: 'images',
            images: [],
            embed: ''
        });

        // Remove old events
        data.el.off(namespace);

        // Set config from json script tag
        configure(data);

        // Add events based on mode
        if (designer) {
            data.el.on('setting' + namespace, configure.bind(null, data));
        }
        else {
            data.el
                .on('tap' + namespace, tapHandler(data))
                // Prevent page scrolling to top when clicking on lightbox triggers.
                .on('click' + namespace, function (e) { e.preventDefault(); });
        }
    }

    function configure(data) {
        var json = data.el.children('.w-json').html();
        var groupName, groupItems;

        if (!json) {
            data.items = [];
            return;
        }

        try {
            json = JSON.parse(json);

            supportOldLightboxJson(json);

            groupName = json.group;

            if (groupName) {
                groupItems = groups[groupName];
                if (!groupItems) {
                    groupItems = groups[groupName] = [];
                }

                data.items = groupItems;

                if (json.items.length) {
                    data.index = groupItems.length;
                    groupItems.push.apply(groupItems, json.items);
                }
            }
            else {
                data.items = json.items;
            }
        }
        catch (e) {
            console.error('Malformed lightbox JSON configuration.', e.message);
        }
    }

    function tapHandler(data) {
        return function () {
            data.items.length && lightbox(data.items, data.index || 0);
        };
    }

    function supportOldLightboxJson(data) {
        if (data.images) {
            data.images.forEach(function (item) {
                item.type = 'image';
            });
            data.items = data.images;
        }

        if (data.embed) {
            data.embed.type = 'video';
            data.items = [data.embed];
        }

        if (data.groupId) {
            data.group = data.groupId;
        }
    }

    // Export module
    return api;
});