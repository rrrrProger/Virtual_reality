'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let texture;
let cameraText;
let video;
let BG;

// FIGURE CONSTANTS
const a = 0.7;
const c = 1;
const U_MAX = 360;
const T_MAX = 90;
const teta = deg2rad(30);

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
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


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const eyeSeparation = parseFloat(document.getElementById('eyeSeparation').value);
    const convergence = parseFloat(document.getElementById('convergence').value);
    const fov = parseFloat(document.getElementById('fov').value);
    const near = parseFloat(document.getElementById('near').value);
    
    let left, right, top, bottom, far = 2000;
    top = near * Math.tan(fov / 2.0);
    bottom = -top;

    let a = Math.tan(fov / 2.0) * convergence;
    let b = a - eyeSeparation / 2;
    let c = a + eyeSeparation / 2;

    left = -b * near / convergence;
    right = c * near / convergence;

    let leftP = m4.orthographic(left, right, bottom, top, near, far);

    left = -c * near / convergence;
    right = b * near / convergence;

    let rightP = m4.orthographic(left, right, bottom, top, near, far);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0);

    let leftTrans = m4.translation(-0.01, 0, -20);
    let rightTrans = m4.translation(0.01, 0, -20);

    let matrixMult = m4.multiply(rotateToPointZero, modelView);

    if (document.getElementById('camera').checked) {
      const projection = m4.orthographic(0, 1, 0, 1, -1, 1);
      const noRot = m4.multiply(rotateToPointZero, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

      gl.uniformMatrix4fv(shProgram.iModelViewMat, false, noRot);
      gl.uniformMatrix4fv(shProgram.iProjectionMat, false, projection);

      gl.bindTexture(gl.TEXTURE_2D, cameraText);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      BG?.Draw();
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, m4.multiply(leftTrans, matrixMult));
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, leftP);

    gl.colorMask(true, false, false, false);

    surface.Draw();
  
    gl.clear(gl.DEPTH_BUFFER_BIT);
  
    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, m4.multiply(rightTrans, matrixMult));
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, rightP);

    gl.colorMask(false, true, true, false);

    surface.Draw();

    gl.colorMask(true, true, true, true);
}

const CreateSurfaceData = () => {
  let textureList = [];
  let vertexList = [];

  let calculateTu = (u, t) => [u / U_MAX, (t + 90) / T_MAX + 90];
  const scale = 3;

  for (let t = -90; t <= T_MAX; t += 1) {
      for (let u = 0; u <= U_MAX; u += 1) {
      const uRad = deg2rad(u);
      const tRad = deg2rad(t);

      const x = (a + tRad * Math.cos(teta) + c * (tRad * tRad) * Math.sin(teta)) * Math.cos(uRad);
      const y = (a + tRad * Math.cos(teta) + c * (tRad * tRad) * Math.sin(teta)) * Math.sin(uRad);
      const z = -tRad * Math.sin(teta) + c * (tRad * tRad) * Math.cos(teta); 

      vertexList.push(x * scale, y * scale, z * scale);
      textureList.push(...calculateTu(u, t));

      const uNext = deg2rad(u + 1);
      const tNext = deg2rad(t + 1);

      const xNext = (a + tNext * Math.cos(teta) + c * (tNext * tNext) * Math.sin(teta)) * Math.cos(uNext);
      const yNext = (a + tNext * Math.cos(teta) + c * (tNext * tNext) * Math.sin(teta)) * Math.sin(uNext);
      const zNext = -tNext * Math.sin(teta) + c * (tNext * tNext) * Math.cos(teta); 

      vertexList.push(xNext * scale, yNext * scale, zNext * scale);
      textureList.push(...calculateTu(u + 1, t + 1));
      
    }
  }

  return { vertexList, textureList };
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex             = gl.getAttribLocation(prog, 'vertex');
    shProgram.iModelViewMat             = gl.getUniformLocation(prog, 'ModelViewMatrix');
    shProgram.iProjectionMat            = gl.getUniformLocation(prog, 'ProjectionMatrix');
  
    shProgram.iTextCoords               = gl.getAttribLocation(prog, 'textCoords');
    shProgram.iTextUnit                 = gl.getUniformLocation(prog, 'uTexture');

    surface = new Model('Surface');
    BG = new Model('Background');
    const { vertexList, textureList } = CreateSurfaceData();
    surface.BufferData(vertexList, textureList);
    BG.BufferData(
      [ 0.0, 0.0, 0.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 1.0, 1.0, 0.0,  0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
      [ 1, 1, 0, 1,  0, 0, 0, 0,  1, 0, 1, 1],
    );

    LoadTexture();
    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
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
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

const rerender = () => {
  draw();
  window.requestAnimationFrame(rerender);
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");

        video = document.createElement('video');
        video.setAttribute('autoplay', 'true');
        cameraText = getCameraText(gl);

        document.getElementById('camera').addEventListener('change', async (e) => {
          if (document.getElementById('camera').checked) {
            getCamera().then((stream)=> video.srcObject = stream)
          } else {
            video.srcObject = null;
          }
        });

        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);
  
    document.getElementById('eyeSeparation').addEventListener('input', draw);
    document.getElementById('convergence').addEventListener('input', draw);
    document.getElementById('fov').addEventListener('input', draw);
    document.getElementById('near').addEventListener('input', draw);

    rerender();
}

const LoadTexture = () => {
  const image = new Image();
  image.src = 'https://www.the3rdsequence.com/texturedb/download/116/texture/jpg/1024/irregular+wood+planks-1024x1024.jpg';
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

const getCameraText = (gl) => {
  const text = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, text);
  
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return text;
};