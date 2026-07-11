import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { STORY, range, lerp } from '../lib/story'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

const WALKERS = [
  { colorKey: 'bgAgent1' as const, from: -3.4, to: 3.4, start: 0.0, end: 0.24, z: -12.5, s: 0.85 },
  { colorKey: 'bgAgent2' as const, from: 3.2, to: -3.2, start: 0.05, end: 0.3, z: -13.5, s: 0.75 },
  { colorKey: 'bgAgent3' as const, from: -3.0, to: 3.0, start: 0.11, end: 0.34, z: -14.5, s: 0.9 },
]

type WalkerDef = (typeof WALKERS)[number]

function Walker({ colorKey, from, to, start, end, z, s }: WalkerDef) {
  const { theme } = useTheme()
  const group = useRef<THREE.Group>(null)
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null)
  const headMat = useRef<THREE.MeshStandardMaterial>(null)
  const emissive = theme[colorKey]

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    if (bodyMat.current) tl.add(tweenThreeColor(bodyMat.current.emissive, next[colorKey]), 0)
    if (headMat.current) tl.add(tweenThreeColor(headMat.current.emissive, next[colorKey]), 0)
    return () => tl.kill()
  })

  useFrame(({ clock }) => {
    const t = range(STORY.smooth, start, end)
    const visible = t > 0.001 && t < 0.999
    if (group.current) {
      group.current.visible = visible
      if (visible) {
        group.current.position.set(
          lerp(from, to, t),
          Math.abs(Math.sin(t * Math.PI * 7)) * 0.05,
          z,
        )
      }
    }
    if (!visible) return
    const fade = Math.sin(t * Math.PI)
    const glow = 1.5 + Math.sin(clock.elapsedTime * 2 + z) * 0.2
    if (bodyMat.current) {
      bodyMat.current.emissiveIntensity = glow
      bodyMat.current.opacity = fade
    }
    if (headMat.current) {
      headMat.current.emissiveIntensity = glow * 1.2
      headMat.current.opacity = fade
    }
  })

  return (
    <group ref={group} scale={s} visible={false}>
      <mesh position={[0, 0.62, 0]}>
        <capsuleGeometry args={[0.24, 0.55, 6, 14]} />
        <meshStandardMaterial
          ref={bodyMat}
          color={theme.bgAgentBody}
          emissive={emissive}
          emissiveIntensity={1.5}
          transparent
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 1.32, 0]}>
        <icosahedronGeometry args={[0.15, 1]} />
        <meshStandardMaterial
          ref={headMat}
          color={theme.bgAgentBody}
          emissive={emissive}
          emissiveIntensity={1.8}
          transparent
          roughness={0.35}
        />
      </mesh>
    </group>
  )
}

export function BackgroundAgents() {
  return (
    <>
      {WALKERS.map((w) => (
        <Walker key={w.z} {...w} />
      ))}
    </>
  )
}
