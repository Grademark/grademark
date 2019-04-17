import { IBar } from "./bar";
import { IDataFrame } from "data-forge";
import { ITrade } from "./trade";
import { IStrategy } from "./strategy";
import { ISeries } from "data-forge";
import { backtest } from "./backtest";
import { DataFrame } from "data-forge";
import * as math from 'mathjs';
import { isObject, isNumber, isArray, isFunction } from "./utils";

const defaultNumBuckets = 10;

/**
 * Defines a function that selects an objective value to measure the performance of a set of trades.
 */
export type ObjectiveFn = (trades: IDataFrame<number, ITrade>) => number;

/**
 * What is the best value of the objective function?
 */
export enum OptimizeSearchDirection { //TODO: This should be a string for JS compatibility.
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
    searchDirection?: OptimizeSearchDirection; //TODO: This should be part of the objective function??

    /**
     * Record trades for each iteration of the optimization.
     */
    recordTrades?: boolean;

    /**
     * Number of buckets for evaluating performance stability.
     */
    numBuckets?: number; //TODO: This should be part of the objective function??
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
            const bucketPerformance = math.mean(performanceMetrics);
            const bucketPerformanceStdDev = math.std(performanceMetrics);
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
export function optimizeSingleParameter<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParameterT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParameterT, IndexT>, 
    parameter: IParameterDef,
    objectiveFn: ObjectiveFn,
    inputSeries: IDataFrame<IndexT, InputBarT>,
    options?: IOptimizationOptions
        ): IOptimizationResult {

    if (!isObject(strategy)) {
        throw new Error("Expected 'strategy' argument to 'optimizeSingleParameter' to be an object that defines the strategy to be optimized.");
    }

    if (!isObject(parameter)) {
        throw new Error("Expected 'parameter' argument to 'optimizeSingleParameter' to be an object that defines the strategy parameter to be optimized.");
    }

    if (!isNumber(parameter.startingValue)) {
        throw new Error("Expected 'startingValue' field of 'parameter' argument to be a number that specifies the starting value of the strategy parameter to be optimized.");
    }

    if (!isNumber(parameter.endingValue)) {
        throw new Error("Expected 'endingValue' field of 'parameter' argument to be a number that specifies the starting value of the strategy parameter to be optimized.");
    }

    if (!isNumber(parameter.stepSize)) {
        throw new Error("Expected 'stepSize' field of 'parameter' argument to be a number that specifies the starting value of the strategy parameter to be optimized.");
    }

    if (!isObject(inputSeries)) {
        throw new Error("Expected 'inputSeries' argument to 'optimizeSingleParameter' to be a Data-Forge DataFrame object that provides the input data for optimization.");
    }

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
        parameterOverride[parameter.name] = workingParameter;

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

    if (iterationResults.length <= 0) {
        throw new Error(`Optimization of parameter ${parameter.name} from ${parameter.startingValue} to ${parameter.endingValue} in steps of size ${parameter.stepSize} produced no optimization iterations!`);
    }

    const bestIterationIndex = pickBestStrategy(new DataFrame(iterationResults), options.numBuckets || defaultNumBuckets, options.searchDirection)

    return {
        bestIterationResult: iterationResults[bestIterationIndex],
        iterationResults: iterationResults,
    };
}

/**
 * Result of a multi-parameter optimisation.
 */
export interface IMultiParameterOptimizationResult<ParameterT> {

    /**
     * Best parameter values produced by this optimization.
     */
    bestParameterValues: ParameterT;
}

/**
 * Perform an optimization over multiple parameters.
 */
export function optimize<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParameterT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParameterT, IndexT>, 
    parameters: IParameterDef[],
    objectiveFn: ObjectiveFn,
    inputSeries: IDataFrame<IndexT, InputBarT>,
    options?: IOptimizationOptions
        ): IMultiParameterOptimizationResult<ParameterT> {

    if (!isObject(strategy)) {
        throw new Error("Expected 'strategy' argument to 'optimize' to be an object that defines the trading strategy to be optimized.");
    }

    if (!isArray(parameters)) {
        throw new Error("Expected 'parameters' argument to 'optimize' to be an array that defines the various strategy parameters to be optimized.");
    }

    if (!isFunction(objectiveFn)) {
        throw new Error("Expected 'objectiveFn' argument to 'optimize' to be a function that computes an objective function for a set of trades.");
    }

    if (!isObject(inputSeries)) {
        throw new Error("Expected 'inputSeries' argument to 'optimize' to be a Data-Forge DataFrame object that provides the input data for optimization.");
    }
        
    if (!options) {
        options = {};
    }

    if (options.searchDirection === undefined) {
        options.searchDirection = OptimizeSearchDirection.Highest;
    }

    const workingStrategy = Object.assign({}, strategy);
    workingStrategy.parameters = Object.assign({}, strategy.parameters);

    //TODO: Should pass back the metrics for each run of parameters.
    
    for (const parameter of parameters) { //TODO: Maybe want a higher level loop that continues to optimize until we get a stable result.
        const singleParameterResult = optimizeSingleParameter(workingStrategy, parameter, objectiveFn, inputSeries, options);
        (workingStrategy.parameters as any)[parameter.name] = singleParameterResult.bestIterationResult.parameterValue;
    }

    return {
        bestParameterValues: workingStrategy.parameters,
    };
}