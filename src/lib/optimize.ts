import { IBar } from "./bar";
import { IDataFrame } from "data-forge";
import { ITrade } from "./trade";
import { IStrategy } from "./strategy";
import { backtest } from "./backtest";
import { isObject, isArray, isFunction } from "./utils";
import { Random } from "./random";

/**
 * Defines a function that selects an objective value to measure the performance of a set of trades.
 */
export type ObjectiveFn = (trades: ITrade[]) => number;

/**
 * What is the best value of the objective function?
 */
export type OptimizeSearchDirection = "max" | "min";

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

//
// Sets the type of algoritm used for optimization.
//
export type OptimizationType = "grid" | "hill-climb";

/**
 * Options to the optimize function.
 */
export interface IOptimizationOptions {

    /**
     * Determine the direction we are optimizating for when looking out the object function.
     */
    searchDirection?: OptimizeSearchDirection;

    /**
     * Sets the type of algoritm used for optimization.
     * Defaults to "grid".
     */
    optimizationType?: OptimizationType;

    /**
     * Record all results from all iterations.
     */
    recordAllResults?: boolean;

    /**
     * Starting seed for the random number generator.
     */
    randomSeed?: number;

    /**
     * The number of starting points to consider for the hill climb algorithm.
     * The more starting point the better chance of getting an optimal result, but it also makes the algo run slower.
     */
    numStartingPoints?: number;

    /**
     * Record the duration of the optimization algorithm.
     */
    recordDuration?: boolean;
}

//
// Records the result of an iteration of optimization.
//
export type IterationResult<ParameterT> = (ParameterT & { result: number, numTrades: number });

/**
 * Result of a multi-parameter optimisation.
 */
export interface IOptimizationResult<ParameterT> {

    /**
     * The best result that was found in the parameter space.
     */
    bestResult: number;

    /**
     * Best parameter values produced by this optimization.
     */
    bestParameterValues: ParameterT;
    
    /**
     * Results of all iterations of optimizations.
     */
    allResults?: IterationResult<ParameterT>[]; 

    /**
     * The time taken (in milliseconds) by the optimization algorithm.
     */
    durationMS?: number;
}

interface OptimizationIterationResult {
    //
    // Metric used to compare iterations.
    //
    metric: number;

    //
    // Number of trades performed in this iteration.
    //
    numTrades: number;
}

//
// Performs a single iteration of optimization and returns the result.
//
function optimizationIteration<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParameterT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParameterT, IndexT>, 
    parameters: IParameterDef[],
    objectiveFn: ObjectiveFn,
    inputSeries: IDataFrame<IndexT, InputBarT>,
    coordinates: number[]
        ): OptimizationIterationResult {

    const parameterOverride: any = {};
    for (let parameterIndex = 0; parameterIndex < parameters.length; ++parameterIndex) {
        const parameter = parameters[parameterIndex];
        parameterOverride[parameter.name] = coordinates[parameterIndex];
    }

    const strategyClone = Object.assign({}, strategy);
    strategyClone.parameters = Object.assign({}, strategy.parameters, parameterOverride);
    const trades = backtest<InputBarT, IndicatorBarT, ParameterT, IndexT>(strategyClone, inputSeries)
    return {
        metric: objectiveFn(trades),
        numTrades: trades.length,
    };
}

//
// Get neighbours of a particular set of coordinates.
//
function* getNeighbours(coordinates: number[], parameters: IParameterDef[]): IterableIterator<number[]> {
    // 
    // Step forward.
    //
    for (let i = 0; i < parameters.length; ++i) {
        const nextCoordinate = coordinates[i] += parameters[i].stepSize;
        if (nextCoordinate <= parameters[i].endingValue) {
            const nextCoordinates = coordinates.slice(); // Clone.
            nextCoordinates[i] = nextCoordinate;
            yield nextCoordinates;
        }
    }

    // 
    // Step backward.
    //
    for (let i = 0; i < parameters.length; ++i) {
        const nextCoordinate = coordinates[i] -= parameters[i].stepSize;
        if (nextCoordinate >= parameters[i].startingValue) {
            const nextCoordinates = coordinates.slice(); // Clone.
            nextCoordinates[i] = nextCoordinate;
            yield nextCoordinates;
        }
    }
}

