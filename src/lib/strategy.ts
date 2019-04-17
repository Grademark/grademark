import { IBar } from "./bar";
import { IDataFrame } from "data-forge";
import { IPosition } from "./position";

/**
 * Options to the enter position function.
 */
export interface IEnterPositionOptions {
    entryPrice?: number;
}

/**
 * Type for the function used to enter a position.
 * Can specify an optional conditional entry price, if specified entry
 * is only triggered when that instrument hits the target price.
 */
export type EnterPositionFn = (options?: IEnterPositionOptions) => void;

/**
 * Type for the function used to exit a position.
 */
export type ExitPositionFn = () => void;

/**
 * General parameters to rule functions.
 */
export interface IRuleParams<BarT extends IBar, ParametersT> {

    /**
     * The most recent bar.
     */
    bar: BarT;

    /**
     * Lookback buffer containining the past X bars.
     */
    lookback: IDataFrame<number, BarT>;

    /**
     * Optimizable parameters to the trading strategy.
     */
    parameters: ParametersT;
}

/**
 * Parameters to a rule that's executed when there's a current open position.
 */
export interface IOpenPositionRuleArgs<BarT extends IBar, ParametersT> extends IRuleParams<BarT, ParametersT> {
    /**
     * Entry price for the position.
     */
    entryPrice: number;

    /**
     * The position that is currently open.
     */
    position: IPosition;
}

/**
 * Arguments to a stop loss rule function.
 */
export interface IStopLossArgs<BarT extends IBar, ParametersT> extends IOpenPositionRuleArgs<BarT, ParametersT> {
}

/**
 * Computes the intrabar stop loss.
 * Return the maximum loss before an exit is triggered.
 */
export type StopLossFn<BarT extends IBar, ParametersT = any> = (args: IStopLossArgs<BarT, ParametersT>) => number;

/**
 * Arguments to a profit target rule function.
 */
export interface IProfitTargetArgs<BarT extends IBar, ParametersT> extends IOpenPositionRuleArgs<BarT, ParametersT> {
}

/**
 * Computes the intrabar profit target.
 * Return the amount of profit to trigger an exit.
 */
export type ProfitTargetFn<BarT extends IBar, ParametersT = any> = (args: IProfitTargetArgs<BarT, ParametersT>) => number;

/**
 * Arguments for an entry rule function.
 */
export interface IEntryRuleArgs<BarT extends IBar, ParametersT> extends IRuleParams<BarT, ParametersT> {
}

/**
 * Type for a function that defines an entry rule.
 */
export type EntryRuleFn<BarT extends IBar, ParametersT = any> = (enterPosition: EnterPositionFn, args: IEntryRuleArgs<BarT, ParametersT>) => void;

/**
 * Arguments for an exit rule function.
 */
export interface IExitRuleArgs<BarT extends IBar, ParametersT> extends IOpenPositionRuleArgs<BarT, ParametersT> {
}

/**
 * Type for a function that defines an exit rule.
 */
export type ExitRuleFn<BarT extends IBar, ParametersT = any> = (exitPosition: ExitPositionFn, args: IExitRuleArgs<BarT, ParametersT>) => void;

/**
 * A collection of key/value pairs for parameters.
 */
export interface IParameterBucket {
    [index: string]: number;
}

/**
 * Arguments to a prep indicators function.
 */
export interface IPrepIndicatorsArgs<InputBarT extends IBar, ParametersT, IndexT> {

    /**
     * Optimizable parameters to the trading strategy.
     */
    parameters: ParametersT;
    
    /**
     * Input data series from which to compute indicators.
     */
    inputSeries: IDataFrame<IndexT, InputBarT>;
}

/**
 * A function that prepares indicators for backtesting.
 */
export type PrepIndicatorsFn<InputBarT extends IBar, IndicatorsBarT extends InputBarT, ParametersT, IndexT> = (args: IPrepIndicatorsArgs<InputBarT, ParametersT, IndexT>) => IDataFrame<IndexT, IndicatorsBarT>; 

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