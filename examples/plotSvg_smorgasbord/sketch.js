// plotSvg_smorgasbord Example
// This example demonstrates the full range of p5.js drawing functions 
// that are supported by p5.plotSvg.

// This line of code disables the p5.js "Friendly Error System" (FES), 
// in order to prevent several dozen distracting warnings that arise 
// when p5.plotSvg overrides p5's drawing functions. Feel free to comment
// this out if you want the FES enabled and you don't mind the warnings. 
p5.disableFriendlyErrors = true; 

let bDoExportSvg = false; 
function setup() {
  createCanvas(612, 792);
  
  // Set important values for our SVG exporting: 
  setSvgDocumentSize(612, 792); // 6"x8" @ 96dpi
  setSvgResolutionDPI(96); // 96 dpi is default. setSvgResolutionDPCM() is also supported. 
  setSvgPointRadius(0.25); // a "point" is a 0.25 circle by default
  setSvgCoordinatePrecision(4); // how many decimal digits; default is 4
  setSvgTransformPrecision(6); // how many decimal digits; default is 6
  setSvgIndent(SVG_INDENT_SPACES, 2); // or SVG_INDENT_NONE or SVG_INDENT_TABS
  setSvgDefaultStrokeColor('black'); 
  setSvgDefaultStrokeWeight(1); 
  setSvgFlattenTransforms(false); // if true: larger files + greater fidelity to original
}


function keyPressed(){
  // Press 's' to save an SVG file of the current plot
  if (key == 's'){
    bDoExportSvg = true; 
  }
}


function draw(){
  background(245); 
  strokeWeight(1);
  stroke(0);
  noFill();
  
  if (bDoExportSvg){
    beginRecordSvg(this, "plotSvg_smorgasbord.svg");
  }

  drawDesign();

  if (bDoExportSvg){
    endRecordSvg();
    bDoExportSvg = false;
  }
}


