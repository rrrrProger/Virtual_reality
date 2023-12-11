"use strict";

const canvas = document.querySelector("#glcanvas");
var gl = canvas.getContext("webgl");
var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-3d", "fragment-shader-3d"]);
var eyePosition;
var target;

// globals
var pixelRatio = window.devicePixelRatio || 1;
var scale = 1;
var projection = new Float32Array(16);
var exampleProjection = new Float32Array(16);
var exampleInverseProjection = new Float32Array(16);
var view = new Float32Array(16);
var world = new Float32Array(16);
var viewProjection = new Float32Array(16);
eyePosition = new Float32Array([31, 17, 15]);
var worldViewProjection = new Float32Array(16);
var exampleWorldViewProjection = new Float32Array(16);
target = new Float32Array([23, 16, 0]);
var up = new Float32Array([0, 1, 0]);
var v3t0 = new Float32Array(3);
var zeroMat = new Float32Array(16);
var targetToEye = new Float32Array(3);

const m4 = twgl.m4;
const v3 = twgl.v3;
// uniforms.
var sharedUniforms = {
};

// Create a buffer to put positions in
var positionBuffer = gl.createBuffer();
// Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
// Put geometry data into buffer
setGeometry(gl);

// Create a buffer to put colors in
var colorBuffer = gl.createBuffer();
// Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = colorBuffer)
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
// Put geometry data into buffer
setColors(gl);

function degToRad(d) {
  return d * Math.PI / 180;
}

function drawScene() {
  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Clear the canvas AND the depth buffer.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Turn on culling. By default backfacing triangles
  // will be culled.
  gl.enable(gl.CULL_FACE);

  // Enable the depth buffer
  gl.enable(gl.DEPTH_TEST);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(program);
}



function main() {
  // Initialize the GL context

  // Only continue if WebGL is available and working
  if (gl === null) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it.",
    );
    return;
  }
  twgl.addExtensionsToContext(gl);
  if (!gl.drawArraysInstanced || !gl.createVertexArray) {
    alert("need drawArraysInstanced and createVertexArray"); // eslint-disable-line
    return;
  }

  const cam = new StereoCamera(2000.0, 70.0, 1.33, 45.0, 10.0, 20000.0)
  cam.ApplyLeftFrustum()
  drawScene()
}

// Constructor function
class StereoCamera {
  constructor(
  Convergence,
  EyeSeparation,
  AspectRatio,
  FOV,
  NearClippingDistance,
  FarClippingDistance ) {

    this.mConvergence = Convergence
    this.mEyeSeparation = EyeSeparation
    this.mAspectRatio = AspectRatio
    this.mFOV = FOV
    this.mNearClippingDistance = NearClippingDistance
    this.mNearClippingDistance = FarClippingDistance


    this.ApplyLeftFrustum = function()
    {
        let top, bottom, left, right;
        top     = this.mNearClippingDistance * Math.tan(this.mFOV/2);
        bottom  = -top;
        let a = this.mAspectRatio * Math.tan(this.mFOV/2) * this.mConvergence;
        let b = a - this.mEyeSeparation / 2;
        let c = a + this.mEyeSeparation / 2;
        left    = -b * this.mNearClippingDistance/this.mConvergence;
        right   =  c * this.mNearClippingDistance/this.mConvergence;
        let dstopt
        m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mNearClippingDistance, dstopt)        
        console.log(`a : ${a} b : ${b} c : ${c}`)

    }

    this.ApplyRightFrustum = function()
    {
      let top, bottom, left, right;
      top     = mNearClippingDistance * tan(mFOV/2);
      bottom  = -top;
      let a = mAspectRatio * tan(mFOV/2) * mConvergence;
      let b = a - mEyeSeparation/2;
      let c = a + mEyeSeparation/2;
      left    =  -c * mNearClippingDistance/mConvergence;
      right   =   b * mNearClippingDistance/mConvergence;
    }
  }
}

