<!-- 
// previously generated documentation using: 
// npx documentation build p5.plotSvg.js -f md -o docs --shallow
// ...but now edited by hand, sorry
-->

# p5.plotSvg Documentation

### Table of Contents

*   [beginRecordSvg](#beginrecordsvg)
*   [pauseRecordSvg](#pauserecordsvg)
*   [endRecordSvg](#endrecordsvg)
*   [setSvgDocumentSize](#setsvgdocumentsize)
*   [setSvgResolutionDPI](#setsvgresolutiondpi)
*   [setSvgResolutionDPCM](#setsvgresolutiondpcm)
*   [setSvgDefaultStrokeWeight](#setsvgdefaultstrokeweight)
*   [setSvgDefaultStrokeColor](#setsvgdefaultstrokecolor)
*   [setSvgBackgroundColor](#setsvgbackgroundcolor)
*   [setSvgIndent](#setsvgindent)
*   [setSvgFlattenTransforms](#setsvgflattentransforms)
*   [setSvgCoordinatePrecision](#setsvgcoordinateprecision)
*   [setSvgTransformPrecision](#setsvgtransformprecision)
*   [setSvgPointRadius](#setsvgpointradius)
*   [setSvgGroupByStrokeColor](#setsvggroupbystrokecolor)
*   [setSvgMergeNamedGroups](#setsvgmergenamedgroups)
*   [beginSvgGroup](#beginsvggroup)
*   [endSvgGroup](#endsvggroup)
*   [getDefaultStrokeColor](#getdefaultstrokecolor)
*   [isRecordingSVG](#isRecordingSVG)


<!-- WORK IN PROGRESS
*   [setSvgExportPolylinesAsPaths](#setsvgexportpolylinesaspaths)
*   [injectSvgHeaderAttribute](#injectsvgheaderattribute)
*   [injectSvgDef](#injectsvgdef) 
-->


---


## beginRecordSvg

Begins recording SVG output for a p5.js sketch.
Initializes recording state, validates and sets the output filename,
and overrides p5.js drawing functions to capture drawing commands for SVG export.

#### Parameters
*   `p5Instance` **[object][26]** A reference to the current p5.js sketch (e.g. `this`).
*   `fn` **[string][27]?** Optional filename for the output SVG file. The *explicit* use of `null` will prevent a file from being saved. Behavior: 
	* `beginRecordSvg(this, "file.svg"); // saves to "file.svg"`
	* `beginRecordSvg(this); // saves to "output.svg" (default)`
	* `beginRecordSvg(this, null); // DOES NOT save any file!`


## pauseRecordSvg

Pauses or unpauses recording of SVG output for a p5.js sketch,
depending on whether the boolean `bPause` argument is `true` or `false`.

#### Parameters
*   `bPause ` **[boolean][29]**


## endRecordSvg

Ends recording of SVG output for a p5.js sketch. Calls the export function to generate the SVG output and restores the original p5.js functions. Returns the complete text of the SVG file as a string.


## setSvgDocumentSize

Sets the dimensions of the SVG document in pixels/dots. 
Note that graphics are not scaled to fit this size; they may extend beyond the specified dimensions. 
If this is not set, the system will default to the main canvas dimensions (i.e. from `createCanvas()`).

#### Parameters
*   `w` **[number][28]** The SVG document width in pixels/dots. Must be a positive number.
*   `h` **[number][28]** The SVG document height in pixels/dots. Must be a positive number.


## setSvgResolutionDPI

Sets the resolution for the exported SVG file in dots per inch (DPI).
This value is used to determine the scaling of units (pixels to physical dimensions) in the SVG output. The default is 96 dpi. 

#### Parameters
*   `dpi` **[number][28]** The resolution in dots per inch. Must be a positive number.


## setSvgResolutionDPCM

Sets the resolution for the exported SVG file in dots per centimeter (DPCM).
This value is used to determine the scaling of units (pixels to physical dimensions) in the SVG output. The default resolution is approximately 37.79527559 dpcm (equivalent to 96 dpi). 

#### Parameters
*   `dpcm` **[number][28]** The resolution in dots per centimeter. Must be a positive number.


## setSvgDefaultStrokeWeight

Sets the default stroke weight for SVG elements.

#### Parameters
*   `wei` **[number][28]** The stroke weight to set.


## setSvgDefaultStrokeColor

Sets the default stroke color for SVG elements.

#### Parameters
*   `col` **[string][27]** The stroke color to set, in valid CSS color format.


## setSvgBackgroundColor

Sets an optional background color (as a CSS style) for the SVG. This is independent of the `background()` color of the p5 sketch. 
This color does not interfere with plotter output and is purely for visualization. Note that this color may not be visible in all SVG viewers. If this function is not called, no background color style is specified in the SVG.

#### Parameters
*   `col` **[string][27]** The background color to set, in valid CSS color format.


## setSvgIndent

Sets the type and amount of indentation used for formatting SVG output.
The function allows for spaces, tabs, or no indentation.

#### Parameters
*   `itype` **[string][27]** The type of indentation to use. Valid values are
    'SVG\_INDENT\_SPACES', 'SVG\_INDENT\_TABS', or 'SVG\_INDENT\_NONE'.
*   `inum` **[number][28]?** Optional number of spaces or tabs to use for indentation.
    Must be a non-negative integer if provided. Defaults to 2 for spaces and 1 for tabs.


## setSvgFlattenTransforms

Set whether or not to use a stack to encode matrix transforms.

* `setSvgFlattenTransforms(true)` -- larger SVG files, greater fidelity to original
* `setSvgFlattenTransforms(false)` -- smaller SVG files, potentially less fidelity

#### Parameters
*   `b` **[boolean][29]** Whether or not to flatten geometric transforms


## setSvgCoordinatePrecision

Sets the output precision for graphics coordinates in SVGs by adjusting
the number of decimal digits used when formatting values. Default is 4 digits. 

#### Parameters
*   `p` **[number][28]** The desired number of decimal digits for coordinates.
    Must be a non-negative integer. If an invalid value is provided, a warning is issued.


## setSvgTransformPrecision

Sets the output precision for matrix-transform values in SVGs by adjusting
the number of decimal digits used when formatting rotations, translations, etc. Default is 6 digits. 

#### Parameters
*   `p` **[number][28]** The desired number of decimal digits for matrix values.
    Must be a non-negative integer. If an invalid value is provided, a warning is issued.


## setSvgPointRadius

Sets the radius for "points" (which are rendered as tiny circles) in the SVG output. Default is 0.25 pixels.

#### Parameters
*   `radius` **[number][28]** The desired radius for points, specified as a positive number.
    If an invalid value (non-positive or non-number) is provided, a warning is issued.


## setSvgGroupByStrokeColor

Sets whether or not to group SVG elements by stroke color. When true, elements with the same stroke color, at the same level, will be grouped together.

#### Parameters

*   `bEnabled` **[boolean][29]** Enable or disables grouping of elements by stroke color. The default is `false`.


## setSvgMergeNamedGroups

Sets whether or not to merge user-defined SVG groups that have the same name. 
Useful for grouping paths that might be computed at different times, but which are part of the same compositional design element, and should be plotted with the same drawing tool. The default is `true`, meaning that groups with the same name (which are at the same hierarchical level) will be merged.

#### Parameters
*   `bEnabled` **[boolean][29]** Whether or not groups with the same name should be merged.


<!-- WORK IN PROGRESS
## setSvgExportPolylinesAsPaths
Sets whether all polylines should be exported as `<path>` elements instead of `<polyline>` or `<polygon>`.  
This option is required for compatibility with Inkscape’s PowerStroke live path effect (LPE), which only works with `<path>` elements.  
By default, p5.plotSvg outputs simple poly-linear shapes as `<polyline>` or `<polygon>`.

#### Parameters
*   `b` **[boolean][29]** `true` to export polylines as `<path>` elements, `false` to keep the default behavior.
-->


<!-- WORK IN PROGRESS; revised documentation:
## beginSvgGroup
Begins a new user-defined grouping of SVG elements.  
You may optionally provide a group name (used as the `id` attribute),  
and/or an object specifying additional attributes to apply to the group element.  
Be sure to call `endSvgGroup()` later or the SVG file will report errors.

#### Parameters
*   `gnameOrAttrs` **[string][27] | [object][26]?**  
    If a string is provided, it is used as the group name (i.e., `id` attribute).  
    If an object is provided, it is interpreted as a set of SVG attributes to apply to the group element.
*   `attrs` **[object][26]?** Optional object of additional attribute name-value pairs to apply to the group.  
    Only used if the first argument is a group name string.
-->

## beginSvgGroup

Begins a new user-defined grouping of SVG elements.
Optionally associates a group name to the SVG group.
Be sure to call `endSvgGroup()` later or the SVG file will report errors.

#### Parameters
*   `gname` **[string][27]?** Optional group name used as an ID for the SVG group.



## endSvgGroup

Ends the current user-defined group of SVG elements.


## getDefaultStrokeColor

Retrieves the default stroke color used for SVG rendering.
Returns **[string][27]** The default stroke color (in hex, RGB, or named CSS color format).


## isRecordingSVG

Retrieves whether or not SVG recording is active.
Returns **[boolean][29]** True if SVG recording is active, false otherwise.


<!-- WORK IN PROGRESS
## injectSvgHeaderAttribute  
Injects an attribute into the `<svg>` tag in the SVG header section.  
This is useful for adding custom namespaces (e.g. `xmlns:inkscape`).  
If an attribute with the same name already exists, its value will be updated rather than duplicated.

#### Parameters  
* `attrName` **[string][27]** The name of the attribute to inject (e.g. `"xmlns:inkscape"`).  
* `attrValue` **[string][27]** The value to assign to the attribute (e.g. `"http://www.inkscape.org/namespaces/inkscape"`).
-->

<!-- WORK IN PROGRESS
## injectSvgDef  
Injects a definition into the `<defs>` section of the SVG.  
Each definition is an XML element (such as `inkscape:path-effect`) with an associated set of attributes.  
If a definition with the same `type` and `id` already exists, its attributes will be updated.

#### Parameters  
* `type` **[string][27]** The tag name of the element to define (e.g. `"inkscape:path-effect"`).  
* `attributesObj` **[object][26]** An object containing name–value pairs for the attributes of the element.  
-->


[26]: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object

[27]: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String

[28]: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number

[29]: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean