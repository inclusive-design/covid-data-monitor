/*
Copyright 2021 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/main/Infusion-LICENSE.txt
*/

"use strict";

// The expand-collapse button component. This button is only available on the mobile view.
// This component adds or removes a mobile-view-only visibility css class to a given list of DOM elements
// based on the expanded state.
fluid.defaults("fluid.expandButton", {
    gradeNames: "fluid.button",
    // Supplied by integrators. An array of DOM element to expand or collapse.
    elementsToExpand: [],
    styles: {
        hiddenOnMobile: "fl-mapviz-hidden-on-mobile"
    },
    model: {
        // The initial state of all panels on the mobile view is collapsed.
        expanded: false
    },
    modelRelay: {
        toggleOnActivate: {
            source: "activate",
            target: "expanded",
            singleTransform: "fluid.transforms.toggle"
        },
        ariaExpanded: {
            source: "expanded",
            target: "dom.container.attrs.aria-expanded",
            func: x => !!x
        }
    },
    modelListeners: {
        expandContent: {
            path: "expanded",
            funcName: "fluid.expandButton.toggleClass",
            args: ["{that}.options.elementsToExpand", "{that}.options.styles.hiddenOnMobile", "{that}.model.expanded"]
        }
    }
});

fluid.expandButton.toggleClass = function (elementsToExpand, style, toggleFlag) {
    fluid.each(elementsToExpand, function (element) {
        element.toggleClass(style, !toggleFlag);
    });
};
