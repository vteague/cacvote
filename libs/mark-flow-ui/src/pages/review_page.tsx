/* istanbul ignore file - tested via Mark/Mark-Scan */
import styled from 'styled-components';
import {
  LinkButton,
  H1,
  WithScrollButtons,
  appStrings,
  AudioOnly,
  ReadOnLoad,
} from '@votingworks/ui';

import { assert } from '@votingworks/basics';

import { ElectionDefinition, PrecinctId, VotesDict } from '@votingworks/types';
import { Review, ReviewProps } from '../components/review';
import { ContestsWithMsEitherNeither } from '../utils/ms_either_neither_contests';
import { VoterScreen } from '../components/voter_screen';

const ContentHeader = styled(ReadOnLoad)`
  padding: 0.5rem 0.75rem 0;
`;

export interface ReviewPageProps {
  contests: ContestsWithMsEitherNeither;
  electionDefinition?: ElectionDefinition;
  precinctId?: PrecinctId;
  printScreenUrl: string;
  returnToContest?: ReviewProps['returnToContest'];
  votes: VotesDict;
}

export function ReviewPage(props: ReviewPageProps): JSX.Element {
  const {
    contests,
    electionDefinition,
    precinctId,
    printScreenUrl,
    returnToContest,
    votes,
  } = props;

  assert(
    electionDefinition,
    'electionDefinition is required to render ReviewPage'
  );
  assert(
    typeof precinctId !== 'undefined',
    'precinctId is required to render ReviewPage'
  );

  const printMyBallotButton = (
    <LinkButton to={printScreenUrl} id="next" variant="primary" icon="Done">
      {appStrings.buttonPrintBallot()}
    </LinkButton>
  );

  return (
    <VoterScreen actionButtons={printMyBallotButton}>
      <ContentHeader>
        <H1>{appStrings.titleBmdReviewScreen()}</H1>
        <AudioOnly>
          {appStrings.instructionsBmdReviewPageNavigation()}{' '}
          {appStrings.instructionsBmdReviewPageChangingVotes()}
        </AudioOnly>
      </ContentHeader>
      <WithScrollButtons>
        <Review
          election={electionDefinition.election}
          contests={contests}
          precinctId={precinctId}
          votes={votes}
          returnToContest={returnToContest}
        />
      </WithScrollButtons>
    </VoterScreen>
  );
}
