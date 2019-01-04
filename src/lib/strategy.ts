import { IBar } from "./bar";
import { IDataFrame } from "data-forge";
import { IPosition } from "./position";

/**
 * Type for the function used to enter a position.
 * Can specify an optional conditional entry price, if specified entry
 * is only triggered when that instrument hits the target price.
 */
export type EnterPositionFn = (entryPrice?: number) => void;

/**
 * Type for the function used to exit a position.
 */
export type ExitPositionFn = () => void;

/**
 * Computes the intrabar stop loss.
 * Return the maximum loss before an exit is triggered.
 */
export type StopLossFn<BarT extends IBar, ParametersT = any> = (entryPrice: number, latestBar: BarT, lookback: IDataFrame<number, BarT>, parameters?: ParametersT) => number;

/**
 * Computes the intrabar profit target.
 * Return the amount of profit to trigger an exit.
 */
export type ProfitTargetFn<BarT extends IBar, ParametersT = any> = (entryPrice: number, latestBar: BarT, lookback: IDataFrame<number, BarT>, parameters?: ParametersT) => number;

/**
 * Type for a function that defines an entry rule.
 */
export type EntryRuleFn<BarT extends IBar, ParametersT = any> = (enterPosition: EnterPositionFn, curBar: BarT, lookback: IDataFrame<number, BarT>, parameters?: ParametersT) => void;

/**
 * Type for a function that defines an exigt rule.
 */
export type ExitRuleFn<BarT extends IBar, ParametersT = any> = (exitPosition: ExitPositionFn, position: IPosition, curBar: BarT, lookback: IDataFrame<number, BarT>, parameters?: ParametersT) => void;

/**
 * A collection of key/value pairs for parameters.
 */
export interface IParameterBucket {
    [index: string]: number;
}

/**
 * A function that prepares indicators for backtesting.
 */
export type PrepIndicatorsFn<InputBarT extends IBar, IndicatorsBarT extends InputBarT, ParametersT, IndexT> = (parameters: ParametersT, inputSeries: IDataFrame<IndexT, InputBarT>) => IDataFrame<IndexT, IndicatorsBarT>; 

/**
 * Interface that defines a trading strategy.
 */
export interface IStrategy<InputBarT extends IBar = IBar, IndicatorsBarT extends InputBarT = InputBarT, ParametersT = IParameterBucket, IndexT = number> {

    /**
     * Optimizable parameters to the strategy.
     */
    parameters?: ParametersT;

    /**
     * Number of days data to make available to entry/exit rules.
     */
    lookbackPeriod?: number;

    /**
     * A function to prepare indicators prior to backtesting.
     */
    prepIndicators?: PrepIndicatorsFn<InputBarT, IndicatorsBarT, ParametersT, IndexT>;

    /**
     * Defines the rule to enter a position.
     */
    entryRule: EntryRuleFn<IndicatorsBarT, ParametersT>;

    /**
     * Defines the rule to exit a position.
     */
    exitRule?: ExitRuleFn<IndicatorsBarT, ParametersT>;

    /**
     * Function that computes intrabar stop loss distance.
     * Return the maximum loss before an exit is triggered.
     */
    stopLoss?: StopLossFn<InputBarT, ParametersT>;

    /**
     * Function that computes intrabar trailing stop loss distance.
     * Return the maximum loss before an exit is triggered.
     * This stop trails the current price, rising but never declining.
     */
    trailingStopLoss?: StopLossFn<InputBarT, ParametersT>;
    
    /**
     * Function that computes the intrabar profit target.
     * Return the amount of profit to trigger an exit.
     */
    profitTarget?: ProfitTargetFn<InputBarT, ParametersT>;
}