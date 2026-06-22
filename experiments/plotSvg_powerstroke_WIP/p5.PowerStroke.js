// WORK-IN-PROGRESS
// p5.PowerStroke.js v.0.1
// Golan Levin, 2025
// A lightweight sidecar library for p5.plotSvg, 
// which allows the authoring of Inkscape PowerStroke paths in p5.js.
// Note: Requires p5.plotSvg.js to be loaded first.

// References: 
// https://gitlab.com/inkscape/inkscape/-/blob/master/src/live_effects/lpe-powerstroke.cpp?ref_type=heads
// https://gitlab.com/inkscape/inkscape/-/blob/master/src/live_effects/lpe-powerstroke-interpolators.h?ref_type=heads
// https://wiki.inkscape.org/wiki/PowerStroke implementation by Johan Engelen

// Note that the term "PowerStroke" is a type of path effect in Inkscape. 
// It does not refer to any of the following: 
// * Ford Power Stroke® Super Duty Engine
// * Remo PowerStroke Drumheads
// * PowerStroke Golf Swing Trainer
// * Techtronic Industries PowerStroke® high-pressure washers
// etc. 


// NOTES: 
// offsetPts contains an array of // [parametric position t, radius r] pairs. 
// HOWEVER, the parametric position t does NOT go from 0 to 1. 
// Instead, it goes from 0 to N, where N is the number of spine points.
// The expectation is that an offset point at t=5 is the offset for the 5th spine point.
// There may not be an offset point for every spine point. 
// It is also possible to have offset points at fractional t values. 
// For example, an offset point at t=2.5 would be the offset for the point halfway between spine points [2] and [3].


/* In all code below, refer to the following minimal example SVG for a PowerStroke path in Inkscape:
    <svg
        width="210mm"
        height="297mm"
        viewBox="0 0 210 297"
        xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
        xmlns="http://www.w3.org/2000/svg">
        
        <defs>
            <inkscape:path-effect
            effect="powerstroke"
            id="pe-1"
            is_visible="true"
            lpeversion="1.3"
            scale_width="1"
            interpolator_type="Linear"
            start_linecap_type="zerowidth"
            end_linecap_type="zerowidth"
            offset_points="0.0,20.0 | 0.60,3.0 | 0.90,10.0" />
        </defs>

        <g
            inkscape:label="p5.PowerStroke Layer"
            inkscape:groupmode="layer"
            id="layer1">
            <path
                style="fill:#000000;stroke:none;stroke-width:0;fill-opacity:0.25"
                d="M 50.00000,250.00000 66.64101,261.09400 112.49615,161.66410 148.32050,120.54700 
                    150.00000,100.00000 131.67950,109.45300 107.50385,158.33590 33.35899,238.90600 z"
                id="myPowerStroke1"
                inkscape:path-effect="#pe-1"
                inkscape:original-d="M 50.0,250.0 150.0,100.0" />
        </g>
    </svg>
*/


//----------------------------------------------------------------------

