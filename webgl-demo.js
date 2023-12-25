'use strict';

const socket = new WebSocket('ws://Pixel-4.netis:8080/sensors/connect?types=["android.sensor.accelerometer", "android.sensor.magnetic_field", "android.sensor.gyroscope"]')

var last_timestamp = 0;
var MatrixRotationModelView = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]
var degtorad = Math.PI / 180; // Degree-to-Radian conversion
var accelerometerVector = new Float32Array(4);
var magnetometerVector = new Float32Array(4);
var matrixFromGyroscope = new Float32Array(16);
var rotationMatrixFromMagnetometerAndAccelerometer = new Float32Array(16);

socket.onmessage = function (e) {
  var data = JSON.parse(e.data);
  var type = data.type;
  var values = data.values;
  var timestamp = data.timestamp;

  switch (type) {
    case 'android.sensor.accelerometer':
      accelerometerVector = values
      break;
    case 'android.sensor.magnetic_field':
      magnetometerVector = values;
      break;
    case 'android.sensor.gyroscope':
      matrixFromGyroscope = getMatrixDataFromGyroscope(values, timestamp);
      break;
  }

  if (!accelerometerVector.every(item => item === 0) && !magnetometerVector.every(item => item === 0)) {
    console.log("go to getRotationMatrixFromMagnetometer");
    rotationMatrixFromMagnetometerAndAccelerometer = getRotationMatrixFromMagnetometerAndAccelerometer(accelerometerVector, magnetometerVector);
  }
};


function getMatrixDataFromGyroscope(values, timestamp) {
    var deltaRotationMatrix = new Float32Array(16);
    var deltaRotationVector = new Float32Array(4);
    var NS2S = 1.0 / 1000000000.0;
    var axisX = values[0];
    var axisY = values[1];
    var axisZ = values[2];
    var dT = (timestamp - last_timestamp) * NS2S;
    var omegaMagnitude = Math.sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ);
  
    axisX = axisX / omegaMagnitude;
    axisY = axisY / omegaMagnitude;
    axisZ = axisZ / omegaMagnitude;

    var thetaOverTwo = omegaMagnitude * dT / 2.0
    var sinThetaOverTwo = Math.sin(thetaOverTwo)
    var cosThetaOverTwo = Math.cos(thetaOverTwo)

    deltaRotationVector[0] = sinThetaOverTwo * axisX
    deltaRotationVector[1] = sinThetaOverTwo * axisY
    deltaRotationVector[2] = sinThetaOverTwo * axisZ
    deltaRotationVector[3] = cosThetaOverTwo
    last_timestamp = timestamp;

    function getRotationMatrixFromVector(deltaRotationMatrix, deltaRotationVector) {
      var q0;
      var q1 = deltaRotationVector[0];
      var q2 = deltaRotationVector[1];
      var q3 = deltaRotationVector[2];
      if (deltaRotationVector.length >= 4) {
          q0 = deltaRotationVector[3];
      } else {
          q0 = 1 - q1 * q1 - q2 * q2 - q3 * q3;
          if (q0 > 0) {
            q0 = Math.sqrt(q0);
          } else {
            q0 = 0;
          }
      }

      var sq_q1 = 2 * q1 * q1;
      var sq_q2 = 2 * q2 * q2;
      var sq_q3 = 2 * q3 * q3;
      var q1_q2 = 2 * q1 * q2;
      var q3_q0 = 2 * q3 * q0;
      var q1_q3 = 2 * q1 * q3;
      var q2_q0 = 2 * q2 * q0;
      var q2_q3 = 2 * q2 * q3;
      var q1_q0 = 2 * q1 * q0;
      if (deltaRotationMatrix.length == 9) {
          deltaRotationMatrix[0] = 1 - sq_q2 - sq_q3;
          deltaRotationMatrix[1] = q1_q2 - q3_q0;
          deltaRotationMatrix[2] = q1_q3 + q2_q0;
          deltaRotationMatrix[3] = q1_q2 + q3_q0;
          deltaRotationMatrix[4] = 1 - sq_q1 - sq_q3;
          deltaRotationMatrix[5] = q2_q3 - q1_q0;
          deltaRotationMatrix[6] = q1_q3 - q2_q0;
          deltaRotationMatrix[7] = q2_q3 + q1_q0;
          deltaRotationMatrix[8] = 1 - sq_q1 - sq_q2;
      } else if (deltaRotationMatrix.length == 16) {
          deltaRotationMatrix[0] = 1 - sq_q2 - sq_q3;
          deltaRotationMatrix[1] = q1_q2 - q3_q0;
          deltaRotationMatrix[2] = q1_q3 + q2_q0;
          deltaRotationMatrix[3] = 0.0;
          deltaRotationMatrix[4] = q1_q2 + q3_q0;
          deltaRotationMatrix[5] = 1 - sq_q1 - sq_q3;
          deltaRotationMatrix[6] = q2_q3 - q1_q0;
          deltaRotationMatrix[7] = 0.0;
          deltaRotationMatrix[8] = q1_q3 - q2_q0;
          deltaRotationMatrix[9] = q2_q3 + q1_q0;
          deltaRotationMatrix[10] = 1 - sq_q1 - sq_q2;
          deltaRotationMatrix[11] = 0.0;
          deltaRotationMatrix[12] = 0;
          deltaRotationMatrix[13] = 0.0;
          deltaRotationMatrix[14] = 0.0;
          deltaRotationMatrix[15] = 1.0;
      }
    }
    
    getRotationMatrixFromVector(deltaRotationMatrix, deltaRotationVector);
    
    return deltaRotationMatrix;
}

