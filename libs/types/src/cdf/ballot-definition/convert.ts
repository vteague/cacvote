import {
  assert,
  assertDefined,
  duplicates,
  err,
  find,
  groupBy,
  naturals,
  ok,
  Result,
  throwIllegalValue,
  unique,
  wrapException,
} from '@votingworks/basics';
import * as Cdf from '.';
import * as Vxf from '../../election';
import { getContests } from '../../election_utils';
import { Id, safeParse } from '../../generic';
import { safeParseInt } from '../../numeric';

function dateString(date: Date) {
  const isoString = date.toISOString();
  return isoString.split('T')[0];
}

function dateTimeString(date: Date) {
  const isoString = date.toISOString();
  // Need to remove fractional seconds to satisfy CDF schema
  return `${isoString.split('.')[0]}Z`;
}

const paperSizeDimensionsInches: Record<Vxf.BallotPaperSize, [number, number]> =
  {
    [Vxf.BallotPaperSize.Letter]: [8.5, 11],
    [Vxf.BallotPaperSize.Legal]: [8.5, 14],
    [Vxf.BallotPaperSize.Custom17]: [8.5, 17],
    [Vxf.BallotPaperSize.Custom18]: [8.5, 18],
    [Vxf.BallotPaperSize.Custom21]: [8.5, 21],
    [Vxf.BallotPaperSize.Custom22]: [8.5, 22],
  };

