/* global L */

"use strict";

var hortis = fluid.registerNamespace("hortis");

// Adapted from https://github.com/IMERSS/imerss-bioinfo/blob/master/src/client/js/leafletMap.js
// Needs to be consolidated to produce a core implementation

fluid.defaults("hortis.leafletMap", {
    gradeNames: "fluid.viewComponent",
    selectors: {
        map: ".fl-mapviz-map",
        tooltip: ".fl-mapviz-map-tooltip"
    },
    members: {
        map: "@expand:L.map({that}.dom.map.0, {that}.options.mapOptions)"
    },
    events: {
        buildMap: null
    },
    zoomDuration: 2, // Animation duration in seconds
    mapOptions: {
        zoomSnap: 0.1
    },
    tileOptions: {
        // tileUrl, tileAttribution
    },
    datasets: {},
    markup: {
        tooltip: "<div class=\"fl-mapviz-tooltip\"></div>",
        tooltipHeader: "<table>",
        tooltipRow: "<tr><td class=\"fl-tooltip-key\">%key: </td><td class=\"fl-tooltip-value\">%value</td>",
        tooltipFooter: "</table>"
    },
    // We can't default this because of https://issues.fluidproject.org/browse/FLUID-6587
    // outerBounds: "@expand:fluid.geom.emptyBounds()",
    listeners: {
        "buildMap.bindZoom": "hortis.leafletMap.bindZoom",
        "buildMap.fitBounds": "{that}.fitBounds({that}.options.outerBounds)",
        "buildMap.createTooltip": "hortis.leafletMap.createTooltip({that}, {that}.options.markup)",
        "buildMap.addTiles": "hortis.leafletMap.addTileLayer({that}.map, {that}.options.tileOptions)"
    },
    model: {
        // zoom: Number (0 - whole world -> 18 - maximal zoom)
    },
    invokers: {
        // Perhaps this will one day be a "materialiser registration" and we will instead call applier.pullModel("zoom")
        acquireZoom: "hortis.leafletMap.acquireZoom({that})",
        fitBounds: "hortis.leafletMap.fitBounds({that}, {arguments}.0, {arguments}.1)"
    },
    modelListeners: {
        "": {
            namespace: "buildMap",
            includeSource: "init",
            func: "{that}.events.buildMap.fire",
            args: "{that}"
        }
    }
});

hortis.leafletMap.boundsToLeaflet = function (bounds) {
    return [
        hortis.leafletMap.leafletPoint(bounds.min),
        hortis.leafletMap.leafletPoint(bounds.max)
    ];
};

// Leaflet breaks with consensus and accepts coordinates in the opposite order - https://macwright.com/lonlat/
hortis.leafletMap.leafletPoint = function (point) {
    return [point[1], point[0]];
};

hortis.leafletMap.acquireZoom = function (map) {
    map.applier.change("zoom", map.map.getZoom());
};

hortis.leafletMap.bindZoom = function (map) {
    var leafletMap = map.map;
    // Note that we can't apply the change at startup because of FLUID-5498
    leafletMap.on("zoomend", function () {
        map.acquireZoom();
    });
};

hortis.leafletMap.fitBounds = function (map, fitBounds, fly) {
    if (fitBounds) {
        map.map[fly ? "flyToBounds" : "fitBounds"](hortis.leafletMap.boundsToLeaflet(fitBounds), {duration: map.options.zoomDuration});
        map.acquireZoom();
    }
};

hortis.leafletMap.createTooltip = function (that, markup) {
    var tooltip = $(markup.tooltip).appendTo(that.container);
    tooltip.hide();
    that.map.createPane("hortis-tooltip", tooltip[0]);
};


fluid.defaults("hortis.streetmapTiles", {
    tileOptions: {
        tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        tileAttribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
    }
});

hortis.leafletMap.addTileLayer = function (map, tileOptions) {
    if (tileOptions.tileUrl) {
        L.tileLayer(tileOptions.tileUrl, {
            attribution: tileOptions.tileAttribution
        }).addTo(map);
    }
};

fluid.defaults("hortis.conditionalTemplateRenderer", {
    gradeNames: "fluid.contextAware",
    contextAwareness: {
        renderContainer: {
            checks: {
                hasTemplate: {
                    contextValue: "{that}.options.resources.template.url",
                    gradeNames: "fluid.templateRenderingView"
                }
            }
        }
    }
});

hortis.parseColours = function (colours) {
    var togo = {};
    fluid.each(colours, function (colour, key) {
        togo[key] = colour;
        var parsed = fluid.colour.hexToArray(colour);
        var lighter = fluid.colour.interpolate(0.5, parsed, [255, 255, 255]);
        togo[key + "Lighter"] = fluid.colour.arrayToString(lighter);
    });
    return togo;
};

hortis.leafletMap.tooltipRow = function (markup, key, value) {
    return fluid.stringTemplate(markup.tooltipRow, {key: key, value: value});
};


// From https://en.wikipedia.org/wiki/Longitude#Length_of_a_degree_of_longitude
hortis.WGS84a = 6378137;
hortis.WGS84b = 6356752.3142;
hortis.WGS84e2 = (hortis.WGS84a * hortis.WGS84a - hortis.WGS84b * hortis.WGS84b) / (hortis.WGS84a * hortis.WGS84a);

/** Length in metres for a degree of longitude at given latitude **/

hortis.longitudeLength = function (latitude) {
    var latrad = Math.PI * latitude / 180;
    var sinrad = Math.sin(latrad);
    return Math.PI * hortis.WGS84a * Math.cos(latrad) / (180 * Math.sqrt(1 - hortis.WGS84e2 * sinrad * sinrad));
};

/** Length in metres for a degree of latitude at given latitude **/

hortis.latitudeLength = function (latitude) {
    var latrad = Math.PI * latitude / 180;
    var sinrad = Math.sin(latrad);
    return Math.PI * hortis.WGS84a * (1 - hortis.WGS84e2) / (180 * Math.pow(1 - hortis.WGS84e2 * sinrad * sinrad, 1.5));
};

hortis.longToLat = function (lng, lat) {
    var longLength = hortis.longitudeLength(lat);
    var latLength = hortis.latitudeLength(lat);
    return lng * longLength / latLength;
};


hortis.quickDistance = function (c1, c2) {
    var baselat = c1[0];
    var latd = (c1[0] - c2[0]) * hortis.latitudeLength(baselat);
    var longd = (c1[1] - c2[1]) * hortis.longitudeLength(baselat);
    return Math.sqrt(latd * latd + longd * longd);
};
