import { assert, expect } from 'chai';
import * as dataForge from 'data-forge';
import * as path from 'path';
import 'data-forge-indicators';
import { IDataFrame } from 'data-forge';
import { DataFrame } from 'data-forge';
import { ISerializedDataFrame } from 'data-forge/build/lib/dataframe';
import { checkArray, checkDataFrameExpectations, readDataFrame, checkObjectExpectations } from './check-object';
import { Stream } from 'stream';
import { StopLossFn, ProfitTargetFn, EntryRuleFn, ExitRuleFn } from '../../lib/strategy';
import { ITrade, analyze } from '../..';

describe("analyze mean reversion", function (this: any) {
    
    this.timeout(15000);

    const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades.dataframe"));

    it("analyze", function  (this: any) {
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });
});