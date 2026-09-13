export type EventKind =
  'birthday' | 'death_anniversary' | 'wedding_anniversary' | 'gathering' | 'other';
export type EventCalendarType = 'gregorian' | 'lunar_vietnamese';
export type EventRecurrence = 'none' | 'yearly';
export type LunarMonthMode = 'regular' | 'leap_only' | 'both';
export type MissingLunarDayPolicy = 'last_day' | 'skip';
export type February29Policy = 'feb28' | 'mar1' | 'skip';
export type EventReminderOffset = 'seven_days' | 'one_day' | 'same_day';
export type EventStatus = 'active' | 'cancelled';
export type EventOccurrenceStatus = 'active' | 'cancelled';
export type EventRsvpResponse = 'yes' | 'no' | 'maybe';

export interface EventDateParts {
  year: number | null;
  month: number;
  day: number;
}

export interface LunarEventPolicy {
  month_mode: LunarMonthMode;
  missing_day: MissingLunarDayPolicy;
}

interface EventInputBase {
  kind: EventKind;
  title: string;
  note?: string | null;
  location?: string | null;
  member_id?: string | null;
  recurrence: EventRecurrence;
  timezone: 'Asia/Ho_Chi_Minh';
  date_parts: EventDateParts;
  all_day: boolean;
  starts_local_time?: string;
  duration_minutes?: number;
  reminder_offsets: EventReminderOffset[];
}

export interface GregorianEventInput extends EventInputBase {
  calendar_type: 'gregorian';
  feb29_policy?: February29Policy;
}

export interface VietnameseLunarEventInput extends EventInputBase {
  calendar_type: 'lunar_vietnamese';
  lunar_policy: LunarEventPolicy;
}

export type CreateEventInput = GregorianEventInput | VietnameseLunarEventInput;

export interface UpdateEventInput {
  version: number;
  event: CreateEventInput;
}

export interface CancelEventInput {
  version: number;
}

export interface UpsertEventRsvpInput {
  response: EventRsvpResponse;
}

export type EventDto = CreateEventInput & {
  id: string;
  status: EventStatus;
  revision: number;
  version: number;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
};

export interface EventOccurrenceDto {
  id: string;
  event_id: string;
  event_revision: number;
  local_date: string;
  starts_at: string | null;
  ends_at: string | null;
  calendar_conversion_version: string | null;
  status: EventOccurrenceStatus;
  my_rsvp: EventRsvpResponse | null;
  event: Pick<EventDto, 'id' | 'kind' | 'title' | 'member_id' | 'calendar_type' | 'all_day'>;
}

export interface EventOccurrenceListResponse {
  occurrences: EventOccurrenceDto[];
  next_cursor: string | null;
}

export interface EventDetailResponse {
  event: EventDto;
  occurrences: EventOccurrenceDto[];
}

export interface EventRsvpDto {
  occurrence_id: string;
  response: EventRsvpResponse;
  updated_at: string;
}

const uuid = { type: 'string', format: 'uuid' } as const;
const nullableText = (maxLength: number) =>
  ({ type: ['string', 'null'], minLength: 1, maxLength }) as const;
const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const;
const localTime = { type: 'string', pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$' } as const;
const version = { type: 'integer', minimum: 1 } as const;
const nullableCalendarYear = {
  anyOf: [{ type: 'integer', minimum: 1200, maximum: 2199 }, { type: 'null' }],
} as const;

const gregorianDatePartsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['year', 'month', 'day'],
  properties: {
    year: nullableCalendarYear,
    month: { type: 'integer', minimum: 1, maximum: 12 },
    day: { type: 'integer', minimum: 1, maximum: 31 },
  },
  allOf: [
    {
      if: { required: ['month'], properties: { month: { enum: [4, 6, 9, 11] } } },
      then: { properties: { day: { type: 'integer', maximum: 30 } } },
    },
    {
      if: { required: ['month'], properties: { month: { const: 2 } } },
      then: { properties: { day: { type: 'integer', maximum: 29 } } },
    },
    {
      if: {
        required: ['year', 'month', 'day'],
        properties: {
          year: { type: 'integer' },
          month: { const: 2 },
          day: { const: 29 },
        },
      },
      then: {
        properties: {
          year: {
            anyOf: [
              { type: 'integer', multipleOf: 400 },
              {
                type: 'integer',
                allOf: [
                  { type: 'integer', multipleOf: 4 },
                  { not: { type: 'integer', multipleOf: 100 } },
                ],
              },
            ],
          },
        },
      },
    },
  ],
} as const;

const lunarDatePartsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['year', 'month', 'day'],
  properties: {
    year: nullableCalendarYear,
    month: { type: 'integer', minimum: 1, maximum: 12 },
    day: { type: 'integer', minimum: 1, maximum: 30 },
  },
} as const;

const lunarPolicySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['month_mode', 'missing_day'],
  properties: {
    month_mode: { type: 'string', enum: ['regular', 'leap_only', 'both'] },
    missing_day: { type: 'string', enum: ['last_day', 'skip'] },
  },
} as const;

const commonRequired = [
  'kind',
  'title',
  'calendar_type',
  'recurrence',
  'timezone',
  'date_parts',
  'all_day',
  'reminder_offsets',
] as const;

const commonProperties = {
  kind: {
    type: 'string',
    enum: ['birthday', 'death_anniversary', 'wedding_anniversary', 'gathering', 'other'],
  },
  title: { type: 'string', minLength: 1, maxLength: 160 },
  note: nullableText(2000),
  location: nullableText(300),
  member_id: { anyOf: [uuid, { type: 'null' }] },
  recurrence: { type: 'string', enum: ['none', 'yearly'] },
  timezone: { type: 'string', enum: ['Asia/Ho_Chi_Minh'] },
  all_day: { type: 'boolean' },
  starts_local_time: localTime,
  duration_minutes: { type: 'integer', minimum: 1, maximum: 1440 },
  reminder_offsets: {
    type: 'array',
    maxItems: 3,
    uniqueItems: true,
    items: { type: 'string', enum: ['seven_days', 'one_day', 'same_day'] },
  },
} as const;

const timingRules = [
  {
    if: { required: ['all_day'], properties: { all_day: { const: false } } },
    then: { required: ['starts_local_time'] },
  },
  {
    if: { required: ['all_day'], properties: { all_day: { const: true } } },
    then: { properties: { starts_local_time: false, duration_minutes: false } },
  },
] as const;

const oneTimeYearRule = {
  if: { required: ['recurrence'], properties: { recurrence: { const: 'none' } } },
  then: {
    properties: {
      date_parts: {
        type: 'object',
        properties: { year: { type: 'integer', minimum: 1200, maximum: 2199 } },
      },
    },
  },
} as const;

const yearlyFebruary29Condition = {
  required: ['recurrence', 'date_parts'],
  properties: {
    recurrence: { const: 'yearly' },
    date_parts: {
      type: 'object',
      required: ['month', 'day'],
      properties: { month: { const: 2 }, day: { const: 29 } },
    },
  },
} as const;

const gregorianEventSchema = {
  type: 'object',
  additionalProperties: false,
  required: commonRequired,
  properties: {
    ...commonProperties,
    calendar_type: { const: 'gregorian' },
    date_parts: gregorianDatePartsSchema,
    feb29_policy: { type: 'string', enum: ['feb28', 'mar1', 'skip'] },
  },
  allOf: [
    ...timingRules,
    oneTimeYearRule,
    {
      if: yearlyFebruary29Condition,
      then: { required: ['feb29_policy'] },
      else: { properties: { feb29_policy: false } },
    },
  ],
} as const;

const lunarEventSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...commonRequired, 'lunar_policy'],
  properties: {
    ...commonProperties,
    calendar_type: { const: 'lunar_vietnamese' },
    date_parts: lunarDatePartsSchema,
    lunar_policy: lunarPolicySchema,
  },
  allOf: [
    ...timingRules,
    oneTimeYearRule,
    {
      if: { required: ['recurrence'], properties: { recurrence: { const: 'none' } } },
      then: {
        properties: {
          lunar_policy: {
            type: 'object',
            properties: { month_mode: { enum: ['regular', 'leap_only'] } },
          },
        },
      },
    },
  ],
} as const;

export const createEventBodySchema = {
  oneOf: [gregorianEventSchema, lunarEventSchema],
} as const;

export const updateEventBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'event'],
  properties: {
    version,
    event: createEventBodySchema,
  },
} as const;

export const cancelEventBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version },
} as const;

export const upsertEventRsvpBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['response'],
  properties: { response: { type: 'string', enum: ['yes', 'no', 'maybe'] } },
} as const;

export const eventListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['from', 'to'],
  properties: {
    from: isoDate,
    to: isoDate,
    cursor: { type: 'string', minLength: 1, maxLength: 500 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
} as const;

export const familyEventParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'eventId'],
  properties: { familyId: uuid, eventId: uuid },
} as const;

export const familyOccurrenceParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'occurrenceId'],
  properties: { familyId: uuid, occurrenceId: uuid },
} as const;
