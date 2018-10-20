import { IBar } from "./bar";
import { IDataFrame } from "data-forge";

/**
 * Type for the function used to enter a position.
 */
export type EnterPositionFn = () => void;

/**
 * Type for a function that defines an entry rule.
 */
export type EntryRuleFn<IndexT = number> = (dataSeries: IDataFrame<IndexT, IBar>, enterPosition: EnterPositionFn) => void;

/**
 * Interface that defines a trading strategy.
 */
export interface IStrategy<IndexT = number> {

    /**
     * Defines the rule to enter positions.
     */
    entryRule: EntryRuleFn<IndexT>;

}