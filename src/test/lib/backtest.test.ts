import { expect } from 'chai';
import { backtest } from '../../lib/backtest';
import { DataFrame, IDataFrame } from 'data-forge';
import { IBar } from '../../lib/bar';
import { IStrategy, EnterPositionFn, IEntryRuleArgs, ExitPositionFn, IExitRuleArgs, TradeDirection } from '../../lib/strategy';
import * as moment from 'dayjs';
import { toASCII } from 'punycode';

describe("backtest", () => {

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

    function unconditionalLongEntry(enterPosition: EnterPositionFn, args: IEntryRuleArgs<IBar, {}>) {
        enterPosition({ direction: TradeDirection.Long }); // Unconditionally enter position at market price.
    };

    function unconditionalLongExit(exitPosition: ExitPositionFn, args: IExitRuleArgs<IBar, {}>) {
        exitPosition(); // Unconditionally exit position at market price.
    };

    function unconditionalShortEntry(enterPosition: EnterPositionFn, args: IEntryRuleArgs<IBar, {}>) {
        enterPosition({ direction: TradeDirection.Short }); // Unconditionally enter position at market price.
    };

    function unconditionalShortExit(exitPosition: ExitPositionFn, args: IExitRuleArgs<IBar, {}>) {
        exitPosition(); // Unconditionally exit position at market price.
    };

    const strategyWithUnconditionalEntry: IStrategy = {
        entryRule: unconditionalLongEntry,
        exitRule: mockExit,
    };

    const longStrategyWithUnconditionalEntryAndExit: IStrategy = {
        entryRule: unconditionalLongEntry,
        exitRule: unconditionalLongExit,
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
    
    it("generates no trades when no entry is ever taken", ()  => {

        const trades = backtest(mockStrategy(), makeDataSeries([mockBar()]));
        expect(trades.length).to.eql(0);
    });

    it("must pass in 1 or more bars", () => {

        expect(() => backtest(mockStrategy(), new DataFrame<number, IBar>())).to.throw();
    });

    it('unconditional entry rule with no exit creates single trade', () => {

        const trades = backtest(strategyWithUnconditionalEntry, simpleInputSeries);
        expect(trades.length).to.eql(1);
    });
    
    it('going long makes a profit when the price rises', () => {

        const entryPrice = 3;
        const exitPrice = 7;
        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: entryPrice, close: 4 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 5, close: 6 },
            { time: "2018/10/23", open: exitPrice, close: 8 }, // Exit position at open on this day.
        ]);

        const trades = backtest(longStrategyWithUnconditionalEntryAndExit, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.profit).to.be.greaterThan(0);
        expect(singleTrade.profit).to.eql(exitPrice-entryPrice);
    });

    it('going long makes a loss when the price drops', () => {

        const entryPrice = 6;
        const exitPrice = 2;
        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 8, close: 7 },
            { time: "2018/10/21", open: entryPrice, close: 5 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 4, close: 3 }, 
            { time: "2018/10/23", open: exitPrice, close: 1 }, // Exit position at open on this day.
        ]);

        const trades = backtest(longStrategyWithUnconditionalEntryAndExit, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.profit).to.be.lessThan(0);
        expect(singleTrade.profit).to.eql(exitPrice-entryPrice);
    });

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

    it('enters position at open on day after signal', () => {

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: 3, close: 4 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 5, close: 6 },
        ]);
        
        const trades = backtest(strategyWithUnconditionalEntry, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.entryPrice).to.eql(3);
    });

    it('enters position at open on day after signal', () => {

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: 3, close: 4 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 5, close: 6 },
        ]);
        
        const trades = backtest(strategyWithUnconditionalEntry, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.entryPrice).to.eql(3);
    });

    it('unconditional entry rule creates single trade that is finalized at end of trading period', () => {

        const trades = backtest(strategyWithUnconditionalEntry, simpleInputSeries);
        expect(trades.length).to.eql(1);
        
        const singleTrade = trades[0];
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/22"));
        expect(singleTrade.exitReason).to.eql("finalize");
    });

    it('open position is finalized on the last day of the trading period', () => {

        const trades = backtest(strategyWithUnconditionalEntry, simpleInputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/22"));
    });
    
    it('open position is finalized at end of trading period at the closing price', () => {

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: 3, close: 4 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 5, close: 6 },
        ]);

        const trades = backtest(strategyWithUnconditionalEntry, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(6);
    });

    it('profit is computed for trade finalized at end of the trading period', () => {

        const inputData = makeDataSeries([
            { time: "2018/10/20", close: 5 },
            { time: "2018/10/21", close: 5 },
            { time: "2018/10/22", close: 10 },
        ]);
       
        const trades = backtest(strategyWithUnconditionalEntry, inputData);
        const singleTrade = trades[0];
        expect(singleTrade.profit).to.eql(5);
        expect(singleTrade.profitPct).to.eql(100);
        expect(singleTrade.growth).to.eql(2);
    });

    it('profit is computed for trade finalized at end of the trading period', () => {

        const inputData = makeDataSeries([
            { time: "2018/10/20", close: 5 },
            { time: "2018/10/21", close: 5 },
            { time: "2018/10/22", close: 10 },
        ]);
       
        const trades = backtest(strategyWithUnconditionalEntry, inputData);
        const singleTrade = trades[0];
        expect(singleTrade.profit).to.eql(5);
        expect(singleTrade.profitPct).to.eql(100);
        expect(singleTrade.growth).to.eql(2);
    });

    it("conditional entry can be triggered within the trading period", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                if (args.bar.close > 3) {
                    enterPosition(); // Conditional enter when instrument closes above 3.
                }
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 1 },
            { time: "2018/10/21", close: 2 },
            { time: "2018/10/22", close: 4 }, // Entry signal.
            { time: "2018/10/23", close: 5 }, // Entry day.
            { time: "2018/10/24", close: 6 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/23"));
    });

    it("conditional entry triggers entry at opening price of next bar", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                if (args.bar.close > 5) {
                    enterPosition(); // Conditional enter when instrument closes above 3.
                }
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: 3, close: 4 },
            { time: "2018/10/22", open: 5, close: 6 }, // Entry signal day.
            { time: "2018/10/23", open: 7, close: 8 }, // Entry day.
            { time: "2018/10/24", open: 9, close: 10 },
        ]);

        const trades = backtest(strategy, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.entryPrice).to.eql(7);
    });

    it("conditional entry is not triggered when condition is not met", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                if (args.bar.close > 10) {
                    enterPosition(); // Conditional enter when instrument closes above 3.
                }
            },

            exitRule: mockExit,
        };

        const trades = backtest(strategy, longerDataSeries);
        expect(trades.length).to.eql(0);
    });

    it("can conditionally exit before end of trading period", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,

            exitRule: (exitPosition, args) => {
                if (args.bar.close > 3) {
                    exitPosition(); // Exit at next open.
                }
            },
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 1 },
            { time: "2018/10/21", close: 2 }, // Entry day.
            { time: "2018/10/22", close: 4 }, // Exit signal.
            { time: "2018/10/23", close: 5 }, // Exit day.
            { time: "2018/10/24", close: 6 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
        expect(singleTrade.exitReason).to.eql("exit-rule");
    });

    it("exits position with opening price of next bar", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,

            exitRule: (exitPosition, args) => {
                if (args.bar.close > 5) {
                    exitPosition(); // Exit at next open.
                }
            },
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: 3, close: 4 }, // Entry
            { time: "2018/10/22", open: 5, close: 6 }, // Exits signal day.
            { time: "2018/10/23", open: 7, close: 8 }, // Exit day.
            { time: "2018/10/24", open: 9, close: 10 },
        ]);

        const trades = backtest(strategy, inputSeries);
        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(7);
    });

    it("profit is computed for conditionally exited position", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            exitRule: (exitPosition, args) => {
                if (args.bar.close > 3) {
                    exitPosition(); // Exit at next open.
                }
            },
        };

        const inputData = makeDataSeries([
            { time: "2018/10/20", close: 1 },
            { time: "2018/10/21", close: 5},    // Unconditionally enter here.
            { time: "2018/10/22", close: 6 },   // Exit signal.
            { time: "2018/10/23", close: 10 },  // Exit.
            { time: "2018/10/24", close: 100 }, // Last bar.
        ]);

        const trades = backtest(strategy, inputData);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
        expect(singleTrade.profit).to.eql(5);
        expect(singleTrade.profitPct).to.eql(100);
        expect(singleTrade.growth).to.eql(2);
    });
    
    it("can exit based on intra-trade profit", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            exitRule: (exitPosition, args) => {
                if (args.position.profitPct <= -50) {
                    exitPosition(); // Exit at 50% loss
                }
            },
        };

        const inputData = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 },     // Entry day.
            { time: "2018/10/22", close: 20 },      // Big loss, exit signal.
            { time: "2018/10/23", close: 10 },      // Exit.
            { time: "2018/10/24", close: 1 },
        ]);

        const trades = backtest(strategy, inputData);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
        expect(singleTrade.exitPrice).to.eql(10);
    });

    it("can exit position after max holding period", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            exitRule: (exitPosition, args) => {
                if (args.position.holdingPeriod >= 3) {
                    exitPosition(); // Exit after holding for 3 days.
                }
            },
        };

        const inputData = makeDataSeries([
            { time: "2018/10/20", close: 1 },
            { time: "2018/10/21", close: 2 },      // Entry day.
            { time: "2018/10/22", close: 3 },      // 1 day
            { time: "2018/10/23", close: 4 },      // 2 days
            { time: "2018/10/24", close: 5 },      // 3 days
            { time: "2018/10/25", close: 6 },      // Exit day (after 3 days).
            { time: "2018/10/26", close: 7 },
        ]);

        const trades = backtest(strategy, inputData);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/25"));
        expect(singleTrade.exitPrice).to.eql(6);
    });

    it("can execute multiple trades", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                if ((args.bar.close - args.bar.open) > 0) { 
                    enterPosition(); // Enter on up day.
                }
            },

            exitRule: (exitPosition, args) => {
                if (args.position.profitPct > 1.5) {
                    exitPosition(); // Exit on small profit
                }
            },
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 1 },  // Flat, no signal.
            { time: "2018/10/21", open: 2, close: 3 },  // Up day, entry signal.
            { time: "2018/10/22", open: 4, close: 4 },  // Flat, in position.
            { time: "2018/10/23", open: 5, close: 6 },  // Good profit, exit signal
            { time: "2018/10/24", open: 9, close: 10 }, // Exit day.

            { time: "2018/10/25", open: 1, close: 1 },  // Flat, no signal.
            { time: "2018/10/26", open: 2, close: 3 },  // Up day, entry signal.
            { time: "2018/10/27", open: 4, close: 4 },  // Flat, in position.
            { time: "2018/10/28", open: 5, close: 6 },  // Good profit, exit signal
            { time: "2018/10/29", open: 9, close: 10 }, // Exit day.

            { time: "2018/10/30", open: 11, close: 11 }, // Last bar.
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(2);
    });

    interface CustomBar extends IBar {
        goLong: number; // Custom indicator, indicates 'buy now'.
    }
    
    it("can use custom bar type and enter/exit on computed indicator", () => {
        
        const strategy: IStrategy<CustomBar> = {
            entryRule: (enterPosition, args) => {
                if (args.bar.goLong > 0) {
                    enterPosition(); // Enter on custom indicator.
                }
            },

            exitRule: (exitPosition, args) => {
                if (args.bar.goLong < 1) {
                    exitPosition(); // Exit on custom indicator.
                }
            },
        };

        const bars: CustomBar[] = [
            { time: makeDate("2018/10/20"), open: 1,  high: 2,  low: 1,  close: 2,  volume: 1, goLong: 0 },
            { time: makeDate("2018/10/21"), open: 3,  high: 4,  low: 3,  close: 4,  volume: 1, goLong: 1 }, // Entry signal.
            { time: makeDate("2018/10/22"), open: 5,  high: 6,  low: 5,  close: 6,  volume: 1, goLong: 1 }, // Entry day.
            { time: makeDate("2018/10/23"), open: 7,  high: 8,  low: 7,  close: 8,  volume: 1, goLong: 0 }, // Exit signal.
            { time: makeDate("2018/10/24"), open: 9,  high: 10, low: 8,  close: 10, volume: 1, goLong: 0 }, // Exit day.
            { time: makeDate("2018/10/25"), open: 11, high: 12, low: 11, close: 12, volume: 1, goLong: 0 }, // Last bar.
        ];

        const inputSeries = new DataFrame<number, CustomBar>(bars);
        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/22"));
        expect(singleTrade.entryPrice).to.eql(5);
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/24"));
        expect(singleTrade.exitPrice).to.eql(9);
    });

    it("example of caching a custom indicator before doing the backtest", () => {
        
        const strategy: IStrategy<CustomBar> = {
            entryRule: (enterPosition, args) => {
                if (args.bar.goLong > 0) {
                    enterPosition(); // Enter on custom indicator.
                }
            },

            exitRule: (exitPosition, args) => {
                if (args.bar.goLong < 1) {
                    exitPosition(); // Exit on custom indicator.
                }
            },
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 1 },  // Flat, no signal.
            { time: "2018/10/21", open: 2, close: 3 },  // Up day, entry signal.
            { time: "2018/10/22", open: 4, close: 4 },  // Flat, in position.
            { time: "2018/10/23", open: 5, close: 6 },  // Good profit, exit signal
            { time: "2018/10/24", open: 9, close: 10 }, // Exit day.

            { time: "2018/10/25", open: 1, close: 1 },  // Flat, no signal.
            { time: "2018/10/26", open: 2, close: 3 },  // Up day, entry signal.
            { time: "2018/10/27", open: 4, close: 4 },  // Flat, in position.
            { time: "2018/10/28", open: 5, close: 6 },  // Good profit, exit signal
            { time: "2018/10/29", open: 9, close: 10 }, // Exit day.

            { time: "2018/10/30", open: 11, close: 11 }, // Last bar.
        ]);

        const augumentedInputSeries = inputSeries
            .generateSeries<CustomBar>(bar => {
                let goLong = 0;
                if ((bar.close - bar.open) > 0) { 
                    goLong = 1; // Entry triggered by an up day.
                }
                return { goLong }; // Added new series to dataframe.
            });

        const trades = backtest(strategy, augumentedInputSeries);
        expect(trades.length).to.eql(2);
    });

    it("passes through exception in entry rule", ()  => {

        const badStrategy: IStrategy = { 
            entryRule: () => {
                throw new Error("Bad rule!");
            },
            exitRule: () => {},
         };

        expect(() => backtest(badStrategy, simpleInputSeries)).to.throw();
    });
    
    it("passes through exception in exit rule", ()  => {

        const badStrategy: IStrategy = { 
            entryRule: unconditionalLongEntry,
            exitRule: () => {
                throw new Error("Bad rule!");
            },
         };

        expect(() => backtest(badStrategy, simpleInputSeries)).to.throw();
    });

    it("can set lookback period and use data series in entry rule", ()  => {

        let lookbackPeriodChecked = false;

        const strategy: IStrategy = { 
            lookbackPeriod: 2,

            entryRule: (enterPosition, args) => {
                lookbackPeriodChecked = true;
                expect(args.lookback.count()).to.eql(2);
            },

            exitRule: () => {},
         };

        backtest(strategy, longerDataSeries);

        expect(lookbackPeriodChecked).to.eql(true);
    });

    it("can set lookback period and use data series in exit rule", ()  => {

        let lookbackPeriodChecked = false;

        const strategy: IStrategy = { 
            lookbackPeriod: 2,

            entryRule: unconditionalLongEntry,

            exitRule: (exitPosition, args) => {
                lookbackPeriodChecked = true;
                expect(args.lookback.count()).to.eql(2);
            },
         };

        backtest(strategy, longerDataSeries);

        expect(lookbackPeriodChecked).to.eql(true);
    });

    it("exception is thrown when there is less data than the lookback period", () => {

        const strategy: IStrategy = { 
            lookbackPeriod: 30,
            entryRule: mockEntry,
            exitRule: mockExit,
         };

        expect(() => backtest(strategy, simpleInputSeries)).to.throw();
    });

    it("can exit via stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 90 },  // Hold
            { time: "2018/10/23", close: 70 },  // Stop loss triggered.
            { time: "2018/10/24", close: 70 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.stopPrice).to.eql(80);
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("stop loss exits based on intrabar low", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 90 },  // Hold
            { time: "2018/10/23", open: 90, high: 100, low: 30, close: 70 },  // Stop loss triggered.
            { time: "2018/10/24", close: 70 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(80);
    });

    it("stop loss is not triggered unless there is a significant loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
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

    it("can exit via profit target", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            profitTarget: args => args.entryPrice * (10/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 100 },  // Hold
            { time: "2018/10/23", close: 110 },  // Profit target triggered.
            { time: "2018/10/24", close: 110 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.profitTarget).to.eql(110);
        expect(singleTrade.exitReason).to.eql("profit-target");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("profit target exits based on intrabar high", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            profitTarget: args => args.entryPrice * (10/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 90 },  // Hold
            { time: "2018/10/23", open: 90, high: 120, low: 90, close: 90 },  // Profit target triggered.
            { time: "2018/10/24", close: 70 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(110);
    });

    it("exit is not triggered unless target profit is achieved", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
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

    it("can exit via trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 90 },  // Hold
            { time: "2018/10/23", close: 70 },  // Stop loss triggered.
            { time: "2018/10/24", close: 70 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("can exit via rising trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 },  // Entry day.
            { time: "2018/10/22", close: 200 },  // Hold
            { time: "2018/10/23", close: 150 },  // Stop loss triggered.
            { time: "2018/10/24", close: 150 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("trailing stop loss exits based on intrabar low", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 90 },  // Hold
            { time: "2018/10/23", open: 90, high: 100, low: 30, close: 70 },  // Stop loss triggered.
            { time: "2018/10/24", close: 70 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(80);
    });

    it("trailing stop loss is not triggered unless there is a significant loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
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

    it("can record trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close * (50/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 200 },
            { time: "2018/10/22", close: 300 },
            { time: "2018/10/23", close: 200 },
            { time: "2018/10/24", close: 500 },
            { time: "2018/10/25", close: 400 },
            { time: "2018/10/26", close: 800 },
        ]);

        const trades = backtest(strategy, inputSeries, { recordStopPrice: true });

        expect(trades.length).to.eql(1);
        const singleTrade = trades[0];

        expect(singleTrade.stopPriceSeries!).to.eql([
            {
                time: makeDate("2018/10/21"),
                value: 100,
            },
            {
                time: makeDate("2018/10/22"),
                value: 150,
            },
            {
                time: makeDate("2018/10/23"),
                value: 150,
            },
            {
                time: makeDate("2018/10/24"),
                value: 250,
            },
            {
                time: makeDate("2018/10/25"),
                value: 250,
            },
            {
                time: makeDate("2018/10/26"),
                value: 400,
            },
        ]);
    });

    it("can place intrabar conditional buy order", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                enterPosition({ entryPrice: 6 }); // Enter position when price hits 6.
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 1 },
            { time: "2018/10/21", close: 2 },
            { time: "2018/10/22", close: 4 },
            { time: "2018/10/23", close: 5, high: 6 }, // Intraday entry.
            { time: "2018/10/24", close: 5 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/23"));
    });
    
    it("conditional buy order is not executed if price doesn't reach target", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                enterPosition({ entryPrice: 6 }); // Enter position when price hits 6.
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 1 },
            { time: "2018/10/21", close: 2 },
            { time: "2018/10/22", close: 3 },
            { time: "2018/10/23", close: 4 },
            { time: "2018/10/24", close: 5 },
        ]);

        const trades = backtest(strategy, inputSeries);
        expect(trades.length).to.eql(0);
    });

    it("computes risk from initial stop", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
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
            entryRule: unconditionalLongEntry,
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
        expect(singleTrade.rmultiple).to.eql(1);
    });

    it("computes rmultiple from initial risk and loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
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
        expect(singleTrade.rmultiple).to.eql(-1);
    });

    it("current risk rises as profit increases", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            stopLoss: args => args.entryPrice * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 150 },
            { time: "2018/10/23", close: 140 },
            { time: "2018/10/24", close: 200 },
            { time: "2018/10/25", close: 190 },
            { time: "2018/10/26", close: 250 },
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
                value: 46.67,
            },
            {
                time: makeDate("2018/10/23"),
                value: 42.86,
            },
            {
                time: makeDate("2018/10/24"),
                value: 60,
            },
            {
                time: makeDate("2018/10/25"),
                value: 57.89,
            },
            {
                time: makeDate("2018/10/26"),
                value: 68,
            },
        ]);
    });

    it("current risk is low by trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close * (20/100)
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: 100 },
            { time: "2018/10/21", close: 100 }, // Entry day.
            { time: "2018/10/22", close: 150 },
            { time: "2018/10/23", close: 140 },
            { time: "2018/10/24", close: 200 },
            { time: "2018/10/25", close: 190 },
            { time: "2018/10/26", close: 250 },
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
                value: 14.29,
            },
            {
                time: makeDate("2018/10/24"),
                value: 20,
            },
            {
                time: makeDate("2018/10/25"),
                value: 15.79,
            },
            {
                time: makeDate("2018/10/26"),
                value: 20,
            },
        ]);
    });

});
