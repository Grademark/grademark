import { assert, expect } from 'chai';
import * as path from 'path';
import { readDataFrame, checkDataFrameExpectations } from './check-object';
import { ITrade, monteCarlo } from '../..';
import { DataFrame } from 'data-forge';
import { IDataFrame } from 'data-forge';

describe("monte-carlo mean reversion", function (this: any) {
    
    this.timeout(15000);

    const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades.dataframe"));

    it("monte-carlo", function  (this: any) {
        const samples = monteCarlo(sampleTrades, 10, 5);
        const flattened = samples
            .aggregate<IDataFrame<number, ITrade>>(new DataFrame<number, ITrade>(), 
                (flattened, sample) => flattened.concat(sample)
            );
        checkDataFrameExpectations(flattened, this.test);
    });
});