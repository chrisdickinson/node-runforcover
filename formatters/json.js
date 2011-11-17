module.exports.format = function(coverageData) {
    var source = coverageData.bunker.sources[0].split('\n');
    var stats = coverageData.stats();
    var filename = coverageData.filename;
    var result = { filename: filename, stats: stats, source: source };
    return JSON.stringify(result);
}