import path from 'path';
import * as castVoteRecords from './castVoteRecords';

export * as definitionXml from './definition.xml';
export { election, electionDefinition } from './election.json';
export * as electionJson from './election.json';
export * as scanMarkedFront from './scan-marked-front.jpeg';
export * as scanMarkedFrontUnmarkedWriteIns from './scan-marked-front-unmarked-write-ins.jpeg';
export * as scanMarkedBackUnmarkedWriteIns from './scan-marked-back-unmarked-write-ins.jpeg';
export * as scanMarkedFrontUnmarkedWriteInsOvervote from './scan-marked-front-unmarked-write-ins-overvote.jpeg';
export * as scanMarkedBackUnmarkedWriteInsOvervote from './scan-marked-back-unmarked-write-ins-overvote.jpeg';
export * as scanMarkedBack from './scan-marked-back.jpeg';
export * as scanMarkedOvervoteFront from './scan-marked-overvote-front.jpeg';
export * as scanMarkedOvervoteBack from './scan-marked-overvote-back.jpeg';
export * as scanMarkedStretchFront from './scan-marked-stretch-front.jpeg';
export * as scanMarkedStretchBack from './scan-marked-stretch-back.jpeg';
export * as scanMarkedStretchExtraFront from './scan-marked-stretch-extra-front.jpeg';
export * as scanMarkedStretchExtraBack from './scan-marked-stretch-extra-back.jpeg';
export * as scanMarkedStretchMarkFront from './scan-marked-stretch-mark-front.jpeg';
export * as scanMarkedStretchMarkBack from './scan-marked-stretch-mark-back.jpeg';
export * as scanMarkedStretchMidFront from './scan-marked-stretch-mid-front.jpeg';
export * as scanMarkedStretchMidBack from './scan-marked-stretch-mid-back.jpeg';
export * as scanMarkedTimingMarkHoleFront from './scan-marked-timing-mark-hole-front.jpeg';
export * as scanMarkedTimingMarkHoleBack from './scan-marked-timing-mark-hole-back.jpeg';
export * as scanMarkedUnevenCropFront from './scan-marked-uneven-crop-front.jpeg';
export * as scanMarkedUnevenCropBack from './scan-marked-uneven-crop-back.jpeg';
export * as scanMarkedGrainyTimingMarksFront from './scan-marked-grainy-timing-marks-front.jpeg';
export * as scanMarkedGrainyTimingMarksBack from './scan-marked-grainy-timing-marks-back.jpeg';
export * as scanUnmarkedFront from './scan-unmarked-front.jpeg';
export * as scanUnmarkedBack from './scan-unmarked-back.jpeg';
export * as templateFront from './template-front.jpeg';
export * as templateBack from './template-back.jpeg';
export * as templatePdf from './template.pdf';

export const castVoteRecordExport = {
  asDirectoryPath: () =>
    path.join(castVoteRecords.asDirectoryPath(), 'generated'),
} as const;

export const manualCastVoteRecordExport = {
  asDirectoryPath: () => path.join(castVoteRecords.asDirectoryPath(), 'manual'),
} as const;
