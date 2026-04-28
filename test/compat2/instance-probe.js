(function() {
  p5.disableFriendlyErrors = true;

  const result = {
    version: p5.VERSION,
    before: {
      lineOwn: Object.prototype.hasOwnProperty.call(window, "line"),
      rectOwn: Object.prototype.hasOwnProperty.call(window, "rect")
    },
    after: null,
    error: "",
    svgLength: 0
  };

  function finish() {
    result.after = {
      lineOwn: Object.prototype.hasOwnProperty.call(window, "line"),
      rectOwn: Object.prototype.hasOwnProperty.call(window, "rect"),
      lineType: typeof window.line,
      rectType: typeof window.rect
    };

    document.body.textContent = JSON.stringify(result);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "compat2-instance-probe",
        result
      }, "*");
    }
  }

  new p5(function(sketch) {
    sketch.setup = function() {
      sketch.createCanvas(40, 40);
      sketch.noLoop();
      try {
        beginRecordSvg(sketch, null);
        sketch.line(2, 2, 38, 38);
        sketch.rect(8, 8, 18, 14);
        const svg = endRecordSvg();
        result.svgLength = svg.length;
      } catch (err) {
        result.error = String(err && err.message ? err.message : err);
        try {
          endRecordSvg();
        } catch (endErr) {
          result.error += " | endRecordSvg: " + String(endErr && endErr.message ? endErr.message : endErr);
        }
      }
      finish();
    };
  });
})();
