var bunker = require('bunker'),
    Module = require('module').Module,
    path = require('path'),
    fs = require('fs'),
    vm = require('vm'),
    html_formatter = require('./formatters/html'),
    cli_formatter = require('./formatters/cli'),
    json_formatter = require('./formatters/json');

function CoverageData (filename, bunker) {
  this.bunker = bunker;
  this.filename = filename;
  this.nodes = {};
};

CoverageData.prototype.visit = function(node) {
  ++(this.nodes[node.id] = this.nodes[node.id] || {node:node, count:0}).count;
};

CoverageData.prototype.missing = function() {
  var nodes = this.nodes,
      missing = this.bunker.nodes.filter(function(node) {
        return !nodes[node.id];
      });

  return missing;
};

CoverageData.prototype.seen = function() {  
  var nodes = this.nodes,
      seen = this.bunker.nodes.filter(function(node) {
        return !!nodes[node.id];
      });

  return seen;
};

// Explode all multi-line nodes into single-line ones.
var explodeNodes = function(coverageData, fileData) {  
  var missing = coverageData.missing(); 
  var newNodes = [];

  // Get only the multi-line nodes.
  var multiLineNodes = missing.filter(function(node) {
    return (node.node[0].start.line < node.node[0].end.line);
  });

  for(var i = 0; i < multiLineNodes.length; i++) {
    // Get the current node and delta
    var node = multiLineNodes[i];
    var lineDelta = node.node[0].end.line - node.node[0].start.line + 1;

    for(var j = 0; j < lineDelta; j++) {
      // For each line in the multi-line node, we'll create a 
      // new node, and we set the start and end columns
      // to the correct vlaues.
      var curLine = node.node[0].start.line + j;
      var startCol = 0;
      var endCol = fileData[curLine].length;;
      if (curLine === node.node[0].start.line) {
        startCol = node.node[0].start.col;
      }
      else if (curLine === node.node[0].end.line) {
        startCol = 0;
        endCol = node.node[0].end.col;
      }

      var newNode = {
        node: [
          {
            start: {
              line: curLine,
              col: startCol
            },
            end: {
              line: curLine,
              col: endCol
            }
          }
        ]
      };

      newNodes.push(newNode);
    }
  }

  return newNodes;
}

CoverageData.prototype.coverage = function() {  
  var missingLines = this.missing(),
      fileData = fs.readFileSync(this.filename, 'utf8').split('\n');

  // Get a dictionary of all the lines we did observe being at least
  // partially covered
  seen = {};

  this.seen().forEach(function(node) {
    seen[node.node[0].start.line] = true;
  });

  // Add all the new multi-line nodes.
  missingLines = missingLines.concat(explodeNodes(this, fileData));

  var seenNodes = {};
  missingLines = missingLines.sort(
    function(lhs, rhs) {
      var lhsNode = lhs.node[0];
      var rhsNode = rhs.node[0];

      // First try to sort based on line
      return lhsNode.start.line < rhsNode.start.line ? -1 : // first try line
             lhsNode.start.line > rhsNode.start.line ? 1  :
             lhsNode.start.col < rhsNode.start.col ? -1 : // then try start col
             lhsNode.start.col > rhsNode.start.col ? 1 :
             lhsNode.end.col < rhsNode.end.col ? -1 : // then try end col
             lhsNode.end.col > rhsNode.end.col ? 1 : 
             0; // then just give up and say they are equal
  }).filter(
    function(node) {
      // If it is a multi-line node, we can just ignore it
      if (node.node[0].start.line < node.node[0].end.line) {
        return false;
      }

      // We allow multiple nodes per line, but only one node per
      // start column (due to how bunker works)
      var okay = false;
      if (seenNodes.hasOwnProperty(node.node[0].start.line)) {
        var isNew = (seenNodes[node.node[0].start.line].indexOf(node.node[0].start.col) < 0);
        if (isNew) {
          seenNodes[node.node[0].start.line].push(node.node[0].start.col);
          okay = true;
        }
      }
      else {
          seenNodes[node.node[0].start.line] = [node.node[0].start.col];
          okay = true;
      }

      return okay;
  });

  var coverage = {};

  missingLines.forEach(function(node) {
    var line = node.node[0].start.line + 1;
    var startCol = node.node[0].start.col;
    var endCol = node.node[0].end.col;
    var source = fileData[line - 1];
    var partial = seen.hasOwnProperty(line - 1) && seen[line - 1];

    if (coverage.hasOwnProperty(line)) {
      coverage[line].missing.push({startCol: startCol, endCol: endCol});
    }
    else {
      coverage[line] = {
        partial: partial,
        source: source,
        missing: [{startCol: startCol, endCol: endCol}]
      };
    }
  });

  return coverage;
};

