/// <reference types="@webgpu/types" />

const kFloatSize = 4;
const kLineSegments = 1024;
const kNoNumber = -1.7014118e+38;

interface WebGPUChartAdapter<DataItem> {
    x: (item: DataItem) => number
    y: (item: DataItem) => number
    x_axis_label: (value: number) => string
    y_axis_label: (value: number) => string
    tooltip: (item: DataItem) => string
}

class WebGPUChartRect {
    t: number;
    r: number;
    b: number;
    l: number;

    constructor(t: number, r: number, b: number, l: number) {
        this.t = t;
        this.r = r;
        this.b = b;
        this.l = l;
    }

    public get w(): number {
        return this.r - this.l;
    }

    public get h(): number {
        return this.t - this.b;
    }
};

class mat3x2 {
    m00: number; m01: number;
    m10: number; m11: number;
    m20: number; m21: number;

    constructor(
        m00: number, m01: number,
        m10: number, m11: number,
        m20: number, m21: number,
    ) {
        this.m00 = m00; this.m01 = m01;
        this.m10 = m10; this.m11 = m11;
        this.m20 = m20; this.m21 = m21;
    }

    static offset(x: number, y: number) {
        return new mat3x2(
            1, 0,
            0, 1,
            x, y);
    }

    static scale(x: number, y: number) {
        return new mat3x2(
            x, 0,
            0, y,
            0, 0);
    }

    offset(x: number, y: number) {
        return new mat3x2(
            this.m00, this.m01,
            this.m10, this.m11,
            this.m20 + x, this.m21 + y);
    }

    scale(x: number, y: number) {
        return new mat3x2(
            this.m00 * x, this.m01 * y,
            this.m10 * x, this.m11 * y,
            this.m20 * x, this.m21 * y);
    }

    mul_x(x: number) {
        return x * this.m00 + this.m20;
    }

    mul_y(y: number) {
        return y * this.m11 + this.m21;
    }

    write(arr: Float32Array, offset: number) {
        var i = offset;
        arr[i++] = this.m00;
        arr[i++] = this.m01;
        arr[i++] = this.m10;
        arr[i++] = this.m11;
        arr[i++] = this.m20;
        arr[i++] = this.m21;
    }
};

const kDefaultMargin: WebGPUChartRect = new WebGPUChartRect(20, 100, 300, 200);

interface WebGPUChartConfig<DataItem> {
    adapter: WebGPUChartAdapter<DataItem>
    margin?: WebGPUChartRect,
}

interface WebGPUChartColor {
    r: number,
    g: number,
    b: number,
    a: number,
}

interface WebGPUChartDataset<DataItem> {
    label: string,
    samples: DataItem[],
    color: WebGPUChartColor,
}

interface WebGPUChartData<DataItem> {
    datasets: WebGPUChartDataset<DataItem>[]
}

interface WebGPUChartInternalDataset<DataItem> {
    external: WebGPUChartDataset<DataItem>;
    sample_indices: number[]; // DataItem indices in WebGPUChart.data.datasets[i]
    y_values: number[];
    samples_to_chart_data_bind_group: GPUBindGroup;
    process_chart_data_bind_group: GPUBindGroup;
    draw_line_bind_group: GPUBindGroup;
}

interface WebGPUChartInternalData<DataItem> {
    datasets: WebGPUChartInternalDataset<DataItem>[];
    chart_bounds: WebGPUChartRect; // pixels, in canvas space
    data_to_chart: mat3x2;
    chart_to_data: mat3x2;
    chart_to_ndc: mat3x2;
    labels: HTMLElement[];
}

interface WebGPUChartInternalGPUState {
    device: GPUDevice;
    null_bindgroup_layout: GPUBindGroupLayout;
    null_bindgroup: GPUBindGroup;
    samples_to_chart_data_bind_group_layout: GPUBindGroupLayout;
    samples_to_chart_data_pipeline: GPUComputePipeline;
    process_chart_data_bind_group_layout: GPUBindGroupLayout;
    process_chart_data_pipeline: GPUComputePipeline;
    draw_line_bind_group_layout: GPUBindGroupLayout;
    draw_line_pipeline: GPURenderPipeline;
    draw_grid_pipeline: GPURenderPipeline;
    view_bind_group: GPUBindGroup;
    view_buffer: GPUBuffer;
    view_changed: boolean;
}