//
// Extracts parameter values from the coordinate system.
//
function extractParameterValues<ParameterT>(parameters: IParameterDef[], workingCoordinates: number[]): ParameterT {
    
    const bestParameterValues: any = {};

    for (let parameterIndex = 0; parameterIndex < parameters.length; ++parameterIndex) {
        const parameter = parameters[parameterIndex];
        bestParameterValues[parameter.name] = workingCoordinates[parameterIndex];
    }

    return bestParameterValues;
}

//
// Packages the results of an iteration.
//
function packageIterationResult<ParameterT>(parameters: IParameterDef[], workingCoordinates: number[], result: OptimizationIterationResult): IterationResult<ParameterT> {
    const iterationResult: any = Object.assign(
        {}, 
        extractParameterValues(parameters, workingCoordinates), 
        { 
            result: result.metric,
            numTrades: result.numTrades, 
        }
    );
    return iterationResult;
}

//
// Returns true to accept the current result or false to discard.
//
function acceptResult(workingResult: number, nextResult: number, options: IOptimizationOptions): boolean {

    if (options.searchDirection === "max") {
        if (nextResult > workingResult) { // Looking for maximum value.
            return true;
        }
    }
    else {
        if (nextResult < workingResult) { // Looking for minimum value.
            return true;
        }
    }

    return false;
}

//
// Iterate a dimension in coordinate space.
//
function* iterateDimension(workingCoordinates: number[], parameterIndex: number, parameters: IParameterDef[]): IterableIterator<number[]> {
    
    const parameter = parameters[parameterIndex];
    
    for (let parameterValue = parameter.startingValue; parameterValue <= parameter.endingValue; parameterValue += parameter.stepSize) {

        const coordinatesHere = [...workingCoordinates, parameterValue];

        if (parameterIndex < parameters.length-1) {
            //
            // Recurse to higher dimensions.
            //
            for (const coordinates of iterateDimension(coordinatesHere, parameterIndex+1, parameters)) {
                yield coordinates;
            }
        }
        else {
            //
            // At the bottommost dimension.
            // This is where we produce coordinates.
            //
            yield coordinatesHere;
        }
    }
}

//
// Get all coordinates in a particular coordinate space.
//
function* getAllCoordinates(parameters: IParameterDef[]): IterableIterator<number[]> {

    for (const coordinates of iterateDimension([], 0, parameters)) {
        yield coordinates;
    }
}

//
// Performs a fast but non-exhaustive hill climb optimization.
//
function hillClimbOptimization<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParameterT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParameterT, IndexT>, 
    parameters: IParameterDef[],
    objectiveFn: ObjectiveFn,
    inputSeries: IDataFrame<IndexT, InputBarT>,
    options: IOptimizationOptions
        ): IOptimizationResult<ParameterT> {

    let bestResult: number | undefined;
    let bestCoordinates: number[] | undefined;
    const results: IterationResult<ParameterT>[] = [];

    const startTime = Date.now();

    const visitedCoordinates = new Map<number[], OptimizationIterationResult>(); // Tracks coordinates that we have already visited and their value.

    const random = new Random(options.randomSeed || 0);

    const numStartingPoints = options.numStartingPoints || 4;
    for (let startingPointIndex = 0; startingPointIndex < numStartingPoints; ++startingPointIndex) {

        //
        // Compute starting coordinates for this section.
        //
        let workingCoordinates: number[] = [];
    
        for (const parameter of parameters) {
            const randomIncrement = random.getInt(0, (parameter.endingValue - parameter.startingValue) / parameter.stepSize);
            const randomCoordinate = parameter.startingValue + randomIncrement * parameter.stepSize;
            workingCoordinates.push(randomCoordinate);
        }

        if (visitedCoordinates.has(workingCoordinates)) {
            // Already been here!
            continue;
        }

        let workingResult = optimizationIteration(strategy, parameters, objectiveFn, inputSeries, workingCoordinates);
        visitedCoordinates.set(workingCoordinates, workingResult);

        if (bestResult === undefined) {
            bestResult = workingResult.metric;
            bestCoordinates = workingCoordinates
        }
        else if (acceptResult(bestResult, workingResult.metric, options)) {
            bestResult = workingResult.metric;
            bestCoordinates = workingCoordinates;
        }

        if (options.recordAllResults) {
            results.push(packageIterationResult(parameters, workingCoordinates, workingResult));
        }
    
        while (true) {
            let gotBetterResult = false;

            //
            // Visit all neighbouring coordinates.
            //
            let nextCoordinates: number[];
            for (nextCoordinates of getNeighbours(workingCoordinates!, parameters)) {

                const cachedResult = visitedCoordinates.get(workingCoordinates);                
                const nextResult = cachedResult !== undefined ? cachedResult : optimizationIteration(strategy, parameters, objectiveFn, inputSeries, nextCoordinates);

                if (options.recordAllResults) {
                    results.push(packageIterationResult(parameters, workingCoordinates, workingResult));
                }
                
                if (acceptResult(bestResult, workingResult.metric, options)) {
                    bestResult = workingResult.metric;
                    bestCoordinates = workingCoordinates;
                }
    
                if (acceptResult(workingResult.metric, nextResult.metric, options)) {
                    workingCoordinates = nextCoordinates; 
                    workingResult = nextResult;
                    gotBetterResult = true;

                    break; // Move to this neighbour and start again.
                }
            }

            if (!gotBetterResult) {
                // There is no better neighbour, break out.
                break;
            }
        }
    }

    return {
        bestResult: bestResult!,
        bestParameterValues: extractParameterValues(parameters, bestCoordinates!),
        durationMS: options.recordDuration ? (Date.now() - startTime) : undefined,
        allResults: options.recordAllResults ? results : undefined,
    };
}

