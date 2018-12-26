import { assert, expect } from 'chai';
import * as dataForge from 'data-forge';
import 'data-forge-fs';
import 'data-forge-indicators';
import * as path from 'path';
import * as fs from 'fs';
import { IStrategy, backtest, IBar, ITrade } from '../..';
import { IDataFrame } from 'data-forge';
import { DataFrame } from 'data-forge';
import { ISerializedDataFrame } from 'data-forge/build/lib/dataframe';
import { checkArray } from './check-object';
import { Stream } from 'stream';
import { StopLossFn, ProfitTargetFn, EntryRuleFn, ExitRuleFn } from '../../lib/strategy';

interface MyBar extends IBar {
    sma: number;
}

describe("backtest mean reversion", function (this: any) {
    
    this.timeout(15000);

    let inputSeries = dataForge.readFileSync(path.join(__dirname, "data/STW.csv"))
        .parseCSV()
        .parseDates("date", "DD/MM/YYYY")
        .parseFloats(["open", "high", "low", "close", "volume"])
        .setIndex("date") // Index so we can later merge on date.
        .renameSeries({ date: "time" });

    const movingAverage = inputSeries
        .deflate(bar => bar.close)          // Extract closing price series.
        .sma(30);                           // 30 day moving average.
    
    inputSeries = inputSeries
        .withSeries("sma", movingAverage)   // Integrate moving average into data, indexed on date.
        .skip(30)                           // Skip blank sma entries.

    function output(filePath: string, dataFrame: IDataFrame<any, any>): void {
        const serializedDataFrame = dataFrame.serialize();
        const json = JSON.stringify(serializedDataFrame, null, 4);
        fs.writeFileSync(filePath, json);
    }
        
    function loadExpectedInput<IndexT = any, ValueT = any>(filePath: string): IDataFrame<IndexT, ValueT> {
        const json = fs.readFileSync(filePath, "utf8");
        const serializedDataFrame = JSON.parse(json) as ISerializedDataFrame;
        return DataFrame.deserialize<IndexT, ValueT>(serializedDataFrame);
    }

    function checkData(trades: IDataFrame<number, ITrade>, test: any) {
        const filePath = path.join(__dirname, "output", test.fullTitle() + ".dataframe");
        if (!fs.existsSync(filePath)) {
            output(filePath, trades);
        }

        const expectedTrades = loadExpectedInput<number, ITrade>(filePath);
        checkArray(trades.toArray(), expectedTrades.toArray());
    }

    interface IStrategyModifications {
        entryRule?: EntryRuleFn<MyBar>;
        exitRule?: ExitRuleFn<MyBar>;
        stopLoss?: StopLossFn<MyBar>;
        trailingStopLoss?: StopLossFn<MyBar>;
        profitTarget?: ProfitTargetFn<MyBar>;        
    }

    function meanReversionStrategy(modifications?: IStrategyModifications): IStrategy<MyBar> {
        let strategy: IStrategy<MyBar> = {
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
    
    it("basic strategy", function  (this: any) {
        const strategy = meanReversionStrategy();    
        const trades = backtest(strategy, inputSeries);
        checkData(trades, this.test);
    });

    it("with stop loss", function  (this: any) {
        const strategy = meanReversionStrategy({
            stopLoss: entryPrice => entryPrice * (5/100),
        });

        const trades = backtest(strategy, inputSeries);
        checkData(trades, this.test);
    });

    it("with trailing stop", function  (this: any) {
        const strategy = meanReversionStrategy({
            trailingStopLoss: (entryPrice, latestBar) => latestBar.close * (5/100),
        });
    
        const trades = backtest(strategy, inputSeries);
        checkData(trades, this.test);
    });

    it("with profit target", function  (this: any) {
        const strategy = meanReversionStrategy({
            profitTarget: entryPrice => entryPrice * (5/100),
        });
    
        const trades = backtest(strategy, inputSeries);
        checkData(trades, this.test);
    });

    it("with conditional buy", function  (this: any) {
        const strategy = meanReversionStrategy({
            entryRule: (enterPosition, curBar) => {
                enterPosition(curBar.close + (curBar.close * (0.1/100)))
            }
        });
    
        const trades = backtest(strategy, inputSeries);
        checkData(trades, this.test);
    });

    it("with maximum holding period", function  (this: any) {
        const strategy = meanReversionStrategy({
            exitRule: (exitPosition, position) => {
                if (position.holdingPeriod >= 3) {
                    exitPosition();
                }
            }
        });

        const trades = backtest(strategy, inputSeries);
        checkData(trades, this.test);
    });
});