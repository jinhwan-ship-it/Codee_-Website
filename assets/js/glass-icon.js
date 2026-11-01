/*!
 * Glass Icon — Originkit (registry: glass-icon · export LiquidGlassCluster)
 * 원본: originkit CLI `add glass-icon` 소스(React/TSX). 레이마칭 셰이더 · 회전 수학 · SDF 베이킹은
 * 원본 코드를 TypeScript 타입만 지워 그대로 옮겼다. 런타임(React 부분)은 아래 'Codee 바닐라 런타임' 참고.
 * 정적 HTML에서 쓰도록 React 컴포넌트를 바닐라 스크립트로 옮겼다.
 */
;(function (global) {
"use strict";
const BEVEL = 0.025;
const CORE_REFRACT = 1;
const IOR = 1.5;
const THICKNESS = 2;
const IDLE_FLOAT = 0.05;
const TILT_RANGE = 0.5;
const TILT_RATE = 5;
const DRAG_GAIN = 0.01;
const SPIN_YAW = 0.5;
const SPIN_PITCH = 0.2;
const FOV = 45 * Math.PI / 180;
const CAM_DIST = 5;
const DEG = Math.PI / 180;
function parseColor(input, fallback) {
  if (!input) return fallback;
  const s = input.trim();
  if (s[0] === "#") {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4)
      h = h.split("").map((c) => c + c).join("");
    if (h.length >= 6) {
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    }
    return fallback;
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(",").map((v) => parseFloat(v));
    if (p.length >= 3) return [p[0] / 255, p[1] / 255, p[2] / 255];
  }
  return fallback;
}
function numOf(v, fallback) {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}
function srcOf(v) {
  if (!v) return void 0;
  if (typeof v === "string") return v;
  const s = v.src;
  return typeof s === "string" ? s : void 0;
}
function rotYX(yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const m = new Float32Array(9);
  m[0] = cy;
  m[1] = 0;
  m[2] = -sy;
  m[3] = sy * sx;
  m[4] = cx;
  m[5] = cy * sx;
  m[6] = sy * cx;
  m[7] = -sx;
  m[8] = cy * cx;
  return m;
}
function transpose3(m) {
  const o = new Float32Array(9);
  o[0] = m[0];
  o[1] = m[3];
  o[2] = m[6];
  o[3] = m[1];
  o[4] = m[4];
  o[5] = m[7];
  o[6] = m[2];
  o[7] = m[5];
  o[8] = m[8];
  return o;
}
function mul3(a, b) {
  const o = new Float32Array(9);
  for (let c = 0; c < 3; c++)
    for (let r = 0; r < 3; r++)
      o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
  return o;
}
function rotYXZ(yaw, pitch, roll) {
  const base = rotYX(yaw, pitch);
  if (roll === 0) return base;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const rz = new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]);
  return mul3(base, rz);
}
function buildEnvCanvas() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, 1024, 512);
  const softbox = (x, y, w, h, intensity) => {
    const grd = ctx.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
    grd.addColorStop(1, `rgba(50, 50, 50, ${intensity * 0.2})`);
    ctx.fillStyle = grd;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 80;
    ctx.beginPath();
    const rr = ctx.roundRect;
    if (typeof rr === "function") rr.call(ctx, x, y, w, h, 60);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  };
  softbox(50, 100, 300, 312, 1);
  softbox(674, 100, 300, 312, 1);
  softbox(350, -50, 324, 150, 0.9);
  ctx.shadowBlur = 0;
  return canvas;
}
const SDF_MAX = 512;
const SDF_PAD = 24;
const SDF_SPREAD = 32;
function edt1d(f, d, v, z, n) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
function edt2d(mask, w, h) {
  const INF = 1e20;
  const grid = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = mask[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float32Array(n);
  const d = new Float32Array(n);
  const v = new Int32Array(n);
  const z = new Float32Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  return grid;
}
function bakeSDF(alpha, w, h) {
  const inside = new Uint8Array(w * h);
  const outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const on = alpha[i * 4 + 3] > 127 ? 1 : 0;
    inside[i] = on;
    outside[i] = on ? 0 : 1;
  }
  const dOut = edt2d(inside, w, h);
  const dIn = edt2d(outside, w, h);
  const signed = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) signed[i] = inside[i] ? Math.sqrt(dIn[i]) : -Math.sqrt(dOut[i]);
  const blurred = new Float32Array(w * h);
  const tmp = new Float32Array(w * h);
  const K = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += K[k + 2] * signed[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += K[k + 2] * tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      blurred[y * w + x] = s;
    }
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const norm = Math.max(0, Math.min(1, 0.5 + blurred[i] / (2 * SDF_SPREAD)));
    const b = Math.round(norm * 255);
    out[i * 4] = b;
    out[i * 4 + 1] = b;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  return out;
}
function fallbackAlpha(w, h) {
  const px = new Uint8ClampedArray(w * h * 4);
  const hx = w / 2 - SDF_PAD;
  const hy = h / 2 - SDF_PAD;
  const r = Math.min(hx, hy) * 0.45;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - w / 2) - (hx - r);
      const dy = Math.abs(y - h / 2) - (hy - r);
      const qx = Math.max(dx, 0);
      const qy = Math.max(dy, 0);
      const d = Math.hypot(qx, qy) + Math.min(Math.max(dx, dy), 0) - r;
      px[(y * w + x) * 4 + 3] = d < 0 ? 255 : 0;
    }
  }
  return px;
}
const FULLSCREEN_VS = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
const PLATE_FS = `
precision highp float;
uniform sampler2D uPlate;
uniform vec2 uPlateFit;
uniform vec2 uRes;
void main() {
    vec2 uv = (gl_FragCoord.xy / uRes - 0.5) * uPlateFit + 0.5;
    gl_FragColor = texture2D(uPlate, clamp(uv, 0.0, 1.0));
}`;
const GLASS_FS = `
precision highp float;

uniform vec2 uRes;
uniform float uAspect;
uniform float uTanHalf;

uniform sampler2D uPlate;
uniform vec2 uPlateFit;
uniform float uHasPlate;
uniform sampler2D uEnv;
uniform sampler2D uSDF;

uniform mat3 uRot;
uniform mat3 uRotT;
uniform vec3 uCenter;
uniform float uScale;
uniform float uBoundR;

uniform float uShape;
uniform float uHalfDepth;
uniform float uBevel;
uniform float uTorusTube;
uniform vec2 uLogoHalf;
uniform float uSdfUnits;

uniform float uDisp;
uniform float uFrost;
uniform vec3 uTint;

const float PI = 3.14159265359;
const float CORE_REFRACT = ${CORE_REFRACT.toFixed(4)};
const float IOR = ${IOR.toFixed(4)};
const float THICKNESS = ${THICKNESS.toFixed(4)};

float sdCross(vec2 p, vec2 b) {
    p = abs(p);
    p = (p.y > p.x) ? p.yx : p.xy;
    vec2 q = p - b;
    float k = max(q.y, q.x);
    vec2 w = (k > 0.0) ? q : vec2(b.y - p.x, -k);
    return sign(k) * length(max(w, 0.0));
}

vec2 r45(vec2 p) {
    const float c = 0.7071067811865476;
    return vec2((p.x + p.y) * c, (p.y - p.x) * c);
}

float sdLogo(vec2 p) {
    vec2 uv = p / (2.0 * uLogoHalf) + 0.5;

    uv.y = 1.0 - uv.y;
    vec2 e = abs(p) - uLogoHalf;
    float dBox = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0);

    float dTex = (0.5 - texture2D(uSDF, clamp(uv, 0.0, 1.0)).r) * 2.0 * uSdfUnits;
    return max(dTex, dBox);
}

float extrudeRound(float d2, float pz, float hd, float r) {
    vec2 q = vec2(d2 + r, abs(pz) - hd + r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float map(vec3 p) {
    if (uShape < 0.5) {
        return extrudeRound(sdCross(r45(p.xy), vec2(1.3, 0.35)), p.z, uHalfDepth, uBevel);
    } else if (uShape < 1.5) {
        vec2 q = vec2(length(p.xy) - 0.8, p.z);
        return length(q) - uTorusTube;
    } else if (uShape < 2.5) {
        return length(p) - 1.2;
    }
    return extrudeRound(sdLogo(p.xy), p.z, uHalfDepth, uBevel);
}

vec3 mapNormal(vec3 p) {
    const float e = 0.0015;
    vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * map(p + k.xyy * e) +
        k.yyx * map(p + k.yyx * e) +
        k.yxy * map(p + k.yxy * e) +
        k.xxx * map(p + k.xxx * e)
    );
}

vec4 plate(vec2 screenUv) {
    if (uHasPlate < 0.5) return vec4(0.0);
    vec2 uv = (screenUv - 0.5) * uPlateFit + 0.5;
    return texture2D(uPlate, clamp(uv, 0.0, 1.0));
}

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 screenUv = gl_FragCoord.xy / uRes;
    vec2 ndc = screenUv * 2.0 - 1.0;

    vec3 D = normalize(vec3(ndc.x * uTanHalf * uAspect, ndc.y * uTanHalf, -1.0));
    vec3 rd = normalize(uRotT * D);
    vec3 ro = (uRotT * -uCenter) / uScale;

    float bb = dot(ro, rd);
    float cc = dot(ro, ro) - uBoundR * uBoundR;
    float hh = bb * bb - cc;
    if (hh < 0.0) discard;
    hh = sqrt(hh);
    float t = max(-bb - hh, 0.0);
    float tMax = -bb + hh;

    bool hit = false;
    for (int i = 0; i < 80; i++) {
        if (t > tMax) break;
        float d = map(ro + rd * t);
        if (d < 0.0009) { hit = true; break; }
        t += d * 0.9;
    }
    if (!hit) discard;

    vec3 pObj = ro + rd * t;
    vec3 nObj = mapNormal(pObj);

    vec3 vP = uCenter + uScale * (uRot * pObj);
    vec3 normal = normalize(uRot * nObj);
    vec3 viewDir = normalize(-vP);

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);

    float coreFactor = pow(max(dot(normal, viewDir), 0.0), 2.0);
    vec2 lensOffset = (screenUv - 0.5) * (CORE_REFRACT * 0.15) * coreFactor;

    vec3 refractView = refract(-viewDir, normal, 1.0 / IOR);
    vec2 offset = refractView.xy * (THICKNESS * 0.1) - lensOffset;

    vec3 reflectDir = reflect(-viewDir, normal);
    vec2 equirectUv = vec2(
        atan(reflectDir.z, reflectDir.x) / (2.0 * PI) + 0.5,
        asin(clamp(reflectDir.y, -1.0, 1.0)) / PI + 0.5
    );
    vec3 reflection = texture2D(uEnv, equirectUv).rgb * 2.5;

    vec3 transmission = vec3(0.0);
    float bgAlpha = 0.0;

    vec2 uvR = screenUv + offset * (1.0 + uDisp);
    vec2 uvG = screenUv + offset;
    vec2 uvB = screenUv + offset * (1.0 - uDisp);

    if (uFrost > 0.001) {
        float rnd = rand(screenUv) * 6.2831853;
        const int SAMPLES = 24;
        const float GOLDEN_ANGLE = 2.39996323;
        float radius = 0.0;
        float radiusStep = 1.0 / float(SAMPLES);
        float blurMultiplier = uFrost * 0.025;
        for (int i = 0; i < SAMPLES; i++) {
            float theta = float(i) * GOLDEN_ANGLE + rnd;
            radius += radiusStep;
            vec2 bo = vec2(cos(theta), sin(theta)) * radius * blurMultiplier;
            transmission.r += plate(uvR + bo).r;
            vec4 g = plate(uvG + bo);
            transmission.g += g.g;
            bgAlpha += g.a;
            transmission.b += plate(uvB + bo).b;
        }
        transmission /= float(SAMPLES);
        bgAlpha /= float(SAMPLES);
    } else {
        transmission.r = plate(uvR).r;
        vec4 g = plate(uvG);
        transmission.g = g.g;
        bgAlpha = g.a;
        transmission.b = plate(uvB).b;
    }

    transmission *= uTint;

    vec3 clearGlassTint = mix(uTint, reflection, 0.5);
    transmission = mix(clearGlassTint, transmission, bgAlpha);

    vec3 finalColor = mix(transmission, reflection, fresnel * 0.8);

    float baseAlpha = max(0.25, fresnel * 0.85);
    float outAlpha = mix(baseAlpha, 1.0, bgAlpha);

    gl_FragColor = vec4(finalColor, outAlpha);
}`;
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("LiquidGlassCluster shader:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}
function link(gl, vs, fs) {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn("LiquidGlassCluster link:", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}


/* ------------------------------------------------------------------------
 * 바닐라 런타임 — 원본 React 컴포넌트(useEffect) 부분을 정적 HTML용으로 옮김.
 * 위의 상수 · 셰이더 · 수학 함수는 원본 그대로다. 아래에서 바뀐 점:
 *  1) React 없음: createGlassIcon(canvas, options)이 제어 객체를 돌려준다.
 *  2) 배경판(backdrop): Image + plate(2D 캔버스 그리기 함수)만 지원. Text · Video 제외.
 *  3) 정지 · 재생 API, 동작 줄이기(정적 한 장면), 화면 밖 · 탭 숨김 시 루프 정지.
 *  4) 포인터: 기울기는 마우스만(터치 스크롤 중 흔들림 방지), 드래그는 지정한 영역에서만.
 *     원본의 host `touch-action: none`(모바일 스크롤 막힘)은 쓰지 않는다.
 *  5) WebGL 실패 · 컨텍스트 손실 시 null / onFail로 알려 대체 화면을 쓰게 한다.
 * ---------------------------------------------------------------------- */

const DEFAULT_OPTIONS = {
    background: "#000000",
    shape: "Torus",
    logo: "",
    depth: 32,
    size: 60,
    speed: 100,
    direction: "Clockwise",
    glass: { tint: "#FFFFFF", chromatic: 25, frost: 50 },
    // Originkit 프리셋: orient.angleX = 100
    orient: { angleX: 100, angleY: 0, angleZ: 0, offsetX: 0, offsetY: 0 },
    plate: null,
    plateImage: "",
    maxDpr: 2,
    interactive: true,
    reduced: false,
    initialYaw: 0,
    initialPitch: 0,
    dragTarget: null,
    onLayout: null,
    onFirstFrame: null,
    onFail: null,
}

function mergeOptions(base, patch) {
    const out = { ...base, ...patch }
    out.glass = { ...base.glass, ...(patch.glass || {}) }
    out.orient = { ...base.orient, ...(patch.orient || {}) }
    return out
}

function createGlassIcon(canvas, userOptions = {}) {
    let opts = mergeOptions(DEFAULT_OPTIONS, userOptions)

    const glOpts = { antialias: false, alpha: true, premultipliedAlpha: true }
    let ctx = null
    try {
        ctx = canvas.getContext("webgl2", glOpts) || canvas.getContext("webgl", glOpts)
    } catch (e) {
        ctx = null
    }
    if (!ctx) return null
    const gl = ctx

    const plateProg = link(gl, FULLSCREEN_VS, PLATE_FS)
    const glassProg = link(gl, FULLSCREEN_VS, GLASS_FS)
    if (!plateProg || !glassProg) return null

    const uPlatePass = {
        plate: gl.getUniformLocation(plateProg, "uPlate"),
        fit: gl.getUniformLocation(plateProg, "uPlateFit"),
        res: gl.getUniformLocation(plateProg, "uRes"),
    }
    const u = {}
    ;[
        ["res", "uRes"], ["aspect", "uAspect"], ["tanHalf", "uTanHalf"], ["plate", "uPlate"],
        ["plateFit", "uPlateFit"], ["hasPlate", "uHasPlate"], ["env", "uEnv"], ["sdf", "uSDF"],
        ["rot", "uRot"], ["rotT", "uRotT"], ["center", "uCenter"], ["scale", "uScale"],
        ["boundR", "uBoundR"], ["shape", "uShape"], ["halfDepth", "uHalfDepth"], ["bevel", "uBevel"],
        ["torusTube", "uTorusTube"], ["logoHalf", "uLogoHalf"], ["sdfUnits", "uSdfUnits"],
        ["disp", "uDisp"], ["frost", "uFrost"], ["tint", "uTint"],
    ].forEach(([k, name]) => { u[k] = gl.getUniformLocation(glassProg, name) })
    const aPlatePos = gl.getAttribLocation(plateProg, "aPos")
    const aGlassPos = gl.getAttribLocation(glassProg, "aPos")

    const quadBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

    function makeTex(wrap) {
        const t = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
        return t
    }
    const plateTex = makeTex(gl.CLAMP_TO_EDGE)
    const sdfTex = makeTex(gl.CLAMP_TO_EDGE)
    const envTex = makeTex(gl.REPEAT)

    const envCanvas = buildEnvCanvas()
    if (envCanvas) {
        gl.bindTexture(gl.TEXTURE_2D, envTex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, envCanvas)
    }

    // ---- 상태 ----
    let vw = 1, vh = 1, cssW = 1, cssH = 1, dprCur = 1
    let sdfH = 1, sdfReady = false, logoAspect = 1, sdfToken = 0
    let plateReady = false, plateAspect = 1, plateToken = 0
    let baseYaw = opts.initialYaw || 0, basePitch = opts.initialPitch || 0
    let tiltX = 0, tiltY = 0, tiltTargetX = 0, tiltTargetY = 0
    let dragging = false, lastX = 0, lastY = 0, dragId = null
    let elapsed = 0
    let playing = true
    let inView = true
    let docVisible = typeof document === "undefined" ? true : !document.hidden
    let lost = false
    let destroyed = false
    let raf = 0
    let prev = 0
    let pending = 0
    let firstFrameSent = false

    // ---- 로고 SDF (원본 그대로) ----
    function uploadSDF(alpha, w, h, aspect) {
        const bytes = bakeSDF(alpha, w, h)
        sdfH = h
        logoAspect = aspect
        gl.bindTexture(gl.TEXTURE_2D, sdfTex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes)
        sdfReady = true
    }
    function bakeFallback() {
        uploadSDF(fallbackAlpha(320, 320), 320, 320, 1)
    }
    function bakeLogo() {
        const url = srcOf(opts.logo)
        if (!url) { bakeFallback(); return }
        const token = ++sdfToken
        const img = new window.Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
            if (token !== sdfToken || destroyed) return
            const scale = Math.min(
                (SDF_MAX - SDF_PAD * 2) / Math.max(img.width, 1),
                (SDF_MAX - SDF_PAD * 2) / Math.max(img.height, 1),
                1
            )
            const iw = Math.max(1, Math.round(img.width * scale))
            const ih = Math.max(1, Math.round(img.height * scale))
            const w = iw + SDF_PAD * 2
            const h = ih + SDF_PAD * 2
            const c = document.createElement("canvas")
            c.width = w
            c.height = h
            const c2d = c.getContext("2d")
            if (!c2d) return
            c2d.clearRect(0, 0, w, h)
            c2d.drawImage(img, SDF_PAD, SDF_PAD, iw, ih)
            let data
            try { data = c2d.getImageData(0, 0, w, h) } catch (e) { bakeFallback(); return }
            uploadSDF(data.data, w, h, w / h)
            invalidate()
        }
        img.onerror = () => { if (token === sdfToken) { bakeFallback(); invalidate() } }
        img.src = url
    }

    // ---- 아이콘이 화면에서 차지하는 자리(CSS px) ----
    // 투영 계산: 화면 중심 대비 offsetX/100, offsetY/100 위치, 반지름 = size/100 × 높이/2
    // size는 숫자, 또는 무대 크기(cssW, cssH)를 받아 숫자를 돌려주는 함수
    function sizeOf() {
        const v = typeof opts.size === "function" ? opts.size(cssW, cssH) : opts.size
        return Math.max(0.02, (Number(v) || 0) / 100)
    }
    function iconRect() {
        const o = opts.orient
        return {
            x: ((1 + o.offsetX / 100) / 2) * cssW,
            y: ((1 - o.offsetY / 100) / 2) * cssH,
            r: (sizeOf() * cssH) / 2,
            width: cssW,
            height: cssH,
        }
    }

    // ---- 배경판 ----
    function loadPlate() {
        plateReady = false
        const token = ++plateToken
        if (typeof opts.plate === "function") {
            const c = document.createElement("canvas")
            c.width = vw
            c.height = vh
            const c2d = c.getContext("2d")
            if (!c2d) return
            const r = iconRect()
            opts.plate(c2d, vw, vh, {
                dpr: dprCur,
                cx: r.x * dprCur,
                cy: r.y * dprCur,
                r: r.r * dprCur,
                background: opts.background,
            })
            plateAspect = vw / vh
            gl.bindTexture(gl.TEXTURE_2D, plateTex)
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c)
            plateReady = true
            return
        }
        const url = srcOf(opts.plateImage)
        if (!url) return
        const img = new window.Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
            if (token !== plateToken || destroyed) return
            plateAspect = img.width / Math.max(img.height, 1)
            gl.bindTexture(gl.TEXTURE_2D, plateTex)
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
            plateReady = true
            invalidate()
        }
        img.src = url
    }

    // ---- 크기 ----
    function resize(force) {
        const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr)
        const cw = canvas.clientWidth || 1
        const ch = canvas.clientHeight || 1
        const w = Math.max(1, Math.round(cw * dpr))
        const h = Math.max(1, Math.round(ch * dpr))
        if (!force && w === vw && h === vh) return
        dprCur = dpr
        cssW = cw
        cssH = ch
        vw = w
        vh = h
        canvas.width = w
        canvas.height = h
        if (typeof opts.plate === "function") loadPlate()
        if (typeof opts.onLayout === "function") opts.onLayout(iconRect())
        invalidate()
    }

    // ---- 그리기 (원본 frame()의 계산을 그대로 따른다) ----
    function draw(dt, animate) {
        const p = opts
        const isLogo = p.shape === "Logo"
        if (isLogo && !sdfReady) return false

        if (animate) {
            const k = 1 - Math.exp(-TILT_RATE * dt)
            tiltX += (tiltTargetX - tiltX) * k
            tiltY += (tiltTargetY - tiltY) * k
            const spin = (p.speed / 50) * (p.direction === "Counterclockwise" ? -1 : 1)
            baseYaw += spin * SPIN_YAW * dt
            basePitch += spin * SPIN_PITCH * dt
            elapsed += dt
        }

        const o = p.orient
        const yaw = baseYaw + tiltX + o.angleY * DEG
        const pitch = Math.max(-1.45, Math.min(1.45, basePitch - tiltY)) + o.angleX * DEG
        const rot = rotYXZ(yaw, pitch, o.angleZ * DEG)
        const rotT = transpose3(rot)

        const camDist = CAM_DIST
        const halfFrame = camDist * Math.tan(FOV / 2)
        const targetHalf = sizeOf() * halfFrame

        const nativeDepth = Math.max(0, p.depth / 100)
        const torusTube = Math.max(0.02, nativeDepth * 0.5)
        let refHalf, boundR, shapeId
        let halfDepth = nativeDepth * 0.5
        let bevel = BEVEL
        let logoHalfX = 1
        let logoHalfY = 1

        if (p.shape === "X") {
            shapeId = 0
            refHalf = 1.3
            boundR = Math.hypot(1.3, 0.35) + halfDepth + bevel
        } else if (p.shape === "Torus") {
            shapeId = 1
            refHalf = 0.8 + torusTube
            boundR = 0.8 + torusTube
        } else if (p.shape === "Sphere") {
            shapeId = 2
            refHalf = 1.2
            boundR = 1.2
        } else {
            shapeId = 3
            logoHalfY = 1
            logoHalfX = logoAspect
            refHalf = 1
            halfDepth *= refHalf / 1.3
            bevel *= refHalf / 1.3
            boundR = Math.hypot(logoHalfX, logoHalfY, halfDepth) + bevel
        }

        const scale = targetHalf / refHalf
        const floatY = Math.sin(elapsed * 2) * IDLE_FLOAT

        const screenAspect = vw / vh
        const fitX = screenAspect > plateAspect ? 1 : screenAspect / plateAspect
        const fitY = screenAspect > plateAspect ? plateAspect / screenAspect : 1
        const hasPlate = plateReady ? 1 : 0

        gl.viewport(0, 0, vw, vh)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)

        if (hasPlate) {
            gl.useProgram(plateProg)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, plateTex)
            gl.uniform1i(uPlatePass.plate, 0)
            gl.uniform2f(uPlatePass.fit, fitX, fitY)
            gl.uniform2f(uPlatePass.res, vw, vh)
            gl.enableVertexAttribArray(aPlatePos)
            gl.vertexAttribPointer(aPlatePos, 2, gl.FLOAT, false, 0, 0)
            gl.drawArrays(gl.TRIANGLES, 0, 3)
        }

        gl.useProgram(glassProg)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, plateTex)
        gl.uniform1i(u.plate, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, envTex)
        gl.uniform1i(u.env, 1)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, sdfTex)
        gl.uniform1i(u.sdf, 2)

        gl.uniform2f(u.res, vw, vh)
        gl.uniform1f(u.aspect, screenAspect)
        gl.uniform1f(u.tanHalf, Math.tan(FOV / 2))
        gl.uniform2f(u.plateFit, fitX, fitY)
        gl.uniform1f(u.hasPlate, hasPlate)

        gl.uniformMatrix3fv(u.rot, false, rot)
        gl.uniformMatrix3fv(u.rotT, false, rotT)

        gl.uniform3f(
            u.center,
            (o.offsetX / 100) * halfFrame * screenAspect,
            floatY + (o.offsetY / 100) * halfFrame,
            -camDist
        )
        gl.uniform1f(u.scale, scale)
        gl.uniform1f(u.boundR, boundR)

        gl.uniform1f(u.shape, shapeId)
        gl.uniform1f(u.halfDepth, halfDepth)
        gl.uniform1f(u.bevel, bevel)
        gl.uniform1f(u.torusTube, torusTube)
        gl.uniform2f(u.logoHalf, logoHalfX, logoHalfY)
        gl.uniform1f(u.sdfUnits, (SDF_SPREAD * (2 * logoHalfY)) / Math.max(sdfH, 1))

        const g = p.glass
        gl.uniform1f(u.disp, g.chromatic / 1000)
        gl.uniform1f(u.frost, g.frost / 100)
        const tint = parseColor(g.tint, [1, 1, 1])
        gl.uniform3f(u.tint, tint[0], tint[1], tint[2])

        gl.enableVertexAttribArray(aGlassPos)
        gl.vertexAttribPointer(aGlassPos, 2, gl.FLOAT, false, 0, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 3)

        if (!firstFrameSent && (plateReady || !opts.plate)) {
            firstFrameSent = true
            if (typeof opts.onFirstFrame === "function") opts.onFirstFrame()
        }
        return true
    }

    // ---- 루프 ----
    function animating() {
        return playing && inView && docVisible && !opts.reduced && !lost && !destroyed
    }
    function loop(now) {
        raf = 0
        if (!animating()) return
        const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0
        prev = now
        draw(dt, true)
        raf = requestAnimationFrame(loop)
    }
    function startLoop() {
        if (raf || !animating()) return
        prev = 0
        raf = requestAnimationFrame(loop)
    }
    function stopLoop() {
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        prev = 0
    }
    // 루프가 멈춘 상태(정지 · 동작 줄이기 · 드래그)에서 한 장만 다시 그린다
    function invalidate() {
        if (destroyed || lost || raf || pending) return
        pending = requestAnimationFrame(() => {
            pending = 0
            if (!raf) draw(0, false)
        })
    }
    function sync() {
        if (animating()) startLoop()
        else { stopLoop(); invalidate() }
    }

    // ---- 포인터 ----
    function onPointerMove(e) {
        if (dragging) {
            if (dragId !== null && e.pointerId !== dragId) return
            baseYaw += (e.clientX - lastX) * DRAG_GAIN
            basePitch += (e.clientY - lastY) * DRAG_GAIN
            basePitch = Math.max(-1.4, Math.min(1.4, basePitch))
            lastX = e.clientX
            lastY = e.clientY
            if (!raf) invalidate()
            return
        }
        // 기울기는 마우스만 — 터치 스크롤 중에는 반응하지 않는다
        if (e.pointerType !== "mouse" || !animating()) return
        const r = canvas.getBoundingClientRect()
        tiltTargetX = (((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1) * TILT_RANGE
        tiltTargetY = (-((e.clientY - r.top) / Math.max(r.height, 1)) * 2 + 1) * TILT_RANGE
    }
    function onPointerDown(e) {
        if (opts.reduced || !opts.interactive) return
        if (e.pointerType === "mouse" && e.button !== 0) return
        dragging = true
        dragId = e.pointerId
        lastX = e.clientX
        lastY = e.clientY
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* noop */ }
    }
    function onPointerUp(e) {
        if (dragId !== null && e && e.pointerId !== dragId) return
        dragging = false
        dragId = null
    }
    function onLeave() {
        if (!dragging) {
            tiltTargetX = 0
            tiltTargetY = 0
        }
    }

    let dragTarget = null
    function bindDragTarget(el) {
        if (dragTarget) {
            dragTarget.removeEventListener("pointerdown", onPointerDown)
            dragTarget.removeEventListener("pointerup", onPointerUp)
            dragTarget.removeEventListener("pointercancel", onPointerUp)
        }
        dragTarget = el || null
        if (dragTarget) {
            dragTarget.addEventListener("pointerdown", onPointerDown)
            dragTarget.addEventListener("pointerup", onPointerUp)
            dragTarget.addEventListener("pointercancel", onPointerUp)
        }
    }
    if (opts.interactive) {
        bindDragTarget(opts.dragTarget)
        window.addEventListener("pointermove", onPointerMove, { passive: true })
        window.addEventListener("pointerup", onPointerUp)
        document.documentElement.addEventListener("pointerleave", onLeave)
    }

    // ---- 관찰자 ----
    const ro = new ResizeObserver(() => resize(false))
    ro.observe(canvas)

    let io = null
    if ("IntersectionObserver" in window) {
        io = new IntersectionObserver((records) => {
            const rec = records[records.length - 1]
            inView = rec.isIntersecting
            sync()
        })
        io.observe(canvas)
    }
    function onVisibility() {
        docVisible = !document.hidden
        sync()
    }
    document.addEventListener("visibilitychange", onVisibility)

    function onContextLost(e) {
        e.preventDefault()
        lost = true
        stopLoop()
        if (typeof opts.onFail === "function") opts.onFail("context-lost")
    }
    canvas.addEventListener("webglcontextlost", onContextLost)

    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)

    if (opts.shape === "Logo") bakeLogo()
    resize(true)
    if (typeof opts.plate !== "function") loadPlate()
    sync()

    return {
        play() { playing = true; sync() },
        pause() { playing = false; tiltTargetX = 0; tiltTargetY = 0; sync() },
        get playing() { return playing },
        get animating() { return animating() },
        setReduced(value) {
            opts.reduced = !!value
            if (opts.reduced) { dragging = false; tiltX = tiltY = tiltTargetX = tiltTargetY = 0 }
            sync()
        },
        setOptions(patch) {
            const prevShape = opts.shape
            const prevLogo = opts.logo
            opts = mergeOptions(opts, patch || {})
            if (opts.shape === "Logo" && (prevShape !== "Logo" || prevLogo !== opts.logo)) bakeLogo()
            resize(true)
        },
        bindDragTarget,
        iconRect,
        renderOnce() { invalidate() },
        destroy() {
            destroyed = true
            stopLoop()
            if (pending) cancelAnimationFrame(pending)
            sdfToken++
            plateToken++
            ro.disconnect()
            if (io) io.disconnect()
            bindDragTarget(null)
            document.removeEventListener("visibilitychange", onVisibility)
            canvas.removeEventListener("webglcontextlost", onContextLost)
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("pointerup", onPointerUp)
            document.documentElement.removeEventListener("pointerleave", onLeave)
        },
    }
}

global.CodeeGlassIcon = { createGlassIcon: createGlassIcon }
})(typeof window !== "undefined" ? window : this);
