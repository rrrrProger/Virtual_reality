'use strict';

function degToRad(d) {
  return d * Math.PI / 180;
}

const settings = {
  fov: 10,
  znear: 1,
  zfar: 2000,
  aspect:1.0,
  eyeSeperation: 0.1,
  convergence: 5000,
};

let canvas = document.querySelector("#webglcanvas");
let gl = canvas.getContext("webgl");
let stereoCam // Object holding stereo camera calc params.
let spaceball // a simple rotator object
let surface
let shProgram
let a_coords_loc;          // Location of the a_coords attribute variable in the shader program.
let a_coords_buffer;       // Buffer to hold the values for a_coords.
// Vertex shader
var vshader = `
attribute vec3 vertex;
uniform mat4 ModelViewMatrix;
uniform mat4 ModelProjectonMatrix;

void main() {
    gl_Position = ModelProjectonMatrix * ModelViewMatrix * vec4(vertex, 1.0);
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
let vertexShaderCompiled = gl.compileShader(vertexShader);

var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragmentShader, fshader);
let fragmentShaderCompiled = gl.compileShader(fragmentShader);

var program = gl.createProgram();

// Attach pre-existing shaders
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  const info = gl.getProgramInfoLog(program);
  throw `Could not compile WebGL program. \n\n${info}`;
}


webglLessonsUI.setupUI(document.querySelector('#ui'), settings, [
  { type: 'slider',   key: 'fov',        min:   0, max: 360, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'aspect',     min:   0.1, max: 10.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'znear',      min:   1.0, max: 1000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'zfar',       min:   1.0, max: 2000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'eyeSeperation',    min:   1.0, max: 100.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'convergence',       min:   0.0, max: 5000.0, change: draw, precision: 2, step: 0.001, },
]);

function StereoCamera(eyeSeperation, 
    convergence, 
    fov, 
    aspect, 
    znear, 
    zfar) 
{
  this.eyeSeperation = eyeSeperation;
  this.convergence = convergence;
  this.znear = znear;
  this.zfar = zfar;
  this.fov = fov;
  this.aspect = aspect;

  this.applyLeftFrustum = function()
  {
    let top, bottom, left, right;
    top = this.znear * Math.tan(degToRad(this.fov/2));
    bottom = -top;

    let a = this.aspect * Math.tan(degToRad(this.fov / 2)) * this.convergence;
    let b = a - this.eyeSeperation / 2;
    let c = a + this.eyeSeperation / 2;

    left = -b * this.znear / this.convergence;
    right = c * this.znear / this.convergence;
    console.log('left : ', left);
    console.log('right : ', right);
    console.log('bottom :', bottom);
    console.log('top: ', top);
    return m4.frustum(left, right, bottom, top, this.znear, this.zfar);
  }

  this.applyRightFrustum = function()
  {
    const top = Math.tan(degToRad(this.fov)* 0.5) * this.znear;
    const bottom = -top;

    var a = cam.aspect * Math.tan(degToRad(this.fov)/2) * this.convergence;

    var b = a - this.eyeSeperation/2;
    var c = a + this.eyeSeperation/2;

    const left = -c * this.znear / this.convergence;
    const right = b * this.znear / this.convergence;

    return m4.frustum(left, right, bottom, top, cam.znear, cam.zfar);
  }
}

function Model(name) {
  this.name = name
  this.iVertexBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function(vertices) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    this.count = vertices.length / 3;
  }

  this.Draw = function() {
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function draw() {
  gl.clearColor(1,0,0,1);
  gl.enable(gl.DEPTH_TEST);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearDepth(1);

  var modelview = spaceball.getViewMatrix();
  var translatetozero = m4.translation(0.0, 0.0, -1.0);
  var projection = m4.perspective(Math.PI / 8, 1, 8, 12);

  
  /*
  var projection = m4.perspective(Math.PI / 8, 1, 8, 12);
  var modelview = spaceball.getViewMatrix();
  var rotatetozero = m4.axisRotation([0.707, 0.707, 0], 0.7)
  var translatetozero = m4.translation(0.0, 0.0, -1.0);

  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, projection);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
  */
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
  console.log(matrleftfrust)
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrleftfrust);

  let matAccum1 = m4.multiply(modelview, translatetozero);

  let translateLeftEye = m4.translation(-stereoCam.eyeSeperation/2, 0, 0);
  let modelViewLeft = m4.multiply(matAccum1, translateLeftEye);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewLeft);

//  gl.colorMask(true, false, false, false);
  

  surface.Draw();

//  gl.clear(gl.DEPTH_BUFFER_BIT);
//  gl.colorMask(false, true, true, false);

  /*
  let matrightfrustum = applyRightFrustum(stereoCam);
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrightfrustum);

  let translateRightEye = m4.translation(stereoCam.eyeSeperation / 2, 0, 0);
  let modelViewRight = m4.multiply(translateRightEye, matAccum1);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewRight);
  */
//  surface.Draw();

}

function main() {
  // Get A WebGL context
  if (!gl) {
    return;
  }
  spaceball = new SimpleRotator(canvas, draw, 10);
  initGL();
  draw();
}

function createSurfaceData()
{
  let vertexList = [ -1,-1,1, 1,-1,1, 1,1,1, -1,1,1 ];

  return vertexList;
}

function initGL() {
  
//  let prog = createProgram(gl, vshader, fshader);
  shProgram = new ShaderProgram('Basic', program);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(program, "vertex");
  shProgram.iModelViewMatrix = gl.getUniformLocation(program, "ModelViewMatrix");
  shProgram.iModelProjectionMatrix = gl.getUniformLocation(program, "ModelProjectonMatrix");
  shProgram.iColor = gl.getUniformLocation(program, "color");

  surface = new Model("Surface");
  surface.BufferData(createSurfaceData());

  stereoCam = new StereoCamera(
    settings.eyeSeperation, //70
    settings.convergence, //5000
    settings.fov, //60
    settings.aspect, //1.5
    settings.znear, //1
    settings.zfar // 20000
  );
  gl.enable(gl.DEPTH_TEST);
}

function ShaderProgram(name, program) {
  
  this.name = name
  this.prog = program

  // Location of the attribute variable in the shader program
  this.iAttribVertex = -1;
  this.iColor = -1;
  this.iModelViewMatrix = -1;
  this.iModelProjectionMatrix = -1;

  this.Use = function() {
    gl.useProgram(this.prog);
  }
}

main();