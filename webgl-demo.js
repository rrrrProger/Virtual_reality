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

function createTriangle() {
    let modelProjection = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]
    let modelView = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, -0.12000000476837158, 1, 
  0, 1, -0.12000000476837158, 1, 
  1, -1, -0.12000000476837158, 1]),
    gl.STATIC_DRAW);

    var vert_shader = gl.createShader(gl.VERTEX_SHADER);

    gl.shaderSource(vert_shader,"attribute vec4 vertex;  uniform mat4 ModelViewMatrix; uniform mat4 ModelProjectionMatrix; void main(void) {gl_Position = ModelViewMatrix * ModelProjectionMatrix * vertex;}");


    gl.compileShader(vert_shader);
    if( !gl.getShaderParameter(vert_shader,gl.COMPILE_STATUS ) ) {
        throw 0;
    }

    var frag_shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag_shader,"void main(void) { gl_FragColor = vec4(1.0,1.0,1.0,1.0); } \n");

    gl.compileShader(frag_shader);
    if( !gl.getShaderParameter(frag_shader,gl.COMPILE_STATUS) ) {
        throw 1;
    }

    var program = gl.createProgram();
    gl.attachShader(program,vert_shader);
    gl.attachShader(program,frag_shader);
    gl.linkProgram(program);
    if( !gl.getProgramParameter(program,gl.LINK_STATUS) ) {
        throw 2;
    }
    gl.useProgram(program);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "ModelProjectionMatrix"), false, modelProjection);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "ModelViewMatrix"), false, modelView);
    var vertexLocation = gl.getAttribLocation(program,"vertex");

    gl.deleteShader(frag_shader);
    gl.deleteShader(vert_shader);
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(vertexLocation);
    gl.vertexAttribPointer(vertexLocation,4, gl.FLOAT,false,0,0);

    gl.drawArrays(gl.TRIANGLES,0 ,3);
}
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

function drawPrimitive( primitiveType, color, vertices ) {
  gl.enableVertexAttribArray(ver);
  gl.bindBuffer(gl.ARRAY_BUFFER,a_coords_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
  gl.uniform4fv(u_color, color);
  gl.vertexAttribPointer(a_coords_loc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(primitiveType, 0, vertices.length/3);
}

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
}

function applyLeftFrustum(cam) 
{
  let top, bottom, left, right;
  top = cam.znear * Math.tan(degToRad(cam.fov/2));
  bottom = -top;

  let a = cam.aspect * Math.tan(cam.fov / 2) * cam.convergence;
  let b = a - cam.eyeSeperation / 2;
  let c = a + cam.eyeSeperation / 2;

  left = -b * cam.znear / cam.convergence;
  right = c * cam.znear / cam.convergence;

  return m4.frustum(left, right, bottom, top, cam.znear, cam.zfar);
}

function applyRightFrustum(cam)
{
  const top = Math.tan(degToRad(cam.fov)* 0.5) * cam.znear;
  const bottom = -top;

  var a = cam.aspect * Math.tan(degToRad(cam.fov)/2) * cam.convergence;

  var b = a - cam.eyeSeperation/2;
  var c = a + cam.eyeSeperation/2;

  const left = -c * cam.znear / cam.convergence;
  const right = b * cam.znear / cam.convergence;

  return m4.frustum(left, right, bottom, top, cam.znear, cam.zfar);
}

function degToRad(d) {
  return d * Math.PI / 180;
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
  let modelProjection = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]
  let modelView = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, modelProjection);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelView);
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
  
  /*
  let matrleftfrust = applyLeftFrustum(stereoCam);
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrleftfrust);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

  let translateLeftEye = m4.translation(-stereoCam.eyeSeperation/2, 0, 0);
  let modelViewLeft = m4.multiply(translateLeftEye, matAccum1);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewLeft);

  gl.colorMask(true, false, false, false);
  */

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
  spaceball = new SimpleRotator(canvas, 0, 10);
  initGL();
  draw();
}

function createSurfaceData()
{
  let vertexList = [-1, -1, -0.12000000476837158, 1, 
    0, 1, -0.12000000476837158, 1, 
    1, -1, -0.12000000476837158, 1];

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
    70.0,
    5000.0,
    degToRad(60.0),
    1.5,
    10.0,
    20000.0
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