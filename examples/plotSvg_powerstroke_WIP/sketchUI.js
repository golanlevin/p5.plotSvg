//=========================================================
// USER INTERFACE
let spineModeRadio, spineModeRadioLabel;
let envModeRadio, envModeRadioLabel;
let maxThicknessSlider, maxThicknessSliderLabel;
let fitCurveSlider, fitCurveSliderLabel; 
let betaSlider, betaSliderLabel;
let envEmphasisSlider, envEmphasisSliderLabel;
let envContrastSlider, envContrastSliderLabel;
let envScaleSlider, envScaleSliderLabel;
let envOffsetSlider, envOffsetSliderLabel;
let envStepSlider, envStepSliderLabel; 
let filterButton, clearButton, resetButton; 

function updateSliders(){
  maxThicknessSliderLabel.html("Width Multiplier: " + nf(maxThicknessSlider.value(), 1, 3));
  fitCurveSliderLabel.html("Spine Fit Error: " + nf(fitCurveSlider.value(), 1, 3));
  betaSliderLabel.html("Envelope Smoothness: " + nf(betaSlider.value(), 1, 3));
  envStepSliderLabel.html("Envelope Step: " + nf(envStepSlider.value(), 1, 3));
  envEmphasisSliderLabel.html("Emphasis: " + nf(envEmphasisSlider.value(), 1, 3));
  envContrastSliderLabel.html("Contrast: " + nf(envContrastSlider.value(), 1, 3));
  envScaleSliderLabel.html("Scale: " + nf(envScaleSlider.value(), 1, 3));
  envOffsetSliderLabel.html("Offset: " + nf(envOffsetSlider.value(), 1, 3));
}

function createUserInterface(){
  createSliders(); 
  createSpineModeRadio(); 
  createEnvelopeModeRadio(); 
  createSpineModeRadio(); 
  createButtons();
}

//--------------------
function createSpineModeRadio(){
  spineModeRadio = createRadio();
  spineModeRadio.class('p5-radio');
  spineModeRadio.position(7, 10);
  spineModeRadio.size(300);
  spineModeRadio.option(SPINE_MODE_LINEAR, 'Polyline');  
  spineModeRadio.option(SPINE_MODE_BEZIER, 'PolyBezier');  
  spineModeRadio.selected(String(SPINE_MODE_LINEAR));
  spineModeRadio.elt.addEventListener('mousedown', (e) => e.stopPropagation());
  spineModeRadio.changed(() => {
    SPINE_MODE = Number(spineModeRadio.value());
    fitCurveSlider.elt.disabled = (SPINE_MODE != SPINE_MODE_BEZIER);
  });
  fitCurveSlider.elt.disabled = (SPINE_MODE != SPINE_MODE_BEZIER);
  spineModeRadioLabel = createDiv('Spine Construction');
  spineModeRadioLabel.position(220, 12);
}

//--------------------
function createEnvelopeModeRadio() {
  envModeRadio = createRadio();
  envModeRadio.class('p5-radio');
  envModeRadio.position(7, 30);
  envModeRadio.size(300); 
  envModeRadio.option(ENV_INTERP_LINEAR, 'Linear');  
  envModeRadio.option(ENV_INTERP_BEZIER_JOHAN, 'CubicBezierJohan');  
  envModeRadio.selected(String(ENV_INTERP_LINEAR));
  envModeRadio.elt.addEventListener('mousedown', (e) => e.stopPropagation());
  envModeRadio.changed(() => {
    ENV_INTERP_MODE = Number(envModeRadio.value());
    betaSlider.elt.disabled = (ENV_INTERP_MODE != ENV_INTERP_BEZIER_JOHAN);
  });
  betaSlider.elt.disabled = (ENV_INTERP_MODE != ENV_INTERP_BEZIER_JOHAN);
  envModeRadioLabel = createDiv('Envelope Smoothing Type');
  envModeRadioLabel.position(220, 32);
}


