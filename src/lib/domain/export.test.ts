import { describe, expect, it } from 'vitest';
import {
  csvField,
  csvText,
  decimal,
  decimalsDeep,
  exportFileName,
  SHOT_COLUMNS,
  shotsCsv,
  type ShotExportRow
} from './export';

const ZONE = 'Europe/Copenhagen';
// 30 October 2026, 06:42 UTC = 07:42 in Copenhagen (winter time).
const BREWED = Date.UTC(2026, 9, 30, 6, 42);

const row: ShotExportRow = {
  brewedAt: BREWED,
  beanName: 'Guji Hambela',
  roaster: 'Coffee Collective',
  roastDate: '2026-10-18',
  machine: 'Lelit Bianca',
  grinder: 'Timemore Sculptor 064S',
  basket: 'VST · 18 g',
  routine: 'Daily routine',
  setup: '93 °C · Flat 9.0 bar · Preinfusion 4 s',
  grind: 1600,
  dose: 18000,
  yield: 36500,
  time: 28000,
  score: 8,
  balance: -2,
  body: 6,
  sweetness: 7,
  aftertaste: 5,
  flavors: ['Blueberry', 'Jasmine'],
  notes: 'Bright, "juicy",\nlong finish'
};

describe('decimal', () => {
  it('D-252: thousandths become plain decimals with a point, empty when not set', () => {
    expect(decimal(18000)).toBe('18');
    expect(decimal(36500)).toBe('36.5');
    expect(decimal(1600)).toBe('1.6');
    expect(decimal(1001)).toBe('1.001');
    expect(decimal(-2500)).toBe('-2.5');
    expect(decimal(null)).toBe('');
  });
});

describe('csvField and csvText', () => {
  it('D-252: a field with a comma, quote or line break is quoted, quotes doubled', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('')).toBe('');
  });

  it('D-252: rows end with CRLF and the file starts with a byte order mark, so spreadsheets read ø and °', () => {
    expect(
      csvText([
        ['a', 'b'],
        ['1', '2']
      ])
    ).toBe('﻿a,b\r\n1,2\r\n');
  });
});

describe('shotsCsv', () => {
  it('D-252: plain column names with their units', () => {
    expect(SHOT_COLUMNS).toEqual([
      'Date',
      'Time of day',
      'Bean',
      'Roaster',
      'Roast date',
      'Machine',
      'Grinder',
      'Basket',
      'Puck prep',
      'Setup',
      'Grind',
      'Dose (g)',
      'Yield (g)',
      'Time (s)',
      'Ratio (1 : x)',
      'Score',
      'Balance (sour −10 to bitter +10)',
      'Body',
      'Sweetness',
      'Aftertaste',
      'Flavor notes',
      'Notes'
    ]);
  });

  it('D-252: one row per shot, the date and time in the account’s time zone', () => {
    const lines = shotsCsv([row], ZONE).slice(1).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      '2026-10-30,07:42,Guji Hambela,Coffee Collective,2026-10-18,Lelit Bianca,Timemore Sculptor 064S,' +
        'VST · 18 g,Daily routine,93 °C · Flat 9.0 bar · Preinfusion 4 s,1.6,18,36.5,28,2.0,8,-2,6,7,5,' +
        'Blueberry; Jasmine,"Bright, ""juicy"",\nlong finish"'
    );
    expect(lines[2]).toBe('');
  });

  it('D-11, D-252: what was not set stays empty, never 0', () => {
    const csv = shotsCsv(
      [
        {
          ...row,
          roaster: null,
          basket: null,
          routine: null,
          yield: null,
          time: null,
          score: null,
          balance: null,
          body: null,
          sweetness: null,
          aftertaste: null,
          flavors: [],
          notes: null
        }
      ],
      ZONE
    );
    const fields = csv.slice(1).split('\r\n')[1].split(',');
    expect(fields).toHaveLength(SHOT_COLUMNS.length);
    expect(fields.slice(11)).toEqual(['18', '', '', '', '', '', '', '', '', '', '']);
    expect(fields[3]).toBe('');
  });

  it('D-252: the ratio is rounded once to one decimal, as the app shows it (D-03)', () => {
    const csv = shotsCsv([{ ...row, dose: 18000, yield: 37800 }], ZONE);
    expect(csv.split('\r\n')[1].split(',')[14]).toBe('2.1');
  });
});

describe('decimalsDeep', () => {
  it('D-252: every number in a stored setup or spec becomes a decimal; text, true/false and empty stay', () => {
    expect(
      decimalsDeep({
        temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
        steps: [
          { name: 'WDT', value: 20000 },
          { name: 'Distributor', value: null }
        ]
      })
    ).toEqual({
      temperature: { label: 'Temperature', unit: '°C', on: true, value: 93 },
      steps: [
        { name: 'WDT', value: 20 },
        { name: 'Distributor', value: null }
      ]
    });
  });
});

describe('exportFileName', () => {
  it('D-251, D-252: files are named by the day in the account’s time zone', () => {
    const late = Date.UTC(2026, 9, 30, 23, 30); // 00:30 on 31 October in Copenhagen
    expect(exportFileName('backup', late, ZONE)).toBe('coffee-nerd-backup-2026-10-31.db');
    expect(exportFileName('shots', BREWED, ZONE)).toBe('coffee-nerd-shots-2026-10-30.csv');
    expect(exportFileName('everything', BREWED, ZONE)).toBe(
      'coffee-nerd-everything-2026-10-30.json'
    );
  });
});
