import React, { useState } from 'react'

import Button, { StyledButtonProps } from './Button'
import Modal from './Modal'
import Loading from './Loading'
import Prose from './Prose'

interface ConfirmModal {
  content: React.ReactNode
  confirmButtonLabel?: string
}

interface PrintButtonProps extends StyledButtonProps {
  title?: string
  afterPrint?: () => void
  copies?: number
  confirmModal?: ConfirmModal
}

const PrintButton: React.FC<React.PropsWithChildren<PrintButtonProps>> = ({
  title,
  afterPrint,
  children,
  copies,
  confirmModal,
  ...rest
}) => {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showPrintingError, setShowPrintingError] = useState(false)

  const print = async () => {
    if (window.kiosk) {
      const printers = await window.kiosk.getPrinterInfo()
      if (!printers.some((p) => p.connected)) {
        setShowPrintingError(true)
        return
      }
    }

    setIsPrinting(true)
    setTimeout(() => {
      setIsPrinting(false)
    }, 3000)
    const documentTitle = document.title
    if (title) {
      document.title = title
    }
    if (window.kiosk) {
      await window.kiosk.print({ copies })
    } else {
      copies &&
        copies > 1 &&
        // eslint-disable-next-line no-console
        console.error(
          'Printing more than 1 copy can only be done with KioskBrowser.'
        )
      window.print()
    }
    if (title) {
      document.title = documentTitle
    }

    afterPrint?.()
  }

  const donePrintingError = () => {
    setShowPrintingError(false)
  }

  const initConfirmModal = () => {
    setIsConfirming(true)
  }

  const cancelPrint = () => {
    setIsConfirming(false)
  }

  const confirmPrint = () => {
    setIsConfirming(false)
    print()
  }

  return (
    <React.Fragment>
      <Button onPress={confirmModal ? initConfirmModal : print} {...rest}>
        {children}
      </Button>
      {isPrinting && (
        <Modal centerContent content={<Loading>Printing</Loading>} />
      )}
      {isConfirming && (
        <Modal
          centerContent
          content={confirmModal?.content}
          actions={
            <React.Fragment>
              <Button onPress={cancelPrint}>Cancel</Button>
              <Button onPress={confirmPrint} primary>
                {confirmModal?.confirmButtonLabel ?? 'Print'}
              </Button>
            </React.Fragment>
          }
        />
      )}
      {showPrintingError && (
        <Modal
          content={
            <Prose>
              <h2>The printer is not connected.</h2>
              <p>Please connect the printer and try again.</p>
            </Prose>
          }
          actions={
            <React.Fragment>
              <Button onPress={donePrintingError}>OK</Button>
            </React.Fragment>
          }
        />
      )}
    </React.Fragment>
  )
}

export default PrintButton
