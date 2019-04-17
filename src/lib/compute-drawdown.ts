import { ITrade } from "./trade";
import { IDataFrame, ISeries, Series } from "data-forge";
import { isNumber, isObject } from "./utils";

/**
 * Compute drawdown for a series of trades.
 * 
 * @param trades The series of trades to compute drawdown for.
 */
export function computeDrawdown(startingCapital: number, trades: IDataFrame<number, ITrade>): ISeries<number, number> {

    if (!isNumber(startingCapital) || startingCapital <= 0) {
        throw new Error("Expected 'startingCapital' argument to 'computeDrawdown' to be a positive number that specifies the amount of capital used to compute drawdown.");
    }

    if (!isObject(trades) && trades.count() > 0) {
        throw new Error("Expected 'trades' argument to 'computeDrawdown' to be a Data-Forge DataFrame that contains a set of trades for which to compute drawdown.");
    }

    const drawdown: number[] = [ 0 ];
    let workingCapital = startingCapital;
    let peakCapital = startingCapital;
    let workingDrawdown = 0;

    for (const trade of trades) {
        workingCapital *= trade.growth;
        if (workingCapital < peakCapital) {
            workingDrawdown = workingCapital - peakCapital;
        }
        else {
            peakCapital = workingCapital;
            workingDrawdown = 0; // Reset at the peak.
        }
        drawdown.push(workingDrawdown);
    }

    return new Series<number, number>(drawdown);
}