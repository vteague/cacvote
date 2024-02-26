import { getHardware } from '@votingworks/utils';
import { BrowserRouter } from 'react-router-dom';
import { Logger, LogSource } from '@votingworks/logging';
import {
  AppBase,
  AppErrorBoundary,
  BatteryLowAlert,
  SystemCallContextProvider,
} from '@votingworks/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoot, AppRootProps } from './app_root';
import {
  ApiClient,
  ApiClientContext,
  createApiClient,
  createQueryClient,
  systemCallApi,
} from './api';
import { SessionTimeLimitTracker } from './components/session_time_limit_tracker';

export interface Props {
  hardware?: AppRootProps['hardware'];
  logger?: AppRootProps['logger'];
  apiClient?: ApiClient;
  queryClient?: QueryClient;
}

export function App({
  hardware = getHardware(),
  logger = new Logger(LogSource.VxCentralScanFrontend, window.kiosk),
  apiClient = createApiClient(),
  queryClient = createQueryClient(),
}: Props): JSX.Element {
  return (
    <BrowserRouter>
      <AppBase
        defaultColorMode="desktop"
        defaultSizeMode="desktop"
        screenType="lenovoThinkpad15"
      >
        <AppErrorBoundary
          restartMessage="Please restart the machine."
          logger={logger}
        >
          <ApiClientContext.Provider value={apiClient}>
            <QueryClientProvider client={queryClient}>
              <SystemCallContextProvider api={systemCallApi}>
                <AppRoot hardware={hardware} logger={logger} />
                <SessionTimeLimitTracker />
                <BatteryLowAlert />
              </SystemCallContextProvider>
            </QueryClientProvider>
          </ApiClientContext.Provider>
        </AppErrorBoundary>
      </AppBase>
    </BrowserRouter>
  );
}
