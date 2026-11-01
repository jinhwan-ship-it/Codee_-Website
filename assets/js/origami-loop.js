/*!
 * Origami Loop — Originkit / port of d3adrabbit/origami (Codrops)
 * 상수 · 행렬 · 상자 · 셰이더 · 그리기 순서는 원본 React/TSX에서
 * TypeScript 타입만 지워 그대로 옮겼다. React 부분은 아래 mount()로 바꿨다 — 열 때마다 새 캔버스, 닫을 때 destroy().
 */
;(function (global) {
"use strict";

/* --------------------------------------------------------------- constants */

const TAU = Math.PI * 2
const DPR_CAP = 2
/** Vertical field of view. Framing is the Distance dial's job, not this. */
const FOV = (45 * Math.PI) / 180
const NEAR = 0.1
const FAR = 200

/** The reference's ring radius, its group scale and its plate dimensions. */
const RADIUS = 3
const GROUP_SCALE = 0.6
const PLATE_W = 1
const PLATE_H = 0.2
const PLATE_D = 1

/** Reference rates, in radians per second: one plate turn every 6s, one band
 *  turn every 24s. */
const SPIN_RATE = TAU / 6
const BAND_RATE = TAU / 24

/* ------------------------------------------------------------------ colour */

function parseColor(input, fb) {
    if (!input) return fb
    let s = String(input).trim()
    const v = /^var\(\s*--[^,]+,\s*(.+)\)\s*$/i.exec(s)
    if (v) s = v[1].trim()

    if (s.charAt(0) === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4) {
            h =
                h.charAt(0) + h.charAt(0) +
                h.charAt(1) + h.charAt(1) +
                h.charAt(2) + h.charAt(2)
        }
        if (h.length < 6) return fb
        const n = parseInt(h.slice(0, 6), 16)
        if (!isFinite(n)) return fb
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    }

    const m = /^(rgba?|hsla?)\(([^)]+)\)\s*$/i.exec(s)
    if (!m) return fb
    const parts = m[2].split(/[\s,/]+/).filter((x) => x.length > 0)
    if (parts.length < 3) return fb

    if (m[1].charAt(0).toLowerCase() === "r") {
        const ch = (t) =>
            t.indexOf("%") >= 0 ? (parseFloat(t) / 100) * 255 : parseFloat(t)
        const r = ch(parts[0]), g = ch(parts[1]), b = ch(parts[2])
        if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return fb
        return [r / 255, g / 255, b / 255]
    }

    // hsl() / hsla(). The hue may carry a deg / rad / turn unit.
    let hue = parseFloat(parts[0])
    if (parts[0].indexOf("turn") >= 0) hue *= 360
    else if (parts[0].indexOf("rad") >= 0) hue *= 180 / Math.PI
    const sat = parseFloat(parts[1]) / 100
    const lit = parseFloat(parts[2]) / 100
    if (!isFinite(hue) || !isFinite(sat) || !isFinite(lit)) return fb
    const c = (1 - Math.abs(2 * lit - 1)) * sat
    const hp = (((hue % 360) + 360) % 360) / 60
    const x = c * (1 - Math.abs((hp % 2) - 1))
    let r = 0, g = 0, b = 0
    if (hp < 1) { r = c; g = x } else if (hp < 2) { r = x; g = c }
    else if (hp < 3) { g = c; b = x } else if (hp < 4) { g = x; b = c }
    else if (hp < 5) { r = x; b = c } else { r = c; b = x }
    const mm = lit - c / 2
    return [r + mm, g + mm, b + mm]
}

/* -------------------------------------------------------------------- mat4 */

/** Column-major, GL order — the same layout three.js uploads. */
function m4() {
    const o = new Float32Array(16)
    o[0] = o[5] = o[10] = o[15] = 1
    return o
}

function m4Ident(o) {
    o.fill(0)
    o[0] = o[5] = o[10] = o[15] = 1
    return o
}

/** out = a * b. `out` must not alias either input. */
function m4Mul(a, b, out) {
    for (let c = 0; c < 4; c++) {
        const b0 = b[c * 4], b1 = b[c * 4 + 1]
        const b2 = b[c * 4 + 2], b3 = b[c * 4 + 3]
        out[c * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3
        out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3
        out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3
        out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3
    }
    return out
}

const SCR_A = m4()
const SCR_B = m4()

/* Every transform below POST-multiplies (m := m * R), so a chain of calls
 * reads outermost parent first, exactly like walking a three.js scene graph
 * downwards. */

function rotX(m, a) {
    if (a === 0) return
    const c = Math.cos(a), s = Math.sin(a)
    m4Ident(SCR_A)
    SCR_A[5] = c; SCR_A[6] = s; SCR_A[9] = -s; SCR_A[10] = c
    m.set(m4Mul(m, SCR_A, SCR_B))
}

function rotY(m, a) {
    if (a === 0) return
    const c = Math.cos(a), s = Math.sin(a)
    m4Ident(SCR_A)
    SCR_A[0] = c; SCR_A[2] = -s; SCR_A[8] = s; SCR_A[10] = c
    m.set(m4Mul(m, SCR_A, SCR_B))
}

function rotZ(m, a) {
    if (a === 0) return
    const c = Math.cos(a), s = Math.sin(a)
    m4Ident(SCR_A)
    SCR_A[0] = c; SCR_A[1] = s; SCR_A[4] = -s; SCR_A[5] = c
    m.set(m4Mul(m, SCR_A, SCR_B))
}

/** m := m * T(x, y, z) */
function trans(m, x, y, z) {
    m[12] = m[0] * x + m[4] * y + m[8]  * z + m[12]
    m[13] = m[1] * x + m[5] * y + m[9]  * z + m[13]
    m[14] = m[2] * x + m[6] * y + m[10] * z + m[14]
    m[15] = m[3] * x + m[7] * y + m[11] * z + m[15]
}

/** m := m * S(s). Uniform only. */
function scaleU(m, s) {
    for (let i = 0; i < 12; i++) m[i] *= s
}

function persp(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2)
    out.fill(0)
    out[0] = f / aspect
    out[5] = f
    out[10] = (far + near) / (near - far)
    out[11] = -1
    out[14] = (2 * far * near) / (near - far)
    return out
}

/** Upper-left 3x3 of the model matrix (the view is a pure translation). */
function nm3(m, out) {
    out[0] = m[0]; out[1] = m[1]; out[2] = m[2]
    out[3] = m[4]; out[4] = m[5]; out[5] = m[6]
    out[6] = m[8]; out[7] = m[9]; out[8] = m[10]
}

/* ---------------------------------------------------------------- geometry */

function pack(pos, nrm, idx) {
    return {
        pos: new Float32Array(pos),
        nrm: new Float32Array(nrm),
        idx: new Uint16Array(idx),
    }
}

/** three.js BoxGeometry(w, h, d) — 6 flat-shaded quads. */
function boxGeo(w, h, d) {
    const pos = [], nrm = [], idx = []
    // normal, then the 4 corners CCW seen from outside, on the unit cube.
    const faces = [
        [ 1, 0, 0,   0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5],
        [-1, 0, 0,  -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5],
        [ 0, 1, 0,  -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5],
        [ 0,-1, 0,  -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5],
        [ 0, 0, 1,  -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5],
        [ 0, 0,-1,   0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5],
    ]
    for (let f = 0; f < faces.length; f++) {
        const q = faces[f]
        const base = f * 4
        for (let k = 0; k < 4; k++) {
            pos.push(q[3 + k * 3] * w, q[4 + k * 3] * h, q[5 + k * 3] * d)
            nrm.push(q[0], q[1], q[2])
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    return pack(pos, nrm, idx)
}

/* ----------------------------------------------------------------- shaders */

const VERT = `
precision highp float;

attribute vec3 aPos;
attribute vec3 aNrm;

uniform mat4 uMVP;
uniform mat3 uNM;

varying vec3 vN;

void main() {
    vN = uNM * aNrm;
    gl_Position = uMVP * vec4(aPos, 1.0);
}
`

/** A procedural matcap — KEY / FILL fitted from the reference's chrome matcap. */
const FRAG = `
precision highp float;

varying vec3 vN;

uniform vec3 uBase;
uniform vec3 uAcc;

// Fitted highlight directions of the reference's chrome matcap.
const vec3 KEY  = vec3(-0.4364, 0.4601, 0.7733);
const vec3 FILL = vec3( 0.7831, 0.1309, 0.6080);

void main() {
    vec3 n = normalize(vN);
    float k = max(dot(n, KEY), 0.0);
    float f = max(dot(n, FILL), 0.0);
    // Facing ratio: 1 at the silhouette, 0 dead-on. abs() so a back face that
    // wins the depth test through an opening still rims instead of going flat.
    float graze = 1.0 - clamp(abs(n.z), 0.0, 1.0);

    vec3 c = uBase * (0.08 + 0.62 * pow(k, 2.0));
    c += uAcc * 0.80 * pow(k, 9.0);
    c += uAcc * 0.35 * pow(f, 6.0);
    // The matcap's bright top edge: grazing, and weighted upwards.
    c += uAcc * 0.32 * pow(graze, 3.0) * (0.40 + 0.60 * max(n.y, 0.0));

    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`

/* ---------------------------------------------------------------- GL plumbing */

function compile(gl, type, src) {
    const sh = gl.createShader(type)
    if (!sh) return null
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("shader: " + gl.getShaderInfoLog(sh))
        gl.deleteShader(sh)
        return null
    }
    return sh
}

function buildProgram(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return null
    const p = gl.createProgram()
    if (!p) return null
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.linkProgram(p)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error("link: " + gl.getProgramInfoLog(p))
        return null
    }
    return p
}

