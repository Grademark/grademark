import { assert, expect } from 'chai';
import * as dataForge from 'data-forge';
import * as path from 'path';
import 'data-forge-indicators';
import { IDataFrame } from 'data-forge';
import { DataFrame } from 'data-forge';
import { checkArray, checkDataFrameExpectations, readDataFrame, checkObjectExpectations } from './check-object';
import { Stream } from 'stream';
import { StopLossFn, ProfitTargetFn, EntryRuleFn, ExitRuleFn } from '../../lib/strategy';
import { ITrade, analyze } from '../..';

describe("analyze mean reversion", function (this: any) {
    
    this.timeout(15000);

    it("with only profits", function  (this: any) {
        const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - all profits.dataframe"));
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });

    it("with only losses", function  (this: any) {
        const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - all losses.dataframe"));
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });

    it("with profits and losses", function  (this: any) {
        const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - profits and losses.dataframe"));
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });
});