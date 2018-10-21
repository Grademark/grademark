import { assert, expect } from 'chai';
import { backtest } from '../../lib/backtest';
import { DataFrame, IDataFrame } from 'data-forge';
import { IBar } from '../../lib/bar';
import { IStrategy, EnterPositionFn } from '../../lib/strategy';
import * as moment from 'moment';

describe("backtest", () => {

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

    const mockExit = () => {};

    function mockStrategy(): IStrategy {
        return { 
            entryRule: () => {},
            exitRule: mockExit,
         };
    }

    function unconditionalEntry(bar: IBar, dataSeries: IDataFrame<number, IBar>, enterPosition: EnterPositionFn) {
        enterPosition(); // Unconditionally enter position at market price.
    };

    const strategyWithUnconditionalEntry: IStrategy = {
        entryRule: unconditionalEntry,
        exitRule: mockExit,
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
        expect(trades.count()).to.eql(0);
    });

    it("must pass in 1 or more bars", () => {

        expect(() => backtest(mockStrategy(), new DataFrame<number, IBar>())).to.throw();
    });

    it('unconditional entry rule with no exit creates single trade', () => {

        const trades = backtest(strategyWithUnconditionalEntry, simpleInputSeries);
        expect(trades.count()).to.eql(1);
    });
    
    it('unconditional entry rule enters position on day after signal', () => {

        const trades = backtest(strategyWithUnconditionalEntry, simpleInputSeries);
        const singleTrade = trades.first();
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/21"));
    });

    it('enters position at open on day after signal', () => {

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: 3, close: 4 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 5, close: 6 },
        ]);
        
        const trades = backtest(strategyWithUnconditionalEntry, inputSeries);
        const singleTrade = trades.first();
        expect(singleTrade.entryPrice).to.eql(3);
    });

    it('unconditional entry rule creates single trade that is finalized at end of trading period', () => {

        const trades = backtest(strategyWithUnconditionalEntry, simpleInputSeries);
        expect(trades.count()).to.eql(1);
        
        const singleTrade = trades.first();
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/22"));
    });

    it('open position is finalized on the last day of the trading period', () => {

        const trades = backtest(strategyWithUnconditionalEntry, simpleInputSeries);
        const singleTrade = trades.first();
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/22"));
    });
    
    it('open position is finalized at end of trading period at the closing price', () => {

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: 1, close: 2 },
            { time: "2018/10/21", open: 3, close: 4 }, // Enter position at open on this day.
            { time: "2018/10/22", open: 5, close: 6 },
        ]);

        const trades = backtest(strategyWithUnconditionalEntry, inputSeries);
        const singleTrade = trades.first();
        expect(singleTrade.exitPrice).to.eql(6);
    });

    it('profit is computed for trade finalized at end of the trading period', () => {

        const inputData = makeDataSeries([
            { time: "2018/10/20", close: 5 },
            { time: "2018/10/21", close: 5 },
            { time: "2018/10/22", close: 10 },
        ]);
       
        const trades = backtest(strategyWithUnconditionalEntry, inputData);
        const singleTrade = trades.first();
        expect(singleTrade.profit).to.eql(5);
        expect(singleTrade.profitPct).to.eql(100);
        expect(singleTrade.growth).to.eql(2);
    });

    it("conditional entry can be triggered within the trading period", () => {
        
        const strategy: IStrategy = {
            entryRule: (bar, dataSeries, enterPosition) => {
                if (bar.close > 3) {
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
        expect(trades.count()).to.eql(1);

        const singleTrade = trades.first();
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/23"));
    });

    it("conditional entry triggers entry at opening price of next bar", () => {
        
        const strategy: IStrategy = {
            entryRule: (bar, dataSeries, enterPosition) => {
                if (bar.close > 5) {
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
        const singleTrade = trades.first();
        expect(singleTrade.entryPrice).to.eql(7);
    });

    it("conditional entry is not triggered when condition is not met", () => {
        
        const strategy: IStrategy = {
            entryRule: (bar, dataSeries, enterPosition) => {
                if (bar.close > 10) {
                    enterPosition(); // Conditional enter when instrument closes above 3.
                }
            },

            exitRule: mockExit,
        };

        const trades = backtest(strategy, longerDataSeries);
        expect(trades.count()).to.eql(0);
    });

    it("can conditionally exit before end of trading period", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalEntry,

            exitRule: (position, bar, dataSeries, exitPosition) => {
                if (bar.close > 3) {
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
        expect(trades.count()).to.eql(1);

        const singleTrade = trades.first();
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("exits position with opening price of next bar", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalEntry,

            exitRule: (position, bar, dataSeries, exitPosition) => {
                if (bar.close > 5) {
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
        const singleTrade = trades.first();
        expect(singleTrade.exitPrice).to.eql(7);
    });

    it("profit is computed for conditionally exited position", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalEntry,
            exitRule: (position, bar, dataSeries, exitPosition) => {
                if (bar.close > 3) {
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
        expect(trades.count()).to.eql(1);

        const singleTrade = trades.first();
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
        expect(singleTrade.profit).to.eql(5);
        expect(singleTrade.profitPct).to.eql(100);
        expect(singleTrade.growth).to.eql(2);
    });
    
    it("can exit based on intra-trade profit", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalEntry,
            exitRule: (position, bar, dataSeries, exitPosition) => {
                if (position.profitPct <= -50) {
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
        expect(trades.count()).to.eql(1);

        const singleTrade = trades.first();
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
        expect(singleTrade.exitPrice).to.eql(10);
    });

    it("can exit position after max holding period", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalEntry,
            exitRule: (position, bar, dataSeries, exitPosition) => {
                if (position.holdingPeriod >= 3) {
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
        expect(trades.count()).to.eql(1);

        const singleTrade = trades.first();
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/25"));
        expect(singleTrade.exitPrice).to.eql(6);
    });

    it("can execute multiple trades", () => {
        
        const strategy: IStrategy = {
            entryRule: (bar, dataSeries, enterPosition) => {
                if ((bar.close - bar.open) > 0) { 
                    enterPosition(); // Enter on up day.
                }
            },

            exitRule: (position, bar, dataSeries, exitPosition) => {
                if (position.profitPct > 1.5) {
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
        expect(trades.count()).to.eql(2);
    });

    interface CustomBar extends IBar {
        goLong: number; // Custom indicator, indicates 'buy now'.
    }
    
    it("can use custom bar type and enter/exit on computed indicator", () => {
        
        const strategy: IStrategy<CustomBar> = {
            entryRule: (bar, dataSeries, enterPosition) => {
                if (bar.goLong > 0) {
                    enterPosition(); // Enter on custom indicator.
                }
            },

            exitRule: (position, bar, dataSeries, exitPosition) => {
                if (bar.goLong < 1) {
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
        expect(trades.count()).to.eql(1);

        const singleTrade = trades.first();
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/22"));
        expect(singleTrade.entryPrice).to.eql(5);
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/24"));
        expect(singleTrade.exitPrice).to.eql(9);
    });

    it("example of caching a custom indicator before doing the backtest", () => {
        
        const strategy: IStrategy<CustomBar> = {
            entryRule: (bar, dataSeries, enterPosition) => {
                if (bar.goLong > 0) {
                    enterPosition(); // Enter on custom indicator.
                }
            },

            exitRule: (position, bar, dataSeries, exitPosition) => {
                if (bar.goLong < 1) {
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
        expect(trades.count()).to.eql(2);
    });
});
