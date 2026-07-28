import { useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTheme } from '../ui/ThemeContext'

/** Scene background, fog, and fill lights. */
export function SceneEnvironment() {
  const { theme } = useTheme()
  const scene = useThree((s) => s.scene)
  const bg = useRef(new THREE.Color(theme.sceneBackground))
  const fogColor = useRef(new THREE.Color(theme.sceneFog))

  useLayoutEffect(() => {
    scene.background = bg.current
    scene.fog = new THREE.Fog(fogColor.current.getHex(), 16, 70)
    return () => {
      scene.fog = null
    }
  }, [scene])

  return (
    <>
      <ambientLight intensity={theme.ambientIntensity} />
      <hemisphereLight args={[theme.hemi, theme.hemiGround, theme.hemiIntensity]} />
      <directionalLight position={[6, 10, 4]} intensity={theme.keyIntensity} color={theme.key} />
      <directionalLight position={[0, 5, -9]} intensity={theme.rimIntensity} color={theme.rim} />
    </>
  )
}
