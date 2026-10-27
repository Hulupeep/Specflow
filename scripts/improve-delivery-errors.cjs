'use strict';
const {ServiceError}=require('./improve-service-errors.cjs');
// Trusted adapter control-flow proof: its write callback was never invoked.
// No JSON/HTTP/MCP payload can instantiate this capability.
class NotIssued extends ServiceError{constructor(code){super(code,503);}}
module.exports={NotIssued};
