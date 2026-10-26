'use strict';
const cfg=require(require('path').resolve(process.argv[2])),{OperationReceipts}=require('../../../scripts/improve-operation-receipts.cjs');
new OperationReceipts({...cfg.options,fault:(phase,detail)=>{if(phase===cfg.killAt&&detail?.kind==='receipts')process.kill(process.pid,'SIGKILL');}}).put(cfg.input);
