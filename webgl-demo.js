'use strict';

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
let stereoCam // Object holding stereo camera calc params.
let spaceball // a simple rotator object
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
   v_texcoord = a_texcoord;
}`;

// Fragment shader
var fshader = `
precision mediump float;

varying vec2 v_texcoord;

uniform sampler2D u_texture;
uniform vec4 color;

void main() {
  gl_FragColor = texture2D(u_texture, v_texcoord) * color;
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
var texcoordLocation = gl.getAttribLocation(program, "a_texcoord");

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

var copyVideo = false;

function setupVideo(url) {
  video = document.createElement("video");

  let playing = false;
  let timeupdate = false;

  video.playsInline = true;
  video.muted = true;
  video.loop = true;
  video.width = 200;
  video.height = 200;

  // Waiting for these 2 events ensures
  // there is data in the video
  video.addEventListener('playing', function() {
      playing = true;
      checkReady();
  }, true);
  video.addEventListener('timeupdate', function() {
      timeupdate = true;
      checkReady();
  }, true);
  function checkReady() {
      if (playing && timeupdate) {
          copyVideo = true;
      }
  }

  video.src = url;
  video.play();

  return video;
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
    console.log("Drawing surface");
  }
}

function loadWebCamTexture() {
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Put a 2 unit quad in the buffer
  var positions = [
    -0.5, -0.5,
    -0.5,  0.5,
    0.5, -0.5,
    -0.5, -0.5,
    -0.5,  0.5,
    0.5,  0.5,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Create a buffer for texture coords
  var texcoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

  // Put texcoords in the buffer
  var texcoords = [
    0, 0,
    0, 1,
    1, 0,
    1, 0,
    0, 1,
    1, 1,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

  // creates a texture info { width: w, height: h, texture: tex }
  // The texture will start with 1x1 pixels and be updated
  // when the image has loaded
  function loadImageAndCreateTextureInfo() {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Fill the texture with a 1x1 blue pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 255, 255]));

    // let's assume all images are not a power of 2
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    var textureInfo = {
      width: 1,   // we don't know the size until it loads
      height: 1,
      texture: tex,
    };

    textureInfo.width = video.width;
    textureInfo.height = video.height;

    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    return textureInfo;
  }

  var texInfo = loadImageAndCreateTextureInfo();

  function render(time) {

    time *= 0.001
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindTexture(gl.TEXTURE_2D, texInfo.texture);

    // Tell WebGL to use our shader program pair

    // Setup the attributes to pull data from our buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.enableVertexAttribArray(texcoordLocation);
    gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

    var matrix = m4.multiply(translatetozero, modelview);
    // Set the matrix.
    gl.uniformMatrix4fv(matrixLocationProjection, false, modelview);
    gl.uniformMatrix4fv(matrixLocationView, false, matrix);

    // Tell the shader to get the texture from texture unit 0
    gl.uniform1i(textureLocation, 0);

    // draw the quad (2 triangles, 6 vertices)
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (copyVideo)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
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
  var white1PixelTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white1PixelTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([255,255,255,255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  let matrleftfrust = stereoCam.applyLeftFrustum();
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrleftfrust);

  let matAccum1 = m4.multiply(modelview, translatetozero);

  let translateLeftEye = m4.translation(-stereoCam.eyeSeperation/2, 0, 0);
  let modelViewLeft = m4.multiply(matAccum1, translateLeftEye);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewLeft);
  gl.colorMask(true, false, false, true);
  gl.uniform1i(textureLocation, 0);
  gl.uniform4fv(shProgram.iColor, [1,1,0,1]);
  surface.Draw();
  
  /*
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.clearDepth(1);
  gl.colorMask(false, true, true, true);

  let matrightfrustum = stereoCam.applyRightFrustum();

  let translateRightEye = m4.translation(stereoCam.eyeSeperation / 2, 0, 0);
  let modelViewRight = m4.multiply(matAccum1, translateRightEye);

  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrightfrustum);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewRight);
  gl.uniform1i(textureLocation, 1);
  surface.Draw();

  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.clearDepth(1);
  gl.colorMask(true, true, true, true);
  gl.uniform4fv(shProgram.iColor, [0,0,0,1]);
  */
//  loadWebCamTexture();
}

function main() {
  // Get A WebGL context
  if (!gl) {
    return;
  }
//  spaceball = new SimpleRotator(canvas, draw, 10);
  initGL();

  video = setupVideo("video_example.mp4");
  
//  setInterval(draw, 1/20);

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
  shProgram.itexCoordAttributeLocation = gl.getAttribLocation(program, "aTextureCoord");
  shProgram.iuSampler = gl.getUniformLocation(program, "uSampler");
  shProgram.ivTextureCoord = gl.getUniformLocation(program, "vTextureCoord");
  // look up where the vertex data needs to go.

  // lookup uniforms
//  shProgram.iresolutionLocation = gl.getUniformLocation(program, "u_resolution");
//  shProgram.iuImage = gl.getUniformLocation(program, "u_image");
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