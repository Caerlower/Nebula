import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { glowTexture } from '../lib/glow'
import { Q } from '../lib/device'
import { STORY, range, easeOutCubic, spike, BEAT } from '../lib/story'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

const dummy = new THREE.Object3D()
const ORIGIN = new THREE.Vector3(0, 0.72, 0.3)

export function BurstFX() {
  const { theme } = useTheme()
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)
  const ringAMat = useRef<THREE.MeshBasicMaterial>(null)
  const ringBMat = useRef<THREE.MeshBasicMaterial>(null)
  const flash = useRef<THREE.Sprite>(null)
  const flashMat = useRef<THREE.SpriteMaterial>(null)

  const palette = useRef([theme.burst1, theme.burst2, theme.burst3, theme.burst4]).current

  const { mesh, seeds } = useMemo(() => {
    const count = Q.burst
    const geo = new THREE.TetrahedronGeometry(0.032)
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const im = new THREE.InstancedMesh(geo, mat, count)
    im.frustumCulled = false
    im.visible = false

    const seeds = new Float32Array(count * 8)
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1
      const phi = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      const o = i * 8
      seeds[o + 0] = r * Math.cos(phi)
      seeds[o + 1] = u * 0.75 + 0.25
      seeds[o + 2] = r * Math.sin(phi)
      seeds[o + 3] = 0.35 + Math.random() * Math.random()
      seeds[o + 4] = (Math.random() - 0.5) * 9
      seeds[o + 5] = (Math.random() - 0.5) * 9
      seeds[o + 6] = (Math.random() - 0.5) * 9
      seeds[o + 7] = 0.5 + Math.random() * 0.9
      im.setColorAt(i, c.set(palette[i % palette.length]))
    }
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    return { mesh: im, seeds }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    const nextPalette = [next.burst1, next.burst2, next.burst3, next.burst4]
    const c = new THREE.Color()
    for (let i = 0; i < Q.burst; i++) {
      mesh.setColorAt(i, c.set(nextPalette[i % nextPalette.length]))
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (ringAMat.current) tl.add(tweenThreeColor(ringAMat.current.color, next.burst1), 0)
    if (ringBMat.current) tl.add(tweenThreeColor(ringBMat.current.color, next.burst2), 0)
    if (flashMat.current) tl.add(tweenThreeColor(flashMat.current.color, next.burstCore), 0)
    return () => tl.kill()
  })

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    },
    [mesh],
  )

  useFrame(() => {
    const p = STORY.smooth

    const life = range(p, BEAT.contact, 0.74)
    const active = life > 0.0001 && life < 0.9999
    mesh.visible = active
    if (active) {
      const e = easeOutCubic(life)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.pow(1 - life, 1.35)
      for (let i = 0; i < Q.burst; i++) {
        const o = i * 8
        const dist = 0.12 + e * (1.6 + seeds[o + 3] * 4.6)
        dummy.position.set(
          ORIGIN.x + seeds[o] * dist,
          Math.max(0.04, ORIGIN.y + seeds[o + 1] * dist * 0.85),
          ORIGIN.z + seeds[o + 2] * dist,
        )
        dummy.rotation.set(seeds[o + 4] * e, seeds[o + 5] * e, seeds[o + 6] * e)
        dummy.scale.setScalar(seeds[o + 7] * (1 - life * 0.8))
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    setRing(ringA.current, ringAMat.current, range(p, BEAT.contact, 0.62), 17)
    setRing(ringB.current, ringBMat.current, range(p, BEAT.contact + 0.015, 0.65), 13)

    const f = spike(p, 0.492, 0.515, 0.6)
    if (flashMat.current) flashMat.current.opacity = f * 0.9
    if (flash.current) {
      const s = 2 + f * 6
      flash.current.scale.set(s, s, 1)
      flash.current.visible = f > 0.001
    }
  })

  return (
    <group>
      <primitive object={mesh} />

      <mesh ref={ringA} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} visible={false}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial
          ref={ringAMat}
          color={theme.burst1}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringB} rotation-x={-Math.PI / 2} position={[0, 0.1, 0]} visible={false}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial
          ref={ringBMat}
          color={theme.burst2}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <sprite ref={flash} position={ORIGIN.toArray()} visible={false}>
        <spriteMaterial
          ref={flashMat}
          map={glowTexture()}
          color={theme.burstCore}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  )
}

function setRing(
  mesh: THREE.Mesh | null,
  mat: THREE.MeshBasicMaterial | null,
  t: number,
  spread: number,
) {
  if (!mesh || !mat) return
  const active = t > 0.0001 && t < 0.9999
  mesh.visible = active
  if (!active) return
  const e = easeOutCubic(t)
  mesh.scale.setScalar(0.2 + e * spread)
  mat.opacity = Math.min(1, Math.pow(1 - t, 2) * 1.1)
}
