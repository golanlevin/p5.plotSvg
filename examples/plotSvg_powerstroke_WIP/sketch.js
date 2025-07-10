// WORK IN PROGRESS; NOTHING TO SEE HERE YET

p5.disableFriendlyErrors = true; 
let bDoExportSvg = false;
let myPowerStrokes = []; // Array to hold loaded PowerStroke instances
let currentPowerStrokeIndex = null; // Currently selected PowerStroke for editing

//---------------------------------------------------------------
function setup() {
  createCanvas(640, 720); // Postcard size: 6"x4" at 96 dpi
  createUserInterface(); 

  let bLoadFromFile = false; // Set to true to load from SVG file
  if (bLoadFromFile) {
    loadPowerStrokesFromSvgFile("svg/plotSvg_powerstroke_2.svg")
      .then(result => {
        let loadedCount = 0; 
        if (Array.isArray(result)) {
          for (let i = 0; i < result.length; i++) {
            myPowerStrokes.push(result[i]);
            loadedCount++;
          }
        }
        // console.log("✅ PowerStrokes loaded:", loadedCount);
      })
      .catch(err => {
        console.error("⚠️ Error loading PowerStrokes:", err);
      });
  }
  
  let aPowerStroke = new PowerStroke();
  aPowerStroke.init(); // Initialize the PowerStroke instance
  aPowerStroke.setPowerStrokeWeight(40.0);
  aPowerStroke.setInterpolatorType("Linear");


  OFFSET_POINT_ADD_MODE = OFFSET_POINT_ADD_CO_HOC;
  let np = 20; 
  for (let i = 0; i < np; i++) {
    let px = map(pow(map(i, 0,np-1, 0,1), 2.0), 0,1, 50,width-50);
    let py = 400; 
    let xt = map(px, 50,width-50, 0, 1); 
    let pr = map(  sin(2 * TWO_PI * xt), -1,1, 0.2,1.0);
    aPowerStroke.addSpineAndOffsetPt(px, py, pr); // Add spine
  }

  /*
  aPowerStroke.addSpinePt(10, 360);
  aPowerStroke.addSpinePt(470, 360);
  aPowerStroke.addOffsetPt(0.00, 1.00);
  aPowerStroke.addOffsetPt(0.15, 0.40); 
  aPowerStroke.addOffsetPt(0.35, 0.80); 
  aPowerStroke.addOffsetPt(0.60, 0.20); 
  aPowerStroke.addOffsetPt(0.90, 0.60); 
  */

  myPowerStrokes.push(aPowerStroke); // Add the PowerStroke to the array
  currentPowerStrokeIndex = 0; // Set the current PowerStroke index to the first one
  
}

function keyPressed(){
  if (key == 's'){ // Initiate SVG exporting
    bDoExportSvg = true; 
  }
  if (key == 'f'){ // Filter the current PowerStroke
    filterCurrentPowerStroke();
  }
  if (key == ' '){ // Clear the current PowerStroke
    clearCurrentPowerStroke();
  }
}


//---------------------------------------------------------------
function draw(){
  background(245); 
  updateSliders(); 
  updatePowerStrokes(); // Update the PowerStroke instances based on slider values

  strokeWeight(1);
  noFill();

  if (bDoExportSvg){
    beginRecordSVG(this, "plotSvg_powerstroke.svg");
  }

  strokeWeight(0.5);
  stroke(255,0,0); 
  fill(0,0,0, 51); 

  for (let i=0; i < myPowerStrokes.length; i++){
    let aPowerStroke = myPowerStrokes[i];
    let bDrawSpine = true; // - Whether to draw the spine points.
    let bDrawOffsetPts = false; //- Whether to draw the offset points.
    let bDrawEnvelope = false; // - Whether to draw the envelope polygon.
    let bEmitDebugViewToSvg = false; //- Whether to emit the debug view to an SVG file.

    aPowerStroke.drawDebugMini(bEmitDebugViewToSvg); // draw envelope to canvas, for debugging

    //aPowerStroke.drawDebug (false, false, true, false); // draw envelope to canvas, for debugging
    //aPowerStroke.drawDebug (true, false, false, true); // draw spine for debugging, and also emit to SVG
    aPowerStroke.addToCurrentSvg(); // add the actual PowerStroke to the current SVG (not just the debug view)
  }

  if (bDoExportSvg){
    endRecordSVG();
    bDoExportSvg = false;
  }
}

//---------------------------------------------------------------
function updatePowerStrokes() {
  for (let i = 0; i < myPowerStrokes.length; i++) {
    let aPowerStroke = myPowerStrokes[i];
    aPowerStroke.setPowerStrokeWeight(maxThicknessSlider.value());
    aPowerStroke.setFitCurveMaxError(fitCurveSlider.value()); 
    aPowerStroke.setBezierInterpBeta(betaSlider.value()); 
    aPowerStroke.setSpineMode(SPINE_MODE); 

    const step = envStepSlider.value(); 
    aPowerStroke.computeRadii(step); 
    aPowerStroke.computeEnvelope();

    let e = envEmphasisSlider.value();
    let c = envContrastSlider.value();
    let s = envScaleSlider.value();
    let o = envOffsetSlider.value();
    aPowerStroke.setShapingParams(e,c,s,o); 
    
    if (ENV_INTERP_MODE == ENV_INTERP_LINEAR){
      aPowerStroke.setInterpolatorType("Linear");
    } else {
      aPowerStroke.setInterpolatorType("CubicBezierJohan")
    }
  }
}


function filterCurrentPowerStroke() {
  if (currentPowerStrokeIndex >= 0 && currentPowerStrokeIndex < myPowerStrokes.length) {
    let myPowerStroke = myPowerStrokes[currentPowerStrokeIndex];
    myPowerStroke.filterSpine(); 
  }
}

function clearCurrentPowerStroke() {
  if (currentPowerStrokeIndex >= 0 && currentPowerStrokeIndex < myPowerStrokes.length) {
    let myPowerStroke = myPowerStrokes[currentPowerStrokeIndex];
    myPowerStroke.clear();
  }
}

function mousePressed() {
  if (currentPowerStrokeIndex >= 0 && currentPowerStrokeIndex < myPowerStrokes.length) {
    let myPowerStroke = myPowerStrokes[currentPowerStrokeIndex];
    myPowerStroke.addSpinePt(mouseX, mouseY);
  }
}

function mouseDragged() {
  if (currentPowerStrokeIndex >= 0 && currentPowerStrokeIndex < myPowerStrokes.length) {
    let myPowerStroke = myPowerStrokes[currentPowerStrokeIndex];
    myPowerStroke.addSpinePt(mouseX, mouseY);
  }
}