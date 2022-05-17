import * as z from 'zod';
import { Iso8601Date } from '@votingworks/types';

export type Iso8601Timestamp = string;

export const Iso8601TimestampSchema = Iso8601Date;

export type OkResponse<Props = Record<string, unknown>> = {
  status: 'ok';
} & Props;

export const OkResponseSchema: z.ZodSchema<OkResponse> = z.object({
  status: z.literal('ok'),
});

export interface ErrorsResponse {
  status: 'error';
  errors: Array<{ type: string; message: string }>;
}

export const ErrorsResponseSchema: z.ZodSchema<ErrorsResponse> = z.object({
  status: z.literal('error'),
  errors: z.array(z.object({ type: z.string(), message: z.string() })),
});
