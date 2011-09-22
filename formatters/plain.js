function pad(text, width) {
  var result = '';
  for (var i = 0; i < width - text.length; i++) {
    result += ' ';
  }
  return result + text;
}

module.exports.format = function(coverageData) {
    var source = coverageData.bunker.sources[0].split('\n');
    var stats = coverageData.stats();
    var filename = coverageData.filename;
    var result = 'File: ' + filename + '\n\n';
    stats.lines.forEach(function (line) {
        result += pad('' + line.lineno, 5) + ' | ' + line.source() + '\n';
    });
    return result + '\n';
}