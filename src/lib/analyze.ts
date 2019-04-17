import { IDataFrame } from "data-forge";
import { ITrade } from "./trade";
import * as math from 'mathjs';
import { IAnalysis } from "./analysis";
import { isNumber, isObject } from "./utils";

/**
 * Analyse a sequence of trades and compute their performance.
 */
export function analyze<IndexT>(startingCapital: number, trades: IDataFrame<IndexT, ITrade>): IAnalysis {

    if (!isNumber(startingCapital) || startingCapital <= 0) {
        throw new Error("Expected 'startingCapital' argument to 'analyze' to be a positive number that specifies the amount of capital used to simulate trading.");
    }

    if (!isObject(trades) && trades.count() > 0) {
        throw new Error("Expected 'trades' argument to 'analyze' to be a Data-Forge DataFrame that contains a set of trades to be analyzed.");
    }

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
    let maxRiskPct = undefined;

    for (const trade of trades) {
        ++totalTrades;
        if (trade.riskPct !== undefined) {
            maxRiskPct = Math.max(trade.riskPct, maxRiskPct || 0);
        }
        
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

   const rmultiples = trades
            .where(trade => trade.rmultiple !== undefined)
            .deflate<number>(trade => trade.rmultiple!);
    
    const expectency = rmultiples.any() ? rmultiples.average() : undefined;
    const rmultipleStdDev = rmultiples.any()
        ? math.std(rmultiples.toArray())
        : undefined;
    
    let systemQuality: number | undefined;
    if (expectency !== undefined && rmultipleStdDev !== undefined) {
        if (rmultipleStdDev === 0) {
            systemQuality = undefined;
        }
        else {
            systemQuality = expectency / rmultipleStdDev;
        }
    }

    let profitFactor: number | undefined = undefined;
    const absTotalLosses = Math.abs(totalLosses);
    if (absTotalLosses > 0) {
        profitFactor = totalProfits / absTotalLosses    ;
    }
    
    const profit = workingCapital - startingCapital;
    const profitPct = (profit / startingCapital) * 100;
    const analysis: IAnalysis = {
        startingCapital: startingCapital,
        finalCapital: workingCapital,
        profit: profit,
        profitPct: profitPct,
        growth: workingCapital / startingCapital,
        totalTrades: totalTrades,
        barCount: barCount,
        maxDrawdown: maxDrawdown,
        maxDrawdownPct: maxDrawdownPct,
        maxRiskPct: maxRiskPct,
        expectency: expectency,
        rmultipleStdDev: rmultipleStdDev,
        systemQuality: systemQuality,
        profitFactor: profitFactor,
        percentProfitable: (winningTrades / totalTrades) * 100,
        returnOnAccount: profitPct / Math.abs(maxDrawdownPct),
    };

    return analysis;
}