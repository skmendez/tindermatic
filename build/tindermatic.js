let dataTemp;

const margin = {top: 110, right: 120, bottom: 10, left: 10},
    width = 650 - margin.left - margin.right,
    height = 550 - margin.top - margin.bottom;

const format = d3.format(",.0f");


let svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

svg.append("g")
    .attr("class", "sankey")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

let x = 0;

let sankey = d3.sankey()
    .nodeId(d => d.name)
    .nodeAlign(d3.sankeyLeft)
    .nodeWidth(15)
    .nodePadding(10)
    .nodeSort(null)
    .size([width, height])
    .iterations(128);

function handleFileSelect(evt) {
    let f = Promise.resolve(evt.target.files[0]);
    f.then(getJsonPromise)
     .then(function (json) {
        let output = processData(json);
        dataTemp = processDataTemporal(json);
        let graph = createGraph(Array.from(dataTemp)[0][1]);
        createSankey(graph);
        createSlider(dataTemp);
    }).catch((e) => console.log(`Error in Promise ${e}`));
}

function createSlider(dataTemp) {
    var formatDateTick = d3.timeFormat("%b %Y");
    var formatDate = d3.timeFormat("%d %b %Y");

    var startDate = new Date(Array.from(dataTemp.keys())[0]),
        endDate = new Date(Array.from(dataTemp.keys())[dataTemp.size-1]);


    ////////// slider //////////

    var moving = false;
    var currentValue = 0;
    var targetValue = width - 30;

    var x = d3.scaleTime()
        .domain([startDate, endDate])
        .range([0, targetValue])
        .clamp(true);

    var slider = svg.append("g")
        .attr("class", "slider")
        .attr("transform", "translate(" + (margin.left+40) + "," + 50 + ")");

    slider.append("line")
        .attr("class", "track")
        .attr("x1", x.range()[0])
        .attr("x2", x.range()[1])
        .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "track-inset")
        .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "track-overlay")
        .call(d3.drag()
            .on("start.interrupt", function() { slider.interrupt(); })
            .on("start drag", function() {
                currentValue = d3.event.x;
                updateSlider(x.invert(currentValue));
            })
        );

    function updateSlider(h) {
        // update position and text of label according to slider scale
        handle.attr("cx", x(h));
        label
            .attr("x", x(h))
            .text(formatDate(h));

        // filter data set and redraw plot
        var newDate = d3.timeDay.floor(h);
        var data = dataTemp.get(newDate.toJSON());
        var graph = createGraph(data);

        createSankey(graph).catch(console.log);
    }

    slider.insert("g", ".track-overlay")
        .attr("class", "ticks")
        .attr("transform", "translate(0," + 18 + ")")
        .selectAll("text")
        .data(x.ticks(8))
        .enter()
        .append("text")
        .attr("x", x)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .text(d => formatDateTick(d));

    var handle = slider.insert("circle", ".track-overlay")
        .attr("class", "handle")
        .attr("r", 9);

    var playPause = slider.append("g").attr("transform", "translate(-27,0)");

    playPause.append("circle")
        .attr("class", "handle")
        .attr("r", 13);

    let states = {playing: "M11,10 L17,10 17,26 11,26 M20,10 L26,10 26,26 20,26",
        paused:  "M11,10 L18,13.74 18,22.28 11,26 M18,13.74 L26,18 26,18 18,22.28"};

    playPause.append("path")
        .attr("class", "icon")
        .attr("d", states.paused)
        .attr("transform", "translate(-18.5,-18)");

    playPause.on("click", flipState);

    let currentState = "paused";

    function flipState() {
        console.log(currentState);
        currentState = (currentState === "paused") ? "playing" : "paused";
        playPause.select("path.icon").transition().duration(300).attr("d", states[currentState]);

        if (currentState === "paused") {
            moving = false;
            clearInterval(timer);
            // timer = 0;
        } else {
            moving = true;
            if (currentValue >= targetValue) currentValue = 0;
            timer = setInterval(step, 100);
        }
        console.log("Slider moving: " + moving);
    }

    var label = slider.append("text")
        .attr("class", "label")
        .attr("text-anchor", "middle")
        .text(formatDate(startDate))
        .attr("transform", "translate(0," + (-25) + ")")

    // Play Button time
    let timer;


    function step() {
        if (currentValue >= targetValue) {
            moving = false;
            currentValue = 0;
            clearInterval(timer);
            // timer = 0;
            currentState = "paused";
            playPause.select("path.icon").transition().duration(300).attr("d", states[currentState]);
            console.log("Slider moving: " + moving);
        } else {
            let curDate = x.invert(currentValue);
            let nextDate = d3.timeDay.offset(d3.timeDay.floor(curDate));
            currentValue = x(nextDate);
            updateSlider(curDate);
        }
    }

}

