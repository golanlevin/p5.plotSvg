# Context for p5.plotSvg Codebase

This document provides context for authors and LLMs working on the p5.plotSvg codebase.

## Overview

**p5.plotSvg** is a JavaScript library that enables p5.js sketches to export SVG files optimized for pen plotters (like AxiDraw). It captures p5.js drawing commands and converts them to SVG paths focused on geometry only—no fills, transparency, or raster effects.

- **Version**: 0.1.7 (November 2025)
- **Compatibility**: p5.js 1.4.2 through 1.11.11
- **Main file**: `lib/p5.plotSvg.js` (~3,300 lines)

## Architecture

The library is structured as an IIFE (Immediately Invoked Function Expression) that:

1. Creates a `p5plotSvg` namespace object
2. Maintains internal state variables
3. Overrides p5.js drawing functions during recording
4. Stores commands in an array
5. Converts commands to SVG string on export
6. Exposes public API to global scope

### Core Mechanism

```
beginRecordSvg() → overrides p5 functions → drawing commands stored in _commands[]
                                                    ↓
endRecordSvg()   → exportSVG() generates SVG string → restores original p5 functions
```

## Key Internal Variables

### Configuration (set via setter functions)
| Variable | Default | Purpose |
|----------|---------|---------|
| `_bFlattenTransforms` | `false` | If true, encode transforms as matrices; if false, use nested `<g>` groups |
| `_svgCoordPrecision` | `4` | Decimal places for coordinates |
| `_svgTransformPrecision` | `6` | Decimal places for transform values |
| `_svgDefaultStrokeColor` | `'black'` | Default stroke color |
| `_svgDefaultStrokeWeight` | `1` | Default stroke weight |
| `_svgPointRadius` | `0.25` | Radius for point() rendered as circles |
| `_svgDPI` | `96` | Resolution for inch calculations |
| `_svgMergeNamedGroups` | `true` | Merge groups with same ID |
| `_svgGroupByStrokeColor` | `false` | Group elements by stroke color |
| `_bSvgExportPolylinesAsPaths` | `false` | Export polylines as `<path>` instead of `<polyline>` |

### Recording State
| Variable | Purpose |
|----------|---------|
| `_bRecordingSvg` | Whether currently recording (can be paused) |
| `_bRecordingSvgBegun` | Whether recording session has started |
| `_commands` | Array of recorded drawing commands |
| `_vertexStack` | Temporary storage for vertices in beginShape/endShape |
| `_svgGroupLevel` | Current nesting depth for indentation |
| `_p5Instance` | Reference to the p5.js sketch instance |

## Command Types

Commands stored in `_commands[]` have a `type` field:

### Primitive Shapes
- `arc`, `bezier`, `circle`, `curve`, `ellipse`, `line`, `point`, `quad`, `rect`, `triangle`

### Complex Shapes (from beginShape/endShape)
- `polyline` - simple vertex-only shapes
- `path` - shapes with bezierVertex, quadraticVertex, or curveVertex
- `points`, `lines`, `triangles`, `triangle_fan`, `triangle_strip`, `quads`, `quad_strip`

### Transforms & Groups
- `push`, `pop`, `scale`, `translate`, `rotate`, `shearx`, `sheary`
- `beginGroup`, `endGroup` (user-defined groups)

### Other
- `stroke` - color change command
- `text` - text rendering
- `description` - SVG `<desc>` element from p5's `describe()`

## Override Pattern

Each p5 function is overridden using this pattern:

```javascript
function overrideLineFunction() {
  _originalLineFunc = _p5Instance.line;  // Save original
  _p5Instance.line = function(x1, y1, x2, y2) {
    if (_bRecordingSvg) {
      let transformMatrix = captureCurrentTransformMatrix();
      _commands.push({ type: 'line', x1, y1, x2, y2, transformMatrix });
    }
    _originalLineFunc.apply(this, arguments);  // Call original
  };
}
```

## SVG Generation

Each command type has a corresponding `getSvgStr*()` function:

