import { ITrade } from "./trade";
import { IDataFrame, ISeries, Series } from "data-forge";

/**
 * Compute an equity curve for a series of trades.
 * 
 * @param trades The series of trades to compute equity curve for.
 */
export function computeEquityCurve(startingCapital: number, trades: IDataFrame<number, ITrade>): ISeries<number, number> {
    const equityCurve: number[] = [ startingCapital ];
    let workingCapital = startingCapital;

    for (const trade of trades) {
        workingCapital *= trade.growth;
        equityCurve.push(workingCapital);
    }

    return new Series<number, number>(equityCurve);
}