function getRotationMatrixFromMagnetometerAndAccelerometer(gravity, geomagnetic) {
// TODO: move this to native code for efficiency
  var Ax = gravity[0];
  var Ay = gravity[1];
  var Az = gravity[2];
  var normsqA = (Ax * Ax + Ay * Ay + Az * Az);
  var g = 9.81;
  var freeFallGravitySquared = 0.01 * g * g;
  var R = new Float32Array(16);
  if (normsqA < freeFallGravitySquared) {
    // gravity less than 10% of normal value
    return false;
  }
  var Ex = geomagnetic[0];
  var Ey = geomagnetic[1];
  var Ez = geomagnetic[2];
  var Hx = Ey * Az - Ez * Ay;
  var Hy = Ez * Ax - Ex * Az;
  var Hz = Ex * Ay - Ey * Ax;
  var normH = Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz);
  if (normH < 0.1) {
    // device is close to free fall (or in space?), or close to
    // magnetic north pole. Typical values are  > 100.
    return false;
  }
  var invH = 1.0 / normH;
  Hx *= invH;
  Hy *= invH;
  Hz *= invH;
  var invA = 1.0/ Math.sqrt(Ax * Ax + Ay * Ay + Az * Az);
  Ax *= invA;
  Ay *= invA;
  Az *= invA;
  var Mx = Ay * Hz - Az * Hy;
  var My = Az * Hx - Ax * Hz;
  var Mz = Ax * Hy - Ay * Hx;

  R[0]  = Hx;    R[1]  = Hy;    R[2]  = Hz;   R[3]  = 0;
  R[4]  = Mx;    R[5]  = My;    R[6]  = Mz;   R[7]  = 0;
  R[8]  = Ax;    R[9]  = Ay;    R[10] = Az;   R[11] = 0;
  R[12] = 0;     R[13] = 0;     R[14] = 0;    R[15] = 1;

  gravity.fill(0);
  geomagnetic.fill(0);

  return R;
}

function degToRad(d) {
  return d * Math.PI / 180;
}

const settings = {
  fov: 10,
  znear: 1,
  zfar: 2000,
  aspect:1.0,
  eyeSeperation: 0.06,
  convergence: 5000,
};

let canvas = document.querySelector("#webglcanvas");
let gl = canvas.getContext("webgl2");
let stereoCam
let spaceball
let surface
let shProgram
var video
let tex

// Vertex shader
var vshader = `
attribute vec4 a_position;
attribute vec2 a_texcoord;

uniform mat4 ModelViewMatrix;
uniform mat4 ModelProjectionMatrix;

varying vec2 v_texcoord;

void main() {
   gl_Position = ModelProjectionMatrix * ModelViewMatrix * a_position;
}`;

