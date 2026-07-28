import { useRef } from 'react'
import * as THREE from 'three'
import { useTheme } from '../ui/ThemeContext'

export function Ground() {
  const { theme } = useTheme()
  const mat = useRef(
    new THREE.MeshStandardMaterial({
      color: theme.ground,
      roughness: 0.9,
      metalness: 0.08,
    }),
  ).current

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} material={mat}>
      <circleGeometry args={[60, 48]} />
    </mesh>
  )
}
