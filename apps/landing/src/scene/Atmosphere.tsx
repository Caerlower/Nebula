import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { glowTexture } from '../lib/glow'
import { Q } from '../lib/device'
import { STORY, range, smooth01 } from '../lib/story'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

type Haze = { z: number; size: [number, number]; colorKey: 'atmos1' | 'atmos2' | 'atmos3'; opacity: number }

const HAZE: Haze[] = [
  { z: -2.2, size: [3.6, 4.6], colorKey: 'atmos1', opacity: 0.05 },
  { z: -5.6, size: [3.6, 4.8], colorKey: 'atmos2', opacity: 0.065 },
  { z: -9.0, size: [3.8, 5.0], colorKey: 'atmos3', opacity: 0.08 },
]

const MOTE_RANGE = 3.9

export function Atmosphere() {
  const { theme } = useTheme()

  const hazeMats = useMemo(
    () =>
      HAZE.map(
        (h) =>
          new THREE.MeshBasicMaterial({
            map: glowTexture(),
            color: theme[h.colorKey],
            transparent: true,
            opacity: h.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const backMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: theme.atmosBeam,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const motes = useMemo(() => {
    const n = Q.motes
    const base = new Float32Array(n * 3)
    const speed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      base[i * 3] = (Math.random() - 0.5) * 4.4
      base[i * 3 + 1] = 0.1 + Math.random() * MOTE_RANGE
      base[i * 3 + 2] = Math.random() * 14.5 - 10
      speed[i] = 0.08 + Math.random() * 0.18
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3))
    const mat = new THREE.PointsMaterial({
      size: 0.05,
      map: glowTexture(),
      color: theme.atmosFog,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    return { points, base, speed, n }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    hazeMats.forEach((m, i) => tl.add(tweenThreeColor(m.color, next[HAZE[i].colorKey]), 0))
    tl.add(tweenThreeColor(backMat.color, next.atmosBeam), 0)
    tl.add(tweenThreeColor((motes.points.material as THREE.PointsMaterial).color, next.atmosFog), 0)
    return () => tl.kill()
  })

  useEffect(
    () => () => {
      hazeMats.forEach((m) => m.dispose())
      backMat.dispose()
      motes.points.geometry.dispose()
      ;(motes.points.material as THREE.Material).dispose()
    },
    [hazeMats, backMat, motes],
  )

  useFrame(({ clock }) => {
    const p = STORY.smooth
    const t = clock.elapsedTime
    const open = smooth01(range(p, 0.5, 0.7))

    hazeMats.forEach((m, i) => {
      m.opacity = HAZE[i].opacity * (1 - open)
    })
    backMat.opacity = 0.16 * (1 - open)

    const pos = motes.points.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < motes.n; i++) {
      const y = 0.1 + ((motes.base[i * 3 + 1] - 0.1 + t * motes.speed[i]) % MOTE_RANGE)
      pos.setY(i, y)
    }
    pos.needsUpdate = true
    ;(motes.points.material as THREE.PointsMaterial).opacity = 0.3 - open * 0.12
  })

  return (
    <group>
      {HAZE.map((h, i) => (
        <mesh key={h.z} material={hazeMats[i]} position={[0, 2.2, h.z]}>
          <planeGeometry args={[h.size[0], h.size[1]]} />
        </mesh>
      ))}
      <mesh material={backMat} position={[0, 2.6, -16.5]}>
        <planeGeometry args={[8, 6.5]} />
      </mesh>
      <primitive object={motes.points} />
    </group>
  )
}
