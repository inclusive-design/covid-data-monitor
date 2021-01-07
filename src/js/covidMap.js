/* global L */

"use strict";

fluid.setLogging(true);

fluid.registerNamespace("fluid.covidMap");

fluid.covidMap.metresInMile = 1609.34;

fluid.defaults("fluid.covidMap.pagerBar", {
    gradeNames: "fluid.pager.pagerBar",
    components: {
        pageList: {
            type: "fluid.emptySubcomponent"
        }
    },
    selectors: {
        previous: ".fld-mapviz-page-left",
        next: ".fld-mapviz-page-right"
    }
});

fluid.defaults("fluid.covidMap.pager", {
    gradeNames: "fluid.pager",
    dynamicComponents: {
        pagerBar: {
            type: "fluid.covidMap.pagerBar"
        },
        summary: {
            options: {
                strings: {
                    message: "Showing results %first-%last of %total"
                }
            }
        }
    },
    modelRelay: {
        // These definitions taken from Pager's summary subcomponent, should go into its definition
        firstIndex: {
            target: "firstIndex",
            func: (pageIndex, pageSize) => pageIndex * pageSize + 1,
            args: ["{that}.model.pageIndex", "{that}.model.pageSize"]
        },
        lastIndex: {
            target: "lastIndex",
            source: "",
            func: "fluid.pager.computePageLimit"
        }
    },
    selectors: {
        summary: ".fld-mapviz-pagination-summary",
        // Note that we just about get away with the Pager's notion of a "pager bar" since we created a container for its
        // buttons - but how would we accommodate, e.g., a model where the user wanted the summary duplicated etc.?
        // Note that the pager has an interesting model of "duplicated but not repeating" components. This can't be accommodated
        // in the renderer's current idiom which assumes that a selector which matches multiple nodes implies a contiguous area of repetition.
        // Well - it sort of can - since it depends on the "sources" idiom which is model-driven rather than markup driven. We could upgrade it
        // so that a boolean lensed component or unlensed component could duplicate itself into multiple containers - but still, this would
        // imply a mismatch in cardinality of the model source and the number of instantiated components. We would better turn these into
        // distinct subcomponents with distinct DOM binder selectors and linked models.
        pagerBar: ".fld-mapviz-pagination-buttons"
    },
    invokers: {
        acquireDefaultRange: { // TODO: Totally absurd integration model for Pager
            func: function () {
                return undefined;
            }
        }
    }
});

