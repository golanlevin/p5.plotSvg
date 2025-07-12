// WORK IN PROGRESS; NOTHING TO SEE HERE YET

/*
Todo: 
* If bezier spine is selected, when exporting, clobber spinePts with resampled bezier points.
* Demonstrate pre-hoc / post-hoc offset point addition modes.

*/

p5.disableFriendlyErrors = true; 
let bDoExportSvg = false;
let myPowerStrokes = []; // Array to hold loaded PowerStroke instances
let currentPowerStrokeIndex = null; // Currently selected PowerStroke for editing

//---------------------------------------------------------------
function setup() {
  createCanvas(1280, 800);
  createUserInterface(); 

  // DEMO 1. 
  // Load a readymade PowerStroke instance from an SVG file.
  // This may end up being a long-running operation, so we do it asynchronously.
  // As a result, the loaded PowerStroke may appear at the end of the array. 
  let bLoadFromFile = true; // Set to true to load from SVG file
  if (bLoadFromFile) {
    loadPowerStrokesFromSvgFile("svg/plotSvg_powerstroke_wavy.svg")
      .then(result => {
        let loadedCount = 0; 
        if (Array.isArray(result)) {
          for (let i = 0; i < result.length; i++) {
            myPowerStrokes.push(result[i]);
            loadedCount++;
          }
        }
      })
      .catch(err => {
        console.error("⚠️ Error loading PowerStrokes:", err);
      });
  }
  
  // DEMO 2. 
  // Create a PowerStroke in which the offset points are added afterwards 
  // using addOffsetPt(), which wants indexes (0...N-1) as t-values.
  let powerStroke0 = new PowerStroke(OFFSET_POINT_ADD_ASYNC);
  powerStroke0.setPowerStrokeWeight(40.0);
  powerStroke0.setEnvInterpolatorType("Linear");
  powerStroke0.addSpinePt(100, 650);
  powerStroke0.addSpinePt(200, 550);
  powerStroke0.addSpinePt(350, 560);
  powerStroke0.addSpinePt(400, 660);
  powerStroke0.addSpinePt(500, 650);
  powerStroke0.addOffsetPt(0.00, 1.00);
  powerStroke0.addOffsetPt(0.60, 0.30);
  powerStroke0.addOffsetPt(1.00, 0.60); 
  powerStroke0.addOffsetPt(2.00, 0.20); 
  powerStroke0.addOffsetPt(3.50, 0.40); 
  powerStroke0.addOffsetPt(4.00, 0.80); 
  myPowerStrokes.push(powerStroke0); // Add the PowerStroke to the array

  
  // DEMO 3. 
  // Create a PowerStroke in which the offset points are added afterwards 
  // using addNormalizedOffsetPt(), which wants t-values in [0,1] as normalized values.
  let powerStroke1 = new PowerStroke(OFFSET_POINT_ADD_ASYNC);
  powerStroke1.setPowerStrokeWeight(40.0);
  powerStroke1.setEnvInterpolatorType("Linear");
  let nSpinePts1 = 50; 
  for (let i = 0; i < nSpinePts1; i++) {
    let px = map(pow(map(i, 0,nSpinePts1-1, 0,1), 2.0), 0,1, 500,900);
    let py = 200 + 50 * sin(px/60.0);
    powerStroke1.addSpinePt(px, py); // Add spine
  }
  noiseSeed(1234);
  let nOffsetPts1 = 9; // Number of offset points to add
  for (let j=0; j<nOffsetPts1; j++){
    let t = j/(nOffsetPts1-1); 
    let r = map(noise(j), 0.25,0.75, 0.2,1.0);
    powerStroke1.addNormalizedOffsetPt(t, r); 
  }
  myPowerStrokes.push(powerStroke1); 


  // DEMO 4.
  // Create a PowerStroke in which the offset points are added at the same time as the spine points.
  // This PowerStroke will be created by user mouse interaction. The offset points will be added
  // using addSpineAndOffsetPt(), which wants a point and a radius as parameters.
  let powerStroke2 = new PowerStroke(OFFSET_POINT_ADD_SYNC);
  powerStroke2.setPowerStrokeWeight(40.0);
  powerStroke2.setEnvInterpolatorType("Linear");
  myPowerStrokes.push(powerStroke2); // Add the PowerStroke to the array
  currentPowerStrokeIndex = myPowerStrokes.length-1; // Set the current PowerStroke index to this one
}

