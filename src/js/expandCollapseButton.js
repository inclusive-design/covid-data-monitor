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
fluid.defaults("fluid.expandButton", {
    gradeNames: "fluid.button",
    model: {
        expanded: true
    },
    modelRelay: {
        toggleOnActivate: {
            source: "activate",
            target: "expanded",
            singleTransform: "fluid.transforms.toggle"
        },
        ariaExpanded: {
            source: "expanded",
            target: "dom.button.attrs.aria-expanded"
        },
        ariaLabel: {
            source: "expanded",
            target: "dom.button.attrs.aria-label",
            func: expanded => expanded ? "collapse" : "expand"
        }
    }
});
