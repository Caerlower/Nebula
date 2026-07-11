import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { glowTexture } from '../lib/glow'
import { STORY, range, smooth01, lerp } from '../lib/story'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

const WALL_X = 3.3
const WALL = { w: 3.5, h: 9, d: 10 }
const STRIP_Z = [-3.2, -0.9, 1.3]

function createPanelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgb(128,128,128)'
  ctx.fillRect(0, 0, 128, 256)
  for (let y = 0; y < 256; y += 24) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fillRect(0, y, 128, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, y + 2, 128, 1)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 5)
  return tex
}

function Wall({ side }: { side: 1 | -1 }) {
  const { theme } = useTheme()
  const group = useRef<THREE.Group>(null)
  const l1 = useRef<THREE.PointLight>(null)
  const l2 = useRef<THREE.PointLight>(null)
  const stripHex = side === -1 ? theme.stripLeft : theme.stripRight
  const beamHex = side === -1 ? theme.beamEmissiveLeft : theme.beamEmissiveRight

  const panelTex = useMemo(() => createPanelTexture(), [])

  const mats = useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({
      color: theme.wallDim,
      emissive: theme.wallEmissive,
      emissiveIntensity: 0.4,
      roughness: 0.85,
      metalness: 0.2,
      transparent: true,
      roughnessMap: panelTex,
    })
    const strip = new THREE.MeshStandardMaterial({
      color: theme.agentSocket,
      emissive: new THREE.Color(stripHex),
      emissiveIntensity: 1.2,
      transparent: true,
    })
    const beam = new THREE.MeshStandardMaterial({
      color: theme.agentSocket,
      emissive: new THREE.Color(beamHex),
      emissiveIntensity: 0.5,
      transparent: true,
    })
    const pool = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: new THREE.Color(stripHex),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    return { wall, strip, beam, pool }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side])

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    const nextStrip = side === -1 ? next.stripLeft : next.stripRight
    const nextBeam = side === -1 ? next.beamEmissiveLeft : next.beamEmissiveRight
    tl.add(tweenThreeColor(mats.wall.color, next.wallDim), 0)
    tl.add(tweenThreeColor(mats.wall.emissive, next.wallEmissive), 0)
    tl.add(tweenThreeColor(mats.strip.emissive, nextStrip), 0)
    tl.add(tweenThreeColor(mats.beam.emissive, nextBeam), 0)
    tl.add(tweenThreeColor(mats.pool.color, nextStrip), 0)
    if (l1.current) tl.add(tweenThreeColor(l1.current.color, nextStrip), 0)
    if (l2.current) tl.add(tweenThreeColor(l2.current.color, nextStrip), 0)
    return () => tl.kill()
  })

  useEffect(
    () => () => {
      panelTex.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [mats, panelTex],
  )

  useFrame(({ clock }) => {
    const p = STORY.smooth
    const open = smooth01(range(p, 0.5, 0.7))
    if (group.current) {
      group.current.position.x = side * lerp(WALL_X, 9.5, open)
      group.current.visible = open < 0.995
    }
    const alpha = 1 - open
    mats.wall.opacity = alpha
    mats.strip.opacity = alpha
    mats.beam.opacity = alpha
    mats.pool.opacity = 0.2 * alpha
    mats.strip.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 2 + side) * 0.2
    const glow = 1.35 * alpha
    if (l1.current) l1.current.intensity = glow
    if (l2.current) l2.current.intensity = glow
  })

  const inner = side * -(WALL.w / 2)
  return (
    <group ref={group} position={[side * WALL_X, WALL.h / 2, -5.5]}>
      <mesh material={mats.wall}>
        <boxGeometry args={[WALL.w, WALL.h, WALL.d]} />
      </mesh>

      <mesh material={mats.beam} position={[inner + side * -0.05, 0.85, 0]}>
        <boxGeometry args={[0.08, 0.14, WALL.d]} />
      </mesh>

      {STRIP_Z.map((z) => (
        <mesh key={z} material={mats.strip} position={[inner + side * -0.012, -1.7, z]}>
          <boxGeometry args={[0.018, 4.6, 0.06]} />
        </mesh>
      ))}

      {STRIP_Z.map((z) => (
        <mesh
          key={`pool-${z}`}
          material={mats.pool}
          rotation-x={-Math.PI / 2}
          position={[inner + side * -0.7, -(WALL.h / 2) + 0.03, z]}
        >
          <planeGeometry args={[2.4, 1.4]} />
        </mesh>
      ))}

      <pointLight
        ref={l1}
        position={[inner + side * -0.55, -1.6, -2.6]}
        distance={6.5}
        decay={2}
        color={stripHex}
        intensity={1.35}
      />
      <pointLight
        ref={l2}
        position={[inner + side * -0.55, -1.6, 0.6]}
        distance={6.5}
        decay={2}
        color={stripHex}
        intensity={1.35}
      />
    </group>
  )
}

export function AlleyWalls() {
  return (
    <>
      <Wall side={-1} />
      <Wall side={1} />
    </>
  )
}
