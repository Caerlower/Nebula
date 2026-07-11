import { useLayoutEffect, useRef, useState } from 'react'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { gsap } from 'gsap'
import { Q } from '../lib/device'
import { useTheme, useThemeTransition } from '../ui/ThemeContext'

export function Effects() {
  const { theme } = useTheme()
  const [bloom, setBloom] = useState({
    intensity: theme.bloomIntensity,
    threshold: theme.bloomThreshold,
  })
  const [vignette, setVignette] = useState({
    offset: theme.vignetteOffset,
    darkness: theme.vignetteDarkness,
  })
  const bloomProxy = useRef({ ...bloom })
  const vignetteProxy = useRef({ ...vignette })

  useThemeTransition((next) => {
    const tl = gsap.timeline()
    tl.to(
      bloomProxy.current,
      {
        intensity: next.bloomIntensity,
        threshold: next.bloomThreshold,
        duration: 0.6,
        ease: 'power2.inOut',
        onUpdate: () => setBloom({ ...bloomProxy.current }),
      },
      0,
    )
    tl.to(
      vignetteProxy.current,
      {
        offset: next.vignetteOffset,
        darkness: next.vignetteDarkness,
        duration: 0.6,
        ease: 'power2.inOut',
        onUpdate: () => setVignette({ ...vignetteProxy.current }),
      },
      0,
    )
    return () => tl.kill()
  })

  useLayoutEffect(() => {
    bloomProxy.current = {
      intensity: theme.bloomIntensity,
      threshold: theme.bloomThreshold,
    }
    vignetteProxy.current = {
      offset: theme.vignetteOffset,
      darkness: theme.vignetteDarkness,
    }
  }, [])

  return (
    <EffectComposer multisampling={Q.msaa}>
      <Bloom
        mipmapBlur
        intensity={bloom.intensity}
        luminanceThreshold={bloom.threshold}
        luminanceSmoothing={0.3}
        radius={0.8}
      />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.06} />
      <Vignette eskil={false} offset={vignette.offset} darkness={vignette.darkness} />
    </EffectComposer>
  )
}
