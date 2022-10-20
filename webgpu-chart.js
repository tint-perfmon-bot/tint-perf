"use strict";
/// <reference types="@webgpu/types" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _WebGPUChart_instances, _a, _WebGPUChart_adapter, _WebGPUChart_container, _WebGPUChart_canvas, _WebGPUChart_tooltip_box, _WebGPUChart_tooltip_text, _WebGPUChart_context, _WebGPUChart_config, _WebGPUChart_data, _WebGPUChart_gpu, _WebGPUChart_init, _WebGPUChart_on_resize, _WebGPUChart_on_mousemove, _WebGPUChart_render, _WebGPUChart_update_labels, _WebGPUChart_quantize, _WebGPUChart_get_or_create;
const kFloatSize = 4;
const kLineSegments = 1024;
const kNoNumber = -1.7014118e+38;
class WebGPUChartRect {
    constructor(t, r, b, l) {
        this.t = t;
        this.r = r;
        this.b = b;
        this.l = l;
    }
    get w() {
        return this.r - this.l;
    }
    get h() {
        return this.t - this.b;
    }
}
;
class mat3x2 {
    constructor(m00, m01, m10, m11, m20, m21) {
        this.m00 = m00;
        this.m01 = m01;
        this.m10 = m10;
        this.m11 = m11;
        this.m20 = m20;
        this.m21 = m21;
    }
    static offset(x, y) {
        return new mat3x2(1, 0, 0, 1, x, y);
    }
    static scale(x, y) {
        return new mat3x2(x, 0, 0, y, 0, 0);
    }
    offset(x, y) {
        return new mat3x2(this.m00, this.m01, this.m10, this.m11, this.m20 + x, this.m21 + y);
    }
    scale(x, y) {
        return new mat3x2(this.m00 * x, this.m01 * y, this.m10 * x, this.m11 * y, this.m20 * x, this.m21 * y);
    }
    mul_x(x) {
        return x * this.m00 + this.m20;
    }
    mul_y(y) {
        return y * this.m11 + this.m21;
    }
    write(arr, offset) {
        var i = offset;
        arr[i++] = this.m00;
        arr[i++] = this.m01;
        arr[i++] = this.m10;
        arr[i++] = this.m11;
        arr[i++] = this.m20;
        arr[i++] = this.m21;
    }
}
;
const kDefaultMargin = new WebGPUChartRect(20, 100, 300, 200);
class WebGPUChart {
    constructor(container, config) {
        _WebGPUChart_instances.add(this);
        this.data = {
            datasets: [],
        };
        _WebGPUChart_container.set(this, void 0);
        _WebGPUChart_canvas.set(this, void 0);
        _WebGPUChart_tooltip_box.set(this, void 0);
        _WebGPUChart_tooltip_text.set(this, void 0);
        _WebGPUChart_context.set(this, void 0);
        _WebGPUChart_config.set(this, void 0);
        _WebGPUChart_data.set(this, null);
        _WebGPUChart_gpu.set(this, null);
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
        __classPrivateFieldSet(this, _WebGPUChart_container, inner_container, "f");
        __classPrivateFieldSet(this, _WebGPUChart_canvas, canvas, "f");
        __classPrivateFieldSet(this, _WebGPUChart_tooltip_text, tooltip_text, "f");
        __classPrivateFieldSet(this, _WebGPUChart_tooltip_box, tooltip_box, "f");
        __classPrivateFieldSet(this, _WebGPUChart_context, canvas.getContext('webgpu'), "f");
        __classPrivateFieldSet(this, _WebGPUChart_config, config, "f");
        __classPrivateFieldGet(this, _WebGPUChart_instances, "m", _WebGPUChart_init).call(this);
        new ResizeObserver(__classPrivateFieldGet(this, _WebGPUChart_instances, "m", _WebGPUChart_on_resize).bind(this)).observe(canvas);
        canvas.onmousemove = __classPrivateFieldGet(this, _WebGPUChart_instances, "m", _WebGPUChart_on_mousemove).bind(this);
    }
    update() {
        var _b;
        if (__classPrivateFieldGet(this, _WebGPUChart_gpu, "f") == null) {
            return;
        }
        const gpu = __classPrivateFieldGet(this, _WebGPUChart_gpu, "f");
        const margin = __classPrivateFieldGet(this, _WebGPUChart_config, "f").margin ? __classPrivateFieldGet(this, _WebGPUChart_config, "f").margin : kDefaultMargin;
        const chart_w = Math.max(__classPrivateFieldGet(this, _WebGPUChart_canvas, "f").width - margin.l - margin.r, 1);
        const num_datasets = this.data.datasets.length;
        const map_x_to_indices = new Map();
        this.data.datasets.forEach((dataset, dataset_idx) => {
            dataset.samples.forEach((item, item_idx) => {
                const x = __classPrivateFieldGet(this, _WebGPUChart_config, "f").adapter.x(item);
                const indices = __classPrivateFieldGet(this, _WebGPUChart_instances, "m", _WebGPUChart_get_or_create).call(this, map_x_to_indices, x, () => new Array(num_datasets));
                indices[dataset_idx] = item_idx;
            });
        });
        const sorted_x = [...map_x_to_indices.keys()].sort((a, b) => a - b);
        const num_x = sorted_x.length;
        var min_y = 1e50;
        var max_y = -1e50;
        const datasets = this.data.datasets.map((dataset, dataset_idx) => {
            const indices = sorted_x.map(x => map_x_to_indices.get(x)[dataset_idx]);
            const y_values = indices.map(i => {
                const item = dataset.samples[i];
                return (item !== undefined) ? __classPrivateFieldGet(this, _WebGPUChart_config, "f").adapter.y(item) : NaN;
            });
            const sample_data = gpu.device.createBuffer({
                size: kFloatSize * num_x,
                usage: GPUBufferUsage.STORAGE,
                mappedAtCreation: true,
            });
            { // Populate sample_data
                const arr = new Float32Array(sample_data.getMappedRange());
                for (var i = 0; i < num_x; i++) {
                    const val = y_values[i];
                    if (isFinite(val)) {
                        min_y = Math.min(min_y, val);
                        max_y = Math.max(max_y, val);
                        arr[i] = val;
                    }
                    else {
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
            { // Populate draw_ubo_buffer
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
            const internal = {
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
        const canvas_bounds = new WebGPUChartRect(__classPrivateFieldGet(this, _WebGPUChart_canvas, "f").height, __classPrivateFieldGet(this, _WebGPUChart_canvas, "f").width, 0, 0);
        // Bounds of the underlying data, in data-space.
        const data_bounds = new WebGPUChartRect(max_y, num_x, min_y, 0);
        // Viewport of the underlying data, in data-space.
        const data_view = new WebGPUChartRect(__classPrivateFieldGet(this, _WebGPUChart_instances, "m", _WebGPUChart_quantize).call(this, data_bounds.t), data_bounds.r, 0, data_bounds.l);
        // Chart bounds in canvas pixel space.
        const chart_bounds = new WebGPUChartRect(canvas_bounds.h - margin.t, canvas_bounds.w - margin.r, margin.b, margin.l);
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
        const labels = __classPrivateFieldGet(this, _WebGPUChart_instances, "m", _WebGPUChart_update_labels).call(this, (_b = __classPrivateFieldGet(this, _WebGPUChart_data, "f")) === null || _b === void 0 ? void 0 : _b.labels, (acquire_label) => {
            for (var chart_x = 0; chart_x < chart_bounds.w; chart_x += 100) {
                const left = `${__classPrivateFieldGet(this, _WebGPUChart_canvas, "f").offsetLeft + (chart_bounds.l + chart_x) / window.devicePixelRatio}px`;
                const top = `${__classPrivateFieldGet(this, _WebGPUChart_canvas, "f").offsetTop + __classPrivateFieldGet(this, _WebGPUChart_canvas, "f").offsetHeight - chart_bounds.b / window.devicePixelRatio}px`;
                const data_x = Math.floor(chart_to_data.mul_x(chart_x));
                const text = __classPrivateFieldGet(this, _WebGPUChart_config, "f").adapter.x_axis_label(sorted_x[data_x]);
                const label = acquire_label();
                label.style.left = left;
                label.style.top = top;
                label.classList.add("webgpu-chart-label-axis-x");
                label.textContent = text;
            }
            for (var chart_y = 0; chart_y < chart_bounds.h; chart_y += chart_bounds.h / 20) {
                const right = `${__classPrivateFieldGet(this, _WebGPUChart_canvas, "f").offsetWidth - chart_bounds.l / window.devicePixelRatio}px`;
                const bottom = `${(chart_bounds.b + chart_y) / window.devicePixelRatio}px`;
                const data_y = chart_to_data.mul_y(chart_y);
                const text = __classPrivateFieldGet(this, _WebGPUChart_config, "f").adapter.y_axis_label(data_y);
                const label = acquire_label();
                label.style.right = right;
                label.style.bottom = bottom;
                label.classList.add("webgpu-chart-label-axis-y");
                label.textContent = text;
            }
        });
        __classPrivateFieldSet(this, _WebGPUChart_data, {
            datasets,
            chart_bounds,
            data_to_chart,
            chart_to_data,
            chart_to_ndc,
            labels,
        }, "f");
        gpu.view_changed = true;
        this.redraw();
    }
    redraw() {
        requestAnimationFrame(__classPrivateFieldGet(this, _WebGPUChart_instances, "m", _WebGPUChart_render).bind(this));
    }
}
_a = WebGPUChart, _WebGPUChart_container = new WeakMap(), _WebGPUChart_canvas = new WeakMap(), _WebGPUChart_tooltip_box = new WeakMap(), _WebGPUChart_tooltip_text = new WeakMap(), _WebGPUChart_context = new WeakMap(), _WebGPUChart_config = new WeakMap(), _WebGPUChart_data = new WeakMap(), _WebGPUChart_gpu = new WeakMap(), _WebGPUChart_instances = new WeakSet(), _WebGPUChart_init = function _WebGPUChart_init() {
    return __awaiter(this, void 0, void 0, function* () {
        if (__classPrivateFieldGet(WebGPUChart, _a, "f", _WebGPUChart_adapter) == null) {
            __classPrivateFieldSet(WebGPUChart, _a, yield navigator.gpu.requestAdapter(), "f", _WebGPUChart_adapter);
            if (__classPrivateFieldGet(WebGPUChart, _a, "f", _WebGPUChart_adapter) == null) {
                console.error("WebGPU is not avaliable");
                return;
            }
        }
        const device = yield __classPrivateFieldGet(WebGPUChart, _a, "f", _WebGPUChart_adapter).requestDevice();
        const presentation_format = navigator.gpu.getPreferredCanvasFormat();
        __classPrivateFieldGet(this, _WebGPUChart_context, "f").configure({
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
        __classPrivateFieldSet(this, _WebGPUChart_gpu, {
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
        }, "f");
        this.update();
    });
}, _WebGPUChart_on_resize = function _WebGPUChart_on_resize() {
    __classPrivateFieldGet(this, _WebGPUChart_canvas, "f").width = Math.floor(__classPrivateFieldGet(this, _WebGPUChart_canvas, "f").clientWidth * window.devicePixelRatio);
    __classPrivateFieldGet(this, _WebGPUChart_canvas, "f").height = Math.floor(__classPrivateFieldGet(this, _WebGPUChart_canvas, "f").clientHeight * window.devicePixelRatio);
    this.update();
}, _WebGPUChart_on_mousemove = function _WebGPUChart_on_mousemove(ev) {
    if (__classPrivateFieldGet(this, _WebGPUChart_data, "f") === null) {
        return;
    }
    const data = __classPrivateFieldGet(this, _WebGPUChart_data, "f");
    const adapter = __classPrivateFieldGet(this, _WebGPUChart_config, "f").adapter;
    const chart_x = (ev.offsetX * window.devicePixelRatio) - data.chart_bounds.l;
    const chart_y = (__classPrivateFieldGet(this, _WebGPUChart_canvas, "f").clientHeight - ev.offsetY) * window.devicePixelRatio - data.chart_bounds.b;
    const data_x = Math.floor(data.chart_to_data.mul_x(chart_x));
    ;
    var closest = null;
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
        __classPrivateFieldGet(this, _WebGPUChart_tooltip_box, "f").style.left = `${ev.offsetX}px`;
        __classPrivateFieldGet(this, _WebGPUChart_tooltip_box, "f").style.top = `${ev.offsetY}px`;
        __classPrivateFieldGet(this, _WebGPUChart_tooltip_text, "f").innerHTML = adapter.tooltip(closest.sample);
        __classPrivateFieldGet(this, _WebGPUChart_tooltip_box, "f").style.visibility = "visible";
        __classPrivateFieldGet(this, _WebGPUChart_tooltip_box, "f").style.backgroundColor =
            `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, 0.75)`;
    }
    else {
        __classPrivateFieldGet(this, _WebGPUChart_tooltip_box, "f").style.visibility = "hidden";
    }
}, _WebGPUChart_render = function _WebGPUChart_render() {
    if (__classPrivateFieldGet(this, _WebGPUChart_gpu, "f") === null || __classPrivateFieldGet(this, _WebGPUChart_data, "f") === null) {
        return;
    }
    const gpu = __classPrivateFieldGet(this, _WebGPUChart_gpu, "f");
    const data = __classPrivateFieldGet(this, _WebGPUChart_data, "f");
    const cmd_encoder = __classPrivateFieldGet(this, _WebGPUChart_gpu, "f").device.createCommandEncoder();
    const texture_view = __classPrivateFieldGet(this, _WebGPUChart_context, "f").getCurrentTexture().createView();
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
        pass_encoder.setBindGroup(1, gpu.view_bind_group);
        __classPrivateFieldGet(this, _WebGPUChart_data, "f").datasets.forEach(dataset => {
            pass_encoder.setBindGroup(0, dataset.samples_to_chart_data_bind_group);
            pass_encoder.dispatchWorkgroups(256, 1, 1);
        });
        pass_encoder.setPipeline(gpu.process_chart_data_pipeline);
        __classPrivateFieldGet(this, _WebGPUChart_data, "f").datasets.forEach(dataset => {
            pass_encoder.setBindGroup(0, dataset.process_chart_data_bind_group);
            pass_encoder.dispatchWorkgroups(256, 1, 1);
        });
        pass_encoder.end();
    }
    { // Draw
        const render_pass_descriptor = {
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
            pass_encoder.setBindGroup(0, gpu.null_bindgroup);
            pass_encoder.setBindGroup(1, gpu.view_bind_group);
            pass_encoder.draw(4, 1, 0, 0);
        }
        { // Lines
            pass_encoder.setPipeline(gpu.draw_line_pipeline);
            pass_encoder.setBindGroup(1, gpu.view_bind_group);
            __classPrivateFieldGet(this, _WebGPUChart_data, "f").datasets.forEach(dataset => {
                pass_encoder.setBindGroup(0, dataset.draw_line_bind_group);
                pass_encoder.draw(kLineSegments * 2, 1, 0, 0);
            });
        }
        pass_encoder.end();
    }
    gpu.device.queue.submit([cmd_encoder.finish()]);
}, _WebGPUChart_update_labels = function _WebGPUChart_update_labels(old_labels, cb) {
    const new_labels = [];
    const acquire_label = () => {
        var label = old_labels === null || old_labels === void 0 ? void 0 : old_labels.pop();
        if (label === undefined) {
            label = document.createElement("p");
            __classPrivateFieldGet(this, _WebGPUChart_container, "f").insertBefore(label, __classPrivateFieldGet(this, _WebGPUChart_canvas, "f"));
        }
        else {
            label.removeAttribute('style');
            label.textContent = "";
        }
        label.className = "webgpu-chart-label";
        new_labels.push(label);
        return label;
    };
    cb(acquire_label);
    old_labels === null || old_labels === void 0 ? void 0 : old_labels.forEach(label => label.remove());
    return new_labels;
}, _WebGPUChart_quantize = function _WebGPUChart_quantize(value) {
    return Math.pow(10, Math.ceil(Math.log10(value)));
}, _WebGPUChart_get_or_create = function _WebGPUChart_get_or_create(map, key, create) {
    if (map.has(key)) {
        return map.get(key);
    }
    const val = create();
    map.set(key, val);
    return val;
};
_WebGPUChart_adapter = { value: null };
//# sourceMappingURL=webgpu-chart.js.map