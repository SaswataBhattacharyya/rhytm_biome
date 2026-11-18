/** GLSL ES 3.00 shaders for the microscope island. */

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Static warm field — low-frequency value noise, no time term (no boiling). */
export const BACKGROUND_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 uRes;
uniform vec3 uA;
uniform vec3 uB;
uniform float uScale;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.0), f.x), f.y);
}
void main() {
  vec2 px = vUv * uRes;
  float n = vn(px / uScale) * 0.6 + vn(px / (uScale * 0.37) + 7.3) * 0.4;
  vec3 c = mix(uA, uB, smoothstep(0.25, 0.85, n) * 0.55);
  o = vec4(c, 1.0);
}`;

export const ORGANISM_VS = /* glsl */ `#version 300 es
in vec2 aPos;
in vec2 aNormal;
in float aT;
in float aEdge;
in float aSide;
in vec2 aCentroid;
in float aStrandPhase;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uAngle;
uniform float uScale;
uniform float uMode;
// Appendages: integrated beat phase (CPU) and amplitude multiplier.
uniform float uBeatPhase;
uniform float uBeatAmp;
// WRIGGLE-01 / pulse deformation, all in body-local space.
uniform vec2 uBend;      // x: +x half end angle, y: -x half end angle
uniform float uStretch;  // +x end reach
uniform float uRock;     // both halves together
uniform vec2 uSquish;    // near-round: x squash/stretch, y one-sided pull
uniform float uHalf;     // body half-length along local x
uniform float uRound;    // 1 for near-round morphology
out float vEdge;
out float vSide;
out float vT;
out vec2 vRel;

// Midpoint-anchored bend: opposite halves rotate in opposite senses so both
// free ends swing to the same side; deformation is a smooth odd function of
// the axial coordinate, so outline, interior and appendage roots move as one.
vec2 deform(vec2 p) {
  if (uRound > 0.5) {
    float pull = uSquish.y * max(p.x, 0.0);
    return vec2(p.x * (1.0 + uSquish.x) + pull, p.y * (1.0 - uSquish.x * 0.6));
  }
  float u = clamp(p.x / uHalf, -1.6, 1.6);
  float bend = u >= 0.0 ? uBend.x : uBend.y;
  float a = bend * u * (0.55 + 0.45 * abs(u));
  vec2 q = vec2(p.x * (1.0 + uStretch * max(u, 0.0)), p.y);
  float c = cos(a), s = sin(a);
  return vec2(c * q.x - s * q.y, s * q.x + c * q.y);
}

