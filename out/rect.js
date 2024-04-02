import { Point } from './math.js';
class Rect {
    constructor(args) {
        this.t = args.t;
        this.r = args.r;
        this.b = args.b;
        this.l = args.l;
    }
    get w() {
        return Math.abs(this.r - this.l);
    }
    get h() {
        return Math.abs(this.t - this.b);
    }
    get lb() {
        return new Point(this.l, this.b);
    }
    get rt() {
        return new Point(this.r, this.t);
    }
    mul(m) {
        const lb = this.lb.mul(m);
        const rt = this.rt.mul(m);
        return new Rect({ l: lb.x, b: lb.y, r: rt.x, t: rt.y });
    }
    canonincalize() {
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
}
Rect.zero = new Rect({ t: 0, r: 0, b: 0, l: 0 });
export default Rect;
//# sourceMappingURL=rect.js.map