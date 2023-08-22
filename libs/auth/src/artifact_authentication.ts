import { Buffer } from 'buffer';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import { sha256 } from 'js-sha256';
import path from 'path';
import recursiveReadDir from 'recursive-readdir';
import { Stream } from 'stream';
import {
  assert,
  err,
  ok,
  Result,
  throwIllegalValue,
} from '@votingworks/basics';

import { parseCert } from './certs';
import {
  ArtifactAuthenticationConfig,
  constructArtifactAuthenticationConfig,
} from './config';
import {
  extractPublicKeyFromCert,
  signMessage,
  verifyFirstCertWasSignedBySecondCert,
  verifySignature,
} from './openssl';
import { runCommand } from './shell';
import { constructPrefixedMessage } from './signatures';

/**
 * A machine-exported artifact whose authenticity we want to be able to verify
 */
export interface Artifact {
  type: 'ballot_package' | 'cast_vote_records';
  /** A file path for ballot packages and a directory path for cast vote records */
  path: string;
}

interface ArtifactSignatureBundle {
  signature: Buffer;
  signingMachineCert: Buffer;
}

//
// Helpers
//

/**
 * Recursively hashes every file in a directory and outputs a buffer that if written to a file
 * would look something like this:
 * 88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589  file-1.txt
 * e5e088a0b66163a0a26a5e053d2a4496dc16ab6e0e3dd1adf2d16aa84a078c9d  file-2.txt
 * 005c19658919186b85618c5870463eec8d9b8c1a9d00208a5352891ba5bbe086  sub-dir/file-3.txt
 *
 * File paths are sorted alphabetically to ensure a consistent output.
 */
async function hashDirectoryContents(directory: string): Promise<Buffer> {
  const filePaths = (await recursiveReadDir(directory)).sort();
  const fileHashEntries: Buffer[] = [];
  for (const filePath of filePaths) {
    const fileHash = sha256(await fs.readFile(filePath));
    const relativeFilePath = path.relative(directory, filePath);
    fileHashEntries.push(
      // Mimic the output of the sha256sum command-line tool
      Buffer.from(`${fileHash}  ${relativeFilePath}\n`, 'utf-8')
    );
  }
  return Buffer.concat(fileHashEntries);
}

async function constructMessage(artifact: Artifact): Promise<Stream> {
  switch (artifact.type) {
    case 'ballot_package': {
      const fileContents = createReadStream(artifact.path);
      return constructPrefixedMessage(artifact.type, fileContents);
    }
    case 'cast_vote_records': {
      const directoryContents = await hashDirectoryContents(artifact.path);
      return constructPrefixedMessage(artifact.type, directoryContents);
    }
    /* istanbul ignore next: Compile-time check for completeness */
    default: {
      throwIllegalValue(artifact.type);
    }
  }
}

async function constructArtifactSignatureBundle(
  config: ArtifactAuthenticationConfig,
  artifact: Artifact
): Promise<ArtifactSignatureBundle> {
  const message = await constructMessage(artifact);
  const messageSignature = await signMessage({
    message,
    signingPrivateKey: config.signingMachinePrivateKey,
  });
  const signingMachineCert = await fs.readFile(config.signingMachineCertPath);
  return { signature: messageSignature, signingMachineCert };
}

function serializeArtifactSignatureBundle(
  artifactSignatureBundle: ArtifactSignatureBundle
): Buffer {
  const { signature, signingMachineCert } = artifactSignatureBundle;
  return Buffer.concat([
    // ECC signature length can vary ever so slightly, hence the need to persist length metadata
    Buffer.from([signature.length]),
    signature,
    signingMachineCert,
  ]);
}

function deserializeArtifactSignatureBundle(
  buffer: Buffer
): ArtifactSignatureBundle {
  assert(
    buffer.length >= 500, // A conservative lower bound
    'Buffer is too small to reasonably contain an artifact signature bundle'
  );
  const signatureLength = buffer[0];
  assert(signatureLength !== undefined);
  assert(
    signatureLength >= 70 && signatureLength <= 72,
    `Signature length should be between 70 and 72, received ${signatureLength}`
  );
  const signature = buffer.subarray(1, signatureLength + 1);
  const signingMachineCert = buffer.subarray(signatureLength + 1);
  return { signature, signingMachineCert };
}

