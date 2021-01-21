/* eslint-env node */
"use strict";

var fluid = require("infusion"),
    fs = require("fs"),
    jsdom = require("jsdom"),
    jsBeautify = require("js-beautify");

var svgmap = require("./svgmap.json");

var rootNode = "<svg xmlns=\"http://www.w3.org/2000/svg\" style=\"display: none;\">";

var outputFile = "buildSVG/svgIcons.html";

var rootDom = new jsdom.JSDOM(rootNode);
var rootDoc = rootDom.window.document;
rootNode = rootDoc.querySelector("svg");

var noCopyAttrs = ["width", "height", "xmlns", "xmlns:xlink", "id", "x", "y", "version", "xml:space"];

fluid.each(svgmap, function (filename, key) {
    var file = fs.readFileSync(filename, "utf8");
    var filefrag = jsdom.JSDOM.fragment(file);
    var svgNode = filefrag.querySelector("svg");
    var newNode = rootDoc.createElement("symbol");
    newNode.setAttribute("id", key);
    var attrs = svgNode.getAttributeNames();
    attrs.forEach(function (attrName) {
        if (!noCopyAttrs.includes(attrName)) {
            newNode.setAttribute(attrName, svgNode.getAttribute(attrName));
        }
    });
    while (svgNode.hasChildNodes()) {
        newNode.appendChild(svgNode.childNodes[0]);
    }
    rootNode.appendChild(newNode);
});

var text = rootNode.outerHTML;
var formatted = jsBeautify.html(text, {
    indent_level: 4
});

fs.writeFileSync(outputFile, formatted, "utf8");

var fd = fs.openSync(outputFile);
console.log("Written " + fs.fstatSync(fd).size + " bytes to " + outputFile);
