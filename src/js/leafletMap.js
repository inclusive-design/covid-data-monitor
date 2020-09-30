/* global L, fluid */

"use strict";

var hortis = fluid.registerNamespace("hortis");

// Adapted from https://github.com/amb26/bagatelle/blob/master/src/client/js/leafletMap.js
// Needs to be consolidated to produce a core implementation

fluid.defaults("hortis.leafletMap", {
    gradeNames: "fluid.viewComponent",
    selectors: {
        map: ".fld-mapviz-map",
        tooltip: ".fld-mapviz-map-tooltip"
    },
    members: {
        map: "@expand:L.map({that}.dom.map.0, {that}.options.mapOptions)"
    },
    events: {
        buildMap: null
    },
    mapOptions: {
        zoomSnap: 0.1
    },
    tileOptions: {
        // tileUrl, tileAttribution
    },
    datasets: {},
    model: {
        mapBlockTooltipId: null
    },
    markup: {
        tooltip: "<div class=\"fld-mapviz-tooltip\"></div>",
        tooltipHeader: "<table>",
        tooltipRow: "<tr><td class=\"fl-tooltip-key\">%key: </td><td class=\"fl-tooltip-value\">%value</td>",
        tooltipFooter: "</table>"
    },
    fitBounds: [[41.6,-95.2],[56.9,-74.3]],
    listeners: {
        "buildMap.fitBounds": "hortis.leafletMap.fitBounds({that}.map, {that}.options.fitBounds)",
        "buildMap.createTooltip": "hortis.leafletMap.createTooltip({that}, {that}.options.markup)",
        "buildMap.addTiles": "hortis.leafletMap.addTileLayer({that}.map, {that}.options.tileOptions)"
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


hortis.leafletMap.fitBounds = function (map, fitBounds) {
    if (fitBounds) {
        map.fitBounds(fitBounds);
    }
};

hortis.leafletMap.createTooltip = function (that, markup) {
    var tooltip = $(markup.tooltip).appendTo(that.container);
    tooltip.hide();
    that.map.createPane("hortis-tooltip", tooltip[0]);
    var container = that.map.getContainer();
    $(container).on("click", function (event) {
        if (event.target === container) {
            that.applier.change("mapBlockTooltipId", null);
        }
    });
};


fluid.defaults("hortis.CSVLeafletMap", {
    gradeNames: ["hortis.leafletMap", "fluid.resourceLoader"],
    dataUrl: "http://thing",
    resources: {
        data: {
            url: "{that}.options.dataUrl",
            dataType: "csv"
        }
    },
    model: {
        // Resource dependency to ensure that data is loaded before any component use.
        // We make this light (headers only) since our crufty ChangeApplier will clone all the data on every model change
        headers: "{that}.resources.data.parsed.headers"
    }
});

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
    return Math.sqrt(latd * latd + longd + longd);
};
