import { assert } from '@votingworks/basics';
import React, { useContext } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import DomPurify from 'dompurify';
import {
  Election,
  CandidateContest,
  YesNoContest,
  AnyContest,
  PartyIdSchema,
  unsafeParse,
  getContestDistrictName,
  ContestId,
} from '@votingworks/types';

import {
  Button,
  SegmentedButtonDeprecated as SegmentedButton,
  Prose,
  Text,
} from '@votingworks/ui';
import { readFileAsyncAsString } from '@votingworks/utils';
import { InputEventFunction, TextareaEventFunction } from '../config/types';

import { NavigationScreen } from '../components/navigation_screen';
import { AppContext } from '../contexts/app_context';
import {
  CandidateContestChoices,
  Contest,
} from '../components/hand_marked_paper_ballot';
import { TextInput } from '../components/text_input';
import { TextareaAutosize } from '../components/textarea';
import { BubbleMark } from '../components/bubble_mark';
import { FileInputButton } from '../components/file_input_button';
import { configure } from '../api';

const PageHeader = styled.div`
  margin-bottom: 2rem;
`;

const Columns = styled.div`
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  > div:first-child {
    margin-left: 1rem;
  }
  > div:last-child {
    flex: 1;
  }
`;

const RenderedContest = styled.div`
  position: sticky;
  top: 0;
`;
const Paper = styled.div<{ isNarrow?: boolean }>`
  background: #ffffff;
  width: ${({ isNarrow }) => (isNarrow ? '312px' : '477px')};
  font-size: 18px;
  > div {
    margin-bottom: 0;
  }
`;

const StyledField = styled.div`
  margin-bottom: 0.75rem;
  label {
    display: block;
    font-size: 0.85rem;
  }
`;
function TextField({
  disabled = false,
  name,
  label = name,
  min,
  onChange,
  optional,
  pattern,
  step,
  type = 'text',
  value,
}: {
  disabled?: boolean;
  name: string;
  label?: string;
  min?: number;
  onChange: InputEventFunction | TextareaEventFunction;
  optional?: boolean;
  pattern?: string;
  step?: number;
  type?: 'text' | 'textarea' | 'number';
  value?: string | number;
}) {
  return (
    <StyledField>
      <label htmlFor={name}>
        <Text as="span" small>
          {label}
        </Text>
        {optional && (
          <Text as="span" small muted>
            {' '}
            (optional)
          </Text>
        )}
      </label>
      {type === 'textarea' ? (
        <TextareaAutosize
          id={name}
          name={name}
          disabled={disabled}
          defaultValue={value}
          onChange={onChange as TextareaEventFunction}
        />
      ) : (
        <TextInput
          id={name}
          name={name}
          type={type}
          disabled={disabled}
          defaultValue={value}
          onChange={onChange as InputEventFunction}
          min={min}
          pattern={pattern}
          step={step}
        />
      )}
    </StyledField>
  );
}

function ToggleField({
  name,
  label = name,
  trueLabel = 'true',
  falseLabel = 'false',
  value,
  optional,
  onChange,
  disabled,
}: {
  name: string;
  label?: string;
  trueLabel?: string;
  falseLabel?: string;
  value: boolean;
  optional?: boolean;
  onChange: (field: { name: string; value: boolean }) => void;
  disabled?: boolean;
}) {
  return (
    <StyledField>
      <label htmlFor={name}>
        <strong>{label}:</strong>
        {optional && <small> (optional)</small>}
      </label>
      {disabled ? (
        value ? (
          trueLabel
        ) : (
          falseLabel
        )
      ) : (
        <SegmentedButton>
          <Button
            small
            disabled={value}
            value={{ name, value: true }}
            onPress={onChange}
          >
            {trueLabel}
          </Button>
          <Button
            small
            disabled={!value}
            value={{ name, value: false }}
            onPress={onChange}
          >
            {falseLabel}
          </Button>
        </SegmentedButton>
      )}
    </StyledField>
  );
}

