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
export type EntryRuleFn<BarT extends IBar = IBar, IndexT = number> = (curBar: BarT, dataSeries: IDataFrame<IndexT, BarT>, enterPosition: EnterPositionFn) => void;

/**
 * Type for a function that defines an exigt rule.
 */
export type ExitRuleFn<BarT extends IBar = IBar, IndexT = number> = (position: IPosition, curBar: BarT, dataSeries: IDataFrame<IndexT, BarT>, exitPosition: ExitPositionFn) => void;

/**
 * Interface that defines a trading strategy.
 */
export interface IStrategy<BarT extends IBar = IBar, IndexT = number> {

    /**
     * Defines the rule to enter a position.
     */
    entryRule: EntryRuleFn<BarT, IndexT>;

    /**
     * Defines the rule to exit a position.
     */
    exitRule: ExitRuleFn<BarT, IndexT>;
}