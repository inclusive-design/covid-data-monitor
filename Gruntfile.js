/*
Copyright 2020 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

/* eslint-env node */
"use strict";

module.exports = function (grunt) {
    grunt.config.init({
        lintAll: {
            sources: {
                md: ["*.md"],
                js: ["*.js"],
                json: ["*.json"],
                css: ["*.css"]
            }
        }
    });
    grunt.loadNpmTasks("fluid-grunt-lint-all");
    grunt.registerTask("lint", "Perform all standard lint checks.", ["lint-all"]);

    grunt.registerTask("default", ["lint"]);
};
