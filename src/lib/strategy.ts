import { IBar } from "./bar";
import { IDataFrame } from "data-forge";
import { IPosition } from "./position";

/**
 * Type for the function used to enter a position.
 */
export type EnterPositionFn = () => void;

/**
 * Type for the function used to exit a position.
 */
export type ExitPositionFn = () => void;

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
    exitRule: ExitRuleFn<BarT>;
}