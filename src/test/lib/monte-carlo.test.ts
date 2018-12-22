import { assert, expect } from 'chai';
import { monteCarlo } from '../../lib/monte-carlo';
import * as moment from 'moment';
import { ITrade, backtest } from '../..';
import { DataFrame } from 'data-forge';

describe("monte-carlo", () => {

    it("zero trades produces zero samples", () => {
        const trades: ITrade[] = [];
        const samples = monteCarlo(new DataFrame(trades), 2, 2);
        expect(samples.count()).to.eql(0);
    });

    it("can produce sequence of samples from population of one", () => {
        const trades: ITrade[] = [
            {
                entryPrice: 5
            } as ITrade,
        ];
        const samples = monteCarlo(new DataFrame(trades), 3, 2);
        expect(samples.count()).to.eql(3);
        
        const first = samples.first();
        expect(first.count()).to.eql(2);
        expect(first.first().entryPrice).to.eql(5);
        expect(first.skip(1).first().entryPrice).to.eql(5);

        const second = samples.skip(1).first();
        expect(second.count()).to.eql(2);
        expect(second.first().entryPrice).to.eql(5);
        expect(second.skip(1).first().entryPrice).to.eql(5);
        
        const third = samples.skip(2).first();
        expect(third.count()).to.eql(2);
        expect(third.first().entryPrice).to.eql(5);
        expect(third.skip(1).first().entryPrice).to.eql(5);
    });

    it("can produce sequence of samples from population", () => {
        const trades: ITrade[] = [
            {
                entryPrice: 1
            } as ITrade,
            {
                entryPrice: 2
            } as ITrade,
            {
                entryPrice: 3
            } as ITrade,
            {
                entryPrice: 4
            } as ITrade,
        ];
        const samples = monteCarlo(new DataFrame(trades), 4, 3);
        expect(samples.count()).to.eql(4);

        expect(samples.select(trades => trades.toArray()).toArray()).to.eql(
            [                            
                [                        
                    {                    
                        "entryPrice": 3  
                    },                   
                    {                    
                        "entryPrice": 3  
                    },                   
                    {                    
                        "entryPrice": 3  
                    }                    
                ],                       
                [                        
                    {                    
                        "entryPrice": 4  
                    },                   
                    {                    
                        "entryPrice": 3  
                    },                   
                    {                    
                        "entryPrice": 4  
                    }                    
                ],                       
                [                        
                    {                    
                        "entryPrice": 3  
                    },                   
                    {                    
                        "entryPrice": 4  
                    },                   
                    {                    
                        "entryPrice": 2  
                    }                    
                ],                       
                [                        
                    {                    
                        "entryPrice": 3  
                    },                   
                    {                    
                        "entryPrice": 3  
                    },                   
                    {                    
                        "entryPrice": 2  
                    }                    
                ]                        
            ]                            
        );
    });
});
