/* global L */

"use strict";

fluid.setLogging(true);

fluid.registerNamespace("fluid.covidMap");

fluid.covidMap.metresInMile = 1609.34;

fluid.defaults("fluid.covidMap.hospitalRenderer", {
    gradeNames: ["fluid.modelComponent"],
    selectors: {
        hospitalTitle: ".fl-mapviz-hospital-title",
        hospitalDescription: ".fl-mapviz-hospital-description",
        hospitalHours: ".fl-mapviz-hospital-hours",
        hospitalAddress: ".fl-mapviz-hospital-address",
        hospitalPhone:  ".fl-mapviz-hospital-phone",
        expandButton: ".fl-mapviz-expand-collapse-button"
    },
    components: {
        expandButton: {
            type: "fluid.expandButton",
            container: "{hospitalRenderer}.dom.expandButton",
            options: {
                model: {
                    expanded: "{map}.model.expandedPanels.hospitalPanel"
                },
                modelRelay: {
                    visibleDescription: {
                        source: "expanded",
                        target: "{hospitalRenderer}.model.dom.hospitalDescription.visible"
                    },
                    visibleTitle: {
                        source: "expanded",
                        target: "{hospitalRenderer}.model.dom.hospitalTitle.visible"
                    }
                }
            }
        }
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
    var cities = fluid.getMembers(rows, field).map(city => city.trim());
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
    mediaQueryBreakpoint: "screen and (min-width: 1024px)",
    parsedColours: "@expand:hortis.parseColours({that}.options.colours)",
    smallMarkersBelowZoom: 11,
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
            column: "Accessible Entrances"
        },
        washroom: {
            selector: ".fl-mapviz-filter-washrooms",
            column: "Accessible Washrooms"
        },
        parking: {
            selector: ".fl-mapviz-filter-parking",
            column: "Accessible Parking"
        },
        individual: {
            selector: ".fl-mapviz-filter-individual",
            column: "Individual Service"
        },
        wait: {
            selector: ".fl-mapviz-filter-wait",
            column: "Wait Accommodations"
        }
    },
    unselectedFilterChecks: "@expand:fluid.covidMap.unselectedChecks({that}.options.filters)",
    selectors: {
        query: ".fl-mapviz-query",
        filterPanel: ".fl-mapviz-filter-panel",
        resultsPage: ".fl-mapviz-search-results",
        citiesList: ".fl-mapviz-city-list",
        searchResultsBackButton: ".fl-mapviz-search-results-back-button",
        hospitalBackButton: ".fl-mapviz-hospital-back-button",
        hospitalPanel: ".fl-mapviz-hospital-panel",
        attribution: ".leaflet-control-attribution",
        resetButton: ".fl-mapviz-reset-filters",
        applyButton: ".fl-mapviz-apply-filters",
        filterCountOnDesktop: ".fl-mapviz-filter-count-on-desktop",
        filterCountOnMobile: ".fl-mapviz-filter-count-on-mobile",
        locationButtonOnMobile: ".fl-mapviz-locations-button-on-mobile",
        filterButtonOnMobile: ".fl-mapviz-filter-button-on-mobile",
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
        "onCreate.detectWindowSize": {
            funcName: "fluid.covidMap.detectWindowSize",
            args: ["{that}"]
        },
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
        queryResult: [], // Map of row indices to {match: Boolean, matchFilters: Boolean}
        matchedRows: [], // Map of row indices to boolean
        matchedRowIndices: [], // The indices of the matched rows
        selectedRows: [], // Map of row indices to boolean
        hoveredRows: [], // Map of row indices to boolean
        activeRows: [], // Map of row indices to boolean
        selectedIndex: null,
        hoveredIndex: null,
        resultsShowing: false,

        // `visiblePanelArray` and `visiblePanelFlags` are relayed to each other using `fluid.transforms.arrayToSetMembership`
        // visiblePanelArray: null,    // An array of panels that should be visible. Panels that are not in this array should be invisible.
        visiblePanelFlags: {
            citiesList: "{that}.model.dom.citiesList.visible",
            resultsPage: "{that}.model.dom.resultsPage.visible",
            filterPanel: "{that}.model.dom.filterPanel.visible",
            hospitalPanel: "{that}.model.dom.hospitalPanel.visible"
        }

        // isDesktopView: null,  // A boolean indicating if the window size is a desktop view
        // isMobileView: null,   // A boolean indicating if the window size is a mobile view
        // expandedPanels: {}   // An object whose keys are panel names and values are their expanded state
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
        standard: {
            symbol: "Marker",
            iconSize: [23, 33],
            iconAnchor: [11.5, 33]
        },
        standardInactive: {
            symbol: "MarkerInactive",
            iconSize: [23, 33],
            iconAnchor: [11.5, 33]
        },
        standardHover: {
            symbol: "MarkerHover",
            iconSize: [27, 37],
            iconAnchor: [13.5, 35]
        },
        standardSelected: {
            symbol: "MarkerSelected",
            iconSize: [49, 49],
            iconAnchor: [24.5, 41]
        },
        small: {
            symbol: "MarkerSmall",
            iconSize: [9, 13],
            iconAnchor: [4.5, 13]
        },
        smallInactive: {
            symbol: "MarkerSmallInactive",
            iconSize: [9, 13],
            iconAnchor: [4.5, 13]
        },
        smallHover: {
            symbol: "MarkerSmallHover",
            iconSize: [10.5, 14.5],
            iconAnchor: [5.25, 13.5]
        },
        smallSelected: {
            symbol: "MarkerSmallSelected",
            iconSize: [19.5, 19.5],
            iconAnchor: [9.75, 17]
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
        queryResults: {
            target: "queryResults",
            func: "fluid.covidMap.doQuery",
            args: ["{that}.model.rows", "{that}.model.query", "{that}.model.activeFilterChecks", "{that}.options.filters"]
        },
        matchedRows: {
            target: "matchedRows",
            func: "fluid.getMembers",
            args: ["{that}.model.queryResults", "match"]
        },
        matchedRowIndices: {
            target: "matchedRowIndices",
            source: "matchedRows",
            func: "fluid.transforms.setMembershipToArray"
        },
        resultsPanelShowing: {
            source: "resultsShowing",
            target: "dom.resultsPage.visible"
        },
        resultsPanelExpanding: {
            source: "resultsShowing",
            target: "{resultsPage}.expandButton.model.expanded",
            backward: "never"
        },
        // Query reset visibility
        queryResetVisible: {
            source: "query",
            target: "dom.queryReset.visible",
            func: query => !!query
        },
        queryToResultsShowing: {
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
        },
        isMobileView: {
            source: "isDesktopView",
            target: "isMobileView",
            func: value => !value
        },
        visiblePanelArrayToFlags: {
            source: "visiblePanelArray",
            target: "visiblePanelFlags",
            singleTransform: {
                type: "fluid.transforms.arrayToSetMembership",
                options: {
                    "citiesList": "citiesList",
                    "resultsPage": "resultsPage",
                    "filterPanel": "filterPanel",
                    "hospitalPanel": "hospitalPanel"
                }
            },
            backward: "never"
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
        // Update all markers if marker size changes or there is a query
        "smallMarkers": { // TODO: modelise marker choices
            path: ["smallMarkers", "queryResults"],
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
            path: "queryResults",
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
        filterPanel: {
            type: "fluid.covidMap.filterPanel",
            container: "{that}.dom.filterPanel"
        },
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
        searchResultsBackButton: {
            type: "fluid.backButton",
            container: "{that}.dom.searchResultsBackButton"
        },
        hospitalBackButton: {
            type: "fluid.backButton",
            container: "{that}.dom.hospitalBackButton"
        },
        resetButton: {
            type: "fluid.button",
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
            type: "fluid.button",
            container: "{that}.dom.applyButton",
            options: {
                modelListeners: {
                    applyFilters: {
                        path: "activate",
                        changePath: "{map}.model.activeFilterChecks",
                        value: "{map}.model.uiFilterChecks"
                    }
                }
            }
        },
        resetQueryButton: {
            type: "fluid.button",
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
        hospitalPanel: {
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
        filterCountOnDesktop: {
            type: "fluid.covidMap.filterCount",
            container: "{that}.dom.filterCountOnDesktop"
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
                    target: "{that filterCheckbox}.options.gradeNames",
                    record: "fluid.covidMap.filterCheckboxInMap"
                }
            }
        },
        desktopViewHandler: {
            source: "{map}.model.isDesktopView",
            type: "fluid.covidMap.desktopViewHandler"
        },
        mobileViewHandler: {
            source: "{map}.model.isMobileView",
            type: "fluid.covidMap.mobileViewHandler"
        }
    }
});

fluid.covidMap.detectWindowSize = function (that) {
    const mediaQuery = window.matchMedia(that.options.mediaQueryBreakpoint);
    that.applier.change("isDesktopView", mediaQuery.matches);
    mediaQuery.addListener(function (evt) {
        that.applier.change("isDesktopView", evt.matches);
    });
};

// The desktop view handler
fluid.defaults("fluid.covidMap.desktopViewHandler", {
    gradeNames: "fluid.modelComponent",
    listeners: {
        "onCreate.setVisiblePanels": {
            listener: "{map}.applier.change",
            args: ["visiblePanelArray", ["citiesList", "filterPanel"]]
        },
        "onCreate.setExpandedPanels": {
            listener: "{map}.applier.change",
            args: ["expandedPanels", {
                citiesList: true,
                resultsPage: true,
                filterPanel: true,
                hospitalPanel: true
            }]
        }
    },
    modelRelay: {
        // The results page and hide the cities list is only shown one at a time based on the hospital results.
        citiesShowing: {
            source: "{map}.model.resultsShowing",
            target: "{map}.model.dom.citiesList.visible",
            func: x => !x
        }
    }
});

// The mobile view handler
fluid.defaults("fluid.covidMap.mobileViewHandler", {
    gradeNames: "fluid.modelComponent",
    components: {
        filterCountOnMobile: {
            type: "fluid.covidMap.filterCount",
            container: "{map}.dom.filterCountOnMobile"
        },
        locationButtonOnMobile: {
            type: "fluid.button",
            container: "{map}.dom.locationButtonOnMobile",
            options: {
                modelListeners: {
                    "resetQuery": {
                        path: "activate",
                        changePath: "{map}.model.query",
                        value: ""
                    },
                    "showCitiesList": {
                        path: "activate",
                        changePath: "{map}.model.visiblePanelArray",
                        value: ["citiesList"]
                    },
                    "expandCitiesList": {
                        path: "activate",
                        changePath: "{map}.model.expandedPanels.citiesList",
                        value: true
                    }
                }
            }
        },
        filterButtonOnMobile: {
            type: "fluid.button",
            container: "{map}.dom.filterButtonOnMobile",
            options: {
                modelListeners: {
                    "showFilterPanel": {
                        path: "activate",
                        changePath: "{map}.model.visiblePanelArray",
                        value: ["filterPanel"]
                    },
                    "expandFilterPanel": {
                        path: "activate",
                        changePath: "{map}.model.expandedPanels.filterPanel",
                        value: true
                    }
                }
            }
        }
    },
    listeners: {
        "onCreate.setVisiblePanels": {
            listener: "{map}.applier.change",
            args: ["visiblePanelArray", ["citiesList"]]
        },
        "onCreate.setExpandedPanels": {
            listener: "{map}.applier.change",
            args: ["expandedPanels", {
                citiesList: false,
                resultsPage: true,
                filterPanel: true,
                hospitalPanel: true
            }]
        }
    },
    modelRelay: {
        // As "back to location" buttons reset the query value, when the query value is empty,
        // show the citiesList panel only, otherwise, only show the results page.
        backToCities: {
            source: "{map}.model.query",
            target: "{map}.model.visiblePanelArray",
            func: x => x ? ["resultsPage"] : ["citiesList"]
        },
        // When results are available, expand and show the results page only.
        onlyShowResultsPage: {
            source: "{map}.model.resultsShowing",
            target: "{map}.model.visiblePanelArray",
            func: x => {if (x) {return ["resultsPage"];}}
        },
        expandResultsPage: {
            source: "{map}.model.resultsShowing",
            target: "{map}.model.expandedPanels.resultsPage",
            func: x => {if (x) {return true;}}
        },
        // When a hospital is selected, expand and show the hospital panel only.
        onlyShowHospitalPanel: {
            source: "{map}.model.selectedIndex",
            target: "{map}.model.visiblePanelArray",
            func: x => {if (x) {return ["hospitalPanel"];}}
        },
        expandHospitalPanel: {
            source: "{map}.model.selectedIndex",
            target: "{map}.model.expandedPanels.hospitalPanel",
            func: x => {if (x) {return true;}}
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
    selectors: {
        checkbox: ".fl-mapviz-checkbox",
        tooltipIcon: ".fl-mapviz-filter-tooltip-icon",
        tooltip: ".fl-mapviz-filter-tooltip",
        title: ".fl-mapviz-filter-title" // currently unused
    },
    components: {
        checkbox: {
            type: "fluid.covidMap.filterCheckbox",
            container: "{filter}.dom.checkbox"
        }
    }
});

fluid.defaults("fluid.covidMap.filterCount", {
    gradeNames: "fluid.viewComponent",
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
});

fluid.defaults("fluid.covidMap.filterPanel", {
    gradeNames: ["fluid.viewComponent"],
    selectors: {
        title: ".fl-mapviz-filter-panel-title",
        filters: ".fl-mapviz-filters",
        filterButtons: ".fl-mapviz-filter-buttons",
        expandButton: ".fl-mapviz-expand-collapse-button"
    },
    components: {
        expandButton: {
            type: "fluid.expandButton",
            container: "{filterPanel}.dom.expandButton",
            options: {
                model: {
                    expanded: "{map}.model.expandedPanels.filterPanel"
                },
                modelRelay: {
                    visibleTitle: {
                        source: "expanded",
                        target: "{filterPanel}.model.dom.title.visible"
                    },
                    visibleFilters: {
                        source: "expanded",
                        target: "{filterPanel}.model.dom.filters.visible"
                    },
                    visibleFilterButtons: {
                        source: "expanded",
                        target: "{filterPanel}.model.dom.filterButtons.visible"
                    }
                }
            }
        }
    }
});

fluid.defaults("fluid.covidMap.filterCheckbox", {
    gradeNames: "fluid.viewComponent",
    model: {
        // checked: Boolean
    },
    modelRelay: {
        checked: {
            source: "dom.container.value",
            target: "checked"
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

fluid.defaults("fluid.button", {
    gradeNames: "fluid.viewComponent",
    model: {
        activate: 0
    },
    markup: {
        container: "<a class=\"fl-mapviz-apply-filters\" tabindex=\"0\"></a>"
    },
    modelRelay: {
        clickToActivate: {
            target: "activate",
            source: "{that}.model.dom.container.click"
        }
    }
});

fluid.defaults("fluid.backButton", {
    gradeNames: "fluid.button",
    modelListeners: {
        "resetQuery": {
            path: "activate",
            changePath: "{map}.model.query",
            value: ""
        },
        "resetSelectedIndex": {
            path: "activate",
            changePath: "{map}.model.selectedIndex",
            value: null
        }
    }
});

// The cities list component
fluid.defaults("fluid.covidMap.citiesList", {
    gradeNames: ["fluid.viewComponent"],
    markup: {
        cityTemplate: "<div class=\"fl-mapviz-city fl-mapviz-hoverable-focusable\">%city</div>"
    },
    selectors: {
        title: ".fl-mapviz-city-list-title",
        cities: ".fl-mapviz-cities",
        element: ".fl-mapviz-city",
        expandButton: ".fl-mapviz-expand-collapse-button"
    },
    modelListeners: {
        render: {
            path: "cities",
            func: "{that}.renderMarkup"
        }
    },
    components: {
        expandButton: {
            type: "fluid.expandButton",
            container: "{citiesList}.dom.expandButton",
            options: {
                model: {
                    expanded: "{map}.model.expandedPanels.citiesList"
                },
                modelRelay: {
                    visibleTitle: {
                        source: "expanded",
                        target: "{citiesList}.model.dom.title.visible"
                    },
                    visibleCities: {
                        source: "expanded",
                        target: "{citiesList}.model.dom.cities.visible"
                    }
                }
            }
        }
    },
    invokers: {
        renderMarkup: "fluid.covidMap.citiesList.renderMarkup({that})",
        elementToIndex: "fluid.covidMap.elementToIndex({that}, {arguments}.0)"
    },
    listeners: {
        "onCreate.bindCitiesListEvents": "fluid.covidMap.citiesList.bindEvents({that}, {map})"
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
        element: ".fl-mapviz-search-result",
        expandButton: ".fl-mapviz-expand-collapse-button"
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
    components: {
        expandButton: {
            type: "fluid.expandButton",
            container: "{resultsPage}.dom.expandButton",
            options: {
                model: {
                    expanded: "{map}.model.expandedPanels.resultsPage"
                },
                modelRelay: {
                    visibleResultsList: {
                        source: "expanded",
                        target: "{resultsPage}.model.dom.resultsList.visible"
                    }
                }
            }
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

/** Perform the query, producing a set of matched rows
 * @param {Object[]} rows - The data rows as loaded from CSV
 * @param {String} query - The user's query string as present in the search box or imputed from the city selection
 * @param {Boolean[]} activeChecks - The state of currently active accessibility filter checks
 * @param {Object<String, Object>} filters - The filter check configuration structure, mapping keys to records encoding column
 * @return {MatchElement[]} An array of match elements, containing booleans {match, matchQuery, matchFilters} indicating which part of the query state has matched
 */
fluid.covidMap.doQuery = function (rows, query, activeChecks, filters) {
    var normalised = query.trim();
    var isPostcodeQuery = fluid.covidMap.isPostcodeStart(normalised);
    var anyMatched = false;
    var matched = rows.map(function (row) {
        var matchQuery = (isPostcodeQuery ? row.postal_code : row.city).startsWith(query);
        var filterMatches = fluid.transform(filters, function (record, key) {
            var value = row[record.column];
            return !activeChecks[key] || value.includes("Yes");
        });
        var matchFilters = fluid.hashToArray(filterMatches).every(a => a);
        var match = matchQuery && matchFilters;
        anyMatched = anyMatched || match;
        return {
            match: match,
            matchQuery: matchQuery,
            matchFilters: matchFilters // Note that this field is not currently read by anything
        };
    });
    if (!anyMatched) {
        matched = fluid.generate(rows.length, {
            match: true,
            matchQuery: true,
            matchFilters: true
        });
    }
    return matched;
};

/** Update the map marker for a single row
 * @param {fluid.covidMap.map} that - The map instance
 * @param {Integer} index - The index of the row whose map marker is to be updated to be shown, referred to the total array of rows
 */
fluid.covidMap.updateMarker = function (that, index) {
    if (Number.isInteger(index)) {
        var isInactive = !that.model.queryResults[index].match;
        var markerSuffix = isInactive ? "Inactive" :
            that.model.selectedRows[index] ? "Selected" :
                that.model.hoveredRows[index] ? "Hover" : "";
        var markerPrefix = that.model.smallMarkers ? "small" : "standard";
        var markerKey = markerPrefix + markerSuffix;
        var markerIcon = that.markers[markerKey];
        var marker = that.rowMarkers[index];
        if (marker) { // Row with invalid coordinates doesn't get marker
            marker.setIcon(markerIcon);
            marker._icon.removeAttribute("tabindex");
            // Duplicate with logic in fluid.covidMap.updateMarkerVisibility
            $(marker._icon).toggle(that.model.queryResults[index].matchQuery);
        }
    }
};

fluid.covidMap.updateMarkers = function (that, index1, index2) {
    fluid.covidMap.updateMarker(that, index1);
    fluid.covidMap.updateMarker(that, index2);
};

fluid.covidMap.computeBounds = function (rows, queryResults, buffer) {
    var bounds = fluid.geom.emptyBounds();
    rows.forEach(function (row, index) {
        if (queryResults[index].match && row.longitude && row.latitude) {
            fluid.geom.updateBounds(bounds, row.longitude, row.latitude);
        }
    });
    if (!fluid.geom.isEmptyBounds(bounds)) {
        fluid.geom.expandBounds(bounds, buffer);
    }
    return bounds;
};

fluid.covidMap.updateMarkerVisibility = function (that, queryResults) {
    var allMatched = true;
    queryResults.forEach(function (oneResult, index) {
        var marker = that.rowMarkers[index];
        var showMarker = oneResult.matchQuery;
        if (marker) { // Some rows may not have valid coordinates and hence no markers
            $(marker._icon).toggle(showMarker);
        }
        allMatched = allMatched && showMarker;
    });
    var matchedBounds = fluid.covidMap.computeBounds(that.model.rows, queryResults, that.options.boundsBuffer);
    var bounds = fluid.geom.isEmptyBounds(matchedBounds) || allMatched ? that.options.outerBounds : matchedBounds;
    that.fitBounds(bounds, true);
};

/** Ensure that the supplied search result at the supplied index is visible
 * @param {fluid.covidMap.map} that - The map instance
 * @param {Integer} newIndex - The index of the result to be shown, referred to the total array of rows
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

/** Bind mouse events to a map marker. One day we will disuse leaflet map markers and render these directly,
 * but until then, this binding must be done in this literal and inefficient way.
 * @param {fluid.covidMap.map} that - The map instance
 * @param {leaflet.Marker} marker - The leaflet Marker object
 * @param {Integer} index - The index of marker's row
 */
fluid.covidMap.bindMarker = function (that, marker, index) {
    var isActive = function () {
        return that.model.queryResults[index].match;
    };
    marker.on("mouseover", function () {
        if (isActive()) {
            that.applier.change("hoveredIndex", index);
        }
    });
    marker.on("mouseout", function () {
        if (isActive()) {
            that.applier.change("hoveredIndex", null);
        }
    });
    marker.on("click", function () {
        if (isActive()) {
            that.applier.change("selectedIndex", index);
        }
    });
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
            fluid.covidMap.bindMarker(that, marker, index);
            return marker;
        }
    });
};
