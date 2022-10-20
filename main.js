"use strict";
const url_params = new Proxy({}, {
    get: (_, key) => {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(window.location.search);
        if (key === "hash") {
            return url.hash ? url.hash.substring(1) : "";
        }
        return new URLSearchParams(url.search).get(key);
    },
    set: (_, key_in, value) => {
        const key = key_in;
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        var hash = url.hash ? url.hash.substring(1) : "";
        switch (key) {
            case "hash":
                hash = value;
                break;
            default:
                if (value === "") {
                    params.delete(key);
                }
                else {
                    params.set(key, value);
                }
                break;
        }
        var new_url = `${location.pathname}?${params}`;
        if (hash !== "") {
            new_url += `#${hash}`;
        }
        window.history.replaceState("", "", new_url);
        return true;
    },
});
const charts = new Map();
const search_params = new URLSearchParams(window.location.search);
const dataset_sel = document.querySelector("#dataset");
const search_sel = document.querySelector("#search");
const container = document.querySelector("#charts");
const search_for = (str) => {
    search_sel.value = str;
    search_string = str;
    url_params.search = str;
    charts.forEach((chart) => chart.update());
};
const get_or_create = (map, key, create) => {
    if (map.has(key)) {
        return map.get(key);
    }
    const val = create();
    map.set(key, val);
    return val;
};
const trim_quotes = (str) => {
    if (str.startsWith(`"`)) {
        str = str.substring(1);
    }
    if (str.endsWith(`"`)) {
        str = str.substring(0, str.length - 1);
    }
    return str;
};
const format_time = (seconds) => {
    const nanoseconds = seconds * 1e9;
    const digits = Math.log10(nanoseconds);
    if (digits >= 6) {
        return Math.round(nanoseconds / 10000) / 100 + "ms";
    }
    if (digits >= 3) {
        return Math.round(nanoseconds / 10) / 100 + "μs";
    }
    return Math.round(nanoseconds * 10) / 10 + "ns";
};
const colors = [
    { r: 151 / 255.0, g: 187 / 255.0, b: 205 / 255.0, a: 0.8, },
    { r: 247 / 255.0, g: 70 / 255.0, b: 74 / 255.0, a: 0.8, },
    { r: 70 / 255.0, g: 191 / 255.0, b: 189 / 255.0, a: 0.8, },
    { r: 253 / 255.0, g: 180 / 255.0, b: 92 / 255.0, a: 0.8, },
    { r: 220 / 255.0, g: 220 / 255.0, b: 220 / 255.0, a: 0.8, },
    { r: 148 / 255.0, g: 159 / 255.0, b: 177 / 255.0, a: 0.8, },
    { r: 77 / 255.0, g: 83 / 255.0, b: 96 / 255.0, a: 0.8, },
];
;
const config = {
    adapter: {
        x: (item) => item.date.getTime(),
        y: (item) => item.duration,
        x_axis_label: (x) => new Date(x).toDateString(),
        y_axis_label: (y) => format_time(y),
        tooltip: (item) => `
<span class="tooltip-title">${format_time(item.duration)} - ${item.date.toDateString()}</span><br>
<br>
${item.description}<br>
<br>
<span class="code">${item.commit}</span><br>
`
    }
};
const split_benchmark_name = (name) => {
    if (name.startsWith("Castable")) {
        return ["Castable", name.substring(8)];
    }
    if (name.includes("/")) {
        return name.split("/");
    }
    return [name, name];
};
var dataset = search_params.get("data") || dataset_sel.options[0].value;
var search_string = search_params.get("search") || "";
const refresh = () => {
    fetch(
    // `https://raw.githubusercontent.com/tint-perfmon-bot/tint-perf/main/results/${dataset}.json`
    `results/${dataset}.json`)
        .then((response) => response.json())
        .then((json) => {
        const systems = new Map();
        for (const commit of json.Commits) {
            for (const benchmark of commit.Benchmarks) {
                const names = split_benchmark_name(benchmark.Name);
                const system_name = names[0];
                const benchmark_name = names[1];
                const benchmarks = get_or_create(systems, system_name, () => new Map());
                const data_points = get_or_create(benchmarks, benchmark_name, () => []);
                if (benchmark.Time == 0) {
                    // benchmark likely failed.
                    benchmark.Time = undefined;
                }
                data_points.push({
                    short_hash: commit.Commit.substring(0, 7),
                    commit: commit.Commit,
                    description: commit.CommitDescription || "",
                    date: new Date(commit.CommitTime),
                    duration: benchmark.Time,
                    repeats: benchmark.Repeats,
                });
            }
        }
        const dataset_color_indices = new Map();
        const systems_sorted = new Map([...systems].sort((a, b) => String(a[0]).localeCompare(b[0])));
        systems_sorted.forEach((benchmarks, system_name) => {
            const chart = get_or_create(charts, system_name, () => {
                const title = document.createElement("p");
                title.id = system_name;
                title.textContent = system_name;
                title.classList.add("chart-title");
                container.append(title);
                const element = document.createElement("div");
                element.style.boxSizing = "border-box";
                element.style.width = "100%";
                element.style.height = "100%";
                container.append(element);
                if (url_params.hash === system_name) {
                    setTimeout(() => {
                        title.scrollIntoView(true);
                    }, 1);
                }
                return new WebGPUChart(element, config);
            });
            chart.data.datasets = [];
            benchmarks.forEach((data, benchmark_name) => {
                const col_idx = get_or_create(dataset_color_indices, benchmark_name, () => dataset_color_indices.size % colors.length);
                chart.data.datasets.push({
                    label: benchmark_name,
                    samples: data,
                    color: colors[col_idx],
                });
            });
            chart.update();
        });
        document.title = json.System[0].modelName;
    })
        .then(() => setTimeout(refresh, 5 * 60 * 1000)); // refresh every 5 minutes
};
dataset_sel.value = dataset;
dataset_sel.onchange = () => {
    dataset = dataset_sel.value;
    refresh();
};
search_for(search_string);
search_sel.oninput = () => {
    search_for(search_sel.value);
};
window.addEventListener("keydown", function (e) {
    // ctrl-f
    if (e.keyCode === 114 || (e.ctrlKey && e.keyCode === 70)) {
        e.preventDefault();
        search_sel.value = "";
        search_sel.focus();
    }
});
refresh();
//# sourceMappingURL=main.js.map