void main() {
  vec2 p = aPos;
  if (aT >= 0.0) {
    // Each appendage flexes on its own phase; roots (t = 0) never move.
    float w = sin(uBeatPhase + aT * 5.5 + aStrandPhase) * aT * uBeatAmp;
    p += aNormal * w;
  }
  vRel = aPos - aCentroid;
  if (uMode < 1.5) p = deform(p);
  p *= uScale;
  float ang = uAngle + uRock;
  float c = cos(ang), s = sin(ang);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec2 dev = uCenter + p;
  gl_Position = vec4(dev.x / uRes.x * 2.0 - 1.0, 1.0 - dev.y / uRes.y * 2.0, 0.0, 1.0);
  vEdge = aEdge;
  vSide = aSide;
  vT = aT;
}`;

export const ORGANISM_FS = /* glsl */ `#version 300 es
precision highp float;
in float vEdge;
in float vSide;
in float vT;
in vec2 vRel;
out vec4 o;
uniform vec3 uColor;
uniform vec3 uRim;
uniform float uSoft;
uniform float uAlpha;
uniform float uMode;
uniform float uDetail;
uniform float uPhase;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  if (uMode < 0.5) {
    // Envelope: a defined outer band; interior becomes translucent with detail.
    float rim = smoothstep(0.80 - uSoft * 0.4, 0.93, vEdge);
    vec3 body = uColor * (1.06 - 0.12 * vEdge);
    float interiorAlpha = mix(1.0, 0.5, uDetail);
    float a = mix(interiorAlpha, 1.0, smoothstep(0.62, 0.86, vEdge));
    // Second, faint inner membrane line (illustrative double envelope).
    float inner = (1.0 - smoothstep(0.0, 0.035, abs(vEdge - 0.74))) * uDetail * 0.55;
    // Nucleoid-like tangled loop: illustrative, not anatomical. Lives in body
    // space so it stays coherent while the body rotates or wriggles.
    float th = atan(vRel.y, vRel.x);
    float band = 0.30 + 0.10 * sin(3.0 * th + uPhase) + 0.05 * sin(7.0 * th - uPhase * 1.3);
    float loop1 = 1.0 - smoothstep(0.0, 0.045, abs(vEdge - band));
    float band2 = 0.22 + 0.07 * sin(4.0 * th - uPhase * 0.7 + 1.7);
    float loop2 = 1.0 - smoothstep(0.0, 0.035, abs(vEdge - band2));
    float nucleoid = max(loop1, loop2 * 0.8) * (1.0 - smoothstep(0.5, 0.62, vEdge)) * uDetail;
    // Small granules scattered in the cytoplasm-like interior.
    vec2 g = floor(vRel / 3.2);
    float h = hash(g + uPhase);
    vec2 f = fract(vRel / 3.2) - 0.5;
    float gran = step(0.86, h) * (1.0 - smoothstep(0.12, 0.26, length(f))) * (1.0 - smoothstep(0.55, 0.7, vEdge)) * uDetail;
    vec3 ink = mix(uRim, uColor * 0.55, 0.35);
    vec3 col = mix(body, uRim, rim * 0.85);
    col = mix(col, uRim, inner);
    col = mix(col, ink, nucleoid * 0.75);
    col = mix(col, ink, gran * 0.6);
    a = max(a, max(nucleoid * 0.9, inner));
    float edgeAA = 1.0 - smoothstep(0.94 - uSoft * 0.28, 1.0, vEdge);
    o = vec4(col, a * edgeAA * uAlpha);
  } else if (uMode < 1.5) {
    float a = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
    a *= mix(1.0, 0.7, vT) * (1.0 - uSoft * 0.45);
    o = vec4(uRim, a * uAlpha * 0.95);
  } else if (uMode < 2.5) {
    float g = 1.0 - clamp(vEdge, 0.0, 1.0);
    o = vec4(uColor, g * g * 0.18 * uAlpha);
  } else {
    // Solid soft-edged dot (encounter link bead).
    float a = 1.0 - smoothstep(0.7, 1.0, vEdge);
    o = vec4(uColor, a * uAlpha);
  }
}`;

/** 9-tap tent blur used for downsampling and the soft outside field. */
export const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D t;
uniform vec2 uTexel;
uniform float uSpread;
void main() {
  vec3 s = vec3(0.0);
  float wsum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float w = (x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0);
      s += texture(t, vUv + vec2(float(x), float(y)) * uTexel * uSpread).rgb * w;
      wsum += w;
    }
  }
  o = vec4(s / wsum, 1.0);
}`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D tSharp;
uniform sampler2D tSoft;
uniform vec2 uRes;
uniform vec2 uC;
uniform float uR;
uniform float uRimW;
uniform float uSheen;
uniform float uRefract;
uniform float uOutside;
uniform float uRimA;
uniform float uHandleA;
uniform float uDpr;
uniform vec3 uTint;
uniform vec3 uMetal;
uniform vec3 uMetalHi;
uniform vec3 uShadow;
uniform float uPassage;
uniform float uPassagePhase;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec2 toUv(vec2 px) { return vec2(px.x / uRes.x, 1.0 - px.y / uRes.y); }

