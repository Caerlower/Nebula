import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { glowTexture } from '../lib/glow'
import { STORY, range, smooth01, lerp } from '../lib/story'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

const HELD = new THREE.Vector3()
const TARGET = new THREE.Vector3(0, 0.7, 0.3)

export function Elder() {
  const { theme } = useTheme()
  const elder = useRef<THREE.Group>(null)
  const orb = useRef<THREE.Group>(null)
  const orbLight = useRef<THREE.PointLight>(null)
  const orbGlowMat = useRef<THREE.SpriteMaterial>(null)
  const orbCoreMat = useRef<THREE.MeshBasicMaterial>(null)

  const { cloakGeo, cloakMat, faceMat } = useMemo(() => {
    const profile = [
      new THREE.Vector2(0.001, 2.3),
      new THREE.Vector2(0.13, 2.2),
      new THREE.Vector2(0.19, 2.0),
      new THREE.Vector2(0.35, 1.66),
      new THREE.Vector2(0.3, 1.18),
      new THREE.Vector2(0.37, 0.66),
      new THREE.Vector2(0.54, 0.1),
      new THREE.Vector2(0.57, 0.0),
    ]
    const cloakGeo = new THREE.LatheGeometry(profile, 28)
    const cloakMat = new THREE.MeshStandardMaterial({
      color: theme.elderCloak,
      emissive: theme.elderCloakEmissive,
      emissiveIntensity: 0.5,
      roughness: 0.75,
      transparent: true,
    })
    const faceMat = new THREE.MeshStandardMaterial({
      color: theme.agentSocket,
      emissive: theme.elderFace,
      emissiveIntensity: 2.2,
      transparent: true,
    })
    return { cloakGeo, cloakMat, faceMat }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    tl.add(tweenThreeColor(cloakMat.color, next.elderCloak), 0)
    tl.add(tweenThreeColor(cloakMat.emissive, next.elderCloakEmissive), 0)
    tl.add(tweenThreeColor(faceMat.emissive, next.elderFace), 0)
    if (orbCoreMat.current) tl.add(tweenThreeColor(orbCoreMat.current.color, next.orb), 0)
    if (orbGlowMat.current) tl.add(tweenThreeColor(orbGlowMat.current.color, next.orb), 0)
    if (orbLight.current) tl.add(tweenThreeColor(orbLight.current.color, next.orb), 0)
    return () => tl.kill()
  })

  useEffect(
    () => () => {
      cloakGeo.dispose()
      cloakMat.dispose()
      faceMat.dispose()
    },
    [cloakGeo, cloakMat, faceMat],
  )

  useFrame(({ clock }) => {
    const p = STORY.smooth
    const t = clock.elapsedTime

    const appear = smooth01(range(p, 0.2, 0.27))
    const walk = smooth01(range(p, 0.21, 0.38))
    const extend = smooth01(range(p, 0.42, 0.5))
    const absorb = range(p, 0.5, 0.545)
    const gone = smooth01(range(p, 0.56, 0.72))

    const x = lerp(-6.2, -1.85, walk)
    const bob = Math.abs(Math.sin(walk * Math.PI * 5.5)) * 0.045 * (1 - extend)

    if (elder.current) {
      elder.current.visible = appear > 0.001 && gone < 0.999
      elder.current.position.set(x - gone * 1.6, bob + gone * 0.7, 0.9)
      elder.current.rotation.z = -extend * 0.1
    }
    const alpha = appear * (1 - gone)
    cloakMat.opacity = alpha
    faceMat.opacity = alpha

    if (orb.current) {
      HELD.set(x + 0.5, 1.2 + bob + Math.sin(t * 1.8) * 0.03, 1.0)
      orb.current.position.lerpVectors(HELD, TARGET, extend)
      const s = (1 - absorb) * appear
      orb.current.scale.setScalar(Math.max(s, 0.0001))
      orb.current.visible = s > 0.002 && gone < 0.5
    }
    if (orbLight.current) {
      orbLight.current.intensity = appear * (1 - absorb) * (2.2 + extend * 5)
    }
    if (orbGlowMat.current) {
      orbGlowMat.current.opacity =
        appear * (1 - absorb) * (0.75 + Math.sin(t * 3.2) * 0.12)
    }
  })

  return (
    <group>
      <group ref={elder} visible={false}>
        <mesh geometry={cloakGeo} material={cloakMat} />
        <mesh position={[0.13, 1.92, 0]} material={faceMat}>
          <sphereGeometry args={[0.05, 12, 12]} />
        </mesh>
      </group>

      <group ref={orb} visible={false}>
        <mesh>
          <sphereGeometry args={[0.13, 24, 24]} />
          <meshBasicMaterial ref={orbCoreMat} color={theme.orb} toneMapped={false} />
        </mesh>
        <sprite scale={[1.4, 1.4, 1]}>
          <spriteMaterial
            ref={orbGlowMat}
            map={glowTexture()}
            color={theme.orb}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
        <pointLight ref={orbLight} intensity={0} distance={8} decay={2} color={theme.orb} />
      </group>
    </group>
  )
}
