# We Count Covid Data Monitor

This package implements a map and query-based visualisation of data on Ontario COVID-19 assessment centre locations for
project [We Count](https://wecount.inclusivedesign.ca/).

Tt includes a built-in rather stale copy of the data to visualise at data/assessment_centre_locations.csv but when
deployed it will source its data from the live and regularly updated repository at https://github.com/inclusive-design/covid-assessment-centres .

After checking out this project, run `npm install`.

To quickly see the interface in action, load `index.html` from this directory in your browser from a local static HTTP server.

To produce a rolled-up build suitable for deployment run

    node build.js

To produce a build omitting the Infusion library, run
    
    node build.js --no-infusion

The resulting build artefacts will be generated in directory `build`, together with a self-test for the build in 
`build/index.html`.

The project files may be linted by running `grunt lint`.

This work is at a relatively early design and implementation stage - live designs may be seen at https://www.figma.com/file/0lcLol3X5MmOXackT2YbHJ/WeCount-website?node-id=2291%3A0 .
Various courtesies such as test cases and fully accessible markup will shortly arise.
