import * as path from 'path';
import 'data-forge-indicators';
import { readDataFrame, checkObjectExpectations } from './check-object';
import { ITrade, analyze } from '../..';

describe("analyze mean reversion", function (this: any) {
    
    this.timeout(15000);

    it("with only profits", function  (this: any) {
        const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - all profits.dataframe")).toArray();
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });

    it("with only losses", function  (this: any) {
        const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - all losses.dataframe")).toArray();
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });

    it("with profits and losses", function  (this: any) {
        const sampleTrades = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - profits and losses.dataframe")).toArray();
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });
});