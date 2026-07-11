import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Q } from '../lib/device'
import { StoryDriver } from './StoryDriver'
import { CameraRig } from './CameraRig'
import { SceneEnvironment } from './SceneEnvironment'
import { NebulaBackdrop } from './NebulaBackdrop'
import { Ground } from './Ground'
import { AlleyWalls } from './AlleyWalls'
import { Atmosphere } from './Atmosphere'
import { BackgroundAgents } from './BackgroundAgents'
import { Elder } from './Elder'
import { Agent } from './Agent'
import { PowerOrbs } from './PowerOrbs'
import { BurstFX } from './BurstFX'
import { Effects } from './Effects'

/**
 * One continuous 3D scene. Nothing here owns a timeline — every element
 * derives its state from STORY.smooth, so the whole cinematic scrubs
 * forward and backward with the scroll.
 */
export function Experience() {
  return (
    <Canvas
      dpr={Q.dpr}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 42, near: 0.1, far: 140, position: [0.85, 0.95, 3.35] }}
    >
      <SceneEnvironment />

      <StoryDriver />
      <CameraRig />

      <NebulaBackdrop />
      <Stars
        radius={50}
        depth={18}
        count={Q.stars}
        factor={4}
        saturation={0.3}
        fade
        speed={0.3}
      />

      <Ground />
      <AlleyWalls />
      <Atmosphere />
      <BackgroundAgents />
      <Elder />
      <Agent />
      <PowerOrbs />
      <BurstFX />

      <Effects />
    </Canvas>
  )
}
