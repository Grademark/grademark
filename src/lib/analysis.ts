/**
 * Represents an analysis of a trading strategy.
 */
export interface IAnalysis {
    /**
     * Starting capital invested in the trading strategy.
     */
    startingCapital: number;

    /**
     * Capital at the end of trading.
     */
    finalCapital: number;

    /**
     * Amount of profit (or loss) made from start to end.
     */
    profit: number;

    /**
     * Amount of profit as a percentage relative to the starting capital.
     */
    profitPct: number;

    /**
     * Amount of growth in the account since the start of trading.
     */
    growth: number;

    /**
     * Total number of trades considered.
     */
    totalTrades: number;

    /**
     * Number of bars within trades.
     * NOTE: Doesn't include days between trades (because that doesn't work with monte carlo simulation).
     */
    barCount: number;

    /**
     * The maximum level of drawdown experienced during trading.
     * This is the cash that is lost from peak to lowest trough.
     */
    maxDrawdown: number;

    /**
     * The maximum level of drawdown experienced during trading as a percentage of capital at the peak.
     * This is percent amount of lost from peak to lowest trough.
     */
    maxDrawdownPct: number;

    /**
     * Maximum amount of risk taken at any point relative expressed as a percentage relative to the 
     * size of the account at the time.
     * This is optional and only set when a stop loss is applied in the strategy.
     */
    maxRiskPct?: number;

    //
    // The estimated or actual expectency of the strategy.
    // P204 Trading your way to financial freedom.
    //
    expectency?: number,

    //
    // The standard deviation tells you how much variability you can expect from your system's performance. 
    // In the sample our standard deviation was 1.86R. 
    // http://www.actionforex.com/articles-library/money-management-articles/every-trading-system-can-be-described-by-the-r-multiples-it-generates-200604136408/
    //
    rmultipleStdDev?: number,
    
    //
    // The estimated or actual quality of the strategy.
    // Expectency / std devation of rmultiples
    //
    /*
    Typically you can tell how good your system is by the ratio of the expectancy to the standard deviation.
    In our small sample, the ratio is 0.36, which is excellent. After a 100 or so trades, I'd expect this ratio to be much smaller, but if it remains above 0.25, we have a superb system. But that's another story.
    http://www.actionforex.com/articles-library/money-management-articles/every-trading-system-can-be-described-by-the-r-multiples-it-generates-200604136408/
    */
    systemQuality?: number;
    
    /**
     * The ratio of wins to losses.
     * Values above 2 are outstanding.
     * Values above 3 are unheard of.
     */
    profitFactor: number;

    /**
     * The percentage of trades that were winners.
     * This could also be called reliability or accuracy.
     */
    percentProfitable: number;
}