export function convertVxfElectionToCdfBallotDefinition(
  vxfElection: Vxf.Election
): Cdf.BallotDefinition {
  function text(content: string): Cdf.InternationalizedText {
    return {
      '@type': 'BallotDefinition.InternationalizedText',
      Text: [
        {
          '@type': 'BallotDefinition.LanguageString',
          Language: 'en',
          Content: content,
        },
      ],
    };
  }

  const stateId = vxfElection.state.toLowerCase().replaceAll(' ', '-');
  const electionDate = dateString(new Date(vxfElection.date));

  const precinctSplits: Record<
    Vxf.PrecinctId,
    | Array<{
        split: Cdf.ReportingUnit;
        ballotStyles: Vxf.BallotStyle[];
      }>
    | undefined
  > = Object.fromEntries(
    vxfElection.precincts.map((precinct) => {
      const precinctBallotStyles = vxfElection.ballotStyles.filter(
        (ballotStyle) => ballotStyle.precincts.includes(precinct.id)
      );
      // There may be multiple ballot styles with the same districts but
      // different partyIds, but we only want to split precincts that are part
      // of different districts.
      const ballotStylesByDistricts = groupBy(
        precinctBallotStyles,
        (ballotStyle) => ballotStyle.districts
      );
      const splits =
        ballotStylesByDistricts.length <= 1
          ? undefined
          : ballotStylesByDistricts.map(
              (
                [, ballotStyles],
                index
              ): {
                split: Cdf.ReportingUnit;
                ballotStyles: Vxf.BallotStyle[];
              } => ({
                split: {
                  '@type': 'BallotDefinition.ReportingUnit',
                  '@id': `${precinct.id}-split-${index + 1}`,
                  Name: text(`${precinct.name} - Split ${index + 1}`),
                  Type: Cdf.ReportingUnitType.SplitPrecinct,
                },
                ballotStyles,
              })
            );
      return [precinct.id, splits];
    })
  );

  function precinctsOrSplitsForBallotStyle(ballotStyle: Vxf.BallotStyle): Id[] {
    return ballotStyle.precincts.map((precinctId) => {
      const splits = precinctSplits[precinctId];
      return splits !== undefined
        ? // If the precinct has splits, only use the split correponding to this ballot style
          find(splits, (split) =>
            split.ballotStyles.some((bs) => bs.id === ballotStyle.id)
          ).split['@id']
        : // Otherwise, use the precinct itself
          precinctId;
    });
  }

  function candidateOptionId(
    contestId: Vxf.ContestId,
    candidateId: Vxf.CandidateId
  ): string {
    return `${contestId}-option-${candidateId}`;
  }

  function writeInOptionId(
    contestId: Vxf.ContestId,
    writeInIndex: number
  ): string {
    return `${contestId}-option-write-in-${writeInIndex}`;
  }

  function orderedContentForBallotStyle(
    ballotStyle: Vxf.BallotStyle
  ): Cdf.OrderedContest[] | undefined {
    if (!vxfElection.gridLayouts) return undefined;

    const gridLayout = find(
      vxfElection.gridLayouts,
      (layout) => layout.ballotStyleId === ballotStyle.id
    );

    function optionIdForPosition(
      contest: Vxf.AnyContest,
      gridPosition: Vxf.GridPosition
    ): string {
      switch (gridPosition.type) {
        case 'option': {
          switch (contest.type) {
            case 'candidate':
              return candidateOptionId(contest.id, gridPosition.optionId);
            case 'yesno': {
              return gridPosition.optionId;
            }
            /* istanbul ignore next */
            default:
              return throwIllegalValue(contest);
          }
        }
        case 'write-in':
          return writeInOptionId(contest.id, gridPosition.writeInIndex);
        /* istanbul ignore next */
        default:
          return throwIllegalValue(gridPosition);
      }
    }

    const contests = getContests({ election: vxfElection, ballotStyle });
    return contests.map(
      (contest): Cdf.OrderedContest => ({
        '@type': 'BallotDefinition.OrderedContest',
        ContestId: contest.id,
        Physical: [
          {
            '@type': 'BallotDefinition.PhysicalContest',
            BallotFormatId: 'ballot-format',
            vxOptionBoundsFromTargetMark: gridLayout.optionBoundsFromTargetMark,
            PhysicalContestOption: gridLayout.gridPositions
              .filter((position) => position.contestId === contest.id)
              .map(
                (position): Cdf.PhysicalContestOption => ({
                  '@type': 'BallotDefinition.PhysicalContestOption',
                  ContestOptionId: optionIdForPosition(contest, position),
                  OptionPosition: [
                    {
                      '@type': 'BallotDefinition.OptionPosition',
                      Sheet: position.sheetNumber,
                      Side: position.side as Cdf.BallotSideType,
                      // Technically these should be in inches, not grid
                      // coordinates, since that's the measurement unit
                      // specified in the ballot format, but grid coordinates
                      // are what our interpreter uses, and converting to inches
                      // and back would just add arbitrary confusion.
                      X: position.column,
                      Y: position.row,
                      // It's not clear what the height/width of an
                      // OptionPosition refer to. Is it the dimensions of the
                      // bubble? Since we don't actually use this data, just set
                      // it to a dummy value.
                      H: 0,
                      W: 0,
                      NumberVotes: 1,
                    },
                  ],
                  WriteInPosition:
                    position.type === 'write-in'
                      ? [
                          {
                            '@type': 'BallotDefinition.WriteInPosition',
                            Sheet: position.sheetNumber,
                            Side: position.side as Cdf.BallotSideType,
                            // We don't currently use the write-in position, so
                            // setting to a dummy value for now. In the future,
                            // we might want to use this for detecting unmarked
                            // write-ins or for write-in adjudication cropping.
                            H: 0,
                            W: 0,
                            X: 0,
                            Y: 0,
                          },
                        ]
                      : undefined,
                })
              ),
          },
        ],
      })
    );
  }

  return {
    '@type': 'BallotDefinition.BallotDefinition',

    Election: [
      {
        '@type': 'BallotDefinition.Election',
        ElectionScopeId: stateId,
        StartDate: electionDate,
        EndDate: electionDate,
        // Guess the election type based on whether there are any party-associated contests.
        Type: vxfElection.contests.some(
          (contest) => contest.type === 'candidate' && contest.partyId
        )
          ? Cdf.ElectionType.Primary
          : Cdf.ElectionType.General,
        Name: text(vxfElection.title),

        Candidate: vxfElection.contests
          .filter(
            (contest): contest is Vxf.CandidateContest =>
              contest.type === 'candidate'
          )
          .flatMap((contest) => contest.candidates)
          .map(
            (candidate): Cdf.Candidate => ({
              '@type': 'BallotDefinition.Candidate',
              '@id': candidate.id,
              BallotName: text(candidate.name),
            })
          ),

        // eslint-disable-next-line array-callback-return
        Contest: vxfElection.contests.map((contest) => {
          switch (contest.type) {
            case 'candidate':
              return {
                '@type': 'BallotDefinition.CandidateContest',
                '@id': contest.id,
                ElectionDistrictId: contest.districtId,
                Name: contest.title,
                BallotTitle: text(contest.title),
                VotesAllowed: contest.seats,
                ContestOption: [
                  ...contest.candidates.map(
                    (candidate): Cdf.CandidateOption => ({
                      '@type': 'BallotDefinition.CandidateOption',
                      '@id': candidateOptionId(contest.id, candidate.id),
                      CandidateIds: [candidate.id],
                      EndorsementPartyIds: candidate.partyIds,
                    })
                  ),
                  // Create write-in options up to the number of votes allowed
                  ...(contest.allowWriteIns
                    ? naturals()
                        .take(contest.seats)
                        .map(
                          (writeInIndex): Cdf.CandidateOption => ({
                            '@type': 'BallotDefinition.CandidateOption',
                            '@id': writeInOptionId(contest.id, writeInIndex),
                            IsWriteIn: true,
                          })
                        )
                    : []),
                ],
                PrimaryPartyIds: contest.partyId
                  ? [contest.partyId]
                  : undefined,
              };

            case 'yesno':
              return {
                '@type': 'BallotDefinition.BallotMeasureContest',
                '@id': contest.id,
                ElectionDistrictId: contest.districtId,
                Name: contest.title,
                BallotTitle: text(contest.title),
                FullText: text(contest.description),
                ContestOption: [
                  {
                    '@type': 'BallotDefinition.BallotMeasureOption',
                    '@id': contest.yesOption.id,
                    Selection: text(contest.yesOption.label),
                  },
                  {
                    '@type': 'BallotDefinition.BallotMeasureOption',
                    '@id': contest.noOption.id,
                    Selection: text(contest.noOption.label),
                  },
                ],
              };

            /* istanbul ignore next */
            default:
              throwIllegalValue(contest);
          }
        }),

        BallotStyle: vxfElection.ballotStyles.map(
          (ballotStyle): Cdf.BallotStyle => ({
            '@type': 'BallotDefinition.BallotStyle',
            GpUnitIds: precinctsOrSplitsForBallotStyle(ballotStyle),
            PartyIds: ballotStyle.partyId ? [ballotStyle.partyId] : undefined,
            OrderedContent: orderedContentForBallotStyle(ballotStyle),
            // In CDF, ballot styles don't have an id field. I think this might be
            // because each ballot style can be uniquely identified by its
            // GpUnitIds + PartyIds. When multiple ballot styles are used within a
            // precinct (e.g. when there are diff school districts within a
            // precinct), that there should be SplitPrecinct GpUnits to represent
            // that. However, our system currently uses ballot styles with
            // different ids to represent these splits, so as a first pass at
            // compatibility, we add an external identifier to the ballot style
            // and don't use SplitPrecinct GpUnits.
            ExternalIdentifier: [
              {
                '@type': 'BallotDefinition.ExternalIdentifier',
                Type: Cdf.IdentifierType.StateLevel,
                Value: ballotStyle.id,
              },
            ],
          })
        ),
      },
    ],

    Party: vxfElection.parties.map((party) => ({
      '@type': 'BallotDefinition.Party',
      '@id': party.id,
      Name: text(party.fullName),
      Abbreviation: text(party.abbrev),
      vxBallotLabel: text(party.name),
    })),

    GpUnit: [
      {
        '@type': 'BallotDefinition.ReportingUnit',
        '@id': stateId,
        Name: text(vxfElection.state),
        Type: Cdf.ReportingUnitType.State,
        ComposingGpUnitIds: [vxfElection.county.id],
      },
      {
        '@type': 'BallotDefinition.ReportingUnit',
        '@id': vxfElection.county.id,
        Name: text(vxfElection.county.name),
        Type: Cdf.ReportingUnitType.County,
        ComposingGpUnitIds: vxfElection.districts.map(
          (district) => district.id
        ),
      },
      ...vxfElection.districts.map(
        (district): Cdf.ReportingUnit => ({
          '@type': 'BallotDefinition.ReportingUnit',
          '@id': district.id,
          Name: text(district.name),
          // Since we represent multiple real-world entities as districts in VXF,
          // we can't know the actual type to use here
          Type: Cdf.ReportingUnitType.Other,
          // To figure out which precincts/splits are in this district, we look at the
          // associated ballot styles
          ComposingGpUnitIds: unique(
            vxfElection.ballotStyles
              .filter((ballotStyle) =>
                ballotStyle.districts.includes(district.id)
              )
              .flatMap(precinctsOrSplitsForBallotStyle)
          ),
        })
      ),
      ...vxfElection.precincts.map(
        (precinct): Cdf.ReportingUnit => ({
          '@type': 'BallotDefinition.ReportingUnit',
          '@id': precinct.id,
          Name: text(precinct.name),
          Type: Cdf.ReportingUnitType.Precinct,
          ComposingGpUnitIds: precinctSplits[precinct.id]?.map(
            ({ split }) => split['@id']
          ),
        })
      ),
      ...Object.values(precinctSplits).flatMap(
        (splits) => splits?.map(({ split }) => split) ?? []
      ),
    ],

    BallotFormat: [
      {
        '@type': 'BallotDefinition.BallotFormat',
        '@id': 'ballot-format',
        // For some reason, the CDF schema requires at least one external
        // identifier here
        ExternalIdentifier: [
          {
            '@type': 'BallotDefinition.ExternalIdentifier',
            Type: Cdf.IdentifierType.Other,
            Value: 'ballot-format',
          },
        ],
        MeasurementUnit: Cdf.MeasurementUnitType.In,
        ShortEdge:
          paperSizeDimensionsInches[vxfElection.ballotLayout.paperSize][0],
        LongEdge:
          paperSizeDimensionsInches[vxfElection.ballotLayout.paperSize][1],
        Orientation: Cdf.OrientationType.Portrait,
        SelectionCaptureMethod: Cdf.SelectionCaptureMethod.Omr,
      },
    ],

    // Since we don't have a generated date in VXF, we use the election date. If
    // we were to use the current date, it would cause changes every time we
    // hash the object. We want hashes to be based on the content of the
    // election, not the date generated.
    GeneratedDate: dateTimeString(new Date(vxfElection.date)),
    Issuer: 'VotingWorks',
    IssuerAbbreviation: 'VX',
    VendorApplicationId: 'VxSuite',
    Version: Cdf.BallotDefinitionVersion.v1_0_0,
    SequenceStart: 1,
    SequenceEnd: 1,
  };
}