class WebGPUChart<DataItem>  {
    data: WebGPUChartData<DataItem> = {
        datasets: [],
    };

    static #adapter: GPUAdapter | null = null;

    #container: HTMLElement;
    #canvas: HTMLCanvasElement;
    #tooltip_box: HTMLElement;
    #tooltip_text: HTMLElement;
    #context: GPUCanvasContext;
    #config: WebGPUChartConfig<DataItem>;
    #data: WebGPUChartInternalData<DataItem> | null = null;
    #gpu: WebGPUChartInternalGPUState | null = null;

    constructor(container: HTMLElement, config: WebGPUChartConfig<DataItem>) {
        const inner_container = document.createElement("div");
        inner_container.style.position = "relative";
        inner_container.style.width = "100%";
        inner_container.style.height = "100%";
        container.appendChild(inner_container);

        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        inner_container.append(canvas);

        const tooltip_text = document.createElement("div");
        tooltip_text.className = "webgpu-chart-tooltip-text";
        tooltip_text.innerHTML = "I am <b>some text";

        const tooltip_box = document.createElement("div");
        tooltip_box.className = "webgpu-chart-tooltip-box";
        tooltip_box.style.visibility = "hidden";
        tooltip_box.appendChild(tooltip_text);
        inner_container.appendChild(tooltip_box);

        this.#container = inner_container;
        this.#canvas = canvas;
        this.#tooltip_text = tooltip_text;
        this.#tooltip_box = tooltip_box;
        this.#context = canvas.getContext('webgpu') as GPUCanvasContext;
        this.#config = config;
        this.#init();

        new ResizeObserver(this.#on_resize.bind(this)).observe(canvas);
        canvas.onmousemove = this.#on_mousemove.bind(this)
    }

    update() {
        if (this.#gpu == null) {
            return;
        }

        const gpu = this.#gpu as WebGPUChartInternalGPUState;
        const margin = this.#config.margin ? this.#config.margin : kDefaultMargin;
        const chart_w = Math.max(this.#canvas.width - margin.l - margin.r, 1)
        const num_datasets = this.data.datasets.length;

        const map_x_to_indices = new Map<number, Array<number>>();
        this.data.datasets.forEach((dataset, dataset_idx) => {
            dataset.samples.forEach((item, item_idx) => {
                const x = this.#config.adapter.x(item);
                const indices = this.#get_or_create(map_x_to_indices, x, () => new Array(num_datasets))
                indices[dataset_idx] = item_idx;
            });
        });

        const sorted_x = [...map_x_to_indices.keys()].sort((a, b) => a - b);
        const num_x = sorted_x.length;
        var min_y = 1e50;
        var max_y = -1e50;

        const datasets = this.data.datasets.map((dataset, dataset_idx) => {
            const indices = sorted_x.map(x => (map_x_to_indices.get(x) as number[])[dataset_idx]);
            const y_values = indices.map(i => {
                const item = dataset.samples[i];
                return (item !== undefined) ? this.#config.adapter.y(item) : NaN;
            });

            const sample_data = gpu.device.createBuffer({
                size: kFloatSize * num_x,
                usage: GPUBufferUsage.STORAGE,
                mappedAtCreation: true,
            });
            {// Populate sample_data
                const arr = new Float32Array(sample_data.getMappedRange());
                for (var i = 0; i < num_x; i++) {
                    const val = y_values[i];
                    if (isFinite(val)) {
                        min_y = Math.min(min_y, val);
                        max_y = Math.max(max_y, val);
                        arr[i] = val;
                    } else {
                        arr[i] = kNoNumber;
                    }
                }
                sample_data.unmap();
            }

            const chart_data = gpu.device.createBuffer({
                size: 4 * kFloatSize * chart_w,
                usage: GPUBufferUsage.STORAGE,
            });

            const samples_to_chart_data_bind_group = gpu.device.createBindGroup({
                layout: gpu.samples_to_chart_data_bind_group_layout,
                entries: [
                    { binding: 0, resource: { buffer: sample_data } },
                    { binding: 1, resource: { buffer: chart_data } },
                ],
            });

            const process_chart_data_bind_group = gpu.device.createBindGroup({
                layout: gpu.process_chart_data_bind_group_layout,
                entries: [
                    { binding: 0, resource: { buffer: chart_data } },
                ],
            });

            const draw_ubo_buffer = gpu.device.createBuffer({
                size: 4 * 4,
                usage: GPUBufferUsage.UNIFORM,
                mappedAtCreation: true,
            });
            {// Populate draw_ubo_buffer
                const arr = new Float32Array(draw_ubo_buffer.getMappedRange());
                arr[0] = dataset.color.r;
                arr[1] = dataset.color.g;
                arr[2] = dataset.color.b;
                arr[3] = dataset.color.a;
                draw_ubo_buffer.unmap();
            }

            const draw_line_bind_group = gpu.device.createBindGroup({
                layout: gpu.draw_line_bind_group_layout,
                entries: [
                    { binding: 0, resource: { buffer: chart_data } },
                    { binding: 1, resource: { buffer: draw_ubo_buffer } },
                ],
            });

            const internal: WebGPUChartInternalDataset<DataItem> = {
                external: dataset,
                sample_indices: indices,
                y_values,
                samples_to_chart_data_bind_group,
                process_chart_data_bind_group,
                draw_line_bind_group,
            };
            return internal;
        });

        //   ╔══════════════════════╗ ┬
        //   ║                      ║ │
        //   ║   ┃                  ║ │
        //   ║   ┃..         ..     ║ │
        //   ║   ┃  .  ... ..       ║ │
        //   ║   ┃   ..   .         ║ canvas_h
        //   ║   ┃                  ║ │
        //   ║   ┗━━━━━━━━━━━━━━━   ║ │
        //   ║  O                   ║ │
        //   ╚══════════════════════╝ ┴
        //   ├────── canvas_w ──────┤

        // Bounds of the canvas, in canvas pixel space.
        const canvas_bounds = new WebGPUChartRect(this.#canvas.height, this.#canvas.width, 0, 0);

        // Bounds of the underlying data, in data-space.
        const data_bounds = new WebGPUChartRect(max_y, num_x, min_y, 0);

        // Viewport of the underlying data, in data-space.
        const data_view = new WebGPUChartRect(this.#quantize(data_bounds.t), data_bounds.r, 0, data_bounds.l);

        // Chart bounds in canvas pixel space.
        const chart_bounds = new WebGPUChartRect(
            canvas_bounds.h - margin.t,
            canvas_bounds.w - margin.r,
            margin.b,
            margin.l,
        );

        const data_to_chart = mat3x2
            .offset(-data_view.l, -data_view.b)
            .scale(chart_bounds.w / data_view.w, chart_bounds.h / data_view.h);

        const chart_to_data = mat3x2
            .scale(data_view.w / chart_bounds.w, data_view.h / chart_bounds.h)
            .offset(data_view.l, data_view.b);

        const chart_to_ndc = mat3x2
            .offset(chart_bounds.l, chart_bounds.b)
            .scale(2.0 / canvas_bounds.w, 2.0 / canvas_bounds.h)
            .offset(-1, -1);

        const labels = this.#update_labels(this.#data?.labels, (acquire_label) => {
            for (var chart_x = 0; chart_x < chart_bounds.w; chart_x += 100) {
                const left = `${this.#canvas.offsetLeft + (chart_bounds.l + chart_x) / window.devicePixelRatio}px`;
                const top = `${this.#canvas.offsetTop + this.#canvas.offsetHeight - chart_bounds.b / window.devicePixelRatio}px`;

                const data_x = Math.floor(chart_to_data.mul_x(chart_x));
                const text = this.#config.adapter.x_axis_label(sorted_x[data_x]);

                const label = acquire_label();
                label.style.left = left;
                label.style.top = top;
                label.classList.add("webgpu-chart-label-axis-x");
                label.textContent = text;
            }
            for (var chart_y = 0; chart_y < chart_bounds.h; chart_y += chart_bounds.h / 20) {
                const right = `${this.#canvas.offsetWidth - chart_bounds.l / window.devicePixelRatio}px`;
                const bottom = `${(chart_bounds.b + chart_y) / window.devicePixelRatio}px`;

                const data_y = chart_to_data.mul_y(chart_y);
                const text = this.#config.adapter.y_axis_label(data_y);

                const label = acquire_label();
                label.style.right = right;
                label.style.bottom = bottom;
                label.classList.add("webgpu-chart-label-axis-y");
                label.textContent = text;
            }
        });

        this.#data = {
            datasets,
            chart_bounds,
            data_to_chart,
            chart_to_data,
            chart_to_ndc,
            labels,
        };

        gpu.view_changed = true;

        this.redraw();
    }

    redraw() {
        requestAnimationFrame(this.#render.bind(this));
    }

    async #init() {
        if (WebGPUChart.#adapter == null) {
            WebGPUChart.#adapter = await navigator.gpu.requestAdapter();
            if (WebGPUChart.#adapter == null) {
                console.error("WebGPU is not avaliable");
                return;
            }
        }
        const device = await WebGPUChart.#adapter.requestDevice();
        const presentation_format = navigator.gpu.getPreferredCanvasFormat();
        this.#context.configure({
            device: device,
            format: presentation_format,
            alphaMode: 'premultiplied',
        });


