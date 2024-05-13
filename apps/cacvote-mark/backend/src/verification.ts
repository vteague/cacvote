/* eslint-disable max-classes-per-file */
import { constructTlv, parseTlvList } from '@votingworks/auth';
import { unsafeParse } from '@votingworks/types';
import { Buffer } from 'buffer';
import { Uuid, UuidSchema } from './cacvote-server/types';

/**
 * A payload for verifying a ballot. This payload is encoded as a TLV structure
 * with the following tags:
 * - 0x01: Common Access Card ID (string)
 * - 0x02: Election object ID (UUID)
 * - 0x03: SHA256(Encrypted ballot signature)
 */
export class BallotVerificationPayload {
  /**
   * Create a new ballot verification payload.
   *
   * @param commonAccessCardId The common access card ID.
   * @param electionObjectId The election object ID.
   * @param encryptedBallotSignatureHash The SHA256 hash of the encrypted ballot signature.
   */
  constructor(
    private readonly commonAccessCardId: string,
    private readonly electionObjectId: Uuid,
    private readonly encryptedBallotSignatureHash: Buffer
  ) {}

  private static readonly COMMON_ACCESS_CARD_ID_TAG = 0x01;
  private static readonly ELECTION_OBJECT_ID_TAG = 0x02;
  private static readonly ENCRYPTED_BALLOT_SIGNATURE_HASH_TAG = 0x03;

  /**
   * Encodes the payload as a TLV structure. Inverse of
   * `BallotVerificationPayload.decode`.
   */
  encode(): Buffer {
    return Buffer.concat([
      constructTlv(
        BallotVerificationPayload.COMMON_ACCESS_CARD_ID_TAG,
        Buffer.from(this.commonAccessCardId)
      ),
      constructTlv(
        BallotVerificationPayload.ELECTION_OBJECT_ID_TAG,
        Buffer.from(this.electionObjectId)
      ),
      constructTlv(
        BallotVerificationPayload.ENCRYPTED_BALLOT_SIGNATURE_HASH_TAG,
        this.encryptedBallotSignatureHash
      ),
    ]);
  }

  /**
   * Decodes a TLV structure into a ballot verification payload. Inverse of
   * `BallotVerificationPayload::encode`.
   */
  static decode(data: Buffer): BallotVerificationPayload {
    const [commonAccessCardIdBytes, electionObjectIdBytes, signatureHashBytes] =
      parseTlvList(
        [
          BallotVerificationPayload.COMMON_ACCESS_CARD_ID_TAG,
          BallotVerificationPayload.ELECTION_OBJECT_ID_TAG,
          BallotVerificationPayload.ENCRYPTED_BALLOT_SIGNATURE_HASH_TAG,
        ],
        data
      );

    const commonAccessCardId = commonAccessCardIdBytes.toString('utf-8');
    const electionObjectId = unsafeParse(
      UuidSchema,
      electionObjectIdBytes.toString('utf-8')
    );

    const signatureHash = signatureHashBytes;

    return new BallotVerificationPayload(
      commonAccessCardId,
      electionObjectId,
      signatureHash
    );
  }
}

/**
 * A buffer that has been signed.
 *
 * This buffer is encoded as a TLV structure with the following tags:
 * - 0x04: Buffer
 * - 0x05: Signature
 *
 */
export class SignedBuffer {
  constructor(
    private readonly buffer: Buffer,
    private readonly signature: Buffer
  ) {}

  private static readonly BUFFER_TAG = 0x04;
  private static readonly SIGNATURE_TAG = 0x05;

  /**
   * Encodes the payload as a TLV structure. Inverse of `SignedBuffer.decode`.
   */
  encode(): Buffer {
    return Buffer.concat([
      constructTlv(SignedBuffer.BUFFER_TAG, this.buffer),
      constructTlv(SignedBuffer.SIGNATURE_TAG, this.signature),
    ]);
  }

  /**
   * Decodes a TLV structure into a `SignedBuffer`. Inverse of
   * `SignedBuffer::encode`.
   */
  static decode(data: Buffer): SignedBuffer {
    const [buffer, signature] = parseTlvList(
      [SignedBuffer.BUFFER_TAG, SignedBuffer.SIGNATURE_TAG],
      data
    );

    return new SignedBuffer(buffer, signature);
  }
}
