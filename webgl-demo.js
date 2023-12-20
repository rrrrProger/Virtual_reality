'use strict';

const settings = {
  cameraX: 2.0,
  cameraY: 6.27,
  cameraZ: 13.54,
  FOV: 60,
  znear: 1,
  zfar: 2000,
  aspect:1.0,
  eye_seperation: 1.0,
  convergence: 100,
};

let gl = canvas.getContext('webgl');  // The WebGL
let stereoCam // Object holding stereo camera calc params.
let spaceball // a simple rotator object
let surface
let shProgram

// Vertex shader
var vshader = `
attribuite vec3 vertex;
uniform mat4 ModelViewMatrix;
uniform mat4 ModelProjectonMatrix;

void main() {
    gl_Position = ModelViewMatrix * ModelProjectonMatrix * vec4(vertex, 1.0);
}`;

// Fragment shader
var fshader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH 
    precision highp float;
#else
    precision mediump float;
#endif

uniform vec4 color;
void main() {
    gl_FragColor = color;
}`;

// Compile program
//var program = compile(gl, vshader, fshader);
var vertexShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertexShader, vshader);
gl.compileShader(vertexShader);

var fragmentShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(fragmentShader, fshader);
gl.compileShader(fragmentShader);

/*
webglLessonsUI.setupUI(document.querySelector('#ui'), settings, [
  { type: 'slider',   key: 'cameraX',    min: -10, max: 10, change: render, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'cameraY',    min:   1, max: 20, change: render, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'cameraZ',    min:   1, max: 20, change: render, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'FOV',        min:   1, max: 180, change: render, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'aspect',     min:   0.1, max: 10.0, change: render, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'znear',      min:   1.0, max: 1000.0, change: render, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'zfar',       min:   1.0, max: 2000.0, change: render, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'eye_seperation',    min:   1.0, max: 200.0, change: render, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'convergence',       min:   0.0, max: 5000.0, change: render, precision: 2, step: 0.001, },
]);
*/
function degToRad(d) {
  return d * Math.PI / 180;
}

function Model(name) {
  this.name = name
  this.iVertexBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function(vertices) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    this.count = vertices.length / 3;
  }

  this.Draw = function() {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.drawArrays(gl.LINE_STRIP, 0, this.count);
  }
}

function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let modelView = spaceball.getViewMatrix();
  /*
  // Set the values of the projection transformation
  let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

  // Get the view from SimpleRotator
  let modelView = spaceball.getViewMatrix();

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

  let modelViewProjection = m4.multiply(projection, matAccum1);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewProjection);

  //Draw the six faces of a cube
  */
  gl.uniform4fv(shProgram.iColor, [1,1,0,1]);

  let matrleftfrust = stereoCam.applyLeftFrustum();
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrleftfrust);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

  let translateLeftEye = m4.translation(-stereoCam.eyeSeperation/2, 0, 0);
  let modelViewLeft = m4.multiply(translateLeftEye, matAccum1);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewLeft);

  gl.colorMask(true, false, false, false);
  surface.Draw();

  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.colorMask(false, true, true, false);

  let matrightfrustum = stereoCam.applyRightFrustum();
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrightfrustum);

  let translateRightEye = m4.translation(stereoCam.eyeSeperation / 2, 0, 0);
  let modelViewRight = m4.multiply(translateRightEye, matAccum1);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewRight);
}

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector('#canvas');
  if (!gl) {
    return;
  }
  initGL();
  draw();
}

function createSurfaceData()
{
  let vertexList = [];

  for (let i =0; i < 360; i++) {
    vertexList.push( Math.sin(degToRad(i), 1, Math.cos(degToRad(i))));
    vertexList.push( Math.sin(degToRad(i), 0, Math.cos(degToRad(i))))
  }
}
function StereoCamera(eyeSeperation, 
                      convergence, 
                      fov, 
                      aspect, 
                      znear, 
                      zfar) {
  this.eyeSeperation = eyeSeperation
  this.convergence = convergence
  this.znear = znear
  this.zfar = zfar
  this.fov = fov
  this.aspect = aspect
}

function applyLeftFrustum() {
  const top = Math.tan(degToRad(this.fov)* 0.5) * this.znear;
  const bottom = -top;

  var a = this.aspect * Math.tan(degToRad(this.fov)/2) * this.convergence;
  
  var b = a - this.eyeSeperation/2;
  var c = a + this.eyeSeperation/2;

  const left = -b * this.znear / this.convergence;
  const right = c * this.znear / this.convergence;

  return m4.frustum(left, right, bottom, top, this.znear, this.zfar);
}

function applyRightFrustum() {
  const top = Math.tan(degToRad(this.fov)* 0.5) * this.znear;
  const bottom = -top;

  var a = this.aspect * Math.tan(degToRad(this.fov)/2) * this.convergence;
  
  var b = a - this.eyeSeperation/2;
  var c = a + this.eyeSeperation/2;

  const left = -c * this.znear / this.convergence;
  const right = b * this.znear / this.convergence;

  return m4.frustum(left, right, bottom, top, this.znear, this.zfar);
}

function initGL() {
  
  let prog = createProgram(gl, vshader, fshader);
  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iModelProjectionMatrix = gl.getUniformLocation(prog, "ModelProjectonMatrix");
  shProgram.iColor = gl.getUniformLocation(prog, "color");

  surface = new Model("Surface");
  surface.BufferData(CreateSurfaceData());

  gl.enable(gl.DEPTH_TEST);

  stereoCam = new StereoCamera(
    70.0,
    5000.0,
    degToRad(60.0),
    1.5,
    10.0,
    20000.0
  );
}

function ShaderProgram(name, program) {
  
  this.name = name
  this.prog = program

  // Location of the attribute variable in the shader program
  this.iAttribVertex = -1;
  this.iColor = -1;
  this.iModelViewMatrix = -1;
  this.iProjectionMatrix = -1;

  this.Use = function() {
    gl.useProgram(this.prog);
  }
}

function createProgram(gl, vs, fs) {
  webglUtils.createProgramFromSources(gl, [vs, fs])
}

main();