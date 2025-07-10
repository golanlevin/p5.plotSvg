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

  // These run exactly once, right when the script is loaded:
  // Ensure polylines are exported as paths for PowerStroke compatibility:
  p5plotSvg.setSvgExportPolylinesAsPaths(true);
  // Merge groups with the same name, so that all PowerStrokes are in a common layer:
  p5plotSvg.setSvgMergeNamedGroups(true);


  class PowerStroke {

    // We ensure that all PowerStroke's have unique IDs, for the SVG.
    static usedIds = new Set(); // To track all previously-used IDs
    static NF_PRECISION = 5;

    constructor(id = null) {
      this.id = this.resolveId(id);
      this.spinePts = [];
      this.offsetPts = [];
      this.envelopePts = [];
      this.powerStrokeWeight = 20.0;
      this.interpolatorType = 'Linear'; // "Linear" or "Bezier"
      this.envelopeFillColor = { r:0, g:0, b:0, a:51 };
      this._envelopeIsComputed = false;
    }


    clear(){ this.init(); }
    init() {
      this.spinePts = [];
      this.offsetPts = [];
      this.envelopePts = [];
    }


    /**
     * @public
     * Add a point to the spine of the PowerStroke.
     * @param {*} px 
     * @param {*} py 
     */
    addSpinePt(px, py) {
      this.spinePts.push({ x:px, y:py });
      this._envelopeIsComputed = false;
    }


    /**
     * @public
     * Add an offset point to the PowerStroke.
     * This point defines the envelope half-width at a given parametric position `t`.
     * @param {*} paramT 
     * @param {*} paramR 
     */
    addOffsetPt(paramT, paramR) {
      // t in [0, 1] is the normalized parameter or parametric position.
      // r is the offset from centerline, or envelope half-width at t.
      // r is in [0, 1] because it will be used to govern Z-height.
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

      // Sort the offsetPts array by increasing t
      this.offsetPts.sort((a, b) => a.t - b.t);
      this._envelopeIsComputed = false;
    }


    /**
     * @public
     * Set the weight of the PowerStroke, which will be used to scale the offset points.
     * This is a multiplier for the envelope half-width. It's used for visualizing the PowerStroke.
     * @param {*} weight 
     */
    setPowerStrokeWeight(weight) {
      this.powerStrokeWeight = Math.max(weight, 0.1);
    }


    /**
     * @public
     * Sets the type of interpolation for the PowerStroke's envelope.
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
        this._envelopeIsComputed = true;
      }
    }


    /**
     * @private
     * Computes a point on the spine at a given parameter `t`, where `t` is in the range [0, 1].
     * This method assumes that the spine is defined by at least two points.
     * @param {Array} pts - The array of spine points.
     * @param {number} t - The parameter defining the position along the spine (0 to 1).
     * @returns {Object} - An object representing the point on the spine, with properties `x` and `y`.
     */
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


    /**
     * @private
     * Computes the normal vector at a given point on the spine, defined by the parameter `t`.
     * @param {Array} pts - The array of spine points.
     * @param {number} t - The parameter defining the position along the spine (0 to 1).
     * @returns {Object} - An object representing the normalized normal vector at the given point, 
     * with properties `x` and `y`.
     */
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

    //----------------------------------------------------------------------


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
     * @param {boolean} bDrawSpinePts - Whether to draw the spine points.
     * @param {boolean} bDrawOffsetPts - Whether to draw the offset points.
     * @param {boolean} bDrawEnvelope - Whether to draw the envelope polygon.
     * @param {boolean} bEmitDebugViewToSvg - Whether to emit the debug view to an SVG file.
     */
    drawDebug (bDrawSpinePts, bDrawOffsetPts, bDrawEnvelope, bEmitDebugViewToSvg=false) {
      if (!this._envelopeIsComputed) {
        this.computeEnvelope();
      }

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

      // Stash the current colors, so we can restore it later.
      let currentStrokeColor = this.getCurrentColor('stroke'); 
      this.envelopeFillColor = this.getCurrentColor('fill'); 

      p5plotSvg.beginSvgGroup("debug-powerstroke-layer"); 
      p5plotSvg.beginSvgGroup(debugId);
      
      if (bDrawEnvelope === true){
        noStroke();
        let fc = this.envelopeFillColor;
        fill(fc.r,fc.g,fc.b,fc.a); 
        this.drawEnvelope();
      }
      if (bDrawSpinePts === true){
        noFill();
        strokeWeight(1.0);
        let sc = currentStrokeColor;
        stroke(sc.r,sc.g,sc.b,sc.a); 
        this.drawSpinePts();
      }
      if (bDrawOffsetPts === true){
        p5plotSvg.beginSvgGroup(debugId + "-offsets");
        noFill();
        strokeWeight(0.5);
        let sc = currentStrokeColor;
        stroke(sc.r,sc.g,sc.b,sc.a); 
        this.drawOffsetPts();
        p5plotSvg.endSvgGroup();
      }
      
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


    /**
     * @private
     * Draws the offset points of the PowerStroke.
     * Meant to be called from `drawDebug()`.
     */
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


    /**
     * @private
     * Draws the envelope of the PowerStroke.
     * Meant to be called from `drawDebug()`.
     */
    drawEnvelope() {
      // draw width-envelope polygon.
      if (!this._envelopeIsComputed) {
        this.computeEnvelope();
      }
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
        segments: this.envelopePts.map(pt => ({ type: 'vertex', x: pt.x, y: pt.y })),
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
        interpolator_type: this.interpolatorType,
        start_linecap_type: 'zerowidth',
        end_linecap_type: 'zerowidth',
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
      const PP = PowerStroke.NF_PRECISION;
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
      let candidate = `powerstroke-${nf(index, 5)}`;
      while (PowerStroke.usedIds.has(candidate)) {
        index++;
        candidate = `powerstroke-${nf(index, 5)}`;
      }
      PowerStroke.usedIds.add(candidate);
      return candidate;
    }

    /*
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
    */

    
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
          interpolatorType: extractAttr(line, 'interpolator_type')
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

      let ps = new PowerStroke(id);
      ps.setPowerStrokeWeight(effects[lpeRef].scaleWidth);
      ps.setInterpolatorType(effects[lpeRef].interpolatorType);

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