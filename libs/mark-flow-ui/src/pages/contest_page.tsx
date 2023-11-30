/* istanbul ignore file - tested via Mark/Mark-Scan */
import React from 'react';
import { useHistory, useParams } from 'react-router-dom';

import {
  CandidateVote,
  ContestId,
  ElectionDefinition,
  PrecinctId,
  VotesDict,
} from '@votingworks/types';
import { Screen, LinkButton, useScreenInfo, appStrings } from '@votingworks/ui';
import { assert, throwIllegalValue } from '@votingworks/basics';

import { Contest, ContestProps } from '../components/contest';
import { ButtonFooter } from '../components/button_footer';
import { DisplaySettingsButton } from '../components/display_settings_button';
import { ContestsWithMsEitherNeither } from '../utils/ms_either_neither_contests';

interface ContestPageProps {
  contests: ContestsWithMsEitherNeither;
  electionDefinition?: ElectionDefinition;
  getContestUrl: (contestIndex: number) => string;
  getStartPageUrl: () => string;
  getReviewPageUrl: (contestId?: ContestId) => string;
  precinctId?: PrecinctId;
  updateVote: ContestProps['updateVote'];
  votes: VotesDict;
}

interface ContestParams {
  contestNumber: string;
}

export function ContestPage(props: ContestPageProps): JSX.Element {
  const { contestNumber } = useParams<ContestParams>();
  const history = useHistory();
  const isReviewMode = history.location.hash === '#review';

  const {
    contests,
    electionDefinition,
    getContestUrl,
    getStartPageUrl,
    getReviewPageUrl,
    precinctId,
    updateVote,
    votes,
  } = props;

  const screenInfo = useScreenInfo();

  // eslint-disable-next-line vx/gts-safe-number-parse
  const currentContestIndex = parseInt(contestNumber, 10);
  const contest = contests[currentContestIndex];

  const prevContestIndex = currentContestIndex - 1;
  const prevContest = contests[prevContestIndex];

  const nextContestIndex = currentContestIndex + 1;
  const nextContest = contests[nextContestIndex];

  assert(
    electionDefinition,
    'electionDefinition is required to render ContestPage'
  );
  assert(
    typeof precinctId === 'string',
    'precinctId is required to render ContestPage'
  );

  const vote = votes[contest.id];

  const ballotContestNumber = currentContestIndex + 1;
  const ballotContestsLength = contests.length;

  const isVoteComplete = (() => {
    switch (contest.type) {
      case 'yesno':
        return !!vote;
      case 'candidate':
        return contest.seats === ((vote as CandidateVote) ?? []).length;
      case 'ms-either-neither':
        return (
          votes[contest.pickOneContestId]?.length === 1 ||
          votes[contest.eitherNeitherContestId]?.[0] ===
            contest.neitherOption.id
        );
      /* istanbul ignore next */
      default:
        throwIllegalValue(contest);
    }
  })();

  const nextContestButton = (
    <LinkButton
      id="next"
      rightIcon="Next"
      variant={isVoteComplete ? 'primary' : 'neutral'}
      to={nextContest ? getContestUrl(nextContestIndex) : getReviewPageUrl()}
    >
      {appStrings.buttonNext()}
    </LinkButton>
  );

  const previousContestButton = (
    <LinkButton
      icon="Previous"
      id="previous"
      to={prevContest ? getContestUrl(prevContestIndex) : getStartPageUrl()}
    >
      {/* TODO(kofi): Maybe something like "Previous" would translate better in this context? */}
      {appStrings.buttonBack()}
    </LinkButton>
  );

  const reviewScreenButton = (
    <LinkButton
      rightIcon="Next"
      variant={isVoteComplete ? 'primary' : 'neutral'}
      to={getReviewPageUrl(contest.id)}
      id="next"
    >
      {appStrings.buttonReview()}
    </LinkButton>
  );

  const settingsButton = <DisplaySettingsButton />;

  return (
    <Screen flexDirection={screenInfo.isPortrait ? 'column' : 'row'}>
      <Contest
        breadcrumbs={{
          ballotContestCount: ballotContestsLength,
          contestNumber: ballotContestNumber,
        }}
        election={electionDefinition.election}
        contest={contest}
        votes={votes}
        updateVote={updateVote}
      />
      <ButtonFooter>
        {isReviewMode ? (
          <React.Fragment>
            {settingsButton}
            {reviewScreenButton}
          </React.Fragment>
        ) : (
          <React.Fragment>
            {previousContestButton}
            {settingsButton}
            {nextContestButton}
          </React.Fragment>
        )}
      </ButtonFooter>
    </Screen>
  );
}