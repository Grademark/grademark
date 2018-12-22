import { IDataFrame, ISeries, DataFrame, Series } from "data-forge";
import { ITrade } from "..";
const MersenneTwister = require('mersennetwister');

//https://stackoverflow.com/a/1527820/25868
/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt (random: any, min: number, max: number): number {
    return Math.floor(random.real() * (max - min + 1)) + min;
}

/**
 * Perform a monte carlo simulation on a set of trades.
 * Produces a set of X samples of Y trades from the full population.
 * X = numIterators.
 * Y = numSamples
 */
export function monteCarlo(trades: IDataFrame<number, ITrade>, numIterations: number, numSamples: number):
    ISeries<number, IDataFrame<number, ITrade>> {

    const tradesArray = trades.toArray();
    const numTrades = tradesArray.length;
    if (numTrades === 0) {
        return new Series<number, IDataFrame<number, ITrade>>();
    }

    const random = new MersenneTwister(0);
    const samples: IDataFrame<number, ITrade>[] = [];

    for (let iterationIndex = 0; iterationIndex < numIterations; ++iterationIndex) {
        const sample: ITrade[] = [];

        for (var tradeIndex = 0; tradeIndex < numSamples; ++tradeIndex) {
            var tradeCopyIndex = getRandomInt(random, 0, numTrades-1);
            sample.push(tradesArray[tradeCopyIndex]);
        }

        samples.push(new DataFrame<number, ITrade>(sample));
    }

    return new Series<number, IDataFrame<number, ITrade>>(samples);
}