        const null_bindgroup_layout = device.createBindGroupLayout({
            label: "null_bindgroup_layout",
            entries: [],
        });

        const null_bindgroup = device.createBindGroup({
            label: "null_bindgroup",
            layout: null_bindgroup_layout,
            entries: [],
        });

        const samples_to_chart_data_bind_group_layout = device.createBindGroupLayout({
            label: "samples_to_chart_data_bind_group_layout",
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });


        const common_wgsl = `
struct ChartSample {
    fine_min : i32,
    fine_max : i32,
    course_min : i32,
    course_max : i32,
};
struct View {
    chart_bounds : vec4<f32>, // [x, y, w, h] pixels
    data_to_chart : mat3x2<f32>,
    chart_to_data : mat3x2<f32>,
    chart_to_ndc : mat3x2<f32>,
};
`;

        const view_buffer = device.createBuffer({
            label: "view_buffer",
            size: 0 +
                4 * 2 * kFloatSize + // chart_bounds : vec2<f32>
                3 * 2 * kFloatSize + // data_to_chart : mat2x3<f32>
                3 * 2 * kFloatSize + // chart_to_data : mat2x3<f32>
                3 * 2 * kFloatSize + // chart_to_ndc : mat2x3<f32>
                0,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const view_layout = device.createBindGroupLayout({
            label: "view_layout",
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        const view_bind_group = device.createBindGroup({
            label: "view_bind_group",
            layout: view_layout,
            entries: [
                { binding: 0, resource: { buffer: view_buffer } },
            ],
        });

        const samples_to_chart_data_pipeline = device.createComputePipeline({
            label: "samples_to_chart_data_pipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [samples_to_chart_data_bind_group_layout, view_layout],
            }),
            compute: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage> data : array<f32>;
@group(0) @binding(1) var<storage, read_write> chart_data : array<ChartSample>;
@group(1) @binding(0) var<uniform> view : View;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_invocation_id : vec3<u32>) {
    let chart_x0 = global_invocation_id.x;
    let chart_x1 = global_invocation_id.x + 1;

    let data_x0 = i32((view.chart_to_data * vec3(f32(chart_x0), 0, 1)).x);
    let data_x1 = i32((view.chart_to_data * vec3(f32(chart_x1), 0, 1)).x);

    var bounds = ChartSample(0x7fffffff, -0x7fffffff, 0x7fffffff, -0x7fffffff);
    for (var data_x = data_x0; data_x <= data_x1; data_x++) {
        let data_y = data[data_x];
        if (data_y > ${kNoNumber}) {
            let chart_y = i32((view.data_to_chart * vec3(0, data_y, 1)).y);
            bounds.fine_min = min(bounds.fine_min, chart_y);
            bounds.fine_max = max(bounds.fine_max, chart_y);
        }
    }
    chart_data[chart_x0] = bounds;
}`,
                }),
                entryPoint: 'main',
            },
        });

        const process_chart_data_bind_group_layout = device.createBindGroupLayout({
            label: "process_chart_data_bind_group_layout",
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });

        const process_chart_data_pipeline = device.createComputePipeline({
            label: "process_chart_data_pipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [process_chart_data_bind_group_layout],
            }),
            compute: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage, read_write> chart_data : array<ChartSample>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_invocation_id : vec3<u32>) {
    let x = i32(global_invocation_id.x);
    var val_min = chart_data[x].fine_min;
    var val_max = chart_data[x].fine_max;
    for (var i = 1; i < 8; i++) {
        {
            let x2 = x - i;
            let o_min = chart_data[x2].fine_min;
            let o_max = chart_data[x2].fine_max;
            if (x2 >= 0 && o_min <= o_max) {
                val_min = min(val_min, o_min);
                val_max = max(val_max, o_max);
            }
        }
        {
            let x2 = x + i;
            let o_min = chart_data[x2].fine_min;
            let o_max = chart_data[x2].fine_max;
            if (u32(x2) < arrayLength(&chart_data) && o_min <= o_max) {
                val_min = min(val_min, o_min);
                val_max = max(val_max, o_max);
            }
        }
    }
    chart_data[x].course_min = val_min;
    chart_data[x].course_max = val_max;
}`,
                }),
                entryPoint: 'main',
            },
        });


        // const draw_grid_bind_group_layout = device.createBindGroupLayout({
        //     label: "draw_grid_bind_group_layout",
        //     entries: [
        //         { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        //     ],
        // });

        const draw_grid_pipeline = device.createRenderPipeline({
            label: "draw_grid_pipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [null_bindgroup_layout, view_layout],
            }),
            vertex: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(1) @binding(0) var<uniform> view : View;