CoverageData.prototype.stats = function() {
  var missing = this.missing(),
      filedata = fs.readFileSync(this.filename, 'utf8').split('\n');

  var seenLines = [],
      lines = 
      missing.sort(function(lhs, rhs) {
        return lhs.node[0].start.line < rhs.node[0].start.line ? -1 :
               lhs.node[0].start.line > rhs.node[0].start.line ? 1  :
               0;
      }).filter(function(node) {

        var okay = (seenLines.indexOf(node.node[0].start.line) < 0);
        if(okay)
          seenLines.push(node.node[0].start.line);
        return okay;

      }).map(function(node, idx, all) {
        return {
          lineno:node.node[0].start.line + 1,
          source:function() { return filedata[node.node[0].start.line]; }
        };
      });

  return {
    percentage:(filedata.length-seenLines.length)/filedata.length,
    lines:lines,
    missing:seenLines.length,
    seen:(filedata.length-seenLines.length),
    coverage: this.coverage()
  };
};

module.exports.createEnvironment = function(module, filename) {
    var req = function(path) {
      return Module._load(path, module);
    };
    req.resolve = function(request) {
      return Module._resolveFilename(request, module)[1];
    }
    req.paths = Module._paths;
    req.main = process.mainModule;
    req.extensions = Module._extensions;
    req.registerExtension = function() {
      throw new Error('require.registerExtension() removed. Use ' +
                      'require.extensions instead.');
    }
    require.cache = Module._cache;

    var ctxt = {};
    for(var k in global)
      ctxt[k] = global[k];

    ctxt.require = req;
    ctxt.exports = module.exports;
    ctxt.__filename = filename;
    ctxt.__dirname = path.dirname(filename);
    ctxt.process = process;
    ctxt.console = console;
    ctxt.module = module;
    ctxt.global = ctxt;

    return ctxt;
};

module.exports.formatters = {
  html: html_formatter,
  cli: cli_formatter,
  json: json_formatter
};

module.exports.cover = function(fileRegex) {
  var originalRequire = require.extensions['.js'],
      coverageData = {},
      match = fileRegex instanceof RegExp ?
        fileRegex : new RegExp(
            fileRegex ? fileRegex.replace(/\//g, '\\/').replace(/\./g, '\\.') : '.*'
        , ''),
      target = this;
    

  require.extensions['.js'] = function(module, filename) {

    if(!match.test(filename)) return originalRequire(module, filename);

    var context = target.createEnvironment(module, filename),
        data = fs.readFileSync(filename, 'utf8'),
        bunkerized = bunker(data),
        coverage = coverageData[filename] = new CoverageData(filename, bunkerized);

    bunkerized.on('node', coverage.visit.bind(coverage));
    bunkerized.assign(context);

    var wrapper = '(function(ctxt) { with(ctxt) { return '+Module.wrap(bunkerized.compile())+'; } })',
        compiledWrapper = vm.runInThisContext(wrapper, filename, true)(context);

    var args = [context.exports, context.require, module, filename, context.__dirname];
    return compiledWrapper.apply(module.exports, args);
  };

  var retval = function(ready) {
    ready(coverageData);
  };

  retval.release = function() {
    require.extensions['.js'] = originalRequire;
  };

  return retval;
};

