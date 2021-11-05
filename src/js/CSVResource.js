/* global Papa */

"use strict";

fluid.resourceLoader.parsers.csv = function (resourceText, options) {
    var defaultOptions = {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
    };
    var parseOptions = fluid.extend({}, defaultOptions, options.resourceSpec.csvOptions);

    var parsed = Papa.parse(resourceText, parseOptions);
    var togo = fluid.promise();
    if (parsed.errors.length > 0) {
        togo.reject(parsed.errors);
    } else {
        togo.resolve({
            meta: parsed.meta,
            headers: parsed.meta.fields,
            data: parsed.data
        });
    }
    return togo;
};

fluid.defaults("hortis.CSVResourceLoader", {
    gradeNames: ["fluid.resourceLoader"],
    dataUrl: "http://thing",
    resources: {
        data: {
            url: "{that}.options.dataUrl",
            dataType: "csv",
            immutableModelResource: true
        }
    },
    model: {
        rows: []
    },
    modelRelay: {
        source: "{that}.resources.data.parsed.data",
        target: "rows"
    }
});

fluid.defaults("hortis.ProvenancedCSVResourceLoader", {
    gradeNames: ["hortis.CSVResourceLoader"],
    resources: {
        provenance: {
            // url or promise
            dataType: "csv",
            immutableModelResource: true
        },
        provenanceMap: {
            dataType: "json"
        }
    },
    model: {
        provenance: []
    },
    modelRelay: {
        source: "{that}.resources.provenance.parsed.data",
        target: "provenance"
    }
});
