/*
Copyright 2021 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/main/Infusion-LICENSE.txt
*/

"use strict";

fluid.registerNamespace("fluid.geom");

/** Return an empty rectangular bounds structure
 * @return {Bounds} Empty bounds initialised to infinite values
 */
fluid.geom.emptyBounds = function () {
    return {
        min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
        max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
    };
};

fluid.geom.isEmptyBounds = function (bounds) {
    return bounds.min[0] > bounds.max[0] || bounds.min[1] > bounds.max[1];
};

fluid.geom.updateBounds = function (bounds, lon, lat) {
    if (lon < bounds.min[0]) {
        bounds.min[0] = lon;
    }
    if (lon > bounds.max[0]) {
        bounds.max[0] = lon;
    }
    if (lat < bounds.min[1]) {
        bounds.min[1] = lat;
    }
    if (lat > bounds.max[1]) {
        bounds.max[1] = lat;
    }
};

fluid.geom.expandBounds = function (bounds, buffer) {
    bounds.min[0] -= buffer;
    bounds.min[1] -= buffer;
    bounds.max[0] += buffer;
    bounds.max[1] += buffer;
};
