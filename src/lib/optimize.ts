import { IBar } from "./bar";
import { IDataFrame } from "data-forge";
import { ITrade } from "./trade";
import { IStrategy } from "./strategy";
import { ISeries } from "data-forge";
import { backtest } from "./backtest";
import { DataFrame } from "data-forge";

const defaultNumBuckets = 10;

/**
 * Defines a function that selects an objective value to measure the performance of a set of trades.
 */
export type ObjectiveFn = (trades: IDataFrame<number, ITrade>) => number;

/**
 * What is the best value of the objective function?
 */
export enum OptimizeSearchDirection {
    //
    // Select the optimization iteration with the highest value from the objective function.
    //
    Highest,

    // 
    // Select the optimization iteration with the lowest value from the objective function.
    //
    Lowest
}

/**
 * Defines the parameter to optimize for.
 */
export interface IParameterDef {
    /**
     * The name of the parameter.
     */
    name: string;

    /**
     * The starting value of the parameter.
     */
    startingValue: number;

    /**
     * The ending value of the parameter.
     */
    endingValue: number;

    /**
     * Amount to step the parameter with each iteration of the optimziation.
     */
    stepSize: number;
}

/**
 * Result from a single optimization iteration.
 */
export interface IOptimizationIterationResult {
    /**
     * The index of the iteration.
     */
    iterationIndex: number;

    /**
     * The particular parameter value that was backtested and analyzed.
     */
    parameterValue: number;

    /**
     * The output of the object function recorded for the particular parameter value.
     */
    performanceMetric: number;

    /**
     * Records the trades for each iteration of optimization, if recordTrades is enabled in the options.
     */
    trades?: IDataFrame<number, ITrade>;
}

/**
 * Records the result of an optimization.
 */
export interface IOptimizationResult {

    /**
     * Results of the best iteration of optimization.
     */
    bestIterationResult: IOptimizationIterationResult;

    /**
     * Records the result from each optimization iteration.
     * Indicies of the dataframe line up with optimization iteration indicies.
     */
    iterationResults: IOptimizationIterationResult[];
}

/**
 * Options to the optimize function.
 */
export interface IOptimizationOptions {

    /**
     * Determine the direction we are optimizating for when looking out the object function.
     */
    searchDirection?: OptimizeSearchDirection;

    /**
     * Record trades for each iteration of the optimization.
     */
    recordTrades?: boolean;

    /**
     * Number of buckets for evaluating performance stability.
     */
    numBuckets?: number;
}

//todo: probably bring these in from mathjs!
//
// Compute the sum of the set of values.
//
function sum (values: number[]) {
    return values.reduce((prev, cur) => prev + cur, 0);
}

//
// Compute the average of a set of values.
//
function average (values: number[]) {
    return sum(values) / values.length; // Divide the sum of values by the amount of values.
}

//
// Compute the standard deviation of a set of values.
//
function std (values: number[]) {
    const avg = average(values); // Compute the average of the values.
    const squaredDiffsFromAvg = values // Compute the shared difference from the average for each value.
        .map(v => Math.pow(v - avg, 2));
    const avgDiff = average(squaredDiffsFromAvg); // Average the squared differences.
    return Math.sqrt(avgDiff); // Take the square root and we have our standard deviation.
}

//
// Bucket nearby iteration results so we can determine how stable the result is.
//
interface IIterationResultsBucket {
    //
    // Index of the bucket.
    //
    bucketIndex: number;

    //
    // Rank of the bucket. 
    // Average performance / std dev.
    //
    bucketRank: number; 

    //
    // Each result that falls in this bucket.
    //
    iterationResults: ISeries<number, IOptimizationIterationResult>;
}

/**
 * Organise all values in the series into the specified number of buckets.
 * 
 * @param {int} numBuckets - The number of buckets to create.
 * 
 * @returns {DataFrame} Returns a dataframe containing bucketed data. The input values are divided up into these buckets.
 */
