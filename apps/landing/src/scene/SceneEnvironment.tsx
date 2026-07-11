import { useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'
import { tweenThreeColor } from '../lib/theme'

/**
 * Scene-level background, fog, and fill lights — all theme-driven and tweened on toggle.
 */
export function SceneEnvironment() {
  const { theme } = useTheme()
  const scene = useThree((s) => s.scene)
  const bg = useRef(new THREE.Color(theme.sceneBackground))
  const fogColor = useRef(new THREE.Color(theme.sceneFog))
  const ambient = useRef<THREE.AmbientLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)

  useLayoutEffect(() => {
    scene.background = bg.current
    scene.fog = new THREE.Fog(fogColor.current.getHex(), 16, 70)
    return () => {
      scene.fog = null
    }
  }, [scene])

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    tl.add(tweenThreeColor(bg.current, next.sceneBackground), 0)
    tl.add(
      tweenThreeColor(fogColor.current, next.sceneFog, 0.6).eventCallback('onUpdate', () => {
        if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(fogColor.current)
      }),
      0,
    )
    if (ambient.current) tl.to(ambient.current, { intensity: next.ambientIntensity, duration: 0.6, ease: 'power2.inOut' }, 0)
    if (hemi.current) {
      tl.add(tweenThreeColor(hemi.current.color, next.hemi), 0)
      tl.add(tweenThreeColor(hemi.current.groundColor, next.hemiGround), 0)
      tl.to(hemi.current, { intensity: next.hemiIntensity, duration: 0.6, ease: 'power2.inOut' }, 0)
    }
    if (key.current) {
      tl.add(tweenThreeColor(key.current.color, next.key), 0)
      tl.to(key.current, { intensity: next.keyIntensity, duration: 0.6, ease: 'power2.inOut' }, 0)
    }
    if (rim.current) {
      tl.add(tweenThreeColor(rim.current.color, next.rim), 0)
      tl.to(rim.current, { intensity: next.rimIntensity, duration: 0.6, ease: 'power2.inOut' }, 0)
    }
    return () => tl.kill()
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={theme.ambientIntensity} />
      <hemisphereLight
        ref={hemi}
        args={[theme.hemi, theme.hemiGround, theme.hemiIntensity]}
      />
      <directionalLight
        ref={key}
        position={[6, 10, 4]}
        intensity={theme.keyIntensity}
        color={theme.key}
      />
      <directionalLight
        ref={rim}
        position={[0, 5, -9]}
        intensity={theme.rimIntensity}
        color={theme.rim}
      />
    </>
  )
}
