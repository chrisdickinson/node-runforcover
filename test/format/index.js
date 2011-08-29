#!/usr/bin/env node

var runforcover = require("../../index");
var fs = require('fs');
var path = require('path');

var coverage = runforcover.cover();

var test1 = require("./src/test1");
var test2 = require("./src/test2");

test1.run();
test2.run();

coverage(function(coverageData) {
    // coverageData is an object keyed by filename.
    for(var filename in coverageData) {
        if (!coverageData.hasOwnProperty(filename)) {
            continue;
        }

        var html = runforcover.formatters.html.format(coverageData[filename]);

        var filePath = path.join('html', path.basename(filename) + ".html");

        html = "<style>" + "\n"
        + "  .covered { background: #C9F76F; }" + "\n"
        + "  .uncovered { background: #FDD; }" + "\n"
        + "  .partialuncovered { background: #FFA; }" + "\n"
        + "</style>" + "\n"
        + html;
        fs.writeFileSync(filePath, html);

        // return control back to the original require function
        coverage.release(); 
    }
});