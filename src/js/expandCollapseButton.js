/*
Copyright 2021 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/main/Infusion-LICENSE.txt
*/

"use strict";

fluid.registerNamespace("fluid.expandCollapseButton");

// The expand-collapse button component. This button is only available on the mobile view.
// To use this component, add a model listener for the path "expanded", for example:
// expandCollapse: {
//     path: "expanded",
//     func: "{that}.toggleExpandedState",
//     args: ["{change}.value", ["{that}.dom.title", "{that}.dom.cities"]]
// }
// Note that the invoker "toggleExpandedState" requires 2 arguments:
// 1. The changed model value;
// 2. An array of DOM elements to show/hide.
fluid.defaults("fluid.expandCollapseButton", {
    gradeNames: "fluid.viewComponent",
    selectors: {
        expandCollapseButton: ".fl-mapviz-expand-collapse-button"
    },
    model: {
        expanded: true
    },
    invokers: {
        toggleExpandedState: {
            funcName: "fluid.toggleExpandedState",
            args: ["{that}.dom.expandCollapseButton", "{arguments}.0", "{arguments}.1"]
        }
    },
    listeners: {
        "onCreate.bindExpandCollapseButtonEvents": "fluid.bindExpandCollapseButtonEvents({that})"
    }
});

fluid.bindExpandCollapseButtonEvents = function (that) {
    that.locate("expandCollapseButton").click(function () {
        that.applier.change("expanded", !that.model.expanded);
    });
};

fluid.toggleExpandedState = function (expandCollapseButton, expanded, elementsToToggle) {
    console.log(expandCollapseButton);
    expandCollapseButton[0].setAttribute("aria-expanded", expanded);
    expandCollapseButton[0].setAttribute("aria-label", expanded ? "expand" : "collapse");
    elementsToToggle.forEach(elem => {elem[expanded ? "show" : "hide"]();});
};
