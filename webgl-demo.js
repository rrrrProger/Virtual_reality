'use strict';

//x(t)=Rcost,y(t)=Rsin(t),z(t)=at
const socket = new WebSocket('ws://Pixel-4.netis:8080/sensors/connect?types=["android.sensor.accelerometer", "android.sensor.magnetic_field", "android.sensor.gyroscope"]')

let gl;
let surface;
let shProgram;
let texture;

let stereoCam = null;
let rSurface = 1;
let aSurface = 1;

var accelerometerVector = new Float32Array(4);
var magnetometerVector = new Float32Array(4);
var matrixFromGyroscope = new Float32Array(16);
var rotationMatrixFromMagnetometerAndAccelerometer = new Float32Array(16);

socket.onmessage = function (e) {
  var data = JSON.parse(e.data);
  var type = data.type;
  var values = data.values;
  var timestamp = data.timestamp;
  var matrixRotationModelView = null;

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
    rotationMatrixFromMagnetometerAndAccelerometer = getRotationMatrixFromMagnetometerAndAccelerometer(accelerometerVector, magnetometerVector);
  }
  if (!matrixFromGyroscope.every(item => item === 0)) {
    matrixRotationModelView = constructModelViewMatrix(rotationMatrixFromMagnetometerAndAccelerometer, matrixFromGyroscope);
  }

  draw(matrixRotationModelView);
};

function constructModelViewMatrix(rotationMatrixFromMagnetometerAndAccelerometer, matrixFromGyroscope) {
  var weightGyroscope = 0.9;
  var weightMagnetometerAndAccelerometer = 0.1;
  var resultModelView = new Float32Array(16);

  resultModelView.forEach((element, index) => resultModelView[index] = weightGyroscope * matrixFromGyroscope[index] + weightMagnetometerAndAccelerometer * rotationMatrixFromMagnetometerAndAccelerometer[index]);

  return resultModelView;
}

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

const settings = {
  fov: 110,
  znear: 1,
  zfar: 2000,
  aspect: 1.0,
  eyeSeperation: 77.0,
  convergence: 1517.0,
};

var last_timestamp = 0;

socket.addEventListener("message", event => {
  var data = JSON.parse(event.data);
  var deltaRotationMatrix = new Float32Array(16);
  var deltaRotationVector = new Float32Array(4);
  var NS2S = 1.0 / 1000000000.0;
  var values = data.values;
  var axisX = values[0];
  var axisY = values[1];
  var axisZ = values[2];
  var dT = (data.timestamp - last_timestamp) * NS2S;
  var matrixRotationModelView = null;

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
  last_timestamp = data.timestamp;
  getRotationMatrixFromVector(deltaRotationMatrix, deltaRotationVector);
  matrixRotationModelView = deltaRotationMatrix;
  draw(matrixRotationModelView);
});

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

webglLessonsUI.setupUI(document.querySelector('#ui'), settings, [
  { type: 'slider',   key: 'fov',              min:   0, max: 360, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'aspect',           min:   0.1, max: 10.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'znear',            min:   1.0, max: 1000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'zfar',             min:   1.0, max: 2000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'eyeSeperation',    min:   0.01, max: 499.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'convergence',      min:   0.0, max: 10000.0, change: draw, precision: 2, step: 0.001, },
]);

function degToRad(d) {
  return d * Math.PI / 180;
}

function StereoCamera(eyeSeperation, convergence, 
                      fov, aspect, znear, zfar) 
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
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTextureBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, textureList) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
  
      gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureList), gl.STREAM_DRAW);
  
      gl.enableVertexAttribArray(shProgram.iTextCoords);
      gl.vertexAttribPointer(shProgram.iTextCoords, 2, gl.FLOAT, false, 0, 0);
  
      this.count = vertices.length / 3;
    }

    this.Draw = function() {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
      gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(shProgram.iAttribVertex);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
      gl.vertexAttribPointer(shProgram.iTextCoords, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(shProgram.iTextCoords);
    
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }

    this.DrawSphere = function () {
      this.Draw();
      gl.drawArrays(gl.LINE_STRIP, 0, this.count);
    }
}

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iTextCoords = -1;
    this.iTextUnit = -1;

    this.Use = function() {
      gl.useProgram(this.prog);
    }
}

