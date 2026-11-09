import React from 'react'

import { useDraggable } from '../../hooks/useDraggable'

import './style.css'

import * as modalStack from '../../utils/modals'
import { createPortal } from 'react-dom'

export function Modal ({ children, open, size = 'large', onClose = () => {}, onTransitionEnd, draggable = false, shade = true, closeOnShade = false, theme = 'light' }) {
  const elRef = React.useRef()
  const handleRef = React.useRef()

  const [offset] = useDraggable(handleRef.current)

  React.useEffect(() => {
    if (!open) {
      return
    }

    function handleClose () {
      if (typeof onClose !== 'function') {
        return
      }
      onClose()
    }

    const id = modalStack.addToStack(handleClose)
    return () => {
      modalStack.removeFromStack(id)
    }
  }, [open])

  function handleShadeClick (event) {
    if (!closeOnShade || event.target !== event.currentTarget) {
      return
    }
    onClose()
  }

  return (
    <>
      {
        createPortal(
          (
            <div ref={elRef} className={`Modal Modal--${size} ${theme === 'light' ? 'u-theme--light' : ''} ${open ? 'is-open' : ''} ${draggable ? 'is-draggable' : ''} ${!shade ? 'has-noShade' : ''}`} onTransitionEnd={onTransitionEnd} onClick={handleShadeClick}>
              <div className='Modal-wrapper' style={{ transform: `translate(${offset[0]}px, ${offset[1]}px)` }}>
                <div className='Modal-content'>
                  {
                    draggable && <div ref={handleRef} className='Modal-handle'>•••</div>
                  }
                  {children}
                </div>
              </div>
            </div>
          ),
          document.body
        )
      }
    </>
  )
}
