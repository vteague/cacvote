import { createContext } from 'react'
import { MachineConfig } from '../config/types'
import { ElectionDefinition } from '../util/ballot-package'

interface AppContextInterface {
  usbDriveStatus: string
  usbDriveEject: () => void
  machineConfig: MachineConfig
  electionDefinition?: ElectionDefinition
  electionHash?: string
}

const appContext: AppContextInterface = {
  usbDriveStatus: '',
  usbDriveEject: () => undefined,
  machineConfig: { machineId: '0000' },
  electionDefinition: undefined,
  electionHash: undefined,
}

const AppContext = createContext(appContext)

export default AppContext
