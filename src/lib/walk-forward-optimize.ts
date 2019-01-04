import { IBar } from "./bar";
import { IDataFrame } from "data-forge";
import { ITrade } from "./trade";
import { IStrategy } from "./strategy";
import { ISeries } from "data-forge";
import { backtest } from "./backtest";
import { DataFrame } from "data-forge";
import { IParameterDef, ObjectiveFn, OptimizeSearchDirection, optimize } from "./optimize";

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
    trades: IDataFrame<number, ITrade>;
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

    if (!options) {
        options = {};
    }

    if (options.searchDirection === undefined) {
        options.searchDirection = OptimizeSearchDirection.Highest;
    }

    let workingDataOffset = 0;
    let trades: IDataFrame<number, ITrade> = new DataFrame<number, ITrade>();

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
        trades: trades.bake(),
    };
}