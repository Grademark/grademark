import { assert, expect } from 'chai';
import { backtest } from '../../lib/backtest';

describe('backtest', () => {

    it('generates no trades when no entry is ever taken', ()  => {

        const trades = backtest();
        expect(trades.count()).to.eql(0);
    });

});
