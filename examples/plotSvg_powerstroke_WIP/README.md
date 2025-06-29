# plotSvg_powerstroke Example

**WORK IN PROGRESS — NOTHING TO SEE HERE YET**

---

Done: 

* created `_injectedHeaderAttributes`
* created `injectSvgHeaderAttribute()` and exposed to global namespace 
* implemented addition of `_injectedHeaderAttributes` to the `<svg>` tag.
* created `_injectedDefs`
* created `injectSvgDef()` and exposed to global namespace 
* implemented addition of `_injectedDefs` to the `<defs>` tag.
* implemented adding attributes to user-defined groups, e.g. `inkscape:label="Layer 1" inkscape:groupmode="layer"`
* implemented `setSvgExportPolylinesAsPaths()` and `_bSvgExportPolylinesAsPaths`
* altered `getSvgStrPoly()` to convert polylines to paths if requested
