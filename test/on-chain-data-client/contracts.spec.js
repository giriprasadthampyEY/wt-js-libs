import { assert } from 'chai';
import sinon from 'sinon';
import Contracts from '../../src/on-chain-data-client/contracts';
import { SmartContractInstantiationError } from '../../src/on-chain-data-client/errors';

describe('WTLibs.Contracts', () => {
  let contracts, getCodeStub, ContractStub;

  beforeEach(() => {
    getCodeStub = sinon.stub().resolves('0x01');
    ContractStub = sinon.spy();
    contracts = Contracts.createInstance('http://localhost:8545');
    contracts.web3Eth.getCode = getCodeStub;
    contracts.web3Eth.Contract = ContractStub;
  });

  it('should throw on an invalid address', async () => {
    try {
      await contracts._getInstance('some', {}, 'address');
      throw new Error('should not have been called');
    } catch (e) {
      assert.match(e.message, /at an invalid address/i);
      assert.instanceOf(e, SmartContractInstantiationError);
    }
  });

  it('should throw if no code exists on the address', async () => {
    contracts.web3Eth.getCode = sinon.stub().returns('0x0');
    try {
      await contracts._getInstance('some', {}, '0x36bbf6b87d1a770edd5d64145cc617385c66885d');
      throw new Error('should not have been called');
    } catch (e) {
      assert.match(e.message, /address with no code/i);
      assert.instanceOf(e, SmartContractInstantiationError);
    }
  });

  it('should get organization directory instance', async () => {
    await contracts.getSegmentDirectoryInstance('0x0C4c734F0Ecb92270D1ebE7b04aEC4440EB05CAa');
    assert.equal(ContractStub.calledWithNew(), true);
  });

  it('should reuse existing organization contract instances', async () => {
    await contracts.getSegmentDirectoryInstance('0x0C4c734F0Ecb92270D1ebE7b04aEC4440EB05CAa');
    assert.equal(ContractStub.calledWithNew(), true);
    await contracts.getSegmentDirectoryInstance('0x0C4c734F0Ecb92270D1ebE7b04aEC4440EB05CAa');
    assert.equal(ContractStub.callCount, 1);
  });

  it('should get organization instance', async () => {
    await contracts.getOrganizationInstance('0x8C2373842D5EA4Ce4Baf53f4175e5e42a364c59C');
    assert.equal(ContractStub.calledWithNew(), true);
  });

  it('should not panic on empty logs', async () => {
    assert.isEmpty(await contracts.decodeLogs([]));
    assert.isEmpty(await contracts.decodeLogs([{}]));
    assert.isEmpty(await contracts.decodeLogs([{ topics: [] }]));
  });

  it('should work properly for real anonymous events', async () => {
    const decodedLogs = await contracts.decodeLogs([{
      logIndex: 0,
      transactionIndex: 0,
      transactionHash: '0x6458dd74c57a4c102784eabadccfdd1fa46f0d09d96561f63aa0a92393b6cfbe',
      blockHash: '0x99546e6a42f2c9856c0c87134f85b42170302fcd4a65a96f50c71d85d4bc6d63',
      blockNumber: 20,
      address: '0x8C2373842D5EA4Ce4Baf53f4175e5e42a364c59C',
      data: '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003',
      topics:
     ['0x424a91ecdb11da88654837a0ff14d402e92593aabef26295b0a7257f44bb2b22',
       '0x0000000000000000000000000c4c734f0ecb92270d1ebe7b04aec4440eb05caa'],
      type: 'mined',
      id: 'log_43221c70',
    }],
    );

    assert.equal(decodedLogs.length, 1);
    assert.equal(decodedLogs[0].event, 'OrganizationAdded');
    assert.equal(decodedLogs[0].address, '0x8C2373842D5EA4Ce4Baf53f4175e5e42a364c59C');
    assert.equal(decodedLogs[0].attributes.length, 2);
    assert.equal(decodedLogs[0].attributes[0].name, 'organization');
    assert.equal(decodedLogs[0].attributes[1].name, 'index');
    assert.equal(decodedLogs[0].attributes[0].type, 'address');
    assert.equal(decodedLogs[0].attributes[1].type, 'uint256');
    assert.equal(decodedLogs[0].attributes[0].value, '0x0C4c734F0Ecb92270D1ebE7b04aEC4440EB05CAa');
    assert.equal(decodedLogs[0].attributes[1].value, '1');
  });
});
