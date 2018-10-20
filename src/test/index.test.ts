import { assert, expect } from 'chai';
import 'mocha';
import { ExampleClass } from '../index';

describe('main test suite', () => {

    it('should be true', ()  => {

        expect((new ExampleClass()).returnsTrue()).to.be.true;      

    });

});
