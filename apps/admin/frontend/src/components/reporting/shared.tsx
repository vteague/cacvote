import { Card, H3, H5, Icons, LinkButton, Loading, P } from '@votingworks/ui';
import styled from 'styled-components';
import { routerPaths } from '../../router_paths';

export const ExportActions = styled.div`
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: start;
  gap: 0.5rem;
`;

export const PreviewContainer = styled.div`
  position: relative;
  min-height: 11in;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: ${(p) => p.theme.colors.container};
  border-radius: ${(p) => p.theme.sizes.borderRadiusRem}rem;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const PreviewReportPages = styled.div`
  section {
    background: white;
    position: relative;
    box-shadow: 0 3px 10px rgb(0, 0, 0, 20%);
    margin-top: 1rem;
    margin-bottom: 2rem;
    width: 8.5in;
    min-height: 11in;
    padding: 0.5in;
  }
`;

export const PreviewLoadingContainer = styled.div`
  margin-top: 4rem;
  display: flex;
  justify-content: center;
`;

export const NoResultsNotice = styled(H5)`
  margin-top: 2rem;
`;

export const GenerateButtonWrapper = styled.div`
  margin-left: auto;

  button {
    min-width: 15rem;
  }
`;

export const ReportBuilderControls = styled(Card)`
  background: ${(p) => p.theme.colors.containerLow};
  margin-bottom: 1rem;
  overflow: visible;
`;

export const ControlLabel = styled(H3)`
  /* No added styles */
`;

export function PreviewLoading(): JSX.Element {
  return (
    <PreviewLoadingContainer>
      <Loading>Generating Report</Loading>
    </PreviewLoadingContainer>
  );
}

export function ReportBackButton(): JSX.Element {
  return (
    <LinkButton icon="Previous" to={routerPaths.reports}>
      Back
    </LinkButton>
  );
}

export const WarningContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 0.5rem 0;

  p {
    margin-bottom: 0;
  }
`;

export function ReportWarning({ text }: { text: string }): JSX.Element {
  return (
    <WarningContainer>
      {text && (
        <P>
          <Icons.Warning /> {text}
        </P>
      )}
    </WarningContainer>
  );
}
