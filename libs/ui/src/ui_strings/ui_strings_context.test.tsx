import { LanguageCode } from '@votingworks/types';
import { screen, waitFor } from '../../test/react_testing_library';
import { newTestContext } from '../../test/ui_strings/test_utils';

test('includes both language and audio contexts', async () => {
  const { getAudioContext, getLanguageContext, mockBackendApi, render } =
    newTestContext();
  mockBackendApi.getAvailableLanguages.mockResolvedValue([
    LanguageCode.ENGLISH,
  ]);
  mockBackendApi.getUiStrings.mockResolvedValue(null);

  render(<div>foo</div>);

  await waitFor(() => expect(getLanguageContext()).toBeDefined());
  expect(getAudioContext()).toBeDefined();
});

test('skips audio context when `noAudio` is true', async () => {
  const { getAudioContext, getLanguageContext, mockBackendApi, render } =
    newTestContext({ noAudio: true });
  mockBackendApi.getAvailableLanguages.mockResolvedValue([
    LanguageCode.ENGLISH,
  ]);
  mockBackendApi.getUiStrings.mockResolvedValue(null);

  render(<div>foo</div>);

  await waitFor(() => expect(getLanguageContext()).toBeDefined());
  expect(getAudioContext()).toBeUndefined();
});

test('omits both contexts when `disableForTesting` is true', async () => {
  const { getAudioContext, getLanguageContext, mockBackendApi, render } =
    newTestContext({ disabled: true });

  mockBackendApi.getAvailableLanguages.mockResolvedValue([
    LanguageCode.ENGLISH,
  ]);

  mockBackendApi.getUiStrings.mockResolvedValue(null);

  render(<div>foo</div>);

  await screen.findByText('foo');
  expect(getLanguageContext()).toBeUndefined();
  expect(getAudioContext()).toBeUndefined();
});
