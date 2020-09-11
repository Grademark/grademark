const MersenneTwister = require('mersennetwister');

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 * 
 * https://stackoverflow.com/a/1527820/25868
 */
function getRandomArbitrary(random: any, min: number, max: number): number {
    return random.real() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 * 
 * https://stackoverflow.com/a/1527820/25868
 */
function getRandomInt(random: any, min: number, max: number): number {
    return Math.floor(random.real() * (max - min + 1)) + min;
}

export class Random {
    
    //
    // Random number generator.
    //
    private random: any;

    constructor(seed: number) {
        this.random = new MersenneTwister(seed);
    }

    //
    // Get a random number from the full range of real numbers.
    //
    getReal(): number;

    //
    // Get a random real number in the requested range.
    //
    getReal(min?: number, max?: number): number {
        
        if (min === undefined) {
            min = Number.MIN_VALUE;
        }

        if (max === undefined) {
            max = Number.MAX_VALUE;
        }

        return getRandomArbitrary(this.random, min, max);
    }

    //
    // Get a random integer in the requested range.
    //
    getInt(min: number, max: number): number {
        return getRandomInt(this.random, min, max);
    }

}