import userEvent from '@testing-library/user-event';
import { Election } from '@votingworks/types';
import { Buffer } from 'buffer';
import { createMemoryHistory } from 'history';
import {
  MockApiClient,
  createMockApiClient,
  provideApi,
} from '../test/api_helpers';
import {
  blankElectionRecord,
  electionId,
  generalElectionRecord,
} from '../test/fixtures';
import { render, screen, waitFor, within } from '../test/react_testing_library';
import { withRoute } from '../test/routing_helpers';
import { ElectionInfoScreen } from './election_info_screen';
import { routes } from './routes';

let apiMock: MockApiClient;

beforeEach(() => {
  apiMock = createMockApiClient();
});

afterEach(() => {
  apiMock.assertComplete();
});

function renderScreen() {
  const { path } = routes.election(electionId).electionInfo;
  const history = createMemoryHistory({ initialEntries: [path] });
  render(
    provideApi(
      apiMock,
      withRoute(<ElectionInfoScreen />, {
        paramPath: routes.election(':electionId').electionInfo.path,
        history,
      })
    )
  );
  return history;
}

test('newly created election starts in edit mode', async () => {
  apiMock.getElection
    .expectCallWith({ electionId })
    .resolves(blankElectionRecord);
  renderScreen();
  await screen.findByRole('heading', { name: 'Election Info' });

  const titleInput = screen.getByLabelText('Title');
  expect(titleInput).toHaveValue('');
  expect(titleInput).toBeEnabled();

  const dateInput = screen.getByLabelText('Date');
  expect(dateInput).toHaveValue('');
  expect(dateInput).toBeEnabled();

  const typeInput = within(
    screen.getByText('Type').closest('label')!
  ).getByRole('radiogroup');
  expect(within(typeInput).getByLabelText('General')).toBeChecked();
  expect(within(typeInput).getByLabelText('Primary')).not.toBeChecked();
  for (const option of within(typeInput).getAllByRole('radio')) {
    expect(option).toBeEnabled();
  }

  const stateInput = screen.getByLabelText('State');
  expect(stateInput).toHaveValue('');
  expect(stateInput).toBeEnabled();

  const countyInput = screen.getByLabelText('County');
  expect(countyInput).toHaveValue('');
  expect(countyInput).toBeEnabled();

  const sealInput = screen.getByText('Seal').closest('label')!;
  expect(within(sealInput).queryByRole('img')).not.toBeInTheDocument();
  expect(within(sealInput).getByLabelText('Upload Seal Image')).toBeEnabled();

  screen.getByRole('button', { name: 'Save' });
  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  screen.getByRole('button', { name: 'Edit' });
  screen.getByRole('button', { name: 'Delete Election' });
});

test('edit and save election', async () => {
  const { election } = generalElectionRecord;
  apiMock.getElection
    .expectCallWith({ electionId })
    .resolves(generalElectionRecord);
  renderScreen();
  await screen.findByRole('heading', { name: 'Election Info' });

  const titleInput = screen.getByLabelText('Title');
  expect(titleInput).toHaveValue(election.title);
  expect(titleInput).toBeDisabled();

  const dateInput = screen.getByLabelText('Date');
  expect(dateInput).toHaveValue(election.date);
  expect(dateInput).toBeDisabled();

  const typeInput = within(
    screen.getByText('Type').closest('label')!
  ).getByRole('radiogroup');
  expect(within(typeInput).getByLabelText('General')).toBeChecked();
  for (const option of within(typeInput).getAllByRole('radio')) {
    expect(option).toBeDisabled();
  }

  const stateInput = screen.getByLabelText('State');
  expect(stateInput).toHaveValue(election.state);
  expect(stateInput).toBeDisabled();

  const countyInput = screen.getByLabelText('County');
  expect(countyInput).toHaveValue(election.county.name);
  expect(countyInput).toBeDisabled();

  const sealInput = screen.getByText('Seal').closest('label')!;
  expect(within(sealInput).getByRole('img')).toHaveAttribute(
    'src',
    `data:image/svg+xml;base64,${Buffer.from(election.seal).toString('base64')}`
  );
  expect(
    within(sealInput).queryByLabelText('Upload Seal Image')
  ).not.toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'Edit' }));

  userEvent.clear(titleInput);
  userEvent.type(titleInput, 'New Title');
  expect(titleInput).toHaveValue('New Title');

  userEvent.clear(dateInput);
  userEvent.type(dateInput, '2023-09-06');
  expect(dateInput).toHaveValue('2023-09-06');

  userEvent.click(within(typeInput).getByLabelText('Primary'));
  expect(within(typeInput).getByLabelText('General')).not.toBeChecked();
  expect(within(typeInput).getByLabelText('Primary')).toBeChecked();

  userEvent.clear(stateInput);
  userEvent.type(stateInput, 'New State');
  expect(stateInput).toHaveValue('New State');

  userEvent.clear(countyInput);
  userEvent.type(countyInput, 'New County');
  expect(countyInput).toHaveValue('New County');

  userEvent.upload(
    within(sealInput).getByLabelText('Upload Seal Image'),
    new File(['<svg>updated seal</svg>'], 'new_seal.svg')
  );
  await waitFor(() =>
    expect(within(sealInput).getByRole('img')).toHaveAttribute(
      'src',
      `data:image/svg+xml;base64,${Buffer.from(
        '<svg>updated seal</svg>'
      ).toString('base64')}`
    )
  );

  const updatedElection: Election = {
    ...election,
    title: 'New Title',
    date: '2023-09-06',
    type: 'primary',
    state: 'New State',
    county: {
      id: 'county-id',
      name: 'New County',
    },
    seal: '<svg>updated seal</svg>',
  };
  apiMock.updateElection
    .expectCallWith({ electionId, election: updatedElection })
    .resolves();
  apiMock.getElection
    .expectCallWith({ electionId })
    .resolves({ ...generalElectionRecord, election: updatedElection });

  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('button', { name: 'Edit' });
});

test('delete election', async () => {
  apiMock.getElection
    .expectCallWith({ electionId })
    .resolves(generalElectionRecord);
  const history = renderScreen();
  await screen.findByRole('heading', { name: 'Election Info' });

  apiMock.deleteElection.expectCallWith({ electionId }).resolves();

  userEvent.click(screen.getByRole('button', { name: 'Delete Election' }));
  // Redirects to elections list
  await waitFor(() =>
    expect(history.location.pathname).toEqual(routes.root.path)
  );
});
