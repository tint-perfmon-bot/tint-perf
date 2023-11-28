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
var _Chart_instances, _a, _Chart_adapter, _Chart_container, _Chart_canvas, _Chart_axis_x_labels, _Chart_axis_y_labels, _Chart_highlighted_sample_x, _Chart_highlighted_dataset_idx, _Chart_tooltip_box, _Chart_tooltip_text, _Chart_context, _Chart_config, _Chart_data, _Chart_pendingDraw, _Chart_gpu, _Chart_draw, _Chart_init, _Chart_updateViewport, _Chart_client_to_canvas, _Chart_on_resize, _Chart_update_grid, _Chart_update_labels, _Chart_on_mousedown, _Chart_on_mouseup, _Chart_on_mousemove, _Chart_set_highlighted_sample, _Chart_on_wheel, _Chart_beginZoom, _Chart_sample_at_client, _Chart_sample_at_canvas, _Chart_render, _Chart_quantize;
import { Mat2x3, Point, clamp, inv_lerp, lerp, round_up, saturate, square_distance, } from './math.js';
import Rect from './rect.js';
const kF32Size = 4;
const kU32Size = 4;
const kLineSegments = 1024;
const kWorkgroupSize = 256;
const kNoNumber = -1.7014118e38;
const kDefaultMargin = new Rect({ t: 20, r: 100, b: 300, l: 200 });
function get_or_create(map, key, create) {
    const existing = map.get(key);
    if (existing !== undefined) {
        return existing;
    }
    const val = create();
    map.set(key, val);
    return val;
}
export default class Chart {
    constructor(container, config) {
        _Chart_instances.add(this);
        this.datasets = [];
        _Chart_container.set(this, void 0);
        _Chart_canvas.set(this, void 0);
        _Chart_axis_x_labels.set(this, []);
        _Chart_axis_y_labels.set(this, []);
        _Chart_highlighted_sample_x.set(this, -1);
        _Chart_highlighted_dataset_idx.set(this, -1);
        _Chart_tooltip_box.set(this, void 0);
        _Chart_tooltip_text.set(this, void 0);
        _Chart_context.set(this, void 0);
        _Chart_config.set(this, void 0);
        _Chart_data.set(this, null);
        _Chart_pendingDraw.set(this, false);
        _Chart_gpu.set(this, null);
        const inner_container = document.createElement('div');
        inner_container.style.position = 'relative';
        inner_container.style.width = '100%';
        inner_container.style.height = '100%';
        container.appendChild(inner_container);
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        inner_container.append(canvas);
        const tooltip_text = document.createElement('div');
        tooltip_text.className = 'webgpu-chart-tooltip-text';
        const tooltip_box = document.createElement('div');
        tooltip_box.className = 'webgpu-chart-tooltip-box';
        tooltip_box.appendChild(tooltip_text);
        inner_container.appendChild(tooltip_box);
        __classPrivateFieldSet(this, _Chart_container, inner_container, "f");
        __classPrivateFieldSet(this, _Chart_canvas, canvas, "f");
        __classPrivateFieldSet(this, _Chart_tooltip_text, tooltip_text, "f");
        __classPrivateFieldSet(this, _Chart_tooltip_box, tooltip_box, "f");
        __classPrivateFieldSet(this, _Chart_context, canvas.getContext('webgpu'), "f");
        __classPrivateFieldSet(this, _Chart_config, config, "f");
        __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_init).call(this);
        new ResizeObserver(__classPrivateFieldGet(this, _Chart_instances, "m", _Chart_on_resize).bind(this)).observe(canvas);
        canvas.onmousedown = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_on_mousedown).bind(this);
        canvas.onmouseup = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_on_mouseup).bind(this);
        canvas.onmousemove = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_on_mousemove).bind(this);
        canvas.onwheel = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_on_wheel).bind(this);
        canvas.addEventListener('contextmenu', function (e) {
            e.preventDefault();
        });
    }
    update() {
        if (__classPrivateFieldGet(this, _Chart_gpu, "f") === null) {
            return;
        }
        const gpu = __classPrivateFieldGet(this, _Chart_gpu, "f");
        const margin = __classPrivateFieldGet(this, _Chart_config, "f").margin ? __classPrivateFieldGet(this, _Chart_config, "f").margin : kDefaultMargin;
        const chart_w = Math.max(__classPrivateFieldGet(this, _Chart_canvas, "f").width - margin.l - margin.r, 1);
        const num_datasets = this.datasets.length;
        /**
         * x_to_indices holds a map of chart-x value to an array, where the array index is the dataset
         * index, and the array element is the sample index
         */
        const x_to_dataset_sample_idx = new Map();
        for (let dataset_idx = 0; dataset_idx < this.datasets.length; dataset_idx++) {
            const dataset = this.datasets[dataset_idx];
            for (let sample_idx = 0; sample_idx < dataset.samples.length; sample_idx++) {
                const sample = dataset.samples[sample_idx];
                const x = __classPrivateFieldGet(this, _Chart_config, "f").adapter.x(sample);
                const indices = get_or_create(x_to_dataset_sample_idx, x, () => new Array(num_datasets));
                indices[dataset_idx] = sample_idx;
            }
        }
        /** x_values holds all the chart-x values, sorted in ascending order */
        const x_values = [...x_to_dataset_sample_idx.keys()].sort((a, b) => a - b);
        /** the total number of x_values */
        const num_x = x_values.length;
        let min_y = 1e50;
        let max_y = -1e50;
        const datasets = this.datasets.map((dataset, dataset_idx) => {
            const sample_x_to_idx = x_values.map(x => x_to_dataset_sample_idx.get(x)[dataset_idx]);
            const y_values = sample_x_to_idx.map(i => {
                const item = dataset.samples[i];
                return item !== undefined ? __classPrivateFieldGet(this, _Chart_config, "f").adapter.y(item) : NaN;
            });
            const sample_data = gpu.device.createBuffer({
                size: kF32Size * num_x,
                usage: GPUBufferUsage.STORAGE,
                mappedAtCreation: true,
            });
            {
                // Populate sample_data
                const arr = new Float32Array(sample_data.getMappedRange());
                for (let i = 0; i < num_x; i++) {
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
            const line_data = gpu.device.createBuffer({
                size: 4 * kF32Size * chart_w,
                usage: GPUBufferUsage.STORAGE,
            });
            const samples_to_lines_bind_group = gpu.device.createBindGroup({
                layout: gpu.samples_to_lines_bind_group_layout,
                entries: [
                    { binding: 0, resource: { buffer: sample_data } },
                    { binding: 1, resource: { buffer: line_data } },
                ],
            });
            const process_lines_bind_group = gpu.device.createBindGroup({
                layout: gpu.process_lines_bind_group_layout,
                entries: [{ binding: 0, resource: { buffer: line_data } }],
            });
            const draw_info_buffer = gpu.device.createBuffer({
                size: 0 +
                    kF32Size * 4 + // color : vec4f,
                    kU32Size + // dataset_idx : u32,
                    12,
                usage: GPUBufferUsage.UNIFORM,
                mappedAtCreation: true,
            });
            {
                // Populate draw_info_buffer
                const f32 = new Float32Array(draw_info_buffer.getMappedRange());
                const i32 = new Int32Array(f32.buffer);
                f32[0] = dataset.color.r;
                f32[1] = dataset.color.g;
                f32[2] = dataset.color.b;
                f32[3] = dataset.color.a;
                i32[4] = dataset_idx;
                draw_info_buffer.unmap();
            }
            const draw_line_bind_group = gpu.device.createBindGroup({
                layout: gpu.draw_line_bind_group_layout,
                entries: [
                    { binding: 0, resource: { buffer: line_data } },
                    { binding: 1, resource: { buffer: draw_info_buffer } },
                ],
            });
            const draw_points_bind_group = gpu.device.createBindGroup({
                layout: gpu.draw_points_bind_group_layout,
                entries: [
                    { binding: 0, resource: { buffer: sample_data } },
                    { binding: 1, resource: { buffer: draw_info_buffer } },
                ],
            });
            const internal = {
                dataset,
                sample_x_to_idx,
                y_values,
                samples_to_lines_bind_group,
                process_lines_bind_group,
                draw_line_bind_group,
                draw_points_bind_group,
            };
            return internal;
        });
        // Bounds of the full sample data, in sample-space.
        const sample_bounds = new Rect({
            t: max_y,
            r: x_values.length,
            b: 0,
            l: 0,
        });
        __classPrivateFieldSet(this, _Chart_data, {
            x_values,
            datasets,
            min_y,
            max_y,
            margin,
            viewport: {
                chart_bounds: Rect.zero,
                sample_bounds,
                sample_window: sample_bounds,
                canvas_to_sample: Mat2x3.zero,
                sample_to_canvas: Mat2x3.zero,
                chart_to_sample: Mat2x3.zero,
                sample_to_chart: Mat2x3.zero,
                chart_to_ndc: Mat2x3.zero,
            },
        }, "f");
        __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_updateViewport).call(this);
    }
    redraw() {
        if (!__classPrivateFieldGet(this, _Chart_pendingDraw, "f")) {
            __classPrivateFieldSet(this, _Chart_pendingDraw, true, "f");
            requestAnimationFrame(__classPrivateFieldGet(this, _Chart_instances, "m", _Chart_draw).bind(this));
        }
    }
}
_a = Chart, _Chart_container = new WeakMap(), _Chart_canvas = new WeakMap(), _Chart_axis_x_labels = new WeakMap(), _Chart_axis_y_labels = new WeakMap(), _Chart_highlighted_sample_x = new WeakMap(), _Chart_highlighted_dataset_idx = new WeakMap(), _Chart_tooltip_box = new WeakMap(), _Chart_tooltip_text = new WeakMap(), _Chart_context = new WeakMap(), _Chart_config = new WeakMap(), _Chart_data = new WeakMap(), _Chart_pendingDraw = new WeakMap(), _Chart_gpu = new WeakMap(), _Chart_instances = new WeakSet(), _Chart_draw = function _Chart_draw() {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return;
    }
    var animating = false;
    const data = __classPrivateFieldGet(this, _Chart_data, "f");
    __classPrivateFieldSet(this, _Chart_pendingDraw, false, "f");
    if (data.anim !== undefined) {
        const now = Date.now();
        {
            var f = saturate(inv_lerp(now, data.anim.start_ms, data.anim.end_ms));
            f = f = f * f * f * (3 * f * (2 * f - 5) + 10.0); // 'smootherstep'
            const start = data.anim.start_keyframe;
            const end = data.anim.end_keyframe;
            data.viewport.sample_window = new Rect({
                l: lerp(f, start.sample_window.l, end.sample_window.l),
                r: lerp(f, start.sample_window.r, end.sample_window.r),
                t: lerp(f, start.sample_window.t, end.sample_window.t),
                b: lerp(f, start.sample_window.b, end.sample_window.b),
            });
            __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_updateViewport).call(this);
        }
        if (now > data.anim.end_ms) {
            __classPrivateFieldGet(this, _Chart_data, "f").anim = undefined;
        }
        else {
            animating = true;
        }
    }
    const promise = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_render).call(this);
    if (animating) {
        promise.then(() => {
            this.redraw();
        });
    }
}, _Chart_init = function _Chart_init() {
    return __awaiter(this, void 0, void 0, function* () {
        if (__classPrivateFieldGet(Chart, _a, "f", _Chart_adapter) === null) {
            __classPrivateFieldSet(Chart, _a, yield navigator.gpu.requestAdapter(), "f", _Chart_adapter);
            if (__classPrivateFieldGet(Chart, _a, "f", _Chart_adapter) === null) {
                console.error('WebGPU is not avaliable');
                return;
            }
        }
        const device = yield __classPrivateFieldGet(Chart, _a, "f", _Chart_adapter).requestDevice();
        const presentation_format = navigator.gpu.getPreferredCanvasFormat();
        __classPrivateFieldGet(this, _Chart_context, "f").configure({
            device,
            format: presentation_format,
            alphaMode: 'premultiplied',
        });
        const null_bindgroup_layout = device.createBindGroupLayout({
            label: 'null_bindgroup_layout',
            entries: [],
        });
        const null_bindgroup = device.createBindGroup({
            label: 'null_bindgroup',
            layout: null_bindgroup_layout,
            entries: [],
        });
        const samples_to_lines_bind_group_layout = device.createBindGroupLayout({
            label: 'samples_to_lines_bind_group_layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'read-only-storage' },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'storage' },
                },
            ],
        });
        const common_wgsl = `
struct LinePoint {
    fine_min : i32,
    fine_max : i32,
    course_min : i32,
    course_max : i32,
};
alias LineData = array<LinePoint>;
struct View {
    chart_bounds : vec4f, // [x, y, w, h] pixels
    sample_to_chart : mat2x3<f32>,
    chart_to_sample : mat2x3<f32>,
    chart_to_ndc : mat2x3<f32>,
    highlighted_sample_x : u32,
    highlighted_dataset_idx : u32,
};
struct DrawInfo {
    color : vec4f,
    dataset_idx : u32,
};
`;
        const view_buffer = device.createBuffer({
            label: 'view_buffer',
            size: 0 +
                kF32Size * 4 + // chart_bounds : vec4f
                kF32Size * 2 * 4 + // sample_to_chart : mat2x3<f32>
                kF32Size * 2 * 4 + // chart_to_sample : mat2x3<f32>
                kF32Size * 2 * 4 + // chart_to_ndc : mat2x3<f32>
                kU32Size + // highlighted_sample_x : u32
                kU32Size + // highlighted_dataset_idx : u32
                kU32Size * 2 + // padding
                0,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const view_layout = device.createBindGroupLayout({
            label: 'view_layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: { type: 'uniform' },
                },
            ],
        });
        const view_bind_group = device.createBindGroup({
            label: 'view_bind_group',
            layout: view_layout,
            entries: [{ binding: 0, resource: { buffer: view_buffer } }],
        });
        const samples_to_lines_pipeline = device.createComputePipeline({
            label: 'samples_to_lines_pipeline',
            layout: device.createPipelineLayout({
                bindGroupLayouts: [samples_to_lines_bind_group_layout, view_layout],
            }),
            compute: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage> sample_value : array<f32>;
@group(0) @binding(1) var<storage, read_write> line_data : LineData;
@group(1) @binding(0) var<uniform> view : View;

@compute @workgroup_size(${kWorkgroupSize})
fn main(@builtin(global_invocation_id) global_invocation_id : vec3<u32>) {
    let chart_x0 = global_invocation_id.x;
    let chart_x1 = global_invocation_id.x + 1;

    let sample_x0 = i32((vec3(f32(chart_x0), 0, 1) * view.chart_to_sample).x);
    let sample_x1 = i32((vec3(f32(chart_x1), 0, 1) * view.chart_to_sample).x);

    var bounds = LinePoint(0x7fffffff, -0x7fffffff, 0x7fffffff, -0x7fffffff);
    for (var sample_x = sample_x0; sample_x <= sample_x1; sample_x++) {
        let sample_y = sample_value[sample_x];
        if (sample_y > ${kNoNumber}) {
            let chart_y = i32((vec3(0, sample_y, 1) * view.sample_to_chart).y);
            bounds.fine_min = min(bounds.fine_min, chart_y);
            bounds.fine_max = max(bounds.fine_max, chart_y);
        }
    }
    line_data[chart_x0] = bounds;
}`,
                }),
                entryPoint: 'main',
            },
        });
        const process_lines_bind_group_layout = device.createBindGroupLayout({
            label: 'process_lines_bind_group_layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'storage' },
                },
            ],
        });
        const process_lines_pipeline = device.createComputePipeline({
            label: 'process_lines_pipeline',
            layout: device.createPipelineLayout({
                bindGroupLayouts: [process_lines_bind_group_layout],
            }),
            compute: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage, read_write> line_data : LineData;

@compute @workgroup_size(${kWorkgroupSize})
fn main(@builtin(global_invocation_id) global_invocation_id : vec3<u32>) {
    let x = i32(global_invocation_id.x);
    var val_min = line_data[x].fine_min;
    var val_max = line_data[x].fine_max;
    for (var i = 1; i < 8; i++) {
        {
            let x2 = x - i;
            let o_min = line_data[x2].fine_min;
            let o_max = line_data[x2].fine_max;
            if (x2 >= 0 && o_min <= o_max) {
                val_min = min(val_min, o_min);
                val_max = max(val_max, o_max);
            }
        }
        {
            let x2 = x + i;
            let o_min = line_data[x2].fine_min;
            let o_max = line_data[x2].fine_max;
            if (u32(x2) < arrayLength(&line_data) && o_min <= o_max) {
                val_min = min(val_min, o_min);
                val_max = max(val_max, o_max);
            }
        }
    }
    line_data[x].course_min = val_min;
    line_data[x].course_max = val_max;
}`,
                }),
                entryPoint: 'main',
            },
        });
        const draw_grid_buffer = device.createBuffer({
            label: 'draw_grid_buffer',
            size: kF32Size * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
        const targets = [
            {
                format: presentation_format,
                blend: {
                    color: {
                        operation: 'add',
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                    },
                    alpha: {
                        operation: 'add',
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                    },
                },
            },
        ];
        const draw_grid_bind_group_layout = device.createBindGroupLayout({
            label: 'draw_grid_bind_group_layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
            ],
        });
        const draw_grid_bind_group = device.createBindGroup({
            layout: draw_grid_bind_group_layout,
            entries: [{ binding: 0, resource: { buffer: draw_grid_buffer } }],
        });
        const draw_grid_pipeline = device.createRenderPipeline({
            label: 'draw_grid_pipeline',
            layout: device.createPipelineLayout({
                bindGroupLayouts: [draw_grid_bind_group_layout, view_layout],
            }),
            vertex: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(1) @binding(0) var<uniform> view : View;

struct Out {
    @builtin(position) pos_ndc : vec4f,
    @location(0) pos_chart : vec2<f32>,
};

@vertex
fn main(@builtin(vertex_index) vertex_index : u32) -> Out {
    let pos_frac = vec2(f32(vertex_index/2), f32(vertex_index&1));
    let pos_chart = pos_frac * view.chart_bounds.zw;
    let pos_ndc = vec3(pos_chart, 1) * view.chart_to_ndc;
    return Out(vec4(pos_ndc, 0, 1), pos_chart);
}`,
                }),
                entryPoint: 'main',
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
struct Grid {
    major : vec2<f32>,
    minor : vec2<f32>,
};

@group(0) @binding(0) var<uniform> grid : Grid;

fn is_grid_line(grid : vec2<f32>, p0 : vec2<f32>, p1 : vec2<f32>) -> bool {
    return any(floor(p0 / grid) != floor(p1 / grid));
}

@fragment
fn main(@location(0) pos_chart : vec2<f32>) -> @location(0) vec4f {
    let neighbour = pos_chart - abs(dpdx(pos_chart)) - abs(dpdy(pos_chart));
    let major = select(0.0, 0.4, is_grid_line(grid.major, pos_chart, neighbour));
    let minor = select(0.0, 0.2, is_grid_line(grid.minor, pos_chart, neighbour));
    let axis = select(0.0, 1.0, any(sign(pos_chart) != sign(neighbour)));
    return vec4(0, 0, 0, max(max(major, minor), axis));
}
`,
                }),
                entryPoint: 'main',
                targets,
            },
            primitive: {
                topology: 'triangle-strip',
            },
        });
        const draw_line_bind_group_layout = device.createBindGroupLayout({
            label: 'draw_line_bind_group_layout',
            entries: [
                {
                    // LineData
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'read-only-storage' },
                },
                {
                    // DrawInfo
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
            ],
        });
        const draw_line_pipeline = device.createRenderPipeline({
            label: 'draw_line_pipeline',
            layout: device.createPipelineLayout({
                bindGroupLayouts: [draw_line_bind_group_layout, view_layout],
            }),
            vertex: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage> line_data : LineData;
@group(1) @binding(0) var<uniform> view : View;

struct Out {
    @builtin(position) pos_ndc : vec4f,
    @location(0) chart_pos : vec2<f32>,
};

@vertex
fn main(@builtin(vertex_index) vertex_index : u32) -> Out {
    let frac_x = f32(vertex_index/2) / f32(${kLineSegments} - 1);
    let chart_x = i32(frac_x * f32(arrayLength(&line_data) - 1));
    let r = line_data[chart_x];
    var chart_y = select(r.course_min - 8, r.course_max + 8, (vertex_index&1) == 0);
    if (r.course_min > r.course_max) {
      chart_y = 0; // no value
    }
    let chart_pos = vec2<f32>(vec2(chart_x, chart_y));
    let pos_ndc = vec3(chart_pos, 1) * view.chart_to_ndc;
    return Out(vec4(pos_ndc, 0, 1), chart_pos);
}`,
                }),
                entryPoint: 'main',
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage> line_data : LineData;
@group(0) @binding(1) var<uniform> draw : DrawInfo;
@group(1) @binding(0) var<uniform> view : View;

@fragment
fn main(@location(0) chart_pos : vec2<f32>) -> @location(0) vec4f {
    var dist = 1000.0;
    for (var i = -4; i < 4; i++) {
        let x0 = floor(chart_pos.x) - f32(i);
        let x1 = x0 + 1;
        let r0 = line_data[i32(x0)];
        let r1 = line_data[i32(x1)];
        if (r0.fine_min <= r0.fine_max && r1.fine_min <= r1.fine_max) {
            let y0 = f32(clamp(i32(chart_pos.y), r0.fine_min, r0.fine_max));
            let y1 = f32(clamp(i32(chart_pos.y), r1.fine_min, r1.fine_max));
            let d = line_point_dist(vec2(x0, y0), vec2(x1, y1), chart_pos);
            dist = min(dist, d);
        }
    }
    let color = mix(draw.color.rgb * 0.75, draw.color.rgb, smoothstep(1.0, 0.0, dist));
    let alpha = smoothstep(3.0, 2.0, dist);
    let in_bounds = all((chart_pos >= vec2f()) & (chart_pos <= view.chart_bounds.zw));
    return select(vec4f(), vec4(color, draw.color.a) * alpha, in_bounds);
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
                targets,
            },
            primitive: {
                topology: 'triangle-strip',
            },
        });
        const draw_points_bind_group_layout = device.createBindGroupLayout({
            label: 'draw_points_bind_group_layout',
            entries: [
                {
                    // samples
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' },
                },
                {
                    // draw
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
            ],
        });
        const draw_points_pipeline = device.createRenderPipeline({
            label: 'draw_points_pipeline',
            layout: device.createPipelineLayout({
                bindGroupLayouts: [draw_points_bind_group_layout, view_layout],
            }),
            vertex: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(0) var<storage> samples : array<f32>;
@group(0) @binding(1) var<uniform> draw : DrawInfo;
@group(1) @binding(0) var<uniform> view : View;

const kVertA = vec2<f32>(-1,  1); // A --- B
const kVertB = vec2<f32>( 1,  1); // |     |
const kVertC = vec2<f32>(-1, -1); // |     |
const kVertD = vec2<f32>( 1, -1); // C --- D

const kQuadOffsets = array(kVertA, kVertB, kVertC, kVertC, kVertB, kVertD);

struct Out {
    @builtin(position) pos       : vec4f,
    @location(0)       quad      : vec2<f32>,
    @location(1)       chart_pos : vec2<f32>,
}

@vertex
fn main(@builtin(vertex_index) vertex_index : u32) -> Out {
    let sample_idx = vertex_index / 6;
    let is_highlighted_dataset = draw.dataset_idx == view.highlighted_dataset_idx;
    let is_highlighted_sample  = sample_idx       == view.highlighted_sample_x;
    let radius = 3 +
                 select(0.0, 2.0, is_highlighted_sample) +
                 select(0.0, 4.0, is_highlighted_sample & is_highlighted_dataset);
    let quad_offset = kQuadOffsets[vertex_index%6] ;
    let pos_sample = vec2(f32(sample_idx), samples[sample_idx]);
    let pos_chart = (vec3(pos_sample, 1) * view.sample_to_chart) + quad_offset * radius;
    let pos_ndc = vec3(pos_chart, 1) * view.chart_to_ndc;
    return Out(vec4(pos_ndc, 0, 1), quad_offset, pos_chart);
}`,
                }),
                entryPoint: 'main',
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
@group(0) @binding(1) var<uniform> draw : DrawInfo;
@group(1) @binding(0) var<uniform> view : View;

