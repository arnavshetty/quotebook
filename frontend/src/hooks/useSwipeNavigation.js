import { useEffect, useRef } from 'react'

const SWIPE_THRESHOLD_PX = 56
const DIRECTION_LOCK_PX = 12

/**
 * Horizontal swipe navigation on an element.
 * Vertical gestures stay free for page scroll (touch-action: pan-y on the target).
 */
export default function useSwipeNavigation(
  ref,
  {
    onSwipeLeft,
    onSwipeRight,
    enabled = true,
  },
) {
  const callbacksRef = useRef({ onSwipeLeft, onSwipeRight })
  callbacksRef.current = { onSwipeLeft, onSwipeRight }

  useEffect(() => {
    const el = ref?.current
    if (!el || !enabled) return

    let pointerId = null
    let startX = 0
    let startY = 0
    let locked = null

    const reset = () => {
      pointerId = null
      locked = null
      el.classList.remove('book-shell--swiping')
    }

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pointerId = event.pointerId
      startX = event.clientX
      startY = event.clientY
      locked = null
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture failures (e.g. unsupported targets).
      }
    }

    const onPointerMove = (event) => {
      if (pointerId !== event.pointerId) return

      const dx = event.clientX - startX
      const dy = event.clientY - startY

      if (!locked && (Math.abs(dx) > DIRECTION_LOCK_PX || Math.abs(dy) > DIRECTION_LOCK_PX)) {
        locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
        if (locked === 'h') {
          el.classList.add('book-shell--swiping')
        }
      }
    }

    const finish = (event) => {
      if (pointerId !== event.pointerId) return

      const dx = event.clientX - startX
      if (locked === 'h' && Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
        if (dx < 0) callbacksRef.current.onSwipeLeft?.()
        else callbacksRef.current.onSwipeRight?.()
      }

      try {
        el.releasePointerCapture(event.pointerId)
      } catch {
        // Already released or never captured.
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
