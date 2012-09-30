/*
 * Copyright (c) 2011-2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */


/*jslint anon:true, nomen:true, sloppy:true, stupid:true*/


// TODO:
//  * draw each request separately somehow


var run,
    libpath = require('path'),
    libfs = require('fs'),
    existsSync = libfs.existsSync || libpath.existsSync,
    libutils = require(libpath.join(__dirname, '../../management/utils')),
    templatePath = libpath.join(__dirname, 'profiler-graph.svg.hb'),
    Y = require('yui').YUI(),
    CMDS = {},

    MODE_ALL = parseInt('777', 8),
    LOG_SEPARATOR = '|',

    artifactsDir = 'artifacts',
    resultsDir = 'artifacts/profiler';


function lpad(inStr, pad, max) {
    var add,
        outStr = '',
        a;
    add = max - inStr.length;
    if (add < 0) {
        return inStr;
    }
    for (a = 0; a < add; a += 1 ) {
        outStr += pad;
    }
    outStr += inStr;
    return outStr;
}


function logProcess(lines) {
    var log = { requests: {} },
        width,
        requestID;

    Y.Array.each(lines, function(line, l) {
        var parts,
            entry;

        if (!line) {
            return;
        }
        entry = null;
        parts = line.split(LOG_SEPARATOR);
        if ('MARK' === parts[0] || 'TIMELINE' === parts[0]) {
            entry = {
                logOrder: l,
                type: parts.shift(),
                request: parseInt(parts.shift(), 10),
                start: parseInt(parts.shift(), 10),
                typeSpecific: parts.shift(),
                group: parts.shift(),
                label: parts.shift(),
                id: parts.shift()
            };
            entry.desc = parts.join(LOG_SEPARATOR);
            if ('TIMELINE' === entry.type) {
                entry.duration = parseInt(entry.typeSpecific, 10);
                entry.end = entry.start + entry.duration;
            }

            // Normally we'd just use entry.request, but there's a bug
            // in perf.server where it'll use the wrong request ID, even
            // without concurrency.
            if ('request' === entry.label) {
                requestID = entry.request;
            }
        }
        if (entry && requestID) {
            if (!log.requests[requestID]) {
                log.requests[requestID] = { entries: [] };
            }
            log.requests[requestID].entries.push(entry);
        }
    });

    Y.Object.each(log.requests, function(req) {
        req.min = Number.POSITIVE_INFINITY;
        req.max = Number.NEGATIVE_INFINITY;
        Y.Array.each(req.entries, function(entry) {
            req.min = Math.min(req.min, entry.start);
            req.max = Math.max(req.max, entry.start);
            if (entry.end) {
                min = Math.min(req.min, entry.end);
                max = Math.max(req.max, entry.end);
            }
        });
        req.duration = req.max - req.min;
    });
    width = (Object.keys(log.requests).length + '').length;
    if (width < 3) {
        width = 3;
    }

    log.maxOffset = Number.NEGATIVE_INFINITY;
    Y.Object.each(log.requests, function(req, r) {
        req.label = lpad('' + r, '0', width);
        Y.Array.each(req.entries, function(entry) {
            entry.startOffset = entry.start - req.min;
            log.maxOffset = Math.max(log.maxOffset, entry.startOffset);
            if (entry.end) {
                entry.endOffset = entry.end - req.min;
                log.maxOffset = Math.max(log.maxOffset, entry.endOffset);
            }
        });
    });

    return log;
}


CMDS.graph = function(params, options) {
    var env,
        store,
        inFile,
        outFile,
        lines,
        log,
        template,
        context = {},
        graph;

    if (params.length) {
        libutils.error('Unknown extra parameters.');
        return;
    }

    options = options || {};

    // default log if --log filename.ext is not set
    inFile = options.log || 'perf.log';

    outFile = inFile.replace(/\.log$/, '.svg');
    outFile = libpath.join(resultsDir, outFile);

    // make results dir
    if (!existsSync(artifactsDir)) {
        libfs.mkdirSync(artifactsDir, MODE_ALL);
    }
    if (!existsSync(resultsDir)) {
        libfs.mkdirSync(resultsDir, MODE_ALL);
    }

    lines = libfs.readFileSync(inFile, 'utf-8').split('\n');
    log = logProcess(lines);

    Y.applyConfig({useSync: true});
    Y.use('handlebars');

    template = libfs.readFileSync(templatePath, 'utf-8');
    context.logs = JSON.stringify(log);
    graph = Y.Handlebars.render(template, context);

    libfs.writeFileSync(outFile, graph, 'utf-8');
    console.log('graph drawn in ' + outFile);
};


run = function(params, options) {
    var cmd = params.shift();
    if (!CMDS[cmd]) {
        console.log(exports.usage);
        return;
    }
    CMDS[cmd](params, options);
};


/**
 * Standard usage string export.
 */
exports.usage = 'mojito profiler {action}\n' +
    '\n' +
    'ACTIONS\n' +
    '    graph   generates an SVG image of the profiling log\n' +
    '            --log     path to log file (default perf.log)\n';


/**
 * Standard options list export.
 */
exports.options = [
    {
        longName: 'log',
        shortName: null,
        hasValue: true
    }
];


/**
 * Standard run method hook export.
 */
exports.run = run;


