/* global fluid, L */

"use strict";

fluid.setLogging(true);

fluid.registerNamespace("fluid.mapviz.covid");
var hortis = fluid.registerNamespace("hortis");

fluid.mapviz.covid.idrcLocation = [43.654286, -79.391087];

fluid.mapviz.covid.metresInMile = 1609.34;

fluid.mapviz.covid.tooltipColumns = {
    "number": {
        title: "Number"
    },
    "location_name": {
        title: "Name"
    },
    "address": {
        title: "Address"
    },
    "city": {
        title: "City"
    },
    "province": {
        title: "Province"
    },
    "postal_code": {
        title: "Post code"
    },
    "phone": {
        title: "Phone"
    },
    "after_hours": {
        title: "After Hours",
        type: "boolean"
    },
    "appointments": {
        title: "Appointments",
        type: "boolean"
    },
    "walk_ins": {
        title: "Walk-ins",
        type: "boolean"
    },
    "drive_through": {
        title: "Drive through",
        type: "boolean"
    },
    "children_under_2": {
        title: "Children under 2",
        type: "boolean"
    },
    "accessible": {
        title: "Accessible",
        type: "boolean"
    },
    "distance": {
        title: "Distance",
        type: "distance"
    }
};

fluid.mapviz.covid.renderers = {
    text: function (torender) {
        return fluid.isValue(torender) ? torender : "";
    },
    distance: function (torender) {
        var inMiles = torender / fluid.mapviz.covid.metresInMile;
        return inMiles.toFixed(1) + " miles";
    }
};

fluid.mapviz.covid.renderers["boolean"] = fluid.mapviz.covid.renderers.text;

fluid.defaults("fluid.mapviz.covid.map", {
    gradeNames: ["hortis.leafletMap", "hortis.streetmapTiles", "hortis.CSVLeafletMap", "hortis.conditionalTemplateRenderer"],
    colours: {
        accessible: "#0f0",
        inaccessible: "#f00"
    },
    parsedColours: "@expand:hortis.parseColours({that}.options.colours)",
    listeners: {
        "buildMap.addMarkers": "fluid.mapviz.covid.addMarkers({that}, {that}.options.parsedColours, {that}.options.markup)",
        "onCreate.bindMarkup": "fluid.mapviz.covid.bindMarkup({that})"
    },
    model: {
        query: {
            centrePoint: fluid.mapviz.covid.idrcLocation,
            radius: 10,
            accessibleOnly: true
        }
    },
    // TODO: Allow resources to be defaulted in a civilized manner 
    templateUrl: null,
    resources: {
        template: {
            url: "{that}.options.templateUrl"
        }
    },
    modelListeners: {
        "query": {
            funcName: "fluid.mapviz.covid.renderTable",
            args: "{that}",
            priority: "after:buildMap"
        }
    },
    selectors: {
        table: ".fld-mapviz-table",
        distanceControl: ".fld-mapviz-distance",
        accessibleControl: ".fld-mapviz-accessible"
    }
});

fluid.mapviz.covid.bindMarkup = function (that) {
    var distance = that.locate("distanceControl");
    distance.change(function () {
        that.applier.change("query.radius", distance.val());
    });
    var accessible = that.locate("accessibleControl");
    accessible.change(function () {
        that.applier.change("query.accessibleOnly", accessible.is(":checked"));
    });
};

fluid.mapviz.covid.distanceComparator = function (r1, r2) {
    return r1.distance - r2.distance;
};

fluid.mapviz.covid.queryCentres = function (that) {
    var query = that.model.query;
    var data = that.resources.data.parsed.data;
    var renderKeys = Object.keys(fluid.mapviz.covid.tooltipColumns);
    var filtered = data.filter(function (row) {
        return query.accessibleOnly ? row.accessible === "Yes" : true;
    });
    var toSort = filtered.map(function (row) {
        var toRender = fluid.filterKeys(row, renderKeys);
        var distance = hortis.quickDistance(query.centrePoint, [row.latitude, row.longitude]);
        toRender.distance = distance;
        return toRender;
    });

    toSort.sort(fluid.mapviz.covid.distanceComparator);
    var cutoffInMetres = query.radius * fluid.mapviz.covid.metresInMile;
    var cutoffPoint = toSort.findIndex(function (row) {
        return row.distance > cutoffInMetres;
    });
    var togo = cutoffPoint === -1 ? toSort : toSort.slice(0, cutoffPoint);
    togo.forEach(function (row, index) {
        row.number = index + 1;
    });
    console.log("Returning ", togo.length, " rows");
    return togo;
};

fluid.mapviz.covid.renderHeaders = function () {
    var columns = Object.values(fluid.mapviz.covid.tooltipColumns);
    return "<tr>" + columns.map(function (column) {
        return "<th>" + column.title + "</th>";
    }) + "</tr>";
};

fluid.mapviz.covid.renderRow = function (row) {
    var markup = "<tr>";
    fluid.each(fluid.mapviz.covid.tooltipColumns, function (columnValue, key) {
        var value = row[key];
        var renderer = fluid.mapviz.covid.renderers[columnValue.type || "text"];
        var rendered = renderer ? renderer(value) : value;
        markup += "<td>" + rendered + "</td>";
    });
    markup += "</td>";
    return markup;
};

fluid.mapviz.covid.renderTable = function (that) {
    var queryResults = fluid.mapviz.covid.queryCentres(that);
    var node = that.dom.locate("table");
    node.empty();
    var markup = fluid.mapviz.covid.renderHeaders();
    queryResults.forEach(function (row) {
        markup += fluid.mapviz.covid.renderRow(row);
    });
    node.html(markup);
};

fluid.mapviz.covid.rowToColour = function (row, colours) {
    return row.accessible ? {
        color: colours.accessible,
        fillColor: colours.accessibleLighter
    } : {
        color: colours.inaccessible,
        fillColor: colours.inaccessibleLighter
    };
};


fluid.mapviz.covid.renderPopup = function (that, row, markup) {
    var text = markup.tooltipHeader;
    var dumpRow = function (key, value) {
        text += hortis.leafletMap.tooltipRow(markup, key, value);
    };
    fluid.each(fluid.mapviz.covid.tooltipColumns, function (value, key) {
        var rowValue = row[key];
        if (fluid.isValue(rowValue) && rowValue !== "") {
            dumpRow(value.title, rowValue);
        }
    });
    text += markup.tooltipFooter;
    return text;
};

fluid.mapviz.covid.addMarkers = function (that, colours, markup) {
    var data = that.resources.data.parsed.data;
    data.forEach(function (row) {
        if (!row.latitude || !row.longitude) {
            fluid.log("Warning, ignoring row ", row, " which does not have valid coordinates");
        } else {
            var styles = fluid.mapviz.covid.rowToColour(row, colours);
            var circle = L.circleMarker([row.latitude, row.longitude], fluid.extend({
                fillOpacity: 0.5,
                radius: 8,
                weight: 2
            }, styles)).addTo(that.map);
            var popupMarkup = fluid.mapviz.covid.renderPopup(that, row, markup);
            circle.bindPopup(popupMarkup);
        }
    });
};
