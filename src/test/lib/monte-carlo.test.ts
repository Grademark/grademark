import { assert, expect } from 'chai';
import { monteCarlo } from '../../lib/monte-carlo';
import { ITrade, backtest } from '../..';
import { DataFrame } from 'data-forge';

describe("monte-carlo", () => {

    it("zero trades produces zero samples", () => {
        const trades: ITrade[] = [];
        const samples = monteCarlo(trades, 2, 2);
        expect(samples.length).to.eql(0);
    });

    it("can produce sequence of samples from population of one", () => {
        const trades: ITrade[] = [
            {
                entryPrice: 5
            } as ITrade,
        ];
        const samples = monteCarlo(trades, 3, 2);
        expect(samples.length).to.eql(3);
        
        const first = samples[0];
        expect(first.length).to.eql(2);
        expect(first[0].entryPrice).to.eql(5);
        expect(first[1].entryPrice).to.eql(5);

        const second = samples[1];
        expect(second.length).to.eql(2);
        expect(second[0].entryPrice).to.eql(5);
        expect(second[1].entryPrice).to.eql(5);
        
        const third = samples[2];
        expect(third.length).to.eql(2);
        expect(third[0].entryPrice).to.eql(5);
        expect(third[1].entryPrice).to.eql(5);
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
        const samples = monteCarlo(trades, 4, 3);
        expect(samples.length).to.eql(4);

        expect(samples).to.eql(
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
