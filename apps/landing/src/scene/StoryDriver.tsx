import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STORY } from '../lib/story'

/**
 * Damps raw ScrollTrigger progress into STORY.smooth.
 * Runs at priority -10 so every other useFrame reads this frame's value.
 * The damping is what keeps the 3D scrub butter-smooth even on jumpy input.
 */
export function StoryDriver() {
  useFrame((_, delta) => {
    STORY.smooth = THREE.MathUtils.damp(
      STORY.smooth,
      STORY.progress,
      7,
      Math.min(delta, 0.05),
    )
    if (Math.abs(STORY.smooth - STORY.progress) < 0.0004) {
      STORY.smooth = STORY.progress
    }
  }, -10)
  return null
}
