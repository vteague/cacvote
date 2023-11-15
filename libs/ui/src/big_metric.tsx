import React from 'react';
import styled from 'styled-components';

import { format } from '@votingworks/utils';

import { H1 } from './typography';
import { LabelledText } from './labelled_text';
import { NumberString } from './ui_strings';

/** Props for {@link BigMetric}. */
export interface BigMetricProps {
  label: React.ReactNode;
  value: number;

  /** For backward compatibility with tests in VxScan */
  valueElementTestId?: string;
}

const StyledContainer = styled.span`
  display: inline-block;
  font-size: 1rem;
  line-height: 1;
  text-align: center;
`;

const StyledValue = styled(H1)`
  display: inline-block;
  line-height: 1;
  margin: 0;
`;

/**
 * Displays a formatted, H1-sized numerical metric value with the given label.
 */
export function BigMetric(props: BigMetricProps): JSX.Element {
  const { label, value, valueElementTestId } = props;

  const formattedValue = format.count(value);
  const formattedLabel = `${label}: ${formattedValue}`;

  return (
    <StyledContainer>
      <LabelledText label={<span aria-hidden>{label}</span>}>
        <StyledValue data-testid={valueElementTestId}>
          <NumberString aria-label={formattedLabel} value={value} />
        </StyledValue>
      </LabelledText>
    </StyledContainer>
  );
}
