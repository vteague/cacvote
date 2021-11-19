import { parseElection } from '@votingworks/types';
import { join } from 'path';
import electionJson from './election.json';

export const election = parseElection(electionJson);
export const ballotPdf = join(__dirname, 'ballot.pdf');
export const filledInPage1 = join(__dirname, 'filled-in-p1.png');
export const filledInPage2 = join(__dirname, 'filled-in-p2.png');