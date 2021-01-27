/* global L */

"use strict";

fluid.setLogging(true);

fluid.registerNamespace("fluid.covidMap");

fluid.covidMap.metresInMile = 1609.34;

fluid.defaults("fluid.covidMap.hospitalRenderer", {
    gradeNames: "fluid.modelComponent",
    selectors: {
        hospitalTitle: ".fl-mapviz-hospital-title",
        hospitalHours: ".fl-mapviz-hospital-hours",
        hospitalAddress: ".fl-mapviz-hospital-address",
        hospitalPhone:  ".fl-mapviz-hospital-phone"
    },
    modelRelay: {
        hospitalTitle: {
            source: {
                segs: ["row", "{map}.options.fields.name"]
            },
            target: "dom.hospitalTitle.text"
        },
        hospitalHours: {
            source: "row",
            target: "dom.hospitalHours.text",
            func: "fluid.covidMap.renderHours"
        },
        hospitalAddress: {
            source: "row",
            target: "dom.hospitalAddress.text",
            func: "fluid.covidMap.renderAddress"
        },
        hospitalPhone: {
            source: {
                segs: ["mwp", "{map}.options.fields.phone"]
            },
            target: "dom.hospitalPhone.text"
        }
    }
});

// TODO: Needs to be be copied back into framework
fluid.copyImmutableResource = function (tocopy) {
    var newContainer = fluid.isArrayable(tocopy) ? new fluid.ImmutableArray() : new fluid.ImmutableObject();
    Object.assign(newContainer, tocopy);
    if (tocopy.length) {
        newContainer.length = tocopy.length;
    }
    return newContainer;
};

fluid.covidMap.extractCities = function (rows, field) {
    var cities = fluid.getMembers(rows, field);
    var cityHash = fluid.arrayToHash(cities);
    return fluid.copyImmutableResource(Object.keys(cityHash).sort());
};

fluid.covidMap.extractPostcodes = function (rows, field) {
    var postcodes = fluid.getMembers(rows, field);
    var postcodeHash = fluid.arrayToHash(postcodes);
    return postcodeHash;
};

