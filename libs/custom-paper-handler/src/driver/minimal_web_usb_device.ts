import { WebUSBDevice } from 'usb';

// Not all WebUSbDevice methods are implemented in the mock
export type MinimalWebUsbDevice = Pick<
  WebUSBDevice,
  | 'open'
  | 'close'
  | 'transferOut'
  | 'transferIn'
  | 'claimInterface'
  | 'selectConfiguration'
>;
