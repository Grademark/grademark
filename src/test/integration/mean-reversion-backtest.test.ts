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

interface MyBar extends IBar {
    sma: number;
}

describe("mean reversion backtest", function (this: any) {

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

    function output(test: any, dataFrame: IDataFrame<any, any>): void {
        const outputFilePath = path.join(__dirname, "output", test.fullTitle() + ".dataframe");
        const serializedDataFrame = dataFrame.serialize();
        const json = JSON.stringify(serializedDataFrame, null, 4);
        fs.writeFileSync(outputFilePath, json);
    }
        
    function loadExpectedInput<IndexT = any, ValueT = any>(test: any): IDataFrame<IndexT, ValueT> {
        const inputFilePath = path.join(__dirname, "output", test.fullTitle() + ".dataframe");
        const json = fs.readFileSync(inputFilePath, "utf8");
        const serializedDataFrame = JSON.parse(json) as ISerializedDataFrame;
        return DataFrame.deserialize<IndexT, ValueT>(serializedDataFrame);
    }

    function meanReversionStrategy(): IStrategy<MyBar> {
        const strategy: IStrategy<MyBar> = {
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
        return strategy;
    }
    
    it("basic strategy", function  (this: any) {
        const strategy = meanReversionStrategy();    
        const trades = backtest(strategy, inputSeries);
        //const expectedTrades = loadExpectedInput<number, ITrade>(this.test);
        //checkArray(trades.toArray(), expectedTrades.toArray());

        output(this.test, trades);
    });

    it("with stop loss", function  (this: any) {
        const strategy: IStrategy<MyBar> = {
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
    
            stopLoss: (entryPrice, latestBar, lookback) => {
                return entryPrice * (5/100);
            },
        };

    
        const trades = backtest(strategy, inputSeries);
        const expectedTrades = loadExpectedInput<number, ITrade>(this.test);
        checkArray(trades.toArray(), expectedTrades.toArray());

        //output(this.test, trades);
    });

    it("with trailing stop", function  (this: any) {
        const strategy: IStrategy<MyBar> = {
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
    
            trailingStopLoss: (entryPrice, latestBar, lookback) => {
                return latestBar.close * (5/100);
            },
        };

    
        const trades = backtest(strategy, inputSeries);
        const expectedTrades = loadExpectedInput<number, ITrade>(this.test);
        checkArray(trades.toArray(), expectedTrades.toArray());

        //output(this.test, trades);
    });

    it("with profit target", function  (this: any) {
        const strategy: IStrategy<MyBar> = {
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
    
            profitTarget: (entryPrice, latestBar, lookback) => {
                return entryPrice * (5/100);
            },
        };

    
        const trades = backtest(strategy, inputSeries);
        const expectedTrades = loadExpectedInput<number, ITrade>(this.test);
        checkArray(trades.toArray(), expectedTrades.toArray());

        //output(this.test, trades);
    });

});