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
    Y = require('yui').YUI(),

    MODE_ALL = parseInt('777', 8),

    artifactsDir = 'artifacts',
    resultsDir = 'artifacts/profiler',

    LOG_SEPARATOR = '|',
    SVG_WIDTH = 800,
    SVG_HEADER_HEIGHT = 20,
    SVG_HEADER_PADDING = 4,
    SVG_ENTRY_HEIGHT = 20,
    SVG_ENTRY_OFFSET = 2,
    SVG_FONT_SIZE = 8,

    XML_CHARS = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
    };


function addCommas(str) {
    var rx = /(\d+)(\d{3})/;
    str += '';
    while (rx.test(str)) {
        str = str.replace(rx, '$1,$2');
    }
    return str;
}


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


function xmlEncode(str) {
    return str.replace(/[&<>"']/g, function(c) { return XML_CHARS[c]; });
}


function logProcess(lines) {
    var log = { requests: {} },
        width;

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
        }
        if (entry) {
            if (!log.requests[entry.request]) {
                log.requests[entry.request] = { entries: [] };
            }
            log.requests[entry.request].entries.push(entry);
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

    log.maxDuration = Number.NEGATIVE_INFINITY;
    Y.Object.each(log.requests, function(req, r) {
        log.maxDuration = Math.max(log.maxDuration, req.duration);
        req.label = lpad('' + r, '0', width);
        Y.Array.each(req.entries, function(entry) {
            entry.startOffset = entry.start - req.min;
            if (entry.end) {
                entry.endOffset = entry.end - req.min;
            }
        });
    });

    return log;
}


function svgDraw(file, log) {
    var maxEntries = Number.NEGATIVE_INFINITY,
        svg,
        pixelsPerSecond;

    Y.Object.each(log.requests, function(req) {
        maxEntries = Math.max(maxEntries, req.entries.length);
    });

    svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="' + SVG_WIDTH + 'px" height="' + (SVG_HEADER_HEIGHT + (maxEntries * SVG_ENTRY_HEIGHT)) + 'px">\n';
    svg += '    <title>mojito profile</title>\n';

    svg += '    <style type="text/css" >\n';
    svg += '        text { font-size: ' + SVG_FONT_SIZE + 'pt; }\n';
    svg += '        text.left { text-anchor: start; }\n';
    svg += '        text.right { text-anchor: end; }\n';
    svg += '        #header-bg { fill: #CCCCCC; stroke: none; }\n';
    svg += '        #header-txt { font-size: 12pt; text-anchor: start; }\n';
    svg += '        .MARK     { fill: #FF8888; stroke: none; }\n';
    svg += '        .TIMELINE { fill: #8888FF; stroke: none; }\n';
    svg += '    </style>\n';

    svg += '    <g id="header">\n';
    svg += '        <rect id="header-bg" x="0" width="' + SVG_WIDTH + '" y="0" height="' + SVG_HEADER_HEIGHT + '"/>\n';
    svg += '        <text id="header-txt" x="' + SVG_HEADER_PADDING + '" y="' + (SVG_HEADER_HEIGHT - SVG_HEADER_PADDING)+ '"></text>\n';
    svg += '    </g>\n';

    pixelsPerSecond = SVG_WIDTH / log.maxDuration;

    Y.Object.each(log.requests, function(req, r) {
        var laststart = req.min;

        svg += '    <g id="request-' + req.label + '" class="request">\n';
        req.entries.sort(function(a, b) {
            if (a.start === b.start) {
                return a.logOrder - b.logOrder;
            }
            return a.start - b.start;
        });
        Y.Array.each(req.entries, function(entry, e) {
            var
                x0,
                x1,
                y0,
                y1,
                ytext,
                text,
                tooltip;

            y0 = SVG_HEADER_HEIGHT + SVG_ENTRY_OFFSET + (e * SVG_ENTRY_HEIGHT);
            y1 = SVG_HEADER_HEIGHT + ((e + 1) * SVG_ENTRY_HEIGHT) - SVG_ENTRY_OFFSET;
            x0 = Math.round(entry.startOffset * pixelsPerSecond);

            text = [entry.group, entry.label].join(':');
            if (entry.id) {
                text += '[' + entry.id + ']';
            }

            tooltip = [];
            tooltip.push(entry.startOffset);
            tooltip.push('+' + addCommas(entry.start - laststart));

            svg += '        <g class="entry entry-' + entry.type + '">\n';

            if (entry.end) {
                x1 = Math.round((entry.endOffset) * pixelsPerSecond);
                if (x0 === x1) {
                    x0 -= 0.5;
                    x1 += 0.5;
                }
                svg += '            <rect class="' + entry.type + '" x="' + x0 + '" width="' + (x1 - x0) + '" y="' + y0 + '" height="' + (y1 - y0) + '" />\n';
            } else {
                svg += '            <circle class="' + entry.type + '" cx="' + x0 + '" cy="' + Math.round((y1 + y0) / 2) + '" r="4" />\n';
            }

            tooltip.push('');
            tooltip.push(entry.desc);
            if (entry.end) {
                tooltip.push('');
                tooltip.push('+' + addCommas(entry.end - entry.start));
            }

            ytext = y1 - (SVG_FONT_SIZE / 2);
            if (x0 > (SVG_WIDTH / 2)) {
                svg += '            <text class="right" x="' + (x0 - 4) + '" y="' + ytext + '">\n';
                svg += '                <tspan>' + xmlEncode(text) + '</tspan>\n';
                svg += '                <title>' + xmlEncode(tooltip.join(' ')) + '</title>\n';
                svg += '            </text>\n';
            } else {
                svg += '            <text class="left" x="' + (x0 + 4) + '" y="' + ytext + '">\n';
                svg += '                <tspan>' + xmlEncode(text) + '</tspan>\n';
                svg += '                <title>' + xmlEncode(tooltip.join(' ')) + '</title>\n';
                svg += '            </text>\n';
            }

            svg += '        </g>\n';

            laststart = entry.start;
        });

        svg += '    </g>\n';
    });

    svg += '</svg>\n';
    libfs.writeFileSync(file, svg, 'utf-8');
}


run = function(params, options) {
    var env,
        store,
        inFile,
        outFile,
        lines,
        log;

    options = options || {};

    // default input if --input filename.ext is not set
    inFile = options.input || 'perf.log';

    if (params.length) {
        libutils.error('Unknown extra parameters.');
        return;
    }

    // make results dir
    if (!existsSync(artifactsDir)) {
        libfs.mkdirSync(artifactsDir, MODE_ALL);
    }
    if (!existsSync(resultsDir)) {
        libfs.mkdirSync(resultsDir, MODE_ALL);
    }

    outFile = inFile.replace(/\.log$/, '.svg');
    outFile = libpath.join(resultsDir, outFile);

    lines = libfs.readFileSync(inFile, 'utf-8').split('\n');
    log = logProcess(lines);
    svgDraw(outFile, log);

    console.log('graph drawn in ' + outFile);
};


/**
 * Standard usage string export.
 */
exports.usage = 'mojito profiler   // generates an SVG image of the profiling log\n' +
    '\t--input     Path and filename of the input file (default value perf.log).\n';


/**
 * Standard options list export.
 */
exports.options = [
    {
        longName: 'input',
        shortName: null,
        hasValue: true
    }
];


/**
 * Standard run method hook export.
 */
exports.run = run;


