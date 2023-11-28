import { Mat2x3, Point } from './math.js';

export default class Rect {
  t: number;
  r: number;
  b: number;
  l: number;

  constructor(args: { t: number; r: number; b: number; l: number }) {
    this.t = args.t;
    this.r = args.r;
    this.b = args.b;
    this.l = args.l;
  }

  public get w(): number {
    return Math.abs(this.r - this.l);
  }

  public get h(): number {
    return Math.abs(this.t - this.b);
  }

  public get lb(): Point {
    return new Point(this.l, this.b);
  }

  public get rt(): Point {
    return new Point(this.r, this.t);
  }

  public mul(m: Mat2x3) {
    const lb = this.lb.mul(m);
    const rt = this.rt.mul(m);
    return new Rect({ l: lb.x, b: lb.y, r: rt.x, t: rt.y });
  }

  public canonincalize() {
    if (this.l > this.r) {
      const tmp = this.l;
      this.l = this.r;
      this.r = tmp;
    }
    if (this.b > this.t) {
      const tmp = this.b;
      this.b = this.t;
      this.t = tmp;
    }
  }

  static readonly zero: Rect = new Rect({ t: 0, r: 0, b: 0, l: 0 });
}
