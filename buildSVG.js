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

fluid.copyChildren = function (target, source) {
    while (source.hasChildNodes()) {
        target.appendChild(source.childNodes[0]);
    }
};

fluid.removeChildren = function (node) {
    while (node.hasChildNodes()) {
        node.removeChild(node.lastChild);
    }
};

fluid.nodeToText = function (node, indentLevel) {
    var text = node.outerHTML;
    var formatted = jsBeautify.html(text, {
        indent_level: indentLevel || 0,
        preserve_newlines: false,
        end_with_newline: true
    });
    return formatted;
};

fluid.writeFile = function (path, text) {
    fs.writeFileSync(path, text, "utf8");

    var fd = fs.openSync(path);
    console.log("Written " + fs.fstatSync(fd).size + " bytes to " + path);
};

fluid.each(svgmap.images, function (filename, key) {
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
    fluid.copyChildren(newNode, svgNode);
    rootNode.appendChild(newNode);
});

var formatted = fluid.nodeToText(rootNode, 4);

fs.writeFileSync(outputFile, formatted, "utf8");

var fd = fs.openSync(outputFile);
console.log("Written " + fs.fstatSync(fd).size + " bytes to " + outputFile);

svgmap.targets.forEach(function (oneTarget) {
    var content = fs.readFileSync(oneTarget.path, "utf8");
    var dom = new jsdom.JSDOM(content);
    var doc = dom.window.document;
    var targetNode = doc.querySelector(oneTarget.selector);
    if (targetNode) {
        console.log("Got node ", targetNode);
        fluid.removeChildren(targetNode);
        var copy = rootNode.cloneNode(true);
        fluid.copyChildren(targetNode, copy);
        var text;
        if (oneTarget.fragment) {
            var node = doc.documentElement.querySelector("body *");
            text = fluid.nodeToText(node);
        } else {
            text = "<!DOCTYPE html>\n" + fluid.nodeToText(doc.documentElement);
        }
        fluid.writeFile(oneTarget.path, text);
    } else {
        console.log("Could not find selector " + oneTarget.selector + " in document " + oneTarget.path);
    }
});