// Fragment shader
var fshader = `
precision mediump float;

varying vec2 v_texcoord;

uniform sampler2D u_texture;
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
// look up where the vertex data needs to go.
var positionLocation = gl.getAttribLocation(program, "a_position");

// lookup uniforms

var matrixLocationView = gl.getUniformLocation(program, "ModelViewMatrix");
var matrixLocationProjection = gl.getUniformLocation(program, "ModelProjectionMatrix");
var textureLocation = gl.getUniformLocation(program, "u_texture");
var translatetozero = m4.translation(0.0, 0.0, -1.0);
var modelview = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]

webglLessonsUI.setupUI(document.querySelector('#ui'), settings, [
  { type: 'slider',   key: 'fov',        min:   0, max: 360, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'aspect',     min:   0.1, max: 10.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'znear',      min:   1.0, max: 1000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'zfar',       min:   1.0, max: 2000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'eyeSeperation',    min:   0.01, max: 100.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'convergence',       min:   0.0, max: 10000.0, change: draw, precision: 2, step: 0.001, },
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

    return m4.frustum(left, right, bottom, top, this.znear, this.zfar);
  }

  this.applyRightFrustum = function()
  {
    const top = Math.tan(degToRad(this.fov)* 0.5) * this.znear;
    const bottom = -top;

    var a = this.aspect * Math.tan(degToRad(this.fov)/2) * this.convergence;

    var b = a - this.eyeSeperation/2;
    var c = a + this.eyeSeperation/2;

    const left = -c * this.znear / this.convergence;
    const right = b * this.znear / this.convergence;

    return m4.frustum(left, right, bottom, top, this.znear, this.zfar);
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

//    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.drawArrays(gl.LINE_STRIP, 0, this.count);
  }
}

function draw() {
  gl.enable(gl.DEPTH_TEST);
  gl.colorMask(true, true, true, true);
  gl.clear(gl.COLOR_BUFFER_BIT);
 

  stereoCam = new StereoCamera(
    settings.eyeSeperation, //70
    settings.convergence, //5000
    settings.fov, //60
    settings.aspect, //1.5
    settings.znear, //1
    settings.zfar // 20000
  );
  let matrleftfrust = stereoCam.applyLeftFrustum();
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrleftfrust);

  let matAccum1 = m4.multiply(MatrixRotationModelView, translatetozero);

  let translateLeftEye = m4.translation(-stereoCam.eyeSeperation/2, 0, 0);
  let modelViewLeft = m4.multiply(matAccum1, translateLeftEye);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewLeft);
  gl.colorMask(true, false, false, true);
  gl.uniform1i(textureLocation, 0);
  gl.uniform4fv(shProgram.iColor, [1,1,0,1]);
  surface.Draw();

  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.clearDepth(1);
  gl.colorMask(false, true, true, true);

  let matrightfrustum = stereoCam.applyRightFrustum();

  let translateRightEye = m4.translation(stereoCam.eyeSeperation / 2, 0, 0);
  let modelViewRight = m4.multiply(matAccum1, translateRightEye);

  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrightfrustum);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewRight);
  surface.Draw();

  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.clearDepth(1);
  gl.colorMask(true, true, true, true);
  gl.uniform4fv(shProgram.iColor, [1,1,1,1]);
}

function main() {
  // Get A WebGL context
  if (!gl) {
    return;
  }
//  spaceball = new SimpleRotator(canvas, draw, 10);
  initGL();
  draw();
}

function createSurfaceData()
{  
  let vertexList = [];

  for (let i = 0; i < 360; i++) {
    vertexList.push( Math.sin(degToRad(i), 1, Math.cos(degToRad(i))));
    vertexList.push( Math.sin(degToRad(i), 0, Math.cos(degToRad(i))))
  }
  
  return vertexList;
}

function initGL() {
  
//  let prog = createProgram(gl, vshader, fshader);
  shProgram = new ShaderProgram('Basic', program);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(program, "a_position");
  shProgram.iModelViewMatrix = gl.getUniformLocation(program, "ModelViewMatrix");
  shProgram.iModelProjectionMatrix = gl.getUniformLocation(program, "ModelProjectionMatrix");
  shProgram.iColor = gl.getUniformLocation(program, "color");

  surface = new Model("Surface");
  surface.BufferData(createSurfaceData());

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