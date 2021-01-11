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
        widget: "@expand:hortis.autocomplete.render({that}, {that}.options.id, {that}.options.widgetOptions)"
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

hortis.autocomplete.render = function (that, id, widgetOptions) {
    var mergedWidgetOptions = $.extend({
        element: that.container[0],
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
    $("input", that.container).attr("spellcheck", false);
    return togo;
};
