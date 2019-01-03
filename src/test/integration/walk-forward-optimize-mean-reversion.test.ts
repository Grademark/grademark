import { assert, expect } from 'chai';
import { analyze } from '../../lib/analyze';
import { IBar } from '../../lib/bar';
import * as dataForge from 'data-forge';
import 'data-forge-indicators';
import * as path from 'path';
import { EntryRuleFn, ExitRuleFn, StopLossFn, ProfitTargetFn, IStrategy } from '../../lib/strategy';
import { checkDataFrameExpectations, checkObjectExpectations } from '../integration/check-object';
import { walkForwardOptimize } from '../../lib/walk-forward-optimize';
import { OptimizeSearchDirection } from '../../lib/optimize';

interface MyBar extends IBar {
    sma: number;
}

describe("walk forward optimize mean reversion", function (this: any) {
    
    this.timeout(50000);

    let inputSeries = dataForge.readFileSync(path.join(__dirname, "data/STW.csv"))
        .parseCSV()
        .parseDates("date", "DD/MM/YYYY")
        .parseFloats(["open", "high", "low", "close", "volume"])
        .setIndex("date") // Index so we can later merge on date.
        .renameSeries({ date: "time" });

    interface IStrategyModifications {
        entryRule?: EntryRuleFn<MyBar>;
        exitRule?: ExitRuleFn<MyBar>;
        stopLoss?: StopLossFn<MyBar>;
        trailingStopLoss?: StopLossFn<MyBar>;
        profitTarget?: ProfitTargetFn<MyBar>;
    }

    interface IParameters {
        SMA: number;
    }

    function meanReversionStrategy(modifications?: IStrategyModifications): IStrategy<IBar, MyBar, IParameters, number> {
        let strategy: IStrategy<IBar, MyBar, IParameters, number> = {
            parameters: {
                SMA: 30,
            },

            prepIndicators: (parameters, inputSeries) => {
                const movingAverage = inputSeries
                    .deflate(bar => bar.close)
                    .sma(parameters.SMA);
                
                return inputSeries
                    .withSeries("sma", movingAverage)
                    .skip(parameters.SMA)
                    .cast<MyBar>();
            },

            entryRule: (enterPosition, bar, lookback) => {
                if (bar.close < bar.sma) {
                    enterPosition();
                }
            },
    
            exitRule: (exitPosition, position, bar, lookback) => {
                if (bar.close > bar.sma) {
                    exitPosition();
                }
            },
        };

        if (modifications) {
            strategy = Object.assign(strategy, modifications);
        }

        return strategy;
    }

    it("can do walk forward optimization", function (this: any) {
        const strategy = meanReversionStrategy();
        const result = walkForwardOptimize(strategy, { 
                name: "SMA", 
                startingValue: 5, 
                endingValue: 25, 
                stepSize: 10,
            },
            trades => analyze(10000, trades).profitPct,
            inputSeries,
            90,
            30,
            {
                searchDirection: OptimizeSearchDirection.Highest,
            }
        );

        checkObjectExpectations(result, this.test);
    });

});