fluid.defaults("fluid.covidMap.map", {
    gradeNames: ["hortis.leafletMap", "hortis.streetmapTiles", "hortis.CSVLeafletMap", "hortis.conditionalTemplateRenderer"],
    // Colours currently unused, may be again when we inline SVG markers
    colours: {
        accessible: "#0f0",
        inaccessible: "#f00"
    },
    parsedColours: "@expand:hortis.parseColours({that}.options.colours)",
    smallMarkersBelowZoom: 9,
    outerBounds: {
        min: [-95.2, 41.6],
        max: [-74.3, 56.9]
    },
    boundsBuffer: 0.01,
    fields: {
        city: "city",
        name: "location_name",
        website: "website",
        phone: "phone",
        postcode: "postal_code"
    },
    filters: {
        entrances: {
            selector: ".fl-mapviz-filter-entrances",
            column: "Wheelchair-accessible entrance"
        },
        washroom: {
            selector: ".fl-mapviz-filter-washrooms",
            column: "Wheelchair-accessible bathrooms"
        },
        parking: {
            selector: ".fl-mapviz-filter-parking",
            column: "Accessible parking"
        },
        individual: {
            selector: ".fl-mapviz-filter-individual",
            column: "Personalized or individual service is offered"
        },
        wait: {
            selector: ".fl-mapviz-filter-wait",
            column: "Queue accomodations"
        }
    },
    unselectedFilterChecks: "@expand:fluid.covidMap.unselectedChecks({that}.options.filters)",
    selectors: {
        query: ".fl-mapviz-query",
        resultsPage: ".fl-mapviz-search-results",
        citiesList: ".fl-mapviz-city-list",
        backButton: ".fl-mapviz-back-button",
        hospitalPanel: ".fl-mapviz-hospital-panel",
        attribution: ".leaflet-control-attribution",
        resetButton: ".fl-mapviz-reset-filters",
        applyButton: ".fl-mapviz-reset-filters",
        filterPanel: ".fl-mapviz-filter-panel",
        filterControl: ".fl-mapviz-filter-control",
        filterCount: ".fl-mapviz-filter-count",
        queryHolder: ".fl-mapviz-query-holder",
        queryReset: ".fl-mapviz-query-reset",
        query: "#fl-search-query"
    },
    styles: {
        marker: "fl-mapviz-marker"
    },
    markup: {
        marker: "<svg height=\"%height\" width=\"%width\"><use xlink:href=\"#%marker\" /></svg>"
    },
    ids: {
        searchQuery: "fl-search-query"
    },
    listeners: {
        "buildMap.addMarkers": {
            funcName: "fluid.covidMap.addMarkers",
            args: ["{that}"],
            priority: "last"
        }
    },
    model: {
        cities: [],
        postcodes: {},
        query: "",
        activeFilterChecks: "{that}.options.unselectedFilterChecks",
        uiFilterChecks: "{that}.options.unselectedFilterChecks",
        matchedRows: [], // Map of row indices to boolean
        matchedRowIndices: [], // The indices of the matched rows
        selectedRows: [], // Map of row indices to boolean
        hoveredRows: [], // Map of row indices to boolean
        selectedIndex: null,
        hoveredIndex: null,
        resultsShowing: false
        // selectedHospital: null
    },
    members: {
        rowMarkers: [] // an array of Leaflet.Marker constructed during buildMap.addMarkers
    },
    templateUrl: null,
    searchResultTemplateUrl: null,
    iconPrefix: "",
    resources: {
        template: {
            url: "{that}.options.templateUrl"
        }
    },
    markers: {
        unzoomed: {
            symbol: "MarkerUnzoomed",
            iconSize: [9, 13],
            iconAnchor: [4.5, 13]
        },
        standard: {
            symbol: "Marker",
            iconSize: [51, 65],
            iconAnchor: [25.5, 65]
        },
        hover: {
            symbol: "MarkerHover",
            iconSize: [61, 76],
            iconAnchor: [30.5, 70]
        },
        selected: {
            symbol: "MarkerSelected",
            iconSize: [108, 108],
            iconAnchor: [54, 90]
        }
    },
    modelRelay: {
        // Data mapping:
        cities: {
            target: "cities",
            func: "fluid.covidMap.extractCities",
            args: ["{that}.model.rows", "{that}.options.fields.city"]
        },
        postcodes: {
            target: "postcodes",
            func: "fluid.covidMap.extractPostcodes",
            args: ["{that}.model.rows", "{that}.options.fields.postcode"]
        },
        // Selection and hover state
        isHospitalSelected: {
            target: "dom.hospitalPanel.visible",
            source: "selectedIndex",
            func: "fluid.isValue"
        },
        selectedHospital: {
            target: "selectedHospital",
            args: ["{that}.model.selectedIndex", "{that}.model.rows"],
            func: (index, rows) => rows[index]
        },
        selectedRows: {
            target: "selectedRows",
            args: ["{that}.model.rows", "{that}.model.selectedIndex"],
            func: "fluid.transforms.indexToBooleans"
        },
        hoveredRows: {
            target: "hoveredRows",
            args: ["{that}.model.rows", "{that}.model.hoveredIndex"],
            func: "fluid.transforms.indexToBooleans"
        },
        matchedRows: {
            target: "matchedRows",
            func: "fluid.covidMap.doQuery",
            args: ["{that}.model.rows", "{that}.model.query", "{that}.model.activeChecks", "{that}.options.accessibleChecks"]
        },
        matchedRowIndices: {
            target: "matchedRowIndices",
            source: "matchedRows",
            func: "fluid.transforms.setMembershipToArray"
        },
        resultsShowing: {
            source: "resultsShowing",
            target: "dom.resultsPage.visible"
        },
        citiesShowing: {
            source: "resultsShowing",
            target: "dom.citiesList.visible",
            func: x => !x
        },
        // Query reset visibility
        queryResetVisible: {
            source: "query",
            target: "dom.queryReset.visible",
            func: query => !!query
        },
        queryResultsShowing: {
            source: "query",
            target: "resultsShowing",
            func: query => !!query
        },
        // Marker size
        smallMarkers: {
            target: "smallMarkers",
            func: function (zoom, zoomThresh) {
                return zoom < zoomThresh;
            },
            args: ["{that}.model.zoom", "{that}.options.smallMarkersBelowZoom"]
        }
    },
    modelListeners: {
        // Ensure that freshly selected or hovered item is visible
        "showSelectedIndex": {
            path: "selectedIndex",
            funcName: "fluid.covidMap.showResultIndex",
            args: ["{that}", "{change}.value"],
            excludeSource: "resultsList"
        },
        "showHoveredIndex": {
            path: "hoveredIndex",
            funcName: "fluid.covidMap.showResultIndex",
            args: ["{that}", "{change}.value"],
            excludeSource: "resultsList"
        },
        // Update markers for selected or hovered items
        "selectedIndexMarkers": {
            path: "selectedIndex",
            funcName: "fluid.covidMap.updateMarkers",
            args: ["{that}", "{change}.value", "{change}.oldValue"]
        },
        "hoveredIndexMarkers": {
            path: "hoveredIndex",
            funcName: "fluid.covidMap.updateMarkers",
            args: ["{that}", "{change}.value", "{change}.oldValue"]
        },
        // Update all markers if marker size changes
        "smallMarkers": { // TODO: modelise marker choices
            path: "smallMarkers",
            excludeSource: "init",
            func: function (that) {
                that.rowMarkers.forEach(function (row, index) {
                    fluid.covidMap.updateMarker(that, index);
                });
            },
            args: "{that}"
        },
        // Marker visibility
        "markerVisibility": {
            path: "matchedRows",
            excludeSource: "init",
            funcName: "fluid.covidMap.updateMarkerVisibility",
            args: ["{that}", "{change}.value"]
        },
        "queryAccept": {
            path: "query",
            priority: "last",
            func: "{query}.accept",
            args: [0]
        }
    },
    components: {
        resultsPage: {
            type: "fluid.covidMap.resultsPage",
            container: "{that}.dom.resultsPage",
            options: {
                model: {
                    visiblePageIndices: "{map}.model.matchedRowIndices"
                }
            }
        },
        citiesList: {
            type: "fluid.covidMap.citiesList",
            container: "{that}.dom.citiesList",
            options: {
                model: {
                    cities: "{map}.model.cities"
                }
            }
        },
        backButton: {
            type: "fluid.styledButton",
            container: "{that}.dom.backButton",
            options: {
                modelListeners: {
                    "goBack": {
                        path: "activate",
                        changePath: "{map}.model.query",
                        value: ""
                    }
                }
            }
        },
        resetButton: {
            type: "fluid.styledButton",
            container: "{that}.dom.resetButton",
            options: {
                modelListeners: {
                    "resetFilters": {
                        path: "activate",
                        changePath: "{map}.model.uiFilterChecks",
                        value: "{map}.options.unselectedFilterChecks"
                    }
                }
            }
        },
        applyButton: {
            type: "fluid.styledButton",
            container: "{that}.dom.applyButton"
        },
        resetQueryButton: {
            type: "fluid.styledButton",
            container: "{that}.dom.queryReset",
            options: {
                modelListeners: {
                    "resetQuery": {
                        path: "activate",
                        changePath: "{map}.model.query",
                        value: ""
                    }
                }
            }
        },
        query: {
            type: "fluid.covidMap.autocomplete",
            container: "{that}.dom.queryHolder",
            options: {
                id: "{map}.options.ids.searchQuery",
                modelRelay: {
                    query: {
                        target: "{map}.model.query",
                        source: "dom.input.value"
                    }
                }
            }
        },
        selectedHospitalPane: {
            type: "fluid.covidMap.hospitalRenderer",
            container: "{that}.dom.hospitalPanel",
            options: {
                gradeNames: "fluid.viewComponent",
                model: {
                    row: "{map}.model.selectedHospital"
                },
                selectors: {
                    hospitalWebsite: ".fl-mapviz-hospital-website" // This field left over from fluid.covidMap.hospitalRenderer
                },
                modelRelay: {
                    hospitalWebsite: {
                        source: {
                            segs: ["row", "{map}.options.fields.website"]
                        },
                        target: "dom.hospitalWebsite.text"
                    }
                }
            }
        },
        filterControl: {
            type: "fluid.styledButton",
            container: "{that}.dom.filterControl",
            options: {
                model: {
                    filterVisible: true
                },
                modelRelay: {
                    toggle: {
                        source: "activate",
                        target: "filterVisible",
                        singleTransform: "fluid.transforms.toggle"
                    },
                    expanded: {
                        source: "filterVisible",
                        target: "{that}.model.dom.container.attrs.aria-expanded"
                    },
                    filterVisible: {
                        source: "filterVisible",
                        target: "{map}.model.dom.filterPanel.visible"
                    }
                }
            }
        },
        filterCount: {
            type: "fluid.viewComponent",
            container: "{that}.dom.filterCount",
            options: {
                model: {
                    // checkArray: Array
                    // filterCount: Number
                },
                modelRelay: {
                    checkArray: {
                        source: "{map}.model.uiFilterChecks",
                        target: "checkArray",
                        func: checks => Object.values(checks)
                    },
                    filterCount: {
                        source: "checkArray",
                        target: "filterCount",
                        func: checks => checks.reduce((acc, current) => acc + (+current), 0)
                    },
                    renderCount: {
                        source: "filterCount",
                        target: "dom.container.text"
                    }
                }
            }
        }
    },
    dynamicComponents: {
        filterChecks: {
            sources: "{that}.options.filters",
            type: "fluid.covidMap.filter",
            options: {
                // Weird integration model whilst we don't render markup
                container: "@expand:fluid.covidMap.findSelector({map}.container, {source}.selector)",
                key: "{sourcePath}",
                distributeOptions: {
                    target: "{that styledCheckbox}.options.gradeNames",
                    record: "fluid.covidMap.filterCheckboxInMap"
                }
            }
        }
    }
});