@fragment
fn main(@location(0) quad : vec2<f32>, @location(1) chart_pos : vec2<f32>) -> @location(0) vec4f {
    let radius = dot(quad,quad);
    let alpha = smoothstep(1.0, 0.9, radius) * smoothstep(0.2, 0.3, radius) * 0.5;
    let in_bounds = all((chart_pos >= vec2f()) & (chart_pos <= view.chart_bounds.zw));
    let color = vec4f(draw.color.rgb*alpha*0.8, alpha);
    return select(vec4f(), color, in_bounds);
}
`,
                }),
                entryPoint: 'main',
                targets,
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
        const draw_chart_rect_pipeline_layout = device.createBindGroupLayout({
            label: 'draw_chart_rect_pipeline_layout',
            entries: [
                {
                    // RectInfo
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
            ],
        });
        const draw_rect_pipeline = device.createRenderPipeline({
            label: 'draw_rect_pipeline',
            layout: device.createPipelineLayout({
                bindGroupLayouts: [draw_chart_rect_pipeline_layout, view_layout],
            }),
            vertex: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
struct RectInfo {
  rect  : vec4f, // in canvas space
  color : vec4f, // in canvas space
}
@group(0) @binding(0) var<uniform> rect : RectInfo;
@group(1) @binding(0) var<uniform> view : View;

const kVertA = vec2<f32>(0, 1); // A --- B
const kVertB = vec2<f32>(1, 1); // |     |
const kVertC = vec2<f32>(0, 0); // |     |
const kVertD = vec2<f32>(1, 0); // C --- D

const kQuadOffsets = array(kVertA, kVertB, kVertC, kVertC, kVertB, kVertD);

@vertex
fn main(@builtin(vertex_index) vertex_index : u32) -> @builtin(position) vec4f {
    let quad_offset = kQuadOffsets[vertex_index%6];
    let pos_chart = rect.rect.xy + rect.rect.zw * quad_offset - view.chart_bounds.xy;
    return vec4(vec3(pos_chart, 1) * view.chart_to_ndc, 0, 1);
}`,
                }),
                entryPoint: 'main',
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
${common_wgsl}
struct RectInfo {
  rect  : vec4f, // in canvas space
  color : vec4f, // in canvas space
}
@group(0) @binding(0) var<uniform> rect : RectInfo;
@group(0) @binding(1) var<uniform> draw : DrawInfo;