void main() {
  vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
  vec2 dv = px - uC;
  float d = length(dv);
  vec2 dir = d > 0.0 ? dv / d : vec2(0.0);
  float aa = 1.5 * uDpr;
  float inside = 1.0 - smoothstep(uR - aa, uR, d);

  // Edge refraction: gentle compression toward the centre plus slight dispersion.
  float k = smoothstep(uR * 0.70, uR, d) * uRefract;
  vec2 off = -dir * k * 10.0 * uDpr;
  vec2 disp = dir * k * 1.2 * uDpr;
  // Passage through the glass: one restrained radial ripple travelling outward.
  vec2 vc = uRes * 0.5;
  vec2 vd = px - vc;
  float vl = length(vd);
  vec2 vdir = vl > 0.0 ? vd / vl : vec2(0.0);
  float front = uPassagePhase * length(vc) * 1.15;
  float ripple = exp(-pow((vl - front) / (90.0 * uDpr), 2.0)) * uPassage;
  off += vdir * ripple * 7.0 * uDpr;
  vec3 sharp;
  sharp.r = texture(tSharp, toUv(px + off + disp)).r;
  sharp.g = texture(tSharp, toUv(px + off)).g;
  sharp.b = texture(tSharp, toUv(px + off - disp)).b;

  vec3 plain = texture(tSharp, vUv).rgb;
  vec3 soft = texture(tSoft, vUv).rgb;
  float grain = (hash(floor(px / (1.5 * uDpr))) - 0.5) * 0.022;
  vec3 blurred = mix(soft, uTint, 0.28) + grain;
  vec3 outsideCol = mix(plain, blurred, uOutside);
  vec3 col = mix(outsideCol, sharp, inside);
  // Brief soften-and-clear while crossing, plus a faint lift of light.
  vec3 softNow = texture(tSoft, toUv(px + off)).rgb;
  col = mix(col, softNow, uPassage * 0.28);
  col += vec3(0.035) * uPassage;

  // Restrained depth near the inner rim.
  col *= 1.0 - 0.10 * smoothstep(uR * 0.82, uR, d) * inside * uRimA;

  // Sheen: soft elliptical highlight + thin crescent.
  vec2 sp = px - (uC + vec2(-0.32, -0.38) * uR);
  float ca = cos(0.5), sa = sin(0.5);
  sp = vec2(ca * sp.x - sa * sp.y, sa * sp.x + ca * sp.y);
  float se = length(sp / vec2(0.5 * uR, 0.22 * uR));
  float sheen = (1.0 - smoothstep(0.2, 1.0, se)) * 0.13 * uSheen * inside;
  float ang = dot(dir, normalize(vec2(-0.7, -0.7)));
  float cres = smoothstep(0.55, 1.0, ang) * smoothstep(uR * 0.86, uR * 0.93, d) * (1.0 - smoothstep(uR * 0.95, uR * 0.99, d)) * 0.32 * uSheen * inside;
  col += vec3(sheen + cres);

  // Soft contact shadow outside the rim.
  float sh = (1.0 - smoothstep(uR + uRimW, uR + uRimW + 18.0 * uDpr, d)) * (1.0 - inside) * 0.16 * uRimA;
  col = mix(col, uShadow, sh);

  // Handle: leaves the frame as the aperture grows; fades by p≈0.4.
  vec2 hd = normalize(vec2(0.70, 0.72));
  vec2 hp = px - (uC + hd * (uR + uRimW * 0.5 + uR * 0.42));
  vec2 q = vec2(dot(hp, hd), dot(hp, vec2(-hd.y, hd.x)));
  float hb = sdBox(q, vec2(uR * 0.42, uR * 0.085), uR * 0.06);
  float ha = (1.0 - smoothstep(-aa, 0.0, hb)) * uHandleA * (1.0 - inside);
  float hs = 0.82 + 0.22 * clamp(-q.y / (uR * 0.085), -1.0, 1.0);
  col = mix(col, uMetal * hs, ha);

  // Narrow metal rim.
  float ring = smoothstep(uR - aa, uR, d) * (1.0 - smoothstep(uR + uRimW - aa, uR + uRimW, d));
  float lit = 0.5 + 0.5 * dot(dir, normalize(vec2(-0.6, -0.8)));
  float bandT = clamp((d - uR) / uRimW, 0.0, 1.0);
  vec3 metal = mix(uMetal, uMetalHi, lit * 0.65 + 0.35 * (1.0 - abs(bandT * 2.0 - 1.0)));
  col = mix(col, metal, ring * uRimA);

  o = vec4(col, 1.0);
}`;
