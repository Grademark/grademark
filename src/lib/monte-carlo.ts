import { IDataFrame, ISeries, DataFrame, Series } from "data-forge";
import { ITrade } from "..";
import { isNumber, isObject, isArray } from "./utils";
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

    if (!isObject(trades) && trades.count() > 0) {
        throw new Error("Expected 'trades' argument to 'monteCarlo' to be a Data-Forge DataFrame that contains a population of trades to sample during monte carlo simulation.");
    }

    if (!isNumber(numIterations) || numIterations < 1) {
        throw new Error("Expected 'numIterations' argument to 'monteCarlo' to be a number >= 1 that specifies the number of iteration of monte carlo simulation to perform.");
    }

    if (!isNumber(numSamples) || numSamples < 1) {
        throw new Error("Expected 'numSamples' argument to 'monteCarlo' to be a number >= 1 that specifies the size of the sample to create for each iteration of the monte carlo simulation.");
    }
    
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