var Table = require('cli-table');

module.exports.format = function(coverageData) {
    var source = coverageData.bunker.sources[0].split('\n');
    var stats = coverageData.stats();
    var filename = coverageData.filename;
    var table = new Table({ head: ['#', 'Line'], colWidths: [5, 80]});
    stats.lines.forEach(function (line) {
        table.push([line.lineno, line.source()])
    });
    return 'File: ' + filename + '\n' + table.toString();
}