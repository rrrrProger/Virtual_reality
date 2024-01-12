'use strict';

//x(t)=Rcost,y(t)=Rsin(t),z(t)=at

let gl;
let surface;
let shProgram;
let spaceball;
let texture;
let cameraText;
let video;
let BG;

let sphere = null;
let angularSphereVelocity = 0;
let spherePosition = [0, 0, 0];
let startSphereX = 0.7;
let startSphereY = 1;
let startSphereZ = 0.7;

let audioContext = null;
let audioPanner = null;
let audioFilter = null;
let audioSource = null;
let stereoCam = null;
let rSurface = 1;
let aSurface = 1;

const settings = {
  fov: 110,
  znear: 1,
  zfar: 2000,
  aspect: 1.0,
  eyeSeperation: 94.0,
  convergence: 200.0,
  speedRotation: 0.01,
};

webglLessonsUI.setupUI(document.querySelector('#ui'), settings, [
  { type: 'slider',   key: 'fov',              min:   0, max: 360, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'aspect',           min:   0.1, max: 10.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'znear',            min:   1.0, max: 1000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'zfar',             min:   1.0, max: 2000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'eyeSeperation',    min:   0.01, max: 499.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'convergence',      min:   0.0, max: 10000.0, change: draw, precision: 2, step: 0.001, },
  { type: 'slider',   key: 'speedRotation',    min:   0.0, max: 1.0, change: draw, precision: 2, step: 0.001, },
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
    let leftTrans    =   m4.translation(-0.01, 0.2, -20);
    let rightTrans   =   m4.translation( 0.01, 0.2, -20);
  
    /* Set up identity modelView matrix */
    const modelViewStart = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  
    /* Set starting projection Matrix */
    const projectionStart = m4.perspective(degToRad(90), 1, 0.99, 1);

    angularSphereVelocity += settings.speedRotation;
    rotateSpere(angularSphereVelocity);
    const audioPos = [spherePosition[0], spherePosition[1], spherePosition[2]];
  
    /* If audioPanner not null set position */
    audioPanner?.setPosition(...audioPos);
  
    gl.bindTexture(gl.TEXTURE_2D, null);

    const translationSphere = m4.translation(...spherePosition);
    const modelViewMatrix = m4.multiply(translationSphere, modelViewStart);

    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, projectionStart);
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, modelViewMatrix);
    
    sphere.DrawSphere();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, m4.multiply(leftTrans, modelViewStart));
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, leftFrustum);
    
    gl.colorMask(true, false, false, false);

    surface.Draw();
  
    gl.clear(gl.DEPTH_BUFFER_BIT);
  
    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, m4.multiply(rightTrans, modelViewStart));
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

/*
 * Create spere data for audio 
*/
const CreateSphereData = (I, J) => {
  let vertexList = [];
  let textureList = [];

  for (let i = 0; i <= I; i++) {
    const theta = i * Math.PI / I;

    for (let j = 0; j <= J; j++) {
      const phi = j * 2 * Math.PI / J;

      vertexList.push(
        Math.cos(phi) * Math.sin(theta),
        Math.cos(theta),
        Math.sin(phi) * Math.sin(theta)
      );

      textureList.push(1 - (j / J), 1 - (i / I));
    }
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
  
    shProgram.iTextCoords = gl.getAttribLocation(prog, 'textCoords');
    shProgram.iTextUnit = gl.getUniformLocation(prog, 'uTexture');

    surface = new Model('Surface');
    BG = new Model('Background');
    sphere = new Model('Sphere');

    let surfaceData = CreateSurfaceData();
    surface.BufferData(surfaceData.vertexList, surfaceData.textureList);

    BG.BufferData(
      [ 0.0, 0.0, 0.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 1.0, 1.0, 0.0,  0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
      [ 1, 1, 0, 1,  0, 0, 0, 0,  1, 0, 1, 1],
    );

    let sphereData = CreateSphereData(500, 500);
    sphere.BufferData(sphereData.vertexList, sphereData.textureList);

    LoadTexture();
    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
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
    }
    catch (e) {
        console.log('Error initGL()');
    }

  document.getElementById('filter').addEventListener('change', async (e) => {
    const isChecked = e.target.checked
    if (isChecked) {
      audioPanner?.disconnect();
      audioPanner?.connect?.(audioFilter);
      audioFilter?.connect?.(audioContext.destination);
    } else {
      audioPanner?.disconnect();
      audioPanner?.connect?.(audioContext.destination);
    }
  })

  document.getElementById('audio').addEventListener('play', (e) => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
      audioSource = audioContext.createMediaElementSource(audio);
      audioPanner = audioContext.createPanner();
      audioFilter = audioContext.createBiquadFilter();

      audioSource.connect(audioPanner);
      audioPanner.connect(audioFilter);
      audioFilter.connect(audioContext.destination);

      audioFilter.type = "highpass";
      audioFilter.frequency.value = 1400;
      audioContext.resume();
    } else {
      console.log("Audio error");
    }
  });

  setInterval(draw, 1/20);
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

function rotateSpere(angularSphereVelocity) {
  /* Rotate sphere around y (change x and z) */
  spherePosition[0] = Math.cos(angularSphereVelocity) * startSphereX;
  spherePosition[1] = spherePosition[1]
  spherePosition[2] = -1 + Math.sin(angularSphereVelocity) * startSphereZ;
}

init()