function upload(gl, g) {
    const pos = gl.createBuffer(), nrm = gl.createBuffer(), idx = gl.createBuffer()
    if (!pos || !nrm || !idx) return null
    gl.bindBuffer(gl.ARRAY_BUFFER, pos)
    gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, nrm)
    gl.bufferData(gl.ARRAY_BUFFER, g.nrm, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW)
    return { pos, nrm, idx, count: g.idx.length }
}

function freeMesh(gl, m) {
    gl.deleteBuffer(m.pos)
    gl.deleteBuffer(m.nrm)
    gl.deleteBuffer(m.idx)
}

function bindMesh(gl, m, aPos, aNrm) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos)
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nrm)
    gl.vertexAttribPointer(aNrm, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx)
}

/* ------------------------------------------------------------------ values */

const LOOP_DEFAULTS = {
    count: 20,
    plateSize: 100,
    spread: 100,
    ringSpeed: 50,
}

// Originkit preset(loop) + 컴포넌트 기본값(speed · 색) 그대로. 배경은 투명 — 뒤 딤이 보인다
const PRESET = {
    baseColor: "#FFFFFF",
    accentColor: "#FFFFFF",
    speed: 50,
    loop: { count: 40, spread: 114, plateSize: 79, ringSpeed: 81 },
}

// 정지 프레임(동작 줄이기 · 첫 화면 정지 설정) 한 장의 위상 — 판이 비스듬히 서서 고리가 또렷한 자리
const STILL_SPIN = TAU / 8
const STILL_BAND = 0

/* ---------------------------------------------------------------- Codee 바닐라 런타임 */

