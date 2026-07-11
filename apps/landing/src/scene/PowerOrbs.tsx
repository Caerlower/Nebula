import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { glowTexture } from '../lib/glow'
import { STORY, range, easeOutBack } from '../lib/story'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

type OrbDef = {
  name: 'wallet' | 'yield' | 'pulse' | 'star'
  colorKey: 'orbWallet' | 'orbYield' | 'orbPulse' | 'orbStar'
  appear: number
  angle: number
}

const ORBS: OrbDef[] = [
  { name: 'wallet', colorKey: 'orbWallet', appear: 0.63, angle: 0 },
  { name: 'yield', colorKey: 'orbYield', appear: 0.665, angle: Math.PI / 2 },
  { name: 'pulse', colorKey: 'orbPulse', appear: 0.7, angle: Math.PI },
  { name: 'star', colorKey: 'orbStar', appear: 0.735, angle: (3 * Math.PI) / 2 },
]

const RADIUS = 1.35
const CENTER_Y = 1.45

function OrbShape({
  name,
  emissive,
  socket,
}: {
  name: OrbDef['name']
  emissive: string
  socket: string
}) {
  const common = {
    color: socket,
    emissive,
    emissiveIntensity: 1.9,
    roughness: 0.3,
    metalness: 0.2,
  }
  switch (name) {
    case 'wallet':
      return (
        <mesh>
          <boxGeometry args={[0.3, 0.21, 0.09]} />
          <meshStandardMaterial {...common} />
        </mesh>
      )
    case 'yield':
      return (
        <group position={[0, -0.08, 0]}>
          {[0.12, 0.2, 0.3].map((h, i) => (
            <mesh key={h} position={[(i - 1) * 0.1, h / 2, 0]}>
              <boxGeometry args={[0.065, h, 0.065]} />
              <meshStandardMaterial {...common} />
            </mesh>
          ))}
        </group>
      )
    case 'pulse':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial {...common} emissiveIntensity={2.4} />
          </mesh>
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.15, 0.016, 10, 40]} />
            <meshStandardMaterial {...common} />
          </mesh>
        </group>
      )
    default:
      return (
        <mesh scale={[1, 1.4, 1]}>
          <octahedronGeometry args={[0.15, 0]} />
          <meshStandardMaterial {...common} />
        </mesh>
      )
  }
}

function Orb({ def }: { def: OrbDef }) {
  const { theme } = useTheme()
  const group = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const glowMat = useRef<THREE.SpriteMaterial>(null)
  const color = theme[def.colorKey]

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    if (glowMat.current) tl.add(tweenThreeColor(glowMat.current.color, next[def.colorKey]), 0)
    return () => tl.kill()
  })

  useFrame(({ clock }) => {
    const p = STORY.smooth
    const t = clock.elapsedTime
    const raw = range(p, def.appear, def.appear + 0.05)
    const born = raw <= 0 ? 0 : easeOutBack(raw)

    const a = def.angle + t * 0.45 + p * 2.2
    if (group.current) {
      group.current.visible = born > 0.001
      group.current.position.set(
        Math.cos(a) * RADIUS,
        CENTER_Y + Math.sin(t * 1.3 + def.angle) * 0.09,
        Math.sin(a) * RADIUS,
      )
      group.current.scale.setScalar(Math.max(born, 0.0001))
    }
    if (inner.current) {
      inner.current.rotation.y = t * 0.8
      inner.current.rotation.x = Math.sin(t * 0.6 + def.angle) * 0.2
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={inner}>
        <OrbShape name={def.name} emissive={color} socket={theme.orbSocket} />
      </group>
      <sprite scale={[0.85, 0.85, 1]}>
        <spriteMaterial
          ref={glowMat}
          map={glowTexture()}
          color={color}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  )
}

export function PowerOrbs() {
  return (
    <>
      {ORBS.map((o) => (
        <Orb key={o.name} def={o} />
      ))}
    </>
  )
}
