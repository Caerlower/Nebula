import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { glowTexture } from '../lib/glow'
import { Q } from '../lib/device'
import { STORY, range, smooth01, lerp, easeOutCubic, spike } from '../lib/story'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

export function Agent() {
  const { theme } = useTheme()
  const root = useRef<THREE.Group>(null)
  const pose = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const poolMat = useRef<THREE.MeshBasicMaterial>(null)

  const palette = useRef({
    dimBody: new THREE.Color(theme.agentDim),
    dimEmissive: new THREE.Color(theme.agentEmissiveDim),
    litBody: new THREE.Color(theme.agentLit),
    litHead: new THREE.Color(theme.agentHeadLit),
    litEmissiveBody: new THREE.Color(theme.agentEmissiveLit),
    litEmissiveHead: new THREE.Color(theme.agentEmissiveHeadLit),
    coreDim: new THREE.Color(theme.coreDim),
    coreWarm: new THREE.Color(theme.coreWarm),
    coreLit: new THREE.Color(theme.coreLit),
    visorDim: new THREE.Color(theme.visorDim),
    visorLit: new THREE.Color(theme.visorLit),
    warm: new THREE.Color(theme.agentWarm),
  }).current

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({
        color: palette.dimBody.clone(),
        emissive: palette.dimEmissive.clone(),
        emissiveIntensity: 0.25,
        roughness: 0.4,
        metalness: 0.15,
        flatShading: true,
      }),
      head: new THREE.MeshStandardMaterial({
        color: palette.dimBody.clone(),
        emissive: palette.dimEmissive.clone(),
        emissiveIntensity: 0.3,
        roughness: 0.35,
        metalness: 0.15,
        flatShading: true,
      }),
      core: new THREE.MeshStandardMaterial({
        color: theme.agentSocket,
        emissive: palette.coreDim.clone(),
        emissiveIntensity: 0.5,
        roughness: 0.3,
      }),
      visor: new THREE.MeshStandardMaterial({
        color: theme.agentSocket,
        emissive: palette.visorDim.clone(),
        emissiveIntensity: 0.6,
        roughness: 0.25,
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const aura = useMemo(() => {
    const n = Q.aura
    const positions = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 0.55 + Math.random() * 0.5
      const theta = Math.random() * Math.PI * 2
      positions[i * 3] = Math.cos(theta) * r
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.6
      positions[i * 3 + 2] = Math.sin(theta) * r
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.035,
      map: glowTexture(),
      color: theme.agentAura,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    return new THREE.Points(geo, mat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    tl.add(tweenThreeColor(palette.dimBody, next.agentDim), 0)
    tl.add(tweenThreeColor(palette.dimEmissive, next.agentEmissiveDim), 0)
    tl.add(tweenThreeColor(palette.litBody, next.agentLit), 0)
    tl.add(tweenThreeColor(palette.litHead, next.agentHeadLit), 0)
    tl.add(tweenThreeColor(palette.litEmissiveBody, next.agentEmissiveLit), 0)
    tl.add(tweenThreeColor(palette.litEmissiveHead, next.agentEmissiveHeadLit), 0)
    tl.add(tweenThreeColor(palette.coreDim, next.coreDim), 0)
    tl.add(tweenThreeColor(palette.coreWarm, next.coreWarm), 0)
    tl.add(tweenThreeColor(palette.coreLit, next.coreLit), 0)
    tl.add(tweenThreeColor(palette.visorDim, next.visorDim), 0)
    tl.add(tweenThreeColor(palette.visorLit, next.visorLit), 0)
    tl.add(tweenThreeColor(palette.warm, next.agentWarm), 0)
    tl.add(tweenThreeColor((aura.material as THREE.PointsMaterial).color, next.agentAura, 0.6), 0)
    if (poolMat.current) tl.add(tweenThreeColor(poolMat.current.color, next.agentPool, 0.6), 0)
    if (light.current) tl.add(tweenThreeColor(light.current.color, next.agentWarm, 0.6), 0)
    return () => tl.kill()
  })

  useEffect(
    () => () => {
      aura.geometry.dispose()
      ;(aura.material as THREE.Material).dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [aura, mats],
  )

  useFrame(({ clock }) => {
    const p = STORY.smooth
    const t = clock.elapsedTime

    const power = easeOutCubic(range(p, 0.5, 0.64))
    const stand = smooth01(range(p, 0.52, 0.68))
    const ignite = spike(p, 0.49, 0.53, 0.8)

    if (root.current) {
      const breathe = (1 - power) * Math.sin(t * 1.1) * 0.012
      const float = power * Math.sin(t * 1.5) * 0.035
      root.current.position.y = lerp(0.2, 0.52, stand) + breathe + float
      root.current.scale.setScalar(lerp(0.9, 1.05, stand))
    }
    if (pose.current) {
      pose.current.rotation.x = lerp(0.62, 0, stand)
      pose.current.rotation.y = Math.sin(t * 0.4) * 0.05 * power
    }

    mats.body.color.lerpColors(palette.dimBody, palette.litBody, power)
    mats.body.emissive.lerpColors(palette.dimEmissive, palette.litEmissiveBody, power)
    mats.body.emissiveIntensity = lerp(0.25, 2.1, power)

    mats.head.color.lerpColors(palette.dimBody, palette.litHead, power)
    mats.head.emissive.lerpColors(palette.dimEmissive, palette.litEmissiveHead, power)
    mats.head.emissiveIntensity = lerp(0.3, 2.6, power)

    mats.core.emissive.lerpColors(palette.coreDim, palette.coreLit, power)
    mats.core.emissive.lerp(palette.coreWarm, ignite * 0.85)
    mats.core.emissiveIntensity =
      0.5 + (1 - power) * Math.sin(t * 2) * 0.15 + ignite * 9 + power * 3

    mats.visor.emissive.lerpColors(palette.visorDim, palette.visorLit, power)
    mats.visor.emissiveIntensity = 0.6 + power * 2.6 + ignite * 2

    if (light.current) {
      light.current.intensity = spike(p, 0.49, 0.525, 0.8) * 26 + power * 5
      light.current.color.lerpColors(palette.warm, palette.litEmissiveBody, range(p, 0.52, 0.7))
    }
    const auraMat = aura.material as THREE.PointsMaterial
    auraMat.opacity = power * 0.85
    aura.rotation.y = t * 0.25
    if (poolMat.current) poolMat.current.opacity = power * 0.5
  })

  return (
    <group>
      <group ref={root} position={[0, 0.2, 0]}>
        <group ref={pose}>
          <mesh position={[0, 0.55, 0]} scale={[1, 1.5, 0.85]} material={mats.body}>
            <icosahedronGeometry args={[0.3, 0]} />
          </mesh>
          <mesh position={[-0.27, 0.82, 0]} rotation={[0.2, 0, 0.5]} material={mats.body}>
            <octahedronGeometry args={[0.1, 0]} />
          </mesh>
          <mesh position={[0.27, 0.82, 0]} rotation={[0.2, 0, -0.5]} material={mats.body}>
            <octahedronGeometry args={[0.1, 0]} />
          </mesh>
          <mesh position={[0, 0.62, 0.2]} material={mats.core}>
            <sphereGeometry args={[0.085, 16, 16]} />
          </mesh>
          <mesh position={[0, 1.08, 0.02]} scale={[1, 1.15, 0.95]} material={mats.head}>
            <octahedronGeometry args={[0.17, 0]} />
          </mesh>
          <mesh position={[0, 1.07, 0.16]} material={mats.visor}>
            <boxGeometry args={[0.16, 0.03, 0.02]} />
          </mesh>
        </group>
        <primitive object={aura} position={[0, 0.6, 0]} />
        <pointLight
          ref={light}
          position={[0, 0.75, 0.35]}
          distance={9}
          decay={2}
          intensity={0}
          color={theme.agentWarm}
        />
      </group>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[4.5, 4.5]} />
        <meshBasicMaterial
          ref={poolMat}
          map={glowTexture()}
          color={theme.agentPool}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
