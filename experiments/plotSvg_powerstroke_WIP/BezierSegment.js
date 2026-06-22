
//============================================================
// Constants used for Gaussian Quadrature BezierSegment
const NglNodes = 10; 
const glNodes = [
  0.013046735741414,
  0.067468316655507,
  0.160295215850488,
  0.283302302935376,
  0.425562830509184,
  0.574437169490816,
  0.716697697064624,
  0.839704784149512,
  0.932531683344492,
  0.986953264258586,
];
const glWeights = [
  0.033335672154344,
  0.074725674575290,
  0.109543181257991,
  0.134633359654998,
  0.147762112357376,
  0.147762112357376,
  0.134633359654998,
  0.109543181257991,
  0.074725674575290,
  0.033335672154344,
];

//======================================================
class BezierSegment {
  // A set of control points for a cubic Bezier curve, 
  // plus assorted math utilities for computing e.g. 
  // arcLength(t), t(arcLength), etc. 
  
  constructor(ctrlPoints) {
    this.points = ctrlPoints;
    this.len = this.getArcLength();
    this.lut = this.buildArcLengthLUT(64);
  }

  draw() {
    const P0 = this.points[0];
    const P1 = this.points[1];
    const P2 = this.points[2];
    const P3 = this.points[3];
    beginShape();
    vertex(P0[0], P0[1]);
    bezierVertex(P1[0], P1[1], P2[0], P2[1], P3[0], P3[1]);
    endShape();
  }

  drawEndpoints() {
    const P0 = this.points[0];
    const P3 = this.points[3];
    circle(P0[0], P0[1], 9);
    circle(P3[0], P3[1], 9);
  }
  
  getNormal(t) {
    // normalized; left-hand normal
    const d = fcbezier.qprime(this.points, t);
    const dmagInv = 1/Math.hypot(d[0], d[1]);
    return [-d[1] * dmagInv, d[0] * dmagInv]; 
  }
  
  getArcLength() {
    // Arc Length with 10-point Gaussian Quadrature
    let length = 0;
    const points = this.points;
    for (let i = 0; i < NglNodes; i++) {
      const d = fcbezier.qprime(points, glNodes[i]);
      length += glWeights[i] * Math.hypot(d[0], d[1]);
    }
    return length;
  }

  buildArcLengthLUT(steps = 64) {
    const lut = [];
    let total = 0;
    let cumulative = [0]; // stores cumulative arc lengths
    const points = this.points;
    const stepsInv = 1/steps;

    for (let i = 1; i <= steps; i++) {
      const t0 = (i - 1)  * stepsInv;
      const t1 = i * stepsInv;
      const dt = t1 - t0;
      
      let segLen = 0;
      for (let j = 0; j < NglNodes; j++) {
        const t = t0 + glNodes[j] * dt;
        const d = fcbezier.qprime(points, t);
        segLen += glWeights[j] * Math.hypot(d[0], d[1]);
      }
      segLen *= dt;
      total += segLen;
      cumulative.push(total);
    }

    // Normalize and build LUT
    return cumulative.map((s, i) => ({
      t: i * stepsInv,
      s: s / total,
    }));
  }

  // --- Lookup: Given s in [0,1], find t such that arcLen(t) ≈ s ---
  getTForS(s) {
    if (s <= 0) return 0;
    if (s >= 1) return 1;

    const lut = this.lut;
    let lo = 0, hi = lut.length - 1;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (lut[mid].s < s) lo = mid;
      else hi = mid;
    }
    const a = lut[lo], b = lut[hi];
    const alph = (s - a.s) / (b.s - a.s);
    return a.t + alph * (b.t - a.t);
  }
  
  eval(t) {
    return fcbezier.q(this.points, t);
  }

  getPointAtS(s) {
    if (s <= 0) return fcbezier.q(this.points, 0); // this.eval(0);
    if (s >= 1) return fcbezier.q(this.points, 1); // this.eval(1);

    const lut = this.lut;
    let lo = 0, hi = lut.length - 1;

    // Binary search for s
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (lut[mid].s < s) lo = mid;
      else hi = mid;
    }

    // Linear interpolation of t
    const a = lut[lo], b = lut[hi];
    const alph = (s - a.s) / (b.s - a.s);
    const t = a.t + alph * (b.t - a.t);
    return fcbezier.q(this.points, t); // this.eval(t);
  }
}
