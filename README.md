# We Count Covid Data Monitor

This package implements a map and query-based visualisation of data on Ontario COVID-19 assessment centre locations for
project [We Count](https://wecount.inclusivedesign.ca/).

It includes a built-in data that merges [the ODS assessment centre locations dataset](https://data.ontario.ca/dataset/covid-19-assessment-centre-locations)
with a mocked accessibility dataset for these assessment centres to visualize at data/merged/output.csv.

## Install

After checking out this project, run `npm install`.

## Development

The primary styling of this project is written in [Sass](https://sass-lang.com/). At development, to automatically
watch changes in Scss files and compile into CSS files, run

    npm run watch:scss

To manually compile Scss files into CSS files, run

    npm run build:scss

## Build & Run

To quickly see the interface in action, load `index.html` from this directory in your browser from a local static HTTP server.

To produce a rolled-up build suitable for deployment run

    npm run build

To produce a build omitting the Infusion library, run

    npm run build:noInfusion

The resulting build artefacts will be generated in directory `build`, together with a self-test for the build in
`build/index.html`.

## Regenerating SVG icon build

To produce a fresh HTML build from a collection of SVG icon files held in `src/img`, indexed by the file `svgmap.json`, run

    node buildSVG.js

This will produce output in `buildSVG/svgIcons.html` which is automatically pasted into `index.html` and the
bundled template in `src/html/template.html`.

## Lint

The project files may be linted by running `npm run lint`.

This work is at a relatively early design and implementation stage - live designs may be seen at
[here](https://www.figma.com/file/0lcLol3X5MmOXackT2YbHJ/WeCount-website?node-id=2291%3A0).
Various courtesies such as test cases and fully accessible markup will shortly arise.
