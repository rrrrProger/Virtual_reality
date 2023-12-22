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
let video
let tex

// Vertex shader
var vshader = `
attribute vec3 vertex;
uniform mat4 ModelViewMatrix;
uniform mat4 ModelProjectonMatrix;
varying highp vec2 vTextureCoord;
attribute vec2 aTextureCoord;
void main() {
    gl_Position = ModelProjectonMatrix * ModelViewMatrix * vec4(vertex, 1.0);
    vTextureCoord = aTextureCoord;
}`;

// Fragment shader
var fshader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH 
    precision highp float;
#else
    precision mediump float;
#endif
varying highp vec2 vTextureCoord;
    
uniform sampler2D uSampler;
uniform vec4 color;

void main() {
    gl_FragColor = texture2D(uSampler, vTextureCoord) * color;
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

const programInfo = {
  program: program,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(program, "vertex"),
    textureCoord: gl.getAttribLocation(program, "aTextureCoord"),
  },
  uniformLocations: {
    projectionMatrix: gl.getUniformLocation(program, "ModelProjectonMatrix"),
    modelViewMatrix: gl.getUniformLocation(program, "ModelViewMatrix"),
    uSampler: gl.getUniformLocation(program, "uSampler"),
  },
};


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
  gl.clearColor(1,0,0,1);
  gl.enable(gl.DEPTH_TEST);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearDepth(1);

  var modelview = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]

  var projection = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]

  /*
  var modelview = spaceball.getViewMatrix();
  var translatetozero = m4.translation(0.0, 0.0, -1.0);
  var projection = m4.perspective(Math.PI / 8, 1, 8, 12);

  stereoCam = new StereoCamera(
    settings.eyeSeperation, //70
    settings.convergence, //5000
    settings.fov, //60
    settings.aspect, //1.5
    settings.znear, //1
    settings.zfar // 20000
  );
  gl.uniform4fv(shProgram.iColor, [1,1,0,1]);

  let matrleftfrust = stereoCam.applyLeftFrustum();
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrleftfrust);

  let matAccum1 = m4.multiply(modelview, translatetozero);

  let translateLeftEye = m4.translation(-stereoCam.eyeSeperation/2, 0, 0);
  let modelViewLeft = m4.multiply(matAccum1, translateLeftEye);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewLeft);

  gl.colorMask(true, false, false, true);

  surface.Draw();
  
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.clearDepth(1);
  gl.colorMask(false, true, true, true);

  
  let matrightfrustum = stereoCam.applyRightFrustum();
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, matrightfrustum);

  let translateRightEye = m4.translation(stereoCam.eyeSeperation / 2, 0, 0);
  let modelViewRight = m4.multiply(matAccum1, translateRightEye);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewRight);
  
  surface.Draw();

  /*
  let webcamImage = new Image();
  webcamImage.src = canvas.toDataURL();
  webcamImage.onload = () =>
  { 
    // use the new image as a texture
    let webcamTexture = gl.createTexture();
    // send to GPU      
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webcamImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  };
  */
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelview);
  gl.uniformMatrix4fv(shProgram.iModelProjectionMatrix, false, projection);
  // Create a vertex array object (attribute state)
  var vao = gl.createVertexArray();

  // and make it the one we're currently working with
  gl.bindVertexArray(vao);

  // Create a buffer and put a single pixel space rectangle in
  // it (2 triangles)
  var positionBuffer = gl.createBuffer();

  gl.enableVertexAttribArray(shProgram.iAttribVertex);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
    shProgram.iAttribVertex, size, type, normalize, stride, offset);

  // provide texture coordinates for the rectangle.
  var texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0,  0.0,
      1.0,  0.0,
      0.0,  1.0,
      0.0,  1.0,
      1.0,  0.0,
      1.0,  1.0,
  ]), gl.STATIC_DRAW);

  // Turn on the attribute
  gl.enableVertexAttribArray(shProgram.itexCoordAttributeLocation);

  // Tell the attribute how to get data out of texCoordBuffer (ARRAY_BUFFER)
  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
    shProgram.itexCoordAttributeLocation, size, type, normalize, stride, offset);

  // Create a texture.
  tex = gl.createTexture();

  var textureInfo = {
    width: 1,   // we don't know the size until it loads
    height: 1,
    texture: tex,
  };

  gl.bindVertexArray(vao);

  var image = new Image();
  image.src = "cube.png";
  image.addEventListener('load', function() {
    textureInfo.width = image.width;
    textureInfo.height = image.height;

    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
    gl.activeTexture(gl.TEXTURE0 + 0);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    /*
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);

    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    */
    console.log("image : ", image);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  });

  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniform4fv(shProgram.iColor, [1,1,0,1]);


  // Pass in the canvas resolution so we can convert from
  // pixels to clipspace in the shader

  // Tell the shader to get the texture from texture unit 0
  gl.uniform1i(shProgram.iuSampler, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  console.log("image.width : ", image.width, " image.height : ", image.height)
  setRectangle(0, 0, image.width, image.height);

  // Draw the rectangle.
  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = 6;
  gl.drawArrays(primitiveType, offset, count);
}

function main() {
  // Get A WebGL context
  if (!gl) {
    return;
  }
  spaceball = new SimpleRotator(canvas, draw, 10);
  initGL();

  
  video = document.createElement('video');
  document.getElementById('uiContainer').appendChild(video);
  video.width    = 320;
  video.height   = 240;
  video.autoplay = true;
  video.src = "video_example.mp4"
  
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

  shProgram.iAttribVertex = gl.getAttribLocation(program, "vertex");
  shProgram.iModelViewMatrix = gl.getUniformLocation(program, "ModelViewMatrix");
  shProgram.iModelProjectionMatrix = gl.getUniformLocation(program, "ModelProjectonMatrix");
  shProgram.iColor = gl.getUniformLocation(program, "color");
  shProgram.itexCoordAttributeLocation = gl.getAttribLocation(program, "aTextureCoord");
  shProgram.iuSampler = gl.getUniformLocation(program, "uSampler");

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

function setRectangle(x, y, width, height) {
  var x1 = x;
  var x2 = x + width;
  var y1 = y;
  var y2 = y + height;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
     x1, y1,
     x2, y1,
     x1, y2,
     x1, y2,
     x2, y1,
     x2, y2,
  ]), gl.STATIC_DRAW);
}


main();