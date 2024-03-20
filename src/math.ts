export class Mat2x3 {
  // ╭     ╮
  // │ a d │
  // │ b e │
  // │ c f │
  // ╰     ╯
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;

  constructor(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  static offset(x: number, y: number) {
    return new Mat2x3(1, 0, x, 0, 1, y);
  }

  static scale(x: number, y: number) {
    return new Mat2x3(x, 0, 0, 0, y, 0);
  }

  static readonly zero: Mat2x3 = new Mat2x3(0, 0, 0, 0, 0, 0);

  offset(x: number, y: number) {
    return this.mul(Mat2x3.offset(x, y));
    // return new Mat2x3(this.a, this.b, this.c + x, this.d, this.e, this.f + y);
  }

  scale(x: number, y: number) {
    return this.mul(Mat2x3.scale(x, y));
    // return new Mat2x3(this.a * x, this.b * x, this.c * x, this.d * y, this.e * y, this.f * y);
  }

  mul_x(x: number) {
    return x * this.a + this.c;
  }

  mul_y(y: number) {
    return y * this.e + this.f;
  }

  mul(m: Mat2x3) {
    // ╭           ╮ ╭           ╮
    // │ n.a n.d 0 │ │ m.a m.d 0 │
    // │ n.b n.e 0 │ │ m.b m.e 0 │
    // │ n.c n.f 1 │ │ m.c m.f 1 │
    // ╰           ╯ ╰           ╯
    const n = this;
    return new Mat2x3(
      n.a * m.a + n.d * m.b,
      n.b * m.a + n.e * m.b,
      n.c * m.a + n.f * m.b + m.c,
      n.a * m.d + n.d * m.e,
      n.b * m.d + n.e * m.e,
      n.c * m.d + n.f * m.e + m.f
    );
  }

  write(arr: Float32Array, offset: number) {
    var i = offset;
    arr[i++] = this.a;
    arr[i++] = this.b;
    arr[i++] = this.c;
    arr[i++] = 0;
    arr[i++] = this.d;
    arr[i++] = this.e;
    arr[i++] = this.f;
    arr[i++] = 0;
  }
}

export class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  mul(m: Mat2x3) {
    return new Point(m.mul_x(this.x), m.mul_y(this.y));
  }
}
export function sub(a: Point, b: Point) {
  return new Point(a.x - b.x, a.y - b.y);
}

export function square_distance(a: Point, b: Point) {
  const diff = sub(a, b);
  return diff.x * diff.x + diff.y * diff.y;
}

export function lerp(f: number, low: number, high: number) {
  return low + (high - low) * f;
}

export function inv_lerp(f: number, low: number, high: number) {
  return (f - low) / (high - low);
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function remap(
  v: number,
  from_low: number,
  from_high: number,
  to_low: number,
  to_high: number
) {
  return lerp(inv_lerp(v, from_low, from_high), to_low, to_high);
}

export function round_up(value: number, multiple: number) {
  return Math.ceil(value / multiple) * multiple;
}

export function saturate(value: number) {
  return Math.max(Math.min(value, 1), 0);
}