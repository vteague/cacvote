import { LanguageCode } from '@votingworks/types';
import { format } from '@votingworks/utils';
import { H1 } from '..';
import {
  act,
  render as renderWithoutContext,
  screen,
} from '../../test/react_testing_library';
import { newTestContext } from '../../test/test_context';
import { DateString } from './date_string';

const TEST_DATE = new Date('2023/10/12');
const ENGLISH_FORMAT = format.localeLongDate(TEST_DATE, LanguageCode.ENGLISH);
const SPANISH_FORMAT = format.localeLongDate(TEST_DATE, LanguageCode.SPANISH);

test('formats based on current language code', async () => {
  const { getLanguageContext, mockBackendApi, render } = newTestContext();

  mockBackendApi.getAvailableLanguages.mockResolvedValue([]);
  mockBackendApi.getUiStrings.mockResolvedValue({});

  render(
    <H1>
      <DateString value={TEST_DATE} />
    </H1>
  );

  await screen.findByRole('heading', { name: ENGLISH_FORMAT });

  act(() => getLanguageContext()?.setLanguage(LanguageCode.SPANISH));

  await screen.findByRole('heading', { name: SPANISH_FORMAT });
});

test('uses default language code with language context', async () => {
  renderWithoutContext(
    <H1>
      <DateString value={TEST_DATE} />
    </H1>
  );

  await screen.findByRole('heading', { name: ENGLISH_FORMAT });
});