function draw(resultModelView) { 
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    stereoCam = new StereoCamera(
      settings.eyeSeperation,
      settings.convergence,
      settings.fov,
      settings.aspect,
      settings.znear,
      settings.zfar
    );

    var leftFrustum  =   stereoCam.applyLeftFrustum();
    var rightFrustum =   stereoCam.applyRightFrustum();
    let leftTranslate =   m4.translation(-0.01, 0.2, -20);
    let rightTranslate   =   m4.translation( 0.01, 0.2, -20);
  
    /* Set up identity modelView matrix */
    const modelViewStart = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  
    /* Set starting projection Matrix */
    const projectionStart = m4.perspective(degToRad(90), 1, 0.99, 1);
  
    gl.bindTexture(gl.TEXTURE_2D, null);

    var modelViewMatrix = null;

    resultModelView ? modelViewMatrix = resultModelView : modelViewStart;

    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, modelViewMatrix);
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, projectionStart);
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, m4.multiply(leftTranslate, modelViewMatrix));
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, leftFrustum);
    
    gl.colorMask(true, false, false, false);

    surface.Draw();
  
    gl.clear(gl.DEPTH_BUFFER_BIT);
  
    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, m4.multiply(rightTranslate, modelViewMatrix));
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, rightFrustum);

    gl.colorMask(false, true, true, false);

    surface.Draw();

    gl.colorMask(true, true, true, true);
}

const CreateSurfaceData = () => {
  let textureList = [];
  let vertexList = [];

  for (let i = 0; i < 90; i++) {
    vertexList.push( rSurface * Math.cos(i) * settings.aspect, rSurface * Math.sin(i) * settings.aspect, aSurface * i * settings.aspect);
    textureList.push( rSurface * Math.cos(i) * settings.aspect, rSurface * Math.sin(i) * settings.aspect, aSurface * i * settings.aspect);
  }
  
  return { vertexList, textureList };
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, 'vertex');
    shProgram.iModelViewMat = gl.getUniformLocation(prog, 'ModelViewMatrix');
    shProgram.iProjectionMat = gl.getUniformLocation(prog, 'ProjectionMatrix');
  
    shProgram.iTextCoords = gl.getAttribLocation(prog, 'textureCoordinates');
    shProgram.iTextUnit = gl.getUniformLocation(prog, 'uTexture');

    surface = new Model('Surface');
    let surfaceData = CreateSurfaceData();
    surface.BufferData(surfaceData.vertexList, surfaceData.textureList);
    
    LoadTexture();
    gl.enable(gl.DEPTH_TEST);
}

/*
* Create program to compile vertex shader and fragment shader
*/
function createProgram(gl, vShader, fShader) {
    let vertexShader = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vertexShader, vShader);
    gl.compileShader(vertexShader);
    if ( ! gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vertexShader));
     }
    let fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fragmentShader, fShader);
    gl.compileShader(fragmentShader);
    if ( ! gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fragmentShader));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

const LoadTexture = () => {
  const image = new Image();
  image.src =
    'https://www.the3rdsequence.com/texturedb/download/116/texture/jpg/1024/irregular+wood+planks-1024x1024.jpg';
  image.crossOrigin = 'anonymous';

  image.addEventListener('load', () => {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  });
}

function init() {
    let canvas;
    try {
        canvas = document.querySelector("#webglcanvas");
        gl = canvas.getContext("webgl");

        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        console.log('Error webglcanvas');
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
        draw();
    }
    catch (e) {
        console.log('Error initGL()');
    }
}

init()