fluid.defaults("fluid.covidMap.filterCheckboxInMap", {
    modelRelay: {
        source: {
            context: "map",
            segs: ["uiFilterChecks", "{fluid.covidMap.filter}.options.key"]
        },
        target: "checked"
    }
});

fluid.defaults("fluid.covidMap.filter", {
    gradeNames: "fluid.viewComponent",
    // key: String
    selectors: {
        checkbox: ".fl-checkbox-holder",
        tooltipIcon: ".fl-mapviz-filter-tooltip-icon",
        tooltip: ".fl-mapviz-filter-tooltip",
        title: ".fl-mapviz-filter-title" // currently unused
    },
    components: {
        checkbox: {
            type: "fluid.styledCheckbox",
            container: "{filter}.dom.checkbox"
        }
    }
});

fluid.defaults("fluid.covidMap.autocomplete", {
    gradeNames: "hortis.autocomplete",
    invokers: {
        query: "fluid.covidMap.autocomplete.query({map}.model.cities, {map}.model.postcodes, {arguments}.0, {arguments}.1)"
    }
});

fluid.covidMap.autocomplete.query = function (cities, postcodes, query, callback) {
    var queried;
    var lower = query.trim().toLowerCase();
    if (fluid.covidMap.isPostcodeStart(lower)) {
        var upper = lower.toUpperCase();
        var codes = Object.keys(postcodes);
        var matches = codes.filter(function (code) {
            return code.startsWith(upper);
        });
        queried = matches;
    } else {
        queried = Array.prototype.filter.call(cities, function (city) {
            return city.toLowerCase().startsWith(lower);
        });
    }
    callback(queried);
};

