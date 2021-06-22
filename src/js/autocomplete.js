/*
Copyright 2018 Antranig Basman
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

// Taken from %bagatelle/src/client/js/autocomplete.js

/* global accessibleAutocomplete */

"use strict";

var hortis = fluid.registerNamespace("hortis");

fluid.defaults("hortis.autocomplete", {
    gradeNames: ["fluid.viewComponent"],
    members: {
        // widget: "@expand:hortis.autocomplete.render({that}, {that}.options.id, {that}.options.widgetOptions)",
        container: "@expand:hortis.autocomplete.renderContainer({that}, {that}.options.container, {that}.options.id, {that}.options.widgetOptions)"
    },
    selectors: {
        input: {
            expander: {
                func: function (id) {return "#" + id;},
                args: "{that}.options.id"
            }
        }
    },
    events: {
        onConfirm: null
    },
    invokers: {
        query: "hortis.autocomplete.emptyQuery",
        accept: "hortis.autocomplete.accept({that}, {arguments}.0)",
        renderSuggestion: "fluid.identity",
        renderInputValue: "fluid.identity"
    },
    listeners: {
        "onConfirm.update": "hortis.autocomplete.confirmToUpdate({that}, {arguments}.0)"
    },
    widgetOptions: {
        displayMenu: "overlay"
    }
});

hortis.autocomplete.emptyQuery = function (query, callback) {
    callback("");
};

hortis.autocomplete.confirmToUpdate = function (that, selectedOption) {
    // Broken implementation of accessible-autocomplete calls the "onConfirm" callback before it calls its "setState".
    // So we need to ensure that the value of the input is correct at the time we try to read it.
    fluid.changeElementValue(that.locate("input"), selectedOption);
};

// Yet another appalling reuse failure. The accessible-autocomplete widget has no API. Therefore if we progammatically
// cause a change in its query state, there is no way to get it to dismiss the dropdown list other than simulating
// a click on one of its DOM elements. Once more the DOM saves us from what React won't. However, given React renders
// asynchronously we don't even know when the element will appear.
hortis.autocomplete.accept = function (that, index) {
    window.setTimeout(function () {
        var options = that.container.find("li");
        var element = options[index || 0];
        if (element && $(element).is(":visible")) {
            element.click();
        }
    }, 25);
};

// TODO: What on earth happened to generalised interception !!
hortis.autocomplete.renderContainer = function (that, containerOption, id, widgetOptions) {
    var container = fluid.containerForViewComponent(that, containerOption);
    that.widget = hortis.autocomplete.render(that, container, id, widgetOptions);
    return container;
};

hortis.autocomplete.render = function (that, container, id, widgetOptions) {
    var mergedWidgetOptions = $.extend({
        element: container[0],
        id: id,
        source: that.query,
        templates: {
            suggestion: that.renderSuggestion,
            inputValue: that.renderInputValue
        },
        onConfirm: that.events.onConfirm.fire
    }, widgetOptions);
    var togo = accessibleAutocomplete(mergedWidgetOptions);
    // TODO: another one for the bestiary of reuse failures
    $("input", container).attr("spellcheck", false);
    return togo;
};