- `getSvgStrLine(cmd)` → `<line x1="..." y1="..." x2="..." y2="..."/>`
- `getSvgStrCircle(cmd)` → `<circle cx="..." cy="..." r="..."/>`
- `getSvgStrPoly(cmd)` → `<polyline>`, `<polygon>`, or `<path>`
- etc.

### Transform Handling

Two modes controlled by `_bFlattenTransforms`:

1. **Hierarchical (default)**: Transforms become nested `<g transform="...">` elements
2. **Flattened**: Each element gets a `transform="matrix(...)"` attribute

### Stroke Color Handling

- Default stroke applied via CSS in `<style>` block
- Non-default colors add inline `style="stroke:..."` to elements
- Colors converted from rgba/rgb to hex format
- `setSvgGroupByStrokeColor(true)` groups elements by color for multi-pen plotting

## Public API

### Core Functions
- `beginRecordSvg(p5Instance, filename)` - Start recording
- `pauseRecordSvg(bPause)` - Pause/resume recording
- `endRecordSvg()` - Stop recording and export SVG (returns SVG string)

### Configuration Setters
- `setSvgDocumentSize(w, h)` - Override canvas dimensions
- `setSvgResolutionDPI(dpi)` / `setSvgResolutionDPCM(dpcm)`
- `setSvgDefaultStrokeColor(col)` / `setSvgDefaultStrokeWeight(wei)`
- `setSvgBackgroundColor(col)`
- `setSvgFlattenTransforms(bool)`
- `setSvgCoordinatePrecision(n)` / `setSvgTransformPrecision(n)`
- `setSvgPointRadius(r)`
- `setSvgIndent(type, amount)` - Use `SVG_INDENT_SPACES`, `SVG_INDENT_TABS`, or `SVG_INDENT_NONE`
- `setSvgMergeNamedGroups(bool)`
- `setSvgGroupByStrokeColor(bool)`
- `setSvgExportPolylinesAsPaths(bool)`

### Grouping
- `beginSvgGroup(name, attrs)` / `endSvgGroup()` - Create named groups in SVG

### Utilities
- `getDefaultStrokeColor()` - Get current default color
- `isRecordingSVG()` - Check if recording is active
- `injectSvgHeaderAttribute(name, value)` - Add attributes to `<svg>` tag
- `injectSvgDef(type, attributesObj)` - Add elements to `<defs>`

## Key Utility Functions

- `formatNumber(val, precision)` - Format numbers for SVG output
- `captureCurrentTransformMatrix()` - Get current canvas transform
- `generateTransformString(cmd)` - Create SVG transform attribute
- `catmullRom2bezier(crp, closed)` - Convert Catmull-Rom curves to Bezier
- `p5ArcToSvgPath(x, y, w, h, start, stop)` - Convert p5 arc to SVG arc path
- `areColorsEqual(c1, c2)` - Compare colors accounting for format differences
- `rgbToHex(r, g, b)` - Convert RGB to hex string

## Known Limitations

1. No fill support (by design—plotter-focused)
2. No WEBGL mode support
3. `textAlign()` vertical modes (except BASELINE) not fully supported
4. Multi-contour shapes (`beginContour`/`endContour`) not supported
5. `curveVertex()` has minor starting orientation error
6. `colorMode()` not supported—only CSS colors, hex, and RGB 0-255
7. Fonts referenced by name, not embedded

## File Structure

```
p5.plotSvg/
├── lib/
│   └── p5.plotSvg.js      # Main library (~3,300 lines)
├── examples/               # Example sketches
├── images/                 # README images
├── documentation.md        # API documentation
├── README.md              # Project overview
└── package.json           # npm package config
```

## Extension Points

The library exposes `p5plotSvg._commands` during recording, allowing addon libraries (like p5PowerStroke) to:
- Read the commands array
- Add custom commands with `attributes` arrays
- Inject custom SVG elements

## Testing Considerations

When modifying the library, test:

1. All primitive shapes with various modes (ellipseMode, rectMode, etc.)
2. Transform combinations (nested push/pop with rotate/scale/translate)
3. beginShape with different vertex types and shape kinds
4. Stroke color changes and grouping
5. Both transform modes (flattened vs. hierarchical)
6. Instance mode vs. global mode usage