export function DefinitionContestsScreen({
  allowEditing,
}: {
  allowEditing: boolean;
}): JSX.Element {
  const configureMutation = configure.useMutation();
  const { electionDefinition } = useContext(AppContext);
  assert(electionDefinition);
  const { election } = electionDefinition;
  const { contestId } = useParams<{ contestId: ContestId }>();
  const contestIndex = election.contests.findIndex((c) => c.id === contestId);
  const contest = election.contests[contestIndex];

  function saveContest(newContest: AnyContest) {
    if (allowEditing) {
      const newElection: Election = {
        ...election,
        contests: [
          ...election.contests.slice(0, contestIndex),
          newContest,
          ...election.contests.slice(contestIndex + 1),
        ],
      };
      // we expect a stringified election to be valid election JSON
      configureMutation.mutate({ electionData: JSON.stringify(newElection) });
    }
  }

  const saveTextField: InputEventFunction = (event) => {
    const { name, value: targetValue, type } = event.currentTarget;
    let value: string | number = targetValue;
    if (type === 'number') {
      // eslint-disable-next-line vx/gts-safe-number-parse
      value = parseInt(value, 10);
    }
    if (name === 'seats' && value < 1) {
      value = 1;
    }
    saveContest({
      ...contest,
      [name]: value,
    });
  };

  function saveToggleField(field: { name: string; value: boolean }) {
    const { name, value } = field;
    saveContest({
      ...contest,
      [name]: value,
    });
  }

  const saveCandidateTextField: InputEventFunction = (event) => {
    const { name, value: targetValue } = event.currentTarget;
    const nameParts = name.split('.');
    // eslint-disable-next-line vx/gts-safe-number-parse
    const candidateIndex = parseInt(nameParts[0], 10);
    const candidateKey = nameParts[1];
    const candidateContest = contest as CandidateContest;
    const { candidates } = candidateContest;
    const newCandidates = [...candidates];

    switch (candidateKey) {
      case 'id':
        newCandidates[candidateIndex] = {
          ...candidates[candidateIndex],
          id: targetValue,
        };
        break;

      case 'name':
        newCandidates[candidateIndex] = {
          ...candidates[candidateIndex],
          name: targetValue,
        };
        break;

      case 'partyIds':
        newCandidates[candidateIndex] = {
          ...candidates[candidateIndex],
          partyIds: targetValue
            .split(',')
            .map((id) => unsafeParse(PartyIdSchema, id.trim())),
        };
        break;

      default:
        throw new Error(`Unknown candidate key: ${candidateKey}`);
    }

    saveContest({
      ...candidateContest,
      candidates: newCandidates,
    });
  };

  const appendSvgToDescription: InputEventFunction = async (event) => {
    const { files } = event.currentTarget;
    const file = files?.[0];
    if (file?.type === 'image/svg+xml') {
      const yesNoContest = contest as YesNoContest;
      try {
        const fileContent = await readFileAsyncAsString(file);
        const description = `${yesNoContest.description}

${fileContent}`;
        saveContest({
          ...yesNoContest,
          description,
        });
      } catch (error) {
        console.error('appendSvgToDescription failed', error); // eslint-disable-line no-console
      }
    } else {
      console.error('Only SVG images are supported.'); // eslint-disable-line no-console
    }
  };

  if (contestId && contest) {
    return (
      <NavigationScreen>
        <PageHeader>
          <Prose maxWidth={false}>
            <h1>{allowEditing ? 'Edit' : 'View'} Contest</h1>
            <p>
              {allowEditing
                ? 'Disabled fields are shown for informational purpose and can be edited in the JSON Editor if necessary.'
                : 'Editing currently disabled.'}
            </p>
          </Prose>
        </PageHeader>
        <Columns>
          <RenderedContest>
            <Prose>
              <h3>Sample Render</h3>
            </Prose>
            <Paper isNarrow={contest.type === 'candidate'}>
              <Contest
                districtName={getContestDistrictName(election, contest)}
                title={contest.title}
              >
                {contest.type === 'candidate' && (
                  <React.Fragment>
                    <p>
                      {contest.seats === 1
                        ? 'Vote for 1'
                        : `Vote for not more than ${contest.seats}`}
                    </p>
                    <CandidateContestChoices
                      election={election}
                      contest={contest}
                      vote={[]}
                      locales={{ primary: 'en-US' }}
                    />
                  </React.Fragment>
                )}
                {contest.type === 'yesno' && (
                  <React.Fragment>
                    <p>
                      Vote <strong>Yes</strong> or <strong>No</strong>
                    </p>
                    <Text
                      small
                      preLine
                      dangerouslySetInnerHTML={{
                        __html: DomPurify.sanitize(contest.description),
                      }}
                    />
                    {['Yes', 'No'].map((answer) => (
                      <Text key={answer} bold noWrap>
                        <BubbleMark
                          position={election.ballotLayout?.targetMarkPosition}
                          checked={false}
                        >
                          <span>{answer}</span>
                        </BubbleMark>
                      </Text>
                    ))}
                  </React.Fragment>
                )}
              </Contest>
            </Paper>
          </RenderedContest>
          <div>
            <Prose>
              <h3>Contest Data</h3>
            </Prose>
            <TextField
              name="type"
              label="Type"
              value={contest.type}
              onChange={saveTextField}
              disabled
            />
            <TextField
              name="id"
              label="Contest ID"
              value={contest.id}
              onChange={saveTextField}
              disabled
            />
            <TextField
              name="districtId"
              label="District ID"
              value={contest.districtId}
              onChange={saveTextField}
              disabled
            />
            {contest.type === 'candidate' && (
              <TextField
                name="partyId"
                label="Party ID"
                value={contest.partyId || ''}
                optional
                onChange={saveTextField}
                disabled
              />
            )}
            <TextField
              label="Title"
              name="title"
              value={contest.title}
              onChange={saveTextField}
              disabled={!allowEditing}
            />
            {contest.type === 'candidate' && (
              <React.Fragment>
                <TextField
                  name="seats"
                  label="Seats"
                  value={contest.seats}
                  type="number"
                  min={0}
                  step={1}
                  pattern="\d*"
                  onChange={saveTextField}
                  disabled={!allowEditing}
                />
                <ToggleField
                  name="allowWriteIns"
                  label="Allow Write-Ins"
                  value={contest.allowWriteIns}
                  onChange={saveToggleField}
                  disabled={!allowEditing}
                />
                <h2>Candidates</h2>
                <ol>
                  {contest.candidates.map((candidate, index) => (
                    <li key={candidate.id}>
                      <TextField
                        name={`${index}.name`}
                        label="Candidate Name"
                        value={candidate.name}
                        onChange={saveCandidateTextField}
                        disabled={!allowEditing}
                      />
                      <TextField
                        name={`${index}.id`}
                        label="Candidate ID"
                        value={candidate.id}
                        onChange={saveCandidateTextField}
                        disabled
                      />
                      <TextField
                        name={`${index}.partyIds`}
                        label="Party IDs"
                        value={candidate.partyIds?.join(', ') ?? ''}
                        optional
                        onChange={saveCandidateTextField}
                        disabled
                      />
                    </li>
                  ))}
                </ol>
              </React.Fragment>
            )}
            {contest.type === 'yesno' && (
              <React.Fragment>
                <TextField
                  label="Description"
                  name="description"
                  type="textarea"
                  value={contest.description}
                  onChange={saveTextField}
                  disabled={!allowEditing}
                />
                <FileInputButton
                  buttonProps={{
                    small: true,
                  }}
                  accept="image/svg+xml"
                  onChange={appendSvgToDescription}
                  disabled={!allowEditing}
                >
                  Append SVG Image to Description
                </FileInputButton>
              </React.Fragment>
            )}
          </div>
        </Columns>
      </NavigationScreen>
    );
  }

  return (
    <NavigationScreen>
      <h1>DefinitionContestsScreen</h1>
      <p>
        /definition/contests - Add new - section - title - party - seats -
        allowWriteIns - candidates.length
      </p>
    </NavigationScreen>
  );
}
