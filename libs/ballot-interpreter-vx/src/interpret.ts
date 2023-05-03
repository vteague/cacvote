import { Result, err, ok } from '@votingworks/basics';
import {
  CompletedBallot,
  ElectionDefinition,
  SheetOf,
  mapSheet,
} from '@votingworks/types';
import { decodeBallot } from '@votingworks/ballot-encoder';
import { DetectQrCodeError, detectInBallot } from './utils/qrcode';
import { DetectedQrCode } from './types';

export interface Interpretation {
  ballot: CompletedBallot;
  normalizedImages: SheetOf<ImageData>;
}

export type InterpretError =
  | {
      type: 'votes-not-found';
      source: SheetOf<DetectQrCodeError>;
    }
  | {
      type: 'multiple-qr-codes';
      source: SheetOf<DetectedQrCode>;
    };

export type InterpretResult = Result<Interpretation, InterpretError>;

/**
 * Interprets a ballot card as a VX BMD ballot.
 */
export async function interpret(
  electionDefinition: ElectionDefinition,
  card: SheetOf<ImageData>
): Promise<InterpretResult> {
  const [frontResult, backResult] = await mapSheet(card, detectInBallot);

  if (frontResult.isErr() && backResult.isErr()) {
    return err({
      type: 'votes-not-found',
      source: [frontResult.err(), backResult.err()],
    });
  }

  if (frontResult.isOk() && backResult.isOk()) {
    return err({
      type: 'multiple-qr-codes',
      source: [frontResult.ok(), backResult.ok()],
    });
  }

  const foundQrCode = (frontResult.ok() ?? backResult.ok()) as DetectedQrCode;
  return ok({
    ballot: decodeBallot(electionDefinition.election, foundQrCode.data),
    normalizedImages: [
      frontResult.isOk() ? card[0] : card[1],
      frontResult.isOk() ? card[1] : card[0],
    ],
  });
}