//
// Performs a slow exhaustive grid search optimization.
//
function gridSearchOptimization<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParameterT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParameterT, IndexT>, 
    parameters: IParameterDef[],
    objectiveFn: ObjectiveFn,
    inputSeries: IDataFrame<IndexT, InputBarT>,
    options: IOptimizationOptions
        ): IOptimizationResult<ParameterT> {

    let bestResult: number | undefined;
    let bestCoordinates: number[] | undefined;
    const results: IterationResult<ParameterT>[] = [];

    const startTime = Date.now();

    for (const coordinates of getAllCoordinates(parameters)) {
        const iterationResult = optimizationIteration(strategy, parameters, objectiveFn, inputSeries, coordinates);
        if (bestResult === undefined) {
            bestResult = iterationResult.metric;
            bestCoordinates = coordinates;
        }
        else if (acceptResult(bestResult, iterationResult.metric, options)) {
            bestResult = iterationResult.metric;
            bestCoordinates = coordinates;
        }

        if (options.recordAllResults) {
            results.push(packageIterationResult(parameters, coordinates, iterationResult));
        }
    }

    return {
        bestResult: bestResult!,
        bestParameterValues: extractParameterValues(parameters, bestCoordinates!),
        durationMS: options.recordDuration ? (Date.now() - startTime) : undefined,
        allResults: options.recordAllResults ? results : undefined,
    };
}

/**
 * Perform an optimization over multiple parameters.
 */
export function optimize<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParameterT, IndexT> (
    strategy: IStrategy<InputBarT, IndicatorBarT, ParameterT, IndexT>, 
    parameters: IParameterDef[],
    objectiveFn: ObjectiveFn,
    inputSeries: IDataFrame<IndexT, InputBarT>,
    options?: IOptimizationOptions
        ): IOptimizationResult<ParameterT> {

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
    else {
        options = Object.assign({}, options); // Copy so we can change.
    }

    if (options.searchDirection === undefined) {
        options.searchDirection = "max";
    }

    if (options.optimizationType === undefined) {
        options.optimizationType = "grid";
    }

    if (options.optimizationType === "hill-climb") {
        return hillClimbOptimization<InputBarT, IndicatorBarT, ParameterT, IndexT>(strategy, parameters, objectiveFn, inputSeries, options);
    }
    else if (options.optimizationType === "grid") {
        return gridSearchOptimization<InputBarT, IndicatorBarT, ParameterT, IndexT>(strategy, parameters, objectiveFn, inputSeries, options);
    }
    else {
        throw new Error(`Unexpected "optimizationType" field of "options" parameter to the "optimize" function. Expected "grid", or "hill-climb", Actual: "${options.optimizationType}".`);
    }
}
