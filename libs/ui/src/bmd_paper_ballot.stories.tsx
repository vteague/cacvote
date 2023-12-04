import { Meta } from '@storybook/react';

import {
  Color,
  Election,
  ElectionStringKey,
  LanguageCode,
  UiStringsPackage,
  YesNoContest,
  getContests,
  safeParseElectionDefinition,
} from '@votingworks/types';
import { generateBallotStyleId } from '@votingworks/utils';
import styled from 'styled-components';
import { electionGeneral } from '@votingworks/fixtures';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import _ from 'lodash';
import { find } from '@votingworks/basics';
import {
  BmdPaperBallot as Component,
  BmdPaperBallotProps,
} from './bmd_paper_ballot';
import {
  UiStringsReactQueryApi,
  createUiStringsApi,
} from './hooks/ui_strings_api';
import { QUERY_CLIENT_DEFAULT_OPTIONS } from './react_query';
import { UiStringsContextProvider } from './ui_strings';
import {
  generateCandidateVotes,
  generateYesNoVote,
} from './bmd_paper_ballot_test_utils';

const ballotLanguages = [LanguageCode.ENGLISH, LanguageCode.CHINESE_SIMPLIFIED];
const election: Election = {
  ...electionGeneral,
  ballotStyles: electionGeneral.ballotStyles.flatMap((ballotStyle, i) =>
    ballotLanguages.map((languageCode) => ({
      ...ballotStyle,
      id: generateBallotStyleId({
        ballotStyleIndex: i + 1,
        languages: [languageCode],
      }),
      languages: [languageCode],
    }))
  ),
};

const TEST_UI_STRINGS: UiStringsPackage = {
  [LanguageCode.CHINESE_SIMPLIFIED]: {
    [ElectionStringKey.COUNTY_NAME]: {
      franklin: '富兰克林县',
    },
    [ElectionStringKey.CONTEST_OPTION_LABEL]: _(election.contests)
      .filter((contest): contest is YesNoContest => contest.type === 'yesno')
      .flatMap((contest) => [contest.yesOption, contest.noOption])
      .keyBy((option) => option.id)
      .mapValues((option) => (option.id.endsWith('no') ? '不' : '是'))
      .value(),
    [ElectionStringKey.CONTEST_TITLE]: {
      '102': '措施 102：车辆减排计划',
      'city-council': '市议会',
      'city-mayor': '市长',
      'county-commissioners': '县专员',
      'county-registrar-of-wills': '遗嘱登记员',
      'judicial-elmer-hull': '保留埃尔默·赫尔担任副法官吗？',
      'judicial-robert-demergue':
        '保留罗伯特·德默格（Robert Demergue）担任首席大法官？',
      'lieutenant-governor': '副州长',
      'measure-101': '措施 101：大学区',
      'proposition-1': '提案 1：富兰克林县和弗洛维特县的赌博',
      'question-a': '问题A：财产损失的追偿',
      'question-b': '问题 B：权力分立',
      'question-c': '问题C：非经济损失的损害赔偿限额',
      'representative-district-6': '第 6 区代表',
      'secretary-of-state': '国务卿',
      'state-assembly-district-54': '第 54 区议会议员',
      'state-senator-district-31': '第 31 区参议员',
      governor: '州长',
      president: '主席和副主席',
      senator: '参议员',
    },
    [ElectionStringKey.ELECTION_TITLE]: '全民选举',
    [ElectionStringKey.PARTY_NAME]: {
      '0': '联邦党人',
      '1': '人们',
      '2': '自由',
      '3': '宪法',
      '4': '辉格党',
      '5': '劳动',
      '6': '独立的',
      '7': '民主党人',
      '8': '共和党人',
    },
    [ElectionStringKey.PRECINCT_NAME]: {
      '23': '斯普林菲尔德中心',
      '21': '北斯普林菲尔德',
      '20': '南斯普林菲尔德',
    },
    [ElectionStringKey.STATE_NAME]: '汉密尔顿州',
    noteBallotContestNoSelection: '无选择',
    labelNumVotesUnused: '未使用的票数：',
    labelWriteInParenthesized: '（写进）',
    titleBallotId: '选票识别',
    titleBallotStyle: '选票样式',
    titleOfficialBallot: '正式选票',
    titlePrecinct: '辖区',
    titleUnofficialTestBallot: '非官方测试选票',
  },
};

const initialArgs: BmdPaperBallotProps = {
  ballotStyleId: election.ballotStyles[0].id,
  electionDefinition: safeParseElectionDefinition(
    JSON.stringify(election)
  ).unsafeUnwrap(),
  isLiveMode: true,
  onRendered: () => undefined,
  precinctId: election.precincts[0].id,
  votes: _(election.contests)
    .keyBy((c) => c.id)
    .mapValues((c) =>
      c.type === 'yesno' ? generateYesNoVote(c) : generateCandidateVotes(c)
    )
    .value(),
};

const queryClient = new QueryClient({
  defaultOptions: QUERY_CLIENT_DEFAULT_OPTIONS,
});

const uiStringsApi: UiStringsReactQueryApi = createUiStringsApi(() => ({
  getAudioClipsBase64: () => Promise.resolve({}),
  getAvailableLanguages: () => Promise.resolve(ballotLanguages),
  getUiStringAudioIds: () => Promise.resolve(null),
  getUiStrings: ({ languageCode }) =>
    Promise.resolve(TEST_UI_STRINGS[languageCode] || null),
}));

const Container = styled.div`
  & > * {
    @media screen {
      box-sizing: border-box;

      /* Force print-only content to display. */
      display: block !important;
      padding: 0.375in;
      min-height: 11in;
      width: 8.5in;
    }
  }
`;

const meta: Meta<typeof Component> = {
  title: 'libs-ui/BmdPaperBallot',
  component: Component,
  args: initialArgs,
  argTypes: {
    ballotStyleId: {
      control: 'radio',
      options: election.ballotStyles.map((b) => b.id).sort(),
    },
  },
  decorators: [
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <UiStringsContextProvider api={uiStringsApi} noAudio>
          <Container>
            <Story />
          </Container>
        </UiStringsContextProvider>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    backgrounds: {
      default: 'gray',
      values: [{ name: 'gray', value: Color.GRAY_LIGHT }],
    },
  },
};

export default meta;

export function BmdPaperBallot(props: BmdPaperBallotProps): JSX.Element {
  const { ballotStyleId, electionDefinition, votes } = props;

  const ballotStyle = find(
    electionDefinition.election.ballotStyles,
    (b) => b.id === ballotStyleId
  );

  const filteredVotes = _.pick(
    votes,
    getContests({ ballotStyle, election }).map((c) => c.id)
  );

  return <Component {...props} votes={filteredVotes} />;
}