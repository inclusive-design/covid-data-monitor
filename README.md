# We Count Covid Data Monitor

This package implements a map and query-based visualisation of data on Ontario COVID-19 assessment centre locations for
project [We Count](https://wecount.inclusivedesign.ca/).

It includes built-in data that merges [the ODS assessment centre locations dataset](https://data.ontario.ca/dataset/covid-19-assessment-centre-locations)
with a mocked accessibility dataset for these assessment centres to visualize at [data/merged/output.csv](data/merged.output.csv).

## Install

After checking out this project, run `npm install`.

## Development

The primary styling of this project is written in [Sass](https://sass-lang.com/). At development, to automatically
watch changes in Scss files and compile into CSS files, run

    npm run watch:scss

To manually compile Scss files into CSS files, run

    npm run build:scss

## Testing

To quickly see the interface in action, load `index.html` from this directory in your browser from a local static HTTP server.
This index sources live data from the GitHub [covid-assessment-centres](https://github.com/inclusive-design/covid-assessment-centres) repository.

This repository is a demonstration of Project WeCount's pluralistic data infrastructure, whose implementation and
description can be seen at [forgiving-data](https://github.com/inclusive-design/forgiving-data). This infrastructure
allows data to be aggregated and merged from a variety of sources whilst tracking provenance. In order to test the
provenance display of this interface (at the time of writing), you can scroll to "North York" in the list of cities
in the left panel, and then select from the first couple of hospitals shown - the first hospital in the list,
"North York General Hospital - Branson" should show up with stale (2020 provenance) in the bottom right display
pane, and others should show up with synthetic provenance.

## Building

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

## Design 
Live designs for this work may be seen in 
[Figma](https://www.figma.com/file/0lcLol3X5MmOXackT2YbHJ/WeCount-website?node-id=2291%3A0).
