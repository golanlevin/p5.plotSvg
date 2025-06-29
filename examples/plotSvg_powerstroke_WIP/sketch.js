// WORK IN PROGRESS; NOTHING TO SEE HERE YET

p5.disableFriendlyErrors = true; 

let bDoExportSvg = false; 
function setup() {
  createCanvas(576, 384); // Postcard size: 6"x4" at 96 dpi
}

function keyPressed(){
  if (key == 's'){
    // Initiate SVG exporting
    bDoExportSvg = true; 
  }
}

function draw(){
  background(245); 
  strokeWeight(1);
  stroke(0);
  noFill();
  
  if (bDoExportSvg){
    // Begin exporting, if requested
    beginRecordSVG(this, "plotSvg_powerstroke.svg");

    // Inject additional information into the SVG.
    injectSvgHeaderAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape");
    injectSvgHeaderAttribute("inkscape:version", "1.4 (e7c3feb1, 2024-10-09)");
    injectSvgDef("inkscape:path-effect", {
      id: "pe-1",
      effect: "powerstroke",
      is_visible: "true",
      lpeversion: "1.3",
      scale_width: "1",
      interpolator_type: "Linear",
      start_linecap_type: "zerowidth",
      end_linecap_type: "zerowidth",
      offset_points: "0.0,1.0 | 0.60,0.15 | 0.90,0.50"
    });
  }


  push(); 
  translate(width/2, height/2); 

  beginSvgGroup("myGroup", {
    "inkscape:label": "Layer 1",
    "inkscape:groupmode": "layer",
  });
  beginShape();
  vertex(-100,-100); 
  vertex(-75,-125); 
  vertex(-50,-100); 
  vertex(-75,-75);
  endShape(); 
  endSvgGroup();

  beginSvgGroup("myGroup");
  circle(0,-100, 50); 
  endSvgGroup();

  // Anonymous group with attributes
  beginSvgGroup({
    "data-name": "anon-group",
  });
  ellipse(100,-100, 75,50);
  endSvgGroup();


  rectMode(CENTER); 
  rect(0,0, 400,300); 
  pop(); 
  

  if (bDoExportSvg){
    endRecordSVG();
    bDoExportSvg = false;
  }
}