import React from 'react'
import { CenteredLargeProse, CenteredScreen } from '../components/Layout'

const SetupCardReaderPage: React.FC = () => (
  <CenteredScreen infoBar={false}>
    <CenteredLargeProse>
      <h1>No Card Reader Detected</h1>
      <p>Attach a card reader.</p>
    </CenteredLargeProse>
  </CenteredScreen>
)

export default SetupCardReaderPage

/* istanbul ignore next */
export const DefaultPreview: React.FC = () => {
  return <SetupCardReaderPage />
}