function bucket(optimizationIterationResults: IDataFrame<number, IOptimizationIterationResult>, numBuckets: number, searchDirection: OptimizeSearchDirection): IDataFrame<number, IIterationResultsBucket> {

    if (optimizationIterationResults.none()) {
        return new DataFrame();
    }

    const totalValues = optimizationIterationResults.count();
    const parameterValues = optimizationIterationResults.deflate(iterationResult => iterationResult.parameterValue).bake();
    const min = parameterValues.min();
    const max = parameterValues.max();
    const range = max - min;
    return optimizationIterationResults
        .select(iterationResult => {
            const bucketIndex = Math.floor(((iterationResult.parameterValue - min) / range) * (numBuckets-1));
            return {
                bucketIndex: bucketIndex,
                iterationResult: iterationResult,
            };
        })
        .groupBy(bucket => bucket.bucketIndex)
        .select(group => {
            const performanceMetrics = group.select(bucket => bucket.iterationResult.performanceMetric).toArray();
            const bucketPerformance = average(performanceMetrics);
            const bucketPerformanceStdDev = std(performanceMetrics);
            const invertedPerformance = searchDirection === OptimizeSearchDirection.Highest ? bucketPerformance : -bucketPerformance;
            const bucketRank = bucketPerformanceStdDev > 0
                ? invertedPerformance / bucketPerformanceStdDev
                : invertedPerformance;
            return {
                bucketIndex: group.first().bucketIndex,
                bucketRank: bucketRank,
                iterationResults: group.select(bucket => bucket.iterationResult),
            };
        })
        .inflate();
};    

//
// Pick the most optimized version strategy of the selected according to the objective function and search direction.
// Returns the iteration index of the strategy.
//
function pickBestStrategy(optimizationIterationResults: IDataFrame<number, IOptimizationIterationResult>, numBuckets: number, searchDirection: OptimizeSearchDirection): number {

    //
    // Find the best bucket based on average metric value penalised by standard deviation.
    // Dividing by standard deviation reduces the metric as std dev grows. 
    //
    // If we are looking for the lowest value then the average is inverted before taking the ratio.
    //
    const bucketed = bucket(optimizationIterationResults, numBuckets, searchDirection);
    const orderedBuckets = bucketed
        .orderByDescending(bucket => bucket.bucketRank)
        .bake();
    const bestBucket = orderedBuckets.first(); // Looking for highest average performance penalized by std dev. 
    let orderedResults = bestBucket.iterationResults
        .orderBy(result => result.performanceMetric)
        .bake();

    if (searchDirection === OptimizeSearchDirection.Highest) {
        return orderedResults.first().iterationIndex;
    }
    else {
        return orderedResults.last().iterationIndex;
    }
}

/**
 * Perform an optimization over a single parameter.
 */
export function optimize<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParameterT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParameterT, IndexT>, 
    parameter: IParameterDef,
    objectiveFn: ObjectiveFn,
    inputSeries: IDataFrame<IndexT, InputBarT>,
    options?: IOptimizationOptions
        ): IOptimizationResult {

    if (!options) {
        options = {};
    }

    if (options.searchDirection === undefined) {
        options.searchDirection = OptimizeSearchDirection.Highest;
    }

    const iterationResults: IOptimizationIterationResult[] = [];

    let iterationIndex = 0;
    let workingParameter = parameter.startingValue;
    while (workingParameter <= parameter.endingValue) {

        const parameterOverride: any = {};
        parameterOverride[parameter.name] = workingParameter

        const strategyClone = Object.assign({}, strategy);
        strategyClone.parameters = Object.assign({}, strategy.parameters, parameterOverride);

        // Run a back test with this parameter value.
        const iterationTrades = backtest<InputBarT, IndicatorBarT, ParameterT, IndexT>(strategyClone, inputSeries);

        // Use objective function to compute performance metric.
        const iterationResult: IOptimizationIterationResult = {
            iterationIndex: iterationIndex,
            parameterValue: workingParameter,
            performanceMetric: objectiveFn(iterationTrades),
        };

        if (options.recordTrades) {
            iterationResult.trades = iterationTrades;
        }

        iterationResults.push(iterationResult);
        
        workingParameter += parameter.stepSize;
        ++iterationIndex;
    }

    const bestIterationIndex = pickBestStrategy(new DataFrame(iterationResults), options.numBuckets || defaultNumBuckets, options.searchDirection)

    return {
        bestIterationResult: iterationResults[bestIterationIndex],
        iterationResults: iterationResults,
    };
}