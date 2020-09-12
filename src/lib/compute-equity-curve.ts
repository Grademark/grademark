import { ITrade } from "./trade";
import { isNumber, isObject } from "./utils";
import { isArray } from "util";

/**
 * Compute an equity curve for a series of trades.
 * 
 * @param trades The series of trades to compute equity curve for.
 */
export function computeEquityCurve(startingCapital: number, trades: ITrade[]): number[] {

    if (!isNumber(startingCapital) || startingCapital <= 0) {
        throw new Error("Expected 'startingCapital' argument to 'computeEquityCurve' to be a positive number that specifies the amount of capital used to compute the equity curve.");
    }

    if (!isArray(trades)) {
        throw new Error("Expected 'trades' argument to 'computeEquityCurve' to be an array that contains a set of trades for which to compute the equity curve.");
    }

    const equityCurve: number[] = [ startingCapital ];
    let workingCapital = startingCapital;

    for (const trade of trades) {
        workingCapital *= trade.growth;
        equityCurve.push(workingCapital);
    }

    return equityCurve;
}