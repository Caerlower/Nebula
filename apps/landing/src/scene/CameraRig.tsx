import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { IS_MOBILE } from '../lib/device'
import { STORY, range, smooth01 } from '../lib/story'

/**
 * The virtual camera's journey through the story, keyframed on progress.
 * Each keyframe is { t, position, lookAt }; we ease between neighbors.
 * Tune the shot list here — one line per beat boundary.
 */
type Key = { t: number; pos: THREE.Vector3; look: THREE.Vector3 }
const K = (t: number, p: [number, number, number], l: [number, number, number]): Key => ({
  t,
  pos: new THREE.Vector3(...p),
  look: new THREE.Vector3(...l),
})

const KEYS: Key[] = [
  K(0.0, [0.85, 0.95, 3.35], [-0.05, 0.72, -1.8]), // open: closer, lower — agent reads larger
  K(0.2, [-1.0, 1.45, 4.3], [-0.7, 0.95, 0.2]), // drift left as the elder approaches
  K(0.38, [-0.85, 1.4, 3.2], [-0.6, 1.0, 0.3]), // two-shot: elder + agent
  K(0.5, [0.55, 1.3, 2.8], [-0.05, 0.95, 0]), //  close on the contact
  K(0.62, [0.2, 1.75, 4.2], [0, 1.15, 0]), //     ease back as the agent ignites
  K(0.8, [1.7, 1.95, 5.0], [0, 1.35, 0]), //      slow orbit watching the powers
  K(1.0, [0, 2.15, 9.0], [0, 1.5, 0]), //         hero pull-back, centered + radiant
]

const pos = new THREE.Vector3()
const look = new THREE.Vector3()

function sample(t: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  let i = 0
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const u = smooth01(range(t, a.t, b.t))
  outPos.lerpVectors(a.pos, b.pos, u)
  outLook.lerpVectors(a.look, b.look, u)
}

export function CameraRig() {
  useFrame(({ camera, pointer }) => {
    sample(STORY.smooth, pos, look)
    if (!IS_MOBILE) {
      // gentle parallax — depth without hijacking the shot
      pos.x += pointer.x * 0.16
      pos.y += pointer.y * 0.09
    }
    camera.position.copy(pos)
    camera.lookAt(look)
  })
  return null
}
