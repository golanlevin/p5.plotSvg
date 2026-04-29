// p5.plotSvg: a Plotter-Oriented SVG Exporter for p5.js
// https://github.com/golanlevin/p5.plotSvg
// Initiated by Golan Levin (@golanlevin)
// v.0.2.0, April 28, 2026
// Known to work with p5.js versions 1.4.2–1.11.13
// "Mostly" supports p5.js version 2.2.2 as well.

(function(global) {
  // Create a namespace for the library
  const p5plotSvg = {};

  // Attach constants to the p5plotSvg namespace
  p5plotSvg.VERSION = "0.2.0";
  p5plotSvg.SVG_INDENT_NONE = 0;
  p5plotSvg.SVG_INDENT_SPACES = 1;
  p5plotSvg.SVG_INDENT_TABS = 2;
  p5plotSvg.SVG_UNITS_IN = 0;
  p5plotSvg.SVG_UNITS_CM = 1;

  const SVG_COMMAND = Object.freeze({
    ARC: 'arc',
    BEZIER: 'bezier',
    CIRCLE: 'circle',
    CURVE: 'curve',
    SPLINE: 'spline',
    ELLIPSE: 'ellipse',
    LINE: 'line',
    POINT: 'point',
    QUAD: 'quad',
    RECT: 'rect',
    TRIANGLE: 'triangle',
    POLYLINE: 'polyline',
    PATH: 'path',
    POINTS: 'points',
    LINES: 'lines',
    TRIANGLES: 'triangles',
    TRIANGLE_FAN: 'triangle_fan',
    TRIANGLE_STRIP: 'triangle_strip',
    QUADS: 'quads',
    QUAD_STRIP: 'quad_strip',
    DESCRIPTION: 'description',
    BEGIN_GROUP: 'beginGroup',
    END_GROUP: 'endGroup',
    PUSH: 'push',
    POP: 'pop',
    SCALE: 'scale',
    TRANSLATE: 'translate',
    ROTATE: 'rotate',
    SHEAR_X: 'shearx',
    SHEAR_Y: 'sheary',
    TEXT: 'text',
    STROKE: 'stroke'
  });

  const SVG_SEGMENT = Object.freeze({
    VERTEX: 'vertex',
    BEZIER: 'bezier',
    BEZIER_POINT: 'bezierPoint',
    QUADRATIC: 'quadratic',
    CURVE: 'curve',
    SPLINE: 'spline',
    CONTOUR_START: 'contourStart',
    CONTOUR_END: 'contourEnd'
  });

  Object.defineProperty(p5plotSvg, 'SVG_COMMAND', {
    value: SVG_COMMAND,
    enumerable: true
  });
  Object.defineProperty(p5plotSvg, 'SVG_SEGMENT', {
    value: SVG_SEGMENT,
    enumerable: true
  });


  // Internal configuration set using public API functions.
  const config = {
    flattenTransforms: false,
    exportPolylinesAsPaths: false,
    filename: "output.svg",
    coordPrecision: 4,
    transformPrecision: 6,
    indentType: p5plotSvg.SVG_INDENT_SPACES,
    indentAmount: 2,
    pointRadius: 0.25,
    dpi: 96,
    unitMode: p5plotSvg.SVG_UNITS_IN,
    width: 816,
    height: 1056,
    customSizeSet: false,
    defaultStrokeColor: 'black',
    backgroundColor: null,
    defaultStrokeWeight: 1,
    mergeNamedGroups: true,
    groupByStrokeColor: false,
    inkscapeCompatibility: true
  };

  const cssColorValidationCache = new Map();

  // Internal recording state. Override bookkeeping remains separate for now.
  const session = {
    commands: [],
    vertexStack: [], // Temp stack for polyline/polygon vertices
    groupStack: [],  // Stack for tracking open groups (for unclosed group detection)
    injectedHeaderAttributes: [], // Attributes to inject into the SVG header
    injectedDefs: [],
    pointsSetCount: 0,
    linesSetCount: 0,
    trianglesSetCount: 0,
    triangleFanSetCount: 0,
    triangleStripSetCount: 0,
    quadsSetCount: 0,
    quadStripSetCount: 0,
    transformsExist: false,
    recording: false,
    recordingBegun: false,
    recordingSessionId: 0,
    shapeMode: "simple",
    shapeKind: "poly",
    p5Instance: undefined,
    p5PixelDensity: 1,
    p5MajorVersion: 1,
    usingGlobalMode: false,
    curveTightness: 0.0,
    bezierOrder: 3, // p5.js v2 bezierVertex() point-stream order
    splineEndsMode: null, // p5.js v2 splineProperty('ends') value
    curveVertexCompatActive: false,
    curveVertexCompatPreviousEndsMode: undefined,
    layers: {
      inkscapeLayerMap: new Map(),   // Maps group names to layer numbers
      inkscapeUsedLabels: new Map(), // Tracks used label values for collision detection
      inkscapeNextLayerNumber: 1  // Counter for auto-incrementing
    },
    overrides: {
      restoreStack: [],
      originals: {
        arc: undefined,
        bezier: undefined,
        circle: undefined,
        curve: undefined,
        spline: undefined,
        ellipse: undefined,
        line: undefined,
        point: undefined,
        quad: undefined,
        rect: undefined,
        square: undefined,
        triangle: undefined,
        bezierDetail: undefined,
        curveTightness: undefined,
        bezierOrder: undefined,
        splineProperty: undefined,
        splineProperties: undefined,
        beginShape: undefined,
        vertex: undefined,
        bezierVertex: undefined,
        quadraticVertex: undefined,
        curveVertex: undefined,
        splineVertex: undefined,
        beginContour: undefined,
        endContour: undefined,
        endShape: undefined,
        describe: undefined,
        push: undefined,
        pop: undefined,
        scale: undefined,
        translate: undefined,
        rotate: undefined,
        shearX: undefined,
        shearY: undefined,
        text: undefined,
        stroke: undefined,
        colorMode: undefined,
        clip: undefined
      }
    }
  };

  // Warn-once state is intentionally module-level, not session-local.
  const warnings = {
    p5v2Shown: false,
    curveV2Shown: false,
    curveTightnessV2Shown: false,
    clipShown: false,
    incompleteBezierPointSegmentShown: false,
    mixedSplineSegmentShown: false,
    unsupportedPathSegmentShown: false,
    nonFiniteNumberShown: false
  };

  /**
   * @private
   * Resets per-recording Inkscape layer bookkeeping.
   * Layer labels and numeric prefixes are session state; they must not leak
   * between independent SVG exports.
   */
  function resetSessionLayers() {
    session.layers.inkscapeLayerMap = new Map();
    session.layers.inkscapeUsedLabels = new Map();
    session.layers.inkscapeNextLayerNumber = 1;
  }

  /**
   * @private
   * Overrides a function on a target object, handling p5.js v2's non-writable properties.
   * In p5.js v2, global functions are defined with writable:false, so simple assignment fails.
   * This helper uses Object.defineProperty when needed to ensure the override takes effect.
   * @param {object} target - The object to override the function on (e.g., window or session.p5Instance)
   * @param {string} funcName - The name of the function to override
   * @param {function} newFunc - The new function to use
   */
  function overrideFunction(target, funcName, newFunc) {
    if (!target) return;
    const globalTarget = getGlobalTarget();
    if (target === globalTarget && !session.usingGlobalMode) return;

    let restoreInfo = session.overrides.restoreStack.find(item =>
      item.target === target && item.funcName === funcName
    );
    if (!restoreInfo) {
      const hadOwnProperty = Object.prototype.hasOwnProperty.call(target, funcName);
      session.overrides.restoreStack.push({
        target,
        funcName,
        hadOwnProperty,
        descriptor: hadOwnProperty ? Object.getOwnPropertyDescriptor(target, funcName) : undefined
      });
    }

    const currentDescriptor = Object.getOwnPropertyDescriptor(target, funcName);
    Object.defineProperty(target, funcName, {
      value: newFunc,
      writable: true,
      configurable: true,
      enumerable: currentDescriptor ? currentDescriptor.enumerable : true
    });
  }


  /**
   * @private
   * Restores all p5 functions overridden during the current recording session.
   * Exact own-property descriptors are restored; temporary own properties are
   * deleted so inherited p5 instance methods remain inherited.
   */
  function restoreOverriddenFunctions() {
    for (let i = session.overrides.restoreStack.length - 1; i >= 0; i--) {
      const item = session.overrides.restoreStack[i];
      if (!item.target) continue;
      if (item.hadOwnProperty) {
        Object.defineProperty(item.target, item.funcName, item.descriptor);
      } else {
        delete item.target[item.funcName];
      }
    }
    session.overrides.restoreStack = [];
  }


  /**
   * @private
   * Returns the browser global object used by p5 global mode.
   */
  function getGlobalTarget() {
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof global !== 'undefined') return global;
    return undefined;
  }


  /**
   * @private
   * Escapes text for use inside XML element content.
   */
  function escapeXmlText(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }


  /**
   * @private
   * Escapes text for use inside double-quoted XML attribute values.
   */
  function escapeXmlAttribute(value) {
    return escapeXmlText(value)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }


  /**
   * @private
   * XML tag and attribute names cannot be escaped into validity; reject unsafe
   * names instead of emitting malformed SVG.
   */
  function normalizeXmlName(name, context) {
    const trimmedName = String(name).trim();
    if (/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(trimmedName)) {
      return trimmedName;
    }
    console.warn(`p5.plotSvg: Ignoring invalid ${context} "${trimmedName}".`);
    return null;
  }


  /**
   * @private
   * Serializes an array of { name, value } pairs into escaped SVG attributes.
   */
  function attrsToString(attrs, context, options = {}) {
    if (!Array.isArray(attrs)) return '';

    let str = '';
    for (let attr of attrs) {
      if (!attr || typeof attr.name === 'undefined') continue;
      if (options.skip && options.skip(attr)) continue;

      const attrName = normalizeXmlName(attr.name, context);
      if (!attrName) continue;

      if (options.onAttr) {
        options.onAttr(attr, attrName);
      }
      str += `${options.trailingSpace ? '' : ' '}${attrName}="${escapeXmlAttribute(attr.value)}"${options.trailingSpace ? ' ' : ''}`;
    }
    return str;
  }


  /**
   * @private
   * Returns the p5.js version without requiring a global p5 symbol.
   */
  function getP5Version(p5Instance = session.p5Instance) {
    if (p5Instance?.constructor?.VERSION) {
      return p5Instance.constructor.VERSION;
    }
    if (typeof p5 !== 'undefined' && p5.VERSION) {
      return p5.VERSION;
    }
    return '1.0.0';
  }


  /**
   * @private
   * Retrieves an original p5 function from the active instance, falling back to
   * global mode if needed. Instance mode does not always define window aliases.
   */
  function getOriginalFunction(funcName) {
    const globalTarget = getGlobalTarget();
    if (session.usingGlobalMode && globalTarget && typeof globalTarget[funcName] === 'function') {
      return globalTarget[funcName];
    }
    if (session.p5Instance && typeof session.p5Instance[funcName] === 'function') {
      return session.p5Instance[funcName];
    }
    if (globalTarget && typeof globalTarget[funcName] === 'function') {
      return globalTarget[funcName];
    }
    return undefined;
  }


  /**
   * @private
   * Calls p5's original implementation without recording p5 internals. This is
   * important in p5.js v2, where some public APIs delegate through shape APIs
   * that p5.plotSvg also overrides.
   */
  function callOriginalFunction(originalFunc, thisArg, args) {
    if (typeof originalFunc !== 'function') return undefined;
    const wasRecording = session.recording;
    session.recording = false;
    try {
      return originalFunc.apply(thisArg, args);
    } finally {
      session.recording = wasRecording;
    }
  }


  /**
   * @private
   * Checks for WEBGL rendering without assuming WebGLRenderingContext exists.
   */
  function isWebGLDrawingContext() {
    const WebGLCtor = (typeof WebGLRenderingContext !== 'undefined') ? WebGLRenderingContext : null;
    return !!(WebGLCtor && session.p5Instance?._renderer?.drawingContext instanceof WebGLCtor);
  }


  /**
   * @private
   * Whether a value looks like a p5 sketch instance.
   */
  function isP5InstanceLike(value) {
    return !!(value && typeof value === 'object' && typeof value.pixelDensity === 'function');
  }


  /**
   * @private
   * Finds the active global-mode p5 sketch for argument-flexible APIs.
   */
  function getGlobalP5Instance() {
    const globalTarget = getGlobalTarget();
    if (globalTarget && isP5InstanceLike(globalTarget)) {
      return globalTarget;
    }
    if (typeof p5 !== 'undefined' && isP5InstanceLike(p5.instance)) {
      return globalTarget || p5.instance;
    }
    if (globalTarget?.p5 && isP5InstanceLike(globalTarget.p5.instance)) {
      return globalTarget || globalTarget.p5.instance;
    }
    return undefined;
  }


  /**
   * @private
   * Whether a p5 instance is the active global-mode sketch instance.
   */
  function isGlobalP5Instance(value) {
    const globalTarget = getGlobalTarget();
    if (!isP5InstanceLike(value) || !globalTarget) return false;
    if (typeof p5 !== 'undefined' && p5.instance === value) return true;
    if (globalTarget.p5 && globalTarget.p5.instance === value) return true;
    return false;
  }


  /**
   * @private
   * Normalizes old and add-on-style beginRecordSvg() argument forms.
   */
  function normalizeBeginRecordSvgArgs(p5InstanceOrFilename, maybeFilename) {
    if (isP5InstanceLike(p5InstanceOrFilename) || p5InstanceOrFilename === getGlobalTarget()) {
      return {
        p5Instance: p5InstanceOrFilename,
        filename: maybeFilename
      };
    }
    return {
      p5Instance: getGlobalP5Instance(),
      filename: p5InstanceOrFilename
    };
  }


  /**
   * Begins recording SVG output for a p5.js sketch.
   * Initializes recording state, validates and sets the output filename,
   * and overrides p5.js drawing functions to capture drawing commands for SVG export.
   * Behavior is as follows:
   * beginRecordSvg(this); // saves to output.svg (default)
   * beginRecordSvg(this, "file.svg"); // saves to file.svg
   * beginRecordSvg(this, null); // DOES NOT save any file!
   * beginRecordSvg("file.svg"); // global-mode add-on style
   * beginRecordSvg(null); // global-mode add-on style, does not save a file
   * @param {object|string|null} p5Instance - A p5 sketch instance, or a filename in global-mode add-on style.
   * @param {string|null} [fn] - Optional filename for explicit-instance usage.
   */
  p5plotSvg.beginRecordSvg = function(p5InstanceOrFilename, maybeFilename) {
    const normalizedArgs = normalizeBeginRecordSvgArgs(p5InstanceOrFilename, maybeFilename);
    const p5Instance = normalizedArgs.p5Instance;
    let fn = normalizedArgs.filename;

    // Validate the p5 instance
    if (!p5Instance) {
      throw new Error("Invalid p5 instance provided to beginRecordSvg().");
    }

    // Detect p5.js version for compatibility handling
    const p5Version = getP5Version(p5Instance);
    session.p5MajorVersion = parseInt(p5Version.split('.')[0]);

    // Store a reference to the p5 instance for use in other functions
    // In p5.js v2 global mode, 'this' in draw() is window, not the p5 instance
    // Use p5.instance instead when available and p5Instance appears to be window
    const globalTarget = getGlobalTarget();
    session.usingGlobalMode = (p5Instance === globalTarget);
    if (session.p5MajorVersion >= 2 && session.usingGlobalMode && typeof p5 !== 'undefined' && typeof p5.instance !== 'undefined') {
      session.p5Instance = p5.instance;
    } else {
      session.p5Instance = p5Instance;
    }
    session.p5PixelDensity = session.p5Instance.pixelDensity();
    session.bezierOrder = getCurrentBezierOrder();
    session.curveTightness = getCurrentSplineTightness();
    session.splineEndsMode = getCurrentSplineEndsMode();
    session.curveVertexCompatActive = false;
    session.curveVertexCompatPreviousEndsMode = undefined;

    // Warn if using v2 (only once per session)
    if (!warnings.p5v2Shown && session.p5MajorVersion >= 2) {
      console.warn(
        `p5.plotSvg: Detected p5.js version ${p5Version}. ` +
        `p5.js v2 compatibility is experimental. Basic 2D geometry export is supported, ` +
        `including v2 spline() and splineVertex(), but some p5.js v2 API changes may ` +
        `still produce differences from p5.js v1 output.`
      );
      warnings.p5v2Shown = true;
    }

    // Check if filename is provided and valid
    if (fn === null) {
      // if fn is null, explicit opt-out: do NOT save a file
      config.filename = null;

    } else if (typeof fn === 'string' && fn.length > 0) {
      // Ensure ".svg" extension is present
      if (!fn.endsWith(".svg")) {
        fn += ".svg";
      }
      // Strip out illegal filename characters (keep alphanumeric, hyphen, underscore, dot)
      fn = fn.replace(/[^a-zA-Z0-9-_\.]/g, '');

      // Get the base name (without .svg extension)
      let base = fn.slice(0, -4);
      // Check if base has any real content (not just dots)
      let hasContent = base.replace(/\./g, '').length > 0;

      // If base is empty or only dots, fall back to default
      if (!hasContent) {
        config.filename = "output.svg";
      } else {
        config.filename = fn;
      }

    } else {
      // Default behavior: undefined or invalid fn → output.svg
      config.filename = "output.svg";
    }

    // Initialize SVG settings and override functions
    session.recording = true;
    session.recordingBegun = true;
    session.transformsExist = false;
    session.commands = [];

    // Experimental extension hook: expose the live command array while
    // recording so advanced external add-ons can inspect or inject commands.
    p5plotSvg._commands = session.commands;

    session.vertexStack = [];
    session.groupStack = [];
    session.injectedHeaderAttributes = [];
    session.injectedDefs = [];
    session.pointsSetCount = 0;
    session.linesSetCount = 0;
    session.trianglesSetCount = 0;
    session.triangleFanSetCount = 0;
    session.triangleStripSetCount = 0;
    session.quadsSetCount = 0;
    session.quadStripSetCount = 0;
    resetSessionLayers();
    overrideP5Functions();
  }


  /**
   * Pauses or unpauses recording of SVG output for a p5.js sketch,
   * depending on whether the bPause argument is true or false.
   */
  p5plotSvg.pauseRecordSvg = function(bPause) {
    if (!session.recordingBegun){
      console.warn("You must beginRecordSvg() before you can pauseRecordSvg().");
      return;
    } else {
      if (bPause === true){
        session.recording = false;
      } else if (bPause === false){
        session.recording = true;
      }
    }
  }


  /**
   * Ends recording of SVG output for a p5.js sketch.
   * Calls the export function to generate the SVG output
   * and restores the original p5.js functions.
   * Returns the text of the SVG file as a string.
   */
  p5plotSvg.endRecordSvg = function() {
    let svgStr = exportSVG();
    restoreP5Functions();
    session.recording = false;
    session.recordingBegun = false;

    session.recordingSessionId++;
    p5plotSvg._recordingSessionId = session.recordingSessionId;
    return svgStr;
  }

  /**
   * @public
   * @deprecated Use p5plotSvg.beginRecordSvg() instead.
   * Backward-compatible wrapper for the original capitalized API name.
   */
  p5plotSvg.beginRecordSVG = function() {
    console.warn("beginRecordSVG() is deprecated. The new name is beginRecordSvg().");
    return p5plotSvg.beginRecordSvg.apply(p5plotSvg, arguments);
  };

  /**
   * @public
   * @deprecated Use p5plotSvg.pauseRecordSvg() instead.
   * Backward-compatible wrapper for the original capitalized API name.
   */
  p5plotSvg.pauseRecordSVG = function() {
    console.warn("pauseRecordSVG() is deprecated. The new name is pauseRecordSvg().");
    return p5plotSvg.pauseRecordSvg.apply(p5plotSvg, arguments);
  };

  /**
   * @public
   * @deprecated Use p5plotSvg.endRecordSvg() instead.
   * Backward-compatible wrapper for the original capitalized API name.
   */
  p5plotSvg.endRecordSVG = function() {
    console.warn("endRecordSVG() is deprecated. The new name is endRecordSvg().");
    return p5plotSvg.endRecordSvg.apply(p5plotSvg, arguments);
  };


  /**
   * @private
   * Overrides p5.js drawing functions to capture commands for SVG export.
   * Includes support for shapes, vertices, transformations, and text functions.
   */
  function overrideP5Functions() {
    overrideArcFunction();
    overrideBezierFunction();
    overrideCircleFunction();
    overrideCurveFunction();
    overrideSplineFunction();
    overrideEllipseFunction();
    overrideLineFunction();
    overridePointFunction();
    overrideQuadFunction();
    overrideRectFunction();
    overrideSquareFunction();
    overrideTriangleFunction();
    overrideBezierDetailFunction();
    overrideCurveTightnessFunction();
    overrideBezierOrderFunction();
    overrideSplinePropertyFunction();
    overrideSplinePropertiesFunction();

    overrideBeginShapeFunction();
    overrideVertexFunction();
    overrideBezierVertexFunction();
    overrideQuadraticVertexFunction();
    overrideCurveVertexFunction();
    overrideSplineVertexFunction();
    overrideBeginContourFunction();
    overrideEndContourFunction();
    overrideEndShapeFunction();

    overrideDescribeFunction();
    overridePushFunction();
    overridePopFunction();
    overrideScaleFunction();
    overrideTranslateFunction();
    overrideRotateFunction();
    overrideShearXFunction();
    overrideShearYFunction();
    overrideTextFunction();
    overrideStrokeFunction();
    overrideColorModeFunction();
    overrideClipFunction();
  }


  /**
   * @private
   * Restores the original p5.js drawing functions that were overridden for SVG export.
   * Reverts all overrides, returning p5.js functions to their standard behavior.
   */
  function restoreP5Functions(){
    restoreOverriddenFunctions();
  }


  /**
   * @private
   * Overrides the p5.js arc function to capture SVG arc commands for export.
   * Supports different arc modes. Warns about optional detail parameter in WEBGL context.
   * Stores arc parameters in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/arc/}
   */
  function overrideArcFunction() {
    // Save the original window.arc for proper restoration in v2
    session.overrides.originals.arc = getOriginalFunction('arc');
    const newArcFunc = function(x, y, w, h, start, stop, mode, detail = 0) {
      if (session.recording) {
        if (detail !== undefined && isWebGLDrawingContext()) {
          console.warn("arc() detail is currently unsupported in SVG output.");
        }

        // Get ellipseMode: v2 stores in states.ellipseMode, v1 in _ellipseMode
        const ellipseMode = session.p5Instance._renderer?.states?.ellipseMode ||
                           session.p5Instance._renderer?._ellipseMode ||
                           'center';

        // Adjust x, y, w, h based on ellipseMode (arc follows ellipse mode)
        if (ellipseMode === 'center') {
          // No adjustment needed for 'center'
        } else if (ellipseMode === 'corner') {
          x += w / 2;
          y += h / 2;
        } else if (ellipseMode === 'radius') {
          w *= 2;
          h *= 2;
        } else if (ellipseMode === 'corners') {
          let px = Math.min(x, w);
          let qx = Math.max(x, w);
          let py = Math.min(y, h);
          let qy = Math.max(y, h);
          x = px + (qx - px) / 2;
          y = py + (qy - py) / 2;
          w = qx - px;
          h = qy - py;
        }

        let transformMatrix = captureCurrentTransformMatrix();
        const svgMode = (typeof mode === 'undefined') ? getP5Constant('OPEN') : mode;
        session.commands.push({ type: SVG_COMMAND.ARC, x, y, w, h, start, stop, mode: svgMode, transformMatrix });
      }
      callOriginalFunction(session.overrides.originals.arc, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'arc', newArcFunc);
    overrideFunction(getGlobalTarget(), 'arc', newArcFunc);
  }


  /**
   * @private
   * Overrides the p5.js bezier function to capture SVG bezier curve commands for export.
   * Stores bezier curve control points in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/bezier/}
   */
  function overrideBezierFunction(){
    // Save the original window.bezier for proper restoration in v2
    session.overrides.originals.bezier = getOriginalFunction('bezier');
    const newBezierFunc = function(x1, y1, x2, y2, x3, y3, x4, y4) {
      if (session.recording) {
        let transformMatrix = captureCurrentTransformMatrix();
        session.commands.push({ type: SVG_COMMAND.BEZIER, x1, y1, x2, y2, x3, y3, x4, y4, transformMatrix });
      }
      callOriginalFunction(session.overrides.originals.bezier, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'bezier', newBezierFunc);
    overrideFunction(getGlobalTarget(), 'bezier', newBezierFunc);
  }


  /**
   * @private
   * Overrides the p5.js circle function to capture SVG circle commands for export.
   * Handles different ellipse modes (center, corner, radius, corners)
   * to convert circle parameters appropriately.
   * Stores circle or ellipse parameters in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/circle/}
   */
  function overrideCircleFunction(){
    // Save the original window.circle for proper restoration in v2
    session.overrides.originals.circle = getOriginalFunction('circle');
    const newCircleFunc = function(x, y, d) {
      let argumentsCopy = [...arguments];  // safe snapshot
      if (session.recording) {
        let transformMatrix = captureCurrentTransformMatrix();
        // Get ellipseMode: v2 stores in states.ellipseMode, v1 in _ellipseMode
        const ellipseMode = session.p5Instance._renderer?.states?.ellipseMode ||
                            session.p5Instance._renderer?._ellipseMode ||
                            'center';

        if (ellipseMode === 'center'){
          session.commands.push({ type: SVG_COMMAND.CIRCLE, x, y, d, transformMatrix });
        } else if (ellipseMode === 'corner'){
          x += d/2;
          y += d/2;
          session.commands.push({ type: SVG_COMMAND.CIRCLE, x, y, d, transformMatrix });
        } else if (ellipseMode === 'radius'){
          d *= 2;
          session.commands.push({ type: SVG_COMMAND.CIRCLE, x, y, d, transformMatrix });
        } else if (ellipseMode === 'corners'){
          let w = d - x;
          let h = d - y;
          x += w/2;
          y += h/2;
          session.commands.push({ type: SVG_COMMAND.ELLIPSE, x, y, w, h, transformMatrix });
        }
      }
      callOriginalFunction(session.overrides.originals.circle, session.p5Instance, argumentsCopy);
    };
    overrideFunction(session.p5Instance, 'circle', newCircleFunc);
    overrideFunction(getGlobalTarget(), 'circle', newCircleFunc);
  }


  /**
   * @private
   * Overrides the p5.js curve function to capture SVG curve commands for export.
   * Stores curve parameters and current tightness in the `session.commands` array.
   * @see {@link https://p5js.org/reference/#/p5/curve}
   */
  function overrideCurveFunction() {
    session.overrides.originals.curve = getOriginalFunction('curve');
    if (session.p5MajorVersion >= 2) {
      const curveCompatFunc = function(x1, y1, x2, y2, x3, y3, x4, y4) {
        let argumentsCopy = [...arguments];
        if (!warnings.curveV2Shown) {
          console.warn("p5.plotSvg: curve() is no longer part of p5.js v2; using a p5.plotSvg compatibility shim during SVG recording.");
          warnings.curveV2Shown = true;
        }
        if (session.recording) {
          let transformMatrix = captureCurrentTransformMatrix();
          let tightness = getCurrentSplineTightness();
          session.commands.push({ type: SVG_COMMAND.CURVE, x1, y1, x2, y2, x3, y3, x4, y4, tightness, transformMatrix });
        }

        const drawCurve = () => callOriginalFunction(session.overrides.originals.spline, session.p5Instance, argumentsCopy);
        if (typeof session.overrides.originals.spline === 'function') {
          withTemporarySplineEndsMode(getP5Constant('EXCLUDE'), drawCurve);
        }
      };
      overrideFunction(session.p5Instance, 'curve', curveCompatFunc);
      overrideFunction(getGlobalTarget(), 'curve', curveCompatFunc);
      return;
    }

    // p5.js v1 - normal override
    const newCurveFunc = function(x1, y1, x2, y2, x3, y3, x4, y4) {
      let argumentsCopy = [...arguments];  // safe snapshot
      if (session.recording) {
        let transformMatrix = captureCurrentTransformMatrix();
        let tightness = session.curveTightness; // Capture current tightness (set via curveTightness override)
        session.commands.push({ type: SVG_COMMAND.CURVE, x1, y1, x2, y2, x3, y3, x4, y4, tightness, transformMatrix });
      }
      callOriginalFunction(session.overrides.originals.curve, session.p5Instance, argumentsCopy);
    };
    overrideFunction(session.p5Instance, 'curve', newCurveFunc);
    overrideFunction(getGlobalTarget(), 'curve', newCurveFunc);
  }


  /**
   * @private
   * Overrides p5.js v2's spline function. p5.js v1 uses curve() instead.
   */
  function overrideSplineFunction() {
    session.overrides.originals.spline = getOriginalFunction('spline');
    if (typeof session.overrides.originals.spline !== 'function') return;

    const newSplineFunc = function(x1, y1, x2, y2, x3, y3, x4, y4) {
      let argumentsCopy = [...arguments];
      if (session.recording) {
        let transformMatrix = captureCurrentTransformMatrix();
        let tightness = getCurrentSplineTightness();
        let endsMode = getCurrentSplineEndsMode();
        session.commands.push({
          type: SVG_COMMAND.SPLINE,
          points: [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
            { x: x3, y: y3 },
            { x: x4, y: y4 }
          ],
          closed: false,
          tightness,
          endsMode,
          transformMatrix
        });
      }
      callOriginalFunction(session.overrides.originals.spline, session.p5Instance, argumentsCopy);
    };
    overrideFunction(session.p5Instance, 'spline', newSplineFunc);
    overrideFunction(getGlobalTarget(), 'spline', newSplineFunc);
  }


  /**
   * @private
   * Overrides the p5.js ellipse function to capture SVG ellipse commands for export.
   * Handles different ellipse modes (center, corner, radius, corners) and warns
   * when detail is used in WEBGL context as it is unsupported for SVG output.
   * Stores ellipse parameters in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/ellipse/}
  */
  function overrideEllipseFunction(){
    // Save the original window.ellipse for proper restoration in v2
    session.overrides.originals.ellipse = getOriginalFunction('ellipse');
    const newEllipseFunc = function(x, y, w, h, detail = 0) {
      let argumentsCopy = [...arguments];  // safe snapshot
      if (session.recording) {
        if (detail !== undefined && isWebGLDrawingContext()) {
          console.warn("ellipse() detail is currently unsupported in SVG output.");
        }

        // Get ellipseMode: v2 stores in states.ellipseMode, v1 in _ellipseMode
        const ellipseMode = session.p5Instance._renderer?.states?.ellipseMode ||
                            session.p5Instance._renderer?._ellipseMode ||
                            'center';

        if (ellipseMode === 'center'){
          ;
        } else if (ellipseMode === 'corner'){
          x += w/2;
          y += h/2;
        } else if (ellipseMode === 'radius'){
          w *= 2;
          h *= 2;
        } else if (ellipseMode === 'corners'){
          let px = Math.min(x, w);
          let qx = Math.max(x, w);
          let py = Math.min(y, h);
          let qy = Math.max(y, h);
          x = px;
          y = py;
          w = qx - px;
          h = qy - py;
          x += w/2;
          y += h/2;
        }
        let transformMatrix = captureCurrentTransformMatrix();
        session.commands.push({ type: SVG_COMMAND.ELLIPSE, x, y, w, h, transformMatrix });
      }
      callOriginalFunction(session.overrides.originals.ellipse, session.p5Instance, argumentsCopy);
    };
    overrideFunction(session.p5Instance, 'ellipse', newEllipseFunc);
    overrideFunction(getGlobalTarget(), 'ellipse', newEllipseFunc);
  }


  /**
   * @private
   * Overrides the p5.js line function to capture SVG line commands for export.
   * Stores line parameters in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/line/}
   */
  function overrideLineFunction() {
    // Save the original window.line for proper restoration in v2
    session.overrides.originals.line = getOriginalFunction('line');
    const newLineFunc = function(x1, y1, x2, y2) {
      if (session.recording) {
        let transformMatrix = captureCurrentTransformMatrix();
        session.commands.push({ type: SVG_COMMAND.LINE, x1, y1, x2, y2, transformMatrix });
      }
      callOriginalFunction(session.overrides.originals.line, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'line', newLineFunc);
    overrideFunction(getGlobalTarget(), 'line', newLineFunc);
  }


  /**
   * @private
   * Overrides the p5.js point function to capture SVG point commands for export.
   * Stores point parameters as small circles in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/point/}
   */
  function overridePointFunction() {
    // Save the original window.point for proper restoration in v2
    session.overrides.originals.point = getOriginalFunction('point');
    const newPointFunc = function(x, y) {
      if (session.recording) {
        let transformMatrix = captureCurrentTransformMatrix();
        session.commands.push({ type: SVG_COMMAND.POINT, x, y, radius: config.pointRadius, transformMatrix });
      }
      callOriginalFunction(session.overrides.originals.point, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'point', newPointFunc);
    overrideFunction(getGlobalTarget(), 'point', newPointFunc);
  }


  /**
   * @private
   * Overrides the p5.js quad function to capture SVG quad commands for export.
   * Stores quad parameters in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/quad/}
   */
  function overrideQuadFunction(){
    // Save the original window.quad for proper restoration in v2
    session.overrides.originals.quad = getOriginalFunction('quad');
    const newQuadFunc = function(x1, y1, x2, y2, x3, y3, x4, y4) {
      if (session.recording) {
        let transformMatrix = captureCurrentTransformMatrix();
        session.commands.push({ type: SVG_COMMAND.QUAD, x1, y1, x2, y2, x3, y3, x4, y4, transformMatrix });
      }
      callOriginalFunction(session.overrides.originals.quad, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'quad', newQuadFunc);
    overrideFunction(getGlobalTarget(), 'quad', newQuadFunc);
  }


  /**
   * @private
   * Overrides the p5.js rect function to capture SVG rect commands for export.
   * Handles different rect modes (corner, center, radius, corners) and supports
   * rectangles with optional uniform or individual corner radii.
   * Stores rect parameters in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/rect/}
   */
  function overrideRectFunction() {
    // Save the original window.rect for proper restoration in v2
    session.overrides.originals.rect = getOriginalFunction('rect');
    const newRectFunc = function(x, y, w, h, tl, tr, br, bl) {
      let argumentsCopy = [...arguments];  // safe snapshot
      if (session.recording) {
        if (arguments.length === 3) { h = w; }

        // Get rectMode: v2 stores in states.rectMode, v1 in _rectMode
        const rectMode = session.p5Instance._renderer?.states?.rectMode ||
                         session.p5Instance._renderer?._rectMode ||
                         'corner';

        // Handle different rect modes
        if (rectMode === 'corner') {
          // No adjustment needed for 'corner'
        } else if (rectMode === 'center') {
          x = x - w / 2;
          y = y - h / 2;
        } else if (rectMode === 'radius') {
          x = x - w;
          y = y - h;
          w = 2 * w;
          h = 2 * h;
        } else if (rectMode === 'corners') {
          let px = Math.min(x, w);
          let qx = Math.max(x, w);
          let py = Math.min(y, h);
          let qy = Math.max(y, h);
          x = px;
          y = py;
          w = qx - px;
          h = qy - py;
        }

        let transformMatrix = captureCurrentTransformMatrix();
        // Check for corner radii
        if (arguments.length === 5) { // Single corner radius
          session.commands.push({ type: SVG_COMMAND.RECT, x, y, w, h, tl, transformMatrix });
        } else if (arguments.length === 8) { // Individual corner radii
          session.commands.push({ type: SVG_COMMAND.RECT, x, y, w, h, tl,tr,br,bl, transformMatrix });
        } else { // Standard rectangle
          session.commands.push({ type: SVG_COMMAND.RECT, x, y, w, h, transformMatrix });
        }
      }
      callOriginalFunction(session.overrides.originals.rect, session.p5Instance, argumentsCopy);
    };
    overrideFunction(session.p5Instance, 'rect', newRectFunc);
    overrideFunction(getGlobalTarget(), 'rect', newRectFunc);
  }


  /**
   * @private
   * Overrides the p5.js square function to capture SVG square commands for export.
   * Handles different rect modes (corner, center, radius, corners) and supports
   * squares with optional uniform or individual corner radii.
   * Converts square parameters to equivalent rectangle parameters and stores them
   * in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/square/}
   */
  function overrideSquareFunction(){
    // Save the original window.square for proper restoration in v2
    session.overrides.originals.square = getOriginalFunction('square');
    const newSquareFunc = function(x, y, s, tl, tr, br, bl) {
      let argumentsCopy = [...arguments];  // safe snapshot
      if (session.recording) {
        let w = s;
        let h = s;

        // Get rectMode: v2 stores in states.rectMode, v1 in _rectMode
        const rectMode = session.p5Instance._renderer?.states?.rectMode ||
                         session.p5Instance._renderer?._rectMode ||
                         'corner';

        if (rectMode === 'corner'){
          ;
        } else if (rectMode === 'center'){
          x = x - w/2;
          y = y - h/2;
        } else if (rectMode === 'radius'){
          x = x - w;
          y = y - h;
          w = 2*w;
          h = 2*h;
        } else if (rectMode === 'corners'){
          let px = Math.min(x, s);
          let qx = Math.max(x, s);
          let py = Math.min(y, s);
          let qy = Math.max(y, s);
          x = px;
          y = py;
          w = qx - px;
          h = qy - py;
        }

        let transformMatrix = captureCurrentTransformMatrix();
        if (arguments.length === 3) { // standard square
          session.commands.push({ type: SVG_COMMAND.RECT, x, y, w, h, transformMatrix });
        } else if (arguments.length === 4) { // rounded square
          session.commands.push({ type: SVG_COMMAND.RECT, x, y, w, h, tl, transformMatrix });
        } else if (arguments.length === 7) {
          session.commands.push({ type: SVG_COMMAND.RECT, x, y, w, h, tl, tr, br, bl, transformMatrix });
        }
      }
      callOriginalFunction(session.overrides.originals.square, session.p5Instance, argumentsCopy);
    };
    overrideFunction(session.p5Instance, 'square', newSquareFunc);
    overrideFunction(getGlobalTarget(), 'square', newSquareFunc);
  }


  /**
   * @private
   * Overrides the p5.js triangle function to capture SVG triangle commands for export.
   * Stores triangle vertex coordinates in the `session.commands` array when recording SVG output.
   * @see {@link https://p5js.org/reference/p5/triangle/}
   */
  function overrideTriangleFunction(){
    // Save the original window.triangle for proper restoration in v2
    session.overrides.originals.triangle = getOriginalFunction('triangle');
    const newTriangleFunc = function(x1, y1, x2, y2, x3, y3) {
      if (session.recording) {
        let transformMatrix = captureCurrentTransformMatrix();
        session.commands.push({ type: SVG_COMMAND.TRIANGLE, x1, y1, x2, y2, x3, y3, transformMatrix });
      }
      callOriginalFunction(session.overrides.originals.triangle, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'triangle', newTriangleFunc);
    overrideFunction(getGlobalTarget(), 'triangle', newTriangleFunc);
  }


  /**
   * @private
   * Overrides the p5.js bezierDetail function to provide a warning when used in WEBGL context.
   * Warns users that bezierDetail is currently unsupported in SVG output.
   * https://p5js.org/reference/p5/bezierDetail/
   */
  function overrideBezierDetailFunction() {
    session.overrides.originals.bezierDetail = getOriginalFunction('bezierDetail');
    if (typeof session.overrides.originals.bezierDetail !== 'function') return;
    const newBezierDetailFunc = function(detailLevel) { // Check if the renderer is WEBGL
      if (isWebGLDrawingContext()) {
        console.warn("bezierDetail() is currently unsupported in SVG output.");
      }
      callOriginalFunction(session.overrides.originals.bezierDetail, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'bezierDetail', newBezierDetailFunc);
    overrideFunction(getGlobalTarget(), 'bezierDetail', newBezierDetailFunc);
  }


  /**
   * @private
   * Overrides the p5.js curveTightness function to capture curve tightness settings for SVG export.
   * Updates the recorded curve tightness to reflect the specified tightness value.
   * @see {@link https://p5js.org/reference/p5/curveTightness/}
   */
  function overrideCurveTightnessFunction() {
    session.overrides.originals.curveTightness = getOriginalFunction('curveTightness');
    if (session.p5MajorVersion >= 2) {
      const curveTightnessCompatFunc = function(tightness) {
        session.curveTightness = tightness;
        setOriginalSplineProperty('tightness', tightness);
        if (!warnings.curveTightnessV2Shown) {
          console.warn("p5.plotSvg: curveTightness() is no longer part of p5.js v2; mapping it to splineProperty('tightness', value) during SVG recording.");
          warnings.curveTightnessV2Shown = true;
        }
        return session.p5Instance;
      };
      overrideFunction(session.p5Instance, 'curveTightness', curveTightnessCompatFunc);
      overrideFunction(getGlobalTarget(), 'curveTightness', curveTightnessCompatFunc);
      return;
    }

    // p5.js v1 - normal override
    const newCurveTightnessFunc = function(tightness) {
      if (session.recording) {
        session.curveTightness = tightness;
      }
      callOriginalFunction(session.overrides.originals.curveTightness, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'curveTightness', newCurveTightnessFunc);
    overrideFunction(getGlobalTarget(), 'curveTightness', newCurveTightnessFunc);
  }


  /**
   * @private
   * Tracks p5.js v2's current Bezier order for bezierVertex() point streams.
   */
  function overrideBezierOrderFunction() {
    session.overrides.originals.bezierOrder = getOriginalFunction('bezierOrder');
    if (typeof session.overrides.originals.bezierOrder !== 'function') return;

    const newBezierOrderFunc = function(order) {
      if (typeof order !== 'undefined') {
        session.bezierOrder = order;
      }
      return callOriginalFunction(session.overrides.originals.bezierOrder, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'bezierOrder', newBezierOrderFunc);
    overrideFunction(getGlobalTarget(), 'bezierOrder', newBezierOrderFunc);
  }


  /**
   * @private
   * Tracks p5.js v2 spline settings that affect exported spline geometry.
   */
  function overrideSplinePropertyFunction() {
    session.overrides.originals.splineProperty = getOriginalFunction('splineProperty');
    if (typeof session.overrides.originals.splineProperty !== 'function') return;

    const newSplinePropertyFunc = function(property, value) {
      const ret = callOriginalFunction(session.overrides.originals.splineProperty, session.p5Instance, arguments);
      if (typeof value !== 'undefined') {
        if (property === 'tightness') {
          session.curveTightness = value;
        } else if (property === 'ends') {
          session.splineEndsMode = value;
        }
      }
      return ret;
    };
    overrideFunction(session.p5Instance, 'splineProperty', newSplinePropertyFunc);
    overrideFunction(getGlobalTarget(), 'splineProperty', newSplinePropertyFunc);
  }


  /**
   * @private
   * Tracks p5.js v2 spline settings assigned in bulk.
   */
  function overrideSplinePropertiesFunction() {
    session.overrides.originals.splineProperties = getOriginalFunction('splineProperties');
    if (typeof session.overrides.originals.splineProperties !== 'function') return;

    const newSplinePropertiesFunc = function(values) {
      const ret = callOriginalFunction(session.overrides.originals.splineProperties, session.p5Instance, arguments);
      if (values && typeof values === 'object') {
        if (Object.prototype.hasOwnProperty.call(values, 'tightness')) {
          session.curveTightness = values.tightness;
        }
        if (Object.prototype.hasOwnProperty.call(values, 'ends')) {
          session.splineEndsMode = values.ends;
        }
      }
      return ret;
    };
    overrideFunction(session.p5Instance, 'splineProperties', newSplinePropertiesFunc);
    overrideFunction(getGlobalTarget(), 'splineProperties', newSplinePropertiesFunc);
  }


  /**
   * @private
   * Overrides the p5.js beginShape function to initiate shape recording for SVG export.
   * Initializes the vertex stack and sets the shape kind based on the provided kind parameter.
   * @see {@link https://p5js.org/reference/p5/beginShape/}
   */
  function overrideBeginShapeFunction() {
    session.overrides.originals.beginShape = getOriginalFunction('beginShape');
    const newBeginShapeFunc = function(kind) {
      if (session.recording) {
        session.vertexStack = []; // Start with an empty vertex stack
        session.shapeMode = "simple"; // Assume simple mode initially

        if ((kind !== null) && (kind === 0 || (typeof session.p5Instance.POINTS !== 'undefined' && kind === session.p5Instance.POINTS))) {
          session.shapeKind = SVG_COMMAND.POINTS;
        } else if (kind === null || typeof kind === 'undefined'){
          session.shapeKind = 'poly'; // default to "poly" for polyline/polygon
        } else {
          session.shapeKind = kind;
        }
      }
      callOriginalFunction(session.overrides.originals.beginShape, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'beginShape', newBeginShapeFunc);
    overrideFunction(getGlobalTarget(), 'beginShape', newBeginShapeFunc);
  }


  /**
   * @private
   * Overrides the p5.js vertex function to capture vertex coordinates for SVG export.
   * Pushes simple vertex data to the `session.vertexStack` when recording is active.
   * @see {@link https://p5js.org/reference/p5/vertex/}
   */
  function overrideVertexFunction() {
    session.overrides.originals.vertex = getOriginalFunction('vertex');
    const newVertexFunc = function(x, y) {
      if (session.recording) {
        session.vertexStack.push({ type: SVG_SEGMENT.VERTEX, x, y });
      }
      callOriginalFunction(session.overrides.originals.vertex, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'vertex', newVertexFunc);
    overrideFunction(getGlobalTarget(), 'vertex', newVertexFunc);
  }


  /**
   * @private
   * Overrides the p5.js bezierVertex function to capture Bézier control points for SVG export.
   * Marks the current shape as complex and stores Bézier vertex data in the `session.vertexStack`.
   * @see {@link https://p5js.org/reference/p5/bezierVertex/}
   */
  function overrideBezierVertexFunction() {
    // Override `bezierVertex()` and mark shape as complex
    session.overrides.originals.bezierVertex = getOriginalFunction('bezierVertex');
    const newBezierVertexFunc = function(x2, y2, x3, y3, x4, y4) {
      if (session.recording) {
        session.shapeMode = 'complex'; // Switch to complex mode
        if (session.p5MajorVersion >= 2 && arguments.length <= 5) {
          session.vertexStack.push({
            type: SVG_SEGMENT.BEZIER_POINT,
            x: x2,
            y: y2,
            order: getCurrentBezierOrder()
          });
        } else {
          session.vertexStack.push({ type: SVG_SEGMENT.BEZIER, x2, y2, x3, y3, x4, y4 });
        }
      }
      callOriginalFunction(session.overrides.originals.bezierVertex, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'bezierVertex', newBezierVertexFunc);
    overrideFunction(getGlobalTarget(), 'bezierVertex', newBezierVertexFunc);
  }


  /**
   * @private
   * Overrides the p5.js quadraticVertex function to capture quadratic Bézier control points for SVG export.
   * Marks the current shape as complex and stores quadratic vertex data in the `session.vertexStack`.
   * @see {@link https://p5js.org/reference/p5/quadraticVertex/}
   */
  function overrideQuadraticVertexFunction() {
    // Override `quadraticVertex()` and mark shape as complex
    session.overrides.originals.quadraticVertex = getOriginalFunction('quadraticVertex');
    if (typeof session.overrides.originals.quadraticVertex !== 'function' && session.p5MajorVersion < 2) return;
    const newQuadraticVertexFunc = function(cx, cy, x, y) {
      if (session.recording) {
        session.shapeMode = 'complex'; // Switch to complex mode
        session.vertexStack.push({ type: SVG_SEGMENT.QUADRATIC, cx, cy, x, y });
      }
      if (session.p5MajorVersion >= 2) {
        const previousOrder = getCurrentBezierOrder();
        setOriginalBezierOrder(2);
        callOriginalFunction(session.overrides.originals.bezierVertex, session.p5Instance, [cx, cy]);
        callOriginalFunction(session.overrides.originals.bezierVertex, session.p5Instance, [x, y]);
        setOriginalBezierOrder(previousOrder);
      } else {
        callOriginalFunction(session.overrides.originals.quadraticVertex, session.p5Instance, arguments);
      }
    };
    overrideFunction(session.p5Instance, 'quadraticVertex', newQuadraticVertexFunc);
    overrideFunction(getGlobalTarget(), 'quadraticVertex', newQuadraticVertexFunc);
  }


  /**
   * @private
   * Overrides the p5.js curveVertex function to capture Catmull-Rom curve control points for SVG export.
   * Marks the current shape as complex and handles specific kludge logic for initial vertices.
   * @see {@link https://p5js.org/reference/p5/curveVertex/}
   */
  function overrideCurveVertexFunction() {
    // Override `curveVertex()` and mark shape as complex
    session.overrides.originals.curveVertex = getOriginalFunction('curveVertex');
    if (typeof session.overrides.originals.curveVertex !== 'function' && session.p5MajorVersion < 2) return;
    const newCurveVertexFunc = function(x, y) {
      if (session.recording) {
        session.shapeMode = 'complex'; // Switch to complex mode
        let tightness = session.curveTightness; // Capture current tightness

        let bDoKludge = true; // TODO: Revisit
        if (bDoKludge){
          if (session.vertexStack.length === 1){
            if(session.vertexStack[0].type === SVG_SEGMENT.CURVE){
              let x0 = session.vertexStack[0].x;
              let y0 = session.vertexStack[0].y;
              let dist01 = Math.hypot(x-x0, y-y0);
              if (dist01 > 0){
                session.vertexStack.shift();
                session.vertexStack.push({ type: SVG_SEGMENT.CURVE, x, y, tightness });
              }
            }
          }
        }
        session.vertexStack.push({ type: SVG_SEGMENT.CURVE, x, y, tightness });
      }
      if (session.p5MajorVersion >= 2) {
        beginCurveVertexCompatIfNeeded();
        callOriginalFunction(session.overrides.originals.splineVertex, session.p5Instance, arguments);
      } else {
        callOriginalFunction(session.overrides.originals.curveVertex, session.p5Instance, arguments);
      }
    };
    overrideFunction(session.p5Instance, 'curveVertex', newCurveVertexFunc);
    overrideFunction(getGlobalTarget(), 'curveVertex', newCurveVertexFunc);
  }


  /**
   * @private
   * Overrides p5.js v2's splineVertex function. p5.js v1 uses curveVertex().
   */
  function overrideSplineVertexFunction() {
    session.overrides.originals.splineVertex = getOriginalFunction('splineVertex');
    if (typeof session.overrides.originals.splineVertex !== 'function') return;

    const newSplineVertexFunc = function(x, y) {
      if (session.recording) {
        session.shapeMode = 'complex';
        session.vertexStack.push({
          type: SVG_SEGMENT.SPLINE,
          x,
          y,
          tightness: getCurrentSplineTightness(),
          endsMode: getCurrentSplineEndsMode()
        });
      }
      callOriginalFunction(session.overrides.originals.splineVertex, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'splineVertex', newSplineVertexFunc);
    overrideFunction(getGlobalTarget(), 'splineVertex', newSplineVertexFunc);
  }


  /**
   * @private
   * Overrides the p5.js beginContour function to mark the start of an inner contour.
   * Pushes a contour start marker to the vertex stack for multi-contour shape support.
   * @see {@link https://p5js.org/reference/p5/beginContour/}
   */
  function overrideBeginContourFunction() {
    session.overrides.originals.beginContour = getOriginalFunction('beginContour');
    if (typeof session.overrides.originals.beginContour !== 'function') return;
    const newBeginContourFunc = function() {
      if (session.recording) {
        session.vertexStack.push({ type: SVG_SEGMENT.CONTOUR_START });
      }
      callOriginalFunction(session.overrides.originals.beginContour, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'beginContour', newBeginContourFunc);
    overrideFunction(getGlobalTarget(), 'beginContour', newBeginContourFunc);
  }


  /**
   * @private
   * Overrides the p5.js endContour function to mark the end of an inner contour.
   * Pushes a contour end marker with closure info to the vertex stack.
   * @see {@link https://p5js.org/reference/p5/endContour/}
   */
  function overrideEndContourFunction() {
    session.overrides.originals.endContour = getOriginalFunction('endContour');
    if (typeof session.overrides.originals.endContour !== 'function') return;
    const newEndContourFunc = function(mode) {
      if (session.recording) {
        let isClosed = (mode === session.p5Instance.CLOSE);
        session.vertexStack.push({ type: SVG_SEGMENT.CONTOUR_END, closed: isClosed });
      }
      callOriginalFunction(session.overrides.originals.endContour, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'endContour', newEndContourFunc);
    overrideFunction(getGlobalTarget(), 'endContour', newEndContourFunc);
  }


  /**
   * @private
   * Overrides the p5.js `endShape` function to capture SVG shape data for export.
   * This function modifies the behavior of `endShape()` to record vertex data
   * and transformation matrices when creating SVG output from p5.js shapes.
   * It handles various shape kinds such as points, lines, triangles, quads, etc.,
   * and pushes the recorded data to an internal command stack for later SVG rendering.
   * @see {@link https://p5js.org/reference/p5/endShape/}
   */
  function overrideEndShapeFunction() {
    session.overrides.originals.endShape = getOriginalFunction('endShape');
    const newEndShapeFunc = function(mode) {
      if (session.recording && session.vertexStack.length > 0) {
        let transformMatrix = captureCurrentTransformMatrix();

        // Dispatch based on the active shape kind.
        switch (session.shapeKind) {
          case SVG_COMMAND.POINTS:
            session.commands.push({ type: SVG_COMMAND.POINTS, vertices: [...session.vertexStack], transformMatrix });
            break;
          case session.p5Instance.LINES:
            session.commands.push({ type: SVG_COMMAND.LINES, vertices: [...session.vertexStack], transformMatrix });
            break;
          case session.p5Instance.TRIANGLES:
            session.commands.push({ type: SVG_COMMAND.TRIANGLES, vertices: [...session.vertexStack], transformMatrix });
            break;
          case session.p5Instance.TRIANGLE_FAN:
            session.commands.push({ type: SVG_COMMAND.TRIANGLE_FAN, vertices: [...session.vertexStack], transformMatrix });
            break;
          case session.p5Instance.TRIANGLE_STRIP:
            session.commands.push({ type: SVG_COMMAND.TRIANGLE_STRIP, vertices: [...session.vertexStack], transformMatrix });
            break;
          case session.p5Instance.QUADS:
            session.commands.push({ type: SVG_COMMAND.QUADS, vertices: [...session.vertexStack], transformMatrix });
            break;
          case session.p5Instance.QUAD_STRIP:
            session.commands.push({ type: SVG_COMMAND.QUAD_STRIP, vertices: [...session.vertexStack], transformMatrix });
            break;

          case 'poly':
          default:
            // Handle the default polyline/polygon behavior
            let isClosed = (mode === session.p5Instance.CLOSE);
            // Check if shape has contours (for multi-contour path support)
            let hasContours = session.vertexStack.some(v => v.type === SVG_SEGMENT.CONTOUR_START);
            if (session.shapeMode === "simple") {
              session.commands.push({
                type: SVG_COMMAND.POLYLINE,
                vertices: [...session.vertexStack],
                closed: isClosed,
                hasContours,
                transformMatrix
              });
            } else {
              session.commands.push({
                type: SVG_COMMAND.PATH,
                segments: [...session.vertexStack],
                closed: isClosed,
                hasContours,
                transformMatrix
              });
            }
            break;
        }

        session.vertexStack = []; // Clear stack after pushing
        session.shapeMode = 'simple';
        session.shapeKind = 'poly';
      }
      try {
        callOriginalFunction(session.overrides.originals.endShape, session.p5Instance, arguments);
      } finally {
        if (session.p5MajorVersion >= 2) {
          endCurveVertexCompatIfNeeded();
        }
      }
    };
    overrideFunction(session.p5Instance, 'endShape', newEndShapeFunc);
    overrideFunction(getGlobalTarget(), 'endShape', newEndShapeFunc);
  }


  /**
   * @private
   * Overrides the p5.js describe function to produce SVG description elements.
   * Captures the provided description text for embedding in the SVG as a <desc> element.
   * @see {@link https://p5js.org/reference/p5/describe/}
   */
  function overrideDescribeFunction() {
    session.overrides.originals.describe = getOriginalFunction('describe');
    if (typeof session.overrides.originals.describe !== 'function') return;
    const newDescribeFunc = function(description) {
      if (session.recording) {
        if (description && description.trim().length > 0){
          // Push a command to the stack for generating an SVG `desc` element
          session.commands.push({ type: SVG_COMMAND.DESCRIPTION, text: description });
        }
      }
      callOriginalFunction(session.overrides.originals.describe, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'describe', newDescribeFunc);
    overrideFunction(getGlobalTarget(), 'describe', newDescribeFunc);
  }


  /**
   * @private
   * Overrides the p5.js push function to capture transformations for SVG output.
   * Captures transformation state for recording SVG output by storing a 'push' command.
   * @see {@link https://p5js.org/reference/p5/push/}
   */
  function overridePushFunction(){
    session.overrides.originals.push = getOriginalFunction('push');
    session.transformsExist = true;
    const newPushFunc = function() {
      if (session.recording) {
        session.commands.push({ type: SVG_COMMAND.PUSH });
      }
      callOriginalFunction(session.overrides.originals.push, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'push', newPushFunc);
    overrideFunction(getGlobalTarget(), 'push', newPushFunc);
  }


  /**
   * @private
   * Overrides the p5.js pop function to capture transformations for SVG output.
   * Captures transformation state for recording SVG output by storing a 'pop' command.
   * @see {@link https://p5js.org/reference/p5/pop/}
   */
  function overridePopFunction(){
    session.overrides.originals.pop = getOriginalFunction('pop');
    session.transformsExist = true;
    const newPopFunc = function() {
      if (session.recording) {
        session.commands.push({ type: SVG_COMMAND.POP });
      }
      callOriginalFunction(session.overrides.originals.pop, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'pop', newPopFunc);
    overrideFunction(getGlobalTarget(), 'pop', newPopFunc);
  }


  /**
   * @private
   * Overrides the p5.js scale function to capture scaling transformations for SVG output.
   * Captures scaling parameters for recording SVG output by storing a 'scale' command.
   * @see {@link https://p5js.org/reference/p5/scale/}
   */
  function overrideScaleFunction(){
    session.overrides.originals.scale = getOriginalFunction('scale');
    session.transformsExist = true;
    const newScaleFunc = function(sx, sy) {
      if (session.recording) {
        session.commands.push({ type: SVG_COMMAND.SCALE, sx, sy: sy || sx });
      }
      callOriginalFunction(session.overrides.originals.scale, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'scale', newScaleFunc);
    overrideFunction(getGlobalTarget(), 'scale', newScaleFunc);
  }


  /**
   * @private
   * Overrides the p5.js translate function to capture translation transformations for SVG output.
   * Captures translation parameters for recording SVG output by storing a 'translate' command.
   * @see {@link https://p5js.org/reference/p5/translate/}
   */
  function overrideTranslateFunction(){
    session.overrides.originals.translate = getOriginalFunction('translate');
    session.transformsExist = true;
    const newTranslateFunc = function(tx, ty) {
      if (session.recording) {
        session.commands.push({ type: SVG_COMMAND.TRANSLATE, tx, ty });
      }
      callOriginalFunction(session.overrides.originals.translate, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'translate', newTranslateFunc);
    overrideFunction(getGlobalTarget(), 'translate', newTranslateFunc);
  }


  /**
   * @private
   * Overrides the p5.js rotate function to capture rotation transformations for SVG output.
   * Captures rotation angle for recording SVG output by storing a 'rotate' command.
   * https://p5js.org/reference/p5/rotate/
   */
  function overrideRotateFunction(){
    session.overrides.originals.rotate = getOriginalFunction('rotate');
    session.transformsExist = true;
    const newRotateFunc = function(angle) {
      if (session.recording) {
        session.commands.push({ type: SVG_COMMAND.ROTATE, angle });
      }
      callOriginalFunction(session.overrides.originals.rotate, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'rotate', newRotateFunc);
    overrideFunction(getGlobalTarget(), 'rotate', newRotateFunc);
  }


  /**
   * @private
   * Overrides the p5.js shearX function to capture X-axis skew for SVG output.
   * Captures shearing angle for recording SVG output by storing a 'shearx' command.
   * @see {@link https://p5js.org/reference/p5/shearX/}
   */
  function overrideShearXFunction(){
    session.overrides.originals.shearX = getOriginalFunction('shearX');
    session.transformsExist = true;
    const newShearXFunc = function(angle) {
      if (session.recording) {
        session.commands.push({ type: SVG_COMMAND.SHEAR_X, angle });
      }
      callOriginalFunction(session.overrides.originals.shearX, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'shearX', newShearXFunc);
    overrideFunction(getGlobalTarget(), 'shearX', newShearXFunc);
  }


  /**
   * @private
   * Overrides the p5.js shearY function to capture Y-axis skew for SVG output.
   * Captures shearing angle for recording SVG output by storing a 'sheary' command.
   * @see {@link https://p5js.org/reference/p5/shearY/}
   */
  function overrideShearYFunction(){
    session.overrides.originals.shearY = getOriginalFunction('shearY');
    session.transformsExist = true;
    const newShearYFunc = function(angle) {
      if (session.recording) {
        session.commands.push({ type: SVG_COMMAND.SHEAR_Y, angle });
      }
      callOriginalFunction(session.overrides.originals.shearY, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'shearY', newShearYFunc);
    overrideFunction(getGlobalTarget(), 'shearY', newShearYFunc);
  }



  /**
   * @private
   * Overrides the p5.js text function to capture SVG text commands for export.
   * Captures text content, position, font properties, alignment, and style for
   * later rendering in SVG format. Currently, it does not handle optional maxWidth
   * and maxHeight parameters and will issue a warning if these are provided.
   * @see {@link https://p5js.org/reference/p5/text/}
   */
  function overrideTextFunction() {
    session.overrides.originals.text = getOriginalFunction('text');
    const newTextFunc = function(content, x, y, maxWidth, maxHeight) {
      if (session.recording) {

        // Warn if maxWidth or maxHeight are provided
        if (typeof maxWidth !== 'undefined' || typeof maxHeight !== 'undefined') {
          console.warn('The SVG export does not yet support maxWidth or maxHeight for text rendering.');
        }

        // --- BEGIN @blvrd's FONT FIX ------------------------------------
        // https://github.com/golanlevin/p5.plotSvg/issues/17
        let font;
        const currentFont = session.p5Instance.textFont();

        if (typeof currentFont === 'string') {
          // User gave a raw string to textFont()
          font = currentFont;

        } else if (currentFont && currentFont.font && currentFont.font.names) {
          const names = currentFont.font.names;
          // Helper to resolve objects like { en: "...", jp: "..." }
          const resolve = v =>
            (typeof v === "string") ? v :
            (v && typeof v === "object") ? (v.en || v[Object.keys(v)[0]]) : "";
          // ORDER OF PREFERENCE (for SVG portability):
          // 1. fontFamily      → "Berkeley Mono Trial"
          // 2. fullName        → "Berkeley Mono Trial Regular"
          // 3. postScriptName  → "BerkeleyMonoTrial-Regular"
          let fontName =
            resolve(names.fontFamily) ||
            resolve(names.fullName) ||
            resolve(names.postScriptName) || "";
          font = fontName;

        } else {
          // Fallback
          font = String(currentFont || "");
        }
        // Sanitize accidental embedded quotes
        if (font) {
          font = font.replace(/"/g, "");
        }

        // --- END @blvrd FONT FIX --------------------------------------

        const fontSize = session.p5Instance.textSize();
        const alignX   = session.p5Instance.textAlign().horizontal;
        const alignY   = session.p5Instance.textAlign().vertical;
        const style    = session.p5Instance.textStyle();
        const leading  = session.p5Instance.textLeading();
        const ascent   = session.p5Instance.textAscent();
        const descent  = session.p5Instance.textDescent();
        let transformMatrix = captureCurrentTransformMatrix();

        // Push text command with properties
        session.commands.push({
          type: SVG_COMMAND.TEXT,
          content, x, y,
          font, fontSize, alignX, alignY,
          style, leading, ascent, descent,
          transformMatrix
        });
      }

      callOriginalFunction(session.overrides.originals.text, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'text', newTextFunc);
    overrideFunction(getGlobalTarget(), 'text', newTextFunc);
  }


  /**
   * @private
   * Exports the recorded p5.js drawing commands as an SVG file.
   * Generates an SVG string from the recorded drawing commands,
   * including any applied transforms, styles, and shape data.
   * Creates an SVG file and triggers a download for the generated
   * SVG. Resets the internal recording state upon completion.
   */
  function exportSVG() {
    let svgContent = "";

    // Check for unclosed groups and auto-close them with a warning
    if (session.groupStack.length > 0) {
      const unclosedNames = session.groupStack.slice().reverse();
      console.warn(`p5.plotSvg warning: ${session.groupStack.length} unclosed group(s) detected. ` +
        `Missing endSvgGroup() for: ${unclosedNames.map(n => `"${n}"`).join(', ')}. ` +
        `Auto-closing to produce valid SVG.`);
      // Auto-close the unclosed groups
      while (session.groupStack.length > 0) {
        session.commands.push({ type: SVG_COMMAND.END_GROUP });
        session.groupStack.pop();
      }
    }

    // Auto-inject Inkscape namespace if compatibility mode is enabled and groups exist
    if (config.inkscapeCompatibility) {
      const hasGroups = session.commands.some(cmd => cmd.type === SVG_COMMAND.BEGIN_GROUP);
      if (hasGroups || config.groupByStrokeColor) {
        p5plotSvg.injectSvgHeaderAttribute('xmlns:inkscape',
          'http://www.inkscape.org/namespaces/inkscape');
        p5plotSvg.injectSvgHeaderAttribute('inkscape:version', '1.4');
      }
    }

    let svgW = config.customSizeSet ? config.width : session.p5Instance.width;
    let svgH = config.customSizeSet ? config.height : session.p5Instance.height;
    let widthInches = svgW / config.dpi;
    let heightInches = svgH / config.dpi;

    // Determine dimensions and unit suffix based on unit mode
    let dimWidth, dimHeight, unitSuffix;
    if (config.unitMode === p5plotSvg.SVG_UNITS_CM) {
      dimWidth = widthInches * 2.54;
      dimHeight = heightInches * 2.54;
      unitSuffix = 'cm';
    } else {
      dimWidth = widthInches;
      dimHeight = heightInches;
      unitSuffix = 'in';
    }

    // The <svg> tag
    svgContent += `<svg `;
    svgContent += ` version="1.1" `;
    svgContent += ` xmlns="http://www.w3.org/2000/svg" `;
    svgContent += attrsToString(
      session.injectedHeaderAttributes,
      'SVG header attribute name',
      { trailingSpace: true }
    );
    svgContent += ` width="${dimWidth}${unitSuffix}" height="${dimHeight}${unitSuffix}" `;
    svgContent += ` viewBox="0 0 ${svgW} ${svgH}" `;
    if (config.backgroundColor) {
      svgContent += ` style="background-color: ${config.backgroundColor}" `;
    }
    svgContent += `>\n`;  // close the <svg> tag

    // The <defs> tag
    if (session.injectedDefs.length > 0) {
      svgContent += `  <defs>\n`;
      for (let def of session.injectedDefs) {
        const defType = normalizeXmlName(def.type, 'SVG defs element name');
        if (!defType) continue;
        svgContent += `    <${defType} `;
        svgContent += attrsToString(def.attributes, 'SVG defs attribute name', { trailingSpace: true });
        svgContent += ` />\n`;
      }
      svgContent += `  </defs>\n`;
    }

    // The <style> tag
    svgContent += `  <style>
      circle, ellipse, line, path, polygon, polyline, rect, quad, text {
        fill: none;
        stroke: ${config.defaultStrokeColor};
        stroke-width: ${config.defaultStrokeWeight};
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
    </style>\n`;

    const renderContext = {
      groupLevel: 0,
      currentStrokeColor: config.defaultStrokeColor,
      hasNonDefaultStrokeColor: false,
      transformGroupStack: []
    };
    for (let cmd of session.commands) {

      if (cmd.type === SVG_COMMAND.PUSH ||
          cmd.type === SVG_COMMAND.POP ||
          cmd.type === SVG_COMMAND.SCALE ||
          cmd.type === SVG_COMMAND.TRANSLATE ||
          cmd.type === SVG_COMMAND.ROTATE ||
          cmd.type === SVG_COMMAND.SHEAR_X ||
          cmd.type === SVG_COMMAND.SHEAR_Y) {

        if (!config.flattenTransforms && session.transformsExist) {
          if (cmd.type === SVG_COMMAND.PUSH) {
            // Open a new group
            svgContent += getIndentStr(renderContext);
            svgContent += `<g>\n`;
            renderContext.transformGroupStack.push(1);
            renderContext.groupLevel++;

          } else if (cmd.type === SVG_COMMAND.POP) {
            // Close the most recent group
            if (renderContext.transformGroupStack.length > 0) {
              while (renderContext.transformGroupStack[renderContext.transformGroupStack.length - 1] > 0){
                renderContext.transformGroupStack[renderContext.transformGroupStack.length - 1]--;
                renderContext.groupLevel = Math.max(0, renderContext.groupLevel - 1);
                svgContent += getIndentStr(renderContext);
                svgContent += `</g>\n`;
              }
              renderContext.transformGroupStack.pop();
            }

          } else {
            // Handle transformations by creating a group with a transform attribute
            let transformStr = '';
            if (cmd.type === SVG_COMMAND.SCALE) {
              transformStr = getSvgStrScale(cmd);
            } else if (cmd.type === SVG_COMMAND.TRANSLATE) {
              transformStr = getSvgStrTranslate(cmd);
            } else if (cmd.type === SVG_COMMAND.ROTATE) {
              transformStr = getSvgStrRotate(cmd);
            } else if (cmd.type === SVG_COMMAND.SHEAR_X) {
              transformStr = getSvgStrShearX(cmd);
            } else if (cmd.type === SVG_COMMAND.SHEAR_Y) {
              transformStr = getSvgStrShearY(cmd);
            }

            svgContent += getIndentStr(renderContext);
            svgContent += `<g transform="${transformStr}">\n`;

            if (renderContext.transformGroupStack.length > 0){
              renderContext.transformGroupStack[renderContext.transformGroupStack.length - 1]++;
            } else {
              renderContext.transformGroupStack.push(1);
            }
            renderContext.groupLevel++;
          }
        }

      } else if (cmd.type === SVG_COMMAND.STROKE) {
        handleSvgStrokeCommand(cmd, renderContext);
      } else {
        svgContent += getIndentStr(renderContext);
      }

      if (cmd.type === SVG_COMMAND.DESCRIPTION) {
        svgContent += getSvgStrDescription(cmd);
      } else if (cmd.type === SVG_COMMAND.BEGIN_GROUP) {
        svgContent += getSvgStrBeginGroup(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.END_GROUP) {
        svgContent += getSvgStrEndGroup(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.ARC) {
        svgContent += getSvgStrArc(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.BEZIER) {
        svgContent += getSvgStrBezier(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.CIRCLE) {
        svgContent += getSvgStrCircle(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.CURVE) {
        svgContent += getSvgStrCurve(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.SPLINE) {
        svgContent += getSvgStrSpline(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.ELLIPSE) {
        svgContent += getSvgStrEllipse(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.LINE) {
        svgContent += getSvgStrLine(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.POINT) {
        svgContent += getSvgStrPoint(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.QUAD) {
        svgContent += getSvgStrQuad(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.RECT) {
        svgContent += getSvgStrRect(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.TRIANGLE) {
        svgContent += getSvgStrTriangle(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.TEXT){
        svgContent += getSvgStrText(cmd, renderContext);

      } else if (cmd.type === SVG_COMMAND.POLYLINE){
        svgContent += getSvgStrPoly(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.PATH){
        svgContent += getSvgStrPoly(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.POINTS) {
        svgContent += getSvgStrPoints(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.LINES) {
        svgContent += getSvgStrLines(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.TRIANGLES) {
        svgContent += getSvgStrTriangles(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.TRIANGLE_FAN) {
        svgContent += getSvgStrTriangleFan(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.TRIANGLE_STRIP) {
        svgContent += getSvgStrTriangleStrip(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.QUADS) {
        svgContent += getSvgStrQuads(cmd, renderContext);
      } else if (cmd.type === SVG_COMMAND.QUAD_STRIP) {
        svgContent += getSvgStrQuadStrip(cmd, renderContext);
      }
    }

    // Close any remaining groups
    if (!config.flattenTransforms) {
      while (renderContext.transformGroupStack.length > 0) {
        while (renderContext.transformGroupStack[renderContext.transformGroupStack.length - 1] > 0){
          renderContext.transformGroupStack[renderContext.transformGroupStack.length - 1]--;
          renderContext.groupLevel = Math.max(0, renderContext.groupLevel - 1);
          svgContent += getIndentStr(renderContext);
          svgContent += `</g>\n`;
        }
        renderContext.transformGroupStack.pop();
      }
    }

    svgContent += `</svg>`;

    svgContent = postProcessSvgString(svgContent);

    let headerContent = ``;
    if (config.filename){ headerContent += `<!-- ${config.filename} -->\n`; }
    headerContent += `<!-- Generated using p5.js v.${getP5Version()} and p5.plotSvg v.${p5plotSvg.VERSION}: -->\n`;
    headerContent += `<!-- A Plotter-Oriented SVG Exporter for p5.js -->\n`;
    headerContent += `<!-- ${new Date().toString()} -->\n`;
    headerContent += `<!-- DPI: ${config.dpi} -->\n`;
    svgContent = headerContent + svgContent;

    if (config.filename !== null) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } else {
      // config.filename is explicitly null; do not save any file.
      // Probably you're using the returned SVG string in some other way.
    }

    session.vertexStack = [];
    session.injectedHeaderAttributes = [];
    session.injectedDefs = [];

    // Clear the public extension hook after export; it is only valid while recording.
    if (Array.isArray(session.commands)) session.commands.length = 0;
    session.commands = null;
    p5plotSvg._commands = null;
    return svgContent;
  }


  /**
   * @private
   * Applies DOMParser-based SVG post-processing to the generated SVG string.
   */
  function postProcessSvgString(svgContent) {
    if (config.mergeNamedGroups) {
      svgContent = mergeNamedGroupsInSvg(svgContent);
    }

    if (config.groupByStrokeColor) {
      svgContent = groupSvgElementsByStrokeColor(svgContent);
    }

    return svgContent;
  }


  /**
   * @private
   * Merges named groups in an SVG string by combining sibling groups with the same ID.
   * @param {string} svgString
   * @returns A SVG string with merged named groups.
   */
  function mergeNamedGroupsInSvg(svgString){
    const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");

    function processElement(element) {
      const children = Array.from(element.children);
      children.forEach((child) => processElement(child));
      const groupsById = new Map();
      const nodesToRemove = [];

      children.forEach((child) => {
        if (child.tagName === "g" && child.hasAttribute("id")) {
          const id = child.getAttribute("id");
          if (id !== "") {
            if (!groupsById.has(id)) {
              groupsById.set(id, []);
            }
            groupsById.get(id).push(child);
          }
        }
      });

      groupsById.forEach((groups, id) => {
        if (groups.length > 1) {
          const firstGroup = groups[0];
          const firstGroupDepth = getGroupDepth(firstGroup);

          for (let i = 1; i < groups.length; i++) {
            const groupToMerge = groups[i];
            const indent = '\n' + getIndentStr(firstGroupDepth + 1);

            while (groupToMerge.firstChild) {
              const child = groupToMerge.firstChild;
              if (child.nodeType === Node.ELEMENT_NODE) {
                firstGroup.appendChild(doc.createTextNode(indent));
                firstGroup.appendChild(child);
              } else {
                groupToMerge.removeChild(child);
              }
            }

            nodesToRemove.push(groupToMerge);
          }

          // Add a closing newline
          const closingIndent = '\n' + getIndentStr(firstGroupDepth);
          firstGroup.appendChild(doc.createTextNode(closingIndent));
        }
      });

      nodesToRemove.forEach((node) => {
        const next = node.nextSibling;
        // remove any empty text nodes left after the element to remove
        if (next && next.nodeType === Node.TEXT_NODE && /^\s*$/.test(next.nodeValue)) {
          element.removeChild(next);
        }
        element.removeChild(node);
      });
    }

    processElement(doc.documentElement);
    return new XMLSerializer().serializeToString(doc);
  }

  /**
   * @private
   * Group sibling elements by stroke color in an SVG string.
   * @param {string} svgString
   * @returns A SVG string with sibling elements grouped by stroke color.
   */
  function groupSvgElementsByStrokeColor(svgString) {
    const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");

    function processElement(element) {
      const children = Array.from(element.children);
      const colorGroups = new Map();
      const nodesToRemove = [];

      children.forEach((child) => processElement(child));

      children.forEach((child) => {
        const strokeColor = getStrokeColor(child);
        if (strokeColor && child.tagName !== 'g') {
          if (!colorGroups.has(strokeColor)) {
            colorGroups.set(strokeColor, []);
          }
          colorGroups.get(strokeColor).push(child);
          nodesToRemove.push(child);
        }
      });

      nodesToRemove.forEach((node) => {
        const next = node.nextSibling;
        // remove any empty text nodes left after the element to remove
        if (next && next.nodeType === Node.TEXT_NODE && /^\s*$/.test(next.nodeValue)) {
          element.removeChild(next);
        }
        element.removeChild(node);
      });

      colorGroups.forEach((elements, col) => {
        if (elements.length > 0) {
          const group = doc.createElementNS("http://www.w3.org/2000/svg", "g");
          const groupName = `stroke-color-group-${col.replace(/[^a-zA-Z0-9]/g, '-')}`;
          group.setAttribute('id', groupName);

          // Add Inkscape layer attributes if compatibility mode is enabled
          if (config.inkscapeCompatibility) {
            const layerNum = getOrAssignInkscapeLayerNumber(groupName);
            const labelValue = `${layerNum}_${groupName}`;
            group.setAttribute('inkscape:groupmode', 'layer');
            group.setAttribute('inkscape:label', labelValue);
          }

          element.appendChild(group);
          elements.forEach(elem => {
            group.appendChild(elem);
          });
        }
      });
    }

    processElement(doc.documentElement);
    return new XMLSerializer().serializeToString(doc);
  }

  /**
   * @private
   * Extracts the effective stroke color from an SVG element for post-processing.
   * Checks the direct stroke attribute first, then falls back to an inline style
   * declaration. Returns null for missing strokes and explicit "none" strokes.
   * @param {Element} element - SVG DOM element to inspect.
   * @returns {?string} The stroke color string, or null if no usable stroke is present.
   */
  function getStrokeColor(element) {
    if (element.hasAttribute('stroke')) {
      const stroke = element.getAttribute('stroke');
      if (stroke && stroke !== 'none') {
        return stroke;
      }
    }

    if (element.hasAttribute('style')) {
      const style = element.getAttribute('style');
      const strokeMatch = style.match(/stroke\s*:\s*([^;]+)/);
      if (strokeMatch && strokeMatch[1] && strokeMatch[1].trim() !== 'none') {
        return strokeMatch[1].trim();
      }
    }

    return null;
  }

  /**
   * @private
   * Helper function. Returns the current depth of an SVG group level.
   */
  function getGroupDepth(el) {
    let depth = 0;
    while (el.parentNode && el.parentNode.tagName === 'g') {
      depth++;
      el = el.parentNode;
    }
    return depth;
  }


  /**
   * @private
   * Generates an SVG scale transform string based on the given command object.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform}
   * @param {Object} cmd - The command object containing scale values.
   * @param {number} cmd.sx - The scale factor along the x-axis.
   * @param {number} cmd.sy - The scale factor along the y-axis.
   * @returns {string} The SVG scale transform string.
   */
  function getSvgStrScale(cmd){
    let sxStr = formatNumber(cmd.sx, config.transformPrecision);
    let syStr = formatNumber(cmd.sy, config.transformPrecision);
    let str = `scale(${sxStr}, ${syStr})`;
    return str;
  }


  /**
   * @private
   * Generates an SVG translate transform string based on the given command object.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform}
   * @param {Object} cmd - The command object containing translation values.
   * @param {number} cmd.tx - The translation distance along the x-axis.
   * @param {number} cmd.ty - The translation distance along the y-axis.
   * @returns {string} The SVG translate transform string.
   */
  function getSvgStrTranslate(cmd){
    let txStr = formatNumber(cmd.tx, config.transformPrecision);
    let tyStr = formatNumber(cmd.ty, config.transformPrecision);
    let str = `translate(${txStr}, ${tyStr})`;
    return str;
  }


  /**
   * @private
   * Generates an SVG rotate transform string based on the given command object.
   * Converts angles to degrees if necessary based on the current p5 angle mode.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform}
   * @param {Object} cmd - The command object containing rotation values.
   * @param {number} cmd.angle - The rotation angle.
   * @returns {string} The SVG rotate transform string.
   */
  function getSvgStrRotate(cmd){
    let angle = cmd.angle;
    if (session.p5Instance.angleMode() === session.p5Instance.RADIANS) {
      angle = (cmd.angle * 180) / Math.PI; // Convert radians to degrees
    }
    let angStr = formatNumber(angle, config.transformPrecision);
    let str = `rotate(${angStr})`;
    return str;
  }


  /**
   * @private
   * Generates an SVG skewX transform string based on the given command object.
   * Converts angles to degrees if necessary based on the current p5 angle mode.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform}
   * @param {Object} cmd - The command object containing the shear angle.
   * @param {number} cmd.angle - The shear angle along the x-axis.
   * @returns {string} The SVG skewX transform string in degrees.
   */
  function getSvgStrShearX(cmd) {
    let angle = cmd.angle;
    if (session.p5Instance.angleMode() === session.p5Instance.RADIANS) {
      angle = (cmd.angle * 180) / Math.PI; // Convert radians to degrees
    }
    let angStr = formatNumber(angle, config.transformPrecision);
    let str = `skewX(${angStr})`;
    return str;
  }


  /**
   * @private
   * Generates an SVG skewY transform string based on the given command object.
   * Converts angles to degrees if necessary based on the current p5 angle mode.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform}
   * @param {Object} cmd - The command object containing the shear angle.
   * @param {number} cmd.angle - The shear angle along the y-axis.
   * @returns {string} The SVG skewY transform string in degrees.
   */
  function getSvgStrShearY(cmd) {
    let angle = cmd.angle;
    if (session.p5Instance.angleMode() === session.p5Instance.RADIANS) {
      angle = (cmd.angle * 180) / Math.PI; // Convert radians to degrees
    }
    let angStr = formatNumber(angle, config.transformPrecision);
    let str = `skewY(${angStr})`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <desc> element string based on the given command object.
   * The <desc> element provides a textual description of the SVG content,
   * typically used for accessibility or metadata purposes.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Element/desc}
   * @param {Object} cmd - The command object containing description text.
   * @param {string} cmd.text - The description text to be included within the <desc> element.
   * @returns {string} The SVG <desc> element string with the provided description text.
   */
  function getSvgStrDescription(cmd){
    let str = `<desc>${escapeXmlText(cmd.text)}</desc>\n`;
    return str;
  }



  /**
   * @private
   * Generates an SVG string to start a new user-defined group element.
   * If a group name is provided, adds it as an ID attribute for the group.
   * If additional attributes are provided, they are included as well.
   * @param {Object} cmd - The command object containing group properties.
   * @param {string} [cmd.gname] - Optional group name used as the ID for the SVG group.
   * @param {Array} [cmd.attributes] - Optional array of additional attributes as { name, value } pairs.
   * @returns {string} The SVG string to open a new group.
   */
  function getSvgStrBeginGroup(cmd, renderContext) {
    let attrStr = '';

    // Include group name as ID if present
    if (cmd.gname) {
      attrStr += ` id="${escapeXmlAttribute(cmd.gname)}"`;
    }
    attrStr += attrsToString(cmd.attributes, 'SVG group attribute name', {
      skip: attr => attr.name === 'id' && cmd.gname,
      onAttr: (attr, attrName) => {
        if (attrName === 'style') {
          console.warn("Warning: Group 'style' attributes are overridden by CSS defaults in the SVG. Use e.g. stroke() instead.");
        }
      }
    });

    let str = getIndentStr(renderContext);
    str += `<g${attrStr}>\n`;
    renderContext.groupLevel++;
    return str;
  }



  /**
   * @private
   * Generates an SVG string to end the current group element.
   * Decreases the SVG group level counter to track nested groups.
   * @param {Object} cmd - The command object (not used but included for consistency).
   * @returns {string} The SVG string to close the group.
   */
  function getSvgStrEndGroup(cmd, renderContext){
    // Close the current group
    renderContext.groupLevel = Math.max(0, renderContext.groupLevel - 1);
    let str = `</g>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <path> element string representing an elliptical arc,
   * based on the given command object. Supports optional modes for chord and pie-slice shapes.
   * @param {Object} cmd - The command object containing arc parameters and optional mode.
   * @returns {string} The SVG <path> element string with formatted arc data.
   */
  function getSvgStrArc(cmd, renderContext) {
    // Generate the base arc path using p5ArcToSvgPath()
    let svgArcData = p5ArcToSvgPath(cmd.x, cmd.y, cmd.w, cmd.h, cmd.start, cmd.stop);
    let transformStr = generateTransformString(cmd);
    let styleStr = getSvgStrStroke(renderContext);
    let str = `<path d="` + svgArcData;

    // Extract the end point of the arc from svgArcData
    let endPoint = svgArcData.split(" ").slice(-2).join(" ");

    if (cmd.mode === session.p5Instance.CHORD) {
      // Add a line segment to connect the arc endpoints
      str += ` L ${endPoint}`;
      str += ` Z`; // Close the path

    } else if (cmd.mode === session.p5Instance.PIE) {
      // Add lines from the center to the end point to form a "pie" slice
      let ctrX = formatNumber(cmd.x);
      let ctrY = formatNumber(cmd.y);
      str += ` L ${endPoint} L ${ctrX} ${ctrY} Z`; // Connect end to center
    }

    str += `"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <path> element string representing a cubic Bézier curve,
   * based on the given command object.
   * @param {Object} cmd - The command object containing Bézier curve control points.
   * @returns {string} The SVG <path> element string with formatted control points.
   */
  function getSvgStrBezier(cmd, renderContext){
    let x1Str = formatNumber(cmd.x1);
    let y1Str = formatNumber(cmd.y1);
    let x2Str = formatNumber(cmd.x2);
    let y2Str = formatNumber(cmd.y2);
    let x3Str = formatNumber(cmd.x3);
    let y3Str = formatNumber(cmd.y3);
    let x4Str = formatNumber(cmd.x4);
    let y4Str = formatNumber(cmd.y4);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let str = `<path d="M ${x1Str},${y1Str} C ${x2Str},${y2Str} ${x3Str},${y3Str} ${x4Str},${y4Str}"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <circle> element string based on the given command object.
   * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
   * @param {Object} cmd - The command object containing circle parameters.
   * @returns {string} The SVG <circle> element string with formatted position and radius.
   */
  function getSvgStrCircle(cmd, renderContext){
    let xStr = formatNumber(cmd.x);
    let yStr = formatNumber(cmd.y);
    let rStr = formatNumber(cmd.d/2.0);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let str = `<circle cx="${xStr}" cy="${yStr}" r="${rStr}"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <path> element string representing a Catmull-Rom curve segment.
   * @param {Object} cmd - The command object containing control points for the curve.
   * @returns {string} The SVG <path> element string with the necessary Bézier segment.
   */
  function getSvgStrCurve(cmd, renderContext){
    // Prepare the control points for the Catmull-Rom to Bézier conversion
    let crp = [cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x3, cmd.y3, cmd.x4, cmd.y4];
    let bClosed = false; // `false` for an open curve

    // Convert to Bézier segments using the tightness stored with this command
    let bezierSegments = catmullRom2bezier(crp, bClosed, cmd.tightness);

    // The segment we need is the one between (x2, y2) and (x3, y3)
    let targetSegment = bezierSegments[1];

    // Format the starting point (x2, y2)
    let x2Str = formatNumber(cmd.x2);
    let y2Str = formatNumber(cmd.y2);

    // Format the control points and endpoint for the Bézier segment
    let cx1Str = formatNumber(targetSegment[0]);
    let cy1Str = formatNumber(targetSegment[1]);
    let cx2Str = formatNumber(targetSegment[2]);
    let cy2Str = formatNumber(targetSegment[3]);
    let x3Str = formatNumber(targetSegment[4]);
    let y3Str = formatNumber(targetSegment[5]);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);

    // Construct the SVG path string with only the necessary segment
    let str = `<path d="M ${x2Str},${y2Str} C ${cx1Str},${cy1Str} ${cx2Str},${cy2Str} ${x3Str},${y3Str}"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <path> for p5.js v2 spline() commands.
   */
  function getSvgStrSpline(cmd, renderContext) {
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let d = getSplinePathData(
      cmd.points,
      cmd.closed,
      cmd.tightness,
      shouldIncludeSplineEnds(cmd.endsMode)
    );
    if (!d) return '';
    return `<path d="${d}"${styleStr}${transformStr}/>\n`;
  }


  /**
   * @private
   * Generates an SVG <ellipse> element string based on the given command object.
   * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element/ellipse
   * @param {Object} cmd - The command object containing ellipse parameters.
   * @returns {string} The SVG <ellipse> element string with formatted center and radii.
   */
  function getSvgStrEllipse(cmd, renderContext){
    let xStr = formatNumber(cmd.x);
    let yStr = formatNumber(cmd.y);
    let rxStr = formatNumber(cmd.w/2);
    let ryStr = formatNumber(cmd.h/2);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let str = `<ellipse cx="${xStr}" cy="${yStr}" rx="${rxStr}" ry="${ryStr}"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <line> element string based on the given command object.
   * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element/line
   * @param {Object} cmd - The command object containing line endpoints.
   * @returns {string} The SVG <line> element string with formatted endpoints.
   */
  function getSvgStrLine(cmd, renderContext) {
    let x1Str = formatNumber(cmd.x1);
    let y1Str = formatNumber(cmd.y1);
    let x2Str = formatNumber(cmd.x2);
    let y2Str = formatNumber(cmd.y2);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let str = `<line x1="${x1Str}" y1="${y1Str}" x2="${x2Str}" y2="${y2Str}"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <circle> element string representing a point, based on the given command.
   * @param {Object} cmd - The command object containing point position and radius.
   * @returns {string} The SVG <circle> element string with formatted position and radius.
   */
  function getSvgStrPoint(cmd, renderContext){
    let xStr = formatNumber(cmd.x);
    let yStr = formatNumber(cmd.y);
    let rStr = formatNumber(cmd.radius);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let str = `<circle cx="${xStr}" cy="${yStr}" r="${rStr}"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <polygon> element string representing a quadrilateral,
   * based on the given command object.
   * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polygon
   * @param {Object} cmd - The command object containing quad vertices.
   * @returns {string} The SVG <polygon> element string with formatted vertex coordinates.
   */
  function getSvgStrQuad(cmd, renderContext){
    let x1Str = formatNumber(cmd.x1);
    let y1Str = formatNumber(cmd.y1);
    let x2Str = formatNumber(cmd.x2);
    let y2Str = formatNumber(cmd.y2);
    let x3Str = formatNumber(cmd.x3);
    let y3Str = formatNumber(cmd.y3);
    let x4Str = formatNumber(cmd.x4);
    let y4Str = formatNumber(cmd.y4);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let str = `<polygon points="${x1Str},${y1Str} ${x2Str},${y2Str} ${x3Str},${y3Str} ${x4Str},${y4Str}"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * @private
   * Generates an SVG <rect> or <path> element string for a rectangle, based on the given command object.
   * Supports rectangles with individual or uniform corner radii.
   * @param {Object} cmd - The command object containing rectangle parameters and optional corner radii.
   * @returns {string} The SVG <rect> or <path> element string with formatted position, size, and corners.
   */
  function getSvgStrRect(cmd, renderContext) {
    let xStr = formatNumber(cmd.x);
    let yStr = formatNumber(cmd.y);
    let wStr = formatNumber(cmd.w);
    let hStr = formatNumber(cmd.h);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let maxRadius = Math.min(cmd.w, cmd.h) / 2;
    let str = "";

    if (cmd.tl !== undefined && cmd.tr !== undefined &&
        cmd.br !== undefined && cmd.bl !== undefined) {

      // If all four are exactly equal, do a simple rounded rectangle
      if (cmd.tl === cmd.tr && cmd.tr === cmd.br && cmd.br === cmd.bl) {
        cmd.tl = Math.min(cmd.tl, maxRadius);
        let rStr = formatNumber(cmd.tl);
        str = `<rect x="${xStr}" y="${yStr}" width="${wStr}" height="${hStr}" rx="${rStr}" ry="${rStr}"${styleStr}${transformStr}/>\n`;

      } else {
        // Constrain corner radii: tl <= min(w, h)/2, tr <= min(w, h)/2, etc.
        cmd.tl = Math.min(cmd.tl, maxRadius);
        cmd.tr = Math.min(cmd.tr, maxRadius);
        cmd.br = Math.min(cmd.br, maxRadius);
        cmd.bl = Math.min(cmd.bl, maxRadius);

        // Individual corner radii specified; use a path
        let xtl = cmd.x + cmd.tl;
        let ytl = cmd.y + cmd.tl;
        let xtr = cmd.x + cmd.w - cmd.tr;
        let ytr = cmd.y + cmd.tr;
        let xbr = cmd.x + cmd.w - cmd.br;
        let ybr = cmd.y + cmd.h - cmd.br;
        let xbl = cmd.x + cmd.bl;
        let ybl = cmd.y + cmd.h - cmd.bl;

        // Calculate control points for each corner, using the multiplier c
        // See: https://spencermortensen.com/articles/bezier-circle/
        const c = 0.55191502449351; // For cubic Bézier arc approximation
        let ctlX = cmd.tl * c;
        let ctlY = cmd.tl * c;
        let ctrX = cmd.tr * c;
        let ctrY = cmd.tr * c;
        let cbrX = cmd.br * c;
        let cbrY = cmd.br * c;
        let cblX = cmd.bl * c;
        let cblY = cmd.bl * c;

        // Construct the path using cubic Bézier curves for each corner
        str = `<path d="M ${formatNumber(xtl)},${formatNumber(cmd.y)} ` +
          `H ${formatNumber(xtr)} ` +
          `C ${formatNumber(xtr + ctrX)},${formatNumber(cmd.y)}` +
          ` ${formatNumber(cmd.x + cmd.w)},${formatNumber(ytr - ctrY)}`+
          ` ${formatNumber(cmd.x + cmd.w)},${formatNumber(ytr)} ` + // Top-right corner
          `V ${formatNumber(ybr)} ` +
          `C ${formatNumber(cmd.x + cmd.w)},${formatNumber(ybr + cbrY)}`+
          ` ${formatNumber(xbr + cbrX)},${formatNumber(cmd.y + cmd.h)}`+
          ` ${formatNumber(xbr)},${formatNumber(cmd.y + cmd.h)} ` + // Bottom-right corner
          `H ${formatNumber(xbl)} ` +
          `C ${formatNumber(xbl - cblX)},${formatNumber(cmd.y + cmd.h)}`+
          ` ${formatNumber(cmd.x)},${formatNumber(ybl + cblY)}`+
          ` ${formatNumber(cmd.x)},${formatNumber(ybl)} ` + // Bottom-left corner
          `V ${formatNumber(ytl)} ` +
          `C ${formatNumber(cmd.x)},${formatNumber(ytl - ctlY)}`+
          ` ${formatNumber(xtl - ctlX)},${formatNumber(cmd.y)}`+
          ` ${formatNumber(xtl)},${formatNumber(cmd.y)} Z"${styleStr}${transformStr}/>\n`;
      }

    } else if (cmd.tl !== undefined) {
      // Use a single rounded radius for all corners
      cmd.tl = Math.min(cmd.tl, maxRadius);
      let rStr = formatNumber(cmd.tl);
      str = `<rect x="${xStr}" y="${yStr}" width="${wStr}" height="${hStr}" rx="${rStr}" ry="${rStr}"${styleStr}${transformStr}/>\n`;

    } else {
      // Standard rectangle without rounded corners
      str = `<rect x="${xStr}" y="${yStr}" width="${wStr}" height="${hStr}"${styleStr}${transformStr}/>\n`;
    }
    return str;
  }


  /**
   * @private
   * Generates an SVG <polygon> element string representing a triangle, based on the given command object.
   * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polygon
   * @param {Object} cmd - The command object containing triangle vertices.
   * @returns {string} The SVG <polygon> element string with formatted vertex coordinates.
   */
  function getSvgStrTriangle(cmd, renderContext){
    let x1Str = formatNumber(cmd.x1);
    let y1Str = formatNumber(cmd.y1);
    let x2Str = formatNumber(cmd.x2);
    let y2Str = formatNumber(cmd.y2);
    let x3Str = formatNumber(cmd.x3);
    let y3Str = formatNumber(cmd.y3);
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let str = `<polygon points="${x1Str},${y1Str} ${x2Str},${y2Str} ${x3Str},${y3Str}"${styleStr}${transformStr}/>\n`;
    return str;
  }


  /**
   * Set whether or not to merge SVG groups with the same name.
   * @param {boolean} bEnabled - Enable or disables merging of named SVG groups.
   * Default is `true`: groups with the same name, at the same level, will be merged.
   */
  p5plotSvg.setSvgMergeNamedGroups = function(bEnabled) {
    if (bEnabled === true){
      config.mergeNamedGroups = true;
    } else {
      config.mergeNamedGroups = false;
    }
  }


  /**
   * Enables or disables Inkscape-compatible layer attributes for SVG groups.
   * When enabled (default), groups created with beginSvgGroup() will include
   * inkscape:groupmode="layer" and auto-numbered inkscape:label attributes,
   * making them compatible with Inkscape, vpype, and AxiDraw software.
   * @param {boolean} bEnabled - Enable or disable Inkscape layer compatibility.
   * Default is `true`: groups will include Inkscape layer attributes.
   */
  p5plotSvg.setSvgInkscapeCompatibility = function(bEnabled) {
    if (bEnabled === true) {
      config.inkscapeCompatibility = true;
    } else {
      config.inkscapeCompatibility = false;
    }
  }


  /**
   * Set whether or not to group elements by stroke color.
   * @param {boolean} bEnabled - Enable or disables grouping of elements by stroke color.
   * Default is `false`: elements with the same stroke color, at the same level, will be grouped.
   */
  p5plotSvg.setSvgGroupByStrokeColor = function(bEnabled) {
    if (bEnabled === true){
      config.groupByStrokeColor = true;
    } else {
      config.groupByStrokeColor = false;
    }
  }


  /**
   * Sets the default stroke weight for SVG elements.
   * @param {number} wei - The stroke weight to set.
   */
  p5plotSvg.setSvgDefaultStrokeWeight = function(wei) {
    if (typeof wei === 'number' && wei >= 0) {
      config.defaultStrokeWeight = wei;
    } else {
      console.warn("Invalid stroke weight. Please provide a positive number.");
    }
  }


  /**
   * Sets the default stroke color for SVG elements.
   * @param {string} col - The stroke color to set, in valid CSS color format.
   */
  p5plotSvg.setSvgDefaultStrokeColor = function(col) {
    if (isValidCssColor(col)) {
      config.defaultStrokeColor = col;
    } else {
      console.warn("Invalid stroke color. Provide a valid CSS color string (e.g., 'red', '#ff0000', 'rgb(255,0,0)').");
    }
  }


  /**
   * @public
   * Sets the background color for the exported SVG.
   * This adds a `style="background-color: ..."` attribute to the root <svg> element.
   * This color does not interfere with plotter output and is purely for visualization.
   * Note that this color may not be visible in all SVG viewers.
   * @param {string} col - The background color to set, in valid CSS color format.
   */
  p5plotSvg.setSvgBackgroundColor = function(col) {
    if (isValidCssColor(col)) {
      config.backgroundColor = col;
    } else {
      console.warn("Invalid background color. Provide a valid CSS color string (e.g., 'ivory', '#FFFFF0', 'rgb(255,255,240)').");
    }
  }

  /**
   * @public
   * Sets the dimensions of the SVG document in pixels/dots.
   * Note that graphics are not scaled to fit this size; they may extend beyond the specified dimensions.
   * If this is not set, the system will default to the main canvas dimensions (i.e. from `createCanvas()`).
   * @param {number} w - The SVG document width in pixels/dots. Must be a positive number.
   * @param {number} h - The SVG document height in pixels/dots. Must be a positive number.
   */
  p5plotSvg.setSvgDocumentSize = function (w, h){
    if ((typeof w === 'number' && w > 0) && (typeof h === 'number' && h > 0)){
      config.customSizeSet = true;
      config.width = w;
      config.height = h;
    }
  }

  /**
   * @public
   * @deprecated Use p5plotSvg.setSvgDocumentSize() instead.
   * Backward-compatible wrapper for the original capitalized API name.
   */
  p5plotSvg.setSVGDocumentSize = function() {
    console.warn("setSVGDocumentSize() is deprecated. The new name is setSvgDocumentSize().");
    return p5plotSvg.setSvgDocumentSize.apply(p5plotSvg, arguments);
  };


  /**
   * @public
   * Sets the resolution for the exported SVG file in dots per inch (DPI).
   * This value is used to determine the scaling of units (pixels to physical dimensions) in the SVG output.
   * @param {number} dpi - The resolution in dots per inch. Must be a positive number.
   */
  p5plotSvg.setSvgResolutionDPI = function(dpi) {
    if (typeof dpi === 'number' && dpi > 0) {
      config.dpi = dpi;
      config.unitMode = p5plotSvg.SVG_UNITS_IN;
    } else {
      console.warn("Invalid DPI value. Please provide a positive number.");
    }
  }


  /**
   * @public
   * Sets the resolution for the exported SVG file in dots per centimeter (DPCM).
   * This value is used to determine the scaling of units (pixels to physical dimensions) in the SVG output.
   * The default resolution is approximately 37.79527559 dpcm (equivalent to 96 dpi).
   * @param {number} dpcm - The resolution in dots per centimeter. Must be a positive number.
   */
  p5plotSvg.setSvgResolutionDPCM = function(dpcm) {
    if (typeof dpcm === 'number' && dpcm > 0) {
      config.dpi = dpcm * 2.54;
      config.unitMode = p5plotSvg.SVG_UNITS_CM;
    } else {
      console.warn("Invalid DPCM value. Please provide a positive number.");
    }
  }


  /**
   * Sets the type and amount of indentation used for formatting SVG output.
   * The function allows for spaces, tabs, or no indentation.
   * @param {string} itype - The type of indentation to use. Valid values are
   * 'SVG_INDENT_SPACES', 'SVG_INDENT_TABS', or 'SVG_INDENT_NONE'.
   * @param {number} [inum] - Optional number of spaces or tabs to use for indentation.
   * Must be a non-negative integer if provided. Defaults to 2 for spaces and 1 for tabs.
   */
  p5plotSvg.setSvgIndent = function(itype, inum) {
    // Set indent type if it matches one of the predefined constants
    if (itype === p5plotSvg.SVG_INDENT_SPACES ||
        itype === p5plotSvg.SVG_INDENT_TABS ||
        itype === p5plotSvg.SVG_INDENT_NONE) {
      config.indentType = itype;
    } else {
      console.warn("Invalid indent type. Use SVG_INDENT_SPACES, SVG_INDENT_TABS, or SVG_INDENT_NONE.");
    }

    // Set indent amount if `inum` is provided
    if (inum !== undefined && Number.isInteger(inum) && inum >= 0) {
      if (config.indentType === p5plotSvg.SVG_INDENT_NONE){
        config.indentAmount = 0;
      } else {
        config.indentAmount = inum;
      }
    } else {
      // Defaults
      if (config.indentType === p5plotSvg.SVG_INDENT_SPACES){
        config.indentAmount = 2;
      } else if (config.indentType === p5plotSvg.SVG_INDENT_TABS){
        config.indentAmount = 1;
      } else if (config.indentType === p5plotSvg.SVG_INDENT_NONE){
        config.indentAmount = 0;
      }
    }
  }


  /**
   * @private
   * Generates a string representing the current level of indentation.
   * Optionally accepts a manual depth override.
   * @param {Object|number} [renderContext] - Current render context, or a depth override for post-processing callers.
   * @param {number} [depthOverride] - Optional; if provided, overrides the current group depth.
   * @returns {string} A string containing the appropriate number of spaces
   * or tabs for the current indentation level, or an empty string if no
   * indentation is set.
   */
  function getIndentStr(renderContext, depthOverride) {
    if (typeof renderContext === 'number' && typeof depthOverride === 'undefined') {
      depthOverride = renderContext;
      renderContext = null;
    }
    let out = '';
    let depth = (typeof depthOverride === 'number') ? depthOverride : (renderContext ? renderContext.groupLevel : 0);

    if ((config.indentType !== p5plotSvg.SVG_INDENT_NONE) && (config.indentAmount > 0)) {
      const c = (config.indentType === p5plotSvg.SVG_INDENT_SPACES) ? ' ' : '\t';
      for (let i = 0; i < depth; i++) {
        for (let j = 0; j < config.indentAmount; j++) {
          out += c;
        }
      }
    }
    return out;
  }


  /**
   * Set whether or not to use a stack to encode matrix transforms.
   * setSvgFlattenTransforms(true) -- larger SVG files, greater fidelity to original
   * setSvgFlattenTransforms(false) -- smaller SVG files, potentially less fidelity
   */
  p5plotSvg.setSvgFlattenTransforms = function(b) {
    if (b === true){
      config.flattenTransforms = true;
    } else {
      config.flattenTransforms = false;
    }
  }


  /**
   * Sets the output precision for graphics coordinates in SVGs by adjusting
   * the number of decimal digits used when formatting values.
   * @param {number} p - The desired number of decimal digits for coordinates.
   * Must be a non-negative integer. If an invalid value is provided, a warning is issued.
   */
  p5plotSvg.setSvgCoordinatePrecision = function(p) {
    // Check if p` is a number and an integer
    if (typeof p === 'number' && Number.isInteger(p) && (p >= 0)) {
      config.coordPrecision = p;
    } else {
      console.warn('Invalid precision value.');
    }
  }


  /**
   * Sets the output precision for matrix-transform values in SVGs by adjusting
   * the number of decimal digits used when formatting rotations, translations, etc.
   * @param {number} p - The desired number of decimal digits for matrix values.
   * Must be a non-negative integer. If an invalid value is provided, a warning is issued.
   */
  p5plotSvg.setSvgTransformPrecision = function(p) {
    // Check if p` is a number and an integer
    if (typeof p === 'number' && Number.isInteger(p) && (p >= 0)) {
      config.transformPrecision = p;
    } else {
      console.warn('Invalid precision value.');
    }
  }


  /**
   * Sets the radius for points (rendered as tiny circles) in the SVG output.
   * @param {number} radius - The desired radius for points, specified as a positive number.
   * If an invalid value (non-positive or non-number) is provided, a warning is issued.
   */
  p5plotSvg.setSvgPointRadius = function(radius) {
    if (typeof radius === 'number' && radius > 0) {
      config.pointRadius = radius;
    } else {
      console.warn("Invalid radius. Please provide a positive number.");
    }
  }


  /**
   * Sets whether to export all polylines as <path> elements instead.
   * This is useful for extension code or downstream tools that need path elements.
   * @param {boolean} b - true to export polylines as <path>, false to keep as <polyline>
   */
  p5plotSvg.setSvgExportPolylinesAsPaths = function(b) {
    if (b === true){
      config.exportPolylinesAsPaths = true;
    } else {
      config.exportPolylinesAsPaths = false;
    }
  }


  /**
   * @private
   * Gets or assigns a layer number for a group name.
   * If the group name has been seen before, returns its existing layer number.
   * Otherwise, assigns the next available layer number (skipping any that
   * are already in use from explicit user assignments).
   * @param {string|undefined} gname - The group name (may be undefined for unnamed groups)
   * @returns {number} The layer number for this group
   */
  function getOrAssignInkscapeLayerNumber(gname) {
    if (!gname) {
      // Unnamed groups get a new number each time
      // Skip numbers that are already in use
      while (session.layers.inkscapeUsedLabels.has(String(session.layers.inkscapeNextLayerNumber))) {
        session.layers.inkscapeNextLayerNumber++;
      }
      const num = session.layers.inkscapeNextLayerNumber;
      const labelValue = String(num);
      // Store both the number and full label for collision detection
      session.layers.inkscapeUsedLabels.set(String(num), '(unnamed group)');
      session.layers.inkscapeUsedLabels.set(labelValue, '(unnamed group)');
      session.layers.inkscapeNextLayerNumber++;
      return num;
    }

    // Named groups: check if we've seen this name before
    if (session.layers.inkscapeLayerMap.has(gname)) {
      return session.layers.inkscapeLayerMap.get(gname);
    }

    // New group name - skip numbers already in use (from explicit labels)
    while (session.layers.inkscapeUsedLabels.has(String(session.layers.inkscapeNextLayerNumber))) {
      session.layers.inkscapeNextLayerNumber++;
    }
    const num = session.layers.inkscapeNextLayerNumber;
    const labelValue = `${num}_${gname}`;
    session.layers.inkscapeLayerMap.set(gname, num);
    // Store both the number (for skip logic) and full label (for collision detection)
    session.layers.inkscapeUsedLabels.set(String(num), gname);
    session.layers.inkscapeUsedLabels.set(labelValue, gname);
    session.layers.inkscapeNextLayerNumber++;
    return num;
  }


  /**
   * @private
   * Checks for collision with an explicitly provided inkscape:label.
   * Warns if the same label is being used by a different group name.
   * @param {string} label - The inkscape:label value provided by user
   * @param {string|undefined} gname - The current group's name
   */
  function checkInkscapeLabelCollision(label, gname) {
    const labelStr = String(label);
    const existingOwner = session.layers.inkscapeUsedLabels.get(labelStr);
    if (existingOwner && existingOwner !== gname) {
      console.warn(`p5.plotSvg warning: inkscape:label "${labelStr}" is already ` +
        `used by group "${existingOwner}". Duplicate labels may cause unexpected ` +
        `behavior in Inkscape/plotter software.`);
    }
  }


  /**
   * Begins a new user-defined grouping of SVG elements.
   * Optionally assigns a group name (as an SVG ID), and/or custom attributes.
   * Be sure to call `endSvgGroup()` later or the SVG file will report errors.
   *
   * @param {string|object} [gnameOrAttrs] - Optional group name as a string,
   *   or an attributes object if no name is needed.
   * @param {object} [attrs] - Optional object containing additional attributes.
   */
  p5plotSvg.beginSvgGroup = function(gnameOrAttrs, attrs) {
    if (session.recording) {
      let group = { type: SVG_COMMAND.BEGIN_GROUP };
      let userProvidedInkscapeLabel = null;
      let userProvidedInkscapeGroupmode = false;

      if (typeof gnameOrAttrs === 'string') {
        const trimmedName = gnameOrAttrs.trim();
        if (trimmedName.length > 0) {
          group.gname = trimmedName;
        }
        if (attrs && typeof attrs === 'object') {
          const attrArray = [];
          for (let key in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, key)) {
              attrArray.push({ name: key, value: String(attrs[key]) });
              // Track user-provided Inkscape attributes
              if (key === 'inkscape:label') {
                userProvidedInkscapeLabel = String(attrs[key]);
              }
              if (key === 'inkscape:groupmode') {
                userProvidedInkscapeGroupmode = true;
              }
            }
          }
          if (attrArray.length > 0) {
            group.attributes = attrArray;
          }
        }
      } else if (typeof gnameOrAttrs === 'object' && gnameOrAttrs !== null) {
        // Only attributes provided, no group name
        const attrArray = [];
        for (let key in gnameOrAttrs) {
          if (Object.prototype.hasOwnProperty.call(gnameOrAttrs, key)) {
            attrArray.push({ name: key, value: String(gnameOrAttrs[key]) });
            // Track user-provided Inkscape attributes
            if (key === 'inkscape:label') {
              userProvidedInkscapeLabel = String(gnameOrAttrs[key]);
            }
            if (key === 'inkscape:groupmode') {
              userProvidedInkscapeGroupmode = true;
            }
            // Extract id as group name if provided in object form
            if (key === 'id') {
              group.gname = String(gnameOrAttrs[key]);
            }
          }
        }
        if (attrArray.length > 0) {
          group.attributes = attrArray;
        }
      }

      // Auto-inject Inkscape attributes if compatibility mode is enabled
      if (config.inkscapeCompatibility) {
        if (!group.attributes) {
          group.attributes = [];
        }

        // Auto-add groupmode="layer" if not provided by user
        if (!userProvidedInkscapeGroupmode) {
          group.attributes.push({ name: 'inkscape:groupmode', value: 'layer' });
        }

        // Handle inkscape:label assignment
        if (userProvidedInkscapeLabel !== null) {
          // User provided explicit label - check for collision and mark as used
          checkInkscapeLabelCollision(userProvidedInkscapeLabel, group.gname);
          session.layers.inkscapeUsedLabels.set(userProvidedInkscapeLabel, group.gname || '(unnamed group)');
        } else {
          // Auto-generate label from layer number and group name
          const layerNum = getOrAssignInkscapeLayerNumber(group.gname);
          const labelValue = group.gname ? `${layerNum}_${group.gname}` : String(layerNum);
          group.attributes.push({ name: 'inkscape:label', value: labelValue });
        }
      }

      session.commands.push(group);
      session.groupStack.push(group.gname || '(unnamed group)');
    }
  };



  /**
   * Ends the current user-defined group of SVG elements.
   */
  p5plotSvg.endSvgGroup = function() {
    // Push an 'endGroup' command to signify closing the group
    if (session.recording) {
      session.commands.push({ type: SVG_COMMAND.END_GROUP });
      if (session.groupStack.length > 0) {
        session.groupStack.pop();
      }
    }
  }


  /**
   * @private
   * Converts a p5.js-style arc into an SVG elliptical arc path string.
   * Handles discrepancies between p5.js and SVG elliptical arc conventions,
   * including angle transformations and aspect ratio adjustments.
   * Converts degrees to radians depending on p5's angleMode().
   *
   * @param {number} x - The x-coordinate of the arc's center.
   * @param {number} y - The y-coordinate of the arc's center.
   * @param {number} w - The width (diameter) of the arc.
   * @param {number} h - The height (diameter) of the arc.
   * @param {number} start - The starting angle of the arc
   * @param {number} stop - The stopping angle of the arc
   * @returns {string} The SVG path data string for the arc.
   */
  function p5ArcToSvgPath(x, y, w, h, start, stop) {
    let rx = w / 2;
    let ry = h / 2;

    let startRadians = start;
    let stopRadians = stop;
    if (session.p5Instance.angleMode() === session.p5Instance.DEGREES) {
      startRadians = degreesToRadians(start);
      stopRadians = degreesToRadians(stop);
    }

    // Cope with discrepancies between how p5 & SVG do elliptical arcs.
    // p5 sets the angle absolutely; SVG stretches the angle by aspect ratio.
    if ((h > 0) && (w > 0) && (w != h)){
      let dxA = cos(startRadians);
      let dyA = sin(startRadians);
      startRadians = atan2(dyA, dxA/(w/h));

      let dxB = cos(stopRadians);
      let dyB = sin(stopRadians);
      stopRadians = atan2(dyB, dxB/(w/h));
    }

    // Calculate start and end points
    let startX = x + rx * Math.cos(startRadians);
    let startY = y + ry * Math.sin(startRadians);
    let endX = x + rx * Math.cos(stopRadians);
    let endY = y + ry * Math.sin(stopRadians);

    // Calculate the absolute angle difference, normalize for full circle
    let deltaAngle = (stopRadians - startRadians) % (2 * Math.PI);
    if (deltaAngle < 0) deltaAngle += 2 * Math.PI;

    // Determine if the arc is greater than 180° (large-arc-flag)
    let largeArcFlag = (deltaAngle > Math.PI) ? 1 : 0;

    // Set the sweep flag based on the direction of the angle
    let sweepFlag = deltaAngle > 0 ? 1 : 0;

    // Format numbers for SVG path data
    let rxStr = formatNumber(rx);
    let ryStr = formatNumber(ry);
    let sxStr = formatNumber(startX);
    let syStr = formatNumber(startY);
    let exStr = formatNumber(endX);
    let eyStr = formatNumber(endY);

    // Generate the SVG path data string
    return `M ${sxStr} ${syStr} A ${rxStr} ${ryStr} 0 ${largeArcFlag} ${sweepFlag} ${exStr} ${eyStr}`;
  }


  /**
   * @private
   * Converts a flat Catmull-Rom point list into SVG cubic Bezier segments.
   * Based on p5.Font's curve conversion and modified to honor p5's
   * curveTightness() value.
   * Source reference:
   * https://github.com/processing/p5.js/blob/e32b45367baad694b1f4eeec0586b910bfcf0724/src/typography/p5.Font.js#L1099
   * @param {number[]} crp - Flat point list in [x0, y0, x1, y1, ...] order.
   * @param {boolean} z - Whether the Catmull-Rom path is closed.
   * @param {number} [tightness=0] - p5 curve tightness value.
   * @returns {number[][]} Cubic Bezier segments as [x1, y1, x2, y2, x, y].
   */
  function catmullRom2bezier(crp, z, tightness = 0) {
    const s = 1 - tightness; // Scale factor for control point influence
    const d = [];
    for (let i = 0, iLen = crp.length; iLen - 2 * !z > i; i += 2) {
      const p = [
        { x: crp[i - 2], y: crp[i - 1] },
        { x: crp[i + 0], y: crp[i + 1] },
        { x: crp[i + 2], y: crp[i + 3] },
        { x: crp[i + 4], y: crp[i + 5] },
        ];
      if (z) {
        if (!i) {
          p[0] = { x: crp[iLen - 2], y: crp[iLen - 1] };
        } else if (iLen - 4 === i) {
          p[3] = { x: crp[0], y: crp[1] };
        } else if (iLen - 2 === i) {
          p[2] = { x: crp[0], y: crp[1] };
          p[3] = { x: crp[2], y: crp[3] };
        }
      } else {
        if (iLen - 4 === i) {
          p[3] = p[2];
        } else if (!i) {
          p[0] = { x: crp[i], y: crp[i + 1] };
        }
      }
      // Control points scaled by s = (1 - tightness)
      // First control point: p[1] + s * (p[2] - p[0]) / 6
      // Second control point: p[2] + s * (p[1] - p[3]) / 6
      d.push([
        p[1].x + s * (p[2].x - p[0].x) / 6.0,
        p[1].y + s * (p[2].y - p[0].y) / 6.0,
        p[2].x + s * (p[1].x - p[3].x) / 6.0,
        p[2].y + s * (p[1].y - p[3].y) / 6.0,
        p[2].x,
        p[2].y,
        ]);
    }
    return d;
  }


  /**
   * @private
   * Converts a list of p5.js v2 spline points to SVG cubic Bezier path data.
   */
  function getSplinePathData(points, closed, tightness = 0, includeEnds = true) {
    if (!Array.isArray(points) || points.length < 2) return '';
    const cleanPoints = points.filter(pt =>
      pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)
    );
    if (cleanPoints.length < 2) return '';

    const s = 1 - tightness;
    const lastIndex = cleanPoints.length - 1;
    let startIndex = includeEnds ? 0 : 1;
    let endIndex = includeEnds ? lastIndex - 1 : lastIndex - 2;

    if (closed) {
      startIndex = 0;
      endIndex = lastIndex;
    }
    if (startIndex > endIndex) return '';

    const pointAt = (idx) => {
      if (closed) {
        const len = cleanPoints.length;
        return cleanPoints[((idx % len) + len) % len];
      }
      return cleanPoints[Math.max(0, Math.min(lastIndex, idx))];
    };

    const startPoint = pointAt(startIndex);
    const parts = [];
    appendPathMoveTo(parts, startPoint.x, startPoint.y);
    for (let i = startIndex; i <= endIndex; i++) {
      const p0 = pointAt(i - 1);
      const p1 = pointAt(i);
      const p2 = pointAt(i + 1);
      const p3 = pointAt(i + 2);
      const c1x = p1.x + s * (p2.x - p0.x) / 6.0;
      const c1y = p1.y + s * (p2.y - p0.y) / 6.0;
      const c2x = p2.x + s * (p1.x - p3.x) / 6.0;
      const c2y = p2.y + s * (p1.y - p3.y) / 6.0;
      appendPathCubicTo(parts, c1x, c1y, c2x, c2y, p2.x, p2.y);
    }
    if (closed) appendPathClose(parts);
    return joinPathData(parts);
  }


  /**
   * @private
   * Appends an SVG path move command to a path fragment array.
   * @param {string[]} parts - Mutable array of serialized path fragments.
   * @param {number} x - Destination x coordinate.
   * @param {number} y - Destination y coordinate.
   */
  function appendPathMoveTo(parts, x, y) {
    parts.push(`M ${formatNumber(x)},${formatNumber(y)}`);
  }


  /**
   * @private
   * Appends an SVG path line command to a path fragment array.
   * @param {string[]} parts - Mutable array of serialized path fragments.
   * @param {number} x - Destination x coordinate.
   * @param {number} y - Destination y coordinate.
   */
  function appendPathLineTo(parts, x, y) {
    parts.push(` L ${formatNumber(x)},${formatNumber(y)}`);
  }


  /**
   * @private
   * Appends an SVG cubic Bezier path command to a path fragment array.
   * @param {string[]} parts - Mutable array of serialized path fragments.
   * @param {number} x1 - First control point x coordinate.
   * @param {number} y1 - First control point y coordinate.
   * @param {number} x2 - Second control point x coordinate.
   * @param {number} y2 - Second control point y coordinate.
   * @param {number} x - Destination x coordinate.
   * @param {number} y - Destination y coordinate.
   */
  function appendPathCubicTo(parts, x1, y1, x2, y2, x, y) {
    parts.push(` C ${formatNumber(x1)},${formatNumber(y1)}`);
    parts.push(` ${formatNumber(x2)},${formatNumber(y2)}`);
    parts.push(` ${formatNumber(x)},${formatNumber(y)}`);
  }


  /**
   * @private
   * Appends an SVG quadratic Bezier path command to a path fragment array.
   * @param {string[]} parts - Mutable array of serialized path fragments.
   * @param {number} cx - Control point x coordinate.
   * @param {number} cy - Control point y coordinate.
   * @param {number} x - Destination x coordinate.
   * @param {number} y - Destination y coordinate.
   */
  function appendPathQuadraticTo(parts, cx, cy, x, y) {
    parts.push(` Q ${formatNumber(cx)},${formatNumber(cy)}`);
    parts.push(` ${formatNumber(x)},${formatNumber(y)}`);
  }


  /**
   * @private
   * Appends an SVG closepath command to a path fragment array.
   * @param {string[]} parts - Mutable array of serialized path fragments.
   */
  function appendPathClose(parts) {
    parts.push(' Z');
  }


  /**
   * @private
   * Joins serialized SVG path fragments into one path data string.
   * @param {string[]} parts - Serialized path fragments.
   * @returns {string} SVG path data.
   */
  function joinPathData(parts) {
    return parts.join('');
  }


  /**
   * @private
   * Generates SVG path data for a simple vertex-only contour.
   * This handles recorded vertex() commands that do not include curve or
   * Bezier segment metadata.
   * @param {Object[]} vertices - Vertex records with x and y properties.
   * @param {boolean} closed - Whether to close the path with Z.
   * @returns {string} SVG path data.
   */
  function generateVertexPathData(vertices, closed) {
    if (!Array.isArray(vertices) || vertices.length === 0) return '';

    const parts = [];
    for (let i = 0; i < vertices.length; i++) {
      let v = vertices[i];
      if (i === 0) {
        appendPathMoveTo(parts, v.x, v.y);
      } else {
        appendPathLineTo(parts, v.x, v.y);
      }
    }
    if (closed) appendPathClose(parts);
    return joinPathData(parts);
  }


  /**
   * @private
   * Emits a warning for an unsupported path segment, optionally using a
   * warn-once flag from the module-level warnings object.
   * @param {string} message - Warning text to send to console.warn().
   * @param {string} [flagName] - Optional warnings object key used to suppress repeats.
   */
  function warnUnsupportedPathSegment(message, flagName) {
    if (flagName && warnings[flagName]) return;
    console.warn(message);
    if (flagName) warnings[flagName] = true;
  }


  /**
   * @private
   * Appends path data for one recorded segment in a complex beginShape() path.
   * Some recorded p5 commands consume more than one segment record; in those
   * cases the returned index advances past the consumed records.
   * @param {string[]} parts - Mutable array of serialized path fragments.
   * @param {Object[]} segments - Recorded segment stream.
   * @param {number} index - Index of the segment to process.
   * @returns {number} Index of the last consumed segment.
   */
  function appendSegmentPathData(parts, segments, index) {
    let seg = segments[index];
    if (!seg || !seg.type) {
      warnUnsupportedPathSegment(
        "p5.plotSvg: Unsupported empty path segment skipped during SVG export.",
        'unsupportedPathSegmentShown'
      );
      return index;
    }

    if (seg.type === SVG_SEGMENT.VERTEX) {
      appendPathLineTo(parts, seg.x, seg.y);
    } else if (seg.type === SVG_SEGMENT.BEZIER) {
      appendPathCubicTo(parts, seg.x2, seg.y2, seg.x3, seg.y3, seg.x4, seg.y4);
    } else if (seg.type === SVG_SEGMENT.BEZIER_POINT) {
      let order = seg.order || session.bezierOrder;
      if (order === 2 && index + 1 < segments.length) {
        let endPt = segments[index + 1];
        appendPathQuadraticTo(parts, seg.x, seg.y, endPt.x, endPt.y);
        return index + 1;
      } else if (index + 2 < segments.length) {
        let c2 = segments[index + 1];
        let endPt = segments[index + 2];
        appendPathCubicTo(parts, seg.x, seg.y, c2.x, c2.y, endPt.x, endPt.y);
        return index + 2;
      }
      warnUnsupportedPathSegment(
        "p5.plotSvg: Incomplete bezierVertex() point-stream segment skipped during SVG export.",
        'incompleteBezierPointSegmentShown'
      );
    } else if (seg.type === SVG_SEGMENT.QUADRATIC) {
      appendPathQuadraticTo(parts, seg.cx, seg.cy, seg.x, seg.y);
    } else if (seg.type === SVG_SEGMENT.CURVE) {
      // Convert Catmull-Rom to cubic Bezier.
      if (index > 2) {
        let sx1 = segments[Math.max(0, index - 3)].x;
        let sy1 = segments[Math.max(0, index - 3)].y;
        let sx2 = segments[Math.max(0, index - 2)].x;
        let sy2 = segments[Math.max(0, index - 2)].y;
        let sx3 = segments[index - 1].x;
        let sy3 = segments[index - 1].y;
        let sx4 = segments[index].x;
        let sy4 = segments[index].y;
        let crp = [sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4];

        let bClosedCatmull = false;
        let segmentTightness = (seg.tightness !== undefined) ? seg.tightness : 0;
        let bezierSegments = catmullRom2bezier(crp, bClosedCatmull, segmentTightness);
        let targetSegment = bezierSegments[1];

        appendPathCubicTo(
          parts,
          targetSegment[0],
          targetSegment[1],
          targetSegment[2],
          targetSegment[3],
          targetSegment[4],
          targetSegment[5]
        );
      }
    } else if (seg.type === SVG_SEGMENT.SPLINE) {
      warnUnsupportedPathSegment(
        "p5.plotSvg: Mixed splineVertex() path segments are not yet supported in SVG export. Pure spline paths are supported.",
        'mixedSplineSegmentShown'
      );
    } else {
      warnUnsupportedPathSegment(
        `p5.plotSvg: Unsupported path segment type "${seg.type}" skipped during SVG export.`,
        'unsupportedPathSegmentShown'
      );
    }
    return index;
  }


  /**
   * @private
   * Generates SVG path data for a recorded complex beginShape() path.
   * Supports vertex, bezierVertex, quadraticVertex, v1 curveVertex-derived
   * Catmull-Rom segments, and pure v2 spline paths. Mixed or unsupported v2
   * segment forms are skipped with warnings until explicitly implemented.
   * @param {Object[]} segments - Recorded path segment stream.
   * @param {boolean} closed - Whether to close the path with Z.
   * @returns {string} SVG path data.
   */
  function generateSegmentPathData(segments, closed) {
    if (!Array.isArray(segments) || segments.length === 0) return '';

    if (segments.every(seg => seg.type === SVG_SEGMENT.SPLINE)) {
      let firstSpline = segments[0];
      return getSplinePathData(
        segments,
        closed,
        firstSpline.tightness,
        shouldIncludeSplineEnds(firstSpline.endsMode)
      );
    }

    const parts = [];
    appendPathMoveTo(parts, segments[0].x, segments[0].y);

    for (let i = 1; i < segments.length; i++) {
      i = appendSegmentPathData(parts, segments, i);
    }
    if (closed) appendPathClose(parts);
    return joinPathData(parts);
  }


  /**
   * @private
   * Generates an SVG <path> element string for shapes with multiple contours.
   * Each contour becomes a separate sub-path (M...Z) within a single <path> element.
   * Supports both simple vertex-only contours and complex contours with bezier/quadratic vertices.
   * @param {Object} cmd - The command object containing vertices/segments with contour markers.
   * @param {string} styleStr - Pre-computed style string for the element.
   * @param {string} transformStr - Pre-computed transform string for the element.
   * @returns {string} The SVG <path> element string with multiple sub-paths.
   */
  function getSvgStrMultiContourPath(cmd, styleStr, transformStr) {
    // Get the vertex/segment array (polyline uses vertices, path uses segments)
    let items = cmd.type === SVG_COMMAND.POLYLINE ? cmd.vertices : cmd.segments;
    if (!items || items.length === 0) {
      return '';
    }

    // Split into contours based on contourStart/contourEnd markers
    let contours = [];
    let currentContour = { vertices: [], closed: cmd.closed }; // Main contour uses shape's closed flag

    for (let i = 0; i < items.length; i++) {
      let item = items[i];
      if (item.type === SVG_SEGMENT.CONTOUR_START) {
        // Save current contour and start a new one
        if (currentContour.vertices.length > 0) {
          contours.push(currentContour);
        }
        currentContour = { vertices: [], closed: false };
      } else if (item.type === SVG_SEGMENT.CONTOUR_END) {
        // Mark contour closure and prepare for next
        currentContour.closed = item.closed;
        if (currentContour.vertices.length > 0) {
          contours.push(currentContour);
        }
        currentContour = { vertices: [], closed: cmd.closed };
      } else {
        // Regular vertex/segment
        currentContour.vertices.push(item);
      }
    }
    // Don't forget any remaining vertices after the last contourEnd
    if (currentContour.vertices.length > 0) {
      contours.push(currentContour);
    }

    // Build the path data string with all contours as sub-paths
    let d = '';
    for (let contour of contours) {
      if (contour.vertices.length === 0) continue;

      if (cmd.type === SVG_COMMAND.POLYLINE) {
        // Simple case: all vertices are simple {x, y} points
        d += generateSimpleContourPath(contour);
      } else {
        // Complex case: vertices may include bezier, quadratic, curve types
        d += generateComplexContourPath(contour);
      }
    }

    if (d === '') return '';

    // Build the final path element
    let str = `<path d="${d.trim()}"${styleStr}${transformStr}`;
    str += attrsToString(cmd.attributes, 'SVG path attribute name');
    str += `/>\n`;
    return str;
  }


  /**
   * @private
   * Generates path data for a simple contour (vertex-only, no curves).
   * @param {Object} contour - Object with vertices array and closed boolean.
   * @returns {string} SVG path data string (M...L...Z or M...L...).
   */
  function generateSimpleContourPath(contour) {
    return generateVertexPathData(contour.vertices, contour.closed) + ' ';
  }


  /**
   * @private
   * Generates path data for a complex contour (may include bezier, quadratic, curve vertices).
   * @param {Object} contour - Object with vertices array and closed boolean.
   * @returns {string} SVG path data string with appropriate curve commands.
   */
  function generateComplexContourPath(contour) {
    return generateSegmentPathData(contour.vertices, contour.closed) + ' ';
  }


  /**
   * @private
   * Generates an SVG <polyline>, <polygon>, or <path> element string based on the given command object.
   * Handles both simple polylines/polygons and complex paths with mixed vertex types.
   * @param {Object} cmd - The command object containing vertices, segments, and shape properties.
   * @returns {string} The SVG element string representing the polyline, polygon, or complex path.
   */
  function getSvgStrPoly(cmd, renderContext) {
    let str = "";
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);

    // Handle multi-contour shapes (beginContour/endContour)
    if (cmd.hasContours) {
      return getSvgStrMultiContourPath(cmd, styleStr, transformStr);
    }

    // 🔁 Convert polylines to path if specified by config.exportPolylinesAsPaths
    if (cmd.type === SVG_COMMAND.POLYLINE && config.exportPolylinesAsPaths) {
      let d = generateVertexPathData(cmd.vertices, cmd.closed);
      str += `<path d="${d}"${styleStr}${transformStr}`;

      // If additional attributes are present, add them
      str += attrsToString(cmd.attributes, 'SVG path attribute name');
      str += `/>\n`;
      return str;
    }

    if (cmd.type === SVG_COMMAND.POLYLINE) {
      // Simple case: use polyline or polygon
      let points = "";
      for (let i = 0; i < cmd.vertices.length; i++) {
        let v = cmd.vertices[i];
        points += formatNumber(v.x) + "," + formatNumber(v.y);
        if (i < cmd.vertices.length - 1) {points += " ";}
      }

      if (cmd.closed) {
        str += `<polygon points="${points}"${styleStr}${transformStr}`;
      } else {
        str += `<polyline points="${points}"${styleStr}${transformStr}`;
      }

      str += attrsToString(cmd.attributes, 'SVG polyline attribute name');
      str += `/>\n`;
      return str;

    } else if (cmd.type === SVG_COMMAND.PATH) {
      // Complex case: construct path data with mixed vertex types
      if (!cmd.segments || cmd.segments.length === 0) {
        return ''; // No segments to render
      }
      let d = generateSegmentPathData(cmd.segments, cmd.closed);

      str += `<path `;
      // Experimental extension hook: custom command attributes.
      let cmdAttributesHasStyle = false;
      str += attrsToString(cmd.attributes, 'SVG path attribute name', {
        onAttr: (attr, attrName) => {
          if (attrName === 'style') {
            cmdAttributesHasStyle = true;
          }
        }
      });
      // Only add the default style if not already set by cmd.attributes
      if (!cmdAttributesHasStyle) {
        str += `${styleStr}`;
      }
      str += ` d="${d}"${transformStr}`;

      str += `/>\n`;
      return str;

    }
    return str;
  }


  /**
   * @private
   * Generates an SVG group element string representing a set of points,
   * based on the given command object. Handles beginShape(POINTS) in p5.js.
   * @param {Object} cmd - The command object containing vertices.
   * @returns {string} The SVG group element string with formatted points.
   */
  function getSvgStrPoints(cmd, renderContext) {
    // handle beginShape(POINTS)
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let pointsStr = `<g id="POINTS_${session.pointsSetCount}"${styleStr}${transformStr}>\n`;
    renderContext.groupLevel++;
    session.pointsSetCount++;

    let rStr = formatNumber(config.pointRadius);
    for (let i = 0; i < cmd.vertices.length; i++) {
      const v = cmd.vertices[i];
      let xStr = formatNumber(v.x);
      let yStr = formatNumber(v.y);
      pointsStr += getIndentStr(renderContext);
      pointsStr += `<circle cx="${xStr}" cy="${yStr}" r="${rStr}"/>\n`;
    }

    renderContext.groupLevel--;
    pointsStr += getIndentStr(renderContext);
    pointsStr += `</g>\n`;
    return pointsStr;
  }


  /**
   * @private
   * Generates an SVG group element string representing a set of lines,
   * based on the given command object. Handles beginShape(LINES) in p5.js.
   * @param {Object} cmd - The command object containing vertices.
   * @returns {string} The SVG group element string with formatted lines.
   */
  function getSvgStrLines(cmd, renderContext) {
    // handle beginShape(LINES)
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let linesStr = "";
    linesStr += `<g id="LINES_${session.linesSetCount}"${styleStr}${transformStr}>\n`;
    renderContext.groupLevel++;
    session.linesSetCount++;

    if (cmd.vertices.length > 1){
      for (let i = 0; i < cmd.vertices.length-1; i+=2) {
        let x1Str = formatNumber(cmd.vertices[i].x);
        let y1Str = formatNumber(cmd.vertices[i].y);
        let x2Str = formatNumber(cmd.vertices[i+1].x);
        let y2Str = formatNumber(cmd.vertices[i+1].y);

        linesStr += getIndentStr(renderContext);
        linesStr += `<line x1="${x1Str}" y1="${y1Str}" `;
        linesStr += `x2="${x2Str}" y2="${y2Str}"/>\n`;
      }
    }

    renderContext.groupLevel--;
    linesStr += getIndentStr(renderContext);
    linesStr += `</g>\n`;
    return linesStr;
  }


  /**
   * @private
   * Generates an SVG group element string representing a set of triangles,
   * based on the given command object.Handles beginShape(TRIANGLES) in p5.js.
   * @param {Object} cmd - The command object containing vertices.
   * @returns {string} The SVG group element string with formatted triangles.
   */
  function getSvgStrTriangles(cmd, renderContext) {
    // handle beginShape(TRIANGLES)
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let trianglesStr = "";
    trianglesStr += `<g id="TRIANGLES_${session.trianglesSetCount}"${styleStr}${transformStr}>\n`;
    renderContext.groupLevel++;
    session.trianglesSetCount++;

    if (cmd.vertices.length >= 3){
      for (let i = 0; i < cmd.vertices.length - 2; i += 3) {
        let x1Str = formatNumber(cmd.vertices[i  ].x);
        let y1Str = formatNumber(cmd.vertices[i  ].y);
        let x2Str = formatNumber(cmd.vertices[i+1].x);
        let y2Str = formatNumber(cmd.vertices[i+1].y);
        let x3Str = formatNumber(cmd.vertices[i+2].x);
        let y3Str = formatNumber(cmd.vertices[i+2].y);
        let triStr = `${x1Str},${y1Str} ${x2Str},${y2Str} ${x3Str},${y3Str}`;

        trianglesStr += getIndentStr(renderContext);
        trianglesStr += `<polygon points="${triStr}"/>\n`;
      }
    }

    renderContext.groupLevel--;
    trianglesStr += getIndentStr(renderContext);
    trianglesStr += `</g>\n`;
    return trianglesStr;
  }


  /**
   * @private
   * Generates an SVG group element string representing a triangle fan,
   * based on the given command object. Handles beginShape(TRIANGLE_FAN) in p5.js.
   * @param {Object} cmd - The command object containing vertices.
   * @returns {string} The SVG group element string with formatted triangles.
   */
  function getSvgStrTriangleFan(cmd, renderContext) {
    // handle beginShape(TRIANGLE_FAN)
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let fanStr = "";
    fanStr += `<g id="TRIANGLE_FAN_${session.triangleFanSetCount}"${styleStr}${transformStr}>\n`;
    renderContext.groupLevel++;
    session.triangleFanSetCount++;

    if (cmd.vertices.length >= 3){
      let x0Str = formatNumber(cmd.vertices[0].x);
      let y0Str = formatNumber(cmd.vertices[0].y);
      for (let i = 1; i < cmd.vertices.length - 1; i++) {
        let x1Str = formatNumber(cmd.vertices[i  ].x);
        let y1Str = formatNumber(cmd.vertices[i  ].y);
        let x2Str = formatNumber(cmd.vertices[i+1].x);
        let y2Str = formatNumber(cmd.vertices[i+1].y);
        let pointsStr = `${x0Str},${y0Str} ${x1Str},${y1Str} ${x2Str},${y2Str}`;

        fanStr += getIndentStr(renderContext);
        fanStr += `<polygon points="${pointsStr}"/>\n`;
      }
    }

    renderContext.groupLevel--;
    fanStr += getIndentStr(renderContext);
    fanStr += `</g>\n`;
    return fanStr;
  }


  /**
   * @private
   * Generates an SVG group element string representing a triangle strip,
   * based on the given command object. Handles beginShape(TRIANGLE_STRIP) in p5.js.
   * @param {Object} cmd - The command object containing vertices.
   * @returns {string} The SVG group element string with formatted triangles.
   */
  function getSvgStrTriangleStrip(cmd, renderContext) {
    // handle beginShape(TRIANGLE_STRIP)
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let triStripStr = "";
    triStripStr += `<g id="TRIANGLE_STRIP_${session.triangleStripSetCount}"${styleStr}${transformStr}>\n`;
    renderContext.groupLevel++;
    session.triangleStripSetCount++;

    if (cmd.vertices.length >= 3){
      for (let i = 0; i < cmd.vertices.length - 2; i++) {
        let x1Str = formatNumber(cmd.vertices[i  ].x);
        let y1Str = formatNumber(cmd.vertices[i  ].y);
        let x2Str = formatNumber(cmd.vertices[i+1].x);
        let y2Str = formatNumber(cmd.vertices[i+1].y);
        let x3Str = formatNumber(cmd.vertices[i+2].x);
        let y3Str = formatNumber(cmd.vertices[i+2].y);

        let triStr = "";
        if (i%2 == 0){
          triStr = `${x1Str},${y1Str} ${x2Str},${y2Str} ${x3Str},${y3Str}`;
        } else {
          triStr = `${x1Str},${y1Str} ${x3Str},${y3Str} ${x2Str},${y2Str}`;
        }
        triStripStr += getIndentStr(renderContext);
        triStripStr += `<polygon points="${triStr}"/>\n`;
      }
    }

    renderContext.groupLevel--;
    triStripStr += getIndentStr(renderContext);
    triStripStr += `</g>\n`;
    return triStripStr;
  }


  /**
   * @private
   * Generates an SVG group element string representing a set of quads,
   * based on the given command object. Handles beginShape(QUADS) in p5.js.
   * @param {Object} cmd - The command object containing vertices.
   * @returns {string} The SVG group element string with formatted quads.
   */
  function getSvgStrQuads(cmd, renderContext) {
    // handle beginShape(QUADS)
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let quadsStr = "";
    quadsStr += `<g id="QUADS_${session.quadsSetCount}"${styleStr}${transformStr}>\n`;
    renderContext.groupLevel++;
    session.quadsSetCount++;

    if (cmd.vertices.length >= 4){
      for (let i = 0; i < cmd.vertices.length - 3; i+=4) {
        const v1 = cmd.vertices[i  ];
        const v2 = cmd.vertices[i+1];
        const v3 = cmd.vertices[i+2];
        const v4 = cmd.vertices[i+3];
        const qStr = `${formatNumber(v1.x)},${formatNumber(v1.y)} ` +
                    `${formatNumber(v2.x)},${formatNumber(v2.y)} ` +
                    `${formatNumber(v3.x)},${formatNumber(v3.y)} ` +
                    `${formatNumber(v4.x)},${formatNumber(v4.y)}`;
        quadsStr += getIndentStr(renderContext);
        quadsStr += `<polygon points="${qStr}"/>\n`;
      }
    }

    renderContext.groupLevel--;
    quadsStr += getIndentStr(renderContext);
    quadsStr += `</g>\n`;
    return quadsStr;
  }


  /**
   * @private
   * Generates an SVG group element string representing a quad strip,
   * based on the given command object.Handles beginShape(QUAD_STRIP) in p5.js.
   * @param {Object} cmd - The command object containing vertices.
   * @returns {string} The SVG group element string with formatted quads.
   */
  function getSvgStrQuadStrip(cmd, renderContext) {
    // handle beginShape(QUAD_STRIP)
    let styleStr = getSvgStrStroke(renderContext);
    let transformStr = generateTransformString(cmd);
    let quadStripStr = "";
    quadStripStr += `<g id="QUAD_STRIP_${session.quadStripSetCount}"${styleStr}${transformStr}>\n`;
    renderContext.groupLevel++;
    session.quadStripSetCount++;

    if (cmd.vertices.length >= 4){
      for (let i = 0; i < cmd.vertices.length - 3; i += 2) {
        const v1 = cmd.vertices[i];
        const v2 = cmd.vertices[i + 1];
        const v3 = cmd.vertices[i + 2];
        const v4 = cmd.vertices[i + 3];
        const qStr = `${formatNumber(v1.x)},${formatNumber(v1.y)} ` +
                    `${formatNumber(v2.x)},${formatNumber(v2.y)} ` +
                    `${formatNumber(v4.x)},${formatNumber(v4.y)} ` +
                    `${formatNumber(v3.x)},${formatNumber(v3.y)}`;
        quadStripStr += getIndentStr(renderContext);
        quadStripStr += `<polygon points="${qStr}"/>\n`;
      }
    }

    renderContext.groupLevel--;
    quadStripStr += getIndentStr(renderContext);
    quadStripStr += `</g>\n`;
    return quadStripStr;
  }


  /**
   * @private
   * Generates an SVG <text> element string based on the provided command object.
   * Captures text content, position, font properties, alignment, and style for SVG rendering.
   * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text
   *
   * @param {Object} cmd - The command object containing text properties:
   *   @param {number} cmd.x - The x-coordinate for the text position.
   *   @param {number} cmd.y - The y-coordinate for the text position.
   *   @param {string} cmd.font - The font family for the text.
   *   @param {number} cmd.fontSize - The font size for the text.
   *   @param {string} cmd.alignX - The horizontal alignment ('left', 'center', 'right').
   *   @param {string} cmd.alignY - The vertical alignment ('top', 'center', 'bottom', 'alphabetic').
   *   @param {string} cmd.style - The text style ('normal', 'bold', 'italic', 'bolditalic').
   *   @param {string} cmd.leading - The text leading.
   *   @param {string} cmd.ascent - The text ascent.
   *   @param {string} cmd.descent - The text descent.
   *   @param {string} cmd.content - The text content to display.
   * @returns {string} The formatted SVG <text> element string.
   */
  function getSvgStrText(cmd, renderContext) {
    let xStr = formatNumber(cmd.x);
    let yStr = formatNumber(cmd.y);
    let fontSizeStr = formatNumber(cmd.fontSize);

    // Adjust y-coordinate for vertical alignment : NOT FINISHED
    // See https://github.com/processing/p5.js/blob/v1.11.1/src/core/p5.Renderer.js#L233
    let adjustedY = cmd.y; // Default to the original y-value
    switch (cmd.alignY) {
      case 'top':
        // no solution yet
        break;
      case 'center':
        // no solution yet
        break;
      case 'bottom':
        adjustedY = adjustedY + cmd.fontSize - cmd.leading; // is this correct??
        break;
      case 'alphabetic': // baseline
        // no solution needed
        break;
    }
    let adjustedYStr = formatNumber(adjustedY);

    // Generate transformation string, if applicable
    let transformStr = generateTransformString(cmd);
    let styleStr = getSvgStrStroke(renderContext);

    // Construct SVG <text> element
    let str = `<text x="${xStr}" y="${adjustedYStr}" font-family="${escapeXmlAttribute(cmd.font)}" font-size="${fontSizeStr}"${styleStr}${transformStr}`;

    // Handle horizontal alignment
    if (cmd.alignX === 'center') {
      str += ` text-anchor="middle"`;
    } else if (cmd.alignX === 'right') {
      str += ` text-anchor="end"`;
    }

    // Apply font-weight and font-style based on textStyle()
    if (cmd.style === 'bold') {
      str += ` font-weight="bold"`;
    } else if (cmd.style === 'italic') {
      str += ` font-style="italic"`;
    } else if (cmd.style === 'bolditalic') {
      str += ` font-weight="bold" font-style="italic"`;
    } // Normal is default and doesn’t need additional attributes

    str += `>${escapeXmlText(cmd.content)}</text>\n`;
    return str;
  }


  /**
   * @private
   * Captures the current transformation matrix from the drawing context
   * if transforms exist and we're not using a transform stack.
   * @returns {Object|null} An object containing the transformation
   * matrix values or null if no transforms exist.
   */
  function captureCurrentTransformMatrix() {
    if (session.transformsExist && config.flattenTransforms) {
      const ctxTransform = session.p5Instance.drawingContext.getTransform();
      return {
        a: ctxTransform.a,
        b: ctxTransform.b,
        c: ctxTransform.c,
        d: ctxTransform.d,
        e: ctxTransform.e,
        f: ctxTransform.f
      };
    }
    return null;
  }


  /**
   * @private
   * Generates an SVG transform string from a command object if a transformation matrix is present,
   * accounting for pixel density scaling.
   * @param {Object} cmd - The command object potentially containing a transform matrix.
   * @returns {string} The SVG transform string or an empty string if no transform matrix is present.
   */
  function generateTransformString(cmd) {
    if (cmd.transformMatrix) {
      // Calculate the scaling factor from pixelDensity()
      // and adjust the matrix values by the pixelScale
      const pixelScale = 1.0 / session.p5PixelDensity;
      const { a, b, c, d, e, f } = cmd.transformMatrix;
      const sA = formatNumber(a * pixelScale, config.transformPrecision);
      const sB = formatNumber(b * pixelScale, config.transformPrecision);
      const sC = formatNumber(c * pixelScale, config.transformPrecision);
      const sD = formatNumber(d * pixelScale, config.transformPrecision);
      const sE = formatNumber(e * pixelScale, config.transformPrecision);
      const sF = formatNumber(f * pixelScale, config.transformPrecision);
      return ` transform="matrix(${sA} ${sB} ${sC} ${sD} ${sE} ${sF})"`;
    }
    return '';
  }


  /**
   * @private
   * Formats a number to a specified decimal precision, converting it to a string.
   * If the number is an integer, it is returned as a string without formatting.
   * If no precision is provided, the function defaults to using `config.coordPrecision`.
   *
   * @param {number} val - The value to be formatted.
   * @param {number} [precision] - Optional precision specifying the number of decimal places.
   * If omitted, the configured coordinate precision is used.
   * @returns {string} The formatted number as a string.
   */
  function formatNumber(val, precision) {
    const precisionToUse = (typeof precision === 'number') ? precision : config.coordPrecision;
    if (!Number.isFinite(val)) {
      if (!warnings.nonFiniteNumberShown) {
        console.warn("p5.plotSvg: Non-finite numeric value encountered during SVG export; writing 0 instead.");
        warnings.nonFiniteNumberShown = true;
      }
      return '0';
    }
    if (Number.isInteger(val)) {
      return val.toString();
    } else {
      return val.toFixed(precisionToUse);
    }
  }


  /**
   * @private
   * Converts an angle from degrees to radians.
   * @param {number} deg - The angle in degrees to be converted.
   * @returns {number} The angle converted to radians.
   */
  function degreesToRadians(deg) {
    return deg * (Math.PI / 180.0);
  }


  /**
   * @private
   * Returns a p5 constant from the active instance or global target.
   */
  function getP5Constant(name) {
    if (session.p5Instance && typeof session.p5Instance[name] !== 'undefined') {
      return session.p5Instance[name];
    }
    const globalTarget = getGlobalTarget();
    if (globalTarget && typeof globalTarget[name] !== 'undefined') {
      return globalTarget[name];
    }
    return undefined;
  }


  /**
   * @private
   * Returns the current p5.js v2 Bezier order, defaulting to cubic curves.
   */
  function getCurrentBezierOrder() {
    const order = session.p5Instance?._renderer?.states?.bezierOrder;
    return (order === 2 || order === 3) ? order : session.bezierOrder;
  }


  /**
   * @private
   * Sets p5.js v2's native Bezier order while keeping p5.plotSvg state in sync.
   */
  function setOriginalBezierOrder(order) {
    if (typeof order === 'undefined') return;
    if (typeof session.overrides.originals.bezierOrder === 'function') {
      callOriginalFunction(session.overrides.originals.bezierOrder, session.p5Instance, [order]);
    } else if (session.p5Instance?._renderer?.states) {
      session.p5Instance._renderer.states.bezierOrder = order;
    }
    if (order === 2 || order === 3) {
      session.bezierOrder = order;
    }
  }


  /**
   * @private
   * Returns the current p5.js curve/spline tightness.
   */
  function getCurrentSplineTightness() {
    const tightness = session.p5Instance?._renderer?.states?.splineProperties?.tightness;
    if (typeof tightness === 'number') return tightness;
    return session.curveTightness;
  }


  /**
   * @private
   * Returns the current p5.js v2 spline end-mode.
   */
  function getCurrentSplineEndsMode() {
    const endsMode = session.p5Instance?._renderer?.states?.splineProperties?.ends;
    return (typeof endsMode !== 'undefined') ? endsMode : session.splineEndsMode;
  }


  /**
   * @private
   * Sets one p5.js v2 spline property while keeping p5.plotSvg state in sync.
   */
  function setOriginalSplineProperty(property, value) {
    if (typeof value === 'undefined') return;
    if (typeof session.overrides.originals.splineProperty === 'function') {
      callOriginalFunction(session.overrides.originals.splineProperty, session.p5Instance, [property, value]);
    } else if (session.p5Instance?._renderer?.states?.splineProperties) {
      session.p5Instance._renderer.states.splineProperties[property] = value;
    }
    if (property === 'tightness') {
      session.curveTightness = value;
    } else if (property === 'ends') {
      session.splineEndsMode = value;
    }
  }


  /**
   * @private
   * Temporarily applies a p5.js v2 spline end-mode around a native draw call.
   */
  function withTemporarySplineEndsMode(endsMode, drawCallback) {
    const previousEndsMode = getCurrentSplineEndsMode();
    setOriginalSplineProperty('ends', endsMode);
    try {
      return drawCallback();
    } finally {
      setOriginalSplineProperty('ends', previousEndsMode);
    }
  }


  /**
   * @private
   * Starts a v1 curveVertex() compatibility span in p5.js v2.
   */
  function beginCurveVertexCompatIfNeeded() {
    if (session.curveVertexCompatActive) return;
    session.curveVertexCompatPreviousEndsMode = getCurrentSplineEndsMode();
    setOriginalSplineProperty('ends', getP5Constant('EXCLUDE'));
    session.curveVertexCompatActive = true;
  }


  /**
   * @private
   * Restores p5.js v2 spline settings after a v1 curveVertex() compatibility span.
   */
  function endCurveVertexCompatIfNeeded() {
    if (!session.curveVertexCompatActive) return;
    setOriginalSplineProperty('ends', session.curveVertexCompatPreviousEndsMode);
    session.curveVertexCompatPreviousEndsMode = undefined;
    session.curveVertexCompatActive = false;
  }


  /**
   * @private
   * Whether p5.js v2 splines should include endpoint spans in SVG output.
   */
  function shouldIncludeSplineEnds(endsMode) {
    if (session.p5Instance && typeof session.p5Instance.EXCLUDE !== 'undefined' && endsMode === session.p5Instance.EXCLUDE) {
      return false;
    }
    return true;
  }


  /**
   * @private
   * Compares two colors and determines if they are equal.
   * Handles CSS color names, hex strings, and RGB values.
   * Ignores alpha channel and whitespace differences.
   * Assumes RGB values are integers between 0-255.
   * @param {string|number|Array} color1 - The first color (CSS name, hex, RGB string, or RGB array).
   * @param {string|number|Array} color2 - The second color (CSS name, hex, RGB string, or RGB array).
   * @returns {boolean} - True if the colors are equal, otherwise false.
   */
  function areColorsEqual(color1, color2) {
    // Guard: if p5 instance is not available, cannot compare
    if (!session.p5Instance) {
      return false;
    }

    // Use p5's built-in color parsing to normalize and compare colors
    try {
      const c1 = session.p5Instance.color(color1);
      const c2 = session.p5Instance.color(color2);
      return session.p5Instance.red(c1) === session.p5Instance.red(c2) &&
             session.p5Instance.green(c1) === session.p5Instance.green(c2) &&
             session.p5Instance.blue(c1) === session.p5Instance.blue(c2);
    } catch (e) {
      // If color parsing fails, colors are not equal
      return false;
    }
  }


  /**
   * @private
   * Overrides the p5.js colorMode function to provide a warning about unsupported color modes
   * for SVG export in p5.plotSvg. Only CSS named colors, hex colors, and RGB/gray colors
   * whose values are in the range of 0-255 are supported.
   */
  function overrideColorModeFunction() {
    session.overrides.originals.colorMode = getOriginalFunction('colorMode');
    const newColorModeFunc = function() {
      console.warn("p5.plotSvg: Only CSS named colors, hex colors, and RGB/gray colors whose values are in the range of 0-255 are supported for SVG output.");
      callOriginalFunction(session.overrides.originals.colorMode, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'colorMode', newColorModeFunc);
    overrideFunction(getGlobalTarget(), 'colorMode', newColorModeFunc);
  }


  /**
   * @private
   * Overrides the p5.js clip function to provide a warning that clipping is not supported
   * for SVG export in p5.plotSvg.
   * @see {@link https://p5js.org/reference/p5/clip/}
   */
  function overrideClipFunction() {
    session.overrides.originals.clip = getOriginalFunction('clip');
    if (typeof session.overrides.originals.clip !== 'function') return;
    const newClipFunc = function() {
      if (session.recording && !warnings.clipShown) {
        console.warn("p5.plotSvg: p5's clip() function is not currently supported for SVG export.");
        warnings.clipShown = true;
      }
      callOriginalFunction(session.overrides.originals.clip, session.p5Instance, arguments);
    };
    overrideFunction(session.p5Instance, 'clip', newClipFunc);
    overrideFunction(getGlobalTarget(), 'clip', newClipFunc);
  }


  /**
   * @private
   * Overrides the p5.js stroke function to capture stroke color commands for SVG export.
   * Handles both CSS color names and p5.js color conversions for RGB/gray colors.
   * Records a command to change the stroke color when SVG recording is active.
   * @param {...*} args - Arguments passed to the stroke function. Can include CSS named colors,
   * hex colors, or RGB/gray values.
   */
  function overrideStrokeFunction() {
    session.overrides.originals.stroke = getOriginalFunction('stroke');
    const newStrokeFunc = function(...args) {
      if (session.recording) {
        let scol;

        // If the first argument is a string and a valid CSS color, use it directly
        if (typeof args[0] === 'string' && isValidCssColor(args[0])) {
          scol = args[0].trim();
        } else {
          // Otherwise, convert the arguments using p5.js color functionality
          scol = session.p5Instance.color(...args).toString();
        }

        // Add a command to the stack to update the stroke color
        session.commands.push({ type: SVG_COMMAND.STROKE, color: scol });
      }
      // Call the original p5.js `stroke` function with all arguments
      callOriginalFunction(session.overrides.originals.stroke, session.p5Instance, args);
    };
    overrideFunction(session.p5Instance, 'stroke', newStrokeFunc);
    overrideFunction(getGlobalTarget(), 'stroke', newStrokeFunc);
  }

  /**
   * @private
   * Checks if a given string is a valid CSS color name or value.
   * @param {string} color - The input color string.
   * @returns {boolean} - True if the string is a valid CSS color, false otherwise.
   */
  function isValidCssColor(color) {
    if (typeof color !== 'string') return false;

    const trimmedColor = color.trim();
    if (trimmedColor === '') return false;
    if (cssColorValidationCache.has(trimmedColor)) {
      return cssColorValidationCache.get(trimmedColor);
    }

    let isValid = false;
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
      isValid = CSS.supports('color', trimmedColor);
    } else if (typeof document !== 'undefined' && document.createElement) {
      const tempElem = document.createElement('div');
      tempElem.style.color = trimmedColor;
      isValid = tempElem.style.color !== '';
      tempElem.remove();
    }

    cssColorValidationCache.set(trimmedColor, isValid);
    return isValid;
  }


  /**
   * @private
   * Generates an SVG stroke style string if the current stroke color differs from the default.
   * Converts colors from rgba or rgb formats to hex format for consistent SVG output.
   * Assumes that non-rgba and non-rgb colors are already in a valid format (hex or CSS named colors).
   * @returns {string} - The SVG stroke style string or an empty string if the stroke matches the default.
   */
  function getSvgStrStroke(renderContext) {
    // Add stroke style if:
    // - grouping by stroke color is enabled, OR
    // - any non-default color has been used (so all colors are explicit), OR
    // - current color differs from the default
    if (config.groupByStrokeColor || renderContext.hasNonDefaultStrokeColor || !areColorsEqual(renderContext.currentStrokeColor, config.defaultStrokeColor)) {
      let colorStr = renderContext.currentStrokeColor;

      // If the color is in rgba format, strip out the alpha channel and convert to hex
      if (colorStr.startsWith('rgba')) {
        // Extract the RGB values
        const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*\d*\.?\d+\)/);
        if (match) {
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);
          colorStr = rgbToHex(r, g, b);
        }
      }
      // If the color is in rgb format, convert to hex
      else if (colorStr.startsWith('rgb')) {
        // Extract the RGB values
        const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);
          colorStr = rgbToHex(r, g, b);
        }
      }

      // Assume the color is already in hex format or a
      // named CSS color if it doesn't match previous conditions
      return ` style="stroke:${colorStr};"`;
    }
    return '';
  }


  /**
   * @private
   * Converts RGB values to a hex color string.
   * @param {number} r - The red value (0-255).
   * @param {number} g - The green value (0-255).
   * @param {number} b - The blue value (0-255).
   * @returns {string} The hex color string (e.g., '#ff0000').
   */
  function rgbToHex(r, g, b) {
    const toHex = (val) => val.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }


  /**
   * @private
   * Handles the SVG stroke command by updating the current stroke color.
   * This function is invoked when a stroke color change is recorded, ensuring
   * the stroke color state is updated for subsequent SVG elements.
   * @param {Object} cmd - The command object containing stroke properties.
   * @param {string} cmd.color - The new stroke color to set (in hex, RGB, or named CSS color format).
   */
  function handleSvgStrokeCommand(cmd, renderContext) {
    // Update the current stroke color
    renderContext.currentStrokeColor = cmd.color;
    // Track if any non-default color has been used
    if (!areColorsEqual(cmd.color, config.defaultStrokeColor)) {
      renderContext.hasNonDefaultStrokeColor = true;
    }
  }


  /**
   * Retrieves the default stroke color used for SVG rendering.
   * @returns {string} - The default stroke color (in hex, RGB, or named CSS color format).
   */
  p5plotSvg.getDefaultStrokeColor = function() {
    return config.defaultStrokeColor;
  }

  /**
   * Retrieves whether or not SVG recording is active.
   * @returns {boolean} - True if SVG recording is active, false otherwise.
   */
  p5plotSvg.isRecordingSVG = function() {
    return session.recording === true;
  };


  /**
   * Injects an attribute into the SVG header section.
   */
  p5plotSvg.injectSvgHeaderAttribute = function(attrName, attrValue) {
    if (typeof attrName !== 'string' || typeof attrValue === 'undefined') return;
    // Check for existing attribute by name; do not add duplicates
    attrName = normalizeXmlName(attrName, 'SVG header attribute name');
    if (!attrName) return;
    attrValue = String(attrValue);
    let existing = session.injectedHeaderAttributes.find(attr => attr.name === attrName);
    if (existing) {
      existing.value = attrValue;
    } else {
      session.injectedHeaderAttributes.push({ name: attrName, value: attrValue });
    }
  }

  /**
   * Injects a <defs> element into the SVG output.
   * `type` is the tag name (e.g. "marker")
   * `attributes` is an object of key-value pairs (e.g. {id: "marker-1", orient: "auto"})
   */
  p5plotSvg.injectSvgDef = function(type, attributesObj) {
    if (typeof type !== 'string' || typeof attributesObj !== 'object' || !attributesObj) return;
    type = normalizeXmlName(type, 'SVG defs element name');
    if (!type) return;
    const attrArray = [];
    for (let key in attributesObj) {
      if (Object.prototype.hasOwnProperty.call(attributesObj, key)) {
        const attrName = normalizeXmlName(key, 'SVG defs attribute name');
        if (attrName) {
          attrArray.push({ name: attrName, value: String(attributesObj[key]) });
        }
      }
    }
    // Prevent duplicates by checking if a def with the same type and id exists
    const idValue = (typeof attributesObj.id !== 'undefined') ? String(attributesObj.id) : undefined;
    let existing = session.injectedDefs.find(def =>
      def.type === type &&
      def.attributes.some(attr => attr.name === 'id' && attr.value === idValue)
    );
    if (existing) {
      existing.attributes = attrArray; // Overwrite attributes if duplicate id/type found
    } else {
      session.injectedDefs.push({ type: type, attributes: attrArray });
    }
  }

  /**
   * @private
   * Adds p5.plotSvg methods to p5 instances without removing the existing
   * namespace or global aliases. These wrappers are permanent addon API methods;
   * they are separate from the temporary drawing-function overrides used while
   * recording SVG.
   */
  function installPrototypeMethods(p5Ctor, fnArg) {
    if (!p5Ctor) return;
    const fn = fnArg || p5Ctor.prototype;
    if (!fn) return;

    const addMethod = function(name, method) {
      if (typeof fn[name] !== 'undefined') return;
      Object.defineProperty(fn, name, {
        value: method,
        writable: true,
        configurable: true
      });
    };

    addMethod('beginRecordSvg', function(p5InstanceOrFilename, maybeFilename) {
      if (isP5InstanceLike(p5InstanceOrFilename) || p5InstanceOrFilename === getGlobalTarget()) {
        return p5plotSvg.beginRecordSvg(p5InstanceOrFilename, maybeFilename);
      }
      if (isGlobalP5Instance(this)) {
        return p5plotSvg.beginRecordSvg(getGlobalTarget(), p5InstanceOrFilename);
      }
      return p5plotSvg.beginRecordSvg(this, p5InstanceOrFilename);
    });
    addMethod('pauseRecordSvg', function(bPause) {
      return p5plotSvg.pauseRecordSvg(bPause);
    });
    addMethod('endRecordSvg', function() {
      return p5plotSvg.endRecordSvg();
    });
    addMethod('setSvgDocumentSize', function(w, h) {
      return p5plotSvg.setSvgDocumentSize(w, h);
    });
    addMethod('setSvgResolutionDPI', function(dpi) {
      return p5plotSvg.setSvgResolutionDPI(dpi);
    });
    addMethod('setSvgResolutionDPCM', function(dpcm) {
      return p5plotSvg.setSvgResolutionDPCM(dpcm);
    });
    addMethod('setSvgDefaultStrokeWeight', function(weight) {
      return p5plotSvg.setSvgDefaultStrokeWeight(weight);
    });
    addMethod('setSvgMergeNamedGroups', function(bEnabled) {
      return p5plotSvg.setSvgMergeNamedGroups(bEnabled);
    });
    addMethod('setSvgInkscapeCompatibility', function(bEnabled) {
      return p5plotSvg.setSvgInkscapeCompatibility(bEnabled);
    });
    addMethod('setSvgGroupByStrokeColor', function(bEnabled) {
      return p5plotSvg.setSvgGroupByStrokeColor(bEnabled);
    });
    addMethod('setSvgDefaultStrokeColor', function(color) {
      return p5plotSvg.setSvgDefaultStrokeColor(color);
    });
    addMethod('setSvgBackgroundColor', function(color) {
      return p5plotSvg.setSvgBackgroundColor(color);
    });
    addMethod('setSvgIndent', function(indentType, indentAmount) {
      return p5plotSvg.setSvgIndent(indentType, indentAmount);
    });
    addMethod('setSvgFlattenTransforms', function(bFlatten) {
      return p5plotSvg.setSvgFlattenTransforms(bFlatten);
    });
    addMethod('setSvgCoordinatePrecision', function(precision) {
      return p5plotSvg.setSvgCoordinatePrecision(precision);
    });
    addMethod('setSvgTransformPrecision', function(precision) {
      return p5plotSvg.setSvgTransformPrecision(precision);
    });
    addMethod('setSvgPointRadius', function(radius) {
      return p5plotSvg.setSvgPointRadius(radius);
    });
    addMethod('setSvgExportPolylinesAsPaths', function(bEnabled) {
      return p5plotSvg.setSvgExportPolylinesAsPaths(bEnabled);
    });
    addMethod('beginSvgGroup', function(gnameOrAttrs, attrs) {
      return p5plotSvg.beginSvgGroup(gnameOrAttrs, attrs);
    });
    addMethod('endSvgGroup', function() {
      return p5plotSvg.endSvgGroup();
    });
    addMethod('getDefaultStrokeColor', function() {
      return p5plotSvg.getDefaultStrokeColor();
    });
    addMethod('isRecordingSVG', function() {
      return p5plotSvg.isRecordingSVG();
    });
    addMethod('injectSvgHeaderAttribute', function(attrName, attrValue) {
      return p5plotSvg.injectSvgHeaderAttribute(attrName, attrValue);
    });
    addMethod('injectSvgDef', function(type, attributesObj) {
      return p5plotSvg.injectSvgDef(type, attributesObj);
    });
  }

  /**
   * Official p5.js add-on installer.
   * p5.js v2 invokes this through p5.registerAddon(); p5.js v1 uses the same
   * function as a direct fallback because registerAddon() does not exist there.
   * The installer attaches p5.plotSvg's public API to p5 instances without
   * removing the existing global and p5plotSvg namespace APIs.
   * @param {Function} p5Ctor - The p5 constructor supplied by p5.js.
   * @param {Object} fn - Prototype/method target supplied by p5.js v2, or p5.prototype in v1.
   * @param {Object} lifecycles - p5.js lifecycle registry; currently unused.
   */
  function plotSvgAddon(p5Ctor, fn, lifecycles) {
    installPrototypeMethods(p5Ctor, fn);
  }

  p5plotSvg.plotSvgAddon = plotSvgAddon;

  if (typeof p5 !== 'undefined') {
    if (typeof p5.registerAddon === 'function') {
      p5.registerAddon(plotSvgAddon);
    } else {
      plotSvgAddon(p5, p5.prototype, {});
    }
  }


  // Expose public functions to the namespace
  global.p5plotSvg = p5plotSvg;

  // Attach functions to the global scope for easier access.
  // Repeat this pattern for any other functions you wish to expose globally
  global.beginRecordSvg      = p5plotSvg.beginRecordSvg;
  global.pauseRecordSvg      = p5plotSvg.pauseRecordSvg;
  global.endRecordSvg        = p5plotSvg.endRecordSvg;
  global.setSvgDocumentSize  = p5plotSvg.setSvgDocumentSize;

  global.setSvgResolutionDPI = p5plotSvg.setSvgResolutionDPI;
  global.setSvgResolutionDPCM = p5plotSvg.setSvgResolutionDPCM;
  global.setSvgDefaultStrokeWeight = p5plotSvg.setSvgDefaultStrokeWeight;
  global.setSvgMergeNamedGroups = p5plotSvg.setSvgMergeNamedGroups;
  global.setSvgInkscapeCompatibility = p5plotSvg.setSvgInkscapeCompatibility;
  global.setSvgGroupByStrokeColor = p5plotSvg.setSvgGroupByStrokeColor;
  global.setSvgDefaultStrokeColor = p5plotSvg.setSvgDefaultStrokeColor;
  global.setSvgBackgroundColor = p5plotSvg.setSvgBackgroundColor;
  global.setSvgIndent = p5plotSvg.setSvgIndent;
  global.setSvgFlattenTransforms = p5plotSvg.setSvgFlattenTransforms;
  global.setSvgCoordinatePrecision = p5plotSvg.setSvgCoordinatePrecision;
  global.setSvgTransformPrecision = p5plotSvg.setSvgTransformPrecision;
  global.setSvgPointRadius = p5plotSvg.setSvgPointRadius;
  global.beginSvgGroup = p5plotSvg.beginSvgGroup;
  global.endSvgGroup = p5plotSvg.endSvgGroup;
  global.getDefaultStrokeColor = p5plotSvg.getDefaultStrokeColor;
  global.isRecordingSVG = p5plotSvg.isRecordingSVG;

  // New injection utilities (v.0.1.6+)
  global.injectSvgHeaderAttribute = p5plotSvg.injectSvgHeaderAttribute;
  global.injectSvgDef = p5plotSvg.injectSvgDef;
  global.setSvgExportPolylinesAsPaths = p5plotSvg.setSvgExportPolylinesAsPaths;

  global.SVG_INDENT_SPACES = p5plotSvg.SVG_INDENT_SPACES;
  global.SVG_INDENT_NONE = p5plotSvg.SVG_INDENT_NONE;
  global.SVG_INDENT_TABS = p5plotSvg.SVG_INDENT_TABS;
  global.SVG_UNITS_IN = p5plotSvg.SVG_UNITS_IN;
  global.SVG_UNITS_CM = p5plotSvg.SVG_UNITS_CM;


  // Global-level LEGACY aliases (deprecated):
  global.beginRecordSVG = function() {
    console.warn("beginRecordSVG() is deprecated. The new name is beginRecordSvg().");
    return p5plotSvg.beginRecordSvg.apply(p5plotSvg, arguments);
  };
  global.pauseRecordSVG = function() {
    console.warn("pauseRecordSVG() is deprecated. The new name is pauseRecordSvg().");
    return p5plotSvg.pauseRecordSvg.apply(p5plotSvg, arguments);
  };
  global.endRecordSVG = function() {
    console.warn("endRecordSVG() is deprecated. The new name is endRecordSvg().");
    return p5plotSvg.endRecordSvg.apply(p5plotSvg, arguments);
  };
  global.setSVGDocumentSize = function() {
    console.warn("setSVGDocumentSize() is deprecated. The new name is setSvgDocumentSize().");
    return p5plotSvg.setSvgDocumentSize.apply(p5plotSvg, arguments);
  };

  //--------------
  // Support CommonJS and ES6 modules
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = p5plotSvg;
  } else {
    global.p5plotSvg = p5plotSvg;
  }


})(typeof globalThis !== 'undefined' ? globalThis : undefined);
