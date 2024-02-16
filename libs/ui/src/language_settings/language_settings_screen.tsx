import React from 'react';
import styled, { DefaultTheme } from 'styled-components';

import { LanguageCode, SizeMode } from '@votingworks/types';

import { Screen } from '../screen';
import { Button } from '../button';
import {
  AudioOnly,
  ReadOnLoad,
  appStrings,
  electionStrings,
} from '../ui_strings';
import { useCurrentLanguage } from '../hooks/use_current_language';
import { useAvailableLanguages } from '../hooks/use_available_languages';
import { useLanguageControls } from '../hooks/use_language_controls';
import { H2 } from '../typography';
import { RadioGroup } from '../radio_group';
import { DEFAULT_LANGUAGE_CODE } from '../ui_strings/language_context';
import { useScreenInfo } from '../hooks/use_screen_info';
import { WithScrollButtons } from '../with_scroll_buttons';

export interface LanguageSettingsScreenProps {
  onDone: () => void;
}

const COMPACT_SIZE_MODES = new Set<SizeMode>(['touchExtraLarge']);

/* istanbul ignore next - presentational */
function getSpacingRem(p: { theme: DefaultTheme }) {
  return COMPACT_SIZE_MODES.has(p.theme.sizeMode) ? 0.3 : 0.5;
}

const Header = styled.div`
  padding: ${(p) => getSpacingRem(p)}rem;
`;

const RadioGroupContainer = styled.div`
  padding: ${(p) => getSpacingRem(p)}rem;
`;

const Buttons = styled.div`
  display: flex;
  gap: ${(p) => getSpacingRem(p)}rem;
  justify-content: end;
  padding: ${(p) => getSpacingRem(p)}rem;
`;

export function LanguageSettingsScreen(
  props: LanguageSettingsScreenProps
): JSX.Element {
  const { onDone } = props;

  const screenInfo = useScreenInfo();
  const currentLanguageCode = useCurrentLanguage();
  const availableLanguages = useAvailableLanguages();
  const { setLanguage } = useLanguageControls();

  function getOptionLabel(languageCode: LanguageCode) {
    const selectedPrefix =
      languageCode === currentLanguageCode ? (
        <AudioOnly>{appStrings.labelSelected()} </AudioOnly>
      ) : null;

    return (
      <React.Fragment>
        {selectedPrefix}
        {electionStrings.ballotLanguage(languageCode)}
      </React.Fragment>
    );
  }

  const orderedLanguageCodes: LanguageCode[] = [
    DEFAULT_LANGUAGE_CODE,
    // TODO(kofi); We'll likely want a way for election officials to specify an
    // ordering for the other languages.
    ...availableLanguages.filter((l) => l !== DEFAULT_LANGUAGE_CODE),
  ];

  return (
    <Screen>
      <Header>
        <ReadOnLoad>
          <H2 as="h1">{appStrings.titleLanguageSettingsScreen()}</H2>
          <AudioOnly>
            {/*
             * TODO(kofi): These instructions should be overridden with
             * PAT-specific instructions when a sip-and-puff device is
             * connected.
             */}
            {appStrings.instructionsLanguageSettingsScreen()}
          </AudioOnly>
        </ReadOnLoad>
      </Header>
      <WithScrollButtons noPadding>
        <RadioGroupContainer>
          <RadioGroup
            hideLabel
            label="Available Languages"
            numColumns={
              /* istanbul ignore next - presentational */
              screenInfo.isPortrait ? 1 : 2
            }
            onChange={setLanguage}
            options={orderedLanguageCodes.map((languageCode) => ({
              label: getOptionLabel(languageCode),
              value: languageCode,
            }))}
            value={currentLanguageCode}
          />
        </RadioGroupContainer>
      </WithScrollButtons>
      <Buttons>
        <Button
          icon="Done"
          id="next" // Enables right arrow control on accessible controllers.
          onPress={onDone}
          variant="primary"
        >
          {appStrings.buttonDone()}
        </Button>
      </Buttons>
    </Screen>
  );
}