function setRadioOption(radio, valueToDisable, torf) {
  const inputs = radio.elt.querySelectorAll('input[type="radio"]');
  for (let input of inputs) {
    if (input.value === String(valueToDisable)) {
      input.disabled = !torf;
      break;
    }
  }
}

//--------------------
function createSliders(){
  let sy = 110;
  const dy = 20; 
  
  envStepSlider = createSlider(0.25,20, 3, 0.25);
  envStepSlider.position(10, sy);
  envStepSlider.size(200);
  envStepSlider.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  envStepSliderLabel = createDiv('Envelope Step');
  envStepSliderLabel.position(220, sy);
  sy += dy; 
  
  maxThicknessSlider = createSlider(1,100, 50, 1);
  maxThicknessSlider.position(10, sy);
  maxThicknessSlider.size(200);
  maxThicknessSlider.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  maxThicknessSliderLabel = createDiv('Width Multiplier');
  maxThicknessSliderLabel.position(220, sy);
  sy += dy; 
  
  fitCurveSlider = createSlider(0.1,20, 4, 0.1);
  fitCurveSlider.position(10, sy);
  fitCurveSlider.size(200);
  fitCurveSlider.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  fitCurveSliderLabel = createDiv('Spine Fit Error');
  fitCurveSliderLabel.position(220, sy);
  sy += dy; 
  
  betaSlider = createSlider(0,1, 0.333333, 0.005);
  betaSlider.position(10, sy);
  betaSlider.size(200);
  betaSlider.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  betaSliderLabel = createDiv('Envelope Smoothness');
  betaSliderLabel.position(220, sy);
  sy += dy; 

  envEmphasisSlider = createSlider(-1,1, 0.0, 0.005);
  envEmphasisSlider.position(10, sy);
  envEmphasisSlider.size(200);
  envEmphasisSlider.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  envEmphasisSliderLabel = createDiv('Emphasis');
  envEmphasisSliderLabel.position(220, sy);
  sy += dy; 

  envContrastSlider = createSlider(0,1, 0.0, 0.005);
  envContrastSlider.position(10, sy);
  envContrastSlider.size(200);
  envContrastSlider.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  envContrastSliderLabel = createDiv('Contrast');
  envContrastSliderLabel.position(220, sy);
  sy += dy; 
  
  envScaleSlider = createSlider(0,2, 1, 0.005);
  envScaleSlider.position(10, sy);
  envScaleSlider.size(200);
  envScaleSlider.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  envScaleSliderLabel = createDiv('Scale');
  envScaleSliderLabel.position(220, sy);
  sy += dy; 

  envOffsetSlider = createSlider(-1,1, 0, 0.005);
  envOffsetSlider.position(10, sy);
  envOffsetSlider.size(200);
  envOffsetSlider.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  envOffsetSliderLabel = createDiv('Offset');
  envOffsetSliderLabel.position(220, sy);
  sy += dy; 
}

//--------------------
function createButtons(){
  let filterButton = createButton('Filter');
  let clearButton = createButton('Clear');
  let resetButton = createButton('Reset');
  filterButton.position(10, 80);
  clearButton.position(60,  80);
  resetButton.position(110, 80); 
  
  filterButton.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  clearButton.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  resetButton.elt.addEventListener(
    'mousedown', (e) => e.stopPropagation());
  
  filterButton.mousePressed(() => {
    filterCurrentPowerStroke();
  });
  clearButton.mousePressed(() => {
    clearCurrentPowerStroke();
  });

  resetButton.mousePressed(() => {
    envStepSlider.value(3); 
    maxThicknessSlider.value(50); 
    fitCurveSlider.value(4); 
    betaSlider.value(0.33333); 
    envEmphasisSlider.value(0);
    envContrastSlider.value(0); 
    envScaleSlider.value(1); 
    envOffsetSlider.value(0); 
  }); 
}
