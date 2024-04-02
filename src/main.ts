import Color from './color.js';
import Config from './config.js';
import Dataset from './dataset.js';
import Chart from './chart.js';

interface URLParams {
  dataset: string;
  system: string;
}

const url_params = new Proxy(
  {},
  {
    get: (_, key: string) => {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(window.location.search);
      if (key === 'system') {
        return url.hash ? url.hash.substring(1) : '';
      }
      return new URLSearchParams(url.search).get(key);
    },
    set: (_, key_in, value): boolean => {
      const key = key_in as string;
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      var system = url.hash ? url.hash.substring(1) : '';
      switch (key) {
        case 'system':
          system = value;
          break;
        default:
          if (value === '') {
            params.delete(key);
          } else {
            params.set(key, value);
          }
          break;
      }
      var new_url = `${location.pathname}?${params}`;
      if (system !== '') {
        new_url += `#${system}`;
      }
      window.history.replaceState('', '', new_url);
      return true;
    },
  }
) as URLParams;

const charts = new Map<string, Chart<DataPoint>>();

const dataset_sel = document.querySelector('#dataset') as HTMLSelectElement;
const container = document.querySelector('#charts') as HTMLDivElement;

const get_or_create = <K, V>(map: Map<K, V>, key: K, create: () => V) => {
  if (map.has(key)) {
    return map.get(key) as V;
  }
  const val = create();
  map.set(key, val);
  return val;
};

const trim_quotes = (str: string) => {
  if (str.startsWith(`"`)) {
    str = str.substring(1);
  }
  if (str.endsWith(`"`)) {
    str = str.substring(0, str.length - 1);
  }
  return str;
};

const format_time = (seconds: number) => {
  const nanoseconds = seconds * 1e9;
  const digits = Math.log10(nanoseconds);
  if (digits >= 6) {
    return Math.round(nanoseconds / 10000) / 100 + 'ms';
  }
  if (digits >= 3) {
    return Math.round(nanoseconds / 10) / 100 + 'μs';
  }
  return Math.round(nanoseconds * 10) / 10 + 'ns';
};

const colors = [
  { r: 151 / 255.0, g: 187 / 255.0, b: 205 / 255.0, a: 0.8 },
  { r: 240 / 255.0, g: 170 / 255.0, b: 160 / 255.0, a: 0.8 },
  { r: 70 / 255.0, g: 191 / 255.0, b: 189 / 255.0, a: 0.8 },
  { r: 253 / 255.0, g: 180 / 255.0, b: 92 / 255.0, a: 0.8 },
  { r: 220 / 255.0, g: 190 / 255.0, b: 120 / 255.0, a: 0.8 },
  { r: 180 / 255.0, g: 180 / 255.0, b: 210 / 255.0, a: 0.8 },
  { r: 150 / 255.0, g: 200 / 255.0, b: 150 / 255.0, a: 0.8 },
  { r: 210 / 255.0, g: 160 / 255.0, b: 180 / 255.0, a: 0.8 },
  { r: 200 / 255.0, g: 160 / 255.0, b: 240 / 255.0, a: 0.8 },
];

interface DataPoint {
  short_hash: string;
  commit: string;
  description: string;
  date: Date;
  duration: number;
  repeats: number;
}

const config: Config<DataPoint> = {
  adapter: {
    x: (item: DataPoint) => item.date.getTime(),
    y: (item: DataPoint) => item.duration,
    x_axis_label: (x: number) => new Date(x).toDateString(),
    y_axis_label: (y: number) => format_time(y),
    tooltip: (item: DataPoint, dataset: Dataset<DataPoint>) => `
<p class="tooltip-title">${dataset.label}</p>
<p>${format_time(item.duration)} - ${item.date.toDateString()}</p>
<p class="code">
    ${item.description}<br>
    <br>
    ${item.commit}
</p>
`,
  },
  on_click: (item: DataPoint) => {
    const url = `https://dawn.googlesource.com/dawn/+/${item.commit}`;
    window.open(url, '_blank');
  },
};

const split_benchmark_name = (name: string) => {
  if (name.startsWith('Castable')) {
    return ['Castable', name.substring(8)];
  }
  if (name.endsWith('Parser')) {
    return ['Parser', name.substring(0, name.length - 6)];
  }
  const slash = name.indexOf('/');
  if (slash >= 0) {
    return [name.slice(0, slash), name.slice(slash + 1)];
  }
  return [name, name];
};

var dataset = url_params.dataset || dataset_sel.options[0].value;

const refresh = () => {
  const months_to_view = 12;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  type SystemName = string;
  type BenchmarkName = string;
  type Datasets = Map<BenchmarkName, Dataset<DataPoint>>;
  const systems = new Map<SystemName, Datasets>();
  const benchmark_colors = new Map<BenchmarkName, Color>();

  const data_loaded = () => {
    if (--requests_remaining > 0) {
      return;
    }

    const systems_sorted = [...systems.keys()].sort((a, b) => String(a[0]).localeCompare(b[0]));

    for (const system_name of systems_sorted) {
      const chart = get_or_create(charts, system_name, () => {
        const title = document.createElement('p');
        title.id = system_name;
        title.textContent = system_name;
        title.classList.add('chart-title');
        title.onclick = () => {
          url_params.system = system_name;
        };
        container.append(title);

        const element = document.createElement('div');
        element.style.boxSizing = 'border-box';
        element.style.width = '100%';
        element.style.height = '100%';
        container.append(element);

        if (url_params.system === system_name) {
          setTimeout(() => title.scrollIntoView(true), 1);
        }
        return new Chart<DataPoint>(element, config);
      });

      const datasets = systems.get(system_name) as Datasets;
      for (const benchmark of datasets.values()) {
        benchmark.samples.sort((a, b) => a.date.getTime() - b.date.getTime());
      }

      chart.datasets = [...datasets.values()];
      chart.update();
    }

    setTimeout(refresh, 5 * 60 * 1000); // refresh every 5 minutes
  };

  let requests_remaining = months_to_view;

  for (let i = 0; i < months_to_view; i++) {
    fetch(`results/${dataset}-${year}-${month.toString().padStart(2, '0')}.json`)
      .then(response => response.json())
      .then(json => {
        for (const commit of json.Commits) {
          for (const benchmark of commit.Benchmarks) {
            const names = split_benchmark_name(benchmark.Name);
            const system_name = names[0];
            const benchmark_name = trim_quotes(names[1]);
            const datasets = get_or_create(
              systems,
              system_name,
              () => new Map<string, Dataset<DataPoint>>()
            );
            const color = get_or_create(
              benchmark_colors,
              benchmark_name,
              () => colors[benchmark_colors.size % colors.length]
            );
            const dataset = get_or_create(datasets, benchmark_name, () => {
              return { label: benchmark_name, color, samples: [] };
            });

            if (benchmark.Time == 0) {
              benchmark.Time = undefined;
            }

            dataset.samples.push({
              short_hash: commit.Commit.substring(0, 7),
              commit: commit.Commit,
              description: commit.CommitDescription || '',
              date: new Date(commit.CommitTime),
              duration: benchmark.Time,
              repeats: benchmark.Repeats,
            });
          }
        }
        data_loaded();
      })
      .catch(error => {
        data_loaded();
      });

    month--;
    if (month == 0) {
      year--;
      month = 12;
    }
  }
};

dataset_sel.value = dataset;
dataset_sel.onchange = () => {
  dataset = dataset_sel.value;
  url_params.dataset = dataset;
  refresh();
};
refresh();
