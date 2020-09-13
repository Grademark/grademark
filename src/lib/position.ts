import { ITimestampedValue } from "./trade";
import { TradeDirection } from "./strategy";

/**
 * Interface that defines an open position.
 */
export interface IPosition {

    /**
     * The direction of the position.
     * Long or short.
     */
    direction: TradeDirection;

    /***
     * Timestamp when the position was entered.
     */
    entryTime: Date;

    /**
     * Price when the position was entered.
     */
    entryPrice: number;

    /**
     * Net profit or loss.
     */
    profit: number;

    /**
     * Profit expressed as a percentage.
     */
    profitPct: number;

    /**
     * Profit expressed as growth.
     */
    growth: number;

    /**
     * Optional initial risk in dollars computed from stop loss.
     */
    initialUnitRisk?: number;

    /**
     * Optional initial risk computed from stop loss and expressed as a percentage of entry price.
     */
    initialRiskPct?: number;

    /**
     * Ongoing risk, the difference of current price and stop loss expressed as a percentage of current price.
     */
    curRiskPct?: number;

    /**
     * Optional profit expressed as a multiple of initial unit risk.
     */
    curRMultiple?: number;

    /**
     * Records the risk series, if enabled.
     */
    riskSeries?: ITimestampedValue[];
    
    /**
     * Number of bars the position was held for.
     */
    holdingPeriod: number;

    /**
     * Initial maximum loss before exit is triggered (intrabar).
     */
    initialStopPrice?: number;

    /**
     * Current (possibly trailing) maximum loss before exit is triggered (intrabar).
     */
    curStopPrice?: number;

    /**
     * Records the stop price series, if enabled.
     */
    stopPriceSeries?: ITimestampedValue[];

    /*
     * Profit target where exit is triggered (intrabar).
     */
    profitTarget?: number;
}