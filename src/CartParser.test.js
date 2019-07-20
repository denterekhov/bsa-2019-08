import CartParser from './CartParser';
import fs from 'fs';
// import { readFileSync } from 'fs';
const { readFileSync } = jest.requireActual('fs');

const uuidv4 = require('uuid/v4');
const path = require('path');

jest.mock('uuid/v4');
jest.mock('fs');

let parser;

beforeEach(() => {
  parser = new CartParser();
});

describe('CartParser - unit tests', () => {
  describe('validation tests', () => {
    it('should return error when column name does not meet the requirements', () => {
      const contents = `
        Not a product name,Price,Quantity
        Mollis consequat,9.00,2
        Tvoluptatem,10.32,1
        Scelerisque lacinia,18.90,1
        Consectetur adipiscing,28.72,10
        Condimentum aliquet,13.90,1
      `;

      const expectedError = {
        type:    'header',
        row:     0,
        column:  0,
        message: `Expected header to be named "${parser.schema.columns[0].name}" but received Not a product name.`,
      };

      const error = parser.validate(contents)[0];

      expect(error).toEqual(expectedError);
    });

    it('should return error when row length does not meet the requirements', () => {
      const contents = `
        Product name,Price,Quantity
        Mollis consequat,9.00,2
        Tvoluptatem,10.32,1
        Scelerisque lacinia,18.90,1
        Consectetur adipiscing,28.72,10
        Condimentum aliquet,13.90`;

      const expectedError = {
        type:    `${parser.ErrorType.ROW}`,
        row:     5,
        column:  -1,
        message: `Expected row to have ${parser.schema.columns.length} cells but received 2.`,
      };

      const error = parser.validate(contents)[0];

      expect(error).toEqual(expectedError);
    });

    it('should return error when cell contains empty string', () => {
      const emptyString = '';
      const contents = `
        Product name,Price,Quantity
        ${emptyString},9.00,2
        Tvoluptatem,10.32,1
        Scelerisque lacinia,18.90,1
        Consectetur adipiscing,28.72,10
        Condimentum aliquet,13.90,1`;

      const expectedError = {
        type:    `${parser.ErrorType.CELL}`,
        row:     1,
        column:  0,
        message: `Expected cell to be a nonempty string but received "${emptyString}".`,
      };

      const error = parser.validate(contents)[0];

      expect(error).toEqual(expectedError);
    });

    it('should return error when cell contains negative number', () => {
      const negativeNumber = -3;
      const contents = `
        Product name,Price,Quantity
        Mollis consequat,${negativeNumber},2
        Tvoluptatem,10.32,1
        Scelerisque lacinia,18.90,1
        Consectetur adipiscing,28.72,10
        Condimentum aliquet,13.90,1`;

      const expectedError = {
        type:    `${parser.ErrorType.CELL}`,
        row:     1,
        column:  1,
        message: `Expected cell to be a positive number but received "${negativeNumber}".`,
      };

      const error = parser.validate(contents)[0];

      expect(error).toEqual(expectedError);
    });

    it('should return error when data contains several errors', () => {
      const negativeNumber = -3;
      const notAProductName = 'Not a product name';

      const contents = `
        ${notAProductName},Price,Quantity
        Mollis consequat,${negativeNumber},2
        Tvoluptatem,10.32,1
        Scelerisque lacinia,18.90,1
        Consectetur adipiscing,28.72,10
        Condimentum aliquet,13.90,1`;

      const expectedErrors = [
        {
          type:    `${parser.ErrorType.HEADER}`,
          row:     0,
          column:  0,
          message: `Expected header to be named "${parser.schema.columns[0].name}" but received Not a product name.`,
        },
        {
          type:    `${parser.ErrorType.CELL}`,
          row:     1,
          column:  1,
          message: `Expected cell to be a positive number but received "${negativeNumber}".`,
        }
      ];

      const errors = parser.validate(contents);

      expect(errors).toEqual(expectedErrors);
    });

    it('should not emit any error when data with right shape passed to function', () => {
      const contents = `
        Product name,Price,Quantity
        Mollis consequat,9.00,2
        Tvoluptatem,10.32,1
        Scelerisque lacinia,18.90,1
        Consectetur adipiscing,28.72,10
        Condimentum aliquet,13.90,1`;

      const errors = parser.validate(contents);

      expect(errors).toHaveLength(0);
    });
  });

  describe('calculation test', () => {
    it('should calculate sum correctly', () => {
      const items = [
        {
          "id":       "3e6def17-5e87-4f27-b6b8-ae78948523a9",
          "name":     "Mollis consequat",
          "price":    9,
          "quantity": 2,
        },
        {
          "id":       "90cd22aa-8bcf-4510-a18d-ec14656d1f6a",
          "name":     "Tvoluptatem",
          "price":    10.32,
          "quantity": 1,
        },
        {
          "id":       "33c14844-8cae-4acd-91ed-6209a6c0bc31",
          "name":     "Scelerisque lacinia",
          "price":    18.9,
          "quantity": 1,
        },
        {
          "id":       "f089a251-a563-46ef-b27b-5c9f6dd0afd3",
          "name":     "Consectetur adipiscing",
          "price":    28.72,
          "quantity": 10,
        },
        {
          "id":       "0d1cbe5e-3de6-4f6a-9c53-bab32c168fbf",
          "name":     "Condimentum aliquet",
          "price":    13.9,
          "quantity": 1,
        }
      ];

      const expectedTotal = 348.32;
      const total = parser.calcTotal(items);

      expect(total).toBeCloseTo(expectedTotal);
    });
  });

  describe('parsing tests', () => {
    beforeEach(() => {
      jest.mock('fs');
    });
    it('should parse row correctly when data with right shape passed to function', () => {
      const csvLine = `Mollis consequat,9.00,2.5`;
      const mockedId = uuidv4();

      const expectedResult = {
        id:       mockedId,
        name:     'Mollis consequat',
        price:    9,
        quantity: 2.5,
      };

      const result = parser.parseLine(csvLine);

      expect(result).toEqual(expectedResult);
    });

    it('should emit error when data does not meet the requirements', () => {
      const negativeNumber = -3;
      const contents = `
        Product name,Price,Quantity
        Mollis consequat,${negativeNumber},2
        Tvoluptatem,10.32,1
        Scelerisque lacinia,18.90,1
        Consectetur adipiscing,28.72,10
        Condimentum aliquet,13.90,1`;

      fs.readFileSync.mockReturnValueOnce(contents);

      expect(() => parser.parse()).toThrow('Validation failed!');
    });
  });
});

describe('CartParser - integration test', () => {
  it('should return correct JSON object', () => {
    const result = parser.parse(path.resolve(__dirname, '../samples/cart.csv'));
    const mockedId = uuidv4();
    const expectedResult = {
      "items": [
        {
          "id":       mockedId,
          "name":     "Mollis consequat",
          "price":    9,
          "quantity": 2,
        },
        {
          "id":       mockedId,
          "name":     "Tvoluptatem",
          "price":    10.32,
          "quantity": 1,
        },
        {
          "id":       mockedId,
          "name":     "Scelerisque lacinia",
          "price":    18.9,
          "quantity": 1,
        },
        {
          "id":       mockedId,
          "name":     "Consectetur adipiscing",
          "price":    28.72,
          "quantity": 10,
        },
        {
          "id":       mockedId,
          "name":     "Condimentum aliquet",
          "price":    13.9,
          "quantity": 1,
        }
      ],
      "total": 348.32,
    };

    expect(result).toEqual(expectedResult);
  });
});
