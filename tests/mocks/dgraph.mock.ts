import { jest } from '@jest/globals';

// Mock Dgraph client and stub
export const mockTxn = {
  mutate: jest.fn(),
  commit: jest.fn(),
  discard: jest.fn(),
  queryWithVars: jest.fn(),
};

export const mockClient = {
  newTxn: jest.fn(() => mockTxn),
  alter: jest.fn(),
  close: jest.fn(),
};

export const mockClientStub = jest.fn();

// Mock dgraph-js module
jest.unstable_mockModule('dgraph-js', () => ({
  DgraphClient: jest.fn(() => mockClient),
  DgraphClientStub: jest.fn(() => mockClientStub),
  Mutation: jest.fn(),
  Operation: jest.fn(),
  Request: jest.fn(),
}));

export const resetDgraphMocks = (): void => {
  jest.clearAllMocks();
  mockTxn.mutate.mockResolvedValue({ getUidsMap: () => new Map([['entity', 'test-uid']]) });
  mockTxn.commit.mockResolvedValue(undefined);
  mockTxn.discard.mockResolvedValue(undefined);
  mockTxn.queryWithVars.mockResolvedValue({ getJson: () => ({ entities: [] }) });
  mockClient.alter.mockResolvedValue(undefined);
};