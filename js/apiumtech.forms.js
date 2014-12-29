/**
 * Created by xavi on 28/12/14.
 */
/**
 * ----------------------------------------------------------------------
 * Apiumtech: Forms
 */
Apiumtech.define('forms', function($, _) {
    'use strict';

    var api = {};

    var FORM_API_HOST = 'https://webflow.com';
    var FORM_SUBMIT_HOST = 'https://webflow.com';
    var FORM_OLDIE_HOST = 'http://formdata.webflow.com';

    var $doc = $(document);
    var $forms;
    var loc = window.location;
    var retro = window.XDomainRequest && !window.atob;
    var namespace = '.w-form';
    var siteId;
    var emailField = /e(\-)?mail/i;
    var emailValue = /^\S+@\S+$/;
    var alert = window.alert;
    var listening;

    // MailChimp domains: list-manage.com + mirrors
    var chimpRegex = /list-manage[1-9]?.com/i;

    api.ready = function() {
        // Init forms
        init();

        // Wire document events once
        if (!listening) addListeners();
    };

    api.preview = api.design = function() {
        init();
    };

    function init() {
        siteId = $('html').attr('data-wf-site');

        $forms = $(namespace + ' form');
        if (!$forms.length) return;
        $forms.each(build);
    }

    function build(i, el) {
        // Store form state using namespace
        var $el = $(el);
        var data = $.data(el, namespace);
        if (!data) data = $.data(el, namespace, { form: $el }); // data.form

        reset(data);
        var wrap = $el.closest('div.w-form');
        data.done = wrap.find('> .w-form-done');
        data.fail = wrap.find('> .w-form-fail');

        var action = data.action = $el.attr('action');
        data.handler = null;
        data.redirect = $el.attr('data-redirect');

        // MailChimp form
        if (chimpRegex.test(action)) { data.handler = submitMailChimp; return; }

        // Custom form action
        if (action) return;

        // Apiumtech form
        if (siteId) { data.handler = submitWebflow; return; }

        // Alert for disconnected Apiumtech forms
        disconnected();
    }

    function addListeners() {
        listening = true;

        // Handle form submission for Apiumtech forms
        $doc.on('submit', namespace + ' form', function(evt) {
            var data = $.data(this, namespace);
            if (data.handler) {
                data.evt = evt;
                data.handler(data);
            }
        });
    }

    // Reset data common to all submit handlers
    function reset(data) {
        var btn = data.btn = data.form.find(':input[type="submit"]');
        data.wait = data.btn.attr('data-wait') || null;
        data.success = false;
        btn.prop('disabled', false);
        data.label && btn.val(data.label);
    }

    // Disable submit button
    function disableBtn(data) {
        var btn = data.btn;
        var wait = data.wait;
        btn.prop('disabled', true);
        // Show wait text and store previous label
        if (wait) {
            data.label = btn.val();
            btn.val(wait);
        }
    }

    // Find form fields, validate, and set value pairs
    function findFields(form, result) {
        var status = null;
        result = result || {};

        // The ":input" selector is a jQuery shortcut to select all inputs, selects, textareas
        form.find(':input:not([type="submit"])').each(function(i, el) {
            var field = $(el);
            var type = field.attr('type');
            var name = field.attr('data-name') || field.attr('name') || ('Field ' + (i + 1));
            var value = field.val();

            if (type == 'checkbox') {
                value = field.is(':checked');
            } if (type == 'radio') {
                // Radio group value already processed
                if (result[name] === null || typeof result[name] == 'string') {
                    return;
                }

                value = form.find('input[name="' + field.attr('name') + '"]:checked').val() || null;
            }

            if (typeof value == 'string') value = $.trim(value);
            result[name] = value;
            status = status || getStatus(field, name, value);
        });

        return status;
    }

    function getStatus(field, name, value) {
        var status = null;
        if (!field.attr('required')) return null;
        if (!value) status = 'Please fill out the required field: ' + name;
        else if (emailField.test(name) || emailField.test(field.attr('type'))) {
            if (!emailValue.test(value)) status = 'Please enter a valid email address for: ' + name;
        }
        return status;
    }

    // Submit form to Apiumtech
    function submitWebflow(data) {
        reset(data);

        var form = data.form;
        var payload = {
            name: form.attr('data-name') || form.attr('name') || 'Untitled Form',
            source: loc.href,
            test: Webflow.env(),
            fields: {}
        };

        preventDefault(data);

        // Find & populate all fields
        var status = findFields(form, payload.fields);
        if (status) return alert(status);

        // Disable submit button
        disableBtn(data);

        // Read site ID
        // NOTE: If this site is exported, the HTML tag must retain the data-wf-site attribute for forms to work
        if (!siteId) { afterSubmit(data); return; }
        var url = FORM_API_HOST + '/api/v1/form/' + siteId;

        // Work around same-protocol IE XDR limitation - without this IE9 and below forms won't submit
        if (retro && url.indexOf(FORM_SUBMIT_HOST) >= 0) {
            url = url.replace(FORM_SUBMIT_HOST, FORM_OLDIE_HOST);
        }

        $.ajax({
            url: url,
            type: 'POST',
            data: payload,
            dataType: 'json',
            crossDomain: true
        }).done(function() {
            data.success = true;
            afterSubmit(data);
        }).fail(function() {
            afterSubmit(data);
        });
    }

    // Submit form to MailChimp
    function submitMailChimp(data) {
        reset(data);

        var form = data.form;
        var payload = {};

        // Skip Ajax submission if http/s mismatch, fallback to POST instead
        if (/^https/.test(loc.href) && !/^https/.test(data.action)) {
            form.attr('method', 'post');
            return;
        }

        preventDefault(data);

        // Find & populate all fields
        var status = findFields(form, payload);
        if (status) return alert(status);

        // Disable submit button
        disableBtn(data);

        // Use special format for MailChimp params
        var fullName;
        _.each(payload, function(value, key) {
            if (emailField.test(key)) payload.EMAIL = value;
            if (/^((full[ _-]?)?name)$/i.test(key)) fullName = value;
            if (/^(first[ _-]?name)$/i.test(key)) payload.FNAME = value;
            if (/^(last[ _-]?name)$/i.test(key)) payload.LNAME = value;
        });

        if (fullName && !payload.FNAME) {
            fullName = fullName.split(' ');
            payload.FNAME = fullName[0];
            payload.LNAME = payload.LNAME || fullName[1];
        }

        // Use the (undocumented) MailChimp jsonp api
        var url = data.action.replace('/post?', '/post-json?') + '&c=?';
        // Add special param to prevent bot signups
        var userId = url.indexOf('u=')+2;
        userId = url.substring(userId, url.indexOf('&', userId));
        var listId = url.indexOf('id=')+3;
        listId = url.substring(listId, url.indexOf('&', listId));
        payload['b_' + userId + '_' + listId] = '';

        $.ajax({
            url: url,
            data: payload,
            dataType: 'jsonp'
        }).done(function(resp) {
            data.success = (resp.result == 'success' || /already/.test(resp.msg));
            if (!data.success) console.info('MailChimp error: ' + resp.msg);
            afterSubmit(data);
        }).fail(function() {
            afterSubmit(data);
        });
    }

    // Common callback which runs after all Ajax submissions
    function afterSubmit(data) {
        var form = data.form;
        var wrap = form.closest('div.w-form');
        var redirect = data.redirect;
        var success = data.success;

        // Redirect to a success url if defined
        if (success && redirect) {
            Webflow.location(redirect);
            return;
        }

        // Show or hide status divs
        data.done.toggle(success);
        data.fail.toggle(!success);

        // Hide form on success
        form.toggle(!success);

        // Reset data and enable submit button
        reset(data);
    }

    function preventDefault(data) {
        data.evt && data.evt.preventDefault();
        data.evt = null;
    }

    var disconnected = _.debounce(function() {
        alert('Oops! This page has a form that is powered by Apiumtech, but important code was removed that is required to make the form work. Please contact support@webflow.com to fix this issue.');
    }, 100);

    // Export module
    return api;
});