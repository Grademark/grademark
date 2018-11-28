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

    //TODO: Add system quality, etc.
}

export function analyze<IndexT>(startingCapital: number, trades: IDataFrame<IndexT, ITrade>): IAnalysis {

    let workingCapital = startingCapital;
    let barCount = 0;
    let peakCapital = startingCapital;
    let workingDrawdown = 0;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let totalProfits = 0;
    let totalLosses = 0;
    let winningTrades = 0;
    let totalTrades = 0;

    for (const trade of trades) {
        ++totalTrades;
        workingCapital *= trade.growth;
        barCount += trade.holdingPeriod;

        if (workingCapital < peakCapital) {
            workingDrawdown = workingCapital - peakCapital;
        }
        else {
            peakCapital = workingCapital;
            workingDrawdown = 0; // Reset at the peak.
        }

        if (trade.profit > 0) {
            totalProfits += trade.profit;
            ++winningTrades;
        }
        else {
            totalLosses += trade.profit;
        }

        maxDrawdown = Math.min(workingDrawdown, maxDrawdown);
        maxDrawdownPct = Math.min((maxDrawdown / peakCapital) * 100, maxDrawdownPct);
    }

    const profit = workingCapital - startingCapital;

    const analysis: IAnalysis = {
        startingCapital: startingCapital,
        finalCapital: workingCapital,
        profit: profit,
        profitPct: (profit / startingCapital) * 100,
        growth: workingCapital / startingCapital,
        totalTrades: totalTrades,
        barCount: barCount,
        maxDrawdown: maxDrawdown,
        maxDrawdownPct: maxDrawdownPct,
        maxRisk: undefined,     //TODO
        maxRiskPct: undefined,  //TODO
        profitFactor: totalProfits / Math.abs(totalLosses),
        percentProfitable: (winningTrades / totalTrades) * 100,
    };

    return analysis;
}