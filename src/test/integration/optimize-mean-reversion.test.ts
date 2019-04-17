import { assert, expect } from 'chai';
import { OptimizeSearchDirection, optimizeSingleParameter } from '../../lib/optimize';
import { analyze } from '../../lib/analyze';
import { IBar } from '../../lib/bar';
import * as dataForge from 'data-forge';
import 'data-forge-indicators';
import * as path from 'path';
import { EntryRuleFn, ExitRuleFn, StopLossFn, ProfitTargetFn, IStrategy } from '../../lib/strategy';
import { checkDataFrameExpectations, checkObjectExpectations } from '../integration/check-object';

interface MyBar extends IBar {
    sma: number;
}

describe("optimize mean reversion", function (this: any) {
    
    this.timeout(50000);

    let inputSeries = dataForge.readFileSync(path.join(__dirname, "data/STW-short.csv"))
        .parseCSV()
        .parseDates("date", "D/MM/YYYY")
        .parseFloats(["open", "high", "low", "close", "volume"])
        .setIndex("date") // Index so we can later merge on date.
        .renameSeries({ date: "time" });

        interface MyParameters {
            SMA: number;
        }

        interface IStrategyModifications {
        entryRule?: EntryRuleFn<MyBar, MyParameters>;
        exitRule?: ExitRuleFn<MyBar, MyParameters>;
        stopLoss?: StopLossFn<MyBar, MyParameters>;
        trailingStopLoss?: StopLossFn<MyBar, MyParameters>;
        profitTarget?: ProfitTargetFn<MyBar, MyParameters>;
    }

    function meanReversionStrategy(modifications?: IStrategyModifications): IStrategy<IBar, MyBar, MyParameters, number> {
        let strategy: IStrategy<IBar, MyBar, MyParameters, number> = {
            parameters: {
                SMA: 30,
            },

            prepIndicators: args => {
                const movingAverage = args.inputSeries
                    .deflate(bar => bar.close)
                    .sma(args.parameters.SMA);
                
                return args.inputSeries
                    .withSeries("sma", movingAverage)
                    .skip(args.parameters.SMA)
                    .cast<MyBar>();
            },

            entryRule: (enterPosition, args) => {
                if (args.bar.close < args.bar.sma) {
                    enterPosition();
                }
            },
    
            exitRule: (exitPosition, args) => {
                if (args.bar.close > args.bar.sma) {
                    exitPosition();
                }
            },
        };

        if (modifications) {
            strategy = Object.assign(strategy, modifications);
        }

        return strategy;
    }

    it("can optimize for largest objective function value", function (this: any) {
        const strategy = meanReversionStrategy();
        const result = optimizeSingleParameter(strategy, { 
                name: "SMA", 
                startingValue: 5, 
                endingValue: 25, 
                stepSize: 10,
            },
            trades => analyze(10000, trades).profitPct,
            inputSeries,
            {
                searchDirection: OptimizeSearchDirection.Highest,
                recordTrades: true,
            }
        );

        checkObjectExpectations(result, this.test);
    });

    it("larger optimization", function (this: any) {
        const strategy = meanReversionStrategy();
        const result = optimizeSingleParameter(strategy, { 
                name: "SMA", 
                startingValue: 5, 
                endingValue: 25, 
                stepSize: 2,
            },
            trades => analyze(10000, trades).profitPct,
            inputSeries,
            {
                searchDirection: OptimizeSearchDirection.Highest,
                recordTrades: true,
            }
        );

        checkObjectExpectations(result, this.test);
    });
});