@fragment
fn main() -> @location(0) vec4f {
    return rect.color;
}
`,
                }),
                entryPoint: 'main',
                targets,
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
        const draw_rect_buffer = device.createBuffer({
            size: 2 * 4 * kF32Size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const draw_rect_bind_group = device.createBindGroup({
            layout: draw_chart_rect_pipeline_layout,
            entries: [{ binding: 0, resource: { buffer: draw_rect_buffer } }],
        });
        __classPrivateFieldSet(this, _Chart_gpu, {
            device,
            null_bindgroup_layout,
            null_bindgroup,
            samples_to_lines_bind_group_layout,
            samples_to_lines_pipeline,
            process_lines_bind_group_layout,
            process_lines_pipeline,
            draw_grid_buffer,
            draw_grid_pipeline,
            draw_grid_bind_group,
            draw_line_pipeline,
            draw_line_bind_group_layout,
            draw_points_pipeline,
            draw_points_bind_group_layout,
            draw_rect_pipeline,
            draw_chart_rect_pipeline_layout,
            draw_rect_bind_group,
            draw_rect_buffer,
            view_bind_group,
            view_buffer,
            view_changed: true,
        }, "f");
        this.update();
    });
}, _Chart_updateViewport = function _Chart_updateViewport() {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        throw new Error('#data is null');
    }
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
    const transform = (a, b) => {
        return Mat2x3.offset(-a.l, -a.b)
            .scale(b.w / a.w, b.h / a.h)
            .offset(b.l, b.b);
    };
    // Bounds of the canvas, in canvas pixel space.
    const canvas_bounds = new Rect({ t: __classPrivateFieldGet(this, _Chart_canvas, "f").height, r: __classPrivateFieldGet(this, _Chart_canvas, "f").width, b: 0, l: 0 });
    const sample_bounds = __classPrivateFieldGet(this, _Chart_data, "f").viewport.sample_bounds;
    const sample_window = __classPrivateFieldGet(this, _Chart_data, "f").viewport.sample_window;
    // Chart bounds in canvas space.
    const chart_bounds = new Rect({
        l: __classPrivateFieldGet(this, _Chart_data, "f").margin.l,
        b: __classPrivateFieldGet(this, _Chart_data, "f").margin.b,
        r: canvas_bounds.r - __classPrivateFieldGet(this, _Chart_data, "f").margin.r,
        t: canvas_bounds.t - __classPrivateFieldGet(this, _Chart_data, "f").margin.t,
    });
    const canvas_to_chart = Mat2x3.offset(-chart_bounds.l, -chart_bounds.b);
    const chart_to_canvas = Mat2x3.offset(chart_bounds.l, chart_bounds.b);
    const canvas_to_sample = transform(chart_bounds, sample_window);
    const sample_to_canvas = transform(sample_window, chart_bounds);
    const chart_to_sample = chart_to_canvas.mul(canvas_to_sample);
    const sample_to_chart = sample_to_canvas.mul(canvas_to_chart);
    const chart_to_ndc = Mat2x3.offset(chart_bounds.l, chart_bounds.b)
        .scale(2.0 / canvas_bounds.w, 2.0 / canvas_bounds.h)
        .offset(-1, -1);
    __classPrivateFieldGet(this, _Chart_data, "f").viewport = {
        chart_bounds,
        sample_bounds,
        sample_window,
        canvas_to_sample,
        sample_to_canvas,
        chart_to_sample,
        sample_to_chart,
        chart_to_ndc,
    };
    if (__classPrivateFieldGet(this, _Chart_gpu, "f") !== null) {
        __classPrivateFieldGet(this, _Chart_gpu, "f").view_changed = true;
        this.redraw();
    }
}, _Chart_client_to_canvas = function _Chart_client_to_canvas(client) {
    const rect = __classPrivateFieldGet(this, _Chart_canvas, "f").getBoundingClientRect();
    return new Point((client.x - rect.left) * window.devicePixelRatio, (rect.height - (client.y - rect.top)) * window.devicePixelRatio);
}, _Chart_on_resize = function _Chart_on_resize() {
    __classPrivateFieldGet(this, _Chart_canvas, "f").width = Math.floor(__classPrivateFieldGet(this, _Chart_canvas, "f").clientWidth * window.devicePixelRatio);
    __classPrivateFieldGet(this, _Chart_canvas, "f").height = Math.floor(__classPrivateFieldGet(this, _Chart_canvas, "f").clientHeight * window.devicePixelRatio);
    this.update();
}, _Chart_update_grid = function _Chart_update_grid() {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null || __classPrivateFieldGet(this, _Chart_gpu, "f") === null) {
        return null;
    }
    const data = __classPrivateFieldGet(this, _Chart_data, "f");
    const gpu = __classPrivateFieldGet(this, _Chart_gpu, "f");
    const chart_bounds = data.viewport.chart_bounds;
    const sample_window = data.viewport.sample_window;
    const major_x = (chart_bounds.w / sample_window.w) * __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_quantize).call(this, (sample_window.w / chart_bounds.w) * 50);
    const major_y = (chart_bounds.h / sample_window.h) * __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_quantize).call(this, (sample_window.h / chart_bounds.h) * 50);
    const minor_x = major_x / 2;
    const minor_y = major_y / 2;
    gpu.device.queue.writeBuffer(gpu.draw_grid_buffer, 0, new Float32Array([major_x, major_y, minor_x, minor_y]));
    data.grid = {
        major_x,
        minor_x,
        major_y,
        minor_y,
    };
}, _Chart_update_labels = function _Chart_update_labels() {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return;
    }
    const data = __classPrivateFieldGet(this, _Chart_data, "f");
    const grid = data.grid;
    if (grid === undefined) {
        return;
    }
    const chart_bounds = data.viewport.chart_bounds;
    const canvas_to_sample = data.viewport.canvas_to_sample;
    const old_axis_x_labels = __classPrivateFieldGet(this, _Chart_axis_x_labels, "f");
    const new_axis_x_labels = [];
    const old_axis_y_labels = __classPrivateFieldGet(this, _Chart_axis_y_labels, "f");
    const new_axis_y_labels = [];
    const acquire_axis_x_label = () => {
        let label = old_axis_x_labels === null || old_axis_x_labels === void 0 ? void 0 : old_axis_x_labels.pop();
        if (label === undefined) {
            label = document.createElement('p');
            label.classList.add('webgpu-chart-label');
            label.classList.add('webgpu-chart-label-axis-x');
            __classPrivateFieldGet(this, _Chart_container, "f").insertBefore(label, __classPrivateFieldGet(this, _Chart_canvas, "f"));
        }
        new_axis_x_labels.push(label);
        return label;
    };
    const acquire_axis_y_label = () => {
        let label = old_axis_y_labels === null || old_axis_y_labels === void 0 ? void 0 : old_axis_y_labels.pop();
        if (label === undefined) {
            label = document.createElement('p');
            label.classList.add('webgpu-chart-label');
            label.classList.add('webgpu-chart-label-axis-y');
            __classPrivateFieldGet(this, _Chart_container, "f").insertBefore(label, __classPrivateFieldGet(this, _Chart_canvas, "f"));
        }
        new_axis_y_labels.push(label);
        return label;
    };
    for (let canvas_x = chart_bounds.l; canvas_x < chart_bounds.r; canvas_x += grid.major_x) {
        const left = `${__classPrivateFieldGet(this, _Chart_canvas, "f").offsetLeft + canvas_x / window.devicePixelRatio}px`;
        const top = `${__classPrivateFieldGet(this, _Chart_canvas, "f").offsetTop +
            __classPrivateFieldGet(this, _Chart_canvas, "f").offsetHeight -
            chart_bounds.b / window.devicePixelRatio}px`;
        const sample_x = Math.floor(canvas_to_sample.mul_x(canvas_x));
        const text = __classPrivateFieldGet(this, _Chart_config, "f").adapter.x_axis_label(data.x_values[sample_x]);
        const label = acquire_axis_x_label();
        label.style.left = left;
        label.style.top = top;
        label.textContent = text;
    }
    for (let canvas_y = chart_bounds.b; canvas_y < chart_bounds.t; canvas_y += grid.major_y) {
        const right = `${__classPrivateFieldGet(this, _Chart_canvas, "f").offsetWidth - chart_bounds.l / window.devicePixelRatio}px`;
        const bottom = `${canvas_y / window.devicePixelRatio}px`;
        const sample_y = canvas_to_sample.mul_y(canvas_y);
        const text = __classPrivateFieldGet(this, _Chart_config, "f").adapter.y_axis_label(sample_y);
        const label = acquire_axis_y_label();
        label.style.right = right;
        label.style.bottom = bottom;
        label.textContent = text;
    }
    old_axis_x_labels === null || old_axis_x_labels === void 0 ? void 0 : old_axis_x_labels.forEach(label => label.remove());
    old_axis_y_labels === null || old_axis_y_labels === void 0 ? void 0 : old_axis_y_labels.forEach(label => label.remove());
    __classPrivateFieldSet(this, _Chart_axis_x_labels, new_axis_x_labels, "f");
    __classPrivateFieldSet(this, _Chart_axis_y_labels, new_axis_y_labels, "f");
}, _Chart_on_mousedown = function _Chart_on_mousedown(ev) {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return;
    }
    if ((ev.buttons & 1) !== 0) {
        const client = new Point(ev.clientX, ev.clientY);
        const canvas = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_client_to_canvas).call(this, client);
        __classPrivateFieldGet(this, _Chart_data, "f").zoom_rect = new Rect({ l: canvas.x, r: canvas.x, t: canvas.y, b: canvas.y });
        ev.preventDefault();
    }
    if ((ev.buttons & 2) !== 0) {
        __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_beginZoom).call(this, __classPrivateFieldGet(this, _Chart_data, "f").viewport.sample_bounds);
        ev.preventDefault();
    }
}, _Chart_on_mouseup = function _Chart_on_mouseup(ev) {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return;
    }
    const zoom_rect = __classPrivateFieldGet(this, _Chart_data, "f").zoom_rect;
    if (zoom_rect !== undefined && zoom_rect.w > 5 && zoom_rect.h > 5) {
        zoom_rect.canonincalize();
        const sample_window = zoom_rect.mul(__classPrivateFieldGet(this, _Chart_data, "f").viewport.canvas_to_sample);
        __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_beginZoom).call(this, sample_window);
        __classPrivateFieldGet(this, _Chart_data, "f").zoom_rect = undefined;
        return;
    }
    if (ev.button === 0 && __classPrivateFieldGet(this, _Chart_config, "f").on_click !== undefined) {
        const client = new Point(ev.clientX, ev.clientY);
        const sample = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_sample_at_client).call(this, client);
        if (sample !== null) {
            __classPrivateFieldGet(this, _Chart_config, "f").on_click(sample.sample, sample.dataset);
        }
    }
}, _Chart_on_mousemove = function _Chart_on_mousemove(ev) {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return;
    }
    if (ev.altKey) {
        return; // Don't update if alt is held
    }
    const adapter = __classPrivateFieldGet(this, _Chart_config, "f").adapter;
    const client = new Point(ev.clientX, ev.clientY);
    const data = __classPrivateFieldGet(this, _Chart_data, "f");
    if ((ev.buttons & 1) === 0) {
        __classPrivateFieldGet(this, _Chart_data, "f").zoom_rect = undefined;
        this.redraw();
    }
    const zoom_rect = data.zoom_rect;
    if (zoom_rect !== undefined) {
        const canvas = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_client_to_canvas).call(this, client);
        zoom_rect.r = clamp(canvas.x, data.viewport.chart_bounds.l, data.viewport.chart_bounds.r);
        zoom_rect.b = clamp(canvas.y, data.viewport.chart_bounds.b, data.viewport.chart_bounds.t);
        this.redraw();
    }
    if (zoom_rect !== undefined && zoom_rect.w > 5 && zoom_rect.h > 5) {
        return;
    }
    // Tooltip
    const sample = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_sample_at_client).call(this, client);
    if (sample !== null) {
        const color = sample.dataset.color;
        const align_x = ev.offsetX / __classPrivateFieldGet(this, _Chart_container, "f").clientWidth;
        __classPrivateFieldGet(this, _Chart_tooltip_text, "f").innerHTML = adapter.tooltip(sample.sample, sample.dataset);
        __classPrivateFieldGet(this, _Chart_tooltip_box, "f").style.left = `${ev.offsetX}px`;
        __classPrivateFieldGet(this, _Chart_tooltip_box, "f").style.top = `${ev.offsetY + 10}px`;
        __classPrivateFieldGet(this, _Chart_tooltip_box, "f").style.transform = `translateX(-${align_x * 100}%)`;
        __classPrivateFieldGet(this, _Chart_tooltip_box, "f").style.backgroundColor = `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, 0.75)`;
        __classPrivateFieldGet(this, _Chart_tooltip_box, "f").classList.add('visible');
        __classPrivateFieldGet(this, _Chart_tooltip_box, "f").classList.remove('hidden');
        __classPrivateFieldGet(this, _Chart_canvas, "f").classList.add('webgpu-chart-crosshair');
        __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_set_highlighted_sample).call(this, sample.sample_x, sample.dataset_idx);
    }
    else {
        __classPrivateFieldGet(this, _Chart_tooltip_box, "f").classList.add('hidden');
        __classPrivateFieldGet(this, _Chart_tooltip_box, "f").classList.remove('visible');
        __classPrivateFieldGet(this, _Chart_canvas, "f").classList.remove('webgpu-chart-crosshair');
        __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_set_highlighted_sample).call(this, -1, -1);
    }
}, _Chart_set_highlighted_sample = function _Chart_set_highlighted_sample(sample_x, dataset_idx) {
    if (__classPrivateFieldGet(this, _Chart_highlighted_sample_x, "f") !== sample_x || __classPrivateFieldGet(this, _Chart_highlighted_dataset_idx, "f") !== dataset_idx) {
        __classPrivateFieldSet(this, _Chart_highlighted_sample_x, sample_x, "f");
        __classPrivateFieldSet(this, _Chart_highlighted_dataset_idx, dataset_idx, "f");
        this.redraw();
    }
}, _Chart_on_wheel = function _Chart_on_wheel(ev) {
    if (ev.ctrlKey) {
        ev.preventDefault();
        if (__classPrivateFieldGet(this, _Chart_data, "f") !== null) {
            const client = new Point(ev.clientX, ev.clientY);
            const canvas = __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_client_to_canvas).call(this, client);
            const sample_bounds = __classPrivateFieldGet(this, _Chart_data, "f").viewport.sample_bounds;
            const sample = clamp(canvas.mul(__classPrivateFieldGet(this, _Chart_data, "f").viewport.canvas_to_sample).x, sample_bounds.l, sample_bounds.r);
            const sample_window = __classPrivateFieldGet(this, _Chart_data, "f").anim !== undefined
                ? __classPrivateFieldGet(this, _Chart_data, "f").anim.end_keyframe.sample_window
                : __classPrivateFieldGet(this, _Chart_data, "f").viewport.sample_window;
            const target = ev.deltaY < 0
                ? new Rect({ l: sample, r: sample, t: sample_window.t, b: sample_window.b })
                : sample_bounds;
            const factor = 0.2;
            __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_beginZoom).call(this, new Rect({
                l: lerp(factor, sample_window.l, target.l),
                r: lerp(factor, sample_window.r, target.r),
                b: lerp(factor, sample_window.b, target.b),
                t: lerp(factor, sample_window.t, target.t),
            }));
        }
    }
}, _Chart_beginZoom = function _Chart_beginZoom(sample_window) {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return;
    }
    __classPrivateFieldGet(this, _Chart_data, "f").anim = {
        start_keyframe: { sample_window: __classPrivateFieldGet(this, _Chart_data, "f").viewport.sample_window },
        end_keyframe: { sample_window },
        start_ms: Date.now(),
        end_ms: Date.now() + 500,
    };
    this.redraw();
}, _Chart_sample_at_client = function _Chart_sample_at_client(client) {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return null;
    }
    return __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_sample_at_canvas).call(this, __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_client_to_canvas).call(this, client));
}, _Chart_sample_at_canvas = function _Chart_sample_at_canvas(canvas) {
    if (__classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return null;
    }
    const data = __classPrivateFieldGet(this, _Chart_data, "f");
    const adapter = __classPrivateFieldGet(this, _Chart_config, "f").adapter;
    let closest = null;
    const threshold = 10 * window.devicePixelRatio;
    const canvas_x_from = Math.max(Math.floor(canvas.x - threshold), data.viewport.chart_bounds.l);
    const canvas_x_to = Math.min(Math.ceil(canvas.x + threshold), data.viewport.chart_bounds.r);
    const sample_x_from = Math.floor(data.viewport.canvas_to_sample.mul_x(canvas_x_from));
    const sample_x_to = Math.ceil(data.viewport.canvas_to_sample.mul_x(canvas_x_to));
    for (let sample_x = sample_x_from; sample_x <= sample_x_to; sample_x++) {
        for (let dataset_idx = 0; dataset_idx < data.datasets.length; dataset_idx++) {
            const dataset = data.datasets[dataset_idx];
            const sample_idx = dataset.sample_x_to_idx[sample_x];
            const sample = dataset.dataset.samples[sample_idx];
            if (sample !== undefined) {
                const sample_pos = new Point(sample_x, adapter.y(sample));
                const p = sample_pos.mul(data.viewport.sample_to_canvas);
                const sqr_distance = square_distance(p, canvas);
                if (sqr_distance < threshold) {
                    if (closest === null || sqr_distance < closest.sqr_distance) {
                        closest = {
                            sqr_distance,
                            sample,
                            sample_x,
                            dataset: dataset.dataset,
                            dataset_idx,
                        };
                    }
                }
            }
        }
    }
    if (closest === null) {
        return null;
    }
    return {
        sample: closest.sample,
        sample_x: closest.sample_x,
        dataset: closest.dataset,
        dataset_idx: closest.dataset_idx,
    };
}, _Chart_render = function _Chart_render() {
    if (__classPrivateFieldGet(this, _Chart_gpu, "f") === null || __classPrivateFieldGet(this, _Chart_data, "f") === null) {
        return Promise.reject();
    }
    const gpu = __classPrivateFieldGet(this, _Chart_gpu, "f");
    const data = __classPrivateFieldGet(this, _Chart_data, "f");
    const cmd_encoder = __classPrivateFieldGet(this, _Chart_gpu, "f").device.createCommandEncoder();
    const texture_view = __classPrivateFieldGet(this, _Chart_context, "f").getCurrentTexture().createView();
    {
        const f32 = new Float32Array(gpu.view_buffer.size / kF32Size);
        const i32 = new Int32Array(f32.buffer);
        const chart_bounds = data.viewport.chart_bounds;
        f32[0] = chart_bounds.l;
        f32[1] = chart_bounds.b;
        f32[2] = chart_bounds.w;
        f32[3] = chart_bounds.h;
        data.viewport.sample_to_chart.write(f32, 4);
        data.viewport.chart_to_sample.write(f32, 12);
        data.viewport.chart_to_ndc.write(f32, 20);
        i32[28] = __classPrivateFieldGet(this, _Chart_highlighted_sample_x, "f");
        i32[29] = __classPrivateFieldGet(this, _Chart_highlighted_dataset_idx, "f");
        gpu.device.queue.writeBuffer(gpu.view_buffer, 0, f32);
    }
    if (gpu.view_changed) {
        __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_update_grid).call(this);
        __classPrivateFieldGet(this, _Chart_instances, "m", _Chart_update_labels).call(this);
        gpu.view_changed = false;
    }
    {
        // line_data
        const pass_encoder = cmd_encoder.beginComputePass();
        pass_encoder.setPipeline(gpu.samples_to_lines_pipeline);
        pass_encoder.setBindGroup(1, gpu.view_bind_group);
        const n = Math.ceil(data.viewport.chart_bounds.w / kWorkgroupSize);
        for (const dataset of __classPrivateFieldGet(this, _Chart_data, "f").datasets) {
            pass_encoder.setBindGroup(0, dataset.samples_to_lines_bind_group);
            pass_encoder.dispatchWorkgroups(n);
        }
        pass_encoder.setPipeline(gpu.process_lines_pipeline);
        for (const dataset of __classPrivateFieldGet(this, _Chart_data, "f").datasets) {
            pass_encoder.setBindGroup(0, dataset.process_lines_bind_group);
            pass_encoder.dispatchWorkgroups(n);
        }
        pass_encoder.end();
    }
    {
        // Draw
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
        pass_encoder.setBindGroup(1, gpu.view_bind_group);
        {
            // Grid
            pass_encoder.setPipeline(gpu.draw_grid_pipeline);
            pass_encoder.setBindGroup(0, gpu.draw_grid_bind_group);
            pass_encoder.draw(4, 1, 0, 0);
        }
        {
            // Lines
            pass_encoder.setPipeline(gpu.draw_line_pipeline);
            for (const dataset of __classPrivateFieldGet(this, _Chart_data, "f").datasets) {
                pass_encoder.setBindGroup(0, dataset.draw_line_bind_group);
                pass_encoder.draw(kLineSegments * 2, 1, 0, 0);
            }
        }
        {
            // Points
            pass_encoder.setPipeline(gpu.draw_points_pipeline);
            pass_encoder.setBindGroup(1, gpu.view_bind_group);
            const sample_x_from = clamp(Math.ceil(data.viewport.canvas_to_sample.mul_x(__classPrivateFieldGet(this, _Chart_data, "f").viewport.chart_bounds.l)), 0, __classPrivateFieldGet(this, _Chart_data, "f").x_values.length);
            const sample_x_to = clamp(Math.floor(data.viewport.canvas_to_sample.mul_x(__classPrivateFieldGet(this, _Chart_data, "f").viewport.chart_bounds.r)), 0, __classPrivateFieldGet(this, _Chart_data, "f").x_values.length);
            if (sample_x_from < sample_x_to) {
                const count = sample_x_to - sample_x_from;
                for (const dataset of __classPrivateFieldGet(this, _Chart_data, "f").datasets) {
                    pass_encoder.setBindGroup(0, dataset.draw_points_bind_group);
                    pass_encoder.draw(count * 6, 1, sample_x_from * 6);
                }
            }
        }
        const zoom_rect = data.zoom_rect;
        if (zoom_rect !== undefined) {
            // Zoom rect
            const data = new Float32Array(8);
            data[0] = zoom_rect.l;
            data[1] = zoom_rect.b;
            data[2] = zoom_rect.r - zoom_rect.l;
            data[3] = zoom_rect.t - zoom_rect.b;
            data[4] = 0.2;
            data[5] = 0.2;
            data[6] = 0.2;
            data[7] = 0.5;
            gpu.device.queue.writeBuffer(gpu.draw_rect_buffer, 0, data);
            pass_encoder.setPipeline(gpu.draw_rect_pipeline);
            pass_encoder.setBindGroup(0, gpu.draw_rect_bind_group);
            pass_encoder.setBindGroup(1, gpu.view_bind_group);
            pass_encoder.draw(6, 1);
        }
        pass_encoder.end();
    }
    gpu.device.queue.submit([cmd_encoder.finish()]);
    return gpu.device.queue.onSubmittedWorkDone();
}, _Chart_quantize = function _Chart_quantize(value) {
    const multiple = Math.pow(10, Math.ceil(Math.log10(value)) - 1) * 0.5;
    return round_up(value, multiple);
};
_Chart_adapter = { value: null };
//# sourceMappingURL=chart.js.map