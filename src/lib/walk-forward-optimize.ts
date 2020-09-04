import { IBar } from "./bar";
import { IDataFrame } from "data-forge";
import { ITrade } from "./trade";
import { IStrategy } from "./strategy";
import { backtest } from "./backtest";
import { IParameterDef, ObjectiveFn, OptimizeSearchDirection, optimize } from "./optimize";
import { isObject, isArray, isFunction, isNumber } from "./utils";

/**
 * Options to the optimize function.
 */
export interface IOptimizationOptions {

    /**
     * Determine the direction we are optimizating for when looking out the object function.
     */
    searchDirection?: OptimizeSearchDirection; //TODO: This should be part of the objective function??

    /**
     * Number of buckets for evaluating performance stability.
     */
    numBuckets?: number; //TODO: This should be part of the objective function??
}

/**
 * Records the result of an optimization.
 */
export interface IOptimizationResult {

    /**
     * Records the out of sample trades from the walk forward optimization.
     */
    trades: ITrade[];
}

/**
 * Perform a walk-forward optimization over a single parameter.
 */
export function walkForwardOptimize<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParameterT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParameterT, IndexT>, 
    parameters: IParameterDef[],
    objectiveFn: ObjectiveFn,
    inputSeries: IDataFrame<IndexT, InputBarT>,
    inSampleSize: number,
    outSampleSize: number,
    options?: IOptimizationOptions
        ): IOptimizationResult {

    if (!isObject(strategy)) {
        throw new Error("Expected 'strategy' argument to 'walkForwardOptimize' to be an object that defines the trading strategy for to do the walk-forward optimization.");
    }

    if (!isArray(parameters) || parameters.length <= 0) {
        throw new Error("Expected 'parameters' argument to 'walkForwardOptimize' to be an array that specifies the strategy parameters that are to be optimized.");
    }

    if (!isFunction(objectiveFn)) {
        throw new Error("Expected 'objectiveFn' argument to 'walkForwardOptimize' to be a function that computes an objective function for a set of trades.");
    }

    if (!isObject(inputSeries) && inputSeries.count() > 0) {
        throw new Error("Expected 'inputSeries' argument to 'walkForwardOptimize' to be a Data-Forge DataFrame object that provides the input data for optimization.");
    }

    if (!isNumber(inSampleSize) || inSampleSize <= 0) {
        throw new Error("Expected 'inSampleSize' argument to 'walkForwardOptimize' to be a positive number that specifies the amount of data to use for the in-sample data set (the training data).");
    }

    if (!isNumber(outSampleSize) || outSampleSize <= 0) {
        throw new Error("Expected 'outSampleSize' argument to 'walkForwardOptimize' to be a positive number that specifies the amount of data to use for the out-of-sample data set (the testing data).");
    }

    if (!options) {
        options = {};
    }

    if (options.searchDirection === undefined) {
        options.searchDirection = OptimizeSearchDirection.Highest;
    }

    let workingDataOffset = 0;
    let trades: ITrade[] = []

    while (true) {
        const inSampleSeries = inputSeries.skip(workingDataOffset).take(inSampleSize).bake();
        const outSampleSeries = inputSeries.skip(workingDataOffset+inSampleSize).take(outSampleSize).bake();
        if (outSampleSeries.count() < outSampleSize) {
            break; // No more data.
        }

        //
        // Optimize using in sample data.
        //
        const optimizeResult = optimize(strategy, parameters, objectiveFn, inSampleSeries, { numBuckets: options.numBuckets, searchDirection: options.searchDirection });

        //
        // Construct a strategy using the optimal parameter values.
        //
        const strategyClone = Object.assign({}, strategy);
        strategyClone.parameters = Object.assign({}, strategy.parameters, optimizeResult.bestParameterValues);
        
        //
        // Backtest optimized strategy on out of sample data.
        //
        const outSampleTrades = backtest(strategyClone, outSampleSeries); 

        //
        // Accumulate trades from out of sample data.
        //
        trades = trades.concat(outSampleTrades);

        //
        // Move forward to the next out of sample section and repeat.
        //
        workingDataOffset += outSampleSize;
    }

    return {
        trades: trades,
    };
}