function drawDesign(){
  // (This text gets added as metadata inside the SVG.)
  describe("A test program to export an SVG from p5.js graphics."); 
  
  // Tests of squares and rects with various rectModes
  beginSvgGroup("someSquares"); 
  rectMode(CORNER);
  square(100,250, 50); 
  rectMode(CENTER);
  square(100,250, 50); 
  rectMode(CORNERS);
  square(100,250, 50); 
  rectMode(RADIUS);
  square(100,250, 50); 
  rectMode(CENTER);
  rect(75,350, 100,50); 
  rectMode(CORNER);
  rect(75,350, 100,50); 
  endSvgGroup(); 
  
  // Tests of circles and ellipses with various ellipseModes
  beginSvgGroup("someCircles"); 
  ellipseMode(CENTER);
  circle(200,250, 50);
  ellipseMode(CORNER);
  circle(200,250, 50); 
  ellipseMode(RADIUS);
  circle(200,250, 50);
  ellipseMode(CORNERS);
  circle(50,100, 200); 
  ellipseMode(CORNER);
  ellipse(175,350, 100,50); 
  ellipseMode(CENTER);
  ellipse(175,350, 100,50); 
  endSvgGroup(); 
  
  // Tests of rounded vs. non-rounded squares and rects
  beginSvgGroup("someRectsAndRoundedRects"); 
  rect(300,25, 75,50, 15); 
  rect(375,25, 75,50); 
  stroke('blue'); 
  square(300,100, 75, 15); 
  square(375,100, 75); 
  stroke('red'); 
  rect(475,25, 80,100, 0,10,20,40);
  square(490,40,50, 5,10,0,25); 
  stroke(getDefaultStrokeColor()); 
  endSvgGroup(); 
  
  // Tests of arcs with various sweeps and closure modes
  beginSvgGroup("someCircularArcs"); 
  ellipseMode(CENTER);
  arc(400,250, 110,110, 1,PI); 
  arc(400,250, 100,100, PI,1, OPEN); 
  arc(400,250,  90, 90, PI,1, CHORD); 
  arc(400,250,  80, 80, PI,1, PIE); 
  arc(400,250,  100,100, 1.1,PI-0.1, CHORD);
  arc(410,250,  50,50, 0,1, PIE); 
  endSvgGroup(); 
  
  beginSvgGroup("someEllipticalArcs"); 
  ellipseMode(CENTER);
  arc(520,250, 110, 70, 1,PI); 
  arc(520,250, 100, 60, PI,1, OPEN); 
  arc(520,250,  90, 50, PI,1, CHORD); 
  arc(520,250,  80, 40, PI,1, PIE); 
  arc(520,250,  100,60, 1.1,PI-0.1, CHORD);
  arc(530,250,  50, 20, 0,1, PIE); 
  endSvgGroup(); 
  
  beginSvgGroup("someSimpleCurves"); 
  bezier(95, 20, 20, 10, 100, 90, 25, 80);
  curveTightness(-10);
  curve(5, 26, 73, 24, 73, 61, 15, 65);
  curveTightness(0);
  endSvgGroup(); 
  
  beginSvgGroup("someTransforms"); 
  rectMode(CENTER);
  push(); 
  translate(560, 575); 
  rect(0,0, 60,40); 
  pop(); 
  push(); 
  translate(534, 591); 
  rotate(radians(20)); 
  rect(0,0, 60,40); 
  pop(); 
  push(); 
  translate(553, 622); 
  shearX(radians(-20)); 
  rect(0,0, 60,40); 
  pop(); 
  push(); 
  translate(553, 622); 
  shearX(radians(-20)); 
  rect(0,0, 60,40); 
  pop(); 
  push(); 
  translate(539, 643); 
  shearY(radians(20)); 
  rect(0,0, 60,40); 
  pop(); 
  push(); 
  translate(542, 668); 
  scale(0.6666, 1.0); 
  rect(0,0, 60,40); 
  pop(); 
  push(); 
  translate(542,692); 
  rotate(radians(20.0)); 
  shearX(radians(-20.0));
  rect(0,0, 60,40);
  line(-30,-20, 30,20); 
  pop(); 
  rectMode(CORNER);
  endSvgGroup(); 
  
  beginSvgGroup("someOtherShapes"); 
  point(300, 255); 
  circle(300, 255, 10); 
  line(260,290, 285,210);
  triangle(300,225, 325,275, 275,275);
  quad(275,200, 325,200, 350,300, 250,300);
  endSvgGroup();
  
  // Tests of open and closed polylines with simple vertices
  beginSvgGroup("simplePolylinesAndPolygons"); 
  beginShape();
  vertex( 70, 530);
  vertex(130, 530);
  vertex(130, 550);
  vertex( 90, 550);
  vertex( 90, 570);
  vertex(130, 570);
  vertex(130, 590);
  vertex( 70, 590);
  endShape();
  
  beginShape();
  vertex( 70, 610);
  vertex(130, 610);
  vertex(130, 630);
  vertex( 90, 630);
  vertex( 90, 650);
  vertex(130, 650);
  vertex(130, 670);
  vertex( 70, 670);
  endShape(CLOSE);
  endSvgGroup();
  
  
  beginSvgGroup("complexPolylinesAndPolygons"); 
  beginShape();
  vertex(300, 340);
  quadraticVertex(360, 340, 330, 370);
  quadraticVertex(300, 400, 360, 400);
  vertex(360, 330);
  vertex(300, 330);
  endShape();
  
  beginShape();
  vertex(300, 420);
  quadraticVertex(360, 420, 330, 450);
  quadraticVertex(300, 480, 360, 480);
  vertex(360, 410);
  vertex(300, 410);
  endShape(CLOSE);
  
  beginShape();
  vertex(430, 320);
  bezierVertex(480, 300, 480, 375, 430, 375);
  bezierVertex(450, 380, 460, 325, 430, 320);
  endShape();
  
  beginShape();
  vertex      (400, 420);
  bezierVertex(400, 420,  410, 400,   420, 420);
  bezierVertex(420, 420,  430, 440,   440, 420);
  bezierVertex(440, 420,  450, 400,   460, 420);
  vertex      (460, 460);
  vertex      (400, 460);
  vertex      (400, 420);
  endShape();
  
  beginShape();
  vertex(      530, 470); 
  bezierVertex(525, 425, 600, 450, 550, 500);
  bezierVertex(550, 540, 575, 540, 600, 520); 
  endShape();

  beginShape();
  vertex(      530, 370); 
  bezierVertex(525, 325, 600, 350, 550, 400);
  bezierVertex(520, 430, 575, 440, 600, 420); 
  endShape();
  
  // See: https://github.com/processing/p5.js/issues/6560
  beginShape();
  vertex(275, 500); 
  vertex(280, 500); 
  bezierVertex(300,500, 310,530, 325,530);
  bezierVertex(340,530, 350,500, 370,500);
  vertex(375, 500);
  vertex(375, 540);
  vertex(275, 540);
  endShape(CLOSE); 
  
  beginShape();
  vertex(275, 550);
  vertex(375, 550);
  vertex(375, 590);
  vertex(350, 595);
  quadraticVertex(325,540, 300,595); 
  vertex(300, 595);
  vertex(275, 590);
  endShape(CLOSE); 
  
  beginShape();
  for (let i=0; i<24; i++){
    let t = map(i,0,24, 0,TWO_PI); 
    let r = (i%2 == 0) ? 45:25; 
    let px = 200 + r*cos(t); 
    let py = 560 + r*sin(t); 
    vertex(px,py); 
  }
  endShape(CLOSE); 
  
  beginShape();
  for (let i=0; i<27; i++){
    let t = map(i,0,24, 0,TWO_PI); 
    let r = (i%2 == 0) ? 45:35; 
    let px = 200 + r*cos(t); 
    let py = 660 + r*sin(t); 
    curveVertex(px,py); 
  }
  endShape(); 
  
  let cpts = [[340,500],[340,500],[380,520],[400,560],[360,580],[350,610],[350,610]];
  for (let j=0; j<7; j++){
    beginShape();
    for (let i=0; i<j; i++){
      curveVertex(cpts[i][0] + 15*j,cpts[i][1]);
    }
    endShape();
  }
  endSvgGroup();

  
  beginSvgGroup("multiPointShapeVariants"); 
  beginShape(TRIANGLE_STRIP);
  vertex(250+30, 600+75);
  vertex(250+40, 600+20);
  vertex(250+50, 600+75);
  vertex(250+60, 600+20);
  vertex(250+70, 600+75);
  vertex(250+80, 600+20);
  vertex(250+90, 600+75);
  endShape();
 
  beginShape(TRIANGLES);
  vertex(250+30, 660+75);
  vertex(250+40, 660+20);
  vertex(250+50, 660+75);
  vertex(250+60, 660+20);
  vertex(250+70, 660+75);
  vertex(250+80, 660+20);
  endShape();
  
  beginShape(QUAD_STRIP);
  vertex(330+30, 600+20);
  vertex(330+30, 600+75);
  vertex(330+50, 600+20);
  vertex(330+50, 600+75);
  vertex(330+65, 600+20);
  vertex(330+65, 600+75);
  vertex(330+85, 600+20);
  vertex(330+85, 600+75);
  endShape();

  beginShape(QUADS);
  vertex(330+30, 660+20);
  vertex(330+30, 660+75);
  vertex(330+50, 660+75);
  vertex(330+50, 660+20);
  vertex(330+65, 660+20);
  vertex(330+65, 660+75);
  vertex(330+85, 660+75);
  vertex(330+85, 660+20);
  endShape();
  
  beginShape(TRIANGLE_FAN);
  vertex(410+57, 600+50);
  vertex(410+57, 600+15);
  vertex(410+92, 600+50);
  vertex(410+57, 600+85);
  vertex(410+22, 600+50);
  vertex(410+57, 600+15);
  endShape();
  
  beginShape(POINTS);
  for (let i=0; i<60; i++){
    let t = map(i,0,60, 0,TWO_PI); 
    let px = 467 + 30*cos(t); 
    let py = 720 + 30*sin(t); 
    vertex(px,py); 
  }
  endShape(CLOSE); 
  
  beginShape(LINES);
  for (let i=0; i<40; i++){
    let t = map(i,0,40, 0,TWO_PI); 
    let px = 467 + 25*cos(t); 
    let py = 720 + 25*sin(t); 
    vertex(px,py); 
  }
  endShape(CLOSE); 
  endSvgGroup();
  
                    
  beginSvgGroup("someText");
  textSize(40); 
  textFont("Times"); 
  textStyle(NORMAL);
  textAlign(LEFT,BASELINE); 
  text("Press 's' to save an SVG.", 50, 770); 
  
  textSize(30); 
  textAlign(CENTER,BASELINE); 
  text("abc", 50, 475); 
  textAlign(RIGHT,BASELINE); 
  text("abc", 50, 500); 
  textAlign(LEFT,BASELINE); 
  text("abc", 50, 450); 
  // textAlign(LEFT,TOP);    // Not ready for prime time
  // text("top", 100, 450); 
  // textAlign(LEFT,CENTER); // Not ready for prime time
  // text("cen", 100, 450); 
  // textAlign(LEFT,BOTTOM); // Not ready for prime time
  // text("bot", 100, 450); 
  // line(0,450, 150,450); 
  endSvgGroup();
}