function createGraph(data) {
    let n = new Map([
        ["s", "Swipe"],
        ["ls", "Left Swipe"],
        ["rs", "Right Swipe"],
        ["nm", "No Match"],
        ["m", "Match"],
        ["nmsg", "No Message"],
        ["msg", "Messaged"],
        ["smsg", "Single Message"],
        ["mmsg", "Multiple Messages"],
    ]);

    let green = "#63DE9C";
    let red = "#FC8371";

    let nodes = [...n.values()].map(function(name) {return {name: name}});
    let links = [
        {source: n.get("s"), target: n.get("ls"), value:data.left, color:red},
        {source: n.get("s"), target: n.get("rs"), value:data.right, color:green},
        {source: n.get("rs"), target: n.get("nm"), value: data.right - data.matches, color:red},
        {source: n.get("rs"), target: n.get("m"), value: data.matches, color:green},
        {source: n.get("m"), target: n.get("nmsg"), value: data.matches - data.messaged, color:red},
        {source: n.get("m"), target: n.get("msg"), value: data.messaged, color:green},
        {source: n.get("msg"), target: n.get("smsg"), value: data.messaged - data.multiple, color:red},
        {source: n.get("msg"), target: n.get("mmsg"), value:data.multiple, color:green}
        ];

    return ({
        nodes: nodes,
        links: links
    })
}

