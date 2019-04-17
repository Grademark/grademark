import { ITrade } from "./trade";
import { IDataFrame, ISeries, Series } from "data-forge";
import { isNumber, isObject } from "./utils";

/**
 * Compute an equity curve for a series of trades.
 * 
 * @param trades The series of trades to compute equity curve for.
 */
export function computeEquityCurve(startingCapital: number, trades: IDataFrame<number, ITrade>): ISeries<number, number> {

    if (!isNumber(startingCapital) || startingCapital <= 0) {
        throw new Error("Expected 'startingCapital' argument to 'computeEquityCurve' to be a positive number that specifies the amount of capital used to compute the equity curve.");
    }

    if (!isObject(trades) && trades.count() > 0) {
        throw new Error("Expected 'trades' argument to 'computeEquityCurve' to be a Data-Forge DataFrame that contains a set of trades for which to compute the equity curve.");
    }

    const equityCurve: number[] = [ startingCapital ];
    let workingCapital = startingCapital;

    for (const trade of trades) {
        workingCapital *= trade.growth;
        equityCurve.push(workingCapital);
    }

    return new Series<number, number>(equityCurve);
}