fluid.defaults("fluid.covidMap.hospitalRenderer", {
    gradeNames: "fluid.modelComponent",
    selectors: {
        hospitalTitle: ".fld-mapviz-hospital-title",
        hospitalHours: ".fld-mapviz-hospital-hours",
        hospitalAddress: ".fld-mapviz-hospital-address",
        hospitalPhone:  ".fld-mapviz-hospital-phone"
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

fluid.covidMap.extractCities = function (rows, field) {
    var cities = fluid.getMembers(rows, field);
    var cityHash = fluid.arrayToHash(cities);
    return Object.keys(cityHash);
};

fluid.defaults("fluid.covidMap.map", {
    gradeNames: ["hortis.leafletMap", "hortis.streetmapTiles", "hortis.CSVLeafletMap", "hortis.conditionalTemplateRenderer"],
    colours: {
        accessible: "#0f0",
        inaccessible: "#f00"
    },
    smallMarkersBelowZoom: 9,
    fields: {
        city: "city",
        name: "location_name",
        website: "website",
        phone: "phone"
    },
    filters: {
        entrances: {
            selector: ".fld-mapviz-filter-entrances",
            column: "Wheelchair-accessible entrance"
        },
        washroom: {
            selector: ".fld-mapviz-filter-washrooms",
            column: "Wheelchair-accessible bathrooms"
        },
        parking: {
            selector: ".fld-mapviz-filter-parking",
            column: "Accessible parking"
        },
        individual: {
            selector: ".fld-mapviz-filter-individual",
            column: "Personalized or individual service is offered"
        },
        wait: {
            selector: ".fld-mapviz-filter-wait",
            column: "Queue accomodations"
        }
    },
    unselectedFilterChecks: "@expand:fluid.covidMap.unselectedChecks({that}.options.filters)",
    parsedColours: "@expand:hortis.parseColours({that}.options.colours)",
    selectors: {
        query: ".fld-mapviz-query",
        pager: ".fld-mapviz-search-result-pagination",
        resultsPage: ".fld-mapviz-search-results",
        hospitalPanel: ".fld-mapviz-hospital-panel",
        attribution: ".leaflet-control-attribution",
        resetButton: ".fld-mapviz-reset-filters",
        applyButton: ".fld-mapviz-reset-filters",
        filterPanel: ".fl-mapviz-filter-panel",
        filterControl: ".fld-filter-control",
        filterCount: ".fld-filter-count"
    },
    listeners: {
        "buildMap.addMarkers": {
            funcName: "fluid.covidMap.addMarkers",
            args: ["{that}", "{that}.options.parsedColours", "{that}.options.markup)"],
            priority: "last"
        }
    },
    model: {
        cities: [],
        query: "",
        pageSize: 5,
        activeFilterChecks: "{that}.options.unselectedFilterChecks",
        uiFilterChecks: "{that}.options.unselectedFilterChecks",
        matchedRows: [], // Map of row indices to boolean
        matchedRowIndices: [], // The indices of the matched rows
        visiblePageIndices: [], // The indices, selected from matchedRowIndices, which are visible
        selectedRows: [], // Map of row indices to boolean
        hoveredRows: [], // Map of row indices to boolean
        selectedIndex: null,
        hoveredIndex: null
        // selectedHospital: null
    },
    members: {
        rowMarkers: [] // an array of Leaflet.Marker constructed during buildMap.addMarkers
    },
    // TODO: Allow resources to be defaulted in a civilized manner
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
            iconUrl: "img/Marker-unzoomed.svg",
            iconSize: [9, 13],
            iconAnchor: [4.5, 13]
        },
        standard: {
            iconUrl: "img/Marker.svg",
            iconSize: [51, 65],
            iconAnchor: [25.5, 65]
        },
        hover: {
            iconUrl: "img/Marker-hover.svg",
            iconSize: [61, 76],
            iconAnchor: [30.5, 70]
        },
        selected: {
            iconUrl: "img/Marker-selected.svg",
            iconSize: [108, 108],
            iconAnchor: [54, 90]
        }
    },
    modelRelay: {
        // Cities:
        cities: {
            target: "cities",
            func: "fluid.covidMap.extractCities",
            args: ["{that}.model.rows", "{that}.options.fields.city"]
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
        // Query state
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
        // Paging state
        visiblePageIndices: {
            target: "visiblePageIndices",
            func: function (matchedRowIndices, firstIndex, lastIndex) {
                return matchedRowIndices.slice(firstIndex - 1, lastIndex);
            },
            args: ["{that}.model.matchedRowIndices", "{pager}.model.firstIndex", "{pager}.model.lastIndex"]
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
        "selectedIndexPage": {
            path: "selectedIndex",
            funcName: "fluid.covidMap.showPageForIndex",
            args: ["{that}", "{change}.value"]
        },
        "hoveredIndexPage": {
            path: "hoveredIndex",
            funcName: "fluid.covidMap.showPageForIndex",
            args: ["{that}", "{change}.value"]
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
        // reset and apply buttons
        "resetFilters": {
            path: "{resetButton}.model.activate",
            changePath: "{map}.model.uiFilterChecks",
            value: "{that}.options.unselectedFilterChecks"
        }
    },
    components: {
        pager: {
            type: "fluid.covidMap.pager",
            container: "{that}.dom.pager",
            options: {
                model: {
                    totalRange: "{map}.model.matchedRowIndices.length",
                    pageSize: "{map}.model.pageSize"
                }
            }
        },
        resultsPage: {
            type: "fluid.covidMap.map.resultsPage",
            container: "{that}.dom.resultsPage",
            options: {
                model: {
                    visiblePageIndices: "{map}.model.visiblePageIndices"
                }
            }
        },
        resetButton: {
            type: "fluid.styledButton",
            container: "{that}.dom.resetButton"
        },
        applyButton: {
            type: "fluid.styledButton",
            container: "{that}.dom.applyButton"
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
                    hospitalWebsite: ".fld-mapviz-hospital-website" // This field left over from fluid.covidMap.hospitalRenderer
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
        checkbox: ".flc-checkbox-holder",
        tooltipIcon: ".fld-mapviz-filter-tooltip-icon",
        tooltip: ".fld-mapviz-filter-tooltip",
        title: ".fld-mapviz-filter-title" // currently unused
    },
    components: {
        checkbox: {
            type: "fluid.styledCheckbox",
            container: "{filter}.dom.checkbox"
        }
    }
});

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
        control: ".fld-mapviz-checkbox"
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
        container: "<label class=\"flc-checkbox-holder\" tabindex=\"0\"><input class=\"fld-mapviz-checkbox visually-hidden\" tabindex=\"-1\" type=\"checkbox\"><span></span></label>"
    }
});

fluid.defaults("fluid.styledButton", {
    gradeNames: "fluid.activatableComponent",
    markup: {
        container: "<a class=\"fld-mapviz-apply-filters flc-mapviz-hoverable\" tabindex=\"0\"></a>"
    },
    modelRelay: {
        clickToActivate: {
            target: "activate",
            source: "{that}.model.dom.container.click"
        }
    }
});

fluid.defaults("fluid.covidMap.map.resultsPage", {
    gradeNames: "fluid.viewComponent",
    model: {
        // visiblePageIndices: []
    },
    selectors: {
        resultList: ".fld-mapviz-search-result-list"
    },
    listeners: {
        // TODO: eliminate this workflow when we move to real renderer
        // "onCreate.clear": {
        //      "this": "{resultsPage}.dom.resultList",
        //      method: "empty"
        // }
    },
    dynamicComponents: {
        searchResults: {
            sources: "{resultsPage}.model.visiblePageIndices",
            type: "fluid.covidMap.map.searchResult",
            options: {
                parentContainer: "{resultsPage}.dom.resultList"
            }
        }
    }
});

fluid.defaults("fluid.covidMap.map.searchResult", {
    gradeNames: ["fluid.covidMap.hospitalRenderer", "fluid.templateRenderingView"],
    templateUrl: "{map}.options.searchResultTemplateUrl",
    model: {
        hospitalIndex: "{source}"
    },
    styles: {
        selected: "fl-mapviz-search-result-selected",
        hover: "fl-mapviz-search-result-hover"
    },
    modelRelay: {
        fetchRow: {
            target: "row",
            func: (index, rows) => rows[index],
            args: ["{that}.model.hospitalIndex", "{map}.model.rows"]
        },
        isSelected: {
            target: "isSelected",
            func: (index, selectedRows) => selectedRows[index],
            args: ["{that}.model.hospitalIndex", "{map}.model.selectedRows"]
        },
        isHovered: {
            target: "isHovered",
            func: (index, hoveredRows) => hoveredRows[index],
            args: ["{that}.model.hospitalIndex", "{map}.model.hoveredRows"]
        },
        // Rendering directives
        showSelected: {
            source: "isSelected",
            target: {
                segs: ["dom", "container", "class", "{that}.options.styles.selected"]
            }
        },
        showHovered: {
            source: "isHovered",
            target: {
                segs: ["dom", "container", "class", "{that}.options.styles.hover"]
            }
        }
    },
    modelListeners: {
        clickToSelect: {
            path: "dom.container.click",
            changePath: "{map}.model.selectedIndex",
            value: "{that}.model.hospitalIndex"
        },
        hoverToHover: {
            path: "dom.container.hover",
            changePath: "{map}.model.hoveredIndex",
            value: "{that}.model.hospitalIndex"
        }
    }
});

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

fluid.covidMap.doQuery = function (rows, query, activeChecks, checks) {
    var tokens = query.split(" ").map(s => s.trim()).filter(t => t);
    var noChecks = fluid.hashToArray(activeChecks).every(a => !a);
    // var checksActive = activeChecks.some(a => a) && activeChecks.some(a => !a);
    var selected = rows.map(function (row) {
        var address = fluid.covidMap.renderAddress(row);
        var matchTokens = tokens.length ? tokens.some(t => address.contains(t)) : true;
        var checkMatches = fluid.transform(checks, function (record, key) {
            var value = row[record.column];
            return !activeChecks[key] || value.contains("Yes");
        });
        var matchChecks = noChecks || fluid.hashToArray(checkMatches).every(a => a);
        return matchTokens && matchChecks;
    });
    return selected;
};

fluid.covidMap.updateMarker = function (that, index) {
    if (Number.isInteger(index)) {
        var markerIcon = that.model.selectedRows[index] ? that.markers.selected :
            (that.model.hoveredRows[index] ? that.markers.hover : that.markers.standard);
        if (that.model.smallMarkers) {
            markerIcon = that.markers.unzoomed;
        }
        var marker = that.rowMarkers[index];
        marker.setIcon(markerIcon);
        marker._icon.removeAttribute("tabindex");
    }
};

fluid.covidMap.updateMarkers = function (that, index1, index2) {
    fluid.covidMap.updateMarker(that, index1);
    fluid.covidMap.updateMarker(that, index2);
};

fluid.covidMap.showPageForIndex = function (that, newIndex) {
    if (Number.isInteger(newIndex)) {
        var filterIndex = that.model.matchedRowIndices.indexOf(newIndex);
        if (filterIndex !== -1) {
            var pageIndex = Math.floor(filterIndex / that.model.pageSize);
            that.pager.applier.change("pageIndex", pageIndex);
        }
    }
};

fluid.covidMap.addMarkers = function (that) {
    that.markers = fluid.transform(that.options.markers, function (marker) {
        var markerOptions = fluid.extend({}, marker, {
            iconUrl: that.options.iconPrefix + marker.iconUrl
        });
        return L.icon(markerOptions);
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
