import { err, ok, typedAs } from '@votingworks/basics';
import { Buffer } from 'buffer';
import * as fc from 'fast-check';
import { MAX_UINT16 } from './constants';
import { CoderType } from './message_coder';
import { DecodeResult } from './types';
import { uint16 } from './uint16_coder';

test('uint16', () => {
  fc.assert(
    fc.property(
      fc.integer(0, 65535),
      fc.integer({ min: 0, max: 100 }),
      (value, byteOffset) => {
        const bitOffset = byteOffset * 8;
        const buffer = Buffer.alloc(2 + byteOffset);
        const field = uint16();
        type field = CoderType<typeof field>;

        expect(field.encodeInto(value, buffer, bitOffset)).toEqual(
          ok(bitOffset + 16)
        );
        expect(buffer.readUInt16LE(byteOffset)).toEqual(value);
        expect(field.decodeFrom(buffer, bitOffset)).toEqual(
          typedAs<DecodeResult<field>>(ok({ value, bitOffset: bitOffset + 16 }))
        );
      }
    )
  );
});

test('uint16 with enumeration', () => {
  enum Enum {
    A = 1,
    B = 2,
    C = 3,
  }

  const field = uint16<Enum>(Enum);
  expect(field.bitLength(Enum.A)).toEqual(16);
  expect(field.encode(Enum.A)).toEqual(ok(Buffer.from([1, 0])));
  expect(field.decode(Buffer.from([1, 0]))).toEqual(ok(Enum.A));
  expect(field.encode(99)).toEqual(err('InvalidValue'));
  expect(field.decode(Buffer.from([99, 0]))).toEqual(err('InvalidValue'));
});

test('uint16 with invalid value', () => {
  const coder = uint16();
  expect(coder.encode(-1)).toEqual(err('InvalidValue'));
  expect(coder.encode(MAX_UINT16 + 1)).toEqual(err('InvalidValue'));
});