let mx = 0; 
let my = 0; 
let oldP = 0; 

function mousePressed() {
  if (currentPowerStrokeIndex >= 0 && currentPowerStrokeIndex < myPowerStrokes.length) {
    let myPowerStroke = myPowerStrokes[currentPowerStrokeIndex];
    // myPowerStroke.addSpinePt(mouseX, mouseY);
    let px = mouseX;
    let py = mouseY;
    let pr = 0; 
    myPowerStroke.addSpineAndOffsetPt(px, py, pr); 
    mx = mouseX;
    my = mouseY;
    oldP = 0;
  }
}

function mouseDragged() {
  if (currentPowerStrokeIndex >= 0 && currentPowerStrokeIndex < myPowerStrokes.length) {
    let myPowerStroke = myPowerStrokes[currentPowerStrokeIndex];
    // myPowerStroke.addSpinePt(mouseX, mouseY);

    let px = mx; // Previous mouse position
    let py = my; // Previous mouse position
    mx = 0.75 * mx + 0.25 * mouseX; // Smooth mouse movement
    my = 0.75 * my + 0.25 * mouseY;

    let vel = 2*dist(px, py, mx, my);
    var sca = maxThicknessSlider.value(); 
    var minP = 0.02;
    let damp = 5.0;
    let dampInv = 1.0 / damp;
    let damp1 = damp - 1;
    let th = ((minP + max(0, 1.0 - vel/sca)) + (damp1 * oldP)) * dampInv;
    oldP = th; 
  
    let pr = th; 
    pr = map(sin(millis()/50.0), -1,1, 0.2, 1.0); // Example radius based on time
    myPowerStroke.addSpineAndOffsetPt(px, py, pr); 
  }
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
  if (key == 'b'){
    if (currentPowerStrokeIndex >= 0 && currentPowerStrokeIndex < myPowerStrokes.length) {
      let myPowerStroke = myPowerStrokes[currentPowerStrokeIndex];
      let step = envStepSlider.value() || 3; // Default step value if slider is not set
      myPowerStroke.resamplePolylineFromBezierAndReindexOffsetPts(step);
    }
  }
}

//---------------------------------------------------------------
function draw(){
  background(245); 
  updateSliders(); 
  updatePowerStrokes(); // Update the PowerStroke instances based on slider values

  if (bDoExportSvg){
    beginRecordSVG(this, "plotSvg_powerstroke.svg");
  }

  fill(200,200,200, 120); 
  stroke(0,0,255, 80); 

  for (let i=0; i < myPowerStrokes.length; i++){
    let aPowerStroke = myPowerStrokes[i];

    // Draw a visual representation of the PowerStroke. 
    // If bEmitDebugViewToSvg is true, this will also emit a debug view to the SVG.
    // NOTE THAT EMITTING THE DEBUGVIEW TO SVG IS NOT THE SAME THING AS SAVING THE POWERSTROKE TO SVG.
    aPowerStroke.drawDebugView (
      true, /* bEmitDebugViewToSvg */
      true, /* bDrawEnvelope */
      true, /* bDrawEnvelopeSpans */
      true, /* bDrawSpineLine */
      true, /* bDrawSpinePts */
      true, /* bDrawShapedOffsetPts */
    );

    // Save the actual PowerStroke to the current SVG, as a PowerStroke element.
    aPowerStroke.addToCurrentSvg(); 
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
      aPowerStroke.setEnvInterpolatorType("Linear");
    } else {
      aPowerStroke.setEnvInterpolatorType("CubicBezierJohan")
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