// Fill the buffer with the values that define a letter 'F'.
function setGeometry(gl) {
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
          // left column front
          0,   0,  0,
          0, 150,  0,
          30,   0,  0,
          0, 150,  0,
          30, 150,  0,
          30,   0,  0,

          // top rung front
          30,   0,  0,
          30,  30,  0,
          100,   0,  0,
          30,  30,  0,
          100,  30,  0,
          100,   0,  0,

          // middle rung front
          30,  60,  0,
          30,  90,  0,
          67,  60,  0,
          30,  90,  0,
          67,  90,  0,
          67,  60,  0,

          // left column back
            0,   0,  30,
           30,   0,  30,
            0, 150,  30,
            0, 150,  30,
           30,   0,  30,
           30, 150,  30,

          // top rung back
           30,   0,  30,
          100,   0,  30,
           30,  30,  30,
           30,  30,  30,
          100,   0,  30,
          100,  30,  30,

          // middle rung back
           30,  60,  30,
           67,  60,  30,
           30,  90,  30,
           30,  90,  30,
           67,  60,  30,
           67,  90,  30,

          // top
            0,   0,   0,
          100,   0,   0,
          100,   0,  30,
            0,   0,   0,
          100,   0,  30,
            0,   0,  30,

          // top rung right
          100,   0,   0,
          100,  30,   0,
          100,  30,  30,
          100,   0,   0,
          100,  30,  30,
          100,   0,  30,

          // under top rung
          30,   30,   0,
          30,   30,  30,
          100,  30,  30,
          30,   30,   0,
          100,  30,  30,
          100,  30,   0,

          // between top rung and middle
          30,   30,   0,
          30,   60,  30,
          30,   30,  30,
          30,   30,   0,
          30,   60,   0,
          30,   60,  30,

          // top of middle rung
          30,   60,   0,
          67,   60,  30,
          30,   60,  30,
          30,   60,   0,
          67,   60,   0,
          67,   60,  30,

          // right of middle rung
          67,   60,   0,
          67,   90,  30,
          67,   60,  30,
          67,   60,   0,
          67,   90,   0,
          67,   90,  30,

          // bottom of middle rung.
          30,   90,   0,
          30,   90,  30,
          67,   90,  30,
          30,   90,   0,
          67,   90,  30,
          67,   90,   0,

          // right of bottom
          30,   90,   0,
          30,  150,  30,
          30,   90,  30,
          30,   90,   0,
          30,  150,   0,
          30,  150,  30,

          // bottom
          0,   150,   0,
          0,   150,  30,
          30,  150,  30,
          0,   150,   0,
          30,  150,  30,
          30,  150,   0,

          // left side
          0,   0,   0,
          0,   0,  30,
          0, 150,  30,
          0,   0,   0,
          0, 150,  30,
          0, 150,   0]),
      gl.STATIC_DRAW);
}

// Fill the buffer with colors for the 'F'.
function setColors(gl) {
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Uint8Array([
          // left column front
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,

          // top rung front
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,

          // middle rung front
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,
        200,  70, 120,

          // left column back
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,

          // top rung back
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,

          // middle rung back
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,
        80, 70, 200,

          // top
        70, 200, 210,
        70, 200, 210,
        70, 200, 210,
        70, 200, 210,
        70, 200, 210,
        70, 200, 210,

          // top rung right
        200, 200, 70,
        200, 200, 70,
        200, 200, 70,
        200, 200, 70,
        200, 200, 70,
        200, 200, 70,

          // under top rung
        210, 100, 70,
        210, 100, 70,
        210, 100, 70,
        210, 100, 70,
        210, 100, 70,
        210, 100, 70,

          // between top rung and middle
        210, 160, 70,
        210, 160, 70,
        210, 160, 70,
        210, 160, 70,
        210, 160, 70,
        210, 160, 70,

          // top of middle rung
        70, 180, 210,
        70, 180, 210,
        70, 180, 210,
        70, 180, 210,
        70, 180, 210,
        70, 180, 210,

          // right of middle rung
        100, 70, 210,
        100, 70, 210,
        100, 70, 210,
        100, 70, 210,
        100, 70, 210,
        100, 70, 210,

          // bottom of middle rung.
        76, 210, 100,
        76, 210, 100,
        76, 210, 100,
        76, 210, 100,
        76, 210, 100,
        76, 210, 100,

          // right of bottom
        140, 210, 80,
        140, 210, 80,
        140, 210, 80,
        140, 210, 80,
        140, 210, 80,
        140, 210, 80,

          // bottom
        90, 130, 110,
        90, 130, 110,
        90, 130, 110,
        90, 130, 110,
        90, 130, 110,
        90, 130, 110,

          // left side
        160, 160, 220,
        160, 160, 220,
        160, 160, 220,
        160, 160, 220,
        160, 160, 220,
        160, 160, 220]),
      gl.STATIC_DRAW);
}

function render() {
  gl.resizeCanvasToDisplaySize(canvas, pixelRatio);
  const halfHeight = gl.canvas.height / 2;
  const width = gl.canvas.width;

  // clear the screen.
  gl.disable(gl.SCISSOR_TEST);
  gl.colorMask(true, true, true, true);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.viewport(0, halfHeight, width, halfHeight);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  var aspect = gl.canvas.clientWidth / (gl.canvas.clientHeight / 2);

  m4.perspective(
      degToRad(60),
      aspect,
      1,
      5000,
      projection);

  var f = Math.max(30, fieldOfView) - 30;
  f = f / (179 - 30);
  f = f * f * f * f;
  f = lerp(1, 179 * 0.9, f);
  f = 1;
  v3.mulScalar(targetToEye, f, v3t0);
  v3.add(v3t0, target, v3t0);
  m4.lookAt(
      v3t0, //eyePosition,
      target,
      up,
      view);
  m4.inverse(view, view);
  m4.multiply(projection, view, viewProjection);
}

main();
