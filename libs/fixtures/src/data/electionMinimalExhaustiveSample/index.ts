import { asText as standardCvrsAsText } from './cvrFiles/standard.jsonl';
import { asText as standardLiveCvrsAsText } from './cvrFiles/standard.live.jsonl';
import { asText as batchResultsCsvAsText } from './csvFiles/batchResults.csv';
import { asText as finalResultsCsvAsText } from './csvFiles/finalResults.csv';

export * as standardCvrFile from './cvrFiles/standard.jsonl';
export * as standardLiveCvrFile from './cvrFiles/standard.live.jsonl';
export * as partial1CvrFile from './cvrFiles/partial1.jsonl';
export * as partial2CvrFile from './cvrFiles/partial2.jsonl';

export const cvrData = standardCvrsAsText();
export const liveCvrsData = standardLiveCvrsAsText();
export const batchCsvData = batchResultsCsvAsText();
export const finalCsvData = finalResultsCsvAsText();

export * as ballotPackage from './ballot-package.zip';
export {
  election,
  electionDefinition,
} from './electionMinimalExhaustiveSample.json';
