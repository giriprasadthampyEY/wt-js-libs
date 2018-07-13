import isFunction from 'lodash.isfunction';
import sinon from 'sinon';

function stubPromiEvent (sendSetup = { txHash: true, receipt: true, error: false, catch: false }) {
  return {
    on: function (evt, callback) {
      if (evt === 'transactionHash' && sendSetup.txHash) {
        callback('tx-hash'); // eslint-disable-line standard/no-callback-literal
      }
      if (evt === 'receipt' && sendSetup.receipt) {
        callback({ some: 'receipt' }); // eslint-disable-line standard/no-callback-literal
      }
      if (evt === 'error' && sendSetup.error) {
        let message = typeof sendSetup.error === 'string' ? sendSetup.error : 'on error handler fired';
        callback({ message: message }); // eslint-disable-line standard/no-callback-literal
      }
      return this;
    },
    catch: function (callback) {
      let message = typeof sendSetup.catch === 'string' ? sendSetup.catch : 'send catch fired';
      callback({ message: message }); // eslint-disable-line standard/no-callback-literal
    },
  };
}

function stubContractMethodResult (callResult, sendSetup = { txHash: true, receipt: true, error: false, catch: false }, estimatedGas = 33) {
  let methodParams = arguments;
  let finalCallResult = callResult;
  if (isFunction(callResult)) {
    finalCallResult = callResult({
      methodParams: methodParams,
      callParams: arguments,
    });
  }

  const methodMock = {
    call: sinon.stub().returns(finalCallResult),
    encodeABI: sinon.stub().returns('encoded-abi-' + callResult),
    send: sinon.stub().returns(stubPromiEvent(sendSetup)),
    estimateGas: sinon.stub().returns(estimatedGas),
  };

  return function () {
    return methodMock;
  };
}

export default {
  stubContractMethodResult: stubContractMethodResult,
  stubPromiEvent: stubPromiEvent,
};