// Stupid utility to compensate for lack of this-ism in expander resolution
fluid.covidMap.findSelector = function (scope, selector) {
    return scope.find(selector);
};

/** Maps an array and an index number to an array of booleans with `true` at the selected index
 * @param {Array} rows - An array of any type - only the length will be used
 * @param {Integer} selectedIndex - An index into the array
 * @return {Boolean[]} An array of booleans of the same length as `rows` with `true` at the index `selectedIndex` and
 * `false` at all other positions
 */
fluid.transforms.indexToBooleans = function (rows, selectedIndex) {
    return rows.map(function (row, index) {
        return index === selectedIndex;
    });
};

fluid.defaults("fluid.activatableComponent", {
    gradeNames: "fluid.viewComponent",
    model: {
        activate: 0
    },
    // These options will be forwarded to fluid.activatable applied to the container
    activatableOptions: {
    },
    invokers: {
        // This invoker only necessary as an integration artefact until fluid.activatable is made integral
        activate: {
            changePath: "activate",
            func: x => x + 1,
            args: "{that}.model.activate"
        }
    },
    listeners: {
        "onCreate.makeActivatable": {
            funcName: "fluid.activatable",
            args: ["{that}.container", "{that}.activate", "{that}.options.activatableOptions"]
        }
    }
});

