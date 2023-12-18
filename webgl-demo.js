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

const gl = canvas.getContext('webgl');
// setup GLSL program
// compiles shader, links program, look up locations
const textureProgramInfo = webglUtils.createProgramInfo(gl, ['vertex-shader-3d', 'fragment-shader-3d']);

const sphereBufferInfo = primitives.createSphereBufferInfo(
    gl,
    1,  // radius
    12, // subdivisions around
    6,  // subdivisions down
);
const planeBufferInfo = primitives.createPlaneBufferInfo(
    gl,
    20,  // width
    20,  // height
    1,   // subdivisions across
    1,   // subdivisions down
);

// make a 8x8 checkerboard texture
const checkerboardTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, checkerboardTexture);
gl.texImage2D(
    gl.TEXTURE_2D,
    0,                // mip level
    gl.LUMINANCE,     // internal format
    8,                // width
    8,                // height
    0,                // border
    gl.LUMINANCE,     // format
    gl.UNSIGNED_BYTE, // type
    new Uint8Array([  // data
      0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
      0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
      0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
      0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
      0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
      0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
      0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
      0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
    ]));
gl.generateMipmap(gl.TEXTURE_2D);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

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
function degToRad(d) {
  return d * Math.PI / 180;
}

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector('#canvas');
  document.getElementById("applyLeft").onclick = applyLeftFrustum;
  document.getElementById("applyRight").onclick = applyRightFrustum;
  if (!gl) {
    return;
  }
  render();
}


// Uniforms for each object.
const planeUniforms = {
  u_colorMult: [0.5, 0.5, 1, 1],  // lightblue
  u_texture: checkerboardTexture,
  u_world: m4.translation(0, 0, 0),
};
const sphereUniforms = {
  u_colorMult: [1, 0.5, 0.5, 1],  // pink
  u_texture: checkerboardTexture,
  u_world: m4.translation(0, 2, 0),
};


function render() {
  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const cameraPosition = [settings.cameraX, settings.cameraY, settings.cameraZ];
  const target = [0, 0, 0];
  const up = [0, 1, 0];
  const cameraMatrix = m4.lookAt(cameraPosition, target, up);
  const worldMatrix = m4.translation(0, 0, 0)

  const top = Math.tan(degToRad(settings.FOV)* 0.5) * settings.znear;
  const bottom = -top;
  const left = settings.aspect * bottom;
  const right = settings.aspect * top;
  const width = Math.abs(right - left);
  const height = Math.abs(top - bottom);
  drawScene(m4.frustum(left, right, bottom, top, settings.znear, settings.zfar), m4.inverse(cameraMatrix), worldMatrix);
}

function applyLeftFrustum() {
  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(settings.eye_seperation/2, 0, gl.canvas.width, gl.canvas.height);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  // Clear the canvas AND the depth buffer.
  let red = 1.0;
  let green = 0.0;
  let blue = 0.0;
  let alpha = 0.0;
  gl.clearColor(0.0, 1.0, 1.0, 1.0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const cameraPosition = [settings.cameraX, settings.cameraY, settings.cameraZ];
  const target = [0, 0, 0];
  const up = [0, 1, 0];
  const cameraMatrix = m4.lookAt(cameraPosition, target, up);
  const worldMatrix = m4.translation(0, 0, 0)

  const top = Math.tan(degToRad(settings.FOV)* 0.5) * settings.znear;
  const bottom = -top;

  var a = settings.aspect * Math.tan(degToRad(settings.FOV)/2) * settings.convergence;
  
  var b = a - settings.eye_seperation/2;
  var c = a + settings.eye_seperation/2;

  const left = -b * settings.znear / settings.convergence;
  const right = c * settings.znear / settings.convergence;

  const width = Math.abs(right - left);
  const height = Math.abs(top - bottom);
  drawScene(m4.frustum(left, right, bottom, top, settings.znear, settings.zfar), m4.inverse(cameraMatrix), worldMatrix);
}

function applyRightFrustum() {
  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(-settings.eye_seperation/2, 0, gl.canvas.width, gl.canvas.height);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  // Clear the canvas AND the depth buffer.
  let red = 0;
  let green = 1;
  let blue = 1;
  let alpha = 0;
  gl.clearColor(1.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const cameraPosition = [settings.cameraX, settings.cameraY, settings.cameraZ];
  const target = [0, 0, 0];
  const up = [0, 1, 0];
  const cameraMatrix = m4.lookAt(cameraPosition, target, up);
  const worldMatrix = m4.translation(0, 0, 0)

  const top = Math.tan(degToRad(settings.FOV)* 0.5) * settings.znear;
  const bottom = -top;

  var a = settings.aspect * Math.tan(degToRad(settings.FOV)/2) * settings.convergence;
  
  var b = a - settings.eye_seperation/2;
  var c = a + settings.eye_seperation/2;

  const left = -c * settings.znear / settings.convergence;
  const right = b * settings.znear / settings.convergence;

  drawScene(m4.frustum(left, right, bottom, top, settings.znear, settings.zfar), m4.inverse(cameraMatrix), worldMatrix);
}

function drawScene(projectionMatrix, viewMatrix, worldMatrix) {
  // Make a view matrix from the camera matrix.
  gl.useProgram(textureProgramInfo.program);

  // Set the uniform that both the sphere and the plane share
  webglUtils.setUniforms(textureProgramInfo, {
    u_view: viewMatrix,
    u_projection: projectionMatrix,
    u_world: m4.translation(2, 0, 0),
  });

  
// ------ Draw the sphere --------

  // Setup all the needed attributes.
  webglUtils.setBuffersAndAttributes(gl, textureProgramInfo, sphereBufferInfo);

  // Set the uniforms unique to the sphere
  webglUtils.setUniforms(textureProgramInfo, sphereUniforms);

  // calls gl.drawArrays or gl.drawElements
  webglUtils.drawBufferInfo(gl, sphereBufferInfo);

  // ------ Draw the plane --------

  // Setup all the needed attributes.
  webglUtils.setBuffersAndAttributes(gl, textureProgramInfo, planeBufferInfo);

  // Set the uniforms unique to the plane
  webglUtils.setUniforms(textureProgramInfo, planeUniforms);

  // calls gl.drawArrays or gl.drawElements
  webglUtils.drawBufferInfo(gl, planeBufferInfo);
}

main();