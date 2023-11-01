/* istanbul ignore file - tested via VxSuite apps. */

import { Optional } from '@votingworks/basics';
import { Client as DbClient } from '@votingworks/db';
import {
  LanguageCode,
  LanguageCodeSchema,
  safeParse,
  safeParseJson,
  UiStringAudioIds,
  UiStringAudioIdsSchema,
  UiStringTranslations,
  UiStringTranslationsSchema,
} from '@votingworks/types';

/** Store interface for UI String API endpoints. */
export interface UiStringsStore {
  // TODO(kofi): Fill out.
  addLanguage(code: LanguageCode): void;

  getLanguages(): LanguageCode[];

  getUiStrings(languageCode: LanguageCode): UiStringTranslations | null;

  getUiStringAudioIds(languageCode: LanguageCode): UiStringAudioIds | null;

  setUiStringAudioIds(input: {
    languageCode: LanguageCode;
    data: UiStringAudioIds;
  }): void;

  setUiStrings(input: {
    languageCode: LanguageCode;
    data: UiStringTranslations;
  }): void;
}

/** Creates a shareable implementation of the {@link UiStringsStore}. */
export function createUiStringStore(dbClient: DbClient): UiStringsStore {
  return {
    addLanguage(languageCode: LanguageCode): void {
      dbClient.run(
        'insert or ignore into languages (code) values (?)',
        languageCode
      );
    },

    getLanguages(): LanguageCode[] {
      const result = dbClient.all('select code from languages') as Array<{
        code: string;
      }>;

      return result.map((row) =>
        safeParse(LanguageCodeSchema, row.code).unsafeUnwrap()
      );
    },

    getUiStrings(languageCode) {
      const row = dbClient.one(
        `
        select
          data
        from ui_strings
        where
          language_code = ?
      `,
        languageCode
      ) as Optional<{ data: string }>;

      if (!row) {
        return null;
      }

      return safeParseJson(row.data, UiStringTranslationsSchema).unsafeUnwrap();
    },

    getUiStringAudioIds(languageCode) {
      const row = dbClient.one(
        `
        select
          data
        from ui_string_audio_ids
        where
          language_code = ?
      `,
        languageCode
      ) as Optional<{ data: string }>;

      if (!row) {
        return null;
      }

      return safeParseJson(row.data, UiStringAudioIdsSchema).unsafeUnwrap();
    },

    setUiStrings(input) {
      const { languageCode, data } = input;

      this.addLanguage(languageCode);

      dbClient.run(
        `
          insert or replace into ui_strings (
            language_code,
            data
          ) values
            (?, ?)
        `,
        languageCode,
        JSON.stringify(data)
      );
    },

    setUiStringAudioIds(input) {
      const { languageCode, data } = input;

      dbClient.run(
        `
          insert or replace into ui_string_audio_ids (
            language_code,
            data
          ) values
            (?, ?)
        `,
        languageCode,
        JSON.stringify(data)
      );
    },
  };
}