fluid.defaults("fluid.styledCheckbox", {
    gradeNames: "fluid.activatableComponent",
    selectors: {
        control: ".fl-mapviz-checkbox"
    },
    model: {
        // checked: Boolean
    },
    modelRelay: {
        toggleChecked: {
            target: "checked",
            source: "activate",
            singleTransform: "fluid.transforms.toggle"
        },
        checked: {
            target: "checked",
            source: "{that}.model.dom.control.value"
        }
    },

    markup: {
        container: "<label class=\"fl-checkbox-holder\" tabindex=\"0\"><input class=\"fl-mapviz-checkbox visually-hidden\" tabindex=\"-1\" type=\"checkbox\"><span></span></label>"
    }
});

fluid.defaults("fluid.styledButton", {
    gradeNames: "fluid.activatableComponent",
    markup: {
        container: "<a class=\"fl-mapviz-apply-filters fl-mapviz-hoverable\" tabindex=\"0\"></a>"
    },
    modelRelay: {
        clickToActivate: {
            target: "activate",
            source: "{that}.model.dom.container.click"
        }
    }
});

fluid.defaults("fluid.covidMap.citiesList", {
    gradeNames: ["fluid.viewComponent"],
    markup: {
        cityTemplate: "<div class=\"fl-mapviz-city fl-mapviz-hoverable\">%city</div>"
    },
    selectors: {
        cities: ".fl-mapviz-cities",
        element: ".fl-mapviz-city"
    },
    modelListeners: {
        render: {
            path: "cities",
            func: "{that}.renderMarkup"
        }
    },
    invokers: {
        renderMarkup: "fluid.covidMap.citiesList.renderMarkup({that})",
        elementToIndex: "fluid.covidMap.elementToIndex({that}, {arguments}.0)"
    },
    listeners: {
        "onCreate.bindEvents": "fluid.covidMap.citiesList.bindEvents({that}, {map})"
    }
});

fluid.covidMap.citiesList.renderMarkup = function (that) {
    var template = that.options.markup.cityTemplate;
    var fragment = document.createDocumentFragment();
    that.model.cities.forEach(function (city, index) {
        var terms = {city: city};
        var record = fluid.stringTemplate(template, terms);
        var element = $(record);
        element.attr("data-fl-index", index);
        fragment.appendChild(element[0]);
    });
    var cities = that.locate("cities");
    cities.empty();
    cities[0].appendChild(fragment);
};

fluid.covidMap.citiesList.bindEvents = function (that, map) {
    that.container.click(function (event) {
        var index = that.elementToIndex(event.target);
        var city = that.model.cities[index];
        map.applier.change("query", city);
    });
};

fluid.defaults("fluid.covidMap.resultsPage", {
    gradeNames: ["fluid.viewComponent", "fluid.resourceLoader"],
    resources: {
        resultTemplate: {
            url: "{map}.options.searchResultTemplateUrl"
        }
    },
    members: {
        // Map of visiblePageIndices member to jQuery of DOM element
        indexToElement: []
    },
    model: {
        template: "{that}.resources.resultTemplate.parsed" // Hack so that it loads on model load
        // visiblePageIndices: []
    },
    selectors: {
        resultsList: ".fl-mapviz-search-results-list",
        element: ".fl-mapviz-search-result"
    },
    styles: {
        selected: "fl-mapviz-search-result-selected",
        hover: "fl-mapviz-search-result-hover"
    },
    modelListeners: {
        showSelected: {
            path: "{map}.model.selectedRows.*",
            funcName: "fluid.covidMap.booleanToClass",
            args: ["{that}", "{change}.path", "{change}.value", "{that}.options.styles.selected"]
        },
        showHover: {
            path: "{map}.model.hoveredRows.*",
            funcName: "fluid.covidMap.booleanToClass",
            args: ["{that}", "{change}.path", "{change}.value", "{that}.options.styles.hover"]
        },
        render: {
            path: "visiblePageIndices",
            func: "{that}.renderMarkup"
        }
    },
    listeners: {
        "onCreate.bindEvents": "fluid.covidMap.resultsPage.bindEvents({that}, {map})"
    },
    invokers: {
        renderMarkup: "fluid.covidMap.resultsPage.renderMarkup({that}, {map})",
        elementToIndex: "fluid.covidMap.elementToIndex({that}, {arguments}.0)"
    }
});

