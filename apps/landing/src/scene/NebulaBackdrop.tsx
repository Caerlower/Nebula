import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { Q } from '../lib/device'
import { STORY, range, smooth01, spike } from '../lib/story'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform float uEnergy;
uniform float uOctaves;
uniform vec3 uViolet;
uniform vec3 uBlue;
uniform vec3 uTeal;
uniform vec3 uHorizon;

float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3(0., 0., 0.)), hash3(i + vec3(1., 0., 0.)), u.x),
        mix(hash3(i + vec3(0., 1., 0.)), hash3(i + vec3(1., 1., 0.)), u.x), u.y),
    mix(mix(hash3(i + vec3(0., 0., 1.)), hash3(i + vec3(1., 0., 1.)), u.x),
        mix(hash3(i + vec3(0., 1., 1.)), hash3(i + vec3(1., 1., 1.)), u.x), u.y),
    u.z);
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= uOctaves) break;
    v += a * noise3(p);
    p = p * 2.03 + vec3(7.7, 3.1, 11.3);
    a *= 0.55;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float t = uTime * 0.015;

  float warp = fbm3(d * 2.2 + vec3(t, -t * 0.6, t * 0.35));
  float n = fbm3(d * 3.1 + warp * 1.5);
  float wisps = smoothstep(0.32, 0.85, n);

  float g1 = pow(max(dot(d, normalize(vec3(-0.55, 0.28, -0.55))), 0.0), 3.0);
  float g2 = pow(max(dot(d, normalize(vec3(0.70, 0.08, -0.35))), 0.0), 4.0);
  float g3 = pow(max(dot(d, normalize(vec3(0.05, 0.75, -0.30))), 0.0), 5.0);

  vec3 col = vec3(0.0);
  col += uViolet * g1 * (0.35 + 1.15 * n);
  col += uBlue   * g2 * (0.30 + 0.95 * fbm3(d * 4.2 - warp));
  col += uTeal   * g3 * (0.25 + 0.85 * n);
  col *= (0.55 + 0.5 * wisps);

  float horizonBand = smoothstep(-0.05, 0.22, d.y) * (1.0 - smoothstep(0.22, 0.55, d.y));
  col += uHorizon * horizonBand * 0.55;

  col += vec3(0.012, 0.014, 0.030) * smoothstep(-0.2, 0.7, d.y);
  col *= uEnergy;
  col *= smoothstep(-0.4, 0.08, d.y) * 0.92 + 0.08;
  col += (hash3(vec3(gl_FragCoord.xy, 1.0)) - 0.5) * (2.0 / 255.0);

  gl_FragColor = vec4(col, 1.0);
}
`

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export function NebulaBackdrop() {
  const { theme } = useTheme()

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0.55 },
        uOctaves: { value: Q.noiseOctaves },
        uViolet: { value: new THREE.Color(theme.nebulaViolet) },
        uBlue: { value: new THREE.Color(theme.nebulaBlue) },
        uTeal: { value: new THREE.Color(theme.nebulaTeal) },
        uHorizon: { value: new THREE.Color(theme.nebulaHorizon) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
    })
    return mat
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; uniforms tween on toggle
  }, [])

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    tl.add(tweenThreeColor(material.uniforms.uViolet.value, next.nebulaViolet), 0)
    tl.add(tweenThreeColor(material.uniforms.uBlue.value, next.nebulaBlue), 0)
    tl.add(tweenThreeColor(material.uniforms.uTeal.value, next.nebulaTeal), 0)
    tl.add(tweenThreeColor(material.uniforms.uHorizon.value, next.nebulaHorizon), 0)
    return () => tl.kill()
  })

  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    const p = STORY.smooth
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uEnergy.value =
      0.55 + spike(p, 0.44, 0.52, 0.78) * 0.95 + smooth01(range(p, 0.78, 1)) * 0.4
  })

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[75, 48, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