(function (global) {
  'use strict';
  
  // Ensure p5plotSvg is present
  if (typeof p5plotSvg === 'undefined') {
    console.warn("⚠️ p5.plotSvg.js is required for p5.PowerStroke to export to SVG.");
    return;
  }

  // === Constants ===
  const ENV_INTERP_LINEAR = 1; 
  const ENV_INTERP_BEZIER_JOHAN = 2; 
  let ENV_INTERP_MODE = ENV_INTERP_LINEAR;
  const SPINE_MODE_LINEAR = 0; 
  const SPINE_MODE_BEZIER = 1; 
  let SPINE_MODE = SPINE_MODE_LINEAR;
  const OFFSET_POINT_ADD_NULL = 0; // Mode has not been set yet.
  const OFFSET_POINT_ADD_SYNC = 1; // Add offset points at the same time as the spine is drawn
  const OFFSET_POINT_ADD_ASYNC = 2; // Add offset points at some other time
  

  // Export these to make them visible in sketch.js:
  global.ENV_INTERP_LINEAR = ENV_INTERP_LINEAR;
  global.ENV_INTERP_BEZIER_JOHAN = ENV_INTERP_BEZIER_JOHAN;
  global.ENV_INTERP_MODE = ENV_INTERP_MODE;
  global.SPINE_MODE_LINEAR = SPINE_MODE_LINEAR;
  global.SPINE_MODE_BEZIER = SPINE_MODE_BEZIER;
  global.SPINE_MODE = SPINE_MODE;
  global.OFFSET_POINT_ADD_NULL = OFFSET_POINT_ADD_NULL; // Mode has not been set yet.
  global.OFFSET_POINT_ADD_SYNC = OFFSET_POINT_ADD_SYNC; // Add offset points at the same time as the spine is drawn
  global.OFFSET_POINT_ADD_ASYNC = OFFSET_POINT_ADD_ASYNC; // Add offset points at some other time
  

  // These run exactly once, right when the script is loaded:
  // Ensure polylines are exported as paths for PowerStroke compatibility:
  p5plotSvg.setSvgExportPolylinesAsPaths(true);
  // Merge groups with the same name, so that all PowerStrokes are in a common layer:
  p5plotSvg.setSvgMergeNamedGroups(true);


  class PowerStroke {

    // We ensure that all PowerStroke's have unique IDs, for the SVG.
    static usedIds = new Set(); // To track all previously-used IDs
    static NF_PRECISION = 5;

    constructor(offsetPointAddingMode, id = null) {
      this.id = this.resolveId(id);

      // CORE data for the PowerStroke
      this.spinePts = []; // the raw polyline spine
      this.offsetPts = []; // specifying the half-width of the envelope
      this.shapedOffsetPts = []; // offsetPts, reshaped
      this.envelopePts = []; //envelopePts (storing the polygon)

      // Secondary data products computed from the polyline spine
      this.polylineApprox = [];
      this.cumulativePolylineLengths = [];
      this.totalPolylineLength = 0; 

      // Helper data that represents the computed envelope surrounding the spine. 
      this.radii = null;
      this._envelopeIsComputed = false;

      // Data used to represent the poly-bezier approximation of the spine.
      this.bezierSegments = []; 
      this.bezierSegmentLengths = []; 
      this.cumulativePolyBezierLengths = [0];
      this.totalPolyBezierLength = 0; 

      this.envInterpolatorType = "Linear"; // "Linear" or "CubicBezierJohan"
      this.interpolatorBeta = 0.25;
      this.powerStrokeWeight = 50.0; 
      
      // Parameters and data for shaping functions that (may) affect the offsetPoints.
      this.envEmphasis = 0; 
      this.envContrast = 0;
      this.envScale = 1; 
      this.envOffset = 0; 

      // Miscellaneous information about this PowerStroke
      this.spineMode = SPINE_MODE_LINEAR; 
      this.envelopeFillColor = { r:0, g:0, b:0, a:51 };
      this.drawingDistThresh = 0.5;
      this.fitCurveMaxError = 4; 

      if (offsetPointAddingMode === OFFSET_POINT_ADD_SYNC || 
          offsetPointAddingMode === OFFSET_POINT_ADD_ASYNC) {
        this.offsetPointAddMode = offsetPointAddingMode;
      } else {
        this.offsetPointAddMode = OFFSET_POINT_ADD_NULL; 
        console.warn(`[PowerStroke] Invalid offset point adding mode: ${offsetPointAddingMode}`);
      }
    }

    clear(){ this.init(); }
    init() {
      this.spinePts = [];
      this.offsetPts = [];
      this.shapedOffsetPts = [];
      this.envelopePts = [];

      this.polylineApprox = [];
      this.cumulativePolylineLengths = [];
      this.totalPolylineLength = 0; 
      
      this.radii = null;
      this.bezierSegments = []; 
      this.bezierSegmentLengths = [];
      this.cumulativePolyBezierLengths = [0];
      this.totalPolyBezierLength = 0; 
      
      this._envelopeIsComputed = false;
    }

    //--------------------------------------------------
    /**
     * @public
     * Add a point to the spine of the PowerStroke.
     * @param {*} px 
     * @param {*} py 
     */
    // REVISED
    addSpinePt(x, y) {
      // Store the new point if it's further than thresh away from prev.
      this._envelopeIsComputed = false;
      const N = this.spinePts.length;
      if (N === 0) {
        // Push the first point
        this.spinePts.push([x, y]);
        this.cumulativePolylineLengths.push(0);
        this.totalPolylineLength = 0; 
      } else {
        // Points already exist
        let pp = this.spinePts[N - 1];
        let dx = x - pp[0];
        let dy = y - pp[1];
        let moved = sqrt(dx * dx + dy * dy);
        if (moved > this.drawingDistThresh) {
          this.spinePts.push([x, y]);
          let nClens = this.cumulativePolylineLengths.length;
          let clen = this.cumulativePolylineLengths[nClens - 1];
          this.totalPolylineLength = clen + moved;
          this.cumulativePolylineLengths.push(this.totalPolylineLength);
        }
      }
    }

    addSpineAndOffsetPt(px, py, pr) {
      // Add a point to the spine and an offset point at the same time.
      // Exclusively for when offsetPointAddMode is OFFSET_POINT_ADD_SYNC.
      if (this.offsetPointAddMode == OFFSET_POINT_ADD_SYNC){
        this._envelopeIsComputed = false;
        const N = this.spinePts.length;

        if (N === 0) {
          // Push the first point
          this.spinePts.push([px, py]);
          this.cumulativePolylineLengths.push(0);
          this.totalPolylineLength = 0;
          pr = constrain(pr, 0, 1);
          this.offsetPts.push([0, pr]);

        } else {
          let pp = this.spinePts[N - 1];
          let dx = px - pp[0];
          let dy = py - pp[1];
          let moved = Math.sqrt(dx*dx + dy*dy);
          if (moved > this.drawingDistThresh) {

            this.spinePts.push([px, py]);
            this.offsetPts.push([N, pr]);

            let nClens = this.cumulativePolylineLengths.length;
            let clen = this.cumulativePolylineLengths[nClens - 1];
            this.totalPolylineLength = clen + moved;
            this.cumulativePolylineLengths.push(this.totalPolylineLength);
          }
        }

        // Copy the offset points to the shapedOffsetPts. They'll need to be shaped later.
        this.shapedOffsetPts = [];
        this.shapedOffsetPts = this.offsetPts.map(([t, r]) => [t, r]);
      } else {
        console.warn(`[PowerStroke] Cannot add spine and offset point together in mode ${this.offsetPointAddMode}.`);
      }
    }


    //--------------------------------------------------
    /**
     * @public
     * Add an offset point to the PowerStroke.
     * This point defines the envelope half-width at a given parametric position `t`.
     * @param {*} paramT 
     * @param {*} paramR 
     */
    // REVISED
    addOffsetPt(paramT, paramR) {
      // t in [0, N] is the parametric index, up to the number of spine points.
      // r is the offset from centerline, or envelope half-width at t.
      // r is in [0, 1] because it will be used to govern Z-height.
      const t = constrain(paramT, 0, this.spinePts.length - 1);
      const r = constrain(paramR, 0, 1);

      // Check if a point with the same `t` already exists
      const index = this.offsetPts.findIndex(pt => pt[0] === t);
      const newOffsetPt = [t, r];
      if (index !== -1) {
        this.offsetPts[index] = newOffsetPt;
      } else {
        this.offsetPts.push(newOffsetPt);
      }
      
      // Sort the offsetPts array by increasing t
      this.offsetPts.sort((a, b) => a[0] - b[0]);
      this._envelopeIsComputed = false;
      
      // Copy the offset points to the shapedOffsetPts. They'll need to be shaped later.
      this.shapedOffsetPts = [];
      this.shapedOffsetPts = this.offsetPts.map(([t, r]) => [t, r]);
    }


    /**
     * @public
     * Add an offset point to the PowerStroke, normalized to the polyline length.
     * @param {*} paramT01 - A normalized parameter t in [0, 1] representing the position along the polyline.
     * @param {*} paramR - A normalized radius r in [0, 1]
     */
    addNormalizedOffsetPt(paramT01, paramR) {
      // Constrain input
      const t01 = constrain(paramT01, 0, 1);
      const r = constrain(paramR, 0, 1);

      // Convert t ∈ [0,1] → floating indexf ∈ [0, N-1]
      const indexf = this.getPolylineIndexAtPercent(t01);

      // Check if a point with the same t already exists (use a tolerance due to float comparisons)
      const EPSILON = 1e-6;
      const index = this.offsetPts.findIndex(pt => Math.abs(pt[0] - indexf) < EPSILON);

      const newOffsetPt = [indexf, r];
      if (index !== -1) {
        this.offsetPts[index] = newOffsetPt;
      } else {
        this.offsetPts.push(newOffsetPt);
      }

      // Sort and update
      this.offsetPts.sort((a, b) => a[0] - b[0]);
      this._envelopeIsComputed = false;
      this.shapedOffsetPts = this.offsetPts.map(([t, r]) => [t, r]);
    }


    /**
     * @public
     * Set the weight of the PowerStroke, which will be used to scale the offset points.
     * This is a multiplier for the envelope half-width. It's used for visualizing the PowerStroke.
     * @param {*} mxth 
     */
    setPowerStrokeWeight(mxth){
      this.powerStrokeWeight = Math.max(mxth, 0.1);
    }

    //--------------------------------------------------
    setSpineMode(spim){
      // Set the mode for the spine: SPINE_MODE_LINEAR or SPINE_MODE_BEZIER
      if (spim === SPINE_MODE_LINEAR || spim === SPINE_MODE_BEZIER) {
        this.spineMode = spim;
      } else {
        console.warn(`[PowerStroke] Invalid spine mode: ${spim}`);
      }
    }

    /**
     * @public
     * Sets the type of interpolation for the PowerStroke's envelope.
     * Only accepts "Linear" or "Bezier" (case-sensitive).
     * @param {string} type - The interpolation type to use.
     */
    setEnvInterpolatorType(type) {
      if (type === 'Linear' || type === 'CubicBezierJohan') {
        this.envInterpolatorType = type;
      } else {
        console.warn(`[PowerStroke] Invalid interpolator type.`);
      }
    }

    setBezierInterpBeta(bib){
      this.interpolatorBeta = bib;
    }
    setFitCurveMaxError(fcme){
      this.fitCurveMaxError = fcme;
    }


    //--------------------------------------------------
    fitPolyBezierToPolyline(){
      // Fit a sequence of Bezier splines to this.spinePts
      
      // Use the `fitCurve` function from fit-curve.js,
      // https://github.com/soswow/fit-curve/blob/master/src/fit-curve.js
      const bezierCtrlPtsArr = fitCurve(this.spinePts, this.fitCurveMaxError);
      if (bezierCtrlPtsArr && (bezierCtrlPtsArr.length > 0)){
        
        // Construct the array of Bezier Segments
        this.bezierSegments = []; 
        for (let i = 0; i < bezierCtrlPtsArr.length; i++) {
          const BS = new BezierSegment(bezierCtrlPtsArr[i]);
          this.bezierSegments.push(BS);
        }
        
        // Compute this.bezierSegmentLengths and this.cumulativePolyBezierLengths
        this.bezierSegmentLengths = [];
        this.bezierSegmentLengths = this.bezierSegments.map(seg => seg.getArcLength());
        this.totalPolyBezierLength = this.bezierSegmentLengths.reduce((a, b) => a + b, 0);

        // Cumulative length array for fast lookup
        this.cumulativePolyBezierLengths = [0];
        for (let i = 0; i < this.bezierSegmentLengths.length; i++) {
          const cuml = this.cumulativePolyBezierLengths[i] + this.bezierSegmentLengths[i];
          this.cumulativePolyBezierLengths.push(cuml);
        }
      }
    }

    //--------------------------------------------------
    // Stores the PowerStroke radii (i.e. envelope half-widths) at dense samples along the spine.
    // This is used to compute the envelope polygon.
    // The radii are computed based on the offset points and the interpolation type.
    // Uses one of the Envelope smoothing types: Linear or BezierJohan. 
    // Computed values are [0..1] as functions of t in [0..1].
    computeRadii(stepLen = 3){
      let bProceed = (this.spinePts.length > 0);
      if (bProceed && (this.spineMode == SPINE_MODE_BEZIER)){
        bProceed = bProceed && (this.bezierSegments.length > 0);
        this.fitPolyBezierToPolyline();  // Bezier fitting happens here!
      }
      
      if (bProceed){ 
        const totalLen = (this.spineMode == SPINE_MODE_LINEAR) ? 
              this.totalPolylineLength:
              this.totalPolyBezierLength;
        const nSamples = max(2, int(totalLen / stepLen)); 
        const nSamplesm1inv = 1.0/(nSamples-1); 
        
        this.radii = null;
        this.radii = new Float32Array(nSamples);
        const radii = this.radii;
  
        if (this.envInterpolatorType === 'Linear'){
            const getRLin = this.getStrokeRadiusAtPercentLinear.bind(this); 
            for (let i = 0; i < nSamples; i++) {
              const t = i * nSamplesm1inv;
              radii[i] = getRLin(t);
            }
        } else if (this.envInterpolatorType === 'CubicBezierJohan'){
          const getRBez = this.getStrokeRadiusAtPercentBezierJohan.bind(this);
          for (let i = 0; i < nSamples; i++) {
            const t = i * nSamplesm1inv;
            radii[i] = getRBez(t); 
          }
        }
      }
    }

    updateShapedOffsetPoints(){
      for (let i=0; i<this.shapedOffsetPts.length; i++){
        let rawR = this.offsetPts[i][1];
        let newR = this.shapeValue(rawR); 
        this.shapedOffsetPts[i][1] = newR;
      }
    }
    setEnvEmphasis(e){
      this.envEmphasis = constrain(e, -1,1);
      this.updateShapedOffsetPoints(); 
    }
    setEnvContrast(c){
      this.envContrast = constrain(c, -1,1);
      this.updateShapedOffsetPoints(); 
    }
    setEnvScale(s){
      this.envScale = constrain(s, 0,2);
      this.updateShapedOffsetPoints(); 
    }
    setEnvOffset(o){
      this.envOffset = constrain(o, -1,1);
      this.updateShapedOffsetPoints(); 
    }
    setShapingParams(e, c, s, o){
      // Set all shaping parameters at once.
      let prevE = this.envEmphasis;
      let prevC = this.envContrast;
      let prevS = this.envScale;
      let prevO = this.envOffset;

      if ((e != prevE) || (c != prevC) ||
          (s != prevS) || (o != prevO)) {
        // If any of the parameters have changed, update them.
        // Update the parameters, clamping them to their valid ranges.
        this.envEmphasis = constrain(e, -1,1);
        this.envContrast = constrain(c, -1,1);
        this.envScale = constrain(s, 0,2);
        this.envOffset = constrain(o, -1,1);
        this.updateShapedOffsetPoints();
      } 
    }
    shapeValue(r){
      const e = map(this.envEmphasis,-1,1, 0,1); 
      const c = this.envContrast;
      const s = this.envScale; 
      const o = this.envOffset;
      const thr = 0.01;
      let bDoClamp = false; 
      
      if (Math.abs(e - 0.5) > thr){
        r = this.exponentialEmphasis(r, e);
      }
      if (true){ //Math.abs(c) > thr){
        if (c < 0){
          r = this.exponentialDecontrast(r, 0-c);
        } else if (c > 0){
          r = this.exponentialContrast(r, c);
        }
      }
      if (Math.abs(s - 1.0) > thr){
        bDoClamp = true; 
        r = r*s;
      }
      if (Math.abs(o) > thr){
        bDoClamp = true; 
        r = r+o; 
      }
      if (bDoClamp){
        r = constrain(r, 0,1); 
      }
      return r; 
    }

    exponentialContrast (x, a){
      const eps = 0.00001;
      const min_param_a = 0.0 + eps;
      const max_param_a = 1.0 - eps;
      a = constrain(a, min_param_a, max_param_a); 
      a = 1-a;

      let y = 0;
      if (x<=0.5){
        y = (Math.pow(2.0*x, 1.0/a))/2.0;
      } 
      else {
        y = 1.0 - (Math.pow(2.0*(1.0-x), 1.0/a))/2.0;
      }
      return y;
    }

    exponentialDecontrast ( x, a){
      const eps = 0.00001;
      const min_param_a = 0.0 + eps;
      const max_param_a = 1.0 - eps;
      a = constrain(a, min_param_a, max_param_a); 

      let y = 0;
      if (x<=0.5){
        y = (pow(2.0*x, 1-a))/2.0;
      } 
      else {
        y = 1.0 - (pow(2.0*(1.0-x), 1-a))/2.0;
      }
      return y;
    }
  
    exponentialEmphasis (x, a){
      const eps = 0.00001;
      const min_param_a = 0.0 + eps;
      const max_param_a = 1.0 - eps;
      a = constrain(a, min_param_a, max_param_a); 

      if (a < 0.5){
        // emphasis
        a = 2*(a);
        const y = Math.pow(x, a);
        return y;
      } else {
        // de-emphasis
        a = 2*(a-0.5);
        const y = Math.pow(x, 1.0/(1-a));
        return y;
      }
      return 0; 
    }

    //----------------------------------------------------------------------
    /**
     * @private
     * Computes the envelope polygon for the PowerStroke.
     * This method generates the points that define the boundary of the PowerStroke path,
     * based on the spine points and offset points.
     * The computed envelope points are stored in `this.envelopePts`.
     * This method should be called before drawing the PowerStroke or exporting it to SVG.
     */
    computeEnvelope(){
      this.envelopePts = [];
      this._envelopeIsComputed = false; 
        
      let bProceed = (this.spinePts.length > 0);
      if (this.spineMode == SPINE_MODE_BEZIER){
        bProceed = bProceed && (this.bezierSegments.length > 0); }
      if (bProceed){ 
        if (this.radii == null){
          this.computeRadii();
        }
          
        const getPandN = (this.spineMode == SPINE_MODE_LINEAR)? 
              this.getPolylinePointAndNormalAtPercent.bind(this): 
              this.getPointAndNormalAtS.bind(this);
          
        const radii = this.radii;
        const maxTh = this.powerStrokeWeight;
        const nSamples = radii.length; 
        const nSamplesm1inv = 1.0/(nSamples-1);
          
        let leftSideX = [];
        let leftSideY = [];
        let rightSideX = [];
        let rightSideY = [];
        for (let i = 0; i < nSamples; i++) {
          const t = i*nSamplesm1inv;
          const { point: p, normal: n } = getPandN(t);
          const r = radii[i] * maxTh;
          leftSideX.push(p[0] + r * n[0]);
          leftSideY.push(p[1] + r * n[1]);
          rightSideX.push(p[0] - r * n[0]); 
          rightSideY.push(p[1] - r * n[1]);
        }
          
        // Store envelope polygon
        for (let i=0; i<leftSideX.length; i++){
          const ptx = leftSideX[i];
          const pty = leftSideY[i];
          this.envelopePts.push([ptx, pty]);
        }
        for (let i = rightSideX.length-1; i >= 0; i--) {
          const ptx = rightSideX[i];
          const pty = rightSideY[i];
          this.envelopePts.push([ptx, pty]);
        }
        this._envelopeIsComputed = true;
      }
    }

  
    //=======================================================================
    getStrokeRadiusAtPercentLinear(t) {
      // Returns linearly interpolated stroke radius at percent t ∈ [0, 1]
      // Works with both LINEAR and BEZIER spine modes.
      // Recreation of Inkscape Powerstroke INTERP_LINEAR. 
      // Linear refers to the linear interpolation of the offset points, at the dense samples.
      // t is in [0, 1] and represents the parametric position along the spine.

      t = max(0, min(1, t));
      const osp = this.shapedOffsetPts;
      if (t === 0) return osp[0][1];
      if (t === 1) return osp[osp.length - 1][1];

      let indexf = 0; 
      if (this.spineMode === SPINE_MODE_BEZIER) {
        const targetBezierLen = t * this.totalPolyBezierLength;
        const polylinePct = targetBezierLen / this.totalPolyBezierLength;
        indexf = this.getPolylineIndexAtPercent(polylinePct);
      } else {
        indexf = this.getPolylineIndexAtPercent(t);
      }
      return this.getPolylineRadiusAtIndex(indexf);
    }

    //--------------------------------------------------
    getPolylineRadiusAtIndex(indexf) {
      // Assumes this.shapedOffsetPts is an array of [t, r] pairs,
      // where t ranges from 0 to N-1 (same range as indexf)
      const points = this.shapedOffsetPts;
      const n = points.length;

      if (n === 0) return 0;  // No radius data
      if (n === 1) return points[0][1]; // Single radius value

      // Clamp indexf to valid range
      const t = max(0, min(this.spinePts.length - 1, indexf));

      // If t is outside the shapedOffsetPts domain, return edge values
      if (t <= points[0][0]) return points[0][1];
      if (t >= points[n - 1][0]) return points[n - 1][1];

      // Find the two shapedOffsetPts that bracket t
      for (let i = 0; i < n - 1; i++) {
        const [t0, r0] = points[i];
        const [t1, r1] = points[i + 1];

        if (t >= t0 && t <= t1) {
          const alpha = (t - t0) / (t1 - t0);  // interpolation weight
          return r0 + (r1 - r0) * alpha;       // linear interpolation
        }
      }
      // Should never reach here if input is valid and sorted
      console.warn("⚠️ getPolylineRadiusAtIndex: t not bracketed.");
      return 0;
    }

    //--------------------------------------------------
    getPolylineLengthAtPercent(t) {
      // Returns the arc length at parametric percentage t in [0,1]
      // POLYLINE VERSION, uses this.spinePts and this.cumulativePolylineLengths

      const lengths = this.cumulativePolylineLengths;
      const n = lengths.length;

      if (n === 0) return 0;
      if (n === 1) return lengths[0];
      t = max(0, min(1, t));

      const totalLength = this.totalPolylineLength;
      const targetLength = t * totalLength;

      // Binary search for the segment in which targetLength lies
      let lo = 0;
      let hi = n - 1;

      while (lo < hi - 1) {
        const mid = floor((lo + hi) / 2);
        if (lengths[mid] < targetLength) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      // Interpolate between lengths[lo] and lengths[hi]
      const len1 = lengths[lo];
      const len2 = lengths[hi];
      const segLen = len2 - len1;
      let segT = 0;
      if (segLen > 0) {
        segT = (targetLength - len1) / segLen;
      }

      // Return the actual arc length at that interpolated location
      return len1 + segT * segLen;
    }

    //--------------------------------------------------
    getStrokeRadiusAtPercentBezierJohan(t) {
      const osp = this.shapedOffsetPts;
      const nosp = osp.length;
      if (this.spinePts.length < 2 || !osp || nosp === 0) return 0;
      t = constrain(t, 0, 1);

      const beta = this.interpolatorBeta;
      if (beta <= 0.01) return this.getStrokeRadiusAtPercentLinear(t);

      const Bez = this.Bez.bind(this);
      const solveBezForT = this.solveBezForT.bind(this);

      const getLenAtIndex = (this.spineMode === SPINE_MODE_BEZIER)
        ? this.getBezierLengthAtIndex.bind(this)
        : this.getPolylineLengthAtIndex.bind(this);

      const totalLen = (this.spineMode === SPINE_MODE_BEZIER)
        ? this.totalPolyBezierLength
        : this.totalPolylineLength;

      for (let i = 1; i < nosp; i++) {
        const p0 = osp[i - 1];
        const p3 = osp[i];
        const t0 = getLenAtIndex(p0[0]) / totalLen;
        const t3 = getLenAtIndex(p3[0]) / totalLen;

        if (t >= t0 && t <= t3) {
          const beta_d30_0 = (t3 - t0) * beta;
          const p1 = [t0 + beta_d30_0, p0[1]];
          const p2 = [t3 - beta_d30_0, p3[1]];
          const t1 = Bez(t0, p1[0], p2[0], t3, beta);
          const t2 = Bez(t0, p1[0], p2[0], t3, 1 - beta);
          const newT = solveBezForT(t, t0, t1, t2, t3);
          return Bez(p0[1], p1[1], p2[1], p3[1], newT);
        }
      }
      return 0; // Fallback
    }

    
    Bez(y0, y1, y2, y3, t) {
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      return mt2 * mt * y0 +
            3 * mt2 * t * y1 +
            3 * mt * t2 * y2 +
            t2 * t * y3;
    }

    getBezierLengthAtIndex(indexf) {
      const N = this.spinePts.length;
      if (N < 2) return 0;
      if (indexf <= 0) return 0;
      if (indexf >= N - 1) return this.totalPolyBezierLength;

      // 1. Get true polyline length at fractional indexf (accurate, not assuming uniformity)
      const targetPolylineLen = this.getPolylineLengthAtIndex(indexf);

      // 2. Compute proportion of total polyline length
      const polylinePct = targetPolylineLen / this.totalPolylineLength;

      // 3. Return matching length along Bezier spine
      return polylinePct * this.totalPolyBezierLength;
    }

    solveBezForT(yTarget, y0, y1, y2, y3, tolerance = 0.001, maxIter = 8) {
      // Bisection solver for monotonic Bézier
      // NOTE: safety removed; this fails if yTarget falls outside the range.
      let t0 = 0;
      let t1 = 1;
      let iter = 0;
      const Bez = this.Bez.bind(this);
      const y0_eval = Bez(y0, y1, y2, y3, t0); 
      const sign0 = Math.sign(y0_eval - yTarget);

      while (iter < maxIter) {
        const tm = 0.5 * (t0 + t1);
        const ym = Bez(y0, y1, y2, y3, tm);
        const err = ym - yTarget;
        if (Math.abs(err) < tolerance) {
          return tm;
        }
        const signM = Math.sign(err);
        if (signM === sign0) {
          t0 = tm;
        } else {
          t1 = tm;
        }
        iter++;
      }
      return 0.5 * (t0 + t1);  // best guess
    }

    resamplePolylineFromBezierAndReindexOffsetPts(stepLen = 3) {
      // Resample the polyline from the Bezier segments and reindex offsetPts accordingly.
      // Destructively clobbers this.spinePts and this.offsetPts.
      if (this.spineMode !== SPINE_MODE_BEZIER) {
        console.warn(`[PowerStroke] Cannot resample polyline from Bezier segments in SPINE_MODE_LINEAR.`);
        return;
      }
      if (this.bezierSegments.length === 0) {
        return;
      }

      // STEP 1: Save a copy of offsetPts as arc-length percentages [t ∈ 0..1] in offsetPtsT01
      const offsetPtsT01 = [];
      const osp = this.offsetPts;
      this.recalculatePolylineLengths(); // ensure spinePts is current
      for (let i = 0; i < osp.length; i++) {
        const indexf = osp[i][0];
        const radius = osp[i][1];
        const lenAtIndex = this.getPolylineLengthAtIndex(indexf);
        const pct = lenAtIndex / this.totalPolylineLength;
        offsetPtsT01.push([pct, radius]);
      }

      // STEP 2: Resample the polyline from the Bezier segments
      this.fitPolyBezierToPolyline(); // ensure bezierSegments is current
      this.polylineApprox = [];
      const nSamples = max(2, int(this.totalPolyBezierLength / stepLen));
      const nSamplesm1inv = 1.0/(nSamples-1); 

      for (let i = 0; i < nSamples; i++) {
        const t = i * nSamplesm1inv;
        const point = this.getPointAndNormalAtS(t).point;
        this.polylineApprox.push(point);
      }
      // Update the spinePts with the new polyline approximation
      this.spinePts = this.polylineApprox.slice(); // shallow copy

      // STEP 3: Reproject offsetPtsT01 to floating indexf in the updated spinePts
      this.recalculatePolylineLengths();
      const newOffsetPts = [];
      for (let i = 0; i < offsetPtsT01.length; i++) {
        const pct = offsetPtsT01[i][0];
        const radius = offsetPtsT01[i][1];
        const len = pct * this.totalPolylineLength;
        const indexf = this.getPolylineIndexAtLength(len);
        newOffsetPts.push([indexf, radius]);
      }

      // STEP 4: Reindex offsetPts based on the new polyline approximation
      this.offsetPts = newOffsetPts;
      this.shapedOffsetPts = []; 
      this.shapedOffsetPts = this.offsetPts.map(p => [p[0], this.shapeValue(p[1])]);
    }

    //--------------------------------------------------
    recalculatePolylineLengths(){
      // POLYLINE VERSION, uses this.spinePts
      this.cumulativePolylineLengths = [];
      this.totalPolylineLength = 0; 
      const nPoints = this.spinePts.length;
      if (nPoints <= 1) return;
      
      let tpl = 0; 
      const points = this.spinePts;
      const cumulativeLengths = this.cumulativePolylineLengths;
      cumulativeLengths.push(tpl); 
      for (let i=1; i<nPoints; i++){
        const p = points[i-1];
        const q = points[i  ];
        const dx = q[0] - p[0];
        const dy = q[1] - p[1];
        tpl += sqrt(dx * dx + dy * dy); 
        cumulativeLengths.push(tpl); 
      }
      this.totalPolylineLength = tpl; 
    }

    //--------------------------------------------------
    getPolylineLengthAtIndex(findex) {
      // POLYLINE VERSION, uses this.points
      const nSpinePts = this.spinePts.length;
      if (nSpinePts < 2) {
        return 0;
      } else if (findex < 0) {
        return 0;
      } else if (findex >= (nSpinePts - 1)) {
        return this.totalPolylineLength;
      }

      let i1 = floor(findex);
      let i2 = min(i1 + 1, nSpinePts - 1);
      let t = findex - i1;
      return lerp(this.cumulativePolylineLengths[i1], 
                  this.cumulativePolylineLengths[i2], t);
  }
  
    //--------------------------------------------------
    getPolylineIndexAtLength(len) {
      // POLYLINE VERSION, uses this.spinePts
      // returns index, with fractional component
      const perim = this.totalPolylineLength;

      if (this.spinePts.length < 2) {
        return 0;
      } else if (len < 0) {
        return 0;
      } else if (len >= perim) {
        return (this.spinePts.length - 1);
      }

      let out = 0;
      const cumLens = this.cumulativePolylineLengths;
      const lastLength = cumLens.length - 1;

      for (let i = 0; i < lastLength; i++) {
        const lengthLo = cumLens[i];
        const lengthHi = cumLens[i+1];
        if (len >= lengthLo && len < lengthHi) {
          const t = (len - lengthLo) / (lengthHi - lengthLo);
          out = i + t;
          break;
        }
      }
      return out;
    }
  
    //-------------------------------------------------- 
    getPolylinePointAtIndex(findex) {
      // POLYLINE VERSION, uses this.spinePts
      const points = this.spinePts;
      const nPoints = points.length;
      const nPointsm1 = nPoints - 1; 

      if (nPoints === 0) {
        return [0,0];
      } else if (nPoints === 1) {
        return points[0];
      } else if (findex >= nPointsm1) {
        return points[nPointsm1];
      } else if (findex <= 0) {
        return points[0];
      }

      const i1 = floor(findex);
      const i2 = min(i1 + 1, nPointsm1);
      const t = findex - i1;
      const p1 = points[i1];
      const p2 = points[i2];
      const px = p1[0] + (p2[0] - p1[0]) * t; // lerp
      const py = p1[1] + (p2[1] - p1[1]) * t;
      return [px,py];
    }
    
    //--------------------------------------------------
    getPolylinePointAtLength(len) {
      // POLYLINE VERSION, uses this.spinePts
      const nPoints = this.spinePts.length;
      const nLengths = this.cumulativePolylineLengths.length;
      if (nPoints <= 0) {
        return [0, 0];
      } else if (nPoints === 1) {
        return this.spinePts[0];
      } else if (len > this.cumulativePolylineLengths[nLengths-1]) {
        return this.spinePts[nPoints - 1];
      }
      const pil = this.getPolylineIndexAtLength(len);
      return this.getPolylinePointAtIndex(pil);
    }
    
    //--------------------------------------------------
    getPolylineIndexAtPercent(pct) {
      // POLYLINE VERSION, uses this.spinePts
      let pctPerimeter = pct * this.totalPolylineLength;
      return this.getPolylineIndexAtLength(pctPerimeter);
    }
  
    //--------------------------------------------------
    getPolylinePointAndNormalAtPercent(pct) {
      // POLYLINE VERSION, uses this.spinePts and this.cumulativePolylineLengths
      const points = this.spinePts;
      const lengths = this.cumulativePolylineLengths;
      const nPoints = points.length;

      if (nPoints === 0) {
        return { point: [0, 0], normal: [0, 0] };
      } else if (nPoints === 1) {
        return { point: points[0], normal: [0, 0] };
      }

      // Clamp and convert percent to arc length
      pct = max(0, min(1, pct));
      const targetLen = pct * this.totalPolylineLength;

      // --- Binary search to find which segment `len` falls into
      let lo = 0;
      let hi = lengths.length - 1;
      while (lo < hi - 1) {
        const mid = floor((lo + hi) / 2);
        if (lengths[mid] < targetLen) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      const i1 = lo;
      const i2 = min(i1 + 1, nPoints - 1);
      const p1 = points[i1];
      const p2 = points[i2];
      const segLen = lengths[i2] - lengths[i1];
      let t = 0;
      if (segLen > 0) {
        t = (targetLen - lengths[i1]) / segLen;
      }

      // Linear interpolation for point
      const px = p1[0] + (p2[0] - p1[0]) * t;
      const py = p1[1] + (p2[1] - p1[1]) * t;

      // Normal from segment direction
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const len = Math.hypot(dx, dy);
      let nx = 0, ny = 0;
      if (len !== 0) {
        nx = -dy / len;
        ny =  dx / len;
      }

      return { point:[px, py], normal:[nx, ny] };
    }
  
    //--------------------------------------------------
    getPolylinePointAtPercent(pct) {
      // POLYLINE VERSION, uses this.spinePts
      const tlen = this.totalPolylineLength;
      return this.getPolylinePointAtLength(pct * tlen);
    }
    
    //--------------------------------------------------
    getPolylineNormalAtPercent(pct){
      // POLYLINE VERSION, uses this.spinePts
      const nPoints = this.spinePts.length;
      if (nPoints <=1){
        return [0, 0];
      }
      pct = max(0, min(1, pct)); 
      const findex = this.getPolylineIndexAtPercent(pct);
      let i1 = floor(findex);
      let i2 = min(i1 + 1, this.spinePts.length - 1);
      if (pct === 1) i1 = max(0, i2-1); 
      const p1 = this.spinePts[i1]; 
      const p2 = this.spinePts[i2];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const len = Math.hypot(dx, dy);
      if (len === 0){
        return [0, 0]; 
      }
      const nx = -dy / len;
      const ny =  dx / len;
      return [nx, ny]; 
    }

    //--------------------------------------------------
    // s in [0, 1] → point [x, y] along full Stroke
    getPointAtS(s) {
      const bezSegs = this.bezierSegments;
      if (s <= 0) return bezSegs[0].getPointAtS(0);
      if (s >= 1) return bezSegs.at(-1).getPointAtS(1);
      
      const cumBezLens = this.cumulativePolyBezierLengths;
      const target = s * this.totalPolyBezierLength;

      // Binary search over cumulative array
      let lo = 0, hi = bezSegs.length;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (cumBezLens[mid] < target) lo = mid;
        else hi = mid;
      }

      // localS is distance into segment, divided by segment length
      const seg = bezSegs[lo];
      const segStart = cumBezLens[lo];
      const segLength = this.bezierSegmentLengths[lo];
      const localS = (target - segStart) / segLength;
      return seg.getPointAtS(localS);
    }

    // Get point and normal at s in [0,1]
    getPointAndNormalAtS(s) {
      const bezSegs = this.bezierSegments;
      if (s <= 0)
        return {
          point: bezSegs[0].getPointAtS(0),
          normal: bezSegs[0].getNormal(0),
        };
      if (s >= 1)
        return {
          point: bezSegs.at(-1).getPointAtS(1),
          normal: bezSegs.at(-1).getNormal(1),
        };

      const target = s * this.totalPolyBezierLength;
      let lo = 0, hi = bezSegs.length;
      const cumLens = this.cumulativePolyBezierLengths;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (cumLens[mid] < target) lo = mid;
        else hi = mid;
      }

      const seg = bezSegs[lo];
      const segStart = cumLens[lo];
      const segLength = this.bezierSegmentLengths[lo];
      const localS = (target - segStart) / segLength;
      const segT = seg.getTForS(localS);
      return {
        point: seg.getPointAtS(localS),
        normal: seg.getNormal(segT),
      };
    }
  

    //======================================================
    filterSpine(){
      // NOTE: Destructive; clobbers this.spinePts and this.offsetPts!
      //
      // STEP 1: Save offsetPts as arc-length percentages [t ∈ 0..1]
      const offsetPtsT01 = [];
      const osp = this.offsetPts;
      this.recalculatePolylineLengths(); // ensure spinePts is current
      for (let i = 0; i < osp.length; i++) {
        const indexf = osp[i][0];
        const radius = osp[i][1];
        const lenAtIndex = this.getPolylineLengthAtIndex(indexf);
        const pct = lenAtIndex / this.totalPolylineLength;
        offsetPtsT01.push([pct, radius]);
      }

      // STEP 2: Modify spinePts destructively
      // 2A. Compute Visvalingam-Whyatt approximation
      this.polylineApprox = [];
      this.polylineApprox = this.approxPolylineVW(this.spinePts, 8.0);
      this.spinePts = this.polylineApprox.map(p => [p[0], p[1]]);

      // 2B. Subsample segments that are too long. 
      this.recalculatePolylineLengths(); 
      const regularizedPts = this.regularizePolylineBySubdividingLongSegments(
        this.spinePts, this.cumulativePolylineLengths, 5);
      this.spinePts = regularizedPts.map(p => [p[0], p[1]]);

      // 2C. Apply a bilateral smoothing filter.
      this.spinePts = this.getPolylineBilateralSmooth(
        this.spinePts, {
          spatialSigma:3.0, 
          angleSigma:radians(90), 
          windowSize:3}); 
      
      // STEP 3: Reproject offsetPtsT01 to floating indexf in updated spinePts
      this.recalculatePolylineLengths();
      const newOffsetPts = [];
      for (let i = 0; i < offsetPtsT01.length; i++) {
        const pct = offsetPtsT01[i][0];
        const radius = offsetPtsT01[i][1];
        const len = pct * this.totalPolylineLength;
        const indexf = this.getPolylineIndexAtLength(len);
        newOffsetPts.push([indexf, radius]);
      }

      // STEP 4: Save
      this.offsetPts = newOffsetPts;
      this.shapedOffsetPts = []; 
      this.shapedOffsetPts = this.offsetPts.map(p => [p[0], this.shapeValue(p[1])]);
    }



  
    //--------------------------------------------------
    regularizePolylineBySubdividingLongSegments(
      points, cumulativeLengths, tooLongFactor = 10) {
        
      const pointsRegularized = [];
      const n = points.length;
      if (n < 2) return points.slice(); // nothing to do

      const segmentLengths = [];
      for (let i = 1; i < n; i++) {
        segmentLengths.push(cumulativeLengths[i] - cumulativeLengths[i - 1]);
      }

      // Compute median segment length
      const sorted = segmentLengths.slice().sort((a, b) => a - b);
      const medianLen = sorted[Math.floor(sorted.length / 2)];
      const tooLongThreshold = tooLongFactor * medianLen;
    
      // Helper: linear interpolation between two points
      function lerpPt(p1, p2, t) {
        return [
          p1[0] + (p2[0] - p1[0]) * t,
          p1[1] + (p2[1] - p1[1]) * t
        ];
      }

      for (let i = 0; i < n - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const segLen = segmentLengths[i];
        const redivideFactor = medianLen * 4;

        pointsRegularized.push(p0); // always include the first point
        if (segLen > tooLongThreshold) {
          const nSubdivisions = max(1, Math.ceil(segLen / redivideFactor));
          for (let j = 1; j < nSubdivisions; j++) {
            const t = j / nSubdivisions;
            pointsRegularized.push(lerpPt(p0, p1, t));
          }
        }
      }

      pointsRegularized.push(points[n - 1]); // push the final point
      return pointsRegularized;
    }
  
    //--------------------------------------------------
    getPolylineBilateralSmooth(points, options = {}) {
      const N = points.length;
      if (N < 3) return points.slice(); // nothing to smooth

      // --- Parameters with sensible defaults ---
      const spatialSigma = options.spatialSigma || 4.0;
      const spatialSigma2 = spatialSigma * spatialSigma; // sq
      const angleSigma = options.angleSigma || 0.4;
      const angleSigma2 = angleSigma * angleSigma; // sq
      const windowSize = options.windowSize || 3;
      
      /*
      spatialSigma: how much influence neighboring 
      points have, based on distance in pixels.
      If two points are close together, they 
      influence each other strongly.
      If they're farther apart, they influence 
      each other less, falling off with a Gaussian.
      spatialSigma → low	    Only very close neighbors affect smoothing 
      spatialSigma → high	Smoothing looks across a wider region
      
      angleSigma: how much a neighbor is discounted 
      based on the sharpness of its local corner. 
      If a point lies on a sharp corner (large angle), 
      it gets less influence in the average.
      This helps preserve corners and avoid 
      smearing them. Units are radians. 
      angleSigma → low	Preserves corners 
      more aggressively (less smoothing)
      angleSigma → high	Blurs across sharp 
      features (more aggressive smoothing)
      
      windowSize: Determines the number of neighbors on each side 
      of the current point to consider. 
      Total window size is 2*windowSize + 1.
      */ 

      let result = [];
      const nm1 = N-1;

      for (let i = 0; i<nm1; i++) {
        const ix = points[i][0];
        const iy = points[i][1];
        
        let weightedX = 0;
        let weightedY = 0;
        let totalWeight = 0;

        const iLo = Math.max(0, i - windowSize);
        const iHi = Math.min(N - 1, i + windowSize);
        for (let j = iLo; j <= iHi; j++) {
          const jx = points[j][0];
          const jy = points[j][1];
          
          const dx = jx - ix;
          const dy = jy - iy;
          const spatialDist2 = dx * dx + dy * dy;
          const spatialWeight = Math.exp(-spatialDist2 / spatialSigma2);
          let angleWeight = 1.0;
          if ((j > 0) && (j < (N-1))) {
            let angle = this.turningAngle (points[j-1], points[j], points[j+1]);
            angleWeight = Math.exp(- (angle * angle) / angleSigma2);
          }

          const weight = spatialWeight * angleWeight;
          weightedX += weight * jx;
          weightedY += weight * jy;
          totalWeight += weight;
        }
        result.push([weightedX / totalWeight, weightedY / totalWeight]);
      }
      const lastx = points[N-1][0];
      const lasty = points[N-1][1];
      result.push([lastx,lasty]); 
      return result;
    }
  
    approxPolylineVW(polyline, epsilon) {
      // https://en.wikipedia.org/wiki/Visvalingam%E2%80%93Whyatt_algorithm
      if (polyline.length <= 2) return polyline;

      // Clone points and attach area info
      let pts = polyline.map((pt, i) => ({
        index: i,
        pt: pt.slice(), // copy
        area: Infinity, // endpoints get Infinity to prevent deletion
      }));

      // Compute initial areas
      for (let i = 1; i < pts.length - 1; i++) {
        pts[i].area = this.triangleArea(pts[i - 1].pt, pts[i].pt, pts[i + 1].pt);
      }

      // Iteratively remove smallest area points
      while (true) {
        let minArea = Infinity;
        let minIndex = -1;

        for (let i = 1; i < pts.length - 1; i++) {
          if (pts[i].area < minArea) {
            minArea = pts[i].area;
            minIndex = i;
          }
        }

        if (minArea > epsilon || minIndex === -1) break;

        // Remove the point with the smallest area
        pts.splice(minIndex, 1);

        // Recalculate neighboring areas
        if (minIndex - 1 > 0) {
          pts[minIndex - 1].area = this.triangleArea(
            pts[minIndex - 2]?.pt ?? pts[minIndex - 1].pt,
            pts[minIndex - 1].pt,
            pts[minIndex].pt
          );
        }

        if (minIndex < pts.length - 1) {
          pts[minIndex].area = this.triangleArea(
            pts[minIndex - 1].pt,
            pts[minIndex].pt,
            pts[minIndex + 1]?.pt ?? pts[minIndex].pt
          );
        }
      }

      return pts.map((p) => p.pt);
    }
  
    turningAngle(p0, p1, p2) {
      const v1x = p1[0] - p0[0];
      const v1y = p1[1] - p0[1];
      const v2x = p2[0] - p1[0];
      const v2y = p2[1] - p1[1];

      const dot = v1x * v2x + v1y * v2y;
      const mag1 = Math.hypot(v1x, v1y);
      const mag2 = Math.hypot(v2x, v2y);
      if (mag1 === 0 || mag2 === 0) return 0;
      let cosTheta = dot / (mag1 * mag2);
      cosTheta = Math.max(-1, Math.min(1, cosTheta)); // clamp for safety
      return Math.acos(cosTheta); // always stay positive
    }

    // Triangle area using the shoelace formula
    triangleArea(p1, p2, p3) {
      return Math.abs(
        (p1[0] * (p2[1] - p3[1]) +
          p2[0] * (p3[1] - p1[1]) +
          p3[0] * (p1[1] - p2[1])) /
          2
      );
    }
    //=======================================================================

    /**
     * @public
     * Prints a report of the current state of the PowerStroke, for debugging.
     */
    printReport() {
      // For debugging: print a report of the current state of the PowerStroke
      console.log(`PowerStroke Report (${this.id}):`);
      console.log(`  Spine Points: ${this.spinePts.length}`);
      console.log(`  Offset Points: ${this.offsetPts.length}`);
      console.log(`  Envelope Points: ${this.envelopePts.length}`);
    }


    /**
     * @public
     * Draws the PowerStroke for debugging purposes.
     * This method draws the spine points, offset points, and envelope polygon.
     * It can also emit the chosen features to the SVG file if `bEmitDebugViewToSvg` is true.
     * @param {boolean} bEmitDebugViewToSvg - IMPORTANT: Whether to emit the DEBUG VIEW to an SVG file.
     * NOTE THAT EMITTING THE DEBUGVIEW TO SVG IS NOT THE SAME THING AS SAVING THE POWERSTROKE TO SVG.
     * @param {boolean} bDrawEnvelope - Whether to draw the envelope polygon.
     * @param {boolean} bDrawEnvelopeSpans - Whether to draw the envelope spans.
     * @param {boolean} bDrawSpineLine - Whether to draw the spine line
     * @param {boolean} bDrawSpinePts - Whether to draw the spine points.
     * @param {boolean} bDrawShapedOffsetPts - Whether to draw the offset points.
     */
    drawDebugView (
      bEmitDebugViewToSvg,
      bDrawEnvelope = true,
      bDrawEnvelopeSpans = true,
      bDrawSpineLine = true,
      bDrawSpinePts = true, 
      bDrawShapedOffsetPts = true) {

      const debugId = "debug-" + this.id;

      // Safety checks
      if (!p5plotSvg){  
        // console.warn(`[PowerStroke] p5plotSvg is not initialized`);
      } else if (!Array.isArray(p5plotSvg._commands)) {
        // console.warn(`[PowerStroke] p5plotSvg._commands is not an array.`)
      } else if (bEmitDebugViewToSvg) {
        // Check if the debug group already exists in the SVG commands
        const bAlreadyExists = p5plotSvg._commands.some(c =>
          c.type === 'beginGroup' &&
          (
            c.gname === debugId || // If `gname` is set
            (Array.isArray(c.attributes) &&
              c.attributes.some(attr => attr.name === 'id' && attr.value === debugId))
          )
        );
        if (bAlreadyExists) {
          console.warn(`[PowerStroke] Debug PowerStroke with id "${debugId}" already exists; skipping.`);
          return;
        }
      }

      //--------------------
      // 'pausing' is our mechanism to prevent recording the debug view to the SVG file.
      const bWasRecording = p5plotSvg.isRecordingSVG();
      const bShouldPause = bWasRecording && !bEmitDebugViewToSvg;
      if (bShouldPause) p5plotSvg.pauseRecordSVG(true);

      p5plotSvg.beginSvgGroup("debug-powerstroke-layer"); 
      p5plotSvg.beginSvgGroup(debugId);

      // Stash the current colors, so we can restore it later.
      const currentStrokeColor = this.getCurrentColor('stroke'); 
      this.envelopeFillColor = this.getCurrentColor('fill'); 
      const sc = currentStrokeColor;
      const fc = this.envelopeFillColor;
      strokeWeight(0.5);

      //--------------------
      // Export the envelope as a filled polygon with black outline.
      if (bDrawEnvelope){
        stroke(0,0,0, 255);
        fill(fc.r,fc.g,fc.b,fc.a);
        p5plotSvg.beginSvgGroup(debugId + "-envelope");
        this.drawEnvelopeOutline();
        p5plotSvg.endSvgGroup();
      }
      // Export the envelope spans as a series of spanning lines
      if (bDrawEnvelopeSpans){
        noFill(); 
        stroke(sc.r,sc.g,sc.b,sc.a);
        p5plotSvg.beginSvgGroup(debugId + "-spans");
        this.drawEnvelopeSpans();
        p5plotSvg.endSvgGroup();
      }
  
      //--------------------
      // Export the spine as a line
      if (bDrawSpineLine){
        noFill();
        stroke(sc.r,sc.g,sc.b,sc.a);
        p5plotSvg.beginSvgGroup(debugId + "-spine-polyline");
        this.drawSpineLine();
        p5plotSvg.endSvgGroup();
        if (this.spineMode == SPINE_MODE_BEZIER){
          stroke(0,0,0, 255); 
          p5plotSvg.beginSvgGroup(debugId + "-spine-polybezier");
          this.drawPolyBezierSpine(); 
          p5plotSvg.endSvgGroup();
        }
      }
      // Export the spine points as a series of points.
      if (bDrawSpinePts) {
        noFill();
        stroke(sc.r,sc.g,sc.b,sc.a);
        p5plotSvg.beginSvgGroup(debugId + "-spine-pts");
        this.drawSpinePts();
        p5plotSvg.endSvgGroup();
      }

      //--------------------
      // Export the (shaped) offset points as a series of circles.
      if (bDrawShapedOffsetPts){
        noFill();
        stroke(sc.r,sc.g,sc.b,sc.a);
        p5plotSvg.beginSvgGroup(debugId + "-offset-pts");
        this.drawShapedOffsetPts();
        p5plotSvg.endSvgGroup();
      }

      //--------------------
      p5plotSvg.endSvgGroup();
      p5plotSvg.endSvgGroup();
      if (bShouldPause) p5plotSvg.pauseRecordSVG(false);
    }

    //----------------------------------------------------------------------


    /**
     * @private
     * Draws the spine points of the PowerStroke.
     * Meant to be called from `drawDebug()`.
     */
    drawSpineLine() {
      const spinePts = this.spinePts;
      if (spinePts.length > 0) {
        beginShape();
        for (let i = 0; i < spinePts.length; i++) {
          const px = spinePts[i][0];
          const py = spinePts[i][1];
          vertex(px, py);
        }
        endShape();
      }
    }

    drawSpinePts() {
      const spinePts = this.spinePts;
      if (spinePts.length > 0) {
        for (let i = 0; i < spinePts.length; i++) {
          const px = spinePts[i][0];
          const py = spinePts[i][1];
          circle(px, py, 2); 
        }
      }
    }

    drawPolyBezierSpine() {
      if(this.spineMode == SPINE_MODE_BEZIER){
        const segs = this.bezierSegments;
        const nSegs = segs.length;
        if (nSegs === 0) return;
        noFill(); 
        beginShape();
        let P0 = segs[0].points[0];
        vertex(P0[0], P0[1]);
        for (let i = 0; i < nSegs; i++) {
          const bsp = segs[i].points;
          const P1 = bsp[1];
          const P2 = bsp[2];
          const P3 = bsp[3];
          bezierVertex(P1[0],P1[1], P2[0],P2[1], P3[0],P3[1]);
        }
        endShape(); 
      }
    }


    /**
     * @private
     * Draws the offset points of the PowerStroke.
     * Meant to be called from `drawDebug()`.
     */
    
    /*
    drawOffsetPts() {
      // n.b.: -- Actually draws the shaped offset points
      let bProceed = (this.spinePts.length > 0);
      bProceed = bProceed && (this.shapedOffsetPts.length > 0);
      if (this.spineMode == SPINE_MODE_BEZIER){
        bProceed = bProceed && (this.bezierSegments.length > 0); }
      if (bProceed) {
        const getPandN = (this.spineMode == SPINE_MODE_LINEAR)? 
              this.getPolylinePointAndNormalAtPercent.bind(this): 
              this.getPointAndNormalAtS.bind(this);
          
        const maxTh = this.powerStrokeWeight; 
        for (let i=0; i<this.shapedOffsetPts.length; i++){
          const op = this.shapedOffsetPts[i]; 
          const t = op[0];
          const r = op[1] * maxTh; 
          const { point: p, normal: n } = getPandN(t);
          const ox = p[0] - r * n[0];
          const oy = p[1] - r * n[1];
          circle(ox, oy, 7); 
        }
      }
    }
      */


    drawShapedOffsetPts() {
      let bProceed = (this.spinePts.length > 0);
      bProceed = bProceed && (this.shapedOffsetPts.length > 0);
      if (this.spineMode == SPINE_MODE_BEZIER){
        bProceed = bProceed && (this.bezierSegments.length > 0); }
      if (bProceed) {
        const getPandN = (this.spineMode == SPINE_MODE_LINEAR)? 
              this.getPolylinePointAndNormalAtPercent.bind(this): 
              this.getPointAndNormalAtS.bind(this);
          
        const maxTh = this.powerStrokeWeight; 
        for (let i=0; i<this.shapedOffsetPts.length; i++){
          const op = this.shapedOffsetPts[i]; 
          const indexf = op[0]; // in [0, N-1]
          const lenAtIndex = this.getPolylineLengthAtIndex(indexf);
          const pct = lenAtIndex / this.totalPolylineLength;

          const r = op[1] * maxTh; 
          const { point: p, normal: n } = getPandN(pct);
          const ox = p[0] - r * n[0];
          const oy = p[1] - r * n[1];
          circle(ox, oy, 7); 
        }
      }
    }
    

    drawEnvelopeOutline(){
      // render the envelope around this.spinePts, from the radii 
      // pre-computed in computeRadii()
      let bProceed = (this.spinePts.length > 0);
      if (this.spineMode == SPINE_MODE_BEZIER){
        bProceed = bProceed && (this.bezierSegments.length > 0); }
      if (bProceed){ 
        if (this.radii == null){
          this.computeRadii();
        }
        if (this._envelopeIsComputed == false){
          this.computeEnvelope(); 
        }
        const pts = this.envelopePts;
        const nPts = pts.length;
        beginShape();
        for (let i=0; i<nPts; i++){
          const ptx = pts[i][0];
          const pty = pts[i][1];
          vertex(ptx, pty); 
        }
        endShape(CLOSE);
      }
    }

    drawEnvelopeSpans(){
      // render the envelope around this.spinePts, from the radii 
      // pre-computed in computeRadii()
      let bProceed = (this.spinePts.length > 0);
      if (this.spineMode == SPINE_MODE_BEZIER){
        bProceed = bProceed && (this.bezierSegments.length > 0); }
      if (bProceed){ 
        if (this.radii == null){
          this.computeRadii();
        }
        if (this._envelopeIsComputed == false){
          this.computeEnvelope(); 
        }
        const pts = this.envelopePts;
        const nPts = pts.length;
        const nSpans = nPts/2; 
        const nPtsm1 = nPts-1;
        for (let i=0; i<nSpans; i++){
          let P = pts[i];
          let Q = pts[nPtsm1-i];
          line(P[0],P[1], Q[0],Q[1]);
        }
      }
    }























    //----------------------------------------------------------------------


    /**
     * @private
     * Returns the current fill or stroke color as an RGBA object.
     */
    getCurrentColor(fillOrStroke) {
      if (fillOrStroke !== 'fill' && fillOrStroke !== 'stroke') {
        console.warn("[PowerStroke] Invalid argument for getCurrentColor; must be 'fill' or 'stroke'.");
        return { r: 0, g: 0, b: 0, a: 255 };
      }
      // Returns RGBA object of the current fill or stroke color.
      try {
        if (typeof drawingContext === 'undefined'){
          return { r: 0, g: 0, b: 0, a: 255 };
        }
        if (fillOrStroke === 'fill' && !drawingContext.fillStyle) { 
          return { r: 0, g: 0, b: 0, a: 255 };
        } else if (fillOrStroke === 'stroke' && !drawingContext.strokeStyle) {
          return { r: 0, g: 0, b: 0, a: 255 };
        }

        const style = (fillOrStroke === 'fill') ? drawingContext.fillStyle : drawingContext.strokeStyle;
        // If it's a hex string, parse as RGB
        if (typeof style === 'string' && style.startsWith('#')) {
          let hex = style.slice(1);
          if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
          }
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          return { r, g, b, a: 255 };
        }
        // If it's an rgb(...) or rgba(...) string
        const match = style.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
        if (match) {
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);
          const a = 255.0 * (match[4] !== undefined ? parseFloat(match[4]) : 1.0);
          return { r, g, b, a };
        }
        return { r: 0, g: 0, b: 0, a: 255 };
      } catch (e) {
        return { r: 0, g: 0, b: 0, a: 255 };
      }
    }


    /**
     * @private
     * Utility to converts RGB values to a hex color string.
     */
    rgbToHex(r, g, b) {
      return "#" + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    }

    //----------------------------------------------------------------------


    /**
     * @public
     * Adds the PowerStroke path to the current SVG recording.
     * This method constructs the SVG command object and injects it into the p5plotSvg._commands array.
     * It ensures that the SVG recording is active before adding the command.
     * @returns {void}
     */
    addToCurrentSvg() {

      // Ensure p5plotSvg is available
      if (typeof p5plotSvg === 'undefined') {
        console.warn("[PowerStroke] Cannot add to SVG: p5plotSvg is not defined.");
        return;
      }

      // Ensure p5plotSvg recording is active
      const bIsRecordingSVG = p5plotSvg.isRecordingSVG();
      if (!bIsRecordingSVG) {
        // console.warn(`[PowerStroke] Cannot add to SVG: beginRecordSVG() has not been called.`);
        return;
      }

      // Ensure the envelope is computed before generating the SVG command.
      if (!this._envelopeIsComputed) {
        this.computeEnvelope();
      }

      // Construct p5plotSvg command object and check for validity, 
      // including whether it has enough segments and attributes.
      this.envelopeFillColor = this.getCurrentColor('fill'); 
      const cmd = this.generatePlotSvgCommand();
      const isValid =
        cmd &&
        typeof cmd === 'object' &&
        cmd.type === 'path' &&
        Array.isArray(cmd.segments) &&
        cmd.segments.length > 1 &&
        Array.isArray(cmd.attributes) &&
        cmd.attributes.length > 0;

      if (!isValid) {
        console.warn("[PowerStroke] Invalid PowerStroke; not added.");
        return;
      }

      const styleAttrs = cmd.attributes.filter(a => a.name === 'style');
      if (styleAttrs.length > 1) {
        console.warn('[SVG] Multiple style attributes detected. This will break your SVG!');
      }

      // Ensure _commands array exists
      if (!Array.isArray(p5plotSvg._commands)) {
        console.warn("[PowerStroke] Cannot add command: p5plotSvg._commands is not initialized.");
        print("p5plotSvg._commands = " + p5plotSvg._commands)
        return;
      }

      // Prevent adding PowerStrokes with duplicate IDs
      const bAlreadyExists = p5plotSvg._commands.some(c =>
        Array.isArray(c.attributes) && c.attributes.some(attr => attr.name === 'id' && attr.value === this.id));
      if (bAlreadyExists) {
        console.warn(`[PowerStroke] PowerStroke with id "${this.id}" already exists; skipping.`);
        return;
      }

      // Inject command into _commands array:
      // Inject header attributes required for Inkscape:
      p5plotSvg.injectSvgHeaderAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape");
      p5plotSvg.injectSvgHeaderAttribute("inkscape:version", "1.4 (e7c3feb1, 2024-10-09)");

      // Add PowerStroke offset points to the SVG's <defs> element
      let def = this.generateInkscapePowerStrokeDef();
      p5plotSvg.injectSvgDef("inkscape:path-effect", def);

      // Add the PowerStroke's command to the p5plotSvg._commands array,
      // but first, surround it with a special (required) SVG group
      p5plotSvg.beginSvgGroup("powerstroke-layer", {
        "inkscape:label": "p5.PowerStroke Layer",
        "inkscape:groupmode": "layer"
      });
      p5plotSvg._commands.push(cmd);
      p5plotSvg.endSvgGroup();
    }


    /**
     * @private
     * Generates the p5.plotSvg command object for the PowerStroke path.
     * Used in `addToCurrentSvg()`.
     * @returns {object} - The SVG command object for the PowerStroke path.
     */
    generatePlotSvgCommand() {
      // Validate that there are enough envelope points
      if (!this.envelopePts || this.envelopePts.length < 2) {
        console.warn("[PowerStroke] Cannot generate SVG command: not enough envelope points.");
        return null;
      }
      let fc = this.envelopeFillColor;
      let envelopeStyle = `fill:${this.rgbToHex(fc.r, fc.g, fc.b)}; stroke:none; stroke-width:0; fill-opacity:${fc.a / 255}`;
      return {
        type: 'path',
        closed: true, /* for the envelope, not the spine! */
        segments: this.envelopePts.map(pt => ({ type: 'vertex', x: pt[0], y: pt[1] })),
        attributes: [
          { name: 'id', value: this.id },
          { name: 'style', value: envelopeStyle },
          { name: 'inkscape:path-effect', value: '#pe-' + this.id },
          { name: 'inkscape:original-d', value: this.generateOriginalD() }, /* the spine */
        ]
      };
    }

    //----------------------------------------------------------------------


    /**
     * @private
     * Creates the required Inkscape PowerStroke definition for the SVG <defs> section.
     * Used in `addToCurrentSvg()`.
     * @returns {object} - The Inkscape PowerStroke definition object.
     */
    generateInkscapePowerStrokeDef(){
      const def = {
        id: 'pe-' + this.id,
        effect: 'powerstroke',
        is_visible: 'true',
        lpeversion: '1.3',
        scale_width: this.powerStrokeWeight,
        interpolator_type: this.envInterpolatorType,
        start_linecap_type: 'zerowidth',
        end_linecap_type: 'zerowidth',
        linejoin_type: 'bevel',
        interpolator_beta: this.interpolatorBeta,
        offset_points: this.generateOffsetPointsAttr()
      };
      return def;
    }


    /**
     * @private
     * Generates the inkscape:original-d string data, representing the PowerStroke spine.
     * This is used for Inkscape's path effects to reconstruct the original stroke.
     * Used in `<g><path inkscape:original-d=`
     * @returns {string} - The SVG path data string for the original stroke.
     */
    generateOriginalD() {
      const PP = PowerStroke.NF_PRECISION;
      return 'M ' + this.spinePts.map(pt => `${nf(pt[0], 1,PP)},${nf(pt[1], 1,PP)}`).join(' ');
    }


    /**
     * @private
     * Generates the offset_points attribute string for Inkscape's path effect.
     * This string defines the offset points for the PowerStroke effect.
     * Used in `<defs><inkscape:path-effect offset_points=`
     * @returns {string} - The offset_points attribute string.
     */
    generateOffsetPointsAttr() {
      // generate string for InkScape's offset_points data
      if (this.offsetPts.length === 0) {
        console.warn(`[PowerStroke] No offset points defined for ${this.id}`);
        return "";
      }
      const PP = PowerStroke.NF_PRECISION;
      return this.offsetPts.map(pt => `${nf(pt[0], 1,PP)},${nf(pt[1], 1,PP)}`).join(' | ');
    }

    //----------------------------------------------------------------------


    resolveId(baseId) {
      if (typeof baseId === 'string' && baseId.length > 0) {
        let candidate = baseId;
        let counter = 1;
        while (PowerStroke.usedIds.has(candidate)) {
          candidate = `${baseId}-${counter}`;
          counter++;
        }
        PowerStroke.usedIds.add(candidate);
        return candidate;
      } else {
        return this.generateUniqueId();
      }
    }


    generateUniqueId() {
      let index = 0;
      let candidate = `powerstroke-${nf(index, 5)}`;
      while (PowerStroke.usedIds.has(candidate)) {
        index++;
        candidate = `powerstroke-${nf(index, 5)}`;
      }
      PowerStroke.usedIds.add(candidate);
      return candidate;
    }

    
    static resetIdTracking() {
      PowerStroke.usedIds.clear();
    }
  }

  //------------------------------------------------------------------------
  // Utilities to load and parse PowerStroke paths from SVG files.

  function loadPowerStrokesFromSvgFile(filePath) {
    return new Promise((resolve, reject) => {
      fetch(filePath)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load SVG file: ${response.statusText}`);
          }
          return response.text();
        })
        .then(svgText => {
          // Split the SVG text into lines for easier parsing
          const lines = svgText.split('\n').map(line => line.trim());
          // Parse the PowerStroke paths from the lines
          const powerStrokes = parsePowerStrokes(lines);
          resolve(powerStrokes);
        })
        .catch(error => {
          console.error(`Error loading PowerStroke paths from SVG file: ${error.message}`);
          reject(error);
        });
    });
  }

  /**
   * @public
   * Parses an array of lines from an SVG file and extracts PowerStroke paths.
   * @param {*} lines 
   * @returns 
   */
  function parsePowerStrokes(lines) {
    // lines is an array of strings from the SVG file
    let strokes = [];
    let effects = {};

    // First, collect all powerstroke effect definitions
    for (let line of lines) {
      if (line.includes('<inkscape:path-effect') && line.includes('effect="powerstroke"')) {
        let id = extractAttr(line, 'id');
        if (!id) continue;

        effects['#' + id] = {
          offsetPoints: parseOffsetPoints(extractAttr(line, 'offset_points')),
          scaleWidth: parseFloat(extractAttr(line, 'scale_width')),
          envInterpolatorType: extractAttr(line, 'interpolator_type')
        };
      }
    }

    // Now collect all <path> elements that use PowerStroke LPEs
    for (let line of lines) {
      if (!line.includes('<path')) continue;

      let id = extractAttr(line, 'id');
      let origD = extractAttr(line, 'inkscape:original-d');
      let lpeRef = extractAttr(line, 'inkscape:path-effect');

      // Skip if any required attribute is missing
      if (!id || !origD || !lpeRef) continue;
      if (!effects[lpeRef]) continue;  // no matching effect found

      let ps = new PowerStroke(OFFSET_POINT_ADD_ASYNC, id);
      ps.setPowerStrokeWeight(effects[lpeRef].scaleWidth);
      ps.setEnvInterpolatorType(effects[lpeRef].envInterpolatorType);

      let spinePts = parsePathToPoints(origD);
      for (let [x, y] of spinePts) {
        ps.addSpinePt(x, y);
      }

      for (let [t, r] of effects[lpeRef].offsetPoints) {
        ps.addOffsetPt(t, r);
      }

      strokes.push(ps);
    }

    return strokes;
  }

  /**
   * @private
   * Extracts the value of a specified attribute from a line of SVG.
   * @param {*} line 
   * @param {*} attrName 
   * @returns 
   */
  function extractAttr(line, attrName) {
    let match = line.match(new RegExp(attrName + '="([^"]+)"'));
    return match ? match[1] : null;
  }

  /**
   * @private
   * Parses the offset_points attribute string into an array of [t, r] pairs.
   * Each pair represents a parametric position `t` and the corresponding offset `r`.
   * @param {*} str 
   * @returns 
   */
  function parseOffsetPoints(str) {
    let result = [];
    let pairs = str.split('|');
    for (let i = 0; i < pairs.length; i++) {
      let pair = pairs[i].trim();            // e.g. "0.60000,0.15000"
      let parts = pair.split(',');           // e.g. ["0.60000", "0.15000"]
      let t = parseFloat(parts[0]);
      let r = parseFloat(parts[1]);
      result.push([t, r]);                   // store as [t, r] pair
    }
    return result;
  }

  /**
   * @private
   * Parses a path data string (d attribute) into an array of points.
   * This function extracts M and L commands and their coordinates.
   * @param {*} d - The path data string.
   * @returns {Array} - An array of [x, y] points.
   */
  function parsePathToPoints(d) {
    // Note: This is a simplified parser that assumes the path data is well-formed.
    // It only handles M (move to) and L (line to) commands, and does not handle curves or arcs.  
    let commands = d.match(/[ML][^MLZ]+/g);
    let pts = [];
    for (let cmd of commands) {
      let nums = cmd.slice(1).trim().split(/[ ,]+/).map(parseFloat);
      for (let i = 0; i < nums.length; i += 2) {
        pts.push([nums[i], nums[i+1]]);
      }
    }
    return pts;
  }


  //-------------------------------------------------------------------------
  // Expose globally
  global.PowerStroke = PowerStroke;
  global.loadPowerStrokesFromSvgFile = loadPowerStrokesFromSvgFile;

})(this);