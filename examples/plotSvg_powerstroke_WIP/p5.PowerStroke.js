// WORK-IN-PROGRESS
// p5.PowerStroke.js v.0.1
// Golan Levin, 2025
// A lightweight sidecar library for p5.plotSvg, 
// which allows the authoring of Inkscape PowerStroke paths in p5.js.
// Note: Requires p5.plotSvg.js to be loaded first.

// Reference: 
// https://gitlab.com/inkscape/inkscape/-/blob/master/src/live_effects/lpe-powerstroke.cpp?ref_type=heads
// https://gitlab.com/inkscape/inkscape/-/blob/master/src/live_effects/lpe-powerstroke-interpolators.h?ref_type=heads

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
            inkscape:label="MyPowerStrokeLayer"
            inkscape:groupmode="layer"
            id="layer1">
            <path
                style="fill:#000000;stroke:none;stroke-width:0;fill-opacity:0.5"
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
  
  // Ensure dependency is present
  if (typeof p5plotSvg === 'undefined') {
    console.warn("⚠️ p5.plotSvg.js is required for p5.PowerStroke to export to SVG.");
    return;
  }

  // These run exactly once, right when the script is loaded:
  // Ensure polylines are exported as paths for PowerStroke compatibility:
  p5plotSvg.setSvgExportPolylinesAsPaths(true);
  // Merge groups with the same name, so that all PowerStrokes are in a common layer:
  p5plotSvg.setSvgMergeNamedGroups(true);


  class PowerStroke {

    // We ensure that all PowerStroke's have unique IDs, for the SVG.
    static usedIds = new Set(); // To track all previously-used IDs
    static precision = 5;

    constructor(id = null) {
      this.id = this.resolveId(id);
      this.spinePts = [];
      this.offsetPts = [];
      this.envelopePts = [];
      this.powerStrokeWeight = 20.0;
      this.interpolatorType = 'Linear'; // "Linear" or "Bezier"
    }

    clear(){
      this.init();
    }

    init() {
      this.spinePts = [];
      this.offsetPts = [];
      this.envelopePts = [];
    }

    addSpinePt(px, py) {
      this.spinePts.push({ x:px, y:py });
    }

    addOffsetPt(paramT, paramR) {
      // t in [0, 1] is the normalized parameter or parametric position.
      // r is the offset from centerline, or envelope half-width at t.
      // r is in [0, 1] because it will be used to govern Z-height.

      // Clamp values to [0, 1]
      const t = constrain(paramT, 0, 1);
      const r = constrain(paramR, 0, 1);

      // Check if a point with the same `t` already exists
      const index = this.offsetPts.findIndex(pt => pt.t === t);
      const newOffsetPt = { t: t, r: r };
      if (index !== -1) {
        // Replace any prviously existing point
        this.offsetPts[index] = newOffsetPt;
      } else {
        this.offsetPts.push(newOffsetPt);
      }

      // Sort the array by increasing t
      this.offsetPts.sort((a, b) => a.t - b.t);
    }

    /**
     * Set the weight of the PowerStroke, which will be used to scale the offset points.
     * This is a multiplier for the envelope half-width. It's used for visualizing the PowerStroke.
     * @param {*} weight 
     */
    setPowerStrokeWeight(weight) {
      this.powerStrokeWeight = Math.max(weight, 0.1);
    }

    /**
     * Sets the type of interpolation for the PowerStroke.
     * Only accepts "Linear" or "Bezier" (case-sensitive).
     * @param {string} type - The interpolation type to use.
     */
    setInterpolatorType(type) {
      if (type === 'Linear' || type === 'Bezier') {
        this.interpolatorType = type;
      } else {
        console.warn(`[PowerStroke] Invalid interpolator type.`);
      }
    }

    computeEnvelope(){
      // Compute the polygon boundary for the path
      this.envelopePts = [];
      if (this.spinePts.length > 1 && this.offsetPts.length > 1) {
        this.envelopePts.push({ ...this.spinePts[0] }); // deep copy
        for (let i = 0; i < this.offsetPts.length; i++) {
          let t = this.offsetPts[i].t;
          let r = this.offsetPts[i].r;
          let tpt = this.getPointAtPercent(this.spinePts, t);
          let nv = this.getNormalAtPercent(this.spinePts, t);
          let px = tpt.x + nv.x * r * this.powerStrokeWeight;
          let py = tpt.y + nv.y * r * this.powerStrokeWeight;
          this.envelopePts.push({ x: px, y: py });
        }
        let lastPt = this.spinePts[this.spinePts.length - 1];
        this.envelopePts.push({ ...lastPt });
        for (let i = this.offsetPts.length - 1; i >= 0; i--) {
          let t = this.offsetPts[i].t;
          let r = this.offsetPts[i].r;
          let tpt = this.getPointAtPercent(this.spinePts, t);
          let nv = this.getNormalAtPercent(this.spinePts, t);
          let px = tpt.x - nv.x * r * this.powerStrokeWeight;
          let py = tpt.y - nv.y * r * this.powerStrokeWeight;
          this.envelopePts.push({ x: px, y: py });
        }
      }
    }

    getPointAtPercent(pts, t) {
      // replace this with a much more sophisticated polyline resampler.
      let x0 = pts[0].x;
      let x1 = pts[1].x;
      let y0 = pts[0].y;
      let y1 = pts[1].y;
      let px = lerp(x0, x1, t);
      let py = lerp(y0, y1, t);
      return { x: px, y: py };
    }

    getNormalAtPercent(pts, t) {
      // replace this with a much more sophisticated computation.
      let x0 = pts[0].x;
      let x1 = pts[1].x;
      let y0 = pts[0].y;
      let y1 = pts[1].y;
      let dx = x1 - x0;
      let dy = y1 - y0;
      let dh = sqrt(dx * dx + dy * dy);
      return { x: 0 - dy / dh, y: dx / dh };
    }

    printReport() {
      // For debugging: print a report of the current state of the PowerStroke
      console.log(`PowerStroke Report (${this.id}):`);
      console.log(`  Spine Points: ${this.spinePts.length}`);
      console.log(`  Offset Points: ${this.offsetPts.length}`);
      console.log(`  Envelope Points: ${this.envelopePts.length}`);
    }


    drawDebug (bDrawSpinePts, bDrawOffsetPts, bDrawEnvelope, bEmitDebugViewToSvg=false) {
      const debugId = "debug-" + this.id;

      if (!p5plotSvg || !Array.isArray(p5plotSvg._commands)) {
        ; // _commands not initialized
      } else if (bEmitDebugViewToSvg) {
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

      const bWasRecording = p5plotSvg.isRecordingSVG();
      const bShouldPause = bWasRecording && !bEmitDebugViewToSvg;
      if (bShouldPause) p5plotSvg.pauseRecordSVG(true);

      p5plotSvg.beginSvgGroup("debug-powerstroke-layer"); 
      p5plotSvg.beginSvgGroup(debugId);
      
      if (bDrawEnvelope === true){
        noStroke(); 
        fill(0,0,0, 60); 
        this.drawEnvelope();
      }
      if (bDrawSpinePts === true){
        noFill();
        stroke(0);
        strokeWeight(1);
        this.drawSpinePts();
      }
      if (bDrawOffsetPts === true){
        p5plotSvg.beginSvgGroup(debugId + "-offsets");
        noFill();
        stroke(0);
        strokeWeight(0.5);
        this.drawOffsetPts();
        p5plotSvg.endSvgGroup();
      }
      
      p5plotSvg.endSvgGroup();
      p5plotSvg.endSvgGroup();
      if (bShouldPause) p5plotSvg.pauseRecordSVG(false);
    }

    drawSpinePts() {
      if (this.spinePts.length > 0) {
        beginShape();
        for (let i = 0; i < this.spinePts.length; i++) {
          let px = this.spinePts[i].x;
          let py = this.spinePts[i].y;
          vertex(px, py);
        }
        endShape();
      }
    }

    drawOffsetPts() {
      if (this.spinePts.length > 0 && this.offsetPts.length > 0) {
        for (let i = 0; i < this.offsetPts.length; i++) {
          let t = this.offsetPts[i].t;
          let r = this.offsetPts[i].r;
          let tpt = this.getPointAtPercent(this.spinePts, t);
          let nv = this.getNormalAtPercent(this.spinePts, t);
          let ox = tpt.x + nv.x * r * this.powerStrokeWeight;
          let oy = tpt.y + nv.y * r * this.powerStrokeWeight;
          line(tpt.x, tpt.y, ox,oy); 
          circle(ox,oy, 2);
        }
      }
    }

    drawEnvelope() {
      // draw width-envelope polygon. Assumes that this.envelopePts is populated!
      if (this.envelopePts.length > 0) {
        beginShape();
        for (let i = 0; i < this.envelopePts.length; i++) {
          let px = this.envelopePts[i].x;
          let py = this.envelopePts[i].y;
          vertex(px, py);
        }
        endShape(CLOSE);
      }
    }


    /**
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

      // Construct p5plotSvg command object and check for validity, 
      // including whether it has enough segments and attributes.
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
      return {
        type: 'path',
        closed: true, /* for the envelope, not the spine! */
        segments: this.envelopePts.map(pt => ({ type: 'vertex', x: pt.x, y: pt.y })),
        attributes: [
          { name: 'id', value: this.id },
          { name: 'inkscape:path-effect', value: '#pe-' + this.id },
          { name: 'inkscape:original-d', value: this.generateOriginalD() }, /* the spine */
        ]
      };
    }

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
        interpolator_type: this.interpolatorType,
        start_linecap_type: 'zerowidth',
        end_linecap_type: 'zerowidth',
        offset_points: this.generateOffsetPointsAttr()
      };
      return def;
    }

    //----------------------------------------------------------------------

    /**
     * @private
     * Generates the inkscape:original-d string data, representing the PowerStroke spine.
     * This is used for Inkscape's path effects to reconstruct the original stroke.
     * Used in `<g><path inkscape:original-d=`
     * @returns {string} - The SVG path data string for the original stroke.
     */
    generateOriginalD() {
      const PP = PowerStroke.precision;
      return 'M ' + this.spinePts.map(pt => `${nf(pt.x, 1,PP)},${nf(pt.y, 1,PP)}`).join(' ');
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
      const PP = PowerStroke.precision;
      return this.offsetPts.map(pt => `${nf(pt.t, 1,PP)},${nf(pt.r, 1,PP)}`).join(' | ');
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
      let candidate;
      do {
        candidate = `powerstroke-${nf(index, 5)}`;
        index++;
      } while (PowerStroke.usedIds.has(candidate));
      PowerStroke.usedIds.add(candidate);
      return candidate;
    }

    static resetIdTracking() {
      PowerStroke.usedIds.clear();
    }
  }

  // Expose globally
  global.PowerStroke = PowerStroke;

})(this);