// Given change in row flag, map to toggled class of corresponding row
fluid.covidMap.booleanToClass = function (resultsPage, path, value, className) {
    var rowIndex = Number(fluid.peek(path));
    var cellIndex = resultsPage.model.visiblePageIndices.indexOf(Number(rowIndex));
    var element = resultsPage.indexToElement[cellIndex];
    if (element) {
        element.toggleClass(className, value);
    }
};

fluid.covidMap.elementToIndex = function (that, target) {
    var container = target.closest(that.options.selectors.element);
    return container ? container.getAttribute("data-fl-index") : -1;
};

fluid.covidMap.resultsPage.transduceTarget = function (that, map, target, prefix) {
    var cellIndex = that.elementToIndex(target);
    var rowIndex = that.model.visiblePageIndices[cellIndex];
    map.applier.change(prefix, rowIndex, "ADD", "resultsList");
};

fluid.covidMap.resultsPage.bindEvents = function (that, map) {
    that.container.click(function (event) {
        fluid.covidMap.resultsPage.transduceTarget(that, map, event.target, "selectedIndex");
    });
    that.container.mouseover(function (event) {
        fluid.covidMap.resultsPage.transduceTarget(that, map, event.target, "hoveredIndex");
    });
};

fluid.covidMap.rowToTerms = function (map, row) {
    return {
        hospitalTitle: row[map.options.fields.name],
        hospitalHours: fluid.covidMap.renderHours(row),
        hospitalAddress: fluid.covidMap.renderAddress(row),
        hospitalPhone: row[map.options.fields.phone]
    };
};

fluid.covidMap.resultsPage.renderMarkup = function (that, map) {
    var template = that.resources.resultTemplate.parsed;
    var indexToElement = [];
    var fragment = document.createDocumentFragment();
    that.model.visiblePageIndices.forEach(function (rowIndex, cellIndex) {
        var row = map.model.rows[rowIndex];
        var terms = fluid.covidMap.rowToTerms(map, row);
        var record = fluid.stringTemplate(template, terms);
        var element = $(record);
        element.attr("data-fl-index", cellIndex);
        element.toggleClass(that.options.styles.selected, map.model.selectedRows[rowIndex]);
        element.toggleClass(that.options.styles.hover, map.model.hoveredRows[rowIndex]);
        indexToElement[cellIndex] = element;
        fragment.appendChild(element[0]);
    });
    that.indexToElement = indexToElement;
    var resultsList = that.locate("resultsList");
    resultsList.empty();
    resultsList[0].appendChild(fragment);
};


fluid.covidMap.unselectedChecks = function (checks) {
    return fluid.transform(checks, () => false);
};

fluid.capitalize = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

fluid.covidMap.renderHours = function (row) {
    return ["monday", "tuesday", "wednesday", "thursday", "friday"].map(function (day) {
        return fluid.capitalize(day) + ": " + (row[day] || "closed");
    }).join(", ");
};

fluid.covidMap.renderAddress = function (row) {
    return row.address + ", " + row.city + ", " + row.province + " " + row.postal_code;
};

fluid.covidMap.isPostcodeStart = function (query) {
    return query.match(/[a-z][0-9]/i);
};

fluid.covidMap.doQuery = function (rows, query, activeChecks, checks) {
    var normalised = query.trim();
    var isPostcodeQuery = fluid.covidMap.isPostcodeStart(normalised);
    var noChecks = fluid.hashToArray(activeChecks).every(a => !a);
    // var checksActive = activeChecks.some(a => a) && activeChecks.some(a => !a);
    var anyMatched = false;
    var matched = rows.map(function (row) {
        var matchQuery = (isPostcodeQuery ? row.postal_code : row.city).startsWith(query);
        var checkMatches = fluid.transform(checks, function (record, key) {
            var value = row[record.column];
            return !activeChecks[key] || value.contains("Yes");
        });
        var matchChecks = noChecks || fluid.hashToArray(checkMatches).every(a => a);
        var match = matchQuery && matchChecks;
        anyMatched = anyMatched || match;
        return match;
    });
    if (!anyMatched) {
        matched = fluid.generate(rows.length, true);
    }
    return matched;
};