struct Out {
    @builtin(position) pos_ndc : vec4<f32>,
    @location(0) pos_chart : vec2<f32>,
};

@vertex
fn main(@builtin(vertex_index) vertex_index : u32) -> Out {
    let pos_frac = vec2(f32(vertex_index/2), f32(vertex_index&1));
    let pos_chart = pos_frac * view.chart_bounds.zw;
    let pos_ndc = view.chart_to_ndc * vec3(pos_chart, 1);
    return Out(vec4(pos_ndc, 0, 1), pos_chart);
}`,
                }),
                entryPoint: 'main',
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@fragment
fn main(@location(0) p : vec2<f32>) -> @location(0) vec4<f32> {
    const grid = 50;
    let p_x = p - abs(dpdx(p))*2;
    let p_y = p - abs(dpdy(p))*2;
    let cell = floor(p / grid);
    let cell_x = floor(p_x / grid);
    let cell_y = floor(p_y / grid);

    let is_grid_x = any(cell != cell_x);
    let is_grid_y = any(cell != cell_y);
    let minor = select(0.0, 0.3, is_grid_x || is_grid_y);
    let is_axis_x = any(sign(p) != sign(p_x));
    let is_axis_y = any(sign(p) != sign(p_y));
    let axis = select(0.0, 0.5, is_axis_x || is_axis_y);
    return vec4(0, 0, 0, minor + axis);
}
`,
                }),
                entryPoint: 'main',
                targets: [
                    {
                        format: presentation_format,
                        blend: {
                            color: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                            alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                        },
                    },
                ],
            },
            primitive: {
                topology: 'triangle-strip',
            },
        });

        const draw_line_bind_group_layout = device.createBindGroupLayout({
            label: "draw_line_bind_group_layout",
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            ],
        });

        const draw_line_pipeline = device.createRenderPipeline({
            label: "draw_line_pipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [draw_line_bind_group_layout, view_layout],
            }),
            vertex: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage> chart_data : array<ChartSample>;
