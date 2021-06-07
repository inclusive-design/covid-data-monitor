/* eslint-env node */
"use strict";

var readline = require("readline"),
    minimist = require("minimist"),
    fs = require("fs-extra"),
    resolve = require("resolve");

var fluid = require("infusion");
var terser = require("terser");

var buildIndex = {
    excludes: [
        "index.html"
    ],
    localSource: [
    ],
    codeHeader: "",
    codeFooter: "", // "\njQuery.noConflict()",
    copy: [{
        src: "src/html/template.html",
        dest: "build/html/template.html"
    }, {
        src: "src/css/demo.css",
        dest: "build/css/demo.css"
    }, {
        src: "%sanitize.css/sanitize.css",
        dest: "build/css/sanitize.css"
    }, {
        src: "src/html/searchResultTemplate.html",
        dest: "build/html/searchResultTemplate.html"
    }, {
        src: "src/buildTest/index.html",
        dest: "build/index.html"
    }, {
        src: "data/merged/output.csv",
        dest: "build/data/output.csv"
    }]
};

var infusion_prefix = "%infusion";

var parsedArgs = minimist(process.argv.slice(2));

// minimist has a wierd undocumented pathway for options beginning "no" - https://github.com/substack/minimist/blob/master/index.js#L118
// We accept the option "--no-infusion" in order to exclude Infusion's files from the build
var noInfusion = parsedArgs.infusion === false;

var readLines = function (filename) {
    var lines = [];
    var togo = fluid.promise();
    var rl = readline.createInterface({
        input: fs.createReadStream(filename),
        terminal: false
    });
    rl.on("line", function (line) {
        lines.push(line);
    });
    rl.on("close", function () {
        togo.resolve(lines);
    });
    rl.on("error", function (error) {
        togo.reject(error);
    });
    return togo;
};

/**
 * Resolve a templated module file to a file with an absolute path.
 * @param {String} file - A file path. The path can contain or not contain a template string starting with "%".
 * @return {String} The actual file location with an absolute path
 */
var fileResolver = function (file) {
    return file.startsWith("%") ? resolve.sync(file.replace(/^%/, "")) : file;
};

var filesToContentHash = function (allFiles, extension) {
    var extFiles = allFiles.filter(function (file) {
        return file.endsWith(extension);
    });
    var hash = fluid.transform(fluid.arrayToHash(extFiles), function (troo, filename) {
        return fs.readFileSync(fileResolver(filename), "utf8");
    });
    return hash;
};

var computeAllFiles = function (buildIndex, nodeFiles) {
    var withExcludes = nodeFiles.filter(function (oneFile) {
        return !buildIndex.excludes.some(function (oneExclude) {
            return oneFile.indexOf(oneExclude) !== -1;
        });
    });
    var withInf = withExcludes.filter(function (oneFile) {
        return !(noInfusion && oneFile.startsWith(infusion_prefix));
    });
    return withInf.concat(buildIndex.localSource);
};

var buildFromFiles = function (buildIndex, nodeFiles) {
    var allFiles = computeAllFiles(buildIndex, nodeFiles);
    nodeFiles.concat(buildIndex.localSource);

    var jsHash = filesToContentHash(allFiles, ".js", noInfusion);
    var fullJsHash = fluid.extend({header: buildIndex.codeHeader}, jsHash, {footer: buildIndex.codeFooter});
    fluid.log("Minifying " + Object.keys(fullJsHash).length + " JS files ... ");
    console.log("Sizes", fluid.transform(fullJsHash, function (file) {
        return file.length;
    }));
    var promise = terser.minify(fullJsHash, {
        mangle: false,
        sourceMap: {
            filename: "covid-data-monitor.js",
            url: "covid-data-monitor.js.map",
            root: "../../"
        }
    });
    promise.then(function (minified) {
        fs.removeSync("build");
        fs.ensureDirSync("build/js");
        fs.writeFileSync("build/js/covid-data-monitor.js", minified.code, "utf8");
        fs.writeFileSync("build/js/covid-data-monitor.js.map", minified.map);

        var cssHash = filesToContentHash(allFiles, ".css", noInfusion);
        var cssConcat = String.prototype.concat.apply("", Object.values(cssHash));

        fs.ensureDirSync("build/css");
        fs.writeFileSync("build/css/covid-data-monitor-all.css", cssConcat);
        buildIndex.copy.forEach(function (oneCopy) {
            fs.copySync(fileResolver(oneCopy.src), oneCopy.dest);
        });
        fluid.log("Copied " + (buildIndex.copy.length + 3) + " files to " + fs.realpathSync("build"));
    });
};

fluid.setLogging(true);

var linesPromise = readLines("topublish.txt");

linesPromise.then(function (lines) {
    buildFromFiles(buildIndex, lines);
}, function (error) {
    console.log(error);
});