function createSankey(graph, time) {
    sankey(graph);

    let t = svg.transition()
        .duration(time || 500).ease(d3.easeLinear);

    svg.select("g.sankey").selectAll("g.sankey > g").data(["rect", "link", "text"]).join("g").attr("id", d => d);
    svg.select("g#rect")
        .selectAll("rect")
        .data(graph.nodes, d => d.name)
        .join(rectEnter, rectUpdate);


    function rectEnter(rect) {
        rect.append("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .attr("fill", d => {
                let c;
                for (const link of d.sourceLinks) {
                    if (c === undefined) c = link.color;
                    else if (c !== link.color) c = null;
                }
                if (c === undefined) for (const link of d.targetLinks) {
                    if (c === undefined) c = link.color;
                    else if (c !== link.color) c = null;
                }
                return (d3.color(c) || d3.color("grey")).darker(0.5);
            })
            .append("title")
            .text(d => `${d.name}\n${d.value.toLocaleString()}`);
    }

    function rectUpdate(rect) {
        rect.transition(t)
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0);
    }

    const link = svg.select("g#link")
        .attr("fill", "none")
        .selectAll("g")
        .data(graph.links, linkKey)
        .join(linkEnter, linkUpdate);

    function linkKey(d) {
        return d.source.name + '-' + d.target.name
    }

    function linkEnter(link) {
        link = link.append("g");

        link.attr("stroke", d => d3.color(d.color).brighter(1))
            .style("mix-blend-mode", "multiply");

        link.append("path")
            .attr("class", "link")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke-width", d => Math.max(1, d.width));

        link.append("title")
            .text(d => `${d.source.name} → ${d.target.name}\n ${format(d.value)}`);
    }

    function linkUpdate(link) {
        link.transition(t).call(function(update) {
                update.select("path")
                  .attr("d", d3.sankeyLinkHorizontal())
                  .attr("stroke-width", d => Math.max(1, d.width));

                update.select("title")
                    .text(d => `${d.source.name} → ${d.target.name}\n ${format(d.value)}`);
              }
              );
    }

    svg.select("g#text")
        .style("font", "10px sans-serif")
        .selectAll("text")
        .data(graph.nodes, d => d.name)
        .join(textEnter, textUpdate);

    function textEnter(text) {
        text.append("text")
            .attr("x", d => d.x1 + 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .text(d => d.name)
          .append("tspan")
            .attr("fill-opacity", 0.7)
            .text(d => ` ${format(d.value)}`);
    }

    function textUpdate(text) {
        text.transition(t)
            .attr("x", d => d.x1 + 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
          .select("tspan")
            .attrTween("text", function(d) {
                const that = d3.select(this),
                    i = d3.interpolateNumber(that.text().replace(/,/g, ""), d.value);
                return function(t) { that.text(` ${format(i(t))}`); };
            });
    }

    return t.end().catch(Function.prototype);

}

function getJsonPromise(file) {
    let promise;
    if (file.name.endsWith("zip")) {
        let zip = new JSZip();
        promise = zip.loadAsync(file)
            .then(function (zip) {
                // process ZIP file content here
                return zip.files["data.json"].async("string")
            }, function () {
                alert("Not a valid zip file")
            });
    } else {

        let temporaryFileReader = new FileReader();

        promise = new Promise((resolve, reject) => {
            temporaryFileReader.onerror = () => {
                temporaryFileReader.abort();
                reject(new DOMException("Problem parsing input file."));
            };

            temporaryFileReader.onload = () => {
                resolve(temporaryFileReader.result);
            };
            temporaryFileReader.readAsText(file);
        });
    }
    return promise.then(JSON.parse)
}


function processDataTemporal(data) {
    const left = data.Usage.swipes_passes;
    const right = data.Usage.swipes_likes;
    const matches = data.Usage.matches;
    const messages = data.Messages;
    function cumsum(obj) {
        return Object.entries(obj).sort(([key, value]) => Date.parse(key)).reduce((a, [key, value], i) => [...a, [d3.timeDay.floor(Date.parse(key)), a.length > 0 ? value + a[i-1][1] : value]], []).reverse()

    }

    const left_cumsum = cumsum(left);
    const right_cumsum = cumsum(right);
    const matches_cumsum = cumsum(matches);
    function gen_messages(filter_num) {
        return messages.filter((msg) => msg.messages.length > filter_num).map((msg) => d3.timeDay.floor(Date.parse(msg.messages[0].sent_date)));
    }
    const messages_date = gen_messages(0);
    const multiple_messages = gen_messages(1);
    const firstDay = d3.timeDay.floor(Date.parse(Object.keys(right).concat(Object.keys(left)).reduce((min, v) => v < min ? v : min)));
    const lastDay = d3.timeDay.offset(messages_date.reduce((max, v) => v > max ? v : max), 1);
    const dayRange = d3.timeDay.range(firstDay, lastDay);
    function cumsum_finder(cum_arr, date) {
        return cum_arr.find(([in_date]) => in_date <= date)[1]
    }
    function message_finder(msg_arr, date) {
        return msg_arr.filter(v => v <= date).length
    }

    let out = [];
    dayRange.forEach(function (day) {
        vals = {
            left: cumsum_finder(left_cumsum, day),
            right: cumsum_finder(right_cumsum, day),
            matches: cumsum_finder(matches_cumsum, day),
            messaged: message_finder(messages_date, day),
            multiple: message_finder(multiple_messages, day)
        };
        out.push([day.toJSON(), vals]);
        }
    );
    return new Map(out);
}

function processData(data) {
    function sum(array) {
        return array.reduce((total, curr) => total + curr, 0)
    }

    const leftSwipes = sum(Object.values(data.Usage.swipes_passes));
    const rightSwipes = sum(Object.values(data.Usage.swipes_likes));
    const matches = sum(Object.values(data.Usage.matches));
    const messaged = data.Messages.length;
    const multipleMessages = function (array) {
        let sum = 0;
        array.forEach(function (value) {
            if (value.messages.length > 1) {
                sum += 1;
            }
        });
        return sum;

    }(data.Messages);

    return `Swipe [${leftSwipes}] Left swipe
Swipe [${rightSwipes}] Right swipe #00CC00
Right swipe [${rightSwipes - matches}] No match
Right swipe [${matches}] Match #00CC00
Match [${matches - messaged}] No message
Match [${messaged}] Messaged #00CC00
Messaged [${messaged - multipleMessages}] Single Message
Messaged [${multipleMessages}] Multiple Messages #00CC00`
}

window.onload = () => document.getElementById('files').addEventListener('change', handleFileSelect, false);