// mount(host, { distance, still }) → { destroy } · WebGL을 못 만들거나 셰이더가 실패하면 null
function mount(host, options) {
    const o = options || {}
    const P = {
        base: parseColor(PRESET.baseColor, [0.56, 0.6, 0.65]),
        acc: parseColor(PRESET.accentColor, [1, 1, 1]),
        speed: PRESET.speed,
        distance: typeof o.distance === "number" ? o.distance : 20,
        loop: Object.assign({}, LOOP_DEFAULTS, PRESET.loop),
    }
    const still = !!o.still

    const canvas = document.createElement("canvas")
    canvas.setAttribute("aria-hidden", "true")
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"
    host.appendChild(canvas)

    const fail = () => { canvas.remove(); return null }

    const gl = canvas.getContext("webgl", {
        antialias: true,
        alpha: true,
        premultipliedAlpha: true,
        depth: true,
    })
    if (!gl) return fail()

    const lose = () => {
        const ext = gl.getExtension("WEBGL_lose_context")
        if (ext) ext.loseContext()
    }

    const prog = buildProgram(gl)
    if (!prog) { lose(); return fail() }
    gl.useProgram(prog)

    const aPos = gl.getAttribLocation(prog, "aPos")
    const aNrm = gl.getAttribLocation(prog, "aNrm")
    gl.enableVertexAttribArray(aPos)
    gl.enableVertexAttribArray(aNrm)

    const uMVP = gl.getUniformLocation(prog, "uMVP")
    const uNM = gl.getUniformLocation(prog, "uNM")
    const uBase = gl.getUniformLocation(prog, "uBase")
    const uAcc = gl.getUniformLocation(prog, "uAcc")
    if (!uMVP || !uNM || !uBase || !uAcc) {
        console.error("OrigamiLoop: uniform location missing")
        gl.deleteProgram(prog)
        lose()
        return fail()
    }

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.clearColor(0, 0, 0, 0)

    const plate = upload(gl, boxGeo(PLATE_W, PLATE_H, PLATE_D))
    if (!plate) { gl.deleteProgram(prog); lose(); return fail() }

    /* ---- sizing ---- */
    let cssW = 0, cssH = 0, dpr = 1
    const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
        cssW = canvas.clientWidth || host.clientWidth || 0
        cssH = canvas.clientHeight || host.clientHeight || 0
        const w = Math.max(1, Math.round(cssW * dpr))
        const h = Math.max(1, Math.round(cssH * dpr))
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
        }
        gl.viewport(0, 0, w, h)
    }

    /* ---- drawing ---- */
    const proj = m4(), view = m4(), pv = m4(), model = m4(), mvp = m4()
    const nrmMat = new Float32Array(9)
    let raf = 0
    let last = performance.now()
    let spinPhase = still ? STILL_SPIN : 0
    let bandPhase = still ? STILL_BAND : 0

    const draw = () => {
        const count = Math.max(1, Math.round(P.loop.count))
        const plateScale = P.loop.plateSize / 100
        const radius = RADIUS * (P.loop.spread / 100)

        const w = canvas.width, h = canvas.height
        const aspect = w / h
        persp(proj, FOV, aspect, NEAR, FAR)
        // Fit against the SHORT edge: a portrait host would otherwise crop
        // the band horizontally, since the field of view is vertical.
        const dist = P.distance / Math.min(1, aspect)
        m4Ident(view)
        trans(view, 0, 0, -dist)
        m4Mul(proj, view, pv)

        gl.uniform3fv(uBase, P.base)
        gl.uniform3fv(uAcc, P.acc)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        bindMesh(gl, plate, aPos, aNrm)
        for (let i = 0; i < count; i++) {
            const a = (i / count) * TAU
            m4Ident(model)
            // Outer group: Rz(band) * S(0.6).
            rotZ(model, bandPhase)
            scaleU(model, GROUP_SCALE)
            // Per-plate group: T(ring position) * Rz(a).
            trans(model, Math.cos(a) * radius, Math.sin(a) * radius, 0)
            rotZ(model, a)
            // The instance's own tween.
            rotY(model, spinPhase)
            scaleU(model, plateScale)
            m4Mul(pv, model, mvp)
            nm3(model, nrmMat)
            gl.uniformMatrix4fv(uMVP, false, mvp)
            gl.uniformMatrix3fv(uNM, false, nrmMat)
            gl.drawElements(gl.TRIANGLES, plate.count, gl.UNSIGNED_SHORT, 0)
        }
    }

    const frame = (now) => {
        raf = requestAnimationFrame(frame)
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
        last = now
        // 50 is the rate each shipped at; 0 stops that motion alone.
        spinPhase = (spinPhase + dt * SPIN_RATE * (P.speed / 50)) % TAU
        bandPhase = (bandPhase + dt * BAND_RATE * (P.loop.ringSpeed / 50)) % TAU
        draw()
    }

    resize()
    const ro = new ResizeObserver(() => { resize(); if (still) draw() })
    ro.observe(canvas)
    if (still) draw()
    else raf = requestAnimationFrame(frame)

    let destroyed = false
    return {
        destroy() {
            if (destroyed) return
            destroyed = true
            cancelAnimationFrame(raf)
            ro.disconnect()
            freeMesh(gl, plate)
            gl.deleteProgram(prog)
            // 열 때마다 새 캔버스라 컨텍스트를 바로 돌려준다(원본의 "loseContext 안 씀"은 React StrictMode 때문)
            lose()
            canvas.remove()
        },
    }
}

global.CodeeOrigamiLoop = { mount: mount }
})(typeof window !== "undefined" ? window : this);
