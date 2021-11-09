import { ESLintUtils } from '@typescript-eslint/experimental-utils';
import * as ts from 'typescript';
import { join } from 'path';
import rule from '../../src/rules/gts_jsdoc';

const ruleTester = new ESLintUtils.RuleTester({
  parserOptions: {
    ecmaVersion: 2018,
    tsconfigRootDir: join(__dirname, '../fixtures'),
    project: './tsconfig.json',
  },
  parser: '@typescript-eslint/parser',
});

const tsSupportsOverride = 'OverrideKeyword' in ts.SyntaxKind;

ruleTester.run('gts-jsdoc', rule, {
  valid: [
    tsSupportsOverride
      ? `
      class Foo extends Bar {
        override doSomething() {}
      }
    `
      : `
      class Foo extends bar {
        doSomething() {}
      }
    `,
    `
      // ignore line comments @override @implements @extends @enum
    `,
    `/** @see {@link foo} */`,
  ],
  invalid: [
    {
      code: '/** @override */',
      errors: [{ messageId: 'noJsDocOverride', line: 1 }],
    },
    {
      code: '/** @implements */',
      errors: [{ messageId: 'noJsDocImplements', line: 1 }],
    },
    {
      code: '/** @extends */',
      errors: [{ messageId: 'noJsDocExtends', line: 1 }],
    },
    {
      code: '/** @enum */',
      errors: [{ messageId: 'noJsDocEnum', line: 1 }],
    },
    {
      code: '/** @private */',
      errors: [{ messageId: 'noJsDocPrivate', line: 1 }],
    },
    {
      code: '/** @protected */',
      errors: [{ messageId: 'noJsDocProtected', line: 1 }],
    },
    {
      code: '/** @type {number} */',
      errors: [{ messageId: 'noJsDocType', line: 1 }],
    },
    {
      code: `
        /**
         * @param {number} a
         * @param {number} b
         * @returns {number}
         */
        function add(a: number, b: number): number {
          return a + b;
        }
      `,
      errors: [
        { messageId: 'noJsDocType' },
        { messageId: 'noJsDocType' },
        { messageId: 'noJsDocType' },
      ],
    },
  ],
});
