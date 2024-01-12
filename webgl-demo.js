'use strict';

//x(t)=Rcost,y(t)=Rsin(t),z(t)=at

let gl;
let surface;
let shProgram;
let texture;

let stereoCam = null;
let rSurface = 1;
let aSurface = 1;

let video = null;
let cameraText = null;

let backGround = null;

const settings = {
  fov: 110,
  znear: 1,
  zfar: 2000,
  aspect: 1.0,
  eyeSeperation: 77.0,
  convergence: 1517.0,
};

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

function draw() { 
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
    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0);
  
    /* Set up identity modelView matrix */
    const modelViewStart = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  
    /* Set starting projection Matrix */
    const projectionStart = m4.perspective(degToRad(90), 1, 0.99, 1);
  
    gl.bindTexture(gl.TEXTURE_2D, null);

    const modelViewMatrix = modelViewStart;

    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, modelViewMatrix);
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, projectionStart);
    
    if (document.getElementById('camera').checked) {
      const projection = m4.orthographic(0, 1, 0, 1, -1, 1);
      const noRot = m4.multiply(rotateToPointZero, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

      gl.uniformMatrix4fv(shProgram.iModelViewMat, false, noRot);
      gl.uniformMatrix4fv(shProgram.iProjectionMat, false, projection);

      gl.bindTexture(gl.TEXTURE_2D, cameraText);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      backGround?.Draw();
    }

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

    backGround = new Model('BackGround');
    backGround.BufferData(
      [ 0.0, 0.0, 0.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 1.0, 1.0, 0.0,  0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
      [ 1, 1, 0, 1,  0, 0, 0, 0,  1, 0, 1, 1],
    );
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

const getCamera = () => new Promise(
  (resolve) => navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then((s) => resolve(s))
  );

function init() {
    let canvas;

    try {
        canvas = document.querySelector("#webglcanvas");
        gl = canvas.getContext("webgl");

        video = document.createElement('video');
        video.setAttribute('autoplay', true);

        cameraText = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, cameraText);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }

        document.getElementById('camera').addEventListener('change', async (e) => {
          if (document.getElementById('camera').checked) {
            getCamera().then((stream)=> video.srcObject = stream)
          } else {
            video.srcObject = null;
          }
        });
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

init();