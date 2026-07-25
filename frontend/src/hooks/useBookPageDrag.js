import { useEffect, useRef } from 'react'

const DIRECTION_LOCK_PX = 12
const COMMIT_PROGRESS = 0.28
const COMMIT_VELOCITY = 0.45

/**
 * Finger-linked horizontal page drag.
 * Reports progress 0→1 while dragging; on release commits or cancels.
 */
export default function useBookPageDrag(
  ref,
  {
    enabled = true,
    canGoForward = false,
    canGoBack = false,
    onDragStart,
    onDragMove,
    onDragEnd,
  },
) {
  const callbacksRef = useRef({
    canGoForward,
    canGoBack,
    onDragStart,
    onDragMove,
    onDragEnd,
  })
  callbacksRef.current = {
    canGoForward,
    canGoBack,
    onDragStart,
    onDragMove,
    onDragEnd,
  }

  useEffect(() => {
    const el = ref?.current
    if (!el || !enabled) return undefined

    let pointerId = null
    let startX = 0
    let startY = 0
    let locked = null
    let direction = null
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let active = false

    const reset = () => {
      pointerId = null
      locked = null
      direction = null
      active = false
      velocity = 0
      el.classList.remove('book-shell--swiping')
    }

    const width = () => Math.max(el.clientWidth, 1)

    const progressFromDx = (dx) => {
      // Map drag distance to 0–1; ~55% of width ≈ full turn.
      return Math.min(1, Math.max(0, Math.abs(dx) / (width() * 0.55)))
    }

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pointerId = event.pointerId
      startX = event.clientX
      startY = event.clientY
      lastX = event.clientX
      lastT = event.timeStamp
      locked = null
      direction = null
      active = false
      velocity = 0
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture failures.
      }
    }

    const onPointerMove = (event) => {
      if (pointerId !== event.pointerId) return

      const dx = event.clientX - startX
      const dy = event.clientY - startY
      const dt = event.timeStamp - lastT
      if (dt > 0) {
        velocity = (event.clientX - lastX) / dt
      }
      lastX = event.clientX
      lastT = event.timeStamp

      if (!locked && (Math.abs(dx) > DIRECTION_LOCK_PX || Math.abs(dy) > DIRECTION_LOCK_PX)) {
        locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }

      if (locked !== 'h') return

      const nextDirection = dx < 0 ? 'forward' : 'back'
      const allowed = nextDirection === 'forward'
        ? callbacksRef.current.canGoForward
        : callbacksRef.current.canGoBack

      if (!allowed) {
        if (active) {
          callbacksRef.current.onDragMove?.(0, direction)
        }
        return
      }

      if (!active) {
        active = true
        direction = nextDirection
        el.classList.add('book-shell--swiping')
        callbacksRef.current.onDragStart?.(direction)
      }

      // Keep the original direction for this gesture.
      const signedDx = direction === 'forward' ? -dx : dx
      const progress = progressFromDx(Math.max(0, signedDx))
      callbacksRef.current.onDragMove?.(progress, direction)
    }

    const finish = (event) => {
      if (pointerId !== event.pointerId) return

      try {
        el.releasePointerCapture(event.pointerId)
      } catch {
        // Already released.
      }

      if (active && direction) {
        const dx = event.clientX - startX
        const signedDx = direction === 'forward' ? -dx : dx
        const progress = progressFromDx(Math.max(0, signedDx))
        const velocityCommit = direction === 'forward'
          ? velocity <= -COMMIT_VELOCITY
          : velocity >= COMMIT_VELOCITY
        const commit = progress >= COMMIT_PROGRESS || velocityCommit
        callbacksRef.current.onDragEnd?.(commit, direction, progress)
      }

      reset()
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
      reset()
    }
  }, [ref, enabled])
}
