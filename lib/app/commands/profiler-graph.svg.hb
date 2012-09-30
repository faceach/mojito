<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="920px" height="670px" viewport-fill="#000000">

    <style><![CDATA[
        text , tspan { font-size: 8pt; font-family: sans-serif; }
        text.left { text-anchor: start; }
        text.middle { text-anchor: middle; }
        text.right { text-anchor: end; }
        .scrollbar { fill: #888888; stroke: none; }
        .scrollbar.inactive { fill: #EEEEEE; }

        #timeline line { stroke: #000000; stroke-width: 1px; }
        #timeline text {}

        #sections text { font-size: 12pt; font-weight: bold; }
        #section text.request { font-family: monospace; }

        #graph .MARK     { fill: #FF8888; stroke: none; }
        #graph .TIMELINE { fill: #8888FF; stroke: none; }
    ]]></style>


    <svg id="timeline" x="0" y="0" width="800" height="30" viewBox="0 0 800 30"/>

    <svg id="graph" x="0" y="30" width="800" height="600" viewBox="0 0 800 600">
        <text class="middle" x="400" y="300">This graph is interactive (like flash).</text>
        <text class="middle" x="400" y="314">In order to use it, you should view it in a browser (such as Chrome)</text>
        <text class="middle" x="400" y="328">that supports javascript in SVG.</text>
    </svg>
    <rect id="sb-graph" class="scrollbar inactive" x="801" y="30" width="8" height="600" rx="4" ry="4" />

    <svg id="details" x="0" y="630" width="800" height="40" viewBox="0 0 800 40"/>

    <g id="sections">
        <text id="sec-requests" class="tab left" x="814" y="28">REQUESTS</text>
    </g>

    <svg id="section" x="810" y="30" width="100" height="600" viewBox="0 0 100 600"/>
    <rect id="sb-section" class="scrollbar inactive" x="911" y="30" width="8" height="600" rx="4" ry="4"/>


    <script><![CDATA[
        function debug(obj, showAll) {
            var k, key, keys = [], val;
            for (var key in obj) {
                if (showAll || obj.hasOwnProperty(key)) {
                    keys.push(key);
                }
            }
            keys.sort();
            for (k = 0; k < keys.length; k++) {
                key = keys[k];
                val = obj[key];
                console.log('--------------------------------------------- ' + key + ' -- ' + typeof val);
                if ('function' !== typeof val) {
                    console.log(val);
                }
            }
        }


        var NS_SVG = 'http://www.w3.org/2000/svg',
            NS_XLINK = 'http://www.w3.org/1999/xlink',

            LOG = {{{logs}}},

            // Keep a list of dynamic event handlers, so that we can clean them
            // up when needed.  (Each item in a list is a quad: target, event
            // name, handler, capture.)
            HANDLERS = {},
            
            currentRequest;


        function jsForEach(obj, cb) {
            var i;
            for (i in obj) {
                if (obj.hasOwnProperty(i)) {
                    cb(obj[i], i);
                }
            }
        }


        function textAddCommas(str) {
            var rx = /(\d+)(\d{3})/;
            str += '';
            while (rx.test(str)) {
                str = str.replace(rx, '$1,$2');
            }
            return str;
        }


        function eventSubscribe(group, target, event, handler, capture) {
            if (!HANDLERS[group]) {
                HANDLERS[group] = [];
            }
            HANDLERS[group].push([target, event, handler, capture]);
            target.addEventListener(event, handler, capture);
        }


        function eventClearGroup(group) {
            var s,
                sub,
                subs = HANDLERS[group];

            if (!subs) {
                return;
            }
            for (s = 0; s < subs.length; s += 1) {
                sub = subs[s];
                sub[0].removeEventListener(sub[1], sub[2], sub[3]);
            }
        }


        function scrollbarInitHandlers() {
            // TODO
        }

        function scrollbarLink(scrollbarID, targetID) {
            // TODO
        }


        function detailsUpdate(line1, line2) {
            var detailsDOM = document.getElementById('details'),
                textDOM;
            while (detailsDOM.firstChild) {
                detailsDOM.removeChild(detailsDOM.firstChild);
            }
            if (line1) {
                textDOM = document.createElementNS(NS_SVG, 'text');
                textDOM.setAttribute('x', '4');
                textDOM.setAttribute('y', '16');
                textDOM.setAttributeNS(null, 'class', 'left');
                textDOM.appendChild(document.createTextNode(line1));
                detailsDOM.appendChild(textDOM);
            }
            if (line2) {
                textDOM = document.createElementNS(NS_SVG, 'text');
                textDOM.setAttribute('x', '4');
                textDOM.setAttribute('y', '36');
                textDOM.setAttributeNS(null, 'class', 'left');
                textDOM.appendChild(document.createTextNode(line2));
                detailsDOM.appendChild(textDOM);
            }
        }


        function graphClear() {
            var graphDOM = document.getElementById('graph');
            eventClearGroup('graph');
            while (graphDOM.firstChild) {
                graphDOM.removeChild(graphDOM.firstChild);
            }
        }


        // FUTURE -- draw ticks at even number intervals (100, 200, etc)
        function timelineDraw(minTime, maxTime) {
            var timelineDOM = document.getElementById('timeline'),
                lineDOM,
                textDOM,
                i,
                x,
                time,
                classes = { 0: 'left', 10: 'right' };

            while (timelineDOM.firstChild) {
                timelineDOM.removeChild(timelineDOM.firstChild);
            }

            lineDOM = document.createElementNS(NS_SVG, 'line');
            lineDOM.setAttributeNS(null, 'x1', '0');
            lineDOM.setAttributeNS(null, 'x2', '800');
            lineDOM.setAttributeNS(null, 'y1', '30');
            lineDOM.setAttributeNS(null, 'y2', '30');
            timelineDOM.appendChild(lineDOM);

            for (i = 0; i <= 10; i += 1) {
                x = i * 80;
                lineDOM = document.createElementNS(NS_SVG, 'line');
                lineDOM.setAttributeNS(null, 'x1', x);
                lineDOM.setAttributeNS(null, 'x2', x);
                lineDOM.setAttributeNS(null, 'y1', '20');
                lineDOM.setAttributeNS(null, 'y2', '30');
                timelineDOM.appendChild(lineDOM);
                time = minTime + ((maxTime - minTime) * (i / 10));

                textDOM = document.createElementNS(NS_SVG, 'text');
                textDOM.setAttribute('x', x);
                textDOM.setAttribute('y', '20');
                textDOM.setAttributeNS(null, 'class', classes[i] || 'middle');
                textDOM.appendChild(document.createTextNode(Math.round(time)));
                timelineDOM.appendChild(textDOM);
            }
        }


        function requestChoose(requestID) {
            var request,
                graphDOM,
                pixelsPerTime,
                laststart;

            if (requestID === currentRequest) {
                return;
            }

            detailsUpdate();
            graphClear();

            // draw waterfall
            request = LOG.requests[requestID];
            graphDOM = document.getElementById('graph');
            pixelsPerTime = 800 / LOG.maxOffset;
            laststart = request.min;
            request.entries.sort(function(a, b) {
                if (a.start === b.start) {
                    return a.logOrder - b.logOrder;
                }
                return a.start - b.start;
            });

            jsForEach(request.entries, function(entry, e) {
                var
                    x0,
                    x1,
                    y0,
                    y1,
                    text,
                    textClass,
                    tooltip = [],
                    gDOM,
                    entryDOM,
                    xOffset,
                    textDOM;

                y0 = 2 + (e * 20);
                y1 = y0 + 16;
                x0 = Math.round(entry.startOffset * pixelsPerTime);

                text = [entry.group, entry.label].join(':');
                if (entry.id) {
                    text += '[' + entry.id + ']';
                }

                tooltip.push(entry.startOffset);
                tooltip.push('+' + textAddCommas(entry.start - laststart));

                gDOM = document.createElementNS(NS_SVG, 'g');
                gDOM.setAttributeNS(null, 'class', 'entry entry-' + entry.type);

                if (entry.end) {
                    x1 = Math.round((entry.endOffset) * pixelsPerTime);
                    if (x0 === x1) {
                        x0 -= 0.5;
                        x1 += 0.5;
                    }
                    entryDOM = document.createElementNS(NS_SVG, 'rect');
                    entryDOM.setAttributeNS(null, 'class', entry.type);
                    entryDOM.setAttributeNS(null, 'x', x0);
                    entryDOM.setAttributeNS(null, 'y', y0);
                    entryDOM.setAttributeNS(null, 'width', (x1 - x0));
                    entryDOM.setAttributeNS(null, 'height', (y1 - y0));
                    gDOM.appendChild(entryDOM);
                } else {
                    entryDOM = document.createElementNS(NS_SVG, 'circle');
                    entryDOM.setAttributeNS(null, 'class', entry.type);
                    entryDOM.setAttributeNS(null, 'cx', x0);
                    entryDOM.setAttributeNS(null, 'cy', y0 + 8);
                    entryDOM.setAttributeNS(null, 'r', 4);
                    gDOM.appendChild(entryDOM);
                }

                tooltip.push('');
                tooltip.push(entry.desc);
                if (entry.end) {
                    tooltip.push('');
                    tooltip.push('+' + textAddCommas(entry.end - entry.start));
                }

                xOffset = 4;
                textClass = 'left';
                if (x0 > 400) {
                    xOffset = -4;
                    textClass = 'right';
                }

                textDOM = document.createElementNS(NS_SVG, 'text');
                textDOM.setAttributeNS(null, 'class', textClass);
                textDOM.setAttributeNS(null, 'x', (x0 + xOffset));
                textDOM.setAttributeNS(null, 'y', (y1 - 4));
                textDOM.appendChild(document.createTextNode(text));
                gDOM.appendChild(textDOM);

                graphDOM.appendChild(gDOM);

                eventSubscribe('graph', gDOM, 'mouseover', function(evt) {
                    detailsUpdate(text, tooltip.join(' '));
                });

                laststart = entry.start;
            });

            currentRequest = requestID;
        }


        function sectionRequests() {
            var sectionDOM = document.getElementById('section'),
                y = 20;

            // common to all requests
            timelineDraw(0, LOG.maxOffset);

            eventClearGroup('section');
            while (sectionDOM.firstChild) {
                sectionDOM.removeChild(sectionDOM.firstChild);
            }
            jsForEach(LOG.requests, function(req, id) {
                var textDOM;
                textDOM = document.createElementNS(NS_SVG, 'text');
                textDOM.setAttributeNS(null, 'class', 'request left');
                textDOM.setAttributeNS(null, 'x', '4');
                textDOM.setAttributeNS(null, 'y', y);
                textDOM.appendChild(document.createTextNode(req.label));
                eventSubscribe('section', textDOM, 'click', function(evt) {
                    requestChoose(id);
                });
                sectionDOM.appendChild(textDOM);
                y += 20;
            });
            scrollbarLink('sb-section', 'section');

            requestChoose(Object.keys(LOG.requests)[0]);
        }


        scrollbarInitHandlers();
        sectionRequests();
    ]]></script>

</svg>
