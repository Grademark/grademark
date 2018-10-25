import { IDataFrame } from "data-forge";
import { ITrade } from "./trade";

/**
 * Represents an analysis of trading strategy.
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
     * Number of bars within trades.
     * NOTE: Doesn't include days between trades (because that doesn't work with monte carlo simulation).
     */
    barCount: number;

    /**
     * The maximum level of drawdown experienced during trading.
     * This is the cash that is lost from peak to lowest trough.
     */
    maxDrawdown: number; //todo:

    /**
     * The maximum level of drawdown experienced during trading as a percentage of capital at the peak.
     * This is percent amount of lost from peak to lowest trough.
     */
    maxDrawdownPct: number; //todo:

    /**
     * Maximum amount of risk across the trading session.
     * This is optional and only set when a stop loss is applied in the strategy.
     */
    maxRisk?: number; //todo:

    /**
     * Maximum amount of risk taken at any point relative expressed as a percentage relative to the 
     * size of the account at the time.
     * This is optional and only set when a stop loss is applied in the strategy.
     */
    maxRiskPct?: number; //todo:

    //TODO: Add system quality, etc.
}

export function analyze<IndexT>(startingCapital: number, trades: IDataFrame<IndexT, ITrade>): IAnalysis {

    let workingCapital = startingCapital;
    let barCount = 0;

    for (const trade of trades) {
        workingCapital *= trade.growth;
        barCount += trade.holdingPeriod;
    }

    const profit = workingCapital - startingCapital;

    const analysis: IAnalysis = {
        startingCapital: startingCapital,
        finalCapital: workingCapital,
        profit: profit,
        profitPct: (profit / startingCapital) * 100,
        growth: workingCapital / startingCapital,
        barCount: barCount,
        maxDrawdown: 0,         //TODO
        maxDrawdownPct: 0,      //TODO
        maxRisk: undefined,     //TODO
        maxRiskPct: undefined,  //TODO
    };

    return analysis;
}