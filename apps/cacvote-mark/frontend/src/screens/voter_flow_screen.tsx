import { assert, find, throwIllegalValue } from '@votingworks/basics';
import {
  ContestId,
  OptionalVote,
  VotesDict,
  getContests,
} from '@votingworks/types';
import { useState } from 'react';
import { getElectionConfiguration, getVoterStatus } from '../api';
import * as Registration from './registration';
import * as Voting from './voting';
import { randomInt } from '../random';

interface InitState {
  type: 'init';
}

interface MarkState {
  type: 'mark';
  contestIndex: number;
  votes: VotesDict;
}

interface ReviewOnscreenState {
  type: 'review_onscreen';
  votes: VotesDict;
  contestIndex?: number;
}

interface PrintBallotState {
  type: 'print_ballot';
  votes: VotesDict;
  serialNumber: number;
}

interface ReviewPrintedBallotState {
  type: 'review_printed';
  votes: VotesDict;
  serialNumber: number;
}

interface DestroyPrintedBallotState {
  type: 'destroy_printed';
  votes: VotesDict;
  serialNumber: number;
}

interface SubmitState {
  type: 'submit';
  votes: VotesDict;
  serialNumber: number;
}

interface PostVoteState {
  type: 'post_vote';
}

interface PromptToRemoveCommonAccessCardState {
  type: 'prompt_to_remove_common_access_card';
}

type VoterFlowState =
  | InitState
  | MarkState
  | ReviewOnscreenState
  | PrintBallotState
  | ReviewPrintedBallotState
  | DestroyPrintedBallotState
  | SubmitState
  | PostVoteState
  | PromptToRemoveCommonAccessCardState;

interface RegisteredStateScreenProps {
  onIsVotingSessionInProgressChanged: (
    isVotingSessionInProgress: boolean
  ) => void;
}