fluid.covidMap.updateMarker = function (that, index) {
    if (Number.isInteger(index)) {
        var markerKey = that.model.selectedRows[index] ? "selected" : (that.model.hoveredRows[index] ? "hover" : "standard");
        if (that.model.smallMarkers) { // TODO: stopgap until we have 3 unzoomed markers
            markerKey = "unzoomed";
        }
        var markerIcon = that.markers[markerKey];
        var marker = that.rowMarkers[index];
        if (marker) { // Row with invalid coordinates doesn't get marker
            marker.setIcon(markerIcon);
            marker._icon.removeAttribute("tabindex");
            $(marker._icon).toggleClass("visually-hidden", !that.model.matchedRows[index]);
        }
    }
};

fluid.covidMap.updateMarkers = function (that, index1, index2) {
    fluid.covidMap.updateMarker(that, index1);
    fluid.covidMap.updateMarker(that, index2);
};

fluid.covidMap.computeBounds = function (rows, matched, buffer) {
    var bounds = fluid.geom.emptyBounds();
    rows.forEach(function (row, index) {
        if (matched[index]) {
            fluid.geom.updateBounds(bounds, row.longitude, row.latitude);
        }
    });
    if (!fluid.geom.isEmptyBounds(bounds)) {
        fluid.geom.expandBounds(bounds, buffer);
    }
    return bounds;
};

fluid.covidMap.updateMarkerVisibility = function (that, matchedRows) {
    var allMatched = true;
    matchedRows.forEach(function (matched, index) {
        var marker = that.rowMarkers[index];
        if (marker) { // Some rows may not have valid coordinates and hence no markers
            $(marker._icon).toggleClass("visually-hidden", !matched);
        }
        allMatched = allMatched && matched;
    });
    var matchedBounds = fluid.covidMap.computeBounds(that.model.rows, matchedRows, that.options.boundsBuffer);
    var bounds = fluid.geom.isEmptyBounds(matchedBounds) || allMatched ? that.options.outerBounds : matchedBounds;
    that.fitBounds(bounds, true);
};

/** Ensure that the supplied search result at the supplied index is visible
 * @param {fluid.covidMap.
 */

fluid.covidMap.showResultIndex = function (that, newIndex) {
    if (Number.isInteger(newIndex)) {
        var visibleIndex = that.model.matchedRowIndices.indexOf(newIndex);
        var element = that.resultsPage.indexToElement[visibleIndex];
        if (element) {
            element[0].scrollIntoView();
        }
    }
};

fluid.covidMap.addMarkers = function (that) {
    that.markers = fluid.transform(that.options.markers, function (marker) {
        var markerOptions = fluid.extend({}, marker, {
            html: fluid.stringTemplate(that.options.markup.marker, {
                marker: marker.symbol,
                width: marker.iconSize[0],
                height: marker.iconSize[1]
            }),
            className: that.options.styles.marker
        });
        return L.divIcon(markerOptions);
    });

    $(that.container).on("click", function (event) {
        if (event.target === that.locate("map")[0]) {
            that.applier.change("selectedIndex", null);
        }
    });
    that.locate("attribution").find("a").attr("tabindex", -1);
    var data = that.resources.data.parsed.data;
    that.rowMarkers = [];
    data.forEach(function (row, index) {
        if (!row.latitude || !row.longitude) {
            fluid.log("Warning, ignoring row ", row, " which does not have valid coordinates");
        } else {
            var marker = L.marker([row.latitude, row.longitude], {
                icon: that.markers.standard
            }).addTo(that.map);
            that.rowMarkers[index] = marker;
            fluid.covidMap.updateMarker(that, index);
            marker.on("mouseover", function () {
                that.applier.change("hoveredIndex", index);
            });
            marker.on("mouseout", function () {
                that.applier.change("hoveredIndex", null);
            });
            marker.on("click", function () {
                that.applier.change("selectedIndex", index);
            });
            return marker;
        }
    });
};
