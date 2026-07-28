import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Q } from '../lib/device'
import { useTheme } from '../ui/ThemeContext'

export function Effects() {
  const { theme } = useTheme()

  return (
    <EffectComposer multisampling={Q.msaa}>
      <Bloom
        mipmapBlur
        intensity={theme.bloomIntensity}
        luminanceThreshold={theme.bloomThreshold}
        luminanceSmoothing={0.3}
        radius={0.8}
      />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.06} />
      <Vignette eskil={false} offset={theme.vignetteOffset} darkness={theme.vignetteDarkness} />
    </EffectComposer>
  )
}