function RegisteredStateScreen({
  onIsVotingSessionInProgressChanged,
}: RegisteredStateScreenProps): JSX.Element | null {
  const getElectionConfigurationQuery = getElectionConfiguration.useQuery();
  const electionConfiguration = getElectionConfigurationQuery.data;
  const [voterFlowState, setVoterFlowState] = useState<VoterFlowState>({
    type: 'init',
  });

  if (!electionConfiguration) {
    return null;
  }

  const { electionDefinition, ballotStyleId, precinctId } =
    electionConfiguration;
  const ballotStyle = find(
    electionDefinition.election.ballotStyles,
    (bs) => bs.id === ballotStyleId
  );
  const contests = getContests({
    election: electionDefinition.election,
    ballotStyle,
  });

  function onStartVoting() {
    onIsVotingSessionInProgressChanged(true);
    setVoterFlowState((prev) => {
      assert(prev?.type === 'init');
      return {
        type: 'mark',
        contestIndex: 0,
        votes: {},
      };
    });
  }

  function onReviewContestAtIndex(contestIndex: number) {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'review_onscreen');
      return {
        ...prev,
        contestIndex,
      };
    });
  }

  function onReviewConfirm() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'review_onscreen');
      const serialNumber = randomInt();
      return {
        type: 'print_ballot',
        votes: prev.votes,
        serialNumber,
      };
    });
  }

  function updateVote(contestId: ContestId, vote: OptionalVote) {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'mark' || prev?.type === 'review_onscreen');
      return {
        ...prev,
        votes: {
          ...prev.votes,
          [contestId]: vote,
        },
      };
    });
  }

  function goMarkNext() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'mark');
      if (prev.contestIndex === contests.length - 1) {
        return {
          type: 'review_onscreen',
          votes: prev.votes,
        };
      }

      return {
        ...prev,
        contestIndex: prev.contestIndex + 1,
      };
    });
  }

  function onReturnToReview() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'review_onscreen');
      return {
        type: 'review_onscreen',
        votes: prev.votes,
      };
    });
  }

  function goMarkPrevious() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'mark');
      return {
        ...prev,
        contestIndex: Math.max(0, prev.contestIndex - 1),
      };
    });
  }

  function onPrintBallotCompleted() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'print_ballot');
      return {
        type: 'review_printed',
        votes: prev.votes,
        serialNumber: prev.serialNumber,
      };
    });
  }

  function onConfirmPrintedBallotSelections() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'review_printed');
      return {
        type: 'submit',
        votes: prev.votes,
        serialNumber: prev.serialNumber,
      };
    });
  }

  function onRejectPrintedBallotSelections() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'review_printed');
      return {
        type: 'destroy_printed',
        votes: prev.votes,
        serialNumber: prev.serialNumber,
      };
    });
  }

  function onConfirmBallotDestroyed() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'destroy_printed');
      return {
        type: 'review_onscreen',
        votes: prev.votes,
      };
    });
  }

  function onCancelBallotDestroyed() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'destroy_printed');
      return {
        type: 'review_printed',
        votes: prev.votes,
        serialNumber: prev.serialNumber,
      };
    });
  }

  function onConfirmBallotSealedInEnvelope() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'post_vote');
      return {
        type: 'prompt_to_remove_common_access_card',
      };
    });
  }

  function onSubmitSuccess() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'submit');
      return {
        type: 'post_vote',
      };
    });
  }

  function onCancelSubmit() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'submit');
      return {
        type: 'review_printed',
        votes: prev.votes,
        serialNumber: prev.serialNumber,
      };
    });
  }

  function onReturnToSealBallotInEnvelope() {
    setVoterFlowState((prev) => {
      assert(prev?.type === 'prompt_to_remove_common_access_card');
      return {
        type: 'post_vote',
      };
    });
  }

  switch (voterFlowState.type) {
    case 'init':
      return (
        <Voting.StartScreen
          electionDefinition={electionDefinition}
          onStartVoting={onStartVoting}
        />
      );

    case 'mark':
      return (
        <Voting.MarkScreen
          electionDefinition={electionDefinition}
          contests={contests}
          contestIndex={voterFlowState.contestIndex}
          votes={voterFlowState.votes}
          updateVote={updateVote}
          goNext={goMarkNext}
          goPrevious={goMarkPrevious}
        />
      );

    case 'review_onscreen':
      if (typeof voterFlowState.contestIndex === 'number') {
        return (
          <Voting.ReviewMarkScreen
            electionDefinition={electionDefinition}
            contests={contests}
            contestIndex={voterFlowState.contestIndex}
            votes={voterFlowState.votes}
            updateVote={updateVote}
            onReturnToReview={onReturnToReview}
          />
        );
      }

      return (
        <Voting.ReviewOnscreenBallotScreen
          electionDefinition={electionDefinition}
          contests={contests}
          precinctId={precinctId}
          votes={voterFlowState.votes}
          goToIndex={onReviewContestAtIndex}
          onConfirm={onReviewConfirm}
        />
      );

    case 'print_ballot':
      return (
        <Voting.PrintBallotScreen
          electionDefinition={electionDefinition}
          ballotStyleId={ballotStyleId}
          precinctId={precinctId}
          votes={voterFlowState.votes}
          generateBallotId={() => `${voterFlowState.serialNumber}`}
          // TODO: use live vs test mode?
          isLiveMode={false}
          onPrintCompleted={onPrintBallotCompleted}
        />
      );

    case 'review_printed':
      return (
        <Voting.ReviewPrintedBallotScreen
          onConfirm={onConfirmPrintedBallotSelections}
          onReject={onRejectPrintedBallotSelections}
        />
      );

    case 'destroy_printed':
      return (
        <Voting.DestroyBallotScreen
          onConfirm={onConfirmBallotDestroyed}
          onCancel={onCancelBallotDestroyed}
        />
      );

    case 'submit':
      return (
        <Voting.SubmitScreen
          votes={voterFlowState.votes}
          serialNumber={voterFlowState.serialNumber}
          onSubmitSuccess={onSubmitSuccess}
          onCancel={onCancelSubmit}
        />
      );

    case 'post_vote':
      return (
        <Voting.SealBallotInEnvelopeScreen
          onNext={onConfirmBallotSealedInEnvelope}
        />
      );

    case 'prompt_to_remove_common_access_card':
      return (
        <Voting.RemoveCommonAccessCardToPrintMailLabelScreen
          onCancel={onReturnToSealBallotInEnvelope}
        />
      );

    default:
      throwIllegalValue(voterFlowState);
  }
}

export function VoterFlowScreen(): JSX.Element | null {
  const [isVotingSessionInProgress, setIsVotingSessionInProgress] =
    useState(false);
  const getVoterStatusQuery = getVoterStatus.useQuery();
  const voterStatus = getVoterStatusQuery.data;

  if (!voterStatus) {
    return null;
  }

  if (isVotingSessionInProgress) {
    return (
      <RegisteredStateScreen
        onIsVotingSessionInProgressChanged={setIsVotingSessionInProgress}
      />
    );
  }

  switch (voterStatus.status) {
    case 'unregistered':
      return <Registration.StartScreen />;

    case 'registration_pending':
      return <Registration.StatusScreen />;

    case 'registered':
      return (
        <RegisteredStateScreen
          onIsVotingSessionInProgressChanged={setIsVotingSessionInProgress}
        />
      );

    case 'voted':
      return <Voting.AlreadyVotedScreen />;

    default:
      throwIllegalValue(voterStatus.status);
  }
}
