import { ITrade } from "./trade";
import { IDataFrame, ISeries, Series } from "data-forge";

/**
 * Compute drawdown for a series of trades.
 * 
 * @param trades The series of trades to compute drawdown for.
 */
export function computeDrawdown(startingCapital: number, trades: IDataFrame<number, ITrade>): ISeries<number, number> {
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