import { createInterface } from 'readline';
import { extractErrorMessage, throwIllegalValue } from '@votingworks/basics';

import { CommonAccessCard, CommonAccessCardDetails } from '../src/cac';
import { CardDetails, PinProtectedCard, StatefulCard } from '../src/card';
import { JavaCard } from '../src/java_card';
import { waitForReadyCardStatus } from './utils';

const usageMessage = 'Usage: check-pin [--cac|--vxsuite (default)]';

interface CheckPinInput {
  cardType: 'cac' | 'vxsuite';
}

function parseCommandLineArgs(args: readonly string[]): CheckPinInput {
  if (args.length > 1 || ![undefined, '--cac', '--vxsuite'].includes(args[0])) {
    console.error(usageMessage);
    process.exit(1);
  }
  return { cardType: args[0] === '--cac' ? 'cac' : 'vxsuite' };
}

async function checkPin({ cardType }: CheckPinInput): Promise<void> {
  const pin = await new Promise<string>((resolve) => {
    createInterface(process.stdin, process.stdout).question(
      'Enter PIN: ',
      resolve
    );
  });

  let card: PinProtectedCard &
    StatefulCard<CardDetails | CommonAccessCardDetails>;
  switch (cardType) {
    case 'cac': {
      card = new CommonAccessCard();
      break;
    }
    case 'vxsuite': {
      (process.env.VX_MACHINE_TYPE as string) = 'admin';
      card = new JavaCard();
      break;
    }
    default: {
      throwIllegalValue(cardType);
    }
  }

  await waitForReadyCardStatus(card);
  const checkPinResponse = await card.checkPin(pin);
  console.log(checkPinResponse);
}

/**
 * A script for checking a Java Card PIN
 */
export async function main(args: readonly string[]): Promise<void> {
  try {
    await checkPin(parseCommandLineArgs(args));
  } catch (error) {
    console.error(`❌ ${extractErrorMessage(error)}`);
    process.exit(1);
  }
}
