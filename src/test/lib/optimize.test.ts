import { assert, expect } from 'chai';
import { IParameterDef, OptimizeSearchDirection, optimizeSingleParameter } from '../../lib/optimize';
import { IDataFrame } from 'data-forge';
import { DataFrame } from 'data-forge';
import { IBar } from '../../lib/bar';
import { IStrategy, EnterPositionFn, IEntryRuleArgs } from '../../lib/strategy';
import { ITrade } from '../../lib/trade';
import * as moment from 'dayjs';

describe("optimize", () => {

    function makeDate(dateStr: string, fmt?: string): Date {
        return moment(dateStr, fmt || "YYYY/MM/DD").toDate();
    }

    interface IBarDef {
        time: string;
        open?: number;
        high?: number;
        low?: number;
        close: number;
        volume?: number;
    }

    function makeBar(bar: IBarDef): IBar {
        return {
            time: makeDate(bar.time),
            open: bar.open !== undefined ? bar.open : bar.close,
            high: bar.high !== undefined ? bar.high : bar.close,
            low: bar.low !== undefined ? bar.low : bar.close,
            close: bar.close,
            volume: bar.volume !== undefined ? bar.volume : 1,
        };
    }
    
    function makeDataSeries(bars: IBarDef[]): IDataFrame<number, IBar> {
        return new DataFrame<number, IBar>(bars.map(makeBar));
    }

    function unconditionalEntry(enterPosition: EnterPositionFn, args: IEntryRuleArgs<IBar, {}>) {
        enterPosition(); // Unconditionally enter position at market price.
    };

    const inputSeries = makeDataSeries([
        { time: "2018/10/20", close: 100 },
        { time: "2018/10/21", close: 110 },
        { time: "2018/10/22", close: 120 },
        { time: "2018/10/23", close: 130 },
        { time: "2018/10/24", close: 140 },
        { time: "2018/10/25", close: 150 },
        { time: "2018/10/26", close: 160 },
        { time: "2018/10/27", close: 170 },
        { time: "2018/10/28", close: 180 },
        { time: "2018/10/29", close: 190 },
    ]);
    
    it("can perform multiple optimization iterations", () => {

        const strategy = {
            entryRule: unconditionalEntry,

        } as IStrategy;

        const parameter = {
             name: "MyParameter",
             startingValue: 1,
             endingValue: 10,
             stepSize: 1,
        };

        const mockPerformanceMetrics = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let mockPerformanceMetricIndex = 0;
        const objectiveFn = (trades: IDataFrame<number, ITrade>) => mockPerformanceMetrics[mockPerformanceMetricIndex]++;

        const result = optimizeSingleParameter(strategy, parameter, objectiveFn, inputSeries, { searchDirection: OptimizeSearchDirection.Highest });
        expect(result.iterationResults.length).to.eql(10);
    });

    it("iteration with highest performance metric wins", () => {

        const strategy = {
            entryRule: unconditionalEntry,

        } as IStrategy;

        const parameter = {
             name: "MyParameter",
             startingValue: 1,
             endingValue: 3,
             stepSize: 1,
        };

        const mockPerformanceMetrics = [5, 6, 2];
        let mockPerformanceMetricIndex = 0;
        const objectiveFn = (trades: IDataFrame<number, ITrade>) => mockPerformanceMetrics[mockPerformanceMetricIndex++];

        const result = optimizeSingleParameter(strategy, parameter, objectiveFn, inputSeries, { searchDirection: OptimizeSearchDirection.Highest });
        expect(result.bestIterationResult.iterationIndex).to.eql(1);
    });

    it("iteration with lowest performance metric wins", () => {

        const strategy = {
            entryRule: unconditionalEntry,

        } as IStrategy;

        const parameter = {
             name: "MyParameter",
             startingValue: 1,
             endingValue: 3,
             stepSize: 1,
        };

        const mockPerformanceMetrics = [5, 6, 2];
        let mockPerformanceMetricIndex = 0;
        const objectiveFn = (trades: IDataFrame<number, ITrade>) => mockPerformanceMetrics[mockPerformanceMetricIndex++];

        const result = optimizeSingleParameter(strategy, parameter, objectiveFn, inputSeries, { searchDirection: OptimizeSearchDirection.Lowest });
        expect(result.bestIterationResult.iterationIndex).to.eql(2);

    });

});