/**
 * Throws an error if validation fails
 */
async function validateSigningMachineCert(
  config: ArtifactAuthenticationConfig,
  signingMachineCert: Buffer,
  artifact: Artifact
): Promise<void> {
  const certDetails = await parseCert(signingMachineCert);
  switch (artifact.type) {
    case 'ballot_package': {
      assert(
        certDetails.component === 'admin',
        'Signing machine cert for ballot package should be a VxAdmin cert'
      );
      break;
    }
    case 'cast_vote_records': {
      assert(
        certDetails.component === 'central-scan' ||
          certDetails.component === 'scan',
        'Signing machine cert for CVR file should be a VxCentralScan or VxScan cert'
      );
      break;
    }
    /* istanbul ignore next: Compile-time check for completeness */
    default: {
      throwIllegalValue(artifact.type);
    }
  }
  await verifyFirstCertWasSignedBySecondCert(
    signingMachineCert,
    config.vxCertAuthorityCertPath
  );
}

/**
 * Throws an error if artifact authentication fails
 */
async function authenticateArtifactUsingArtifactSignatureBundle(
  config: ArtifactAuthenticationConfig,
  artifact: Artifact,
  artifactSignatureBundle: ArtifactSignatureBundle
): Promise<void> {
  const message = await constructMessage(artifact);
  const { signature: messageSignature, signingMachineCert } =
    artifactSignatureBundle;
  await validateSigningMachineCert(config, signingMachineCert, artifact);
  const signingMachinePublicKey = await extractPublicKeyFromCert(
    signingMachineCert
  );
  await verifySignature({
    message,
    messageSignature,
    publicKey: signingMachinePublicKey,
  });
}

function constructSignatureFilePath(
  artifact: Artifact,
  signatureFileDirectory: string = path.dirname(artifact.path)
): string {
  return path.join(
    signatureFileDirectory,
    `${path.basename(artifact.path)}.vxsig`
  );
}

//
// Exported functions
//

/**
 * Writes a signature file for the provided artifact that can later be used to verify the
 * artifact's authenticity. The signature file is written to
 * {signatureFileDirectory}/{artifactFileName}.vxsig, where signatureFileDirectory defaults to the
 * same directory as the artifact but can be overridden.
 */
export async function writeSignatureFile(
  artifact: Artifact,
  signatureFileDirectory?: string,
  /* istanbul ignore next */
  config: ArtifactAuthenticationConfig = constructArtifactAuthenticationConfig()
): Promise<void> {
  const signatureFilePath = constructSignatureFilePath(
    artifact,
    signatureFileDirectory
  );
  const artifactSignatureBundle = await constructArtifactSignatureBundle(
    config,
    artifact
  );
  await fs.writeFile(
    signatureFilePath,
    serializeArtifactSignatureBundle(artifactSignatureBundle)
  );

  // If writing to a USB drive (or any removable device), ensure that data is flushed to the device
  // before it's removed
  const isFileOnRemovableDevice =
    config.isFileOnRemovableDeviceOverride ??
    ((filePath: string) => filePath.startsWith('/media/'));
  if (isFileOnRemovableDevice(signatureFilePath)) {
    await runCommand(['sync', '-f', signatureFilePath]);
  }
}

/**
 * Verifies the authenticity of the provided artifact using its signature file, which is expected
 * to be found at the same file path as the artifact, but with a .vxsig extension, e.g.
 * /path/to/artifact.txt.vxsig. Returns an error Result if artifact authentication fails.
 */
export async function authenticateArtifactUsingSignatureFile(
  artifact: Artifact,
  /* istanbul ignore next */
  config: ArtifactAuthenticationConfig = constructArtifactAuthenticationConfig()
): Promise<Result<void, Error>> {
  try {
    const signatureFilePath = constructSignatureFilePath(artifact);
    const artifactSignatureBundle = deserializeArtifactSignatureBundle(
      await fs.readFile(signatureFilePath)
    );
    await authenticateArtifactUsingArtifactSignatureBundle(
      config,
      artifact,
      artifactSignatureBundle
    );
  } catch {
    // TODO: Log raw error
    return err(
      new Error(`Error authenticating ${artifact.path} using signature file`)
    );
  }
  return ok();
}
