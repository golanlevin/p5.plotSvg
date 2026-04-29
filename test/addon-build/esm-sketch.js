import p5plotSvgDefault, { p5plotSvg, plotSvgAddon } from '../../dist/p5.plotSvg.esm.js';

p5.disableFriendlyErrors = true;

window.__addonEsmImportReport = {
  defaultMatchesNamed: p5plotSvgDefault === p5plotSvg,
  hasNamespace: typeof p5plotSvg === 'object',
  hasAddon: typeof plotSvgAddon === 'function',
  registeredAddon: typeof p5.registerAddon === 'function' &&
    p5._registeredAddons instanceof Set &&
    p5._registeredAddons.has(plotSvgAddon)
};

new p5(function(sketch) {
  sketch.setup = function() {
    sketch.createCanvas(120, 80);
    sketch.noLoop();

    window.runAddonEsmBuildExport = function() {
      sketch.beginRecordSvg(null);
      sketch.line(10, 10, 110, 10);
      sketch.rect(20, 25, 40, 30);
      sketch.circle(85, 40, 20);
      return sketch.endRecordSvg();
    };
  };

  sketch.draw = function() {
    sketch.background(255);
    sketch.line(10, 10, 110, 10);
    sketch.rect(20, 25, 40, 30);
    sketch.circle(85, 40, 20);
  };
});
