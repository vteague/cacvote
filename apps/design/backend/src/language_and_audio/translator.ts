import { TranslationServiceClient as GoogleCloudTranslationClient } from '@google-cloud/translate';
import { assertDefined } from '@votingworks/basics';
import { LanguageCode } from '@votingworks/types';

import { Store } from '../store';
import { GOOGLE_CLOUD_PROJECT_ID } from './google_cloud_config';

export interface Translator {
  translateText(
    textArray: string[],
    targetLanguageCode: LanguageCode
  ): Promise<string[]>;
}

/**
 * The subset of {@link GoogleCloudTranslationClient} that we actually use
 */
export type MinimalGoogleCloudTranslationClient = Pick<
  GoogleCloudTranslationClient,
  'translateText'
>;

/**
 * An implementation of {@link Translator} that uses the Google Cloud Translation API
 */
export class GoogleCloudTranslator implements Translator {
  private readonly store: Store;
  private readonly translationClient: MinimalGoogleCloudTranslationClient;

  constructor(input: {
    store: Store;
    // Support providing a mock client for tests
    translationClient?: MinimalGoogleCloudTranslationClient;
  }) {
    this.store = input.store;
    this.translationClient =
      input.translationClient ??
      /* istanbul ignore next */ new GoogleCloudTranslationClient();
  }

  async translateText(
    textArray: string[],
    targetLanguageCode: LanguageCode
  ): Promise<string[]> {
    const translatedTextArray: string[] = Array.from<string>({
      length: textArray.length,
    }).fill('');

    const cacheMisses: Array<{ index: number; text: string }> = [];
    for (const [index, text] of textArray.entries()) {
      const translatedTextFromCache = this.store.getTranslatedTextFromCache(
        text,
        targetLanguageCode
      );
      if (translatedTextFromCache) {
        translatedTextArray[index] = translatedTextFromCache;
      } else {
        cacheMisses.push({ index, text });
      }
    }

    if (cacheMisses.length === 0) {
      return translatedTextArray;
    }

    const cacheMissesTranslated = await this.translateTextWithGoogleCloud(
      cacheMisses.map(({ text }) => text),
      targetLanguageCode
    );
    for (const [i, translatedText] of cacheMissesTranslated.entries()) {
      const { index: originalIndex, text } = cacheMisses[i];
      translatedTextArray[originalIndex] = translatedText;
      this.store.addTranslationCacheEntry({
        text,
        targetLanguageCode,
        translatedText,
      });
    }

    return translatedTextArray;
  }

  private async translateTextWithGoogleCloud(
    textArray: string[],
    targetLanguageCode: LanguageCode
  ): Promise<string[]> {
    const [response] = await this.translationClient.translateText({
      contents: textArray,
      mimeType: 'text/plain',
      parent: `projects/${GOOGLE_CLOUD_PROJECT_ID}`,
      sourceLanguageCode: LanguageCode.ENGLISH,
      targetLanguageCode,
    });
    const translatedTextArray = assertDefined(response.translations).map(
      ({ translatedText }) => assertDefined(translatedText)
    );
    return translatedTextArray;
  }
}