export function convertCdfBallotDefinitionToVxfElection(
  cdfBallotDefinition: Cdf.BallotDefinition
): Vxf.Election {
  const election = cdfBallotDefinition.Election[0];
  const gpUnits = cdfBallotDefinition.GpUnit;
  const ballotFormat = cdfBallotDefinition.BallotFormat[0];

  const state = find(
    gpUnits,
    (gpUnit) => gpUnit.Type === Cdf.ReportingUnitType.State
  );
  const county = find(
    gpUnits,
    (gpUnit) => gpUnit.Type === Cdf.ReportingUnitType.County
  );

  // Any GpUnit that is associated with contests is a "district" in VXF
  const districts = gpUnits.filter((gpUnit) =>
    election.Contest.some(
      (contest) => contest.ElectionDistrictId === gpUnit['@id']
    )
  );

  const precincts = gpUnits.filter(
    (gpUnit) => gpUnit.Type === Cdf.ReportingUnitType.Precinct
  );
  const precinctSplits = gpUnits.filter(
    (gpUnit) => gpUnit.Type === Cdf.ReportingUnitType.SplitPrecinct
  );

  function precinctOrSplitIdToPrecinctId(
    precinctOrSplitId: Id
  ): Vxf.PrecinctId {
    return find(
      precincts,
      (precinct) =>
        precinct['@id'] === precinctOrSplitId ||
        Boolean(precinct['ComposingGpUnitIds']?.includes(precinctOrSplitId))
    )['@id'];
  }

  function convertOptionId(contestId: Vxf.ContestId, optionId: string): Id {
    const contest = find(election.Contest, (c) => c['@id'] === contestId);
    switch (contest['@type']) {
      case 'BallotDefinition.CandidateContest': {
        const candidateOption = find(
          contest.ContestOption,
          (option) => option['@id'] === optionId
        );
        return assertDefined(candidateOption.CandidateIds)[0];
      }
      case 'BallotDefinition.BallotMeasureContest':
        return optionId;
      /* istanbul ignore next */
      default:
        return throwIllegalValue(contest);
    }
  }

  function parseWriteInIndexFromOptionId(
    contestId: Vxf.ContestId,
    optionId: string
  ): number {
    const match = /^-option-write-in-([0-9]+)$/.exec(
      optionId.replace(contestId, '')
    );
    /* istanbul ignore next */
    return safeParseInt(match?.[1]).assertOk(
      `Invalid write-in option id: ${optionId}`
    );
  }

  function englishText(text: Cdf.InternationalizedText): string {
    const content = find(text.Text, (t) => t.Language === 'en').Content;
    assert(content !== undefined, 'Could not find English text');
    return content;
  }

  return {
    title: englishText(election.Name),
    state: englishText(state.Name),
    county: {
      id: county['@id'],
      name: englishText(county.Name),
    },
    date: dateTimeString(new Date(election.StartDate)),

    parties: cdfBallotDefinition.Party.map((party) => {
      return {
        id: party['@id'] as Vxf.PartyId,
        name: englishText(party.vxBallotLabel),
        fullName: englishText(party.Name),
        abbrev: englishText(party.Abbreviation),
      };
    }),

    contests: election.Contest.map((contest): Vxf.AnyContest => {
      const contestBase = {
        id: contest['@id'],
        title: englishText(contest.BallotTitle),
        districtId: contest.ElectionDistrictId as Vxf.DistrictId,
      } as const;
      switch (contest['@type']) {
        case 'BallotDefinition.CandidateContest': {
          if (contest.PrimaryPartyIds) {
            assert(contest.PrimaryPartyIds.length === 1);
          }
          return {
            ...contestBase,
            type: 'candidate',
            seats: contest.VotesAllowed,
            allowWriteIns: contest.ContestOption.some(
              (option) => option.IsWriteIn
            ),
            candidates: contest.ContestOption.filter(
              (option) => !option.IsWriteIn
            ).map((option): Vxf.Candidate => {
              const candidate = find(
                assertDefined(election.Candidate),
                (cand) => cand['@id'] === assertDefined(option.CandidateIds)[0]
              );
              return {
                id: candidate['@id'],
                name: englishText(candidate.BallotName),
                // We use CandidateOption.EndorsementPartyIds rather than
                // Candidate.PartyId, since we want to support cases where a
                // candidate is endorsed by multiple parties, and we don't
                // care about the candidate's "home" party.
                partyIds: option.EndorsementPartyIds as Vxf.PartyId[],
              };
            }),
            partyId: contest.PrimaryPartyIds
              ? (contest.PrimaryPartyIds[0] as Vxf.PartyId)
              : undefined,
          };
        }
        case 'BallotDefinition.BallotMeasureContest': {
          // We use option order to determine the "yes" and "no" options.
          // There's no real semantic difference in the eyes of the voting
          // system.
          const [yesOption, noOption] = contest.ContestOption;
          return {
            ...contestBase,
            type: 'yesno',
            description: englishText(contest.FullText),
            yesOption: {
              id: yesOption['@id'],
              label: englishText(yesOption.Selection),
            },
            noOption: {
              id: noOption['@id'],
              label: englishText(noOption.Selection),
            },
          };
        }

        /* istanbul ignore next */
        default:
          throw new Error(`Unsupported contest type: ${contest['@type']}`);
      }
    }),

    districts: districts.map((district) => ({
      id: district['@id'] as Vxf.DistrictId,
      name: englishText(district.Name),
    })),

    precincts: precincts.map((precinct) => ({
      id: precinct['@id'],
      name: englishText(precinct.Name),
    })),

    ballotStyles: election.BallotStyle.map((ballotStyle): Vxf.BallotStyle => {
      // Ballot style GpUnitIds should all be precincts or splits
      assert(
        ballotStyle.GpUnitIds.every((gpUnitId) =>
          [...precincts, ...precinctSplits].some(
            (precinctOrSplit) => precinctOrSplit['@id'] === gpUnitId
          )
        )
      );
      // To find the districts for a ballot style, we look at the associated
      // precincts/splits and find the districts that contain them
      const ballotStyleDistricts = ballotStyle.GpUnitIds.flatMap((gpUnitId) => {
        return districts.filter((district) =>
          assertDefined(district.ComposingGpUnitIds).includes(gpUnitId)
        );
      });
      const districtIds = unique(
        ballotStyleDistricts.map(
          (district) => district['@id'] as Vxf.DistrictId
        )
      );

      if (ballotStyle.PartyIds) assert(ballotStyle.PartyIds.length <= 1);

      const precinctIds = ballotStyle.GpUnitIds.map(
        precinctOrSplitIdToPrecinctId
      );

      // For now, we expect exactly one external identifier for each ballot
      // style (see comment on BallotStyles in other conversion function for
      // context).
      assert(ballotStyle.ExternalIdentifier.length === 1);

      return {
        id: ballotStyle.ExternalIdentifier[0].Value,
        districts: districtIds,
        precincts: precinctIds,
        partyId: ballotStyle.PartyIds?.[0] as Vxf.PartyId | undefined,
      };
    }),

    ballotLayout: {
      paperSize: find(
        Object.entries(paperSizeDimensionsInches),
        ([, [width, height]]) =>
          width === ballotFormat.ShortEdge && height === ballotFormat.LongEdge
      )[0] as Vxf.BallotPaperSize,
      metadataEncoding: 'qr-code',
    },

    gridLayouts: (() => {
      const gridLayouts = election.BallotStyle.filter(
        (ballotStyle) => ballotStyle.OrderedContent !== undefined
      ).map((ballotStyle): Vxf.GridLayout => {
        const orderedContests = assertDefined(ballotStyle.OrderedContent);
        const optionBoundsFromTargetMark =
          orderedContests[0].Physical[0].vxOptionBoundsFromTargetMark;
        return {
          ballotStyleId: ballotStyle.ExternalIdentifier[0].Value,
          optionBoundsFromTargetMark,
          gridPositions: orderedContests.flatMap(
            (orderedContest): Vxf.GridPosition[] =>
              orderedContest.Physical[0].PhysicalContestOption.map(
                (option): Vxf.GridPosition => ({
                  contestId: orderedContest.ContestId,
                  sheetNumber: option.OptionPosition[0].Sheet,
                  side: option.OptionPosition[0].Side,
                  column: option.OptionPosition[0].X,
                  row: option.OptionPosition[0].Y,
                  ...(option.WriteInPosition
                    ? {
                        type: 'write-in',
                        writeInIndex: parseWriteInIndexFromOptionId(
                          orderedContest.ContestId,
                          option.ContestOptionId
                        ),
                      }
                    : {
                        type: 'option',
                        optionId: convertOptionId(
                          orderedContest.ContestId,
                          option.ContestOptionId
                        ),
                      }),
                })
              )
          ),
        };
      });
      return gridLayouts.length > 0 ? gridLayouts : undefined;
    })(),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * The '@id' fields in a CDF ballot definition are required to be globally
 * unique across the entire ballot definition.
 */
function findDuplicateIds(ballotDefinition: Cdf.BallotDefinition): string[] {
  function findIds(value: unknown): string[] {
    if (isPlainObject(value)) {
      const id = value['@id'] as string;
      return (id ? [id] : []).concat(Object.values(value).flatMap(findIds));
    }
    if (isArray(value)) {
      return value.flatMap(findIds);
    }
    return [];
  }
  const allIds = findIds(ballotDefinition);
  return duplicates(allIds);
}

export function safeParseCdfBallotDefinition(
  value: unknown
): Result<Vxf.Election, Error> {
  const parseResult = safeParse(Cdf.BallotDefinitionSchema, value);
  if (parseResult.isErr()) return parseResult;
  const ballotDefinition = parseResult.ok();

  const duplicateIds = findDuplicateIds(ballotDefinition);
  if (duplicateIds.length > 0) {
    return err(
      new Error(
        `Ballot definition contains duplicate @ids: ${duplicateIds.join(', ')}`
      )
    );
  }

  try {
    return ok(convertCdfBallotDefinitionToVxfElection(ballotDefinition));
  } catch (error) {
    return wrapException(error);
  }
}
