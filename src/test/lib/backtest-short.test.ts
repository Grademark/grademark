import { expect } from 'chai';
import { backtest } from '../../lib/backtest';
import { DataFrame, IDataFrame } from 'data-forge';
import { IBar } from '../../lib/bar';
import { IStrategy, EnterPositionFn, IEntryRuleArgs, ExitPositionFn, IExitRuleArgs, TradeDirection } from '../../lib/strategy';
import * as moment from 'dayjs';

describe("backtest short", () => {

    function round(value: number) {
        return Math.round(value * 100) / 100;
    }

    function makeDate(dateStr: string, fmt?: string): Date {
        return moment(dateStr, fmt || "YYYY/MM/DD").toDate();
    }

    function mockBar(): IBarDef {
        return {
            time: "2018/10/20",
            close: 2,
        };        
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

    const mockEntry = () => {};
    const mockExit = () => {};

    function mockStrategy(): IStrategy {
        return { 
            entryRule: mockEntry,
            exitRule: mockExit,
         };
    }

    function unconditionalShortEntry(enterPosition: EnterPositionFn, args: IEntryRuleArgs<IBar, {}>) {
        enterPosition({ direction: TradeDirection.Short }); // Unconditionally enter position at market price.
    };

    function unconditionalShortExit(exitPosition: ExitPositionFn, args: IExitRuleArgs<IBar, {}>) {
        exitPosition(); // Unconditionally exit position at market price.
    };

    const shortStrategyWithUnconditionalEntryAndExit: IStrategy = {
        entryRule: unconditionalShortEntry,
        exitRule: unconditionalShortExit,
    };
    
    const simpleInputSeries = makeDataSeries([
        { time: "2018/10/20", close: 1 },
        { time: "2018/10/21", close: 2 },
        { time: "2018/10/22", close: 3 },
    ]);

    const longerDataSeries = makeDataSeries([
        { time: "2018/10/20", close: 1 },
        { time: "2018/10/21", close: 2 },
        { time: "2018/10/22", close: 4 },
        { time: "2018/10/23", close: 5 },
        { time: "2018/10/24", close: 6 },
    ]);
    
    it('going short makes a loss when the price rises', () => {

        const entryPrice = 3;
        const exitPrice = 7;
        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: entryPrice, close: 4 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 5, close: 6 },
            { time: "2018/10/23", open: exitPrice, close: 8 }, // Exit position at open on this day.
        ]);

        const trades = backtest(shortStrategyWithUnconditionalEntryAndExit, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.profit).to.be.lessThan(0);
        expect(singleTrade.profit).to.eql(entryPrice-exitPrice);
    });

    it('going short makes a profit when the price drops', () => {

        const entryPrice = 6;
        const exitPrice = 2;
        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 8, close: 7 },
            { time: "2018/10/21", open: entryPrice, close: 5 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 4, close: 3 }, 
            { time: "2018/10/23", open: exitPrice, close: 1 }, // Exit position at open on this day.
        ]);

        const trades = backtest(shortStrategyWithUnconditionalEntryAndExit, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.profit).to.be.greaterThan(0);
        expect(singleTrade.profit).to.eql(entryPrice-exitPrice);
    });

    it("can exit short via stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 110 }, // Hold
            { time: "2018/10/23", close: 120 }, // Stop loss triggered.
            { time: "2018/10/24", close: 120 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.stopPrice).to.eql(120);
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("stop loss exits short based on intrabar high", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 110 },  // Hold
            { time: "2018/10/23", open: 110, high: 120, low: 100, close: 105 },  // Stop loss triggered.
            { time: "2018/10/24", close: 105 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(120);
    });

    it("stop loss is not triggered unless there is a significant rise", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day
            { time: "2018/10/22", close: 90 },  // Hold
            { time: "2018/10/23", close: 85 },  // Hold
            { time: "2018/10/24", close: 82 },  // Exit
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("finalize");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/24"));
    });

    it("can exit short via profit target", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            profitTarget: args => args.entryPrice * (10/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 95 },  // Hold
            { time: "2018/10/23", close: 90 },  // Profit target triggered.
            { time: "2018/10/24", close: 90 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.profitTarget).to.eql(90);
        expect(singleTrade.exitReason).to.eql("profit-target");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("profit target exits short based on intrabar low", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            profitTarget: args => args.entryPrice * (10/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 95 },  // Hold
            { time: "2018/10/23", open: 95, high: 100, low: 90, close: 95 },  // Profit target triggered.
            { time: "2018/10/24", close: 95 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(90);
    });

    it("short exit is not triggered unless target profit is achieved", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            profitTarget: args => args.entryPrice * (30/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day
            { time: "2018/10/22", close: 100 },  // Hold
            { time: "2018/10/23", close: 110 },  // Hold
            { time: "2018/10/24", close: 120 },  // Exit
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("finalize");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/24"));
    });

    it("can exit short via trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 110 }, // Hold
            { time: "2018/10/23", close: 120 }, // Stop loss triggered.
            { time: "2018/10/24", close: 120 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("can exit short via decreasing trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 60 },  // Hold
            { time: "2018/10/23", close: 72 },  // Stop loss triggered.
            { time: "2018/10/24", close: 72 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("trailing stop loss exits short based on intrabar high", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 110 }, // Hold
            { time: "2018/10/23", open: 110, high: 120, low: 100, close: 110 }, // Stop loss triggered.
            { time: "2018/10/24", close: 110 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(120);
    });

    it("trailing stop loss is not triggered unless there is a significant rise", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 },  // Entry day
            { time: "2018/10/22", close: 110 },  // Hold
            { time: "2018/10/23", close: 115 },  // Hold
            { time: "2018/10/24", close: 112 },  // Exit
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("finalize");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/24"));
    });

    it("can place intrabar conditional short order", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                enterPosition({ 
                    direction: TradeDirection.Short, 
                    entryPrice: 6, // Enter position when price hits 6.
                }); 
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 10 },
            { time: "2018/10/21", close: 9 },
            { time: "2018/10/22", close: 8 },
            { time: "2018/10/23", close: 7, low: 6 }, // Intraday entry.
            { time: "2018/10/24", close: 5 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/23"));
    });
    
    it("conditional short order is not executed if price doesn't reach target", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                enterPosition({ 
                    direction: TradeDirection.Short, 
                    entryPrice: 6, // Enter position when price hits 6.
                }); 
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 10 },
            { time: "2018/10/21", close: 9 },
            { time: "2018/10/22", close: 8 },
            { time: "2018/10/23", close: 7 },
            { time: "2018/10/24", close: 7 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(0);
    });

    it("computes risk from initial stop", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 100 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.riskPct).to.eql(20);
    });

    it("computes rmultiple from initial risk and profit", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 80 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.rmultiple).to.eql(1);
    });

    it("computes rmultiple from initial risk and loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 120 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.rmultiple).to.eql(-1);
    });

    it("current risk rises as profit increases", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 80 },
            { time: "2018/10/23", close: 60 },
            { time: "2018/10/24", close: 40 },
            { time: "2018/10/25", close: 20 },
            { time: "2018/10/26", close: 10 },
        ]);

        const trades = backtest(strategy, inputSeries, { recordRisk: true });
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];

        const output = singleTrade.riskSeries!.map(risk => ({ time: risk.time, value: round(risk.value) }));
        expect(output).to.eql([
            {
                time: makeDate("2018/10/21"),
                value: 20,
            },
            {
                time: makeDate("2018/10/22"),
                value: 50,
            },
            {
                time: makeDate("2018/10/23"),
                value: 100,
            },
            {
                time: makeDate("2018/10/24"),
                value: 200,
            },
            {
                time: makeDate("2018/10/25"),
                value: 500,
            },
            {
                time: makeDate("2018/10/26"),
                value: 1100,
            },
        ]);
    });

    it("current risk remains low by trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 80 },
            { time: "2018/10/23", close: 60 },
            { time: "2018/10/24", close: 40 },
            { time: "2018/10/25", close: 20 },
            { time: "2018/10/26", close: 10 },
        ]);

        const trades = backtest(strategy, inputSeries, { recordRisk: true });
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];

        const output = singleTrade.riskSeries!.map(risk => ({ time: risk.time, value: round(risk.value) }));
        expect(output).to.eql([
            {
                time: makeDate("2018/10/21"),
                value: 20,
            },
            {
                time: makeDate("2018/10/22"),
                value: 20,
            },
            {
                time: makeDate("2018/10/23"),
                value: 20,
            },
            {
                time: makeDate("2018/10/24"),
                value: 20,
            },
            {
                time: makeDate("2018/10/25"),
                value: 20,
            },
            {
                time: makeDate("2018/10/26"),
                value: 20,
            },
        ]);
    });

});
