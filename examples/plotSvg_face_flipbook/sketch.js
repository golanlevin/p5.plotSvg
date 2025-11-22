// Software which exports an SVG flipbook showing a 
// two-second recording from a face-tracker, using
// p5.js v.1.11.10 + MediaPipe v.0.10.17 + p5.plotSvg v.0.1.5
 
//------------------------------------------
let myFaceLandmarker;
let faceLandmarks;
let myCapture;
let lastVideoTime = -1;
let bDoExportSvg = false; 

const DPI = 96; 
const margin = DPI*0.5; 
const nPageCols = 6; 
const nPageRows = 9; 
const nPages = nPageCols * nPageRows;

let faces = [];
let currentFrameIndex = 0;
p5.disableFriendlyErrors = true; 

//------------------------------------------
const trackingConfig = {
  doAcquireFaceMetrics: true,
  cpuOrGpuString: "GPU", /* "GPU" or "CPU" */
  maxNumFaces: 1,
};
//------------------------------------------
async function preload() {
  const mediapipe_module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js');
  FaceLandmarker = mediapipe_module.FaceLandmarker;
  FilesetResolver = mediapipe_module.FilesetResolver;
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
  );
  // Face Landmark Tracking:
  // https://developers.google.com/mediapipe/solutions/vision/face_landmarker
	myFaceLandmarker = await FaceLandmarker.createFromOptions(vision, {
		numFaces: trackingConfig.maxNumFaces,
		runningMode: "VIDEO",
		outputFaceBlendshapes:trackingConfig.doAcquireFaceMetrics,
		baseOptions: {
			delegate: trackingConfig.cpuOrGpuString,
			modelAssetPath:
				"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
		},
	});
}

//------------------------------------------
async function predictWebcam() {
  let startTimeMs = performance.now();
  if (lastVideoTime !== myCapture.elt.currentTime) {
    if (myFaceLandmarker) {
      faceLandmarks = myFaceLandmarker.detectForVideo(myCapture.elt,startTimeMs);
    }
    lastVideoTime = myCapture.elt.currentTime;
  }
  window.requestAnimationFrame(predictWebcam);
}

//------------------------------------------
function keyPressed(){
	bDoExportSvg = false; 
	currentFrameIndex = 0; 
	faces = []; 
}

//------------------------------------------
function setup() {
  createCanvas(11*DPI, 8.5*DPI);
  myCapture = createCapture(VIDEO);
  myCapture.size(320, 240);
  myCapture.hide();
	setSvgDefaultStrokeWeight(0.25); 
}

//------------------------------------------
function draw() {
  background(245);
	noFill();
	stroke("black");
	strokeWeight(0.5);

  predictWebcam();
	storeCurrentFace(); 
	text("Press a key to restart recording.",10,30);
	
	if (bDoExportSvg){
    beginRecordSvg(this, "plotSvg_face_flipbook.svg");
  }

  drawVideoBackground();
	drawFlipbookPageBoundaries(); 
	drawFlipbookPages();
	
	if (bDoExportSvg){
    endRecordSvg();
    bDoExportSvg = false;
  }
}

//------------------------------------------
function drawFlipbookPageBoundaries(){
	let rw = (width-2*margin)/nPageCols;
	let rh = (height-2*margin)/nPageRows;
	let f = 0; 
	noFill(); 
	stroke(0); 
	for (let col=0; col<nPageCols; col++){
		for (let row=0; row<nPageRows; row++){
			let rx = map(col,0,nPageCols, margin,width-margin);
			let ry = map(row,0,nPageRows, margin,height-margin);
			rect(rx,ry,rw,rh); 
			text(f++, rx+5,ry+20); 
		}
	}
}

//------------------------------------------
function drawFlipbookPages(){
	let rw = (width-2*margin)/nPageCols;
	let rh = (height-2*margin)/nPageRows;
	let f = 0; 
	for (let col=0; col<nPageCols; col++){
		for (let row=0; row<nPageRows; row++){
			let rx = map(col,0,nPageCols, margin,width-margin);
			let ry = map(row,0,nPageRows, margin,height-margin);
			
			let vm = 5; 
			let vh = rh-(vm*2); 
			let vw = myCapture.width / myCapture.height * vh; 
			let vx = rx+rw - vw-vm; 
			let vy = ry+vm; 
			rect(vx,vy, vw,vh); 
			
			if (f < faces.length){
				if ((f == (faces.length-1)) && !bDoExportSvg){
					drawFace(vx,vy, vw,vh, faces[frameCount%faces.length]);
				} else {
					drawFace(vx,vy, vw,vh, faces[f]);
				}
				f++; 
			}
		}
	}
}

//------------------------------------------
function drawVideoBackground() {
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 255, 255, 32);
  image(myCapture, 0, 0, width, height);
  tint(255);
  pop();
}

//------------------------------------------
function storeCurrentFace(rx,ry, rw,rh) {
	if (faceLandmarks && faceLandmarks.faceLandmarks) {
		const nFaces = Math.min(1, faceLandmarks.faceLandmarks.length);
		if (nFaces > 0) {
			for (let f = 0; f < nFaces; f++) {
				let aFace = faceLandmarks.faceLandmarks[f];
				if (aFace) {
					let nFrames = nPageCols*nPageRows;
					if (faces.length < nFrames){
						faces.push(aFace); 
						if (faces.length == nFrames){
							bDoExportSvg = true;
						}
					}
				}
			}
		}
	}
}

//------------------------------------------
function drawFace(rx,ry, rw,rh, aFace){
	drawConnectors(rx,ry, rw,rh, aFace, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE);
	drawConnectors(rx,ry, rw,rh, aFace, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW);
	drawConnectors(rx,ry, rw,rh, aFace, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE);
	drawConnectors(rx,ry, rw,rh, aFace, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW);
	drawConnectors(rx,ry, rw,rh, aFace, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);
	drawConnectors(rx,ry, rw,rh, aFace, FaceLandmarker.FACE_LANDMARKS_LIPS);
	drawConnectors(rx,ry, rw,rh, aFace, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS);
	drawConnectors(rx,ry, rw,rh, aFace, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS);
	drawConnectors(rx,ry, rw,rh, aFace, FACELANDMARKER_NOSE);
}

//------------------------------------------
function drawConnectors(rx,ry,rw,rh, landmarks, connectorSet) {
  if (landmarks) {
    let nConnectors = connectorSet.length;
    for (let i=0; i<nConnectors; i++){
      let index0 = connectorSet[i].start; 
      let index1 = connectorSet[i].end;
      let x0 = map(landmarks[index0].x, 0,1, rx+rw,rx);
      let y0 = map(landmarks[index0].y, 0,1, ry,ry+rh);
      let x1 = map(landmarks[index1].x, 0,1, rx+rw,rx);
      let y1 = map(landmarks[index1].y, 0,1, ry,ry+rh);
      line(x0,y0, x1,y1); 
    }
  }
}

const FACELANDMARKER_NOSE = [{start:168,end:6},{start:6,end:195},
														 {start:195,end:4},{start:98,end:97},
														 {start:97,end:2},{start:2,end:326},
														 {start:326,end:327}];