import { electionSampleNoSealDefinition } from '@votingworks/fixtures';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { render as renderWithBallotContext } from '../../test/test_utils';
import { createApiMock, ApiMock } from '../../test/helpers/mock_api_client';
import { screen } from '../../test/react_testing_library';
import { ValidateBallotPage } from './validate_ballot_page';
import { getMockInterpretation } from '../../test/helpers/interpretation';

let apiMock: ApiMock;
beforeEach(() => {
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

test('calls invalidateBallot if voter indicates their ballot is incorrect', async () => {
  const electionDefinition = electionSampleNoSealDefinition;
  const mockInterpretation = getMockInterpretation(electionDefinition);
  apiMock.expectGetInterpretation(mockInterpretation);
  apiMock.expectGetElectionDefinition(electionDefinition);
  apiMock.expectInvalidateBallot();
  renderWithBallotContext(
    <Route path="/validate" component={ValidateBallotPage} />,
    {
      route: '/validate',
      precinctId: electionDefinition.election.precincts[0].id,
      ballotStyleId: electionDefinition.election.ballotStyles[0].id,
      apiMock,
    }
  );

  await screen.findByText('Review Your Votes');
  apiMock.expectGetInterpretation(mockInterpretation);
  userEvent.click(screen.getByText('My Ballot is Incorrect'));
});