@group(1) @binding(0) var<uniform> view : View;

struct Out {
    @builtin(position) pos_ndc : vec4<f32>,
    @location(0) pos_chart : vec2<f32>,
};

@vertex
fn main(@builtin(vertex_index) vertex_index : u32) -> Out {
    let frac_x = f32(vertex_index/2) / f32(${kLineSegments} - 1);
    let chart_x = i32(frac_x * f32(arrayLength(&chart_data) - 1));
    let r = chart_data[chart_x];
    let chart_y = select(r.course_min - 8, r.course_max + 8, (vertex_index&1) == 0);
    let pos_chart = vec2<f32>(vec2(chart_x, chart_y));
    let pos_ndc = view.chart_to_ndc * vec3(pos_chart, 1);
    return Out(vec4(pos_ndc, 0, 1), pos_chart);
}`,
                }),
                entryPoint: 'main',
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage> chart_data : array<ChartSample>;

struct UBO {
    color : vec4<f32>,
};

@group(0) @binding(1) var<uniform> ubo : UBO;

@fragment
fn main(@location(0) p : vec2<f32>) -> @location(0) vec4<f32> {
    var dist = 1000.0;
    for (var i = -4; i < 4; i++) {
        let x0 = floor(p.x) - f32(i);
        let x1 = x0 + 1;
        let r0 = chart_data[i32(x0)];
        let r1 = chart_data[i32(x1)];
        let y0 = f32(clamp(i32(p.y), r0.fine_min, r0.fine_max));
        let y1 = f32(clamp(i32(p.y), r1.fine_min, r1.fine_max));
        let d = line_point_dist(vec2(x0, y0), vec2(x1, y1), p);
        dist = min(dist, d);
    }
    let color = mix(ubo.color.rgb * 0.75, ubo.color.rgb, smoothstep(2.0, 1.0, dist));
    let alpha = smoothstep(4.0, 3.0, dist);
    return vec4(color, ubo.color.a) * alpha;
}

// returns minimum distance between line segment a<->b and point p
fn line_point_dist(a : vec2<f32>, b : vec2<f32>, p : vec2<f32>) -> f32 {
    let l2 = length_squared(a, b); // length(a, b) ^ 2
    let t = saturate(dot(p - a, b - a) / l2);
    let projection = mix(a, b, t);
    return distance(p, projection);
}

fn length_squared(a : vec2<f32>, b : vec2<f32>) -> f32 {
    let d = a - b;
    return dot(d, d);
}
`,
                }),
                entryPoint: 'main',
                targets: [
                    {
                        format: presentation_format,
                        blend: {
                            color: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                            alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                        },
                    },
                ],
            },
            primitive: {
                topology: 'triangle-strip',
            },
        });

        this.#gpu = {
            device,
            null_bindgroup_layout,
            null_bindgroup,
            samples_to_chart_data_bind_group_layout,
            samples_to_chart_data_pipeline,
            process_chart_data_bind_group_layout,
            process_chart_data_pipeline,
            draw_line_pipeline,
            draw_line_bind_group_layout,
            draw_grid_pipeline,
            view_bind_group,
            view_buffer,
            view_changed: true,
        };

        this.update();
    }

    #on_resize() {
        this.#canvas.width = Math.floor(this.#canvas.clientWidth * window.devicePixelRatio);
        this.#canvas.height = Math.floor(this.#canvas.clientHeight * window.devicePixelRatio);
        this.update();
    }

    #on_mousemove(ev: MouseEvent) {
        if (this.#data === null) {
            return;
        }
        const data = this.#data;
        const adapter = this.#config.adapter;
        const chart_x = (ev.offsetX * window.devicePixelRatio) - data.chart_bounds.l;
        const chart_y = (this.#canvas.clientHeight - ev.offsetY) * window.devicePixelRatio - data.chart_bounds.b;
        const data_x = Math.floor(data.chart_to_data.mul_x(chart_x));

        interface Closest {
            distance: number,
            sample: DataItem,
            dataset: WebGPUChartDataset<DataItem>
        };

        var closest: Closest | null = null;

        for (const dataset of data.datasets) {
            const sample_idx = dataset.sample_indices[data_x];
            const sample = dataset.external.samples[sample_idx];
            if (sample !== undefined) {
                const sample_data_y = adapter.y(sample);
                const sample_chart_y = data.data_to_chart.mul_y(sample_data_y);
                const distance = Math.abs(sample_chart_y - chart_y);
                if (distance < 50) {
                    if (closest == null || distance < closest.distance) {
                        closest = { distance, sample, dataset: dataset.external };
                    }
                }
            }
        }

        if (closest !== null) {
            const color = closest.dataset.color;
            this.#tooltip_box.style.left = `${ev.offsetX}px`;
            this.#tooltip_box.style.top = `${ev.offsetY}px`;
            this.#tooltip_text.innerHTML = adapter.tooltip(closest.sample);
            this.#tooltip_box.style.visibility = "visible";
            this.#tooltip_box.style.backgroundColor =
                `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, 0.75)`;
        } else {
            this.#tooltip_box.style.visibility = "hidden";
        }
    }

    #render() {
        if (this.#gpu === null || this.#data === null) {
            return;
        }
        const gpu = this.#gpu;
        const data = this.#data;

        const cmd_encoder = this.#gpu.device.createCommandEncoder();
        const texture_view = this.#context.getCurrentTexture().createView();

        if (gpu.view_changed) {
            const arr = new Float32Array(gpu.view_buffer.size / kFloatSize);
            arr[0] = data.chart_bounds.l;
            arr[1] = data.chart_bounds.b;
            arr[2] = data.chart_bounds.w;
            arr[3] = data.chart_bounds.h;
            data.data_to_chart.write(arr, 4);
            data.chart_to_data.write(arr, 10);
            data.chart_to_ndc.write(arr, 16);
            gpu.device.queue.writeBuffer(gpu.view_buffer, 0, arr);
        }

        { // chart_data
            const pass_encoder = cmd_encoder.beginComputePass();
            pass_encoder.setPipeline(gpu.samples_to_chart_data_pipeline);
            pass_encoder.setBindGroup(1, gpu.view_bind_group)
            this.#data.datasets.forEach(dataset => {
                pass_encoder.setBindGroup(0, dataset.samples_to_chart_data_bind_group);
                pass_encoder.dispatchWorkgroups(256, 1, 1);
            });
            pass_encoder.setPipeline(gpu.process_chart_data_pipeline);
            this.#data.datasets.forEach(dataset => {
                pass_encoder.setBindGroup(0, dataset.process_chart_data_bind_group);
                pass_encoder.dispatchWorkgroups(256, 1, 1);
            });
            pass_encoder.end();
        }

        { // Draw
            const render_pass_descriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        view: texture_view,
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            };
            const pass_encoder = cmd_encoder.beginRenderPass(render_pass_descriptor);
            { // Grid
                pass_encoder.setPipeline(gpu.draw_grid_pipeline);
                pass_encoder.setBindGroup(0, gpu.null_bindgroup)
                pass_encoder.setBindGroup(1, gpu.view_bind_group)
                pass_encoder.draw(4, 1, 0, 0);
            }
            { // Lines
                pass_encoder.setPipeline(gpu.draw_line_pipeline);
                pass_encoder.setBindGroup(1, gpu.view_bind_group)
                this.#data.datasets.forEach(dataset => {
                    pass_encoder.setBindGroup(0, dataset.draw_line_bind_group);
                    pass_encoder.draw(kLineSegments * 2, 1, 0, 0);
                });
            }
            pass_encoder.end();
        }

        gpu.device.queue.submit([cmd_encoder.finish()]);
    }

    #update_labels(old_labels: HTMLElement[] | undefined, cb: (acquire_label: () => HTMLElement) => void) {
        const new_labels: HTMLElement[] = [];
        const acquire_label = () => {
            var label = old_labels?.pop();
            if (label === undefined) {
                label = document.createElement("p");
                this.#container.insertBefore(label, this.#canvas);
            } else {
                label.removeAttribute('style');
                label.textContent = "";
            }
            label.className = "webgpu-chart-label";
            new_labels.push(label);
            return label;
        };

        cb(acquire_label);

        old_labels?.forEach(label => label.remove());
        return new_labels;
    }

    #quantize(value: number) {
        return Math.pow(10, Math.ceil(Math.log10(value)));
    }

    #get_or_create<K, V>(map: Map<K, V>, key: K, create: () => V): V {
        if (map.has(key)) {
            return map.get(key) as V;
        }
        const val = create();
        map.set(key, val);
        return val;
    }
}
