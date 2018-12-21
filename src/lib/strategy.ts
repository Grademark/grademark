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
export type StopLossFn<BarT extends IBar = IBar> = (entryPrice: number, latestBar: BarT, lookback: IDataFrame<number, BarT>) => number;

/**
 * Computes the intrabar profit target.
 * Return the amount of profit to trigger an exit.
 */
export type ProfitTargetFn<BarT extends IBar = IBar> = (entryPrice: number, latestBar: BarT, lookback: IDataFrame<number, BarT>) => number;

/**
 * Type for a function that defines an entry rule.
 */
export type EntryRuleFn<BarT extends IBar = IBar> = (enterPosition: EnterPositionFn, curBar: BarT, lookback: IDataFrame<number, BarT>) => void;

/**
 * Type for a function that defines an exigt rule.
 */
export type ExitRuleFn<BarT extends IBar = IBar> = (exitPosition: ExitPositionFn, position: IPosition, curBar: BarT, lookback: IDataFrame<number, BarT>) => void;

/**
 * Interface that defines a trading strategy.
 */
export interface IStrategy<BarT extends IBar = IBar> {

    /**
     * Number of days data to make available to entry/exit rules.
     */
    lookbackPeriod?: number;

    /**
     * Defines the rule to enter a position.
     */
    entryRule: EntryRuleFn<BarT>;

    /**
     * Defines the rule to exit a position.
     */
    exitRule?: ExitRuleFn<BarT>;

    /**
     * Function that computes intrabar stop loss distance.
     * Return the maximum loss before an exit is triggered.
     */
    stopLoss?: StopLossFn<BarT>;

    /**
     * Function that computes intrabar trailing stop loss distance.
     * Return the maximum loss before an exit is triggered.
     * This stop trails the current price, rising but never declining.
     */
    trailingStopLoss?: StopLossFn<BarT>;
    
    /**
     * Function that computes the intrabar profit target.
     * Return the amount of profit to trigger an exit.
     */
    profitTarget?: ProfitTargetFn<BarT>;
}