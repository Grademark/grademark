import { assert, expect } from 'chai';
import * as path from 'path';
import { readDataFrame, checkObjectExpectations } from './check-object';
import { ITrade, monteCarlo } from '../..';
import { DataFrame } from 'data-forge';
import { IDataFrame } from 'data-forge';

describe("monte-carlo mean reversion", function (this: any) {
    
    this.timeout(15000);

    const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - all profits.dataframe")).toArray();

    it("monte-carlo", function  (this: any) {
        const samples = monteCarlo(sampleTrades, 10, 5);
        const flattened = samples.flat();
        checkObjectExpectations(flattened, this.test);
    });
});