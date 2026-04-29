import '../lib/p5.plotSvg.js';

const root = typeof globalThis !== 'undefined' ? globalThis : undefined;
const p5plotSvg = root ? root.p5plotSvg : undefined;
const plotSvgAddon = p5plotSvg ? p5plotSvg.plotSvgAddon : undefined;

export { p5plotSvg, plotSvgAddon };
export default p5plotSvg;
