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
export type EntryRuleFn<IndexT = number> = (curBar: IBar, dataSeries: IDataFrame<IndexT, IBar>, enterPosition: EnterPositionFn) => void;

/**
 * Type for a function that defines an exigt rule.
 */
export type ExitRuleFn<IndexT = number> = (position: IPosition, curBar: IBar, dataSeries: IDataFrame<IndexT, IBar>, exitPosition: ExitPositionFn) => void;

/**
 * Interface that defines a trading strategy.
 */
export interface IStrategy<IndexT = number> {

    /**
     * Defines the rule to enter a position.
     */
    entryRule: EntryRuleFn<IndexT>;

    /**
     * Defines the rule to exit a position.
     */
    exitRule: ExitRuleFn<IndexT>;
}