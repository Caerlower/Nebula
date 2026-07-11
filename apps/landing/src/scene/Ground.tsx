import { useRef } from 'react'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

export function Ground() {
  const { theme } = useTheme()
  const mat = useRef(
    new THREE.MeshStandardMaterial({
      color: theme.ground,
      roughness: 0.9,
      metalness: 0.08,
    }),
  ).current

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    tl.add(tweenThreeColor(mat.color, next.ground), 0)
    return () => tl.kill()
  })

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} material={mat}>
      <circleGeometry args={[60, 48]} />
    </mesh>
  )
}
